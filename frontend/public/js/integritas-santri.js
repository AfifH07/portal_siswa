let integritasSantriState = {
    currentUser: null,
    poin: [],
    santri: [],
    selectedSantriNisn: '',
    initialized: false,
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

    const tabButton = document.querySelector('[data-tab="integritas"]');
    if (user.role === 'walisantri') {
        if (tabButton) tabButton.style.display = 'none';
        return;
    }

    if (tabButton) tabButton.style.display = '';
    setupIntegritasEvents();
    loadPoinIntegritas().then(() => {
        loadSantriList().then(() => {
            renderFormIntegritasSantri();
            if (integritasSantriState.santri.length > 0) {
                const first = integritasSantriState.santri[0];
                const select = document.getElementById('integritas-santri-select');
                if (select) select.value = first.nisn;
                integritasSantriState.selectedSantriNisn = first.nisn;
                loadHistoryIntegritasSantri(first.nisn);
            }
        });
    });
}

function setupTabButtons() {
    document.querySelectorAll('.module-tabs .tab-btn').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        btn.onclick = () => switchTab(tab);
    });
}

function setupIntegritasEvents() {
    const select = document.getElementById('integritas-santri-select');
    if (select) {
        select.onchange = () => {
            integritasSantriState.selectedSantriNisn = select.value;
            if (select.value) {
                loadHistoryIntegritasSantri(select.value);
            } else {
                renderIntegritasHistory([]);
            }
        };
    }

    const btnLoad = document.getElementById('btn-load-integritas-history');
    if (btnLoad) {
        btnLoad.onclick = () => {
            const nisn = document.getElementById('integritas-santri-select')?.value || '';
            if (!nisn) return;
            loadHistoryIntegritasSantri(nisn);
        };
    }
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    tabs.forEach(tab => {
        tab.style.display = tab.id === `tab-${tabName}` ? '' : 'none';
        tab.classList.toggle('active', tab.id === `tab-${tabName}`);
    });

    if (tabName === 'integritas' && integritasSantriState.poin.length === 0) {
        loadPoinIntegritas().then(() => {
            renderFormIntegritasSantri();
        });
    }
}

async function loadPoinIntegritas() {
    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/');
        const result = await response.json();
        integritasSantriState.poin = result.data || [];
        renderFormIntegritasSantri();
    } catch (err) {
        console.error('[Integritas] Gagal load poin:', err);
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
            .filter(s => s && (s.nisn || s.nis))
            .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

        renderSantriSelect();
    } catch (err) {
        console.error('[Integritas] Gagal load santri:', err);
    }
}

function renderSantriSelect() {
    const select = document.getElementById('integritas-santri-select');
    if (!select) return;

    select.innerHTML = '<option value="">Pilih Santri</option>';
    integritasSantriState.santri.forEach(s => {
        select.innerHTML += `<option value="${escapeHtml(s.nisn)}">${escapeHtml(s.nama || s.name || '-') } (${escapeHtml(s.nisn)})</option>`;
    });
}

