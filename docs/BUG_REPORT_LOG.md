# BUG REPORT LOG - Portal Siswa
### Deep Scan Audit Report
**Date:** 2026-02-05
**Auditor:** Claude Code (Automated QA Scan)
**Scope:** Full codebase - Frontend JS, HTML Templates, Django Backend, Node.js Backend
**Total Issues Found:** 140

---

## STATISTICS SUMMARY

| Severity | Frontend JS | HTML Templates | Django Backend | Node.js Backend | **TOTAL** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **CRITICAL** | 5 | 1 | 6 | 6 | **18** |
| **HIGH** | 18 | 3 | 11 | 11 | **43** |
| **MEDIUM** | 24 | 3 | 12 | 10 | **49** |
| **LOW** | 10 | 2 | 13 | 4 | **29** |
| **TOTAL** | **57** | **9** | **42** | **31** | **140** (1 overlap removed) |

---

## SECTION 1: CRITICAL ISSUES (18)

| # | SEVERITY | FILE PATH | LINE (Est.) | CATEGORY | ISSUE DESCRIPTION |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **CRITICAL** | `frontend/public/js/grades.js` | 316 | ReferenceError | `api.getClass()` dipanggil tapi method yang ada adalah `api.getClasses()` (line 42). TypeError akan muncul, dropdown kelas tidak akan pernah terisi. |
| 2 | **CRITICAL** | `frontend/public/js/grades.js` | 424 | Wrong Type | `mataPelajaran` di `saveAllGrades()` adalah DOM element (`getElementById`), bukan `.value`. API menerima string `[object HTMLElement]` bukan nilai sebenarnya. |
| 3 | **CRITICAL** | `frontend/public/js/grades.js` | 557 | Wrong Type | `importExcel()` — `mataPelajaran` juga DOM element, bukan `.value`. `formData.append('mata_pelajaran', mataPelajaran)` mengirim `[object HTMLElement]`. Validasi `!mataPelajaran` selalu truthy karena element ada. |
| 4 | **CRITICAL** | `frontend/public/js/evaluations.js` | 111 | ReferenceError | `switchView()` dipanggil di `initializeViews()` dan di-export ke `window.switchView` (line 724), tapi fungsi ini **tidak pernah didefinisikan** di file manapun. Halaman evaluations akan crash saat load. |
| 5 | **CRITICAL** | `frontend/public/js/students.js` | 49, 270, 353, 576 | ReferenceError | `getUser()`, `apiCall()`, `getUserRole()` dipanggil tapi tidak didefinisikan di file ini. Bergantung pada script eksternal — jika gagal load, seluruh modul rusak. |
| 6 | **CRITICAL** | `frontend/public/js/auth-check.js` | 281-340 | URL Construction | `apiFetch` di auth-check.js **tidak** menggunakan `API_CONFIG.buildUrl()`. URL dikirim langsung ke `fetch()`. Caller seperti `dashboard.js` yang memanggil `window.apiFetch('users/me/')` akan mengarah ke URL relatif yang salah (404). |
| 7 | **CRITICAL** | `frontend/public/js/apiFetch.js` + `auth-check.js` | 1, 379 | Variable Overwrite | `window.apiFetch` didefinisikan di `apiFetch.js`, lalu **ditimpa total** oleh `auth-check.js` (line 379) dengan implementasi yang berbeda (tanpa `buildUrl`). Semua API call melalui `window.apiFetch` rusak. |
| 8 | **CRITICAL** | `frontend/public/js/api-helper.js` | 15 | Naming Conflict | Method bernama `fetch` pada `apiClient` — panggilan internal `fetch(url)` (line 15) mengarah ke `window.fetch`, tapi jika di-destructure (`const { fetch } = apiClient`) akan terjadi infinite recursion. |
| 9 | **CRITICAL** | `frontend/views/index.html` | 45-88 | XSS | `loadDashboardContent()` menggunakan `innerHTML` dengan `${userName}` dan `${role}` dari `localStorage` tanpa escaping. Attacker yang bisa modify localStorage dapat inject HTML/JS. |
| 10 | **CRITICAL** | `backend_django/backend_django/settings.py` | 11 | Security | `SECRET_KEY = 'abc123xyz789abc123xyz789abc123xyz'` hardcoded langsung di source code. Juga dipakai sebagai JWT `SIGNING_KEY` (line 167). Siapapun dengan akses repo bisa forge JWT token. |
| 11 | **CRITICAL** | `backend_django/apps/accounts/views.py` | 61-72 | IDOR | `change_password_view` mengambil `username` dari request body dan mengubah password user tersebut. **Tidak ada validasi** bahwa `request.user` adalah user yang sama. User manapun bisa ubah password siapapun. |
| 12 | **CRITICAL** | `backend_django/apps/accounts/views.py` | 87-92 | Security | `request_reset_view` mengembalikan plaintext reset `token` di HTTP response body. Token seharusnya dikirim via email/SMS, bukan dikembalikan ke caller. |
| 13 | **CRITICAL** | `backend_django/apps/registration/views.py` | 17-41 | Logic Error | `RegistrationView.post` tidak melakukan validasi apapun, tidak menyimpan data, tapi mengembalikan HTTP 201 "success: True". Registrasi selalu "berhasil" tapi data hilang. |
| 14 | **CRITICAL** | `backend/utils/helpers.js` | 6 | Runtime Crash | `normalizeNISN` mendeklarasi `nisnStr` dengan `const` (line 5), lalu reassign di line 6. Throw `TypeError: Assignment to constant variable` saat NISN dimulai dengan karakter quote. |
| 15 | **CRITICAL** | `backend/utils/auth.js` | 4 | Security | `JWT_SECRET = process.env.JWT_SECRET \|\| 'default-secret'` — fallback ke string trivial. Jika env var tidak di-set, semua JWT token bisa di-forge. |
| 16 | **CRITICAL** | `backend/routes/auth.js` | 5-7 | Missing Auth | `/api/auth/change-password`, `/request-reset`, `/reset-password` **tanpa authentication middleware**. Siapapun (unauthenticated) bisa attempt change password. |
| 17 | **CRITICAL** | `backend/routes/students.js` | 10-12 | Missing Authorization | POST, PUT, DELETE student routes hanya pakai `authMiddleware` (autentikasi), **tanpa role-based authorization**. User biasa bisa hapus/edit data siswa. Berlaku juga untuk routes attendance, grades, evaluations. |
| 18 | **CRITICAL** | `backend/controllers/authController.js` | 144-148 | Security | `requestPasswordReset` mengembalikan reset token langsung di JSON response. Attacker bisa request + reset password siapapun dalam 2 langkah. |

