# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.
> Versi: 2.4.1 | Update: Mei 2026

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron
**Versi:** 2.4.1 (Active Development)
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
| Icons | Lucide Icons + FontAwesome 6.5 |
| Charts | Chart.js 4.4 |
| Design | Baron Emerald Theme (Glassmorphism) |
| Font | Plus Jakarta Sans + DM Mono |
| Token Optimizer | RTK (hanya di lokal, TIDAK di PythonAnywhere) |

---

## 👥 SISTEM ROLE (8 Role Aktif)

| Role | Akses |
|------|-------|
| `superadmin` | Full access + kelola user |
| `admin` | Co-superadmin, import/export, tanpa kelola user |
| `pimpinan` | Lihat semua + evaluasi asatidz + approval |
| `guru` | Jurnal, nilai, evaluasi |
| `musyrif` | Ibadah, hafalan, pembinaan |
| `bk` | Bimbingan konseling |
| `bendahara` | Keuangan |
| `walisantri` | Lihat data anak (multi-anak) |

> **v2.4.0:** Role `admin` ditambahkan (akses data seperti superadmin, tapi tidak bisa kelola user)

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier |
|-------|-----|-----------|
| `User` | accounts | `id`, `username`, `role`, `name` |
| `Student` | students | **`nisn`** (PK), `nis` (7 digit), `jenis_kelamin`, `catatan` |
| `Assignment` | accounts | user + assignment_type + kelas + mata_pelajaran |
| `Schedule` | students | guru + hari + sesi + master_jam |
| `MasterJam` | core | sesi + jam_ke + jam_mulai/selesai |
| `MasterMapel` | core | nama + sesi + kode + is_active |
| `TahunAjaran` | core | nama + semester + is_active |
| `Attendance` | attendance | student + tanggal + jam_ke + **input_by** + **ada_penilaian** + **ketuntasan_materi** + **tujuan_pembelajaran** |
| `TitipanTugas` | attendance | guru + kelas + tanggal_berlaku |
| `IzinGuru` | kesantrian | guru + jenis_izin + foto_surat |
| `Ibadah` | kesantrian | siswa + tanggal + jenis + waktu |
| `TargetHafalan` | kesantrian | siswa + tahun_ajaran + semester |
| `Grade` | grades | nisn + mapel + nilai + jenis + **materi** + **input_by** |
| `Evaluation` | evaluations | nisn (FK) + jenis + kategori + evaluator + **foto** + **is_approved** + **approved_by** + **created_by** |

### Field Baru v2.4.x

**Attendance:**
- `ada_penilaian` (BooleanField, default=False)
- `ketuntasan_materi` (IntegerField, 0-100)
- `tujuan_pembelajaran` (TextField)
- `input_by` (FK ke User)
- `tipe_pengajar` choices: `guru_pengampu` (Guru Pengampu), `guru_piket` (Guru Piket)

**Grade:**
- `materi` (CharField, opsional)
- `input_by` (FK ke User)
- `jenis` choices: penugasan, tes_tulis, tes_lisan, portofolio, praktek, proyek, uts, uas

**Evaluation:**
- `foto` (ImageField, opsional)
- `is_approved` (BooleanField, default=False)
- `approved_by` (FK ke User)
- `approved_at` (DateTimeField)
- `created_by` (FK ke User)

**Student:**
- `nis` (CharField, 7 digit, unik)
- `jenis_kelamin` (CharField, L/P)
- `catatan` (TextField)

> **⚠️ CRITICAL — Custom User Model:**
> - Nama lengkap: **`user.name`** (BUKAN first_name/full_name)
> - **TIDAK ADA** `get_full_name()` → throws AttributeError
> - Selalu: `user.name or user.username`

> **Relasi Walisantri → Anak:**
> - `User.linked_student_nisn` → CharField (NISN anak pertama)
> - `User.linked_student_nisns` → JSONField (array NISN)

> **Siswa diidentifikasi dengan NISN, bukan auto-increment ID**

---

## 🆕 v2.4.1 Updates (Mei 2026)

