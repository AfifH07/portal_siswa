# 📋 COMPLETE PROJECT PLAN - PORTAL PONPES BARON

## 📝 PROJECT OVERVIEW

**Project Name:** Portal Ponpes Baron  
**Domain:** ponpesbaron.id  
**Platform:** Django REST Framework + Native HTML/CSS/JS  
**Deployment:** Hostinger Cloud VPS  
**Timeline:** 5 Working Days  
**Status:** Planning Complete - Ready for Implementation  

---

## 🎯 PROJECT REQUIREMENTS

### **Business Requirements**
- Sistem manajemen pondok pesantren modern
- Pengelolaan data santri (~500 siswa)
- Sistem absensi berbasis kelas
- Manajemen nilai akademik
- Tracking evaluasi (prestasi/pelanggaran)
- Dashboard progress santri (target vs actual)
- Formulir pendaftaran online

### **Technical Requirements**
- Backend: Django 4.2.7 + DRF 3.14.0
- Frontend: Native HTML/CSS/JS (no framework)
- Database: PostgreSQL (production), SQLite (dev)
- Authentication: JWT with 5 role-based access
- Pagination: 25 rows per page
- Search & Filter capabilities
- Excel import/export functionality
- SSL/HTTPS required
- Modern, responsive UI (Bootstrap 5)

---

## 👥 USER ROLES (5 ROLES)

| Role | Description | Permissions |
|------|-------------|--------------|
| **superadmin** | System administrator | Full access, user management, system settings |
| **pimpinan** | School leadership | View all data, reports, statistics (read-only critical) |
| **guru** | Teachers | Manage attendance, input grades, add evaluations (class-related) |
| **walisantri** | Student guardians | View child's data only (attendance, grades, evaluations) |
| **pendaftar** | Registrants | Access registration form only |

### **Role-Based Redirects**
- superadmin → `/dashboard/admin`
- pimpinan → `/dashboard/pimpinan`
- guru → `/dashboard/guru`
- walisantri → `/dashboard/walisantri`
- pendaftar → `/registration`

---

## 📊 FEATURE SPECIFICATIONS

### **1. Authentication System**
- Login page with role-based authentication
- Password reset functionality
- Token-based authentication (JWT)
- Auto-refresh token mechanism
- Logout functionality
- Protected route middleware

### **2. Student Management**
- CRUD operations for student data
- Pagination (25 rows per page)
- Real-time search (by NISN, Nama)
- Filter by Class, Program, Status
- Excel import (bulk upload)
- Excel export (data backup)
- Student profile view

### **3. Attendance System**
- Batch attendance input by class
- Initialize attendance draft
- Status: Hadir, Sakit, Izin, Alpha
- Daily attendance view
- Monthly attendance report
- Attendance statistics (percentage)
- Class attendance summary

### **4. Grades Management**
- Batch grade input by class
- Grade types: UH, UTS, UAS, Tugas, Proyek
- Semester management (Ganjil/Genap)
- Academic year tracking
- Automatic average calculation
- Grade distribution
- Excel import/export

### **5. Evaluations System**
- Record achievements (Prestasi)
- Record violations (Pelanggaran)
- Photo upload for evidence
- Evaluator information
- Follow-up actions (tindak lanjut)
- Evaluation history

### **6. Dashboard (Role-Based)**
**Superadmin/Pimpinan Dashboard:**
- Total active students
- Total classes
- Today's attendance rate
- Overall grade average
- Hafalan progress (overall)
- Attendance chart (6 months)
- Grade distribution (pie chart)
- Below-target students list
- Recent activity feed

**Guru Dashboard:**
- Total students in class
- Today's attendance for class
- Class grade average
- Quick action buttons
- Student progress table
  - Hafalan progress bar (target vs current)
  - Grade progress bar (target vs actual)
  - Status indicator

**Walisantri Dashboard:**
- Child information (photo, name, class, NISN)
- Hafalan Progress
  - Target: X juz
  - Current: Y juz
  - Percentage: Z%
  - Status indicator
- Akademik Progress
  - Target: X
  - Current: Y
  - Percentage: Z%
  - Status indicator
- Quick access buttons
  - View Attendance
  - View Grades
  - View Evaluations

**Pendaftar View:**
- Registration form only
- Multi-step form wizard
- Form validation
- Submission confirmation

