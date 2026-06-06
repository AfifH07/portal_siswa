# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.
> Versi: 2.4.3 | Update: 6 Juni 2026

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron  
**Versi:** 2.4.3 (Active Development)  
**Institusi:** Pondok Pesantren Baron  
**Deployment:** PythonAnywhere — https://apiiip.pythonanywhere.com  
**Deskripsi:** Sistem Informasi Akademik Terpadu untuk manajemen santri, akademik, evaluasi karakter, pemantauan ibadah, hafalan Al-Quran, dan komunikasi walisantri.

---

## 🏗️ ARSITEKTUR SISTEM

| Layer | Teknologi |
|-------|-----------|
| Backend | Django 4.2 + DRF 3.14 |
| Auth | SimpleJWT 5.3 |
| DB Staging | SQLite (PythonAnywhere) |
| DB Production | PostgreSQL 15 |
| PDF Export | reportlab 4.2.5 + weasyprint 62.3 |
| Excel | openpyxl |
| Image Upload | Pillow 10.4.0 |
| Frontend | Native HTML5/CSS3/Vanilla JS ES6+ |
| Icons | Lucide Icons + FontAwesome 6.5 |
| Charts | Chart.js 4.4 |
| Design | Baron Emerald Theme (Glassmorphism) |
| Font | Plus Jakarta Sans + DM Mono |

---

## 👥 SISTEM ROLE (9 Role Aktif)

| Role | Akses |
|------|-------|
| `superadmin` | Full access + kelola user |
| `admin` | Co-superadmin: import/export, semua data, tanpa kelola user |
| `pimpinan` | Lihat semua approved + approval + close case |
| `guru` | Jurnal KBM, nilai, evaluasi (kelas sendiri) |
| `musyrif` | Ibadah, hafalan, pembinaan santri |
| `bk` | Bimbingan konseling (semua evaluasi approved) |
| `bendahara` | Keuangan |
| `walisantri` | Lihat data anak (hafalan, evaluasi visibility=semua, BLP) |
| `admin_santri` | Input BLP + presensi sholat semua santri |

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier/Keterangan |
|-------|-----|-----------------------|
| `User` | accounts | `id`, `username`, `role`, `name` (bukan first_name) |
| `Student` | students | PK = **`nisn`** (string), `nis` (7 digit), `jenis_kelamin`, `catatan` |
| `Assignment` | accounts | user + assignment_type + kelas + mata_pelajaran + `hafalan_type` |
| `Schedule` | students | guru + hari + sesi + master_jam |
| `MasterJam` | core | sesi + jam_ke + jam_mulai/selesai |
| `MasterMapel` | core | nama + sesi + kode + is_active |
| `TahunAjaran` | core | nama + semester + is_active |
| `Attendance` | attendance | student + tanggal + jam_ke + input_by + ada_penilaian + ketuntasan_materi + tujuan_pembelajaran |
| `TitipanTugas` | attendance | guru + kelas + tanggal_berlaku |
| `IzinGuru` | kesantrian | guru + jenis_izin + foto_surat |
| `Ibadah` | kesantrian | siswa + tanggal + jenis + waktu |
| `HafalanRecord` | kesantrian | siswa + tanggal + juz + halaman_dari + halaman_sampai + jumlah_halaman + catatan + status + input_by |
| `TargetHafalan` | kesantrian | siswa + tahun_ajaran + semester |
| `KompetensiSantri` | kesantrian | santri (OneToOne) + guru_tartil + guru_tahfidz + lulus_tartil + lulus_tahfidz + status_khidmat + tanggal_mulai_khidmat + tanggal_akhir_khidmat |
| `BLPEntry` | kesantrian | siswa + week_start + week_end + indicator_values (JSONField) + total_score (float %) + status |
| `Incident` | kesantrian | siswa + jenis + deskripsi + foto + resolved |
| `Grade` | grades | nisn + mapel + nilai + jenis + materi + input_by |
| `Evaluation` | evaluations | nisn + jenis + kategori + foto + is_approved + keputusan_final + closed_by + closed_at |
| `EvaluationComment` | evaluations | evaluation + user + jenis + content + visibility + foto |

### ⚠️ CRITICAL — Hal yang Sering Salah

```python
# NAMA USER — SELALU user.name, BUKAN first_name atau get_full_name()
user.name or user.username   # BENAR
user.get_full_name()         # ERROR — method tidak ada

# STUDENT FK FILTER — nisn adalah string, bukan integer
Grade.objects.filter(nisn__nisn=<string>)   # BENAR
Grade.objects.filter(nisn=<string>)          # SALAH

# WALISANTRI → ANAK
user.linked_student_nisn     # CharField — NISN anak pertama
user.linked_student_nisns    # JSONField — array semua NISN anak

# STUDENT PK = nisn (string), bukan auto-increment
Student.objects.get(nisn='1234567890')
```

