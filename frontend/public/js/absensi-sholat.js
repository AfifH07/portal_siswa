// absensi-sholat.js
'use strict';

const WAKTU_LIST = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const STATUS_OPTIONS = [
    { value: 'hadir',       label: 'Hadir' },
    { value: 'terlambat',   label: 'Terlambat' },
    { value: 'izin',        label: 'Izin' },
    { value: 'sakit',       label: 'Sakit' },
    { value: 'tidak_hadir', label: 'Tidak Hadir' },
];
const WAKTU_LABEL = {
    subuh: 'Subuh',
    dzuhur: 'Dzuhur',
    ashar: 'Ashar',
    maghrib: 'Maghrib',
    isya: 'Isya'
};
const REKAP_ROLES = ['superadmin', 'admin', 'guru', 'admin_santri'];
const EDIT_STATUS_OPTIONS = [
    { value: '',            label: '-- Pilih --' },
    { value: 'hadir',       label: 'Hadir' },
    { value: 'terlambat',   label: 'Terlambat' },
    { value: 'tidak_hadir', label: 'Tidak Hadir' },
    { value: 'izin',        label: 'Izin' },
    { value: 'sakit',       label: 'Sakit' },
];

let studentList = [];
let kelasList = [];

function escapeText(value) {
    const text = value == null ? '' : String(value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showAlert(msg, type = 'success') {
    const el = document.getElementById('as-alert');
    el.textContent = msg;
    el.className = `as-alert ${type} show`;
    setTimeout(() => { el.className = 'as-alert'; }, 4000);
}

async function parseApiResponse(res, context) {
    if (!res || !res.ok) {
        const errText = await res?.text();
        console.error(`[absensi-sholat] ${context} HTTP error:`, res?.status, errText);
        throw new Error(`HTTP ${res?.status || 'unknown'}`);
    }
    return res.json();
}

function resetSelectOptions(select, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
}

function appendKelasOptions(select) {
    if (!select) return;
    resetSelectOptions(select, '-- Pilih Kelas --');
    kelasList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        select.appendChild(opt);
    });
}

function getCurrentRole() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || window.getUserRole?.() || document.body.dataset.role || '';
}

