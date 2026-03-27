/**
 * ============================================
 * FINANCE.JS - Modul Keuangan
 * Portal Ponpes Baron
 * Deep Emerald Theme
 *
 * SENIOR-FRIENDLY UI VERSION
 * - Larger fonts and buttons
 * - Confirmation dialogs before critical actions
 * - Input masking for nominal (thousands separator)
 * - Large success indicators
 * - Smart empty states
 * ============================================
 */

// ============================================
// STATE MANAGEMENT
// ============================================
let currentUser = null;
let currentTagihan = [];
let currentPembayaran = [];
let currentTarif = [];
let pendingVerifications = [];
let tagihanPage = 1;
let tagihanTotalPages = 1;
let isSubmitting = false;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    setupTabNavigation();
    setupFilters();
    setupInputMasking();
    setupCurrentDate();
});

function setupCurrentDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
}

async function loadCurrentUser() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        const response = await fetch('/api/users/me/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load user');

        currentUser = await response.json();

        // Update user display
        const userNameEl = document.getElementById('user-name-display');
        const userRoleEl = document.getElementById('user-role-display');
        const userAvatarEl = document.getElementById('user-avatar-initials');

        if (userNameEl) userNameEl.textContent = currentUser.name || currentUser.username;
        if (userRoleEl) userRoleEl.textContent = capitalizeRole(currentUser.role);
        if (userAvatarEl) {
            const name = currentUser.name || currentUser.username || 'U';
            userAvatarEl.textContent = name.charAt(0).toUpperCase();
        }

        // Show appropriate view based on role
        if (currentUser.role === 'walisantri') {
            showWalisantriView();
        } else if (['superadmin', 'bendahara', 'pimpinan'].includes(currentUser.role)) {
            showAdminView();
        } else {
            showAccessDenied();
        }
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Gagal memuat data pengguna', 'error');
    }
}

function capitalizeRole(role) {
    const roleNames = {
        'superadmin': 'Super Admin',
        'pimpinan': 'Pimpinan',
        'bendahara': 'Bendahara',
        'guru': 'Guru',
        'walisantri': 'Wali Santri',
        'pendaftar': 'Pendaftar'
    };
    return roleNames[role] || role;
}

function showAccessDenied() {
    Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Anda tidak memiliki akses ke halaman ini.',
        confirmButtonColor: '#059669'
    }).then(() => {
        window.location.href = '/dashboard';
    });
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showAdminView() {
    document.getElementById('admin-view').style.display = 'block';
    document.getElementById('walisantri-view').style.display = 'none';

    // Show/hide generate SPP section based on role
    const generateSection = document.getElementById('generate-spp-section');
    if (generateSection) {
        generateSection.style.display = ['superadmin', 'bendahara'].includes(currentUser.role) ? 'flex' : 'none';
    }

    loadStatistics();
    loadTagihan();
    loadKelasOptions();
}

function showWalisantriView() {
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('walisantri-view').style.display = 'block';
    loadWalisantriData();
}

// ============================================
// TAB NAVIGATION
// ============================================

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;

            // Update active button
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Show/hide tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Load data for tab
            if (tabId === 'tagihan') loadTagihan();
            else if (tabId === 'verifikasi') loadPendingVerifications();
            else if (tabId === 'pembayaran') loadPembayaran();
            else if (tabId === 'tarif') loadTarif();
        });
    });
}

function setupFilters() {
    // Tagihan filters
    ['filter-kelas', 'filter-status', 'filter-bulan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => loadTagihan(1));
    });

    const searchInput = document.getElementById('search-tagihan');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadTagihan(1), 500);
        });
    }

    // Pembayaran filters
    ['filter-verifikasi', 'filter-metode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => loadPembayaran());
    });
}

// ============================================
// INPUT MASKING - THOUSANDS SEPARATOR
// ============================================

function setupInputMasking() {
    const nominalInputs = document.querySelectorAll('#bayar-nominal, #tarif-nominal');
    nominalInputs.forEach(input => {
        // Convert to text input for formatting
        input.type = 'text';
        input.inputMode = 'numeric';

        input.addEventListener('input', function(e) {
            formatNominalInput(this);
        });

        input.addEventListener('focus', function() {
            // Select all on focus for easy editing
            this.select();
        });
    });
}

function formatNominalInput(input) {
    // Remove non-digits
    let value = input.value.replace(/\D/g, '');

    // Format with thousand separators
    if (value) {
        value = parseInt(value, 10).toLocaleString('id-ID');
    }

    input.value = value;
}

function parseNominalValue(formattedValue) {
    // Remove separators and convert to number
    if (!formattedValue) return 0;
    return parseInt(formattedValue.replace(/\D/g, ''), 10) || 0;
}

function formatRupiah(value) {
    const num = parseFloat(value) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
}

