# Portal Siswa Baron

Sistem Informasi Akademik Terpadu untuk Pondok Pesantren Baron. Mengelola data santri, kegiatan akademik, evaluasi karakter, pemantauan ibadah, hafalan Al-Quran, dan komunikasi dengan walisantri dalam satu platform.

**Deployment:** https://apiiip.pythonanywhere.com  
**Stack:** Django 4.2 + DRF · Vanilla JS ES6+ · SQLite (staging) / PostgreSQL (production)

---

## Fitur Utama

### Manajemen Santri
Data lengkap santri mencakup NISN, NIS, jenis kelamin, kelas, dan catatan khusus. Setiap santri diidentifikasi dengan NISN sebagai primary key di seluruh sistem. Walisantri dapat memiliki lebih dari satu anak yang terhubung ke akun mereka.

### Jurnal Guru (Presensi KBM)
Guru mencatat kehadiran santri per sesi dengan wizard 4 langkah: tipe pengajar (pengampu/piket), info kelas, kehadiran per santri, dan dokumentasi. Setiap sesi bisa dilengkapi tujuan pembelajaran, ketuntasan materi, dan penilaian.

### Sistem Nilai
Mendukung 8 jenis penilaian: penugasan, tes tulis, tes lisan, portofolio, praktek, proyek, UTS, dan UAS. Guru input nilai per mata pelajaran dan materi. Admin dan pimpinan dapat melihat rekap per kelas.

### Evaluasi Santri & Pembinaan
Guru dan BK mencatat evaluasi/insiden santri dengan foto. Alur: guru input → admin/pimpinan approve → pimpinan bisa close kasus dengan keputusan final. Setiap evaluasi bisa dikomentari; komentar memiliki visibilitas `internal` (hanya staf) atau `semua` (termasuk walisantri).

### Program Al-Quran (Hafalan)
Musyrif dan guru tahfidz mencatat setoran hafalan harian per santri dengan detail juz, halaman dari-sampai, jumlah halaman, catatan, dan status (lancar/perlu ulang/belum selesai). Mendukung import bulk via Excel. Setiap santri memiliki target hafalan per semester. Tersedia export PDF progress hafalan 30 juz.

### Presensi Sholat
Pencatatan kehadiran sholat wajib 5 waktu per santri per hari (hadir/tidak hadir/terlambat). Mendukung input manual dan import bulk via CSV/Excel. Tersedia rekap per kelas untuk admin.

### BLP — Buku Lapangan Pesantren
Pemantauan karakter santri mingguan berbasis 59 indikator boolean (0/1) yang terbagi dalam 6 domain:

| Domain | Jumlah Indikator |
|--------|-----------------|
| Ibadah & Religius | 18 |
| Akhlak & Perilaku | 25 |
| Resiliensi & Daya Pegan | 4 |
| Kecerdikan & Resourcefulness | 4 |
| Refleksi & Meta Belajar | 4 |
| Timbal Balik & Empati | 4 |

Skor dihitung sebagai persentase (0–100%). Predikat: Mumtaz (≥90%), Jayyid Jiddan (≥75%), Jayyid (≥60%), Maqbul (≥40%), Perlu Pembinaan (<40%). Mendukung import bulk via Excel (61 kolom: nisn, week_start, + 59 kode indikator).

### Kompetensi & Pengajar
Setiap santri memiliki data guru tartil dan guru tahfidz yang bertanggung jawab, beserta status kelulusan masing-masing (sudah lulus / belum lulus). Informasi ini ditampilkan di halaman hafalan dan dapat dilihat oleh walisantri.

### Status Khidmat
Mencatat status keterlibatan santri dalam kegiatan pesantren dengan 4 pilihan: Sangat Aktif, Aktif, Tidak Aktif, atau Pengabdian. Dilengkapi tanggal mulai dan akhir masa khidmat.

### Evaluasi Asatidz
Penilaian kinerja ustadz/ustadzah oleh pimpinan mencakup evaluasi kompetensi, kinerja mengajar, dan indikator kinerja yang dapat dikonfigurasi.

### Izin Guru
Guru mengajukan izin dengan foto surat. Admin/pimpinan approve atau tolak. Status izin terlihat di dashboard guru.

### Keuangan
Modul pencatatan keuangan pesantren diakses oleh role bendahara.

### Dashboard
Setiap role mendapatkan dashboard yang disesuaikan. Dashboard guru menampilkan todo list: sesi yang belum diisi presensi, nilai yang belum diinput, dan izin tanpa titipan tugas. Dashboard walisantri menampilkan ringkasan data anak.

### Pertemuan Pengasuhan
Pencatatan jadwal dan presensi pertemuan antara pesantren dengan walisantri.

---

## Role & Akses

| Role | Deskripsi Akses |
|------|----------------|
| `superadmin` | Akses penuh termasuk manajemen user |
| `admin` | Co-superadmin: import/export, semua data, tanpa kelola user |
| `pimpinan` | Lihat semua data approved, approval evaluasi, close kasus |
| `guru` | Jurnal KBM, input nilai, evaluasi santri (kelas sendiri) |
| `musyrif` | Input ibadah, hafalan, pembinaan santri |
| `bk` | Bimbingan konseling, lihat semua evaluasi approved |
| `bendahara` | Modul keuangan |
| `walisantri` | Lihat data anak: hafalan, evaluasi (visibility=semua), BLP, kehadiran |
| `admin_santri` | Input BLP dan presensi sholat untuk semua santri |

---

## Arsitektur

