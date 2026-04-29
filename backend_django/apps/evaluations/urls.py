from django.urls import path
from . import views

urlpatterns = [
    path('', views.EvaluationViewSet.as_view({'get': 'list', 'post': 'create'}), name='evaluation_list'),
    path('<int:pk>/', views.EvaluationViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='evaluation_detail'),
    path('student/<str:nisn>/', views.get_student_evaluations, name='student_evaluations'),
    path('all/', views.get_all_evaluations, name='all_evaluations'),
    path('statistics/', views.evaluation_statistics, name='evaluation_statistics'),

    # PERUBAHAN 4: Approval endpoints
    path('<int:pk>/approve/', views.approve_evaluation, name='approve_evaluation'),
    path('<int:pk>/unapprove/', views.unapprove_evaluation, name='unapprove_evaluation'),

    # PERUBAHAN 5: Comment/Tanggapan endpoints
    path('<int:evaluation_id>/comments/', views.evaluation_comments, name='evaluation_comments'),
    path('comments/<int:comment_id>/', views.delete_comment, name='delete_comment'),
]
