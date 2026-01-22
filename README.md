# Portal Siswa - Django REST Framework

Sistem manajemen portal siswa yang telah dimigrasi dari Google Apps Script (Node.js/Express) ke Django + Django REST Framework.

## 🏗️ Arsitektur

### Backend: Django + DRF
- Framework: Django 4.2.7 + Django REST Framework 3.14.0
- Database: PostgreSQL 15
- Authentication: JWT (djangorestframework-simplejwt)
- File Upload: Django MEDIA_ROOT (local filesystem)

### Frontend: Native HTML/CSS/JS
- Tanpa framework (React/Vue)
- Serve langsung oleh Django
- Komunikasi API via fetch() dengan JWT token

## 📁 Struktur Direktori

```
portal-siswa/
├── backend_django/           # Django Backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── backend_django/      # Django settings package
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── apps/               # Django apps
│   │   ├── accounts/       # Auth & users
│   │   ├── students/       # Student management
│   │   ├── attendance/     # Attendance system
│   │   ├── grades/         # Grades system
│   │   ├── evaluations/    # Evaluations + upload
│   │   └── dashboard/      # Statistics
│   ├── media/              # File uploads
│   ├── static/             # Static files (optional)
│   └── database/          # Migrations & seed scripts
├── frontend/               # Frontend static files
│   ├── public/
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   └── views/
│       └── index.html
├── legacy_node_backend/     # Old Node.js backend (archived)
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prasyarat
- Python 3.9+
- PostgreSQL 15 atau Docker
- Git

### Cara 1: Menggunakan Docker Compose (Recommended)

```bash
# 1. Clone repository
cd portal-siswa

# 2. Setup environment
cp backend_django/.env.example backend_django/.env

# 3. Jalankan dengan Docker Compose
docker-compose up -d

# 4. Database migrations otomatis berjalan

# 5. Akses aplikasi
# - Frontend: http://localhost:8000
# - API: http://localhost:8000/api/
# - Django Admin: http://localhost:8000/admin/
```

### Cara 2: Manual Setup (Local PostgreSQL)

```bash
# 1. Setup PostgreSQL
sudo -u postgres psql
CREATE DATABASE portal_siswa;
CREATE USER portal_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE portal_siswa TO portal_user;
\q

# 2. Setup Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
cd backend_django
pip install -r requirements.txt

# 4. Setup environment
cp .env.example .env
# Edit .env sesuai konfigurasi database Anda

# 5. Run migrations
python manage.py makemigrations
python manage.py migrate

# 6. Create superuser
python manage.py createsuperuser

# 7. Run development server
python manage.py runserver
```

### Cara 3: Menggunakan PostgreSQL Container saja

```bash
# 1. Jalankan PostgreSQL di Docker
docker run --name portal_pg -e POSTGRES_PASSWORD=postgres_password \
  -e POSTGRES_DB=portal_siswa -p 5432:5432 -d postgres:15-alpine

# 2. Setup Python (langkah 2-7 dari Cara 2)
```

## 🔧 Konfigurasi Environment

### .env file (backend_django/.env)

```env
# Django Configuration
DEBUG=True
SECRET_KEY=django-insecure-change-this-in-production-secret-key-min-50-chars
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Database Configuration (PostgreSQL)
DB_HOST=postgres  # 'localhost' jika tidak pakai Docker
DB_PORT=5432
DB_NAME=portal_siswa
DB_USER=postgres
DB_PASS=postgres_password

# JWT Configuration
JWT_ACCESS_TOKEN_LIFETIME=60  # minutes
JWT_REFRESH_TOKEN_LIFETIME=1440  # minutes (24 hours)

# Media & Static
MEDIA_URL=/media/
MEDIA_ROOT=/app/backend_django/media
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login user, return JWT token |
| POST | `/api/auth/change-password` | Ganti password |
| POST | `/api/auth/request-reset` | Minta token reset password |
| POST | `/api/auth/reset-password` | Reset password dengan token |
| POST | `/api/auth/token/refresh` | Refresh JWT token |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Statistik dashboard |
| GET | `/api/dashboard/attendance-chart` | Data grafik kehadiran |
| GET | `/api/dashboard/grades-distribution` | Distribusi nilai |

### Users (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/` | Get all users (superadmin only) |
| POST | `/api/users/` | Create new user |
| PUT | `/api/users/<username>/` | Update user |
| DELETE | `/api/users/<username>/` | Delete user |

