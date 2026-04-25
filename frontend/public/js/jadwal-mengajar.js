/**
 * Jadwal Mengajar Management
 * CRUD operations for teaching schedules
 */

// State
let allJadwal = [];
let allGuru = [];
let guruAssignments = {}; // Cache: { guru_username: [assignments] }
let currentPage = 1;
let pageSize = 20;
let totalPages = 1;
let searchTimeout = null;
let deleteTargetId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Check access - only superadmin
    const role = localStorage.getItem('user_role');
    if (role !== 'superadmin') {
        document.getElementById('admin-view').style.display = 'none';
        document.getElementById('access-denied-view').style.display = 'block';
        return;
    }

    // Update topbar date
    updateTopbarDate();

    // Load initial data
    await Promise.all([
        loadGuruList(),
        loadJadwalData()
    ]);
});

function updateTopbarDate() {
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        dateEl.textContent = '📅 ' + now.toLocaleDateString('id-ID', options);
    }
}

// ============================================
// DATA LOADING
// ============================================

async function loadGuruList() {
    try {
        const response = await window.apiFetch('users/?role=guru&is_active=true&limit=200');
        if (!response.ok) throw new Error('Failed to load guru');

        const data = await response.json();
        allGuru = data.results || data || [];

        // Populate filter dropdown
        const filterGuru = document.getElementById('filter-guru');
        const formGuru = document.getElementById('form-guru');

        allGuru.forEach(guru => {
            const option = document.createElement('option');
            option.value = guru.username;
            option.textContent = `${guru.name || guru.username}`;

            filterGuru.appendChild(option.cloneNode(true));
            formGuru.appendChild(option);
        });

        // Update stats
        document.getElementById('total-guru').textContent = allGuru.length;

    } catch (error) {
        console.error('[JadwalMengajar] Error loading guru:', error);
        showToast('Gagal memuat daftar guru', 'error');
    }
}