---

## SECTION 2: HIGH ISSUES (43)

| # | SEVERITY | FILE PATH | LINE (Est.) | CATEGORY | ISSUE DESCRIPTION |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 19 | **HIGH** | `frontend/public/js/grades.js` | 461 | ReferenceError | `ui.calculateSummary()` dipanggil, tapi `calculateSummary` didefinisikan di objek `calculator`, bukan `ui`. Throw TypeError. |
| 20 | **HIGH** | `frontend/public/js/grades.js` | 841 | Missing Await | Di `init()`, `dataManager.loadCurrentUser()`, `loadClasses()`, `loadHistory()` semuanya async tapi tidak di-`await`. Error tidak tertangkap oleh try/catch. |
| 21 | **HIGH** | `frontend/public/js/grades.js` | 1110-1281 | ReferenceError | Pemanggilan bare `showToast()` dan `closeModal()` di luar IIFE scope. Fungsi-fungsi ini didefinisikan sebagai `ui.showToast()` di dalam IIFE. ReferenceError saat runtime. |
| 22 | **HIGH** | `frontend/public/js/grades.js` | 1155, 1197 | Null Reference | `document.getElementById('grade-form').addEventListener(...)` tanpa null check. Crash jika element tidak ada di DOM saat script load. |
| 23 | **HIGH** | `frontend/public/js/students.js` | 22-27, 36-46 | Double Event | `setupEventListeners()` dan `setupSearchDebounce()` memasang **dua** listener `input` pada `search-input` dengan debounce 500ms dan 300ms. Setiap keystroke memicu `loadStudents()` **dua kali**. |
| 24 | **HIGH** | `frontend/public/js/students.js` | 22, 29-31, 33 | Null Reference | `getElementById(...).addEventListener(...)` tanpa null check pada `search-input`, `filter-class`, dll. Jika satu element hilang, seluruh function crash dan listener berikutnya tidak terpasang. |
| 25 | **HIGH** | `frontend/public/js/students.js` | 588-591 | Logic Error | `exportToExcel()` menggunakan `else if` chains untuk filter — hanya SATU filter yang dikirim ke API. Jika user filter kelas DAN status, hanya kelas yang dipakai. `loadStudents()` (line 214) benar pakai independent `if`. |
| 26 | **HIGH** | `frontend/public/js/auth.js` + `auth-check.js` | 230, 7 | Race Condition | `checkAuthAndRedirect()` didefinisikan di kedua file dengan implementasi berbeda. Keduanya fire pada page load. Di login page, auth-check.js memanggil API `users/me/` yang gagal 401, potensial redirect loop. |
| 27 | **HIGH** | `frontend/public/js/auth.js` | 256 | Anti-Pattern | `new Promise(async (resolve, reject) => {...})` — jika exception terjadi sebelum `reject()`, promise hang selamanya tanpa resolve/reject. |
| 28 | **HIGH** | `frontend/public/js/auth.js` | 300 | Null Reference | Ketika `makeRequest` return `undefined` (setelah 401 + refresh fail), `response.json()` throw TypeError. Redirect ke `/login` belum tentu execute (navigation async). |
| 29 | **HIGH** | `frontend/public/js/auth.js` + `auth-check.js` + `dashboard.js` + `attendance.js` | 308, 378, 277, 1222 | Redeclaration | `window.logout` didefinisikan di **4 file** berbeda. `dashboard.js` dan `attendance.js` hanya clear localStorage TANPA invalidasi server-side refresh token. Security issue. |
| 30 | **HIGH** | `frontend/public/js/auth.js` + `apiFetch.js` + `api-helper.js` | 255, 1, 1 | Architecture | **3 API wrapper** berbeda (`window.apiCall`, `window.apiFetch`, `window.apiClient.fetch`). Masing-masing handle CSRF, token refresh, dan URL building secara berbeda. Inkonsisten dan membingungkan. |
| 31 | **HIGH** | `frontend/public/js/api-helper.js` | all | Missing CSRF | `apiClient.fetch` tidak pernah mengirim `X-CSRFToken` header. POST/PUT/DELETE melalui wrapper ini ditolak oleh Django CSRF middleware. |
| 32 | **HIGH** | `frontend/public/js/auth-check.js` | 1-5 | Performance | `checkAuthAndRedirect()` memanggil API `users/me/` pada **setiap halaman load** via DOMContentLoaded. Halaman seperti `dashboard.js` juga memanggil endpoint yang sama — duplikat request. |
| 33 | **HIGH** | `frontend/public/js/auth-check.js` | 81 | Security | `checkPageAccess()` membaca `user_role` dari localStorage yang bisa dimodifikasi via browser DevTools. Attacker bisa set role `'superadmin'` dan bypass semua client-side access control. |
| 34 | **HIGH** | `frontend/public/js/dashboard.js` | 277-289 | Security | `window.logout` hanya clear localStorage dan redirect. **Tidak** memanggil server-side logout endpoint — refresh token tetap valid. Juga menghapus key `'currentUser'` bukan `'user'`. |
| 35 | **HIGH** | `frontend/public/js/attendance.js` | mixed | Inconsistent API | Campuran `window.apiFetch('/path/')` dan raw `fetch('/api/path/')`. Hardcoded `/api/` prefix pada raw fetch (lines 584, 677, 757, 880, 988). Jika base URL berubah, semua hardcoded path rusak. |
| 36 | **HIGH** | `frontend/public/js/attendance.js` | 584, 677 | Missing CSRF | `initializeAttendance()` dan `saveAttendance()` pakai raw `fetch()` POST tanpa `X-CSRFToken` header. Django CSRF akan reject kecuali view di-exempt. |
| 37 | **HIGH** | `frontend/public/js/attendance.js` | 393-415, 830-972 | XSS | Student names, NISN, keterangan, mata_pelajaran di-interpolasi langsung ke innerHTML tanpa escaping. Stored XSS jika data dari database mengandung tag HTML/script. |
| 38 | **HIGH** | `frontend/public/js/dashboard.js` | 176-245 | XSS | `renderProgressTable` dan `renderRecentActivity` — student names dan activity data di-inject ke innerHTML tanpa escaping. Stored XSS vulnerability. |
| 39 | **HIGH** | `frontend/views/students.html` | 128-129 | Broken HTML | `<div class="filters-section glass-card admin-view">` tidak ditutup sebelum div berikutnya. DOM tree rusak, layout halaman berpotensi error. |
| 40 | **HIGH** | `frontend/views/attendance.html` | 166-251 | Broken HTML | `<div class="form-section">` (line 166) tidak ditutup. Section berikutnya nested salah. DOM malformed, menyebabkan masalah rendering. |
| 41 | **HIGH** | `frontend/views/students.html` + attendance + grades + evaluations | 291-296 | Script Order | `auth.js` di-load sebelum `apiConfig.js` dan `apiFetch.js`. Jika `auth.js` bergantung pada kedua file tersebut saat load time, akan gagal. Pattern ini di semua halaman kecuali login. |
| 42 | **HIGH** | `backend_django/apps/accounts/views.py` | 146-156 | Logic Error | Logout view menggunakan `BlacklistedToken.objects.create(token=str(token), user=request.user)` yang salah. Seharusnya `token.blacklist()`. Setiap logout akan raise exception dan silently gagal. |
| 43 | **HIGH** | `backend_django/apps/grades/views.py` | 79-94 | Logic Error | `perform_update` return `Response(403)` di else branch, tapi DRF ignore return value dari `perform_update`. Respons 403 tidak pernah dikirim ke client. |
| 44 | **HIGH** | `backend_django/apps/attendance/views.py` | 558 | FK Mismatch | `queryset.filter(nisn=user.linked_student_nisn)` — `nisn` adalah ForeignKey ke Student, tapi filter value adalah string. Seharusnya `nisn__nisn=user.linked_student_nisn`. |
| 45 | **HIGH** | `backend_django/apps/grades/views.py` | 42 | FK Mismatch | Sama: `queryset.filter(nisn=user.linked_student_nisn)` — ForeignKey vs string mismatch. Walisantri tidak bisa lihat nilai. |
| 46 | **HIGH** | `backend_django/apps/evaluations/views.py` | 42, 181 | FK Mismatch | Sama: `queryset.filter(nisn=user.linked_student_nisn)` di `get_queryset` dan `statistics`. ForeignKey vs string — crash untuk user walisantri. |
| 47 | **HIGH** | `backend_django/apps/grades/serializers.py` | 23-34 | N+1 Query | `get_rata_rata_kelas` menjalankan full DB query untuk **setiap** Grade object yang di-serialize. N grades = N extra queries, masing-masing load unbounded result set. |
| 48 | **HIGH** | `backend_django/apps/dashboard/views.py` | 196-250 | N+1 Query | Untuk setiap active student, query `Grade.objects.filter(nisn=student).aggregate(...)` dijalankan di dalam loop. Severe N+1 issue. |
| 49 | **HIGH** | `backend_django/apps/students/views.py` | 130-137 | N+1 Query | `statistics` action iterasi semua student di Python (`for student in queryset`) bukan database aggregation. Load semua object ke memory. |
| 50 | **HIGH** | `backend_django/apps/grades/views.py` | 204-216 | N+1 Query | `get_class_grades` iterasi semua Grade tanpa `select_related('nisn')`. Setiap akses `grade.nisn.nama` trigger query terpisah. |
| 51 | **HIGH** | `backend/controllers/authController.js` | 129-133 | Info Disclosure | `requestPasswordReset` return "Username tidak ditemukan!" — attacker bisa enumerate valid usernames. `changePassword` juga reveal username existence. |
| 52 | **HIGH** | `backend/server.js` | 22-25 | Security | CORS `origin: process.env.CORS_ORIGIN \|\| '*'` default allow all origins. Kombinasi dengan `credentials: true` adalah security risk. |
| 53 | **HIGH** | `backend/server.js` | 38 | Security | `app.use('/uploads', express.static(...))` serve uploaded files (foto evaluasi) **tanpa autentikasi**. Siapapun yang tahu URL bisa akses file. |
| 54 | **HIGH** | `backend/server.js` | 1-104 | Security | **Tidak ada rate limiting** di seluruh aplikasi. Login endpoint vulnerable brute-force. Reset token (6 digit = 900k kemungkinan) bisa di-bruteforce. |
| 55 | **HIGH** | `backend/config/config.js` vs frontend | 15-19 | Role Mismatch | Backend roles: `superadmin, admin, user`. Frontend roles: `walisantri, pimpinan, guru, pendaftar`. Role-role frontend **tidak ada** di backend ENUM. Seluruh role-based UI non-functional. |
| 56 | **HIGH** | `backend/models/index.js` | 1-19 | Missing Associations | Tidak ada Sequelize association yang didefinisikan (`hasMany`, `belongsTo`). Tapi controller pakai `include: [{ model: Student }]`. Query akan throw error "Model is not associated". |
| 57 | **HIGH** | `backend/utils/helpers.js` | 10-12 | Weak Token | `generateToken()` generate 6-digit numeric (900k kemungkinan) pakai `Math.random()` (non-crypto). Trivially brute-forceable tanpa rate limiting. |
| 58 | **HIGH** | `backend/controllers/authController.js` | 4 | Dead Import | Import `formatDatabaseDate` dan `getTodayDatabaseDateString` dari `utils/date` tapi tidak pernah dipakai. Tanda refactoring tidak selesai. |
| 59 | **HIGH** | `backend/controllers/attendanceController.js` | 364-398 | Race Condition | `saveBatchAttendance` — query `findOne` (line 398) tidak di-wrap dalam transaction. Dua concurrent request bisa keduanya find "no existing" dan create duplicates. |

