let integritasSantriState = {
    currentUser: null,
    poin: [],
    santri: [],
    selectedSantriNisn: '',
    history: [],
    initialized: false,
    modalReady: false,
};

document.addEventListener('DOMContentLoaded', () => {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (cachedUser && cachedUser.role) {
        initIntegritasSantri(cachedUser);
    }
});

window.addEventListener('evaluations:user-ready', (event) => {
    if (event?.detail) {
        initIntegritasSantri(event.detail);
    }
});

function initIntegritasSantri(user) {
    if (!user || !user.role) return;
    if (integritasSantriState.initialized && integritasSantriState.currentUser?.id === user.id) return;

    integritasSantriState.initialized = true;
    integritasSantriState.currentUser = user;

    setupTabButtons();
    setupTopControls();
    setupModalControls();

    const tabButton = document.querySelector('[data-tab="integritas"]');
    if (user.role === 'walisantri') {
        if (tabButton) tabButton.style.display = 'none';
        return;
    }

    if (tabButton) tabButton.style.display = '';

    Promise.all([
        loadPoinIntegritas(),
        loadSantriList(),
    ]).then(() => {
        renderSantriSelect();
        renderHistoryEmptyState();
        if (integritasSantriState.santri.length > 0) {
            const first = integritasSantriState.santri[0];
            setSelectedSantri(first.nisn, true);
        }
    });
}

function setupTabButtons() {
    document.querySelectorAll('.module-tabs .tab-btn').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        btn.onclick = () => switchTab(tab);
    });
}

function setupTopControls() {
    const select = document.getElementById('integritas-santri-select');
    if (select) {
        select.onchange = () => {
            setSelectedSantri(select.value, true);
        };
    }

    const openBtn = document.getElementById('btn-open-integritas-modal');
    if (openBtn) {
        openBtn.onclick = openIntegritasModal;
        openBtn.style.display = '';
    }
}

function setupModalControls() {
    if (integritasSantriState.modalReady) return;

    const closeBtn = document.getElementById('btn-close-integritas-modal');
    const cancelBtn = document.getElementById('btn-cancel-integritas-modal');
    const saveBtn = document.getElementById('btn-save-integritas-modal');

    if (closeBtn) closeBtn.onclick = closeIntegritasModal;
    if (cancelBtn) cancelBtn.onclick = closeIntegritasModal;
    if (saveBtn) saveBtn.onclick = submitIntegritasSantri;

    integritasSantriState.modalReady = true;
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    tabs.forEach(tab => {
        const isActive = tab.id === `tab-${tabName}`;
        tab.style.display = isActive ? '' : 'none';
        tab.classList.toggle('active', isActive);
    });

    if (tabName === 'integritas') {
        const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'walisantri') {
            updateIntegritasActionVisibility();
            if (!integritasSantriState.selectedSantriNisn && integritasSantriState.santri.length > 0) {
                setSelectedSantri(integritasSantriState.santri[0].nisn, false);
            } else if (integritasSantriState.selectedSantriNisn) {
                loadHistoryIntegritasSantri(integritasSantriState.selectedSantriNisn);
            }
        }
    }
}

async function loadPoinIntegritas() {
    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/');
        const result = await response.json();
        integritasSantriState.poin = result.data || [];
    } catch (err) {
        console.error('[Integritas] Gagal load poin:', err);
        integritasSantriState.poin = [];
    }
}

