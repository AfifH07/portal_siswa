/**
 * grades.js - PART 1
 * Fokus: Konfigurasi, Utilities, Modal Management, & Excel Import
 */

const GRADES_API_URL = '/api/grades/';

// ==========================================
// 1. GLOBAL STATE
// ==========================================
let currentImportStep = 1;
let searchDebounceTimer = null; // Timer untuk debounce search

// Import Context State - stores selected values for template download
const importContext = {
    kelas: '',
    mata_pelajaran: '',
    jenis: 'UH',
    semester: 'Ganjil',
    tahun_ajaran: '2024/2025'
};

// Cache for loaded classes (prevents multiple API calls)
let cachedClasses = null;

// ==========================================
// 2. UTILITY & TOAST FUNCTIONS
// ==========================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    
    // Reset classes
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.add('active');

    // Auto hide
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 3. MODAL MANAGEMENT
// ==========================================

/**
 * Load classes dynamically from API
 * Only shows classes that have active students
 * Includes timeout protection and fallback mechanism
 */
async function loadImportClasses() {
    const kelasSelect = document.getElementById('import-kelas');
    if (!kelasSelect) return;

    // Clear and show loading state
    kelasSelect.innerHTML = '<option value="">Memuat kelas...</option>';
    kelasSelect.disabled = true;

    try {
        // Use cached data if available (fast path)
        if (cachedClasses && cachedClasses.length > 0) {
            populateClassDropdown(kelasSelect, cachedClasses);
            kelasSelect.disabled = false;
            return;
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Token tidak ditemukan');
        }

        // Create abort controller with 5 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 5000);

        const response = await fetch('/api/students/classes/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Parse response
        const data = await response.json();

        // Check for API error response
        if (!response.ok || !data.success) {
            console.warn('API returned error:', data.message || data.error);
            throw new Error(data.message || 'Gagal memuat kelas');
        }

        // Validate classes data
        if (data.classes && Array.isArray(data.classes) && data.classes.length > 0) {
            cachedClasses = data.classes;
            populateClassDropdown(kelasSelect, data.classes);
            console.log(`Loaded ${data.classes.length} classes from API`);
        } else {
            // API returned empty list - use fallback
            console.warn('API returned empty classes list, using fallback');
            useFallbackClasses(kelasSelect);
        }

    } catch (error) {
        console.error('Error loading classes:', error);

        // Determine error type and show appropriate message
        if (error.name === 'AbortError') {
            console.warn('Request timeout - using fallback classes');
            showToast('Koneksi lambat, menggunakan data lokal', 'warning');
        } else if (error.message.includes('Token')) {
            showToast('Silakan login ulang', 'error');
        }

        // Always use fallback on any error
        useFallbackClasses(kelasSelect);

    } finally {
        // CRITICAL: Always re-enable dropdown
        kelasSelect.disabled = false;

        // Ensure "Memuat..." is replaced
        if (kelasSelect.options.length === 1 && kelasSelect.options[0].text.includes('Memuat')) {
            useFallbackClasses(kelasSelect);
        }
    }
}

/**
 * Use fallback static class options when API fails
 */
function useFallbackClasses(selectElement) {
    const fallbackClasses = ['X A', 'X B', 'X C', 'X D', 'XI A', 'XI B', 'XII A', 'XII B'];
    populateClassDropdown(selectElement, fallbackClasses);
    selectElement.disabled = false;
}

/**
 * Populate class dropdown with grouped options
 */
function populateClassDropdown(selectElement, classes) {
    // Group classes by level (X, XI, XII)
    const grouped = {};
    classes.forEach(kelas => {
        const level = kelas.split(' ')[0]; // Get "X", "XI", or "XII"
        if (!grouped[level]) grouped[level] = [];
        grouped[level].push(kelas);
    });

    let html = '<option value="">Pilih Kelas</option>';

    // Sort levels: X, XI, XII
    const levelOrder = ['X', 'XI', 'XII'];
    levelOrder.forEach(level => {
        if (grouped[level] && grouped[level].length > 0) {
            html += `<optgroup label="Kelas ${level}">`;
            grouped[level].sort().forEach(kelas => {
                html += `<option value="${kelas}">${kelas}</option>`;
            });
            html += '</optgroup>';
        }
    });

    // Add any other levels not in the standard order
    Object.keys(grouped).forEach(level => {
        if (!levelOrder.includes(level) && grouped[level].length > 0) {
            html += `<optgroup label="Kelas ${level}">`;
            grouped[level].sort().forEach(kelas => {
                html += `<option value="${kelas}">${kelas}</option>`;
            });
            html += '</optgroup>';
        }
    });

    selectElement.innerHTML = html;
    selectElement.disabled = false;
}

/**
 * Update import context state when form values change
 */
function updateImportContext() {
    importContext.kelas = document.getElementById('import-kelas')?.value || '';
    importContext.mata_pelajaran = document.getElementById('import-mata-pelajaran')?.value || '';
    importContext.jenis = document.getElementById('import-jenis')?.value || 'UH';
    importContext.semester = document.getElementById('import-semester')?.value || 'Ganjil';
    importContext.tahun_ajaran = document.getElementById('import-tahun-ajaran')?.value || '2024/2025';
}

function openImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.add('active');

        // Load classes dynamically from API
        loadImportClasses();

        // Reset form fields
        const kelas = document.getElementById('import-kelas');
        const mapel = document.getElementById('import-mata-pelajaran');
        const jenis = document.getElementById('import-jenis');
        const semester = document.getElementById('import-semester');
        const tahunAjaran = document.getElementById('import-tahun-ajaran');

        if (kelas) kelas.value = '';
        if (mapel) mapel.value = '';
        if (jenis) jenis.value = 'UH';
        if (semester) semester.value = 'Ganjil';
        if (tahunAjaran) tahunAjaran.value = '2024/2025';

        // Reset import context
        Object.assign(importContext, {
            kelas: '',
            mata_pelajaran: '',
            jenis: 'UH',
            semester: 'Ganjil',
            tahun_ajaran: '2024/2025'
        });

        // Reset to Step 1
        currentImportStep = 1;
        goToImportStep(1);

        // Validate form (will disable Next button since fields are empty)
        validateImportForm();
    }
}

function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.remove('active');

        // Reset file input
        const fileInput = document.getElementById('import-file');
        if (fileInput) fileInput.value = '';

        const fileInfo = document.getElementById('selected-file-name');
        if (fileInfo) {
            fileInfo.textContent = 'Belum ada file dipilih';
            fileInfo.classList.remove('has-file');
        }

        // Hide summary result
        const summary = document.getElementById('import-summary');
        if (summary) {
            summary.style.display = 'none';
            summary.classList.add('hidden');
        }

        // Reset step to 1
        currentImportStep = 1;
    }
}

function closeEditGradeModal() {
    document.getElementById('edit-grade-modal').classList.remove('active');
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

async function openViewModal(id) {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${GRADES_API_URL}${id}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const modalBody = document.getElementById('view-modal-body');
        modalBody.innerHTML = `
            <div class="view-detail-grid">
                <div class="detail-item">
                    <span class="detail-label">NISN</span>
                    <span class="detail-value">${escapeHtml(data.nisn_nisn || data.nisn)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Nama Siswa</span>
                    <span class="detail-value">${escapeHtml(data.nisn_nama || data.nama)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Kelas</span>
                    <span class="detail-value">${escapeHtml(data.kelas)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Mata Pelajaran</span>
                    <span class="detail-value">${escapeHtml(data.mata_pelajaran)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Nilai</span>
                    <span class="detail-value badge ${data.nilai >= 75 ? 'badge-success' : 'badge-danger'}">${data.nilai}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status</span>
                    <span class="detail-value">${data.nilai >= 75 ? 'Tuntas' : 'Remedi'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Jenis</span>
                    <span class="detail-value">${escapeHtml(data.jenis)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Semester</span>
                    <span class="detail-value">${escapeHtml(data.semester)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tahun Ajaran</span>
                    <span class="detail-value">${escapeHtml(data.tahun_ajaran)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Guru</span>
                    <span class="detail-value">${escapeHtml(data.guru || '-')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Rata-rata Kelas</span>
                    <span class="detail-value">${data.rata_rata_kelas || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tanggal Input</span>
                    <span class="detail-value">${data.created_at_formatted || '-'}</span>
                </div>
            </div>
        `;

        document.getElementById('view-modal').classList.add('active');
    } catch (e) {
        console.error('View modal error:', e);
        showToast('Gagal memuat detail nilai', 'error');
    }
}