### **7. Registration Form**
**Multi-Step Form:**
- Step 1: Data Diri (Nama, NISN, TTL)
- Step 2: Kontak (Email, Phone, Alamat)
- Step 3: Akademik (Program, Kelas, Tanggal Masuk)
- Step 4: Wali (Nama, Phone, Hubungan)
- Step 5: Target (Hafalan, Nilai)

**Features:**
- Progress bar indicator
- Form validation
- NISN uniqueness check
- Photo upload (optional)
- Success notification
- Admin approval workflow

### **8. Progress Tracking System**
**Santri Progress Metrics:**
- Hafalan Progress
  - Target: Set by ponpes (e.g., 30 juz)
  - Current: Actual hafalan
  - Percentage: (current / target * 100)
  - Status: Above target (✓) / Below target (⚠)

- Akademik Progress
  - Target: Set by ponpes (e.g., 75)
  - Current: Actual grade average
  - Percentage: (current / target * 100)
  - Status: Above target (✓) / Below target (⚠)

**Visual Indicators:**
- Progress bars with color coding
- Green for above/below target achievement
- Red for below target
- Status badges
- Ranking by class

---

## 🗄️ DATABASE SCHEMA

### **User Model (accounts/models.py)**
```python
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('superadmin', 'Superadmin'),
        ('pimpinan', 'Pimpinan'),
        ('guru', 'Guru'),
        ('walisantri', 'Walisantri'),
        ('pendaftar', 'Pendaftar'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    name = models.CharField(max_length=100)
    nisn = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    linked_student_nisn = models.CharField(max_length=20, blank=True, null=True)
    kelas = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)
```

### **Student Model (students/models.py)**
```python
class Student(models.Model):
    nisn = models.CharField(max_length=20, unique=True)
    nama = models.CharField(max_length=100)
    kelas = models.CharField(max_length=20, blank=True, null=True)
    program = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    wali_nama = models.CharField(max_length=100, blank=True, null=True)
    wali_phone = models.CharField(max_length=20, blank=True, null=True)
    tanggal_masuk = models.DateField(blank=True, null=True)
    target_hafalan = models.IntegerField(default=0)
    current_hafalan = models.IntegerField(default=0)
    target_nilai = models.IntegerField(default=75)
    aktif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Attendance Model (attendance/models.py)**
```python
class Attendance(models.Model):
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE)
    tanggal = models.DateField()
    waktu = models.CharField(max_length=20)
    status = models.CharField(max_length=50)
    keterangan = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AttendanceDraft(models.Model):
    username = models.CharField(max_length=50)
    kelas = models.CharField(max_length=20)
    tanggal = models.DateField()
    mata_pelajaran = models.CharField(max_length=100)
    data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### **Grade Model (grades/models.py)**
```python
class Grade(models.Model):
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE)
    mata_pelajaran = models.CharField(max_length=100)
    nilai = models.IntegerField()
    semester = models.CharField(max_length=20)
    tahun_ajaran = models.CharField(max_length=10)
    jenis = models.CharField(max_length=50)
    kelas = models.CharField(max_length=20)
    guru = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Evaluation Model (evaluations/models.py)**
```python
class Evaluation(models.Model):
    JENIS_CHOICES = [
        ('prestasi', 'Prestasi'),
        ('pelanggaran', 'Pelanggaran'),
    ]
    
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE)
    tanggal = models.DateField()
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    evaluator = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    summary = models.TextField()
    photo = models.ImageField(upload_to='evaluations/', blank=True, null=True)
    tindak_lanjut = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 🔌 API ENDPOINTS

### **Authentication API**
```
POST   /api/auth/login/              - Login
POST   /api/auth/change-password/      - Change password
POST   /api/auth/request-reset/        - Request password reset
POST   /api/auth/reset-password/       - Reset password
POST   /api/auth/token/refresh/       - Refresh JWT token
POST   /api/auth/logout/              - Logout
```

### **Students API**
```
GET    /api/students/                  - List students (paginated, search, filter)
POST   /api/students/                  - Create student (superadmin, pimpinan)
GET    /api/students/<nisn>/           - Get student detail
PUT    /api/students/<nisn>/           - Update student (superadmin, pimpinan)
DELETE /api/students/<nisn>/           - Delete student (superadmin only)
GET    /api/students/classes/           - Get distinct classes
```

