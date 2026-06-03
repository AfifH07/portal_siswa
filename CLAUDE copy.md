# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.
> Versi: 2.3.9 | Update: April 2026

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron  
**Versi:** 2.3.9 (Active Development)  
**Institusi:** Pondok Pesantren Baron  
**Deployment:** PythonAnywhere — https://apiiip.pythonanywhere.com  
**Deskripsi:** Sistem Informasi Akademik Terpadu untuk manajemen santri, akademik, evaluasi karakter, dan komunikasi walisantri.

---

## 🏗️ ARSITEKTUR SISTEM

| Layer | Teknologi |
|-------|-----------|
| Backend | Django 4.2 + DRF 3.14 |
| Auth | SimpleJWT 5.3 |
| DB Staging | SQLite (PythonAnywhere) |
| DB Production | PostgreSQL 15 |
| PDF Export | reportlab 4.2.5 + weasyprint 62.3 |
| Image Upload | Pillow 10.4.0 |
| Frontend | Native HTML5/CSS3/Vanilla JS ES6+ |
| Icons | Lucide Icons |
| Charts | Chart.js 4.4 |
| Design | Baron Emerald Theme (Glassmorphism) |
| Font | Plus Jakarta Sans |
| Token Optimizer | RTK (hanya di lokal, TIDAK di PythonAnywhere) |

---

## 👥 SISTEM ROLE (7 Role Aktif)

> ⚠️ Role `wali_kelas` sudah DIHAPUS — semua dimigrasi ke `guru`

| Role | Akses |
|------|-------|
| `superadmin` | Full access |
| `pimpinan` | Lihat semua + evaluasi asatidz |
| `guru` | Presensi, nilai, evaluasi (termasuk eks-wali_kelas) |
| `musyrif` | Ibadah, hafalan, pembinaan |
| `bk` | Bimbingan konseling |
| `bendahara` | Keuangan |
| `walisantri` | Lihat data anak (multi-anak) |

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier |
|-------|-----|-----------|
| `User` | accounts | `id`, `username`, `role`, `name` |
| `Student` | students | **`nisn`** (bukan id!) |
| `Assignment` | accounts | user + assignment_type + kelas |
| `Attendance` | attendance | student + tanggal + jam_ke |
| `TitipanTugas` | attendance | id, guru, kelas, tanggal_berlaku, jam_ke |
| `IzinGuru` | kesantrian | id, guru, jenis_izin, foto_surat |
| `TahunAjaran` | core | id, is_active |
| `Ibadah` | kesantrian | siswa + tanggal + jenis + waktu |
| `TargetHafalan` | kesantrian | siswa + tahun_ajaran + semester |

> **⚠️ CRITICAL — Custom User Model:**
> - Nama lengkap: **`user.name`** (BUKAN first_name/full_name)
> - **TIDAK ADA** `get_full_name()` → throws AttributeError
> - Selalu: `user.name or user.username`

> **Relasi Walisantri → Anak:**
> - `User.linked_student_nisn` → CharField (NISN anak pertama)
> - `User.linked_student_nisns` → JSONField (array NISN: ["nisn1", "nisn2"])

> **Siswa diidentifikasi dengan NISN, bukan auto-increment ID**

---

## 🆕 FITUR BARU v2.3.9

### 1. Guru Pengganti (Attendance Step 3)
- Step 3 presensi: Guru Asli / Guru Pengganti
- Guru Pengganti = request.user otomatis
- Field baru Attendance: tipe_pengajar, guru_pengganti, materi, capaian_pembelajaran, catatan
- Titipan tugas relevan muncul otomatis di Step 3

### 2. Jurnal Piket
- File: frontend/views/jurnal-piket.html
- Endpoint: GET /api/attendance/jurnal-piket/?tanggal=YYYY-MM-DD
- Daftar sesi piket + Titipan Tugas Hari Ini

### 3. Titipan Tugas
- File: frontend/views/titipan-tugas.html
- Endpoints: GET/POST /api/attendance/titipan-tugas/
- GET /api/attendance/titipan-tugas/kelas-saya/
- PATCH /api/attendance/titipan-tugas/<id>/tandai/
- Model: guru, kelas, mata_pelajaran, jam_ke, tanggal_berlaku, deskripsi_tugas, status

