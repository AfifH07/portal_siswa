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

let studentList = [];
let kelasList = [];

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
        appendKelasOptions(document.getElementById('hapus-kelas-select'));
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

function initHapusTab() {
    const kelasSelect = document.getElementById('hapus-kelas-select');
    const santriSelect = document.getElementById('hapus-santri-select');
    const tanggalInput = document.getElementById('hapus-tanggal-input');
    const cariBtn = document.getElementById('hapus-cari-btn');

    if (!kelasSelect || !santriSelect || !tanggalInput || !cariBtn) return;

    tanggalInput.value = new Date().toISOString().split('T')[0];

    kelasSelect.onchange = async function() {
        resetSelectOptions(santriSelect, '-- Pilih Santri --');
        santriSelect.disabled = true;
        if (!this.value) return;

        try {
            const res = await window.apiFetch(
                `students/?kelas=${encodeURIComponent(this.value)}&page_size=200`
            );
            const data = await parseApiResponse(res, 'loadSantri hapus');
            const students = data.results || data.data || data || [];

            students.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.nisn;
                opt.textContent = `${s.nama} (${s.nisn})`;
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
        await fetchIbadahRecord(nisn, tanggal);
    };
}

async function fetchIbadahRecord(nisn, tanggal) {
    const area = document.getElementById('hapus-result-area');
    area.innerHTML = '<p>Memuat data...</p>';

    try {
        const res = await window.apiFetch(
            `kesantrian/ibadah/${nisn}/?start_date=${tanggal}&end_date=${tanggal}&jenis=sholat_wajib`
        );
        const data = await parseApiResponse(res, 'fetchIbadahRecord');
        if (!data?.success || !data.data?.length) {
            area.innerHTML = '<p style="color:#888;">Tidak ada record absensi sholat untuk santri dan tanggal ini.</p>';
            return;
        }
        renderHapusResult(data.data, data.nama, tanggal, area);
    } catch (e) {
        area.innerHTML = '<p style="color:#b91c1c;">Gagal memuat record absensi.</p>';
    }
}

function renderHapusResult(records, nama, tanggal, area) {
    const WAKTU_LABEL = {
        subuh: 'Subuh', dzuhur: 'Dzuhur', ashar: 'Ashar',
        maghrib: 'Maghrib', isya: 'Isya'
    };
    const STATUS_LABEL = {
        hadir: 'Hadir', tidak_hadir: 'Tidak Hadir',
        terlambat: 'Terlambat', izin: 'Izin', sakit: 'Sakit'
    };

    let html = `<div class="hapus-result-card">
        <h4>${nama} - ${tanggal}</h4>
        <table class="hapus-table">
            <thead>
                <tr>
                    <th>Waktu</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>`;

    records.forEach(r => {
        html += `<tr id="hapus-row-${r.id}">
            <td>${WAKTU_LABEL[r.waktu] || r.waktu}</td>
            <td>${STATUS_LABEL[r.status] || r.status}</td>
            <td>${r.catatan || '-'}</td>
            <td>
                <button class="hapus-btn-delete"
                    data-id="${r.id}"
                    data-waktu="${r.waktu}">
                    Hapus
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    area.innerHTML = html;

    area.querySelectorAll('.hapus-btn-delete').forEach(btn => {
        btn.onclick = function() {
            const id = this.dataset.id;
            const waktu = this.dataset.waktu;
            hapusRecord(id, waktu);
        };
    });
}

async function hapusRecord(id, waktu) {
    if (!confirm(`Hapus record absensi waktu ${waktu}?`)) return;

    try {
        const res = await window.apiFetch(
            `kesantrian/ibadah/delete/${id}/`,
            { method: 'DELETE' }
        );
        const data = await parseApiResponse(res, 'hapusRecord');
        if (data?.success) {
            const row = document.getElementById(`hapus-row-${id}`);
            if (row) row.remove();
            showAlert('Record berhasil dihapus.', 'success');
        } else {
            showAlert('Gagal menghapus record. Coba lagi.', 'error');
        }
    } catch (e) {
        showAlert('Gagal menghapus record: ' + e.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('as-tanggal').value = today;

    initTabs();
    initHapusTab();
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