function isRekapRole() {
    return REKAP_ROLES.includes(getCurrentRole());
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildSelectHTML(nisn, waktu, defaultVal = 'hadir') {
    const opts = STATUS_OPTIONS.map(o =>
        `<option value="${o.value}"${o.value === defaultVal ? ' selected' : ''}>${o.label}</option>`
    ).join('');
    return `<select class="as-status-select s-${defaultVal}"
                    data-nisn="${nisn}"
                    data-waktu="${waktu}"
                    id="sel-${nisn}-${waktu}">
                ${opts}
            </select>`;
}

function applySelectColor(sel) {
    const val = sel.value;
    sel.className = `as-status-select s-${val}`;
}

async function loadKelas() {
    try {
        const res = await window.apiFetch('students/classes/');
        const d = await parseApiResponse(res, 'loadKelas');
        kelasList = d.classes || d || [];
        appendKelasOptions(document.getElementById('as-kelas'));
        appendKelasOptions(document.getElementById('edit-kelas-select'));
        appendKelasOptions(document.getElementById('rekap-kelas-select'));
    } catch (e) {
        console.error('[absensi-sholat] gagal load kelas:', e);
        showAlert('Gagal memuat daftar kelas: ' + e.message, 'error');
    }
}

async function loadSantri() {
    const kelas = document.getElementById('as-kelas').value;
    const tanggal = document.getElementById('as-tanggal').value;

    if (!kelas) { showAlert('Pilih kelas terlebih dahulu.', 'error'); return; }
    if (!tanggal) { showAlert('Pilih tanggal terlebih dahulu.', 'error'); return; }

    const btn = document.getElementById('as-btn-load');
    btn.disabled = true;
    btn.textContent = 'Memuat...';

    try {
        const res = await window.apiFetch(
            `students/?kelas=${encodeURIComponent(kelas)}&page_size=200`
        );
        const d = await parseApiResponse(res, 'loadSantri');
        studentList = d.results || d.data || d || [];

        if (studentList.length === 0) {
            document.getElementById('as-card').style.display = 'none';
            document.getElementById('as-empty').style.display = 'block';
            document.getElementById('as-empty').textContent =
                'Tidak ada santri di kelas ini.';
            return;
        }

        renderTable();
        document.getElementById('as-card').style.display = 'block';
        document.getElementById('as-empty').style.display = 'none';
        document.getElementById('as-card-title').textContent =
            `Kelas ${kelas} - ${tanggal}`;
        document.getElementById('as-student-count').textContent =
            `${studentList.length} santri`;
    } catch (e) {
        showAlert('Gagal memuat data santri: ' + e.message, 'error');
        console.error('[absensi-sholat] loadSantri error:', e);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Muat Santri';
    }
}

function renderTable() {
    const tbody = document.getElementById('as-tbody');
    tbody.innerHTML = studentList.map(s => {
        const waktuCols = WAKTU_LIST.map(w =>
            `<td>${buildSelectHTML(s.nisn, w)}</td>`
        ).join('');
        return `<tr>
            <td>
                <div>${s.nama}</div>
                <div class="as-student-meta">${s.nisn}</div>
            </td>
            ${waktuCols}
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.as-status-select').forEach(sel => {
        sel.onchange = function() { applySelectColor(this); };
    });
}

function setAllHadir() {
    document.querySelectorAll('.as-status-select').forEach(sel => {
        sel.value = 'hadir';
        applySelectColor(sel);
    });
}

async function submitAbsensi() {
    const tanggal = document.getElementById('as-tanggal').value;
    if (!tanggal || studentList.length === 0) return;

    const btn = document.getElementById('as-btn-submit');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    let totalSuccess = 0;
    let totalError = 0;

    for (const waktu of WAKTU_LIST) {
        const records = studentList.map(s => {
            const sel = document.getElementById(`sel-${s.nisn}-${waktu}`);
            return { nisn: s.nisn, status: sel ? sel.value : 'hadir' };
        });

        try {
            const res = await window.apiFetch(
                'kesantrian/ibadah/record-bulk/',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        tanggal,
                        jenis: 'sholat_wajib',
                        waktu,
                        records
                    })
                }
            );
            const d = await parseApiResponse(res, `submitAbsensi ${waktu}`);
            totalSuccess += d.success_count || 0;
            totalError += d.error_count || 0;
        } catch (e) {
            console.error(`[absensi-sholat] error submit ${waktu}:`, e);
            totalError += records.length;
        }
    }

    btn.disabled = false;
    btn.textContent = 'Simpan Absensi';

    if (totalError === 0) {
        showAlert(`Absensi berhasil disimpan: ${totalSuccess} record.`, 'success');
    } else {
        showAlert(`Tersimpan ${totalSuccess}, gagal ${totalError}.`, 'error');
    }
}

function initTabs() {
    const buttons = document.querySelectorAll('.abs-tab-btn');
    const panels = document.querySelectorAll('.abs-tab-panel');

    buttons.forEach(btn => {
        btn.onclick = function() {
            const target = this.dataset.tab;
            buttons.forEach(b => b.classList.remove('active'));
            panels.forEach(panel => {
                panel.style.display = panel.id === `tab-${target}` ? 'block' : 'none';
            });
            this.classList.add('active');
        };
    });
}

function initEditTab() {
    const kelasSelect = document.getElementById('edit-kelas-select');
    const santriSelect = document.getElementById('edit-santri-select');
    const tanggalInput = document.getElementById('edit-tanggal-input');
    const cariBtn = document.getElementById('edit-cari-btn');

    if (!kelasSelect || !santriSelect || !tanggalInput || !cariBtn) return;

    tanggalInput.value = new Date().toISOString().split('T')[0];

    kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    kelasList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        kelasSelect.appendChild(opt);
    });

    kelasSelect.onchange = async function() {
        resetSelectOptions(santriSelect, '-- Pilih Santri --');
        santriSelect.disabled = true;
        if (!this.value) return;

        try {
            const res = await window.apiFetch(
                `students/?kelas=${encodeURIComponent(this.value)}&page_size=200`
            );
            const data = await parseApiResponse(res, 'loadSantri edit');
            const students = data.results || data.data || data || [];

            students.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.nisn;
                opt.textContent = s.nama;
                santriSelect.appendChild(opt);
            });
            santriSelect.disabled = false;
        } catch (e) {
            showAlert('Gagal memuat santri: ' + e.message, 'error');
        }
    };

    cariBtn.onclick = async function() {
        const nisn = santriSelect.value;
        const tanggal = tanggalInput.value;
        if (!nisn || !tanggal) {
            showAlert('Pilih santri dan tanggal terlebih dahulu.', 'error');
            return;
        }
        await fetchEditRecord(nisn, tanggal);
    };
}

async function fetchEditRecord(nisn, tanggal) {
    const area = document.getElementById('edit-result-area');
    area.innerHTML = '<p>Memuat data...</p>';

    try {
        const res = await window.apiFetch(
            `kesantrian/ibadah/${nisn}/?start_date=${tanggal}&end_date=${tanggal}&jenis=sholat_wajib`
        );
        const data = await parseApiResponse(res, 'fetchEditRecord');

        const recordMap = {};
        if (data?.success && data.data?.length) {
            data.data.forEach(r => { recordMap[r.waktu] = r; });
        }

        const nama = data?.nama || nisn;
        renderEditResult(nisn, tanggal, nama, recordMap, area);
    } catch (e) {
        area.innerHTML = '<p style="color:#b91c1c;">Gagal memuat record absensi.</p>';
    }
}

function renderEditResult(nisn, tanggal, nama, recordMap, area) {
    let html = `<div class="edit-result-card">
        <h4>${escapeText(nama)} - ${escapeText(tanggal)}</h4>
        <table class="edit-table">
            <thead>
                <tr>
                    <th>Waktu</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>`;

    WAKTU_LIST.forEach(waktu => {
        const r = recordMap[waktu] || null;
        const recordId = r ? r.id : '';
        const currentStatus = r ? r.status : '';
        const currentCatatan = r ? (r.catatan || '') : '';
        const optionsHtml = EDIT_STATUS_OPTIONS.map(o =>
            `<option value="${o.value}"${currentStatus === o.value ? ' selected' : ''}>${o.label}</option>`
        ).join('');
        const hapusBtnHtml = r
            ? `<button class="edit-btn-delete" data-id="${r.id}" data-waktu="${waktu}">Hapus</button>`
            : '';

        html += `<tr id="edit-row-${waktu}" data-waktu="${waktu}" data-record-id="${recordId}">
            <td><strong>${WAKTU_LABEL[waktu]}</strong></td>
            <td>
                <select class="edit-status-select" id="edit-status-${waktu}">
                    ${optionsHtml}
                </select>
            </td>
            <td>
                <input type="text" class="edit-catatan-input"
                    id="edit-catatan-${waktu}"
                    value="${escapeText(currentCatatan)}"
                    placeholder="opsional"
                    style="width:100%;padding:4px 6px;border:1px solid #d1e7d8;border-radius:5px;">
            </td>
            <td style="display:flex;gap:6px;align-items:center;">
                <button class="edit-btn-save"
                    data-waktu="${waktu}"
                    data-nisn="${nisn}"
                    data-tanggal="${tanggal}"
                    data-record-id="${recordId}">
                    Simpan
                </button>
                ${hapusBtnHtml}
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    area.innerHTML = html;

    area.querySelectorAll('.edit-btn-save').forEach(btn => {
        btn.onclick = async function () {
            const waktu = this.dataset.waktu;
            const nisnVal = this.dataset.nisn;
            const tanggalVal = this.dataset.tanggal;
            const recordId = this.dataset.recordId;
            const statusVal = document.getElementById(`edit-status-${waktu}`).value;
            const catatanVal = document.getElementById(`edit-catatan-${waktu}`).value;

            if (!statusVal) {
                showAlert(`Pilih status untuk waktu ${WAKTU_LABEL[waktu]}.`, 'error');
                return;
            }

            try {
                if (recordId) {
                    const res = await window.apiFetch(
                        `kesantrian/ibadah/update/${recordId}/`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({ status: statusVal, catatan: catatanVal })
                        }
                    );
                    const data = await parseApiResponse(res, 'updateEditRecord');
                    if (data?.success) {
                        showEditFeedback(waktu, 'Tersimpan!', 'success');
                    } else {
                        showEditFeedback(waktu, 'Gagal menyimpan.', 'error');
                    }
                } else {
                    const res = await window.apiFetch(
                        'kesantrian/ibadah/create-single/',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                nisn: nisnVal,
                                tanggal: tanggalVal,
                                jenis: 'sholat_wajib',
                                waktu: waktu,
                                status: statusVal,
                                catatan: catatanVal
                            })
                        }
                    );
                    const data = await parseApiResponse(res, 'createEditRecord');
                    if (data?.success) {
                        const row = document.getElementById(`edit-row-${waktu}`);
                        if (row && data.id) {
                            row.dataset.recordId = data.id;
                            this.dataset.recordId = data.id;
                            const td = this.parentElement;
                            if (td && !td.querySelector('.edit-btn-delete')) {
                                const hapusBtn = document.createElement('button');
                                hapusBtn.className = 'edit-btn-delete';
                                hapusBtn.dataset.id = data.id;
                                hapusBtn.dataset.waktu = waktu;
                                hapusBtn.textContent = 'Hapus';
                                hapusBtn.onclick = function () {
                                    hapusEditRecord(this.dataset.id, this.dataset.waktu);
                                };
                                td.appendChild(hapusBtn);
                            }
                        }
                        showEditFeedback(waktu, 'Ditambahkan!', 'success');
                    } else {
                        showEditFeedback(waktu, 'Gagal menambahkan.', 'error');
                    }
                }
            } catch (e) {
                showEditFeedback(waktu, 'Gagal menyimpan.', 'error');
            }
        };
    });

    area.querySelectorAll('.edit-btn-delete').forEach(btn => {
        btn.onclick = function () {
            hapusEditRecord(this.dataset.id, this.dataset.waktu);
        };
    });
}