### **Attendance API**
```
POST   /api/attendance/initialize/      - Initialize daily attendance
POST   /api/attendance/                - Save single attendance
POST   /api/attendance/batch/           - Save batch attendance
GET    /api/attendance/today/<nisn>/    - Get today's attendance
GET    /api/attendance/monthly/<nisn>/<month>/<year>/  - Monthly attendance
GET    /api/attendance/stats/<nisn>/    - Attendance statistics
GET    /api/attendance/class/<kelas>/<tanggal>/       - Class attendance
GET    /api/attendance/all/             - All records (pimpinan)
```

### **Grades API**
```
POST   /api/grades/                    - Save grade
GET    /api/grades/<nisn>/             - Get student grades
GET    /api/grades/average/<nisn>/     - Calculate average
GET    /api/grades/class/<kelas>/      - Class grades
GET    /api/grades/all/                - All records (pimpinan)
```

### **Evaluations API**
```
POST   /api/evaluations/               - Save evaluation
GET    /api/evaluations/<nisn>/        - Student evaluations
GET    /api/evaluations/all/           - All records (pimpinan)
POST   /api/upload/photo/              - Upload evaluation photo
```

### **Dashboard API**
```
GET    /api/dashboard/stats/            - Dashboard statistics (role-based)
GET    /api/dashboard/attendance-chart/ - 6-month attendance chart
GET    /api/dashboard/grades-distribution/ - Grade distribution
GET    /api/dashboard/progress/        - Santri progress tracking
```

### **Registration API**
```
POST   /api/registration/              - Submit registration form
GET    /api/registration/pending/      - Get pending registrations (admin)
POST   /api/registration/<id>/approve/ - Approve registration (admin)
POST   /api/registration/<id>/reject/  - Reject registration (admin)
```

### **Documentation API**
```
GET    /api/schema/                    - OpenAPI schema
GET    /api/docs/                      - Swagger UI documentation
```

---

## 🎨 UI/UX DESIGN SYSTEM

### **Color Palette**
```css
:root {
    --primary: #0f766e;      /* Emerald green (Islamic theme) */
    --primary-dark: #134e4a;
    --accent: #f59e0b;        /* Amber/gold */
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --info: #3b82f6;
    --light: #f8fafc;
    --dark: #1e293b;
    --background: linear-gradient(135deg, #f0fdfa 0%, #fff 100%);
}
```

### **Typography**
- Font Family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- Headings: Bold, primary color
- Body: Regular, dark gray
- Labels: Medium, dark gray

### **Component Styles**

**Cards:**
```css
.card {
    border: none;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s, box-shadow 0.2s;
    background: white;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}
```

**Buttons:**
```css
.btn-primary {
    background: linear-gradient(135deg, #0f766e, #134e4a);
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: 600;
    transition: all 0.3s;
    color: white;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(15, 118, 110, 0.4);
}
```

**Progress Bars:**
```css
.progress-bar-container {
    background: #e9ecef;
    border-radius: 10px;
    overflow: hidden;
    height: 20px;
}

.progress-bar {
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
}

.progress-bar.above-target {
    background: linear-gradient(90deg, #10b981, #34d399);
}

.progress-bar.below-target {
    background: linear-gradient(90deg, #ef4444, #f87171);
}
```

**Status Badges:**
```css
.badge-success { background: #10b981; }
.badge-danger { background: #ef4444; }
.badge-warning { background: #f59e0b; }
.badge-info { background: #3b82f6; }
.badge-primary { background: #0f766e; }
```

---

## 📁 PROJECT STRUCTURE

