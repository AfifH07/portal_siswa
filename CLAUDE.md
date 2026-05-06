# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.
> Versi: 2.4.2 | Update: 4 Mei 2026

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron
**Versi:** 2.4.2 (Active Development)
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
| `pimpinan` | Lihat semua approved + approval + close case |
| `guru` | Jurnal, nilai, evaluasi (personal + wali kelas) |
| `musyrif` | Ibadah, hafalan, pembinaan (approved) |
| `bk` | Bimbingan konseling (semua approved) |
| `bendahara` | Keuangan |
| `walisantri` | Lihat data anak (multi-anak, hanya visibility=semua) |

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier |
|-------|-----|-----------|
| `User` | accounts | `id`, `username`, `role`, `name` |
| `Student` | students | **`nisn`** (PK), `nis` (7 digit), `jenis_kelamin`, `catatan` |
| `Assignment` | accounts | user + assignment_type + kelas + mata_pelajaran + **hafalan_type** |
| `Schedule` | students | guru + hari + sesi + master_jam |
| `MasterJam` | core | sesi + jam_ke + jam_mulai/selesai |
| `MasterMapel` | core | nama + sesi + kode + is_active |
| `TahunAjaran` | core | nama + semester + is_active |
| `Attendance` | attendance | student + tanggal + jam_ke + input_by + ada_penilaian + ketuntasan_materi + tujuan_pembelajaran |
| `TitipanTugas` | attendance | guru + kelas + tanggal_berlaku |
| `IzinGuru` | kesantrian | guru + jenis_izin + foto_surat |
| `Ibadah` | kesantrian | siswa + tanggal + jenis + waktu |
| `TargetHafalan` | kesantrian | siswa + tahun_ajaran + semester |
| `HafalanRecord` | kesantrian | siswa + tanggal + juz + halaman + catatan |
| `Grade` | grades | nisn + mapel + nilai + jenis + materi + input_by |
| `Evaluation` | evaluations | nisn (FK) + jenis + kategori + foto + is_approved + **keputusan_final** + **closed_by** + **closed_at** |
| `EvaluationComment` | evaluations | evaluation (FK) + user + jenis + content + **visibility** + **foto** |

### Field Baru v2.4.2

**Evaluation:**
- `keputusan_final` (TextField, blank) — keputusan akhir dari pimpinan
- `closed_by` (FK User, null) — siapa yang close kasus
- `closed_at` (DateTimeField, null) — kapan kasus di-close

**EvaluationComment:**
- `visibility` (CharField, choices: `internal`/`semua`, default=`internal`)
- `foto` (ImageField, upload_to='evaluations/pembinaan/', null)

**Assignment (v2.4.1):**
- `hafalan_type` (CharField, choices: tahfidz/tahsin/murojaah, null)

### Field Baru v2.4.x (sebelumnya)

**Attendance:**
- `ada_penilaian` (BooleanField, default=False)
- `ketuntasan_materi` (IntegerField, 0-100)
- `tujuan_pembelajaran` (TextField)
- `input_by` (FK ke User)
- `tipe_pengajar` choices: `guru_pengampu`, `guru_piket`

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

## 🆕 v2.4.2 Updates (4 Mei 2026)

### 1. Evaluasi Santri — Close Case & Comment Visibility

**Model EvaluationComment baru:**
- `visibility` — `internal` (default) atau `semua`
- `foto` — upload foto pembinaan

**Model Evaluation baru:**
- `keputusan_final` — keputusan akhir pimpinan
- `closed_by`, `closed_at` — tracking siapa & kapan close

**Endpoint baru:**
- `PATCH /api/evaluations/<id>/close/` — pimpinan close kasus

**Frontend:**
- Walisantri hanya lihat comment dengan `visibility=semua`
- Form tambah pembinaan dengan visibility & foto
- Button "Selesaikan Kasus" untuk pimpinan

### 2. Fix Bug Evaluasi Stats & Filter

**BEFORE:**
```python
# Bug: get_queryset() dan evaluation_statistics() punya logic terpisah
# Hasil: Stats card = 0, filter tidak konsisten
```

**AFTER:**
```python
# Fix: Helper function dipakai bersama
def get_filtered_queryset_for_user(user, base_queryset=None):
    # superadmin, admin → semua
    # pimpinan → is_approved=True
    # bk → is_approved=True (semua santri)
    # musyrif → is_approved=True
    # guru (wali) → own_cases OR (wali_classes + approved)
    # guru (non-wali) → own_cases saja
    # walisantri → linked_nisns + approved
```

### 3. Program Al-Quran (Hafalan)

