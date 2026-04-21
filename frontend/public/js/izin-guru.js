/**
 * Izin Guru - Portal Ponpes Baron v2.3.9
 * ======================================
 */

// State
let izinData = [];
let isAdmin = false;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[IzinGuru] Initializing...');

    // Get user role
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || '';

    // Check if admin (can see all data)
    isAdmin = ['superadmin', 'pimpinan', 'bk'].includes(role);

    // Hide form for pimpinan/superadmin (they don't need to submit leave)
    if (['superadmin', 'pimpinan'].includes(role)) {
        const formSection = document.getElementById('form-section');
        if (formSection) formSection.style.display = 'none';
    }

    // Update table title and show guru column for admin
    if (isAdmin) {
        const tableTitle = document.getElementById('table-title');
        if (tableTitle) tableTitle.textContent = 'Rekap Izin Semua Guru';

        const thGuru = document.getElementById('th-guru');
        if (thGuru) thGuru.style.display = '';
    }

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const inputTanggalMulai = document.getElementById('input-tanggal-mulai');
    const inputTanggalSelesai = document.getElementById('input-tanggal-selesai');

    if (inputTanggalMulai) inputTanggalMulai.value = today;
    if (inputTanggalSelesai) inputTanggalSelesai.value = today;

    // Set topbar date
    setTopbarDate();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Setup form handler
    const form = document.getElementById('form-izin');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Setup file input preview
    const fileInput = document.getElementById('input-foto');
    if (fileInput) {
        fileInput.addEventListener('change', handleFilePreview);
    }

    // Load data
    await loadIzinList();
});

// ============================================
// DATA LOADING
// ============================================

async function loadIzinList() {
    console.log('[IzinGuru] Loading izin list...');

    const tbody = document.getElementById('tbody-izin');
    const emptyState = document.getElementById('empty-state');
    const badge = document.getElementById('izin-badge');
    const tableContainer = document.querySelector('.table-container');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="${isAdmin ? 6 : 5}" class="text-center">
                <div class="loading-spinner" style="margin: 30px auto;"></div>
            </td>
        </tr>
    `;

    try {
        // Build query params
        const params = new URLSearchParams();

        const filterDari = document.getElementById('filter-dari')?.value;
        const filterSampai = document.getElementById('filter-sampai')?.value;
        const filterJenis = document.getElementById('filter-jenis')?.value;

        if (filterDari) params.append('tanggal_mulai', filterDari);
        if (filterSampai) params.append('tanggal_selesai', filterSampai);
        if (filterJenis) params.append('jenis', filterJenis);

        const url = `/kesantrian/izin-guru/${params.toString() ? '?' + params.toString() : ''}`;
        const response = await window.apiFetch(url);

        if (!response || !response.ok) {
            throw new Error('Gagal memuat data izin');
        }

        const result = await response.json();

        if (result.success) {
            izinData = result.data || [];
            renderIzinTable(izinData);

            // Update badge
            if (badge) badge.textContent = `${izinData.length} data`;
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('[IzinGuru] Error:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="${isAdmin ? 6 : 5}" class="text-center text-muted">
                    Gagal memuat data: ${error.message}
                </td>
            </tr>
        `;
    }
}

// ============================================
// RENDERING
// ============================================

function renderIzinTable(data) {
    const tbody = document.getElementById('tbody-izin');
    const emptyState = document.getElementById('empty-state');
    const tableContainer = document.querySelector('.table-container');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (tableContainer) tableContainer.style.display = '';
    if (emptyState) emptyState.style.display = 'none';

    data.forEach((item) => {
        const tr = document.createElement('tr');

        const badgeClass = getBadgeClass(item.jenis_izin);
        const tanggalDisplay = `${formatDate(item.tanggal_mulai)} - ${formatDate(item.tanggal_selesai)}`;

        let html = '';

        // Guru column (admin only)
        if (isAdmin) {
            html += `<td>${escapeHtml(item.guru_nama || '-')}</td>`;
        }

        html += `
            <td><span class="status-badge ${badgeClass}">${escapeHtml(item.jenis_izin_display || item.jenis_izin)}</span></td>
            <td>${tanggalDisplay}</td>
            <td>${item.durasi_hari} hari</td>
            <td class="keterangan-cell">${escapeHtml(truncateText(item.keterangan, 50))}</td>
            <td>
                ${item.foto_surat_url ? `
                    <button class="btn btn-sm btn-outline" onclick="openFotoModal('${escapeHtml(item.foto_surat_url)}', '${escapeHtml(item.guru_nama || 'Guru')}')">
                        <i data-lucide="image"></i> Lihat
                    </button>
                ` : '<span class="text-muted">-</span>'}
            </td>
        `;

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });

    // Re-init Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function getBadgeClass(jenis) {
    const classMap = {
        'sakit': 'badge-red',
        'dinas': 'badge-blue',
        'keperluan_keluarga': 'badge-purple',
        'lainnya': 'badge-gray'
    };
    return classMap[jenis] || 'badge-gray';
}

// ============================================
// FORM HANDLING
// ============================================