```
portal-siswa/
├── DOCUMENTATION.md               # This file
├── DEPLOYMENT.md                  # Deployment guide
├── USER_MANUAL.md                 # User guide
├── API_DOCS.md                    # API documentation
├── README.md                      # Project readme
├── .env.example                   # Environment template
├── requirements.txt                # Python dependencies
├── backend_django/                # Django backend
│   ├── manage.py
│   ├── db.sqlite3
│   ├── backend_django/           # Django settings
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── apps/                     # Django apps
│   │   ├── accounts/             # Authentication & users
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── permissions.py
│   │   │   ├── urls.py
│   │   │   └── urls_users.py
│   │   ├── students/             # Student management
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   ├── attendance/           # Attendance system
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   ├── grades/               # Grades management
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   ├── evaluations/          # Evaluations system
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   └── urls_upload.py
│   │   ├── dashboard/            # Dashboard & stats
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│   │   └── registration/         # Registration system
│   │       ├── __init__.py
│   │       ├── apps.py
│   │       ├── models.py
│   │       ├── views.py
│   │       ├── serializers.py
│   │       └── urls.py
│   ├── management/               # Management commands
│   │   └── commands/
│   │       ├── __init__.py
│   │       ├── import_students.py
│   │       ├── import_grades.py
│   │       ├── export_attendance.py
│   │       └── seed_data.py
│   ├── media/                   # Uploaded files
│   │   ├── evaluations/
│   │   ├── grades/
│   │   └── photos/
│   ├── staticfiles/              # Collected static files
│   └── templates/               # Excel templates
│       ├── students_template.xlsx
│       └── grades_template.xlsx
├── frontend/                     # Frontend files
│   ├── views/                    # HTML templates
│   │   ├── index.html           # Main app (SPA)
│   │   ├── login.html           # Login page
│   │   ├── dashboard.html       # Dashboard
│   │   ├── students.html        # Student management
│   │   ├── attendance.html      # Attendance system
│   │   ├── grades.html          # Grades management
│   │   ├── evaluations.html     # Evaluations system
│   │   └── registration.html    # Registration form
│   ├── public/                   # Static assets
│   │   ├── css/
│   │   │   ├── style.css        # Main styles
│   │   │   ├── auth.css         # Auth styles
│   │   │   ├── dashboard.css    # Dashboard styles
│   │   │   ├── students.css     # Students styles
│   │   │   ├── attendance.css   # Attendance styles
│   │   │   ├── grades.css       # Grades styles
│   │   │   └── evaluations.css  # Evaluations styles
│   │   ├── js/
│   │   │   ├── app.js           # Main app logic
│   │   │   ├── auth.js          # Authentication
│   │   │   ├── dashboard.js     # Dashboard logic
│   │   │   ├── students.js      # Students logic
│   │   │   ├── attendance.js    # Attendance logic
│   │   │   ├── grades.js        # Grades logic
│   │   │   ├── evaluations.js   # Evaluations logic
│   │   │   └── registration.js  # Registration logic
│   │   └── assets/             # Images, icons
│   └── templates/               # Excel templates
│       ├── students_template.xlsx
│       └── grades_template.xlsx
├── backend/                     # Legacy Node.js (archived)
├── database/                    # Database files
│   └── schema.sql
└── docker-compose.yml           # Docker configuration
```

---

## 🗺️ 5-DAY EXECUTION PLAN

### **DAY 1: CORE INFRASTRUCTURE & AUTHENTICATION**

#### **Morning (4 hours)**
**1.1 Environment Setup (1 hour)**
```bash
# Install packages
pip install pandas openpyxl django-filter django-import-export drf-spectacular

# Update backend_django/settings.py
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'import_export',
    'drf_spectacular',
    'apps.accounts',
    'apps.students',
    'apps.attendance',
    'apps.grades',
    'apps.evaluations',
    'apps.dashboard',
    'apps.registration',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}
```

**1.2 Update User Model (1 hour)**
- Add 5 role choices
- Add new fields: phone, linked_student_nisn, kelas
- Update UserManager
- Create migration

**1.3 Permission Classes (1 hour)**
- Create `apps/accounts/permissions.py`
- Implement: IsSuperAdmin, IsPimpinan, IsGuru, IsWalisantri, IsPendaftar
- Add object-level permissions

**1.4 Authentication API (1 hour)**
- Update `apps/accounts/views.py`
- Implement login view with role-based response
- Implement token refresh
- Implement logout
- Update serializers

#### **Afternoon (4 hours)**
**1.5 Frontend Authentication UI (4 hours)**
- Create `frontend/views/login.html`
  - Glassmorphism design
  - Username & password fields
  - Show password toggle
  - Remember me checkbox
  - Loading states
  - Error messages
- Create `frontend/public/css/auth.css`
  - Modern design
  - Animations
  - Responsive
- Create `frontend/public/js/auth.js`
  - Login function
  - Token storage
  - Role-based redirect
  - Logout function
  - Auto-refresh token
- Integrate with backend API
- Test all 5 roles login flow

**Deliverables Day 1:**
- [ ] Environment setup complete
- [ ] User model updated
- [ ] Permission classes created
- [ ] Authentication API complete
- [ ] Login page UI complete
- [ ] Login/logout working for all roles

---

### **DAY 2: STUDENT MANAGEMENT & REGISTRATION**

