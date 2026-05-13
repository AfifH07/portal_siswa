# Handover: Fitur Hafalan & Kajian Mingguan — Portal Siswa Baron

## Peran AI di Sesi Ini
Kamu adalah **prompter** — tugasmu membuat prompt Claude Code yang presisi
berdasarkan permintaan user, bukan mengerjakan kodenya sendiri.

---

## Konteks Proyek
**Portal Siswa Baron v2.4.3** — Django 4.2 + DRF, Vanilla JS ES6+, baron-emerald.css
Deploy: PythonAnywhere (staging) + VPS PostgreSQL (production)

### Constraints Kritis (WAJIB di setiap prompt)
- apiFetch('/endpoint/') — TANPA prefix /api/
- Student PK = nisn (string), filter: nisn__nisn=...
- user.name or user.username — tidak ada get_full_name()
- Event handler via .onclick = fn — BUKAN inline HTML onclick
- Script order: utils.js → apiConfig.js → apiFetch.js → auth-check.js → page.js
- Cek duplikat fungsi di views.py sebelum save
- evaluasi-asatidz.js TIDAK BOLEH diubah sama sekali

---

## STATUS FITUR HAFALAN

### ✅ SELESAI & BERFUNGSI

**Integritas Guru (evaluasi-asatidz.html + integritas-guru.js):**
- Summary cards modal detail — styling card box sudah benar ✅
- CSS variables di-hardcode di evaluasi-asatidz.css (:root) ✅

**Halaman Hafalan (hafalan.html + hafalan.js):**
- Juz progress grid 30 juz — tersambung ke `kesantrian/hafalan/siswa/<nisn>/` ✅
- Target Tartil — model `TartilSantri`, endpoint `kesantrian/hafalan/tartil/<nisn>/` ✅
- Target Tahfidz — model `TahfidzSantri`, endpoint `kesantrian/hafalan/tahfidz/<nisn>/` ✅
- Save tartil/tahfidz nyambung ke backend (POST upsert) ✅
- Merge 6 jilid default + 4 kategori tahfidz default dengan data DB ✅
- Rename "Halaqoh" → "Kajian Mingguan" di UI ✅
- Mapping juz → range halaman (Mushaf Kemenag) + validasi form setoran ✅
- Searchable dropdown selector santri per kelas (untuk guru/admin) ✅

**Model baru di `backend_django/apps/kesantrian/`:**
- `TartilSantri` — migration 0014 ✅
- `TahfidzSantri` — migration 0014 ✅

---

### ❌ BELUM DIKERJAKAN

**1. Selector santri di tab Overview belum muncul untuk admin**
- Symptom: `student-selector-bar` tidak muncul
- Kemungkinan: NISN kosong saat `renderHafalanGuru` pertama dipanggil
  sehingga `initStudentSelector` tidak ter-trigger
- File: `frontend/public/js/hafalan.js` → `initStudentSelector()`
- Fix yang disarankan: panggil `initStudentSelector()` tanpa syarat NISN,
  biarkan selector muncul dulu, baru fetch data siswa saat dipilih

**2. Fitur Kajian Mingguan (Tab baru di hafalan.html)**

Scope lengkap yang perlu dibangun:

*Backend:*
- Tambah model `KelompokAnggota` (junction KelompokPengasuhan ↔ Student)
  karena saat ini anggota kelompok = filter by kelas (tidak bisa lintas kelas)
- Update serializer `KelompokPengasuhSerializer` — jumlah_santri dari
  KelompokAnggota, bukan filter kelas
- Tambah endpoint:
  - `GET/POST kesantrian/kelompok-pengasuhan/<id>/anggota/`
  - `DELETE kesantrian/kelompok-pengasuhan/<id>/anggota/<nisn>/`

*Frontend — Halaman Manajemen Kelompok (admin/pimpinan):*
- Buat halaman baru atau modal di hafalan.html
- CRUD kelompok: nama, pengasuh (dropdown user guru/musyrif), tambah/hapus anggota
- Searchable multi-select siswa lintas kelas

*Frontend — Tab Kajian Mingguan di hafalan.html (guru/musyrif):*
- List pertemuan milik kelompok yang diasuh guru login
- Tombol "Tambah Pertemuan" → modal (judul, tanggal, lokasi)
- Per pertemuan: input presensi per santri (hadir/izin/sakit/tidak_hadir)
- Di tab Overview per santri: tampilkan ringkasan kehadiran kajian
  (sudah ada UI-nya: Hadir/Izin/Alpa — tinggal disambungkan)

*Model yang sudah ada dan siap dipakai:*
- `KelompokPengasuhan` — nama, pengasuh, wakil_pengasuh, tahun_ajaran
- `PertemuanPengasuhan` — kelompok, judul, tanggal, lokasi
- `PresensiPertemuan` — pertemuan, santri, status, catatan
- Endpoint sudah ada: `kelompok-pengasuhan/`, `pertemuan-pengasuhan/`,
  `pertemuan-pengasuhan/<id>/presensi/`

**3. Catatan Guru per santri — belum tersambung ke backend**
- `saveCatatan()` masih fake save (hanya update memory)
- Perlu endpoint baru atau field di model yang ada

**4. Guru Tartil / Guru Tahfidz / Status Khidmat — belum ada data**
- UI sudah ada tapi semua tampil "–"
- Rencananya dari assignment guru ke siswa
- Belum ada model/endpoint yang sesuai

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
