# REGRESSION CHECKLIST - MANUAL TESTING
**Date**: January 30, 2026
**Purpose**: Pastikan semua fungsi berjalan tanpa "tombol mati" dan tanpa data blank
**Status**: ✅ READY FOR TESTING

---

## INSTRUKSI TESTING

### Prerequisites
1. **Pastikan server berjalan**: `python manage.py runserver`
2. **Pastikan database sudah ada data**: Seeding minimal beberapa siswa, evaluasi, absensi
3. **Pastikan token berfungsi**: JWT configuration benar
4. **Buka DevTools Console**: Untuk melihat error JavaScript
5. **Buka Network Tab**: Untuk memastikan request berhasil

### Testing Flow
1. Login dengan role tertentu
2. Buka halaman yang akan ditest
3. Lakukan aksi yang diminta
4. Catat hasil: ✅ SUKSES atau ❌ GAGAL
5. Catat error jika ada (console error, network error, UI error)
6. Lanjut ke test berikutnya

### Expected Results
- ✅ Tombol merespons saat diklik
- ✅ Data muncul (tidak blank/undefined)
- ✅ Tidak ada error di Console (JavaScript errors)
- ✅ Tidak ada error di Network (failed requests, 404, 500)
- ✅ Loading state berfungsi dengan benar
- ✅ Pagination berfungsi jika ada

---

## TEST CASES

## ROLE: GURU

### Test #1: Login sebagai Guru
**Halaman**: Login (`/login/`)
**Steps**:
1. Masukkan username guru (contoh: `guru`)
2. Masukkan password yang benar
3. Klik tombol "Login"

**Expected Results**:
- ✅ Redirect ke dashboard admin
- ✅ Token disimpan di localStorage (`access_token`, `refresh_token`)
- ✅ Console log: `[AUTH_CHECK] loaded: /` dan redirect
- ✅ Tidak ada error "Login failed" atau "Invalid credentials"
- ✅ Console log: `[API_FETCH] Requesting: /users/me/ with token` → 200 OK

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #2: Buka Dashboard
**Halaman**: Dashboard (`/dashboard/`)
**Steps**:
1. Login sebagai guru (jika belum)
2. Navigasi ke `/dashboard/`
3. Tunggu sampai data selesai load

**Expected Results**:
- ✅ Dashboard widget muncul dengan data
- ✅ Statistik muncul: Total Santri, Total Kelas, Kehadiran Hari Ini, dll.
- ✅ Chart muncul (attendance chart, grades distribution, progress tracking)
- ✅ Tidak ada "Loading..." yang berlama
- ✅ Console log: `[DASHBOARD] loaded: /dashboard/`
- ✅ Console log: `[API_FETCH] Requesting: /dashboard/stats/ with token` → 200 OK

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #3: Dashboard Charts Render
**Halaman**: Dashboard
**Steps**:
1. Scroll ke bawah ke section charts
2. Periksa apakah charts muncul

**Expected Results**:
- ✅ Attendance Chart muncul dengan grafik kehadiran
- ✅ Grades Distribution pie chart muncul
- ✅ Progress Tracking chart muncul
- ✅ Tidak ada error "Chart is not defined" atau "Canvas not found"
- ✅ Data di charts sesuai dengan statistik

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #4: Buka Halaman Students
**Halaman**: Students (`/students/`)
**Steps**:
1. Login sebagai guru (jika belum)
2. Klik menu "Siswa" di sidebar
3. Tunggu data load

**Expected Results**:
- ✅ Tabel siswa muncul dengan data
- ✅ Statistik cards muncul (Total Siswa, Siswa Aktif, Hafalan > Target, Hafalan < Target)
- ✅ Tidak ada "Loading..." yang berlama
- ✅ Progress bar hafalan muncul untuk setiap siswa
- ✅ Console log: `[STUDENTS] loaded: /students/`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #5: Lihat Detail Siswa (View)
**Halaman**: Students
**Steps**:
1. Di tabel siswa, klik tombol View (👁️) pada salah satu siswa
2. Periksa modal yang muncul

