# CLAUDE.md — Portal Siswa Baron
> File ini dibaca otomatis oleh Claude Code setiap sesi. Jangan hapus.

---

## 🎯 IDENTITAS PROYEK

**Nama:** Portal Siswa Baron  
**Versi:** 2.3.8 (Production Ready)  
**Institusi:** Pondok Pesantren Baron  
**Deskripsi:** Sistem Informasi Akademik Terpadu (web-based) untuk manajemen santri, akademik, evaluasi karakter, dan komunikasi walisantri.

---

## 🏗️ ARSITEKTUR SISTEM

### Stack Teknologi
| Layer | Teknologi |
|-------|-----------|
| Backend | Django 4.2 + Django REST Framework 3.14 |
| Auth | SimpleJWT 5.3 (JWT + refresh token + blacklist) |
| DB Dev/Staging | SQLite (otomatis, tanpa konfigurasi) |
| DB Production | PostgreSQL 15 (via `DATABASE_URL`) |
| DB Routing | `dj-database-url` 2.1 |
| Excel/CSV | pandas 2.1 + openpyxl |
| Frontend | Native HTML5/CSS3/Vanilla JS (ES6+) |
| Icons | Lucide Icons (SVG) |
| Charts | Chart.js 4.4 |
| Design | Baron Emerald Theme (Glassmorphism custom CSS) |
| Font | Plus Jakarta Sans (Google Fonts) |

### Struktur Direktori Penting
```
portal-siswa/
├── backend_django/
│   ├── apps/
│   │   ├── accounts/       # Auth, Users, JWT, Permissions
│   │   ├── core/           # Master Data (TahunAjaran)
│   │   ├── students/       # CRUD Siswa & Alumni
│   │   ├── attendance/     # Presensi Harian
│   │   ├── grades/         # Nilai Akademik & Analytics
│   │   ├── evaluations/    # Evaluasi Poin Santri
│   │   ├── kesantrian/     # Ibadah, Hafalan, BLP, Incident
│   │   ├── finance/        # Modul Keuangan
│   │   ├── registration/   # Pendaftaran Santri Baru
│   │   └── dashboard/      # Statistik & Visualisasi
│   ├── backend_django/     # Django settings package
│   └── requirements.txt
├── frontend/
│   ├── views/              # HTML templates (19 files)
│   └── public/
│       ├── css/            # Stylesheets (15 files)
│       └── js/             # JS modules (18 files)
```

### Pola Database Dual-Environment
```python
# settings.py — jangan ubah pola ini
DATABASE_URL = config('DATABASE_URL', default='')
if DATABASE_URL:
    DATABASES = {'default': dj_database_url.config(default=DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
```
> **Aturan:** Jangan hardcode database engine. Selalu gunakan pola ini.

---

## 👥 SISTEM ROLE (RBAC — 8 Level)

| Role | Akses Utama |
|------|-------------|
| `superadmin` | Full system access, kelola user & konfigurasi |
| `pimpinan` | Lihat semua data, evaluasi asatidz, dashboard manajemen |
| `guru` | Input nilai & kehadiran, evaluasi santri |
| `musyrif` | Pemantauan ibadah, hafalan, pembinaan santri |
| `wali_kelas` | Manajemen kelas, laporan progress santri |
| `bk` | Bimbingan konseling, penanganan kasus |
| `bendahara` | Modul keuangan, pembayaran |
| `walisantri` | Lihat data anak (multi-anak supported) |

> **Penting:** Setiap fitur baru HARUS mempertimbangkan permission per role. Gunakan `@permission_classes` atau `has_permission()` di DRF views.

---

## 🔌 API ENDPOINTS (60+ Total)

### Pola URL
```
/api/auth/          → Authentication (login, logout, refresh, reset)
/api/users/         → User management
/api/students/      → CRUD siswa + bulk import/export
/api/grades/        → Nilai akademik
/api/attendance/    → Presensi
/api/evaluations/   → Evaluasi poin santri
/api/kesantrian/    → Ibadah, hafalan, BLP, incident, asatidz
/api/finance/       → Keuangan
/api/core/          → Tahun ajaran (master data)
/api/dashboard/     → Statistik & aggregasi
```

### Endpoint Kritis (Sering Dipakai)
```
POST /api/auth/login/                          → Return JWT
POST /api/auth/token/refresh/                  → Refresh access token
GET  /api/users/me/                            → Data user yang login
GET  /api/students/?kelas=X&tahun_ajaran=1     → List siswa dengan filter
POST /api/students/import/                     → Bulk import Excel
GET  /api/kesantrian/worship-tracker/<nisn>/   → Data ibadah harian
GET  /api/kesantrian/hafalan/<nisn>/           → Progress hafalan
GET  /api/kesantrian/blp/<nisn>/               → Skor BLP
GET  /api/core/tahun-ajaran/active/            → Tahun ajaran aktif
```

---

## 🔐 AUTENTIKASI & KEAMANAN

