# Handover: Fitur Hafalan & Kajian Mingguan - Portal Siswa Baron

## Peran AI di Sesi Ini
Kamu adalah **prompter** - tugasmu membuat prompt Claude Code yang presisi
berdasarkan permintaan user, bukan mengerjakan kodenya sendiri.

---

## Konteks Proyek
**Portal Siswa Baron v2.4.3** - Django 4.2 + DRF, Vanilla JS ES6+, baron-emerald.css
Deploy: PythonAnywhere (staging) + VPS PostgreSQL (production)

### Constraints Kritis (WAJIB di setiap prompt)
- apiFetch('/endpoint/') - TANPA prefix /api/
- Student PK = nisn (string), filter: nisn__nisn=...
- user.name or user.username - tidak ada get_full_name()
- Event handler via .onclick = fn - BUKAN inline HTML onclick
- Script order: utils.js -> apiConfig.js -> apiFetch.js -> auth-check.js -> page.js
- Cek duplikat fungsi di views.py sebelum save
- evaluasi-asatidz.js TIDAK BOLEH diubah sama sekali

---

## STATUS FITUR HAFALAN

### SELESAI & BERFUNGSI

**Integritas Guru (evaluasi-asatidz.html + integritas-guru.js):**
- Summary cards modal detail - styling card box sudah benar
- CSS variables di-hardcode di evaluasi-asatidz.css (:root)

**Halaman Hafalan (hafalan.html + hafalan.js):**
- Juz progress grid 30 juz - tersambung ke `kesantrian/hafalan/siswa/<nisn>/`
- Target Tartil - model `TartilSantri`, endpoint `kesantrian/hafalan/tartil/<nisn>/`
- Target Tahfidz - model `TahfidzSantri`, endpoint `kesantrian/hafalan/tahfidz/<nisn>/`
- Save tartil/tahfidz nyambung ke backend (POST upsert)
- Merge 6 jilid default + 4 kategori tahfidz default dengan data DB
- Rename "Halaqoh" -> "Kajian Mingguan" di UI
- Mapping juz -> range halaman (Mushaf Kemenag) + validasi form setoran
- Searchable dropdown selector santri per kelas (untuk guru/admin)

**Model baru di `backend_django/apps/kesantrian/`:**
- `TartilSantri` - migration 0014
- `TahfidzSantri` - migration 0014

**Dashboard Walisantri (dashboard.html + dashboard.js + wali-dashboard.css):**
- Redesign dashboard walisantri: hero card gradient hijau, topbar greeting,
  4 stat card, aktivitas terkini, status tagihan, akses cepat 6 item
- Cleanup duplikat `renderWalisantriDashboard()` dan CSS conflict di
  `wali-dashboard.css`
- Route dashboard walisantri dikonfirmasi: `unified_dashboard` -> `dashboard.js`
  -> `renderWalisantriDashboard()` (`dashboard-parent.html` tidak dipakai)

**Fix Hafalan Walisantri:**
- Fix `renderHafalanWalisantri()`: tambah `fetchKehadiranKajian()` agar
  walisantri dapat data kehadiran kajian di tab Overview hafalan

**Dashboard Walisantri - fix lanjutan (16 Mei 2026):**
- Fix tabel ibadah harian: tambah CSS worship tracker di
  `wali-dashboard.css` (sebelumnya CSS ada di `dashboard-emerald.css`
  yang tidak di-load)
- Fix warna icon Akses Cepat: perkuat warna background dari
  `#E1F5EE` -> `#C6F0DC` dll
- Fix fetch worship tracker: ganti `fetch('/api/...')` -> `apiFetch()`

**Halaman Absensi Sholat (absensi-sholat.html + absensi-sholat.js):**
- Route: `/absensi-sholat/` -> `TemplateView` -> `absensi-sholat.html`
- UI: toolbar kelas+tanggal, tabel santri per kelas, 5 dropdown
  status per waktu sholat, tombol Semua Hadir + Simpan
- Endpoint submit: `kesantrian/ibadah/record-bulk/` (POST)
- CSS: `absensi-sholat.css`
- Status: UI berfungsi, submit masih 405 (belum resolved)

---

### BELUM DIKERJAKAN

**1. Selector santri di tab Overview belum muncul untuk admin**
- Symptom: `student-selector-bar` tidak muncul
- Kemungkinan: NISN kosong saat `renderHafalanGuru` pertama dipanggil
  sehingga `initStudentSelector` tidak ter-trigger
- File: `frontend/public/js/hafalan.js` -> `initStudentSelector()`
- Fix yang disarankan: panggil `initStudentSelector()` tanpa syarat NISN,
  biarkan selector muncul dulu, baru fetch data siswa saat dipilih

**2. Fitur Kajian Mingguan (Tab baru di hafalan.html)**

