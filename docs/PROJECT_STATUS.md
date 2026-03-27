# Project Status - Portal Ponpes Baron

**Last Updated:** 12 Februari 2026

## Overview

Portal Ponpes Baron adalah sistem manajemen portal siswa untuk Pondok Pesantren yang mencakup:
- Manajemen Data Siswa
- Sistem Absensi/Kehadiran
- Sistem Nilai/Grades
- Sistem Evaluasi
- Dashboard Statistik

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Django 4.2 + Django REST Framework 3.14 |
| Database | PostgreSQL 15 |
| Authentication | JWT (djangorestframework-simplejwt) |
| Frontend | Native HTML5 + CSS3 + JavaScript (ES6+) |
| UI Style | Glassmorphism Design |
| Deployment | Docker / Docker Compose |

## Current Status: PRODUCTION READY

### Modul yang Sudah Selesai

#### 1. Authentication & Authorization
- [x] Login dengan JWT Token
- [x] Role-based access control (superadmin, pimpinan, guru, walisantri)
- [x] CSRF Protection
- [x] Rate Limiting
- [x] Password Change
- [x] Logout

#### 2. Dashboard
- [x] Statistik kehadiran
- [x] Statistik nilai
- [x] Grafik distribusi
- [x] Role-based view (berbeda tampilan per role)

#### 3. Manajemen Siswa
- [x] CRUD Siswa
- [x] Filter by Kelas
- [x] Search by NISN/Nama
- [x] Pagination
- [x] Export data

#### 4. Sistem Absensi
- [x] Input absensi per tanggal
- [x] Batch input (per kelas)
- [x] Status: Hadir, Sakit, Izin, Alpha
- [x] Rekap kehadiran
- [x] Filter by kelas, tanggal, status

#### 5. Sistem Nilai
- [x] CRUD Nilai
- [x] Jenis nilai: UH, UTS, UAS, Tugas, Proyek
- [x] Input nilai masal (bulk entry)
- [x] Import dari Excel
- [x] Export ke CSV
- [x] Statistik & grafik nilai
- [x] Role-based view (Walisantri hanya lihat nilai anaknya)
- [x] Pagination

#### 6. Sistem Evaluasi
- [x] CRUD Evaluasi
- [x] Upload foto
- [x] Kategori evaluasi

## Recent Fixes (Februari 2026)

### Bug Fixes
1. **Grade Table Pagination** - Fixed pagination on GradeViewSet
2. **Walisantri FK Filter** - Fixed `nisn__nisn` lookup for walisantri grades
3. **CSRF Rate Limiting** - Exempted CSRF endpoint from throttling
4. **Walisantri View Loading** - Fixed JavaScript function hoisting issue
5. **Role-Based UI Guards** - Hide admin buttons for walisantri users

### Code Cleanup
- Removed unused Node.js backend (`backend/` and `legacy_node_backend/`)
- Removed `node_modules/`, `package.json`, `package-lock.json`
- Organized documentation files to `docs/` folder
- Clean project structure

## Project Structure

```
portal-siswa/
├── backend_django/        # Django REST Framework Backend
│   ├── apps/
│   │   ├── accounts/     # Auth, Users, Permissions
│   │   ├── students/     # Student Management
│   │   ├── attendance/   # Attendance System
│   │   ├── grades/       # Grades System
│   │   ├── evaluations/  # Evaluations
│   │   └── dashboard/    # Dashboard Stats
│   ├── backend_django/   # Django Settings
│   └── venv/             # Python Virtual Env
├── frontend/             # Frontend Static Files
│   ├── public/
│   │   ├── css/         # Stylesheets
│   │   └── js/          # JavaScript
│   └── views/           # HTML Pages
├── database/            # SQL Schema
├── docs/                # Documentation
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## API Endpoints Summary

### Authentication
- `POST /api/auth/login/` - Login
- `POST /api/auth/logout/` - Logout
- `GET /api/auth/csrf/` - Get CSRF Token
- `POST /api/auth/token/refresh/` - Refresh JWT

### Users
- `GET /api/users/` - List users
- `GET /api/users/me/` - Current user info
- `POST /api/users/` - Create user
- `PUT /api/users/<id>/` - Update user
- `DELETE /api/users/<id>/` - Delete user

### Students
- `GET /api/students/` - List students
- `POST /api/students/` - Create student
- `GET /api/students/<nisn>/` - Get student
- `PUT /api/students/<nisn>/` - Update student
- `DELETE /api/students/<nisn>/` - Delete student

### Attendance
- `GET /api/attendance/` - List attendance
- `POST /api/attendance/` - Create attendance
- `POST /api/attendance/batch/` - Batch create

### Grades
- `GET /api/grades/` - List grades
- `POST /api/grades/` - Create grade
- `GET /api/grades/statistics/` - Statistics
- `GET /api/grades/average/<nisn>/` - Student average
- `POST /api/grades/import/` - Import Excel

### Dashboard
- `GET /api/dashboard/stats/` - Dashboard statistics

## Known Issues

Saat ini tidak ada known issues yang signifikan.

## Performance Notes

- Pagination diaktifkan untuk semua list endpoints (10 items/page)
- Query optimization dengan `select_related()` untuk FK
- CSRF rate limiting di-exempt untuk endpoint CSRF token
- JWT token lifetime: 60 menit (access), 24 jam (refresh)

## Security Features

- JWT Authentication
- CSRF Protection
- Role-based permissions
- Rate limiting (throttling)
- Password hashing (Django default)
- CORS configuration

## Development Notes

### Running Locally
```bash
cd backend_django
source venv/Scripts/activate  # Windows
python manage.py runserver
```

### Running with Docker
```bash
docker-compose up -d
```

### Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

## Contact

Untuk pertanyaan atau issue, silakan buat issue di repository.