async function loadJadwalData() {
    const tbody = document.getElementById('jadwal-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                <div class="loading-spinner"></div>
                <p class="text-muted">Memuat data...</p>
            </td>
        </tr>
    `;

    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('page_size', pageSize);

        const search = document.getElementById('filter-search')?.value?.trim();
        const guru = document.getElementById('filter-guru')?.value;
        const kelas = document.getElementById('filter-kelas')?.value;
        const hari = document.getElementById('filter-hari')?.value;

        if (search) params.append('search', search);
        if (guru) params.append('username', guru);
        if (kelas) params.append('kelas', kelas);
        if (hari) params.append('hari', hari);

        const response = await window.apiFetch(`schedules/?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load schedules');

        const data = await response.json();

        // Handle paginated vs non-paginated response
        if (data.results) {
            allJadwal = data.results;
            totalPages = Math.ceil(data.count / pageSize) || 1;
        } else {
            allJadwal = data;
            totalPages = 1;
        }

        renderJadwalTable();
        updateStats(data);
        updatePagination();

    } catch (error) {
        console.error('[JadwalMengajar] Error loading jadwal:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <p>Gagal memuat data jadwal</p>
                    <button class="btn btn-sm btn-primary" onclick="loadJadwalData()">Coba Lagi</button>
                </td>
            </tr>
        `;
    }
}

function updateStats(data) {
    const total = data.count || allJadwal.length;
    document.getElementById('total-jadwal').textContent = total;

    // Count unique kelas
    const uniqueKelas = new Set(allJadwal.map(j => j.kelas));
    document.getElementById('total-kelas').textContent = uniqueKelas.size;

    // Count active
    const activeCount = allJadwal.filter(j => j.is_active).length;
    document.getElementById('jadwal-aktif').textContent = activeCount;

    // Update result count
    document.getElementById('result-count').textContent = `${total} jadwal`;
}

// ============================================
// TABLE RENDERING
// ============================================

function renderJadwalTable() {
    const tbody = document.getElementById('jadwal-table-body');

    if (!allJadwal || allJadwal.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted" style="padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
                    <p>Belum ada jadwal mengajar</p>
                    <button class="btn btn-primary btn-sm" onclick="openCreateModal()">+ Tambah Jadwal</button>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allJadwal.map(jadwal => {
        const guru = allGuru.find(g => g.username === jadwal.username) || {};
        const initials = getInitials(guru.name || jadwal.username);
        const hariClass = `badge-${jadwal.hari.toLowerCase()}`;

        // Format waktu
        let waktuDisplay = '-';
        if (jadwal.jam_mulai && jadwal.jam_selesai) {
            waktuDisplay = `${jadwal.jam_mulai} - ${jadwal.jam_selesai}`;
        } else if (jadwal.jam) {
            waktuDisplay = jadwal.jam;
        }

        return `
            <tr data-id="${jadwal.id}">
                <td>
                    <div class="guru-cell">
                        <div class="guru-avatar">${initials}</div>
                        <div class="guru-info">
                            <span class="guru-name">${escapeHtml(guru.name || jadwal.username)}</span>
                            <span class="guru-username">@${escapeHtml(jadwal.username)}</span>
                        </div>
                    </div>
                </td>
                <td><strong>${escapeHtml(jadwal.kelas)}</strong></td>
                <td>${escapeHtml(jadwal.mata_pelajaran || '-')}</td>
                <td><span class="badge-hari ${hariClass}">${jadwal.hari}</span></td>
                <td>${jadwal.jam_ke ? `<span class="jam-badge">Jam ${jadwal.jam_ke}</span>` : '-'}</td>
                <td><span class="waktu-display">${waktuDisplay}</span></td>
                <td>
                    <span class="badge ${jadwal.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${jadwal.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" onclick="editJadwal(${jadwal.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="openDeleteModal(${jadwal.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getInitials(name) {
    if (!name) return '??';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ============================================
// FILTERING & SEARCH
// ============================================

function debounceSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadJadwalData();
    }, 300);
}

function applyFilters() {
    currentPage = 1;
    loadJadwalData();
}

// ============================================
// PAGINATION
// ============================================

function updatePagination() {
    const pageInfo = document.getElementById('page-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= totalPages;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadJadwalData();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadJadwalData();
    }
}

// ============================================
// MODAL HANDLERS
// ============================================

function openCreateModal() {
    document.getElementById('modal-title').textContent = 'Tambah Jadwal Baru';
    document.getElementById('form-jadwal-id').value = '';
    document.getElementById('jadwal-form').reset();

    // Reset dependent dropdowns
    document.getElementById('form-kelas').innerHTML = '<option value="">-- Pilih Kelas --</option>';
    document.getElementById('form-mapel').innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

    document.getElementById('jadwal-modal-overlay').classList.add('active');
}

async function editJadwal(id) {
    const jadwal = allJadwal.find(j => j.id === id);
    if (!jadwal) {
        showToast('Jadwal tidak ditemukan', 'error');
        return;
    }

    document.getElementById('modal-title').textContent = 'Edit Jadwal';
    document.getElementById('form-jadwal-id').value = id;

    // Set guru first, then load assignments
    document.getElementById('form-guru').value = jadwal.username;
    await onGuruChange();

    // Set kelas and mapel
    document.getElementById('form-kelas').value = jadwal.kelas;
    await onKelasChange();
    document.getElementById('form-mapel').value = jadwal.mata_pelajaran || '';

    // Set other fields
    document.getElementById('form-hari').value = jadwal.hari;
    document.getElementById('form-jam-ke').value = jadwal.jam_ke || '';
    document.getElementById('form-jam-mulai').value = jadwal.jam_mulai || '';
    document.getElementById('form-jam-selesai').value = jadwal.jam_selesai || '';
    document.getElementById('form-status').value = jadwal.is_active ? 'true' : 'false';

    document.getElementById('jadwal-modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('jadwal-modal-overlay').classList.remove('active');
}

function openDeleteModal(id) {
    deleteTargetId = id;
    const jadwal = allJadwal.find(j => j.id === id);
    if (!jadwal) return;

    const guru = allGuru.find(g => g.username === jadwal.username) || {};

    document.getElementById('delete-jadwal-info').innerHTML = `
        <strong>${escapeHtml(guru.name || jadwal.username)}</strong><br>
        ${escapeHtml(jadwal.kelas)} - ${escapeHtml(jadwal.mata_pelajaran || '-')}<br>
        ${jadwal.hari} ${jadwal.jam_ke ? `Jam ${jadwal.jam_ke}` : ''}
    `;

    document.getElementById('delete-modal-overlay').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal-overlay').classList.remove('active');
    deleteTargetId = null;
}

// ============================================
// DYNAMIC DROPDOWNS (Guru → Kelas → Mapel)
// ============================================

async function onGuruChange() {
    const username = document.getElementById('form-guru').value;
    const kelasSelect = document.getElementById('form-kelas');
    const mapelSelect = document.getElementById('form-mapel');

    // Reset
    kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

    if (!username) return;

    try {
        // Check cache first
        if (!guruAssignments[username]) {
            const response = await window.apiFetch(`admin/assignments/?user__username=${username}&status=active`);
            if (response.ok) {
                const data = await response.json();
                guruAssignments[username] = data.results || data || [];
            } else {
                guruAssignments[username] = [];
            }
        }

        const assignments = guruAssignments[username];

        // Get unique kelas from assignments
        const kelasSet = new Set();
        assignments.forEach(a => {
            if (a.kelas && (a.assignment_type === 'kbm' || a.assignment_type === 'diniyah')) {
                kelasSet.add(a.kelas);
            }
        });

        // If no assignments, show all kelas
        if (kelasSet.size === 0) {
            const allKelas = ['X A', 'X B', 'X C', 'XI A', 'XI B', 'XI C', 'XII A', 'XII B', 'XII C'];
            allKelas.forEach(k => {
                const option = document.createElement('option');
                option.value = k;
                option.textContent = k;
                kelasSelect.appendChild(option);
            });
        } else {
            Array.from(kelasSet).sort().forEach(k => {
                const option = document.createElement('option');
                option.value = k;
                option.textContent = k;
                kelasSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error('[JadwalMengajar] Error loading assignments:', error);
        // Fallback: show all kelas
        const allKelas = ['X A', 'X B', 'X C', 'XI A', 'XI B', 'XI C', 'XII A', 'XII B', 'XII C'];
        allKelas.forEach(k => {
            const option = document.createElement('option');
            option.value = k;
            option.textContent = k;
            kelasSelect.appendChild(option);
        });
    }
}

async function onKelasChange() {
    const username = document.getElementById('form-guru').value;
    const kelas = document.getElementById('form-kelas').value;
    const mapelSelect = document.getElementById('form-mapel');

    // Reset
    mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

    if (!username || !kelas) return;

    const assignments = guruAssignments[username] || [];

    // Get mapel for this guru + kelas
    const mapelSet = new Set();
    assignments.forEach(a => {
        if (a.kelas === kelas && a.mata_pelajaran) {
            mapelSet.add(a.mata_pelajaran);
        }
    });

    // If no specific mapel, allow free input (add common ones)
    if (mapelSet.size === 0) {
        const commonMapel = [
            'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Bahasa Arab',
            'IPA', 'IPS', 'PKN', 'PAI', 'Fiqih', 'Aqidah', 'Akhlak',
            'Al-Quran Hadist', 'SKI', 'Penjaskes', 'Seni Budaya', 'TIK'
        ];
        commonMapel.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            mapelSelect.appendChild(option);
        });
    } else {
        Array.from(mapelSet).sort().forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            mapelSelect.appendChild(option);
        });
    }
}

// ============================================
// CRUD OPERATIONS
// ============================================

async function saveJadwal(event) {
    event.preventDefault();

    const id = document.getElementById('form-jadwal-id').value;
    const isEdit = !!id;

    const payload = {
        username: document.getElementById('form-guru').value,
        kelas: document.getElementById('form-kelas').value,
        mata_pelajaran: document.getElementById('form-mapel').value,
        hari: document.getElementById('form-hari').value,
        jam_ke: document.getElementById('form-jam-ke').value || null,
        jam_mulai: document.getElementById('form-jam-mulai').value || null,
        jam_selesai: document.getElementById('form-jam-selesai').value || null,
        is_active: document.getElementById('form-status').value === 'true'
    };

    // Validate
    if (!payload.username || !payload.kelas || !payload.hari) {
        showToast('Harap lengkapi field wajib', 'error');
        return;
    }

    try {
        const url = isEdit ? `schedules/${id}/` : 'schedules/';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await window.apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.message || 'Gagal menyimpan jadwal');
        }

        showToast(isEdit ? 'Jadwal berhasil diperbarui' : 'Jadwal berhasil ditambahkan', 'success');
        closeModal();
        loadJadwalData();

    } catch (error) {
        console.error('[JadwalMengajar] Error saving:', error);
        showToast(error.message || 'Gagal menyimpan jadwal', 'error');
    }
}

async function confirmDelete() {
    if (!deleteTargetId) return;

    try {
        const response = await window.apiFetch(`schedules/${deleteTargetId}/`, {
            method: 'DELETE'
        });

        if (!response.ok && response.status !== 204) {
            throw new Error('Gagal menghapus jadwal');
        }

        showToast('Jadwal berhasil dihapus', 'success');
        closeDeleteModal();
        loadJadwalData();

    } catch (error) {
        console.error('[JadwalMengajar] Error deleting:', error);
        showToast(error.message || 'Gagal menghapus jadwal', 'error');
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

// Export functions for global access
window.openCreateModal = openCreateModal;
window.editJadwal = editJadwal;
window.closeModal = closeModal;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.saveJadwal = saveJadwal;
window.onGuruChange = onGuruChange;
window.onKelasChange = onKelasChange;
window.debounceSearch = debounceSearch;
window.applyFilters = applyFilters;
window.prevPage = prevPage;
window.nextPage = nextPage;
