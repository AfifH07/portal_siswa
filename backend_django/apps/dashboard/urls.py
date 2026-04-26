from django.urls import path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    # Main dashboard (redirects based on role)
    path('', TemplateView.as_view(template_name='dashboard.html'), name='dashboard'),

    # Role-specific dashboards (Bento UI v2.3)
    path('parent/', TemplateView.as_view(template_name='dashboard-parent.html'), name='dashboard_parent'),
    path('ustadz/', TemplateView.as_view(template_name='dashboard-ustadz.html'), name='dashboard_ustadz'),

    # Dashboard API endpoints
    path('api/', views.dashboard_api, name='dashboard_api'),
    path('stats/', views.dashboard_stats, name='dashboard_stats'),
    path('attendance-chart/', views.attendance_chart_data, name='attendance_chart'),
    path('grades-distribution/', views.grades_distribution_data, name='grades_distribution'),
    path('progress-tracking/', views.progress_tracking_data, name='progress_tracking'),
    path('recent-activity/', views.recent_activity_data, name='recent_activity'),

    # Parent dashboard specific API
    path('parent/summary/', views.parent_dashboard_summary, name='parent_dashboard_summary'),

    # Ustadz dashboard specific API
    path('ustadz/summary/', views.ustadz_dashboard_summary, name='ustadz_dashboard_summary'),

    # Guru Today Dashboard API
    path('guru-today/', views.guru_today_dashboard, name='guru_today_dashboard'),

    # Guru TODO List API
    path('guru/todo-list/', views.guru_todo_list, name='guru_todo_list'),
]
