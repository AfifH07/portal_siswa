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
                    <div class="kar-eval-item" data-incident-id="${incident.id}" style="cursor:pointer;">
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
            listEl.querySelectorAll('.kar-eval-item[data-incident-id]').forEach(card => {
                card.onclick = () => openIncidentModal(card.dataset.incidentId);
            });
            show('eval-list');
        }

    } catch (e) {
        hide('eval-loading');
        show('eval-empty');
        console.error('[karakter] incident error:', e);
    }
}

async function openIncidentModal(incidentId) {
    ensureIncidentModal();
    renderIncidentModalLoading();
    showIncidentModal();

    try {
        const res = await window.apiFetch(`kesantrian/incidents/${incidentId}/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const incident = d.data || d;
        renderIncidentModal(incident);
    } catch (e) {
        const body = document.getElementById('kar-incident-modal-body');
        if (body) {
            body.innerHTML = `
                <div style="padding:24px;text-align:center;color:#dc2626;">
                    Gagal memuat detail catatan.
                </div>
            `;
        }
        console.error('[karakter] incident detail error:', e);
    }
}

function ensureIncidentModal() {
    if (document.getElementById('kar-incident-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'kar-incident-modal';
    modal.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'display:none',
        'align-items:center',
        'justify-content:center',
        'background:rgba(15,23,42,0.48)',
        'padding:18px'
    ].join(';');

    modal.innerHTML = `
        <div style="width:min(760px,100%);max-height:88vh;overflow:hidden;
            background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,0.28);">
            <div style="display:flex;align-items:center;justify-content:space-between;
                gap:12px;padding:18px 22px;border-bottom:1px solid #e5e7eb;">
                <div>
                    <div style="font-size:12px;color:#6b7280;font-weight:600;">Detail Catatan & Bimbingan</div>
                    <div id="kar-incident-modal-title" style="font-size:18px;color:#064e3b;font-weight:800;margin-top:3px;">
                        Memuat...
                    </div>
                </div>
                <button type="button" id="kar-incident-modal-close"
                    style="border:0;background:#f3f4f6;color:#374151;border-radius:10px;
                    width:36px;height:36px;cursor:pointer;font-size:18px;">&times;</button>
            </div>
            <div id="kar-incident-modal-body" style="padding:20px 22px;overflow:auto;max-height:calc(88vh - 82px);"></div>
        </div>
    `;

    modal.onclick = event => {
        if (event.target === modal) closeIncidentModal();
    };
    document.body.appendChild(modal);

    const closeBtn = document.getElementById('kar-incident-modal-close');
    if (closeBtn) closeBtn.onclick = closeIncidentModal;
}

function renderIncidentModalLoading() {
    setText('kar-incident-modal-title', 'Memuat...');
    const body = document.getElementById('kar-incident-modal-body');
    if (body) {
        body.innerHTML = `
            <div style="padding:24px;text-align:center;color:#6b7280;">
                Memuat detail catatan...
            </div>
        `;
    }
}

function renderIncidentModal(incident) {
    setText('kar-incident-modal-title', incident.judul || '-');

    const body = document.getElementById('kar-incident-modal-body');
    if (!body) return;

    const comments = Array.isArray(incident.comments) ? incident.comments : [];
    const tingkatClass = {
        ringan: 'badge-ringan',
        sedang: 'badge-sedang',
        berat: 'badge-berat',
        kritis: 'badge-kritis'
    }[incident.tingkat] || 'badge-ringan';

    const fotoHtml = incident.foto_url ? `
        <div style="margin-top:14px;">
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px;">Foto bukti</div>
            <a href="${escapeHtml(incident.foto_url)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(incident.foto_url)}" alt="Foto bukti"
                    style="max-width:100%;max-height:280px;border-radius:12px;border:1px solid #e5e7eb;">
            </a>
        </div>
    ` : '';

    const keputusanHtml = incident.keputusan_final ? `
        <div style="margin-top:14px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;
            border-radius:12px;color:#047857;font-size:13px;">
            <strong>Keputusan:</strong> ${escapeHtml(incident.keputusan_final)}
        </div>
    ` : '';

    const commentsHtml = comments.length > 0 ? comments.map(comment => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin-top:10px;">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;">
                <strong style="font-size:13px;color:#111827;">${escapeHtml(comment.author_name || '-')}</strong>
                <span style="font-size:11px;color:#9ca3af;">${formatDateOnly(comment.created_at)}</span>
            </div>
            <div style="font-size:12px;color:#047857;font-weight:600;margin-bottom:6px;">
                ${escapeHtml(comment.comment_type_display || 'Komentar')}
            </div>
            <div style="font-size:13px;color:#374151;line-height:1.6;">
                ${escapeHtml(comment.content || '')}
            </div>
        </div>
    `).join('') : `
        <div style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">
            Belum ada komentar publik.
        </div>
    `;

    body.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
            <span class="kar-badge ${tingkatClass}">
                ${escapeHtml(incident.tingkat_display || incident.tingkat || '-')}
            </span>
            <span class="kar-badge" style="background:#f3f4f6;color:#374151;">
                ${escapeHtml(incident.status_display || incident.status || '-')}
            </span>
            ${incident.kategori_display ? `
                <span class="kar-badge" style="background:#ecfdf5;color:#047857;">
                    ${escapeHtml(incident.kategori_display)}
                </span>
            ` : ''}
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:12px;">
            ${escapeHtml(incident.tanggal_kejadian || '-')}
            ${incident.pelapor_name ? ' &middot; ' + escapeHtml(incident.pelapor_name) : ''}
        </div>
        <div style="font-size:14px;color:#374151;line-height:1.7;">
            ${escapeHtml(incident.deskripsi || '')}
        </div>
        ${fotoHtml}
        ${keputusanHtml}
        <div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:16px;">
            <div style="font-size:15px;font-weight:800;color:#064e3b;margin-bottom:10px;">
                Komentar & Pembinaan
            </div>
            ${commentsHtml}
        </div>
    `;
}

function showIncidentModal() {
    const modal = document.getElementById('kar-incident-modal');
    if (modal) modal.style.display = 'flex';
}

function closeIncidentModal() {
    const modal = document.getElementById('kar-incident-modal');
    if (modal) modal.style.display = 'none';
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

function formatDateOnly(value) {
    if (!value) return '-';
    return String(value).slice(0, 10);
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
