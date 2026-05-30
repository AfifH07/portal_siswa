/**
 * Pertemuan Pengasuhan - Portal Ponpes Baron v2.4.3
 */

let userRole = '';
let userId = null;
let kelompokData = [];
let pertemuanData = [];
let activePertemuanId = null;
let activeSantriList = [];

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userRole = user.role || '';
    userId = user.id || null;

    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) topbarDate.textContent = '📅 ' + new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Show sections by role
    if (['superadmin', 'admin', 'pimpinan'].includes(userRole)) {
        document.getElementById('kelompok-section').style.display = '';
        document.getElementById('belum-pertemuan-section').style.display = '';
        document.getElementById('form-pertemuan-section').style.display = '';
        document.getElementById('th-aksi-pt').style.display = '';
        document.getElementById('pertemuan-title').textContent = 'Semua Pertemuan';
        await loadGuruList();
        await loadKelasList();
        await loadBelumPertemuan();
    }

    if (userRole === 'guru') {
        document.getElementById('form-pertemuan-section').style.display = '';
        document.getElementById('th-aksi-pt').style.display = '';
    }

    // Setup foto preview
    const fotoInput = document.getElementById('pt-foto');
    if (fotoInput) fotoInput.addEventListener('change', handleFotoPreview);

    if (typeof lucide !== 'undefined') lucide.createIcons();

    await loadKelompok();
    await loadPertemuan();

    // Warning guru belum pertemuan
    if (userRole === 'guru') await checkWarningGuru();

    const ptTanggal = document.getElementById('pt-tanggal');
    if (ptTanggal) {
        ptTanggal.value = new Date().toISOString().split('T')[0];
    }
});

// ============================================
// KELOMPOK
// ============================================