async function loadKelasOptions() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/students/?page_size=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const kelasList = [...new Set((data.results || []).map(s => s.kelas).filter(k => k))];

            const select = document.getElementById('filter-kelas');
            if (select) {
                kelasList.sort().forEach(kelas => {
                    const option = document.createElement('option');
                    option.value = kelas;
                    option.textContent = kelas;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading kelas options:', error);
    }
}

// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/finance/statistics/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load statistics');

        const data = await response.json();

        if (data.success) {
            const stats = data.statistics;
            document.getElementById('total-tagihan').textContent = formatRupiah(stats.total_tagihan);
            document.getElementById('total-terbayar').textContent = formatRupiah(stats.total_terbayar);
            document.getElementById('total-tunggakan').textContent = formatRupiah(stats.total_tunggakan);
            document.getElementById('pending-count').textContent = stats.jumlah_pembayaran_pending;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// ============================================
// GENERATE SPP - WITH CONFIRMATION
// ============================================

async function generateSPP() {
    if (isSubmitting) return;

    // SweetAlert2 confirmation with senior-friendly design
    const result = await Swal.fire({
        title: 'Generate Tagihan SPP?',
        html: `
            <div style="text-align: left; font-size: 15px; line-height: 1.8;">
                <p>Sistem akan membuat tagihan SPP bulanan untuk:</p>
                <ul style="margin: 12px 0; padding-left: 20px;">
                    <li><strong>Semua siswa aktif</strong></li>
                    <li><strong>Bulan ini</strong></li>
                </ul>
                <p style="color: #666;">Tagihan yang sudah ada tidak akan dibuat ulang.</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<span style="font-size: 16px;">Ya, Generate Sekarang</span>',
        cancelButtonText: '<span style="font-size: 16px;">Batal</span>',
        reverseButtons: true,
        customClass: {
            popup: 'swal-senior-popup',
            title: 'swal-senior-title',
            confirmButton: 'swal-senior-btn',
            cancelButton: 'swal-senior-btn'
        }
    });

    if (!result.isConfirmed) return;

    const btn = document.getElementById('btn-generate-spp');
    isSubmitting = true;
    const originalText = btn.querySelector('.btn-text').textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span class="btn-text">Memproses...</span>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/finance/generate-spp/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            // Show success with large indicator
            await Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                html: `
                    <div style="font-size: 16px; line-height: 1.8;">
                        <p><strong>${data.created}</strong> tagihan baru dibuat</p>
                        <p>${data.skipped} tagihan sudah ada sebelumnya</p>
                        <p style="margin-top: 12px; color: #059669; font-weight: 600;">
                            Periode: ${data.periode}
                        </p>
                    </div>
                `,
                confirmButtonColor: '#059669',
                confirmButtonText: 'OK'
            });

            loadTagihan();
            loadStatistics();
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Perhatian',
                text: data.message || 'Tidak ada tagihan yang di-generate',
                confirmButtonColor: '#059669'
            });
        }
    } catch (error) {
        console.error('Error generating SPP:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Terjadi kesalahan saat generate tagihan',
            confirmButtonColor: '#059669'
        });
    } finally {
        isSubmitting = false;
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">${originalText}</span>`;
    }
}

// ============================================
// TAGIHAN (ADMIN VIEW)
// ============================================

async function loadTagihan(page = 1) {
    tagihanPage = page;
    const tbody = document.getElementById('tagihan-table-body');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><div class="loading-spinner"></div></td></tr>';

    try {
        const token = localStorage.getItem('access_token');
        let url = `/api/finance/tagihan/?page=${page}`;

        // Add filters
        const kelas = document.getElementById('filter-kelas')?.value;
        const status = document.getElementById('filter-status')?.value;
        const bulan = document.getElementById('filter-bulan')?.value;
        const search = document.getElementById('search-tagihan')?.value;

        if (kelas) url += `&kelas=${encodeURIComponent(kelas)}`;
        if (status) url += `&status=${status}`;
        if (bulan) url += `&bulan=${bulan}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load tagihan');

        const data = await response.json();
        currentTagihan = data.results || [];
        tagihanTotalPages = Math.ceil(data.count / 25);

        renderTagihanTable();
        updateTagihanPagination();
    } catch (error) {
        console.error('Error loading tagihan:', error);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Error loading data</td></tr>';
    }
}

function renderTagihanTable() {
    const tbody = document.getElementById('tagihan-table-body');

    // Smart Empty State
    if (currentTagihan.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11">
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <div class="empty-title">Belum Ada Tagihan</div>
                        <div class="empty-desc">
                            Klik tombol "Generate SPP" untuk membuat tagihan bulanan bagi semua siswa aktif.
                        </div>
                        <button class="empty-action" onclick="generateSPP()">
                            <span>➕</span> Generate SPP Sekarang
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentTagihan.map((t, idx) => {
        const statusBadge = getStatusBadge(t.status, t.status_display);
        const periode = t.bulan_display ? `${t.bulan_display} ${t.tahun}` : t.tahun;
        const invoiceNo = t.no_invoice || '-';

        return `
            <tr>
                <td>${(tagihanPage - 1) * 25 + idx + 1}</td>
                <td>
                    <span class="invoice-cell" title="${invoiceNo}">${formatInvoiceDisplay(invoiceNo)}</span>
                </td>
                <td class="student-cell">
                    <div class="student-name">${escapeHtml(t.siswa_nama)}</div>
                    <div class="student-nisn">${t.siswa_nisn}</div>
                </td>
                <td>${escapeHtml(t.siswa_kelas || '-')}</td>
                <td>${escapeHtml(t.tarif_nama)}</td>
                <td>${periode}</td>
                <td class="nominal">${formatRupiah(t.total)}</td>
                <td class="nominal positive">${formatRupiah(t.terbayar)}</td>
                <td class="nominal ${t.sisa > 0 ? 'negative' : 'positive'}">${formatRupiah(t.sisa)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button onclick="viewTagihanSlip(${t.id})" class="action-btn action-view" title="Lihat Invoice">
                            <span class="btn-icon">📄</span>
                            <span class="btn-label">Invoice</span>
                        </button>
                        ${t.sisa > 0 ? `
                            <button onclick="openBayarModal(${t.id})" class="action-btn action-pay" title="Bayar">
                                <span class="btn-icon">💳</span>
                                <span class="btn-label">Bayar</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Format Invoice Number for Display (truncate if too long)
function formatInvoiceDisplay(invoiceNo) {
    if (!invoiceNo || invoiceNo === '-') return '-';
    // Show format: INV-YYYYMM-XXX
    const parts = invoiceNo.split('-');
    if (parts.length >= 3) {
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return invoiceNo.length > 18 ? invoiceNo.substring(0, 18) + '...' : invoiceNo;
}

function getStatusBadge(status, display) {
    // Dashboard-consistent badge styling
    const config = {
        'lunas': {
            class: 'badge-lunas',
            icon: '✓',
            text: 'Lunas'
        },
        'sebagian': {
            class: 'badge-sebagian',
            icon: '◐',
            text: 'Sebagian'
        },
        'belum_bayar': {
            class: 'badge-belum',
            icon: '○',
            text: 'Belum Bayar'
        },
        'lewat_jatuh_tempo': {
            class: 'badge-overdue',
            icon: '⚠',
            text: 'Terlambat'
        }
    };

    const cfg = config[status] || { class: '', icon: '', text: display };
    return `<span class="badge badge-status ${cfg.class}">${cfg.icon} ${cfg.text}</span>`;
}

function updateTagihanPagination() {
    const currentPageEl = document.getElementById('current-page-tagihan');
    const totalPagesEl = document.getElementById('total-pages-tagihan');
    const prevBtn = document.getElementById('btn-prev-tagihan');
    const nextBtn = document.getElementById('btn-next-tagihan');

    if (currentPageEl) currentPageEl.textContent = tagihanPage;
    if (totalPagesEl) totalPagesEl.textContent = tagihanTotalPages;
    if (prevBtn) prevBtn.disabled = tagihanPage <= 1;
    if (nextBtn) nextBtn.disabled = tagihanPage >= tagihanTotalPages;
}

function loadTagihanPage(direction) {
    if (direction === 'prev' && tagihanPage > 1) {
        loadTagihan(tagihanPage - 1);
    } else if (direction === 'next' && tagihanPage < tagihanTotalPages) {
        loadTagihan(tagihanPage + 1);
    }
}

// ============================================
// PENDING VERIFICATIONS (BENDAHARA VIEW)
// ============================================

async function loadPendingVerifications() {
    const container = document.getElementById('verification-list');
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/finance/pembayaran/?terverifikasi=false', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load pending verifications');

        const data = await response.json();
        pendingVerifications = data.results || [];

        renderVerificationList();
    } catch (error) {
        console.error('Error loading pending verifications:', error);
        container.innerHTML = '<p class="text-center">Error loading data</p>';
    }
}

function renderVerificationList() {
    const container = document.getElementById('verification-list');

    // Smart Empty State
    if (pendingVerifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-title">Semua Sudah Terverifikasi</div>
                <div class="empty-desc">
                    Tidak ada pembayaran yang menunggu verifikasi saat ini.
                    Pembayaran baru akan muncul di sini setelah wali santri mengirim bukti transfer.
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = pendingVerifications.map(p => {
        const tanggal = new Date(p.tanggal).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        // Safe image handling - prevent 404 loop
        const hasBukti = p.bukti && p.bukti.trim() !== '';
        const buktiHtml = hasBukti
            ? `<img src="${p.bukti}" alt="Bukti Transfer" class="bukti-preview" onclick="previewBuktiImage('${p.bukti}')" onerror="handleImageError(this)">`
            : `<div class="bukti-placeholder">📷</div>`;

        return `
            <div class="verification-card" id="verification-card-${p.id}">
                ${buktiHtml}
                <div class="info">
                    <div class="nama">${escapeHtml(p.siswa_nama)}</div>
                    <div class="detail">${escapeHtml(p.tarif_nama)} - ${p.metode_display}</div>
                </div>
                <div class="nominal-wrap">
                    <div class="nominal-value">${formatRupiah(p.nominal)}</div>
                    <div class="tanggal">${tanggal}</div>
                </div>
                <button class="action-btn action-verify" id="btn-verify-${p.id}" onclick="verifyPaymentWithConfirm(${p.id}, '${escapeHtml(p.siswa_nama)}', ${p.nominal})">
                    <span class="btn-icon">✓</span>
                    <span class="btn-label">Verifikasi</span>
                </button>
            </div>
        `;
    }).join('');
}

// Handle image error without looping
function handleImageError(img) {
    // Prevent infinite loop by removing onerror handler
    img.onerror = null;
    // Replace with placeholder div
    const placeholder = document.createElement('div');
    placeholder.className = 'bukti-placeholder';
    placeholder.innerHTML = '📷';
    img.parentNode.replaceChild(placeholder, img);
}

// ============================================
// VERIFY PAYMENT - WITH CONFIRMATION
// ============================================

async function verifyPaymentWithConfirm(id, siswaNama, nominal) {
    if (isSubmitting) return;

    // SweetAlert2 confirmation
    const result = await Swal.fire({
        title: 'Verifikasi Pembayaran?',
        html: `
            <div style="text-align: left; font-size: 15px; line-height: 1.8; padding: 10px 0;">
                <table style="width: 100%;">
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Siswa:</td>
                        <td style="padding: 8px 0; font-weight: 600;">${siswaNama}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;">Nominal:</td>
                        <td style="padding: 8px 0; font-weight: 600; color: #059669; font-size: 18px;">${formatRupiah(nominal)}</td>
                    </tr>
                </table>
                <p style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 8px; color: #92400e;">
                    ⚠️ Pastikan bukti transfer sudah dicek dan nominal sesuai!
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<span style="font-size: 16px;">Ya, Verifikasi</span>',
        cancelButtonText: '<span style="font-size: 16px;">Batal</span>',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    await verifyPayment(id);
}

async function verifyPayment(id) {
    const btn = document.getElementById(`btn-verify-${id}`);
    if (!btn) return;

    isSubmitting = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-small"></span> <span class="btn-label">Memproses...</span>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/finance/pembayaran/${id}/verify/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ terverifikasi: true })
        });

        const data = await response.json();

        if (data.success) {
            // Show large success indicator
            showSuccessOverlay('Verifikasi Berhasil!');

            // Update card appearance
            const card = document.getElementById(`verification-card-${id}`);
            if (card) {
                card.classList.add('verified');
            }

            // Reload after delay
            setTimeout(() => {
                loadPendingVerifications();
                loadStatistics();
            }, 1500);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: data.message || 'Gagal memverifikasi pembayaran',
                confirmButtonColor: '#059669'
            });
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">✓</span> <span class="btn-label">Verifikasi</span>';
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Terjadi kesalahan saat verifikasi',
            confirmButtonColor: '#059669'
        });
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">✓</span> <span class="btn-label">Verifikasi</span>';
    } finally {
        isSubmitting = false;
    }
}

