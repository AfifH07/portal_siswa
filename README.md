# Portal Siswa Baron v2.3.7

Sistem Informasi Sekolah untuk manajemen santri, evaluasi, dan pemantauan akademik di **Pondok Pesantren Baron**.

[![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-4.2-green.svg)](https://djangoproject.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Deskripsi

Portal Siswa Baron adalah platform terintegrasi yang menghubungkan manajemen pesantren dengan walisantri. Sistem ini menyediakan:

- **Dashboard Real-time** dengan visualisasi data dan statistik
- **Manajemen Akademik** (nilai, kehadiran, evaluasi)
- **Modul Kesantrian** (ibadah, hafalan, halaqoh, BLP)
- **Sistem Evaluasi Poin** untuk pembinaan santri
- **Multi-Role Access** dengan 8 level akses berbeda

---

## Fitur Utama

### Role-Based Access Control (RBAC)
| Role | Akses |
|------|-------|
| `superadmin` | Full system access - kelola user, konfigurasi sistem |
| `pimpinan` | Lihat semua data, evaluasi asatidz, dashboard manajemen |
| `guru` | Input nilai & kehadiran, evaluasi santri |
| `musyrif` | Pemantauan ibadah, hafalan, pembinaan santri |
| `wali_kelas` | Manajemen kelas, laporan progress santri |
| `bk` | Bimbingan konseling, penanganan kasus |
| `bendahara` | Modul keuangan, pembayaran |
| `walisantri` | Lihat data anak (multi-anak supported) |

### Bulk Import
- Import data siswa via Excel/CSV
- Import nilai batch per mata pelajaran
- Import kehadiran harian otomatis
- Validasi data sebelum insert

### Dashboard Real-time
- Statistik kehadiran dengan chart interaktif
- Progress hafalan per kelas
- Distribusi nilai akademik
- Ringkasan evaluasi santri

### Sistem Evaluasi Poin
- **BLP (Buku Laporan Pembinaan)**: 25 indikator, 6 domain
- **Incident Management**: Pelaporan dan tracking kasus
- **Evaluasi Asatidz**: Penilaian kinerja ustadz/karyawan
- Predikat otomatis (Mumtaz, Jayyid Jiddan, Jayyid, Maqbul, Perlu Pembinaan)

### Secure Password Reset
- 3-step wizard (request → verify → reset)
- Token 6-digit dengan expiry 30 menit
- Email notification (opsional)
- Rate limiting untuk keamanan

---

## Tech Stack

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Django | 4.2.x | Web framework |
| Django REST Framework | 3.14.x | REST API |
| SimpleJWT | 5.3.x | JWT authentication |
| dj-database-url | 2.1.x | Database URL parsing |
| Pillow | 10.3+ | Image processing |
| pandas | 2.1.x | Excel/CSV processing |

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| HTML5/CSS3 | Struktur & styling |
| Vanilla JavaScript | Logic & API calls |
| Lucide Icons | Icon library (SVG) |
| Chart.js | Visualisasi data |

### Database
| Environment | Database |
|-------------|----------|
| Development | SQLite |
| Staging (PythonAnywhere) | SQLite |
| Production (VPS) | PostgreSQL 15 |

---

## Struktur Direktori

```
portal-siswa/
├── backend_django/
│   ├── apps/
│   │   ├── accounts/       # Auth, Users, JWT, Permissions
│   │   ├── core/           # Master Data (TahunAjaran)
│   │   ├── students/       # CRUD Siswa, Alumni
│   │   ├── attendance/     # Sistem Presensi
│   │   ├── grades/         # Nilai & Analytics
│   │   ├── evaluations/    # Evaluasi Santri + Upload
│   │   ├── kesantrian/     # Ibadah, Hafalan, BLP, Incident
│   │   ├── finance/        # Modul Keuangan
│   │   ├── registration/   # Pendaftaran
│   │   └── dashboard/      # Statistik
│   ├── backend_django/     # Django settings
│   ├── requirements.txt
│   ├── .env.staging.example
│   └── .env.production.example
├── frontend/
│   ├── public/
│   │   ├── css/            # Stylesheets
│   │   └── js/             # JavaScript modules
│   └── views/              # HTML templates
└── README.md
```

---

## Panduan Instalasi Lokal

### Prasyarat
- Python 3.13+
- Git
- (Opsional) PostgreSQL 15 untuk production mode

### Langkah Instalasi

```bash
# 1. Clone repository
git clone https://github.com/your-org/portal-siswa.git
cd portal-siswa

# 2. Buat virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 3. Install dependencies
cd backend_django
pip install -r requirements.txt

# 4. Setup environment (development mode)
# Tidak perlu .env file - default SQLite & DEBUG=True

# 5. Jalankan migrasi database
python manage.py migrate

# 6. Buat superuser
python manage.py createsuperuser

# 7. Jalankan server development
python manage.py runserver

# 8. Akses aplikasi
# Frontend: http://localhost:8000
# Admin: http://localhost:8000/admin/
# API Docs: http://localhost:8000/api/schema/swagger/
```

---

## Konfigurasi Environment

### Development (Default)
Tidak memerlukan file `.env`. Sistem otomatis menggunakan:
- `DEBUG=True`
- SQLite database
- Secret key development

### Staging (PythonAnywhere)
```bash
cp .env.staging.example .env
# Edit sesuai username PythonAnywhere Anda
```

### Production (VPS + PostgreSQL)
```bash
cp .env.production.example .env
# Edit DATABASE_URL dan SECRET_KEY
```

#### Contoh DATABASE_URL
```
# PostgreSQL lokal
DATABASE_URL=postgres://user:password@localhost:5432/portal_siswa

# PostgreSQL cloud (Supabase/Neon/Railway)
DATABASE_URL=postgres://user:pass@db.provider.com:5432/dbname?sslmode=require
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login/` | Login dengan JWT |
| POST | `/api/auth/logout/` | Logout & blacklist token |
| POST | `/api/auth/token/refresh/` | Refresh JWT token |
| POST | `/api/auth/change-password/` | Ganti password |
| POST | `/api/auth/request-reset/` | Request token reset |
| POST | `/api/auth/verify-token/` | Verifikasi token 6-digit |
| POST | `/api/auth/reset-password/` | Reset password |

### Core
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/core/tahun-ajaran/active/` | Tahun ajaran aktif |
| GET/POST | `/api/core/tahun-ajaran/` | CRUD tahun ajaran |

### Students
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/students/` | List/Create siswa |
| GET/PUT/DELETE | `/api/students/<nisn>/` | Detail siswa |
| GET | `/api/students/classes/` | Daftar kelas |
| POST | `/api/students/import/` | Bulk import Excel |

### Kesantrian
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/kesantrian/worship-tracker/<nisn>/` | Data ibadah harian |
| GET | `/api/kesantrian/hafalan/<nisn>/` | Progress hafalan |
| GET/POST | `/api/kesantrian/incidents/` | Incident management |
| GET/POST | `/api/kesantrian/asatidz/evaluations/` | Evaluasi asatidz |

---

## Deployment

### PythonAnywhere (Staging)
1. Upload project ke PythonAnywhere
2. Setup virtualenv dan install requirements
3. Copy `.env.staging.example` ke `.env`
4. Konfigurasi WSGI dan static files
5. Reload web app

### VPS Production
1. Setup server dengan Nginx + Gunicorn
2. Install PostgreSQL dan buat database
3. Copy `.env.production.example` ke `.env`
4. Jalankan migrasi dan collectstatic
5. Konfigurasi SSL dengan Certbot

```bash
# Contoh Gunicorn
gunicorn backend_django.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

---

## Security Features

- JWT token dengan access/refresh rotation
- Rate limiting pada login dan password reset
- CSRF protection
- XSS protection headers
- SQL injection prevention (Django ORM)
- HTTPS enforcement (production)
- HSTS headers (production)

---

## Pengembangan

### Menambah Module Baru
```bash
cd backend_django
python manage.py startapp apps/nama_module
```

### Menjalankan Tests
```bash
python manage.py test
```

### Generate API Documentation
```bash
python manage.py spectacular --file schema.yml
```

---

## Troubleshooting

### Database Error
```bash
# Reset database (development only!)
rm db.sqlite3
python manage.py migrate
```

### Static Files Tidak Muncul
```bash
python manage.py collectstatic --noinput
```

### Token Expired
- Access token: 60 menit (configurable)
- Refresh token: 24 jam
- Frontend otomatis refresh token

---

## Kontribusi

1. Fork repository
2. Buat feature branch (`git checkout -b feature/fitur-baru`)
3. Commit perubahan (`git commit -m 'Tambah fitur baru'`)
4. Push ke branch (`git push origin feature/fitur-baru`)
5. Buat Pull Request

---

## Tim Pengembang

**Portal Siswa Baron** dikembangkan untuk **Pondok Pesantren Baron**.

---

## Lisensi

[MIT License](LICENSE)

---

**Status**: Production Ready | **Versi**: 2.3.7 | **Update**: April 2026
