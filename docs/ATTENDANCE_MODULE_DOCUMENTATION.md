# Technical Documentation: Attendance Module
## Portal Ponpes Baron - Modul Absensi

---

## Daftar Isi

1. [Arsitektur & State Management](#1-arsitektur--state-management)
2. [Inisialisasi Halaman](#2-inisialisasi-halaman-page-load-algorithm)
3. [Alur Data (Data Flow)](#3-alur-data-data-flow)
4. [Event Handling & Interaksi Pengguna](#4-event-handling--interaksi-pengguna)
5. [Algoritma Pengumpulan & Pengiriman Data](#5-algoritma-pengumpulan--pengiriman-data)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Diagram Alur](#7-diagram-alur)

---

## 1. Arsitektur & State Management

### 1.1 Global State Variables

```javascript
// State untuk pagination tabel utama
let currentPage = 1;        // Halaman aktif saat ini
let totalPages = 1;         // Total halaman (dihitung dari count/page_size)
let attendanceData = [];    // Array hasil query riwayat absensi

// State untuk input absensi baru (modal)
let inputData = {
    kelas: '',              // Kelas yang dipilih (e.g., "XII A")
    mapel: '',              // Mata pelajaran (e.g., "Matematika")
    tanggal: '',            // Tanggal absensi (format: YYYY-MM-DD)
    students: [],           // Array siswa dari API
    records: {}             // Object untuk menyimpan status per NISN
};

let modalStep = 1;          // Step modal (1 = info kelas, 2 = input kehadiran)
```

### 1.2 Struktur Data `inputData.records`

```javascript
// Key: NISN siswa
// Value: Object dengan status dan keterangan
inputData.records = {
    "1234567890": { status: "Hadir", keterangan: "" },
    "1234567891": { status: "Sakit", keterangan: "Demam" },
    "1234567892": { status: "Alpha", keterangan: "" },
    // ... dst
};
```

**Mengapa menggunakan Object bukan Array?**
- **O(1) Lookup**: Akses langsung berdasarkan NISN tanpa perlu iterasi
- **Mudah di-update**: Langsung assign `records[nisn] = {...}`
- **Mencegah duplikasi**: NISN sebagai key unik

---

## 2. Inisialisasi Halaman (Page Load Algorithm)

### 2.1 Sequence Diagram

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Browser   │          │  Frontend   │          │   Backend   │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │  DOMContentLoaded      │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │                        │  GET /students/classes/│
       │                        │───────────────────────>│
       │                        │<───────────────────────│
       │                        │  { classes: [...] }    │
       │                        │                        │
       │                        │  GET /attendance/history/
       │                        │───────────────────────>│
       │                        │<───────────────────────│
       │                        │  { results: [...] }    │
       │                        │                        │
       │  Render Complete       │                        │
       │<───────────────────────│                        │
```

### 2.2 Algoritma Inisialisasi

```javascript
document.addEventListener('DOMContentLoaded', function() {
    // 1. Load opsi kelas ke semua dropdown
    loadClassOptions();     // Async - parallel execution

    // 2. Load opsi mata pelajaran (static list)
    loadSubjectOptions();   // Sync - immediate

    // 3. Load data riwayat absensi
    loadAttendanceData();   // Async - parallel execution

    // 4. Set tanggal default
    setDefaultDate();       // Sync - immediate
});
```

### 2.3 Fungsi `loadClassOptions()` - Detail

```
ALGORITHM: Load Class Options
─────────────────────────────────────────────────────────────
INPUT:  None
OUTPUT: Dropdown options populated

1. CALL API GET /students/classes/
2. IF response.ok THEN
     2.1 PARSE response as JSON
     2.2 FOR EACH select_id IN ['filter-kelas', 'input-kelas', 'export-kelas']:
         2.2.1 GET element by select_id
         2.2.2 SAVE current value (untuk preserve selection)
         2.2.3 CLEAR innerHTML
         2.2.4 ADD default option ("Semua Kelas" atau "-- Pilih Kelas --")
         2.2.5 FOR EACH class IN data.classes:
               ADD <option value="class">class</option>
         2.2.6 RESTORE saved value
3. ELSE
     3.1 LOG error to console
─────────────────────────────────────────────────────────────
```

**Catatan Penting:**
- Preserve current value mencegah reset dropdown saat refresh
- Tiga dropdown di-populate sekaligus untuk konsistensi

### 2.4 Fungsi `loadAttendanceData()` - Detail

```
ALGORITHM: Load Attendance History Data
─────────────────────────────────────────────────────────────
INPUT:  Filter values from DOM (kelas, start_date, end_date)
OUTPUT: Table rendered with data, stats updated

1. SHOW loading state in table body
   tbody.innerHTML = "Memuat data..."

2. BUILD query parameters:
   params = {
     page: currentPage,
     page_size: 10,
     kelas: (if not empty),
     start_date: (if not empty),
     end_date: (if not empty)
   }

3. CALL API GET /attendance/history/?{params}

4. IF response.ok THEN
     4.1 PARSE response as JSON
     4.2 STORE data.results → attendanceData
     4.3 CALCULATE totalPages = ceil(data.count / 10)
     4.4 CALL renderTable()      // DOM manipulation
     4.5 CALL updateStats(data)  // Update stat cards
     4.6 CALL updatePagination() // Update pagination controls
5. ELSE
     5.1 SHOW error message in table
─────────────────────────────────────────────────────────────
```

### 2.5 Fungsi `renderTable()` - DOM Manipulation

```
ALGORITHM: Render Attendance Table
─────────────────────────────────────────────────────────────
INPUT:  attendanceData (global state)
OUTPUT: Table rows rendered in DOM

1. GET tbody element

2. IF attendanceData.length === 0 THEN
     SHOW "Tidak ada data absensi" message
     RETURN

3. BUILD HTML string using map():
   FOR EACH item IN attendanceData:
     CREATE <tr> with:
       - Tanggal (formatted)
       - Kelas
       - Mata Pelajaran
       - Total Siswa
       - Hadir count
       - Sakit count
       - Izin count
       - Alpha count
       - Action button (viewDetail onclick)

4. SET tbody.innerHTML = joined HTML string

─────────────────────────────────────────────────────────────
Time Complexity: O(n) where n = number of records
Space Complexity: O(n) for the HTML string
```

---

## 3. Alur Data (Data Flow)

### 3.1 Diagram Alur Data Keseluruhan

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   HTML/DOM  │◄───│  JavaScript │◄───│    State    │             │
│  │  (View)     │    │  (Logic)    │    │  Variables  │             │
│  └─────────────┘    └──────┬──────┘    └─────────────┘             │
│                            │                                        │
│                            │ apiFetch()                             │
│                            ▼                                        │
│                    ┌───────────────┐                                │
│                    │  API Layer    │                                │
│                    │  (apiFetch)   │                                │
│                    └───────┬───────┘                                │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP Request (with JWT Token)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Django REST)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │    URLs     │───►│   Views     │───►│   Models    │             │
│  │  (Router)   │    │ (Business)  │    │    (ORM)    │             │
│  └─────────────┘    └─────────────┘    └──────┬──────┘             │
│                                               │                     │
│                                               ▼                     │
│                                       ┌─────────────┐              │
│                                       │  Database   │              │
│                                       │ (PostgreSQL)│              │
│                                       └─────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow: Input Absensi Baru

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: User clicks "Input Absensi"                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  openAddModal()                                                      │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  RESET STATE:                                                │    │
│  │  inputData = { kelas: '', mapel: '', tanggal: '', ... }     │    │
│  │  modalStep = 1                                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  SHOW Modal Step 1 (form: kelas, mapel, tanggal)                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: User fills form and clicks "Lanjut"                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  modalNext()                                                         │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  VALIDATE: kelas && mapel && tanggal must be filled         │    │
│  │  IF not valid → showToast('warning') → RETURN               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  STORE to inputData:                                         │    │
│  │  inputData.kelas = kelas                                     │    │
│  │  inputData.mapel = mapel                                     │    │
│  │  inputData.tanggal = tanggal                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  loadStudentsForInput(kelas, tanggal)                               │
│       │                                                              │
│       ▼                                                              │
│  POST /attendance/initialize/                                        │
│  Body: { kelas, tanggal, mata_pelajaran, waktu }                    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  IF response.ok:                                             │    │
│  │    students = response.data                                  │    │
│  │  ELSE (fallback):                                            │    │
│  │    GET /students/?kelas={kelas}                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  INITIALIZE inputData.records:                               │    │
│  │  FOR EACH student:                                           │    │
│  │    records[student.nisn] = {                                 │    │
│  │      status: student.status || null,                         │    │
│  │      keterangan: ''                                          │    │
│  │    }                                                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  renderStudentsList()                                                │
│  SHOW Modal Step 2 (list siswa dengan tombol H/S/I/A)               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: User inputs attendance and clicks "Simpan"                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  saveAttendance()                                                    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  VALIDATE: Check all students have status                   │    │
│  │  unfilled = students.filter(s => !records[s.nisn]?.status)  │    │
│  │  IF unfilled.length > 0 → showToast('warning') → RETURN     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  BUILD attendance_data array:                                │    │
│  │  [                                                           │    │
│  │    { nisn: "123", status: "Hadir", keterangan: "" },        │    │
│  │    { nisn: "124", status: "Sakit", keterangan: "Flu" },     │    │
│  │    ...                                                       │    │
│  │  ]                                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  POST /attendance/batch/                                             │
│  Body: {                                                             │
│    kelas: "XII A",                                                   │
│    tanggal: "2024-02-07",                                           │
│    mata_pelajaran: "Matematika",                                    │
│    waktu: "Pagi",                                                    │
│    attendance_data: [...]                                            │
│  }                                                                   │
│       │                                                              │
│       ▼                                                              │
│  IF success:                                                         │
│    showToast('success')                                              │
│    closeAddModal()                                                   │
│    loadAttendanceData()  ← Refresh table                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Event Handling & Interaksi Pengguna

### 4.1 Status Toggle (H/S/I/A Button)

#### Algoritma

```
ALGORITHM: Set Student Attendance Status
─────────────────────────────────────────────────────────────
INPUT:  nisn (string), status (string: "Hadir"|"Sakit"|"Izin"|"Alpha")
OUTPUT: Updated state and UI

FUNCTION setStatus(nisn, status):

    // 1. Update State
    inputData.records[nisn] = {
        status: status,
        keterangan: ''
    }

    // 2. Update UI (Visual Feedback)
    row = document.querySelector(`.student-row[data-nisn="${nisn}"]`)

    IF row EXISTS:
        // 2.1 Remove 'active' class from all buttons
        FOR EACH button IN row.querySelectorAll('.status-btn'):
            button.classList.remove('active')

        // 2.2 Add 'active' class to clicked button
        targetButton = row.querySelector(`.status-btn.${status.toLowerCase()}`)
        targetButton.classList.add('active')

    // 3. Update Summary Counter (reactive)
    updateCounts()

─────────────────────────────────────────────────────────────
Time Complexity: O(1) for state update, O(4) for UI update
```

#### Visual Feedback - CSS Classes

```css
/* Default state */
.status-btn {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
}

/* Active states dengan warna berbeda per status */
.status-btn.active.hadir {
    background: rgba(16, 185, 129, 0.3);  /* Green */
    border-color: #10b981;
    color: #10b981;
}

.status-btn.active.sakit {
    background: rgba(245, 158, 11, 0.3);  /* Yellow/Orange */
    border-color: #f59e0b;
    color: #f59e0b;
}

.status-btn.active.izin {
    background: rgba(59, 130, 246, 0.3);  /* Blue */
    border-color: #3b82f6;
    color: #3b82f6;
}

.status-btn.active.alpha {
    background: rgba(239, 68, 68, 0.3);   /* Red */
    border-color: #ef4444;
    color: #ef4444;
}
```

### 4.2 Mark All Present

#### Algoritma

```
ALGORITHM: Mark All Students as Present
─────────────────────────────────────────────────────────────
INPUT:  None (uses global inputData.students)
OUTPUT: All students marked as "Hadir"

FUNCTION markAllPresent():

    // 1. Loop through all students and update records
    FOR EACH student IN inputData.students:
        inputData.records[student.nisn] = {
            status: 'Hadir',
            keterangan: ''
        }

    // 2. Re-render entire list (simpler than updating each button)
    renderStudentsList()

    // Note: renderStudentsList() internally calls updateCounts()

─────────────────────────────────────────────────────────────
Time Complexity: O(n) where n = number of students
```

#### Mengapa Re-render vs Individual Update?

| Pendekatan | Pros | Cons |
|------------|------|------|
| **Re-render (dipilih)** | Kode lebih sederhana, konsisten state | Sedikit lebih lambat untuk list besar |
| **Individual Update** | Lebih efisien untuk list besar | Kode lebih kompleks, risiko race condition |

Untuk kasus ini dengan ~30-40 siswa per kelas, re-render lebih praktis.

### 4.3 Real-time Counter (Reactive Summary)

#### Algoritma

```
ALGORITHM: Update Attendance Counts (Reactive)
─────────────────────────────────────────────────────────────
INPUT:  None (reads from inputData.records)
OUTPUT: Updated counter display in DOM

FUNCTION updateCounts():

    // 1. Initialize counters
    hadir = 0
    sakit = 0
    izin = 0
    alpha = 0

    // 2. Iterate through all records
    FOR EACH record IN Object.values(inputData.records):
        SWITCH record.status:
            CASE 'Hadir': hadir++
            CASE 'Sakit': sakit++
            CASE 'Izin':  izin++
            CASE 'Alpha': alpha++

    // 3. Update DOM
    document.getElementById('count-hadir').textContent = hadir
    document.getElementById('count-sakit').textContent = sakit
    document.getElementById('count-izin').textContent = izin
    document.getElementById('count-alpha').textContent = alpha

─────────────────────────────────────────────────────────────
Time Complexity: O(n) where n = number of students
Called: After every setStatus() or markAllPresent()
```

#### Diagram Reactive Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User clicks    │────►│  setStatus()    │────►│  updateCounts() │
│  H/S/I/A button │     │  updates state  │     │  updates DOM    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                 ┌───────────────┐
                                                 │ Summary shows │
                                                 │ Hadir: 25     │
                                                 │ Sakit: 2      │
                                                 │ Izin: 1       │
                                                 │ Alpha: 0      │
                                                 └───────────────┘
```

---

## 5. Algoritma Pengumpulan & Pengiriman Data

### 5.1 Validasi Sebelum Submit

```
ALGORITHM: Validate Before Save
─────────────────────────────────────────────────────────────
INPUT:  inputData.students, inputData.records
OUTPUT: Boolean (valid/invalid) + user feedback

FUNCTION validateBeforeSave():

    // Find students without status
    unfilled = inputData.students.filter(student => {
        record = inputData.records[student.nisn]
        RETURN !record OR !record.status
    })

    IF unfilled.length > 0:
        showToast(`${unfilled.length} siswa belum diisi statusnya`, 'warning')
        RETURN false

    RETURN true

─────────────────────────────────────────────────────────────
```

### 5.2 Transformasi Data untuk API

```
ALGORITHM: Transform Data for API
─────────────────────────────────────────────────────────────
INPUT:  inputData (state object)
OUTPUT: API-ready payload

FUNCTION buildPayload():

    // Transform records object to array format
    attendance_data = inputData.students.map(student => ({
        nisn: student.nisn,
        status: inputData.records[student.nisn].status,
        keterangan: inputData.records[student.nisn].keterangan || ''
    }))

    // Build final payload
    payload = {
        kelas: inputData.kelas,           // "XII A"
        tanggal: inputData.tanggal,       // "2024-02-07"
        mata_pelajaran: inputData.mapel,  // "Matematika"
        waktu: "Pagi",                    // Static value
        attendance_data: attendance_data   // Array of {nisn, status, keterangan}
    }

    RETURN JSON.stringify(payload)

─────────────────────────────────────────────────────────────
```

### 5.3 Contoh Payload yang Dikirim

```json
{
    "kelas": "XII A",
    "tanggal": "2024-02-07",
    "mata_pelajaran": "Matematika",
    "waktu": "Pagi",
    "attendance_data": [
        {
            "nisn": "1234567890",
            "status": "Hadir",
            "keterangan": ""
        },
        {
            "nisn": "1234567891",
            "status": "Sakit",
            "keterangan": "Demam"
        },
        {
            "nisn": "1234567892",
            "status": "Izin",
            "keterangan": "Acara keluarga"
        },
        {
            "nisn": "1234567893",
            "status": "Alpha",
            "keterangan": ""
        }
    ]
}
```

---

## 6. API Endpoints Reference

### 6.1 Endpoints yang Digunakan

| Method | Endpoint | Fungsi | Request Body | Response |
|--------|----------|--------|--------------|----------|
| `GET` | `/students/classes/` | Load daftar kelas | - | `{ success, classes: ["X A", "XI B", ...] }` |
| `GET` | `/attendance/history/` | Load riwayat absensi | Query params: `page`, `page_size`, `kelas`, `start_date`, `end_date` | `{ success, count, results: [...] }` |
| `POST` | `/attendance/initialize/` | Inisialisasi absensi + get siswa | `{ kelas, tanggal, mata_pelajaran, waktu }` | `{ success, data: [{nisn, nama, status}, ...] }` |
| `POST` | `/attendance/batch/` | Simpan absensi batch | `{ kelas, tanggal, mata_pelajaran, waktu, attendance_data: [...] }` | `{ success, message }` |
| `GET` | `/attendance/class/{kelas}/{tanggal}/` | Detail absensi per kelas per tanggal | - | `{ success, attendance_data: [...] }` |
| `GET` | `/students/?kelas={kelas}` | Fallback: get siswa langsung | Query param: `kelas` | `{ success, students: [...] }` |

### 6.2 Response Structure

#### GET /attendance/history/

```json
{
    "success": true,
    "count": 45,
    "page": 1,
    "page_size": 10,
    "next": true,
    "previous": false,
    "results": [
        {
            "id": "2024-02-07_XII A",
            "tanggal": "2024-02-07",
            "kelas": "XII A",
            "mata_pelajaran": "Matematika",
            "total_students": 28,
            "hadir": 25,
            "sakit": 2,
            "izin": 1,
            "alpha": 0
        }
    ]
}
```

#### POST /attendance/initialize/

```json
{
    "success": true,
    "draft_id": 123,
    "data": [
        {
            "nisn": "1234567890",
            "nama": "Ahmad Fauzi",
            "status": null
        },
        {
            "nisn": "1234567891",
            "nama": "Budi Santoso",
            "status": "Hadir"  // Jika sudah ada data sebelumnya
        }
    ]
}
```

---

## 7. Diagram Alur

### 7.1 Flowchart: Input Absensi Lengkap

```
                            ┌─────────────┐
                            │    START    │
                            └──────┬──────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  User clicks "Input      │
                    │  Absensi" button         │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  openAddModal()          │
                    │  - Reset state           │
                    │  - Show Step 1           │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  User fills:             │
                    │  - Kelas                 │
                    │  - Mata Pelajaran        │
                    │  - Tanggal               │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  User clicks "Lanjut"    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  modalNext()             │
                    │  - Validate form         │
                    └────────────┬─────────────┘
                                 │
                      ┌──────────┴──────────┐
                      │                     │
                      ▼                     ▼
              ┌───────────┐         ┌───────────────┐
              │  Invalid  │         │    Valid      │
              └─────┬─────┘         └───────┬───────┘
                    │                       │
                    ▼                       ▼
        ┌─────────────────┐     ┌─────────────────────┐
        │ showToast       │     │ loadStudentsForInput│
        │ ('warning')     │     │ - POST /initialize/ │
        └─────────────────┘     └──────────┬──────────┘
                                           │
                                           ▼
                               ┌─────────────────────┐
                               │ renderStudentsList()│
                               │ - Create DOM rows   │
                               │ - Show Step 2       │
                               └──────────┬──────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
                    ▼                                           ▼
        ┌─────────────────────┐                   ┌─────────────────────┐
        │  User clicks        │                   │  User clicks        │
        │  H/S/I/A buttons    │                   │  "Semua Hadir"      │
        └──────────┬──────────┘                   └──────────┬──────────┘
                   │                                         │
                   ▼                                         ▼
        ┌─────────────────────┐                   ┌─────────────────────┐
        │  setStatus()        │                   │  markAllPresent()   │
        │  - Update record    │                   │  - Loop all students│
        │  - Update UI        │                   │  - Set all "Hadir"  │
        │  - updateCounts()   │                   │  - Re-render list   │
        └──────────┬──────────┘                   └──────────┬──────────┘
                   │                                         │
                   └────────────────┬────────────────────────┘
                                    │
                                    ▼
                       ┌─────────────────────┐
                       │  User clicks        │
                       │  "Simpan"           │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  saveAttendance()   │
                       │  - Validate all     │
                       │    students filled  │
                       └──────────┬──────────┘
                                  │
                        ┌─────────┴─────────┐
                        │                   │
                        ▼                   ▼
                ┌───────────┐       ┌───────────────┐
                │ Not Valid │       │    Valid      │
                └─────┬─────┘       └───────┬───────┘
                      │                     │
                      ▼                     ▼
          ┌─────────────────┐    ┌─────────────────────┐
          │ showToast       │    │ POST /attendance/   │
          │ ('warning')     │    │      /batch/        │
          └─────────────────┘    └──────────┬──────────┘
                                            │
                                  ┌─────────┴─────────┐
                                  │                   │
                                  ▼                   ▼
                          ┌───────────┐       ┌───────────────┐
                          │  Failed   │       │   Success     │
                          └─────┬─────┘       └───────┬───────┘
                                │                     │
                                ▼                     ▼
                    ┌─────────────────┐    ┌─────────────────────┐
                    │ showToast       │    │ showToast('success')│
                    │ ('error')       │    │ closeAddModal()     │
                    └─────────────────┘    │ loadAttendanceData()│
                                           └──────────┬──────────┘
                                                      │
                                                      ▼
                                                ┌───────────┐
                                                │    END    │
                                                └───────────┘
```

### 7.2 State Machine: Modal Steps

```
                    ┌─────────────────┐
                    │  Modal Closed   │
                    │   (hidden)      │
                    └────────┬────────┘
                             │ openAddModal()
                             ▼
              ┌──────────────────────────────┐
              │         STEP 1               │
              │  ┌─────────────────────┐     │
              │  │ Form:               │     │
              │  │ - Kelas dropdown    │     │
              │  │ - Mapel dropdown    │     │
              │  │ - Tanggal input     │     │
              │  └─────────────────────┘     │
              │                              │
              │  [Batal]        [Lanjut →]   │
              └────────────────┬─────────────┘
                               │ modalNext()
                               │ (if valid)
                               ▼
              ┌──────────────────────────────┐
              │         STEP 2               │
              │  ┌─────────────────────┐     │
              │  │ Student List:       │     │
              │  │ ┌─────────────────┐ │     │
              │  │ │ Ahmad    [H][S][I][A] │ │
              │  │ │ Budi     [H][S][I][A] │ │
              │  │ │ ...               │ │     │
              │  │ └─────────────────┘ │     │
              │  │                     │     │
              │  │ Summary:            │     │
              │  │ H:25 S:2 I:1 A:0   │     │
              │  └─────────────────────┘     │
              │                              │
              │  [← Kembali]   [💾 Simpan]   │
              └──────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    modalBack()        closeAddModal()    saveAttendance()
              │                │                │
              ▼                ▼                ▼
         Back to          Close Modal      Submit & Close
          Step 1           (cancel)         (if success)
```

---

## Appendix A: Kode Referensi Cepat

### A.1 Quick Reference: Fungsi Utama

```javascript
// === INISIALISASI ===
loadClassOptions()       // Load dropdown kelas
loadSubjectOptions()     // Load dropdown mapel
loadAttendanceData()     // Load tabel riwayat
setDefaultDate()         // Set tanggal default

// === MODAL INPUT ===
openAddModal()           // Buka modal, reset state
closeAddModal()          // Tutup modal
modalNext()              // Step 1 → Step 2
modalBack()              // Step 2 → Step 1

// === INPUT KEHADIRAN ===
loadStudentsForInput()   // Load siswa untuk input
renderStudentsList()     // Render list siswa di DOM
setStatus(nisn, status)  // Set status individual
markAllPresent()         // Set semua hadir
updateCounts()           // Update summary counter
saveAttendance()         // Simpan ke backend

// === VIEW DETAIL ===
viewDetail(kelas, tgl)   // Lihat detail absensi
closeDetailModal()       // Tutup modal detail
printDetail()            // Print halaman

// === EXPORT ===
exportData()             // Buka modal export
closeExportModal()       // Tutup modal export
executeExport()          // Eksekusi export
exportToCSV()            // Generate file CSV
exportToPDF()            // Generate printable PDF

// === UTILITIES ===
formatDate(dateStr)      // Format tanggal Indonesia
showToast(msg, type)     // Tampilkan notifikasi
goToPage(direction)      // Navigasi pagination
resetFilters()           // Reset filter ke default
```

---

**Dokumentasi ini dibuat untuk Portal Ponpes Baron - Modul Absensi**
*Last Updated: February 2024*
