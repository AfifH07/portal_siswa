/**
 * Case Management (Catatan & Bimbingan) JavaScript
 * Portal Kesantrian v2.3
 */

(function() {
    'use strict';

    // State
    let incidents = [];
    let currentIncident = null;
    let students = [];

    // ======================== FETCH STATE FLAGS (Anti-Double Load) ========================
    const fetchState = {
        incidents: false,
        summary: false,
        detail: false,
        students: false,
        statusUpdate: false
    };

    // Helper to check if any fetch is in progress
    function isFetching(key) {
        return fetchState[key] === true;
    }

    function setFetching(key, value) {
        fetchState[key] = value;
        console.log(`[CaseManagement] Fetch state: ${key} = ${value}`);
    }

    // Reset all fetch states (for error recovery)
    function resetAllFetchStates() {
        Object.keys(fetchState).forEach(key => {
            fetchState[key] = false;
        });
        console.log('[CaseManagement] All fetch states reset');
    }

    // Expose fetch state for debugging
    window.getCaseManagementState = function() {
        return {
            fetchState: { ...fetchState },
            incidentsCount: incidents.length,
            currentIncident: currentIncident ? currentIncident.id : null,
            studentsCount: students.length
        };
    };

    // Expose reset function for recovery
    window.resetCaseManagementFetch = resetAllFetchStates;

    // ======================== DEBUG TEST FUNCTION ========================
    // Call this from browser console: window.debugCaseManagement()
    window.debugCaseManagement = function() {
        console.log('========== CASE MANAGEMENT DEBUG ==========');

        // Check elements
        const elements = {
            'btn-add-incident': document.getElementById('btn-add-incident'),
            'incident-list': document.getElementById('incident-list'),
            'incident-modal': document.getElementById('incident-modal'),
            'thread-modal': document.getElementById('thread-modal'),
            'tab-catatan': document.getElementById('tab-catatan'),
            'incident-form': document.getElementById('incident-form')
        };

        console.log('📋 Element Check:');
        Object.entries(elements).forEach(([id, el]) => {
            const status = el ? '✅' : '❌';
            const display = el ? (el.style.display || getComputedStyle(el).display) : 'N/A';
            console.log(`  ${status} #${id}: ${el ? 'FOUND' : 'NOT FOUND'} (display: ${display})`);
        });

        // Check cards
        const cards = document.querySelectorAll('.incident-card');
        console.log(`\n📇 Incident Cards: ${cards.length} found`);
        cards.forEach((card, i) => {
            console.log(`  Card ${i + 1}: data-incident-id="${card.dataset.incidentId}"`);
        });

        // Check user role
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log(`\n👤 User: ${user.username || 'N/A'} (${user.role || 'unknown'})`);
        console.log(`  body[data-role]: "${document.body.dataset.role}"`);

        // Check functions
        console.log('\n🔧 Functions:');
        console.log(`  window.openIncidentModal: ${typeof window.openIncidentModal}`);
        console.log(`  window.openThreadModal: ${typeof window.openThreadModal}`);
        console.log(`  window.closeIncidentModal: ${typeof window.closeIncidentModal}`);
        console.log(`  window.closeThreadModal: ${typeof window.closeThreadModal}`);

        // Fetch state
        console.log('\n⏳ Fetch State:', fetchState);

        // Test click
        console.log('\n🧪 To test manually:');
        console.log('  - Click test: window.openIncidentModal()');
        console.log('  - Thread test: window.openThreadModal(1)');
        console.log('  - Reset states: window.resetCaseManagementFetch()');
        console.log('  - Test API: window.testIncidentAPI()');
        console.log('========================================');

        return {
            elements: Object.fromEntries(Object.entries(elements).map(([k, v]) => [k, !!v])),
            cardsCount: cards.length,
            user: user.role,
            fetchState: { ...fetchState }
        };
    };

    // Manual API Test Function
    window.testIncidentAPI = async function() {
        console.log('[TEST] ===== INCIDENT API TEST =====');

        // Test 1: Check apiFetch availability
        console.log('[TEST] 1. window.apiFetch exists:', typeof window.apiFetch);
        if (typeof window.apiFetch !== 'function') {
            console.error('[TEST] ❌ apiFetch not available! Check if apiFetch.js is loaded.');
            return;
        }

        // Test 2: Fetch incidents list
        try {
            console.log('[TEST] 2. Fetching incidents list...');
            const rawResp = await window.apiFetch('/kesantrian/incidents/');
            console.log('[TEST] Raw response:', rawResp);
            console.log('[TEST] Response ok:', rawResp?.ok, 'Status:', rawResp?.status);

            if (rawResp && rawResp.ok) {
                const data = await rawResp.json();
                console.log('[TEST] ✅ Incidents data:', data);
                console.log('[TEST] Count:', data.count || data.data?.length || 'unknown');

                // Get first incident ID for detail test
                const firstIncident = data.data?.[0] || data.results?.[0] || data[0];
                if (firstIncident) {
                    console.log('[TEST] First incident ID:', firstIncident.id);

                    // Test 3: Fetch single incident detail
                    console.log('[TEST] 3. Fetching detail for ID:', firstIncident.id);
                    const detailResp = await window.apiFetch(`/kesantrian/incidents/${firstIncident.id}/`);
                    if (detailResp && detailResp.ok) {
                        const detailData = await detailResp.json();
                        console.log('[TEST] ✅ Detail data:', detailData);
                    } else {
                        console.error('[TEST] ❌ Detail fetch failed:', detailResp?.status);
                    }
                }
            } else {
                console.error('[TEST] ❌ List fetch failed:', rawResp?.status);
            }
        } catch (err) {
            console.error('[TEST] ❌ API Error:', err);
        }

        console.log('[TEST] ===== TEST COMPLETE =====');
    };

    // Manual Form Submit Test
    window.testFormSubmit = async function(testData = null) {
        console.log('[TEST] ===== FORM SUBMIT TEST =====');

        // Use test data or sample data
        const data = testData || {
            siswa: '0012345678',  // Test NISN
            tanggal_kejadian: new Date().toISOString().split('T')[0],
            judul: 'Test Catatan dari Console',
            kategori: 'lainnya',
            tingkat: 'ringan',
            deskripsi: 'Ini adalah test catatan yang dibuat dari console untuk debugging.'
        };

        console.log('[TEST] Form data:', data);

        try {
            console.log('[TEST] Sending POST to /kesantrian/incidents/...');
            const rawResp = await window.apiFetch('/kesantrian/incidents/', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            console.log('[TEST] Response status:', rawResp?.status, rawResp?.ok);

            if (rawResp && rawResp.ok) {
                const result = await rawResp.json();
                console.log('[TEST] ✅ SUCCESS! Created incident:', result);
                return result;
            } else {
                const errorBody = await rawResp?.text().catch(() => 'Could not read body');
                console.error('[TEST] ❌ FAILED! Status:', rawResp?.status);
                console.error('[TEST] Error body:', errorBody);
            }
        } catch (err) {
            console.error('[TEST] ❌ Exception:', err);
        }

        console.log('[TEST] ===== TEST COMPLETE =====');
    };

    // Status icons
    const STATUS_ICONS = {
        'open': '🔴',
        'in_discussion': '🟡',
        'dalam_pembahasan': '🟡',
        'resolved': '🟢',
        'closed': '⚫'
    };

    const STATUS_LABELS = {
        'open': 'Open',
        'in_discussion': 'Dalam Penanganan',
        'dalam_pembahasan': 'Dalam Penanganan',
        'resolved': 'Selesai',
        'closed': 'Ditutup'
    };

    const KATEGORI_LABELS = {
        'perilaku': 'Perilaku/Akhlak',
        'kedisiplinan': 'Kedisiplinan',
        'akademik': 'Akademik',
        'sosial': 'Sosial',
        'kesehatan': 'Kesehatan',
        'keluarga': 'Keluarga',
        'lainnya': 'Lainnya'
    };

    // PERUBAHAN 5: Type labels untuk pembinaan
    const TYPE_LABELS = {
        'diskusi': 'Diskusi',
        'pembinaan': 'Pembinaan',
        // Legacy types (backward compatibility)
        'observation': 'Observasi',
        'suggestion': 'Saran',
        'decision': 'Keputusan',
        'follow_up': 'Follow Up',
        'note': 'Catatan'
    };

    // ======================== TAB SWITCHING ========================
    window.switchTab = function(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) {
            activeContent.style.display = 'block';
            activeContent.classList.add('active');
        }

        // Load incidents when switching to catatan tab
        if (tabName === 'catatan') {
            loadIncidentSummary();
            loadIncidents();
        }
    };

    // ======================== LOAD SUMMARY ========================
    async function loadIncidentSummary() {
        // Anti-double load guard
        if (isFetching('summary')) {
            console.log('[CaseManagement] Summary already loading, skipping...');
            return;
        }
        setFetching('summary', true);

        try {
            // Build URL based on user role
            let url = '/kesantrian/incidents/summary/';
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const adminRoles = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'];

            console.log('[CaseManagement] ===== SUMMARY FETCH =====');
            console.log('[CaseManagement] User role:', user.role);

            // ADMIN: No filter
            if (adminRoles.includes(user.role)) {
                console.log('[CaseManagement] Admin - fetching ALL summary');
            }
            // WALISANTRI: Filter by selected child
            else if (user.role === 'walisantri') {
                const selectedNisn = localStorage.getItem('selected_child_nisn');
                console.log('[CaseManagement] Walisantri - selected NISN:', selectedNisn);
                if (selectedNisn) {
                    url += `?siswa=${selectedNisn}`;
                } else {
                    console.warn('[CaseManagement] No child selected, skipping summary');
                    return;
                }
            }

            console.log('[CaseManagement] Fetching summary:', url);
            const rawResponse = await window.apiFetch(url);

            // CRITICAL: apiFetch returns raw Response object, need to parse JSON!
            if (!rawResponse || !rawResponse.ok) {
                console.error('[CaseManagement] Summary API failed:', rawResponse?.status);
                return;
            }

            const response = await rawResponse.json();

            // Debug: Log parsed summary response
            console.log('[CaseManagement] Summary Parsed Response:', response);
            console.log('[CaseManagement] Summary Response keys:', response ? Object.keys(response) : 'null');

            if (response) {
                // Handle nested response.summary or flat response
                const summary = response.summary || response;

                console.log('[CaseManagement] Parsed summary:', summary);

                const openCountEl = document.getElementById('incident-open-count');
                const discussionCountEl = document.getElementById('incident-discussion-count');
                const resolvedCountEl = document.getElementById('incident-resolved-count');

                if (openCountEl) openCountEl.textContent = summary.total_open || summary.open || 0;
                if (discussionCountEl) discussionCountEl.textContent = summary.total_in_discussion || summary.in_discussion || 0;
                if (resolvedCountEl) resolvedCountEl.textContent = summary.total_resolved || summary.resolved_this_month || 0;

                // Show latest suggestion from BK if available
                const suggestionEl = document.getElementById('incident-suggestion-count');
                const latestSuggestion = summary.latest_bk_suggestion || summary.latest_suggestion;
                if (suggestionEl) {
                    if (latestSuggestion) {
                        suggestionEl.textContent = latestSuggestion.substring(0, 50) + '...';
                    } else {
                        suggestionEl.textContent = 'Tidak ada';
                    }
                }

                // Update badge
                const badge = document.getElementById('incident-badge');
                const openCount = summary.total_open || summary.open || 0;
                if (badge) {
                    if (openCount > 0) {
                        badge.textContent = openCount;
                        badge.style.display = 'inline';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error('[CaseManagement] Error loading incident summary:', err);
        } finally {
            setFetching('summary', false);
        }
    }

    // ======================== LOAD INCIDENTS ========================
    async function loadIncidents() {
        // Anti-double load guard
        if (isFetching('incidents')) {
            console.log('[CaseManagement] Incidents already loading, skipping...');
            return;
        }
        setFetching('incidents', true);

        const listEl = document.getElementById('incident-list');
        if (!listEl) {
            console.warn('[CaseManagement] incident-list element not found');
            setFetching('incidents', false);
            return;
        }
        listEl.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Memuat catatan...</p></div>';

        try {
            // Build query params from filters
            const params = new URLSearchParams();
            const statusFilter = document.getElementById('incident-filter-status')?.value;
            const kategoriFilter = document.getElementById('incident-filter-kategori')?.value;
            const tingkatFilter = document.getElementById('incident-filter-tingkat')?.value;

            if (statusFilter) params.append('status', statusFilter);
            if (kategoriFilter) params.append('kategori', kategoriFilter);
            if (tingkatFilter) params.append('tingkat', tingkatFilter);

            // Get user info
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const adminRoles = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'];

            console.log('[CaseManagement] ===== FETCH DEBUG =====');
            console.log('[CaseManagement] User:', user);
            console.log('[CaseManagement] User role:', user.role);

            // ADMIN/SUPERADMIN: Fetch ALL incidents (no siswa filter)
            if (adminRoles.includes(user.role)) {
                console.log('[CaseManagement] Admin mode - fetching ALL incidents');
                // No siswa filter for admin
            }
            // WALISANTRI: Filter by selected child NISN
            else if (user.role === 'walisantri') {
                const selectedNisn = localStorage.getItem('selected_child_nisn');
                console.log('[CaseManagement] Walisantri mode - selected NISN:', selectedNisn);

                if (selectedNisn) {
                    // Use siswa parameter (backend accepts both 'siswa' and 'siswa_nisn')
                    params.append('siswa', selectedNisn);
                } else {
                    console.warn('[CaseManagement] No child selected for walisantri');
                    listEl.innerHTML = `
                        <div class="incident-empty">
                            <div class="incident-empty-icon">👶</div>
                            <h3>Pilih Anak Terlebih Dahulu</h3>
                            <p>Silakan pilih anak dari dropdown di atas untuk melihat catatan.</p>
                        </div>
                    `;
                    return;
                }
            }

            const url = '/kesantrian/incidents/' + (params.toString() ? '?' + params.toString() : '');
            console.log('[CaseManagement] Fetching URL:', url);
            console.log('[CaseManagement] Query params:', params.toString());

            const rawResponse = await window.apiFetch(url);

            // CRITICAL: apiFetch returns raw Response object, need to parse JSON!
            if (!rawResponse || !rawResponse.ok) {
                console.error('[CaseManagement] API request failed:', rawResponse?.status, rawResponse?.statusText);
                throw new Error(`HTTP ${rawResponse?.status}: ${rawResponse?.statusText}`);
            }

            const response = await rawResponse.json();

            // Debug: Log parsed API response structure
            console.log('[CaseManagement] ===== API RESPONSE DEBUG =====');
            console.log('[CaseManagement] Parsed response:', response);
            console.log('[CaseManagement] Response type:', typeof response);
            console.log('[CaseManagement] Response keys:', response ? Object.keys(response) : 'null');

            // Handle different API response formats:
            // Format 1: { success: true, data: [...] }
            // Format 2: { success: true, results: [...] }
            // Format 3: { count: N, data: [...] }
            // Format 4: Direct array [...]
            let extractedData = [];

            if (Array.isArray(response)) {
                extractedData = response;
                console.log('[CaseManagement] Response is direct array');
            } else if (response && typeof response === 'object') {
                if (response.data && Array.isArray(response.data)) {
                    extractedData = response.data;
                    console.log('[CaseManagement] Extracted from response.data');
                } else if (response.results && Array.isArray(response.results)) {
                    extractedData = response.results;
                    console.log('[CaseManagement] Extracted from response.results');
                } else {
                    console.warn('[CaseManagement] Unknown response format, using empty array');
                    console.log('[CaseManagement] response.data:', response.data);
                    console.log('[CaseManagement] response.results:', response.results);
                }
            }

            incidents = extractedData;

            console.log('[CaseManagement] ===== FINAL DATA =====');
            console.log('[CaseManagement] Incidents count:', incidents.length);
            console.log('[CaseManagement] First incident:', incidents[0]);
            if (incidents.length > 0) {
                console.log('[CaseManagement] First incident keys:', Object.keys(incidents[0]));
            }

            renderIncidents();
        } catch (err) {
            console.error('[CaseManagement] Error loading incidents:', err);
            console.error('[CaseManagement] Error stack:', err.stack);
            listEl.innerHTML = '<div class="incident-empty"><div class="incident-empty-icon">❌</div><h3>Gagal memuat data</h3><p>Silakan coba lagi nanti.</p><p class="text-muted" style="font-size:11px;margin-top:8px;">Error: ' + escapeHtml(err.message || 'Unknown') + '</p></div>';
        } finally {
            setFetching('incidents', false);
        }
    }

    window.filterIncidents = function() {
        loadIncidents();
    };

    // ======================== RENDER INCIDENTS ========================
    function renderIncidents() {
        const listEl = document.getElementById('incident-list');
        if (!listEl) {
            console.error('[CaseManagement] incident-list element not found during render');
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isWalisantri = user.role === 'walisantri';

        // Critical Debug: Log incidents before rendering
        console.log('[CaseManagement] ===== RENDER DEBUG =====');
        console.log('[CaseManagement] Incidents to render:', incidents);
        console.log('[CaseManagement] Incidents count:', incidents ? incidents.length : 'null/undefined');
        console.log('[CaseManagement] Incidents type:', typeof incidents);
        console.log('[CaseManagement] Is Array:', Array.isArray(incidents));

        // Ensure incidents is an array
        if (!Array.isArray(incidents)) {
            console.warn('[CaseManagement] incidents is not an array, attempting to extract...');
            // Try to extract from common response formats
            if (incidents && typeof incidents === 'object') {
                if (incidents.data) incidents = incidents.data;
                else if (incidents.results) incidents = incidents.results;
                else incidents = [];
            } else {
                incidents = [];
            }
            console.log('[CaseManagement] After extraction:', incidents.length);
        }

        if (!incidents || incidents.length === 0) {
            console.log('[CaseManagement] No incidents to render, showing empty state');
            // Different message for walisantri
            if (isWalisantri) {
                listEl.innerHTML = `
                    <div class="incident-empty">
                        <div class="incident-empty-icon">✅</div>
                        <h3>Tidak Ada Catatan Kejadian</h3>
                        <p>Alhamdulillah, ananda tidak memiliki catatan kejadian yang perlu ditindaklanjuti.</p>
                        <p class="text-muted" style="margin-top: 8px; font-size: 13px;">Jika ada catatan baru, akan ditampilkan di sini.</p>
                    </div>
                `;
            } else {
                listEl.innerHTML = `
                    <div class="incident-empty">
                        <div class="incident-empty-icon">📝</div>
                        <h3>Belum Ada Catatan</h3>
                        <p>Tidak ada catatan kejadian yang ditemukan.</p>
                    </div>
                `;
            }
            return;
        }

        console.log('[CaseManagement] ===== RENDER LOOP START =====');
        const renderedCards = incidents.map((incident, index) => {
            console.log('[CaseManagement] Rendering incident #' + index + ':', incident.id, incident.judul);
            return renderIncidentCard(incident, index === incidents.length - 1);
        });
        console.log('[CaseManagement] Rendered cards count:', renderedCards.length);
        listEl.innerHTML = renderedCards.join('');
        console.log('[CaseManagement] ===== RENDER LOOP END =====');
    }

    function renderIncidentCard(incident, isLast) {
        const statusIcon = STATUS_ICONS[incident.status] || '⚪';
        const kategoriLabel = KATEGORI_LABELS[incident.kategori] || incident.kategori;
        const tingkatClass = `badge-tingkat-${incident.tingkat}`;
        const tanggal = formatDate(incident.tanggal_kejadian);
        const preview = incident.deskripsi ? incident.deskripsi.substring(0, 150) + (incident.deskripsi.length > 150 ? '...' : '') : '';
        const commentCount = incident.comments_count || incident.comment_count || 0;

        // Footer message based on comments and status
        let footerContent = '';
        if (incident.keputusan_final) {
            footerContent = `
                <span class="incident-comments-count">💬 ${commentCount} tanggapan</span>
                <span class="incident-decision">✅ Sudah ada keputusan</span>
            `;
        } else if (commentCount > 0) {
            footerContent = `<span class="incident-comments-count">💬 ${commentCount} tanggapan</span>`;
        } else {
            // No comments yet - show waiting message
            footerContent = `<span class="incident-waiting">⏳ Menunggu evaluasi dari ustadz pengampu</span>`;
        }

        return `
            <div class="incident-card" data-incident-id="${incident.id}" onclick="window.openThreadModal(${incident.id})" role="button" tabindex="0" aria-label="Lihat detail: ${escapeHtml(incident.judul)}">
                <div class="incident-timeline">
                    <div class="incident-status-dot status-${incident.status}">${statusIcon}</div>
                    ${!isLast ? '<div class="incident-timeline-line"></div>' : ''}
                </div>
                <div class="incident-body">
                    <div class="incident-header">
                        <h4 class="incident-title">${escapeHtml(incident.judul)}</h4>
                        <div class="incident-badges">
                            <span class="incident-badge badge-kategori">${kategoriLabel}</span>
                            <span class="incident-badge ${tingkatClass}">${incident.tingkat}</span>
                        </div>
                    </div>
                    <div class="incident-meta">
                        <span class="incident-meta-item">👤 ${escapeHtml(incident.siswa_nama || incident.siswa?.nama || '-')}</span>
                        <span class="incident-meta-item">📅 ${tanggal}</span>
                        <span class="incident-meta-item">📝 ${escapeHtml(incident.pelapor_role_display || incident.pelapor_role || '-')}</span>
                    </div>
                    ${preview ? `<div class="incident-preview">${escapeHtml(preview)}</div>` : ''}
                    <div class="incident-footer">
                        ${footerContent}
                    </div>
                </div>
            </div>
        `;
    }

    // ======================== INCIDENT MODAL - FAIL-SAFE v2.4 ========================
    window.openIncidentModal = async function(incidentId = null) {
        console.log('[CaseManagement] 🔄 ===== openIncidentModal START =====');
        console.log('[CaseManagement] incidentId:', incidentId);

        try {
            // ===== STEP 1: Get modal element =====
            const modal = document.getElementById('incident-modal');
            if (!modal) {
                throw new Error('CRITICAL: Elemen #incident-modal tidak ditemukan di HTML!');
            }
            console.log('[CaseManagement] ✅ Modal element found');

            // ===== STEP 2: FORCE SHOW MODAL IMMEDIATELY =====
            // Apply maximum z-index and visibility
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            modal.style.zIndex = '99999';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.classList.add('show');
            console.log('[CaseManagement] ✅ Modal FORCE displayed with z-index 99999');

            // ===== STEP 3: Get form elements (with fallbacks) =====
            const form = document.getElementById('incident-form');
            const title = document.getElementById('incident-modal-title');
            const siswaSelect = document.getElementById('incident-siswa');
            const tanggalInput = document.getElementById('incident-tanggal');
            const incidentIdInput = document.getElementById('incident-id');

            console.log('[CaseManagement] Form elements:', {
                form: !!form,
                title: !!title,
                siswaSelect: !!siswaSelect,
                tanggalInput: !!tanggalInput
            });

            // ===== STEP 4: Reset form if exists =====
            if (form) {
                form.reset();
                console.log('[CaseManagement] ✅ Form reset');
            }
            if (incidentIdInput) {
                incidentIdInput.value = '';
            }

            // ===== STEP 5: Load students for dropdown =====
            if (siswaSelect) {
                if (students.length === 0) {
                    console.log('[CaseManagement] Loading students...');
                    siswaSelect.innerHTML = '<option value="">⏳ Memuat daftar siswa...</option>';
                    try {
                        await loadStudents();
                    } catch (e) {
                        console.error('[CaseManagement] Failed to load students:', e);
                    }
                }
                // Populate dropdown
                siswaSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
                    students.map(s => `<option value="${s.nisn}">${s.nama} (${s.kelas || '-'})</option>`).join('');
                console.log('[CaseManagement] ✅ Dropdown populated:', students.length, 'students');
            }

            // ===== STEP 6: Set title and default values =====
            if (incidentId) {
                // EDIT MODE
                if (title) title.textContent = 'Edit Evaluasi & Pelanggaran';
                console.log('[CaseManagement] Loading existing incident for edit...');
                try {
                    const rawResp = await window.apiFetch(`/kesantrian/incidents/${incidentId}/`);
                    if (rawResp && rawResp.ok) {
                        const respData = await rawResp.json();
                        const incident = respData.data || respData;
                        if (incidentIdInput) incidentIdInput.value = incident.id;
                        if (siswaSelect) siswaSelect.value = incident.siswa;
                        if (tanggalInput) tanggalInput.value = incident.tanggal_kejadian;
                        const judulInput = document.getElementById('incident-judul');
                        const kategoriSelect = document.getElementById('incident-kategori');
                        const tingkatSelect = document.getElementById('incident-tingkat');
                        const deskripsiText = document.getElementById('incident-deskripsi');
                        if (judulInput) judulInput.value = incident.judul || '';
                        if (kategoriSelect) kategoriSelect.value = incident.kategori || '';
                        if (tingkatSelect) tingkatSelect.value = incident.tingkat || '';
                        if (deskripsiText) deskripsiText.value = incident.deskripsi || '';
                        console.log('[CaseManagement] ✅ Edit form populated');
                    }
                } catch (err) {
                    console.error('[CaseManagement] Error loading incident for edit:', err);
                    alert('⚠️ Gagal memuat data untuk edit. Form akan direset.');
                }
            } else {
                // ADD MODE
                if (title) title.textContent = 'Input Evaluasi & Pelanggaran Baru';
                if (tanggalInput) tanggalInput.value = new Date().toISOString().split('T')[0];
                console.log('[CaseManagement] ✅ Add mode - date set to today');
            }

            console.log('[CaseManagement] 🔄 ===== openIncidentModal COMPLETE =====');

        } catch (err) {
            console.error('[CaseManagement] ❌ CRITICAL ERROR in openIncidentModal:', err);
            console.error('[CaseManagement] Stack:', err.stack);
            alert('❌ Error: ' + err.message + '\n\nSilakan refresh halaman.');
        }
    };

    window.closeIncidentModal = function() {
        console.log('[CaseManagement] Closing incident modal...');
        try {
            const modal = document.getElementById('incident-modal');
            if (modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
                console.log('[CaseManagement] ✅ Modal closed');
            }
        } catch (e) {
            console.error('[CaseManagement] Error closing modal:', e);
        }
    };

    // ======================== SAVE ENFORCER - DIRECT FORM HANDLER ========================
    // PERUBAHAN 1: Menggunakan FormData untuk mendukung upload foto
    window.handleIncidentSubmit = async function(e) {
        console.log('[CaseManagement] 🔄 ===== handleIncidentSubmit TRIGGERED =====');

        // CRITICAL: Prevent page reload
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const form = document.getElementById('incident-form');
        const submitBtn = document.getElementById('incident-submit-btn') || form?.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '💾 Simpan Catatan';

        try {
            // ===== STEP 1: Show loading state =====
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Menyimpan...';
            }
            console.log('[CaseManagement] Loading state shown');

            // ===== STEP 2: Collect data - Build FormData for file upload =====
            // PERUBAHAN 1: Gunakan FormData bukan JSON.stringify
            const formData = new FormData();

            // Get values from form elements
            const siswa_nisn = document.getElementById('incident-siswa')?.value || '';
            const tanggal_kejadian = document.getElementById('incident-tanggal')?.value || '';
            const judul = (document.getElementById('incident-judul')?.value || '').trim();
            const kategori = document.getElementById('incident-kategori')?.value || '';
            const tingkat = document.getElementById('incident-tingkat')?.value || '';
            const deskripsi = (document.getElementById('incident-deskripsi')?.value || '').trim();
            const visibility = document.getElementById('incident-visibility')?.value || 'internal';
            const incidentId = document.getElementById('incident-id')?.value || '';

            // Append to FormData
            formData.append('siswa_nisn', siswa_nisn);
            formData.append('tanggal_kejadian', tanggal_kejadian);
            formData.append('judul', judul);
            formData.append('kategori', kategori);
            formData.append('tingkat', tingkat);
            formData.append('deskripsi', deskripsi);
            formData.append('visibility', visibility);

            // PERUBAHAN 1: Append foto if exists
            const fotoInput = document.getElementById('incident-foto');
            if (fotoInput && fotoInput.files && fotoInput.files[0]) {
                formData.append('foto', fotoInput.files[0]);
                console.log('[CaseManagement] 📷 Foto attached:', fotoInput.files[0].name);
            }

            // Debug: Log all FormData entries
            console.log('[CaseManagement] 📋 FormData entries:');
            for (let [key, value] of formData.entries()) {
                if (value instanceof File) {
                    console.log(`  ${key}: [File] ${value.name} (${value.size} bytes)`);
                } else {
                    console.log(`  ${key}: "${value}"`);
                }
            }

            console.log('[CaseManagement] Edit mode:', !!incidentId, 'ID:', incidentId);

            // ===== STEP 3: Validation =====
            const errors = [];
            if (!siswa_nisn) errors.push('❌ Siswa/Santri belum dipilih!');
            if (!tanggal_kejadian) errors.push('❌ Tanggal kejadian belum diisi!');
            if (!judul) errors.push('❌ Judul catatan belum diisi!');
            if (!kategori) errors.push('❌ Kategori belum dipilih!');
            if (!tingkat) errors.push('❌ Tingkat belum dipilih!');
            if (!deskripsi) errors.push('❌ Deskripsi belum diisi!');

            if (errors.length > 0) {
                console.error('[CaseManagement] Validation failed:', errors);
                alert('VALIDASI GAGAL:\n\n' + errors.join('\n'));
                return false;
            }
            console.log('[CaseManagement] ✅ Validation passed');

            // ===== STEP 4: Check apiFetch =====
            if (typeof window.apiFetch !== 'function') {
                throw new Error('CRITICAL: window.apiFetch tidak tersedia! Pastikan apiFetch.js dimuat.');
            }

            // ===== STEP 5: Send to API =====
            const isEdit = !!incidentId;
            const apiUrl = isEdit ? `/kesantrian/incidents/${incidentId}/` : '/kesantrian/incidents/';
            const method = isEdit ? 'PUT' : 'POST';

            console.log(`[CaseManagement] 🌐 ${method} ${apiUrl}`);

            // PERUBAHAN 1: Kirim FormData langsung (apiFetch auto-detect)
            // JANGAN set Content-Type manual - browser akan set multipart/form-data otomatis
            const response = await window.apiFetch(apiUrl, {
                method: method,
                body: formData  // FormData, bukan JSON.stringify
            });

            console.log('[CaseManagement] 📡 Response received:', response);
            console.log('[CaseManagement] 📡 Status:', response?.status, response?.ok);

            // ===== STEP 6: Handle response =====
            if (!response) {
                throw new Error('Tidak ada response dari server. Cek koneksi internet.');
            }

            if (!response.ok) {
                let errorDetail = `Server error: HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error('[CaseManagement] ❌ Server error response:', errorData);

                    // Parse error details
                    if (errorData.detail) {
                        errorDetail = errorData.detail;
                    } else if (errorData.message) {
                        errorDetail = errorData.message;
                    } else if (typeof errorData === 'object') {
                        const errorMessages = [];
                        for (const [field, msgs] of Object.entries(errorData)) {
                            if (Array.isArray(msgs)) {
                                errorMessages.push(`${field}: ${msgs.join(', ')}`);
                            } else {
                                errorMessages.push(`${field}: ${msgs}`);
                            }
                        }
                        errorDetail = errorMessages.join('\n');
                    }
                } catch (parseErr) {
                    console.error('[CaseManagement] Could not parse error:', parseErr);
                }
                throw new Error(errorDetail);
            }

            // ===== STEP 7: SUCCESS! =====
            const responseData = await response.json();
            console.log('[CaseManagement] ✅ SUCCESS! Data saved:', responseData);

            // Show success message
            alert('✅ ' + (isEdit ? 'Data berhasil diperbarui!' : 'Evaluasi baru berhasil disimpan!'));

            // Reset form
            if (form) form.reset();

            // Close modal
            window.closeIncidentModal();

            // Refresh UI
            console.log('[CaseManagement] 🔄 Refreshing incident list...');
            try {
                if (typeof loadIncidentSummary === 'function') await loadIncidentSummary();
                if (typeof loadIncidents === 'function') await loadIncidents();
                console.log('[CaseManagement] ✅ UI refreshed');
            } catch (refreshErr) {
                console.error('[CaseManagement] Refresh failed, reloading page...', refreshErr);
                window.location.reload();
            }

            console.log('[CaseManagement] 🔄 ===== handleIncidentSubmit COMPLETE =====');
            return false; // Prevent form default action

        } catch (err) {
            console.error('[CaseManagement] ❌ SAVE ERROR:', err);
            console.error('[CaseManagement] Stack:', err.stack);
            alert('❌ GAGAL MENYIMPAN!\n\n' + err.message + '\n\nCek Console untuk detail.');
            return false;
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    };

    async function loadStudents() {
        // Anti-double load guard
        if (isFetching('students')) {
            console.log('[CaseManagement] Students already loading, skipping...');
            return;
        }
        setFetching('students', true);

        try {
            const rawResp = await window.apiFetch('/students/');
            if (!rawResp || !rawResp.ok) {
                console.error('[CaseManagement] Failed to load students:', rawResp?.status);
                students = [];
                return;
            }
            const response = await rawResp.json();
            students = response.results || response.data || response || [];
            console.log('[CaseManagement] Loaded students count:', students.length);
        } catch (err) {
            console.error('Error loading students:', err);
            students = [];
        } finally {
            setFetching('students', false);
        }
    }

    // ======================== THREAD MODAL (INCIDENT DETAIL) - BRUTE FORCE v2.4 ========================
    window.openThreadModal = async function(incidentId) {
        console.log('[CaseManagement] 🔍 openThreadModal called with ID:', incidentId);

        // Validate input
        if (!incidentId) {
            console.error('[CaseManagement] ❌ No incident ID provided!');
            showToast('Error: ID insiden tidak valid', 'error');
            return;
        }

        // Force reset fetch state (prevent stuck state)
        setFetching('detail', false);

        // BRUTE FORCE: Get elements directly
        const modal = document.querySelector('#thread-modal');
        const detailEl = document.querySelector('#thread-incident-detail');
        const commentsEl = document.querySelector('#thread-comments');
        const countEl = document.querySelector('#thread-comment-count');
        const resolveSection = document.querySelector('#thread-resolve-action');
        const addCommentSection = document.querySelector('#thread-add-comment');
        const commentIncidentId = document.querySelector('#comment-incident-id');
        const commentParentId = document.querySelector('#comment-parent-id');

        console.log('[CaseManagement] 📋 BRUTE FORCE element check:', {
            modal: !!modal,
            detailEl: !!detailEl,
            commentsEl: !!commentsEl,
            countEl: !!countEl
        });

        // FALLBACK: Create modal if not found (emergency)
        if (!modal) {
            console.error('[CaseManagement] ❌ CRITICAL: thread-modal not found!');
            alert('Error: Modal tidak ditemukan. Silakan refresh halaman.');
            return;
        }

        // INJECT loading state immediately
        if (detailEl) {
            detailEl.innerHTML = `
                <div class="loading-state" style="text-align:center;padding:40px;">
                    <div class="loading-spinner" style="width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#10b981;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
                    <p style="margin-top:16px;color:#6b7280;">Memuat detail insiden #${incidentId}...</p>
                </div>
            `;
        }
        if (commentsEl) {
            commentsEl.innerHTML = '<p class="text-muted" style="color:#9ca3af;text-align:center;">Memuat komentar...</p>';
        }

        // SHOW MODAL NOW
        modal.classList.add('show');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        console.log('[CaseManagement] ✅ Modal FORCED visible');

        // Set timeout protection (15 seconds max)
        const timeoutId = setTimeout(() => {
            console.error('[CaseManagement] ⏱️ TIMEOUT: Fetch took too long');
            if (detailEl) {
                detailEl.innerHTML = `
                    <div style="text-align:center;padding:40px;background:#fef2f2;border-radius:12px;">
                        <div style="font-size:48px;margin-bottom:16px;">⏱️</div>
                        <h3 style="color:#dc2626;margin:0 0 8px;">Request Timeout</h3>
                        <p style="color:#7f1d1d;margin:0 0 16px;">Server tidak merespon dalam 15 detik</p>
                        <button onclick="window.openThreadModal(${incidentId})" style="background:#10b981;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">
                            🔄 Coba Lagi
                        </button>
                    </div>
                `;
            }
            setFetching('detail', false);
        }, 15000);

        try {
            setFetching('detail', true);

            // Fetch incident detail from API
            const apiUrl = `/kesantrian/incidents/${incidentId}/`;
            console.log('[CaseManagement] 🌐 Fetching:', apiUrl);

            // Check if apiFetch exists
            if (typeof window.apiFetch !== 'function') {
                throw new Error('apiFetch tidak tersedia. Pastikan apiFetch.js dimuat.');
            }

            const rawResponse = await window.apiFetch(apiUrl);
            clearTimeout(timeoutId); // Cancel timeout

            console.log('[CaseManagement] 📡 Raw response:', rawResponse);
            console.log('[CaseManagement] 📡 Response type:', typeof rawResponse);

            // CRITICAL: Check response
            if (!rawResponse) {
                throw new Error('Tidak ada response dari server');
            }

            // Check if it's a Response object
            if (typeof rawResponse.json !== 'function') {
                console.error('[CaseManagement] ❌ Response bukan Response object:', rawResponse);
                throw new Error('Response format tidak valid');
            }

            console.log('[CaseManagement] 📡 Status:', rawResponse.status, rawResponse.ok);

            if (!rawResponse.ok) {
                const errorText = await rawResponse.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${rawResponse.status}: ${errorText}`);
            }

            const response = await rawResponse.json();
            console.log('[CaseManagement] 📦 Parsed JSON:', response);

            // Handle nested response.data or flat response
            const incident = response.data || response;
            console.log('[CaseManagement] 📦 Incident object:', incident);

            if (!incident || !incident.id) {
                console.error('[CaseManagement] ❌ Invalid incident data:', incident);
                throw new Error('Data insiden tidak valid (missing id)');
            }

            currentIncident = incident;

            // ===== BRUTE FORCE CONTENT INJECTION =====
            console.log('[CaseManagement] 💉 INJECTING CONTENT...');

            // Update header
            const statusEl = document.querySelector('#thread-status');
            const titleEl = document.querySelector('#thread-title');
            if (statusEl) statusEl.textContent = STATUS_ICONS[incident.status] || '⚪';
            if (titleEl) titleEl.textContent = incident.judul || 'Detail Catatan';

            // INJECT detail content directly
            const detailHTML = buildDetailHTML(incident);
            if (detailEl) {
                detailEl.innerHTML = detailHTML;
                console.log('[CaseManagement] ✅ Detail HTML injected, length:', detailHTML.length);
            }

            // Set comment form values
            if (commentIncidentId) commentIncidentId.value = incidentId;
            if (commentParentId) commentParentId.value = '';

            // INJECT comments
            const comments = incident.comments || [];
            if (countEl) countEl.textContent = comments.length;

            if (commentsEl) {
                if (comments.length === 0) {
                    commentsEl.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;color:#9ca3af;">Belum ada tanggapan.</p>';
                } else {
                    commentsEl.innerHTML = comments.map(c => buildCommentHTML(c)).join('');
                }
                console.log('[CaseManagement] ✅ Comments injected, count:', comments.length);
            }

            // Show/hide sections based on role
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isPimpinan = user.role === 'pimpinan' || user.role === 'superadmin';
            const isWalisantri = user.role === 'walisantri';
            const isClosed = incident.status === 'resolved' || incident.status === 'closed';

            if (resolveSection) {
                const canResolve = isPimpinan && !isClosed;
                resolveSection.style.display = canResolve ? 'block' : 'none';
            }
            if (addCommentSection) {
                addCommentSection.style.display = (isWalisantri || isClosed) ? 'none' : 'block';
            }

            console.log('[CaseManagement] ✅ CONTENT INJECTION COMPLETE');

        } catch (err) {
            clearTimeout(timeoutId);
            console.error('[CaseManagement] ❌ Error:', err);
            console.error('[CaseManagement] Stack:', err.stack);

            // BRUTE FORCE error display
            if (detailEl) {
                detailEl.innerHTML = `
                    <div style="text-align:center;padding:40px;background:#fef2f2;border-radius:12px;border:1px solid #fecaca;">
                        <div style="font-size:48px;margin-bottom:16px;">❌</div>
                        <h3 style="color:#dc2626;margin:0 0 8px;">Gagal Memuat Data</h3>
                        <p style="color:#7f1d1d;margin:0 0 8px;">${escapeHtml(err.message || 'Terjadi kesalahan')}</p>
                        <p style="color:#9ca3af;font-size:12px;margin:0 0 16px;">ID: ${incidentId}</p>
                        <button onclick="window.openThreadModal(${incidentId})" style="background:#10b981;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;margin-right:8px;">
                            🔄 Coba Lagi
                        </button>
                        <button onclick="window.closeThreadModal()" style="background:#6b7280;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">
                            ✖️ Tutup
                        </button>
                    </div>
                `;
            }
            if (commentsEl) {
                commentsEl.innerHTML = '';
            }
        } finally {
            setFetching('detail', false);
        }
    };

    // Helper: Build detail HTML directly (bypass renderIncidentDetail)
    function buildDetailHTML(incident) {
        const statusLabel = STATUS_LABELS[incident.status] || incident.status;
        const kategoriLabel = KATEGORI_LABELS[incident.kategori] || incident.kategori;
        const tanggal = formatDate(incident.tanggal_kejadian);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canChangeStatus = ['guru', 'musyrif', 'pimpinan', 'superadmin'].includes(user.role);
        const isNotClosed = incident.status !== 'resolved' && incident.status !== 'closed';

        let finalDecisionBanner = '';
        if (incident.status === 'resolved' && incident.keputusan_final) {
            finalDecisionBanner = `
                <div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);padding:16px;border-radius:12px;margin-bottom:16px;border-left:4px solid #22c55e;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <span style="font-size:20px;">✅</span>
                        <span style="font-weight:600;color:#166534;">KEPUTUSAN FINAL</span>
                    </div>
                    <p style="margin:0;color:#15803d;">${escapeHtml(incident.keputusan_final)}</p>
                </div>
            `;
        }

        let statusActions = '';
        if (canChangeStatus && isNotClosed) {
            statusActions = `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                    <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:4px;">Ubah Status:</label>
                    <select id="thread-status-dropdown" onchange="window.onStatusDropdownChange(this)" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;background:white;">
                        <option value="open" ${incident.status === 'open' ? 'selected' : ''}>🔴 Open</option>
                        <option value="dalam_pembahasan" ${incident.status === 'dalam_pembahasan' || incident.status === 'in_discussion' ? 'selected' : ''}>🟡 Dalam Penanganan</option>
                        <option value="resolved">🟢 Selesaikan (Final)</option>
                    </select>
                </div>
            `;
        }

        return `
            ${finalDecisionBanner}
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
                    <h3 style="margin:0;font-size:18px;font-weight:600;color:#1e293b;">${escapeHtml(incident.judul)}</h3>
                    <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;background:${incident.status === 'open' ? '#fee2e2' : incident.status === 'in_discussion' ? '#fef3c7' : '#dcfce7'};color:${incident.status === 'open' ? '#dc2626' : incident.status === 'in_discussion' ? '#d97706' : '#16a34a'};">
                        ${STATUS_ICONS[incident.status] || '⚪'} ${statusLabel}
                    </span>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:20px;font-size:12px;">👤 ${escapeHtml(incident.siswa_nama || '-')}</span>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:20px;font-size:12px;">📅 ${tanggal}</span>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:20px;font-size:12px;">📋 ${kategoriLabel}</span>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:20px;font-size:12px;">⚡ ${incident.tingkat}</span>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:20px;font-size:12px;">📝 ${escapeHtml(incident.pelapor_nama || '-')} (${escapeHtml(incident.pelapor_role_display || '-')})</span>
            </div>
            <div style="padding:16px;background:#f9fafb;border-radius:8px;color:#374151;line-height:1.6;">
                ${escapeHtml(incident.deskripsi || 'Tidak ada deskripsi.')}
            </div>
            ${statusActions}
        `;
    }

    // Helper: Build comment HTML directly
    function buildCommentHTML(comment) {
        const authorInitials = getInitials(comment.author_nama || comment.author_name || 'U');
        const typeLabel = TYPE_LABELS[comment.comment_type] || comment.comment_type || 'Catatan';
        const timestamp = formatDateTime(comment.created_at);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'].includes(user.role);
        const isReply = comment.parent_comment != null;
        const isInternal = comment.visibility === 'internal';

        let visibilityBadge = '';
        if (comment.visibility === 'internal') {
            visibilityBadge = '<span style="font-size:10px;padding:2px 6px;background:#fee2e2;color:#dc2626;border-radius:4px;">🔒 Internal</span>';
        } else if (comment.visibility === 'public') {
            visibilityBadge = '<span style="font-size:10px;padding:2px 6px;background:#dbeafe;color:#2563eb;border-radius:4px;">👁️ Publik</span>';
        } else if (comment.visibility === 'final_decision') {
            visibilityBadge = '<span style="font-size:10px;padding:2px 6px;background:#dcfce7;color:#16a34a;border-radius:4px;">✅ Final</span>';
        }

        const replyBtn = isAdmin ? `<button onclick="window.replyToComment(${comment.id})" style="font-size:12px;color:#10b981;background:none;border:none;cursor:pointer;padding:4px 8px;">↩️ Balas</button>` : '';

        return `
            <div style="display:flex;gap:12px;padding:16px;margin-bottom:12px;background:${isInternal ? '#fef2f2' : 'white'};border-radius:12px;border:1px solid ${isInternal ? '#fecaca' : '#e5e7eb'};${isReply ? 'margin-left:40px;' : ''}">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;flex-shrink:0;">
                    ${authorInitials}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                        <div>
                            <span style="font-weight:600;color:#1e293b;">${escapeHtml(comment.author_nama || comment.author_name || 'Unknown')}</span>
                            <span style="color:#9ca3af;font-size:12px;margin-left:8px;">${escapeHtml(comment.author_role_display || comment.author_role || '-')}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:10px;padding:2px 6px;background:#f3f4f6;color:#6b7280;border-radius:4px;">${typeLabel}</span>
                            ${visibilityBadge}
                            <span style="font-size:11px;color:#9ca3af;">${timestamp}</span>
                        </div>
                    </div>
                    <div style="color:#374151;line-height:1.5;">${escapeHtml(comment.content)}</div>
                    ${replyBtn ? `<div style="margin-top:8px;">${replyBtn}</div>` : ''}
                </div>
            </div>
        `;
    }

    // Aliases for compatibility
    window.showIncidentDetail = window.openThreadModal;
    window.openIncidentDetail = window.openThreadModal;

    window.closeThreadModal = function() {
        console.log('[CaseManagement] 🔒 Closing thread modal');
        const modal = document.getElementById('thread-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        currentIncident = null;
        // Reset fetch state in case it was stuck
        setFetching('detail', false);
    };

    function renderIncidentDetail(incident) {
        const detailEl = document.getElementById('thread-incident-detail');
        const statusLabel = STATUS_LABELS[incident.status] || incident.status;
        const kategoriLabel = KATEGORI_LABELS[incident.kategori] || incident.kategori;
        const tanggal = formatDate(incident.tanggal_kejadian);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canChangeStatus = ['guru', 'musyrif', 'pimpinan', 'superadmin'].includes(user.role);
        const canApprove = ['superadmin', 'pimpinan'].includes(user.role);
        const isNotClosed = incident.status !== 'resolved' && incident.status !== 'closed';

        // Final Decision Banner - Shows at TOP when resolved for walisantri visibility
        let finalDecisionBanner = '';
        if (incident.status === 'resolved' && incident.keputusan_final) {
            finalDecisionBanner = `
                <div class="thread-final-decision-banner">
                    <div class="decision-badge">
                        <span class="decision-icon">✅</span>
                        <span class="decision-label">KEPUTUSAN FINAL</span>
                    </div>
                    <div class="decision-content">${escapeHtml(incident.keputusan_final)}</div>
                    <div class="decision-meta">
                        Diputuskan oleh Pimpinan/Mudir • Status: Selesai
                    </div>
                </div>
            `;
        }

        // Status indicator class for real-time styling
        const statusClass = `status-indicator-${incident.status}`;

        // Status change dropdown for admin (instead of multiple buttons)
        let statusActions = '';
        if (canChangeStatus && isNotClosed) {
            statusActions = `
                <div class="thread-status-actions">
                    <span class="status-action-label">Ubah Status:</span>
                    <select id="thread-status-dropdown" class="status-dropdown glass-input" onchange="window.onStatusDropdownChange(this)">
                        <option value="open" ${incident.status === 'open' ? 'selected' : ''}>🔴 Open</option>
                        <option value="dalam_pembahasan" ${incident.status === 'dalam_pembahasan' || incident.status === 'in_discussion' ? 'selected' : ''}>🟡 Dalam Penanganan</option>
                        <option value="resolved">🟢 Selesaikan (Final)</option>
                    </select>
                    <span class="status-hint">Hanya Pimpinan dapat menyelesaikan kasus</span>
                </div>
            `;
        } else if (incident.status === 'resolved' || incident.status === 'closed') {
            statusActions = `
                <div class="thread-status-closed">
                    <span class="status-closed-badge">✅ Kasus ini telah diselesaikan</span>
                </div>
            `;
        }

        // PERUBAHAN 2: Section Foto Kejadian
        let fotoSection = '';
        const fotoUrl = incident.foto_url || incident.foto;
        if (fotoUrl) {
            fotoSection = `
                <div class="thread-foto-section">
                    <div class="thread-foto-label">📷 Foto Kejadian</div>
                    <div class="thread-foto-container">
                        <a href="${fotoUrl}" target="_blank" class="thread-foto-link" title="Klik untuk buka fullscreen">
                            <img src="${fotoUrl}" alt="Foto Kejadian" class="thread-foto-thumbnail">
                            <span class="thread-foto-overlay">🔍 Lihat Fullscreen</span>
                        </a>
                    </div>
                </div>
            `;
        }

        // PERUBAHAN 3: Approval Section
        let approvalSection = '';
        if (incident.is_approved) {
            const approvedByName = incident.approved_by_name || incident.approved_by_nama || 'Admin';
            const approvedAt = incident.approved_at ? formatDate(incident.approved_at) : '';
            approvalSection = `
                <div class="thread-approval-section approval-approved">
                    <span class="approval-badge badge-approved">✅ Disetujui</span>
                    <span class="approval-info">oleh ${escapeHtml(approvedByName)}${approvedAt ? ` pada ${approvedAt}` : ''}</span>
                </div>
            `;
        } else if (canApprove) {
            approvalSection = `
                <div class="thread-approval-section approval-pending">
                    <span class="approval-badge badge-pending">⏳ Menunggu persetujuan</span>
                    <button onclick="window.approveIncident(${incident.id})" class="btn btn-primary btn-sm">
                        ✅ Setujui Kasus
                    </button>
                </div>
            `;
        } else {
            approvalSection = `
                <div class="thread-approval-section approval-pending">
                    <span class="approval-badge badge-pending">⏳ Menunggu persetujuan admin</span>
                </div>
            `;
        }

        detailEl.innerHTML = `
            ${finalDecisionBanner}
            <div class="thread-detail-header">
                <h3 class="thread-detail-title">${escapeHtml(incident.judul)}</h3>
                <div class="thread-status-indicator ${statusClass}">
                    <span class="status-dot">${STATUS_ICONS[incident.status]}</span>
                    <span class="status-text">${statusLabel}</span>
                </div>
            </div>
            <div class="thread-detail-meta">
                <span class="thread-meta-chip">👤 ${escapeHtml(incident.siswa_nama || '-')}</span>
                <span class="thread-meta-chip">📅 ${tanggal}</span>
                <span class="thread-meta-chip">📋 ${kategoriLabel}</span>
                <span class="thread-meta-chip">⚡ ${incident.tingkat}</span>
                <span class="thread-meta-chip">📝 Pelapor: ${escapeHtml(incident.pelapor_nama || '-')} (${escapeHtml(incident.pelapor_role_display || '-')})</span>
            </div>
            <div class="thread-detail-content">${escapeHtml(incident.deskripsi)}</div>
            ${fotoSection}
            ${approvalSection}
            ${statusActions}
        `;
    }

    function renderComments(comments) {
        const commentsEl = document.getElementById('thread-comments');
        const countEl = document.getElementById('thread-comment-count');
        const sectionTitle = document.querySelector('.thread-section-title');
        const addCommentForm = document.getElementById('thread-add-comment');

        // PERUBAHAN 5: Get user role to filter comments for walisantri
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isWalisantri = user.role === 'walisantri';

        // Filter comments for walisantri - only show public visibility
        let filteredComments = comments;
        if (isWalisantri) {
            filteredComments = comments.filter(c => c.visibility === 'public' || c.visibility === 'final_decision');

            // PERUBAHAN 5: Change title to "Perkembangan Penanganan" for walisantri
            if (sectionTitle) {
                sectionTitle.innerHTML = '<span>📋</span> Perkembangan Penanganan <span class="comment-count" id="thread-comment-count">' + filteredComments.length + '</span>';
            }

            // PERUBAHAN 5: Hide add comment form for walisantri
            if (addCommentForm) {
                addCommentForm.style.display = 'none';
            }
        } else {
            // Admin view - show "Pembinaan" title and form
            if (sectionTitle) {
                sectionTitle.innerHTML = '<span>💬</span> Pembinaan <span class="comment-count" id="thread-comment-count">' + comments.length + '</span>';
            }
            if (addCommentForm) {
                addCommentForm.style.display = 'block';
            }
        }

        countEl.textContent = filteredComments.length;

        if (!filteredComments || filteredComments.length === 0) {
            commentsEl.innerHTML = isWalisantri
                ? '<p class="text-muted">Belum ada perkembangan yang dapat ditampilkan.</p>'
                : '<p class="text-muted">Belum ada tanggapan.</p>';
            return;
        }

        commentsEl.innerHTML = filteredComments.map(comment => renderComment(comment)).join('');
    }

    function renderComment(comment) {
        const authorInitials = getInitials(comment.author_nama || comment.author_name || 'U');
        const typeLabel = TYPE_LABELS[comment.comment_type] || comment.comment_type;
        const typeClass = `type-${comment.comment_type}`;
        const timestamp = formatDateTime(comment.created_at);

        // Visibility indicators with tooltips for admin
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'].includes(user.role);

        let visibilityBadge = '';
        if (comment.visibility === 'internal') {
            visibilityBadge = `<span class="comment-visibility-badge visibility-internal" title="Internal - Hanya terlihat oleh ustadz">🔒 Internal</span>`;
        } else if (comment.visibility === 'public') {
            visibilityBadge = `<span class="comment-visibility-badge visibility-public" title="Publik - Terlihat oleh walisantri">👁️ Publik</span>`;
        } else if (comment.visibility === 'final_decision') {
            visibilityBadge = `<span class="comment-visibility-badge visibility-final" title="Keputusan Final">✅ Final</span>`;
        }

        const isReply = comment.parent_comment != null;

        // Show reply button only for admin roles
        const replyButton = isAdmin ?
            `<button class="comment-action-btn" onclick="window.replyToComment(${comment.id})">↩️ Balas</button>` : '';

        return `
            <div class="thread-comment ${isReply ? 'is-reply' : ''} ${comment.visibility === 'internal' ? 'comment-internal' : ''}">
                <div class="comment-avatar">${authorInitials}</div>
                <div class="comment-body">
                    <div class="comment-header">
                        <div class="comment-author">
                            <span class="comment-author-name">${escapeHtml(comment.author_nama || comment.author_name || 'Unknown')}</span>
                            <span class="comment-author-role">${escapeHtml(comment.author_role_display || comment.author_role || '-')}</span>
                        </div>
                        <div class="comment-meta">
                            <span class="comment-type-badge ${typeClass}">${typeLabel}</span>
                            ${visibilityBadge}
                            <span>${timestamp}</span>
                        </div>
                    </div>
                    <div class="comment-content">${escapeHtml(comment.content)}</div>
                    ${replyButton ? `<div class="comment-actions">${replyButton}</div>` : ''}
                </div>
            </div>
        `;
    }

    window.replyToComment = function(commentId) {
        document.getElementById('comment-parent-id').value = commentId;
        document.getElementById('comment-content').focus();
        document.getElementById('comment-content').placeholder = 'Membalas komentar #' + commentId + '...';

        // Scroll to comment form
        const commentForm = document.getElementById('thread-add-comment');
        if (commentForm) {
            commentForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // ======================== PERUBAHAN 3: APPROVE INCIDENT ========================
    window.approveIncident = async function(incidentId) {
        if (!confirm('Apakah Anda yakin ingin menyetujui kasus ini?')) {
            return;
        }

        try {
            console.log('[CaseManagement] Approving incident:', incidentId);

            const response = await window.apiFetch(`/kesantrian/incidents/${incidentId}/approve/`, {
                method: 'PATCH'
            });

            if (!response || !response.ok) {
                const errorData = await response?.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.detail || `HTTP ${response?.status}`);
            }

            const data = await response.json();

            if (data.success) {
                showToast('✅ Kasus berhasil disetujui');
                // Refresh the thread modal
                window.openThreadModal(incidentId);
                // Refresh the incidents list
                if (typeof loadIncidents === 'function') loadIncidents();
            } else {
                throw new Error(data.message || 'Gagal menyetujui kasus');
            }
        } catch (err) {
            console.error('[CaseManagement] Error approving incident:', err);
            showToast('❌ Gagal menyetujui kasus: ' + err.message, 'error');
        }
    };

    // ======================== REFRESH THREAD COMMENTS (ASYNC) ========================
    async function refreshThreadComments(incidentId) {
        const commentsEl = document.querySelector('#thread-comments');
        const countEl = document.querySelector('#thread-comment-count');

        if (!commentsEl) {
            console.warn('[CaseManagement] thread-comments element not found');
            return;
        }

        // Show subtle loading indicator
        commentsEl.style.opacity = '0.6';

        try {
            console.log('[CaseManagement] Refreshing comments for incident:', incidentId);
            const rawResponse = await window.apiFetch(`/kesantrian/incidents/${incidentId}/`);

            if (!rawResponse || !rawResponse.ok) {
                throw new Error(`HTTP ${rawResponse?.status}`);
            }

            const response = await rawResponse.json();
            const incident = response.data || response;

            // Update current incident reference
            currentIncident = incident;

            // Re-render comments using buildCommentHTML
            const comments = incident.comments || [];
            if (countEl) countEl.textContent = comments.length;

            if (!comments || comments.length === 0) {
                commentsEl.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;color:#9ca3af;">Belum ada tanggapan.</p>';
            } else {
                // Use buildCommentHTML for consistent rendering
                commentsEl.innerHTML = comments.map(comment => buildCommentHTML(comment)).join('');

                // Highlight the newest comment
                const lastComment = commentsEl.lastElementChild;
                if (lastComment) {
                    lastComment.style.boxShadow = '0 0 0 2px #10b981';
                    setTimeout(() => {
                        lastComment.style.boxShadow = 'none';
                    }, 2000);
                    lastComment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }

            console.log('[CaseManagement] ✅ Comments refreshed, count:', comments.length);
        } catch (err) {
            console.error('[CaseManagement] ❌ Error refreshing comments:', err);
        } finally {
            commentsEl.style.opacity = '1';
        }
    }

    // ======================== QUICK STATUS CHANGE ========================
    window.changeIncidentStatus = async function(newStatus) {
        if (!currentIncident) {
            console.warn('[CaseManagement] No current incident for status change');
            return;
        }

        // Anti-double update guard
        if (isFetching('statusUpdate')) {
            console.log('[CaseManagement] Status update already in progress, skipping...');
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canChangeStatus = ['guru', 'musyrif', 'pimpinan', 'superadmin'].includes(user.role);

        if (!canChangeStatus) {
            showToast('Anda tidak memiliki izin untuk mengubah status', 'error');
            return;
        }

        // For resolved status, use the resolve endpoint (pimpinan only)
        if (newStatus === 'resolved') {
            const isPimpinan = user.role === 'pimpinan' || user.role === 'superadmin';
            if (!isPimpinan) {
                showToast('Hanya pimpinan yang bisa menyelesaikan kasus', 'error');
                return;
            }
            // Show resolve form instead
            document.getElementById('thread-resolve-action').style.display = 'block';
            document.getElementById('resolve-decision').focus();
            return;
        }

        setFetching('statusUpdate', true);

        // Disable status dropdown during update
        const statusDropdown = document.getElementById('thread-status-dropdown');
        if (statusDropdown) {
            statusDropdown.disabled = true;
        }

        try {
            console.log('[CaseManagement] Updating incident status:', currentIncident.id, '->', newStatus);
            const rawResp = await window.apiFetch(`/kesantrian/incidents/${currentIncident.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });

            if (!rawResp || !rawResp.ok) {
                throw new Error(`HTTP ${rawResp?.status}: Failed to update status`);
            }

            showToast(`Status berhasil diubah ke ${STATUS_LABELS[newStatus]}`);

            // Update UI immediately
            currentIncident.status = newStatus;
            document.getElementById('thread-status').textContent = STATUS_ICONS[newStatus] || '⚪';
            renderIncidentDetail(currentIncident);

            // Reload list in background
            loadIncidents();
            loadIncidentSummary();
        } catch (err) {
            console.error('[CaseManagement] Error changing status:', err);
            showToast('Gagal mengubah status', 'error');
            // Revert dropdown to original value
            if (statusDropdown) {
                statusDropdown.value = currentIncident.status;
            }
        } finally {
            setFetching('statusUpdate', false);
            if (statusDropdown) {
                statusDropdown.disabled = false;
            }
        }
    };

    // Status change via dropdown
    window.onStatusDropdownChange = function(selectEl) {
        const newStatus = selectEl.value;
        if (newStatus && currentIncident && newStatus !== currentIncident.status) {
            window.changeIncidentStatus(newStatus);
        }
    };

    // ======================== FORM HANDLERS ========================
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[CaseManagement] DOMContentLoaded - setting up event listeners');

        // ========== ROLE-BASED UI VISIBILITY (Parent View Constraints) ==========
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isWalisantri = user.role === 'walisantri';
        const isAdmin = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'].includes(user.role);

        console.log('[CaseManagement] User role:', user.role, '| isWalisantri:', isWalisantri, '| isAdmin:', isAdmin);

        // Set body data-role attribute for CSS-based hiding
        document.body.dataset.role = user.role || 'guest';

        // Explicitly hide admin-only elements for walisantri
        if (isWalisantri) {
            console.log('[CaseManagement] Walisantri mode - hiding admin-only elements');

            // Hide "Add New Incident" button
            const addBtn = document.getElementById('btn-add-incident');
            if (addBtn) addBtn.style.display = 'none';

            // Hide action bar (filters + add button container)
            const actionsBar = document.querySelector('.incident-actions-bar.admin-only');
            if (actionsBar) actionsBar.style.display = 'none';

            // Hide add comment form in thread modal
            const addCommentForm = document.getElementById('thread-add-comment');
            if (addCommentForm) addCommentForm.style.display = 'none';

            // Hide resolve action section
            const resolveAction = document.getElementById('thread-resolve-action');
            if (resolveAction) resolveAction.style.display = 'none';
        }

        // ========== VERIFY ELEMENTS EXIST ==========
        const addIncidentBtn = document.getElementById('btn-add-incident');
        const incidentList = document.getElementById('incident-list');

        console.log('[CaseManagement] ✅ Elements found:', {
            addIncidentBtn: !!addIncidentBtn,
            incidentList: !!incidentList
        });

        // NOTE: All click handling is done via single document-level listener below
        // This ensures clicks work even for dynamically loaded content

        // ========== INCIDENT FORM SUBMIT - BULLETPROOF v2.4 ==========
        const incidentForm = document.getElementById('incident-form');
        if (incidentForm) {
            console.log('[CaseManagement] ✅ Incident form found, attaching submit listener');

            incidentForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[CaseManagement] 📝 ===== FORM SUBMIT START =====');

                // Get form elements directly
                const submitBtn = incidentForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn ? submitBtn.innerHTML : '💾 Simpan Catatan';

                // ========== COLLECT DATA USING FORMDATA ==========
                const formData = new FormData(incidentForm);
                const incidentId = formData.get('incident-id') || document.getElementById('incident-id')?.value || '';

                // Build data object from form
                // CRITICAL: Backend expects 'siswa_nisn' NOT 'siswa'!
                const data = {
                    siswa_nisn: formData.get('siswa_nisn') || document.getElementById('incident-siswa')?.value || '',
                    tanggal_kejadian: formData.get('tanggal_kejadian') || document.getElementById('incident-tanggal')?.value || '',
                    judul: (formData.get('judul') || document.getElementById('incident-judul')?.value || '').trim(),
                    kategori: formData.get('kategori') || document.getElementById('incident-kategori')?.value || '',
                    tingkat: formData.get('tingkat') || document.getElementById('incident-tingkat')?.value || '',
                    deskripsi: (formData.get('deskripsi') || document.getElementById('incident-deskripsi')?.value || '').trim()
                };

                console.log('[CaseManagement] 📋 Form data collected:', data);

                // ========== VALIDATION ==========
                const errors = [];
                const fields = {
                    siswa_nisn: document.getElementById('incident-siswa'),
                    tanggal_kejadian: document.getElementById('incident-tanggal'),
                    judul: document.getElementById('incident-judul'),
                    kategori: document.getElementById('incident-kategori'),
                    tingkat: document.getElementById('incident-tingkat'),
                    deskripsi: document.getElementById('incident-deskripsi')
                };

                // Clear previous errors
                Object.values(fields).forEach(el => el?.classList.remove('input-error'));

                if (!data.siswa) {
                    errors.push('Siswa wajib dipilih');
                    fields.siswa?.classList.add('input-error');
                }
                if (!data.tanggal_kejadian) {
                    errors.push('Tanggal kejadian wajib diisi');
                    fields.tanggal_kejadian?.classList.add('input-error');
                }
                if (!data.judul) {
                    errors.push('Judul catatan wajib diisi');
                    fields.judul?.classList.add('input-error');
                }
                if (!data.kategori) {
                    errors.push('Kategori wajib dipilih');
                    fields.kategori?.classList.add('input-error');
                }
                if (!data.tingkat) {
                    errors.push('Tingkat wajib dipilih');
                    fields.tingkat?.classList.add('input-error');
                }
                if (!data.deskripsi) {
                    errors.push('Deskripsi wajib diisi');
                    fields.deskripsi?.classList.add('input-error');
                }

                if (errors.length > 0) {
                    console.warn('[CaseManagement] ⚠️ Validation errors:', errors);
                    // Use alert as fallback
                    try {
                        showToast(errors[0], 'error');
                    } catch (e) {
                        alert('❌ ' + errors[0]);
                    }
                    return;
                }

                // ========== SHOW LOADING STATE ==========
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '⏳ Menyimpan...';
                    submitBtn.style.opacity = '0.7';
                }

                try {
                    const isEdit = !!incidentId;
                    const apiUrl = isEdit
                        ? `/kesantrian/incidents/${incidentId}/`
                        : '/kesantrian/incidents/';
                    const method = isEdit ? 'PUT' : 'POST';

                    console.log(`[CaseManagement] 🌐 ${method} ${apiUrl}`);
                    console.log('[CaseManagement] 📦 Payload:', JSON.stringify(data));

                    // Check apiFetch availability
                    if (typeof window.apiFetch !== 'function') {
                        throw new Error('apiFetch tidak tersedia');
                    }

                    const rawResp = await window.apiFetch(apiUrl, {
                        method: method,
                        body: JSON.stringify(data)
                    });

                    console.log('[CaseManagement] 📡 Raw response:', rawResp);

                    // Check response
                    if (!rawResp) {
                        throw new Error('Tidak ada response dari server');
                    }

                    console.log('[CaseManagement] 📡 Response status:', rawResp.status, rawResp.ok);

                    if (!rawResp.ok) {
                        // Try to get error message from response
                        let errorMsg = `HTTP ${rawResp.status}`;
                        try {
                            const errorData = await rawResp.json();
                            console.log('[CaseManagement] ❌ Error response body:', errorData);
                            if (errorData.detail) {
                                errorMsg = errorData.detail;
                            } else if (errorData.message) {
                                errorMsg = errorData.message;
                            } else if (typeof errorData === 'object') {
                                const firstKey = Object.keys(errorData)[0];
                                if (firstKey && Array.isArray(errorData[firstKey])) {
                                    errorMsg = `${firstKey}: ${errorData[firstKey][0]}`;
                                } else if (firstKey) {
                                    errorMsg = `${firstKey}: ${errorData[firstKey]}`;
                                }
                            }
                        } catch (e) {
                            console.error('[CaseManagement] Could not parse error response');
                        }
                        throw new Error(errorMsg);
                    }

                    // ========== SUCCESS! ==========
                    const responseData = await rawResp.json();
                    console.log('[CaseManagement] ✅ SUCCESS! Response:', responseData);

                    // Show success notification (with fallbacks)
                    const successMsg = isEdit ? '✅ Catatan berhasil diperbarui!' : '✅ Catatan baru berhasil ditambahkan!';
                    try {
                        showToast(successMsg, 'success');
                    } catch (e) {
                        alert(successMsg);
                    }

                    // Close modal
                    try {
                        window.closeIncidentModal();
                    } catch (e) {
                        const modal = document.getElementById('incident-modal');
                        if (modal) {
                            modal.style.display = 'none';
                            modal.classList.remove('show');
                        }
                    }

                    // Reset form
                    incidentForm.reset();

                    // ========== REFRESH UI ==========
                    console.log('[CaseManagement] 🔄 Refreshing UI...');

                    try {
                        // Try normal refresh first
                        await loadIncidentSummary();
                        await loadIncidents();
                        console.log('[CaseManagement] ✅ UI refreshed via loadIncidents()');
                    } catch (refreshErr) {
                        console.error('[CaseManagement] ❌ loadIncidents failed:', refreshErr);
                        // FALLBACK: Full page reload
                        console.log('[CaseManagement] 🔄 Fallback: Reloading page...');
                        alert('Data tersimpan! Halaman akan dimuat ulang.');
                        window.location.reload();
                    }

                    console.log('[CaseManagement] 📝 ===== FORM SUBMIT COMPLETE =====');

                } catch (err) {
                    console.error('[CaseManagement] ❌ Error saving incident:', err);
                    console.error('[CaseManagement] Error stack:', err.stack);

                    // Show error with fallback
                    const errorMsg = err.message || 'Gagal menyimpan catatan';
                    try {
                        showToast(errorMsg, 'error');
                    } catch (e) {
                        alert('❌ Error: ' + errorMsg);
                    }
                } finally {
                    // Restore button state
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                        submitBtn.style.opacity = '1';
                    }
                }
            });

            // Also add direct onclick as backup
            const formSubmitBtn = incidentForm.querySelector('button[type="submit"]');
            if (formSubmitBtn) {
                formSubmitBtn.onclick = function(e) {
                    console.log('[CaseManagement] 🔔 Submit button clicked via onclick');
                    // Let the form submit event handle it
                };
            }

            console.log('[CaseManagement] ✅ Form submit listener attached successfully');
        } else {
            console.error('[CaseManagement] ❌ CRITICAL: incident-form not found!');
            alert('Error: Form tidak ditemukan. Silakan refresh halaman.');
        }

        // Comment form submit - BULLETPROOF v2.4
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            console.log('[CaseManagement] ✅ Comment form found, attaching submit listener');

            commentForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[CaseManagement] 💬 ===== COMMENT SUBMIT START =====');

                const submitBtn = commentForm.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.innerHTML : '💬 Kirim Tanggapan';

                const incidentId = document.getElementById('comment-incident-id')?.value;
                const contentEl = document.getElementById('comment-content');

                if (!incidentId) {
                    console.error('[CaseManagement] ❌ No incident ID for comment');
                    alert('❌ Error: ID insiden tidak ditemukan');
                    return;
                }

                if (!contentEl?.value?.trim()) {
                    alert('❌ Isi tanggapan tidak boleh kosong');
                    contentEl?.focus();
                    return;
                }

                const data = {
                    content: contentEl.value.trim(),
                    comment_type: document.getElementById('comment-type')?.value || 'note',
                    visibility: document.getElementById('comment-visibility')?.value || 'internal'
                };

                const parentId = document.getElementById('comment-parent-id')?.value;
                if (parentId) {
                    data.parent_comment = parseInt(parentId);
                }

                console.log('[CaseManagement] 💬 Comment data:', data);

                // Show loading state
                if (submitBtn) {
                    submitBtn.innerHTML = '⏳ Mengirim...';
                    submitBtn.disabled = true;
                }

                try {
                    const rawResp = await window.apiFetch(`/kesantrian/incidents/${incidentId}/comments/`, {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });

                    console.log('[CaseManagement] 💬 Response:', rawResp?.status, rawResp?.ok);

                    if (!rawResp || !rawResp.ok) {
                        let errorMsg = `HTTP ${rawResp?.status}`;
                        try {
                            const errData = await rawResp.json();
                            errorMsg = errData.detail || errData.message || errorMsg;
                        } catch (e) {}
                        throw new Error(errorMsg);
                    }

                    // SUCCESS!
                    console.log('[CaseManagement] ✅ Comment added successfully');
                    try {
                        showToast('✅ Tanggapan berhasil ditambahkan', 'success');
                    } catch (e) {
                        alert('✅ Tanggapan berhasil ditambahkan!');
                    }

                    // Reset form
                    contentEl.value = '';
                    document.getElementById('comment-parent-id').value = '';
                    contentEl.placeholder = 'Tulis tanggapan atau saran...';

                    // Refresh comments
                    try {
                        await refreshThreadComments(incidentId);
                        loadIncidents();
                    } catch (refreshErr) {
                        console.error('[CaseManagement] Refresh failed, reloading thread...');
                        window.openThreadModal(incidentId);
                    }

                    console.log('[CaseManagement] 💬 ===== COMMENT SUBMIT COMPLETE =====');

                } catch (err) {
                    console.error('[CaseManagement] ❌ Error adding comment:', err);
                    try {
                        showToast('❌ ' + (err.message || 'Gagal menambahkan tanggapan'), 'error');
                    } catch (e) {
                        alert('❌ ' + (err.message || 'Gagal menambahkan tanggapan'));
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                    }
                }
            });

            console.log('[CaseManagement] ✅ Comment form submit listener attached');
        } else {
            console.warn('[CaseManagement] ⚠️ comment-form not found');
        }

        // Resolve form submit
        const resolveForm = document.getElementById('resolve-form');
        if (resolveForm) {
            resolveForm.addEventListener('submit', async function(e) {
                e.preventDefault();

                if (!currentIncident) return;

                const decision = document.getElementById('resolve-decision').value;

                try {
                    const rawResp = await window.apiFetch(`/kesantrian/incidents/${currentIncident.id}/resolve/`, {
                        method: 'POST',
                        body: JSON.stringify({ keputusan_final: decision })
                    });

                    if (!rawResp || !rawResp.ok) throw new Error(`HTTP ${rawResp?.status}`);
                    showToast('Kasus berhasil diselesaikan');
                    window.closeThreadModal();
                    loadIncidentSummary();
                    loadIncidents();
                } catch (err) {
                    console.error('Error resolving incident:', err);
                    showToast('Gagal menyelesaikan kasus', 'error');
                }
            });
        }

        // ========== SETUP VERIFICATION ==========
        console.log('[CaseManagement] ========== SETUP COMPLETE ==========');
        console.log('[CaseManagement] ✅ All event listeners attached');
        console.log('[CaseManagement] 💡 Run window.debugCaseManagement() in console for diagnostics');
        console.log('[CaseManagement] ================================================');
    });

    // ======================== UTILITIES ========================
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getInitials(name) {
        if (!name) return 'U';
        const words = name.trim().split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message');
        if (toast && toastMsg) {
            toastMsg.textContent = message;
            toast.className = 'toast show ' + type;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    // ======================== MODAL CLOSE ON OUTSIDE CLICK ========================
    window.addEventListener('click', function(e) {
        const incidentModal = document.getElementById('incident-modal');
        const threadModal = document.getElementById('thread-modal');

        if (e.target === incidentModal) {
            window.closeIncidentModal();
        }
        if (e.target === threadModal) {
            window.closeThreadModal();
        }
    });

    // ======================== KEYBOARD SHORTCUTS ========================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            window.closeIncidentModal();
            window.closeThreadModal();
        }
    });

    // ======================== CHILD SWITCH LISTENER ========================
    // Listen for child switch events from dashboard
    window.addEventListener('childSwitched', function(e) {
        const { nisn } = e.detail;
        if (nisn) {
            // Clear cached data
            incidents = [];

            // Reload if on catatan tab
            const catatanTab = document.getElementById('tab-catatan');
            if (catatanTab && catatanTab.classList.contains('active')) {
                loadIncidentSummary();
                loadIncidents();
            }
        }
    });

    // ======================== EXPOSE FUNCTIONS FOR EXTERNAL USE ========================
    window.refreshIncidentData = function() {
        loadIncidentSummary();
        loadIncidents();
    };

    // ======================== INITIAL LOAD ========================
    // Auto-load data when page loads for all roles
    window.addEventListener('load', function() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        console.log('[CaseManagement] ===== PAGE LOAD =====');
        console.log('[CaseManagement] User data:', user);
        console.log('[CaseManagement] User role:', user.role);
        console.log('[CaseManagement] User username:', user.username);

        // Admin roles - auto-load all incidents
        const adminRoles = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'bk'];

        // Check if incident-list element exists (we're on the right page)
        const incidentList = document.getElementById('incident-list');
        const catatanTab = document.getElementById('tab-catatan');

        console.log('[CaseManagement] incident-list element:', incidentList ? 'found' : 'not found');
        console.log('[CaseManagement] tab-catatan element:', catatanTab ? 'found' : 'not found');

        if (!incidentList && !catatanTab) {
            console.log('[CaseManagement] Not on incident page, skipping auto-load');
            return;
        }

        if (adminRoles.includes(user.role)) {
            console.log('[CaseManagement] Admin role detected, auto-loading ALL incidents');

            // Always load summary
            loadIncidentSummary();

            // Load incidents immediately
            loadIncidents();
        }
        // Walisantri - auto-load if child is selected
        else if (user.role === 'walisantri') {
            const selectedNisn = localStorage.getItem('selected_child_nisn');
            console.log('[CaseManagement] Walisantri mode, selected_child_nisn:', selectedNisn);

            if (selectedNisn) {
                console.log('[CaseManagement] Walisantri with child selected, loading...');
                loadIncidentSummary();
                loadIncidents();
            } else {
                console.warn('[CaseManagement] Walisantri but no child selected yet');
                // Show message to select child
                if (incidentList) {
                    incidentList.innerHTML = `
                        <div class="incident-empty">
                            <div class="incident-empty-icon">👶</div>
                            <h3>Pilih Anak Terlebih Dahulu</h3>
                            <p>Silakan pilih anak dari dropdown untuk melihat catatan.</p>
                        </div>
                    `;
                }
            }
        } else {
            console.log('[CaseManagement] Unknown role, attempting load anyway...');
            loadIncidentSummary();
            loadIncidents();
        }
    });

    // ======================== MASTER CLICK HANDLER (Single Source of Truth) ========================
    // This is THE click handler - handles all clicks via event delegation
    // Using capture phase (true) ensures we get the event first
    document.addEventListener('click', function(e) {
        // ===== ADD BUTTON =====
        const addBtn = e.target.closest('#btn-add-incident');
        if (addBtn) {
            console.log('[CaseManagement] 🔔 TAMBAH EVALUASI CLICKED via delegation');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (typeof window.openIncidentModal === 'function') {
                window.openIncidentModal();
            } else {
                console.error('[CaseManagement] ❌ openIncidentModal not defined! Retrying in 100ms...');
                setTimeout(() => {
                    if (typeof window.openIncidentModal === 'function') {
                        window.openIncidentModal();
                    } else {
                        alert('Error: Fungsi modal tidak tersedia. Silakan refresh halaman.');
                    }
                }, 100);
            }
            return false;
        }

        // ===== INCIDENT CARD =====
        const card = e.target.closest('.incident-card');
        if (card && card.dataset.incidentId) {
            console.log('[CaseManagement] 🔔 CARD CLICKED via delegation, ID:', card.dataset.incidentId);
            e.preventDefault();
            e.stopPropagation();

            const incidentId = parseInt(card.dataset.incidentId);
            if (typeof window.openThreadModal === 'function') {
                window.openThreadModal(incidentId);
            } else {
                console.error('[CaseManagement] ❌ openThreadModal not defined!');
            }
            return false;
        }

        // ===== MODAL CLOSE (click outside) =====
        if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
            console.log('[CaseManagement] 🔔 MODAL BACKDROP CLICKED');
            if (e.target.id === 'incident-modal' && typeof window.closeIncidentModal === 'function') {
                window.closeIncidentModal();
            } else if (e.target.id === 'thread-modal' && typeof window.closeThreadModal === 'function') {
                window.closeThreadModal();
            }
        }
    }, true); // CAPTURE PHASE - gets event before bubbling

    // ===== KEYBOARD ACCESSIBILITY =====
    document.addEventListener('keydown', function(e) {
        // Enter/Space on cards
        if (e.key === 'Enter' || e.key === ' ') {
            const card = e.target.closest('.incident-card');
            if (card && card.dataset.incidentId) {
                e.preventDefault();
                console.log('[CaseManagement] 🔔 CARD ACTIVATED via keyboard');
                const incidentId = parseInt(card.dataset.incidentId);
                if (typeof window.openThreadModal === 'function') {
                    window.openThreadModal(incidentId);
                }
            }
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            const incidentModal = document.getElementById('incident-modal');
            const threadModal = document.getElementById('thread-modal');

            if (threadModal?.classList.contains('show')) {
                window.closeThreadModal?.();
            } else if (incidentModal?.classList.contains('show')) {
                window.closeIncidentModal?.();
            }
        }
    });

    // ===== IMMEDIATE VERIFICATION =====
    console.log('[CaseManagement] ✅ Module loaded. Function availability:');
    console.log('  - window.openIncidentModal:', typeof window.openIncidentModal);
    console.log('  - window.openThreadModal:', typeof window.openThreadModal);
    console.log('  - window.closeIncidentModal:', typeof window.closeIncidentModal);
    console.log('  - window.closeThreadModal:', typeof window.closeThreadModal);

    // ======================== FORCE SYNC POLLER v2.4 ========================
    // This poller guarantees button binding even if DOM loads late
    let pollAttempts = 0;
    const maxPollAttempts = 30; // 30 seconds max

    const syncBtn = setInterval(() => {
        pollAttempts++;
        const btn = document.getElementById('btn-add-incident');

        if (btn) {
            // Force direct onclick binding
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[CaseManagement] 🔔 GACOR: Tombol Tambah Evaluasi diklik!');
                window.openIncidentModal();
                return false;
            };
            console.log('✅ GACOR: Tombol Tambah Evaluasi Sinkron! (attempt ' + pollAttempts + ')');
            clearInterval(syncBtn);
        } else if (pollAttempts >= maxPollAttempts) {
            console.warn('[CaseManagement] ⚠️ Tombol btn-add-incident tidak ditemukan setelah ' + maxPollAttempts + ' detik');
            clearInterval(syncBtn);
        }
    }, 1000);

    // Also sync cards when they appear
    const syncCards = setInterval(() => {
        const cards = document.querySelectorAll('.incident-card:not([data-synced])');
        if (cards.length > 0) {
            cards.forEach(card => {
                const incidentId = card.dataset.incidentId;
                if (incidentId) {
                    card.onclick = function(e) {
                        e.preventDefault();
                        console.log('[CaseManagement] 🔔 GACOR: Card diklik via onclick binding, ID:', incidentId);
                        window.openThreadModal(parseInt(incidentId));
                    };
                    card.setAttribute('data-synced', 'true');
                }
            });
            console.log('✅ GACOR: ' + cards.length + ' card(s) disinkronkan!');
        }
    }, 2000);

    // Stop card sync after 60 seconds
    setTimeout(() => {
        clearInterval(syncCards);
        console.log('[CaseManagement] Card sync poller stopped after 60s');
    }, 60000);

})();

// ======================== GLOBAL FALLBACK (Outside IIFE) ========================
// Double-ensure functions are on window object
if (typeof window.openIncidentModal !== 'function') {
    console.error('[CaseManagement] ❌ CRITICAL: openIncidentModal not on window!');
}
if (typeof window.openThreadModal !== 'function') {
    console.error('[CaseManagement] ❌ CRITICAL: openThreadModal not on window!');
}

// Ultimate fallback - bind directly when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CaseManagement] DOMContentLoaded fallback check...');

    const btn = document.getElementById('btn-add-incident');
    if (btn && typeof window.openIncidentModal === 'function') {
        btn.onclick = function() {
            console.log('[CaseManagement] 🔔 DOMContentLoaded fallback: Tambah Evaluasi clicked');
            window.openIncidentModal();
        };
        console.log('[CaseManagement] ✅ DOMContentLoaded fallback: btn-add-incident bound');
    } else {
        console.warn('[CaseManagement] ⚠️ DOMContentLoaded: btn-add-incident not found or openIncidentModal not ready');
    }
});

// Window load fallback (fires after everything including images)
window.addEventListener('load', function() {
    console.log('[CaseManagement] Window load fallback check...');

    const btn = document.getElementById('btn-add-incident');
    if (btn && typeof window.openIncidentModal === 'function') {
        btn.onclick = function() {
            console.log('[CaseManagement] 🔔 Window load fallback: Tambah Evaluasi clicked');
            window.openIncidentModal();
        };
        console.log('[CaseManagement] ✅ Window load fallback: btn-add-incident bound');
    } else {
        console.warn('[CaseManagement] ⚠️ Window load: btn-add-incident not found or openIncidentModal not ready');
    }

    // Also sync any unsynced cards
    const cards = document.querySelectorAll('.incident-card:not([data-synced])');
    cards.forEach(card => {
        const incidentId = card.dataset.incidentId;
        if (incidentId && typeof window.openThreadModal === 'function') {
            card.onclick = function() {
                console.log('[CaseManagement] 🔔 Window load fallback: Card clicked, ID:', incidentId);
                window.openThreadModal(parseInt(incidentId));
            };
            card.setAttribute('data-synced', 'true');
        }
    });
    if (cards.length > 0) {
        console.log('[CaseManagement] ✅ Window load fallback: ' + cards.length + ' cards bound');
    }
});