### JWT Flow
- **Access Token:** 60 menit (configurable via `JWT_ACCESS_TOKEN_LIFETIME`)
- **Refresh Token:** 24 jam (configurable via `JWT_REFRESH_TOKEN_LIFETIME`)
- **Blacklisting:** Aktif — logout menginvalidasi token
- **Header:** `Authorization: Bearer <access_token>`

### Password Reset (3-Step OTP)
```
Step 1: POST /api/auth/request-reset/ → {username}
Step 2: POST /api/auth/verify-token/  → {username, token}
Step 3: POST /api/auth/reset-password/ → {username, token, new_password}
```
OTP: 6 digit, expire 30 menit, dikirim via SMTP Gmail.

### Security Headers (Production)
- CSRF, XSS, HSTS, HTTPS redirect — sudah dikonfigurasi via `.env.production`
- **Jangan matikan** security middleware saat debug production issues

---

## 📦 MODUL KESANTRIAN (Paling Kompleks)

### BLP (Buku Laporan Pembinaan)
- **25 indikator**, **6 domain** karakter
- Skor mingguan per santri
- Predikat otomatis: `Mumtaz` / `Jayyid Jiddan` / `Jayyid` / `Maqbul` / `Perlu Pembinaan`

### Hafalan
- Tracking progress per santri (model: `HafalanProgress`, 25 fields)
- Update via: `POST /api/kesantrian/hafalan/<nisn>/update/`

### Ibadah Harian
- Record harian per santri (model: `WorshipRecord`, 10 fields)
- 10.000+ records — query HARUS pakai filter `tahun_ajaran` + `tanggal` untuk performa

### Incident Management
- Pelaporan kasus dengan sistem komentar
- Status tracking (open → in progress → resolved)

---

## 🗄️ MODEL DATABASE UTAMA

| Model | App | Identifier Utama |
|-------|-----|-----------------|
| `User` | accounts | `id`, `username`, `role`, `name` (nama lengkap) |
| `Student` | students | **`nisn`** (bukan id!) |
| `Grade` | grades | `student` (FK ke nisn) + `mata_pelajaran` + `semester` |
| `Attendance` | attendance | `student` + `tanggal` |
| `TahunAjaran` | core | `id`, `is_active` |
| `HafalanProgress` | kesantrian | `student` (FK ke nisn) |
| `WorshipRecord` | kesantrian | `student` + `tanggal` |
| `BLPEntry` | kesantrian | `student` + `minggu` |
| `Incident` | kesantrian | `id`, `student`, `status` |
| `PenilaianKinerja` | kesantrian | `ustadz` (FK ke User) |

> **⚠️ WAJIB DIBACA — Custom User Model:**
> - Nama lengkap user ada di field **`user.name`** (bukan `first_name`, `last_name`, atau `full_name`)
> - **TIDAK ADA** method `get_full_name()` — ini Custom User Model, bukan Django default User
> - Selalu gunakan: `user.name or user.username`
> - **JANGAN PERNAH** gunakan: `user.get_full_name()` → akan throw `AttributeError`

---

## 🎨 KONVENSI FRONTEND

### Design System
- **Tema:** Glassmorphism — `backdrop-filter: blur()`, semi-transparent cards
- **Warna Utama:** Emerald/hijau tua (sesuai Baron Emerald Theme)
- **Font:** Plus Jakarta Sans (wajib, sudah di-import dari Google Fonts)
- **Icons:** Lucide Icons — **JANGAN** pakai Font Awesome atau emoji untuk UI

### Pola JavaScript (Vanilla ES6+)
```javascript
// Pola standar pemanggilan API di frontend
const response = await fetch('/api/endpoint/', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
    }
});

// Auto-refresh token jika 401
if (response.status === 401) {
    await refreshToken(); // fungsi sudah ada di auth.js
    // retry request
}
```

### Struktur File Frontend Baru
```
frontend/views/nama-fitur.html      → Template HTML
frontend/public/css/nama-fitur.css  → Stylesheet
frontend/public/js/nama-fitur.js    → Logic JS
```

---

## ⚙️ KONVENSI BACKEND

### Struktur View (DRF)
```python
# Gunakan class-based views dengan ViewSet atau APIView
# Selalu tambahkan permission_classes yang sesuai role
class NamaView(APIView):
    permission_classes = [IsAuthenticated, IsGuru]  # sesuaikan role
    
    def get(self, request):
        tahun_ajaran = get_object_or_404(TahunAjaran, is_active=True)
        # ... logic
        return Response(serializer.data)
```

### Serializer
```python
# Selalu gunakan serializer — jangan return raw queryset
# Untuk nested data, gunakan SerializerMethodField
class StudentSerializer(serializers.ModelSerializer):
    kelas_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = ['nisn', 'nama', 'kelas', 'kelas_display']
```