// Expose functions to Global Window
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.closeEditGradeModal = closeEditGradeModal;
window.closeViewModal = closeViewModal;
window.openViewModal = openViewModal;

// ==========================================
// 4. WIZARD LOGIC: IMPORT EXCEL
// ==========================================

/**
 * Validate import form fields and update Next button state
 */
function validateImportForm() {
    const kelas = document.getElementById('import-kelas')?.value?.trim();
    const mapel = document.getElementById('import-mata-pelajaran')?.value?.trim();
    const jenis = document.getElementById('import-jenis')?.value;
    const semester = document.getElementById('import-semester')?.value;

    const isValid = kelas && mapel && jenis && semester;
    const nextBtn = document.getElementById('import-btn-next');

    if (nextBtn) {
        nextBtn.disabled = !isValid;
    }

    return isValid;
}

/**
 * Navigate to next import step
 */
function goToImportStepNext() {
    if (currentImportStep === 1) {
        // Validate Step 1 fields
        if (!validateImportForm()) {
            showToast('Lengkapi semua field yang wajib diisi', 'error');
            return;
        }
        goToImportStep(2);
    } else if (currentImportStep === 2) {
        goToImportStep(3);
    }
}

/**
 * Navigate to previous import step
 */
function goToImportStepBack() {
    if (currentImportStep > 1) {
        goToImportStep(currentImportStep - 1);
    }
}

/**
 * Go to specific import step
 */
function goToImportStep(step) {
    // Update import context and template info for Step 2
    if (step === 2) {
        updateImportContext(); // Persist context state

        const { kelas, mata_pelajaran, jenis } = importContext;

        // Update kelas label
        const kelasLabel = document.getElementById('template-kelas-label');
        if (kelasLabel) kelasLabel.textContent = kelas || '...';

        // Update mapel label
        const mapelLabel = document.getElementById('template-mapel-label');
        if (mapelLabel) mapelLabel.textContent = mata_pelajaran || '...';

        // Generate dynamic filename: Template_Nilai_XIIA_Matematika_UTS.xlsx
        const safeKelas = (kelas || 'Kelas').replace(/\s+/g, '');
        const safeMapel = (mata_pelajaran || 'Mapel').replace(/\s+/g, '_').substring(0, 15);
        const safeJenis = jenis || 'UH';
        const dynamicFilename = `Template_Nilai_${safeKelas}_${safeMapel}_${safeJenis}.xlsx`;

        // Update filename display
        const filenameEl = document.getElementById('template-filename');
        if (filenameEl) filenameEl.textContent = dynamicFilename;
    }

    // Update Step Dots
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`import-dot-${i}`);
        const line = document.getElementById(`import-line-${i}`);

        if (dot) {
            dot.classList.remove('active', 'done');
            if (i === step) {
                dot.classList.add('active');
            } else if (i < step) {
                dot.classList.add('done');
            }
        }

        if (line) {
            if (i < step) {
                line.classList.add('done');
            } else {
                line.classList.remove('done');
            }
        }
    }

    // Show correct panel
    for (let i = 1; i <= 3; i++) {
        const panel = document.getElementById(`import-step-${i}`);
        if (panel) {
            panel.style.display = (i === step) ? 'block' : 'none';
            panel.classList.toggle('active', i === step);
        }
    }

    // Update footer buttons visibility
    const btnBack = document.getElementById('import-btn-back');
    const btnNext = document.getElementById('import-btn-next');
    const btnUpload = document.getElementById('import-btn-upload');

    if (btnBack) btnBack.style.display = (step > 1) ? '' : 'none';
    if (btnNext) btnNext.style.display = (step < 3) ? '' : 'none';
    if (btnUpload) btnUpload.style.display = (step === 3) ? '' : 'none';

    currentImportStep = step;
}

async function downloadGradeTemplateFromModal() {
    // Force update context from current form values (safety check)
    updateImportContext();

    // Get values from context
    const { kelas, mata_pelajaran, jenis, semester, tahun_ajaran } = importContext;

    // Debug: Log values being sent
    console.log('[Download Template] Context values:', {
        kelas,
        mata_pelajaran,
        jenis,
        semester,
        tahun_ajaran
    });

    // Validation with specific error messages
    if (!kelas || kelas.trim() === '') {
        showToast('Pilih kelas terlebih dahulu', 'error');
        return;
    }
    if (!mata_pelajaran || mata_pelajaran.trim() === '') {
        showToast('Isi mata pelajaran terlebih dahulu', 'error');
        return;
    }

    const btn = document.getElementById('btn-download-template');
    const originalHTML = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<span class="btn-download-icon">⏳</span><span class="btn-download-content"><span class="btn-download-label">Menyiapkan...</span></span>';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Session expired. Silakan login ulang.');
        }

        // Build parameters with trimmed values
        const params = new URLSearchParams({
            kelas: kelas.trim(),
            mata_pelajaran: mata_pelajaran.trim(),
            jenis: (jenis || 'UH').trim(),
            semester: (semester || 'Ganjil').trim(),
            tahun_ajaran: (tahun_ajaran || '2024/2025').trim()
        });

        console.log('[Download Template] Fetching:', `${GRADES_API_URL}generate-template/?${params.toString()}`);

        const response = await fetch(`${GRADES_API_URL}generate-template/?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json'
            }
        });

        console.log('[Download Template] Response status:', response.status);

        // Check if response is JSON (error) or blob (success)
        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            let errorMessage = 'Gagal generate template';
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
                console.error('[Download Template] Error response:', errorData);
            }
            throw new Error(errorMessage);
        }

        // Generate dynamic filename
        const safeKelas = kelas.replace(/\s+/g, '');
        const safeMapel = mata_pelajaran.replace(/\s+/g, '_').substring(0, 15);
        const filename = `Template_Nilai_${safeKelas}_${safeMapel}_${jenis}.xlsx`;

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast('Template berhasil didownload!', 'success');

        // Auto-advance to Step 3 after successful download
        setTimeout(() => goToImportStep(3), 800);

    } catch (error) {
        console.error('Download template error:', error);
        showToast(error.message || 'Gagal download template', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}

async function importGradesNow() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    if (!file) return showToast('Pilih file Excel dahulu', 'error');

    // Use persisted import context
    const { kelas, mata_pelajaran, jenis, semester, tahun_ajaran } = importContext;

    const formData = new FormData();
    formData.append('file', file);
    // Send context from persisted state
    formData.append('kelas', kelas);
    formData.append('mata_pelajaran', mata_pelajaran);
    formData.append('jenis', jenis);
    formData.append('semester', semester);
    formData.append('tahun_ajaran', tahun_ajaran);

    const btn = document.getElementById('import-btn-upload');
    const originalText = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '⏳ Importing...';
        btn.disabled = true;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${GRADES_API_URL}import-v2/`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('Import berhasil!', 'success');
            
            // Tampilkan detail sukses
            const detailsDiv = document.getElementById('import-result-details');
            if(detailsDiv) detailsDiv.innerHTML = `<p>${data.message}</p>`;
            document.getElementById('import-summary').classList.remove('hidden');
            
            setTimeout(() => {
                closeImportModal();
                if(typeof loadGrades === 'function') loadGrades(1);
                if(typeof loadStatistics === 'function') loadStatistics();
            }, 1500);
        } else {
            throw new Error(data.message || 'Gagal import');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalText || '🚀 Mulai Import';
            btn.disabled = false;
        }
    }
}

