# Baron Ponpes Portal Akademik
## Project Handover & Future Vision Document

---

**Document Version:** 1.0.0
**Last Updated:** March 2026
**Prepared By:** Lead Software Architect
**Status:** Production-Ready with Active Development

---

## Table of Contents

1. [Project Overview & Identity](#1-project-overview--identity)
2. [Current Technical Status](#2-current-technical-status-the-now)
3. [Future Roadmap](#3-future-roadmap-the-vision)
4. [Known Issues & Debugging Notes](#4-known-issues--debugging-notes)
5. [Development Guidelines](#5-development-guidelines)
6. [Deployment & Operations](#6-deployment--operations)

---

## 1. Project Overview & Identity

### 1.1 Project Identity

| Attribute | Value |
|-----------|-------|
| **Project Name** | Baron Ponpes Portal Akademik |
| **Project Type** | Centralized Academic & Financial Management System |
| **Target Users** | Islamic Boarding Schools (Pondok Pesantren) |
| **Version** | 1.0.0 (Production) |
| **Repository** | portal-siswa |

### 1.2 Mission Statement

> A comprehensive, accessible academic management platform designed specifically for Indonesian Islamic Boarding Schools, emphasizing **role-based accessibility** and **boomer-friendly UX** for administrative staff while providing modern interfaces for all stakeholders.

### 1.3 Core Objectives

1. **Centralized Management** - Single platform for academics, attendance, evaluations, and finance
2. **Role-Based Access** - Tailored experiences for 6 distinct user roles
3. **Accessibility First** - High-contrast, senior-friendly design for administrators
4. **Islamic Education Focus** - Built-in support for Hafalan (memorization) tracking
5. **Financial Transparency** - Complete billing, payment, and verification workflows

### 1.4 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
│  HTML5 + CSS3 + Vanilla JavaScript                         │
│  Baron Deep Emerald Theme + Glass Morphism UI              │
└─────────────────────────────────────────────────────────────┘
                              ↕ REST API (JSON)
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND LAYER                           │
│  Django 4.2.7 + Django REST Framework 3.14.0               │
│  SimpleJWT Authentication + Custom RBAC                     │
└─────────────────────────────────────────────────────────────┘
                              ↕ ORM
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                          │
│  PostgreSQL (Production) / SQLite (Development)            │
│  Django Signals for Real-time Updates                       │
└─────────────────────────────────────────────────────────────┘
```

**Key Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| Django | 4.2.7 | Web framework |
| djangorestframework | 3.14.0 | API framework |
| djangorestframework-simplejwt | 5.3.1 | JWT authentication |
| psycopg2-binary | 2.9.9 | PostgreSQL adapter |
| pandas | 2.1.4 | Excel data processing |
| Pillow | 10.1.0 | Image handling |
| gunicorn | 21.2.0 | WSGI server |
| whitenoise | 6.6.0 | Static file serving |

### 1.5 User Roles & Hierarchy

```
                    ┌─────────────┐
                    │ SUPERADMIN  │ ← Full system control
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │ PIMPINAN  │    │ BENDAHARA │    │   GURU    │
   │ Principal │    │  Finance  │    │  Teacher  │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │
         │                │                │
         └────────────────┼────────────────┘
                          ▼
                  ┌───────────────┐
                  │  WALISANTRI   │ ← View own child's data
                  │   Guardian    │
                  └───────────────┘
                          │
                  ┌───────────────┐
                  │   PENDAFTAR   │ ← Registration only
                  └───────────────┘
```

---

## 2. Current Technical Status (The "Now")

### 2.1 Module Status Overview

| Module | Status | Completion | Notes |
|--------|--------|------------|-------|
| **Authentication** | ✅ Production | 100% | JWT + RBAC fully implemented |
| **Students** | ✅ Production | 100% | CRUD + Excel import |
| **Attendance** | ✅ Production | 100% | 9-period system + drafts |
| **Grades** | ✅ Production | 100% | Multi-assessment types |
| **Evaluations** | ✅ Production | 100% | Achievement/violation tracking |
| **Finance** | ✅ Production | 95% | Billing, payments, verification |
| **Hafalan** | ✅ Production | 100% | Memorization tracking |
| **Registration** | ✅ Production | 100% | Approval workflow |
| **Dashboard** | ✅ Production | 100% | Role-specific views |

### 2.2 Core Modules Detail

#### A. Attendance Module (Absensi)

**Architecture:**
```
Student → Attendance (1:N)
          ├── 9 Lesson Periods (JP 1-9)
          │   ├── JP 1: Pagi (Morning)
          │   ├── JP 2-7: Siang (Afternoon)
          │   └── JP 8-9: Sore (Evening)
          └── Unique constraint: (nisn, tanggal, jam_ke)

AttendanceDraft → Bulk Entry System
          ├── JSON storage for flexible data
          └── Teacher can finalize draft → Attendance records
```

**Key Features:**
- Per-lesson-period tracking (not just daily)
- Draft system for bulk entry before finalization
- Teacher-restricted access by assigned class
- Status options: Hadir, Sakit, Izin, Alpha

#### B. Grades Module (Nilai)

**Architecture:**
```
Student → Grade (1:N)
          ├── Assessment Types: UH, UTS, UAS, Tugas, Proyek
          ├── Semesters: Ganjil (Odd), Genap (Even)
          ├── Validation: 0-100 score range
          └── Indexed by: nisn, kelas, semester, tahun_ajaran
```

**Key Features:**
- Multiple assessment type support
- Semester-based organization
- Automatic score validation (0-100)
- Teacher assignment tracking

#### C. Finance Module (Keuangan) - **Newest Addition**

**Architecture:**
```
Tarif (Master Pricing)
   │
   │ Categories: spp, gedung, seragam, buku, kegiatan, wisuda, lainnya
   │ Frequency: bulanan, semester, tahunan, sekali
   │
   └─→ Tagihan (Invoice/Billing)
          │
          │ Invoice: INV-{YYYYMM}-{KAT}-{NISN}-{UUID}
          │ Status: belum_bayar → sebagian → lunas / lewat_jatuh_tempo
          │ Calculations: total = nominal - diskon + denda
          │
          └─→ Pembayaran (Payment)
                 │
                 │ Methods: tunai, transfer, qris, virtual_account
                 │ Verification: terverifikasi (boolean)
                 │ Evidence: bukti (ImageField)
                 │
                 └─→ Signal-driven status updates
```

**Invoice Generation Formula:**
```python
def generate_invoice_number(self):
    # Format: INV-YYYYMM-KAT-NISN4-UUID4
    return f"INV-{tahun}{bulan:02d}-{kategori[:3].upper()}-{nisn[-4:]}-{uuid[:4]}"
```

**Payment Verification Workflow:**
```
Walisantri              Bendahara               System
    │                       │                      │
    │ ───Upload Bukti────→  │                      │
    │                       │ ───Review Image───→  │
    │                       │                      │
    │                       │ ──Verify Payment──→  │
    │                       │                      │
    │                       │                  [Signals]
    │                       │                      │
    │                       │  ←──Update Tagihan──┘
    │                       │     - terbayar
    │  ←──Status Update──── │     - sisa
    │                       │     - status (lunas/sebagian)
```

### 2.3 Backend Hardening

#### Transaction Safety
```python
# Finance operations wrapped in atomic transactions
from django.db import transaction

@transaction.atomic
def verify_payment(request, pk):
    pembayaran = get_object_or_404(Pembayaran, pk=pk)
    pembayaran.terverifikasi = True
    pembayaran.verified_by = request.user.username
    pembayaran.tanggal_verifikasi = timezone.now()
    pembayaran.save()  # Triggers signal for tagihan update
```

#### Audit Trail Implementation
```python
# All critical models include:
class Tagihan(models.Model):
    # ... business fields ...

    # Audit fields
    created_by = models.CharField(max_length=100, blank=True)
    updated_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Verification audit
    verified_by = models.CharField(max_length=100, blank=True, null=True)
    tanggal_verifikasi = models.DateTimeField(null=True, blank=True)
```

#### Django Signals for Real-time Updates
```python
# apps/finance/signals.py

@receiver(post_save, sender=Pembayaran)
def update_tagihan_on_payment(sender, instance, **kwargs):
    """
    Automatically update Tagihan status when payment is verified.

    Triggers:
    - New verified payment
    - Verification status change
    - Nominal change on verified payment
    """
    if instance.terverifikasi:
        tagihan = instance.tagihan

        # Calculate total verified payments
        total_verified = Pembayaran.objects.filter(
            tagihan=tagihan,
            terverifikasi=True
        ).aggregate(total=Sum('nominal'))['total'] or Decimal('0')

        # Update tagihan
        tagihan.terbayar = total_verified
        tagihan.sisa = tagihan.total - total_verified

        # Determine status
        if tagihan.sisa <= 0:
            tagihan.status = 'lunas'
        elif tagihan.terbayar > 0:
            tagihan.status = 'sebagian'
        elif tagihan.is_overdue:
            tagihan.status = 'lewat_jatuh_tempo'
        else:
            tagihan.status = 'belum_bayar'

        tagihan.save(update_fields=['terbayar', 'sisa', 'status', 'updated_at'])
```

### 2.4 UI/UX Strategy: "Hybrid Deep Emerald" Design System

**Design Philosophy:**
```
Modern Dashboard + High-Contrast Admin = Hybrid Deep Emerald
```

#### Color Palette
```css
:root {
    /* Primary - Deep Emerald */
    --emerald-900: #064e3b;
    --emerald-800: #065f46;
    --emerald-700: #047857;
    --emerald-600: #059669;
    --emerald-500: #10b981;

    /* Accent - Gold */
    --gold-500: #eab308;
    --gold-600: #ca8a04;

    /* Status Colors */
    --status-success: #22c55e;
    --status-warning: #f59e0b;
    --status-danger: #ef4444;
    --status-info: #3b82f6;

    /* Accessibility - High Contrast */
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --background-light: #f9fafb;
}
```

#### Component Styling Principles

**Dashboard (Modern Aesthetic):**
```css
.glass-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.stat-card {
    padding: 24px;
    border-radius: 12px;
    transition: transform 0.2s ease;
}
```

**Finance Admin (Boomer-Friendly):**
```css
/* Larger touch targets */
.action-btn {
    min-height: 44px;
    min-width: 44px;
    font-size: 16px;
    padding: 12px 20px;
}

/* High-contrast badges */
.badge-status {
    border-radius: 8px;
    padding: 10px 15px;
    font-weight: 600;
    border: 2px solid currentColor;
}

/* Clear visual hierarchy */
.data-table th {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
```

#### Accessibility Features

1. **Font Sizing** - Minimum 14px for body text, 16px for interactive elements
2. **Touch Targets** - Minimum 44x44px for all buttons
3. **Color Contrast** - WCAG AA compliant (4.5:1 ratio)
4. **Input Masking** - Thousands separator for currency fields
5. **Confirmation Dialogs** - SweetAlert2 with large buttons
6. **Success Indicators** - Full-screen overlay for critical actions
7. **Icon + Text Labels** - Never icon-only buttons in admin sections

---

## 3. Future Roadmap (The "Vision")

### Phase 1: Operational Excellence (Q2 2026)

**Goal:** Streamline administrative operations and enable offline workflows.

#### 1.1 PDF Receipt/Invoice Generation
```python
# Proposed implementation using ReportLab/WeasyPrint

from django.http import HttpResponse
from weasyprint import HTML

def generate_invoice_pdf(request, tagihan_id):
    tagihan = Tagihan.objects.get(id=tagihan_id)
    html_string = render_to_string('finance/invoice_template.html', {
        'tagihan': tagihan,
        'school': get_school_settings(),
        'generated_at': timezone.now()
    })

    pdf = HTML(string=html_string).write_pdf()

    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="INV-{tagihan.no_invoice}.pdf"'
    return response
```

**Deliverables:**
- [ ] Invoice PDF template (thermal printer compatible)
- [ ] Receipt PDF template (A4 format)
- [ ] Batch PDF generation for month-end
- [ ] Direct thermal printer integration (ESC/POS)

#### 1.2 Physical Archive Support
```
┌──────────────────────────────────────┐
│      PHYSICAL ARCHIVE WORKFLOW       │
├──────────────────────────────────────┤
│                                      │
│  Digital Record ──→ Generate PDF     │
│                         │            │
│                    ┌────▼────┐       │
│                    │  Print  │       │
│                    └────┬────┘       │
│                         │            │
│              ┌──────────┴──────────┐ │
│              ▼                     ▼ │
│         Thermal            A4 Binder │
│         Receipt            Archive   │
│                                      │
└──────────────────────────────────────┘
```

---

### Phase 2: Communication (Q3 2026)

**Goal:** Real-time notification system for parents and administrators.

#### 2.1 WhatsApp Gateway Integration
```python
# Proposed architecture using Fonnte/Twilio/WA Business API

class NotificationService:
    def send_payment_confirmation(self, pembayaran):
        """Send WhatsApp notification on payment verification."""

        walisantri = pembayaran.tagihan.siswa.get_walisantri()

        message = f"""
        ✅ *KONFIRMASI PEMBAYARAN*

        Assalamu'alaikum {walisantri.name},

        Pembayaran ananda *{pembayaran.tagihan.siswa.nama}* telah diverifikasi:

        📋 Invoice: {pembayaran.tagihan.no_invoice}
        💰 Nominal: Rp {pembayaran.nominal:,.0f}
        📅 Tanggal: {pembayaran.tanggal_verifikasi}

        Jazakumullah khairan.

        _Pondok Pesantren Baron_
        """

        self.wa_client.send(walisantri.phone, message)
```

**Notification Triggers:**
| Event | Recipient | Channel |
|-------|-----------|---------|
| Payment Verified | Walisantri | WhatsApp |
| New Invoice Generated | Walisantri | WhatsApp + Email |
| Payment Overdue (7 days) | Walisantri | WhatsApp |
| Monthly Statement | Walisantri | Email (PDF) |
| Low Attendance Alert | Walisantri | WhatsApp |
| Evaluation Added | Walisantri | WhatsApp |

#### 2.2 Email Notification System
```python
# Django email configuration

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

# Template-based emails
class InvoiceEmailTemplate:
    subject = "[Ponpes Baron] Invoice #{no_invoice}"
    template = "emails/invoice_notification.html"
```

---

### Phase 3: Intelligence (Q4 2026)

**Goal:** Data-driven decision making with analytics dashboards.

#### 3.1 Financial Analytics Dashboard

**Revenue Trends Visualization:**
```python
# Aggregated data endpoints

class FinanceAnalyticsViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'])
    def revenue_trends(self, request):
        """Monthly revenue trends for the past 12 months."""

        data = Pembayaran.objects.filter(
            terverifikasi=True,
            tanggal__gte=timezone.now() - timedelta(days=365)
        ).annotate(
            month=TruncMonth('tanggal')
        ).values('month').annotate(
            total=Sum('nominal'),
            count=Count('id')
        ).order_by('month')

        return Response({
            'labels': [d['month'].strftime('%b %Y') for d in data],
            'revenue': [float(d['total']) for d in data],
            'transactions': [d['count'] for d in data]
        })

    @action(detail=False, methods=['get'])
    def arrears_analysis(self, request):
        """Unpaid arrears breakdown by kelas and kategori."""

        data = Tagihan.objects.filter(
            status__in=['belum_bayar', 'sebagian', 'lewat_jatuh_tempo']
        ).values(
            'siswa__kelas', 'tarif__kategori'
        ).annotate(
            total_arrears=Sum('sisa'),
            count=Count('id')
        )

        return Response(data)
```

**Dashboard Widgets:**
```
┌────────────────────────────────────────────────────────────┐
│                  FINANCIAL ANALYTICS                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Revenue     │  │  Collection  │  │  Arrears     │     │
│  │  This Month  │  │  Rate        │  │  Total       │     │
│  │  Rp 45.2M    │  │  87.3%       │  │  Rp 12.8M    │     │
│  │  ↑ 12%       │  │  ↑ 5%        │  │  ↓ 8%        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              REVENUE TREND (12 MONTHS)               │  │
│  │     📊 Line Chart with Monthly Revenue               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────┐  ┌────────────────────────────┐   │
│  │  ARREARS BY KELAS  │  │  PAYMENT METHOD BREAKDOWN  │   │
│  │  📊 Bar Chart      │  │  📊 Pie Chart              │   │
│  └────────────────────┘  └────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 3.2 Predictive Analytics
- Arrears prediction based on payment history
- Student performance trend analysis
- Attendance pattern recognition

---

### Phase 4: Scaling (2027)

**Goal:** Mobile accessibility and enhanced user experience.

#### 4.1 Progressive Web App (PWA)
```javascript
// service-worker.js

const CACHE_NAME = 'baron-portal-v1';
const OFFLINE_URLS = [
    '/',
    '/dashboard/',
    '/attendance/',
    '/offline.html',
    '/public/css/baron-emerald.css',
    '/public/js/app.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(OFFLINE_URLS))
    );
});
```

**PWA Features:**
- [ ] Offline attendance recording (sync when online)
- [ ] Push notifications for critical alerts
- [ ] Home screen installation
- [ ] Background sync for data submission

#### 4.2 Native Mobile App (React Native/Flutter)

**Target Features:**
| Feature | Teacher | Walisantri |
|---------|---------|------------|
| Quick Attendance | ✓ | |
| Hafalan Recording | ✓ | |
| View Grades | | ✓ |
| View Invoices | | ✓ |
| Upload Payment | | ✓ |
| Push Notifications | ✓ | ✓ |
| Offline Mode | ✓ | |

---

## 4. Known Issues & Debugging Notes

### 4.1 Media File Pathing

**Issue:** Images returning 404 or infinite error loops.

**Root Cause:**
```python
# Serializer returning relative paths instead of absolute URLs
bukti = models.ImageField(upload_to='pembayaran/')
# Returns: 'pembayaran/image.jpg' instead of '/media/pembayaran/image.jpg'
```

**Solution:**
```python
# Use SerializerMethodField with build_absolute_uri

class PembayaranSerializer(serializers.ModelSerializer):
    bukti = serializers.SerializerMethodField()

    def get_bukti(self, obj):
        if obj.bukti:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.bukti.url)
            return obj.bukti.url
        return None
```

**Frontend Error Handling:**
```javascript
// Prevent 404 loop on broken images
function handleImageError(img) {
    img.onerror = null;  // Remove handler to prevent loop
    const placeholder = document.createElement('div');
    placeholder.className = 'bukti-placeholder';
    placeholder.innerHTML = '📷';
    img.parentNode.replaceChild(placeholder, img);
}
```

**Django Settings Required:**
```python
# settings.py

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# urls.py (development)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### 4.2 Permission Object-Level Access

**Issue:** `IsWalisantri` permission failing for FK object comparisons.

**Root Cause:**
```python
# Old code - comparing string to FK object
if nisn == obj.siswa:  # obj.siswa is Student object, not string
```

**Solution:**
```python
class IsWalisantri(BasePermission):
    def has_object_permission(self, request, view, obj):
        nisn = request.user.linked_student_nisn

        # Handle both FK and string comparisons
        if hasattr(obj, 'siswa'):
            # FK relationship
            if hasattr(obj.siswa, 'nisn'):
                return str(nisn) == str(obj.siswa.nisn)
            return str(nisn) == str(obj.siswa)
        elif hasattr(obj, 'nisn'):
            return str(nisn) == str(obj.nisn)

        return False
```

### 4.3 Guru Class Assignment Validation

**Issue:** Teachers without `kelas` assignment causing permission errors.

**Solution:**
```python
class IsGuru(BasePermission):
    def has_permission(self, request, view):
        if request.user.role in ['superadmin', 'pimpinan']:
            return True
        if request.user.role == 'guru':
            # Validate kelas is set
            if not request.user.kelas or request.user.kelas.strip() == '':
                return False
            return True
        return False
```

### 4.4 Invoice Number Migration

**Issue:** Existing tagihan records without `no_invoice`.

**Solution:**
```bash
# Run management command
python manage.py generate_invoices

# Options
python manage.py generate_invoices --dry-run  # Preview only
python manage.py generate_invoices --force    # Regenerate all
```

### 4.5 Signal Infinite Loop Prevention

**Issue:** Signal handlers triggering each other recursively.

**Solution:**
```python
# Use update_fields to prevent re-triggering
tagihan.save(update_fields=['terbayar', 'sisa', 'status', 'updated_at'])

# Or use signal disconnection pattern
@receiver(post_save, sender=Pembayaran)
def update_tagihan(sender, instance, **kwargs):
    if getattr(instance, '_skip_signal', False):
        return

    instance._skip_signal = True
    try:
        # ... update logic ...
    finally:
        instance._skip_signal = False
```

### 4.6 CORS Configuration

**Development:**
```python
CORS_ALLOW_ALL_ORIGINS = True  # Development only!
```

**Production:**
```python
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://portal.baronponpes.id",
    "https://www.baronponpes.id",
]
```

---

## 5. Development Guidelines

### 5.1 Code Structure

```
backend_django/
├── manage.py
├── requirements.txt
├── backend_django/           # Project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/                     # Django applications
│   ├── accounts/            # Authentication & RBAC
│   ├── students/            # Student management
│   ├── attendance/          # Attendance tracking
│   ├── grades/              # Academic grades
│   ├── evaluations/         # Student evaluations
│   ├── finance/             # Billing & payments
│   ├── dashboard/           # Dashboard views
│   └── registration/        # Student registration
├── media/                    # User uploads
├── logs/                     # Application logs
└── staticfiles/              # Collected static files

frontend/
├── views/                    # HTML templates
│   ├── login.html
│   ├── dashboard.html
│   ├── finance.html
│   └── ...
└── public/
    ├── js/                   # JavaScript modules
    │   ├── app.js
    │   ├── finance.js
    │   └── ...
    └── css/                  # Stylesheets
        └── baron-emerald.css
```

### 5.2 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Models | PascalCase, singular | `Tagihan`, `Pembayaran` |
| Fields | snake_case | `tanggal_verifikasi` |
| Views | PascalCase + ViewSet | `TagihanViewSet` |
| URLs | kebab-case | `/api/finance/generate-spp/` |
| JS Functions | camelCase | `submitTarif()` |
| CSS Classes | kebab-case | `.stat-card`, `.badge-lunas` |

### 5.3 API Response Format

**Success:**
```json
{
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully"
}
```

**List with Pagination:**
```json
{
    "count": 100,
    "next": "http://api/resource/?page=2",
    "previous": null,
    "results": [ ... ]
}
```

**Error:**
```json
{
    "success": false,
    "error": "Error type",
    "message": "Human-readable error message",
    "details": { ... }
}
```

### 5.4 Git Workflow

```bash
# Feature branch
git checkout -b feature/invoice-pdf-generation

# Commit message format
git commit -m "feat(finance): add PDF invoice generation

- Add ReportLab integration
- Create invoice template
- Add download endpoint

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# PR title format
[MODULE] Brief description
# Example: [Finance] Add PDF invoice generation
```

---

## 6. Deployment & Operations

### 6.1 Environment Variables

```bash
# .env.example

# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=portal.baronponpes.id,www.baronponpes.id

# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname

# JWT
ACCESS_TOKEN_LIFETIME=60
REFRESH_TOKEN_LIFETIME=1440

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@baronponpes.id
EMAIL_HOST_PASSWORD=app-password

# WhatsApp (Future)
WA_API_KEY=your-api-key
WA_SENDER_NUMBER=6281234567890

# Media
MEDIA_URL=/media/
```

### 6.2 Production Checklist

```
[ ] DEBUG = False
[ ] SECRET_KEY from environment
[ ] ALLOWED_HOSTS configured
[ ] HTTPS enforced
[ ] HSTS enabled
[ ] Database migrated
[ ] Static files collected
[ ] Media storage configured
[ ] Logging configured
[ ] Backup strategy in place
[ ] Error monitoring (Sentry)
[ ] SSL certificate installed
[ ] CORS whitelist configured
```

### 6.3 Backup Strategy

```bash
# Database backup (daily)
pg_dump -U postgres baron_db > backup_$(date +%Y%m%d).sql

# Media backup (weekly)
tar -czf media_backup_$(date +%Y%m%d).tar.gz media/

# Retention: 30 days rolling
```

### 6.4 Monitoring

**Key Metrics:**
- API response times (target: < 200ms)
- Database query performance
- Payment verification queue size
- Error rate (target: < 0.1%)
- Active sessions count

**Logging:**
```python
LOGGING = {
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/django.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
        },
    },
}
```

---

## Appendix A: API Endpoint Reference

| Endpoint | Method | Description | Permission |
|----------|--------|-------------|------------|
| `/api/auth/login/` | POST | User authentication | Public |
| `/api/users/me/` | GET | Current user profile | Authenticated |
| `/api/students/` | GET/POST | Student CRUD | Staff |
| `/api/attendance/` | GET/POST | Attendance records | Guru+ |
| `/api/grades/` | GET/POST | Grade management | Guru+ |
| `/api/finance/tarif/` | CRUD | Pricing master | Bendahara |
| `/api/finance/tagihan/` | CRUD | Invoices | Bendahara |
| `/api/finance/pembayaran/` | CRUD | Payments | Authenticated |
| `/api/finance/pembayaran/{id}/verify/` | POST | Verify payment | Bendahara |
| `/api/finance/statistics/` | GET | Finance summary | Bendahara |
| `/api/finance/student/{nisn}/` | GET | Student finance | Walisantri |
| `/api/finance/generate-spp/` | POST | Bulk invoice gen | Bendahara |

---

## Appendix B: Database Schema (Key Tables)

```sql
-- Users (Custom AUTH_USER_MODEL)
CREATE TABLE accounts_user (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL,
    name VARCHAR(200),
    email VARCHAR(254),
    phone VARCHAR(20),
    linked_student_nisn VARCHAR(20),
    kelas VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    date_joined TIMESTAMP DEFAULT NOW()
);

-- Students
CREATE TABLE students_student (
    nisn VARCHAR(20) PRIMARY KEY,
    nama VARCHAR(200) NOT NULL,
    kelas VARCHAR(20),
    program VARCHAR(50),
    aktif BOOLEAN DEFAULT TRUE,
    target_hafalan INTEGER DEFAULT 0,
    current_hafalan INTEGER DEFAULT 0
);

-- Finance: Tagihan
CREATE TABLE finance_tagihan (
    id SERIAL PRIMARY KEY,
    siswa_id VARCHAR(20) REFERENCES students_student(nisn),
    tarif_id INTEGER REFERENCES finance_tarif(id),
    no_invoice VARCHAR(50) UNIQUE,
    bulan INTEGER,
    tahun INTEGER NOT NULL,
    nominal DECIMAL(12,2) NOT NULL,
    diskon DECIMAL(12,2) DEFAULT 0,
    denda DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    terbayar DECIMAL(12,2) DEFAULT 0,
    sisa DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'belum_bayar',
    jatuh_tempo DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(siswa_id, tarif_id, bulan, tahun)
);

-- Finance: Pembayaran
CREATE TABLE finance_pembayaran (
    id SERIAL PRIMARY KEY,
    tagihan_id INTEGER REFERENCES finance_tagihan(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    nominal DECIMAL(12,2) NOT NULL,
    metode VARCHAR(20) NOT NULL,
    bukti VARCHAR(200),
    terverifikasi BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(100),
    tanggal_verifikasi TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Appendix C: Contact & Support

**Development Team:**
- Lead Architect: [Your Name]
- Backend Developer: [Name]
- Frontend Developer: [Name]

**Repository:** `portal-siswa`

**Documentation:** `/docs/` folder

**Issue Tracking:** GitHub Issues

---

*Document generated for Baron Ponpes Portal Akademik v1.0.0*
*Last updated: March 2026*
