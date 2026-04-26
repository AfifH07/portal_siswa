# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.
> Versi: 2.3.11 | Update: 26 April 2026

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron
**Versi:** 2.3.11 (Active Development)
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

## 👥 SISTEM ROLE (7 Role Aktif)

> ⚠️ Role `wali_kelas` sudah DIHAPUS — semua dimigrasi ke `guru`

| Role | Akses |
|------|-------|
| `superadmin` | Full access |
| `pimpinan` | Lihat semua + evaluasi asatidz |
| `guru` | Presensi, nilai, evaluasi, jadwal mengajar |
| `musyrif` | Ibadah, hafalan, pembinaan |
| `bk` | Bimbingan konseling |
| `bendahara` | Keuangan |
| `walisantri` | Lihat data anak (multi-anak) |

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier |
|-------|-----|-----------|
| `User` | accounts | `id`, `username`, `role`, `name` |
| `Student` | students | **`nisn`** (PK, bukan auto-id!) |
| `Assignment` | accounts | user + assignment_type + kelas + mata_pelajaran |
| `Schedule` | students | guru + hari + sesi + master_jam |
| `MasterJam` | core | sesi + jam_ke + jam_mulai/selesai |
| `MasterMapel` | core | nama + sesi + kode + is_active |
| `TahunAjaran` | core | nama + semester + is_active |
| `Attendance` | attendance | student + tanggal + jam_ke |
| `TitipanTugas` | attendance | guru + kelas + tanggal_berlaku |
| `IzinGuru` | kesantrian | guru + jenis_izin + foto_surat |
| `Ibadah` | kesantrian | siswa + tanggal + jenis + waktu |
| `TargetHafalan` | kesantrian | siswa + tahun_ajaran + semester |
| `Evaluation` | evaluations | nisn (FK) + jenis + kategori + evaluator |

> **⚠️ CRITICAL — Custom User Model:**
> - Nama lengkap: **`user.name`** (BUKAN first_name/full_name)
> - **TIDAK ADA** `get_full_name()` → throws AttributeError
> - Selalu: `user.name or user.username`

> **Relasi Walisantri → Anak:**
> - `User.linked_student_nisn` → CharField (NISN anak pertama)
> - `User.linked_student_nisns` → JSONField (array NISN)

> **Siswa diidentifikasi dengan NISN, bukan auto-increment ID**

---

## 🆕 v2.3.11 Updates (2026-04-26)

### 1. Master Data System
| Model | Endpoint | Deskripsi |
|-------|----------|-----------|
| `MasterJam` | `GET /api/core/master-jam/` | Jam pelajaran per sesi (Tahfidz/KBM/Diniyah) |
| `MasterMapel` | `GET/POST /api/core/master-mapel/` | Mata pelajaran per sesi |
| `MasterMapel` | `GET /api/core/master-mapel/grouped/` | Grouped by sesi untuk dropdown |
| `MasterMapel` | `PATCH/DELETE /api/core/master-mapel/<id>/` | Update/soft-delete mapel |

**Seed Data:**
- MasterJam: 9 records (1 Tahfidz, 6 KBM, 2 Diniyah)
- MasterMapel: 27 records (18 KBM, 8 Diniyah, 1 Tahfidz)

### 2. Jadwal Mengajar (Admin)
- **Page:** `/jadwal-mengajar/` → `jadwal-mengajar.html`
- **Features:** CRUD jadwal guru, filter hari/sesi, cascading dropdown (Sesi → Jam)
- **Endpoint:** `GET/POST /api/jadwal/`, `PATCH/DELETE /api/jadwal/<id>/`

### 3. Master Mapel Management (Admin)
- **Page:** `/master-mapel/` → `master-mapel.html`
- **Features:** Tab KBM/Diniyah/Tahfidz, toggle status aktif, CRUD mapel
- **Access:** Superadmin only

### 4. Jadwal Minggu Ini Widget (Dashboard Guru)
- Widget di dashboard guru: grid Senin-Sabtu
- Highlight hari ini, tampilkan jam + mapel + kelas
- **Endpoint:** `GET /api/jadwal/guru/<username>/`

### 5. Hapus Assignment (User Management)
- Badge assignment di tabel user dengan tombol × (hover)
- Konfirmasi sebelum hapus, max 3 badge + "+N lagi" expandable
- **Endpoint:** `DELETE /api/admin/users/<user_id>/assignments/<assignment_id>/`

### 6. Dropdown Mapel di Assign Modal
- Dropdown dinamis berdasarkan assignment type (KBM/Diniyah/Halaqoh)
- Data dari `/api/core/master-mapel/grouped/`
- Mapping: `halaqoh` → `tahfidz`

---

## 🆕 v2.3.10 Updates (2026-04-24) - Evaluasi Santri Dashboard Fix

| Bug | Fix |
|-----|-----|
| Case sensitivity jenis | `jenis='Prestasi'` → `jenis='prestasi'` |
| FK vs String comparison | `nisn__nisn=user.linked_student_nisn` |
| Guru filter mismatch | Fallback: `user.name or user.username` |
| Multi-child walisantri | Support `get_linked_students()` array |
| Category query | `kategori__iexact` untuk case-insensitive |

---

## 🆕 v2.3.9 Features

| Feature | Files | Endpoints |
|---------|-------|-----------|
| Guru Pengganti | attendance.html | Step 3 presensi |
| Jurnal Piket | jurnal-piket.html | `GET /api/attendance/jurnal-piket/` |
| Titipan Tugas | titipan-tugas.html | `GET/POST /api/attendance/titipan-tugas/` |
| Izin Guru | izin-guru.html | `GET/POST /api/kesantrian/izin-guru/` |

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

---

## 🎨 KONVENSI FRONTEND

### Script Dependencies (Baron Emerald Theme)
```html
<!-- CSS -->
<link href="/static/css/baron-emerald.css?v=20260327" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Scripts (URUTAN PENTING!) -->
<script src="/static/js/utils.js?v=20260314c"></script>
<script src="/static/js/apiConfig.js?v=20260314c"></script>
<script src="/static/js/apiFetch.js?v=20260314c"></script>
<script src="/static/js/auth-check.js?v=20260420" defer></script>
<script src="/static/js/nama-halaman.js?v=20260426"></script>
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
│   │   ├── attendance/          # Presensi, TitipanTugas
│   │   ├── core/                # TahunAjaran, MasterJam, MasterMapel
│   │   ├── dashboard/           # Dashboard views
│   │   ├── evaluations/         # Evaluasi santri
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

### ✅ Selesai (v2.3.11)
| Task | Status |
|------|--------|
| MasterJam model + seed data | ✅ |
| MasterMapel CRUD + management page | ✅ |
| Jadwal Mengajar admin page | ✅ |
| Jadwal Minggu Ini widget (guru dashboard) | ✅ |
| Dropdown mapel di Assign Modal | ✅ |
| Hapus assignment dengan konfirmasi | ✅ |
| Fix master-mapel.html UI (baron theme) | ✅ |
| Badge assignment compact + expandable | ✅ |

### 🔄 Belum Selesai
| # | Task | Priority |
|---|------|----------|
| 1 | Poin kinerja otomatis untuk guru pengganti | 🟡 Medium |
| 2 | Modal detail Titipan Tugas (read-only) | 🟡 Medium |
| 3 | Notifikasi real-time | 🟢 Low |

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

*Portal Siswa Baron v2.3.11 — Pondok Pesantren Baron — 26 April 2026*