#### **Morning (4 hours)**
**2.1 Update Student Model (1 hour)**
- Add new fields: phone, wali_nama, wali_phone, tanggal_masuk
- Add progress fields: target_hafalan, current_hafalan, target_nilai
- Add status field: aktif
- Add indexes
- Create migration

**2.2 Student Serializers (1 hour)**
- Create `apps/students/serializers.py`
- StudentSerializer (full)
- StudentListSerializer (minimal)
- StudentCreateSerializer
- StudentUpdateSerializer

**2.3 Student API Views (2 hours)**
- Update `apps/students/views.py`
- StudentViewSet with pagination
- Search by nisn, nama
- Filter by kelas, program, aktif
- Role-based queryset filtering (walisantri sees only linked child)
- Implement all CRUD operations
- Add distinct classes endpoint

#### **Afternoon (4 hours)**
**2.4 Student Management UI (3 hours)**
- Create `frontend/views/students.html`
  - Search box (debounced, 300ms)
  - Filter dropdowns (class, program, status)
  - DataTable with pagination
  - Action buttons (Add, Edit, Delete, View)
  - Bulk actions (Activate/Deactivate)
  - Export button
- Create `frontend/public/css/students.css`
  - Table styling
  - Search box styling
  - Filter styling
  - Responsive design
- Create `frontend/public/js/students.js`
  - Load students function
  - Search function
  - Filter function
  - Pagination handling
  - CRUD operations
  - Export to Excel

**2.5 Excel Import/Export (1 hour)**
- Create management command `import_students.py`
- Create Excel template file
- Implement pandas-based import
- Add validation
- Create export function

**Deliverables Day 2:**
- [ ] Student model updated
- [ ] Student API complete
- [ ] Student list UI complete
- [ ] Excel import/export working
- [ ] Search & filter working
- [ ] Pagination working

---

### **DAY 3: ATTENDANCE SYSTEM**

#### **Morning (4 hours)**
**3.1 Attendance Serializers (1 hour)**
- Create `apps/attendance/serializers.py`
- AttendanceSerializer
- AttendanceDraftSerializer
- AttendanceStatsSerializer