function showEditFeedback(waktu, pesan, type) {
    const row = document.getElementById(`edit-row-${waktu}`);
    if (!row) return;
    const existing = row.querySelector('.edit-feedback');
    if (existing) existing.remove();
    const span = document.createElement('span');
    span.className = 'edit-feedback';
    span.textContent = pesan;
    span.style.cssText = `font-size:0.8rem;margin-left:6px;color:${type === 'success' ? '#2d6a4f' : '#b91c1c'};`;
    row.querySelector('td:last-child').appendChild(span);
    setTimeout(() => span.remove(), 2500);
}

async function hapusEditRecord(id, waktu) {
    if (!confirm(`Hapus record absensi waktu ${WAKTU_LABEL[waktu]}?`)) return;
    try {
        const res = await window.apiFetch(
            `kesantrian/ibadah/delete/${id}/`,
            { method: 'DELETE' }
        );
        const data = await parseApiResponse(res, 'hapusEditRecord');
        if (data?.success) {
            const row = document.getElementById(`edit-row-${waktu}`);
            if (row) {
                row.dataset.recordId = '';
                document.getElementById(`edit-status-${waktu}`).value = '';
                document.getElementById(`edit-catatan-${waktu}`).value = '';
                const hapusBtn = row.querySelector('.edit-btn-delete');
                if (hapusBtn) hapusBtn.remove();
                const simpanBtn = row.querySelector('.edit-btn-save');
                if (simpanBtn) simpanBtn.dataset.recordId = '';
            }
            showAlert('Record berhasil dihapus.', 'success');
        } else {
            showAlert('Gagal menghapus record. Coba lagi.', 'error');
        }
    } catch (e) {
        showAlert('Gagal menghapus record: ' + e.message, 'error');
    }
}

