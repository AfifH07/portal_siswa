# HANDOVER BARON v2

## UPDATE SESI 16-18 MEI 2026

### Fitur yang selesai
| Fitur | Detail | File Utama |
|-------|--------|------------|
| Fix tab Kelompok tidak muncul | Fix guard currentRole di initHafalan() | hafalan.js |
| Ganti label tab Kelompok | "Kelompok" -> "Kelompok Kajian Mingguan" | hafalan.html |
| Backend Kelompok Hafalan | Model KelompokHafalan + KelompokHafalanAnggota + 6 endpoint + migration 0018 (status HafalanRecord) + 0019 (model baru) | models.py, views.py, urls.py |
| Frontend tab Kelompok Hafalan | Tab baru, list kelompok, generate otomatis per kelas, CRUD kelompok, kelola anggota, set ketua | hafalan.js, hafalan.html |
| Field status setoran hafalan | Dropdown lancar/perlu_ulang/belum_selesai di modal + badge di tabel | hafalan.js, hafalan.html |
| Fix stat card Kajian Mingguan | fetchKajianSummaryForDashboard(nisn) dari kehadiran-kajian/ | dashboard.js |
| Fix selector santri Overview admin | Hapus guard NISN di initStudentSelector() | hafalan.js |
| Fix fetch data hafalan walisantri | Tambah fetch tartil/tahfidz/kompetensi/siswa di renderHafalanWalisantri() | hafalan.js |
| Child selector hafalan walisantri | Adopt pola ibadah.js - tab per anak, cross-page sync via localStorage | hafalan.js, hafalan.html |
| Fix flow pilih anak dashboard | Simpan selected_child_nisn + selected_child_data ke localStorage saat ganti anak | dashboard.js |

### Versi file setelah sesi ini
| File | Versi |
|------|-------|
| dashboard.js | bump terbaru |
| wali-dashboard.css | ?v=20260516a |
| hafalan.js | bump terbaru |
| hafalan.html | bump terbaru |
| hafalan-baron.css | bump terbaru |
| absensi-sholat.js | ?v=20260516d |
| absensi-sholat.css | ?v=20260516b |
| auth-check.js | ?v=20260515a |
| grades.js | bump terbaru |

### Migration terakhir
- 0018: tambah field status ke HafalanRecord
- 0019: model KelompokHafalan + KelompokHafalanAnggota

### Endpoint aktif Kelompok Hafalan
GET/POST         kesantrian/hafalan/kelompok/
POST             kesantrian/hafalan/kelompok/generate/
GET/PATCH/DELETE kesantrian/hafalan/kelompok/<id>/
GET/POST         kesantrian/hafalan/kelompok/<id>/anggota/
DELETE           kesantrian/hafalan/kelompok/<id>/anggota/<nisn>/
PATCH            kesantrian/hafalan/kelompok/<id>/anggota/<nisn>/set-ketua/

### Pending sesi berikutnya
| # | Item | File | Catatan |
|---|------|------|---------|
| 1 | Catatan guru per santri belum tersambung backend | hafalan.js | saveCatatan() masih fake save |
| 2 | Guru Tartil / Guru Tahfidz / Status Khidmat | hafalan.js | UI sudah ada, model/endpoint belum ada |
| 3 | Bug halaman Nilai walisantri - UH/UTS/UAS kosong | grades.js, grades/views.py | Backend tidak return nilai_uh/uts/uas, perlu tambah breakdown di get_average_grade() |
| 4 | Bug Nilai walisantri - Terbaik = Perlu Perhatian | grades.js | Terjadi jika hanya 1 mapel, perlu guard |
| 5 | Rapor section unstyled di halaman Nilai walisantri | grades.js | Legacy render di loadWalisantriView() tanpa CSS |
| 6 | grades.js masih pakai raw fetch() | grades.js | Technical debt, migrasi ke apiFetch() di sesi tersendiri |
| 7 | Test child selector hafalan walisantri multi-anak | hafalan.js | Belum dikonfirmasi screenshot |

### Catatan arsitektur penting
- KelompokHafalan BERBEDA dari KelompokPengasuhan
  KelompokPengasuhan = kelompok kajian mingguan (sudah lama)
  KelompokHafalan = kelompok hafalan baru (dibuat sesi ini)
