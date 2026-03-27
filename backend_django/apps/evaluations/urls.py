from django.urls import path
from . import views

urlpatterns = [
    path('', views.EvaluationViewSet.as_view({'get': 'list', 'post': 'create'}), name='evaluation_list'),
    path('<int:pk>/', views.EvaluationViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='evaluation_detail'),
    path('student/<str:nisn>/', views.get_student_evaluations, name='student_evaluations'),
    path('all/', views.get_all_evaluations, name='all_evaluations'),
    path('statistics/', views.evaluation_statistics, name='evaluation_statistics'),
]
