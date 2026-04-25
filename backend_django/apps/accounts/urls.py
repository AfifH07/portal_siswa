from django.urls import path
from . import views

urlpatterns = [
    path('csrf/', views.get_csrf_token, name='get_csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('status/', views.auth_status_view, name='auth_status'),  # NEW: Role verification endpoint
    path('change-password/', views.change_password_view, name='change_password'),
    path('request-reset/', views.request_reset_view, name='request_reset'),
    path('reset-password/', views.reset_password_view, name='reset_password'),
    path('token/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),

    # Wali Kelas endpoints
    path('my-wali-kelas/', views.my_wali_kelas_status, name='my_wali_kelas'),
    path('kelas-saya/overview/', views.kelas_overview, name='kelas_overview'),
    path('kelas-saya/students/', views.kelas_students, name='kelas_students'),
    path('kelas-saya/pembinaan/', views.kelas_pembinaan, name='kelas_pembinaan'),
    path('kelas-saya/catatan/', views.kelas_catatan, name='kelas_catatan'),
    path('kelas-saya/siswa/<str:nisn>/detail/', views.kelas_student_detail, name='kelas_student_detail'),
]
