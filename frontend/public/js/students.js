// Students Management JavaScript
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
let searchTimeout = null;
let editingStudent = null;
let currentUser = null;
let currentImportStep = 1;
let selectedImportFile = null;
let kenaikanPreviewStudents = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Wait for user data to be loaded first
    await loadUser();

    // Then load the rest of the page data
    loadFilters();
    loadStatistics();
    loadStudents(1);

    setupEventListeners();
    setupSearchDebounce();
});

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadStudents(1);
        }, 500);
    });
    
    document.getElementById('filter-class').addEventListener('change', () => loadStudents(1));
    document.getElementById('filter-program').addEventListener('change', () => loadStudents(1));
    document.getElementById('filter-status').addEventListener('change', () => loadStudents(1));
    
    document.getElementById('student-form').addEventListener('submit', handleFormSubmit);
}

function setupSearchDebounce() {
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadStudents(1);
        }, 300);
    });
}

async function loadUser() {
    // First try to get from localStorage (fast)
    let user = getUser();

    // If no user in localStorage, try fetching from API
    if (!user) {
        try {
            console.log('[loadUser] No user in localStorage, fetching from API...');
            user = await apiCall('users/me/');
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('user_role', user.role);
                localStorage.setItem('user_name', user.name || user.username);
            }
        } catch (error) {
            console.error('[loadUser] Failed to fetch user:', error);
        }
    }

    currentUser = user;
    console.log('[loadUser] currentUser set to:', currentUser);

    if (user) {
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) {
            userNameDisplay.textContent = user.name || user.username;
        }
    } else {
        window.location.href = '/login/';
    }
}

