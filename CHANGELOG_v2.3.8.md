# Portal Siswa Baron v2.3.8 - Changelog

**Tanggal:** 19 April 2026
**Release Type:** Production Ready + UI/UX Cleanup

---

## Ringkasan

Release ini fokus pada:
1. Setup dual-environment database (SQLite/PostgreSQL)
2. Security fix untuk role-based routing
3. Cleanup template zombie dan simplifikasi arsitektur
4. Production-ready untuk PythonAnywhere (free tier)

---

## Perubahan Database

### Dual-Environment Support
| Environment | Database | Aktivasi |
|-------------|----------|----------|
| Development | SQLite | Default (tanpa DATABASE_URL) |
| PythonAnywhere Free | SQLite | Kosongkan DATABASE_URL |
| Production VPS | PostgreSQL | Set DATABASE_URL |

### File Konfigurasi
- `.env.staging.example` - Template untuk PythonAnywhere
- `.env.production.example` - Template untuk VPS + PostgreSQL

### Logic di settings.py
```python
DATABASE_URL = config('DATABASE_URL', default='')
if DATABASE_URL:
    DATABASES = {'default': dj_database_url.config(...)}
else:
    DATABASES = {'default': {'ENGINE': 'sqlite3', ...}}
```

---

## Security Fixes

### URL Role Parameter Vulnerability (FIXED)
**Sebelum:** URL `?role=superadmin` bisa mengubah template yang di-render
**Sesudah:** Role divalidasi dari JWT token via API, bukan URL parameter

### Perubahan Routing
| URL | Sebelum | Sesudah |
|-----|---------|---------|
| `/` | Render `index.html` (halaman lama) | Redirect ke `/dashboard/` |
| `/dashboard/` | Router → redirect berdasarkan `?role=` | Langsung render `dashboard.html` |
| `/dashboard/?role=xxx` | Template berdasarkan URL | URL param diabaikan |

---

## UI/UX Cleanup

### File Dihapus
| File | Alasan |
|------|--------|
| `frontend/views/index.html` | Halaman lama dengan UI jadul |
| `frontend/views/dashboard-router.html` | Router tidak diperlukan lagi |
| `frontend/views/hafalan-router.html` | Router tidak diperlukan lagi |
| `frontend/views/dashboard_v2.html` | Template zombie tidak terpakai |
| `frontend/public/css/dashboard_v2.css` | CSS orphan |

### URL Routes Dihapus
```python
# Dihapus:
path('dashboard/admin/', ...)
path('dashboard/parent/', ...)
path('dashboard/ustadz/', ...)
path('hafalan/manager/', ...)
path('hafalan/view/', ...)
```

### Role Validation Scripts Dihapus
Dari file berikut:
- `dashboard.html` (baris 20-55)
- `hafalan.html` (baris 21-54)

---

## Backend Fixes

### Assignment Model Field Error (FIXED)
**Error:** `Cannot resolve keyword 'jam_mulai' into field`

**File:** `apps/dashboard/views.py`
```python
# Sebelum (ERROR):
.values('id', 'assignment_type', ..., 'jam_mulai', 'jam_selesai')

# Sesudah (FIXED):
.values('id', 'assignment_type', ..., 'tahun_ajaran', 'semester')
```

### Accounts Views Fix
**File:** `apps/accounts/views.py`
- Removed reference to non-existent fields: `jam_mulai`, `jam_selesai`, `periode_mulai`, `periode_selesai`, `metadata`

---

## Arsitektur Baru

### Flow Autentikasi
```
User akses URL
    ↓
auth-check.js validasi JWT dari localStorage
    ↓
Jika valid → Load data via API
Jika invalid → Redirect ke /login/
    ↓
Sidebar & konten adapt berdasarkan role dari API
```

### Single Dashboard Template
Semua role menggunakan `dashboard.html`:
- Section admin: visible untuk superadmin/pimpinan
- Section walisantri: visible untuk walisantri
- Sidebar: dynamic berdasarkan role (auth-check.js)

---

## Deployment Guide

### PythonAnywhere (Free Tier)
```bash
# 1. Clone repo
git clone https://github.com/your-repo/portal-siswa.git

# 2. Setup virtualenv
mkvirtualenv --python=/usr/bin/python3.10 portal
pip install -r backend_django/requirements.txt

# 3. Buat .env (TANPA DATABASE_URL)
cp backend_django/.env.staging.example backend_django/.env
# Edit: SECRET_KEY, ALLOWED_HOSTS

# 4. Migrasi (SQLite otomatis)
cd backend_django
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic

# 5. Setup WSGI di Web tab
```

### VPS dengan PostgreSQL
```bash
# 1. Setup PostgreSQL
sudo -u postgres createdb portal_siswa

# 2. Buat .env dengan DATABASE_URL
cp .env.production.example .env
# Edit: DATABASE_URL, SECRET_KEY, ALLOWED_HOSTS

# 3. Migrasi
python manage.py migrate
python manage.py collectstatic

# 4. Gunicorn + Nginx
gunicorn backend_django.wsgi:application --bind 0.0.0.0:8000
```

---

## Files Modified

### Backend
- `backend_django/backend_django/urls.py`
- `backend_django/backend_django/settings.py`
- `backend_django/apps/dashboard/views.py`
- `backend_django/apps/accounts/views.py`
- `backend_django/apps/kesantrian/views.py`

### Frontend
- `frontend/views/dashboard.html`
- `frontend/views/hafalan.html`
- `frontend/views/dashboard-parent.html`
- `frontend/views/dashboard-ustadz.html`
- `frontend/views/kesantrian/hafalan-dashboard.html`
- `frontend/public/js/auth-check.js`

### Deleted
- `frontend/views/index.html`
- `frontend/views/dashboard-router.html`
- `frontend/views/hafalan-router.html`
- `frontend/views/dashboard_v2.html`
- `frontend/public/css/dashboard_v2.css`

---

## Kompatibilitas

| Platform | Database | Status |
|----------|----------|--------|
| Local Development | SQLite | ✅ Tested |
| PythonAnywhere Free | SQLite | ✅ Compatible |
| PythonAnywhere Paid | PostgreSQL | ✅ Compatible |
| VPS (Ubuntu/Debian) | PostgreSQL | ✅ Compatible |
| Docker | PostgreSQL | ✅ Compatible |

---

## Known Issues

1. **pkg_resources deprecation warning** - Cosmetic, dari simplejwt library
2. **StudentResource field warning** - `tanggal_masuk` tidak di whitelist (cosmetic)

---

## Next Steps

- [ ] Test deployment ke PythonAnywhere
- [ ] Setup email untuk password reset
- [ ] Monitoring dengan Sentry (optional)

---

**Portal Siswa Baron v2.3.8** - Production Ready
