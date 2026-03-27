"""
Kesantrian URL Routes v2.3
==========================
Includes BLP (Character Monitoring) and Auto-Inval endpoints.
"""

from django.urls import path
from . import views

urlpatterns = [
    # ============================================
    # WALISANTRI ENDPOINTS
    # ============================================
    path('my-children-summary/', views.get_my_children_summary, name='my-children-summary'),

    # Student-specific endpoints
    path('ibadah/<str:nisn>/', views.get_child_ibadah_detail, name='child-ibadah-detail'),
    path('pembinaan/<str:nisn>/', views.get_child_pembinaan, name='child-pembinaan'),
    path('worship-tracker/<str:nisn>/', views.get_worship_tracker, name='worship-tracker'),

    # Recording endpoints (musyrif/guru)
    path('ibadah/record/', views.record_ibadah, name='record-ibadah'),
    path('ibadah/record-bulk/', views.record_ibadah_bulk, name='record-ibadah-bulk'),

    # ============================================
    # DUAL-CHART & PRINT ENGINE
    # ============================================
    path('chart-data/<str:nisn>/', views.get_chart_data, name='chart-data'),
    path('print-rapor/<str:nisn>/', views.get_rapor_data, name='print-rapor'),
    path('print-rapor-html/<str:nisn>/', views.get_rapor_html, name='print-rapor-html'),

    # Logic Engine - Behavior Summary
    path('behavior-summary/<str:nisn>/', views.get_behavior_summary, name='behavior-summary'),

    # Weighted Metrics API (v2)
    path('student-metrics/<str:nisn>/', views.get_student_metrics, name='student-metrics'),

    # ============================================
    # BLP (BUKU LAPANGAN PESANTREN) - 59 INDIKATOR
    # ============================================
    path('blp/indicators/', views.get_blp_indicators, name='blp-indicators'),
    path('blp/', views.blp_list_create, name='blp-list-create'),
    path('blp/<int:pk>/', views.blp_detail, name='blp-detail'),
    path('blp/<int:pk>/lock/', views.blp_lock, name='blp-lock'),
    path('blp/student/<str:nisn>/', views.blp_student_history, name='blp-student-history'),

    # ============================================
    # INVAL (AUTO-INVAL SYSTEM)
    # ============================================
    path('inval/', views.inval_list_create, name='inval-list-create'),
    path('inval/<int:pk>/', views.inval_detail, name='inval-detail'),
    path('inval/<int:pk>/verify/', views.inval_verify, name='inval-verify'),

    # ============================================
    # EMPLOYEE EVALUATION
    # ============================================
    path('employee-evaluations/', views.employee_evaluation_list, name='employee-evaluation-list'),
    path('employee-evaluations/user/<int:user_id>/', views.employee_evaluation_summary, name='employee-evaluation-summary'),

    # ============================================
    # PDF DOWNLOADS
    # ============================================
    path('download-rapor/<str:nisn>/', views.download_rapor_pdf, name='download-rapor-pdf'),
    path('download-blp/<str:nisn>/', views.download_blp_pdf, name='download-blp-pdf'),

    # ============================================
    # INCIDENT (CASE MANAGEMENT / CATATAN & BIMBINGAN)
    # ============================================
    path('incidents/summary/', views.incident_summary, name='incident-summary'),
    path('incidents/', views.incident_list_create, name='incident-list-create'),
    path('incidents/<int:pk>/', views.incident_detail, name='incident-detail'),
    path('incidents/<int:pk>/resolve/', views.incident_resolve, name='incident-resolve'),
    path('incidents/student/<str:nisn>/', views.incident_student_history, name='incident-student-history'),

    # Incident comments
    path('incidents/<int:incident_id>/comments/', views.incident_comments, name='incident-comments'),
    path('comments/<int:pk>/', views.incident_comment_detail, name='incident-comment-detail'),

    # ============================================
    # ASATIDZ EVALUATION (Evaluasi Ustadz/Karyawan)
    # ============================================
    path('asatidz/evaluations/', views.asatidz_evaluation_list_create, name='asatidz-evaluation-list-create'),
    path('asatidz/evaluations/summary/', views.asatidz_evaluation_summary, name='asatidz-evaluation-summary'),
    path('asatidz/evaluations/<int:pk>/', views.asatidz_evaluation_detail, name='asatidz-evaluation-detail'),
    path('asatidz/evaluations/ustadz/<int:ustadz_id>/', views.asatidz_evaluation_by_ustadz, name='asatidz-evaluation-by-ustadz'),

    # ============================================
    # PENILAIAN KINERJA (STAR RATING PERFORMANCE REVIEW)
    # ============================================
    # Indikator Kinerja (Master Data)
    path('penilaian-kinerja/indikator/', views.indikator_kinerja_list_create, name='indikator-kinerja-list-create'),
    path('penilaian-kinerja/indikator/<int:pk>/', views.indikator_kinerja_detail, name='indikator-kinerja-detail'),

    # Penilaian Kinerja
    path('penilaian-kinerja/', views.penilaian_kinerja_list_create, name='penilaian-kinerja-list-create'),
    path('penilaian-kinerja/summary/', views.penilaian_kinerja_summary, name='penilaian-kinerja-summary'),
    path('penilaian-kinerja/<int:pk>/', views.penilaian_kinerja_detail, name='penilaian-kinerja-detail'),
    path('penilaian-kinerja/<int:pk>/finalize/', views.penilaian_kinerja_finalize, name='penilaian-kinerja-finalize'),
    path('penilaian-kinerja/ustadz/<int:ustadz_id>/', views.penilaian_kinerja_by_ustadz, name='penilaian-kinerja-by-ustadz'),

    # ============================================
    # HAFALAN DASHBOARD (Manager View)
    # ============================================
    path('hafalan/dashboard-stats/', views.hafalan_dashboard_stats, name='hafalan-dashboard-stats'),
]