### 4. Izin Guru
- File: frontend/views/izin-guru.html
- Endpoints: GET/POST /api/kesantrian/izin-guru/
- GET /api/kesantrian/izin-guru/export-pdf/
- Model: guru, jenis_izin, tanggal_mulai, tanggal_selesai, keterangan, foto_surat (WAJIB)

---

## 🔧 FIXES KRITIS

| Fix | Detail |
|-----|--------|
| apiFetch.js FormData | Deteksi FormData, skip Content-Type header — JANGAN revert |
| get_full_name() | Diganti user.name or user.username di semua file |
| IsGuru permission | Hanya role 'guru' (wali_kelas sudah hapus) |
| Media files | Serve via urls.py + PythonAnywhere static mapping /media/ |
| Assignment filter | Exclude 'piket' dan 'wali_kelas', bukan hanya kbm |

---

## 🎨 KONVENSI FRONTEND

### Script Dependencies (WAJIB urut di setiap halaman baru!)
```html
<script src="/static/js/utils.js" defer></script>
<script src="/static/js/apiConfig.js" defer></script>
<script src="/static/js/apiFetch.js" defer></script>
<script src="/static/js/auth-check.js" defer></script>
<script src="/static/js/auth.js" defer></script>
<script src="/static/js/page-events.js" defer></script>
<script src="/static/js/nama-halaman.js" defer></script>
```
> Jika ada script yang kurang → halaman tidak jalan. Penyebab error paling umum.

### Referensi UI
- Patokan utama: `frontend/views/students.html`
- Baca file tersebut dulu sebelum buat halaman baru

---

## ⚙️ KONVENSI BACKEND

### Upload File
```python
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([IsAuthenticated])
def nama_view(request):
    ...
```

### Migration
```bash
python manage.py makemigrations nama_app  # SELALU dulu
python manage.py migrate
```

---

## 🐛 ERROR UMUM & SOLUSI

| Error | Solusi |
|-------|--------|
| `AttributeError: get_full_name` | `user.name or user.username` |
| `400 Bad Request` upload file | Cek apiFetch.js isFormData fix |
| `invalid_image` | Cek file.type dan file.size di browser console |
| `no such column` | makemigrations lalu migrate |
| `NoneType 'nama'` | TahunAjaran aktif tidak ada → buat di shell |
| `403 Forbidden` | Cek permission_classes di view |
| Halaman tidak jalan | Script dependencies kurang/urutan salah |
| Static 404 | collectstatic --noinput |

### Cek Log PythonAnywhere
```bash
cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50
```

---

## 🚀 DEPLOY PYTHONANYWHERE

```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab
```

### Setup Fresh PythonAnywhere
```python
# Wajib buat TahunAjaran dulu!
from apps.core.models import TahunAjaran
TahunAjaran.objects.create(nama='2025/2026', semester='Genap', is_active=True)
# Tambah static mapping Web tab: /media/ → backend_django/media/
```

---

## 📋 CHECKLIST FITUR BARU

- [ ] Model + makemigrations + migrate
- [ ] Serializer
- [ ] View + @permission_classes + @parser_classes (jika ada upload)
- [ ] URL di urls.py app + backend_django/urls.py
- [ ] HTML dengan script dependencies lengkap (urut!)
- [ ] Menu di auth-check.js (roleAccess + sidebar)
- [ ] Test → push → deploy

---

## 📋 DAFTAR TUGAS YANG BELUM SELESAI

| # | Task | Priority |
|---|------|----------|
| 1 | Fix dashboard Evaluasi Santri (data tidak muncul di chart) | 🔴 High |
| 2 | Poin kinerja otomatis untuk guru pengganti | 🟡 Medium |
| 3 | Modal detail Titipan Tugas (read-only, klik row) | 🟡 Medium |
| 4 | Jadwal sekolah | 🟢 Low |

---

## ⚡ RTK (Lokal Only)

```bash
rtk git status/log/diff/add/commit/push/pull
rtk grep "keyword" apps/
rtk err python manage.py runserver
rtk curl http://localhost:8000/api/endpoint/
```

---

## 💬 KOMUNIKASI

- **Bahasa:** Indonesia
- **Gaya:** Langsung ke solusi
- **Fitur baru:** Buat semua file sekaligus
- **Debug:** Root cause + fix langsung
- **Refactor:** Pertahankan pola yang ada

---

*Portal Siswa Baron v2.3.9 — Pondok Pesantren Baron — April 2026*