/**
 * Evaluasi Asatidz JS v1.6 - Client-Side Filtering
 * Portal Ponpes Baron - HR Module
 * 2026-03-21
 *
 * Handles:
 * - RBAC-based UI rendering (pimpinan vs ustadz)
 * - Load, filter, and display evaluations
 * - Create/Edit/Delete evaluations (pimpinan only)
 * - Load ustadz dropdown for form
 * - Boomer-friendly form with radio card kategori
 * - Dashboard stats & date display
 * - Real-time stats calculation & animation
 * - Academic year/semester auto-detection
 * - Client-side search with 300ms debounce
 * - applyFilters() for combined filtering
 * - Event listeners for real-time filtering
 */

(function() {
    'use strict';

    // ============================================
    // CONSTANTS & STATE
    // ============================================

    // IMPORTANT: No /api/ prefix - apiFetch adds it automatically
    const API_BASE = 'kesantrian/asatidz/evaluations';
    const USERS_API = 'users';

    let currentUser = null;
    let allEvaluations = [];
    let selectedEvaluationId = null;

    // Roles with write access
    const PIMPINAN_ROLES = ['superadmin', 'pimpinan'];
    // Roles with read access (own data only)
    const USTADZ_ROLES = ['guru', 'musyrif', 'wali_kelas', 'bk'];

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function isPimpinan() {
        return currentUser && PIMPINAN_ROLES.includes(currentUser.role);
    }

    function isUstadz() {
        return currentUser && USTADZ_ROLES.includes(currentUser.role);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    function getKategoriIcon(kategori) {
        const icons = {
            'apresiasi': '🌟',
            'administratif': '📋',
            'kedisiplinan': '⚠️'
        };
        return icons[kategori] || '📝';
    }

    function getKategoriLabel(kategori) {
        const labels = {
            'apresiasi': 'Apresiasi',
            'administratif': 'Administratif',
            'kedisiplinan': 'Kedisiplinan'
        };
        return labels[kategori] || kategori;
    }

    function getBadgeClass(kategori) {
        return `badge-${kategori}`;
    }

    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    // ============================================
    // API FUNCTIONS
    // ============================================

    async function apiRequest(url, options = {}) {
        console.log('[AsatidzEval] ===== API REQUEST =====');
        console.log('[AsatidzEval] URL:', url);
        console.log('[AsatidzEval] Options:', options);

        try {
            // Check if apiFetch exists
            if (!window.apiFetch) {
                throw new Error('window.apiFetch tidak tersedia. Pastikan auth-check.js sudah dimuat.');
            }

            const rawResponse = await window.apiFetch(url, options);

            console.log('[AsatidzEval] Raw response:', rawResponse);

            // Handle null response (auth failure)
            if (!rawResponse) {
                throw new Error('Response null - kemungkinan auth gagal');
            }

            if (!rawResponse.ok) {
                const errorText = await rawResponse.text().catch(() => '');
                console.error('[AsatidzEval] HTTP Error:', rawResponse.status, errorText);
                throw new Error(`HTTP ${rawResponse.status}: ${errorText || 'Unknown error'}`);
            }

            const jsonData = await rawResponse.json();
            console.log('[AsatidzEval] JSON Response:', jsonData);
            return jsonData;
        } catch (error) {
            console.error('[AsatidzEval] API Error:', error);
            throw error;
        }
    }

    // ============================================
    // LOAD DATA FUNCTIONS
    // ============================================

    async function loadAsatidzEvaluations() {
        console.log('[AsatidzEval] ===== LOAD EVALUATIONS =====');
        console.log('[AsatidzEval] Current user:', currentUser);

        const listEl = document.getElementById('evaluation-list');
        const emptyEl = document.getElementById('empty-state');

        if (listEl) {
            listEl.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Memuat data evaluasi...</p>
                </div>
            `;
        }

        try {
            // Build query params from filters (pimpinan only)
            let queryParams = '';
            if (isPimpinan()) {
                const ustadz = document.getElementById('filter-ustadz')?.value;
                const kategori = document.getElementById('filter-kategori')?.value;
                const tahun = document.getElementById('filter-tahun')?.value;
                const semester = document.getElementById('filter-semester')?.value;

                const params = new URLSearchParams();
                if (ustadz) params.append('ustadz', ustadz);
                if (kategori) params.append('kategori', kategori);
                if (tahun) params.append('tahun_ajaran', tahun);
                if (semester) params.append('semester', semester);

                queryParams = params.toString() ? `?${params.toString()}` : '';
            }

            // Build URL properly - no double slashes
            const apiUrl = API_BASE + '/' + queryParams;
            console.log('[AsatidzEval] Fetching URL:', apiUrl);

            const response = await apiRequest(apiUrl);

            console.log('[AsatidzEval] Response:', response);

            if (response.success) {
                allEvaluations = response.data || [];

                // ===== UPDATE STATS FIRST (before rendering cards) =====
                // This gives Pimpinan real-time summary of all evaluations
                console.log('[AsatidzEval] Data received:', allEvaluations.length, 'evaluations');
                updateSummary(allEvaluations);

                // ===== THEN RENDER THE LIST =====
                renderAsatidzCards(allEvaluations);

                console.log('[AsatidzEval] ✅ Data loaded and displayed');
            } else {
                throw new Error(response.message || 'Gagal memuat data');
            }
        } catch (error) {
            console.error('[AsatidzEval] Load error:', error);
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Gagal Memuat Data</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="window.loadAsatidzEvaluations()">🔄 Coba Lagi</button>
                    </div>
                `;
            }
        }
    }

    async function loadUstadzList() {
        console.log('[AsatidzEval] Loading ustadz list...');

        try {
            // Fetch users with ustadz roles
            const response = await apiRequest(`${USERS_API}/?role=guru,musyrif,wali_kelas,pimpinan`);

            const users = response.data || response.results || response || [];

            // Populate form dropdown
            const formSelect = document.getElementById('asatidz-ustadz');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Pilih Ustadz/Karyawan</option>';
                users.forEach(user => {
                    formSelect.innerHTML += `
                        <option value="${user.id}">${user.name || user.username} (${user.role})</option>
                    `;
                });
            }

            // Populate filter dropdown (pimpinan only)
            const filterSelect = document.getElementById('filter-ustadz');
            if (filterSelect && isPimpinan()) {
                filterSelect.innerHTML = '<option value="">Semua Ustadz</option>';
                users.forEach(user => {
                    filterSelect.innerHTML += `
                        <option value="${user.id}">${user.name || user.username}</option>
                    `;
                });
            }

            console.log('[AsatidzEval] Loaded', users.length, 'ustadz');
        } catch (error) {
            console.error('[AsatidzEval] Error loading ustadz:', error);
        }
    }

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    function renderAsatidzCards(evaluations) {
        const listEl = document.getElementById('evaluation-list');
        const emptyEl = document.getElementById('empty-state');

        if (!listEl) return;

        if (!evaluations || evaluations.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.style.display = 'block';
                const emptyMsg = document.getElementById('empty-message');
                if (emptyMsg) {
                    emptyMsg.textContent = isPimpinan()
                        ? 'Belum ada catatan evaluasi. Klik tombol "Tambah Evaluasi Kinerja" untuk membuat catatan baru.'
                        : 'Belum ada catatan evaluasi untuk Anda.';
                }
            }
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        let html = '';

        evaluations.forEach((item, index) => {
            const kategori = item.kategori || 'administratif';
            const ustadzName = item.ustadz_nama || 'Unknown';
            const ustadzRole = item.ustadz_role || '-';
            const reporterName = item.dilaporkan_oleh_nama || '-';
            const tanggal = formatDate(item.tanggal_kejadian);
            const deskripsi = item.deskripsi || '-';

            html += `
                <div class="eval-card kategori-${kategori}" onclick="window.openDetailModal(${item.id})" data-id="${item.id}">
                    <div class="eval-card-indicator"></div>
                    <div class="eval-card-content">
                        <div class="eval-card-header">
                            <div class="eval-card-title">
                                <span class="ustadz-name">${ustadzName}</span>
                                <span class="ustadz-role">${ustadzRole}</span>
                            </div>
                            <div class="eval-card-meta">
                                <span class="kategori-badge ${getBadgeClass(kategori)}">
                                    ${getKategoriIcon(kategori)} ${getKategoriLabel(kategori)}
                                </span>
                            </div>
                        </div>
                        <div class="eval-card-description">${deskripsi}</div>
                        <div class="eval-card-footer">
                            <div class="eval-card-reporter">
                                <span class="reporter-avatar">${getInitials(reporterName)}</span>
                                <span>Oleh: ${reporterName}</span>
                            </div>
                            <span class="eval-card-date">📅 ${tanggal}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
        console.log('[AsatidzEval] Rendered', evaluations.length, 'cards');
    }

    /**
     * Update Summary Stats Cards
     * Calculates kategori counts and injects into dashboard cards
     * Only runs for pimpinan/superadmin roles
     */
    function updateSummary(evaluations) {
        console.log('[AsatidzEval] ===== UPDATE SUMMARY STATS =====');

        // Only show for pimpinan roles
        if (!isPimpinan()) {
            console.log('[AsatidzEval] Skipping stats - not pimpinan');
            return;
        }

        // Show summary banner
        const summaryBanner = document.getElementById('summary-banner');
        if (summaryBanner) {
            summaryBanner.style.display = 'block';
        }

        // Calculate stats
        const data = evaluations || [];
        const total = data.length;
        let apresiasi = 0;
        let administratif = 0;
        let kedisiplinan = 0;

        data.forEach(item => {
            if (item.kategori === 'apresiasi') apresiasi++;
            else if (item.kategori === 'administratif') administratif++;
            else if (item.kategori === 'kedisiplinan') kedisiplinan++;
        });

        console.log('[AsatidzEval] Stats calculated:', {
            total,
            apresiasi,
            administratif,
            kedisiplinan
        });

        // Inject into DOM with animation
        animateStatValue('summary-total', total);
        animateStatValue('summary-apresiasi', apresiasi);
        animateStatValue('summary-administratif', administratif);
        animateStatValue('summary-kedisiplinan', kedisiplinan);

        console.log('[AsatidzEval] ✅ Summary stats updated');
    }

    /**
     * Animate stat value change for visual feedback
     */
    function animateStatValue(elementId, newValue) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const currentValue = parseInt(el.textContent) || 0;

        if (currentValue !== newValue) {
            // Add pulse animation
            el.style.transform = 'scale(1.1)';
            el.style.transition = 'transform 0.2s ease';

            setTimeout(() => {
                el.textContent = newValue;
                el.style.transform = 'scale(1)';
            }, 100);
        } else {
            el.textContent = newValue;
        }
    }

    // ============================================
    // MODAL FUNCTIONS
    // ============================================

    window.openAsatidzModal = async function(editId = null) {
        console.log('[AsatidzEval] ===== OPEN MODAL =====');
        console.log('[AsatidzEval] Edit ID:', editId);

        const modal = document.getElementById('asatidz-modal');
        const form = document.getElementById('asatidz-form');
        const title = document.getElementById('asatidz-modal-title');
        const submitBtn = document.getElementById('asatidz-submit-btn');

        if (!modal || !form) {
            console.error('[AsatidzEval] Modal elements not found');
            alert('❌ Error: Modal tidak ditemukan. Refresh halaman.');
            return;
        }

        // ===== RESET FORM COMPLETELY =====
        form.reset();
        document.getElementById('asatidz-id').value = '';

        // Clear hidden kategori dropdown
        const kategoriDropdown = document.getElementById('asatidz-kategori');
        if (kategoriDropdown) kategoriDropdown.value = '';

        // Clear ALL radio button visual selections
        document.querySelectorAll('.kategori-option input[type="radio"]').forEach(input => {
            input.checked = false;
        });

        // Reset submit button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '💾 Simpan Evaluasi';
        }

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const tanggalInput = document.getElementById('asatidz-tanggal');
        if (tanggalInput) tanggalInput.value = today;

        // ===== ENSURE USTADZ DROPDOWN IS POPULATED =====
        const ustadzSelect = document.getElementById('asatidz-ustadz');
        if (ustadzSelect && ustadzSelect.options.length <= 1) {
            console.log('[AsatidzEval] Ustadz dropdown empty, loading...');
            try {
                await loadUstadzList();
            } catch (e) {
                console.error('[AsatidzEval] Failed to load ustadz:', e);
            }
        }

        // ===== SET MODAL TITLE =====
        if (editId) {
            title.textContent = '✏️ Edit Evaluasi Kinerja';
            await loadEvaluationForEdit(editId);
        } else {
            title.textContent = '➕ Tambah Evaluasi Kinerja Baru';
        }

        // ===== SHOW MODAL =====
        modal.classList.add('show');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scroll

        console.log('[AsatidzEval] Modal opened successfully');
    };

    window.closeAsatidzModal = function() {
        const modal = document.getElementById('asatidz-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        document.body.style.overflow = ''; // Restore scroll
        console.log('[AsatidzEval] Modal closed');
    };

    window.openDetailModal = async function(evalId) {
        console.log('[AsatidzEval] Opening detail modal for:', evalId);

        const modal = document.getElementById('detail-modal');
        const body = document.getElementById('detail-modal-body');
        const actions = document.getElementById('detail-actions');

        if (!modal || !body) return;

        selectedEvaluationId = evalId;

        // Show modal with loading
        modal.classList.add('show');
        modal.style.display = 'flex';
        body.innerHTML = '<div class="loading-spinner"></div>';

        // Show actions for pimpinan
        if (actions) {
            actions.style.display = isPimpinan() ? 'flex' : 'none';
        }

        try {
            const response = await apiRequest(`${API_BASE}/${evalId}/`);

            if (response.success) {
                renderDetailModal(response.data);
            } else {
                throw new Error(response.message || 'Gagal memuat detail');
            }
        } catch (error) {
            console.error('[AsatidzEval] Detail load error:', error);
            body.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Gagal Memuat Detail</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    };

    function renderDetailModal(data) {
        console.log('[AsatidzEval] Rendering detail modal:', data);

        const body = document.getElementById('detail-modal-body');
        const badge = document.getElementById('detail-kategori-badge');
        const title = document.getElementById('detail-title');

        if (!body) return;

        const kategori = data.kategori || 'administratif';

        // Update header badge with large style
        if (badge) {
            badge.className = `detail-kategori-badge badge-lg ${getBadgeClass(kategori)}`;
            badge.innerHTML = `${getKategoriIcon(kategori)} ${getKategoriLabel(kategori)}`;
        }
        if (title) {
            title.textContent = '📋 Detail Evaluasi';
        }

        // Prevent body scroll while modal is open
        document.body.style.overflow = 'hidden';

        body.innerHTML = `
            <div class="detail-section">
                <div class="detail-section-title">Ustadz/Karyawan</div>
                <div class="detail-ustadz-info">
                    <div class="detail-ustadz-avatar">${getInitials(data.ustadz_nama)}</div>
                    <div class="detail-ustadz-meta">
                        <div class="ustadz-name">${data.ustadz_nama || '-'}</div>
                        <div class="ustadz-role">${data.ustadz_role || '-'} &bull; @${data.ustadz_username || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Deskripsi</div>
                <div class="detail-deskripsi">${data.deskripsi || '-'}</div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Informasi</div>
                <div class="detail-info-grid">
                    <div class="detail-info-item">
                        <div class="info-label">Tanggal Kejadian</div>
                        <div class="info-value">${formatDate(data.tanggal_kejadian)}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="info-label">Dilaporkan Oleh</div>
                        <div class="info-value">${data.dilaporkan_oleh_nama || '-'}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="info-label">Tahun Ajaran</div>
                        <div class="info-value">${data.tahun_ajaran || '-'}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="info-label">Semester</div>
                        <div class="info-value">${data.semester || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">Timestamp</div>
                <div class="detail-info-grid">
                    <div class="detail-info-item">
                        <div class="info-label">Dibuat</div>
                        <div class="info-value">${formatDate(data.created_at)}</div>
                    </div>
                    <div class="detail-info-item">
                        <div class="info-label">Diupdate</div>
                        <div class="info-value">${formatDate(data.updated_at)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    window.closeDetailModal = function() {
        const modal = document.getElementById('detail-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        document.body.style.overflow = ''; // Restore scroll
        console.log('[AsatidzEval] Detail modal closed');
        selectedEvaluationId = null;
    };

    // ============================================
    // FORM HANDLERS
    // ============================================

    window.handleAsatidzSubmit = async function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log('[AsatidzEval] ===== FORM SUBMIT =====');

        const form = document.getElementById('asatidz-form');
        const submitBtn = document.getElementById('asatidz-submit-btn');

        if (!form) return false;

        // ===== GATHER FORM DATA =====
        const evalId = document.getElementById('asatidz-id')?.value;
        const ustadz = document.getElementById('asatidz-ustadz')?.value;
        const tanggal = document.getElementById('asatidz-tanggal')?.value;
        const deskripsi = document.getElementById('asatidz-deskripsi')?.value?.trim();

        // ===== GET KATEGORI FROM RADIO BUTTONS (BOOMER-FRIENDLY) =====
        const selectedRadio = document.querySelector('.kategori-option input[type="radio"]:checked');
        const kategori = selectedRadio ? selectedRadio.value : '';

        console.log('[AsatidzEval] Form values:', {
            evalId,
            ustadz,
            tanggal,
            kategori,
            deskripsiLength: deskripsi?.length
        });

        // ===== VALIDATION WITH CLEAR MESSAGES =====
        const errors = [];
        if (!ustadz) errors.push('👤 Pilih Ustadz/Karyawan');
        if (!tanggal) errors.push('📅 Pilih Tanggal Kejadian');
        if (!kategori) errors.push('📝 Pilih Kategori (klik salah satu kotak)');
        if (!deskripsi) errors.push('✍️ Tulis Deskripsi');

        if (errors.length > 0) {
            // BOOMER-FRIENDLY: Show clear alert with all errors
            const errorMsg = '⚠️ PERIKSA DATA ANDA:\n\n' + errors.join('\n');
            alert(errorMsg);
            console.log('[AsatidzEval] Validation failed:', errors);
            return false;
        }

        // ===== DISABLE BUTTON (Prevent double submit) =====
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Menyimpan...';
        }

        const payload = {
            ustadz: parseInt(ustadz),
            tanggal_kejadian: tanggal,
            kategori: kategori,
            deskripsi: deskripsi
        };

        console.log('[AsatidzEval] Payload:', payload);

        try {
            let response;
            const isEdit = !!evalId;

            if (isEdit) {
                // UPDATE existing
                console.log('[AsatidzEval] Updating evaluation ID:', evalId);
                response = await apiRequest(`${API_BASE}/${evalId}/`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // CREATE new
                console.log('[AsatidzEval] Creating new evaluation');
                response = await apiRequest(`${API_BASE}/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            console.log('[AsatidzEval] API Response:', response);

            if (response.success) {
                // ===== BOOMER-FRIENDLY SUCCESS ALERT =====
                const successMsg = isEdit
                    ? '✅ BERHASIL!\n\nCatatan evaluasi telah diperbarui.'
                    : '✅ BERHASIL!\n\nCatatan evaluasi baru telah disimpan.';

                alert(successMsg);
                console.log('[AsatidzEval] ✅ Save successful');

                // Close modal and refresh list
                closeAsatidzModal();
                await loadAsatidzEvaluations();
            } else {
                throw new Error(response.message || 'Gagal menyimpan data');
            }
        } catch (error) {
            console.error('[AsatidzEval] Submit error:', error);

            // ===== BOOMER-FRIENDLY ERROR ALERT =====
            alert('❌ GAGAL MENYIMPAN!\n\n' + error.message + '\n\nSilakan coba lagi atau hubungi admin.');
        } finally {
            // Re-enable button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '💾 Simpan Evaluasi';
            }
        }

        return false;
    };

    async function loadEvaluationForEdit(evalId) {
        console.log('[AsatidzEval] Loading evaluation for edit:', evalId);

        try {
            const response = await apiRequest(`${API_BASE}/${evalId}/`);

            if (response.success && response.data) {
                const data = response.data;
                console.log('[AsatidzEval] Edit data loaded:', data);

                // Set form values
                document.getElementById('asatidz-id').value = data.id;
                document.getElementById('asatidz-ustadz').value = data.ustadz;
                document.getElementById('asatidz-tanggal').value = data.tanggal_kejadian;
                document.getElementById('asatidz-deskripsi').value = data.deskripsi;

                // Set hidden dropdown
                const dropdown = document.getElementById('asatidz-kategori');
                if (dropdown) dropdown.value = data.kategori;

                // ===== SET RADIO BUTTON (BOOMER-FRIENDLY) =====
                // First, clear all
                document.querySelectorAll('.kategori-option input[type="radio"]').forEach(input => {
                    input.checked = false;
                    input.closest('.kategori-option')?.classList.remove('selected');
                });

                // Then, select the correct one
                const radioInput = document.querySelector(`.kategori-option[data-value="${data.kategori}"] input[type="radio"]`);
                if (radioInput) {
                    radioInput.checked = true;
                    radioInput.closest('.kategori-option')?.classList.add('selected');
                    console.log('[AsatidzEval] Kategori radio set to:', data.kategori);
                }

                console.log('[AsatidzEval] ✅ Form populated for edit');
            }
        } catch (error) {
            console.error('[AsatidzEval] Load for edit error:', error);
            alert('❌ GAGAL MEMUAT DATA\n\nTidak dapat memuat data untuk diedit.\n\n' + error.message);
        }
    }

    window.editAsatidzEvaluation = function() {
        if (!selectedEvaluationId) return;
        closeDetailModal();
        openAsatidzModal(selectedEvaluationId);
    };

    window.deleteAsatidzEvaluation = async function() {
        if (!selectedEvaluationId) return;

        // ===== BOOMER-FRIENDLY CONFIRMATION =====
        const confirmMsg = '⚠️ HAPUS CATATAN EVALUASI?\n\n' +
            'Catatan yang dihapus TIDAK DAPAT dikembalikan.\n\n' +
            'Klik OK untuk menghapus, atau Batal untuk membatalkan.';

        if (!confirm(confirmMsg)) {
            console.log('[AsatidzEval] Delete cancelled by user');
            return;
        }

        console.log('[AsatidzEval] Deleting evaluation:', selectedEvaluationId);

        try {
            const response = await apiRequest(`${API_BASE}/${selectedEvaluationId}/`, {
                method: 'DELETE'
            });

            if (response.success) {
                // ===== BOOMER-FRIENDLY SUCCESS =====
                alert('✅ BERHASIL DIHAPUS!\n\nCatatan evaluasi telah dihapus dari sistem.');
                closeDetailModal();
                await loadAsatidzEvaluations();
            } else {
                throw new Error(response.message || 'Gagal menghapus');
            }
        } catch (error) {
            console.error('[AsatidzEval] Delete error:', error);
            alert('❌ GAGAL MENGHAPUS!\n\n' + error.message + '\n\nSilakan coba lagi.');
        }
    };

    window.filterAsatidzEvaluations = function() {
        loadAsatidzEvaluations();
    };

    // ============================================
    // SEARCH & FILTER FUNCTIONS
    // ============================================

    let searchTimeout = null;

    /**
     * Search evaluations by text (ustadz name or description)
     * Uses debounce to avoid excessive filtering
     */
    window.searchEvaluations = function() {
        const searchInput = document.getElementById('search-ustadz');
        const clearBtn = document.getElementById('search-clear');
        const searchTerm = searchInput?.value?.trim() || '';

        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = searchTerm.length > 0 ? 'block' : 'none';
        }

        // Debounce search (300ms delay)
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            console.log('[AsatidzEval] Search triggered:', searchTerm);
            applyFilters();
        }, 300);
    };

    /**
     * Clear search input and re-filter
     */
    window.clearSearch = function() {
        const searchInput = document.getElementById('search-ustadz');
        const clearBtn = document.getElementById('search-clear');

        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.remove('show');

        console.log('[AsatidzEval] Search cleared');
        applyFilters();
    };

    /**
     * Reset all filters to default
     */
    window.resetFilters = function() {
        console.log('[AsatidzEval] Resetting all filters...');

        // Reset search
        const searchInput = document.getElementById('search-ustadz');
        const clearBtn = document.getElementById('search-clear');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.remove('show');

        // Reset dropdowns
        const ustadzFilter = document.getElementById('filter-ustadz');
        const kategoriFilter = document.getElementById('filter-kategori');

        if (ustadzFilter) ustadzFilter.value = '';
        if (kategoriFilter) kategoriFilter.value = '';

        // Apply filters (renders all data)
        applyFilters();

        console.log('[AsatidzEval] ✅ All filters reset');
    };

    // ============================================
    // UI SETUP BASED ON ROLE
    // ============================================

    function setupUIForRole() {
        console.log('[AsatidzEval] Setting up UI for role:', currentUser?.role);
        console.log('[AsatidzEval] isPimpinan():', isPimpinan());
        console.log('[AsatidzEval] isUstadz():', isUstadz());

        // Pimpinan-only elements (summary, filters, add buttons)
        document.querySelectorAll('.pimpinan-only').forEach(el => {
            if (isPimpinan()) {
                el.style.display = '';
                el.style.removeProperty('display');
            } else {
                el.style.display = 'none';
            }
        });

        // Ustadz-only elements (info banner)
        document.querySelectorAll('.ustadz-only').forEach(el => {
            if (isUstadz()) {
                el.style.display = '';
                el.style.removeProperty('display');
            } else {
                el.style.display = 'none';
            }
        });

        // Explicitly show/hide pimpinan elements
        const topbarActions = document.getElementById('topbar-actions');
        const filterSection = document.getElementById('filter-section');

        if (isPimpinan()) {
            // Show topbar action buttons for pimpinan
            if (topbarActions) {
                topbarActions.style.display = 'flex';
                console.log('[AsatidzEval] ✅ Topbar action buttons shown');
            }
            // Show filter section for pimpinan
            if (filterSection) {
                filterSection.style.display = 'block';
                console.log('[AsatidzEval] ✅ Filter section shown');
            }
        } else {
            // Hide pimpinan elements for non-pimpinan
            if (topbarActions) topbarActions.style.display = 'none';
            if (filterSection) filterSection.style.display = 'none';
            console.log('[AsatidzEval] Pimpinan elements hidden for role:', currentUser?.role);
        }

        // Update page title for ustadz view
        const pageTitle = document.getElementById('page-title');
        if (pageTitle && isUstadz()) {
            pageTitle.textContent = 'Evaluasi Saya';
        }
    }

    // ============================================
    // KATEGORI VISUAL SELECTOR SYNC
    // ============================================

    function setupKategoriSelector() {
        console.log('[AsatidzEval] Setting up kategori selector...');

        const selector = document.querySelector('.kategori-selector');
        const dropdown = document.getElementById('asatidz-kategori');

        if (!selector) {
            console.warn('[AsatidzEval] Kategori selector not found');
            return;
        }

        // Get all radio inputs
        const radioInputs = selector.querySelectorAll('input[type="radio"]');
        console.log('[AsatidzEval] Found', radioInputs.length, 'kategori radio buttons');

        // ===== SYNC RADIO BUTTONS TO HIDDEN DROPDOWN =====
        radioInputs.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const value = e.target.value;
                console.log('[AsatidzEval] Kategori selected:', value);

                // Update hidden dropdown
                if (dropdown) {
                    dropdown.value = value;
                }

                // Visual feedback - highlight selected card
                selector.querySelectorAll('.kategori-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.closest('.kategori-option')?.classList.add('selected');
            });
        });

        // ===== ALSO HANDLE CLICK ON CARD (NOT JUST RADIO) =====
        selector.querySelectorAll('.kategori-option').forEach(option => {
            option.addEventListener('click', (e) => {
                // Don't double-handle if clicking directly on radio
                if (e.target.type === 'radio') return;

                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        // ===== SYNC DROPDOWN TO RADIOS (for edit mode) =====
        if (dropdown) {
            dropdown.addEventListener('change', () => {
                const value = dropdown.value;
                radioInputs.forEach(input => {
                    input.checked = input.value === value;
                    if (input.checked) {
                        input.closest('.kategori-option')?.classList.add('selected');
                    } else {
                        input.closest('.kategori-option')?.classList.remove('selected');
                    }
                });
            });
        }

        console.log('[AsatidzEval] ✅ Kategori selector setup complete');
    }

    // ============================================
    // ROBUST USER FETCHING
    // ============================================

    async function getCurrentUserSafe() {
        console.log('[AsatidzEval] getCurrentUserSafe() called');

        // 1. Try window.currentUser first
        if (window.currentUser) {
            console.log('[AsatidzEval] Found user in window.currentUser');
            return window.currentUser;
        }

        // 2. Try localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed && parsed.role) {
                    console.log('[AsatidzEval] Found user in localStorage:', parsed.username);
                    window.currentUser = parsed;
                    return parsed;
                }
            } catch (e) {
                console.warn('[AsatidzEval] Failed to parse localStorage user:', e);
            }
        }

        // 3. Fallback: Fetch from API
        console.log('[AsatidzEval] Fetching user from API...');
        try {
            if (typeof window.apiFetch !== 'function') {
                throw new Error('apiFetch not available');
            }

            const response = await window.apiFetch('users/me/');
            if (!response || !response.ok) {
                throw new Error(`HTTP ${response?.status || 'error'}`);
            }

            const userData = await response.json();
            if (userData && (userData.role || userData.data?.role)) {
                const user = userData.data || userData;
                console.log('[AsatidzEval] Fetched user from API:', user.username);
                window.currentUser = user;
                localStorage.setItem('user', JSON.stringify(user));
                return user;
            }
        } catch (error) {
            console.error('[AsatidzEval] API fetch failed:', error);
        }

        return null;
    }

    // ============================================
    // DATE DISPLAY - Indonesian Format
    // ============================================

    /**
     * Update date display in topbar with Indonesian locale
     * Format: "Sabtu, 21 Maret 2026"
     */
    function updateDateDisplay() {
        console.log('[AsatidzEval] Updating date display...');

        const dateEl = document.getElementById('topbar-date');
        if (!dateEl) {
            console.warn('[AsatidzEval] Date element not found');
            return;
        }

        const now = new Date();

        // Indonesian locale options
        const options = {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        };

        // Format: "Sabtu, 21 Maret 2026"
        const formattedDate = now.toLocaleDateString('id-ID', options);

        // Also calculate academic info
        const tahunAjaran = getTahunAjaran();
        const semester = getSemester();

        // Update date text
        const dateTextEl = dateEl.querySelector('.date-text');
        if (dateTextEl) {
            dateTextEl.textContent = formattedDate;
        } else {
            // Fallback: rebuild entire element
            dateEl.innerHTML = `
                <span class="date-icon">📅</span>
                <span class="date-text">${formattedDate}</span>
            `;
        }

        // Also update filter defaults if they exist
        const tahunFilter = document.getElementById('filter-tahun');
        if (tahunFilter && !tahunFilter.value) {
            tahunFilter.value = tahunAjaran;
        }

        console.log('[AsatidzEval] ✅ Date updated:', formattedDate);
        console.log('[AsatidzEval] Tahun Ajaran:', tahunAjaran, 'Semester:', semester);
    }

    /**
     * Calculate current tahun ajaran
     * July onwards = next year (e.g., July 2025 = 2025/2026)
     */
    function getTahunAjaran() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11

        // Academic year starts in July (month 6)
        if (month >= 6) {
            return `${year}/${year + 1}`;
        } else {
            return `${year - 1}/${year}`;
        }
    }

    /**
     * Calculate current semester
     * July-December = Ganjil, January-June = Genap
     */
    function getSemester() {
        const month = new Date().getMonth();
        return (month >= 6) ? 'Ganjil' : 'Genap';
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function init() {
        console.log('[AsatidzEval] ===== INIT START =====');
        console.log('[AsatidzEval] window.apiFetch:', typeof window.apiFetch);
        console.log('[AsatidzEval] window.currentUser:', window.currentUser);

        // Update date display immediately
        updateDateDisplay();

        const listEl = document.getElementById('evaluation-list');

        // Wait for apiFetch to be available (max 3 seconds)
        let apiFetchAttempts = 0;
        while (typeof window.apiFetch !== 'function' && apiFetchAttempts < 30) {
            await new Promise(r => setTimeout(r, 100));
            apiFetchAttempts++;
        }

        if (typeof window.apiFetch !== 'function') {
            console.error('[AsatidzEval] ❌ apiFetch not available');
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Error: API tidak tersedia</h3>
                        <p>Gagal memuat komponen API. Silakan refresh halaman.</p>
                        <button class="btn btn-primary" onclick="window.location.reload()">🔄 Refresh</button>
                    </div>
                `;
            }
            return;
        }

        console.log('[AsatidzEval] ✅ apiFetch available');

        // Get current user with robust fallback (short wait first for auth-check.js)
        await new Promise(r => setTimeout(r, 500)); // Brief wait for auth-check
        currentUser = await getCurrentUserSafe();

        // If still no user, try one more wait cycle
        if (!currentUser) {
            console.log('[AsatidzEval] First attempt failed, waiting for auth-check...');
            let attempts = 0;
            while (!window.currentUser && attempts < 10) {
                await new Promise(r => setTimeout(r, 300));
                attempts++;
            }
            currentUser = window.currentUser || await getCurrentUserSafe();
        }

        if (!currentUser) {
            console.error('[AsatidzEval] ❌ No user found - redirecting to login');
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔐</div>
                        <h3>Sesi Berakhir</h3>
                        <p>Silakan login kembali untuk melanjutkan.</p>
                        <button class="btn btn-primary" onclick="window.location.href='/login/'">🔑 Login</button>
                    </div>
                `;
            }
            return;
        }

        console.log('[AsatidzEval] ✅ User loaded:', currentUser.username, 'Role:', currentUser.role);

        // Check access
        if (!isPimpinan() && !isUstadz()) {
            console.warn('[AsatidzEval] Access denied for role:', currentUser.role);
            document.querySelector('.page-body').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🚫</div>
                    <h3>Akses Ditolak</h3>
                    <p>Anda tidak memiliki akses ke halaman ini. Role: ${currentUser.role}</p>
                </div>
            `;
            return;
        }

        // Setup UI based on role
        setupUIForRole();
        setupKategoriSelector();

        // Setup filter/search event listeners (pimpinan only)
        if (isPimpinan()) {
            setupFilterListeners();
        }

        // Load ustadz list for dropdowns (pimpinan only)
        if (isPimpinan()) {
            try {
                await loadUstadzList();
            } catch (e) {
                console.error('[AsatidzEval] Failed to load ustadz list:', e);
            }
        }

        // Load evaluations
        try {
            await loadAsatidzEvaluations();
        } catch (e) {
            console.error('[AsatidzEval] Failed to load evaluations:', e);
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Gagal Memuat Data</h3>
                        <p>${e.message}</p>
                        <button class="btn btn-primary" onclick="window.loadAsatidzEvaluations()">🔄 Coba Lagi</button>
                    </div>
                `;
            }
        }

        console.log('[AsatidzEval] ===== INIT COMPLETE =====');
    }

    // ============================================
    // FILTER EVENT LISTENERS SETUP
    // ============================================

    function setupFilterListeners() {
        console.log('[AsatidzEval] Setting up filter event listeners...');

        // ===== SEARCH INPUT - with debounce =====
        const searchInput = document.getElementById('search-ustadz');
        const clearBtn = document.getElementById('search-clear');

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const value = this.value.trim();

                // Show/hide clear button
                if (clearBtn) {
                    if (value.length > 0) {
                        clearBtn.classList.add('show');
                    } else {
                        clearBtn.classList.remove('show');
                    }
                }

                // Debounced search
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    console.log('[AsatidzEval] Search:', value);
                    applyFilters();
                }, 300);
            });
            console.log('[AsatidzEval] ✅ Search input listener attached');
        }

        // ===== CLEAR BUTTON =====
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (searchInput) searchInput.value = '';
                this.classList.remove('show');
                applyFilters();
            });
            console.log('[AsatidzEval] ✅ Clear button listener attached');
        }

        // ===== KATEGORI FILTER - immediate =====
        const kategoriFilter = document.getElementById('filter-kategori');
        if (kategoriFilter) {
            kategoriFilter.addEventListener('change', function() {
                console.log('[AsatidzEval] Kategori filter:', this.value);
                applyFilters();
            });
            console.log('[AsatidzEval] ✅ Kategori filter listener attached');
        }

        // ===== USTADZ FILTER - immediate =====
        const ustadzFilter = document.getElementById('filter-ustadz');
        if (ustadzFilter) {
            ustadzFilter.addEventListener('change', function() {
                console.log('[AsatidzEval] Ustadz filter:', this.value);
                applyFilters();
            });
            console.log('[AsatidzEval] ✅ Ustadz filter listener attached');
        }

        // ===== RESET BUTTON =====
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                console.log('[AsatidzEval] Reset filters clicked');
                window.resetFilters();
            });
            console.log('[AsatidzEval] ✅ Reset button listener attached');
        }

        console.log('[AsatidzEval] ✅ All filter listeners setup complete');
    }

    /**
     * Apply all client-side filters (search, kategori, ustadz)
     * Called after data is loaded or when filters change
     */
    function applyFilters() {
        console.log('[AsatidzEval] ===== APPLY FILTERS =====');

        if (!allEvaluations || allEvaluations.length === 0) {
            console.log('[AsatidzEval] No data to filter');
            renderAsatidzCards([]);
            updateSummary([]);
            return;
        }

        // Get filter values
        const searchTerm = (document.getElementById('search-ustadz')?.value || '').toLowerCase().trim();
        const kategoriFilter = document.getElementById('filter-kategori')?.value || '';
        const ustadzFilter = document.getElementById('filter-ustadz')?.value || '';

        console.log('[AsatidzEval] Filter values:', { searchTerm, kategoriFilter, ustadzFilter });

        // Start with all evaluations
        let filteredData = [...allEvaluations];

        // Apply search filter (name or description)
        if (searchTerm) {
            filteredData = filteredData.filter(item => {
                const ustadzName = (item.ustadz_nama || item.ustadz?.nama || '').toLowerCase();
                const deskripsi = (item.deskripsi || '').toLowerCase();
                const kategori = (item.kategori || '').toLowerCase();

                return ustadzName.includes(searchTerm) ||
                       deskripsi.includes(searchTerm) ||
                       kategori.includes(searchTerm);
            });
        }

        // Apply kategori filter
        if (kategoriFilter) {
            filteredData = filteredData.filter(item => item.kategori === kategoriFilter);
        }

        // Apply ustadz filter
        if (ustadzFilter) {
            filteredData = filteredData.filter(item => {
                return String(item.ustadz) === ustadzFilter ||
                       String(item.ustadz_id) === ustadzFilter;
            });
        }

        console.log('[AsatidzEval] Filtered:', filteredData.length, 'of', allEvaluations.length);

        // Update summary stats with filtered data
        updateSummary(filteredData);

        // Render filtered cards
        renderAsatidzCards(filteredData);
    }

    // ============================================
    // STAR RATING SYSTEM (v2.3.5)
    // ============================================

    const RATING_API = 'kesantrian/penilaian-kinerja';
    const INDIKATOR_API = 'kesantrian/penilaian-kinerja/indikator';

    let activeIndikators = [];
    let currentRatings = {}; // { indikatorId: nilai_bintang }
    let selectedRatingId = null;

    /**
     * Open the Star Rating Modal
     * Fetches active indicators and renders star rating UI
     */
    window.openRatingModal = async function(editId = null) {
        console.log('[Rating] ===== OPEN RATING MODAL =====');
        console.log('[Rating] Edit ID:', editId);

        const modal = document.getElementById('rating-modal');
        const form = document.getElementById('rating-form');

        if (!modal || !form) {
            console.error('[Rating] Modal elements not found');
            alert('❌ Error: Modal tidak ditemukan');
            return;
        }

        // Reset form
        form.reset();
        document.getElementById('rating-penilaian-id').value = editId || '';
        currentRatings = {};
        selectedRatingId = editId;

        // Update periode
        const periodeEl = document.getElementById('rating-periode');
        if (periodeEl) {
            periodeEl.textContent = `${getTahunAjaran()} - ${getSemester()}`;
        }

        // Show modal
        modal.classList.add('show');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Load ustadz dropdown (if not already loaded)
        await loadRatingUstadzList();

        // Load indicators
        await loadIndikators();

        // If editing, load existing data
        if (editId) {
            await loadRatingForEdit(editId);
        }

        // Update calculations
        updateRatingCalculations();

        console.log('[Rating] Modal opened');
    };

    /**
     * Close the Rating Modal
     */
    window.closeRatingModal = function() {
        const modal = document.getElementById('rating-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        currentRatings = {};
        selectedRatingId = null;
        console.log('[Rating] Modal closed');
    };

    /**
     * Load ustadz list for rating dropdown
     */
    async function loadRatingUstadzList() {
        console.log('[Rating] Loading ustadz list...');

        const select = document.getElementById('rating-ustadz');
        if (!select) return;

        // Check if already loaded
        if (select.options.length > 1) {
            console.log('[Rating] Ustadz list already loaded');
            return;
        }

        try {
            const response = await apiRequest(`${USERS_API}/?role=guru,musyrif,wali_kelas,pimpinan`);
            const users = response.data || response.results || response || [];

            select.innerHTML = '<option value="">-- Pilih Ustadz/Karyawan --</option>';
            users.forEach(user => {
                select.innerHTML += `
                    <option value="${user.id}" data-name="${user.name || user.username}" data-role="${user.role}">
                        ${user.name || user.username} (${user.role})
                    </option>
                `;
            });

            // Setup change handler for ustadz info display
            select.addEventListener('change', function() {
                const selected = this.options[this.selectedIndex];
                const infoEl = document.getElementById('rating-ustadz-info');

                if (this.value && infoEl) {
                    const name = selected.getAttribute('data-name') || selected.text;
                    const role = selected.getAttribute('data-role') || '-';

                    document.getElementById('rating-ustadz-avatar').textContent = getInitials(name);
                    document.getElementById('rating-ustadz-name').textContent = name;
                    document.getElementById('rating-ustadz-role').textContent = role;
                    infoEl.style.display = 'flex';
                } else if (infoEl) {
                    infoEl.style.display = 'none';
                }
            });

            console.log('[Rating] Loaded', users.length, 'ustadz');
        } catch (error) {
            console.error('[Rating] Failed to load ustadz:', error);
        }
    }

    /**
     * Load active indicators from API
     */
    async function loadIndikators() {
        console.log('[Rating] Loading indicators...');

        const container = document.getElementById('dynamic-indicators-container');
        const loading = document.getElementById('rating-indicators-loading');

        if (!container) return;

        // Show loading
        if (loading) loading.style.display = 'block';
        container.innerHTML = '';

        try {
            const response = await apiRequest(`${INDIKATOR_API}/`);

            if (response.success) {
                activeIndikators = response.data || [];
                console.log('[Rating] Loaded', activeIndikators.length, 'indicators');

                // Render indicators
                renderIndicators();

                if (loading) loading.style.display = 'none';
            } else {
                throw new Error(response.message || 'Gagal memuat indikator');
            }
        } catch (error) {
            console.error('[Rating] Failed to load indicators:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Gagal Memuat Indikator</h3>
                    <p>${error.message}</p>
                </div>
            `;
            if (loading) loading.style.display = 'none';
        }
    }

    /**
     * Render indicator rows with star ratings
     */
    function renderIndicators() {
        const container = document.getElementById('dynamic-indicators-container');
        if (!container || !activeIndikators.length) return;

        let html = '';

        activeIndikators.forEach((indikator, index) => {
            const isAuto = indikator.is_auto_calculated;
            const currentValue = currentRatings[indikator.id] || 0;

            html += `
                <div class="indicator-row ${isAuto ? 'auto-calculated' : ''} ${currentValue > 0 ? 'rated' : ''}"
                     data-indikator-id="${indikator.id}"
                     data-bobot="${indikator.bobot || 1}">
                    <div class="indicator-info">
                        <div class="indicator-name">${index + 1}. ${indikator.nama_indikator}</div>
                        <div class="indicator-desc">${indikator.deskripsi || ''}</div>
                        ${isAuto ? `
                            <span class="indicator-auto-badge">
                                ⚡ Auto: ${indikator.auto_source || 'system'}
                            </span>
                        ` : ''}
                    </div>
                    <div class="star-rating-container">
                        <div class="star-rating" data-indikator-id="${indikator.id}" ${isAuto ? 'data-auto="true"' : ''}>
                            ${renderStars(indikator.id, currentValue, isAuto)}
                        </div>
                        <span class="star-value ${currentValue > 0 ? '' : 'empty'}" id="star-value-${indikator.id}">
                            ${currentValue > 0 ? currentValue.toFixed(0) : '-'}
                        </span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Setup star click handlers
        setupStarHandlers();

        // Update progress
        updateRatingProgress();
    }

    /**
     * Render 5 stars for an indicator
     */
    function renderStars(indikatorId, currentValue, isAuto) {
        let starsHtml = '';

        for (let i = 1; i <= 5; i++) {
            const isActive = i <= currentValue;
            const iconClass = isActive ? 'fas fa-star' : 'far fa-star';

            starsHtml += `
                <i class="star ${iconClass} ${isActive ? 'active' : ''}"
                   data-star="${i}"
                   ${isAuto ? 'style="cursor: not-allowed; opacity: 0.5;"' : ''}></i>
            `;
        }

        return starsHtml;
    }

    /**
     * Setup interactive star hover/click handlers
     */
    function setupStarHandlers() {
        const starContainers = document.querySelectorAll('.star-rating:not([data-auto="true"])');

        starContainers.forEach(container => {
            const indikatorId = container.getAttribute('data-indikator-id');
            const stars = container.querySelectorAll('.star');

            stars.forEach((star, index) => {
                const starValue = index + 1;

                // Hover effect
                star.addEventListener('mouseenter', () => {
                    // Highlight this star and all before it
                    stars.forEach((s, i) => {
                        if (i < starValue) {
                            s.classList.add('hover');
                            s.classList.remove('far');
                            s.classList.add('fas');
                        } else {
                            s.classList.remove('hover');
                            // Only reset to empty if not active
                            if (!s.classList.contains('active')) {
                                s.classList.remove('fas');
                                s.classList.add('far');
                            }
                        }
                    });
                });

                // Mouse leave - restore actual values
                container.addEventListener('mouseleave', () => {
                    const currentVal = currentRatings[indikatorId] || 0;
                    stars.forEach((s, i) => {
                        s.classList.remove('hover');
                        if (i < currentVal) {
                            s.classList.add('active', 'fas');
                            s.classList.remove('far');
                        } else {
                            s.classList.remove('active', 'fas');
                            s.classList.add('far');
                        }
                    });
                });

                // Click - set the rating
                star.addEventListener('click', () => {
                    setStarRating(indikatorId, starValue);
                });
            });
        });

        console.log('[Rating] Star handlers setup complete');
    }

    /**
     * Set star rating for an indicator
     */
    function setStarRating(indikatorId, value) {
        console.log('[Rating] Setting rating:', indikatorId, '=', value);

        currentRatings[indikatorId] = value;

        // Update visual
        const container = document.querySelector(`.star-rating[data-indikator-id="${indikatorId}"]`);
        if (container) {
            const stars = container.querySelectorAll('.star');
            stars.forEach((star, i) => {
                if (i < value) {
                    star.classList.add('active', 'fas');
                    star.classList.remove('far');
                } else {
                    star.classList.remove('active', 'fas');
                    star.classList.add('far');
                }
            });
        }

        // Update value display
        const valueEl = document.getElementById(`star-value-${indikatorId}`);
        if (valueEl) {
            valueEl.textContent = value;
            valueEl.classList.remove('empty');
        }

        // Update indicator row style
        const row = document.querySelector(`.indicator-row[data-indikator-id="${indikatorId}"]`);
        if (row) {
            row.classList.add('rated');
        }

        // Recalculate totals
        updateRatingCalculations();
        updateRatingProgress();
    }

    /**
     * Update rating calculations (average and predikat)
     */
    function updateRatingCalculations() {
        const ratedIndikators = activeIndikators.filter(ind => currentRatings[ind.id] > 0);
        const totalIndikators = activeIndikators.length;

        if (ratedIndikators.length === 0) {
            document.getElementById('rating-average').textContent = '0.00';
            document.getElementById('rating-predikat').textContent = '-';
            document.getElementById('rating-predikat').className = 'rating-predikat';
            updateAverageStars(0);
            return;
        }

        // Calculate weighted average
        let totalWeightedScore = 0;
        let totalWeight = 0;

        ratedIndikators.forEach(ind => {
            const nilai = currentRatings[ind.id] || 0;
            const bobot = parseFloat(ind.bobot) || 1;
            totalWeightedScore += nilai * bobot;
            totalWeight += bobot;
        });

        const average = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

        // Update average display
        document.getElementById('rating-average').textContent = average.toFixed(2);
        updateAverageStars(average);

        // Calculate predikat
        const predikat = getPredikat(average);
        const predikatEl = document.getElementById('rating-predikat');
        predikatEl.textContent = predikat.label;
        predikatEl.className = `rating-predikat ${predikat.class}`;

        console.log('[Rating] Calculations updated:', {
            rated: ratedIndikators.length,
            total: totalIndikators,
            average: average.toFixed(2),
            predikat: predikat.label
        });
    }

    /**
     * Update the visual stars for average display
     */
    function updateAverageStars(average) {
        const container = document.getElementById('rating-average-stars');
        if (!container) return;

        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(average)) {
                html += '<i class="fas fa-star"></i>';
            } else if (i === Math.ceil(average) && average % 1 >= 0.5) {
                html += '<i class="fas fa-star-half-alt"></i>';
            } else {
                html += '<i class="far fa-star"></i>';
            }
        }
        container.innerHTML = html;
    }

    /**
     * Get predikat based on average value
     */
    function getPredikat(average) {
        if (average >= 4.5) return { label: 'Sangat Baik', class: 'sangat-baik' };
        if (average >= 3.5) return { label: 'Baik', class: 'baik' };
        if (average >= 2.5) return { label: 'Cukup', class: 'cukup' };
        if (average >= 1.5) return { label: 'Kurang', class: 'kurang' };
        if (average > 0) return { label: 'Sangat Kurang', class: 'sangat-kurang' };
        return { label: '-', class: '' };
    }

    /**
     * Update rating progress indicator
     */
    function updateRatingProgress() {
        const progressEl = document.getElementById('rating-progress');
        if (!progressEl) return;

        const rated = Object.keys(currentRatings).filter(k => currentRatings[k] > 0).length;
        const total = activeIndikators.filter(i => !i.is_auto_calculated).length;

        progressEl.textContent = `${rated}/${total} dinilai`;
    }

    /**
     * Save rating as draft
     */
    window.saveRatingDraft = async function() {
        console.log('[Rating] Saving draft...');
        await submitRating('draft');
    };

    /**
     * Submit rating (finalize)
     */
    window.handleRatingSubmit = async function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log('[Rating] Submitting rating...');
        await submitRating('submitted');
        return false;
    };

    /**
     * Submit rating with specified status
     */
    async function submitRating(status) {
        const ustadzSelect = document.getElementById('rating-ustadz');
        const ustadzId = ustadzSelect?.value;
        const catatan = document.getElementById('rating-catatan')?.value?.trim();
        const penilaianId = document.getElementById('rating-penilaian-id')?.value;

        // Validation
        if (!ustadzId) {
            alert('⚠️ PILIH USTADZ!\n\nSilakan pilih ustadz yang akan dinilai.');
            return;
        }

        // Check if at least some ratings are given
        const ratedCount = Object.keys(currentRatings).filter(k => currentRatings[k] > 0).length;
        if (ratedCount === 0) {
            alert('⚠️ BELUM ADA PENILAIAN!\n\nSilakan beri penilaian pada minimal 1 indikator.');
            return;
        }

        // Disable buttons
        const draftBtn = document.getElementById('btn-save-draft');
        const submitBtn = document.getElementById('btn-submit-rating');
        if (draftBtn) draftBtn.disabled = true;
        if (submitBtn) submitBtn.disabled = true;

        try {
            // Build detail_penilaian array
            const detailPenilaian = [];
            activeIndikators.forEach(ind => {
                const nilai = currentRatings[ind.id];
                if (nilai && nilai > 0 && !ind.is_auto_calculated) {
                    detailPenilaian.push({
                        indikator: ind.id,
                        nilai_bintang: nilai
                    });
                }
            });

            const payload = {
                ustadz: parseInt(ustadzId),
                tahun_ajaran_nama: getTahunAjaran(),
                semester: getSemester(),
                status: status,
                catatan_tambahan: catatan || '',
                detail_penilaian: detailPenilaian
            };

            console.log('[Rating] Payload:', payload);

            let response;
            if (penilaianId) {
                // Update existing
                response = await apiRequest(`${RATING_API}/${penilaianId}/`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create new
                response = await apiRequest(`${RATING_API}/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            console.log('[Rating] Response:', response);

            if (response.success) {
                const successMsg = status === 'draft'
                    ? '✅ DRAFT TERSIMPAN!\n\nPenilaian disimpan sebagai draft.'
                    : '✅ PENILAIAN TERSUBMIT!\n\nPenilaian kinerja berhasil disimpan.';

                alert(successMsg);
                closeRatingModal();
            } else {
                throw new Error(response.message || 'Gagal menyimpan penilaian');
            }
        } catch (error) {
            console.error('[Rating] Submit error:', error);
            alert('❌ GAGAL MENYIMPAN!\n\n' + error.message);
        } finally {
            if (draftBtn) draftBtn.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    /**
     * Load existing rating for editing
     */
    async function loadRatingForEdit(penilaianId) {
        console.log('[Rating] Loading rating for edit:', penilaianId);

        try {
            const response = await apiRequest(`${RATING_API}/${penilaianId}/`);

            if (response.success && response.data) {
                const data = response.data;

                // Set ustadz
                const ustadzSelect = document.getElementById('rating-ustadz');
                if (ustadzSelect) {
                    ustadzSelect.value = data.ustadz;
                    ustadzSelect.dispatchEvent(new Event('change'));
                }

                // Set catatan
                const catatanEl = document.getElementById('rating-catatan');
                if (catatanEl) {
                    catatanEl.value = data.catatan_tambahan || '';
                }

                // Load ratings
                if (data.detail_penilaian) {
                    data.detail_penilaian.forEach(detail => {
                        currentRatings[detail.indikator] = detail.nilai_bintang;
                    });
                }

                // Re-render indicators with loaded values
                renderIndicators();
                updateRatingCalculations();

                console.log('[Rating] Loaded rating data:', data);
            }
        } catch (error) {
            console.error('[Rating] Failed to load rating:', error);
        }
    }

    /**
     * Close Rating Detail Modal
     */
    window.closeRatingDetailModal = function() {
        const modal = document.getElementById('rating-detail-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
    };

    // Expose functions to window
    window.loadAsatidzEvaluations = loadAsatidzEvaluations;
    window.filterAsatidzEvaluations = filterAsatidzEvaluations;

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