window.goToImportStep = goToImportStep;
window.goToImportStepNext = goToImportStepNext;
window.goToImportStepBack = goToImportStepBack;
window.validateImportForm = validateImportForm;
window.downloadGradeTemplateFromModal = downloadGradeTemplateFromModal;
window.importGradesNow = importGradesNow;

// File Input Change Listener for displaying selected filename
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const fileNameDisplay = document.getElementById('selected-file-name');
            if (fileNameDisplay) {
                if (file) {
                    fileNameDisplay.textContent = `📄 ${file.name}`;
                    fileNameDisplay.classList.add('has-file');
                } else {
                    fileNameDisplay.textContent = 'Belum ada file dipilih';
                    fileNameDisplay.classList.remove('has-file');
                }
            }
        });
    }

    // Import form validation listeners - also update context state
    const importFormFields = ['import-kelas', 'import-mata-pelajaran', 'import-jenis', 'import-semester', 'import-tahun-ajaran'];
    importFormFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                validateImportForm();
                updateImportContext();
            });
            el.addEventListener('input', () => {
                validateImportForm();
                updateImportContext();
            });
        }
    });

    // Drag & Drop support for upload area
    const dropZone = document.getElementById('upload-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = document.getElementById('import-file');
                if (fileInput) {
                    fileInput.files = files;
                    // Trigger change event
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                }
            }
        });
    }
});
/**
 * grades.js - PART 2
 * Fokus: Main Logic, Table Rendering, Charts, & Initialization
 */

// ==========================================
// 5. MAIN TABLE LOGIC
// ==========================================

async function loadGrades(page = 1) {
    const tbody = document.getElementById('grades-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading...</td></tr>';

    try {
        const token = localStorage.getItem('access_token');

        // Ambil Filter Values dari Smart Filter
        const search = document.getElementById('search-input')?.value?.trim() || '';
        const kelas = document.getElementById('filter-kelas')?.value || '';
        const mapel = document.getElementById('filter-mata-pelajaran')?.value?.trim() || '';
        const semester = document.getElementById('filter-semester')?.value || '';

        // Build URL dengan Conditional Params (hanya kirim jika ada value)
        const params = new URLSearchParams();
        params.append('page', page);

        if (search) params.append('search', search);
        if (kelas) params.append('kelas', kelas);
        if (mapel) params.append('mata_pelajaran', mapel);
        if (semester) params.append('semester', semester);

        const url = `${GRADES_API_URL}?${params.toString()}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

        const data = await response.json();
        let grades = [];
        let totalCount = 0;

        // Handle Pagination structure
        if (Array.isArray(data)) {
            grades = data;
            totalCount = data.length;
        } else if (data.results) {
            grades = data.results;
            totalCount = data.count || grades.length;
        }

        renderGradesTable(grades);
        updatePagination(totalCount, page);

    } catch (error) {
        console.error('Load grades error:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Gagal memuat data</td></tr>';
    }
}

function renderGradesTable(grades) {
    const tbody = document.getElementById('grades-table-body');
    if (!tbody) return;

    if (grades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data nilai ditemukan</td></tr>';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const canEdit = ['superadmin', 'pimpinan', 'guru'].includes(user.role);
    const KKM = 75;

    tbody.innerHTML = grades.map((grade, index) => {
        const nilai = grade.nilai || 0;

        // Auto-color badges based on KKM (75)
        let badgeClass, statusBadge, statusText;
        if (nilai >= 85) {
            badgeClass = 'badge-pass';
            statusBadge = 'badge-pass';
            statusText = 'Tuntas';
        } else if (nilai >= KKM) {
            badgeClass = 'badge-avg';
            statusBadge = 'badge-pass';
            statusText = 'Tuntas';
        } else {
            badgeClass = 'badge-fail';
            statusBadge = 'badge-fail';
            statusText = 'Remedi';
        }

        const editActions = canEdit ? `
            <button onclick="window.openEditModal(${grade.id})" class="action-btn action-edit" title="Edit">✏️</button>
            <button onclick="window.deleteGrade(${grade.id})" class="action-btn action-delete" title="Hapus">🗑️</button>
        ` : '';

        return `
        <tr>
            <td>${index + 1}</td>
            <td><span class="grade-mono">${escapeHtml(grade.nisn_nisn || grade.nisn)}</span></td>
            <td>${escapeHtml(grade.nisn_nama || grade.nama)}</td>
            <td>${escapeHtml(grade.mata_pelajaran)}</td>
            <td><span class="grade-value ${badgeClass}">${nilai}</span></td>
            <td><span class="badge badge-secondary">${escapeHtml(grade.jenis)}</span></td>
            <td>${escapeHtml(grade.kelas)}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
            <td>
                <button onclick="window.openViewModal(${grade.id})" class="action-btn action-view" title="Lihat">👁️</button>
                ${editActions}
            </td>
        </tr>
        `;
    }).join('');
}

function updatePagination(count, page) {
    const totalPages = Math.max(1, Math.ceil(count / 10));

    // Update page indicators (multiple IDs for compatibility)
    const pageEls = [
        document.getElementById('current-page'),
        document.getElementById('current-page-num')
    ];
    const totalEl = document.getElementById('total-pages');
    const countEl = document.getElementById('total-count');
    const badgeEl = document.getElementById('grades-count-badge');

    pageEls.forEach(el => { if (el) el.textContent = page; });
    if (totalEl) totalEl.textContent = totalPages;
    if (countEl) countEl.textContent = count;
    if (badgeEl) badgeEl.textContent = `${count} Data`;

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (btnPrev) {
        btnPrev.disabled = page <= 1;
        btnPrev.onclick = () => loadGrades(page - 1);
    }
    if (btnNext) {
        btnNext.disabled = page >= totalPages;
        btnNext.onclick = () => loadGrades(page + 1);
    }
}

// ==========================================
// 6. STATISTICS & CHARTS
// ==========================================

let trendChart = null;
let distributionChart = null;
let ketuntasanChart = null;
let mapelChart = null;

// Baron Light Emerald Color Palette
const EMERALD_COLORS = {
    teal: '#1fa87a',
    tealLight: '#34c99a',
    amber: '#d97706',
    amberLight: '#f59e0b',
    rose: '#f43f5e',
    roseLight: '#fb7185',
    blue: '#3b82f6',
    blueLight: '#60a5fa',
    purple: '#8b5cf6',
    bgLight: '#ffffff',
    bgCard: '#f8fafc',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    gridLine: 'rgba(148, 163, 184, 0.15)'
};

/**
 * Load statistics with redesigned flashcard logic
 * - Flashcard 1: Rata-rata Nilai
 * - Flashcard 2: Ketuntasan (%)
 * - Flashcard 3: Siswa Remedial (unique students with nilai < 75)
 * - Flashcard 4: Total Mapel (subjects with grades this semester)
 */
async function loadStatistics() {
    try {
        const token = localStorage.getItem('access_token');

        // Get filter values
        const search = document.getElementById('search-input')?.value?.trim() || '';
        const kelas = document.getElementById('filter-kelas')?.value || '';
        const mapel = document.getElementById('filter-mata-pelajaran')?.value?.trim() || '';
        const semester = document.getElementById('filter-semester')?.value || '';

        // Build params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (kelas) params.append('kelas', kelas);
        if (mapel) params.append('mata_pelajaran', mapel);
        if (semester) params.append('semester', semester);

        // Try to get from statistics endpoint first
        const response = await fetch(`${GRADES_API_URL}statistics/?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let avgScore = 0;
        let ketuntasanPct = 0;
        let uniqueRemedialCount = 0;
        let totalMapel = 0;

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.statistics) {
                const s = data.statistics;
                avgScore = s.average_score || 0;
                ketuntasanPct = s.ketuntasan_percentage || 0;
                uniqueRemedialCount = s.unique_remedial_students || s.below_average || 0;
                totalMapel = s.total_subjects || s.total_mapel || 0;
            }

            // Render Charts if available
            if (data.trend) renderTrendChart(data.trend);
            if (data.distribution) renderDistributionChart(data.distribution);
            if (data.ketuntasan) renderKetuntasanChart(data.ketuntasan);

            // Render insight lists
            if (data.top_students) renderTopStudentsList(data.top_students);
            if (data.lowest_subjects) renderLowestSubjectsList(data.lowest_subjects);
        }

        // If statistics endpoint doesn't have the new fields, calculate from raw data
        if (uniqueRemedialCount === 0 || totalMapel === 0) {
            await calculateFlashcardsFromRawData(params, avgScore, ketuntasanPct);
        } else {
            // Update flashcards with animation
            animateFlashcardValue('average-score', avgScore);
            animateFlashcardValue('ketuntasan-percentage', ketuntasanPct, '%');
            animateFlashcardValue('unique-remedial-count', uniqueRemedialCount);
            animateFlashcardValue('total-mapel', totalMapel);
        }

    } catch (e) {
        console.error('Stats error:', e);
    }
}

