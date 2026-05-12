(function () {
    'use strict';

    let allGuru = [];
    let poinList = [];
    let integritasCount = {};
    let allIntegritasGuru = [];
    let currentGuruId = null;
    let currentGuruName = null;
    let integritas_userRole = '';
    let tabInitialized = false;
    let handlersBound = false;

    function setupTabSwitching() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const tabIntegritas = document.getElementById('tab-btn-integritas');
        if (tabIntegritas && !['superadmin', 'admin', 'pimpinan'].includes(user.role || '')) {
            tabIntegritas.style.display = 'none';
        }

        document.querySelectorAll('#asatidz-tab-bar [data-tab]').forEach(btn => {
            btn.onclick = function () {
                const target = this.getAttribute('data-tab');

                document.querySelectorAll('#asatidz-tab-bar .tab-btn').forEach(button => {
                    button.classList.remove('tab-btn-active');
                });
                this.classList.add('tab-btn-active');

                document.querySelectorAll('.tab-content-panel').forEach(panel => {
                    panel.style.display = 'none';
                });

                const panel = document.getElementById('tab-content-' + target);
                if (panel) {
                    panel.style.display = '';
                }

                const topbarActions = document.getElementById('topbar-actions');
                if (topbarActions) {
                    if (target === 'evaluasi-kinerja') {
                        const current = JSON.parse(localStorage.getItem('user') || '{}');
                        topbarActions.style.display = ['superadmin', 'pimpinan'].includes(current.role || '') ? '' : 'none';
                    } else {
                        topbarActions.style.display = 'none';
                    }
                }

                if (target === 'integritas' && !tabInitialized) {
                    tabInitialized = true;
                    initIntegritasTab();
                }

                refreshIcons();
            };
        });

        if (window.location.hash === '#integritas' && tabIntegritas && tabIntegritas.style.display !== 'none') {
            tabIntegritas.click();
        }
    }

    async function initIntegritasTab() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        integritas_userRole = user.role || '';

        setupEventHandlers();

        const canManage = ['superadmin', 'admin', 'pimpinan'].includes(integritas_userRole);
        const konfigBtn = document.getElementById('btn-open-konfig-integritas');
        if (konfigBtn) {
            konfigBtn.style.display = canManage ? '' : 'none';
        }

        await Promise.all([loadPoinIntegritas(), loadGuruList()]);
        renderGuruTable(allGuru);
        refreshIcons();
    }

    function setupEventHandlers() {
        if (handlersBound) return;
        handlersBound = true;

        const searchEl = document.getElementById('search-guru-integritas');
        if (searchEl) {
            searchEl.oninput = function () {
                const q = (this.value || '').toLowerCase();
                renderGuruTable(allGuru.filter(g =>
                    (g.name || g.username || '').toLowerCase().includes(q)
                ));
            };
        }

        const konfigBtn = document.getElementById('btn-open-konfig-integritas');
        if (konfigBtn) konfigBtn.onclick = openKonfigModal;

        const closeDetailBtn = document.getElementById('btn-close-integritas-guru-detail');
        if (closeDetailBtn) closeDetailBtn.onclick = closeDetailModal;

        const beriPenilaianBtn = document.getElementById('btn-beri-penilaian-guru');
        if (beriPenilaianBtn) beriPenilaianBtn.onclick = openFormPenilaian;

        const closeFormBtn = document.getElementById('btn-close-integritas-guru-form');
        if (closeFormBtn) closeFormBtn.onclick = closeFormModal;

        const cancelFormBtn = document.getElementById('btn-cancel-integritas-guru-form');
        if (cancelFormBtn) cancelFormBtn.onclick = closeFormModal;

        const saveFormBtn = document.getElementById('btn-save-integritas-guru-form');
        if (saveFormBtn) saveFormBtn.onclick = submitIntegritasGuru;

        const closeKonfigBtn = document.getElementById('btn-close-integritas-konfig');
        if (closeKonfigBtn) closeKonfigBtn.onclick = closeKonfigModal;

        const tambahPoinBtn = document.getElementById('btn-integritas-tambah-poin');
        if (tambahPoinBtn) tambahPoinBtn.onclick = tambahPoin;
    }

    async function loadGuruList() {
        const tbody = document.getElementById('integritas-guru-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';
        }

        try {
            const responses = await Promise.all([
                window.apiFetch('/admin/users/?role=guru&page_size=200'),
                window.apiFetch('/evaluations/integritas-guru/')
            ]);
            const guruResult = await responses[0].json();
            const integritasResult = await responses[1].json();

            allGuru = (guruResult.data || guruResult.results || []).filter(item => item && item.id);
            allIntegritasGuru = integritasResult.data || [];
            integritasCount = buildIntegritasSummary(allIntegritasGuru);
        } catch (err) {
            console.error('[IntegritasGuru] Gagal memuat daftar guru:', err);
            allGuru = [];
            allIntegritasGuru = [];
            integritasCount = {};
        }
    }

    function buildIntegritasSummary(records) {
        const summary = {};
        records.forEach(record => {
            const guruId = record.guru || record.guru_id;
            if (!guruId) return;
            if (!summary[guruId]) {
                summary[guruId] = { count: 0, last_date: null };
            }
            summary[guruId].count += 1;
            if (!summary[guruId].last_date || new Date(record.tanggal) > new Date(summary[guruId].last_date)) {
                summary[guruId].last_date = record.tanggal;
            }
        });
        return summary;
    }

    function renderGuruTable(list) {
        const tbody = document.getElementById('integritas-guru-tbody');
        const empty = document.getElementById('integritas-guru-empty');
        const tableContainer = document.getElementById('integritas-guru-table-container');
        if (!tbody) return;

        const sorted = [...list].sort((a, b) => {
            const aMeta = integritasCount[a.id] || { count: 0, last_date: null };
            const bMeta = integritasCount[b.id] || { count: 0, last_date: null };
            const aHas = aMeta.count > 0;
            const bHas = bMeta.count > 0;

            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            if (aHas && bHas) {
                return new Date(bMeta.last_date) - new Date(aMeta.last_date);
            }
            return (a.name || a.username || '').localeCompare(b.name || b.username || '');
        });

        if (sorted.length === 0) {
            if (tableContainer) tableContainer.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (tableContainer) tableContainer.style.display = '';
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = sorted.map(guru => {
            const meta = integritasCount[guru.id] || { count: 0, last_date: null };
            return `
                <tr>
                    <td><strong>${escapeHtml(guru.name || guru.username || '-')}</strong></td>
                    <td><span class="status-badge badge-blue">${escapeHtml(guru.role || 'guru')}</span></td>
                    <td><span class="status-badge badge-green">${meta.count}</span></td>
                    <td>${meta.last_date ? escapeHtml(formatDate(meta.last_date)) : '—'}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline" data-integritas-detail="${guru.id}">
                            Detail
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-integritas-detail]').forEach(btn => {
            const guruId = parseInt(btn.getAttribute('data-integritas-detail'), 10);
            const guru = allGuru.find(item => item.id === guruId);
            btn.onclick = () => openDetailModal(guruId, guru?.name || guru?.username || '-');
        });
    }

    async function loadPoinIntegritas() {
        try {
            const response = await window.apiFetch('/evaluations/poin-integritas/');
            const result = await response.json();
            poinList = result.data || [];
        } catch (err) {
            console.error('[IntegritasGuru] Gagal memuat poin integritas:', err);
            poinList = [];
        }
    }

    async function openDetailModal(guruId, guruName) {
        currentGuruId = guruId;
        currentGuruName = guruName;

        const title = document.getElementById('integritas-guru-detail-title');
        const body = document.getElementById('integritas-guru-detail-body');
        const scoreBtn = document.getElementById('btn-beri-penilaian-guru');

        if (title) title.textContent = `Penilaian Integritas — ${guruName}`;
        if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
        if (scoreBtn) {
            scoreBtn.style.display = ['pimpinan', 'superadmin'].includes(integritas_userRole) ? '' : 'none';
        }

        showModal('integritas-guru-detail-modal');
        await renderDetailModal();
    }

    async function renderDetailModal() {
        const body = document.getElementById('integritas-guru-detail-body');
        if (!body || !currentGuruId) return;

        try {
            const records = await loadHistoryIntegritasGuru(currentGuruId);
            const latestPerPoin = getLatestPerPoin(records, poinList);

            body.innerHTML = `
                ${renderSummaryCards(latestPerPoin)}
                ${renderRiwayatTable(records)}
            `;

            body.querySelectorAll('[data-delete-guru-integritas]').forEach(btn => {
                btn.onclick = () => hapusIntegritasGuru(parseInt(btn.getAttribute('data-delete-guru-integritas'), 10));
            });
        } catch (err) {
            body.innerHTML = `<p class="text-muted">${escapeHtml(err.message || 'Gagal memuat detail guru.')}</p>`;
        }
    }

    async function loadHistoryIntegritasGuru(guruId) {
        const response = await window.apiFetch(`/evaluations/integritas-guru/?guru_id=${guruId}`);
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Gagal memuat riwayat penilaian');
        }
        return result.data || [];
    }

    function getLatestPerPoin(riwayat, points) {
        const result = {};
        points.forEach(poin => {
            const records = riwayat
                .filter(r => r.poin === poin.id || r.poin_nama === poin.nama)
                .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
            result[poin.id] = records.length > 0 ? records[0] : null;
        });
        return result;
    }

    function renderSummaryCards(latestPerPoin) {
        if (poinList.length === 0) {
            return '<p class="text-muted">Poin integritas belum tersedia.</p>';
        }

        return `
            <p style="font-size:12px; color:var(--color-text-secondary); margin: 0 0 10px;">
                Menampilkan nilai terbaru per poin dari seluruh penilai
            </p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px,1fr)); gap:10px; margin-bottom:24px;">
                ${poinList.map(poin => {
                    const record = latestPerPoin[poin.id];
                    const skala = record?.skala || 0;
                    const width = Math.max(0, Math.min(100, (skala / 5) * 100));
                    return `
                        <div style="background:var(--color-background-secondary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-md); padding:12px;">
                            <p style="font-size:11px; color:var(--color-text-secondary); margin:0 0 6px;">${escapeHtml(poin.nama)}</p>
                            <p style="font-size:22px; font-weight:500; margin:0; color:${record ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};">
                                ${record ? `${escapeHtml(String(skala))}<span style="font-size:12px; color:var(--color-text-secondary);">/5</span>` : '—'}
                            </p>
                            <div style="height:4px; background:var(--color-border-tertiary); border-radius:2px; margin-top:8px;">
                                <div style="width:${width}%; height:4px; background:#1d9e75; border-radius:2px;"></div>
                            </div>
                            <p style="font-size:10px; color:var(--color-text-secondary); margin:6px 0 0;">
                                ${record ? `${escapeHtml(record.penilai_name || '—')} · ${escapeHtml(formatDate(record.tanggal))}` : 'belum dinilai'}
                            </p>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderRiwayatTable(records) {
        const canDelete = ['superadmin', 'admin', 'pimpinan'].includes(integritas_userRole);

        if (records.length === 0) {
            return `
                <div style="border-top:0.5px solid var(--color-border-tertiary); padding-top:16px; margin-top:8px;">
                    <p style="font-size:13px; font-weight:500; margin:0 0 12px; color:var(--color-text-primary);">
                        Riwayat semua penilaian
                    </p>
                    <p class="text-muted">Belum ada penilaian integritas untuk guru ini.</p>
                </div>
            `;
        }

        return `
            <div style="border-top:0.5px solid var(--color-border-tertiary); padding-top:16px; margin-top:8px;">
                <p style="font-size:13px; font-weight:500; margin:0 0 12px; color:var(--color-text-primary);">
                    Riwayat semua penilaian
                </p>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Poin</th>
                                <th>Skala</th>
                                <th>Catatan</th>
                                <th>Dinilai Oleh</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td>${escapeHtml(formatDate(r.tanggal))}</td>
                                    <td>${escapeHtml(r.poin_nama || '-')}</td>
                                    <td>
                                        <span style="${getScoreBadgeStyle(Number(r.skala))} padding:2px 10px; border-radius:var(--border-radius-md); font-size:12px; display:inline-block;">
                                            ${escapeHtml(String(r.skala || '-'))}
                                        </span>
                                    </td>
                                    <td>${escapeHtml(r.catatan || '—')}</td>
                                    <td>${escapeHtml(r.penilai_name || '—')}</td>
                                    <td>
                                        ${canDelete
                                            ? `<button type="button" class="btn btn-sm btn-outline" data-delete-guru-integritas="${r.id}">Hapus</button>`
                                            : '—'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function openFormPenilaian() {
        if (!currentGuruId || !['pimpinan', 'superadmin'].includes(integritas_userRole)) return;

        const title = document.getElementById('integritas-guru-form-title');
        const tbody = document.getElementById('integritas-guru-form-tbody');
        if (title) title.textContent = `Beri Penilaian Integritas — ${currentGuruName || '-'}`;
        if (tbody) {
            tbody.innerHTML = poinList.map(poin => `
                <tr>
                    <td><strong>${escapeHtml(poin.nama)}</strong></td>
                    <td>
                        <select class="glass-input integritas-guru-skala" data-poin-id="${poin.id}">
                            <option value="0">—</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        }

        const catatan = document.getElementById('integritas-guru-form-catatan');
        if (catatan) catatan.value = '';

        showModal('integritas-guru-form-modal');
    }

    function closeFormModal() {
        hideModal('integritas-guru-form-modal');
    }

    async function submitIntegritasGuru() {
        if (!currentGuruId) return;

        const catatan = document.getElementById('integritas-guru-form-catatan')?.value || '';
        const selects = document.querySelectorAll('#integritas-guru-form-tbody .integritas-guru-skala');
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

        const btn = document.getElementById('btn-save-integritas-guru-form');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
        }

        try {
            for (const item of payload) {
                const response = await window.apiFetch('/evaluations/integritas-guru/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guru_id: currentGuruId,
                        poin_id: item.poin_id,
                        skala: item.skala,
                        catatan
                    })
                });
                const result = await response.json();
                if (!response.ok || result.success === false) {
                    throw new Error(result.message || 'Gagal menyimpan penilaian');
                }
            }

            closeFormModal();
            await refreshGuruSummary();
            await renderDetailModal();
            renderGuruTable(filterGuruBySearch());
            showMessage('Penilaian berhasil disimpan.', 'success');
        } catch (err) {
            showMessage(err.message || 'Gagal menyimpan penilaian.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Simpan Penilaian';
            }
        }
    }

    async function hapusIntegritasGuru(id) {
        if (!confirm('Hapus penilaian ini?')) return;

        try {
            const response = await window.apiFetch(`/evaluations/integritas-guru/${id}/`, {
                method: 'DELETE'
            });

            if (!response.ok && response.status !== 204) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.message || result.error || 'Gagal menghapus penilaian');
            }

            await refreshGuruSummary();
            await renderDetailModal();
            renderGuruTable(filterGuruBySearch());
            showMessage('Penilaian dihapus.', 'success');
        } catch (err) {
            showMessage(err.message || 'Gagal menghapus penilaian.', 'error');
        }
    }

    function openKonfigModal() {
        loadKonfigPoin();
        showModal('integritas-konfig-modal');
    }

    function closeKonfigModal() {
        hideModal('integritas-konfig-modal');
    }

    async function loadKonfigPoin() {
        const tbody = document.getElementById('integritas-konfig-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';
        }

        await loadPoinIntegritas();

        if (!tbody) return;
        if (poinList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada poin aktif.</td></tr>';
            return;
        }

        tbody.innerHTML = poinList.map(poin => `
            <tr>
                <td>
                    <div data-integritas-poin-label="${poin.id}" style="cursor:pointer; font-weight:600;">${escapeHtml(poin.nama)}</div>
                    <input type="text" class="glass-input" data-integritas-poin-input="${poin.id}" value="${escapeAttr(poin.nama)}" style="display:none; margin-top:6px;">
                </td>
                <td>
                    <input type="number" class="glass-input" data-integritas-poin-urutan="${poin.id}" value="${escapeAttr(String(poin.urutan || 0))}" min="0" style="max-width:90px;">
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline" data-integritas-poin-edit="${poin.id}">Edit</button>
                    <button type="button" class="btn btn-sm btn-success" data-integritas-poin-save="${poin.id}" style="display:none;">Simpan</button>
                    <button type="button" class="btn btn-sm btn-outline" data-integritas-poin-delete="${poin.id}">Hapus</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-integritas-poin-label]').forEach(el => {
            el.onclick = () => startEditPoin(parseInt(el.getAttribute('data-integritas-poin-label'), 10));
        });
        tbody.querySelectorAll('[data-integritas-poin-edit]').forEach(el => {
            el.onclick = () => startEditPoin(parseInt(el.getAttribute('data-integritas-poin-edit'), 10));
        });
        tbody.querySelectorAll('[data-integritas-poin-save]').forEach(el => {
            el.onclick = () => editPoin(parseInt(el.getAttribute('data-integritas-poin-save'), 10));
        });
        tbody.querySelectorAll('[data-integritas-poin-delete]').forEach(el => {
            el.onclick = () => hapusPoin(parseInt(el.getAttribute('data-integritas-poin-delete'), 10));
        });
    }

    function startEditPoin(id) {
        const label = document.querySelector(`[data-integritas-poin-label="${id}"]`);
        const input = document.querySelector(`[data-integritas-poin-input="${id}"]`);
        const editBtn = document.querySelector(`[data-integritas-poin-edit="${id}"]`);
        const saveBtn = document.querySelector(`[data-integritas-poin-save="${id}"]`);

        if (label) label.style.display = 'none';
        if (input) {
            input.style.display = '';
            input.focus();
        }
        if (editBtn) editBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = '';
    }

    async function tambahPoin() {
        const namaInput = document.getElementById('integritas-poin-baru-nama');
        const urutanInput = document.getElementById('integritas-poin-baru-urutan');
        const nama = namaInput?.value.trim() || '';
        const urutan = parseInt(urutanInput?.value || '0', 10);

        if (!nama) {
            showMessage('Nama poin wajib diisi.', 'warning');
            return;
        }

        try {
            const response = await window.apiFetch('/evaluations/poin-integritas/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama, urutan })
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Gagal menambah poin');
            }

            if (namaInput) namaInput.value = '';
            if (urutanInput) urutanInput.value = '0';
            await loadKonfigPoin();
            showMessage('Poin berhasil ditambahkan.', 'success');
        } catch (err) {
            showMessage(err.message || 'Gagal menambah poin.', 'error');
        }
    }

    async function editPoin(id) {
        const input = document.querySelector(`[data-integritas-poin-input="${id}"]`);
        const urutanInput = document.querySelector(`[data-integritas-poin-urutan="${id}"]`);
        const nama = input?.value.trim() || '';
        const urutan = parseInt(urutanInput?.value || '0', 10);

        if (!nama) {
            showMessage('Nama poin wajib diisi.', 'warning');
            return;
        }

        try {
            const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama, urutan })
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Gagal memperbarui poin');
            }

            await loadKonfigPoin();
            showMessage('Poin berhasil diperbarui.', 'success');
        } catch (err) {
            showMessage(err.message || 'Gagal memperbarui poin.', 'error');
        }
    }

    async function hapusPoin(id) {
        if (!confirm('Hapus poin ini?')) return;

        try {
            const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Gagal menghapus poin');
            }

            await loadKonfigPoin();
            showMessage('Poin dihapus.', 'success');
        } catch (err) {
            showMessage(err.message || 'Gagal menghapus poin.', 'error');
        }
    }

    async function refreshGuruSummary() {
        const response = await window.apiFetch('/evaluations/integritas-guru/');
        const result = await response.json();
        allIntegritasGuru = result.data || [];
        integritasCount = buildIntegritasSummary(allIntegritasGuru);
    }

    function filterGuruBySearch() {
        const q = (document.getElementById('search-guru-integritas')?.value || '').toLowerCase();
        if (!q) return allGuru;
        return allGuru.filter(g => (g.name || g.username || '').toLowerCase().includes(q));
    }

    function closeDetailModal() {
        hideModal('integritas-guru-detail-modal');
        currentGuruId = null;
        currentGuruName = null;
    }

    function showModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('show');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function getScoreBadgeStyle(skala) {
        if (skala === 5) return 'background:var(--color-background-success); color:var(--color-text-success);';
        if (skala === 4) return 'background:var(--color-background-info); color:var(--color-text-info);';
        if (skala === 3) return 'background:var(--color-background-warning); color:var(--color-text-warning);';
        return 'background:var(--color-background-danger); color:var(--color-text-danger);';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return escapeHtml(text).replace(/"/g, '&quot;');
    }

    function showMessage(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type || 'success');
            return;
        }
        alert(message);
    }

    function refreshIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupTabSwitching);
        } else {
            setupTabSwitching();
        }
    }

    boot();
})();