**Expected Results**:
- ✅ Modal view siswa terbuka
- ✅ Data lengkap muncul: NISN, Nama, Kelas, Program, Email, dll.
- ✅ Progress hafalan muncul dengan persentase yang benar
- ✅ Tombol close modal berfungsi
- ✅ Console log: `viewStudent called with NISN: ...`
- ✅ Network request: `GET /api/students/{nisn}/` → 200 OK
- ✅ Tidak ada error "window.viewStudent is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #6: Edit Data Siswa
**Halaman**: Students
**Steps**:
1. Di tabel siswa, klik tombol Edit (✏️) pada salah satu siswa
2. Ubah beberapa field (contoh: Kelas, Program)
3. Klik tombol "Simpan"
4. Tunggu proses selesai

**Expected Results**:
- ✅ Modal edit terbuka dengan data siswa yang dipilih
- ✅ Field NISN disabled (tidak bisa diedit)
- ✅ Data existing muncul di form (nama, kelas, program, dll.)
- ✅ Setelah klik simpan, modal tertutup
- ✅ Toast "Siswa berhasil diperbarui" muncul
- ✅ Tabel siswa di-refresh dengan data yang baru
- ✅ Network request: `PUT /api/students/{nisn}/` → 200 OK
- ✅ Tidak ada error "window.editStudent is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #7: Filter dan Search Siswa
**Halaman**: Students
**Steps**:
1. Coba filter by kelas: pilih kelas dari dropdown
2. Coba search: ketik nama atau NISN di search box
3. Coba filter by status: pilih "Aktif" atau "Tidak Aktif"
4. Klik tombol "Reset" untuk reset semua filter

**Expected Results**:
- ✅ Filter kelas berfungsi, tabel hanya menampilkan siswa di kelas tersebut
- ✅ Search berfungsi, tabel hanya menampilkan siswa yang cocok
- ✅ Filter status berfungsi
- ✅ Tombol Reset berfungsi, semua filter di-clear
- ✅ Console log: `[API_FETCH] Requesting: /api/students/?kelas=...&search=...`
- ✅ Network request: `GET /api/students/?kelas=...&search=...` → 200 OK
- ✅ Tidak ada error 404 atau 400

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #8: Pagination Siswa
**Halaman**: Students
**Steps**:
1. Pastikan ada banyak data siswa (lebih dari 25)
2. Klik tombol "Selanjutnya" (▶)
3. Periksa apakah data berubah ke halaman 2
4. Klik tombol "Sebelumnya" (◀)
5. Periksa info halaman (Halaman X dari Y)

**Expected Results**:
- ✅ Tombol "Selanjutnya" membawa ke halaman berikutnya
- ✅ Tombol "Sebelumnya" membawa ke halaman sebelumnya
- ✅ Info halaman menampilkan "Halaman X dari Y (Total: Z data)" dengan benar
- ✅ Tombol "Sebelumnya" disabled di halaman 1
- ✅ Tombol "Selanjutnya" disabled di halaman terakhir
- ✅ Network request: `GET /api/students/?page=2` → 200 OK
- ✅ Tidak ada error "window.loadPreviousPage/NextPage is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #9: Export Data Siswa
**Halaman**: Students
**Steps**:
1. Klik tombol "Export Excel" (📥)
2. Tunggu download selesai
3. Buka file yang didownload

**Expected Results**:
- ✅ File CSV terdownload
- ✅ Nama file: `students_YYYY-MM-DD.csv`
- ✅ Data di file lengkap dan sesuai dengan data di tabel
- ✅ Tidak ada error "window.exportToExcel is not a function"
- ✅ Network request: `GET /api/students/` → 200 OK (untuk export)
- ✅ Toast "Data berhasil diexport" muncul

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #10: Buka Halaman Evaluations
**Halaman**: Evaluations (`/evaluations/`)
**Steps**:
1. Login sebagai guru (jika belum)
2. Klik menu "Evaluasi" di sidebar
3. Tunggu data load