- Child selector hafalan pakai ID #hafalan-child-selector
  (bukan #child-selector milik ibadah.html)
- grades.js tidak pakai apiFetch() - semua masih raw fetch()
  dengan Authorization header manual
- ibadah-module.css berisi style .child-tab dan .child-selector
  yang dipakai bersama hafalan.html

## UPDATE SESI 15 MEI 2026

### Fitur yang selesai di sesi ini
| Fitur | Detail | File Utama |
|-------|--------|------------|
| Redesign dashboard walisantri | Hero card gradient, topbar greeting, 4 stat card, aktivitas terkini, status tagihan inline, akses cepat 6 item 1 baris | dashboard.js, wali-dashboard.css |
| Fix kehadiran kajian walisantri | fetchKehadiranKajian(nisn) ditambahkan ke renderHafalanWalisantri() | hafalan.js |
| Cleanup dashboard walisantri | Hapus duplikat renderWalisantriDashboard(), hapus CSS conflict wali-dashboard.css | dashboard.js, wali-dashboard.css |

### Konfirmasi arsitektur dashboard walisantri
- Route /dashboard/ -> unified_dashboard (views.py) -> dashboard.html -> dashboard.js
- renderWalisantriDashboard() adalah satu-satunya entry point untuk walisantri
- dashboard-parent.html TIDAK dipakai untuk route /dashboard/
- Fungsi helper yang masih aktif: fetchWalisantriAttendanceStats,
  fetchWalisantriGradeStats, renderWalisantriGradesTable,
  renderWorshipTracker, renderDualCharts, getWalisantriInitials
- Fungsi baru ditambahkan: fetchWalisantriTagihan(), fetchWalisantriSummary()

### Versi file setelah sesi ini
- dashboard.js -> ?v=20260515g
- wali-dashboard.css -> ?v=20260515d
- hafalan.js -> (versi setelah fix fetchKehadiranKajian)

### Pending (lanjutkan di sesi berikutnya)
1. Fix tabel ibadah harian - renderWorshipTrackerUI() styling cramped
2. Fix icon warna Akses Cepat - .wd-menu-icon background tidak muncul
3. Fix data ibadah 0% / kajian 0 - field mapping fetchWalisantriSummary()
   vs response kesantrian/my-children-summary/
4. Test search kelompok di tab Kelompok hafalan
5. Seed data KompetensiSantri via Django admin

## UPDATE SESI 16 MEI 2026

### Fitur yang selesai
| Fitur | Detail | File Utama |
|-------|--------|------------|
| Fix tabel ibadah harian | Tambah CSS worship tracker di wali-dashboard.css | wali-dashboard.css |
| Fix icon Akses Cepat | Perkuat warna background wd-menu-icon | dashboard.js |
| Build halaman Absensi Sholat | UI lengkap: kelas, tanggal, tabel santri, 5 waktu sholat | absensi-sholat.html/js/css |

### Versi file setelah sesi ini
- dashboard.js -> ?v=20260515i
- wali-dashboard.css -> ?v=20260515e
- auth-check.js -> ?v=20260515a
- absensi-sholat.js -> ?v=20260516b
- absensi-sholat.css -> ?v=20260515a

### Pending
1. Fix POST 405 absensi-sholat/record-bulk/ - backend lokal ok,
   kemungkinan server belum sync
2. Fix stat card Kajian Mingguan - field mapping salah di dashboard.js
3. Selector santri Overview belum muncul untuk admin (hafalan.js)
4. Test search kelompok di tab Kelompok hafalan

## TAMBAHAN SESI 16 MEI 2026 (lanjutan)

### Fitur tambahan yang selesai
| Fitur | Detail | File Utama |
|-------|--------|------------|
| Fix URL conflict record-bulk | Pindah path statis sebelum dinamis di kesantrian/urls.py | urls.py |
| Upgrade tab Edit Absensi | Hapus + edit status + tambah per-santri per-waktu sholat | absensi-sholat.js/css |
| Fix rekap nilai dashboard walisantri | Tambah CSS grade cards + ganti raw fetch ke apiFetch | dashboard.js, wali-dashboard.css |
| Fix fast menu walisantri | 3 href salah diperbaiki, label Kajian -> Pengasuhan | dashboard.js |
| Backend kelompok hafalan | Migrasi is_ketua + serializer + endpoint set-ketua + bulk presensi | models.py, serializers.py, views.py, urls.py |
| Frontend tab Kelompok | CRUD kelompok + kelola anggota + tunjuk ketua | hafalan.js, hafalan-baron.css |

### Pending sesi berikutnya
1. Prompt #12C — Frontend catat setoran pertemuan + lihat progres kelompok
   (backend sudah siap, tinggal frontend)
2. Fix stat card Kajian Mingguan — baca ibadah_summary.total_hadir (salah),
   fix: fetchKajianSummaryForDashboard(nisn) dari kehadiran-kajian/
3. Fix selector santri tab Overview untuk admin di hafalan.js
4. Catatan guru per santri — saveCatatan() masih fake save
5. Guru Tartil / Guru Tahfidz / Status Khidmat — belum ada model/endpoint

### Versi file setelah sesi ini
- dashboard.js -> ?v=20260516g
- wali-dashboard.css -> ?v=20260516a
- absensi-sholat.js -> ?v=20260516d
- absensi-sholat.css -> ?v=20260516b
- hafalan.js -> bump terbaru
- hafalan-baron.css -> bump terbaru
- auth-check.js -> ?v=20260515a
