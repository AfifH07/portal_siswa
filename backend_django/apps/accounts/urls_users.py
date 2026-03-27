from django.urls import path
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import permissions
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer
from apps.accounts.permissions import IsSuperAdmin
from . import views

class UserListCreateView(ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

class UserDetailView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    lookup_field = 'username'
    permission_classes = [IsSuperAdmin]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

urlpatterns = [
    # IMPORTANT: 'me/' must be before '<str:username>/' to avoid being matched as a username
    path('me/', views.current_user_view, name='current_user'),
    path('', UserListCreateView.as_view(), name='user_list'),

    # User assignments (Bento Dashboard v2.3)
    path('<int:user_id>/assignments/', views.user_assignments_view, name='user_assignments'),

    path('<str:username>/', UserDetailView.as_view(), name='user_detail'),
]