function renderFormIntegritasSantri() {
    const container = document.getElementById('integritas-form-container');
    if (!container) return;

    const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (integritasSantriState.poin.length === 0) {
        container.innerHTML = '<p class="text-muted">Poin integritas belum tersedia.</p>';
        return;
    }

    container.innerHTML = `
        <div class="glass-card" style="padding:16px; margin-top:16px;">
            <div class="card-head" style="margin-bottom:12px;">
                <h3><span class="ch-icon">🛡️</span> Form Penilaian</h3>
                <div class="card-badge">${integritasSantriState.poin.length} poin</div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Poin</th>
                            <th>Skala</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${integritasSantriState.poin.map(p => `
                            <tr class="integritas-row" data-poin-id="${p.id}">
                                <td><strong>${escapeHtml(p.nama)}</strong></td>
                                <td>
                                    <select class="glass-input integritas-skala" style="min-width:120px;">
                                        <option value="0">-- Pilih --</option>
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
                <textarea id="integritas-catatan" class="glass-input" rows="3" placeholder="Catatan tambahan..."></textarea>
            </div>
            <div class="form-actions" style="margin-top:16px;">
                <button type="button" id="btn-submit-integritas-santri" class="btn btn-primary">Simpan Penilaian</button>
            </div>
        </div>
    `;

    const btn = document.getElementById('btn-submit-integritas-santri');
    if (btn) {
        btn.disabled = !integritasSantriState.selectedSantriNisn;
        btn.onclick = submitIntegritasSantri;
    }

    const historyCount = document.getElementById('integritas-count');
    if (historyCount && integritasSantriState.selectedSantriNisn) {
        loadHistoryIntegritasSantri(integritasSantriState.selectedSantriNisn);
    }
}

async function submitIntegritasSantri() {
    const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    const nisn = document.getElementById('integritas-santri-select')?.value || integritasSantriState.selectedSantriNisn;
    const catatan = document.getElementById('integritas-catatan')?.value || '';
    const btn = document.getElementById('btn-submit-integritas-santri');

    if (!nisn) {
        showMessage('Pilih santri terlebih dahulu.', 'warning');
        return;
    }

    const rows = document.querySelectorAll('.integritas-row');
    const payloads = [];
    rows.forEach(row => {
        const poinId = row.getAttribute('data-poin-id');
        const skala = row.querySelector('.integritas-skala')?.value || '0';
        if (parseInt(skala, 10) > 0) {
            payloads.push({ poin_id: poinId, skala: parseInt(skala, 10) });
        }
    });

    if (payloads.length === 0) {
        showMessage('Pilih minimal satu skala.', 'warning');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }

    try {
        for (const payload of payloads) {
            const response = await window.apiFetch('/evaluations/integritas-santri/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    santri_nisn: nisn,
                    poin_id: parseInt(payload.poin_id, 10),
                    skala: payload.skala,
                    catatan
                })
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Gagal menyimpan penilaian');
            }
        }

        showMessage('Penilaian berhasil disimpan.', 'success');
        await loadHistoryIntegritasSantri(nisn);
    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan Penilaian';
        }
    }
}

async function loadHistoryIntegritasSantri(nisn) {
    const body = document.getElementById('integritas-history-body');
    const count = document.getElementById('integritas-count');

    if (!body) return;
    if (!nisn) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Pilih santri untuk melihat riwayat.</td></tr>';
        if (count) count.textContent = '0';
        return;
    }

    body.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';

    try {
        const response = await window.apiFetch(`/evaluations/integritas-santri/?santri_nisn=${encodeURIComponent(nisn)}`);
        const result = await response.json();
        const history = result.data || [];

        if (count) count.textContent = history.length;

        if (history.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada penilaian.</td></tr>';
            return;
        }

        body.innerHTML = history.map(item => `
            <tr data-id="${item.id}">
                <td>${escapeHtml(formatDate(item.tanggal))}</td>
                <td>${escapeHtml(item.poin_nama || '-')}</td>
                <td><span class="status-badge badge-blue">${escapeHtml(String(item.skala))}</span></td>
                <td>${escapeHtml(item.catatan || '-')}</td>
                <td>${escapeHtml(item.penilai_name || '-')}</td>
                <td>
                    <button class="btn btn-sm btn-outline" data-action="hapus-integritas-santri" data-id="${item.id}">
                        Hapus
                    </button>
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

async function hapusIntegritasSantri(id) {
    if (!confirm('Hapus penilaian ini?')) return;

    try {
        const response = await window.apiFetch(`/evaluations/integritas-santri/${id}/`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menghapus');

        showMessage('Penilaian dihapus.', 'success');
        const nisn = document.getElementById('integritas-santri-select')?.value || integritasSantriState.selectedSantriNisn;
        if (nisn) await loadHistoryIntegritasSantri(nisn);
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function renderIntegritasHistory(history) {
    const body = document.getElementById('integritas-history-body');
    if (!body) return;
    if (!history || history.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada penilaian.</td></tr>';
        return;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.switchTab = switchTab;
window.loadPoinIntegritas = loadPoinIntegritas;
window.renderFormIntegritasSantri = renderFormIntegritasSantri;
window.submitIntegritasSantri = submitIntegritasSantri;
window.loadHistoryIntegritasSantri = loadHistoryIntegritasSantri;
window.hapusIntegritasSantri = hapusIntegritasSantri;
