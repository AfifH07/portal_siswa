/**
 * timetable.js - Jadwal Pelajaran View
 * Displays all schedules in a grid format per day
 * Shows ALL sesi (Tahfidz → KBM → Diniyah) in each day table
 */

// ============================================
// GLOBAL STATE
// ============================================
let allSchedules = [];
let allClasses = [];
let masterJamBySesi = {}; // { tahfidz: [...], kbm: [...], diniyah: [...] }
let masterMapelKode = {}; // { 'Matematika': 'MTK', ... }
let allGuruMap = new Map(); // Deduplicated guru for legend

// Sesi order and config
const SESI_ORDER = ['tahfidz', 'kbm', 'diniyah'];
const SESI_CONFIG = {
    tahfidz: { icon: '🕌', label: 'TAHFIDZ', cssClass: 'tahfidz' },
    kbm: { icon: '📗', label: 'KBM', cssClass: 'kbm' },
    diniyah: { icon: '📖', label: 'DINIYAH', cssClass: 'diniyah' }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth-check to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize date display
    initDateDisplay();

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

// ============================================
// DATA LOADING
// ============================================
async function loadAllData() {
    try {
        // Load all data in order as specified
        // 1. Master Jam
        const masterJamRes = await window.apiFetch('core/master-jam/');
        if (masterJamRes && masterJamRes.ok) {
            const data = await masterJamRes.json();
            // Handle { data: { tahfidz: [...], kbm: [...], diniyah: [...] } } format
            if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                masterJamBySesi = data.data;
            } else {
                // Handle array format - group by sesi
                const jamList = Array.isArray(data) ? data : (data.results || []);
                masterJamBySesi = { tahfidz: [], kbm: [], diniyah: [] };
                jamList.forEach(jam => {
                    if (masterJamBySesi[jam.sesi]) {
                        masterJamBySesi[jam.sesi].push(jam);
                    }
                });
            }
            // Sort each sesi by jam_mulai ascending
            Object.keys(masterJamBySesi).forEach(sesi => {
                masterJamBySesi[sesi].sort((a, b) => {
                    if (a.jam_mulai && b.jam_mulai) {
                        return a.jam_mulai.localeCompare(b.jam_mulai);
                    }
                    return (a.jam_ke || 0) - (b.jam_ke || 0);
                });
            });
        }

        // 2. Classes
        const classesRes = await window.apiFetch('students/classes/');
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
                return (sectionA || '').localeCompare(sectionB || '');
            });
        }

        // 3. Master Mapel
        const masterMapelRes = await window.apiFetch('core/master-mapel/');
        if (masterMapelRes && masterMapelRes.ok) {
            const data = await masterMapelRes.json();
            const mapelList = Array.isArray(data) ? data : (data.results || data.data || []);
            masterMapelKode = {};
            mapelList.forEach(mapel => {
                if (mapel.nama) {
                    // Use kode if available, fallback to nama
                    masterMapelKode[mapel.nama] = mapel.kode || mapel.nama;
                }
            });
        }

        // 4. Schedules
        const schedulesRes = await window.apiFetch('schedules/?page_size=500&is_active=true');
        if (schedulesRes && schedulesRes.ok) {
            const data = await schedulesRes.json();
            allSchedules = Array.isArray(data) ? data : (data.results || []);
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
    // Total jadwal
    document.getElementById('stat-total-jadwal').textContent = allSchedules.length;

    // Unique guru
    const uniqueGuru = new Set(allSchedules.map(s => s.username));
    document.getElementById('stat-total-guru').textContent = uniqueGuru.size;

    // Unique kelas
    const uniqueKelas = new Set(allSchedules.map(s => s.kelas));
    document.getElementById('stat-total-kelas').textContent = uniqueKelas.size;

    // Unique mapel
    const uniqueMapel = new Set(allSchedules.map(s => s.mata_pelajaran).filter(Boolean));
    document.getElementById('stat-total-mapel').textContent = uniqueMapel.size;
}