/**
 * Calculate flashcard values from raw grades data
 * Used when statistics endpoint doesn't provide the new metrics
 */
async function calculateFlashcardsFromRawData(existingParams, existingAvg, existingKet) {
    try {
        const token = localStorage.getItem('access_token');

        // Fetch all grades data for calculation
        const params = new URLSearchParams(existingParams);
        params.set('page_size', 2000); // Get enough data for calculation

        const response = await fetch(`${GRADES_API_URL}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        let grades = [];

        if (Array.isArray(data)) {
            grades = data;
        } else if (data.results) {
            grades = data.results;
        }

        const KKM = 75;

        // Calculate average if not provided
        let avgScore = existingAvg;
        if (!avgScore && grades.length > 0) {
            const sum = grades.reduce((acc, g) => acc + (g.nilai || 0), 0);
            avgScore = Math.round(sum / grades.length);
        }

        // Calculate ketuntasan percentage if not provided
        let ketuntasanPct = existingKet;
        if (!ketuntasanPct && grades.length > 0) {
            const tuntas = grades.filter(g => (g.nilai || 0) >= KKM).length;
            ketuntasanPct = Math.round((tuntas / grades.length) * 100);
        }

        // Calculate unique students needing remedial (nilai < KKM)
        const studentsNeedingRemedial = new Set();
        grades.forEach(g => {
            if ((g.nilai || 0) < KKM) {
                const studentId = g.nisn_nisn || g.nisn || g.student_id;
                if (studentId) {
                    studentsNeedingRemedial.add(studentId);
                }
            }
        });
        const uniqueRemedialCount = studentsNeedingRemedial.size;

        // Calculate total unique subjects
        const subjects = new Set();
        grades.forEach(g => {
            if (g.mata_pelajaran) {
                subjects.add(g.mata_pelajaran);
            }
        });
        const totalMapel = subjects.size;

        // Update flashcards with animation
        animateFlashcardValue('average-score', avgScore);
        animateFlashcardValue('ketuntasan-percentage', ketuntasanPct, '%');
        animateFlashcardValue('unique-remedial-count', uniqueRemedialCount);
        animateFlashcardValue('total-mapel', totalMapel);

    } catch (e) {
        console.error('Calculate flashcards error:', e);
    }
}

/**
 * Animate flashcard value change with smooth transition
 */
function animateFlashcardValue(elementId, newValue, suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const currentText = el.textContent.replace(/[^0-9]/g, '');
    const currentValue = parseInt(currentText) || 0;
    const targetValue = parseInt(newValue) || 0;

    if (currentValue === targetValue) {
        el.textContent = targetValue + suffix;
        return;
    }

    // Add updating animation to parent card
    const card = el.closest('.stat-card');
    if (card) card.classList.add('updating');

    const duration = 400;
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(currentValue + (targetValue - currentValue) * easeOut);

        el.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            el.textContent = targetValue + suffix;
            if (card) card.classList.remove('updating');
        }
    }

    requestAnimationFrame(animate);

    // Update flashcard context labels based on active filters
    updateFlashcardContextLabels();
}

/**
 * Update flashcard labels to reflect current filter context
 */
function updateFlashcardContextLabels() {
    const kelas = document.getElementById('filter-kelas')?.value || '';
    const mapel = document.getElementById('filter-mata-pelajaran')?.value?.trim() || '';
    const semester = document.getElementById('filter-semester')?.value || '';

    // Build context string
    let context = [];
    if (kelas) context.push(kelas);
    if (semester) context.push(semester);

    // Update "Rata-rata Nilai" label
    const avgLabel = document.querySelector('#average-score')?.closest('.stat-body')?.querySelector('.stat-label');
    if (avgLabel) {
        avgLabel.textContent = context.length > 0 ? `Rata-rata ${context[0]}` : 'Rata-rata Nilai';
    }

    // Update "Siswa Remedial" sublabel
    const remedialSublabel = document.querySelector('#unique-remedial-count')?.closest('.stat-body')?.querySelector('.stat-sublabel');
    if (remedialSublabel) {
        if (kelas) {
            remedialSublabel.textContent = `Kelas ${kelas}`;
        } else {
            remedialSublabel.textContent = 'Unik, nilai < 75';
        }
    }

    // Update "Total Mapel" sublabel
    const mapelSublabel = document.querySelector('#total-mapel')?.closest('.stat-body')?.querySelector('.stat-sublabel');
    if (mapelSublabel) {
        if (semester) {
            mapelSublabel.textContent = `Semester ${semester}`;
        } else {
            mapelSublabel.textContent = 'Semester ini';
        }
    }
}

function renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();

    // v2.3.7: No fallback dummy data - show empty state if no data
    if (!trendData || !trendData.labels || trendData.labels.length === 0) {
        const container = ctx.parentElement;
        if (container) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📈</div>
                    <p style="margin: 0; font-size: 14px;">Belum ada data trend nilai</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af;">Data akan muncul setelah semester berjalan</p>
                </div>
            `;
        }
        return;
    }

    const labels = trendData.labels;
    const data = trendData.data;

    if (typeof Chart === 'undefined') return;

    // Area Chart with Baron Light Emerald styling
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rata-rata Nilai',
                data: data,
                borderColor: EMERALD_COLORS.teal,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(31, 168, 122, 0.1)';
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(31, 168, 122, 0.35)');
                    gradient.addColorStop(0.5, 'rgba(31, 168, 122, 0.15)');
                    gradient.addColorStop(1, 'rgba(31, 168, 122, 0.02)');
                    return gradient;
                },
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: EMERALD_COLORS.teal,
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: EMERALD_COLORS.teal,
                    borderWidth: 1,
                    titleColor: EMERALD_COLORS.textPrimary,
                    bodyColor: EMERALD_COLORS.textMuted,
                    padding: 12,
                    cornerRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0,
                    max: 100,
                    grid: { color: EMERALD_COLORS.gridLine },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'DM Mono', monospace", size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
                    }
                }
            }
        }
    });
}

function renderDistributionChart(distData) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    if (distributionChart) distributionChart.destroy();

    const labels = Object.keys(distData || {});
    const values = Object.values(distData || {});

    if (typeof Chart === 'undefined') return;

    // Category-based colors: Remedial (Rose), Cukup (Amber), Baik (Blue), Sempurna (Teal)
    const categoryColors = [
        EMERALD_COLORS.rose,      // 0-50: Remedial
        EMERALD_COLORS.amber,     // 51-74: Cukup
        EMERALD_COLORS.tealLight, // 75-85: Baik
        EMERALD_COLORS.teal       // 86-100: Sempurna
    ];

    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['0-50', '51-74', '75-85', '86-100'],
            datasets: [{
                label: 'Jumlah Siswa',
                data: values.length ? values : [5, 15, 45, 25],
                backgroundColor: categoryColors,
                borderColor: categoryColors.map(c => c),
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: EMERALD_COLORS.teal,
                    borderWidth: 1,
                    titleColor: EMERALD_COLORS.textPrimary,
                    bodyColor: EMERALD_COLORS.textMuted,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: EMERALD_COLORS.gridLine },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'DM Mono', monospace", size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
                    }
                }
            }
        }
    });
}

