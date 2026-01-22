from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta

from .models import User, ResetToken
from .serializers import (
    LoginSerializer, ChangePasswordSerializer,
    RequestResetSerializer, ResetPasswordSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer
)
from .utils import generate_token, normalize_nisn
from .permissions import IsSuperAdmin, IsAdmin


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        
        # Get student info if user is a student
        kelas = '-'
        program = '-'
        if user.role == 'user' and user.nisn:
            from apps.students.models import Student
            try:
                student = Student.objects.get(nisn=normalize_nisn(user.nisn))
                kelas = student.kelas or '-'
                program = student.program or '-'
            except Student.DoesNotExist:
                pass
        
        return Response({
            'success': True,
            'token': access_token,
            'refresh': str(refresh),
            'username': user.username,
            'name': user.name,
            'role': user.role,
            'nisn': user.nisn,
            'email': user.email,
            'kelas': kelas,
            'program': program
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        new_password = serializer.validated_data.get('new_password')
        
        user = User.objects.get(username=username)
        user.set_password(new_password)
        user.save()
        
        return Response({'success': True, 'message': 'Password berhasil diubah!'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def request_reset_view(request):
    serializer = RequestResetSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        user = User.objects.get(username=username)
        token = generate_token()
        
        ResetToken.objects.create(username=username, token=token)
        
        return Response({
            'success': True,
            'message': 'Token reset password telah dibuat!',
            'token': token,
            'name': user.name
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password_view(request):
    from django.conf import settings
    serializer = ResetPasswordSerializer(data=request.data)
    
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        token = serializer.validated_data.get('token')
        new_password = serializer.validated_data.get('new_password')
        
        try:
            reset_token = ResetToken.objects.get(
                username=username,
                token=token,
                status='Active'
            )
            
            # Check if token is expired (30 minutes)
            expiry_minutes = 30
            if (timezone.now() - reset_token.created_at).total_seconds() > expiry_minutes * 60:
                return Response({
                    'success': False,
                    'message': 'Token sudah kadaluarsa!'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Reset password
            user = User.objects.get(username=username)
            user.set_password(new_password)
            user.save()
            
            # Mark token as used
            reset_token.status = 'Used'
            reset_token.save()
            
            return Response({'success': True, 'message': 'Password berhasil direset!'})
            
        except ResetToken.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Token tidak valid atau sudah digunakan!'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsSuperAdmin]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    lookup_field = 'username'
    permission_classes = [IsSuperAdmin]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer
