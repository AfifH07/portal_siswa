# Dokumentasi Teknis: Arsitektur dan Technology Stack

**Portal Sistem Informasi Pondok Pesantren Baron**
**Versi:** 2.3.4
**Tanggal:** Maret 2026

---

## 1. Deskripsi Sistem

Portal Ponpes Baron adalah Sistem Informasi Manajemen Pesantren (*Boarding School Information System*) yang dirancang untuk mengelola seluruh aspek operasional pendidikan di Pondok Pesantren Baron. Sistem ini mengintegrasikan modul-modul utama meliputi:

- **Manajemen Siswa/Santri** — Data santri, alumni, dan informasi akademik
- **Presensi & Kehadiran** — Pencatatan kehadiran harian santri
- **Nilai Akademik** — Manajemen nilai mata pelajaran dan rapor
- **Program Tahfidz** — Tracking hafalan Al-Qur'an (juz, halaman, ayat)
- **Evaluasi Karakter (BLP)** — Bina Lingkungan Pesantren dengan 25 indikator di 6 domain
- **Monitoring Ibadah** — Tracking sholat 5 waktu, tilawah, dan ibadah harian
- **Keuangan** — Tagihan SPP dan pembayaran
- **Catatan & Bimbingan** — Sistem case management untuk pembinaan santri
- **HR/SDM** — Evaluasi kinerja Asatidz (Ustadz/Karyawan)

Sistem dibangun dengan arsitektur **Single Page Application (SPA)-like** menggunakan Django sebagai backend API dan Vanilla JavaScript di frontend, dengan pemisahan yang jelas antara business logic (backend) dan presentation layer (frontend).

---

## 2. Lingkungan Backend

### 2.1 Framework Utama

| Komponen | Versi | Fungsi |
|----------|-------|--------|
| **Django** | 4.2.7 | Web framework utama berbasis Python, menangani routing, ORM, dan templating |
| **Django REST Framework** | 3.14.0 | Toolkit untuk membangun RESTful API dengan serializers, viewsets, dan permissions |
| **Simple JWT** | 5.3.1 | Autentikasi berbasis JSON Web Token dengan fitur refresh token dan blacklist |

### 2.2 Database

| Environment | Database Engine | Keterangan |
|-------------|-----------------|------------|
| Development | **SQLite 3** | Database file-based untuk development lokal (`db.sqlite3`) |
| Production | **PostgreSQL** | Database relasional enterprise-grade via `psycopg2-binary==2.9.9` |

**Konfigurasi Database:**
```python
# Development: SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Production: PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        ...
    }
}
```

### 2.3 Library Dependencies

| Library | Versi | Fungsi Spesifik dalam Proyek |
|---------|-------|------------------------------|
| `djangorestframework-simplejwt` | 5.3.1 | Autentikasi JWT dengan access/refresh token, token blacklist setelah rotation |
| `django-cors-headers` | 4.3.1 | Mengizinkan cross-origin requests dari frontend (development) |
| `django-filter` | 23.5 | Backend filtering untuk API (filter by kelas, status, tanggal) |
| `django-environ` | 0.11.2 | Manajemen environment variables dari file `.env` |
| `python-decouple` | 3.8 | Parsing konfigurasi dari environment variables |
| `Pillow` | 10.1.0 | Processing gambar untuk upload foto profil/dokumen |
| `pandas` | 2.1.4 | Parsing dan manipulasi data Excel untuk import nilai/siswa |
| `openpyxl` | 3.1.2 | Engine untuk membaca/menulis file Excel (.xlsx) |
| `numpy` | 1.26.2 | Operasi numerik untuk kalkulasi statistik nilai |
| `gunicorn` | 21.2.0 | WSGI HTTP Server untuk deployment production |
| `whitenoise` | 6.6.0 | Serving static files di production |
| `drf-spectacular` | - | Auto-generate OpenAPI/Swagger documentation |
| `django-import-export` | - | Import/export data via Django Admin |

### 2.4 Struktur Aplikasi Django

```
backend_django/
├── backend_django/          # Project settings
│   ├── settings.py          # Konfigurasi utama
│   ├── urls.py              # Root URL routing
│   └── wsgi.py              # WSGI entry point
│
├── apps/
│   ├── core/                # Master Data (Tahun Ajaran)
│   ├── accounts/            # User management, authentication, RBAC
│   ├── students/            # Data santri, alumni, kelas
│   ├── attendance/          # Presensi harian
│   ├── grades/              # Nilai akademik, analytics
│   ├── evaluations/         # Evaluasi perilaku legacy
│   ├── kesantrian/          # Ibadah, Hafalan, BLP, Incident, HR
│   ├── finance/             # Tagihan SPP, pembayaran
│   ├── registration/        # Pendaftaran santri baru
│   └── dashboard/           # Dashboard views & statistics
│
└── media/                   # Uploaded files
```

### 2.5 REST Framework Configuration

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/minute',
        'user': '1000/day',
        'login': '5/minute',
    },
}
```

### 2.6 JWT Configuration

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=1440),  # 24 hours
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

---

## 3. Lingkungan Frontend

### 3.1 Arsitektur Frontend

Frontend dibangun dengan pendekatan **Vanilla JavaScript** tanpa framework SPA (React/Vue/Angular), menggunakan:

- **HTML5** — Struktur dokumen dengan semantic markup
- **CSS3** — Styling dengan CSS Custom Properties (variables)
- **JavaScript ES6+** — Logic dan interaksi DOM

### 3.2 Struktur Direktori Frontend

```
frontend/
├── views/                   # HTML templates (served by Django)
│   ├── index.html           # Landing page
│   ├── login.html           # Authentication page
│   ├── dashboard.html       # Main dashboard (role-based)
│   ├── dashboard-parent.html    # Walisantri dashboard
│   ├── dashboard-ustadz.html    # Ustadz/Guru dashboard
│   ├── students.html        # Student management
│   ├── attendance.html      # Attendance tracking
│   ├── grades.html          # Academic grades
│   ├── hafalan.html         # Tahfidz tracking
│   ├── evaluations.html     # Character evaluation (BLP)
│   ├── ibadah.html          # Worship tracking
│   ├── finance.html         # Financial module
│   ├── users.html           # User management (admin)
│   └── evaluasi-asatidz.html    # HR evaluation
│
└── public/
    ├── css/                 # Stylesheets
    │   ├── baron-emerald.css    # Main theme (design tokens)
    │   ├── bento-dashboard.css  # Dashboard layout
    │   ├── case-management.css  # Incident module
    │   └── [module]-baron.css   # Module-specific styles
    │
    └── js/                  # JavaScript modules
        ├── apiConfig.js     # API base URL configuration
        ├── apiFetch.js      # Centralized API wrapper
        ├── auth-check.js    # Authentication & authorization
        ├── auth.js          # Login/logout handlers
        ├── utils.js         # Shared utilities
        └── [module].js      # Module-specific logic
```

### 3.3 UI Framework & Libraries

| Library | Versi | Penggunaan |
|---------|-------|------------|
| **Chart.js** | 4.4.0 | Visualisasi data: Radar Chart (BLP), Doughnut (attendance), Line (progress) |
| **Google Fonts** | - | Typography: Plus Jakarta Sans (main), DM Mono (code) |

**Catatan:** Sistem **tidak menggunakan** Bootstrap, Tailwind CSS, atau UI framework lainnya. Seluruh styling dibangun dengan **custom CSS** menggunakan CSS Custom Properties untuk konsistensi design tokens.

### 3.4 Design System: Baron Emerald Theme

Sistem menggunakan custom design system "Baron Light Emerald" dengan CSS variables:

```css
:root {
    /* Brand Colors */
    --baron-gold: #c8961c;
    --baron-gold-light: #f0bf4c;

    /* Emerald Palette */
    --emerald-500: #1fa87a;
    --emerald-600: #178560;
    --emerald-700: #0f6347;

    /* UI Surfaces */
    --bg-base: #f2faf7;
    --bg-surface: #ffffff;
    --bg-sidebar: linear-gradient(180deg, #0f6347, #0a4a34, #062e20);

    /* Typography */
    --font-main: 'Plus Jakarta Sans', sans-serif;
    --font-mono: 'DM Mono', monospace;

    /* Spacing & Radius */
    --radius-sm: 8px;
    --radius-md: 12px;
    --sidebar-w: 265px;
}
```

### 3.5 Icon System

Sistem menggunakan **emoji icons** (Unicode) untuk representasi visual, bukan icon font library seperti FontAwesome:

| Konteks | Emoji |
|---------|-------|
| Dashboard | 📊 |
| Siswa | 👥 |
| Presensi | 📋 |
| Nilai | 📝 |
| Hafalan | 📖 |
| Ibadah | 🕌 |
| Keuangan | 💰 |
| Evaluasi | ⭐ |
| Settings | ⚙️ |

### 3.6 Metode Rendering & Data Fetching

**Rendering Pattern:**
- **Server-Side Template Rendering** — Django `TemplateView` merender HTML shell
- **Client-Side DOM Manipulation** — JavaScript mengisi data via DOM API

**API Communication:**
```javascript
// Centralized API wrapper (apiFetch.js)
window.apiFetch = async function(path, options = {}) {
    const url = window.API_CONFIG.buildUrl(path);
    const token = localStorage.getItem('access_token');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });

    // Auto-refresh token on 401
    if (response.status === 401) {
        await refreshToken();
        return retry(url, options);
    }

    return response;
};
```

**State Management:**
- `localStorage` — Token storage, user data caching, selected child (multi-child)
- DOM data attributes — `data-role`, `data-nisn`, `data-id`
- Global variables — `window.currentUser`, `window.allEvaluations`

---

## 4. Arsitektur Aplikasi

### 4.1 Pola MVT (Model-View-Template) Django

Django mengimplementasikan pola arsitektur **MVT** yang merupakan variasi dari MVC:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  HTML/CSS/JS  →  Fetch API  →  REST Endpoints           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     DJANGO BACKEND                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   TEMPLATE   │    │     VIEW     │    │    MODEL     │   │
│  │              │    │              │    │              │   │
│  │  HTML files  │◄───│  APIView     │◄───│  ORM Classes │   │
│  │  (shell)     │    │  ViewSet     │    │  (Database)  │   │
│  │              │    │  Serializer  │    │              │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Komponen Arsitektur

| Layer | Komponen Django | Fungsi |
|-------|-----------------|--------|
| **Model** | `models.py` | Definisi struktur data dan relasi database menggunakan Django ORM |
| **View** | `views.py`, `serializers.py` | Business logic, data validation, dan serialization untuk REST API |
| **Template** | HTML files in `frontend/views/` | Struktur halaman yang dirender server-side, diisi client-side |

### 4.3 REST API Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API ENDPOINTS                         │
├─────────────────────────────────────────────────────────────┤
│  /api/core/         → Master Data (Tahun Ajaran)            │
│  /api/auth/         → Authentication (login, refresh, logout)│
│  /api/users/        → User management                        │
│  /api/students/     → Student CRUD, classes                  │
│  /api/attendance/   → Attendance records                     │
│  /api/grades/       → Academic grades, analytics             │
│  /api/kesantrian/   → Ibadah, Hafalan, BLP, Incidents, HR    │
│  /api/finance/      → Billing, payments                      │
│  /api/dashboard/    → Statistics, summaries                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Authentication Flow

```
┌──────────┐     POST /api/auth/login/      ┌──────────────┐
│  Client  │ ────────────────────────────► │   Backend    │
│          │     {username, password}       │              │
│          │                                │              │
│          │ ◄──────────────────────────── │              │
│          │     {access_token,             │              │
│          │      refresh_token}            │              │
└──────────┘                                └──────────────┘
      │
      │  Store in localStorage
      ▼
