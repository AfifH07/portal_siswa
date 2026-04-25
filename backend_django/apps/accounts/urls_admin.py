"""
Admin User Management URLs
==========================

Endpoints untuk Superadmin mengelola users dan assignments.
Base URL: /api/admin/
"""

from django.urls import path
from . import admin_views

urlpatterns = [
    # Dashboard stats
    path('stats/', admin_views.admin_stats, name='admin_stats'),

    # Assignments list (for jadwal-mengajar dropdown)
    path('assignments/', admin_views.admin_assignments_list, name='admin_assignments_list'),

    # User management
    path('users/', admin_views.admin_user_list, name='admin_user_list'),
    path('users/create/', admin_views.admin_user_create, name='admin_user_create'),
    path('users/<int:user_id>/', admin_views.admin_user_detail, name='admin_user_detail'),
    path('users/<int:user_id>/assign/', admin_views.admin_user_assign, name='admin_user_assign'),
    path('users/<int:user_id>/reset-password/', admin_views.admin_reset_password, name='admin_reset_password'),
    path('users/<int:user_id>/activate/', admin_views.admin_activate_user, name='admin_activate_user'),
    path('users/<int:user_id>/assignments/', admin_views.admin_user_assignments, name='admin_user_assignments'),
    path('users/<int:user_id>/assignments/<int:assignment_id>/', admin_views.admin_delete_assignment, name='admin_delete_assignment'),

    # Bulk operations
    path('bulk-assign/', admin_views.admin_bulk_assign, name='admin_bulk_assign'),

    # Activity log
    path('activities/', admin_views.admin_activity_log, name='admin_activity_log'),

    # Options for forms
    path('halaqoh-options/', admin_views.admin_halaqoh_options, name='admin_halaqoh_options'),
]