**Expected Results**:
- ✅ Tabel evaluasi muncul dengan data
- ✅ Statistik cards muncul (Total Evaluasi, Total Prestasi, Total Pelanggaran, dll.)
- ✅ Badge jenis evaluasi muncul dengan warna yang benar (Prestasi = hijau, Pelanggaran = merah)
- ✅ Tidak ada "Loading..." yang berlama
- ✅ Console log: `[EVALUATIONS] loaded: /evaluations/`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #11: Tambah Evaluasi Baru
**Halaman**: Evaluations
**Steps**:
1. Klik tombol "Tambah Evaluasi" (➕)
2. Isi form:
   - NISN: pilih siswa yang valid
   - Tanggal: pilih tanggal hari ini
   - Jenis: pilih "Prestasi" atau "Pelanggaran"
   - Nama: isi nama evaluasi
   - Summary: isi ringkasan
   - Catatan: isi catatan (opsional)
3. Klik tombol "Simpan"

**Expected Results**:
- ✅ Modal tambah evaluasi terbuka
- ✅ NISN dropdown berisi daftar siswa (autocomplete)
- ✅ Tanggal default hari ini
- ✅ Setelah klik simpan, modal tertutup
- ✅ Toast "Evaluasi berhasil ditambahkan" muncul
- ✅ Tabel evaluasi di-refresh dengan data baru
- ✅ Network request: `POST /api/evaluations/` → 201 Created
- ✅ Tidak ada error "window.openAddModal is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #12: Edit Evaluasi
**Halaman**: Evaluations
**Steps**:
1. Di tabel evaluasi, klik tombol Edit (✏️) pada salah satu evaluasi
2. Ubah beberapa field (contoh: Catatan)
3. Klik tombol "Simpan"

**Expected Results**:
- ✅ Modal edit terbuka dengan data evaluasi yang dipilih
- ✅ Data existing muncul di form (nisn, tanggal, jenis, nama, dll.)
- ✅ Setelah klik simpan, modal tertutup
- ✅ Toast "Evaluasi berhasil diupdate" muncul
- ✅ Tabel evaluasi di-refresh dengan data yang baru
- ✅ Network request: `PUT /api/evaluations/{id}/` → 200 OK
- ✅ Tidak ada error "window.editEvaluation is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #13: Hapus Evaluasi
**Halaman**: Evaluations
**Steps**:
1. Di tabel evaluasi, klik tombol Delete (🗑️) pada salah satu evaluasi
2. Klik "OK" pada confirmation dialog

**Expected Results**:
- ✅ Confirmation dialog muncul dengan nama siswa dan ID evaluasi
- ✅ Setelah klik OK, dialog tertutup
- ✅ Toast "Evaluasi berhasil dihapus" muncul
- ✅ Tabel evaluasi di-refresh, evaluasi yang dihapus tidak muncul
- ✅ Network request: `DELETE /api/evaluations/{id}/` → 204 No Content
- ✅ Tidak ada error "window.deleteEvaluation is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #14: Buka Halaman Attendance (Guru)
**Halaman**: Attendance (`/attendance/`)
**Steps**:
1. Login sebagai guru (jika belum)
2. Klik menu "Absensi" di sidebar
3. Klik tab "Form Absensi" atau "Load Attendance Form"

**Expected Results**:
- ✅ Form absensi muncul
- ✅ Dropdown kelas berisi daftar kelas
- ✅ Dropdown mata pelajaran berisi daftar mata pelajaran
- ✅ Tanggal default hari ini
- ✅ Console log: `[ATTENDANCE] loaded: /attendance/`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #15: Isi dan Simpan Absensi
**Halaman**: Attendance - Form
**Steps**:
1. Pilih kelas (contoh: X A)
2. Pilih mata pelajaran (contoh: Matematika)
3. Pilih tanggal (default hari ini)
4. Klik tombol "Load Students" atau form terisi otomatis
5. Ubah status kehadiran beberapa siswa (Hadir, Sakit, Izin, Alpha)
6. Tambah catatan jika perlu
7. Klik tombol "Simpan Absensi"

**Expected Results**:
- ✅ Tabel siswa muncul setelah pilih kelas dan mata pelajaran
- ✅ Setiap siswa memiliki dropdown status kehadiran
- ✅ Tombol status berfungsi untuk mengubah kehadiran
- ✅ Setelah klik simpan, data tersimpan
- ✅ Toast "Absensi berhasil disimpan" muncul
- ✅ Network request: `POST /api/attendance/batch/` → 200 OK
- ✅ Summary muncul: "X disimpan, Y diupdate, Z error"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## ROLE: WALISANTRI