**Model HafalanRecord baru:**
- `siswa` (FK Student)
- `tanggal`, `juz`, `halaman_dari`, `halaman_sampai`
- `jumlah_halaman`, `catatan`
- `input_by` (FK User)

**Assignment update:**
- `hafalan_type` — tahfidz/tahsin/murojaah

**Frontend:**
- Tab Setoran Hafalan dengan CRUD
- Tab Import Excel untuk bulk import
- Dropdown Juz 1-30

---

## 🆕 v2.4.1 Updates (Mei 2026)

### 1. Dashboard Guru (Todo List)
- Widget Todo List: presensi belum diisi, nilai belum diinput, izin tanpa titipan tugas
- **Endpoint:** `GET /api/dashboard/guru/todo-list/`

### 2. Jurnal Guru (rename dari Presensi)
- **Rename:** Presensi → Jurnal Guru, Guru Asli → Guru Pengampu, Guru Pengganti → Guru Piket
- **Wizard 4 step:** Tipe Pengajar → Info Kelas → Kehadiran → Dokumentasi
- **Endpoint:** `GET /api/attendance/jurnal/history/`, `GET /api/attendance/guru/assignment-info/`

### 3. Sistem Nilai
- 8 jenis penilaian dengan card grid + icon
- **Endpoint:** `GET /api/grades/mapel-list/`

### 4. Evaluasi Santri Approval
- Guru input → Admin/Pimpinan approve
- **Endpoint:** `PATCH /api/evaluations/<id>/approve/`

### 5. Data Santri
- Field baru: NIS, jenis_kelamin, catatan

### 6. Role Admin
- Co-superadmin tanpa kelola user

---

## 📡 ENDPOINT EVALUASI (Lengkap)

| Method | Endpoint | Deskripsi | Access |
|--------|----------|-----------|--------|
| GET | `/api/evaluations/` | List evaluasi (filtered by role) | all |
| POST | `/api/evaluations/` | Tambah evaluasi | guru, pimpinan, admin |
| GET | `/api/evaluations/<id>/` | Detail evaluasi + comments | all |
| PUT/PATCH | `/api/evaluations/<id>/` | Update evaluasi | owner, admin |
| DELETE | `/api/evaluations/<id>/` | Hapus evaluasi | owner, admin |
| GET | `/api/evaluations/statistics/` | Stats (filtered by role) | all |
| PATCH | `/api/evaluations/<id>/approve/` | Approve evaluasi | pimpinan, superadmin |
| PATCH | `/api/evaluations/<id>/unapprove/` | Batalkan approval | pimpinan, superadmin |
| **PATCH** | **`/api/evaluations/<id>/close/`** | **Close kasus + keputusan final** | **pimpinan, superadmin** |
| GET | `/api/evaluations/<id>/comments/` | List comments (filtered visibility) | all |
| POST | `/api/evaluations/<id>/comments/` | Tambah comment + foto | guru, bk, pimpinan, admin |
| DELETE | `/api/evaluations/comments/<id>/` | Hapus comment | owner, admin |

---

## 📡 ENDPOINT HAFALAN (Baru)

| Method | Endpoint | Deskripsi | Access |
|--------|----------|-----------|--------|
| GET | `/api/kesantrian/hafalan/` | List setoran hafalan | guru, musyrif, admin |
| POST | `/api/kesantrian/hafalan/` | Tambah setoran | guru, musyrif, admin |
| PATCH | `/api/kesantrian/hafalan/<id>/` | Update setoran | owner, admin |
| DELETE | `/api/kesantrian/hafalan/<id>/` | Hapus setoran | owner, admin |
| POST | `/api/kesantrian/hafalan/import/` | Import Excel | admin |
| GET | `/api/kesantrian/hafalan/template/` | Download template Excel | admin |

---

## 🔧 FIXES & PATTERNS

### apiFetch Usage
```javascript
// apiFetch returns raw Response - MUST parse JSON!
const response = await window.apiFetch('evaluations/');
const data = await response.json();

// Path WITHOUT /api/ prefix (buildUrl adds it)
window.apiFetch('kesantrian/hafalan/')  // CORRECT
window.apiFetch('/api/kesantrian/...')  // WRONG - double /api/
```

### File Upload (FormData)
```python
# Backend: Add parser_classes
@parser_classes([MultiPartParser, FormParser, JSONParser])
```
```javascript
// Frontend: apiFetch auto-detects FormData
const formData = new FormData();
formData.append('foto', fotoFile);
await window.apiFetch('evaluations/1/comments/', { method: 'POST', body: formData });
```

