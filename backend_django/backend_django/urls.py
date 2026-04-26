from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from django.conf import settings
from django.conf.urls.static import static
from apps.dashboard.views import unified_dashboard

urlpatterns = [
    # ==========================================
    # FRONTEND ROUTES
    # ==========================================
    path('login/', TemplateView.as_view(template_name='login.html')),
    path('forgot-password/', TemplateView.as_view(template_name='forgot-password.html')),
    path('', RedirectView.as_view(url='/dashboard/', permanent=False)),

    # ==========================================
    # DASHBOARD (Single unified template)
    # ==========================================
    path('dashboard/', unified_dashboard, name='dashboard'),

    # ==========================================
    # MODULE PAGES
    # ==========================================
    path('students/', TemplateView.as_view(template_name='students.html')),
    path('attendance/', TemplateView.as_view(template_name='attendance.html')),  # Presensi
    path('grades/', TemplateView.as_view(template_name='grades.html')),          # Akademik
    path('hafalan/', TemplateView.as_view(template_name='hafalan.html'), name='hafalan'),
    path('evaluations/', TemplateView.as_view(template_name='evaluations.html')),
    path('registration/', TemplateView.as_view(template_name='registration.html')),
    path('finance/', TemplateView.as_view(template_name='finance.html')),        # Tagihan
    path('users/', TemplateView.as_view(template_name='users.html')),

    # ==========================================
    # NEW MODULE PAGES (for 7-menu structure)
    # ==========================================
    path('ibadah/', TemplateView.as_view(template_name='ibadah.html')),          # Ibadah/Sholat tracking
    path('blp/', TemplateView.as_view(template_name='evaluations.html')),        # Karakter/BLP

    # ==========================================
    # HR MODULE (Asatidz/Employee)
    # ==========================================
    path('evaluasi-asatidz/', TemplateView.as_view(template_name='evaluasi-asatidz.html')),  # Evaluasi Asatidz
    path('jurnal-piket/', TemplateView.as_view(template_name='jurnal-piket.html')),  # Jurnal Piket
    path('titipan-tugas/', TemplateView.as_view(template_name='titipan-tugas.html')),  # Titipan Tugas
    path('izin-guru/', TemplateView.as_view(template_name='izin-guru.html')),  # Izin Guru

    # ==========================================
    # WALI KELAS
    # ==========================================
    path('kelas-saya/', TemplateView.as_view(template_name='kelas-saya.html')),  # Wali Kelas Dashboard

    # ==========================================
    # JADWAL MENGAJAR (Admin)
    # ==========================================
    path('jadwal-mengajar/', TemplateView.as_view(template_name='jadwal-mengajar.html')),
    path('master-mapel/', TemplateView.as_view(template_name='master-mapel.html')),

    # ==========================================
    # ADMIN
    # ==========================================
    path('admin/', admin.site.urls),

    # ==========================================
    # API ROUTES
    # ==========================================
    path('api/core/', include('apps.core.urls')),  # Master Data (Tahun Ajaran)
    path('api/auth/', include('apps.accounts.urls')),
    path('api/users/', include('apps.accounts.urls_users')),
    path('api/students/', include('apps.students.urls')),
    path('api/schedules/', include('apps.students.urls_schedules')),
    path('api/jadwal/', include('apps.students.urls_jadwal')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/grades/', include('apps.grades.urls')),
    path('api/evaluations/', include('apps.evaluations.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/upload/', include('apps.evaluations.urls_upload')),
    path('api/registration/', include('apps.registration.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/kesantrian/', include('apps.kesantrian.urls')),
    path('api/admin/', include('apps.accounts.urls_admin')),
]

# Serve media files (uploads) - works for both DEBUG and production
# For PythonAnywhere production, also configure static files in Web tab
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
