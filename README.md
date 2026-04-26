# Portal Siswa Baron v2.3.11

Sistem Informasi Akademik Terpadu untuk manajemen santri, evaluasi, dan pemantauan akademik di **Pondok Pesantren Baron**.

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![Django](https://img.shields.io/badge/Django-4.2-green.svg)](https://djangoproject.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Deskripsi

Portal Siswa Baron adalah platform terintegrasi yang menghubungkan manajemen pesantren dengan walisantri. Sistem ini menyediakan:

- **Dashboard Real-time** dengan visualisasi data dan statistik per role
- **Manajemen Akademik** (nilai, kehadiran, jadwal mengajar)
- **Modul Kesantrian** (ibadah, hafalan, halaqoh, BLP)
- **Sistem Evaluasi Poin** untuk pembinaan santri
- **Multi-Role Access** dengan 7 level akses berbeda
- **Manajemen Guru** (assignment, jadwal, titipan tugas, izin)

---

## Fitur Utama

### Role-Based Access Control (RBAC)
| Role | Akses |
|------|-------|
| `superadmin` | Full system access - kelola user, konfigurasi sistem, master data |
| `pimpinan` | Lihat semua data, evaluasi asatidz, dashboard manajemen |
| `guru` | Input nilai & kehadiran, evaluasi santri, jadwal mengajar |
| `musyrif` | Pemantauan ibadah, hafalan, pembinaan santri |
| `bk` | Bimbingan konseling, penanganan kasus |
| `bendahara` | Modul keuangan, pembayaran |
| `walisantri` | Lihat data anak (multi-anak supported) |

> **Note:** Role `wali_kelas` sudah dimigrasi ke `guru`

### Fitur v2.3.11 (Terbaru)
- **Master Jam & Mapel** - Data master jam pelajaran dan mata pelajaran
- **Jadwal Mengajar** - CRUD jadwal guru dengan cascading dropdown
- **Widget Jadwal Mingguan** - Tampilan jadwal minggu ini di dashboard guru
- **Hapus Assignment** - Tombol hapus assignment dengan konfirmasi
- **Dropdown Mapel Dinamis** - Di modal assign tugas berdasarkan sesi

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
- Jadwal mingguan guru (grid Senin-Sabtu)

### Sistem Evaluasi Poin
- **BLP (Buku Laporan Pembinaan)**: 25 indikator, 6 domain
- **Incident Management**: Pelaporan dan tracking kasus
- **Evaluasi Asatidz**: Penilaian kinerja ustadz/karyawan
- Predikat otomatis (Mumtaz, Jayyid Jiddan, Jayyid, Maqbul, Perlu Pembinaan)

### Manajemen HR Guru
- **Titipan Tugas**: Guru menitipkan tugas untuk kelas
- **Izin Guru**: Pengajuan izin dengan upload surat
- **Jurnal Piket**: Catatan piket harian
- **Assignment**: Penugasan guru ke kelas/mapel

---

## Tech Stack

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Django | 4.2.x | Web framework |
| Django REST Framework | 3.14.x | REST API |
| SimpleJWT | 5.3.x | JWT authentication |
| Pillow | 10.4+ | Image processing |
| pandas | 2.1.x | Excel/CSV processing |
| reportlab | 4.2.5 | PDF generation |

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| HTML5/CSS3 | Struktur & styling |
| Vanilla JavaScript ES6+ | Logic & API calls |
| Lucide Icons | Icon library (SVG) |
| FontAwesome 6.5 | Additional icons |
| Chart.js 4.4 | Visualisasi data |

### Design System
| Komponen | Detail |
|----------|--------|
| Theme | Baron Emerald (Glassmorphism) |
| Font | Plus Jakarta Sans + DM Mono |
| CSS | baron-emerald.css |

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
├── CLAUDE.md                    # Dokumentasi untuk Claude Code
├── README.md                    # File ini
├── backend_django/
│   ├── apps/
│   │   ├── accounts/            # Auth, Users, JWT, Permissions, Assignment
│   │   ├── core/                # TahunAjaran, MasterJam, MasterMapel
│   │   ├── students/            # CRUD Siswa, Schedule, Alumni
│   │   ├── attendance/          # Presensi, TitipanTugas, JurnalPiket
│   │   ├── grades/              # Nilai & Analytics
│   │   ├── evaluations/         # Evaluasi Santri + Upload
│   │   ├── kesantrian/          # Ibadah, Hafalan, BLP, Incident, IzinGuru
│   │   ├── finance/             # Modul Keuangan
│   │   ├── registration/        # Pendaftaran
│   │   └── dashboard/           # Statistik
│   ├── backend_django/          # Django settings
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   ├── baron-emerald.css    # Main theme
│   │   │   └── users.css            # User management
│   │   └── js/
│   │       ├── utils.js             # Utilities
│   │       ├── apiConfig.js         # API configuration
│   │       ├── apiFetch.js          # API wrapper
│   │       ├── auth-check.js        # Auth & sidebar
│   │       └── *.js                 # Page scripts
│   └── views/                       # HTML templates
└── docs/                            # Additional documentation
```

---

## Panduan Instalasi Lokal

### Prasyarat
- Python 3.10+
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

# 4. Jalankan migrasi database
python manage.py migrate

# 5. Seed master data (opsional)
python manage.py seed_master_jam
python manage.py seed_master_mapel

# 6. Buat superuser
python manage.py createsuperuser

# 7. Jalankan server development
python manage.py runserver

# 8. Akses aplikasi
# Frontend: http://localhost:8000
# Admin: http://localhost:8000/admin/
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login/` | Login dengan JWT |
| POST | `/api/auth/logout/` | Logout & blacklist token |
| POST | `/api/auth/token/refresh/` | Refresh JWT token |

### Core (Master Data)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/core/tahun-ajaran/active/` | Tahun ajaran aktif |
| GET | `/api/core/master-jam/` | Master jam pelajaran |
| GET | `/api/core/master-mapel/` | Master mata pelajaran |
| GET | `/api/core/master-mapel/grouped/` | Mapel grouped by sesi |

### Students & Schedule
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/students/` | List/Create siswa |
| GET | `/api/jadwal/guru/<username>/` | Jadwal guru mingguan |
| GET/POST | `/api/jadwal/` | CRUD jadwal |

### Admin (User Management)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/admin/users/` | List/Create users |
| PATCH | `/api/admin/users/<id>/assign/` | Assign guru ke kelas |
| DELETE | `/api/admin/users/<id>/assignments/<aid>/` | Hapus assignment |

### Kesantrian
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/kesantrian/worship-tracker/<nisn>/` | Data ibadah |
| GET/POST | `/api/kesantrian/izin-guru/` | Izin guru |
| GET/POST | `/api/attendance/titipan-tugas/` | Titipan tugas |

---

## Deployment

### PythonAnywhere (Staging)
```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab
```

### VPS Production
1. Setup server dengan Nginx + Gunicorn
2. Install PostgreSQL dan buat database
3. Konfigurasi environment variables
4. Jalankan migrasi dan collectstatic
5. Konfigurasi SSL dengan Certbot

---

## Security Features

- JWT token dengan access/refresh rotation
- Rate limiting pada login dan password reset
- CSRF protection
- XSS protection headers
- SQL injection prevention (Django ORM)
- HTTPS enforcement (production)
- Role-based permission system

---

## Troubleshooting

### Static Files Tidak Muncul
```bash
python manage.py collectstatic --noinput
```

### CSS/Sidebar Rusak
Pastikan menggunakan `baron-emerald.css`, bukan file CSS lama.

### Dropdown Mapel Kosong
Cek endpoint `/api/core/master-mapel/grouped/` dan pastikan data master sudah di-seed.

### Token Expired
- Access token: 60 menit
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

**Status**: Production Ready | **Versi**: 2.3.11 | **Update**: 26 April 2026