// Ketuntasan Doughnut Chart with Center Text Plugin
const ketuntasanCenterTextPlugin = {
    id: 'ketuntasanCenterText',
    beforeDraw(chart) {
        if (chart.config.type !== 'doughnut') return;

        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        const dataset = chart.data.datasets[0];
        const total = dataset.data.reduce((a, b) => a + b, 0);
        const tuntas = dataset.data[0] || 0;
        const percentage = total > 0 ? ((tuntas / total) * 100).toFixed(0) : 0;

        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();

        // Draw percentage
        ctx.font = "bold 28px 'DM Mono', monospace";
        ctx.fillStyle = EMERALD_COLORS.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${percentage}%`, centerX, centerY - 8);

        // Draw label
        ctx.font = "500 12px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = EMERALD_COLORS.textMuted;
        ctx.fillText('Tuntas', centerX, centerY + 16);

        ctx.restore();
    }
};

function renderKetuntasanChart(stats) {
    const ctx = document.getElementById('ketuntasanChart');
    if (!ctx) return;
    if (ketuntasanChart) ketuntasanChart.destroy();

    if (typeof Chart === 'undefined') return;

    const tuntas = stats?.tuntas || 75;
    const tidakTuntas = stats?.tidak_tuntas || 25;

    // Register the center text plugin
    Chart.register(ketuntasanCenterTextPlugin);

    ketuntasanChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Tuntas (≥75)', 'Remedial (<75)'],
            datasets: [{
                data: [tuntas, tidakTuntas],
                backgroundColor: [EMERALD_COLORS.teal, EMERALD_COLORS.rose],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: EMERALD_COLORS.textPrimary,
                        padding: 16,
                        font: { size: 12, family: "'Plus Jakarta Sans', sans-serif" },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: EMERALD_COLORS.teal,
                    borderWidth: 1,
                    titleColor: EMERALD_COLORS.textPrimary,
                    bodyColor: EMERALD_COLORS.textMuted,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${context.raw} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Mapel Bar Chart
function renderMapelChart(mapelData) {
    const ctx = document.getElementById('mapelChart');
    if (!ctx) return;
    if (mapelChart) mapelChart.destroy();

    if (typeof Chart === 'undefined') return;

    // v2.3.7: No fallback dummy data - show empty state if no data
    if (!mapelData || !mapelData.labels || mapelData.labels.length === 0) {
        const container = ctx.parentElement;
        if (container) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📚</div>
                    <p style="margin: 0; font-size: 14px;">Belum ada data nilai per mapel</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af;">Data akan muncul setelah nilai diinput</p>
                </div>
            `;
        }
        return;
    }

    const labels = mapelData.labels;
    const data = mapelData.data;

    mapelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rata-rata',
                data: data,
                backgroundColor: data.map(v => v >= 75 ? EMERALD_COLORS.teal : EMERALD_COLORS.amber),
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: EMERALD_COLORS.teal,
                    borderWidth: 1,
                    titleColor: EMERALD_COLORS.textPrimary,
                    bodyColor: EMERALD_COLORS.textMuted,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: EMERALD_COLORS.gridLine },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'DM Mono', monospace", size: 11 }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: EMERALD_COLORS.textPrimary,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 }
                    }
                }
            }
        }
    });
}

// Render Top 3 Students List
function renderTopStudentsList(students) {
    const container = document.getElementById('top-students-list');
    if (!container) return;

    if (!students || students.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada data siswa</div>';
        return;
    }

    const rankIcons = ['🥇', '🥈', '🥉'];
    const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];

    let html = '<ul class="insight-list">';
    students.forEach((student, idx) => {
        const rank = idx < 3 ? idx : 2;
        const statusClass = student.rata_rata >= 75 ? 'status-lulus' : 'status-remedial';
        html += `
            <li class="insight-item ${rankClasses[rank]}">
                <span class="insight-rank">${rankIcons[rank]}</span>
                <div class="insight-info">
                    <div class="insight-name">${student.nama || 'N/A'}</div>
                    <div class="insight-meta">${student.kelas || '-'} · ${student.jumlah_nilai || 0} nilai</div>
                </div>
                <div class="insight-value ${statusClass}">${student.rata_rata || 0}</div>
            </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}

// Render Lowest Subjects List
function renderLowestSubjectsList(subjects) {
    const container = document.getElementById('lowest-subjects-list');
    if (!container) return;

    if (!subjects || subjects.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada data mapel</div>';
        return;
    }

    let html = '<ul class="insight-list insight-list-danger">';
    subjects.forEach((subject, idx) => {
        const statusClass = subject.rata_rata >= 75 ? 'status-lulus' : 'status-remedial';
        const warningIcon = subject.rata_rata < 75 ? '⚠️' : '';
        html += `
            <li class="insight-item">
                <span class="insight-rank insight-rank-num">${idx + 1}</span>
                <div class="insight-info">
                    <div class="insight-name">${subject.nama || 'N/A'} ${warningIcon}</div>
                    <div class="insight-meta">${subject.total_nilai || 0} nilai · ${subject.perlu_perbaikan || 0} remedial</div>
                </div>
                <div class="insight-value ${statusClass}">${subject.rata_rata || 0}</div>
            </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}

// ==========================================
// 7. SINGLE EDIT & DELETE OPERATIONS
// ==========================================

window.openEditModal = async function(id) {
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${GRADES_API_URL}${id}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        document.getElementById('edit-grade-id').value = data.id;
        document.getElementById('edit-grade-nisn').value = data.nisn_nisn || data.nisn;
        document.getElementById('edit-grade-nama').value = data.nisn_nama || data.nama;
        document.getElementById('edit-grade-nilai').value = data.nilai;
        // Opsional: isi jenis/mapel jika ada fieldnya
        
        document.getElementById('edit-grade-modal').classList.add('active');
    } catch (e) {
        showToast('Gagal memuat data edit', 'error');
    }
};

const editForm = document.getElementById('edit-grade-form');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-grade-id').value;
        const nilai = document.getElementById('edit-grade-nilai').value;

        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${GRADES_API_URL}${id}/`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ nilai: parseInt(nilai) })
            });

            if (res.ok) {
                showToast('Update berhasil', 'success');
                closeEditGradeModal();
                loadGrades(1);
                loadStatistics();
            } else {
                showToast('Gagal update', 'error');
            }
        } catch (e) {
            console.error(e);
        }
    });
}

window.deleteGrade = async function(id) {
    if (!confirm('Yakin ingin menghapus nilai ini?')) return;
    try {
        const token = localStorage.getItem('access_token');
        await fetch(`${GRADES_API_URL}${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        showToast('Nilai berhasil dihapus', 'success');
        loadGrades(1);
        loadStatistics();
    } catch (e) {
        showToast('Gagal menghapus', 'error');
    }
};

// ==========================================
// 8. INITIALIZATION & VIEW SWITCHING
// ==========================================

window.switchView = function(view) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (view === 'walisantri') {
        // Mode Walisantri: Sembunyikan semua elemen admin
        document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

        const walisantriView = document.getElementById('walisantri-view');
        if (walisantriView) walisantriView.style.display = 'block';

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = 'Nilai Ananda';

        loadWalisantriView(user.linked_student_nisn);
    } else {
        // Mode Admin/Guru/Pimpinan
        document.querySelectorAll('.admin-view').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');

        const walisantriView = document.getElementById('walisantri-view');
        if (walisantriView) walisantriView.style.display = 'none';

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = 'Kelola Nilai';

        loadGrades(1);
        loadStatistics();
    }
};

