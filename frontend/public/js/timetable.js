/**
 * timetable.js - Jadwal Pelajaran View
 * Displays all schedules in a grid format per day
 */

// ============================================
// GLOBAL STATE
// ============================================
let allSchedules = [];
let allClasses = [];
let masterJamData = {};
let currentSesi = 'all';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth-check to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize date display
    initDateDisplay();

    // Setup sesi filter
    setupSesiFilter();

    // Load data
    await loadAllData();
});

function initDateDisplay() {
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = `📅 ${now.toLocaleDateString('id-ID', options)}`;
    }
}

function setupSesiFilter() {
    const filterContainer = document.getElementById('sesi-filter');
    if (!filterContainer) return;

    filterContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.sesi-pill');
        if (!pill) return;

        // Update active state
        filterContainer.querySelectorAll('.sesi-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        // Update current sesi and re-render
        currentSesi = pill.dataset.sesi;
        renderTimetable();
    });
}

// ============================================
// DATA LOADING
// ============================================
async function loadAllData() {
    try {
        // Load all data in parallel
        const [schedulesRes, classesRes, masterJamRes] = await Promise.all([
            window.apiFetch('schedules/'),
            window.apiFetch('students/classes/'),
            window.apiFetch('core/master-jam/')
        ]);

        // Parse schedules
        if (schedulesRes && schedulesRes.ok) {
            const data = await schedulesRes.json();
            allSchedules = Array.isArray(data) ? data : (data.results || []);
        }

        // Parse classes
        if (classesRes && classesRes.ok) {
            const data = await classesRes.json();
            allClasses = Array.isArray(data) ? data : (data.results || data.classes || []);
            // Sort classes: X A, X B, XI A, XI B, XII A, XII B, etc.
            allClasses.sort((a, b) => {
                const gradeOrder = { 'X': 1, 'XI': 2, 'XII': 3 };
                const [gradeA, sectionA] = a.split(' ');
                const [gradeB, sectionB] = b.split(' ');
                if (gradeOrder[gradeA] !== gradeOrder[gradeB]) {
                    return gradeOrder[gradeA] - gradeOrder[gradeB];
                }
                return sectionA.localeCompare(sectionB);
            });
        }

        // Parse master jam grouped by sesi
        if (masterJamRes && masterJamRes.ok) {
            const data = await masterJamRes.json();
            const jamList = Array.isArray(data) ? data : (data.results || []);
            // Group by sesi
            masterJamData = {};
            jamList.forEach(jam => {
                if (!masterJamData[jam.sesi]) {
                    masterJamData[jam.sesi] = [];
                }
                masterJamData[jam.sesi].push(jam);
            });
            // Sort each sesi by jam_ke
            Object.keys(masterJamData).forEach(sesi => {
                masterJamData[sesi].sort((a, b) => a.jam_ke - b.jam_ke);
            });
        }

        // Update stats and render
        updateStats();
        renderTimetable();

    } catch (error) {
        console.error('[TIMETABLE] Error loading data:', error);
        showError('Gagal memuat data jadwal');
    }
}

function updateStats() {
    // Filter by sesi if needed
    const filtered = currentSesi === 'all'
        ? allSchedules
        : allSchedules.filter(s => s.sesi === currentSesi);

    // Total jadwal
    document.getElementById('stat-total-jadwal').textContent = filtered.length;

    // Unique guru
    const uniqueGuru = new Set(filtered.map(s => s.username));
    document.getElementById('stat-total-guru').textContent = uniqueGuru.size;

    // Unique kelas
    const uniqueKelas = new Set(filtered.map(s => s.kelas));
    document.getElementById('stat-total-kelas').textContent = uniqueKelas.size;

    // Unique mapel
    const uniqueMapel = new Set(filtered.map(s => s.mata_pelajaran).filter(Boolean));
    document.getElementById('stat-total-mapel').textContent = uniqueMapel.size;
}

