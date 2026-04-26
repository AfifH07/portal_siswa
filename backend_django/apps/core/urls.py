"""
Core URLs - Master Data API
Portal Ponpes Baron v2.3.3
"""

from django.urls import path
from .views import (
    ActiveTahunAjaranView,
    TahunAjaranListCreateView,
    TahunAjaranDetailView,
    MasterJamListView,
)

app_name = 'core'

urlpatterns = [
    # Active Tahun Ajaran - GET only
    path('tahun-ajaran/active/', ActiveTahunAjaranView.as_view(), name='tahun-ajaran-active'),

    # Tahun Ajaran CRUD
    path('tahun-ajaran/', TahunAjaranListCreateView.as_view(), name='tahun-ajaran-list'),
    path('tahun-ajaran/<int:pk>/', TahunAjaranDetailView.as_view(), name='tahun-ajaran-detail'),

    # Master Jam - GET list grouped by sesi
    path('master-jam/', MasterJamListView.as_view(), name='master-jam-list'),
]