function initRekapTab() {
    const tabBtn = document.getElementById('tab-btn-rekap-kelas');
    if (tabBtn) tabBtn.style.display = isRekapRole() ? '' : 'none';

    const rangeSelect = document.getElementById('rekap-range-select');
    const loadBtn = document.getElementById('btn-rekap-kelas');

    setDefaultRekapRange();
    toggleRekapCustomDates();

    if (rangeSelect) {
        rangeSelect.onchange = function() {
            toggleRekapCustomDates();
            if (this.value !== 'custom') setDefaultRekapRange();
        };
    }

    if (loadBtn) {
        loadBtn.onclick = loadRekapKelas;
    }
}

function setDefaultRekapRange() {
    const rangeSelect = document.getElementById('rekap-range-select');
    const startInput = document.getElementById('rekap-start-date');
    const endInput = document.getElementById('rekap-end-date');
    if (!rangeSelect || !startInput || !endInput) return;

    const days = rangeSelect.value === 'custom' ? 30 : parseInt(rangeSelect.value || '30', 10);
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(days - 1, 0));

    startInput.value = formatDateInput(start);
    endInput.value = formatDateInput(end);
}

function toggleRekapCustomDates() {
    const isCustom = document.getElementById('rekap-range-select')?.value === 'custom';
    document.querySelectorAll('.rekap-custom-date').forEach(el => {
        el.style.display = isCustom ? '' : 'none';
    });
}

