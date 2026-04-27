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
    MasterMapelListView,
    MasterMapelDetailView,
    MasterMapelGroupedView,
    MasterMapelBySesiView,
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

    # Master Mapel - CRUD
    path('master-mapel/', MasterMapelListView.as_view(), name='master-mapel-list'),
    path('master-mapel/grouped/', MasterMapelGroupedView.as_view(), name='master-mapel-grouped'),
    path('master-mapel/by-sesi/', MasterMapelBySesiView.as_view(), name='master-mapel-by-sesi'),
    path('master-mapel/<int:pk>/', MasterMapelDetailView.as_view(), name='master-mapel-detail'),
]