### Students

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students/` | Get all students |
| POST | `/api/students/` | Create student |
| PUT | `/api/students/<nisn>/` | Update student |
| DELETE | `/api/students/<nisn>/` | Delete student |
| GET | `/api/students/classes/` | Get distinct classes |

### Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/` | Get all attendance |
| POST | `/api/attendance/` | Create attendance record |
| POST | `/api/attendance/batch` | Batch attendance input |
| POST | `/api/attendance/initialize` | Initialize daily attendance |

### Grades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grades/` | Get all grades |
| POST | `/api/grades/` | Create grade |

### Evaluations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/evaluations/` | Get all evaluations |
| POST | `/api/evaluations/` | Create evaluation |
| GET | `/api/evaluations/<nisn>/<date>/` | Get evaluation by student & date |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/photo` | Upload photo (multipart/form-data) |

## 🔐 Authentication

### Login Request

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin_password"
  }'
```

### Response

```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "username": "admin",
  "name": "Super Admin",
  "role": "superadmin",
  "nisn": null,
  "email": null,
  "kelas": "-",
  "program": "-"
}
```

### Using Token

```bash
curl -X GET http://localhost:8000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 👥 Default Users

### Development

| Username | Password | Role | Email |
|----------|----------|------|-------|
| admin | admin123 | superadmin | admin@sekolah.id |

> ⚠️ **Important**: Ganti password default sebelum production!

## 🗄️ Database Models

| Model | Description |
|-------|-------------|
| users | Custom user model dengan role (superadmin/admin/user) |
| students | Data student (NISN, nama, kelas, program) |
| attendance | Record kehadiran (nisn, tanggal, waktu, status, keterangan) |
| grades | Nilai (nisn, mata_pelajaran, nilai, semester, tahun_ajaran, jenis_ujian) |
| evaluations | Evaluasi student dengan foto upload |
| schedules | Jadwal guru |
| reset_tokens | Token reset password |
| attendance_draft | Draft data kehadiran |

## 📤 File Upload

- Lokasi: `backend_django/media/`
- Foto evaluasi: `backend_django/media/evaluations/`
- Dapat diakses via: `http://localhost:8000/media/evaluations/filename.jpg`

## 🔄 Migrasi dari Google Sheets

### Import CSV ke PostgreSQL

```bash
cd backend_django/database/seed

# Import users
python manage.py import_csv_users users.csv

# Import students
python manage.py import_csv_students siswa.csv

# Import attendance
python manage.py import_csv_attendance absensi.csv

# Import grades
python manage.py import_csv_grades nilai.csv

# Import evaluations
python manage.py import_csv_evaluations evaluasi.csv
```

## 🧪 Testing

### Run Tests

```bash
cd backend_django
python manage.py test
```

### Create Test Data

```bash
python manage.py load_test_data
```

## 🐛 Troubleshooting

### Database Connection Error

```bash
# Cek PostgreSQL running
docker ps | grep postgres

# Atau jika manual
sudo systemctl status postgresql
```

### Migration Error

```bash
# Reset migrations
python manage.py migrate --fake-initial
python manage.py migrate --run-syncdb
```

### Static Files Not Loading

```bash
# Collect static files
python manage.py collectstatic --noinput
```

### Permission Denied on Uploads

```bash
# Fix permissions
chmod -R 755 backend_django/media/
```

## 📝 Frontend Integration

Frontend JavaScript sudah menggunakan `fetch()` ke API endpoints. Token disimpan di `localStorage`.

### Example API Call di Frontend

```javascript
const API_BASE = '/api';

// Login
async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const result = await response.json();
  if (result.success) {
    localStorage.setItem('token', result.token);
  }
  return result;
}

// Get Dashboard Stats
async function getDashboardStats() {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}

// Upload Photo
async function uploadPhoto(file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('photo', file);
  
  const response = await fetch(`${API_BASE}/upload/photo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  return await response.json();
}
```

## 🚢 Deployment

### Production Settings

1. Set `DEBUG=False` di .env
2. Generate strong `SECRET_KEY`
3. Set `ALLOWED_HOSTS` ke domain Anda
4. Configure production database
5. Setup static file serving (Nginx/WhiteNoise)
6. Setup SSL/HTTPS

### Gunicorn + Nginx

```bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn backend_django.wsgi:application --bind 0.0.0.0:8000

# Nginx configuration (example)
server {
    listen 80;
    server_name your-domain.com;

    location /static/ {
        alias /path/to/staticfiles/;
    }

    location /media/ {
        alias /path/to/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📚 Documentation Tambahan

- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [SimpleJWT](https://django-rest-framework-simplejwt.readthedocs.io/)

## 🤝 Kontribusi

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push ke branch
5. Create Pull Request

## 📄 License

MIT License

---

**Status**: Production Ready ✅
