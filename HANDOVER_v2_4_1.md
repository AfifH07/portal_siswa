# HANDOVER DOCUMENT — Portal Siswa Baron v2.4.1

> **Versi:** 2.4.1 | **Tanggal:** Mei 2026
> **Institusi:** Pondok Pesantren Baron
> **Deployment:** https://apiiip.pythonanywhere.com

---

## 📋 RINGKASAN PROYEK

**Portal Siswa Baron** adalah Sistem Informasi Akademik Terpadu untuk manajemen santri, akademik, evaluasi karakter, dan komunikasi walisantri di Pondok Pesantren Baron.

### Tech Stack
| Layer | Teknologi |
|-------|-----------|
| Backend | Django 4.2 + DRF 3.14 + SimpleJWT 5.3 |
| Database | SQLite (staging), PostgreSQL 15 (production) |
| Frontend | Vanilla JS ES6+ + Baron Emerald Theme |
| Charts | Chart.js 4.4 |
| Icons | Lucide Icons + FontAwesome 6.5 |

---

## 🔑 AKUN TESTING

| Username | Role | Keterangan |
|----------|------|------------|
| `admin` | superadmin | Full access + kelola user |
| `administrasi` | admin | Co-superadmin, tanpa kelola user |
| `pimpinan` | pimpinan | View all + approval |
| `guru1` | guru | Jurnal, nilai, evaluasi |
| `musyrif1` | musyrif | Ibadah, hafalan |
| `bk` | bk | Bimbingan konseling |
| `bendahara` | bendahara | Keuangan |
| `wali_multi` | walisantri | Multi-child test |

> Password default: `password123` atau `wali123` untuk walisantri

---

## 👥 SISTEM ROLE (8 Role)

| Role | Akses | Sidebar Menu |
|------|-------|--------------|
| `superadmin` | Full access + kelola user | Dashboard, Siswa, Jurnal, Nilai, Evaluasi, Keuangan, Manajemen User, Jadwal Mengajar, Master Mapel |
| `admin` | Co-superadmin, tanpa kelola user | Dashboard, Siswa, Jurnal, Nilai, Evaluasi, Keuangan, Jadwal Mengajar, Master Mapel |
| `pimpinan` | View all + approval + evaluasi asatidz | Dashboard, Siswa, Jurnal, Nilai, Evaluasi, Keuangan, Evaluasi Asatidz |
| `guru` | Jurnal, nilai, evaluasi (personal) | Dashboard, Siswa, Jurnal, Nilai, Hafalan, Evaluasi |
| `musyrif` | Ibadah, hafalan, pembinaan | Dashboard, Siswa, Jurnal, Hafalan, Evaluasi |
| `bk` | Bimbingan konseling | Dashboard, Siswa, Pembinaan, Evaluasi |
| `bendahara` | Keuangan | Dashboard, Keuangan |
| `walisantri` | Lihat data anak (multi-child) | Dashboard, Kehadiran, Ibadah, Akademik, Hafalan, Karakter, Tagihan |

---

## 🆕 FITUR BARU v2.4.1

### 1. Dashboard Guru — Todo List
**File:** `apps/dashboard/views.py`, `frontend/views/dashboard.html`
**Endpoint:** `GET /api/dashboard/guru/todo-list/`

Widget yang menampilkan:
- Presensi/jurnal yang belum diisi hari ini
- Nilai yang belum diinput untuk kelas yang diampu
- Izin tanpa titipan tugas

### 2. Jurnal Guru (Rename dari Presensi)
**File:** `apps/attendance/`, `frontend/views/attendance.html`, `frontend/public/js/attendance.js`

**Perubahan Terminologi:**
| Lama | Baru |
|------|------|
| Presensi | Jurnal Guru |
| Guru Asli | Guru Pengampu |
| Guru Pengganti | Guru Piket |
| Capaian Pembelajaran | Tujuan Pembelajaran |

**Wizard 4 Step:**
1. **Step 1:** Pilih Tipe Pengajar (Guru Pengampu / Guru Piket)
2. **Step 2:** Info Kelas (filter berdasarkan tipe)
3. **Step 3:** Kehadiran Siswa
4. **Step 4:** Dokumentasi (foto, tujuan pembelajaran, ketuntasan)

**Field Baru di Model Attendance:**
- `ada_penilaian` (BooleanField)
- `ketuntasan_materi` (IntegerField 0-100)
- `tujuan_pembelajaran` (TextField)
- `input_by` (FK User) — untuk filter jurnal personal

### 3. Sistem Nilai — 8 Jenis Penilaian
**File:** `apps/grades/`, `frontend/views/grades.html`, `frontend/public/js/grades.js`

**Jenis Penilaian:**
| Kode | Label | Icon |
|------|-------|------|
| `penugasan` | Penugasan | clipboard-list |
| `tes_tulis` | Tes Tulis | file-text |
| `tes_lisan` | Tes Lisan | mic |
| `portofolio` | Portofolio | folder-open |
| `praktek` | Praktek | tool |
| `proyek` | Proyek | layers |
| `uts` | UTS | calendar |
| `uas` | UAS | award |

