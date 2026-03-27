from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.StudentViewSet, basename='student')

urlpatterns = [
    # Utility endpoints (before router)
    path('classes/', views.get_distinct_classes, name='classes'),
    path('statistics/', views.StudentViewSet.as_view({'get': 'statistics'}), name='student_statistics'),
    path('import/', views.import_students_view, name='import_students'),
    path('bulk-update-class/', views.bulk_update_class, name='bulk_update_class'),
    path('download-template/', views.download_import_template, name='download_import_template'),

    # ============================================
    # ALUMNI MANAGEMENT ENDPOINTS
    # ============================================
    path('alumni/', views.alumni_list, name='alumni_list'),
    path('alumni/statistics/', views.alumni_statistics, name='alumni_statistics'),
    path('alumni/<str:nisn>/', views.alumni_detail, name='alumni_detail'),
    path('alumni/<str:nisn>/update/', views.update_alumni_info, name='update_alumni_info'),
    path('set-alumni/', views.set_alumni_status, name='set_alumni'),
    path('bulk-set-alumni/', views.bulk_set_alumni, name='bulk_set_alumni'),
    path('reactivate/', views.reactivate_student, name='reactivate_student'),

    # Router (CRUD for students - keep at end)
    path('', include(router.urls)),
]