### 1. Dashboard Guru (Todo List)
- Widget Todo List: presensi belum diisi, nilai belum diinput, izin tanpa titipan tugas
- Fix Last Login di Manajemen User
- "Materi Hari Ini" → "Jurnal Hari Ini"
- **Endpoint:** `GET /api/dashboard/guru/todo-list/`

### 2. Jurnal Guru (rename dari Presensi)
- **Rename:** Presensi → Jurnal Guru, Guru Asli → Guru Pengampu, Guru Pengganti → Guru Piket, Capaian Pembelajaran → Tujuan Pembelajaran
- **Wizard 4 step:** Step 1: Tipe Pengajar, Step 2: Info Kelas (filter per tipe), Step 3: Kehadiran, Step 4: Dokumentasi
- Guru Pengampu: dropdown dari Assignment
- Guru Piket: mapel filter per sesi
- Field baru: ketuntasan_materi (slider), ada_penilaian (toggle)
- Jurnal personal via field `input_by`
- **Endpoint:** `GET /api/attendance/jurnal/history/`, `GET /api/attendance/guru/assignment-info/`

### 3. Sistem Nilai
- 8 jenis penilaian (card grid + icon): penugasan, tes_tulis, tes_lisan, portofolio, praktek, proyek, uts, uas
- Mapel dari dropdown MasterMapel
- Field baru: materi (opsional)
- Filter personal via `input_by`
- Grafik: Tren Nilai per Jenis Penilaian
- **Endpoint:** `GET /api/grades/mapel-list/`

### 4. Evaluasi Santri
- **Rename:** Dalam Pembahasan → Dalam Penanganan, Diskusi & Tanggapan → Pembinaan
- Upload foto kejadian
- Sistem approval: Guru input → Admin/Pimpinan approve → visible ke wali kelas, BK, musyrif, pimpinan, walisantri
- Field: is_approved, approved_by, created_by
- **Endpoint:** `PATCH /api/evaluations/<id>/approve/`

### 5. Data Santri
- Field baru: NIS (7 digit), jenis_kelamin, catatan
- Kolom tabel: NISN, NIS, Nama, Kelas, Program, Jenis Kelamin, Catatan
- Guru hanya bisa lihat (tidak bisa CRUD)
- Template import Excel diupdate

### 6. Role & Akses
- Role `admin` baru (co-superadmin)
- Hapus link "Daftar sekarang" dari login
- Permission semua view diupdate

---

## 🆕 v2.3.11 Updates (2026-04-26)

### 1. Master Data System
| Model | Endpoint | Deskripsi |
|-------|----------|-----------|
| `MasterJam` | `GET /api/core/master-jam/` | Jam pelajaran per sesi (Tahfidz/KBM/Diniyah) |
| `MasterMapel` | `GET/POST /api/core/master-mapel/` | Mata pelajaran per sesi |
| `MasterMapel` | `GET /api/core/master-mapel/grouped/` | Grouped by sesi untuk dropdown |
| `MasterMapel` | `PATCH/DELETE /api/core/master-mapel/<id>/` | Update/soft-delete mapel |

### 2. Jadwal Mengajar (Admin)
- **Page:** `/jadwal-mengajar/` → `jadwal-mengajar.html`
- **Access:** Superadmin, Admin

### 3. Master Mapel Management (Admin)
- **Page:** `/master-mapel/` → `master-mapel.html`
- **Access:** Superadmin, Admin

---

## 📡 ENDPOINT BARU (v2.4.x)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/dashboard/guru/todo-list/` | Todo list kewajiban guru |
| GET | `/api/attendance/jurnal/history/` | History jurnal personal guru |
| GET | `/api/attendance/guru/assignment-info/` | Info kelas & mapel per guru |
| GET | `/api/core/master-mapel/by-sesi/?sesi=` | Mapel per sesi |
| GET | `/api/grades/mapel-list/` | List mapel per guru |
| PATCH | `/api/evaluations/<id>/approve/` | Approve kasus evaluasi |

---

## 🔧 FIXES & PATTERNS