// ============================================
// RENDERING
// ============================================
function renderTimetable() {
    const container = document.getElementById('timetable-container');
    const legendCard = document.getElementById('legend-card');

    // Filter schedules by sesi
    const filtered = currentSesi === 'all'
        ? allSchedules
        : allSchedules.filter(s => s.sesi === currentSesi);

    // Update stats
    updateStats();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="glass-card">
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <div class="empty-title">Belum Ada Jadwal</div>
                    <div class="empty-desc">Tidak ada jadwal untuk sesi yang dipilih.</div>
                </div>
            </div>
        `;
        legendCard.style.display = 'none';
        return;
    }

    // Collect all unique guru for legend
    const guruMap = new Map();
    filtered.forEach(s => {
        if (!guruMap.has(s.username)) {
            guruMap.set(s.username, {
                username: s.username,
                name: s.guru_name || s.username,
                color: getGuruColor(s.username)
            });
        }
    });

    // Determine which jam slots to show based on sesi filter
    let jamSlots = [];
    if (currentSesi === 'all') {
        // Combine all sesi slots
        const allJamKe = new Set();
        Object.values(masterJamData).flat().forEach(jam => {
            allJamKe.add(jam.jam_ke);
        });
        // Create generic slots
        Array.from(allJamKe).sort((a, b) => a - b).forEach(jamKe => {
            // Find first matching jam data for waktu
            let waktu = '-';
            for (const sesi of Object.keys(masterJamData)) {
                const jam = masterJamData[sesi].find(j => j.jam_ke === jamKe);
                if (jam) {
                    waktu = formatWaktu(jam.jam_mulai, jam.jam_selesai);
                    break;
                }
            }
            jamSlots.push({ jam_ke: jamKe, waktu });
        });
    } else {
        // Use specific sesi jam slots
        const sesiJam = masterJamData[currentSesi] || [];
        jamSlots = sesiJam.map(jam => ({
            jam_ke: jam.jam_ke,
            waktu: formatWaktu(jam.jam_mulai, jam.jam_selesai)
        }));
    }

    // If no jam slots from master data, extract from schedules
    if (jamSlots.length === 0) {
        const jamKeSet = new Set();
        filtered.forEach(s => {
            if (s.jam_ke) jamKeSet.add(s.jam_ke);
            if (s.jam_ke_akhir) {
                for (let i = s.jam_ke; i <= s.jam_ke_akhir; i++) {
                    jamKeSet.add(i);
                }
            }
        });
        jamSlots = Array.from(jamKeSet).sort((a, b) => a - b).map(jamKe => ({
            jam_ke: jamKe,
            waktu: '-'
        }));
    }

    // Group schedules by day
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const schedulesByDay = {};
    days.forEach(day => {
        schedulesByDay[day] = filtered.filter(s => s.hari === day);
    });

    // Render each day
    let html = '';
    days.forEach(day => {
        const daySchedules = schedulesByDay[day];
        if (daySchedules.length === 0 && currentSesi !== 'all') return; // Skip empty days if filtered

        const dayIcon = day.toLowerCase();
        const dayLetter = day.charAt(0);

        html += `
            <div class="day-section">
                <div class="day-header">
                    <div class="day-icon ${dayIcon}">${dayLetter}</div>
                    <div>
                        <div class="day-title">${day}</div>
                        <div class="day-subtitle">${daySchedules.length} jadwal</div>
                    </div>
                </div>
                <div class="glass-card">
                    <div class="timetable-grid">
                        <table class="timetable-table">
                            <thead>
                                <tr>
                                    <th class="jam-col">JAM</th>
                                    ${allClasses.map(kelas => `<th>${kelas}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${renderDayRows(day, jamSlots, daySchedules, guruMap)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Render legend
    renderLegend(guruMap);
}

function renderDayRows(day, jamSlots, daySchedules, guruMap) {
    // Build a map of kelas -> jam_ke -> schedule (with rowspan tracking)
    const scheduleMap = {};
    const rowspanMap = {}; // Track which cells to skip due to rowspan

    allClasses.forEach(kelas => {
        scheduleMap[kelas] = {};
        rowspanMap[kelas] = {};
    });

    // Populate schedule map
    daySchedules.forEach(schedule => {
        const kelas = schedule.kelas;
        if (!scheduleMap[kelas]) return;

        const jamKeStart = schedule.jam_ke;
        const jamKeEnd = schedule.jam_ke_akhir || schedule.jam_ke;
        const rowspan = jamKeEnd - jamKeStart + 1;

        // Place in first jam slot
        scheduleMap[kelas][jamKeStart] = {
            schedule,
            rowspan,
            color: guruMap.get(schedule.username)?.color || '#6b7280'
        };

        // Mark subsequent slots as spanned
        for (let i = jamKeStart + 1; i <= jamKeEnd; i++) {
            rowspanMap[kelas][i] = true;
        }
    });

    // Render rows
    let rowsHtml = '';
    jamSlots.forEach(slot => {
        rowsHtml += `<tr>`;

        // Jam column
        rowsHtml += `
            <td class="jam-cell">
                <div class="jam-ke">${slot.jam_ke}</div>
                <div class="jam-waktu">${slot.waktu}</div>
            </td>
        `;

        // Class columns
        allClasses.forEach(kelas => {
            // Skip if this cell is spanned from above
            if (rowspanMap[kelas][slot.jam_ke]) {
                return; // Don't render <td>
            }

            const cellData = scheduleMap[kelas][slot.jam_ke];
            if (cellData) {
                const { schedule, rowspan, color } = cellData;
                const rowspanAttr = rowspan > 1 ? `rowspan="${rowspan}"` : '';
                rowsHtml += `
                    <td ${rowspanAttr}>
                        <div class="schedule-cell" style="background: ${color};">
                            <div class="schedule-mapel">${schedule.mata_pelajaran || '-'}</div>
                            <div class="schedule-guru">${schedule.guru_name || schedule.username}</div>
                        </div>
                    </td>
                `;
            } else {
                rowsHtml += `<td><span class="empty-cell">-</span></td>`;
            }
        });

        rowsHtml += `</tr>`;
    });

    return rowsHtml;
}

function renderLegend(guruMap) {
    const legendCard = document.getElementById('legend-card');
    const legendGrid = document.getElementById('legend-grid');

    if (guruMap.size === 0) {
        legendCard.style.display = 'none';
        return;
    }

    // Sort by name
    const sortedGuru = Array.from(guruMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    legendGrid.innerHTML = sortedGuru.map(guru => `
        <div class="legend-item">
            <div class="legend-color" style="background: ${guru.color};"></div>
            <div class="legend-name">${guru.name}</div>
        </div>
    `).join('');

    legendCard.style.display = 'block';
}

// ============================================
// UTILITIES
// ============================================

/**
 * Generate a consistent color for a guru based on username hash.
 * Uses HSL for pleasant, distinct colors.
 */
function getGuruColor(username) {
    if (!username) return '#6b7280';

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Format time range string.
 */
function formatWaktu(jamMulai, jamSelesai) {
    if (!jamMulai) return '-';

    const formatTime = (time) => {
        if (!time) return '';
        // Handle both "HH:MM:SS" and "HH:MM" formats
        return time.substring(0, 5);
    };

    const start = formatTime(jamMulai);
    const end = formatTime(jamSelesai);

    if (!end) return start;
    return `${start}-${end}`;
}

/**
 * Show error message.
 */
function showError(message) {
    const container = document.getElementById('timetable-container');
    container.innerHTML = `
        <div class="glass-card">
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Error</div>
                <div class="empty-desc">${message}</div>
            </div>
        </div>
    `;
}