async function loadWalisantriView(nisn) {
    if(!nisn) return;
    const div = document.getElementById('walisantri-content');
    div.innerHTML = '<div class="glass-card"><div class="loading">Loading Nilai...</div></div>';
    
    try {
        const token = localStorage.getItem('access_token');
        // Panggil endpoint khusus view walisantri (misal average atau detail list)
        // Di sini kita gunakan average sebagai contoh
        const res = await fetch(`/api/grades/average/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!data.success) {
            div.innerHTML = `<div class="glass-card">Data tidak ditemukan untuk NISN: ${nisn}</div>`;
            return;
        }

        let html = `
            <div class="glass-card">
                <h3>Rapor: ${data.nama}</h3>
                <p>NISN: ${data.nisn}</p>
                <div class="stats-grid">
                    <div class="stat-item">Rata-rata: <strong>${data.rata_rata}</strong></div>
                    <div class="stat-item">Total Mapel: <strong>${data.jumlah_mata_pelajaran}</strong></div>
                </div>
            </div>
            <div class="glass-card">
                <h4>Detail Mata Pelajaran</h4>
                <div class="mapel-list">
        `;
        
        // Render list mata pelajaran jika ada di data
        if (data.mata_pelajaran && Array.isArray(data.mata_pelajaran)) {
             data.mata_pelajaran.forEach(mp => {
                 html += `
                    <div class="mapel-item" style="border-bottom:1px solid #444; padding:10px 0;">
                        <div style="font-weight:bold; color:#fbbf24;">${mp.nama}</div>
                        <div>Nilai Rata-rata: ${mp.rata_rata}</div>
                    </div>
                 `;
             });
        }
        
        html += `</div></div>`;
        div.innerHTML = html;

    } catch (e) {
        div.innerHTML = '<div class="glass-card">Gagal memuat data.</div>';
    }
}

// Reset Filter helper
window.resetFilters = function() {
    // Reset semua input filter dengan ID spesifik
    const searchInput = document.getElementById('search-input');
    const kelasSelect = document.getElementById('filter-kelas');
    const mapelInput = document.getElementById('filter-mata-pelajaran');
    const semesterSelect = document.getElementById('filter-semester');

    if (searchInput) searchInput.value = '';
    if (kelasSelect) kelasSelect.value = '';
    if (mapelInput) mapelInput.value = '';
    if (semesterSelect) semesterSelect.value = '';

    // Reload data
    loadGrades(1);
    loadStatistics();
};

/**
 * Export grades data to CSV
 */
window.exportGrades = async function() {
    try {
        showToast('Menyiapkan data export...', 'info');

        const token = localStorage.getItem('access_token');

        // Get current filter values
        const search = document.getElementById('search-input')?.value?.trim() || '';
        const kelas = document.getElementById('filter-kelas')?.value || '';
        const mapel = document.getElementById('filter-mata-pelajaran')?.value?.trim() || '';
        const semester = document.getElementById('filter-semester')?.value || '';

        // Build params
        const params = new URLSearchParams();
        params.append('page_size', 1000); // Get all data for export
        if (search) params.append('search', search);
        if (kelas) params.append('kelas', kelas);
        if (mapel) params.append('mata_pelajaran', mapel);
        if (semester) params.append('semester', semester);

        const response = await fetch(`${GRADES_API_URL}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();
        let grades = [];

        if (Array.isArray(data)) {
            grades = data;
        } else if (data.results) {
            grades = data.results;
        }

        if (grades.length === 0) {
            showToast('Tidak ada data untuk di-export', 'warning');
            return;
        }

        // Build CSV content
        const headers = ['No', 'NISN', 'Nama', 'Kelas', 'Mata Pelajaran', 'Nilai', 'Jenis', 'Semester', 'Tahun Ajaran', 'Status'];
        const KKM = 75;

        const rows = grades.map((g, index) => {
            const nilai = g.nilai || 0;
            const status = nilai >= KKM ? 'Tuntas' : 'Remedial';
            return [
                index + 1,
                g.nisn_nisn || g.nisn || '',
                g.nisn_nama || g.nama || '',
                g.kelas || '',
                g.mata_pelajaran || '',
                nilai,
                g.jenis || '',
                g.semester || '',
                g.tahun_ajaran || '',
                status
            ];
        });

        // Create CSV with BOM for Excel compatibility
        let csv = '\uFEFF' + headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => {
                // Escape quotes and wrap in quotes if contains comma
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',') + '\n';
        });

        // Generate filename with current date and filters
        const today = new Date().toISOString().split('T')[0];
        let filename = `Data_Nilai_${today}`;
        if (kelas) filename += `_${kelas.replace(/\s+/g, '')}`;
        if (mapel) filename += `_${mapel.replace(/\s+/g, '')}`;
        filename += '.csv';

        // Download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Export berhasil! ${grades.length} data`, 'success');

    } catch (error) {
        console.error('Export error:', error);
        showToast('Gagal export data', 'error');
    }
};

// Expose functions to window for HTML inline scripts
window.loadGrades = loadGrades;
window.loadStatistics = loadStatistics;
window.animateFlashcardValue = animateFlashcardValue;
window.calculateFlashcardsFromRawData = calculateFlashcardsFromRawData;
window.updateFlashcardContextLabels = updateFlashcardContextLabels;

// ==========================================
// 9. WALISANTRI ANALYTICS (v2.3.2)
// ==========================================

let academicTrendChart = null;
let subjectRadarChart = null;
let selectedChildNisn = null;
let childrenData = [];

// Subject icons mapping
const SUBJECT_ICONS = {
    'matematika': '🔢',
    'b. indonesia': '📖',
    'b. inggris': '🌐',
    'fisika': '⚛️',
    'kimia': '🧪',
    'biologi': '🧬',
    'sejarah': '📜',
    'geografi': '🌍',
    'ekonomi': '💰',
    'pkn': '🏛️',
    'pjok': '⚽',
    'seni': '🎨',
    'fiqih': '📿',
    'quran': '📗',
    'hadits': "📕",
    'aqidah': '🕌',
    'akhlak': '💫',
    'nahwu': '📝',
    'shorof': '📝',
    'default': '📚'
};

/**
 * Initialize Walisantri Analytics View
 */
async function initWalisantriAnalytics() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Get children data
    await loadChildrenData();

    // Get selected child from localStorage or use first child
    selectedChildNisn = localStorage.getItem('selected_child_nisn');
    if (!selectedChildNisn && childrenData.length > 0) {
        selectedChildNisn = childrenData[0].nisn;
        localStorage.setItem('selected_child_nisn', selectedChildNisn);
    }

    // Render child selector
    renderChildSelectorGrades();

    // Load analytics for selected child
    if (selectedChildNisn) {
        await loadWalisantriAnalytics(selectedChildNisn);
    }

    // Listen for child switch events
    window.addEventListener('childSwitched', (e) => {
        if (e.detail && e.detail.nisn) {
            selectedChildNisn = e.detail.nisn;
            loadWalisantriAnalytics(selectedChildNisn);
        }
    });

    // Attach filter listeners
    const trendFilter = document.getElementById('trend-period-filter');
    if (trendFilter) {
        trendFilter.addEventListener('change', () => {
            if (selectedChildNisn) loadAcademicTrendChart(selectedChildNisn);
        });
    }

    const semesterFilter = document.getElementById('subject-semester-filter');
    if (semesterFilter) {
        semesterFilter.addEventListener('change', () => {
            if (selectedChildNisn) loadSubjectDetailList(selectedChildNisn);
        });
    }
}

/**
 * Load children data from API
 */
async function loadChildrenData() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/kesantrian/my-children-summary/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            childrenData = data.children || [];
        }
    } catch (e) {
        console.error('Error loading children data:', e);
        childrenData = [];
    }
}

