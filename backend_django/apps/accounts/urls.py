from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('change-password/', views.change_password_view, name='change_password'),
    path('request-reset/', views.request_reset_view, name='request_reset'),
    path('reset-password/', views.reset_password_view, name='reset_password'),
    path('token/refresh/', views.TokenRefreshView.as_view(), name='token_refresh'),
]