```
portal-siswa/
├── backend_django/
│   └── apps/
│       ├── accounts/       — User, Assignment, autentikasi, wali kelas
│       ├── attendance/     — Jurnal Guru, TitipanTugas
│       ├── core/           — TahunAjaran, MasterJam, MasterMapel
│       ├── dashboard/      — Dashboard views per role
│       ├── evaluations/    — Evaluasi santri, komentar, approval, close case
│       ├── finance/        — Keuangan
│       ├── grades/         — Nilai santri
│       ├── kesantrian/     — BLP, Hafalan, Ibadah, IzinGuru, KompetensiSantri, Incident
│       ├── registration/   — Pendaftaran santri
│       └── students/       — Student, Schedule
└── frontend/
    ├── public/
    │   ├── css/
    │   │   └── baron-emerald.css   — Main theme (glassmorphism, Baron Emerald)
    │   └── js/
    │       ├── utils.js            — Utilities (escapeHtml, getCookie, dll)
    │       ├── apiConfig.js        — Konfigurasi base URL API
    │       ├── apiFetch.js         — Wrapper fetch dengan CSRF & auth
    │       ├── auth-check.js       — Autentikasi & render sidebar per role
    │       └── *.js                — Script per halaman
    └── views/
        └── *.html                  — Halaman HTML per fitur
```

**Custom User Model — penting:**
- Nama lengkap: `user.name` (bukan `first_name`, bukan `get_full_name()`)
- Selalu gunakan: `user.name or user.username`
- Walisantri: `user.linked_student_nisn` (anak pertama), `user.linked_student_nisns` (semua anak, JSONField)
- Student PK: `nisn` (string) — bukan auto-increment integer

---

## Model Database Utama

| Model | App | Keterangan |
|-------|-----|-----------|
| `User` | accounts | Custom user model dengan field `name` dan `role` |
| `Assignment` | accounts | Penugasan guru: kelas, mapel, tipe (hafalan_type) |
| `Student` | students | PK = nisn, field: nis, jenis_kelamin, catatan |
| `TahunAjaran` | core | Tahun ajaran + semester aktif |
| `MasterMapel` | core | Master mata pelajaran |
| `Attendance` | attendance | Kehadiran per sesi KBM |
| `Grade` | grades | Nilai per mapel per jenis penilaian |
| `Evaluation` | evaluations | Evaluasi/insiden santri + approval + close |
| `EvaluationComment` | evaluations | Komentar evaluasi dengan visibility |
| `Ibadah` | kesantrian | Presensi sholat wajib |
| `HafalanRecord` | kesantrian | Setoran hafalan harian |
| `BLPEntry` | kesantrian | Penilaian karakter mingguan (59 indikator boolean) |
| `KompetensiSantri` | kesantrian | Guru tartil/tahfidz, status lulus, status khidmat |
| `Incident` | kesantrian | Insiden/kejadian santri |

---

## API Endpoints Utama

### Auth (`/api/auth/`)
- `POST /login/` — Login
- `GET /status/` — Cek status autentikasi & role
- `GET /users/` — List user (admin)

### Kesantrian (`/api/kesantrian/`)
- `GET|POST /hafalan/` — List & tambah setoran hafalan
- `GET /hafalan/template/` — Download template Excel hafalan
- `POST /hafalan/import/` — Import hafalan bulk
- `GET|POST /blp/` — List & buat BLP entry
- `GET /download-template-blp/` — Download template Excel BLP
- `POST /import-blp/` — Import BLP bulk
- `GET|POST /ibadah/` — Presensi sholat
- `GET /ibadah/template-presensi-csv/` — Download template presensi
- `POST /ibadah/import-presensi-csv/` — Import presensi bulk
- `GET /kompetensi/<nisn>/` — Data kompetensi santri
- `PATCH /kompetensi/<nisn>/update/` — Update kompetensi
- `GET|POST /incidents/` — List & tambah incident
- `GET /download-rapor/<nisn>/` — Export PDF rapor
- `GET /download-blp/<nisn>/` — Export PDF BLP

### Evaluations (`/api/evaluations/`)
- `GET|POST /` — List & buat evaluasi
- `PATCH /<id>/approve/` — Approve evaluasi
- `PATCH /<id>/close/` — Close kasus (pimpinan)
- `GET|POST /<id>/comments/` — Komentar evaluasi

### Grades (`/api/grades/`)
- `GET|POST /` — List & input nilai
- `GET /mapel-list/` — Daftar mata pelajaran

---

## Deploy

```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
```

Cek log error:
```bash
cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50
```

---

## Konvensi Pengembangan

**Frontend:**
- `apiFetch('endpoint/')` — tanpa prefix `/api/`, selalu tanpa leading slash
- Event handler via `.onclick = fn`, bukan inline `onclick=""` di HTML statis (di `innerHTML` dinamis boleh `onclick="window.fn()"`)
- Bump `?v=YYYYMMDD` setiap ada perubahan JS/CSS
- `grades.js` masih pakai raw `fetch()` — jangan dimigrasi ke `apiFetch`
- `evaluasi-asatidz.js` — jangan diubah sama sekali

**Backend:**
- Template download file: wajib `@login_required` + `HttpResponse` (bukan `@api_view` — DRF akan paksa response jadi JSON)
- Student FK filter: `nisn__nisn=<string>` bukan `nisn=<string>`
- Cek duplikat fungsi sebelum menambah fungsi baru

**Alur bug fix:**
1. Prompt investigasi (read-only: grep/cat)
2. Analisis output → tentukan root cause
3. Jika belum jelas → investigasi lanjutan
4. Root cause terkonfirmasi → prompt fix
5. Deploy → konfirmasi hasil

Dilarang fix berdasarkan asumsi tanpa investigasi.
