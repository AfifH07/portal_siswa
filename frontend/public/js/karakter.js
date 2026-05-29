'use strict';

let karCurrentNisn = null;
let karChildren = [];
let karBLPEntries = [];
let karCurrentEntry = null;
let karBLPIndicators = {};

document.addEventListener('DOMContentLoaded', async () => {
    await initKarakter();
});

async function initKarakter() {
    try {
        const res = await window.apiFetch('users/me/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const user = d.user || d;

        if (!user || user.role !== 'walisantri') {
            window.location.href = '/dashboard';
            return;
        }

        const name = user.name || user.username || 'Bapak/Ibu';
        setText('user-name-display', name);
        setText('user-role-display', 'Wali Santri');
        setText('user-avatar-initials', getInitials(name));

        // Topbar date
        const now = new Date();
        setText('topbar-date', now.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }));

        // Logout
        const btnLogout = document.getElementById('btn-logout-karakter');
        if (btnLogout) btnLogout.onclick = () => {
            localStorage.clear();
            window.location.href = '/login';
        };

    } catch (e) {
        window.location.href = '/login';
        return;
    }

    // Setup tabs
    document.querySelectorAll('.kar-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.kar-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.kar-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            const content = document.getElementById(tabId);
            if (content) content.classList.add('active');

            if (btn.dataset.tab === 'evaluasi' && karCurrentNisn) {
                loadEvaluasi(karCurrentNisn);
            }
        };
    });

    // Load indicators
    await loadBLPIndicators();

    // Load children
    await loadChildren();

    // Child selector
    const sel = document.getElementById('kar-child-select');
    if (sel) {
        sel.onchange = () => {
            karCurrentNisn = sel.value;
            if (karCurrentNisn) loadBLP(karCurrentNisn);
        };
    }

    // BLP week selector
    const weekSel = document.getElementById('kar-blp-week');
    if (weekSel) {
        weekSel.onchange = () => {
            const entryId = weekSel.value;
            const entry = karBLPEntries.find(e => String(e.id) === entryId);
            if (entry) renderBLPEntry(entry);
        };
    }
}