### FK String Comparison
```python
# WRONG - comparing FK object with string
queryset.filter(nisn=user.linked_student_nisn)

# CORRECT - use nisn__nisn for string field
queryset.filter(nisn__nisn=user.linked_student_nisn)
```

### Role-Based Queryset Filter (Evaluasi)
```python
# Gunakan helper function untuk konsistensi
from apps.evaluations.views import get_filtered_queryset_for_user

queryset = get_filtered_queryset_for_user(request.user)
```

### Walisantri Comment Visibility
```javascript
// Filter comments di frontend untuk walisantri
if (userRole === 'walisantri') {
    comments = comments.filter(c => c.visibility === 'semua');
}
```

---

## 🎨 KONVENSI FRONTEND

### Script Dependencies (Baron Emerald Theme)
```html
<!-- CSS -->
<link href="/static/css/baron-emerald.css?v=20260504" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Scripts (URUTAN PENTING!) -->
<script src="/static/js/utils.js?v=20260504"></script>
<script src="/static/js/apiConfig.js?v=20260504"></script>
<script src="/static/js/apiFetch.js?v=20260504"></script>
<script src="/static/js/auth-check.js?v=20260504" defer></script>
<script src="/static/js/nama-halaman.js?v=20260504"></script>
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
| Todo list kosong | Cek field input_by di Attendance |
| Stats evaluasi = 0 | ✅ **FIXED v2.4.2** — pakai helper function |
| Comment tidak tampil walisantri | Cek visibility='semua' di comment |
| Foto pembinaan tidak tampil | Cek foto_url di serializer |

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

---

## ✅ BUGS YANG SUDAH DIPERBAIKI (v2.4.2)

### 1. Stats Card Evaluasi = 0 ✅
- **Sebelum:** Stats selalu 0 untuk guru non-wali
- **Sesudah:** Pakai `get_filtered_queryset_for_user()` helper

### 2. Filter Evaluasi Per Role ✅
- **Sebelum:** Guru non-wali lihat semua kasus
- **Sesudah:** Logic role-based filter yang benar di helper function

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

---

## 📋 CHECKLIST FITUR BARU

- [ ] Model + makemigrations + migrate
- [ ] Serializer (dengan SerializerMethodField untuk FK name)
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
│   │   ├── evaluations/         # Evaluasi + approval + comments + close
│   │   ├── finance/             # Keuangan
│   │   ├── grades/              # Nilai
│   │   ├── kesantrian/          # Ibadah, Hafalan, HafalanRecord, IzinGuru
│   │   ├── registration/        # Pendaftaran
│   │   └── students/            # Student, Schedule
│   └── backend_django/
│       └── urls.py              # Main URL routing
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── baron-emerald.css    # Main theme (USE THIS!)
│   │   └── js/
│   │       ├── utils.js             # 1st - Utilities (escapeHtml, escapeAttr)
│   │       ├── apiConfig.js         # 2nd - API config
│   │       ├── apiFetch.js          # 3rd - API wrapper
│   │       ├── auth-check.js        # 4th - Auth & sidebar
│   │       ├── evaluations.js       # Evaluasi + comments + close
│   │       ├── hafalan.js           # Program Al-Quran
│   │       └── *.js                 # Page-specific scripts
│   └── views/
│       └── *.html                   # Page templates
└── docs/                            # Documentation
```

---

## 📋 DAFTAR TUGAS

### ✅ Selesai (v2.4.2)
| Task | Status |
|------|--------|
| Evaluasi: Comment Visibility | ✅ |
| Evaluasi: Foto Pembinaan | ✅ |
| Evaluasi: Close Case (Pimpinan) | ✅ |
| Fix: Stats Card = 0 | ✅ |
| Fix: Filter Evaluasi Per Role | ✅ |
| Program Al-Quran: HafalanRecord Model | ✅ |
| Program Al-Quran: CRUD Frontend | ✅ |
| Program Al-Quran: Import Excel | ✅ |

### ✅ Selesai (v2.4.1)
| Task | Status |
|------|--------|
| Dashboard Guru Todo List | ✅ |
| Jurnal Guru (wizard 4 step) | ✅ |
| 8 Jenis Penilaian | ✅ |
| Evaluasi Santri Approval | ✅ |
| Data Santri field baru | ✅ |
| Role admin baru | ✅ |

### 🔄 Belum Selesai

**MEDIUM PRIORITY:**
| # | Task | Deskripsi |
|---|------|-----------|
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

*Portal Siswa Baron v2.4.2 — Pondok Pesantren Baron — 4 Mei 2026*