### URL Pattern Baru
```python
# apps/nama_app/urls.py
urlpatterns = [
    path('', NamaListView.as_view(), name='nama-list'),
    path('<str:nisn>/', NamaDetailView.as_view(), name='nama-detail'),
]
# Daftarkan di backend_django/urls.py:
# path('api/nama-app/', include('apps.nama_app.urls')),
```

### Migration
```bash
# Setelah ubah model, SELALU jalankan:
python manage.py makemigrations nama_app
python manage.py migrate
```

---

## 🐛 PANDUAN DEBUG

### Cek Log Error
```bash
# Development
python manage.py runserver  # error langsung muncul di terminal

# Production (Gunicorn)
journalctl -u gunicorn -f
# atau cek log Nginx: /var/log/nginx/error.log
```

### Error Umum & Solusinya

| Error | Kemungkinan Penyebab | Solusi |
|-------|----------------------|--------|
| `401 Unauthorized` | Token expired | Cek refresh token logic di frontend |
| `403 Forbidden` | Role tidak punya permission | Cek `permission_classes` di view |
| `400 Bad Request` | Serializer validation gagal | Print `serializer.errors` |
| `AttributeError: get_full_name` | Pakai Django default User method di Custom User | Ganti `user.get_full_name()` → `user.name or user.username` |
| Static files 404 | `collectstatic` belum dijalankan | `python manage.py collectstatic` |
| DB migration error | Conflict migration | Cek `showmigrations`, squash jika perlu |

### Reset Database (DEV ONLY!)
```bash
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

---

## 🚀 DEPLOYMENT REFERENCE

### Development (Local)
```bash
cd backend_django
python manage.py runserver
# Akses: http://localhost:8000
# Admin: http://localhost:8000/admin/
# Swagger: http://localhost:8000/api/schema/swagger/
```

### Staging (PythonAnywhere)
```bash
cp .env.staging.example .env
# Set: SECRET_KEY, ALLOWED_HOSTS=username.pythonanywhere.com
# JANGAN set DATABASE_URL → otomatis pakai SQLite
python manage.py migrate && python manage.py collectstatic --noinput
```

### Production (VPS)
```bash
cp .env.production.example .env
# Set: DATABASE_URL, SECRET_KEY, ALLOWED_HOSTS, EMAIL_*
gunicorn backend_django.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

---

## 📋 CHECKLIST FITUR BARU

Setiap kali membuat fitur baru, pastikan:

- [ ] Model dibuat dengan migration
- [ ] Serializer dibuat di `serializers.py`
- [ ] View dibuat dengan `permission_classes` yang benar sesuai role
- [ ] URL didaftarkan di `urls.py` app + `backend_django/urls.py`
- [ ] Frontend: HTML + CSS + JS mengikuti Baron Emerald Theme
- [ ] Icon menggunakan Lucide Icons
- [ ] API call di JS menggunakan pola `Authorization: Bearer` + auto-refresh
- [ ] Filter by `tahun_ajaran` untuk data yang time-bound
- [ ] Tested di development sebelum deploy

---

## ⚡ RTK (Token Optimizer)

RTK sudah terpasang. **Selalu gunakan prefix `rtk`** untuk semua command di bawah ini — termasuk dalam command chain dengan `&&`.

### Command RTK yang Relevan untuk Proyek Ini

```bash
# Git operations
rtk git status
rtk git log
rtk git diff
rtk git add .
rtk git commit -m "pesan"
rtk git push
rtk git pull

# Pencarian kode
rtk grep "keyword" apps/
rtk find . -name "*.py"
rtk read apps/kesantrian/models.py

# Test & Debug API
rtk curl http://localhost:8000/api/students/
rtk err python manage.py runserver    # filter error Django saja

# Log & analisis
rtk log /var/log/nginx/error.log
rtk summary python manage.py migrate  # ringkasan output migrasi
```

### Command Chain yang Benar
```bash
# ✅ Benar
rtk git add . && rtk git commit -m "feat: tambah modul X" && rtk git push

# ❌ Salah
git add . && git commit -m "feat: tambah modul X" && git push
```

### RTK Meta Commands
```bash
rtk gain            # lihat statistik penghematan token
rtk gain --history  # histori command + penghematan
```

> **Catatan:** `rtk` hanya berlaku untuk command terminal. Tidak berpengaruh pada perintah Python/Django yang tidak menghasilkan output verbose.

---

## 💬 CARA BERKOMUNIKASI DENGAN CLAUDE CODE

Saya adalah developer dari proyek ini. Saat meminta bantuan:

- **Bahasa:** Indonesia
- **Gaya:** Langsung ke solusi — tidak perlu penjelasan panjang kalau tidak diminta
- **Saat bikin fitur baru:** Buat langsung semua file yang diperlukan (model, serializer, view, url, frontend)
- **Saat debug:** Tunjukkan langsung root cause + fix, bukan daftar kemungkinan
- **Saat refactor:** Pertahankan pola kode yang sudah ada, jangan ganti stack

---

*Portal Siswa Baron v2.3.8 — Pondok Pesantren Baron — Production Ready*