/**
 * Render child selector tabs
 */
function renderChildSelectorGrades() {
    const container = document.getElementById('child-selector-grades');
    if (!container || childrenData.length === 0) return;

    container.innerHTML = childrenData.map(child => {
        const isActive = child.nisn === selectedChildNisn;
        const initials = child.nama ? child.nama.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

        return `
            <div class="child-tab-grade ${isActive ? 'active' : ''}"
                 onclick="selectChildGrades('${child.nisn}')"
                 data-nisn="${child.nisn}">
                <div class="child-avatar">${initials}</div>
                <div class="child-info">
                    <h4>${child.nama || 'Anak'}</h4>
                    <span>${child.kelas || '-'}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Select a child and load their analytics
 */
window.selectChildGrades = function(nisn) {
    selectedChildNisn = nisn;
    localStorage.setItem('selected_child_nisn', nisn);

    // Update active state
    document.querySelectorAll('.child-tab-grade').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.nisn === nisn);
    });

    // Broadcast event
    const child = childrenData.find(c => c.nisn === nisn);
    if (child) {
        localStorage.setItem('selected_child_data', JSON.stringify(child));
        window.dispatchEvent(new CustomEvent('childSwitched', { detail: { nisn, child } }));
    }

    // Load analytics
    loadWalisantriAnalytics(nisn);
};

/**
 * Main function to load all walisantri analytics
 */
async function loadWalisantriAnalytics(nisn) {
    if (!nisn) return;

    // Show loading states
    setAnalyticsLoading(true);

    try {
        // Load all analytics in parallel
        await Promise.all([
            loadAcademicInsight(nisn),
            loadAcademicTrendChart(nisn),
            loadSubjectRadarChart(nisn),
            loadSubjectSummary(nisn),
            loadSubjectDetailList(nisn)
        ]);
    } catch (e) {
        console.error('Error loading walisantri analytics:', e);
    } finally {
        setAnalyticsLoading(false);
    }
}

/**
 * Set loading state for analytics components
 */
function setAnalyticsLoading(loading) {
    const elements = [
        'academic-insight',
        'subject-summary',
        'subject-detail-list'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el && loading) {
            // Add loading class or show spinner
        }
    });
}

/**
 * Load and display academic insight card
 */
async function loadAcademicInsight(nisn) {
    const titleEl = document.getElementById('academic-insight-title');
    const descEl = document.getElementById('academic-insight-desc');

    if (!titleEl || !descEl) return;

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/grades/average/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load grades');

        const data = await response.json();

        if (data.success) {
            const avg = data.rata_rata || 0;
            const totalMapel = data.jumlah_mata_pelajaran || 0;
            const nama = data.nama || 'Ananda';

            // Generate insight text based on average
            let insightText, insightDesc;

            if (avg >= 85) {
                insightText = `Prestasi Luar Biasa! Rata-rata ${avg}`;
                insightDesc = `${nama} menunjukkan performa akademik yang sangat baik di ${totalMapel} mata pelajaran.`;
            } else if (avg >= 75) {
                insightText = `Performa Baik! Rata-rata ${avg}`;
                insightDesc = `${nama} memenuhi standar ketuntasan. Terus tingkatkan di ${totalMapel} mata pelajaran.`;
            } else if (avg >= 60) {
                insightText = `Perlu Peningkatan. Rata-rata ${avg}`;
                insightDesc = `${nama} membutuhkan perhatian lebih untuk meningkatkan nilai di beberapa mata pelajaran.`;
            } else {
                insightText = `Butuh Dukungan Ekstra. Rata-rata ${avg}`;
                insightDesc = `Mari bersama-sama mendukung ${nama} untuk meningkatkan hasil belajar.`;
            }

            titleEl.textContent = insightText;
            descEl.textContent = insightDesc;
        }
    } catch (e) {
        console.error('Error loading academic insight:', e);
        titleEl.textContent = 'Data tidak tersedia';
        descEl.textContent = 'Silakan coba lagi nanti';
    }
}

/**
 * Load and render Academic Trend Line Chart
 */
async function loadAcademicTrendChart(nisn) {
    const ctx = document.getElementById('academicTrendChart');
    if (!ctx) return;

    if (academicTrendChart) academicTrendChart.destroy();

    const period = document.getElementById('trend-period-filter')?.value || '6';

    try {
        const token = localStorage.getItem('access_token');

        // Try to get trend data from API
        const response = await fetch(`/api/grades/trend/${nisn}/?months=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let labels, data;

        if (response.ok) {
            const result = await response.json();
            labels = result.labels || [];
            data = result.data || [];
        } else {
            // Generate demo data if API not available
            const months = parseInt(period);
            const now = new Date();
            labels = [];
            data = [];

            for (let i = months - 1; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push(date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));
                // Generate realistic looking data
                data.push(Math.round(70 + Math.random() * 20));
            }
        }

        if (typeof Chart === 'undefined') return;

        academicTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rata-rata Nilai',
                    data: data,
                    borderColor: EMERALD_COLORS.teal,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx: chartCtx, chartArea } = chart;
                        if (!chartArea) return 'rgba(31, 168, 122, 0.1)';
                        const gradient = chartCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(31, 168, 122, 0.3)');
                        gradient.addColorStop(1, 'rgba(31, 168, 122, 0.02)');
                        return gradient;
                    },
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: EMERALD_COLORS.teal,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        borderColor: EMERALD_COLORS.teal,
                        borderWidth: 1,
                        titleColor: EMERALD_COLORS.textPrimary,
                        bodyColor: EMERALD_COLORS.textMuted,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `Rata-rata: ${context.raw}`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: EMERALD_COLORS.gridLine },
                        ticks: {
                            color: EMERALD_COLORS.textMuted,
                            font: { family: "'DM Mono', monospace", size: 11 }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: EMERALD_COLORS.textMuted,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
                        }
                    }
                }
            }
        });

    } catch (e) {
        console.error('Error loading trend chart:', e);
    }
}

/**
 * Load and render Subject Strength Radar Chart
 */
async function loadSubjectRadarChart(nisn) {
    const ctx = document.getElementById('subjectRadarChart');
    if (!ctx) return;

    if (subjectRadarChart) subjectRadarChart.destroy();

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/grades/average/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let labels = [];
        let data = [];

        if (response.ok) {
            const result = await response.json();

            if (result.mata_pelajaran && Array.isArray(result.mata_pelajaran)) {
                // Take top 6 subjects for radar
                const subjects = result.mata_pelajaran.slice(0, 6);
                labels = subjects.map(s => s.nama.length > 10 ? s.nama.substring(0, 10) + '...' : s.nama);
                data = subjects.map(s => s.rata_rata || 0);
            }
        }

        // Use demo data if no real data
        if (labels.length === 0) {
            labels = ['Matematika', 'B. Indonesia', 'B. Inggris', 'Fiqih', 'Quran', 'Sejarah'];
            data = [85, 78, 72, 90, 88, 75];
        }

        if (typeof Chart === 'undefined') return;

        subjectRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nilai',
                    data: data,
                    borderColor: EMERALD_COLORS.teal,
                    backgroundColor: 'rgba(31, 168, 122, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: EMERALD_COLORS.teal,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        borderColor: EMERALD_COLORS.teal,
                        borderWidth: 1,
                        titleColor: EMERALD_COLORS.textPrimary,
                        bodyColor: EMERALD_COLORS.textMuted,
                        padding: 10,
                        cornerRadius: 6
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            color: EMERALD_COLORS.textMuted,
                            font: { size: 10 },
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: EMERALD_COLORS.gridLine
                        },
                        angleLines: {
                            color: EMERALD_COLORS.gridLine
                        },
                        pointLabels: {
                            color: EMERALD_COLORS.textPrimary,
                            font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" }
                        }
                    }
                }
            }
        });

    } catch (e) {
        console.error('Error loading radar chart:', e);
    }
}

