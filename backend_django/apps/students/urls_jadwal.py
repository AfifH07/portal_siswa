from django.urls import path
from . import views

urlpatterns = [
    # GET /api/jadwal/guru/<username>/ - Jadwal mingguan guru
    path('guru/<str:username>/', views.jadwal_guru_mingguan, name='jadwal_guru_mingguan'),
]