---

## 🔑 BLP SYSTEM

`BLPEntry.indicator_values` = JSONField dengan struktur:
```json
{
  "ibadah_religius": {"sholat_subuh": 0, "sholat_dzuhur": 1, ...},
  "akhlak_perilaku": {"bicara_santun": 1, ...},
  "resiliensi": {...},
  "kecerdikan": {...},
  "refleksi": {...},
  "timbal_balik": {...}
}
```

**59 indikator total:**
- `ibadah_religius` (18): sholat_subuh, sholat_dzuhur, sholat_ashar, sholat_maghrib, sholat_isya, sholat_jumat, sholat_rawatib, sholat_tahajud, sholat_dhuha, tadarus, hafalan_quran, murojaah, tadabur, doa_harian, puasa_sunnah, wudhu, infaq, halaqoh
- `akhlak_perilaku` (25): bicara_santun, panggilan_baik, senyum_salam, siapkan_buku, belajar_malam, rapikan_tempat_tidur, mandi_pagi, mandi_sore, sikat_gigi, cuci_pakaian, setrika_pakaian, siapkan_seragam, deodoran, potong_kuku, piket, rapikan_sandal, potong_rambut, cuci_rambut, perlengkapan_sholat, baju_jumat, laptop_tugas, hp_syarie, jas_almamater, jaga_fasilitas, buang_sampah
- `resiliensi` (4): tepat_waktu_kegiatan, selesaikan_tugas, suka_tantangan, libatkan_diri
- `kecerdikan` (4): ajukan_pertanyaan, gunakan_sumber_daya, coba_alternatif, gagasan_inovatif
- `refleksi` (4): baca_buku, serap_informasi, catat_tulis, cara_belajar
- `timbal_balik` (4): teladani_sukses, dengarkan_nasihat, kerjasama, bantu_orang_lain

**`calculate_scores()` dipanggil otomatis di `save()`.**

**Predikat:** Mumtaz ≥90% · Jayyid Jiddan ≥75% · Jayyid ≥60% · Maqbul ≥40% · Perlu Pembinaan <40%

---

## ⚙️ CONSTRAINTS WAJIB — JANGAN DILANGGAR

- `apiFetch('endpoint/')` TANPA prefix `/api/` dan tanpa leading slash
- Student PK = `nisn` (string)
- Event handler via `.onclick = fn`, BUKAN inline HTML `onclick=""` (di `innerHTML` dinamis boleh `onclick="window.fn()"`)
- Cek duplikat fungsi sebelum tambah fungsi baru
- `evaluasi-asatidz.js` TIDAK BOLEH diubah sama sekali
- Bump `?v=YYYYMMDD` setiap perubahan JS/CSS
- `grades.js` masih raw `fetch()` — jangan migrate ke `apiFetch`
- Template download file: WAJIB `@login_required` + `HttpResponse` (bukan `@api_view` — DRF paksa response jadi JSON, file tidak bisa didownload)
- Fungsi import yang return JSON: boleh `@api_view` biasa

---

## 🧠 ALUR WAJIB SETIAP BUG (JANGAN DILANGGAR)

```
[1] PROMPT INVESTIGASI (read-only: grep/cat/sed)
[2] Tunggu output dari user
[3] ANALISIS → tentukan root cause
[4] Jika belum jelas → PROMPT INVESTIGASI LANJUTAN → kembali ke [2]
[5] Root cause TERKONFIRMASI → PROMPT FIX
[6] Konfirmasi hasil deploy
[7] Jika masih gagal → kembali ke [1]

DILARANG skip ke fix tanpa investigasi
DILARANG fix berdasarkan asumsi
```

---

## 📡 ENDPOINT PENTING

### Auth (`/api/auth/`)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `login/` | Login |
| GET | `status/` | Cek role & auth status |
| GET | `users/` | List user |

### Kesantrian (`/api/kesantrian/`)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET\|POST | `hafalan/` | List & tambah setoran hafalan |
| GET | `hafalan/template/` | Download template Excel hafalan |
| POST | `hafalan/import/` | Import hafalan bulk (CSV/Excel) |
| GET\|POST | `blp/` | List & buat BLP entry |
| GET | `download-template-blp/` | Download template Excel BLP (61 kolom) |
| POST | `import-blp/` | Import BLP bulk (Excel) |
| GET\|POST | `ibadah/` | Presensi sholat |
| GET | `ibadah/template-presensi-csv/` | Download template presensi |
| POST | `ibadah/import-presensi-csv/` | Import presensi sholat bulk |
| GET | `kompetensi/<nisn>/` | Data kompetensi santri |
| PATCH | `kompetensi/<nisn>/update/` | Update kompetensi |
| GET\|POST | `incidents/` | List & tambah incident |
| GET | `download-rapor/<nisn>/` | Export PDF rapor |
| GET | `download-blp/<nisn>/` | Export PDF BLP |