// ============================================
// RENDERING
// ============================================
function renderTimetable() {
    const container = document.getElementById('timetable-container');
    const legendCard = document.getElementById('legend-card');

    if (allSchedules.length === 0) {
        container.innerHTML = `
            <div class="glass-card">
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <div class="empty-title">Belum Ada Jadwal</div>
                    <div class="empty-desc">Tidak ada jadwal yang aktif saat ini.</div>
                </div>
            </div>
        `;
        legendCard.style.display = 'none';
        return;
    }

    // Reset guru map for legend
    allGuruMap.clear();

    // Collect all guru for legend
    allSchedules.forEach(s => {
        if (!allGuruMap.has(s.username)) {
            allGuruMap.set(s.username, {
                username: s.username,
                name: s.guru_name || s.username,
                color: getGuruColor(s.username)
            });
        }
    });

    // Group schedules by day
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const schedulesByDay = {};
    days.forEach(day => {
        schedulesByDay[day] = allSchedules.filter(s => s.hari === day);
    });

    // Calculate column count for colspan
    const colCount = allClasses.length + 1; // +1 for JAM column

    // Render each day
    let html = '';
    days.forEach(day => {
        const daySchedules = schedulesByDay[day];
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
                                ${renderDayBody(day, daySchedules, colCount)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Render legend
    renderLegend();
}

function renderDayBody(day, daySchedules, colCount) {
    let bodyHtml = '';

    // Group day schedules by sesi
    const schedulesBySesi = {};
    SESI_ORDER.forEach(sesi => {
        schedulesBySesi[sesi] = daySchedules.filter(s => s.sesi === sesi);
    });

    // Render each sesi section
    SESI_ORDER.forEach(sesi => {
        const config = SESI_CONFIG[sesi];
        const sesiSchedules = schedulesBySesi[sesi];
        const jamList = masterJamBySesi[sesi] || [];

        // Subheader row
        bodyHtml += `
            <tr>
                <td colspan="${colCount}" class="sesi-subheader ${config.cssClass}">
                    ${config.icon} ${config.label}
                </td>
            </tr>
        `;

        // If no jam data for this sesi, show placeholder
        if (jamList.length === 0) {
            bodyHtml += `
                <tr>
                    <td colspan="${colCount}" style="padding: 16px; color: #9ca3af; font-style: italic; text-align: center;">
                        Tidak ada data jam untuk sesi ini
                    </td>
                </tr>
            `;
            return;
        }

        // Build schedule map for this sesi: { kelas: { jam_ke: schedule } }
        const scheduleMap = {};
        const rowspanMap = {};
        allClasses.forEach(kelas => {
            scheduleMap[kelas] = {};
            rowspanMap[kelas] = {};
        });

        sesiSchedules.forEach(schedule => {
            const kelas = schedule.kelas;
            if (!scheduleMap[kelas]) return;

            const jamKeStart = schedule.jam_ke;
            const jamKeEnd = schedule.jam_ke_akhir || schedule.jam_ke;
            const rowspan = jamKeEnd - jamKeStart + 1;

            scheduleMap[kelas][jamKeStart] = {
                schedule,
                rowspan,
                color: allGuruMap.get(schedule.username)?.color || '#6b7280'
            };

            for (let i = jamKeStart + 1; i <= jamKeEnd; i++) {
                rowspanMap[kelas][i] = true;
            }
        });

        // Render jam rows
        jamList.forEach(jam => {
            const jamMulai = formatTimeOnly(jam.jam_mulai);
            const jamSelesai = formatTimeOnly(jam.jam_selesai);

            bodyHtml += `<tr>`;

            // Jam column
            if (jamMulai) {
                bodyHtml += `
                    <td class="jam-cell">
                        <div class="jam-waktu-start">${jamMulai}</div>
                        <div class="jam-waktu-end">- ${jamSelesai || ''}</div>
                    </td>
                `;
            } else {
                bodyHtml += `
                    <td class="jam-cell">
                        <div class="jam-ke-fallback">Jam ${jam.jam_ke}</div>
                    </td>
                `;
            }

            // Class columns
            allClasses.forEach(kelas => {
                // Skip if this cell is spanned from above
                if (rowspanMap[kelas][jam.jam_ke]) {
                    return;
                }

                const cellData = scheduleMap[kelas][jam.jam_ke];
                if (cellData) {
                    const { schedule, rowspan, color } = cellData;
                    const rowspanAttr = rowspan > 1 ? `rowspan="${rowspan}"` : '';
                    const mapelNama = schedule.mata_pelajaran || '-';
                    const mapelDisplay = masterMapelKode[mapelNama] || mapelNama;

                    bodyHtml += `
                        <td ${rowspanAttr}>
                            <div class="schedule-cell" style="background: ${color};">
                                <div class="schedule-mapel">${mapelDisplay}</div>
                                <div class="schedule-guru">${schedule.guru_name || schedule.username}</div>
                            </div>
                        </td>
                    `;
                } else {
                    bodyHtml += `
                        <td>
                            <div class="empty-cell">-</div>
                        </td>
                    `;
                }
            });

            bodyHtml += `</tr>`;
        });
    });

    return bodyHtml;
}

function renderLegend() {
    const legendCard = document.getElementById('legend-card');
    const legendGrid = document.getElementById('legend-grid');

    if (allGuruMap.size === 0) {
        legendCard.style.display = 'none';
        return;
    }

    // Sort by name
    const sortedGuru = Array.from(allGuruMap.values()).sort((a, b) =>
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
 * Format time to HH:MM only.
 */
function formatTimeOnly(time) {
    if (!time) return null;
    return time.substring(0, 5);
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