async function loadKelompok() {
    const tbody = document.getElementById('tbody-kelompok');
    if (!tbody) return;

    try {
        const response = await window.apiFetch('/kesantrian/kelompok-pengasuhan/');
        const result = await response.json();
        if (!result.success) return;

        kelompokData = result.data || [];

        // Populate dropdown form pertemuan
        const ptKelompok = document.getElementById('pt-kelompok');
        if (ptKelompok) {
            ptKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
            kelompokData.forEach(k => {
                ptKelompok.innerHTML += `<option value="${k.id}">${escapeHtml(k.nama)} (${escapeHtml(k.kelas)})</option>`;
            });
        }

        if (!['superadmin', 'admin', 'pimpinan'].includes(userRole)) return;

        tbody.innerHTML = '';
        if (kelompokData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada kelompok</td></tr>';
            return;
        }

        kelompokData.forEach(k => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Klik untuk lihat daftar santri';
            tr.onclick = () => openSantriModal(k.id);
            tr.innerHTML = `
                <td><strong>${escapeHtml(k.nama)}</strong></td>
                <td>${escapeHtml(k.kelas)}</td>
                <td>${escapeHtml(k.pengasuh_name || '-')}</td>
                <td>${escapeHtml(k.wakil_name || '-')}</td>
                <td><span class="status-badge badge-blue">${k.jumlah_santri} santri</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" style="color:var(--danger,#ef4444);"
                        onclick="hapusKelompok(${k.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Gagal memuat</td></tr>`;
    }
}

async function loadGuruList() {
    try {
        const response = await window.apiFetch('/admin/users/?role=guru');
        const result = await response.json();
        const list = result.data || result.results || [];

        const selPengasuh = document.getElementById('kel-pengasuh');
        const selWakil = document.getElementById('kel-wakil');
        if (!selPengasuh) return;

        list.forEach(u => {
            const name = escapeHtml(u.name || u.username);
            selPengasuh.innerHTML += `<option value="${u.id}">${name}</option>`;
            selWakil.innerHTML += `<option value="${u.id}">${name}</option>`;
        });
    } catch (err) {
        console.error('[Pertemuan] Gagal load guru:', err);
    }
}

async function loadKelasList() {
    try {
        const response = await window.apiFetch('/students/');
        const result = await response.json();
        const santriList = result.data || result.results || [];

        const kelasList = [...new Set(
            santriList.map(s => s.kelas).filter(Boolean)
        )].sort();

        const selKelas = document.getElementById('kel-kelas');
        if (!selKelas) return;

        selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        kelasList.forEach(k => {
            selKelas.innerHTML += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`;
        });
    } catch (err) {
        console.error('[Pertemuan] Gagal load kelas:', err);
    }
}

function toggleFormKelompok() {
    const form = document.getElementById('form-kelompok');
    if (form) form.style.display = form.style.display === 'none' ? '' : 'none';
}

async function submitKelompok() {
    const nama = document.getElementById('kel-nama')?.value.trim();
    const kelas = document.getElementById('kel-kelas')?.value.trim();
    const pengasuhId = document.getElementById('kel-pengasuh')?.value;
    const wakilId = document.getElementById('kel-wakil')?.value;
    const btn = document.getElementById('btn-submit-kelompok');

    if (!nama || !kelas || !pengasuhId) {
        alert('⚠️ Nama, kelas, dan pengasuh wajib diisi.'); return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch('/kesantrian/kelompok-pengasuhan/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama, kelas,
                pengasuh_id: parseInt(pengasuhId),
                wakil_pengasuh_id: wakilId ? parseInt(wakilId) : null
            })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Kelompok berhasil dibuat!');
            document.getElementById('kel-nama').value = '';
            document.getElementById('kel-kelas').value = '';
            document.getElementById('kel-pengasuh').value = '';
            document.getElementById('kel-wakil').value = '';
            toggleFormKelompok();
            await loadKelompok();
        } else {
            alert('❌ Gagal: ' + (result.message || 'Error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Simpan Kelompok'; lucide.createIcons(); }
    }
}

async function hapusKelompok(id) {
    if (!confirm('Hapus kelompok ini? Semua pertemuan terkait juga terhapus.')) return;
    try {
        const response = await window.apiFetch(`/kesantrian/kelompok-pengasuhan/${id}/`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) { await loadKelompok(); await loadPertemuan(); }
        else alert('❌ ' + (result.message || 'Gagal hapus'));
    } catch (err) { alert('❌ ' + err.message); }
}

async function openSantriModal(kelompokId) {
    const modal = document.getElementById('santri-modal');
    const title = document.getElementById('santri-modal-title');
    const body = document.getElementById('santri-modal-body');

    const kelompok = kelompokData.find(k => k.id === kelompokId);
    if (title && kelompok) {
        title.textContent = `Santri — ${kelompok.nama} (${kelompok.kelas})`;
    }
    if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    if (modal) modal.classList.add('show');

    try {
        const kelas = kelompok?.kelas || '';
        const response = await window.apiFetch(`/students/?kelas=${encodeURIComponent(kelas)}`);
        const result = await response.json();
        const santri = result.data || result.results || [];

        if (santri.length === 0) {
            body.innerHTML = '<p class="text-muted">Tidak ada santri di kelas ini.</p>';
            return;
        }

        body.innerHTML = `
            <p style="margin-bottom:12px; color:var(--text-secondary);">
                Total: <strong>${santri.length} santri</strong>
            </p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Nama</th>
                        <th>NISN</th>
                        <th>Jenis Kelamin</th>
                    </tr>
                </thead>
                <tbody>
                    ${santri.map((s, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${escapeHtml(s.nama || s.name || '-')}</td>
                            <td><code>${escapeHtml(s.nisn || '-')}</code></td>
                            <td>${s.jenis_kelamin === 'L' ? '👦 Laki-laki' : s.jenis_kelamin === 'P' ? '👧 Perempuan' : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        if (body) body.innerHTML = `<p class="text-muted">Gagal memuat: ${err.message}</p>`;
    }
}

function closeSantriModal() {
    document.getElementById('santri-modal')?.classList.remove('show');
}

// ============================================
// BELUM PERTEMUAN (pimpinan)
// ============================================

async function loadBelumPertemuan() {
    const content = document.getElementById('belum-pertemuan-content');
    const badge = document.getElementById('belum-badge');
    if (!content) return;

    try {
        const response = await window.apiFetch('/kesantrian/pengasuhan/belum-pertemuan/');
        const result = await response.json();
        const data = result.data || [];

        if (badge) badge.textContent = data.length;

        if (data.length === 0) {
            content.innerHTML = '<p style="padding:12px; color:var(--success,#10b981);">✅ Semua kelompok sudah melakukan pertemuan bulan ini.</p>';
            return;
        }

        content.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Kelompok</th><th>Kelas</th><th>Pengasuh</th><th>Wakil</th></tr></thead>
                    <tbody>
                        ${data.map(k => `
                            <tr>
                                <td>${escapeHtml(k.nama)}</td>
                                <td>${escapeHtml(k.kelas)}</td>
                                <td>${escapeHtml(k.pengasuh_name || '-')}</td>
                                <td>${escapeHtml(k.wakil_name || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        if (content) content.innerHTML = '<p class="text-muted">Gagal memuat data.</p>';
    }
}

// ============================================
// PERTEMUAN
// ============================================

async function loadPertemuan() {
    const tbody = document.getElementById('tbody-pertemuan');
    const badge = document.getElementById('pertemuan-badge');
    const empty = document.getElementById('pertemuan-empty');
    const tableContainer = document.getElementById('pertemuan-table-container');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center">
        <div class="loading-spinner" style="margin:30px auto;"></div></td></tr>`;

    try {
        const response = await window.apiFetch('/kesantrian/pertemuan-pengasuhan/');
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        pertemuanData = result.data || [];
        if (badge) badge.textContent = `${pertemuanData.length} data`;

        if (pertemuanData.length === 0) {
            if (tableContainer) tableContainer.style.display = 'none';
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (tableContainer) tableContainer.style.display = '';
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = '';
        pertemuanData.forEach(item => {
            const tr = document.createElement('tr');
            const tanggal = item.tanggal
                ? new Date(item.tanggal).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })
                : '-';

            const canEdit = ['superadmin', 'admin', 'pimpinan'].includes(userRole) || userRole === 'guru';

            tr.innerHTML = `
                <td><span class="status-badge badge-blue">${escapeHtml(item.kelompok_nama || '-')}</span></td>
                <td><strong>${escapeHtml(item.judul)}</strong></td>
                <td>${tanggal}</td>
                <td>${escapeHtml(item.lokasi)}</td>
                <td><span class="status-badge badge-green">${item.jumlah_hadir} hadir</span></td>
                <td>
                    ${item.foto_url
                        ? `<button class="btn btn-sm btn-outline" onclick="openFotoModal('${item.foto_url}')">
                            <i data-lucide="image"></i> Lihat
                           </button>`
                        : '<span class="text-muted">-</span>'}
                </td>
                ${canEdit ? `
                <td>
                    <button class="btn btn-sm btn-outline" style="margin-right:4px;"
                        onclick="${userRole === 'walisantri' ? 'openDetailModal' : 'openPresensiModal'}(${item.id})">
                        <i data-lucide="${userRole === 'walisantri' ? 'eye' : 'clipboard-list'}"></i>
                        ${userRole === 'walisantri' ? 'Detail' : 'Presensi'}
                    </button>
                    <button class="btn btn-sm btn-outline" style="color:var(--danger,#ef4444);"
                        onclick="hapusPertemuan(${item.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>` : `
                <td>
                    <button class="btn btn-sm btn-outline"
                        onclick="openDetailModal(${item.id})">
                        <i data-lucide="eye"></i> Detail
                    </button>
                </td>`}
            `;
            tbody.appendChild(tr);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">
            Gagal memuat: ${err.message}</td></tr>`;
    }
}

async function submitPertemuan() {
    const kelompokId = document.getElementById('pt-kelompok')?.value;
    const tanggal = document.getElementById('pt-tanggal')?.value;
    const lokasi = document.getElementById('pt-lokasi')?.value.trim();
    const deskripsi = document.getElementById('pt-deskripsi')?.value.trim();
    const fotoInput = document.getElementById('pt-foto');
    const btn = document.getElementById('btn-submit-pertemuan');

    if (!kelompokId || !tanggal || !lokasi) {
        alert('⚠️ Kelompok, tanggal, dan lokasi wajib diisi.'); return;
    }

    const formData = new FormData();
    formData.append('kelompok_id', kelompokId);
    formData.append('judul', `Pertemuan ${new Date(tanggal).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
    formData.append('tanggal', tanggal);
    formData.append('lokasi', lokasi);
    formData.append('deskripsi', deskripsi || '');
    if (fotoInput?.files?.length > 0) formData.append('foto', fotoInput.files[0]);

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch('/kesantrian/pertemuan-pengasuhan/', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Pertemuan berhasil dicatat!');
            document.getElementById('pt-kelompok').value = '';
            document.getElementById('pt-tanggal').value =
                new Date().toISOString().split('T')[0];
            document.getElementById('pt-lokasi').value = '';
            document.getElementById('pt-deskripsi').value = '';
            if (fotoInput) fotoInput.value = '';
            document.getElementById('pt-foto-preview').style.display = 'none';
            document.getElementById('pt-foto-name').textContent = 'Belum ada foto';
            await loadPertemuan();
            if (userRole === 'guru') await checkWarningGuru();
        } else {
            alert('❌ Gagal: ' + (result.message || 'Error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="calendar-check"></i> Catat Pertemuan'; lucide.createIcons(); }
    }
}

async function hapusPertemuan(id) {
    if (!confirm('Hapus pertemuan ini?')) return;
    try {
        const response = await window.apiFetch(`/kesantrian/pertemuan-pengasuhan/${id}/`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) await loadPertemuan();
        else alert('❌ ' + (result.message || 'Gagal'));
    } catch (err) { alert('❌ ' + err.message); }
}

// ============================================
// PRESENSI MODAL
// ============================================

async function openPresensiModal(id) {
    activePertemuanId = id;
    const modal = document.getElementById('presensi-modal');
    const title = document.getElementById('presensi-modal-title');
    const body = document.getElementById('presensi-modal-body');
    const btnSave = document.getElementById('btn-save-presensi');

    const item = pertemuanData.find(p => p.id === id);
    if (title && item) title.textContent = `Presensi — ${item.judul}`;
    if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    if (modal) modal.classList.add('show');
    if (btnSave) btnSave.onclick = savePresensi;
    // Tambah tombol Hadir Semua ke footer modal
    const footer = document.querySelector('#presensi-modal .modal-footer');
    if (footer && !document.getElementById('btn-hadir-semua')) {
        const btnHadir = document.createElement('button');
        btnHadir.id = 'btn-hadir-semua';
        btnHadir.className = 'btn btn-secondary';
        btnHadir.innerHTML = '<i data-lucide="check-check"></i> Hadir Semua';
        btnHadir.onclick = hadirSemua;
        footer.insertBefore(btnHadir, footer.firstChild);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        // Load santri dari kelas kelompok
        const kelompok = kelompokData.find(k => k.id === item?.kelompok);
        const kelas = kelompok?.kelas || '';

        const [santriRes, presensiRes] = await Promise.all([
            window.apiFetch(`/students/?kelas=${encodeURIComponent(kelas)}`),
            window.apiFetch(`/kesantrian/pertemuan-pengasuhan/${id}/presensi/`)
        ]);
        const santriResult = await santriRes.json();
        const presensiResult = await presensiRes.json();

        activeSantriList = santriResult.data || santriResult.results || [];
        const presensiData = presensiResult.data || [];

        const presensiMap = {};
        presensiData.forEach(p => { presensiMap[p.santri] = p.status; });

        if (activeSantriList.length === 0) {
            body.innerHTML = '<p class="text-muted">Tidak ada santri di kelas ini.</p>';
            return;
        }

        body.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>Nama Santri</th><th>NISN</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${activeSantriList.map(s => `
                        <tr>
                            <td>${escapeHtml(s.nama || s.name || '-')}</td>
                            <td><code>${escapeHtml(s.nisn)}</code></td>
                            <td>
                                <select class="filter-input presensi-status"
                                    data-nisn="${s.nisn}" style="min-width:130px;">
                                    <option value="hadir" ${(presensiMap[s.nisn] || presensiMap[s.id]) === 'hadir' ? 'selected' : ''}>Hadir</option>
                                    <option value="tidak_hadir" ${!(presensiMap[s.nisn] || presensiMap[s.id]) || (presensiMap[s.nisn] || presensiMap[s.id]) === 'tidak_hadir' ? 'selected' : ''}>Tidak Hadir</option>
                                    <option value="izin" ${(presensiMap[s.nisn] || presensiMap[s.id]) === 'izin' ? 'selected' : ''}>Izin</option>
                                    <option value="sakit" ${(presensiMap[s.nisn] || presensiMap[s.id]) === 'sakit' ? 'selected' : ''}>Sakit</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        if (body) body.innerHTML = `<p class="text-muted">Gagal memuat: ${err.message}</p>`;
    }
}

function hadirSemua() {
    document.querySelectorAll('.presensi-status').forEach(sel => {
        sel.value = 'hadir';
    });
}

async function savePresensi() {
    if (!activePertemuanId) return;
    const btn = document.getElementById('btn-save-presensi');
    const selects = document.querySelectorAll('.presensi-status');
    const payload = [];
    selects.forEach(sel => {
        payload.push({ nisn: sel.getAttribute('data-nisn'), status: sel.value, catatan: '' });
    });

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch(
            `/kesantrian/pertemuan-pengasuhan/${activePertemuanId}/presensi/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presensi: payload })
            }
        );
        const result = await response.json();
        if (result.success) {
            alert('✅ Presensi disimpan!');
            closePresensiModal();
            await loadPertemuan();
        } else { alert('❌ ' + (result.message || 'Gagal')); }
    } catch (err) { alert('❌ ' + err.message); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Simpan Presensi'; lucide.createIcons(); }
    }
}

function closePresensiModal() {
    document.getElementById('presensi-modal')?.classList.remove('show');
    activePertemuanId = null;
}

// ============================================
// DETAIL MODAL (walisantri)
// ============================================

async function openDetailModal(id) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('detail-modal-body');
    const title = document.getElementById('detail-modal-title');
    const item = pertemuanData.find(p => p.id === id);

    if (title && item) title.textContent = item.judul;
    if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    if (modal) modal.classList.add('show');

    try {
        const presensiRes = await window.apiFetch(`/kesantrian/pertemuan-pengasuhan/${id}/presensi/`);
        const presensiResult = await presensiRes.json();
        const presensiData = presensiResult.data || [];

        const tanggal = item?.tanggal
            ? new Date(item.tanggal).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
              })
            : '-';

        const statusMap = { hadir: 'badge-green', tidak_hadir: 'badge-red', izin: 'badge-yellow', sakit: 'badge-purple' };
        const labelMap = { hadir: 'Hadir', tidak_hadir: 'Tidak Hadir', izin: 'Izin', sakit: 'Sakit' };

        body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div><strong>Tanggal:</strong> ${tanggal}</div>
                <div><strong>Lokasi:</strong> ${escapeHtml(item?.lokasi || '-')}</div>
                ${item?.deskripsi ? `<div><strong>Agenda:</strong> ${escapeHtml(item.deskripsi)}</div>` : ''}
                ${item?.foto_url ? `
                    <div>
                        <strong>Foto Dokumentasi:</strong><br>
                        <img src="${item.foto_url}" alt="Foto"
                            style="max-width:100%; max-height:300px; border-radius:8px; margin-top:8px; cursor:pointer;"
                            onclick="openFotoModal('${item.foto_url}')">
                    </div>` : ''}
                <hr style="border:none; border-top:1px solid var(--border,#e2e8f0);">
                <div><strong>Kehadiran Anak:</strong></div>
                ${presensiData.length > 0
                    ? presensiData.map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--bg-card,#f8fafc); border-radius:8px;">
                            <span>${escapeHtml(p.santri_nama || '-')}</span>
                            <span class="status-badge ${statusMap[p.status] || 'badge-gray'}">${labelMap[p.status] || p.status}</span>
                        </div>`).join('')
                    : '<p class="text-muted">Presensi belum diisi.</p>'}
            </div>
        `;
    } catch (err) {
        if (body) body.innerHTML = '<p class="text-muted">Gagal memuat detail.</p>';
    }
}

function closeDetailModal() {
    document.getElementById('detail-modal')?.classList.remove('show');
}

// ============================================
// FOTO MODAL
// ============================================

function openFotoModal(url) {
    const modal = document.getElementById('foto-modal');
    const img = document.getElementById('foto-modal-img');
    if (img) img.src = url;
    if (modal) modal.classList.add('show');
}

function closeFotoModal() {
    document.getElementById('foto-modal')?.classList.remove('show');
}

// ============================================
// WARNING GURU
// ============================================

async function checkWarningGuru() {
    try {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const sudahBulanIni = pertemuanData.some(p => {
            const d = new Date(p.tanggal);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });
        const warning = document.getElementById('warning-section');
        if (warning) warning.style.display = sudahBulanIni ? 'none' : '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) { console.error(err); }
}

// ============================================
// FOTO PREVIEW
// ============================================

function handleFotoPreview(e) {
    const file = e.target.files[0];
    const nameEl = document.getElementById('pt-foto-name');
    const preview = document.getElementById('pt-foto-preview');
    const img = document.getElementById('pt-preview-img');
    if (file) {
        if (nameEl) nameEl.textContent = file.name;
        const reader = new FileReader();
        reader.onload = ev => {
            if (img) img.src = ev.target.result;
            if (preview) preview.style.display = '';
        };
        reader.readAsDataURL(file);
    } else {
        if (nameEl) nameEl.textContent = 'Belum ada foto';
        if (preview) preview.style.display = 'none';
    }
}

// ============================================
// UTILS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Exports
window.toggleFormKelompok = toggleFormKelompok;
window.submitKelompok = submitKelompok;
window.hapusKelompok = hapusKelompok;
window.openSantriModal = openSantriModal;
window.closeSantriModal = closeSantriModal;
window.hadirSemua = hadirSemua;
window.submitPertemuan = submitPertemuan;
window.hapusPertemuan = hapusPertemuan;
window.openPresensiModal = openPresensiModal;
window.savePresensi = savePresensi;
window.closePresensiModal = closePresensiModal;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.openFotoModal = openFotoModal;
window.closeFotoModal = closeFotoModal;