### Evaluations (`/api/evaluations/`)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET\|POST | `` | List & buat evaluasi |
| PATCH | `<id>/approve/` | Approve evaluasi |
| PATCH | `<id>/close/` | Close kasus + keputusan final |
| GET\|POST | `<id>/comments/` | Komentar evaluasi |

---

## 🔧 PATTERNS PENTING

### apiFetch (Frontend)
```javascript
// apiFetch returns raw Response — HARUS parse JSON
const response = await window.apiFetch('evaluations/');
const data = await response.json();

// File upload — apiFetch auto-detect FormData
const formData = new FormData();
formData.append('file', file);
await window.apiFetch('kesantrian/import-blp/', { method: 'POST', body: formData });
```

### Template Download (Backend)
```python
# WAJIB @login_required + HttpResponse — BUKAN @api_view
@login_required
def download_template_xxx(request):
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="template.xlsx"'
    return response
```

### Import Excel (Backend)
```python
# Boleh @api_view karena return JSON
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_xxx_excel(request):
    ...
    return Response({'success': True, 'berhasil': n, 'gagal': m, 'errors': [...]})
```

---

## 🎨 SCRIPT DEPENDENCIES (URUTAN WAJIB)

```html
<link href="/static/css/baron-emerald.css?v=20260530logo" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>

<script src="/static/js/utils.js?v=..."></script>       <!-- 1st -->
<script src="/static/js/apiConfig.js?v=..."></script>   <!-- 2nd -->
<script src="/static/js/apiFetch.js?v=..."></script>    <!-- 3rd -->
<script src="/static/js/auth-check.js?v=..." defer></script>  <!-- 4th -->
<script src="/static/js/nama-halaman.js?v=..."></script>
```

---

## 🐛 ERROR UMUM & SOLUSI

| Error | Solusi |
|-------|--------|
| `AttributeError: get_full_name` | Pakai `user.name or user.username` |
| `no such column` | `makemigrations` → `migrate` |
| `NoneType 'nama'` | TahunAjaran aktif tidak ada |
| Static 404 | `collectstatic --noinput` |
| File download jadi JSON | Ganti `@api_view` ke `@login_required` + `HttpResponse` |
| Dropdown mapel kosong | Cek endpoint `/api/core/master-mapel/grouped/` |
| CSS/sidebar rusak | Pakai `baron-emerald.css`, bukan `main.css` |
| Chart kosong | Cek lowercase jenis, `nisn__nisn`, `kategori__iexact` |

---

## 🚀 DEPLOY PYTHONANYWHERE

```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
```

Log error:
```bash
cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50
```

---

## 📁 FILE KUNCI

```
portal-siswa/
├── CLAUDE.md                          ← file ini, dibaca Claude Code setiap sesi
├── README.md                          ← dokumentasi proyek untuk manusia
├── backend_django/apps/
│   ├── accounts/
│   │   └── models.py                  ← User (name, role, linked_student_nisns)
│   ├── kesantrian/
│   │   ├── models.py                  ← BLPEntry, HafalanRecord, KompetensiSantri, Ibadah
│   │   ├── serializers.py             ← BLPEntryCreateSerializer, HafalanRecordSerializer
│   │   ├── views.py                   ← semua logic import/export/BLP/hafalan/presensi
│   │   └── urls.py                    ← semua route kesantrian
│   ├── evaluations/
│   │   └── views.py                   ← get_filtered_queryset_for_user() helper
│   └── students/
│       └── models.py                  ← Student (nisn sebagai PK)
└── frontend/
    ├── public/
    │   ├── images/
    │   │   ├── logo_ponpes.png        ← logo sidebar
    │   │   └── logo_watermark.png     ← watermark halaman
    │   ├── css/
    │   │   └── baron-emerald.css      ← main theme
    │   └── js/
    │       ├── auth-check.js          ← sidebar + role routing
    │       ├── hafalan.js             ← Program Al-Quran (v=20260605a)
    │       ├── blp.js                 ← Input BLP (v=20260605a)
    │       ├── absensi-sholat.js      ← Presensi sholat
    │       ├── karakter.js            ← Modal incident + BLP view walisantri
    │       ├── evaluations.js         ← Evaluasi santri
    │       ├── grades.js              ← Nilai (raw fetch — jangan migrate)
    │       └── evaluasi-asatidz.js    ← JANGAN DIUBAH
    └── views/
        ├── hafalan.html
        ├── blp.html
        ├── absensi-sholat.html
        ├── karakter.html
        └── *.html
```

---

*Portal Siswa Baron v2.4.3 — Pondok Pesantren Baron — 6 Juni 2026*