function getRekapDateRange() {
    const range = document.getElementById('rekap-range-select')?.value || '30';
    const startInput = document.getElementById('rekap-start-date');
    const endInput = document.getElementById('rekap-end-date');

    if (range !== 'custom') {
        const days = parseInt(range, 10) || 30;
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - Math.max(days - 1, 0));
        return {
            startDate: formatDateInput(start),
            endDate: formatDateInput(end)
        };
    }

    return {
        startDate: startInput?.value || '',
        endDate: endInput?.value || ''
    };
}

async function loadRekapKelas() {
    const kelas = document.getElementById('rekap-kelas-select')?.value || '';
    const tbody = document.getElementById('rekap-kelas-body');
    const summary = document.getElementById('rekap-kelas-summary');
    const btn = document.getElementById('btn-rekap-kelas');
    if (!tbody) return;

    if (!kelas) {
        if (summary) summary.style.display = 'none';
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="rekap-empty">
                    Pilih kelas untuk melihat rekap absensi sholat.
                </td>
            </tr>
        `;
        showAlert('Pilih kelas terlebih dahulu.', 'error');
        return;
    }

    const { startDate, endDate } = getRekapDateRange();
    if (!startDate || !endDate) {
        showAlert('Pilih rentang tanggal terlebih dahulu.', 'error');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memuat...';
    }
    if (summary) summary.style.display = 'none';
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="rekap-empty">
                Memuat data rekap...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams({
            kelas,
            start_date: startDate,
            end_date: endDate
        });
        const res = await window.apiFetch(`kesantrian/ibadah/rekap/?${params.toString()}`);
        const data = await parseApiResponse(res, 'loadRekapKelas');
        renderRekapKelas(data);
    } catch (e) {
        console.error('[absensi-sholat] loadRekapKelas error:', e);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="rekap-empty" style="color:#b91c1c;">
                    Gagal memuat rekap absensi sholat.
                </td>
            </tr>
        `;
        showAlert('Gagal memuat rekap: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Tampilkan';
        }
    }
}