// ============================================
// SUCCESS OVERLAY - LARGE INDICATOR
// ============================================

function showSuccessOverlay(message = 'Berhasil!') {
    const overlay = document.getElementById('success-overlay');
    const textEl = document.getElementById('success-text');

    if (overlay && textEl) {
        textEl.textContent = message;
        overlay.classList.add('active');

        // Auto-hide after 1.5 seconds
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 1500);
    }
}

// ============================================
// PEMBAYARAN
// ============================================

async function loadPembayaran() {
    const tbody = document.getElementById('pembayaran-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><div class="loading-spinner"></div></td></tr>';

    try {
        const token = localStorage.getItem('access_token');
        let url = '/api/finance/pembayaran/';

        // Add filters
        const verifikasi = document.getElementById('filter-verifikasi')?.value;
        const metode = document.getElementById('filter-metode')?.value;

        const params = new URLSearchParams();
        if (verifikasi) params.append('terverifikasi', verifikasi);
        if (metode) params.append('metode', metode);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load pembayaran');

        const data = await response.json();
        currentPembayaran = data.results || [];

        renderPembayaranTable();
    } catch (error) {
        console.error('Error loading pembayaran:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Error loading data</td></tr>';
    }
}

function renderPembayaranTable() {
    const tbody = document.getElementById('pembayaran-table-body');

    // Smart Empty State
    if (currentPembayaran.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">💳</div>
                        <div class="empty-title">Belum Ada Riwayat Pembayaran</div>
                        <div class="empty-desc">
                            Riwayat pembayaran akan muncul setelah wali santri mengirim bukti transfer.
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentPembayaran.map((p, idx) => {
        const tanggal = new Date(p.tanggal).toLocaleDateString('id-ID');
        const statusBadge = p.terverifikasi
            ? '<span class="badge badge-status badge-verified">✓ Verified</span>'
            : '<span class="badge badge-status badge-pending">⏳ Pending</span>';

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${tanggal}</td>
                <td><strong>${escapeHtml(p.siswa_nama)}</strong></td>
                <td>${escapeHtml(p.tarif_nama)}</td>
                <td class="nominal">${formatRupiah(p.nominal)}</td>
                <td>${p.metode_display}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        ${p.bukti ? `
                            <button onclick="previewBuktiImage('${p.bukti}')" class="action-btn action-view" title="Lihat Bukti">
                                <span class="btn-icon">📷</span>
                                <span class="btn-label">Bukti</span>
                            </button>
                        ` : ''}
                        ${!p.terverifikasi ? `
                            <button onclick="verifyPaymentWithConfirm(${p.id}, '${escapeHtml(p.siswa_nama)}', ${p.nominal})" class="action-btn action-verify" title="Verifikasi">
                                <span class="btn-icon">✓</span>
                                <span class="btn-label">Verifikasi</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// TARIF
// ============================================

async function loadTarif() {
    const tbody = document.getElementById('tarif-table-body');
    tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="loading-spinner"></div></td></tr>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/finance/tarif/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load tarif');

        const data = await response.json();
        currentTarif = data.results || [];

        renderTarifTable();
    } catch (error) {
        console.error('Error loading tarif:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading data</td></tr>';
    }
}

function renderTarifTable() {
    const tbody = document.getElementById('tarif-table-body');

    // Smart Empty State
    if (currentTarif.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-icon">📑</div>
                        <div class="empty-title">Belum Ada Tarif</div>
                        <div class="empty-desc">
                            Tambahkan tarif pembayaran (SPP, Uang Gedung, dll) terlebih dahulu sebelum generate tagihan.
                        </div>
                        <button class="empty-action" onclick="openTarifModal()">
                            <span>➕</span> Tambah Tarif Baru
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentTarif.map((t, idx) => {
        const statusBadge = t.aktif
            ? '<span class="badge badge-status badge-verified">✓ Aktif</span>'
            : '<span class="badge badge-status badge-belum">○ Nonaktif</span>';

        return `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${escapeHtml(t.nama)}</strong></td>
                <td>${t.kategori_display}</td>
                <td>${t.frekuensi_display}</td>
                <td class="nominal">${formatRupiah(t.nominal)}</td>
                <td>${t.tahun_ajaran}</td>
                <td>${t.kelas || 'Semua'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button onclick="editTarif(${t.id})" class="action-btn action-edit" title="Edit">
                            <span class="btn-icon">✏️</span>
                            <span class="btn-label">Edit</span>
                        </button>
                        <button onclick="deleteTarif(${t.id})" class="action-btn action-delete" title="Hapus">
                            <span class="btn-icon">🗑️</span>
                            <span class="btn-label">Hapus</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// WALISANTRI VIEW
// ============================================

async function loadWalisantriData() {
    try {
        const token = localStorage.getItem('access_token');
        const nisn = currentUser.linked_student_nisn;

        if (!nisn) {
            document.getElementById('ws-tagihan-tbody').innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-icon">❓</div>
                            <div class="empty-title">Data Siswa Belum Terhubung</div>
                            <div class="empty-desc">
                                Akun Anda belum terhubung dengan data siswa.
                                Silakan hubungi admin untuk menghubungkan akun dengan data ananda.
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const response = await fetch(`/api/finance/student/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load student finance');

        const data = await response.json();

        if (data.success) {
            const summary = data.summary;

            // Update hero card
            document.getElementById('ws-hero-tunggakan').textContent = formatRupiah(summary.total_tunggakan);

            // Update summary cards
            document.getElementById('ws-total-tagihan').textContent = formatRupiah(summary.total_tagihan);
            document.getElementById('ws-total-terbayar').textContent = formatRupiah(summary.total_terbayar);
            document.getElementById('ws-tagihan-count').textContent = summary.jumlah_tagihan || data.recent_tagihan?.length || 0;

            // Render tagihan table
            renderWalisantriTagihan(data.recent_tagihan);
        }
    } catch (error) {
        console.error('Error loading walisantri data:', error);
        showToast('Gagal memuat data keuangan', 'error');
    }
}

function renderWalisantriTagihan(tagihan) {
    const tbody = document.getElementById('ws-tagihan-tbody');

    // Store for later use in slip modal
    window.walisantriTagihan = tagihan;

    // Smart Empty State
    if (!tagihan || tagihan.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <div class="empty-title">Belum Ada Tagihan</div>
                        <div class="empty-desc">
                            Tagihan pembayaran untuk ananda belum tersedia.
                            Tagihan akan muncul setelah digenerate oleh bendahara.
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = tagihan.map(t => {
        const periode = t.bulan_display ? `${t.bulan_display} ${t.tahun}` : t.tahun;
        const statusBadge = getStatusBadge(t.status, t.status_display);
        const canPay = t.status !== 'lunas' && t.sisa > 0;
        const invoiceNo = t.no_invoice || '-';

        return `
            <tr>
                <td>
                    <span class="invoice-cell" title="${invoiceNo}">${formatInvoiceDisplay(invoiceNo)}</span>
                </td>
                <td><strong>${escapeHtml(t.tarif_nama)}</strong></td>
                <td>${periode}</td>
                <td style="text-align: right;">
                    <div class="nominal ${t.sisa > 0 ? 'negative' : 'positive'}">
                        ${formatRupiah(t.sisa > 0 ? t.sisa : t.total)}
                    </div>
                    ${t.sisa > 0 && t.sisa < t.total ? `
                        <small style="color:var(--text-muted);">dari ${formatRupiah(t.total)}</small>
                    ` : ''}
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn action-view" onclick="viewWalisantriSlip(${t.id})" title="Lihat Invoice">
                            <span class="btn-icon">📄</span>
                            <span class="btn-label">Invoice</span>
                        </button>
                        ${canPay ? `
                            <button class="action-btn action-pay" onclick="openBayarModal(${t.id}, '${escapeHtml(t.tarif_nama)}', '${periode}', ${t.sisa})">
                                <span class="btn-icon">💳</span>
                                <span class="btn-label">Bayar</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// View Invoice Slip for Walisantri
function viewWalisantriSlip(id) {
    const tagihan = window.walisantriTagihan?.find(t => t.id === id);
    if (!tagihan) {
        showToast('Data tagihan tidak ditemukan', 'error');
        return;
    }

    const periode = tagihan.bulan_display ? `${tagihan.bulan_display} ${tagihan.tahun}` : tagihan.tahun;
    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Populate Invoice Slip
    document.getElementById('slip-invoice-no').textContent = tagihan.no_invoice || '-';
    document.getElementById('slip-tanggal').textContent = today;
    document.getElementById('slip-siswa').textContent = tagihan.siswa_nama || currentUser?.name || '-';
    document.getElementById('slip-nisn').textContent = tagihan.siswa_nisn || currentUser?.linked_student_nisn || '-';
    document.getElementById('slip-kelas').textContent = tagihan.siswa_kelas || '-';

    // Items
    document.getElementById('slip-items').innerHTML = `
        <tr>
            <td>${escapeHtml(tagihan.tarif_nama)} - ${periode}</td>
            <td style="text-align: right; font-weight: 600;">${formatRupiah(tagihan.nominal)}</td>
        </tr>
        ${parseFloat(tagihan.diskon) > 0 ? `
            <tr>
                <td style="color: #16a34a;">Diskon</td>
                <td style="text-align: right; color: #16a34a;">- ${formatRupiah(tagihan.diskon)}</td>
            </tr>
        ` : ''}
        ${parseFloat(tagihan.denda) > 0 ? `
            <tr>
                <td style="color: #dc2626;">Denda</td>
                <td style="text-align: right; color: #dc2626;">+ ${formatRupiah(tagihan.denda)}</td>
            </tr>
        ` : ''}
    `;

    // Summary
    document.getElementById('slip-total').textContent = formatRupiah(tagihan.total);
    document.getElementById('slip-terbayar').textContent = formatRupiah(tagihan.terbayar);
    document.getElementById('slip-sisa').textContent = formatRupiah(tagihan.sisa);

    // Status Badge
    const statusBadge = getStatusBadge(tagihan.status, tagihan.status_display);
    document.getElementById('slip-status-container').innerHTML = statusBadge;

    openModal('modal-invoice-slip');
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openBayarModal(tagihanId, tarifNama, periode, sisa) {
    // Set modal data
    if (tarifNama) {
        document.getElementById('modal-tagihan-nama').textContent = tarifNama;
        document.getElementById('modal-tagihan-periode').textContent = periode;
        document.getElementById('modal-tagihan-sisa').textContent = formatRupiah(sisa);

        const nominalInput = document.getElementById('bayar-nominal');
        nominalInput.value = sisa.toLocaleString('id-ID');
    } else {
        // Find tagihan from loaded data
        const tagihan = currentTagihan.find(t => t.id === tagihanId);
        if (tagihan) {
            const periode = tagihan.bulan_display ? `${tagihan.bulan_display} ${tagihan.tahun}` : tagihan.tahun;
            document.getElementById('modal-tagihan-nama').textContent = tagihan.tarif_nama;
            document.getElementById('modal-tagihan-periode').textContent = `${tagihan.siswa_nama} - ${periode}`;
            document.getElementById('modal-tagihan-sisa').textContent = formatRupiah(tagihan.sisa);

            const nominalInput = document.getElementById('bayar-nominal');
            nominalInput.value = parseFloat(tagihan.sisa).toLocaleString('id-ID');
        }
    }

    document.getElementById('bayar-tagihan-id').value = tagihanId;

    // Reset form
    document.getElementById('bayar-metode').value = 'transfer';
    document.getElementById('bayar-bukti').value = '';
    document.getElementById('file-name').textContent = '';
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('upload-area').classList.remove('has-file');

    openModal('modal-bayar');

    // Setup input masking for the modal
    const nominalInput = document.getElementById('bayar-nominal');
    nominalInput.type = 'text';
    nominalInput.inputMode = 'numeric';
}

function previewBukti(input) {
    const file = input.files[0];
    if (file) {
        // Validate file
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            Swal.fire({
                icon: 'error',
                title: 'Format Tidak Valid',
                text: 'Hanya file JPG, JPEG, atau PNG yang diizinkan.',
                confirmButtonColor: '#059669'
            });
            input.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            Swal.fire({
                icon: 'error',
                title: 'Ukuran Terlalu Besar',
                text: 'Ukuran file maksimal 2MB.',
                confirmButtonColor: '#059669'
            });
            input.value = '';
            return;
        }

        document.getElementById('file-name').textContent = file.name;
        document.getElementById('upload-area').classList.add('has-file');

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('file-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function previewBuktiImage(url) {
    document.getElementById('preview-bukti-img').src = url;
    openModal('modal-preview-bukti');
}

async function submitPembayaran(event) {
    if (event) event.preventDefault();
    if (isSubmitting) return;

    const btn = document.getElementById('btn-submit-bayar');
    const tagihanId = document.getElementById('bayar-tagihan-id').value;
    const nominalFormatted = document.getElementById('bayar-nominal').value;
    const nominal = parseNominalValue(nominalFormatted);
    const metode = document.getElementById('bayar-metode').value;
    const buktiFile = document.getElementById('bayar-bukti').files[0];

    if (!tagihanId || !nominal || !buktiFile) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Belum Lengkap',
            html: `
                <div style="text-align: left; font-size: 15px;">
                    Mohon lengkapi:
                    <ul style="margin-top: 10px;">
                        ${!nominal ? '<li>Nominal pembayaran</li>' : ''}
                        ${!buktiFile ? '<li>Bukti transfer</li>' : ''}
                    </ul>
                </div>
            `,
            confirmButtonColor: '#059669'
        });
        return;
    }

    // Confirmation
    const result = await Swal.fire({
        title: 'Kirim Bukti Pembayaran?',
        html: `
            <div style="font-size: 15px; line-height: 1.8;">
                <p>Nominal: <strong style="color: #059669; font-size: 18px;">${formatRupiah(nominal)}</strong></p>
                <p>Metode: <strong>${metode === 'transfer' ? 'Transfer Bank' : 'QRIS'}</strong></p>
                <p style="margin-top: 12px; color: #666;">Pembayaran akan diverifikasi oleh bendahara.</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Kirim',
        cancelButtonText: 'Batal',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    isSubmitting = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-small"></span> Mengirim...';

    try {
        const token = localStorage.getItem('access_token');
        const formData = new FormData();
        formData.append('tagihan', tagihanId);
        formData.append('nominal', nominal);
        formData.append('metode', metode);
        formData.append('bukti', buktiFile);

        const response = await fetch('/api/finance/pembayaran/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            closeModal('modal-bayar');
            showSuccessOverlay('Bukti Terkirim!');

            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    html: `
                        <div style="font-size: 15px; line-height: 1.8;">
                            <p>Bukti pembayaran berhasil dikirim.</p>
                            <p style="color: #666; margin-top: 8px;">Mohon tunggu proses verifikasi oleh bendahara.</p>
                        </div>
                    `,
                    confirmButtonColor: '#059669'
                });
            }, 1600);

            // Reload data
            if (currentUser.role === 'walisantri') {
                loadWalisantriData();
            } else {
                loadTagihan();
                loadStatistics();
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: data.detail || data.message || 'Gagal mengirim pembayaran',
                confirmButtonColor: '#059669'
            });
        }
    } catch (error) {
        console.error('Error submitting payment:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Terjadi kesalahan saat mengirim pembayaran',
            confirmButtonColor: '#059669'
        });
    } finally {
        isSubmitting = false;
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-text">Kirim Bukti</span>';
    }
}

// ============================================
// ACCORDION
// ============================================

function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const isActive = header.classList.contains('active');

    // Close all accordions in same container
    const container = header.closest('.accordion');
    container.querySelectorAll('.accordion-header').forEach(h => {
        h.classList.remove('active');
        h.nextElementSibling.classList.remove('active');
    });

    // Toggle current if wasn't active
    if (!isActive) {
        header.classList.add('active');
        content.classList.add('active');
    }
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Nomor rekening disalin!', 'success');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Nomor rekening disalin!', 'success');
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.className = 'toast active ' + (type === 'error' ? 'error' : '');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }
}

// ============================================
// PLACEHOLDER FUNCTIONS
// ============================================

function viewTagihan(id) {
    const tagihan = currentTagihan.find(t => t.id === id);
    if (tagihan) {
        viewTagihanSlip(id);
    }
}

// ============================================
// INVOICE SLIP MODAL - RECEIPT STYLE
// ============================================

function viewTagihanSlip(id) {
    const tagihan = currentTagihan.find(t => t.id === id);
    if (!tagihan) {
        showToast('Data tagihan tidak ditemukan', 'error');
        return;
    }

    const periode = tagihan.bulan_display ? `${tagihan.bulan_display} ${tagihan.tahun}` : tagihan.tahun;
    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Populate Invoice Slip
    document.getElementById('slip-invoice-no').textContent = tagihan.no_invoice || '-';
    document.getElementById('slip-tanggal').textContent = today;
    document.getElementById('slip-siswa').textContent = tagihan.siswa_nama;
    document.getElementById('slip-nisn').textContent = tagihan.siswa_nisn;
    document.getElementById('slip-kelas').textContent = tagihan.siswa_kelas || '-';

    // Items
    document.getElementById('slip-items').innerHTML = `
        <tr>
            <td>${escapeHtml(tagihan.tarif_nama)} - ${periode}</td>
            <td style="text-align: right; font-weight: 600;">${formatRupiah(tagihan.nominal)}</td>
        </tr>
        ${parseFloat(tagihan.diskon) > 0 ? `
            <tr>
                <td style="color: #16a34a;">Diskon</td>
                <td style="text-align: right; color: #16a34a;">- ${formatRupiah(tagihan.diskon)}</td>
            </tr>
        ` : ''}
        ${parseFloat(tagihan.denda) > 0 ? `
            <tr>
                <td style="color: #dc2626;">Denda</td>
                <td style="text-align: right; color: #dc2626;">+ ${formatRupiah(tagihan.denda)}</td>
            </tr>
        ` : ''}
    `;

    // Summary
    document.getElementById('slip-total').textContent = formatRupiah(tagihan.total);
    document.getElementById('slip-terbayar').textContent = formatRupiah(tagihan.terbayar);
    document.getElementById('slip-sisa').textContent = formatRupiah(tagihan.sisa);

    // Status Badge
    const statusBadge = getStatusBadge(tagihan.status, tagihan.status_display);
    document.getElementById('slip-status-container').innerHTML = statusBadge;

    openModal('modal-invoice-slip');
}

function printInvoice() {
    const modal = document.getElementById('modal-invoice-slip');
    const content = modal.querySelector('.invoice-slip-modal');

    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice - Ponpes Baron</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                .invoice-header { text-align: center; padding: 20px; background: #059669; color: white; border-radius: 8px 8px 0 0; }
                .invoice-logo { font-size: 36px; margin-bottom: 10px; }
                .invoice-brand h2 { font-size: 16px; margin-bottom: 4px; }
                .invoice-brand p { font-size: 10px; opacity: 0.9; }
                .invoice-title { text-align: center; padding: 15px; background: #ecfdf5; }
                .invoice-title h3 { font-size: 14px; margin-bottom: 8px; }
                .invoice-number { font-size: 12px; font-weight: bold; color: #059669; }
                .divider { border-bottom: 1px dashed #ccc; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                td, th { padding: 6px 4px; font-size: 11px; }
                .label { color: #666; }
                .value { font-weight: bold; }
                .text-right { text-align: right; }
                .total-row { font-size: 14px; font-weight: bold; border-top: 2px solid #333; }
                .total-row td { padding-top: 10px; }
                .status { text-align: center; padding: 15px; }
                .badge { display: inline-block; padding: 8px 20px; border-radius: 4px; font-weight: bold; text-transform: uppercase; }
                .badge-lunas { background: #28a745; color: white; }
                .badge-sebagian { background: #fd7e14; color: white; }
                .badge-belum { background: #dc3545; color: white; }
                .badge-overdue { background: #b91c1c; color: white; }
                .footer { text-align: center; padding: 15px; font-size: 10px; color: #666; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            ${content.innerHTML}
            <script>
                document.querySelector('.invoice-actions')?.remove();
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ============================================
// CRUD TARIF FUNCTIONS
// ============================================

let editingTarifId = null;

function openGenerateModal() {
    showToast('Fitur generate tagihan manual akan segera tersedia', 'info');
}

function openTarifModal(tarifId = null) {
    editingTarifId = tarifId;

    // Reset form
    document.getElementById('tarif-form').reset();
    document.getElementById('tarif-id').value = '';

    if (tarifId) {
        // Edit mode - load existing data
        document.getElementById('modal-tarif-title').textContent = '✏️ Edit Tarif';
        document.getElementById('btn-submit-tarif').innerHTML = '<span class="btn-text">Simpan Perubahan</span>';

        const tarif = currentTarif.find(t => t.id === tarifId);
        if (tarif) {
            document.getElementById('tarif-id').value = tarif.id;
            document.getElementById('tarif-nama').value = tarif.nama;
            document.getElementById('tarif-kategori').value = tarif.kategori;
            document.getElementById('tarif-frekuensi').value = tarif.frekuensi;
            document.getElementById('tarif-nominal').value = parseFloat(tarif.nominal).toLocaleString('id-ID');
            document.getElementById('tarif-tahun-ajaran').value = tarif.tahun_ajaran;
            document.getElementById('tarif-kelas').value = tarif.kelas || '';
            document.getElementById('tarif-deskripsi').value = tarif.deskripsi || '';
            document.getElementById('tarif-aktif').checked = tarif.aktif;
        }
    } else {
        // Create mode
        document.getElementById('modal-tarif-title').textContent = '➕ Tambah Tarif Baru';
        document.getElementById('btn-submit-tarif').innerHTML = '<span class="btn-text">Simpan Tarif</span>';
        document.getElementById('tarif-aktif').checked = true;
        // Set default tahun ajaran
        document.getElementById('tarif-tahun-ajaran').value = '2025/2026';
    }

    openModal('modal-tarif');
}

async function submitTarif(event) {
    if (event) event.preventDefault();
    if (isSubmitting) return;

    const btn = document.getElementById('btn-submit-tarif');
    const tarifId = document.getElementById('tarif-id').value;
    const isEdit = !!tarifId;

    // Collect form data
    const nominalRaw = document.getElementById('tarif-nominal').value;
    const nominal = parseNominalValue(nominalRaw);

    const data = {
        nama: document.getElementById('tarif-nama').value.trim(),
        kategori: document.getElementById('tarif-kategori').value,
        frekuensi: document.getElementById('tarif-frekuensi').value,
        nominal: nominal,
        tahun_ajaran: document.getElementById('tarif-tahun-ajaran').value.trim(),
        kelas: document.getElementById('tarif-kelas').value.trim() || null,
        deskripsi: document.getElementById('tarif-deskripsi').value.trim() || null,
        aktif: document.getElementById('tarif-aktif').checked
    };

    // Validation
    if (!data.nama) {
        Swal.fire({ icon: 'warning', title: 'Nama Tarif wajib diisi', confirmButtonColor: '#059669' });
        return;
    }
    if (!data.nominal || data.nominal <= 0) {
        Swal.fire({ icon: 'warning', title: 'Nominal harus lebih dari 0', confirmButtonColor: '#059669' });
        return;
    }
    if (!data.tahun_ajaran || !/^\d{4}\/\d{4}$/.test(data.tahun_ajaran)) {
        Swal.fire({ icon: 'warning', title: 'Format Tahun Ajaran salah', text: 'Gunakan format YYYY/YYYY (contoh: 2025/2026)', confirmButtonColor: '#059669' });
        return;
    }

    isSubmitting = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-small"></span> Menyimpan...';

    try {
        const token = localStorage.getItem('access_token');
        const url = isEdit ? `/api/finance/tarif/${tarifId}/` : '/api/finance/tarif/';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            closeModal('modal-tarif');
            showSuccessOverlay(isEdit ? 'Tarif Diperbarui!' : 'Tarif Ditambahkan!');
            loadTarif();
        } else {
            // Show validation errors
            let errorMsg = 'Gagal menyimpan tarif';
            if (result.detail) {
                errorMsg = result.detail;
            } else if (typeof result === 'object') {
                errorMsg = Object.entries(result).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
            }
            Swal.fire({ icon: 'error', title: 'Gagal', text: errorMsg, confirmButtonColor: '#059669' });
        }
    } catch (error) {
        console.error('Error saving tarif:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan saat menyimpan tarif', confirmButtonColor: '#059669' });
    } finally {
        isSubmitting = false;
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">${isEdit ? 'Simpan Perubahan' : 'Simpan Tarif'}</span>`;
    }
}

function editTarif(id) {
    openTarifModal(id);
}

async function deleteTarif(id) {
    const tarif = currentTarif.find(t => t.id === id);
    const tarifName = tarif ? tarif.nama : 'Tarif';

    const result = await Swal.fire({
        title: 'Hapus Tarif?',
        html: `
            <div style="text-align: left; font-size: 14px;">
                <p>Anda akan menghapus tarif:</p>
                <p style="font-weight: 600; color: #dc2626; margin: 10px 0;">${escapeHtml(tarifName)}</p>
                <p style="color: #666;">Tarif yang sudah digunakan pada tagihan tidak dapat dihapus.</p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/finance/tarif/${id}/`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok || response.status === 204) {
            showSuccessOverlay('Tarif Dihapus!');
            loadTarif();
        } else {
            const data = await response.json().catch(() => ({}));
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: data.detail || 'Tarif tidak dapat dihapus karena sudah digunakan pada tagihan.',
                confirmButtonColor: '#059669'
            });
        }
    } catch (error) {
        console.error('Error deleting tarif:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Terjadi kesalahan saat menghapus tarif',
            confirmButtonColor: '#059669'
        });
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

window.loadTagihanPage = loadTagihanPage;
window.generateSPP = generateSPP;
window.verifyPaymentWithConfirm = verifyPaymentWithConfirm;
window.verifyPayment = verifyPayment;
window.openGenerateModal = openGenerateModal;
window.openTarifModal = openTarifModal;
window.openBayarModal = openBayarModal;
window.viewTagihan = viewTagihan;
window.viewTagihanSlip = viewTagihanSlip;
window.viewWalisantriSlip = viewWalisantriSlip;
window.printInvoice = printInvoice;
window.editTarif = editTarif;
window.deleteTarif = deleteTarif;
window.closeModal = closeModal;
window.previewBukti = previewBukti;
window.previewBuktiImage = previewBuktiImage;
window.submitPembayaran = submitPembayaran;
window.toggleAccordion = toggleAccordion;
window.copyToClipboard = copyToClipboard;
window.showSuccessOverlay = showSuccessOverlay;
window.formatInvoiceDisplay = formatInvoiceDisplay;
window.submitTarif = submitTarif;
window.handleImageError = handleImageError;
