from django.urls import path
from . import views

urlpatterns = [
    path('classes/', views.get_distinct_classes, name='classes'),
    path('', views.StudentListView.as_view(), name='student_list'),
    path('<nisn>/', views.StudentDetailView.as_view(), name='student_detail'),
]
