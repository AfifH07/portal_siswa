// absensi-sholat.js
'use strict';

const WAKTU_LIST = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const STATUS_OPTIONS = [
    { value: 'hadir',       label: '✓ Hadir' },
    { value: 'terlambat',   label: '⏰ Terlambat' },
    { value: 'izin',        label: '📝 Izin' },
    { value: 'sakit',       label: '🏥 Sakit' },
    { value: 'tidak_hadir', label: '✗ Tidak Hadir' },
];

let studentList = [];

// ── Helpers ──────────────────────────────────────────────────────────
function showAlert(msg, type = 'success') {
    const el = document.getElementById('as-alert');
    el.textContent = msg;
    el.className = `as-alert ${type} show`;
    setTimeout(() => { el.className = 'as-alert'; }, 4000);
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

// ── Load kelas ────────────────────────────────────────────────────────
async function loadKelas() {
    try {
        const res = await window.apiFetch('students/classes/');
        if (!res || !res.ok) {
            console.error('[absensi-sholat] loadKelas HTTP error:',
                res?.status, await res?.text());
            showAlert('Gagal memuat daftar kelas (HTTP ' + res?.status + ')', 'error');
            return;
        }
        const d = await res.json();
        const kelasList = d.classes || d || [];
        const sel = document.getElementById('as-kelas');
        kelasList.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            sel.appendChild(opt);
        });
    } catch (e) {
        console.error('[absensi-sholat] gagal load kelas:', e);
        showAlert('Gagal memuat daftar kelas: ' + e.message, 'error');
    }
}

// ── Load santri per kelas ─────────────────────────────────────────────
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
        if (!res || !res.ok) {
            console.error('[absensi-sholat] loadSantri HTTP error:',
                res?.status, await res?.text());
            showAlert('Gagal memuat santri (HTTP ' + res?.status + ')', 'error');
            return;
        }
        const d = await res.json();
        studentList = d.results || d.data || d || [];

        if (studentList.length === 0) {
            document.getElementById('as-card').style.display = 'none';
            document.getElementById('as-empty').style.display = 'block';
            document.getElementById('as-empty').textContent =
                'Tidak ada santri di kelas ini.';
            return;
        }

        renderTable(kelas);
        document.getElementById('as-card').style.display = 'block';
        document.getElementById('as-empty').style.display = 'none';
        document.getElementById('as-card-title').textContent =
            `Kelas ${kelas} — ${tanggal}`;
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

// ── Render tabel ──────────────────────────────────────────────────────
function renderTable(kelas) {
    const tbody = document.getElementById('as-tbody');
    tbody.innerHTML = studentList.map((s, idx) => {
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

    // Attach onchange untuk warna
    tbody.querySelectorAll('.as-status-select').forEach(sel => {
        sel.onchange = function() { applySelectColor(this); };
    });
}

// ── Hadir semua ───────────────────────────────────────────────────────
function setAllHadir() {
    document.querySelectorAll('.as-status-select').forEach(sel => {
        sel.value = 'hadir';
        applySelectColor(sel);
    });
}

// ── Submit ────────────────────────────────────────────────────────────
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tanggal,
                        jenis: 'sholat_wajib',
                        waktu,
                        records
                    })
                }
            );
            const d = typeof res?.json === 'function' ? await res.json() : res;
            totalSuccess += d.success_count || 0;
            totalError += d.error_count || 0;
        } catch (e) {
            console.error(`[absensi-sholat] error submit ${waktu}:`, e);
            totalError += records.length;
        }
    }

    btn.disabled = false;
    btn.textContent = '💾 Simpan Absensi';

    if (totalError === 0) {
        showAlert(
            `✅ Absensi berhasil disimpan: ${totalSuccess} record.`,
            'success'
        );
    } else {
        showAlert(
            `⚠️ Tersimpan ${totalSuccess}, gagal ${totalError}.`,
            'error'
        );
    }
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    // Set default tanggal = hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('as-tanggal').value = today;

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