function renderRekapKelas(data) {
    const tbody = document.getElementById('rekap-kelas-body');
    const summary = document.getElementById('rekap-kelas-summary');
    if (!tbody) return;

    const columns = data.columns || WAKTU_LIST;
    const rows = (data.data || []).map(row => {
        const totals = columns.reduce((acc, waktu) => {
            const metric = normalizeRekapMetric(row.ibadah && row.ibadah[waktu]);
            acc.hadir += metric.hadir;
            acc.total += metric.total;
            return acc;
        }, { hadir: 0, total: 0 });
        const scorePercent = totals.total > 0 ? Math.round((totals.hadir / totals.total) * 100) : 0;
        return { ...row, scorePercent, hadirTotal: totals.hadir, slotTotal: totals.total };
    }).sort((a, b) => b.scorePercent - a.scorePercent || String(a.nama || '').localeCompare(String(b.nama || '')));

    if (!rows.length) {
        if (summary) summary.style.display = 'none';
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="rekap-empty">
                    Belum ada data absensi untuk kelas dan periode ini.
                </td>
            </tr>
        `;
        return;
    }

    renderRekapSummary(rows, columns);

    tbody.innerHTML = rows.map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div>${escapeText(row.nama || '-')}</div>
                <div class="as-student-meta">${escapeText(row.nisn || '')}</div>
            </td>
            ${WAKTU_LIST.map(waktu => `
                <td>${renderRekapCell(row.ibadah && row.ibadah[waktu])}</td>
            `).join('')}
            <td><span class="rekap-score">${row.scorePercent}%</span></td>
        </tr>
    `).join('');
}

function renderRekapSummary(rows, columns) {
    const summary = document.getElementById('rekap-kelas-summary');
    if (!summary) return;

    const total = rows.length;
    const pctFor = (waktu) => {
        if (!total) return 0;
        const sum = rows.reduce((acc, row) => {
            const metric = normalizeRekapMetric(row.ibadah && row.ibadah[waktu]);
            acc.hadir += metric.hadir;
            acc.total += metric.total;
            return acc;
        }, { hadir: 0, total: 0 });
        return sum.total > 0 ? Math.round((sum.hadir / sum.total) * 100) : 0;
    };

    const topScore = Math.max(...rows.map(row => row.scorePercent));
    const topSantri = rows.find(row => row.scorePercent === topScore);

    document.getElementById('rekap-total-santri').textContent = total;
    document.getElementById('rekap-subuh-pct').textContent = `${pctFor('subuh')}%`;
    document.getElementById('rekap-isya-pct').textContent = `${pctFor('isya')}%`;
    document.getElementById('rekap-top-santri').textContent =
        topSantri ? `${topSantri.nama || '-'} (${topScore}%)` : '-';
    summary.style.display = 'grid';
}

function normalizeRekapMetric(value) {
    if (value && typeof value === 'object') {
        return {
            hadir: Number(value.hadir || 0),
            total: Number(value.total || 0)
        };
    }

    // Backward compatibility for cached/old API response.
    return {
        hadir: value ? 1 : 0,
        total: 1
    };
}

function renderRekapCell(value) {
    const metric = normalizeRekapMetric(value);
    const hadir = metric.hadir;
    const total = metric.total || 0;
    const ratio = total > 0 ? hadir / total : 0;
    let cls = 'rekap-status-bad';
    if (ratio >= 0.8) {
        cls = 'rekap-status-good';
    } else if (ratio >= 0.5) {
        cls = 'rekap-status-watch';
    }

    return `<span class="rekap-status-count ${cls}">${hadir}/${total}</span>`;
}

document.addEventListener('DOMContentLoaded', function () {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('as-tanggal').value = today;

    initTabs();
    initEditTab();
    initRekapTab();
    loadKelas();

    document.getElementById('as-btn-load').onclick = loadSantri;
    document.getElementById('as-btn-hadir-semua').onclick = setAllHadir;
    document.getElementById('as-btn-submit').onclick = submitAbsensi;

    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.onclick = function() {
            if (typeof window.logout === 'function') window.logout();
        };
    });
});

window.addEventListener('load', function() {
    initRekapTab();
});