Scope lengkap yang perlu dibangun:

*Backend:*
- Tambah model `KelompokAnggota` (junction KelompokPengasuhan <-> Student)
  karena saat ini anggota kelompok = filter by kelas (tidak bisa lintas kelas)
- Update serializer `KelompokPengasuhSerializer` - jumlah_santri dari
  KelompokAnggota, bukan filter kelas
- Tambah endpoint:
  - `GET/POST kesantrian/kelompok-pengasuhan/<id>/anggota/`
  - `DELETE kesantrian/kelompok-pengasuhan/<id>/anggota/<nisn>/`

*Frontend - Halaman Manajemen Kelompok (admin/pimpinan):*
- Buat halaman baru atau modal di hafalan.html
- CRUD kelompok: nama, pengasuh (dropdown user guru/musyrif), tambah/hapus anggota
- Searchable multi-select siswa lintas kelas

*Frontend - Tab Kajian Mingguan di hafalan.html (guru/musyrif):*
- List pertemuan milik kelompok yang diasuh guru login
- Tombol "Tambah Pertemuan" -> modal (judul, tanggal, lokasi)
- Per pertemuan: input presensi per santri (hadir/izin/sakit/tidak_hadir)

*Model yang sudah ada dan siap dipakai:*
- `KelompokPengasuhan` - nama, pengasuh, wakil_pengasuh, tahun_ajaran
- `PertemuanPengasuhan` - kelompok, judul, tanggal, lokasi
- `PresensiPertemuan` - pertemuan, santri, status, catatan
- Endpoint sudah ada: `kelompok-pengasuhan/`, `pertemuan-pengasuhan/`,
  `pertemuan-pengasuhan/<id>/presensi/`

**3. Catatan Guru per santri - belum tersambung ke backend**
- `saveCatatan()` masih fake save (hanya update memory)
- Perlu endpoint baru atau field di model yang ada

**4. Guru Tartil / Guru Tahfidz / Status Khidmat - belum ada data**
- UI sudah ada tapi semua tampil "-"
- Rencananya dari assignment guru ke siswa
- Belum ada model/endpoint yang sesuai

**5. Dashboard Walisantri - follow-up UI/data**
- Fix tabel ibadah harian di dashboard walisantri (`renderWorshipTrackerUI`
  styling)
- Fix icon warna Akses Cepat tidak muncul di dashboard walisantri
- Fix data ibadah 0% dan kajian 0 - cek field mapping
  `fetchWalisantriSummary()` vs response JSON
  `kesantrian/my-children-summary/`

**6. Submit Absensi Sholat - POST 405 belum resolved**
- File: `absensi-sholat.js?v=20260516b`
- Endpoint: `kesantrian/ibadah/record-bulk/`
- Backend lokal sudah benar (`@api_view(['POST'])`, baris 358)
- Kemungkinan: PythonAnywhere belum sync atau ada middleware intercept
- Yang perlu dicek: git log di server, curl test dengan token

**7. Stat card Kajian Mingguan - field mapping salah**
- `dashboard.js` membaca `ibadah_summary.total_hadir` untuk kajian (salah)
- Fix: tambah `fetchKajianSummaryForDashboard(nisn)` -> endpoint
  `kesantrian/hafalan/siswa/<nisn>/kehadiran-kajian/`

---

## File-File Penting

| File | Keterangan |
|------|-----------|
| `frontend/views/hafalan.html` | HTML halaman hafalan, 3 tab: overview/setoran/import |
| `frontend/public/js/hafalan.js` | JS utama hafalan, sudah banyak perubahan |
| `frontend/public/css/hafalan-baron.css` | CSS hafalan, sudah ada .item-edit-row |
| `frontend/public/css/evaluasi-asatidz.css` | CSS variables :root ditambah di sini |
| `backend_django/apps/kesantrian/models.py` | TartilSantri, TahfidzSantri, KelompokPengasuhan, dll |
| `backend_django/apps/kesantrian/views.py` | Semua endpoint kesantrian |
| `backend_django/apps/kesantrian/urls.py` | URL routing kesantrian |

---

## Deploy Flow
```bash
cd ~/portal_siswa && git pull
cd backend_django && python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
# Bump ?v= pada script/CSS yang diubah
```

---

## Brief history

### Recent months

**15 Mei 2026:**
- Redesign penuh dashboard walisantri: hero card, stat grid, aktivitas,
  tagihan, akses cepat
- Fix route dashboard: dikonfirmasi pakai `dashboard.js`, bukan
  `dashboard-parent.html`
- Fix `fetchKehadiranKajian()` tidak dipanggil di `renderHafalanWalisantri()`
- Cleanup: hapus duplikat fungsi `renderWalisantriDashboard()`, hapus CSS
  conflict antara definisi lama dan Redesign 2026 di `wali-dashboard.css`