**3.2 Attendance API Views (3 hours)**
- Update `apps/attendance/views.py`
- InitializeAttendanceView (create draft)
- SaveBatchAttendanceView (save batch)
- AttendanceViewSet (CRUD)
- TodayAttendanceView (get today's)
- MonthlyAttendanceView (get monthly)
- AttendanceStatsView (statistics)
- ClassAttendanceView (by class)
- AllAttendanceView (for pimpinan)

#### **Afternoon (4 hours)**
**3.3 Attendance UI - Teacher View (3 hours)**
- Create `frontend/views/attendance.html`
  - Select class dropdown
  - Select subject dropdown
  - Date picker
  - Initialize button
  - Student table
  - Status dropdown per student
  - Keterangan input
  - Summary cards (Total, Hadir, Sakit, Izin, Alpha)
  - Save button
- Create `frontend/public/css/attendance.css`
  - Table styling
  - Status badges
  - Summary cards
- Create `frontend/public/js/attendance.js`
  - Load students by class
  - Initialize attendance
  - Save batch attendance
  - Auto-save to localStorage
  - Real-time summary update

**3.4 Attendance UI - Walisantri View (1 hour)**
- Add walisantri section to attendance.html
- Calendar view
- Monthly summary table
- Attendance percentage

**Deliverables Day 3:**
- [ ] Attendance API complete
- [ ] Initialize attendance working
- [ ] Batch attendance working
- [ ] Teacher attendance UI complete
- [ ] Walisantri attendance view complete
- [ ] Auto-save feature working

---

### **DAY 4: GRADES & EVALUATIONS + DASHBOARD**

#### **Morning (4 hours)**
**4.1 Grades System (2 hours)**
- Create `apps/grades/models.py`
- Create `apps/grades/serializers.py`
  - GradeSerializer
  - GradeCreateSerializer
  - GradeStatsSerializer
- Create `apps/grades/views.py`
  - GradeViewSet (CRUD)
  - AverageGradeView (calculate average)
  - ClassGradesView (by class)
  - AllGradesView (for pimpinan)

**4.2 Grades UI - Teacher View (1 hour)**
- Create `frontend/views/grades.html`
  - Select class, subject, semester, year, type
  - Load students
  - Input nilai (0-100)
  - Auto-validation
  - Save button
  - Summary (average, highest, lowest)
- Create `frontend/public/css/grades.css`
- Create `frontend/public/js/grades.js`

**4.3 Excel Import for Grades (1 hour)**
- Create management command `import_grades.py`
- Create Excel template
- Implement import with validation

#### **Afternoon (4 hours)**
**4.4 Evaluations System (1 hour)**
- Create `apps/evaluations/models.py`
- Create `apps/evaluations/serializers.py`
- Create `apps/evaluations/views.py`
  - EvaluationViewSet (CRUD)
  - UploadPhotoView
  - StudentEvaluationsView

**4.5 Evaluations UI (1 hour)**
- Add evaluations section to existing HTML
- Add evaluation form (modal)
- Photo upload with preview
- Evaluations list with badges
- Download photo button

**4.6 Dashboard System (2 hours)**
- Create `apps/dashboard/views.py`
  - DashboardStatsView (role-based)
  - AttendanceChartView
  - GradesDistributionView
  - ProgressTrackingView (NEW: Santri progress)
- Create `apps/dashboard/serializers.py`

**4.7 Dashboard UI (Remaining time)**
- Create role-based dashboard sections
- Stats cards
- Charts (Chart.js integration)
- Progress bars
- Recent activity feed

**Deliverables Day 4:**
- [ ] Grades model created
- [ ] Grades API complete
- [ ] Grades UI complete
- [ ] Excel import grades working
- [ ] Evaluations API complete
- [ ] Evaluations UI complete
- [ ] Dashboard API complete (with progress tracking)
- [ ] Dashboard UI complete (role-based)

---

### **DAY 5: UI POLISH & DEPLOYMENT**

#### **Morning (4 hours)**
**5.1 Modern UI Implementation (3 hours)**
- Integrate Bootstrap 5
  - Add CDN links
  - Update all HTML files
- Implement navigation
  - Sticky top navbar
  - Sidebar for desktop
  - Hamburger menu for mobile
  - Role-based menu items
- Apply color scheme
  - Update CSS variables
  - Apply to all components
- Add responsive design
  - Mobile breakpoints
  - Tablet layout
  - Desktop layout
- Add animations
  - Page transitions
  - Button hover effects
  - Card hover effects
- Add toasts for notifications
- Add loading spinners

**5.2 Registration Form (1 hour)**
- Create `apps/registration/models.py`
- Create `apps/registration/views.py`
- Create `apps/registration/serializers.py`
- Create `frontend/views/registration.html`
  - Multi-step form
  - Progress bar
  - Form validation
  - Photo upload
- Create `frontend/public/js/registration.js`

#### **Afternoon (4 hours)**
**5.3 Testing & QA (2 hours)**
Run through all test cases:
```markdown
## Authentication Tests
- [ ] Login with valid credentials (all 5 roles)
- [ ] Login with invalid credentials
- [ ] Password reset flow
- [ ] Role-based redirect
- [ ] Logout functionality
- [ ] Token refresh working

## Student Management Tests
- [ ] List students (pagination)
- [ ] Search by NISN
- [ ] Search by Nama
- [ ] Filter by Class
- [ ] Filter by Program
- [ ] Filter by Status
- [ ] Create student (superadmin)
- [ ] Edit student (superadmin, pimpinan)
- [ ] Delete student (superadmin)
- [ ] Excel import
- [ ] Excel export

## Attendance Tests
- [ ] Initialize attendance (guru)
- [ ] Save batch attendance
- [ ] View today's attendance (walisantri)
- [ ] View monthly attendance
- [ ] Attendance statistics
- [ ] All attendance (pimpinan)
- [ ] Auto-save working

## Grades Tests
- [ ] Save grades (guru)
- [ ] View student grades
- [ ] Calculate average
- [ ] Excel import grades
- [ ] All grades (pimpinan)

## Evaluations Tests
- [ ] Add evaluation (guru)
- [ ] Upload photo
- [ ] View evaluations (walisantri)
- [ ] All evaluations (pimpinan)
- [ ] Download photo

## Dashboard Tests
- [ ] Stats load correctly (all roles)
- [ ] Progress tracking (hafalan)
- [ ] Progress tracking (nilai)
- [ ] Charts render
- [ ] Below target indicators
- [ ] Recent activity

## Registration Tests
- [ ] Registration form submits
- [ ] NISN validation
- [ ] Form validation
- [ ] Success message
- [ ] Admin approval workflow

## Responsive Tests
- [ ] Desktop view (1920x1080)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)
- [ ] Navigation works on all devices
- [ ] Tables scrollable on mobile
```

**5.4 Deployment to Hostinger (2 hours)**
- Server setup (Ubuntu)
- Install dependencies
- Configure PostgreSQL
- Clone project
- Setup virtual environment
- Configure environment variables
- Run migrations
- Create superuser
- Collect static files
- Setup Gunicorn service
- Configure Nginx
- Install SSL certificate
- Configure firewall
- Security hardening
- Final testing on production

**Deliverables Day 5:**
- [ ] Bootstrap 5 integrated
- [ ] Modern UI complete
- [ ] Registration form complete
- [ ] All test cases passed
- [ ] Deployed to Hostinger
- [ ] SSL certificate active
- [ ] Production tested and working

---

## 📦 PYTHON DEPENDENCIES

```txt
# requirements.txt
Django==4.2.7
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.0
django-cors-headers==4.3.0
django-filter==23.5
pandas==2.1.3
openpyxl==3.1.2
django-import-export==3.3.5
drf-spectacular==0.26.5
psycopg2-binary==2.9.9
Pillow==10.1.0
gunicorn==21.2.0
python-decouple==3.8
whitenoise==6.6.0
```

---

## 🚀 DEPLOYMENT GUIDE

### **Hostinger Cloud VPS Requirements**
- **Package:** Cloud Professional ($9.99/month)
  - 4 GB RAM
  - 2 CPU Cores
  - 80 GB SSD
- **OS:** Ubuntu 22.04 LTS
- **Domain:** ponpesbaron.id (pointed to VPS IP)

### **Deployment Steps**

#### **1. Initial Server Setup**
```bash
# SSH to server
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib certbot python3-certbot-nginx git ufw

# Create project directory
mkdir /var/www/ponpesbaron
cd /var/www/ponpesbaron
```

#### **2. Database Setup**
```bash
# PostgreSQL
sudo -u postgres psql
CREATE DATABASE ponpesbaron;
CREATE USER ponpes_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE ponpesbaron TO ponpes_user;
\q
```

#### **3. Project Setup**
```bash
# Clone/upload project
git clone <your-repo-url> .

# Virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

#### **4. Environment Configuration**
```bash
nano .env

DEBUG=False
SECRET_KEY=<generate-very-long-random-key>
ALLOWED_HOSTS=ponpesbaron.id,www.ponpesbaron.id
DB_NAME=ponpesbaron
DB_USER=ponpes_user
DB_PASS=<strong_password_here>
DB_HOST=localhost
DB_PORT=5432
MEDIA_URL=/media/
MEDIA_ROOT=/var/www/ponpesbaron/media
```

#### **5. Run Migrations**
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

#### **6. Gunicorn Service**
```bash
sudo nano /etc/systemd/system/ponpesbaron.service

[Unit]
Description=Gunicorn daemon for Ponpes Baron
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/ponpesbaron
Environment="PATH=/var/www/ponpesbaron/venv/bin"
ExecStart=/var/www/ponpesbaron/venv/bin/gunicorn \
          --workers 3 \
          --bind unix:/var/www/ponpesbaron/ponpesbaron.sock \
          backend_django.wsgi:application

[Install]
WantedBy=multi-user.target

sudo systemctl start ponpesbaron
sudo systemctl enable ponpesbaron
sudo systemctl status ponpesbaron
```

#### **7. Nginx Configuration**
```bash
sudo nano /etc/nginx/sites-available/ponpesbaron

server {
    listen 80;
    server_name ponpesbaron.id www.ponpesbaron.id;

    location /static/ {
        alias /var/www/ponpesbaron/staticfiles/;
        expires 30d;
    }

    location /media/ {
        alias /var/www/ponpesbaron/media/;
        expires 30d;
    }

    location / {
        proxy_pass http://unix:/var/www/ponpesbaron/ponpesbaron.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

sudo ln -s /etc/nginx/sites-available/ponpesbaron /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### **8. SSL Certificate**
```bash
sudo certbot --nginx -d ponpesbaron.id -d www.ponpesbaron.id
sudo certbot renew --dry-run
```

#### **9. Firewall**
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

#### **10. Security Hardening**
```python
# Update production settings
DEBUG = False
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
ALLOWED_HOSTS = ['ponpesbaron.id', 'www.ponpesbaron.id']
```

#### **11. Final Checks**
```bash
sudo systemctl status ponpesbaron
sudo systemctl status nginx
sudo journalctl -u ponpesbaron -f
curl -I https://ponpesbaron.id
```

---

## ✅ FINAL DELIVERABLES CHECKLIST

### **Functional Requirements**
- [x] Authentication system (5 roles)
- [x] Student management (CRUD, pagination, search, filter)
- [x] Batch attendance system
- [x] Grades management (CRUD, average calculation)
- [x] Evaluations system (photo upload)
- [x] Dashboard (role-based)
- [x] Progress tracking (hafalan & nilai)
- [x] Registration form
- [x] Excel import/export
- [x] API documentation (Swagger)

### **Technical Requirements**
- [x] Django 4.2.7 + DRF 3.14.0
- [x] PostgreSQL database
- [x] JWT authentication
- [x] Pagination (25 per page)
- [x] Search & filter
- [x] Modern UI (Bootstrap 5)
- [x] Responsive design
- [x] SSL/HTTPS
- [x] Deployed to Hostinger

### **Documentation**
- [x] Project documentation (this file)
- [x] Deployment guide
- [x] User manual
- [x] API documentation
- [x] README

---

## 📚 EXCEL TEMPLATES

### **Students Template**
| NISN | Nama | Kelas | Program | Email | Phone | Wali Nama | Wali Phone | Tanggal Masuk | Target Hafalan | Target Nilai |
|------|------|-------|---------|-------|-------|-----------|------------|---------------|----------------|-------------|

### **Grades Template**
| NISN | Mata Pelajaran | Nilai | Semester | Tahun | Jenis | Kelas | Guru |
|------|---------------|-------|----------|-------|-------|-------|------|

---

## 🎯 SUCCESS CRITERIA

### **Project is complete when:**
1. All 5 user roles can login and access appropriate features
2. Teacher can input batch attendance for entire class
3. Teacher can input grades for students
4. Walisantri can view their child's data only
5. Pimpinan can view all statistics and reports
6. Superadmin can manage all aspects of the system
7. Dashboard shows progress tracking against targets
8. Pendaftar can submit registration form
9. Excel import/export works correctly
10. Application is responsive on mobile, tablet, and desktop
11. SSL/HTTPS is active and working
12. Application is deployed to Hostinger and accessible at ponpesbaron.id

---

## 📞 SUPPORT & MAINTENANCE

### **Post-Launch Support**
- Monitor server logs daily
- Backup database regularly
- Update dependencies monthly
- Security patches as needed
- User feedback collection
- Bug fixes as reported

### **Maintenance Tasks**
- Daily: Check server logs
- Weekly: Database backup
- Monthly: Dependency updates
- Quarterly: Security audit
- Annually: Performance review

---

## 📝 NOTES & ASSUMPTIONS

1. **Assumption:** No existing data from Google Apps Script needs to be imported
2. **Assumption:** Excel format from teachers matches provided templates
3. **Assumption:** Hostinger Cloud Professional package is sufficient for 500 students
4. **Assumption:** Internet connection is reliable for all users
5. **Assumption:** All users have modern browsers (Chrome, Firefox, Safari, Edge)
6. **Note:** Progress tracking targets (hafalan, nilai) are set per student and can be updated
7. **Note:** Registration form creates pending student records that require admin approval
8. **Note:** File uploads are limited to images for evaluations only
9. **Note:** Auto-save feature for attendance uses localStorage as fallback
10. **Note:** All API endpoints require authentication except registration

---

## 🚀 READY TO IMPLEMENT

This document provides a complete 5-day plan covering all requirements:

✅ **Authentication** - 5 roles with proper permissions  
✅ **Student Management** - CRUD + Pagination + Search + Filter + Excel  
✅ **Attendance** - Batch input by teacher + Statistics  
✅ **Grades** - Input + Calculation + Excel  
✅ **Evaluations** - Record + Photo upload  
✅ **Dashboard** - Stats + Charts + Progress Tracking  
✅ **Registration** - Multi-step form for pendaftar  
✅ **UI** - Modern, functional, responsive with Bootstrap 5  
✅ **Deployment** - Hostinger Cloud + SSL/HTTPS  

**Status:** Planning Complete - Ready for Implementation 🚀

---

*Document Version: 1.0*  
*Last Updated: January 22, 2026*  
*Project: Portal Ponpes Baron*  
*Duration: 5 Working Days*  
*Deployment: ponpesbaron.id*
