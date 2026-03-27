"""
Finance URLs - Portal Ponpes Baron
===================================

API Endpoints:
- /api/finance/tarif/                  - CRUD Tarif
- /api/finance/tagihan/                - CRUD Tagihan
- /api/finance/tagihan/summary/        - Summary per siswa
- /api/finance/tagihan/generate_bulk/  - Generate tagihan massal
- /api/finance/pembayaran/             - CRUD Pembayaran
- /api/finance/pembayaran/{id}/verify/ - Verifikasi pembayaran
- /api/finance/pembayaran/pending/     - Pembayaran belum verifikasi
- /api/finance/statistics/             - Statistik keuangan
- /api/finance/student/{nisn}/         - Summary per siswa (walisantri access)
- /api/finance/generate-spp/           - Generate SPP bulanan otomatis
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tarif', views.TarifViewSet, basename='tarif')
router.register(r'tagihan', views.TagihanViewSet, basename='tagihan')
router.register(r'pembayaran', views.PembayaranViewSet, basename='pembayaran')

urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),

    # Statistics
    path('statistics/', views.finance_statistics, name='finance_statistics'),

    # Student summary (for walisantri)
    path('student/<str:nisn>/', views.student_finance_summary, name='student_finance_summary'),

    # Automated generation
    path('generate-spp/', views.generate_monthly_spp, name='generate_monthly_spp'),
]
