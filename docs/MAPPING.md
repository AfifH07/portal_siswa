# Code.gs ↔ Node.js/Express Mapping

## 📋 Google Apps Script Functions → Node.js API

### Authentication (Lines 124-293)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `validateLogin(username, password)` | `POST /api/auth/login` | authController.login | ✅ |
| `changePassword(username, oldPass, newPass)` | `POST /api/auth/change-password` | authController.changePassword | ✅ |
| `requestPasswordReset(username)` | `POST /api/auth/request-reset` | authController.requestPasswordReset | ✅ |
| `resetPassword(username, token, newPass)` | `POST /api/auth/reset-password` | authController.resetPassword | ✅ |

### Dashboard Statistics (Lines 298-538)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getDashboardStats(username)` | `GET /api/dashboard/stats` | dashboardController.getDashboardStats | ⏳ |
| `getAttendanceChartData(username, months)` | `GET /api/dashboard/attendance-chart` | dashboardController.getAttendanceChartData | ⏳ |
| `getGradesDistribution(username)` | `GET /api/dashboard/grades-distribution` | dashboardController.getGradesDistribution | ⏳ |

### User Management (Lines 543-664)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getAllUsers(username)` | `GET /api/users` | usersController.getAllUsers | ⏳ |
| `addUser(admin, user, pass, role, name, nisn, email)` | `POST /api/users` | usersController.addUser | ⏳ |
| `updateUser(admin, oldUser, user, pass, role, name, nisn, email)` | `PUT /api/users/:username` | usersController.updateUser | ⏳ |
| `deleteUser(admin, username)` | `DELETE /api/users/:username` | usersController.deleteUser | ⏳ |

### Upload Functions (Lines 669-687)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `uploadPhotoToDrive(base64, fileName, nisn, tanggal)` | `POST /api/upload/photo` | uploadController.uploadPhoto | ⏳ |

### Admin & Student Functions (Lines 689-828)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getAllStudents(username)` | `GET /api/students` | attendanceController.getAllStudents | ⏳ |
| `initializeDailyAttendance(username)` | `POST /api/attendance/initialize` | attendanceController.initializeDailyAttendance | ⏳ |
| `saveAttendance(username, nisn, tanggal, waktu, status, ket, kelas)` | `POST /api/attendance` | attendanceController.saveAttendance | ⏳ |
| `saveBatchAttendance(username, kelas, tanggal, mapel, jams, students)` | `POST /api/attendance/batch` | attendanceController.saveBatchAttendance | ⏳ |

### Evaluation Functions (Lines 830-860)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `saveEvaluation(username, nisn, tanggal, jenis, evaluator, name, nama, summary, photo, tindak)` | `POST /api/evaluations` | evaluationsController.saveEvaluation | ⏳ |

### Grade Functions (Lines 862-890)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `saveGrade(username, nisn, mapel, nilai, sem, tahun, jenis, kelas)` | `POST /api/grades` | gradesController.saveGrade | ⏳ |

### User Data Retrieval (Lines 887-1152)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getTodayAttendance(nisn)` | `GET /api/attendance/today/:nisn` | attendanceController.getTodayAttendance | ⏳ |
| `getMonthlyAttendance(nisn, month, year)` | `GET /api/attendance/monthly/:nisn` | attendanceController.getMonthlyAttendance | ⏳ |
| `getAttendanceStats(nisn, month, year)` | `GET /api/attendance/stats/:nisn` | attendanceController.getAttendanceStats | ⏳ |
| `getEvaluationDetails(nisn, date)` | `GET /api/evaluations/:nisn/:date` | evaluationsController.getEvaluationDetails | ⏳ |
| `getGrades(nisn)` | `GET /api/grades/:nisn` | gradesController.getGrades | ⏳ |
| `getStudentDashboard(nisn, month, year)` | `GET /api/student/dashboard/:nisn` | dashboardController.getStudentDashboard | ⏳ |

### Get All Data for Admin (Lines 1157-1419)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getAllAttendance(username)` | `GET /api/attendance/all` | attendanceController.getAllAttendance | ⏳ |
| `getAllGrades(username)` | `GET /api/grades/all` | gradesController.getAllGrades | ⏳ |
| `getAllEvaluations(username)` | `GET /api/evaluations/all` | evaluationsController.getAllEvaluations | ⏳ |

### Batch Attendance (Lines 1446-1496)

| Code.gs Function | Node.js API | Controller | Status |
|----------------|-------------|-------------|---------|
| `getDistinctClasses(username)` | `GET /api/students/classes` | attendanceController.getDistinctClasses | ⏳ |
| `getPreviousDayAttendance(kelas, tanggal)` | `GET /api/attendance/previous/:kelas/:tanggal` | attendanceController.getPreviousDayAttendance | ⏳ |

## 📊 Google Sheets → Database Tables

### Sheet Mapping

