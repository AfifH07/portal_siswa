/**
 * Master Mapel Management
 * CRUD operations for mata pelajaran
 */

// State
let allMapel = [];
let currentSesi = 'kbm';
let deleteTargetId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Check access - only superadmin/admin
    const role = localStorage.getItem('user_role');
    if (!['superadmin', 'admin'].includes(role)) {
        document.getElementById('admin-view').style.display = 'none';
        document.getElementById('access-denied-view').style.display = 'block';
        return;
    }

    // Update topbar date
    updateTopbarDate();

    // Load initial data
    await loadMapelData();
});

function updateTopbarDate() {
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
}

// ============================================
// DATA LOADING
// ============================================

async function loadMapelData() {
    const tbody = document.getElementById('mapel-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="4" class="text-center">
                <div class="loading-spinner"></div>
                <p>Memuat data...</p>
            </td>
        </tr>
    `;

    try {
        const response = await window.apiFetch('core/master-mapel/?include_inactive=true');
        if (!response.ok) throw new Error('Failed to load mapel');

        const data = await response.json();
        allMapel = data.data || [];

        // Update tab counts
        updateTabCounts();

        // Render current tab
        renderMapelTable();

    } catch (error) {
        console.error('[MasterMapel] Error loading data:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-danger">
                    <p>Gagal memuat data</p>
                    <button class="btn btn-sm btn-primary" onclick="loadMapelData()">Coba Lagi</button>
                </td>
            </tr>
        `;
    }
}

function updateTabCounts() {
    const counts = {
        kbm: allMapel.filter(m => m.sesi === 'kbm' && m.is_active).length,
        diniyah: allMapel.filter(m => m.sesi === 'diniyah' && m.is_active).length,
        tahfidz: allMapel.filter(m => m.sesi === 'tahfidz' && m.is_active).length,
    };

    document.getElementById('count-kbm').textContent = counts.kbm;
    document.getElementById('count-diniyah').textContent = counts.diniyah;
    document.getElementById('count-tahfidz').textContent = counts.tahfidz;
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(sesi) {
    currentSesi = sesi;

    // Update active tab
    document.querySelectorAll('.sesi-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.sesi === sesi);
    });

    // Re-render table
    renderMapelTable();
}

// ============================================
// TABLE RENDERING
// ============================================

function renderMapelTable() {
    const tbody = document.getElementById('mapel-table-body');
    const filteredMapel = allMapel.filter(m => m.sesi === currentSesi);

    if (filteredMapel.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <div class="empty-icon">📚</div>
                        <p>Belum ada mata pelajaran di sesi ini</p>
                        <button class="btn btn-primary btn-sm" onclick="openAddModal()">+ Tambah Mapel</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredMapel.map(mapel => `
        <tr data-id="${mapel.id}" class="${!mapel.is_active ? 'opacity-50' : ''}">
            <td>
                <span class="mapel-nama">${escapeHtml(mapel.nama)}</span>
            </td>
            <td>
                ${mapel.kode ? `<span class="mapel-kode">${escapeHtml(mapel.kode)}</span>` : '-'}
            </td>
            <td>
                <label class="status-toggle">
                    <input type="checkbox" ${mapel.is_active ? 'checked' : ''} onchange="toggleStatus(${mapel.id}, this.checked)">
                    <span class="status-slider"></span>
                </label>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="editMapel(${mapel.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="openDeleteModal(${mapel.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// MODAL HANDLERS
// ============================================

function openAddModal() {
    document.getElementById('modal-title').textContent = 'Tambah Mata Pelajaran';
    document.getElementById('form-id').value = '';
    document.getElementById('mapel-form').reset();
    document.getElementById('form-sesi').value = currentSesi;
    document.getElementById('mapel-modal').classList.add('active');
}

function editMapel(id) {
    const mapel = allMapel.find(m => m.id === id);
    if (!mapel) return;

    document.getElementById('modal-title').textContent = 'Edit Mata Pelajaran';
    document.getElementById('form-id').value = id;
    document.getElementById('form-nama').value = mapel.nama;
    document.getElementById('form-kode').value = mapel.kode || '';
    document.getElementById('form-sesi').value = mapel.sesi;
    document.getElementById('mapel-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('mapel-modal').classList.remove('active');
}

function openDeleteModal(id) {
    deleteTargetId = id;
    const mapel = allMapel.find(m => m.id === id);
    if (!mapel) return;

    document.getElementById('delete-mapel-name').textContent = mapel.nama;
    document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    deleteTargetId = null;
}

// ============================================
// CRUD OPERATIONS
// ============================================

async function saveMapel(event) {
    event.preventDefault();

    const id = document.getElementById('form-id').value;
    const isEdit = !!id;

    const payload = {
        nama: document.getElementById('form-nama').value.trim(),
        kode: document.getElementById('form-kode').value.trim(),
        sesi: document.getElementById('form-sesi').value
    };

    if (!payload.nama || !payload.sesi) {
        showToast('Nama dan Sesi harus diisi', 'error');
        return;
    }

    try {
        const url = isEdit ? `core/master-mapel/${id}/` : 'core/master-mapel/';
        const method = isEdit ? 'PATCH' : 'POST';

        const response = await window.apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan');
        }

        showToast(result.message || (isEdit ? 'Berhasil diupdate' : 'Berhasil ditambahkan'), 'success');
        closeModal();
        await loadMapelData();

        // Switch to the sesi of the saved mapel
        switchTab(payload.sesi);

    } catch (error) {
        console.error('[MasterMapel] Error saving:', error);
        showToast(error.message || 'Gagal menyimpan', 'error');
    }
}

async function toggleStatus(id, isActive) {
    try {
        const response = await window.apiFetch(`core/master-mapel/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });

        if (!response.ok) {
            throw new Error('Gagal mengubah status');
        }

        // Update local data
        const mapel = allMapel.find(m => m.id === id);
        if (mapel) {
            mapel.is_active = isActive;
            updateTabCounts();
        }

        showToast(isActive ? 'Mapel diaktifkan' : 'Mapel dinonaktifkan', 'success');

    } catch (error) {
        console.error('[MasterMapel] Error toggling status:', error);
        showToast('Gagal mengubah status', 'error');
        // Reload to reset UI
        await loadMapelData();
    }
}

async function confirmDelete() {
    if (!deleteTargetId) return;

    try {
        const response = await window.apiFetch(`core/master-mapel/${deleteTargetId}/`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal menghapus');
        }

        showToast(result.message || 'Berhasil dinonaktifkan', 'success');
        closeDeleteModal();
        await loadMapelData();

    } catch (error) {
        console.error('[MasterMapel] Error deleting:', error);
        showToast(error.message || 'Gagal menghapus', 'error');
    }
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Export to global scope
window.switchTab = switchTab;
window.openAddModal = openAddModal;
window.editMapel = editMapel;
window.closeModal = closeModal;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.saveMapel = saveMapel;
window.toggleStatus = toggleStatus;
window.confirmDelete = confirmDelete;