**Field Baru:**
- `materi` (CharField, opsional)
- `input_by` (FK User) — untuk filter nilai personal

### 4. Evaluasi Santri — Approval System
**File:** `apps/evaluations/`, `frontend/views/evaluations.html`

**Alur Approval:**
1. Guru input evaluasi → status `is_approved=False`
2. Admin/Pimpinan approve → `is_approved=True`, `approved_by`, `approved_at` terisi
3. Setelah approved → visible ke wali kelas, BK, musyrif, pimpinan, walisantri

**Field Baru:**
- `foto` (ImageField, opsional)
- `is_approved` (BooleanField)
- `approved_by` (FK User)
- `approved_at` (DateTimeField)
- `created_by` (FK User)

**Endpoint:** `PATCH /api/evaluations/<id>/approve/`

### 5. Data Santri — Field Baru
**File:** `apps/students/models.py`, `frontend/views/students.html`

**Field Baru:**
- `nis` (CharField, 7 digit, unik) — Nomor Induk Siswa lokal
- `jenis_kelamin` (CharField, L/P)
- `catatan` (TextField)

**Kolom Tabel:**
NISN | NIS | Nama | Kelas | Program | Jenis Kelamin | Catatan | Aksi

**Template Import Excel:** Sudah diupdate dengan kolom baru

### 6. Role Admin Baru
**File:** `apps/accounts/models.py`, `frontend/public/js/auth-check.js`

Role `admin` ditambahkan dengan akses:
- Sama seperti superadmin untuk manajemen data
- **TIDAK BISA** kelola user (tambah/edit/hapus user)
- Bisa akses: Jadwal Mengajar, Master Mapel, Import/Export data

---

## 📡 ENDPOINT BARU

| Method | Endpoint | Deskripsi | Access |
|--------|----------|-----------|--------|
| GET | `/api/dashboard/guru/todo-list/` | Todo list kewajiban guru | guru |
| GET | `/api/attendance/jurnal/history/` | History jurnal personal | guru |
| GET | `/api/attendance/guru/assignment-info/` | Info kelas & mapel per guru | guru |
| GET | `/api/core/master-mapel/by-sesi/?sesi=` | Mapel per sesi | all |
| GET | `/api/grades/mapel-list/` | List mapel per guru | guru |
| PATCH | `/api/evaluations/<id>/approve/` | Approve evaluasi | admin, pimpinan |

---

## ⚠️ KNOWN BUGS

### 1. Donut Chart Nilai
- **Problem:** Chart "Status Ketuntasan" masih hitung semua guru
- **Location:** `apps/grades/views.py`
- **Root Cause:** Queryset tidak filter per `input_by`

### 2. Filter Evaluasi
- **Problem:** Guru non-wali kelas masih lihat semua kasus
- **Location:** `apps/evaluations/views.py` `get_queryset()`
- **Status:** Perlu deploy ulang

---

## 📋 TASK PENDING

### MEDIUM PRIORITY
| Task | Deskripsi |
|------|-----------|
| Program Al-Quran | Rename "Hafalan & Ziyadah" → "Program Al-Quran", import Excel |
| Dashboard Pimpinan | Efektivitas KBM, presensi guru, breakdown santri |
| Approval Izin Guru | Alur: submit → approve/tolak → notif |

### LOW PRIORITY
| Task | Deskripsi |
|------|-----------|
| Kritik & Saran | Inbox Pimpinan, anonim/identitas |
| Pertemuan Pengasuhan | Jadwal + presensi pertemuan walisantri |

---

## 🔧 CRITICAL PATTERNS

### Custom User Model
```python
# CORRECT
user.name or user.username

# WRONG - AttributeError!
user.get_full_name()
```

### Student Identifier
- Gunakan **NISN** (string), BUKAN auto-increment ID
- FK pattern: `nisn__nisn` untuk string comparison

### apiFetch Usage
```javascript
// MUST parse JSON
const response = await window.apiFetch('endpoint/');
const data = await response.json();

// Path tanpa /api/ prefix
window.apiFetch('evaluations/')  // CORRECT
```

### Personal Filter (input_by)
```python
# Filter data per guru yang login
queryset = queryset.filter(input_by=request.user)
```

---

## 🚀 DEPLOY COMMANDS

```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
```

---

## 📁 FILE PENTING

```
portal-siswa/
├── CLAUDE.md                    # Dokumentasi untuk Claude Code
├── HANDOVER_v2_4_1.md          # File ini
├── README.md                    # README proyek
├── backend_django/
│   ├── apps/
│   │   ├── accounts/           # User, Role, Assignment
│   │   ├── attendance/         # Jurnal Guru
│   │   ├── core/               # Master Data
│   │   ├── evaluations/        # Evaluasi + Approval
│   │   ├── grades/             # Nilai
│   │   └── ...
│   └── backend_django/
│       └── urls.py
└── frontend/
    ├── public/js/
    │   └── auth-check.js       # Role config
    └── views/
```

---

## 📞 KONTAK

Tim Pengembangan Portal Siswa Baron
Pondok Pesantren Baron

---

*Handover Document v2.4.1 — Mei 2026*