### Test #16: Login sebagai Walisantri
**Halaman**: Login (`/login/`)
**Steps**:
1. Masukkan username walisantri (contoh: `walisantri`)
2. Masukkan password yang benar
3. Klik tombol "Login"

**Expected Results**:
- ✅ Redirect ke dashboard admin
- ✅ Token disimpan di localStorage
- ✅ Console log: `[AUTH_CHECK] loaded: /` dan redirect
- ✅ Tidak ada error "Login failed"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #17: Buka Halaman Students (Walisantri)
**Halaman**: Students (`/students/`)
**Steps**:
1. Login sebagai walisantri
2. Klik menu "Siswa" di sidebar

**Expected Results**:
- ✅ Tab "Admin" TIDAK muncul
- ✅ Tab "Walisantri" muncul dan aktif
- ✅ Tombol "Tambah Siswa" TIDAK muncul
- ✅ Tombol "Export Excel" TIDAK muncul
- ✅ Hanya data ananda (siswa yang terhubung) yang muncul
- ✅ Title berubah menjadi "Ananda"
- ✅ Data progress hafalan ananda muncul
- ✅ Console log: `switchView('walisantri') called`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #18: View Ananda Detail (Walisantri)
**Halaman**: Students - Walisantri View
**Steps**:
1. Pastikan di tab "Walisantri"
2. Periksa data ananda yang muncul

**Expected Results**:
- ✅ Data lengkap ananda muncul: NISN, Nama, Kelas, Program, Email, dll.
- ✅ Progress hafalan ananda muncul dengan bar dan persentase
- ✅ Status hafalan muncul ("Di atas target" atau "Di bawah target")
- ✅ Target nilai muncul
- ✅ Informasi kontak wali muncul
- ✅ Tombol edit/add/delete TIDAK muncul
- ✅ Network request: `GET /api/students/{nisn}/` → 200 OK (untuk ananda)

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #19: Buka Halaman Attendance (Walisantri)
**Halaman**: Attendance (`/attendance/`)
**Steps**:
1. Login sebagai walisantri
2. Klik menu "Absensi" di sidebar
3. Periksa tab yang tersedia

**Expected Results**:
- ✅ Tab "Form Absensi" TIDAK muncul (walisantri tidak bisa input absensi)
- ✅ Tab "Riwayat Absensi" muncul dan aktif
- ✅ Tombol "Load Attendance Form" TIDAK muncul
- ✅ Tombol "Reset Form" TIDAK muncul
- ✅ Hanya riwayat absensi ananda yang muncul

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #20: Lihat Riwayat Absensi Ananda (Walisantri)
**Halaman**: Attendance - History
**Steps**:
1. Login sebagai walisantri
2. Klik menu "Absensi"
3. Pastikan di tab "Riwayat Absensi"
4. Periksa tabel riwayat

**Expected Results**:
- ✅ Tabel riwayat absensi ananda muncul
- ✅ Kolom yang muncul: Tanggal, Kelas, Mata Pelajaran, Status
- ✅ Status ditampilkan dengan ikon/color yang benar (Hadir = hijau, Sakit = kuning, dll.)
- ✅ Pagination berfungsi jika banyak data
- ✅ Network request: `GET /api/attendance/monthly/{nisn}/{month}/{year}/` → 200 OK

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## ROLE: PIMPINAN

### Test #21: Login sebagai Pimpinan
**Halaman**: Login (`/login/`)
**Steps**:
1. Masukkan username pimpinan (contoh: `pimpinan`)
2. Masukkan password yang benar
3. Klik tombol "Login"

**Expected Results**:
- ✅ Redirect ke dashboard admin
- ✅ Token disimpan di localStorage
- ✅ Console log: `[AUTH_CHECK] loaded: /` dan redirect
- ✅ Tidak ada error "Login failed"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #22: Dashboard Pimpinan
**Halaman**: Dashboard
**Steps**:
1. Login sebagai pimpinan
2. Navigasi ke `/dashboard/`
3. Periksa data dan chart yang muncul

