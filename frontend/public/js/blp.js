let currentUser = null;
let allStudents = [];
let blpIndicators = {};
let currentStudentNisn = null;
let currentBLPId = null;
let indicatorValues = {};
let currentDomain = 'akhlak';
let activeTahunAjaran = { nama: '', semester: '' };

const DOMAIN_ORDER = ['akhlak', 'kedisiplinan', 'ibadah', 'akademik', 'sosial', 'pengembangan_diri'];

document.addEventListener('DOMContentLoaded', async () => {
    updateTopbarDate();
    setupEventListeners();
    await loadUser();
    await loadAcademicYear();
    await loadBLPIndicators();
    await loadStudents();
});

async function apiJson(endpoint, options = {}) {
    const response = await window.apiFetch(endpoint, options);
    if (!response) throw new Error('Tidak ada response dari server');
    if (typeof response.json === 'function') {
        const data = await response.json();
        if (!response.ok || data.success === false) {
            throw new Error(data.message || data.error || 'Request gagal');
        }
        return data;
    }
    if (response.success === false) {
        throw new Error(response.message || response.error || 'Request gagal');
    }
    return response;
}

async function loadUser() {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
        try {
            currentUser = JSON.parse(cachedUser);
        } catch (err) {
            currentUser = null;
        }
    }

    try {
        const data = await apiJson('auth/status/');
        currentUser = data;
        localStorage.setItem('user', JSON.stringify(data));
    } catch (err) {
        if (!currentUser) {
            showMessage('Gagal memuat data user. Silakan login ulang.', 'error');
        }
    }

    const logoutBtn = document.getElementById('btn-logout-blp');
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            if (typeof window.logout === 'function') window.logout();
        };
    }
}

async function loadAcademicYear() {
    try {
        const data = await apiJson('core/tahun-ajaran/active/');
        const academicData = data.data || data;
        activeTahunAjaran = {
            nama: academicData.nama || academicData.tahun_ajaran || '',
            semester: academicData.semester || ''
        };
    } catch (err) {
        const year = new Date().getFullYear();
        activeTahunAjaran = {
            nama: `${year}/${year + 1}`,
            semester: new Date().getMonth() < 6 ? 'Genap' : 'Ganjil'
        };
    }

    const label = document.getElementById('blp-academic-label');
    if (label) label.textContent = `${activeTahunAjaran.semester} ${activeTahunAjaran.nama}`;
}

async function loadBLPIndicators() {
    const data = await apiJson('kesantrian/blp/indicators/');
    blpIndicators = data.domains || data.data || {};
    indicatorValues = buildDefaultIndicatorValues();
}

