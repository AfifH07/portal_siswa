<div align="center">

# Portal Siswa Baron

**Sistem Informasi Akademik Terpadu — Pondok Pesantren Baron**

[![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat-square&logo=django)](https://djangoproject.com)
[![DRF](https://img.shields.io/badge/DRF-3.14-red?style=flat-square)](https://django-rest-framework.org)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS%20ES6+-F7DF1E?style=flat-square&logo=javascript)](/)
[![Deploy](https://img.shields.io/badge/Deploy-portal.ponpesbaron.id-2196F3?style=flat-square)](https://portal.ponpesbaron.id)

*Satu platform untuk mengelola santri, akademik, karakter, ibadah, hafalan, dan komunikasi walisantri.*

</div>

---

## ✨ Fitur Unggulan

### 🎯 Dashboard Adaptif per Role
Setiap role mendapatkan tampilan dashboard yang berbeda dan relevan. **Dashboard Guru** menampilkan todo list dinamis — sesi mana yang belum diisi presensi, nilai yang belum diinput, dan izin tanpa titipan tugas — sehingga guru tahu persis apa yang harus dikerjakan hari itu. **Dashboard Walisantri** menyajikan ringkasan progress anak secara visual: jumlah juz hafalan, persentase kehadiran ibadah, dan statistik kajian mingguan dalam satu layar. **Dashboard Ustadz** hadir dalam layout bento grid dengan kartu assignment, jadwal mengajar, dan status inval real-time.

### 📖 Program Al-Quran — Hafalan Terintegrasi
Pencatatan hafalan harian per santri dengan detail penuh: juz, halaman dari-sampai, jumlah halaman, status kelancaran, dan catatan pembimbing. Setiap santri memiliki target hafalan per semester yang terpantau. Tersedia export PDF progress 30 juz lengkap dengan tabel detail per juz, rekap kehadiran kajian, dan catatan guru. Import bulk via Excel untuk efisiensi input massal.

### 📊 BLP — Pemantauan Karakter Mingguan
Sistem penilaian karakter berbasis 59 indikator behavioral yang terbagi dalam 6 domain (Ibadah & Religius, Akhlak & Perilaku, Resiliensi, Kecerdikan, Refleksi, Timbal Balik). Setiap indikator dinilai secara boolean (terpenuhi/tidak), menghasilkan skor persentase dan predikat otomatis — dari Mumtaz hingga Perlu Pembinaan. Walisantri dapat melihat ringkasan domain dan riwayat per minggu langsung dari halaman karakter anak.

### 🔥 Heatmap Konsistensi Ibadah
Visualisasi kehadiran sholat berjamaah santri dalam bentuk heatmap 3 bulan terakhir, mirip GitHub contribution graph. Sekilas terlihat pola konsistensi dan hari-hari yang sering absen. Dilengkapi chart sholat wajib 7 hari terakhir per waktu (Subuh–Isya) dan analitik insight otomatis.

### 📋 Evaluasi Santri dengan Alur Approval
Guru dan BK mencatat evaluasi atau insiden santri dengan foto bukti. Kasus mengalir melalui alur approval: guru input → admin/pimpinan approve → pimpinan close dengan keputusan final tertulis. Setiap kasus bisa dikomentari secara bertahap dengan kontrol visibilitas: komentar `internal` hanya terlihat staf, komentar `semua` juga terlihat walisantri.

### 💰 Manajemen SPP & Keuangan
Generate tagihan SPP massal, verifikasi pembayaran dengan bukti foto, dan manajemen keuangan pesantren terintegrasi khusus untuk role bendahara.

---

## 📦 Fitur Lengkap

<table>
<tr>
<td width="50%" valign="top">

**🎓 Akademik**
- Jurnal Guru (wizard 4 langkah: tipe pengajar, info kelas, kehadiran, dokumentasi)
- 8 jenis penilaian: penugasan, tes tulis, tes lisan, portofolio, praktek, proyek, UTS, UAS
- Import nilai massal via Excel + generate template otomatis
- Jadwal mengajar & timetable per kelas
- Titipan tugas saat guru izin
- Wali kelas: catatan kelas, rekap pembinaan, detail santri

**🕌 Kesantrian**
- Presensi sholat 5 waktu (hadir/tidak hadir/terlambat)
- Rekap presensi sholat per kelas untuk admin
- Import presensi sholat bulk via CSV/Excel
- Setoran hafalan harian (CRUD + import bulk)
- Target hafalan per semester
- Pertemuan pengasuhan: kelompok, jadwal, presensi

**👤 Data Santri**
- Profil lengkap: NISN, NIS, jenis kelamin, catatan
- Statistik santri (total, aktif, per jenis kelamin)
- Filter & pencarian multi-kriteria
- Import santri dari Excel
- Kenaikan kelas massal
- Pendaftaran santri baru via form multi-step

</td>
<td width="50%" valign="top">

**📈 Evaluasi & Karakter**
- Evaluasi perilaku santri dengan foto
- Alur approval + close case + keputusan final
- Catatan & bimbingan dengan visibilitas internal/publik
- Poin integritas santri
- Evaluasi integritas guru (penilaian kinerja)
- Riwayat incident per santri
- BLP: 59 indikator, 6 domain, skor persentase

**📄 Export & Import**
- PDF rapor santri (hafalan + karakter + ibadah)
- PDF BLP per santri
- PDF hafalan progress 30 juz
- PDF rekap izin guru
- Export nilai via Excel
- Import nilai, hafalan, BLP, presensi — semua via Excel/CSV dengan template siap pakai

**⚙️ Administrasi**
- Manajemen user & role (9 role)
- Master mata pelajaran & jam pelajaran
- Tahun ajaran & semester
- Izin guru dengan foto surat + approval
- Evaluasi kinerja asatidz
- Kritik & saran (anonim/identitas)
- Kompetensi santri: guru tartil/tahfidz + status lulus
- Status khidmat santri (4 pilihan + periode)

</td>
</tr>
</table>

---

## 🏗️ Arsitektur

```
portal-siswa/
├── backend_django/
│   └── apps/
│       ├── accounts/       — User, Assignment, autentikasi, wali kelas
│       ├── attendance/     — Jurnal Guru, TitipanTugas
│       ├── core/           — TahunAjaran, MasterJam, MasterMapel
│       ├── dashboard/      — Dashboard views per role
│       ├── evaluations/    — Evaluasi, komentar, approval, close case, integritas
│       ├── finance/        — Keuangan & SPP
│       ├── grades/         — Nilai santri
│       ├── kesantrian/     — BLP, Hafalan, Ibadah, IzinGuru, KompetensiSantri, Incident
│       ├── registration/   — Pendaftaran santri baru
│       └── students/       — Student, Schedule
└── frontend/
    ├── public/
    │   ├── css/baron-emerald.css   — Baron Emerald Theme (glassmorphism)
    │   └── js/                     — utils → apiConfig → apiFetch → auth-check (urutan wajib)
    └── views/                      — 27 halaman HTML
```

**Stack:** Django 4.2 · DRF 3.14 · SimpleJWT · ReportLab · openpyxl · Chart.js · Vanilla JS ES6+  
**Design:** Baron Emerald Theme · Plus Jakarta Sans · Glassmorphism · Lucide Icons

---

## 👥 Role & Hak Akses

| Role | Akses |
|------|-------|
| `superadmin` | Akses penuh termasuk manajemen user |
| `admin` | Semua fitur kecuali kelola user |
| `pimpinan` | Lihat semua data approved, approval, close case evaluasi |
| `guru` | Jurnal KBM, input nilai, evaluasi kelas sendiri |
| `musyrif` | Input ibadah, hafalan, pembinaan santri |
| `bk` | Bimbingan konseling, semua evaluasi approved |
| `bendahara` | Modul keuangan & SPP |
| `walisantri` | Lihat data anak: hafalan, karakter, evaluasi, kehadiran ibadah |
| `admin_santri` | Input BLP dan presensi sholat untuk semua santri |

---

## 🚀 Deploy

**Target:** `portal.ponpesbaron.id` (subdomain dari [ponpesbaron.id](https://ponpesbaron.id)) via Hostinger  
**Database:** PostgreSQL 15

```bash
git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

---

<div align="center">
<sub>Portal Siswa Baron · Pondok Pesantren Baron · v2.4.3</sub>
</div>