from django.urls import path
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer
from apps.accounts.permissions import IsSuperAdmin


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
    path('', UserListCreateView.as_view(), name='user_list'),
    path('<username>/', UserDetailView.as_view(), name='user_detail'),
]
