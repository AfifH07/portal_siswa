# HANDOVER DOCUMENT — Portal Siswa Baron v2.4.2

> **Versi:** 2.4.2 | **Tanggal:** 4 Mei 2026
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
| `pimpinan` | pimpinan | View all + approval + close case |
| `guru1` | guru | Jurnal, nilai, evaluasi |
| `musyrif1` | musyrif | Ibadah, hafalan |
| `bk` | bk | Bimbingan konseling |
| `bendahara` | bendahara | Keuangan |
| `wali_multi` | walisantri | Multi-child test |

> Password default: `password123` atau `wali123` untuk walisantri

---

## 👥 SISTEM ROLE (8 Role)

| Role | Akses Evaluasi | Visibilitas Comment |
|------|----------------|---------------------|
| `superadmin` | Semua | Semua |
| `admin` | Semua | Semua |
| `pimpinan` | Approved + close case | Semua |
| `guru` | Own + wali kelas (approved) | Semua |
| `musyrif` | Approved | Semua |
| `bk` | Approved | Semua |
| `bendahara` | - | - |
| `walisantri` | Anak sendiri (approved) | **visibility='semua' only** |

---

## 🆕 FITUR BARU v2.4.2

### 1. Evaluasi — Close Case & Keputusan Final
**File:** `apps/evaluations/models.py`, `views.py`, `serializers.py`

**Field Baru di Model Evaluation:**
```python
keputusan_final = TextField(blank=True)
closed_by = ForeignKey(User, null=True, related_name='closed_evaluations')
closed_at = DateTimeField(null=True, blank=True)
```

**Endpoint:** `PATCH /api/evaluations/<id>/close/`

**Request Body:**
```json
{
    "keputusan_final": "Santri diberi pembinaan intensif selama 2 minggu..."
}
```

**Access:** Hanya pimpinan & superadmin

### 2. Evaluasi Comment — Visibility & Foto
**File:** `apps/evaluations/models.py`, `serializers.py`

**Field Baru di Model EvaluationComment:**
```python
visibility = CharField(max_length=20, choices=[
    ('internal', 'Internal (Guru & Admin)'),
    ('semua', 'Semua Pihak'),
], default='internal')

foto = ImageField(upload_to='evaluations/pembinaan/', null=True, blank=True)
```

**Behavior:**
- Default visibility: `internal` (hanya guru/admin yang bisa lihat)
- Jika `visibility='semua'`: walisantri juga bisa lihat
- Foto opsional untuk dokumentasi pembinaan

### 3. Fix Bug Stats Card = 0
**File:** `apps/evaluations/views.py`

**BEFORE:**
```python
# Bug: get_queryset() dan evaluation_statistics() punya logic terpisah
def get_queryset(self):
    # logic A

def evaluation_statistics(request):
    # logic B (berbeda!)
```

**AFTER:**
```python
# Fix: Helper function dipakai bersama
def get_filtered_queryset_for_user(user, base_queryset=None):
    """Reusable role-based filter"""
    if user.role in ['superadmin', 'admin']:
        pass  # semua
    elif user.role == 'pimpinan':
        queryset = queryset.filter(is_approved=True)
    elif user.role == 'bk':
        queryset = queryset.filter(is_approved=True)
    elif user.role == 'musyrif':
        queryset = queryset.filter(is_approved=True)
    elif user.role == 'guru':
        own_cases = Q(created_by=user)
        # + wali_cases jika dia wali kelas
    elif user.role == 'walisantri':
        queryset = queryset.filter(nisn__nisn__in=linked_nisns, is_approved=True)
    return queryset

# Dipakai di:
def get_queryset(self):
    return get_filtered_queryset_for_user(self.request.user)

def evaluation_statistics(request):
    queryset = get_filtered_queryset_for_user(request.user, Evaluation.objects.all())
```

### 4. Program Al-Quran (Hafalan)
**File:** `apps/kesantrian/models.py`, `views.py`, `frontend/views/hafalan.html`, `frontend/public/js/hafalan.js`

**Model HafalanRecord (baru):**
```python
class HafalanRecord(models.Model):
    siswa = ForeignKey(Student, on_delete=CASCADE)
    tanggal = DateField()
    juz = IntegerField(validators=[MinValue(1), MaxValue(30)])
    halaman_dari = IntegerField()
    halaman_sampai = IntegerField()
    jumlah_halaman = IntegerField()
    catatan = TextField(blank=True)
    input_by = ForeignKey(User, on_delete=SET_NULL, null=True)
    created_at = DateTimeField(auto_now_add=True)
```

