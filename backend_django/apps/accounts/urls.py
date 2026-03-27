from django.urls import path
from . import views

urlpatterns = [
    path('csrf/', views.get_csrf_token, name='get_csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('status/', views.auth_status_view, name='auth_status'),  # NEW: Role verification endpoint
    path('change-password/', views.change_password_view, name='change_password'),
    path('request-reset/', views.request_reset_view, name='request_reset'),
    path('reset-password/', views.reset_password_view, name='reset_password'),
    path('token/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),
]