**Expected Results**:
- ✅ Dashboard widget muncul dengan data lengkap
- ✅ Chart muncul dan berfungsi
- ✅ Statistik muncul: Total Santri, Total Kelas, dll.
- ✅ Semua data terload dengan benar
- ✅ Title berubah menjadi "Data Siswa" (bukan "Kelola Siswa")

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #23: CRUD Siswa (Pimpinan)
**Halaman**: Students
**Steps**:
1. Login sebagai pimpinan
2. Klik menu "Siswa"
3. Test: Lihat detail siswa (tombol View)
4. Test: Edit siswa (tombol Edit)
5. Test: Coba delete siswa (tombol Delete) - mungkin gagal karena permission

**Expected Results**:
- ✅ Tombol View berfungsi
- ✅ Tombol Edit berfungsi
- ✅ Tombol Delete berfungsi atau muncul error permission (sesuai dengan role pimpinan)
- ✅ Tabel siswa muncul dengan data lengkap
- ✅ Console log: `[STUDENTS] loaded: /students/`
- ✅ Tidak ada error "window.* is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #24: Export Siswa (Pimpinan)
**Halaman**: Students
**Steps**:
1. Login sebagai pimpinan
2. Klik menu "Siswa"
3. Klik tombol "Export Excel"

**Expected Results**:
- ✅ Tombol "Export Excel" muncul
- ✅ Tombol berfungsi saat diklik
- ✅ File CSV terdownload
- ✅ Data di file lengkap dan sesuai
- ✅ Tidak ada error "window.exportToExcel is not a function"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## ROLE: SUPERADMIN

### Test #25: Login sebagai Superadmin
**Halaman**: Login (`/login/`)
**Steps**:
1. Masukkan username superadmin (contoh: `superadmin`)
2. Masukkan password yang benar
3. Klik tombol "Login"

**Expected Results**:
- ✅ Redirect ke dashboard admin
- ✅ Token disimpan di localStorage
- ✅ Role terdeteksi sebagai "superadmin"
- ✅ Console log: `[AUTH_CHECK] loaded: /` dan redirect
- ✅ Tidak ada error "Login failed"

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #26: CRUD Siswa (Superadmin)
**Halaman**: Students
**Steps**:
1. Login sebagai superadmin
2. Klik menu "Siswa"
3. Test: Tambah siswa baru (tombol Tambah Siswa)
4. Test: Edit siswa (tombol Edit)
5. Test: Delete siswa (tombol Delete)

**Expected Results**:
- ✅ Semua tombol CRUD berfungsi (View, Edit, Delete)
- ✅ Tambah siswa: modal terbuka, form valid, simpan berhasil
- ✅ Edit siswa: modal terbuka dengan data, edit berhasil
- ✅ Delete siswa: confirmation dialog muncul, delete berhasil
- ✅ Tabel siswa di-refresh setiap aksi CRUD
- ✅ Tidak ada error permission (superadmin punya full access)
- ✅ Network requests: `POST /api/students/`, `PUT /api/students/{nisn}/`, `DELETE /api/students/{nisn}/`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #27: Delete Siswa (Permission Check)
**Halaman**: Students
**Steps**:
1. Login sebagai superadmin
2. Klik menu "Siswa"
3. Klik tombol Delete pada salah satu siswa
4. Klik OK pada confirmation dialog

**Expected Results**:
- ✅ Confirmation dialog muncul dengan nama dan NISN siswa
- ✅ Setelah klik OK, siswa dihapus
- ✅ Toast "Siswa berhasil dihapus" muncul
- ✅ Tabel siswa di-refresh, siswa yang dihapus tidak muncul
- ✅ Network request: `DELETE /api/students/{nisn}/` → 204 No Content
- ✅ Tidak ada error "Akses ditolak" atau 403 Forbidden

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #28: Delete Evaluasi (Superadmin)
**Halaman**: Evaluations
**Steps**:
1. Login sebagai superadmin
2. Klik menu "Evaluasi"
3. Klik tombol Delete pada salah satu evaluasi
4. Klik OK pada confirmation dialog