async function loadSantriList() {
    try {
        const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
        let santri = [];

        if (['superadmin', 'admin', 'pimpinan'].includes(user.role)) {
            const response = await window.apiFetch('/students/?page_size=1000');
            const result = await response.json();
            santri = result.results || result.data || [];
        } else if (['guru', 'musyrif'].includes(user.role)) {
            const response = await window.apiFetch(`/users/${user.id}/assignments/`);
            const assignments = await response.json();
            const classes = [...new Set(
                (assignments || [])
                    .filter(a => a.status === 'active' && a.kelas)
                    .map(a => a.kelas)
            )];

            const list = [];
            for (const kelas of classes) {
                const studentsRes = await window.apiFetch(`/students/?kelas=${encodeURIComponent(kelas)}&page_size=1000`);
                const studentsData = await studentsRes.json();
                const students = studentsData.results || studentsData.data || [];
                students.forEach(s => list.push(s));
            }
            santri = list;
        }

        integritasSantriState.santri = santri
            .filter(s => s && s.nisn)
            .sort((a, b) => (a.nama || a.name || '').localeCompare(b.nama || b.name || ''));

        renderSantriSelect();
        updateIntegritasActionVisibility();
    } catch (err) {
        console.error('[Integritas] Gagal load santri:', err);
        integritasSantriState.santri = [];
        renderSantriSelect();
    }
}

function renderSantriSelect() {
    const select = document.getElementById('integritas-santri-select');
    if (!select) return;

    const previous = integritasSantriState.selectedSantriNisn || '';
    select.innerHTML = '<option value="">Pilih Santri</option>';
    integritasSantriState.santri.forEach(s => {
        select.innerHTML += `<option value="${escapeHtml(s.nisn)}">${escapeHtml(s.nama || s.name || '-') } (${escapeHtml(s.nisn)})</option>`;
    });

    if (previous && integritasSantriState.santri.some(s => s.nisn === previous)) {
        select.value = previous;
    }
}

function setSelectedSantri(nisn, loadHistory = true) {
    integritasSantriState.selectedSantriNisn = nisn || '';
    const select = document.getElementById('integritas-santri-select');
    if (select && select.value !== integritasSantriState.selectedSantriNisn) {
        select.value = integritasSantriState.selectedSantriNisn;
    }
    updateIntegritasActionVisibility();

    if (!nisn) {
        renderHistoryEmptyState();
        return;
    }

    if (loadHistory) {
        loadHistoryIntegritasSantri(nisn);
    }
}

function updateIntegritasActionVisibility() {
    const btn = document.getElementById('btn-open-integritas-modal');
    const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (!btn) return;
    btn.style.display = user.role === 'walisantri' ? 'none' : '';
    btn.disabled = !integritasSantriState.selectedSantriNisn;
}