**Assignment update:**
```python
hafalan_type = CharField(max_length=20, choices=[
    ('tahfidz', 'Tahfidz'),
    ('tahsin', 'Tahsin'),
    ('murojaah', 'Murojaah'),
], null=True, blank=True)
```

**Frontend:**
- Tab "Setoran Hafalan" dengan CRUD table
- Tab "Import Excel" untuk bulk import
- Modal form dengan dropdown Juz 1-30

---

## 📡 ENDPOINT BARU v2.4.2

| Method | Endpoint | Deskripsi | Access |
|--------|----------|-----------|--------|
| PATCH | `/api/evaluations/<id>/close/` | Close kasus + keputusan final | pimpinan, superadmin |
| GET | `/api/kesantrian/hafalan/` | List setoran hafalan | guru, musyrif, admin |
| POST | `/api/kesantrian/hafalan/` | Tambah setoran | guru, musyrif, admin |
| PATCH | `/api/kesantrian/hafalan/<id>/` | Update setoran | owner, admin |
| DELETE | `/api/kesantrian/hafalan/<id>/` | Hapus setoran | owner, admin |
| POST | `/api/kesantrian/hafalan/import/` | Import Excel | admin |
| GET | `/api/kesantrian/hafalan/template/` | Download template | admin |

---

## ⚠️ BUGS DIPERBAIKI v2.4.2

### 1. Stats Card Evaluasi = 0 ✅
- **Problem:** Guru non-wali selalu lihat stats = 0
- **Root Cause:** `evaluation_statistics()` pakai logic berbeda dari `get_queryset()`
- **Fix:** Buat helper `get_filtered_queryset_for_user()` yang dipakai bersama

### 2. Filter Evaluasi Per Role ✅
- **Problem:** Guru non-wali bisa lihat semua kasus
- **Root Cause:** Logic filter tidak konsisten
- **Fix:** Helper function dengan logic role yang benar

---

## ⚠️ KNOWN BUGS (Belum Diperbaiki)

### 1. Donut Chart Nilai
- **Problem:** Chart "Status Ketuntasan" masih hitung semua guru
- **Location:** `apps/grades/views.py`
- **Root Cause:** Queryset tidak filter per `input_by`

---

## 📋 TASK PENDING

### MEDIUM PRIORITY
| Task | Deskripsi |
|------|-----------|
| Dashboard Pimpinan | Efektivitas KBM, presensi guru, breakdown santri |
| Approval Izin Guru | Alur: submit → approve/tolak → notif |

### LOW PRIORITY
| Task | Deskripsi |
|------|-----------|
| Kritik & Saran | Inbox Pimpinan, anonim/identitas |
| Pertemuan Pengasuhan | Jadwal + presensi pertemuan walisantri |

---

## 🔧 MIGRATION v2.4.2

File migration baru:
- `apps/evaluations/migrations/0005_evaluation_closed_at_evaluation_closed_by_and_more.py`
- `apps/kesantrian/migrations/0009_hafalanrecord.py`
- `apps/accounts/migrations/0011_assignment_hafalan_type.py`

**Deploy command:**
```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
```

---

## 📁 FILE YANG DIUBAH v2.4.2

### Backend
```
apps/evaluations/models.py          # +field: keputusan_final, closed_by, closed_at, EvaluationComment.visibility, foto
apps/evaluations/views.py           # +helper function, +close_evaluation endpoint
apps/evaluations/serializers.py     # +field: visibility, foto, closed_by_name
apps/evaluations/urls.py            # +close endpoint
apps/kesantrian/models.py           # +HafalanRecord model
apps/kesantrian/views.py            # +CRUD hafalan
apps/kesantrian/serializers.py      # +HafalanRecordSerializer
apps/kesantrian/urls.py             # +hafalan endpoints
apps/accounts/models.py             # +Assignment.hafalan_type
```

### Frontend
```
frontend/views/evaluations.html     # +visibility dropdown, version update
frontend/public/js/evaluations.js   # +renderComments, +submitComment, +closeCase
frontend/views/hafalan.html         # +tab setoran, +tab import, +modal form
frontend/public/js/hafalan.js       # +CRUD functions, +import functions
frontend/public/css/hafalan-baron.css # +styles
frontend/public/js/auth-check.js    # rename "Hafalan & Ziyadah" → "Program Al-Quran"
```

---

## 📞 KONTAK

Tim Pengembangan Portal Siswa Baron
Pondok Pesantren Baron

---

*Handover Document v2.4.2 — 4 Mei 2026*