┌──────────────────────────────────────────────────────────┐
│  Subsequent API Requests                                  │
│  Header: Authorization: Bearer <access_token>            │
└──────────────────────────────────────────────────────────┘
      │
      │  On 401 Unauthorized
      ▼
┌──────────┐     POST /api/auth/refresh/    ┌──────────────┐
│  Client  │ ────────────────────────────► │   Backend    │
│          │     {refresh_token}            │              │
│          │                                │              │
│          │ ◄──────────────────────────── │              │
│          │     {new_access_token}         │              │
└──────────┘                                └──────────────┘
```

### 4.5 Role-Based Access Control (RBAC)

Sistem mengimplementasikan 9 role dengan permission berbeda:

| Role | Akses Modul | Keterangan |
|------|-------------|------------|
| `superadmin` | ALL | Full system access |
| `pimpinan` | Dashboard, Students, Grades, Finance, HR | Kepala Sekolah/Mudir |
| `guru` | Dashboard, Students, Grades, Hafalan, Evaluasi | Pengajar |
| `musyrif` | Dashboard, Students, Hafalan, BLP, Evaluasi | Pengawas asrama |
| `admin_kelas` | Dashboard, Students, Attendance, Grades | Wali kelas |
| `bendahara` | Dashboard, Finance | Bendahara |
| `walisantri` | Dashboard (own child), Grades, Hafalan, Finance | Orang tua |
| `adituren` | Limited read-only | Alumni |
| `pendaftar` | Registration only | Calon santri |

### 4.6 Pemisahan Antarmuka via REST API

**Prinsip Desain:**
1. **Backend sebagai API Server** — Tidak merender HTML dengan data, hanya menyediakan JSON
2. **Frontend sebagai Consumer** — HTML shell dirender server-side, data diisi client-side
3. **Stateless Communication** — Setiap request membawa token, no server-side sessions

**Keuntungan Arsitektur:**
- **Scalability** — Frontend dan backend dapat di-scale secara independen
- **Flexibility** — Mudah membangun mobile app dengan API yang sama
- **Maintainability** — Clear separation of concerns
- **Testability** — API dapat ditest tanpa UI, UI dapat mock API

---

## 5. Diagram Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                               │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  baron-emerald.css │ module.js │ Chart.js │ apiFetch.js        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP/HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GUNICORN WSGI SERVER                         │
│                              (Production)                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DJANGO APPLICATION                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │  URL Router    │  │  REST Framework │  │  Django ORM           │ │
│  │                │  │                 │  │                       │ │
│  │  /api/*        │──│  ViewSets       │──│  Models               │ │
│  │  /dashboard/   │  │  Serializers    │  │  QuerySets            │ │
│  │  /students/    │  │  Permissions    │  │  Migrations           │ │
│  └────────────────┘  └─────────────────┘  └───────────────────────┘ │
│                                                       │              │
│  ┌─────────────────────────────────────────────────┐  │              │
│  │  Simple JWT                                      │  │              │
│  │  Token Authentication, Refresh, Blacklist        │  │              │
│  └─────────────────────────────────────────────────┘  │              │
└───────────────────────────────────────────────────────│──────────────┘
                                                        │
                                                        ▼
                              ┌─────────────────────────────────────┐
                              │            DATABASE                  │
                              │  SQLite (dev) / PostgreSQL (prod)   │
                              └─────────────────────────────────────┘
```

---

## 6. Referensi Teknis

### 6.1 File Konfigurasi Utama
- `backend_django/settings.py` — Django settings
- `backend_django/urls.py` — URL routing
- `frontend/public/js/apiConfig.js` — API base URL
- `frontend/public/js/apiFetch.js` — API wrapper
- `frontend/public/css/baron-emerald.css` — Design tokens

### 6.2 Environment Variables
```env
DEBUG=True
SECRET_KEY=your-secret-key
DB_NAME=portal_siswa
DB_USER=postgres
DB_PASS=password
DB_HOST=localhost
DB_PORT=5432
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=1440
```

---

*Dokumen ini dibuat sebagai bagian dari dokumentasi teknis Portal Ponpes Baron v2.3.4*
