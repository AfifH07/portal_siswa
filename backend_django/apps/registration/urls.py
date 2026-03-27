from django.urls import path
from . import views

urlpatterns = [
    path('', views.RegistrationView.as_view(), name='registration'),
    path('list/', views.RegistrationListView.as_view(), name='registration-list'),
    path('<int:pk>/review/', views.RegistrationReviewView.as_view(), name='registration-review'),
]
