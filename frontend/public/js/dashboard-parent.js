'use strict';

let wdChildren = [];
let wdCurrentNisn = null;
let wdTagihan = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initWaliDashboard();
});

async function initWaliDashboard() {
    try {
        const res = await window.apiFetch('users/me/');
        const me = typeof res?.json === 'function' ? await res.json() : res;
        const user = me.user || me;
        if (!user || user.role !== 'walisantri') {
            window.location.href = '/dashboard';
            return;
        }

        const name = user.name || user.username || 'Bapak/Ibu';
        setText('wd-wali-name', name);
        setText('user-name-display', name);
        setText('user-role-display', 'Wali Santri');
        setText('user-avatar-initials', getInitials(name));
    } catch (e) {
        window.location.href = '/login';
        return;
    }

    wireMenuLinks();

    await Promise.all([loadChildrenData(), loadTagihanData()]);

    const sel = document.getElementById('wd-child-select');
    if (sel) {
        sel.onchange = () => {
            wdCurrentNisn = sel.value;
            renderChildDashboard(wdCurrentNisn);
        };
    }

    if (wdCurrentNisn) {
        await renderChildDashboard(wdCurrentNisn);
    } else {
        renderEmptyDashboard();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function loadChildrenData() {
    try {
        const res = await window.apiFetch('kesantrian/my-children-summary/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        wdChildren = Array.isArray(d.children) ? d.children : (d.data || []);
        populateChildSelector();
        if (wdChildren.length > 0) {
            wdCurrentNisn = wdChildren[0].nisn;
        }
        updateChildrenCount();
    } catch (e) {
        console.warn('[wali] gagal load children:', e);
        wdChildren = [];
        populateChildSelector();
        updateChildrenCount();
    }
}

async function loadTagihanData() {
    try {
        const res = await window.apiFetch('finance/tagihan/?status=belum_lunas');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        wdTagihan = Array.isArray(d.results) ? d.results : (d.data || []);
        updateTagihanBadge();
    } catch (e) {
        wdTagihan = [];
        updateTagihanBadge();
    }
}

function populateChildSelector() {
    const sel = document.getElementById('wd-child-select');
    if (!sel) return;

    if (wdChildren.length === 0) {
        sel.innerHTML = '<option value="">Belum ada data anak</option>';
        return;
    }

    sel.innerHTML = wdChildren.map(c =>
        `<option value="${escapeHtml(c.nisn || '')}">${escapeHtml(c.nama || 'Tanpa Nama')} (${escapeHtml(c.kelas || '-')})</option>`
    ).join('');

    if (wdCurrentNisn) {
        sel.value = wdCurrentNisn;
    }
}

function updateChildrenCount() {
    const el = document.getElementById('user-children');
    if (!el) return;
    if (wdChildren.length > 0) {
        el.textContent = `${wdChildren.length} Anak Terdaftar`;
        el.style.display = 'block';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

function updateTagihanBadge() {
    const badge = document.getElementById('menu-tagihan-badge');
    if (!badge) return;

    const belum = wdTagihan.filter(t => t.status !== 'lunas' && Number(t.sisa || 0) > 0);
    if (belum.length > 0) {
        badge.textContent = String(belum.length);
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

async function renderChildDashboard(nisn) {
    const child = wdChildren.find(c => c.nisn === nisn);
    if (!child) {
        renderEmptyDashboard();
        return;
    }

    const sel = document.getElementById('wd-child-select');
    if (sel && sel.value !== nisn) {
        sel.value = nisn;
    }

    renderHero(child);
    renderStatCards(child);
    renderAktivitas(child);
    renderNotices(child);
    await renderIbadahTable(nisn);
    await renderKajianStat(nisn);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderEmptyDashboard() {
    setText('wd-avatar', '-');
    setText('wd-nama', 'Belum ada data anak');
    setText('wd-nisn', 'NISN: -');
    setText('wd-badge-aktif', 'Belum terhubung');
    setText('wd-badge-kelas', '-');
    setText('wd-badge-program', '-');
    setText('wd-stat-juz', '-');
    setText('wd-stat-ibadah', '-');
    setText('wd-stat-kajian', '-');
    setText('sc-hafalan', '-');
    setText('sc-hafalan-sub', 'Belum ada data');
    setText('sc-ibadah', '-');
    setText('sc-ibadah-sub', 'Belum ada data');
    setText('sc-kajian', '-');
    setText('sc-kajian-sub', 'Belum ada data');
    setText('sc-tagihan', '-');
    setText('sc-tagihan-sub', 'Belum ada data');
    setBar('sc-hafalan-bar', 0);
    setBar('sc-ibadah-bar', 0);
    setBar('sc-kajian-bar', 0);
    setBar('sc-tagihan-bar', 0);

    setHtml('wd-aktivitas', emptyMessage('Belum ada aktivitas.'));
    setHtml('wd-ibadah-table', emptyMessage('Belum ada data ibadah.'));
    setHtml('wd-notices', emptyMessage('Belum ada informasi.'));
}

function getInitials(nama) {
    return (nama || '-')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0])
        .join('')
        .toUpperCase() || '-';
}

function renderHero(child) {
    const hafalan = child.hafalan_progress || {};
    const ibadah = child.ibadah_summary || {};

    setText('wd-avatar', getInitials(child.nama));
    setText('wd-nama', child.nama || '-');
    setText('wd-nisn', `NISN: ${child.nisn || '-'}`);
    setText('wd-badge-aktif', child.status || 'Aktif');
    setText('wd-badge-kelas', child.kelas || '-');
    setText('wd-badge-program', child.program || 'Reguler');
    setText('wd-stat-juz', `${toNumber(hafalan.tercapai_juz)} Juz`);
    setText('wd-stat-ibadah', `${Math.round(toNumber(ibadah.week_percentage))}%`);
    setText('wd-stat-kajian', '-');
}

function renderStatCards(child) {
    const hafalan = child.hafalan_progress || {};
    const ibadah = child.ibadah_summary || {};

    const juz = toNumber(hafalan.tercapai_juz);
    const tgt = toNumber(hafalan.target_juz) || 30;
    const pct = toNumber(hafalan.persentase);
    setText('sc-hafalan', `${juz} / ${tgt} Juz`);
    setText('sc-hafalan-sub', `Target ${tgt} juz · ${Math.round(pct)}%`);
    setBar('sc-hafalan-bar', pct);

    const ibPct = toNumber(ibadah.week_percentage);
    const ibHadir = toNumber(ibadah.total_hadir);
    const ibTotal = toNumber(ibadah.expected_week) || 35;
    setText('sc-ibadah', `${ibHadir} / ${ibTotal} sholat`);
    setText('sc-ibadah-sub', `Minggu ini · ${Math.round(ibPct)}%`);
    setBar('sc-ibadah-bar', ibPct);

    const tagihanEl = document.getElementById('sc-tagihan');
    const myTagihan = wdTagihan.filter(t => t.siswa_nisn === child.nisn && Number(t.sisa || 0) > 0);
    if (myTagihan.length > 0) {
        const total = myTagihan.reduce((sum, t) => sum + toNumber(t.sisa), 0);
        const jatuh = myTagihan[0].jatuh_tempo || '-';
        setText('sc-tagihan', `Rp ${total.toLocaleString('id-ID')}`);
        setText('sc-tagihan-sub', `Jatuh tempo ${jatuh}`);
        setBar('sc-tagihan-bar', 40);
        if (tagihanEl) tagihanEl.className = 'sv color-amber';
    } else {
        setText('sc-tagihan', 'Lunas');
        setText('sc-tagihan-sub', 'Tidak ada tagihan');
        setBar('sc-tagihan-bar', 100);
        if (tagihanEl) tagihanEl.className = 'sv color-green';
    }

    setText('sc-kajian', '-');
    setText('sc-kajian-sub', 'Memuat data...');
    setBar('sc-kajian-bar', 0);
}

async function renderKajianStat(nisn) {
    try {
        const res = await window.apiFetch(`kesantrian/hafalan/siswa/${nisn}/kehadiran-kajian/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        if (!d.success) return;

        const summary = d.summary || {};
        const hadir = toNumber(summary.hadir);
        const total = hadir + toNumber(summary.izin) + toNumber(summary.sakit) + toNumber(summary.alfa);
        const safeTotal = total || 1;
        const pct = Math.round((hadir / safeTotal) * 100);

        setText('wd-stat-kajian', `${hadir} hadir`);
        setText('sc-kajian', `${hadir} / ${total || 0}`);
        setText('sc-kajian-sub', `Total pertemuan · ${pct}%`);
        setBar('sc-kajian-bar', pct);
    } catch (e) {
        setText('wd-stat-kajian', '-');
        setText('sc-kajian', '-');
        setText('sc-kajian-sub', 'Gagal memuat data');
        setBar('sc-kajian-bar', 0);
    }
}

function renderAktivitas(child) {
    const pembinaan = Array.isArray(child.recent_pembinaan) ? child.recent_pembinaan : [];
    const hafalan = child.hafalan_progress || {};
    const ibadah = child.ibadah_summary || {};
    const items = [];

    if (toNumber(hafalan.tercapai_juz) > 0) {
        items.push({
            dot: 'green',
            text: `Progress hafalan: ${toNumber(hafalan.tercapai_juz)} juz (${Math.round(toNumber(hafalan.persentase))}%)`,
            time: 'Update terkini'
        });
    }

    if (toNumber(ibadah.week_percentage) >= 80) {
        items.push({
            dot: 'green',
            text: `Ibadah minggu ini sangat baik - ${Math.round(toNumber(ibadah.week_percentage))}%`,
            time: 'Minggu ini'
        });
    } else if (toNumber(ibadah.week_percentage) > 0) {
        items.push({
            dot: 'amber',
            text: `Ibadah minggu ini perlu ditingkatkan - ${Math.round(toNumber(ibadah.week_percentage))}%`,
            time: 'Minggu ini'
        });
    }

    pembinaan.slice(0, 3).forEach(p => {
        const judul = p.judul || p.kategori_display || 'Catatan pembinaan';
        const sub = p.tingkat_display || p.kategori_display || '';
        items.push({
            dot: p.tingkat === 'berat' ? 'red' : 'blue',
            text: sub ? `${judul} - ${sub}` : judul,
            time: p.tanggal || ''
        });
    });

    if (items.length === 0) {
        setHtml('wd-aktivitas', emptyMessage('Belum ada aktivitas.'));
        return;
    }

    setHtml('wd-aktivitas', items.map(i => `
        <div class="wd-activity-item">
            <div class="wd-dot wd-dot-${i.dot}"></div>
            <div>
                <div class="wd-act-text">${escapeHtml(i.text)}</div>
                <div class="wd-act-time">${escapeHtml(i.time)}</div>
            </div>
        </div>
    `).join(''));
}

async function renderIbadahTable(nisn) {
    try {
        const res = await window.apiFetch(`kesantrian/ibadah/${nisn}/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const records = Array.isArray(d.data) ? d.data : [];
        const grouped = groupIbadahByDate(records);

        if (grouped.length === 0) {
            setHtml('wd-ibadah-table', emptyMessage('Belum ada data ibadah.'));
            return;
        }

        const sholatKeys = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
        const labels = ['Sub', 'Dzu', 'Asr', 'Mgr', 'Isy'];
        const rows = grouped.slice(0, 5).map(day => {
            const dots = sholatKeys.map(key => {
                const value = day.map[key];
                if (value === null || value === undefined) {
                    return '<div class="wd-sholat-dot sd-empty">-</div>';
                }
                return value === 'hadir'
                    ? '<div class="wd-sholat-dot sd-done">✓</div>'
                    : '<div class="wd-sholat-dot sd-miss">✗</div>';
            }).join('');

            return `
                <div class="wd-ibadah-row">
                    <div class="day">${escapeHtml(day.tanggal)}</div>
                    <div class="wd-sholat-dots">${dots}</div>
                </div>
            `;
        }).join('');

        setHtml('wd-ibadah-table', `
            <div class="wd-ibadah-header">
                <span style="font-size:10px;color:#9ca3af;min-width:72px;"></span>
                ${labels.map(label => `<span style="font-size:9px;width:24px;text-align:center;color:#9ca3af;">${label}</span>`).join('')}
            </div>
            ${rows}
        `);
    } catch (e) {
        setHtml('wd-ibadah-table', emptyMessage('Gagal memuat data ibadah.'));
    }
}

function renderNotices(child) {
    const notices = [];
    const myTagihan = wdTagihan.filter(t => t.siswa_nisn === child.nisn && Number(t.sisa || 0) > 0);

    myTagihan.slice(0, 2).forEach(t => {
        notices.push({
            icon: '🧾',
            title: `${t.tarif_nama || 'Tagihan'} ${t.bulan_display || ''}`.trim(),
            body: `Jatuh tempo ${t.jatuh_tempo || '-'} · Rp ${toNumber(t.sisa).toLocaleString('id-ID')}`,
            color: t.is_overdue ? '#a32d2d' : '#854f0b'
        });
    });

    const halaqoh = Array.isArray(child.halaqoh) ? child.halaqoh[0] : child.halaqoh;
    if (halaqoh) {
        notices.push({
            icon: '🕌',
            title: `Kelompok kajian: ${halaqoh.nama || '-'}`,
            body: `Musyrif: ${halaqoh.musyrif || '-'}${halaqoh.jadwal ? ` · ${halaqoh.jadwal}` : ''}`,
            color: '#0f6e56'
        });
    }

    const pembinaan = Array.isArray(child.recent_pembinaan) ? child.recent_pembinaan[0] : null;
    if (pembinaan) {
        notices.push({
            icon: '📝',
            title: pembinaan.judul || 'Pembinaan terbaru',
            body: `${pembinaan.kategori_display || 'Pembinaan'}${pembinaan.tanggal ? ` · ${pembinaan.tanggal}` : ''}`,
            color: '#185fa5'
        });
    }

    if (notices.length === 0) {
        notices.push({
            icon: '✅',
            title: 'Semua beres',
            body: 'Tidak ada tagihan atau informasi mendesak.',
            color: '#0f6e56'
        });
    }

    setHtml('wd-notices', notices.map(n => `
        <div class="wd-notice">
            <div class="wd-notice-icon">${n.icon}</div>
            <div class="wd-notice-text">
                <strong style="color:${n.color}">${escapeHtml(n.title)}</strong>
                ${escapeHtml(n.body)}
            </div>
        </div>
    `).join(''));
}

function wireMenuLinks() {
    document.querySelectorAll('[data-nav]').forEach(el => {
        el.onclick = (event) => {
            event.preventDefault();
            const target = el.getAttribute('data-nav');
            if (target) {
                window.location.href = target;
            }
        };
    });
}

function groupIbadahByDate(records) {
    const grouped = {};
    records.forEach(record => {
        const tanggal = record.tanggal || record.date;
        const waktu = record.waktu;
        if (!tanggal || !waktu) return;
        if (!grouped[tanggal]) {
            grouped[tanggal] = { tanggal, map: {} };
        }
        grouped[tanggal].map[waktu] = record.status;
    });

    return Object.values(grouped).sort((a, b) => {
        if (a.tanggal < b.tanggal) return 1;
        if (a.tanggal > b.tanggal) return -1;
        return 0;
    });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) {
        el.style.width = `${Math.min(100, Math.max(0, toNumber(pct)))}%`;
    }
}

function emptyMessage(text) {
    return `<div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px 0;">${escapeHtml(text)}</div>`;
}

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