async function handleSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const btnSubmit = document.getElementById('btn-submit');

    // Get form values
    const jenisIzin = document.getElementById('input-jenis').value;
    const tanggalMulai = document.getElementById('input-tanggal-mulai').value;
    const tanggalSelesai = document.getElementById('input-tanggal-selesai').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();
    const fotoInput = document.getElementById('input-foto');

    // Validation
    if (!jenisIzin || !tanggalMulai || !tanggalSelesai || !keterangan) {
        alert('⚠️ Harap lengkapi semua field yang wajib diisi.');
        return;
    }

    if (tanggalSelesai < tanggalMulai) {
        alert('⚠️ Tanggal selesai harus sama atau setelah tanggal mulai.');
        return;
    }

    if (!fotoInput.files || fotoInput.files.length === 0) {
        alert('⚠️ Foto surat izin wajib diupload.');
        return;
    }

    // Disable button
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i data-lucide="loader"></i> Mengirim...';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('jenis_izin', jenisIzin);
        formData.append('tanggal_mulai', tanggalMulai);
        formData.append('tanggal_selesai', tanggalSelesai);
        formData.append('keterangan', keterangan);
        formData.append('foto_surat', fotoInput.files[0]);

        const response = await window.apiFetch('/kesantrian/izin-guru/', {
            method: 'POST',
            body: formData
            // Don't set Content-Type header - browser will set it with boundary for multipart
        });

        if (!response || !response.ok) {
            const errorData = await response?.json();
            throw new Error(errorData?.message || 'Gagal mengajukan izin');
        }

        const result = await response.json();

        if (result.success) {
            alert('✅ Izin berhasil diajukan!');

            // Reset form
            form.reset();
            removePreview();

            // Set default dates again
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('input-tanggal-mulai').value = today;
            document.getElementById('input-tanggal-selesai').value = today;

            // Reload list
            await loadIzinList();
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('[IzinGuru] Error submitting:', error);
        alert('❌ Gagal mengajukan izin: ' + error.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i data-lucide="send"></i> Ajukan Izin';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

// ============================================
// FILE PREVIEW
// ============================================

function handleFilePreview(e) {
    const file = e.target.files[0];
    const fileNameDisplay = document.getElementById('file-name');
    const previewContainer = document.getElementById('foto-preview');
    const previewImg = document.getElementById('preview-img');

    if (file) {
        // Update file name display
        if (fileNameDisplay) {
            fileNameDisplay.textContent = file.name;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = function(event) {
            if (previewImg) previewImg.src = event.target.result;
            if (previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        if (fileNameDisplay) fileNameDisplay.textContent = 'Belum ada file';
        if (previewContainer) previewContainer.style.display = 'none';
    }
}

function removePreview() {
    const fileInput = document.getElementById('input-foto');
    const fileNameDisplay = document.getElementById('file-name');
    const previewContainer = document.getElementById('foto-preview');

    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) fileNameDisplay.textContent = 'Belum ada file';
    if (previewContainer) previewContainer.style.display = 'none';
}

// ============================================
// FOTO MODAL
// ============================================

function openFotoModal(url, guruNama) {
    const modal = document.getElementById('foto-modal');
    const modalImg = document.getElementById('modal-foto-img');
    const modalTitle = document.getElementById('foto-modal-title');
    const downloadLink = document.getElementById('foto-download-link');

    if (!modal) return;

    if (modalTitle) modalTitle.textContent = `Foto Surat - ${guruNama}`;
    if (modalImg) modalImg.src = url;
    if (downloadLink) downloadLink.href = url;

    modal.classList.add('show');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeFotoModal() {
    const modal = document.getElementById('foto-modal');
    if (modal) modal.classList.remove('show');
}

// ============================================
// EXPORT PDF
// ============================================

async function exportPDF() {
    const btnExport = document.getElementById('btn-export');

    // Build query params
    const params = new URLSearchParams();

    const filterDari = document.getElementById('filter-dari')?.value;
    const filterSampai = document.getElementById('filter-sampai')?.value;

    if (filterDari) params.append('tanggal_mulai', filterDari);
    if (filterSampai) params.append('tanggal_selesai', filterSampai);

    // Disable button
    if (btnExport) {
        btnExport.disabled = true;
        btnExport.innerHTML = '<i data-lucide="loader"></i> Mengunduh...';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const url = `/kesantrian/izin-guru/export-pdf/${params.toString() ? '?' + params.toString() : ''}`;

        // Get access token
        const accessToken = localStorage.getItem('access_token');

        const response = await fetch(window.API_BASE_URL + url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData?.message || 'Gagal mengunduh PDF');
        }

        // Get blob and download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `rekap_izin_guru_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        alert('✅ PDF berhasil diunduh!');

    } catch (error) {
        console.error('[IzinGuru] Export error:', error);
        alert('❌ Gagal mengunduh PDF: ' + error.message);
    } finally {
        if (btnExport) {
            btnExport.disabled = false;
            btnExport.innerHTML = '<i data-lucide="file-down"></i> Export PDF';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

// ============================================
// FILTER
// ============================================

function resetFilters() {
    document.getElementById('filter-dari').value = '';
    document.getElementById('filter-sampai').value = '';
    document.getElementById('filter-jenis').value = '';

    loadIzinList();
}

// ============================================
// UTILITIES
// ============================================

function setTopbarDate() {
    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        const today = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        topbarDate.textContent = '📅 ' + today.toLocaleDateString('id-ID', options);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.loadIzinList = loadIzinList;
window.resetFilters = resetFilters;
window.exportPDF = exportPDF;
window.openFotoModal = openFotoModal;
window.closeFotoModal = closeFotoModal;
window.removePreview = removePreview;