---

## SECTION 3: MEDIUM ISSUES (49)

| # | SEVERITY | FILE PATH | LINE (Est.) | CATEGORY | ISSUE DESCRIPTION |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 60 | **MEDIUM** | `frontend/public/js/grades.js` | 389 | Null Reference | `getElementById('select-kelas').value` tanpa null check. Inkonsisten — line 326 pakai optional chaining `?.value` tapi disini tidak. |
| 61 | **MEDIUM** | `frontend/public/js/grades.js` | 1006-1014 | Null Reference | `updatePagination()` akses `getElementById('current-page').textContent` dll tanpa null check. Crash jika element hilang. |
| 62 | **MEDIUM** | `frontend/public/js/grades.js` | 652-678 | Data Integrity | `downloadCSV()` tidak escape values yang mengandung koma, quotes, atau newlines. Field student name dengan koma akan merusak struktur CSV. |
| 63 | **MEDIUM** | `frontend/public/js/grades.js` | 790 | Missing Await | `formHandler.loadDraft()` — `dataManager.loadStudentsByClass()` dipanggil tanpa `await`. Toast "Draft berhasil dimuat" muncul sebelum students benar-benar loaded. |
| 64 | **MEDIUM** | `frontend/public/js/evaluations.js` | 551 | Type Mismatch | `currentEvaluations.find(e => e.id === id)` — `id` dari onclick bisa string, API return numeric. Strict `===` gagal match `'123' !== 123`. |
| 65 | **MEDIUM** | `frontend/public/js/evaluations.js` | 79-106 | Missing Redirect | `loadCurrentUser()` saat fetch gagal hanya show toast, TIDAK redirect ke login. User tetap di halaman dengan state rusak. |
| 66 | **MEDIUM** | `frontend/public/js/evaluations.js` | 356-387 | Missing Load | `editEvaluation()` buka modal tapi tidak load student dropdown (tidak panggil `loadStudents()`). NISN dropdown kosong jika user belum pernah buka Add modal. |
| 67 | **MEDIUM** | `frontend/public/js/evaluations.js` | 297-302 | Null Reference | `updatePagination()` akses DOM elements tanpa null check. Crash jika elements hilang. |
| 68 | **MEDIUM** | `frontend/public/js/evaluations.js` | 413-420 | Null Reference | `removePhoto()` akses `photoInput`, `previewDiv`, `previewImg` tanpa null check. |
| 69 | **MEDIUM** | `frontend/public/js/students.js` | 652 | Null Reference | `animateValue()` akses `element.textContent` tanpa null check. |
| 70 | **MEDIUM** | `frontend/public/js/students.js` | 680-694 | Null Reference | `showToast()` akses `toast` dan `toastMessage` tanpa null check. |
| 71 | **MEDIUM** | `frontend/public/js/students.js` | 597-601 | Missing Error Handling | `exportToExcel()` — fetch response tidak di-check `.ok`. Server 401/500 tetap di-parse sebagai JSON data. |
| 72 | **MEDIUM** | `frontend/public/js/students.js` | 61, 80, 158, 604 | Null Reference | Akses DOM elements `walisantriContent.innerHTML` dll tanpa null check. |
| 73 | **MEDIUM** | `frontend/public/js/auth.js` + `auth-check.js` | 310-312, 370-372 | Redeclaration | `getUser`, `getUserRole`, `isAuthenticated` didefinisikan di kedua file. Implementasi identik tapi maintenance hazard. |
| 74 | **MEDIUM** | `frontend/public/js/auth-check.js` + `dashboard.js` + `attendance.js` | 342, 248, 1194 | Redeclaration | `showToast` didefinisikan 3x dengan implementasi berbeda. Masing-masing expect DOM structure berbeda (`toast-body` vs `toast-message`). |
| 75 | **MEDIUM** | `frontend/public/js/auth.js` + `apiFetch.js` | 127, 126 | Redeclaration | `showError()` didefinisikan di 2 file — target DOM element berbeda (`#error-message` vs `#toast`). Saling overwrite. |
| 76 | **MEDIUM** | `frontend/public/js/auth.js` + `apiFetch.js` + `auth-check.js` | 166, 115, 70 | Logic Error | `clearAuth()` didefinisikan 3x, masing-masing remove localStorage keys yang berbeda. `auth.js` miss `user_email`, `apiFetch.js` miss `user_username`. Stale data tertinggal. |
| 77 | **MEDIUM** | `frontend/public/js/auth.js` | 78-81 | Missing Error Handling | CSRF cookie fetch di luar try/catch block. Jika network error, `handleLogin` throw unhandled rejection, login button stuck disabled. |
| 78 | **MEDIUM** | `frontend/public/js/auth.js` | 47 | Null Reference | `rememberCheckbox.checked` tanpa null check. Jika checkbox element tidak ada, TypeError dan form submission handler gagal. |
| 79 | **MEDIUM** | `frontend/public/js/apiFetch.js` | 13-15 | Security | Debug logging `'[API_FETCH] Requesting:', url, 'with token'` ke console. Information leak via browser DevTools. |
| 80 | **MEDIUM** | `frontend/public/js/auth-check.js` | 109-115 | Logic Error | `isAllowed` pakai `currentPath.startsWith(path + '/')` — user dengan akses `/dashboard` juga akses `/dashboard-admin-secret`. Dead code di line 111-112. |
| 81 | **MEDIUM** | `frontend/public/js/dashboard.js` | 100 | Logic Error | `stats.hafalan_progress + '%' \|\| '-'` — jika `hafalan_progress` undefined, menghasilkan `'undefined%'` (truthy string), fallback `'-'` tidak pernah trigger. |
| 82 | **MEDIUM** | `frontend/public/js/dashboard.js` | 46-52 | Null Reference | `Promise.all` API requests — jika `apiFetch` return `null` (401 refresh fail), check `statsRes.ok` throw TypeError. |
| 83 | **MEDIUM** | `frontend/public/js/attendance.js` | 880, 995 | No Token Refresh | `viewHistoryDetail` dan `exportToCSV` pakai raw fetch tanpa token refresh logic. 401 response tidak trigger refresh. |
| 84 | **MEDIUM** | `frontend/public/js/attendance.js` | 1073-1083 | Missing Error Handling | `loadWalisantriView` pakai raw `fetch()` tanpa check `response.ok`. Jika server return non-JSON error, `.json()` throw. |
| 85 | **MEDIUM** | `frontend/public/js/attendance.js` | 548-561 | Race Condition | `loadDraft` pakai `setTimeout(500ms)` untuk tunggu students load bukan `await`. Jika API response > 500ms, draft data gagal di-apply karena rows belum ada. |
| 86 | **MEDIUM** | `frontend/public/js/registration.js` | 294-300 | Missing Auth | Registration POST pakai raw `fetch()` tanpa `Authorization` header dan tanpa CSRF token. Jika endpoint butuh auth, request gagal 401/403. |
| 87 | **MEDIUM** | `frontend/public/js/registration.js` | 181 | Info Disclosure | `checkNISNUniqueness()` fetch `students/${nisn}/` tanpa auth headers. Jika endpoint tanpa auth, expose student existence ke unauthenticated users. |
| 88 | **MEDIUM** | `frontend/public/js/registration.js` | 228-232 | Null Reference | `setupDragAndDrop` — `document.querySelector('.file-upload-label')` bisa return null. `dropZone.addEventListener(...)` crash. |
| 89 | **MEDIUM** | `frontend/public/js/registration.js` | 269-287 | Missing Feature | Form submission build JSON tapi photo file input `foto-profil` tidak dimasukkan ke payload. Photo di-validate tapi di-discard saat submit. Butuh `FormData` + `multipart/form-data`. |
| 90 | **MEDIUM** | `frontend/public/js/app.js` | 43-45 | Null Reference | Set `textContent = 'Loading...'` pada elements yang mungkin tidak ada. Semua API calls di-comment out — "Loading..." tidak pernah resolve. |
| 91 | **MEDIUM** | `frontend/views/login.html` | 18 | Security | Login form punya `method="POST"` tapi tidak ada CSRF token hidden field. |
| 92 | **MEDIUM** | `frontend/views/index.html` | 19-22 | Security | Auth check murni via `localStorage.getItem('access_token')`. Fake token di localStorage bypass redirect. HTML routes serve tanpa server-side auth. |
| 93 | **MEDIUM** | `frontend/views/index.html` | 53 | Security | Logout button redirect ke `/login/` tanpa clear `localStorage`. Token tetap valid dan usable setelah "logout". |
| 94 | **MEDIUM** | `backend_django/apps/students/serializers.py` | 45-48 | Logic Error | `get_progress_nilai_percentage` selalu return `75.0` (hardcoded). Tidak kalkulasi berdasarkan data student. `get_nilai_status` bandingkan hardcoded `75` vs `target_nilai`. |
| 95 | **MEDIUM** | `backend_django/apps/accounts/urls_users.py` vs `views.py` | mixed | Duplicate Code | `UserListCreateView` dan `UserDetailView` didefinisikan di `urls_users.py` DAN di `views.py`. Dua class hierarchy terpisah bisa diverge. |
| 96 | **MEDIUM** | `backend_django/apps/evaluations/views.py` | 59-77 | Missing Auth | `get_student_evaluations(nisn)` — user manapun bisa lihat evaluasi student manapun. Tidak ada check walisantri hanya lihat linked student. |
| 97 | **MEDIUM** | `backend_django/apps/attendance/views.py` + `grades/views.py` | 424-425, 243-244 | Error Handling | `int(request.query_params.get('page', 1))` — non-numeric string input akan raise `ValueError` → 500 error. |
| 98 | **MEDIUM** | `backend_django/apps/users/views.py` | 46-64 | Logic Error | Pagination logic rusak: queryset di-slice dulu, lalu `.count()` pada sliced queryset (max `page_size` bukan total). `start // end` salah secara matematis. `paginator.page()` compare Page object vs int. Crash. |
| 99 | **MEDIUM** | `backend_django/apps/users/views.py` | 12 | Logic Error | `User.objects.get()` raise `DoesNotExist` jika tidak ketemu, tidak return `None`. Check `if not user:` adalah dead code. Exception ditangkap `except Exception` → return 500 bukan 404. |
| 100 | **MEDIUM** | `backend_django/apps/accounts/urls_users.py` | 31-33 | URL Routing | `path('<username>/', ...)` didefinisikan SEBELUM `path('me/', ...)`. Request ke `/api/users/me/` akan ditangkap oleh `<username>/` pattern, lookup user dengan username='me'. |
| 101 | **MEDIUM** | `backend_django/apps/students/views.py` | 121 | Logic Error | `@permission_classes([IsAuthenticated])` decorator pada ViewSet action method **tidak berpengaruh**. Harus pakai parameter `permission_classes` di `@action()`. |
| 102 | **MEDIUM** | `backend_django/apps/attendance/views.py` | 332-338 | Performance | `get_attendance_stats` execute `filter(tanggal=date).first()` di dalam loop 30 iterasi. 30 extra queries, bisa 1 query saja. |
| 103 | **MEDIUM** | `backend_django/backend_django/settings.py` | 176-177 | Security | `CORS_ALLOW_ALL_ORIGINS=True` + `CORS_ALLOW_CREDENTIALS=True` — forbidden per CORS spec. Library mungkin silently skip credentials header. |
| 104 | **MEDIUM** | `backend_django/apps/dashboard/views.py` | 93-94 | Info Disclosure | Response include `debug_user_info` dan `debug_is_authenticated`. Debug info leak ke client. |
| 105 | **MEDIUM** | `backend_django/apps/dashboard/views.py` | 73-95 | Security | `dashboard_api` pakai `AllowAny` lalu manual auth check. Bypass DRF standard auth pipeline. |
| 106 | **MEDIUM** | `backend_django/apps/accounts/views.py` | 75, 96 | Security | `@csrf_exempt` pada `request_reset_view` dan `reset_password_view`. DRF `@api_view` sudah handle CSRF exemption — ini redundant dan membingungkan. |
| 107 | **MEDIUM** | `backend/server.js` | 62-80 | Missing Auth | Routes serving HTML pages (`/dashboard`, `/students`, dll) tanpa server-side auth. HTML structure dan JS source code exposed ke unauthenticated users. |
| 108 | **MEDIUM** | `backend/controllers/gradesController.js` | 102-109 | Missing Validation | `createGrade` tidak validate `nilai` sebagai number dalam range 0-100. User bisa submit `nilai: 99999` atau `nilai: "abc"`. Attendance status juga tidak divalidasi server-side. |
| 109 | **MEDIUM** | `backend/controllers/authController.js` | 109, 154, 218 | Info Leakage | Error handlers return `error.message` ke client. Bisa leak database schema, internal paths, stack trace. Pattern ini di hampir semua controller. |
| 110 | **MEDIUM** | `backend/controllers/authController.js` | 99, 207 | Security | `changePassword` dan `resetPassword` tidak validate password strength (minimum length, complexity). User bisa set password 1 karakter. |
| 111 | **MEDIUM** | `backend/models/Attendance.js` | 34-44 | Config Error | Model set `timestamps: false` tapi manually define `created_at`/`updated_at` dengan `defaultValue: DataTypes.NOW`. Sequelize tidak auto-update `updated_at` pada `update()`. |
| 112 | **MEDIUM** | `backend/controllers/authController.js` | 136-142 | Token Management | `requestPasswordReset` tidak invalidasi existing active tokens. Attacker bisa accumulate multiple valid tokens, perbesar brute-force surface. |
| 113 | **MEDIUM** | `backend/middleware/uploadMiddleware.js` + routes | all | Dead Code | Upload middleware didefinisikan tapi tidak pernah dipakai di route manapun. Evaluations form punya file input tapi server tidak handle upload. |
| 114 | **MEDIUM** | `backend/server.js` | 35 | Config Error | Static serve dari `frontend/public` tapi HTML reference paths `/static/css/...` dan `/static/js/...`. Kecuali ada directory `frontend/public/static/`, files return 404. |