async function loadStudents() {
    const tbody = document.getElementById('blp-students-tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="blp-muted">Memuat data santri...</td></tr>';
    }

    const userRole = currentUser?.role || window.getUserRole?.() || localStorage.getItem('user_role');
    let students = [];

    try {
        if (['superadmin', 'admin'].includes(userRole)) {
            const data = await apiJson('students/?page_size=1000&aktif=true');
            students = normalizeStudents(data);
        } else if (userRole === 'guru') {
            const classes = await loadAssignedClasses();
            const uniqueStudents = new Map();
            for (const kelas of classes) {
                const data = await apiJson(`students/?kelas=${encodeURIComponent(kelas)}&page_size=1000&aktif=true`);
                normalizeStudents(data).forEach(student => {
                    if (student.nisn) uniqueStudents.set(student.nisn, student);
                });
            }
            students = Array.from(uniqueStudents.values());
        } else {
            students = [];
        }

        allStudents = students
            .filter(student => student && student.nisn)
            .sort((a, b) => (a.nama || a.name || '').localeCompare(b.nama || b.name || ''));
        renderClassFilter(allStudents);
        renderStudentsTable(allStudents);
    } catch (err) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="blp-muted">${escapeHtml(err.message || 'Gagal memuat santri')}</td></tr>`;
        }
    }
}

async function loadAssignedClasses() {
    const userId = currentUser?.user_id || currentUser?.id;
    if (!userId) return [];

    const data = await apiJson(`users/${userId}/assignments/`);
    const assignments = Array.isArray(data)
        ? data
        : (data.assignments || data.data || data.results || []);

    return [...new Set(
        assignments
            .filter(item => item && item.status === 'active' && item.kelas)
            .map(item => item.kelas)
    )];
}

function normalizeStudents(data) {
    return data.results || data.data || data.students || [];
}

function renderClassFilter(students) {
    const select = document.getElementById('blp-class-filter');
    if (!select) return;

    const selected = select.value;
    const classes = [...new Set(students.map(s => s.kelas).filter(Boolean))].sort();
    select.innerHTML = '<option value="">Semua kelas</option>' +
        classes.map(kelas => `<option value="${escapeAttr(kelas)}">${escapeHtml(kelas)}</option>`).join('');
    if (classes.includes(selected)) select.value = selected;
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('blp-students-tbody');
    if (!tbody) return;

    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="blp-muted">Tidak ada santri yang dapat ditampilkan.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr>
            <td><strong>${escapeHtml(student.nama || student.name || '-')}</strong></td>
            <td>${escapeHtml(student.nisn || '-')}</td>
            <td>${escapeHtml(student.kelas || '-')}</td>
            <td>
                <div class="blp-actions">
                    <button type="button" class="btn btn-sm btn-primary" data-blp-input="${escapeAttr(student.nisn)}">Input BLP</button>
                    <button type="button" class="btn btn-sm btn-secondary" data-blp-history="${escapeAttr(student.nisn)}">Riwayat</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-blp-input]').forEach(button => {
        button.onclick = function() {
            openBLPModal(this.dataset.blpInput);
        };
    });
    tbody.querySelectorAll('[data-blp-history]').forEach(button => {
        button.onclick = function() {
            openHistoryModal(this.dataset.blpHistory);
        };
    });
}

function filterStudents() {
    const query = (document.getElementById('blp-search')?.value || '').toLowerCase().trim();
    const kelas = document.getElementById('blp-class-filter')?.value || '';

    const filtered = allStudents.filter(student => {
        const haystack = `${student.nama || student.name || ''} ${student.nisn || ''}`.toLowerCase();
        const matchesSearch = !query || haystack.includes(query);
        const matchesClass = !kelas || student.kelas === kelas;
        return matchesSearch && matchesClass;
    });

    renderStudentsTable(filtered);
}

async function openBLPModal(nisn) {
    currentStudentNisn = nisn;
    currentBLPId = null;
    currentDomain = DOMAIN_ORDER.find(domain => blpIndicators[domain]) || Object.keys(blpIndicators)[0] || 'akhlak';
    indicatorValues = buildDefaultIndicatorValues();

    const student = allStudents.find(item => item.nisn === nisn) || {};
    const monday = getMondayOfCurrentWeek();
    const sunday = getSundayOfCurrentWeek(monday);

    document.getElementById('blp-modal-title').textContent = student.nama || student.name || 'Input BLP';
    document.getElementById('blp-modal-subtitle').textContent = `${nisn} - ${student.kelas || '-'}`;
    document.getElementById('blp-week-start').value = monday;
    document.getElementById('blp-week-end').value = sunday;
    document.getElementById('blp-tahun-ajaran').value = activeTahunAjaran.nama || '';
    document.getElementById('blp-semester').value = activeTahunAjaran.semester || '';

    resetBLPFormFields();

    try {
        const data = await apiJson(`kesantrian/blp/?siswa_nisn=${encodeURIComponent(nisn)}&week_start=${monday}`);
        const entries = data.data || data.results || [];
        if (entries.length) {
            loadBLPEntryToForm(entries[0]);
        }
    } catch (err) {
        console.warn('[BLP] Tidak bisa cek entry existing:', err);
    }

    renderIndicatorTabs();
    updateTotalScore();
    showModal('blp-modal');
}

function resetBLPFormFields() {
    document.getElementById('blp-bonus-points').value = 0;
    document.getElementById('blp-bonus-notes').value = '';
    document.getElementById('blp-catatan').value = '';
    document.getElementById('blp-tindak-lanjut').value = '';
}

function loadBLPEntryToForm(entry) {
    currentBLPId = entry.id;
    indicatorValues = mergeIndicatorValues(entry.indicator_values || {});
    document.getElementById('blp-week-start').value = entry.week_start || getMondayOfCurrentWeek();
    document.getElementById('blp-week-end').value = entry.week_end || getSundayOfCurrentWeek(entry.week_start);
    document.getElementById('blp-tahun-ajaran').value = entry.tahun_ajaran || activeTahunAjaran.nama || '';
    document.getElementById('blp-semester').value = entry.semester || activeTahunAjaran.semester || '';
    document.getElementById('blp-bonus-points').value = entry.bonus_points || 0;
    document.getElementById('blp-bonus-notes').value = entry.bonus_notes || '';
    document.getElementById('blp-catatan').value = entry.catatan || '';
    document.getElementById('blp-tindak-lanjut').value = entry.tindak_lanjut || '';
}

function getMondayOfCurrentWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return toDateInputValue(monday);
}

function getSundayOfCurrentWeek(startDate) {
    const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date(`${getMondayOfCurrentWeek()}T00:00:00`);
    base.setDate(base.getDate() + 6);
    return toDateInputValue(base);
}

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderIndicatorTabs() {
    const tabs = document.getElementById('blp-domain-tabs');
    const container = document.getElementById('blp-indicators-container');
    if (!tabs || !container) return;

    const domains = DOMAIN_ORDER.filter(domain => blpIndicators[domain])
        .concat(Object.keys(blpIndicators).filter(domain => !DOMAIN_ORDER.includes(domain)));

    tabs.innerHTML = domains.map(domain => {
        const meta = blpIndicators[domain] || {};
        return `<button type="button" class="blp-tab ${domain === currentDomain ? 'active' : ''}" data-domain="${escapeAttr(domain)}">${escapeHtml(meta.label || formatDomain(domain))}</button>`;
    }).join('');

    tabs.querySelectorAll('[data-domain]').forEach(button => {
        button.onclick = function() {
            currentDomain = this.dataset.domain;
            renderIndicatorTabs();
        };
    });

    const domainMeta = blpIndicators[currentDomain] || {};
    const indicators = domainMeta.indicators || [];
    const subtotal = getDomainSubtotal(currentDomain);

    container.innerHTML = `
        <div class="blp-card" style="box-shadow:none;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
                <div>
                    <strong>${escapeHtml(domainMeta.label || formatDomain(currentDomain))}</strong>
                    <div class="blp-muted">${indicators.length} indikator</div>
                </div>
                <span class="blp-score-pill" id="blp-domain-subtotal">${subtotal}</span>
            </div>
            ${indicators.map(item => {
                const value = Number(indicatorValues[currentDomain]?.[item.code] || 0);
                return `
                    <div class="blp-indicator-row">
                        <label for="blp-${escapeAttr(currentDomain)}-${escapeAttr(item.code)}">${escapeHtml(item.label)}</label>
                        <input type="range" min="0" max="5" value="${value}" class="blp-indicator-input"
                               id="blp-${escapeAttr(currentDomain)}-${escapeAttr(item.code)}"
                               data-domain="${escapeAttr(currentDomain)}" data-code="${escapeAttr(item.code)}">
                        <span class="blp-score-pill" data-score-display="${escapeAttr(currentDomain)}.${escapeAttr(item.code)}">${value}</span>
                    </div>`;
            }).join('')}
        </div>
    `;

    container.querySelectorAll('.blp-indicator-input').forEach(input => {
        input.oninput = function() {
            const domain = this.dataset.domain;
            const code = this.dataset.code;
            if (!indicatorValues[domain]) indicatorValues[domain] = {};
            indicatorValues[domain][code] = Number(this.value || 0);

            const display = container.querySelector(`[data-score-display="${cssEscape(`${domain}.${code}`)}"]`);
            if (display) display.textContent = this.value;
            const subtotalEl = document.getElementById('blp-domain-subtotal');
            if (subtotalEl) subtotalEl.textContent = getDomainSubtotal(domain);
            updateTotalScore();
        };
    });
}

function updateTotalScore() {
    const baseScore = Object.keys(indicatorValues).reduce((sum, domain) => {
        return sum + Object.values(indicatorValues[domain] || {}).reduce((inner, val) => inner + Number(val || 0), 0);
    }, 0);
    const bonusInput = document.getElementById('blp-bonus-points');
    const bonus = Math.max(0, Math.min(95, Number(bonusInput?.value || 0)));
    if (bonusInput && Number(bonusInput.value || 0) !== bonus) bonusInput.value = bonus;

    document.getElementById('blp-base-score').textContent = baseScore;
    document.getElementById('blp-bonus-preview').textContent = bonus;
    document.getElementById('blp-total-score').textContent = Math.min(390, baseScore + bonus);
}

async function saveBLP(submitStatus) {
    if (!currentStudentNisn) return;

    const payload = {
        siswa_nisn: currentStudentNisn,
        week_start: document.getElementById('blp-week-start').value,
        week_end: document.getElementById('blp-week-end').value,
        tahun_ajaran: document.getElementById('blp-tahun-ajaran').value,
        semester: document.getElementById('blp-semester').value,
        indicator_values: indicatorValues,
        bonus_points: Number(document.getElementById('blp-bonus-points').value || 0),
        bonus_notes: document.getElementById('blp-bonus-notes').value || '',
        catatan: document.getElementById('blp-catatan').value || '',
        tindak_lanjut: document.getElementById('blp-tindak-lanjut').value || '',
        status: submitStatus
    };

    const endpoint = currentBLPId
        ? `kesantrian/blp/${currentBLPId}/`
        : 'kesantrian/blp/';
    const method = currentBLPId ? 'PATCH' : 'POST';

    try {
        await apiJson(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        hideModal('blp-modal');
        showMessage('BLP berhasil disimpan.', 'success');
        await loadStudents();
    } catch (err) {
        showMessage(err.message || 'Gagal menyimpan BLP.', 'error');
    }
}

async function openHistoryModal(nisn) {
    const student = allStudents.find(item => item.nisn === nisn) || {};
    const tbody = document.getElementById('blp-history-tbody');
    document.getElementById('blp-history-subtitle').textContent = `${student.nama || student.name || nisn} - ${student.kelas || '-'}`;
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="blp-muted">Memuat riwayat...</td></tr>';
    showModal('blp-history-modal');

    try {
        const data = await apiJson(`kesantrian/blp/student/${encodeURIComponent(nisn)}/`);
        const entries = data.data || data.history || data.results || data.entries || [];
        if (!entries.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="blp-muted">Belum ada riwayat BLP.</td></tr>';
            return;
        }
        tbody.innerHTML = entries.map(entry => `
            <tr>
                <td>${escapeHtml(formatPeriod(entry.week_start, entry.week_end))}</td>
                <td><strong>${escapeHtml(String(entry.total_score ?? '-'))}</strong></td>
                <td>${escapeHtml(entry.predikat || '-')}</td>
                <td>${escapeHtml(entry.status || '-')}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="blp-muted">${escapeHtml(err.message || 'Gagal memuat riwayat')}</td></tr>`;
    }
}

function setupEventListeners() {
    const search = document.getElementById('blp-search');
    if (search) search.addEventListener('input', filterStudents);

    const classFilter = document.getElementById('blp-class-filter');
    if (classFilter) classFilter.addEventListener('change', filterStudents);

    const weekStart = document.getElementById('blp-week-start');
    if (weekStart) {
        weekStart.addEventListener('change', function() {
            document.getElementById('blp-week-end').value = getSundayOfCurrentWeek(this.value);
        });
    }

    const bonus = document.getElementById('blp-bonus-points');
    if (bonus) bonus.addEventListener('input', updateTotalScore);

    const closeBlp = document.getElementById('btn-close-blp-modal');
    if (closeBlp) closeBlp.onclick = () => hideModal('blp-modal');

    const closeHistory = document.getElementById('btn-close-history-modal');
    if (closeHistory) closeHistory.onclick = () => hideModal('blp-history-modal');

    const saveDraft = document.getElementById('btn-save-blp-draft');
    if (saveDraft) saveDraft.onclick = () => saveBLP('draft');

    const saveSubmit = document.getElementById('btn-save-blp-submit');
    if (saveSubmit) saveSubmit.onclick = () => saveBLP('submitted');
}

function buildDefaultIndicatorValues() {
    const values = {};
    Object.entries(blpIndicators).forEach(([domain, data]) => {
        values[domain] = {};
        (data.indicators || []).forEach(item => {
            values[domain][item.code] = 0;
        });
    });
    return values;
}

function mergeIndicatorValues(existing) {
    const defaults = buildDefaultIndicatorValues();
    Object.entries(existing || {}).forEach(([domain, values]) => {
        defaults[domain] = { ...(defaults[domain] || {}), ...(values || {}) };
    });
    return defaults;
}

function getDomainSubtotal(domain) {
    return Object.values(indicatorValues[domain] || {}).reduce((sum, val) => sum + Number(val || 0), 0);
}

function showModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function updateTopbarDate() {
    const el = document.getElementById('topbar-date');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatDomain(domain) {
    return String(domain || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatPeriod(start, end) {
    if (!start && !end) return '-';
    return `${start || '-'} s/d ${end || '-'}`;
}

function showMessage(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    alert(message);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
}

window.openBLPModal = openBLPModal;
window.openHistoryModal = openHistoryModal;