**Expected Results**:
- ✅ Confirmation dialog muncul
- ✅ Evaluasi dihapus
- ✅ Toast "Evaluasi berhasil dihapus" muncul
- ✅ Tabel evaluasi di-refresh
- ✅ Network request: `DELETE /api/evaluations/{id}/` → 204 No Content

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## TOKEN REFRESH AND AUTH

### Test #29: Token Refresh otomatis
**Halaman**: Semua halaman
**Steps**:
1. Login (semua role)
2. Tunggu sampai access token expired (60 menit default)
3. Atau clear access_token manual: `localStorage.removeItem('access_token')`
4. Lakukan aksi apa saja (contoh: buka dashboard)

**Expected Results**:
- ✅ Access token expired terdeteksi (401 Unauthorized)
- ✅ Refresh token terpanggil otomatis
- ✅ New access token disimpan ke localStorage
- ✅ Original request di-retry dengan new token
- ✅ Data terload dengan benar (tidak redirect ke login)
- ✅ Console log: `[API_FETCH] 401 Unauthorized - attempting refresh`
- ✅ Console log: `[API_FETCH] Token refreshed successfully`
- ✅ Console log: `[API_FETCH] Retried request: ... status: 200`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #30: Logout
**Halaman**: Semua halaman
**Steps**:
1. Login (semua role)
2. Klik tombol "Logout" di sidebar

**Expected Results**:
- ✅ User logout dan di-redirect ke halaman login
- ✅ Token dihapus dari localStorage (access_token, refresh_token)
- ✅ User data dihapus dari localStorage (user, user_role, user_name)
- ✅ Tidak bisa akses halaman protected tanpa login
- ✅ Akses halaman protected akan redirect ke login
- ✅ Console log: `[AUTH_CHECK] No access token, redirecting to login`

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## CROSS-FUNCTIONAL TESTS

### Test #31: Error Handling (401 Unauthorized)
**Halaman**: Semua halaman
**Steps**:
1. Logout
2. Coba akses halaman protected langsung (buka `/dashboard/`)
3. Atau set invalid token: `localStorage.setItem('access_token', 'invalid')`

**Expected Results**:
- ✅ Redirect ke halaman login
- ✅ Toast atau message muncul: "Token expired, redirecting to login"
- ✅ Console log: `[AUTH_CHECK] Token expired, redirecting to login`
- ✅ Auth data di-clear dari localStorage
- ✅ Tidak ada blank page atau infinite loading

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #32: Error Handling (403 Forbidden)
**Halaman**: Semua halaman
**Steps**:
1. Login sebagai walisantri
2. Coba akses fitur yang tidak ada permission (misal: buka form absensi)
3. Atau coba akses endpoint restricted (misal: delete siswa sebagai walisantri)

**Expected Results**:
- ✅ Toast muncul: "Akses ditolak: Anda tidak memiliki izin untuk mengakses resource ini"
- ✅ Tidak ada blank page
- ✅ Console log: `[API_FETCH] 403 Forbidden - access denied`
- ✅ Network request: 403 Forbidden (dengan message yang jelas)

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #33: Error Handling (Network Error)
**Halaman**: Semua halaman
**Steps**:
1. Stop server backend: `Ctrl+C` pada terminal runserver
2. Coba akses halaman apa saja
3. Coba lakukan aksi apa saja (load data, submit form)
4. Start server kembali

**Expected Results**:
- ✅ Toast error muncul: "Gagal memuat data" atau similar
- ✅ Console log: `[API_FETCH] Request error: NetworkError` atau similar
- ✅ Tidak ada blank page tanpa informasi
- ✅ UI tidak frozen, masih bisa berinteraksi
- ✅ Setelah server start kembali, refresh akan berhasil

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #34: Data Validation
**Halaman**: Semua halaman dengan form
**Steps**:
1. Login (semua role dengan permission)
2. Coba submit form dengan data invalid:
   - Tambah siswa tanpa required fields (NISN, Nama)
   - Tambah siswa dengan NISN yang sudah ada
   - Tambah siswa dengan target hafalan negatif
3. Klik tombol Simpan

**Expected Results**:
- ✅ Form validation bekerja, tidak submit jika data invalid
- ✅ Error message muncul di bawah field yang invalid
- ✅ Toast error muncul: "Data tidak valid"
- ✅ Network request: 400 Bad Request (dengan error details)
- ✅ Tidak ada error JavaScript atau blank page
- ✅ Console log: Error details dari validation

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


