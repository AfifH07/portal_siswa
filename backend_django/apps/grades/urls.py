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
    # Input Nilai Manual
    path('my-classes/', views.get_my_teaching_classes, name='my-teaching-classes'),
    path('students/<str:kelas>/', views.get_students_by_class, name='students-by-class'),
    path('input-batch/', views.input_batch_grades, name='input-batch-grades'),
    path('mapel-list/', views.get_mapel_list, name='mapel-list'),
]