async function loadWalisantriView() {
    const walisantriContent = document.getElementById('walisantri-content');

    // Show loading state while fetching user data
    walisantriContent.innerHTML = `
        <div class="profile-loading glass-card" style="padding: 40px; text-align: center;">
            <div class="loading-spinner"></div>
            <p style="color: rgba(255,255,255,0.8); margin-top: 15px;">Memuat data pengguna...</p>
        </div>
    `;

    // CRITICAL FIX: Fetch fresh user data from API to ensure we have linked_student_nisn
    try {
        console.log('[loadWalisantriView] Fetching fresh user data from /users/me/...');
        const userResponse = await apiCall('users/me/');
        console.log('[loadWalisantriView] Fresh user data:', userResponse);

        if (userResponse) {
            currentUser = userResponse;
            // Also update localStorage for consistency
            localStorage.setItem('user', JSON.stringify(userResponse));
        }
    } catch (error) {
        console.error('[loadWalisantriView] Failed to fetch user data:', error);
        // Fall back to localStorage
        currentUser = getUser();
    }

    // Debug: Log current user data
    console.log('[loadWalisantriView] currentUser:', currentUser);
    console.log('[loadWalisantriView] linked_student_nisn:', currentUser?.linked_student_nisn);

    if (!currentUser || !currentUser.linked_student_nisn) {
        console.warn('[loadWalisantriView] No linked student NISN found!');
        walisantriContent.innerHTML = `
            <div class="empty-state-card glass-card">
                <div class="empty-state-icon">👨‍👩‍👧</div>
                <h3>Belum Ada Data Ananda</h3>
                <p>Akun Anda belum terhubung dengan data siswa. Silakan hubungi admin untuk menghubungkan akun dengan data ananda.</p>
                <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px; color: rgba(255,255,255,0.6);">
                    <strong>Debug Info:</strong><br>
                    currentUser: ${currentUser ? 'EXISTS' : 'NULL'}<br>
                    username: ${currentUser?.username || 'NULL'}<br>
                    role: ${currentUser?.role || 'NULL'}<br>
                    linked_student_nisn: ${currentUser?.linked_student_nisn || 'NULL'}
                </div>
            </div>
        `;
        return;
    }

    // Show loading state for profile
    walisantriContent.innerHTML = `
        <div class="profile-loading glass-card" style="padding: 40px; text-align: center;">
            <div class="loading-spinner"></div>
            <p style="color: rgba(255,255,255,0.8); margin-top: 15px;">Memuat profil ananda...</p>
        </div>
    `;

    try {
        const nisn = currentUser.linked_student_nisn;

        // Fetch student data and additional stats in parallel
        const [student, attendanceStats, gradeStats, evaluationStats] = await Promise.all([
            apiCall(`students/${nisn}/`),
            fetchAttendanceStats(nisn).catch(() => null),
            fetchGradeStats(nisn).catch(() => null),
            fetchEvaluationStats(nisn).catch(() => null)
        ]);

        const progressPercent = student.progress_hafalan_percentage || 0;
        const hafalanStatus = student.hafalan_status === 'above_target';

        // Calculate attendance percentage
        const attendancePercent = attendanceStats?.persentase_kehadiran || 0;

        // Calculate average grade
        const avgGrade = gradeStats?.rata_rata || '-';

        // Generate initials for avatar
        const initials = getInitials(student.nama);

        // Status badge
        const statusBadgeHtml = student.aktif
            ? `<span class="profile-status-badge status-aktif">Aktif</span>`
            : `<span class="profile-status-badge status-lulus">Alumni</span>`;

        walisantriContent.innerHTML = `
            <div class="student-profile-dashboard">
                <!-- Profile Card -->
                <div class="profile-card glass-card">
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <div class="avatar-circle">
                                ${student.foto ? `<img src="${student.foto}" alt="${student.nama}">` : `<span class="avatar-initials">${initials}</span>`}
                            </div>
                            ${statusBadgeHtml}
                        </div>
                        <div class="profile-info">
                            <h2 class="profile-name">${escapeHtml(student.nama)}</h2>
                            <p class="profile-nisn">NISN: ${escapeHtml(student.nisn)}</p>
                            <div class="profile-tags">
                                <span class="profile-tag tag-kelas">📚 ${escapeHtml(student.kelas) || 'Belum ada kelas'}</span>
                                <span class="profile-tag tag-program">🎯 ${escapeHtml(student.program) || 'Reguler'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Flashcards Stats Section -->
                <div class="flashcards-section">
                    <h3 class="section-title">Ringkasan Pencapaian</h3>
                    <div class="flashcards-grid">
                        <!-- Hafalan Flashcard -->
                        <div class="flashcard flashcard-hafalan">
                            <div class="flashcard-icon">🏆</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Hafalan Al-Quran</div>
                                <div class="flashcard-value">${student.current_hafalan}/${student.target_hafalan} <span class="unit">Juz</span></div>
                                <div class="flashcard-progress">
                                    <div class="progress-track">
                                        <div class="progress-fill ${hafalanStatus ? 'above' : 'below'}" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <span class="progress-text">${progressPercent}%</span>
                                </div>
                                <div class="flashcard-status ${hafalanStatus ? 'status-good' : 'status-warning'}">
                                    ${hafalanStatus ? '✓ Di atas target' : '⚠ Perlu ditingkatkan'}
                                </div>
                            </div>
                        </div>

                        <!-- Grade Flashcard -->
                        <div class="flashcard flashcard-grade">
                            <div class="flashcard-icon">📊</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Rata-rata Nilai</div>
                                <div class="flashcard-value flashcard-big">${avgGrade}</div>
                                <div class="flashcard-subtitle">Target: ${student.target_nilai}</div>
                                <div class="flashcard-status ${parseFloat(avgGrade) >= student.target_nilai ? 'status-good' : 'status-warning'}">
                                    ${parseFloat(avgGrade) >= student.target_nilai ? '✓ Memenuhi target' : '⚠ Di bawah target'}
                                </div>
                            </div>
                        </div>

                        <!-- Attendance Flashcard -->
                        <div class="flashcard flashcard-attendance">
                            <div class="flashcard-icon">📅</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Kehadiran</div>
                                <div class="flashcard-value flashcard-big">${attendancePercent}<span class="unit">%</span></div>
                                <div class="flashcard-progress">
                                    <div class="progress-track">
                                        <div class="progress-fill ${attendancePercent >= 90 ? 'above' : 'below'}" style="width: ${attendancePercent}%"></div>
                                    </div>
                                </div>
                                <div class="flashcard-status ${attendancePercent >= 90 ? 'status-good' : 'status-warning'}">
                                    ${attendancePercent >= 90 ? '✓ Kehadiran baik' : '⚠ Perlu ditingkatkan'}
                                </div>
                            </div>
                        </div>

                        <!-- Achievement Points Flashcard -->
                        <div class="flashcard flashcard-achievement">
                            <div class="flashcard-icon">⭐</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Evaluasi</div>
                                <div class="flashcard-value flashcard-big">${evaluationStats?.total_evaluations || 0}</div>
                                <div class="flashcard-subtitle">
                                    <span style="color: #10b981;">✓ ${evaluationStats?.prestasi_count || 0} Prestasi</span> |
                                    <span style="color: #ef4444;">⚠ ${evaluationStats?.pelanggaran_count || 0} Pelanggaran</span>
                                </div>
                                <div class="flashcard-badges">
                                    ${generateAchievementBadges(student, evaluationStats)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Details Section -->
                <div class="details-section">
                    <div class="details-grid">
                        <!-- Biodata Card -->
                        <div class="detail-card glass-card">
                            <div class="detail-card-header">
                                <span class="detail-card-icon">📋</span>
                                <h4>Biodata Siswa</h4>
                            </div>
                            <div class="detail-card-body">
                                <div class="detail-row">
                                    <span class="detail-label">Email</span>
                                    <span class="detail-value">${escapeHtml(student.email) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">No. HP</span>
                                    <span class="detail-value">${escapeHtml(student.phone) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Tanggal Masuk</span>
                                    <span class="detail-value">${formatDate(student.tanggal_masuk) || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Guardian Info Card -->
                        <div class="detail-card glass-card">
                            <div class="detail-card-header">
                                <span class="detail-card-icon">👨‍👩‍👧</span>
                                <h4>Informasi Wali</h4>
                            </div>
                            <div class="detail-card-body">
                                <div class="detail-row">
                                    <span class="detail-label">Nama Wali</span>
                                    <span class="detail-value">${escapeHtml(student.wali_nama) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">No. HP Wali</span>
                                    <span class="detail-value">${escapeHtml(student.wali_phone) || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions-section">
                    <h3 class="section-title">Akses Cepat</h3>
                    <div class="quick-actions-grid">
                        <a href="/attendance" class="quick-action-btn glass-card">
                            <span class="qa-icon">📅</span>
                            <span class="qa-label">Lihat Absensi</span>
                        </a>
                        <a href="/grades" class="quick-action-btn glass-card">
                            <span class="qa-icon">📝</span>
                            <span class="qa-label">Lihat Nilai</span>
                        </a>
                        <a href="/evaluations" class="quick-action-btn glass-card">
                            <span class="qa-icon">⭐</span>
                            <span class="qa-label">Lihat Evaluasi</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading walisantri view:', error);
        walisantriContent.innerHTML = `
            <div class="error-state-card glass-card">
                <div class="error-state-icon">⚠️</div>
                <h3>Gagal Memuat Data</h3>
                <p>Terjadi kesalahan saat memuat data ananda. Silakan coba lagi.</p>
                <button onclick="loadWalisantriView()" class="btn btn-primary">Coba Lagi</button>
            </div>
        `;
    }
}

/**
 * Fetch attendance statistics for a student
 * API: /attendance/stats/<nisn>/
 * Returns: { statistics: { persentase_kehadiran, total_hadir, total_sakit, total_izin, total_alpha, total_kehadiran } }
 */
async function fetchAttendanceStats(nisn) {
    try {
        console.log('[fetchAttendanceStats] Fetching for NISN:', nisn);
        const response = await apiCall(`attendance/stats/${nisn}/`);
        console.log('[fetchAttendanceStats] Response:', response);

        if (response.success && response.statistics) {
            return {
                persentase_kehadiran: response.statistics.persentase_kehadiran || 0,
                total_hadir: response.statistics.total_hadir || 0,
                total_sakit: response.statistics.total_sakit || 0,
                total_izin: response.statistics.total_izin || 0,
                total_alpha: response.statistics.total_alpha || 0,
                total_kehadiran: response.statistics.total_kehadiran || 0
            };
        }
        return { persentase_kehadiran: 0 };
    } catch (error) {
        console.warn('[fetchAttendanceStats] Error:', error);
        return { persentase_kehadiran: 0 };
    }
}

/**
 * Fetch grade statistics for a student
 * API: /grades/average/<nisn>/
 * Returns: { rata_rata, jumlah_mata_pelajaran, mata_pelajaran: [...] }
 */
async function fetchGradeStats(nisn) {
    try {
        console.log('[fetchGradeStats] Fetching for NISN:', nisn);
        const response = await apiCall(`grades/average/${nisn}/`);
        console.log('[fetchGradeStats] Response:', response);

        if (response.success) {
            return {
                rata_rata: response.rata_rata || 0,
                jumlah_mata_pelajaran: response.jumlah_mata_pelajaran || 0,
                mata_pelajaran: response.mata_pelajaran || []
            };
        }
        return { rata_rata: '-' };
    } catch (error) {
        console.warn('[fetchGradeStats] Error:', error);
        return { rata_rata: '-' };
    }
}

/**
 * Fetch evaluation/achievement data for a student
 * API: /evaluations/student/<nisn>/
 * Returns: { evaluations: [...], summary: { total, prestasi_count, pelanggaran_count } }
 */
async function fetchEvaluationStats(nisn) {
    try {
        console.log('[fetchEvaluationStats] Fetching for NISN:', nisn);
        const response = await apiCall(`evaluations/student/${nisn}/`);
        console.log('[fetchEvaluationStats] Response:', response);

        if (response.success) {
            // Use summary from backend if available
            if (response.summary) {
                return {
                    total_evaluations: response.summary.total || 0,
                    prestasi_count: response.summary.prestasi_count || 0,
                    pelanggaran_count: response.summary.pelanggaran_count || 0,
                    recent_evaluations: (response.evaluations || []).slice(0, 5)
                };
            }

            // Fallback: calculate from evaluations if summary not available
            if (response.evaluations) {
                let prestasiCount = 0;
                let pelanggaranCount = 0;

                response.evaluations.forEach(ev => {
                    if (ev.jenis === 'Prestasi') {
                        prestasiCount++;
                    } else if (ev.jenis === 'Pelanggaran') {
                        pelanggaranCount++;
                    }
                });

                return {
                    total_evaluations: response.evaluations.length,
                    prestasi_count: prestasiCount,
                    pelanggaran_count: pelanggaranCount,
                    recent_evaluations: response.evaluations.slice(0, 5)
                };
            }
        }
        return { total_evaluations: 0, prestasi_count: 0, pelanggaran_count: 0 };
    } catch (error) {
        console.warn('[fetchEvaluationStats] Error:', error);
        return { total_evaluations: 0, prestasi_count: 0, pelanggaran_count: 0 };
    }
}

/**
 * Get initials from name
 */
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Generate achievement badges HTML
 */
function generateAchievementBadges(student, evaluationStats = null) {
    const badges = [];

    // Add badges based on hafalan achievements
    if (student.current_hafalan >= 30) {
        badges.push('<span class="achievement-badge badge-gold">🏅 Hafidz</span>');
    } else if (student.current_hafalan >= 15) {
        badges.push('<span class="achievement-badge badge-silver">🎖 Half Quran</span>');
    } else if (student.current_hafalan >= 5) {
        badges.push('<span class="achievement-badge badge-bronze">📖 5+ Juz</span>');
    }

    if (student.hafalan_status === 'above_target') {
        badges.push('<span class="achievement-badge badge-star">⭐ Target Tercapai</span>');
    }

    // Add badges based on evaluation stats
    if (evaluationStats) {
        if (evaluationStats.prestasi_count >= 5) {
            badges.push('<span class="achievement-badge badge-gold">🏆 Berprestasi</span>');
        } else if (evaluationStats.prestasi_count >= 3) {
            badges.push('<span class="achievement-badge badge-silver">🌟 Aktif</span>');
        }

        if (evaluationStats.pelanggaran_count === 0 && evaluationStats.total_evaluations > 0) {
            badges.push('<span class="achievement-badge badge-star">✨ Disiplin</span>');
        }
    }

    if (badges.length === 0) {
        return '<span class="no-badges">Terus semangat!</span>';
    }

    return badges.join('');
}

/**
 * Format date to Indonesian format
 */
function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

async function loadFilters() {
    try {
        const data = await apiCall('students/classes/');

        if (data.success) {
            const classSelect = document.getElementById('filter-class');
            classSelect.innerHTML = '<option value="">Semua Kelas</option>';
            data.classes.forEach(cls => {
                classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
            });
            
            const programSelect = document.getElementById('filter-program');
            programSelect.innerHTML = '<option value="">Semua Program</option>';
            data.programs.forEach(prog => {
                programSelect.innerHTML += `<option value="${prog}">${prog}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function loadStatistics() {
    try {
        const data = await apiCall('students/statistics/');

        if (data.success) {
            const stats = data.statistics;
            animateValue('total-students', stats.total_students);
            animateValue('active-students', stats.active_students);
            animateValue('hafalan-above', stats.hafalan_above_target);
            animateValue('hafalan-below', stats.hafalan_below_target);
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadStudents(page = 1) {
    currentPage = page;
    
    const search = document.getElementById('search-input').value.trim();
    const kelas = document.getElementById('filter-class').value;
    const program = document.getElementById('filter-program').value;
    const aktif = document.getElementById('filter-status').value;

    let url = `students/?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (kelas) url += `&kelas=${encodeURIComponent(kelas)}`;
    if (program) url += `&program=${encodeURIComponent(program)}`;
    if (aktif) url += `&aktif=${encodeURIComponent(aktif)}`;
    
    try {
        document.getElementById('students-table-body').innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="loading-spinner" style="margin: 30px auto;"></div>
                </td>
            </tr>
        `;
        
        const data = await apiCall(url);
        
        if (data.results && Array.isArray(data.results)) {
            totalCount = data.count || 0;
            totalPages = Math.ceil(totalCount / 25);
            
            renderStudents(data.results);
            updatePagination();
        } else if (data.detail) {
            showError(`Error: ${data.detail}`);
            document.getElementById('students-table-body').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        Error: ${data.detail}
                    </td>
                </tr>
            `;
        } else {
            console.error('Invalid data format:', data);
            showError('Gagal memuat data siswa - format data tidak valid');
            document.getElementById('students-table-body').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        Format data tidak valid
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('students-table-body').innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    Error: ${error.message}
                </td>
            </tr>
        `;
    }
}

function renderStudents(students) {
    const tbody = document.getElementById('students-table-body');
    const userRole = window.getUserRole();
    const canManage = ['superadmin', 'admin'].includes(userRole);
    const countBadge = document.getElementById('table-count-badge');

    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted" style="padding: 40px;">
                    Tidak ada data siswa
                </td>
            </tr>
        `;
        if (countBadge) countBadge.textContent = '0 data';
        return;
    }

    // Update count badge
    if (countBadge) countBadge.textContent = `${totalCount} data`;

    tbody.innerHTML = students.map(student => {
        // Format jenis kelamin
        const jenisKelaminText = student.jenis_kelamin === 'L' ? 'Laki-laki'
            : student.jenis_kelamin === 'P' ? 'Perempuan'
            : '-';

        // Format catatan (max 50 chars)
        let catatanText = '-';
        if (student.catatan && student.catatan.trim()) {
            catatanText = student.catatan.length > 50
                ? escapeHtml(student.catatan.substring(0, 50)) + '...'
                : escapeHtml(student.catatan);
        }

        const safeNisn = escapeAttr(student.nisn);

        // Action buttons based on role
        let actionButtons = `<button onclick="window.viewStudent('${safeNisn}')" class="action-btn action-view" title="Lihat">👁️</button>`;
        if (canManage) {
            actionButtons += `
                <button onclick="window.editStudent('${safeNisn}')" class="action-btn action-edit" title="Edit">✏️</button>
                <button onclick="window.deleteStudent('${safeNisn}')" class="action-btn action-delete" title="Hapus">🗑️</button>`;
        }

        return `
            <tr>
                <td>${escapeHtml(student.nisn) || '-'}</td>
                <td>${escapeHtml(student.nis) || '-'}</td>
                <td><strong>${escapeHtml(student.nama) || '-'}</strong></td>
                <td>${escapeHtml(student.kelas) || '-'}</td>
                <td>${escapeHtml(student.program) || '-'}</td>
                <td>${jenisKelaminText}</td>
                <td title="${escapeAttr(student.catatan || '')}">${catatanText}</td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination() {
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('total-count').textContent = totalCount;
    
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;
}

function loadPreviousPage() {
    if (currentPage > 1) {
        loadStudents(currentPage - 1);
    }
}

function loadNextPage() {
    if (currentPage < totalPages) {
        loadStudents(currentPage + 1);
    }
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-class').value = '';
    document.getElementById('filter-program').value = '';
    document.getElementById('filter-status').value = '';
    loadStudents(1);
}

// Modal Functions
function openAddModal() {
    const userRole = window.getUserRole();
    // Only superadmin and admin can add students
    if (!userRole === 'superadmin') {
        showError('Anda tidak memiliki izin untuk menambah siswa');
        return;
    }

    editingStudent = null;
    document.getElementById('modal-title').textContent = 'Tambah Siswa';
    document.getElementById('student-form').reset();
    document.getElementById('student-nisn').disabled = false;
    document.getElementById('student-nisn-readonly').value = '';
    document.getElementById('student-nis').disabled = false;
    document.getElementById('student-modal').classList.add('active');
}

async function editStudent(nisn) {
    const userRole = window.getUserRole();
    // Only superadmin and admin can edit students
    if (!userRole === 'superadmin') {
        showError('Anda tidak memiliki izin untuk mengedit data siswa');
        return;
    }

    try {
        const student = await apiCall(`students/${nisn}/`);

        editingStudent = student;
        document.getElementById('modal-title').textContent = 'Edit Siswa';
        document.getElementById('student-nisn').value = student.nisn;
        document.getElementById('student-nisn').disabled = true;
        document.getElementById('student-nisn-readonly').value = student.nisn;
        document.getElementById('student-nis').value = student.nis || '';
        document.getElementById('student-nama').value = student.nama;
        document.getElementById('student-jenis-kelamin').value = student.jenis_kelamin || '';
        document.getElementById('student-kelas').value = student.kelas || '';
        document.getElementById('student-program').value = student.program || '';
        document.getElementById('student-email').value = student.email || '';
        document.getElementById('student-phone').value = student.phone || '';
        document.getElementById('wali-nama').value = student.wali_nama || '';
        document.getElementById('wali-phone').value = student.wali_phone || '';
        document.getElementById('tanggal-masuk').value = student.tanggal_masuk || '';
        document.getElementById('student-aktif').value = student.aktif ? 'true' : 'false';
        document.getElementById('target-hafalan').value = student.target_hafalan;
        document.getElementById('current-hafalan').value = student.current_hafalan;
        document.getElementById('target-nilai').value = student.target_nilai;
        document.getElementById('student-catatan').value = student.catatan || '';

        document.getElementById('student-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading student:', error);
        showError('Gagal memuat data siswa');
    }
}

function closeModal() {
    document.getElementById('student-modal').classList.remove('active');
    editingStudent = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Validate NIS (7 digits)
    const nisValue = document.getElementById('student-nis').value.trim();
    if (nisValue && !/^\d{7}$/.test(nisValue)) {
        showError('NIS harus 7 digit angka');
        return;
    }

    const formData = {
        nisn: document.getElementById('student-nisn').value,
        nis: nisValue || null,
        nama: document.getElementById('student-nama').value,
        jenis_kelamin: document.getElementById('student-jenis-kelamin').value || null,
        kelas: document.getElementById('student-kelas').value,
        program: document.getElementById('student-program').value,
        email: document.getElementById('student-email').value,
        phone: document.getElementById('student-phone').value,
        wali_nama: document.getElementById('wali-nama').value,
        wali_phone: document.getElementById('wali-phone').value,
        tanggal_masuk: document.getElementById('tanggal-masuk').value,
        aktif: document.getElementById('student-aktif').value === 'true',
        target_hafalan: parseInt(document.getElementById('target-hafalan').value) || 0,
        current_hafalan: parseInt(document.getElementById('current-hafalan').value) || 0,
        target_nilai: parseInt(document.getElementById('target-nilai').value) || 75,
        catatan: document.getElementById('student-catatan').value || ''
    };
    
    try {
        if (editingStudent) {
            await apiCall(`students/${editingStudent.nisn}/`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            showSuccess('Siswa berhasil diperbarui');
        } else {
            await apiCall('students/', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            showSuccess('Siswa berhasil ditambahkan');
        }
        
        closeModal();
        document.getElementById('filter-status').value = '';
        loadStudents(1);
        loadStatistics();
    } catch (error) {
        console.error('Error saving student:', error);
        showError('Gagal menyimpan data siswa');
    }
}

async function viewStudent(nisn) {
    try {
        const detailBody = document.getElementById('view-modal-body');
        detailBody.innerHTML = `<div class="loading-spinner" style="margin: 30px auto;"></div>`;
        document.getElementById('view-modal').classList.add('active');

        const student = await apiCall(`students/${nisn}/`);

        const hafalanStatus = student.hafalan_status === 'above_target'
            ? '<span class="badge badge-success">✓ Di atas target</span>'
            : '<span class="badge badge-warning">⚠ Di bawah target</span>';

        const progressPercent = student.progress_hafalan_percentage || 0;
        const statusBadge = student.aktif
            ? '<span class="badge badge-success">Aktif</span>'
            : '<span class="badge badge-danger">Tidak Aktif</span>';

        // Format jenis kelamin
        const jenisKelaminText = student.jenis_kelamin === 'L' ? 'Laki-laki'
            : student.jenis_kelamin === 'P' ? 'Perempuan'
            : '-';

        detailBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">NISN</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${escapeHtml(student.nisn)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">NIS</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${escapeHtml(student.nis) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Nama</div>
                    <div class="detail-value">${escapeHtml(student.nama)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Jenis Kelamin</div>
                    <div class="detail-value">${jenisKelaminText}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Kelas</div>
                    <div class="detail-value">${escapeHtml(student.kelas) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Program</div>
                    <div class="detail-value">${escapeHtml(student.program) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(student.email) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">No. HP</div>
                    <div class="detail-value">${escapeHtml(student.phone) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Nama Wali</div>
                    <div class="detail-value">${escapeHtml(student.wali_nama) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">No. HP Wali</div>
                    <div class="detail-value">${escapeHtml(student.wali_phone) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tanggal Masuk</div>
                    <div class="detail-value">${formatDate(student.tanggal_masuk) || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${statusBadge}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Target Hafalan</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${student.target_hafalan} juz</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Hafalan Saat Ini</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${student.current_hafalan} juz</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Progress Hafalan</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${progressPercent}%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status Hafalan</div>
                    <div class="detail-value">${hafalanStatus}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Target Nilai</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${student.target_nilai}</div>
                </div>
            </div>
            <div class="detail-section-full" style="margin-top: 20px;">
                <div class="detail-label">Catatan</div>
                <div class="detail-value" style="white-space: pre-wrap; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-top: 8px;">${escapeHtml(student.catatan) || '-'}</div>
            </div>
        `;
    } catch (error) {
        console.error('Error viewing student:', error);
        showError('Gagal memuat data siswa');
        document.getElementById('view-modal').classList.remove('active');
    }
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

async function deleteStudent(nisn) {
    const userRole = window.getUserRole();
    // Only superadmin and admin can delete students
    if (!userRole === 'superadmin') {
        showError('Anda tidak memiliki izin untuk menghapus siswa');
        return;
    }

    const nama = await getStudentName(nisn);
    
    if (!confirm(`Apakah Anda yakin ingin menghapus siswa ${nama} (NISN: ${nisn})?`)) {
        return;
    }
    
    try {
        await apiCall(`students/${nisn}/`, {
            method: 'DELETE'
        });
        
        showSuccess('Siswa berhasil dihapus');
        loadStudents(currentPage);
        loadStatistics();
    } catch (error) {
        console.error('Error deleting student:', error);
        showError('Gagal menghapus siswa');
    }
}

async function getStudentName(nisn) {
    try {
        const student = await apiCall(`students/${nisn}/`);
        return student.nama;
    } catch (error) {
        return nisn;
    }
}

    async function exportToExcel() {
      try {
          const userRole = window.getUserRole();
          // Only superadmin and admin can export
          if (!userRole === 'superadmin') {
              showError('Anda tidak memiliki izin untuk export data');
              return;
          }

          let url = 'students/';
          const search = document.getElementById('search-input').value.trim();
          const kelas = document.getElementById('filter-class').value;
          const program = document.getElementById('filter-program').value;
          const aktif = document.getElementById('filter-status').value;

          if (search) url += `?search=${encodeURIComponent(search)}`;
          else if (kelas) url += `?kelas=${encodeURIComponent(kelas)}`;
          else if (program) url += `?program=${encodeURIComponent(program)}`;
          else if (aktif) url += `?aktif=${encodeURIComponent(aktif)}`;

          const fullUrl = window.API_CONFIG && window.API_CONFIG.buildUrl
              ? window.API_CONFIG.buildUrl(url)
              : url;

          const response = await fetch(fullUrl, {
              headers: {
                  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
          });

          const data = await response.json();

          if (data.results) {
              exportToCSV(data.results);
          } else {
              showError('Gagal mengexport data');
          }
      } catch (error) {
          console.error('Error exporting:', error);
          showError('Gagal mengexport data');
      }
  }

function exportToCSV(students) {
    const headers = ['NISN', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas', 'Program', 'Email', 'Phone', 'Wali Nama', 'Wali Phone', 'Tanggal Masuk', 'Target Hafalan', 'Current Hafalan', 'Target Nilai', 'Status', 'Catatan'];

    let csv = headers.join(',') + '\n';

    students.forEach(student => {
        const jenisKelamin = student.jenis_kelamin === 'L' ? 'Laki-laki'
            : student.jenis_kelamin === 'P' ? 'Perempuan'
            : '';
        const row = [
            student.nisn,
            student.nis || '',
            `"${student.nama}"`,
            jenisKelamin,
            student.kelas || '',
            student.program || '',
            student.email || '',
            student.phone || '',
            `"${student.wali_nama || ''}"`,
            student.wali_phone || '',
            student.tanggal_masuk || '',
            student.target_hafalan,
            student.current_hafalan,
            student.target_nilai,
            student.aktif ? 'Aktif' : 'Tidak Aktif',
            `"${(student.catatan || '').replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showSuccess('Data berhasil diexport');
}

// Utility Functions
function animateValue(id, end) {
    const element = document.getElementById(id);
    const start = parseInt(element.textContent) || 0;
    const duration = 500;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

// showToast is provided globally by utils.js

window.switchView = function(view) {
    const adminView = document.getElementById('admin-view');
    const walisantriView = document.getElementById('walisantri-view');
    const tabAdmin = document.getElementById('tab-admin');
    const tabWalisantri = document.getElementById('tab-walisantri');
    const adminActions = document.querySelector('.admin-actions');
    const pageTitle = document.getElementById('page-title');

    if (view === 'admin') {
        if (adminView) adminView.classList.remove('hidden');
        if (walisantriView) walisantriView.classList.remove('active');
        if (tabAdmin) tabAdmin.classList.add('active');
        if (tabWalisantri) tabWalisantri.classList.remove('active');
        if (adminActions) adminActions.style.display = 'flex';
        if (pageTitle) pageTitle.textContent = window.getUserRole() === 'pimpinan' ? 'Data Siswa' : 'Kelola Siswa';
        loadStudents(1);
        loadStatistics();
    } else {
        if (adminView) adminView.classList.add('hidden');
        if (walisantriView) walisantriView.classList.add('active');
        if (tabAdmin) tabAdmin.classList.remove('active');
        if (tabWalisantri) tabWalisantri.classList.add('active');
        if (adminActions) adminActions.style.display = 'none';
        if (pageTitle) pageTitle.textContent = 'Ananda';
        loadWalisantriView();
    }
};

// ==========================================
// IMPORT EXCEL FUNCTIONS
// ==========================================

function openImportModal() {
    const userRole = window.getUserRole();
    // Only superadmin and admin can import
    if (!userRole === 'superadmin') {
        showError('Anda tidak memiliki izin untuk import data');
        return;
    }

    currentImportStep = 1;
    selectedImportFile = null;

    // Reset modal state
    document.getElementById('import-step-1').style.display = 'block';
    document.getElementById('import-step-2').style.display = 'none';
    document.getElementById('import-step-3').style.display = 'none';

    document.getElementById('import-btn-back').style.display = 'none';
    document.getElementById('import-btn-next').style.display = 'inline-flex';
    document.getElementById('import-btn-upload').style.display = 'none';

    updateImportStepIndicator(1);

    document.getElementById('import-modal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('import-modal').classList.remove('active');
    selectedImportFile = null;

    // Reset file input
    const fileInput = document.getElementById('import-file');
    if (fileInput) fileInput.value = '';

    const fileInfo = document.getElementById('selected-file-info');
    if (fileInfo) fileInfo.style.display = 'none';
}

function updateImportStepIndicator(step) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`import-dot-${i}`);
        const line = document.getElementById(`import-line-${i - 1}`);

        if (dot) {
            dot.classList.remove('active', 'completed');
            if (i === step) dot.classList.add('active');
            if (i < step) dot.classList.add('completed');
        }
        if (line) {
            line.classList.remove('active');
            if (i <= step) line.classList.add('active');
        }
    }
}

function goToImportStepNext() {
    if (currentImportStep === 1) {
        // Go to step 2 (Upload)
        currentImportStep = 2;
        document.getElementById('import-step-1').style.display = 'none';
        document.getElementById('import-step-2').style.display = 'block';
        document.getElementById('import-btn-back').style.display = 'inline-flex';
        document.getElementById('import-btn-next').style.display = 'none';
        document.getElementById('import-btn-upload').style.display = 'inline-flex';
        updateImportStepIndicator(2);
    }
}

function goToImportStepBack() {
    if (currentImportStep === 2) {
        currentImportStep = 1;
        document.getElementById('import-step-1').style.display = 'block';
        document.getElementById('import-step-2').style.display = 'none';
        document.getElementById('import-btn-back').style.display = 'none';
        document.getElementById('import-btn-next').style.display = 'inline-flex';
        document.getElementById('import-btn-upload').style.display = 'none';
        updateImportStepIndicator(1);
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedImportFile = file;
        document.getElementById('selected-file-info').style.display = 'flex';
        document.getElementById('selected-file-name').textContent = file.name;
    }
}

function removeSelectedFile() {
    selectedImportFile = null;
    document.getElementById('import-file').value = '';
    document.getElementById('selected-file-info').style.display = 'none';
}

async function downloadStudentTemplate() {
    try {
        showSuccess('Menyiapkan template...');

        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/students/download-template/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal download template');
        }

        // Get the file blob
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Template_Siswa_Emerald.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showSuccess('Template Excel berhasil didownload');
    } catch (error) {
        console.error('Error downloading template:', error);
        showError(error.message || 'Gagal download template');
    }
}

async function importStudentsNow() {
    if (!selectedImportFile) {
        showError('Pilih file Excel terlebih dahulu');
        return;
    }

    // Show loading in step 3
    currentImportStep = 3;
    document.getElementById('import-step-2').style.display = 'none';
    document.getElementById('import-step-3').style.display = 'block';
    document.getElementById('import-btn-back').style.display = 'none';
    document.getElementById('import-btn-upload').style.display = 'none';
    updateImportStepIndicator(3);

    const resultDiv = document.getElementById('import-result');
    resultDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Mengimport data siswa...</p>
    `;

    try {
        const formData = new FormData();
        formData.append('file', selectedImportFile);

        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/students/import/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div class="import-success">
                    <div class="success-icon">✅</div>
                    <h3>Import Berhasil!</h3>
                    <div class="import-stats">
                        <div class="stat-item">
                            <span class="stat-value">${data.created || 0}</span>
                            <span class="stat-label">Siswa Baru</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.updated || 0}</span>
                            <span class="stat-label">Diperbarui</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.skipped || 0}</span>
                            <span class="stat-label">Dilewati</span>
                        </div>
                    </div>
                    ${data.errors && data.errors.length > 0 ? `
                        <div class="import-errors">
                            <h4>Peringatan:</h4>
                            <ul>${data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                </div>
            `;

            // Refresh data
            loadStudents(1);
            loadStatistics();

            setTimeout(() => {
                closeImportModal();
            }, 3000);
        } else {
            throw new Error(data.error || data.detail || 'Import gagal');
        }
    } catch (error) {
        console.error('Import error:', error);
        resultDiv.innerHTML = `
            <div class="import-error">
                <div class="error-icon">❌</div>
                <h3>Import Gagal</h3>
                <p>${escapeHtml(error.message)}</p>
                <button class="btn btn-primary" onclick="window.goToImportStepBack()">Coba Lagi</button>
            </div>
        `;
    }
}

// Setup drag and drop for upload zone
document.addEventListener('DOMContentLoaded', function() {
    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.match(/\.(xlsx|xls)$/i)) {
                    selectedImportFile = file;
                    document.getElementById('selected-file-info').style.display = 'flex';
                    document.getElementById('selected-file-name').textContent = file.name;
                } else {
                    showError('Format file tidak didukung. Gunakan file Excel (.xlsx) dari template');
                }
            }
        });
    }
});

// ==========================================
// KENAIKAN KELAS FUNCTIONS
// ==========================================

function openKenaikanKelasModal() {
    const userRole = window.getUserRole();
    // Only superadmin and admin can do bulk class promotion
    if (!userRole === 'superadmin') {
        showError('Anda tidak memiliki izin untuk fitur kenaikan kelas');
        return;
    }

    // Reset form
    document.getElementById('kenaikan-kelas-form').reset();
    document.getElementById('kenaikan-preview').style.display = 'none';
    document.getElementById('btn-proses-kenaikan').disabled = true;
    kenaikanPreviewStudents = [];

    document.getElementById('kenaikan-kelas-modal').classList.add('active');
}

function closeKenaikanKelasModal() {
    document.getElementById('kenaikan-kelas-modal').classList.remove('active');
}

async function previewKenaikanKelas() {
    const kelasAsal = document.getElementById('kelas-asal').value;
    const kelasTujuan = document.getElementById('kelas-tujuan').value;

    if (!kelasAsal || !kelasTujuan) {
        showError('Pilih kelas asal dan kelas tujuan');
        return;
    }

    if (kelasAsal === kelasTujuan) {
        showError('Kelas asal dan tujuan tidak boleh sama');
        return;
    }

    try {
        // Fetch students from selected class
        const data = await apiCall(`students/?kelas=${encodeURIComponent(kelasAsal)}&aktif=true&page_size=100`);

        if (data.results && data.results.length > 0) {
            kenaikanPreviewStudents = data.results;

            const previewDiv = document.getElementById('kenaikan-preview');
            const previewList = document.getElementById('preview-list');
            const previewCount = document.getElementById('preview-count');

            previewCount.textContent = `${data.results.length} siswa`;

            previewList.innerHTML = data.results.map(s => `
                <div class="preview-item">
                    <input type="checkbox" id="kenaikan-${s.nisn}" checked data-nisn="${s.nisn}">
                    <label for="kenaikan-${s.nisn}">
                        <span class="student-name">${escapeHtml(s.nama)}</span>
                        <span class="student-nisn">${escapeHtml(s.nisn)}</span>
                    </label>
                </div>
            `).join('');

            previewDiv.style.display = 'block';
            document.getElementById('btn-proses-kenaikan').disabled = false;
        } else {
            showError('Tidak ada siswa aktif di kelas tersebut');
            document.getElementById('kenaikan-preview').style.display = 'none';
            document.getElementById('btn-proses-kenaikan').disabled = true;
        }
    } catch (error) {
        console.error('Error fetching students:', error);
        showError('Gagal memuat data siswa');
    }
}

async function prosesKenaikanKelas() {
    const kelasAsal = document.getElementById('kelas-asal').value;
    const kelasTujuan = document.getElementById('kelas-tujuan').value;

    // Get selected students
    const checkboxes = document.querySelectorAll('#preview-list input[type="checkbox"]:checked');
    const selectedNisns = Array.from(checkboxes).map(cb => cb.dataset.nisn);

    if (selectedNisns.length === 0) {
        showError('Pilih minimal satu siswa untuk kenaikan kelas');
        return;
    }

    const confirmMsg = kelasTujuan === 'LULUS'
        ? `Anda akan meluluskan ${selectedNisns.length} siswa dari ${kelasAsal}. Siswa akan diubah statusnya menjadi Alumni. Lanjutkan?`
        : `Anda akan memindahkan ${selectedNisns.length} siswa dari ${kelasAsal} ke ${kelasTujuan}. Lanjutkan?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const btn = document.getElementById('btn-proses-kenaikan');
        btn.disabled = true;
        btn.innerHTML = '⏳ Memproses...';

        const payload = {
            kelas_asal: kelasAsal,
            kelas_tujuan: kelasTujuan,
            nisn_list: selectedNisns
        };

        const result = await apiCall('students/bulk-update-class/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (result.success) {
            showSuccess(`Berhasil memproses ${result.updated || selectedNisns.length} siswa`);
            closeKenaikanKelasModal();
            loadStudents(1);
            loadStatistics();
        } else {
            throw new Error(result.error || 'Gagal memproses kenaikan kelas');
        }
    } catch (error) {
        console.error('Error processing class promotion:', error);
        showError(error.message || 'Gagal memproses kenaikan kelas');
    } finally {
        const btn = document.getElementById('btn-proses-kenaikan');
        btn.disabled = false;
        btn.innerHTML = '🎓 Proses Kenaikan';
    }
}

window.openAddModal = openAddModal;
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.viewStudent = viewStudent;
window.closeModal = closeModal;
window.closeViewModal = closeViewModal;
window.loadPreviousPage = loadPreviousPage;
window.loadNextPage = loadNextPage;
window.resetFilters = resetFilters;
window.exportToExcel = exportToExcel;

// Import functions
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.goToImportStepNext = goToImportStepNext;
window.goToImportStepBack = goToImportStepBack;
window.handleFileSelect = handleFileSelect;
window.removeSelectedFile = removeSelectedFile;
window.downloadStudentTemplate = downloadStudentTemplate;
window.importStudentsNow = importStudentsNow;

// Kenaikan Kelas functions
window.openKenaikanKelasModal = openKenaikanKelasModal;
window.closeKenaikanKelasModal = closeKenaikanKelasModal;
window.previewKenaikanKelas = previewKenaikanKelas;
window.prosesKenaikanKelas = prosesKenaikanKelas;