### Test #35: Responsive Design
**Halaman**: Semua halaman
**Steps**:
1. Buka aplikasi di browser
2. Resize browser window ke ukuran berbeda:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)
3. Periksa layout dan fungsi di tiap ukuran

**Expected Results**:
- ✅ Layout responsif berfungsi di semua ukuran
- ✅ Sidebar ter-collapse di mobile (hamburger menu)
- ✅ Tabel scrollable di mobile
- ✅ Form tetap bisa diisi di mobile
- ✅ Tombol tetap bisa diklik di mobile
- ✅ Tidak ada layout broken di ukuran apapun

**Actual Result**: [ ] SUKSES / [ ] GAGAL
**Error (jika ada)**: _________________________________________________


---

## SUMMARY CHECKLIST

### Berdasarkan Role

| Role | Login | Dashboard | Students | Evaluations | Attendance | Total Tests |
|------|-------|----------|----------|-------------|------------|-------------|
| Guru | Test #1 | Test #2-3 | Test #4-9 | Test #10-13 | Test #14-15 | 15 |
| Walisantri | Test #16 | - | Test #17-18 | - | Test #19-20 | 5 |
| Pimpinan | Test #21 | Test #22 | Test #23-24 | - | - | 4 |
| Superadmin | Test #25 | - | Test #26-28 | - | - | 3 |
| Cross-Functional | - | - | - | - | Test #29-35 | 7 |
| **TOTAL** | **5** | **3** | **11** | **4** | **5** | **35** |

### Berdasarkan Fungsi

| Fungsi | Test Case | Status |
|---------|-----------|--------|
| Login/Logout | #1, #16, #21, #25, #30 | [ ] |
| Dashboard | #2-3, #22 | [ ] |
| Students List | #4, #17 | [ ] |
| Students CRUD | #5-8, #23, #26 | [ ] |
| Students Export | #9, #24 | [ ] |
| Evaluations CRUD | #10-13, #28 | [ ] |
| Attendance Form | #14-15 | [ ] |
| Attendance History | #19-20 | [ ] |
| Token Refresh | #29 | [ ] |
| Error Handling | #31-34 | [ ] |
| Responsive Design | #35 | [ ] |

---

## TESTING LOG

### Date: _______________________
### Tester: _______________________
### Environment: [ ] Development / [ ] Staging / [ ] Production
### Browser: _______________________

### Test Results Summary:
- Total Tests: 35
- Passed: _____
- Failed: _____
- Success Rate: _____%

### Critical Failures:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

### Notes/Observations:
___________________________________________________________________________________
___________________________________________________________________________________
___________________________________________________________________________________

---

## VERIFICATION CRITERIA

### ✅ Checklist MUST PASS
- [ ] Semua tombol merespons saat diklik (tidak ada "tombol mati")
- [ ] Semua data muncul dengan benar (tidak ada data blank/undefined)
- [ ] Tidak ada error JavaScript di Console
- [ ] Tidak ada error Network (failed requests, 404, 500, CORS)
- [ ] Token refresh berfungsi otomatis
- [ ] Error handling berfungsi dengan user feedback yang jelas
- [ ] Permission dan role-based access berfungsi dengan benar
- [ ] Responsive design berfungsi di semua ukuran layar

### ✅ Success Criteria
- **MINIMUM**: 80% tests passed (28/35)
- **RECOMMENDED**: 90% tests passed (32/35)
- **EXCELLENT**: 100% tests passed (35/35)

---

## ISSUE TRACKING

### Issues Found During Testing
| ID | Test Case | Issue | Severity | Status |
|----|-----------|-------|----------|--------|
| #1 | | | | |
| #2 | | | |
| #3 | | | |

### Issues Resolved
| ID | Test Case | Issue | Resolution | Status |
|----|-----------|-------|------------|--------|
| #1 | | | | |
| #2 | | | | |

---

## RECOMMENDATIONS

### Based on Testing Results
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

### Next Steps for Development
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

---

**Checklist Version**: 1.0
**Last Updated**: January 30, 2026
**Ready for Testing**: ✅ YES
