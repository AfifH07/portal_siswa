from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from apps.dashboard.views import unified_dashboard
from apps.kesantrian.views import hafalan_view

urlpatterns = [
    # ==========================================
    # FRONTEND ROUTES (TemplateView)
    # ==========================================
    path('login/', TemplateView.as_view(template_name='login.html')),
    path('forgot-password/', TemplateView.as_view(template_name='forgot-password.html')),
    path('', TemplateView.as_view(template_name='index.html')),

    # ==========================================
    # DASHBOARD ROUTES (Role-based templates)
    # ==========================================
    path('dashboard/', unified_dashboard, name='dashboard'),
    path('dashboard/admin/', TemplateView.as_view(template_name='dashboard.html'), name='dashboard-admin'),
    path('dashboard/parent/', TemplateView.as_view(template_name='dashboard-parent.html'), name='dashboard-parent'),
    path('dashboard/ustadz/', TemplateView.as_view(template_name='dashboard-ustadz.html'), name='dashboard-ustadz'),

    # ==========================================
    # MODULE PAGES
    # ==========================================
    path('students/', TemplateView.as_view(template_name='students.html')),
    path('attendance/', TemplateView.as_view(template_name='attendance.html')),  # Presensi
    path('grades/', TemplateView.as_view(template_name='grades.html')),          # Akademik
    path('hafalan/', hafalan_view, name='hafalan'),
    path('hafalan/manager/', TemplateView.as_view(template_name='kesantrian/hafalan-dashboard.html'), name='hafalan-manager'),
    path('hafalan/view/', TemplateView.as_view(template_name='hafalan.html'), name='hafalan-view'),
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