async function openIntegritasModal() {
    const nisn = integritasSantriState.selectedSantriNisn || document.getElementById('integritas-santri-select')?.value || '';
    if (!nisn) {
        showMessage('Pilih santri terlebih dahulu.', 'warning');
        return;
    }

    const student = integritasSantriState.santri.find(s => s.nisn === nisn);
    const title = document.getElementById('integritas-modal-title');
    const body = document.getElementById('integritas-modal-body');
    if (title) title.textContent = `Penilaian Integritas — ${student?.nama || student?.name || nisn}`;

    if (body) {
        if (integritasSantriState.poin.length === 0) {
            body.innerHTML = '<p class="text-muted">Poin integritas belum tersedia.</p>';
        } else {
            body.innerHTML = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Poin</th>
                                <th>Skala</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${integritasSantriState.poin.map(poin => `
                                <tr>
                                    <td><strong>${escapeHtml(poin.nama)}</strong></td>
                                    <td>
                                        <select class="glass-input integritas-skala" data-poin-id="${poin.id}">
                                            <option value="0">—</option>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="form-group" style="margin-top:12px;">
                    <label>Catatan</label>
                    <textarea id="integritas-catatan" class="glass-input" rows="3" placeholder="Catatan tambahan (opsional)..."></textarea>
                </div>
            `;
        }
    }

    document.getElementById('integritas-modal')?.classList.add('show');
}

function closeIntegritasModal() {
    document.getElementById('integritas-modal')?.classList.remove('show');
}

async function submitIntegritasSantri() {
    const nisn = integritasSantriState.selectedSantriNisn || document.getElementById('integritas-santri-select')?.value || '';
    const catatanValue = document.getElementById('integritas-catatan')?.value || '';
    const selects = document.querySelectorAll('#integritas-modal .integritas-skala');
    const payload = [];

    selects.forEach(sel => {
        const skala = sel.value;
        const poinId = parseInt(sel.getAttribute('data-poin-id'), 10);
        if (skala && skala !== '0') {
            payload.push({ poin_id: poinId, skala: parseInt(skala, 10) });
        }
    });

    if (payload.length === 0) {
        showMessage('Pilih minimal 1 poin untuk dinilai.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-save-integritas-modal');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }

    try {
        for (const item of payload) {
            const response = await window.apiFetch('/evaluations/integritas-santri/', {
                method: 'POST',
                body: JSON.stringify({
                    santri_nisn: nisn,
                    poin_id: item.poin_id,
                    skala: item.skala,
                    catatan: catatanValue
                })
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Gagal menyimpan penilaian');
            }
        }

        closeIntegritasModal();
        showMessage('Penilaian berhasil disimpan.', 'success');
        await loadHistoryIntegritasSantri(nisn);
    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan';
        }
    }
}

async function loadHistoryIntegritasSantri(nisn) {
    const body = document.getElementById('integritas-history-body');
    const empty = document.getElementById('integritas-empty-state');
    const count = document.getElementById('integritas-count');

    if (!body) return;

    if (!nisn) {
        renderHistoryEmptyState();
        if (count) count.textContent = '0';
        return;
    }

    body.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';
    if (empty) empty.style.display = 'none';

    try {
        const response = await window.apiFetch(`/evaluations/integritas-santri/?santri_nisn=${encodeURIComponent(nisn)}`);
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Gagal memuat riwayat');
        }
        const history = result.data || [];
        integritasSantriState.history = history;

        if (count) count.textContent = String(history.length);

        if (history.length === 0) {
            renderHistoryEmptyState('Belum ada penilaian integritas untuk santri ini.');
            return;
        }

        if (empty) empty.style.display = 'none';
        body.innerHTML = history.map(item => `
            <tr data-id="${item.id}">
                <td>${escapeHtml(formatDate(item.tanggal))}</td>
                <td>${escapeHtml(item.poin_nama || '-')}</td>
                <td><span class="status-badge badge-blue">${escapeHtml(String(item.skala || '-'))}</span></td>
                <td>${escapeHtml(item.catatan || '-')}</td>
                <td>${escapeHtml(item.penilai_name || '—')}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline" data-action="hapus-integritas-santri" data-id="${item.id}">Hapus</button>
                </td>
            </tr>
        `).join('');

        body.querySelectorAll('[data-action="hapus-integritas-santri"]').forEach(btn => {
            btn.onclick = () => hapusIntegritasSantri(parseInt(btn.getAttribute('data-id'), 10));
        });
    } catch (err) {
        body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderHistoryEmptyState(text = 'Pilih santri untuk melihat riwayat penilaian integritas.') {
    const body = document.getElementById('integritas-history-body');
    const empty = document.getElementById('integritas-empty-state');
    if (body) {
        body.innerHTML = '';
    }
    if (empty) {
        empty.textContent = text;
        empty.style.display = '';
    }
}

async function hapusIntegritasSantri(id) {
    if (!confirm('Hapus penilaian ini?')) return;

    try {
        const response = await window.apiFetch(`/evaluations/integritas-santri/${id}/`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menghapus');

        showMessage('Penilaian dihapus.', 'success');
        const nisn = integritasSantriState.selectedSantriNisn || document.getElementById('integritas-santri-select')?.value || '';
        if (nisn) {
            await loadHistoryIntegritasSantri(nisn);
        }
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function showMessage(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    alert(message);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

window.switchTab = switchTab;
window.loadPoinIntegritas = loadPoinIntegritas;
window.loadHistoryIntegritasSantri = loadHistoryIntegritasSantri;
window.openIntegritasModal = openIntegritasModal;
window.closeIntegritasModal = closeIntegritasModal;
window.submitIntegritasSantri = submitIntegritasSantri;
window.hapusIntegritasSantri = hapusIntegritasSantri;