### apiFetch Usage
```javascript
// apiFetch returns raw Response - MUST parse JSON!
const response = await window.apiFetch('core/master-mapel/');
const data = await response.json();

// Path WITHOUT /api/ prefix (buildUrl adds it)
window.apiFetch('kesantrian/incidents/')  // CORRECT
window.apiFetch('/api/kesantrian/...')    // WRONG - double /api/
```

### File Upload (FormData)
```python
# Backend: Add parser_classes
@parser_classes([MultiPartParser, FormParser, JSONParser])
```
```javascript
// Frontend: apiFetch auto-detects FormData
const formData = new FormData();
await window.apiFetch('izin-guru/', { method: 'POST', body: formData });
```

### FK String Comparison
```python
# WRONG - comparing FK object with string
queryset.filter(nisn=user.linked_student_nisn)

# CORRECT - use nisn__nisn for string field
queryset.filter(nisn__nisn=user.linked_student_nisn)
```

### Personal Filter Pattern (input_by)
```python
# Filter data berdasarkan guru yang input
queryset = queryset.filter(input_by=request.user)
```

---

## 🎨 KONVENSI FRONTEND

### Script Dependencies (Baron Emerald Theme)
```html
<!-- CSS -->
<link href="/static/css/baron-emerald.css?v=20260501" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Scripts (URUTAN PENTING!) -->
<script src="/static/js/utils.js?v=20260501"></script>
<script src="/static/js/apiConfig.js?v=20260501"></script>
<script src="/static/js/apiFetch.js?v=20260501"></script>
<script src="/static/js/auth-check.js?v=20260501" defer></script>
<script src="/static/js/nama-halaman.js?v=20260501"></script>
```

### Sidebar Structure (Baron Theme)
```html
<aside class="sidebar">
    <div class="sidebar-brand">...</div>
    <a class="back-chip" href="/">...</a>
    <nav class="sidebar-nav" id="sidebar-nav"></nav>
    <div class="sidebar-footer">
        <div class="user-chip">
            <div class="user-avatar" id="user-avatar-initials">U</div>
            <div class="user-meta">
                <div class="user-name" id="user-name-display">Loading...</div>
                <div class="user-role" id="user-role-display">-</div>
            </div>
        </div>
        <button class="btn-logout" onclick="window.logout()">🚪 Keluar</button>
    </div>
</aside>
```

### Referensi UI
- Patokan utama: `frontend/views/users.html`
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
| `no such column` | makemigrations lalu migrate |
| `NoneType 'nama'` | TahunAjaran aktif tidak ada |
| `403 Forbidden` | Cek permission_classes |
| Halaman tidak jalan | Script dependencies kurang/urutan salah |
| Static 404 | collectstatic --noinput |
| Chart kosong | Lowercase jenis, `nisn__nisn`, `kategori__iexact` |
| Dropdown mapel kosong | Cek endpoint `/api/core/master-mapel/grouped/` |
| CSS/sidebar rusak | Pakai `baron-emerald.css`, bukan `main.css` |
| Todo list kosong meski ada kewajiban | Cek field input_by di Attendance, pastikan terisi saat submit |
| Jurnal tidak personal | Cek field input_by, pastikan filter by input_by=request.user |
| Evaluasi terlihat semua guru | Bug pending — filter get_queryset() belum jalan |
| Role admin ngeblink | Cek roleAccess di auth-check.js, pastikan 'admin' ada |
| Foto evaluasi tidak tampil | Cek foto_url di serializer, pastikan absolute URL |

### Cek Log PythonAnywhere
```bash
cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50
```

---

## ⚠️ KNOWN BUGS (Belum Diperbaiki)

### 1. Donut Chart "Status Ketuntasan" di Halaman Nilai
- **Masalah:** Masih hitung semua guru, bukan per guru yang login
- **Lokasi:** `apps/grades/views.py` endpoint statistik/analytics
- **Root cause:** Queryset tidak difilter per guru di endpoint donut chart

### 2. Filter Visibilitas Evaluasi Santri
- **Masalah:** Guru non-wali kelas masih bisa lihat semua kasus
- **Lokasi:** `apps/evaluations/views.py` get_queryset()
- **Root cause:** Perubahan belum ter-deploy dengan benar di PythonAnywhere

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

