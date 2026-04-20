from django.urls import path
from . import views

urlpatterns = [
    path('jurnal-piket/', views.jurnal_piket, name='jurnal_piket'),
    path('initialize/', views.initialize_attendance, name='initialize_attendance'),
    path('batch/', views.save_batch_attendance, name='save_batch_attendance'),
    path('today/<str:nisn>/', views.get_today_attendance, name='today_attendance'),
    path('monthly/<str:nisn>/<str:month>/<str:year>/', views.get_monthly_attendance, name='monthly_attendance'),
    path('stats/<str:nisn>/', views.get_attendance_stats, name='attendance_stats'),
    path('class/<str:kelas>/<str:tanggal>/', views.get_class_attendance, name='class_attendance'),
    path('all/', views.get_all_attendance, name='all_attendance'),
    path('history/', views.get_attendance_history, name='attendance_history'),
    path('', views.AttendanceViewSet.as_view({'get': 'list', 'post': 'create'}), name='attendance-list'),
    path('<str:pk>/', views.AttendanceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='attendance-detail'),
]