| Google Sheet | Database Table | Model | Columns |
|-------------|----------------|-------|---------|
| **Sheet: Users** | `users` | User.js | id, username, password, role, name, nisn, email |
| **Sheet: Siswa** | `students` | Student.js | id, nisn, nama, kelas, program |
| **Sheet: Absensi** | `attendance` | Attendance.js | id, nisn, tanggal, waktu, status, keterangan |
| **Sheet: Nilai** | `grades` | Grade.js | id, nisn, mata_pelajaran, nilai, semester, tahun_ajaran, jenis_ujian |
| **Sheet: Evaluasi** | `evaluations` | Evaluation.js | id, nisn, tanggal, jenis, evaluator, nama_evaluator, nama_siswa, summary, foto_url, tindak_lanjut |
| **Sheet: ResetPassword** | `reset_tokens` | ResetToken.js | id, username, token, status, created_at |
| **Sheet: Jadwal** | `schedules` | Schedule.js | id, username, kelas, hari, jam, mata_pelajaran |
| **Sheet: AttendanceDraft** | `attendance_draft` | AttendanceDraft.js | id, username, kelas, tanggal, mata_pelajaran, data (JSON) |

### Field Mapping Examples

#### Users
| Google Sheets | Database |
|--------------|----------|
| Column A: username | username |
| Column B: password | password |
| Column C: role | role |
| Column D: name | name |
| Column E: nisn | nisn |
| Column F: email | email |

#### Students
| Google Sheets | Database |
|--------------|----------|
| Column A: nisn | nisn |
| Column B: - | - |
| Column C: nama | nama |
| Column D: kelas | kelas |
| Column E: program | program |

#### Attendance
| Google Sheets | Database |
|--------------|----------|
| Column A: nisn | nisn |
| Column B: tanggal (dd/mm/yyyy) | tanggal (YYYY-MM-DD) |
| Column C: waktu | waktu |
| Column D: status | status |
| Column E: keterangan | keterangan |

## 🔄 Google Apps Script Services → Node.js Modules

### SpreadsheetApp → Database
```javascript
// GASPREADSHEET (lama)
var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName('Siswa');
var data = sheet.getDataRange().getValues();

// NODE (baru)
const Student = require('../models/Student');
const students = await Student.findAll();
```

### DriveApp → File System
```javascript
// GDRIVE (lama)
var folder = DriveApp.createFolder('Folder Evaluasi Siswa');
var file = folder.createFile(blob);

// NODE (baru)
const multer = require('multer');
const upload = multer({ dest: './uploads' });
// File tersimpan di: ./uploads/
```

### Utilities → Node.js Modules
```javascript
// GAS (lama)
Utilities.formatDate(date, timeZone, format);
Utilities.base64Decode(base64);
Utilities.newBlob(data, mimeType, name);

// NODE (baru)
const moment = require('moment');
moment(date).format('DD/MM/YYYY');
Buffer.from(base64, 'base64');
const fs = require('fs');
fs.writeFileSync(filePath, data);
```

### HtmlService → Express Static
```javascript
// GAS (lama)
return HtmlService.createHtmlOutputFromFile('Index')
  .setTitle('Portal Siswa');

// NODE (baru)
app.use(express.static('frontend/public'));
res.sendFile('index.html');
```

## 📤 Parameter Mapping

### Input Format Changes

| GAS (lama) | Node.js (baru) |
|------------|---------------|
| `validateLogin(username, password)` | `POST /api/auth/login` with `{ username, password }` in body |
| `saveAttendance(user, nisn, tanggal, waktu, status, ket, kelas)` | `POST /api/attendance` with object in body |
| `getStudentDashboard(nisn, month, year)` | `GET /api/student/dashboard/:nisn?month=1&year=2026` |
| Date: '21/01/2026' | Date: '2026-01-21' (ISO format) |
| Array/Map of values | JSON objects |
| `return { success: true, data: [...] }` | `res.json({ success: true, data: [...] })` |

## 🔐 Authentication Changes

### GAS (Google Apps Script)
- Session-based (implicit)
- Google handles authentication
- `checkPermission()` helper function

### Node.js
- JWT token-based
- Token in header: `Authorization: Bearer <token>`
- Middleware validates each request

```javascript
// Example JWT usage
// After login
const token = generateToken({ username, role, name });
localStorage.setItem('token', token);

// In subsequent requests
fetch('/api/dashboard/stats', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
});
```

## 📝 Date Handling Changes

### Format Changes

| Context | GAS | Node.js |
|---------|-----|----------|
| Display | 21/01/2026 | 21/01/2026 |
| Storage | 21/01/2026 | 2026-01-21 |
| API Input | 21/01/2026 | 2026-01-21 |
| Database | string | DATE type |

```javascript
// Date conversion helpers di backend/utils/date.js
formatDate(date) → '21/01/2026' (display)
formatDatabaseDate(date) → '2026-01-21' (storage/API)
parseDate('21/01/2026') → Date object
```

## 📦 Frontend Changes Summary

### HTML
- Add `<link rel="stylesheet" href="/css/style.css">`
- Add `<script src="/js/app.js"></script>`
- Remove inline `<style>` and `<script>`

### JavaScript
- Replace `google.script.run` with `fetch()`
- Add token to headers for authenticated requests
- Handle JSON responses instead of GAS callbacks

### Example Conversion

```javascript
// GAS (lama)
google.script.run
  .withSuccessHandler(function(result) {
    if (result.success) {
      displayData(result.data);
    }
  })
  .getAllStudents('admin');

// Node.js (baru)
async function loadStudents() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/students', {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  const result = await res.json();
  if (result.success) {
    displayData(result.students);
  }
}
```

---

**Total Functions in Code.gs**: ~35
**Functions Migrated**: 4 (auth only - 11%)
**Functions Pending**: 31 (89%)

Dokumentasi lengkap di README.md, MIGRASI.md, QUICKSTART.md