/**
 * Load and display subject summary (best, needs attention, overall)
 */
async function loadSubjectSummary(nisn) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/grades/average/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load grades');

        const data = await response.json();

        if (data.success && data.mata_pelajaran && data.mata_pelajaran.length > 0) {
            const subjects = data.mata_pelajaran;

            // Sort to find best and worst
            const sorted = [...subjects].sort((a, b) => (b.rata_rata || 0) - (a.rata_rata || 0));
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];
            const overall = data.rata_rata || 0;

            // Update Best Subject
            const bestNameEl = document.getElementById('best-subject-name');
            const bestScoreEl = document.getElementById('best-subject-score');
            const bestDescEl = document.getElementById('best-subject-desc');

            if (bestNameEl) bestNameEl.textContent = best.nama || '-';
            if (bestScoreEl) bestScoreEl.textContent = best.rata_rata || 0;
            if (bestDescEl) bestDescEl.textContent = `Ananda sangat baik dalam mata pelajaran ini. Pertahankan!`;

            // Update Needs Attention
            const attNameEl = document.getElementById('attention-subject-name');
            const attScoreEl = document.getElementById('attention-subject-score');
            const attDescEl = document.getElementById('attention-subject-desc');

            if (attNameEl) attNameEl.textContent = worst.nama || '-';
            if (attScoreEl) attScoreEl.textContent = worst.rata_rata || 0;
            if (attDescEl) {
                if (worst.rata_rata < 75) {
                    attDescEl.textContent = `Perlu peningkatan agar mencapai KKM.`;
                } else {
                    attDescEl.textContent = `Nilai sudah baik, tapi bisa ditingkatkan lagi.`;
                }
            }

            // Update Overall
            const overallScoreEl = document.getElementById('overall-average-score');
            const overallDescEl = document.getElementById('overall-average-desc');

            if (overallScoreEl) overallScoreEl.textContent = overall;
            if (overallDescEl) {
                const totalSubjects = subjects.length;
                const passedSubjects = subjects.filter(s => (s.rata_rata || 0) >= 75).length;
                overallDescEl.textContent = `${passedSubjects} dari ${totalSubjects} mapel tuntas KKM.`;
            }
        }
    } catch (e) {
        console.error('Error loading subject summary:', e);
    }
}

/**
 * Load and render subject detail list with grade history
 */
async function loadSubjectDetailList(nisn) {
    const container = document.getElementById('subject-detail-list');
    if (!container) return;

    const semester = document.getElementById('subject-semester-filter')?.value || '';

    try {
        const token = localStorage.getItem('access_token');
        let url = `/api/grades/average/${nisn}/`;
        if (semester) url += `?semester=${semester}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load grades');

        const data = await response.json();

        if (data.success && data.mata_pelajaran && data.mata_pelajaran.length > 0) {
            const subjects = data.mata_pelajaran;

            container.innerHTML = subjects.map(subject => {
                const score = subject.rata_rata || 0;
                const icon = getSubjectIcon(subject.nama);
                const scoreClass = getScoreClass(score);
                const trend = subject.trend || 'stable';
                const trendIcon = trend === 'up' ? '↑' : (trend === 'down' ? '↓' : '→');
                const trendClass = `trend-${trend}`;

                // Grade history breakdown (UH, UTS, UAS)
                const uhScore = subject.nilai_uh;
                const utsScore = subject.nilai_uts;
                const uasScore = subject.nilai_uas;

                // Class average for comparison
                const classAvg = subject.rata_rata_kelas;

                // Calculate comparison indicator
                const comparisonResult = getComparisonIndicator(score, classAvg);

                return `
                    <div class="subject-item">
                        <div class="subject-item-left">
                            <div class="subject-icon">${icon}</div>
                            <div class="subject-info">
                                <span class="subject-name">${subject.nama}</span>
                                <span class="subject-meta">${subject.jumlah_nilai || 0} nilai · Semester ${data.semester || 'ini'}</span>
                            </div>
                        </div>
                        <div class="subject-grades-history">
                            ${renderGradePill('UH', uhScore)}
                            ${renderGradePill('UTS', utsScore)}
                            ${renderGradePill('UAS', uasScore)}
                        </div>
                        <div class="subject-comparison ${comparisonResult.class}">
                            <span class="comparison-label">Rata-rata Kelas</span>
                            <span class="comparison-value ${classAvg ? '' : 'empty'}">${classAvg ? classAvg : 'TBA'}</span>
                            ${comparisonResult.indicator}
                        </div>
                        <div class="subject-item-right">
                            <span class="subject-score ${scoreClass}">${score}</span>
                            <span class="subject-trend ${trendClass}">${trendIcon}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div class="loading-placeholder">Belum ada data nilai untuk semester ini</div>';
        }
    } catch (e) {
        console.error('Error loading subject detail list:', e);
        container.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
    }
}

/**
 * Render a grade pill with label and value
 */
function renderGradePill(label, value) {
    const hasValue = value !== null && value !== undefined && value !== '';
    const displayValue = hasValue ? value : '-';
    const valueClass = hasValue ? getScoreClass(value) : 'empty';

    return `
        <div class="grade-pill">
            <span class="grade-pill-label">${label}</span>
            <span class="grade-pill-value ${valueClass}">${displayValue}</span>
        </div>
    `;
}

/**
 * Get icon for subject based on name
 */
function getSubjectIcon(subjectName) {
    const name = (subjectName || '').toLowerCase();
    for (const [key, icon] of Object.entries(SUBJECT_ICONS)) {
        if (name.includes(key)) return icon;
    }
    return SUBJECT_ICONS.default;
}

/**
 * Get score class based on value
 */
function getScoreClass(score) {
    if (score >= 85) return 'score-high';
    if (score >= 75) return 'score-mid';
    if (score >= 60) return 'score-low';
    return 'score-danger';
}

/**
 * Get comparison indicator between student score and class average
 */
function getComparisonIndicator(studentScore, classAvg) {
    if (!classAvg || !studentScore) {
        return { indicator: '', class: '' };
    }

    const diff = studentScore - classAvg;
    const pctDiff = Math.abs(Math.round((diff / classAvg) * 100));

    if (diff > 2) {
        // Above average
        return {
            indicator: `<span class="comparison-indicator above">▲ +${pctDiff}%</span>`,
            class: 'comparison-above'
        };
    } else if (diff < -2) {
        // Below average
        return {
            indicator: `<span class="comparison-indicator below">▼ -${pctDiff}%</span>`,
            class: 'comparison-below'
        };
    } else {
        // Near average (within 2 points)
        return {
            indicator: `<span class="comparison-indicator equal">● Setara</span>`,
            class: 'comparison-equal'
        };
    }
}

// Expose functions
window.initWalisantriAnalytics = initWalisantriAnalytics;
window.loadWalisantriAnalytics = loadWalisantriAnalytics;

// Event Listeners (DOM Ready)
window.addEventListener('load', function() {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Grades] Admin page detected, skipping init');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.body.setAttribute('data-role', user.role || 'guest');

    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay) nameDisplay.textContent = user.username || 'User';

    // Init View based on Role
    if (user.role === 'walisantri') {
        window.switchView('walisantri');
        // Initialize walisantri analytics
        initWalisantriAnalytics();
    } else {
        window.switchView('admin');

        // Attach Change Listeners to Select Filters
        ['filter-kelas', 'filter-semester'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    loadGrades(1);
                    loadStatistics();
                });
            }
        });

        // Attach Debounced Input Listener untuk Search (500ms delay)
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    loadGrades(1);
                    loadStatistics();
                }, 500);
            });
        }

        // Attach Debounced Input Listener untuk Mata Pelajaran (500ms delay)
        const mapelInput = document.getElementById('filter-mata-pelajaran');
        if (mapelInput) {
            mapelInput.addEventListener('input', () => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    loadGrades(1);
                    loadStatistics();
                }, 500);
            });
        }
    }
});