### Seed Master Data (jika fresh)
```python
python manage.py shell
>>> from apps.core.models import TahunAjaran, MasterJam, MasterMapel
>>> TahunAjaran.objects.create(nama='2025/2026', semester='Genap', is_active=True)
>>> # Run seed commands:
>>> # python manage.py seed_master_jam
>>> # python manage.py seed_master_mapel
```

---

## 📋 CHECKLIST FITUR BARU

- [ ] Model + makemigrations + migrate
- [ ] Serializer
- [ ] View + @permission_classes + @parser_classes
- [ ] URL di urls.py app + backend_django/urls.py
- [ ] HTML dengan `baron-emerald.css` + script dependencies (urut!)
- [ ] Menu di auth-check.js (roleAccess + sidebar items)
- [ ] Test → push → deploy

---

## 📁 STRUKTUR FILE PENTING

```
portal-siswa/
├── CLAUDE.md                    # File ini
├── backend_django/
│   ├── apps/
│   │   ├── accounts/            # User, Assignment, permissions
│   │   ├── attendance/          # Jurnal Guru, TitipanTugas
│   │   ├── core/                # TahunAjaran, MasterJam, MasterMapel
│   │   ├── dashboard/           # Dashboard views
│   │   ├── evaluations/         # Evaluasi santri + approval
│   │   ├── finance/             # Keuangan
│   │   ├── grades/              # Nilai
│   │   ├── kesantrian/          # Ibadah, Hafalan, IzinGuru
│   │   ├── registration/        # Pendaftaran
│   │   └── students/            # Student, Schedule
│   └── backend_django/
│       └── urls.py              # Main URL routing
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   ├── baron-emerald.css    # Main theme (USE THIS!)
│   │   │   └── users.css            # User management styles
│   │   └── js/
│   │       ├── utils.js             # 1st - Utilities
│   │       ├── apiConfig.js         # 2nd - API config
│   │       ├── apiFetch.js          # 3rd - API wrapper
│   │       ├── auth-check.js        # 4th - Auth & sidebar
│   │       └── *.js                 # Page-specific scripts
│   └── views/
│       └── *.html                   # Page templates
└── docs/                            # Documentation
```

---

## 📋 DAFTAR TUGAS

### ✅ Selesai (v2.4.1)
| Task | Status |
|------|--------|
| Dashboard Guru Todo List | ✅ |
| Jurnal Guru (rename + wizard 4 step) | ✅ |
| 8 Jenis Penilaian | ✅ |
| Evaluasi Santri Approval System | ✅ |
| Data Santri field baru (NIS, JK, catatan) | ✅ |
| Role admin baru | ✅ |
| MasterJam & MasterMapel | ✅ |
| Jadwal Mengajar admin page | ✅ |
| Dropdown mapel di Assign Modal | ✅ |

### 🔄 Belum Selesai

**MEDIUM PRIORITY:**
| # | Task | Deskripsi |
|---|------|-----------|
| G | Program Al-Quran | Rename "Hafalan & Ziyadah" → "Program Al-Quran", import hafalan via Excel |
| H | Dashboard Pimpinan | Efektivitas KBM, presensi guru, breakdown santri per kelas |
| I | Approval Izin Guru | Alur: Guru submit → Admin/Pimpinan approve/tolak → notif guru |

**LOW PRIORITY:**
| # | Task | Deskripsi |
|---|------|-----------|
| J | Kritik & Saran | Semua akun → inbox Pimpinan (Putra/Putri, anonim/identitas) |
| K | Walisantri: Pertemuan Pengasuhan | Jadwal + presensi pertemuan pengasuhan |

---

## ⚡ RTK (Lokal Only)

```bash
rtk git status/log/diff/add/commit/push/pull
rtk grep "keyword" apps/
rtk err python manage.py runserver
```

---

## 💬 KOMUNIKASI

- **Bahasa:** Indonesia
- **Gaya:** Langsung ke solusi
- **Fitur baru:** Buat semua file sekaligus
- **Debug:** Root cause + fix langsung
- **Refactor:** Pertahankan pola yang ada

---

*Portal Siswa Baron v2.4.1 — Pondok Pesantren Baron — Mei 2026*
