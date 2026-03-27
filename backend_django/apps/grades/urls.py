from django.urls import path
from . import views

urlpatterns = [
    path('', views.GradeViewSet.as_view({'get': 'list', 'post': 'create'}), name='grade-list'),
    path('statistics/', views.get_statistics, name='grade-statistics'),
    path('<int:pk>/', views.GradeViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='grade-detail'),
    path('average/<str:nisn>/', views.get_average_grade, name='average-grade'),
    path('my-child/', views.get_my_child_grades, name='my-child-grades'),  # Walisantri endpoint
    path('class/<str:kelas>/', views.get_class_grades, name='class-grades'),
    path('all/', views.get_all_grades, name='all-grades'),
    path('classes/', views.get_classes, name='get-classes'),
    path('mata-pelajaran/', views.get_mata_pelajaran, name='get-mata-pelajaran'),
    path('import/', views.import_excel_grades, name='import-excel-grades'),
    path('generate-template/', views.generate_template, name='generate-template'),
    path('import-v2/', views.import_grades_v2, name='import-grades-v2'),
]