---

## SECTION 4: LOW ISSUES (29)

| # | SEVERITY | FILE PATH | LINE (Est.) | CATEGORY | ISSUE DESCRIPTION |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 115 | **LOW** | `frontend/public/js/grades.js` | 279 | Logic Error | `summary.lowest !== 100` untuk decide show dash — jika student score benar-benar 100, nilai terendah legitimate 100 tapi tampil sebagai `-`. |
| 116 | **LOW** | `frontend/public/js/grades.js` | 926-928 | Code Quality | Functions assigned ke `window` sebelum declaration. Berfungsi karena hoisting, tapi code organization misleading dan fragile. |
| 117 | **LOW** | `frontend/public/js/evaluations.js` | 269, 612 | Code Quality | Variable name `eval` di `.map()` callback shadow built-in `eval()`. Confusing dan beberapa linter/strict-mode reject. |
| 118 | **LOW** | `frontend/public/js/evaluations.js` | 399 | Code Quality | `handlePhotoPreview` declared `async` tapi tidak ada `await`. Misleading. |
| 119 | **LOW** | `frontend/public/js/students.js` | 574 | Code Quality | `exportToExcel()` punya inconsistent indentation — tanda copy-paste dari konteks lain. |
| 120 | **LOW** | `frontend/public/js/auth.js` | 37 | Logic Error | Toggle password — kedua branch ternary set innerHTML ke emoji yang sama. Tidak ada visible feedback show/hide password. |
| 121 | **LOW** | `frontend/public/js/auth.js` | 101 | Logic Error | `remember_me` disimpan di `sessionStorage` (hilang saat tab ditutup). Tokens tetap di `localStorage` (persist). Flag ini tidak berfungsi. |
| 122 | **LOW** | `frontend/public/js/apiFetch.js` | 54-115 | Shadowing | `clearAuth()` lokal di file ini beda dari `auth-check.js` global. Remove `user_email` tapi miss `user_username`. |
| 123 | **LOW** | `frontend/public/js/api-helper.js` | 71 | Redundancy | `window.refreshToken` duplikasi token-refresh logic yang ada di `apiClient.fetch` dan `auth.js`. 3 mekanisme refresh independen. |
| 124 | **LOW** | `frontend/public/js/attendance.js` | 3, dashboard.js 1 | Redeclaration | Kedua file declare `let currentUser = null` top-level. Jika pernah di-load di page yang sama, SyntaxError. |
| 125 | **LOW** | `frontend/public/js/attendance.js` | 442 | Logic Error | `izin` count di-track tapi tidak pernah ditampilkan. Tidak ada element `stat-izin`. Students dengan status Izin tidak terhitung di UI summary. |
| 126 | **LOW** | `frontend/public/js/registration.js` | 109 | Logic Error | Date comparison pakai string (`tanggalMasuk > today`). Bekerja untuk ISO 8601 format by coincidence, tapi tidak robust. |
| 127 | **LOW** | `frontend/public/js/page-events.js` | 12-44 | Redundancy | Escape key handling didefinisikan 2x — document-level dan per-modal. `closeButton.click()` bisa fire 2x. |
| 128 | **LOW** | `frontend/public/js/page-events.js` | 22-24 | Logic Error | Enter key handler call `activeElement.click()` pada buttons. Buttons native respond ke Enter — click event fire 2x, potensial double submission. |
| 129 | **LOW** | `frontend/public/js/app.js` | 12-39 | Dead Code | Seluruh data-loading logic di-comment out. Function hanya set "Loading..." text yang tidak pernah resolve. File unused/stale. |
| 130 | **LOW** | `frontend/views/students.html` | 220 | UI/UX | Phone input pakai `type="text"` bukan `type="tel"`. Tidak ada `pattern` attribute untuk enforce format. |
| 131 | **LOW** | `frontend/views/grades.html` | 93, 242, 307 | Hardcoded Value | Academic year `"2024/2025"` hardcoded. Perlu update manual tiap tahun. |
| 132 | **LOW** | `backend_django/apps/attendance/views.py` | 518-523 | Performance | `get_attendance_history` query `AttendanceDraft` per grouped record di dalam loop. N+1 pattern. |
| 133 | **LOW** | `backend_django/apps/dashboard/views.py` | 253-298 | Authorization | `recent_activity_data` fetch evaluations/grades global (`all()[:5]`). Walisantri user bisa lihat data semua student. |
| 134 | **LOW** | `backend_django/apps/dashboard/views.py` | 287 | Logic Error | Activities sorted by formatted date string `'05 Feb 2026 14:30'` — alphabetical sort != chronological sort. |
| 135 | **LOW** | `backend_django/apps/dashboard/views.py` | 225 | Logic Error | `hafalan_status` compare percentage (0-100) vs `target_hafalan` count juz (0-30). Unit berbeda, comparison tidak bermakna. |
| 136 | **LOW** | `backend_django/apps/registration/models.py` | all | Incomplete | File kosong. Registration endpoint tidak persist data apapun. |
| 137 | **LOW** | `backend_django/apps/evaluations/urls_upload.py` | all | Incomplete | `urlpatterns = []` — route di-include dari main urls.py tapi tidak melakukan apa-apa. |
| 138 | **LOW** | `backend_django/apps/grades/views.py` | 391 | Logic Error | `import_excel_grades` set `existing_grade.keterangan = keterangan` tapi Grade model **tidak punya** field `keterangan`. Runtime error. |
| 139 | **LOW** | `backend_django/apps/accounts/urls_users.py` | 5 | Dead Import | `from rest_framework import permissions` imported tapi tidak dipakai. |
| 140 | **LOW** | `backend/controllers/dashboardController.js` | 63 | Logic Error | Division by zero potential: guard check `totalAttendance > 0` tapi divisi pakai `todayAttendanceCount`. Jika `todayAttendanceCount === 0`, result `NaN`. |

