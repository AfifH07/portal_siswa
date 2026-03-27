from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from datetime import timedelta

from .models import User, ResetToken
from .serializers import (
    LoginSerializer, ChangePasswordSerializer,
    RequestResetSerializer, ResetPasswordSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer
)
from .utils import generate_token, normalize_nisn
from .permissions import IsSuperAdmin, IsPimpinan, IsGuru
from .throttles import LoginRateThrottle, PasswordResetRateThrottle


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
@throttle_classes([])  # Exempt from throttling - CSRF is needed for all form submissions
def get_csrf_token(request):
    return Response({'detail': 'CSRF cookie set'})


@api_view(['POST'])
@authentication_classes([SessionAuthentication])  # Enforces CSRF validation
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        
        response_data = {
            'success': True,
            'access': access_token,
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'redirect': get_redirect_url(user.role)
        }
        
        return Response(response_data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def get_redirect_url(role):
    """
    Get redirect URL after login based on role.
    Uses single /dashboard/ entry point with role query param
    for dynamic template rendering.
    """
    if role == 'pendaftar':
        return '/registration'

    # All roles go to /dashboard/ with role param for dynamic rendering
    return f'/dashboard/?role={role}'


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        new_password = serializer.validated_data.get('new_password')

        # SECURITY: Validate user can only change their own password
        # unless they are a superadmin
        if request.user.username != username and request.user.role != 'superadmin':
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk mengubah password pengguna lain!'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Pengguna tidak ditemukan!'
            }, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save()

        return Response({'success': True, 'message': 'Password berhasil diubah!'})
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([SessionAuthentication])  # Enforces CSRF validation
@permission_classes([permissions.AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def request_reset_view(request):
    serializer = RequestResetSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Return generic message to prevent username enumeration
            return Response({
                'success': True,
                'message': 'Jika username terdaftar, token reset akan dikirim ke kontak terdaftar.'
            })

        token = generate_token()
        ResetToken.objects.create(username=username, token=token)

        # Send email with reset token
        import logging
        from django.core.mail import send_mail
        from django.conf import settings

        logger = logging.getLogger(__name__)
        logger.info(f'Password reset token generated for user: {username}')

        # Attempt to send email if user has email configured
        email_sent = False
        if user.email:
            try:
                send_mail(
                    subject='Reset Password - Portal Ponpes Baron',
                    message=f'''Assalamu'alaikum {user.name},

Anda menerima email ini karena ada permintaan reset password untuk akun Anda di Portal Ponpes Baron.

Kode Verifikasi Anda: {token}

Kode ini berlaku selama 30 menit.

Jika Anda tidak meminta reset password, abaikan email ini.

Wassalamu'alaikum,
Tim Portal Ponpes Baron''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                email_sent = True
                logger.info(f'Password reset email sent to: {user.email}')
            except Exception as e:
                logger.error(f'Failed to send password reset email: {str(e)}')

        # Log token for admin retrieval if email fails or not configured
        if not email_sent:
            logger.warning(f'Email not sent for {username}. Token: {token} (admin retrieval)')

        return Response({
            'success': True,
            'message': 'Token reset password telah dikirim ke kontak terdaftar.' if email_sent else 'Token reset telah dibuat. Hubungi admin untuk mendapatkan token.'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([SessionAuthentication])  # Enforces CSRF validation
@permission_classes([permissions.AllowAny])
@throttle_classes([PasswordResetRateThrottle])
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        BlacklistedToken.objects.create(
            token=str(token),
            user=request.user
        )
        return Response({'success': True, 'message': 'Logout berhasil'})
    except Exception as e:
        return Response({'success': False, 'message': 'Logout gagal'}, status=status.HTTP_400_BAD_REQUEST)


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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_user_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auth_status_view(request):
    """
    Endpoint untuk frontend memverifikasi bahwa role di LocalStorage
    masih sinkron dengan database.

    Returns:
        - valid: boolean (apakah user masih aktif)
        - role: string (role terkini dari database)
        - user_id: int
        - username: string
        - permissions: list (daftar permission berdasarkan role)
    """
    user = request.user

    # Daftar permission berdasarkan role
    role_permissions = {
        'superadmin': ['create', 'read', 'update', 'delete', 'view_all', 'manage_users', 'manage_finance'],
        'pimpinan': ['read', 'update', 'view_all', 'approve', 'view_finance'],
        'guru': ['create', 'read', 'update', 'view_class'],
        'bendahara': ['create', 'read', 'update', 'view_finance', 'manage_finance'],
        'walisantri': ['read', 'view_child', 'view_finance'],
        'pendaftar': ['register', 'view_registration']
    }

    # Daftar halaman yang diizinkan berdasarkan role
    role_allowed_pages = {
        'superadmin': ['/', '/dashboard', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/registration', '/finance', '/users', '/blp', '/inval', '/ibadah', '/case-management', '/evaluasi-asatidz'],
        'pimpinan': ['/', '/dashboard', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/finance', '/blp', '/ibadah', '/case-management', '/evaluasi-asatidz'],
        'guru': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/blp', '/inval', '/case-management', '/evaluasi-asatidz'],
        'musyrif': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/blp', '/inval', '/case-management', '/evaluasi-asatidz'],
        'wali_kelas': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/case-management', '/evaluasi-asatidz'],
        'bk': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/grades', '/hafalan', '/evaluations', '/case-management', '/evaluasi-asatidz'],
        'bendahara': ['/', '/dashboard', '/finance'],
        'walisantri': ['/', '/dashboard', '/dashboard/parent', '/attendance', '/grades', '/hafalan', '/evaluations', '/finance', '/ibadah', '/blp', '/case-management'],
        'pendaftar': ['/registration']
    }

    return Response({
        'valid': user.is_active,
        'user_id': user.id,
        'username': user.username,
        'name': user.name,
        'role': user.role,
        'kelas': user.kelas,
        'linked_student_nisn': user.linked_student_nisn,
        'permissions': role_permissions.get(user.role, []),
        'allowed_pages': role_allowed_pages.get(user.role, []),
        'is_staff': user.role in ['superadmin', 'pimpinan', 'guru', 'bendahara'],
        'timestamp': timezone.now().isoformat()
    })


# ============================================
# USER ASSIGNMENTS API
# ============================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_assignments_view(request, user_id):
    """
    Get assignments for a specific user.

    Users can view their own assignments.
    Admins can view any user's assignments.

    Returns empty array [] as safe fallback if any error occurs.
    """
    try:
        user = request.user

        # Check permissions
        if user.id != user_id and user.role not in ['superadmin', 'pimpinan']:
            return Response({
                'success': False,
                'message': 'Anda hanya dapat melihat penugasan Anda sendiri'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)

        from .models import Assignment

        assignments = Assignment.objects.filter(user=target_user).values(
            'id', 'assignment_type', 'kelas', 'mata_pelajaran',
            'halaqoh_id', 'hari', 'jam_mulai', 'jam_selesai',
            'periode_mulai', 'periode_selesai', 'status', 'metadata'
        )

        # Add display labels
        type_displays = {
            'kbm': 'KBM (Kegiatan Belajar Mengajar)',
            'diniyah': 'Diniyah',
            'halaqoh': 'Halaqoh Tahfidz/Tahsin',
            'piket': 'Piket Harian',
            'wali_kelas': 'Wali Kelas',
        }

        result = []
        for a in assignments:
            a['assignment_type_display'] = type_displays.get(a['assignment_type'], a['assignment_type'])
            result.append(a)

        return Response(result)

    except Exception as e:
        # Safe fallback - return empty array instead of 500 error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[user_assignments_view] Error for user_id={user_id}: {str(e)}")
        print(f"[user_assignments_view] Error: {e}")
        return Response([], status=status.HTTP_200_OK)