async function loadBLPIndicators() {
    try {
        const res = await window.apiFetch('kesantrian/blp/indicators/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        karBLPIndicators = d.indicators || d.data || d || {};
    } catch (e) {
        console.warn('[karakter] gagal load indicators:', e);
    }
}

async function loadChildren() {
    try {
        const res = await window.apiFetch('kesantrian/my-children-summary/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        karChildren = Array.isArray(d.children) ? d.children : (d.data || []);
    } catch (e) {
        karChildren = [];
    }

    const sel = document.getElementById('kar-child-select');
    if (!sel) return;

    if (karChildren.length === 0) {
        sel.innerHTML = '<option value="">Tidak ada data anak</option>';
        return;
    }

    sel.innerHTML = karChildren.map(c =>
        `<option value="${escapeHtml(c.nisn)}">${escapeHtml(c.nama)} (${escapeHtml(c.kelas || '-')})</option>`
    ).join('');

    karCurrentNisn = karChildren[0].nisn;
    sel.value = karCurrentNisn;
    await loadBLP(karCurrentNisn);
}

async function loadBLP(nisn) {
    show('blp-loading');
    hide('blp-content');
    hide('blp-empty');

    try {
        const res = await window.apiFetch(`kesantrian/blp/student/${nisn}/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        karBLPEntries = Array.isArray(d.data) ? d.data
            : Array.isArray(d.results) ? d.results
            : Array.isArray(d) ? d : [];

        // Filter hanya status yang sudah dapat dilihat wali.
        const visible = karBLPEntries.filter(e =>
            ['submitted', 'approved', 'locked'].includes(e.status)
        );
        console.log('[karakter] BLP raw response:', JSON.stringify(d).slice(0, 500));
        console.log('[karakter] entries count:', karBLPEntries.length);
        console.log('[karakter] visible count:', visible.length);

        if (visible.length === 0) {
            hide('blp-loading');
            show('blp-empty');
            return;
        }

        // Isi week selector
        const weekSel = document.getElementById('kar-blp-week');
        if (weekSel) {
            weekSel.innerHTML = visible.map(e => {
                const label = formatPeriod(e.week_start, e.week_end);
                return `<option value="${e.id}">${escapeHtml(label)}</option>`;
            }).join('');
        }

        // Render entry terbaru
        hide('blp-loading');
        show('blp-content');
        renderBLPEntry(visible[0]);

    } catch (e) {
        hide('blp-loading');
        show('blp-empty');
        console.error('[karakter] BLP error:', e);
    }
}

function renderBLPEntry(entry) {
    karCurrentEntry = entry;

    // Score panel
    setText('kar-total-score', entry.total_score ?? '-');
    setText('kar-predikat', entry.predikat || '-');
    setText('kar-status', capitalizeFirst(entry.status || '-'));
    setText('kar-periode', formatPeriod(entry.week_start, entry.week_end));
    setText('kar-bonus', entry.bonus_points ?? '0');
    setText('kar-bonus-notes', entry.bonus_notes || '-');

    // Domain grid
    const domainGrid = document.getElementById('kar-domain-grid');
    const domainDetails = document.getElementById('kar-domain-details');
    const domainScores = entry.domain_scores || {};
    const iv = entry.indicator_values || {};

    if (domainGrid) {
        domainGrid.innerHTML = Object.entries(domainScores).map(([domain, scores]) => {
            const pct = scores.percentage || 0;
            const label = getDomainLabel(domain);
            return `
                <div class="kar-domain-card">
                    <div class="kar-domain-name">${escapeHtml(label)}</div>
                    <div class="kar-domain-bar-wrap">
                        <div class="kar-domain-bar" style="width:${pct}%"></div>
                    </div>
                    <div class="kar-domain-score">
                        <span>${scores.score ?? 0} / ${scores.max_score ?? 0}</span>
                        <span>${Math.round(pct)}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Detail indikator per domain
    if (domainDetails) {
        domainDetails.innerHTML = Object.entries(iv).map(([domain, indicators]) => {
            const label = getDomainLabel(domain);
            const domainMeta = karBLPIndicators[domain];
            const indicatorList = domainMeta?.indicators || [];

            const rows = Object.entries(indicators).map(([code, score]) => {
                const indMeta = indicatorList.find(i => i.code === code);
                const indLabel = indMeta?.label || code;
                return `
                    <div class="kar-indicator-row">
                        <span>${escapeHtml(indLabel)}</span>
                        <span class="kar-score-badge score-${score}">${score}</span>
                    </div>
                `;
            }).join('');

            if (!rows) return '';
            return `
                <div class="kar-card">
                    <div class="kar-card-title">${escapeHtml(label)}</div>
                    ${rows}
                </div>
            `;
        }).join('');
    }

    // Catatan
    const notesCard = document.getElementById('kar-notes-card');
    if (notesCard) {
        if (entry.catatan || entry.tindak_lanjut) {
            notesCard.style.display = '';
            setText('kar-catatan', entry.catatan || '-');
            const tlWrap = document.getElementById('kar-tindak-lanjut-wrap');
            if (entry.tindak_lanjut && tlWrap) {
                tlWrap.style.display = '';
                setText('kar-tindak-lanjut', entry.tindak_lanjut);
            }
        } else {
            notesCard.style.display = 'none';
        }
    }
}

async function loadEvaluasi(nisn) {
    show('eval-loading');
    hide('eval-list');
    hide('eval-empty');

    try {
        const res = await window.apiFetch(
            `kesantrian/incidents/?siswa_nisn=${nisn}`
        );
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const items = Array.isArray(d.results) ? d.results
            : Array.isArray(d.data) ? d.data
            : Array.isArray(d) ? d : [];

        hide('eval-loading');

        if (items.length === 0) {
            show('eval-empty');
            return;
        }

        const listEl = document.getElementById('eval-list');
        if (listEl) {
            listEl.innerHTML = items.map(incident => {
                const tingkatClass = {
                    ringan: 'badge-ringan',
                    sedang: 'badge-sedang',
                    berat: 'badge-berat',
                    kritis: 'badge-kritis'
                }[incident.tingkat] || 'badge-ringan';

                const statusIcon = {
                    open: '🔴',
                    in_discussion: '🟡',
                    resolved: '🟢',
                    closed: '⚪'
                }[incident.status] || '🔴';

                return `
                    <div class="kar-eval-item">
                        <div class="kar-eval-header">
                            <div class="kar-eval-title">
                                ${statusIcon} ${escapeHtml(incident.judul || '-')}
                            </div>
                            <span class="kar-badge ${tingkatClass}">
                                ${escapeHtml(incident.tingkat_display || incident.tingkat || '-')}
                            </span>
                        </div>
                        <div class="kar-eval-meta">
                            ${escapeHtml(incident.tanggal_kejadian || '-')}
                            ${incident.kategori_display
                                ? ' · ' + escapeHtml(incident.kategori_display) : ''}
                            ${incident.pelapor_name
                                ? ' · ' + escapeHtml(incident.pelapor_name) : ''}
                        </div>
                        <div class="kar-eval-desc">
                            ${escapeHtml(incident.deskripsi || '')}
                        </div>
                        ${incident.keputusan_final ? `
                            <div style="margin-top:8px; padding:8px 12px;
                                background:#f0fdf4; border-radius:8px;
                                font-size:12px; color:#047857;">
                                ✅ Keputusan: ${escapeHtml(incident.keputusan_final)}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
            show('eval-list');
        }

    } catch (e) {
        hide('eval-loading');
        show('eval-empty');
        console.error('[karakter] incident error:', e);
    }
}

// ===== HELPERS =====

function getDomainLabel(domain) {
    const labels = {
        akhlak: 'Akhlak & Adab',
        kedisiplinan: 'Kedisiplinan',
        ibadah: 'Ibadah & Spiritual',
        akademik: 'Akademik Keagamaan',
        sosial: 'Interaksi Sosial',
        pengembangan_diri: 'Pengembangan Diri'
    };
    return labels[domain] || domain;
}

function formatPeriod(start, end) {
    if (!start) return '-';
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    const s = new Date(start).toLocaleDateString('id-ID', opts);
    const e = end ? new Date(end).toLocaleDateString('id-ID', opts) : '';
    return e ? `${s} – ${e}` : s;
}

function capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '-';
}

function getInitials(nama) {
    return (nama || '-').split(' ').filter(Boolean).slice(0,2)
        .map(w => w[0]).join('').toUpperCase() || '-';
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '-';
}

function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function hide(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