---

## TOP 10 MOST IMPACTFUL BUGS (Prioritized)

| Priority | Issue # | Summary | Impact |
| :--- | :--- | :--- | :--- |
| 1 | #10, #15 | Hardcoded SECRET_KEY (Django + Node.js) | **Total auth compromise** — attacker can forge any JWT token |
| 2 | #11, #16, #17 | IDOR change-password + missing auth on reset routes | **Account takeover** — change any user's password without auth |
| 3 | #12, #18 | Reset token returned in API response | **Instant password reset** — 2-step account takeover for any user |
| 4 | #6, #7 | `window.apiFetch` overwritten, no URL building | **All API calls broken** — dashboard, attendance, etc return 404 |
| 5 | #4 | `switchView()` undefined in evaluations.js | **Evaluations page crash** — page unusable for all users |
| 6 | #2, #3 | `mataPelajaran` is DOM element not `.value` | **Grades save broken** — `[object HTMLElement]` sent to API |
| 7 | #55 | Frontend roles don't match backend ENUM | **Role-based UI broken** — walisantri/guru/pimpinan features never activate |
| 8 | #56 | Missing Sequelize model associations | **Include queries crash** — attendance, grades list endpoints throw errors |
| 9 | #14 | `const` reassignment in `normalizeNISN` | **Login crash** — TypeError when NISN starts with quote character |
| 10 | #37, #38 | XSS via innerHTML (attendance + dashboard) | **Stored XSS** — malicious student name executes JS for all users |

---

*End of Report. Total: 18 CRITICAL, 43 HIGH, 49 MEDIUM, 29 LOW = **140 issues identified**.*
