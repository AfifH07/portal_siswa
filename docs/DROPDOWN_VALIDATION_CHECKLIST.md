# Checklist Validasi Endpoint Dropdown & Data Loading

## Absensi (Attendance)
### Endpoint yang dibutuhkan:
1. **GET /api/students/classes/**
   - Frontend: attendance.js:136
   - Mengembalikan: `{"success": true, "classes": [...], "programs": [...]}`
   - Digunakan untuk: Dropdown pilih kelas di filter

2. **GET /api/students/?kelas={kelas}&aktif=true**
   - Frontend: attendance.js:260
   - Mengembalikan: `{"count": N, "results": [...], ...}`
   - Digunakan untuk: Tabel siswa setelah pilih kelas

3. **POST /api/attendance/batch/**
   - Frontend: attendance.js (submit form)
   - Mengirim: Array of attendance records
   - Validasi: Form harus punya kelas, tanggal, dan mata pelajaran

### Validasi:
- [x] Endpoint `/students/classes/` exists dengan format response sesuai
- [x] Endpoint `/students/?kelas=X&aktif=true` exists dengan format response sesuai
- [x] `attendance.html` meng-include `auth.js` (line 280)
- [x] `attendance.js` memanggil endpoint dengan benar

---

## Nilai (Grades)
### Endpoint yang dibutuhkan:
1. **GET /api/grades/classes/**
   - Frontend: grades.js:44
   - Mengembalikan: `{"success": true, "classes": [...]}`
   - Digunakan untuk: Dropdown pilih kelas

2. **GET /api/grades/mata_pelajaran/**
   - Frontend: grades.js (perlu verifikasi)
   - Mengembalikan: `{"success": true, "mata_pelajaran": [...]}`
   - Digunakan untuk: Dropdown pilih mata pelajaran

3. **GET /api/students/?kelas={kelas}&aktif=true**
   - Frontend: grades.js:48
   - Mengembalikan: `{"count": N, "results": [...], ...}`
   - Digunakan untuk: Tabel siswa setelah pilih kelas

4. **POST /api/grades/**
   - Frontend: grades.js:57
   - Mengirim: Grade data
   - Validasi: Form harus punya kelas, mata pelajaran, dan siswa

### Validasi:
- [x] Endpoint `/grades/classes/` exists dengan format response sesuai
- [x] Endpoint `/grades/mata_pelajaran/` exists dengan format response sesuai
- [x] Endpoint `/students/?kelas=X&aktif=true` exists dengan format response sesuai
- [x] `grades.html` meng-include `auth.js` (line 353)
- [x] `grades.js` memanggil endpoint dengan benar

---

## Evaluasi (Evaluations)
### Endpoint yang dibutuhkan:
1. **GET /api/students/classes/**
   - Frontend: evaluations.js:91
   - Mengembalikan: `{"success": true, "classes": [...], "programs": [...]}`
   - Digunakan untuk: Dropdown pilih kelas di filter

2. **GET /api/evaluations/**
   - Frontend: evaluations.js:143
   - Mengembalikan: `{"count": N, "results": [...], ...}`
   - Digunakan untuk: Tabel evaluasi

3. **GET /api/evaluations/statistics/**
   - Frontend: evaluations.js:116
   - Mengembalikan: `{"success": true, "statistics": {...}}`
   - Digunakan untuk: Statistik di halaman

4. **POST /api/evaluations/**
   - Frontend: evaluations.js (submit form)
   - Mengirim: Evaluation data
   - Validasi: Form harus punya NISN, jenis, dan ringkasan

### Validasi:
- [x] Endpoint `/students/classes/` exists dengan format response sesuai
- [x] Endpoint `/evaluations/` exists dengan format response sesuai
- [x] Endpoint `/evaluations/statistics/` exists dengan format response sesuai
- [x] `evaluations.html` meng-include `auth.js` (line 253)
- [x] `evaluations.js` memanggil endpoint dengan benar
- [x] NISN input menggunakan text field (bukan dropdown) - tidak perlu endpoint khusus

---

## Summary of Changes
### Files Modified:
1. `frontend/views/attendance.html:280` - Added `<script src="/static/js/auth.js" defer></script>`
2. `frontend/views/grades.html:353` - Added `<script src="/static/js/auth.js" defer></script>`
3. `frontend/views/evaluations.html:253` - Added `<script src="/static/js/auth.js" defer></script>`
4. `frontend/views/students.html:291` - Added `<script src="/static/js/auth.js" defer></script>` (sebelumnya)
5. `frontend/public/js/students.js:205-248` - Enhanced error handling di loadStudents()

### Data Available:
- Students: 6 records
- Classes: ['X-IPA-1', 'X-IPA-2', 'XI-IPA-1', 'XII A']
- Programs: ['Khusus', 'Reguler', 'Tahfidz']
- Grades: 2 records
- Mata Pelajaran: ['Matematika']
- Evaluations: 0 records

---

## Test Instructions
Untuk testing manual:

### 1. Test Absensi:
1. Login sebagai superuser/admin/guru
2. Buka halaman Absensi
3. Pilih kelas dari dropdown (harus muncul: X-IPA-1, X-IPA-2, XI-IPA-1, XII A)
4. Pilih mata pelajaran
5. Tabel siswa harus muncul dengan semua siswa di kelas tersebut
6. Pilih status attendance untuk setiap siswa
7. Klik "Simpan Absensi"
8. Verify data tersimpan via API atau dashboard

### 2. Test Nilai:
1. Login sebagai superuser/admin/guru
2. Buka halaman Nilai
3. Pilih kelas dari dropdown (harus muncul: X-IPA-1 karena ada grade data)
4. Pilih mata pelajaran dari dropdown (harus muncul: Matematika)
5. Tabel siswa harus muncul dengan semua siswa di kelas tersebut
6. Input nilai untuk setiap siswa
7. Klik "Simpan Semua"
8. Verify data tersimpan via API atau dashboard

### 3. Test Evaluasi:
1. Login sebagai superuser/admin/guru
2. Buka halaman Evaluasi
3. Pilih kelas dari dropdown filter (opsional)
4. Klik tombol "Tambah Evaluasi"
5. Input NISN siswa (manual input)
6. Pilih jenis evaluasi (prestasi/pelanggaran)
7. Input ringkasan
8. Klik "Simpan"
9. Verify data tersimpan via API atau dashboard

---

## Regression Checklist
- [ ] Absensi: setelah pilih kelas dan mapel, tabel siswa muncul dan bisa save ke POST /api/attendance/batch/
- [ ] Nilai: setelah pilih kelas dan mapel, tabel siswa muncul dan bisa save ke POST /api/grades/
- [ ] Evaluasi: tombol tambah membuka modal dan bisa submit ke POST /api/evaluations/
- [ ] Dashboard: stats tetap tampil dengan benar setelah perubahan
- [ ] Siswa: halaman students tetap berfungsi dengan benar
- [ ] Authentication: login/logout tetap berfungsi dengan benar