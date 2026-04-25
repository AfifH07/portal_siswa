from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from datetime import timedelta

from .models import User, ResetToken, Assignment, CatatanKelas
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


import logging
logger = logging.getLogger(__name__)


@api_view(['POST'])
@authentication_classes([SessionAuthentication])  # Enforces CSRF validation
@permission_classes([permissions.AllowAny])
@throttle_classes([PasswordResetRateThrottle])
def request_reset_view(request):
    """
    Request password reset token.
    Sends email if configured, otherwise logs token for admin retrieval.
    NEVER crashes - always returns a graceful response.
    """
    try:
        serializer = RequestResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data.get('username')

        # Check if user exists (generic response to prevent enumeration)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            logger.info(f'Password reset requested for non-existent user: {username}')
            return Response({
                'success': True,
                'message': 'Jika username terdaftar, token reset akan dikirim ke kontak terdaftar.'
            })

        # Generate and store token
        token = generate_token()
        ResetToken.objects.create(username=username, token=token)
        logger.info(f'Password reset token generated for user: {username}')

        # Attempt to send email
        email_sent = False
        email_error = None

        # Check if email is configured before attempting to send
        from django.conf import settings as django_settings

        email_host_user = getattr(django_settings, 'EMAIL_HOST_USER', '')
        email_configured = bool(email_host_user and email_host_user.strip())

        if user.email and email_configured:
            try:
                from django.core.mail import send_mail

                # Safely get email settings with defaults
                from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@pesantrenbaron.ac.id')

                send_mail(
                    subject='Reset Password - Portal Ponpes Baron',
                    message=f'''Assalamu'alaikum {user.name},

Anda menerima email ini karena ada permintaan reset password untuk akun Anda di Portal Ponpes Baron.

Kode Verifikasi Anda: {token}

Kode ini berlaku selama 30 menit.

Jika Anda tidak meminta reset password, abaikan email ini.

Wassalamu'alaikum,
Tim Portal Ponpes Baron''',
                    from_email=from_email,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                email_sent = True
                logger.info(f'Password reset email sent successfully to: {user.email}')

            except Exception as e:
                email_error = str(e)
                logger.error(f'Failed to send password reset email to {user.email}: {email_error}')
        elif not email_configured:
            logger.warning(f'Email not configured (EMAIL_HOST_USER empty). Token for {username}: {token}')
        elif not user.email:
            logger.warning(f'User {username} has no email address. Token: {token}')

        # Always return success to prevent username enumeration
        if email_sent:
            message = 'Token reset password telah dikirim ke email terdaftar.'
        elif not email_configured:
            message = 'Token reset telah dibuat. Hubungi admin sekolah untuk mendapatkan kode verifikasi.'
        else:
            message = 'Token reset telah dibuat. Hubungi admin untuk mendapatkan token.'

        return Response({
            'success': True,
            'message': message
        })

    except Exception as e:
        # Catch-all for any unexpected errors - NEVER return 500
        logger.exception(f'Unexpected error in password reset: {str(e)}')
        return Response({
            'success': False,
            'message': 'Terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        'superadmin': ['/', '/dashboard', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/grades', '/hafalan', '/evaluations', '/registration', '/finance', '/users', '/blp', '/inval', '/ibadah', '/case-management', '/evaluasi-asatidz'],
        'pimpinan': ['/', '/dashboard', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/grades', '/hafalan', '/evaluations', '/finance', '/blp', '/ibadah', '/case-management', '/evaluasi-asatidz'],
        'guru': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/grades', '/hafalan', '/evaluations', '/blp', '/inval', '/case-management', '/evaluasi-asatidz'],
        'musyrif': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/grades', '/hafalan', '/evaluations', '/blp', '/inval', '/case-management', '/evaluasi-asatidz'],
        'bk': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/grades', '/hafalan', '/evaluations', '/case-management', '/evaluasi-asatidz'],
        'bendahara': ['/', '/dashboard', '/jurnal-piket', '/finance'],
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
            'halaqoh_id', 'hari', 'tahun_ajaran', 'semester', 'status', 'catatan'
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


# =============================================================
# WALI KELAS ENDPOINTS
# =============================================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_wali_kelas_status(request):
    """
    GET /api/accounts/my-wali-kelas/
    Check if current user is a wali kelas for any class.
    Returns assignment info if yes, or is_wali_kelas=false if not.
    """
    user = request.user

    # Only guru can be wali kelas
    if user.role != 'guru':
        return Response({
            'success': True,
            'is_wali_kelas': False,
            'message': 'Hanya guru yang bisa menjadi wali kelas'
        })

    # Get active tahun ajaran
    from apps.core.models import TahunAjaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

    if not tahun_ajaran:
        return Response({
            'success': True,
            'is_wali_kelas': False,
            'message': 'Tidak ada tahun ajaran aktif'
        })

    # Check for wali_kelas assignment
    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if assignment:
        return Response({
            'success': True,
            'is_wali_kelas': True,
            'kelas': assignment.kelas,
            'tahun_ajaran': tahun_ajaran.nama,
            'semester': tahun_ajaran.semester,
            'assignment_id': assignment.id
        })
    else:
        return Response({
            'success': True,
            'is_wali_kelas': False
        })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def kelas_overview(request):
    """
    GET /api/accounts/kelas-saya/overview/
    Get overview stats for wali kelas's class.
    """
    user = request.user

    # Check wali kelas status
    from apps.core.models import TahunAjaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

    if not tahun_ajaran:
        return Response({
            'success': False,
            'message': 'Tidak ada tahun ajaran aktif'
        }, status=status.HTTP_400_BAD_REQUEST)

    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if not assignment:
        return Response({
            'success': False,
            'message': 'Anda bukan wali kelas aktif'
        }, status=status.HTTP_403_FORBIDDEN)

    kelas = assignment.kelas

    # Get class stats
    from apps.students.models import Student
    from apps.grades.models import Grade
    from apps.attendance.models import Attendance
    from apps.evaluations.models import Evaluation
    from django.db.models import Avg, Count, Q
    from datetime import date, timedelta

    # Total students
    students = Student.objects.filter(kelas=kelas, aktif=True)
    total_siswa = students.count()

    # Average grade (current semester)
    avg_nilai = Grade.objects.filter(
        kelas=kelas,
        semester=tahun_ajaran.semester,
        tahun_ajaran=tahun_ajaran.nama
    ).aggregate(avg=Avg('nilai'))['avg'] or 0

    # Attendance rate (last 30 days)
    thirty_days_ago = date.today() - timedelta(days=30)
    attendance_stats = Attendance.objects.filter(
        nisn__kelas=kelas,
        tanggal__gte=thirty_days_ago
    ).aggregate(
        total=Count('id'),
        hadir=Count('id', filter=Q(status='H'))
    )
    attendance_rate = 0
    if attendance_stats['total'] > 0:
        attendance_rate = round((attendance_stats['hadir'] / attendance_stats['total']) * 100, 1)

    # Evaluations count
    evaluations = Evaluation.objects.filter(nisn__kelas=kelas)
    prestasi_count = evaluations.filter(jenis='prestasi').count()
    pelanggaran_count = evaluations.filter(jenis='pelanggaran').count()

    # Students needing attention (with pelanggaran)
    siswa_perlu_perhatian = evaluations.filter(
        jenis='pelanggaran'
    ).values('nisn').distinct().count()

    return Response({
        'success': True,
        'kelas': kelas,
        'wali_kelas': user.name or user.username,
        'tahun_ajaran': tahun_ajaran.nama,
        'semester': tahun_ajaran.semester,
        'overview': {
            'total_siswa': total_siswa,
            'rata_rata_nilai': round(avg_nilai, 1),
            'persentase_kehadiran': attendance_rate,
            'total_prestasi': prestasi_count,
            'total_pelanggaran': pelanggaran_count,
            'siswa_perlu_perhatian': siswa_perlu_perhatian
        }
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def kelas_students(request):
    """
    GET /api/accounts/kelas-saya/students/
    Get all students in wali kelas's class with summary stats.
    """
    user = request.user

    from apps.core.models import TahunAjaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

    if not tahun_ajaran:
        return Response({'success': False, 'message': 'Tidak ada tahun ajaran aktif'}, status=400)

    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if not assignment:
        return Response({'success': False, 'message': 'Anda bukan wali kelas aktif'}, status=403)

    kelas = assignment.kelas

    from apps.students.models import Student
    from apps.grades.models import Grade
    from apps.evaluations.models import Evaluation
    from django.db.models import Avg, Count

    students = Student.objects.filter(kelas=kelas, aktif=True).order_by('nama')

    result = []
    for s in students:
        # Get average grade
        avg = Grade.objects.filter(
            nisn=s,
            semester=tahun_ajaran.semester,
            tahun_ajaran=tahun_ajaran.nama
        ).aggregate(avg=Avg('nilai'))['avg'] or 0

        # Get evaluation counts
        evals = Evaluation.objects.filter(nisn=s)
        prestasi = evals.filter(jenis='prestasi').count()
        pelanggaran = evals.filter(jenis='pelanggaran').count()

        result.append({
            'nisn': s.nisn,
            'nama': s.nama,
            'jenis_kelamin': s.jenis_kelamin,
            'rata_rata_nilai': round(avg, 1),
            'prestasi': prestasi,
            'pelanggaran': pelanggaran,
            'perlu_perhatian': pelanggaran > 0
        })

    return Response({
        'success': True,
        'kelas': kelas,
        'count': len(result),
        'students': result
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def kelas_pembinaan(request):
    """
    GET /api/accounts/kelas-saya/pembinaan/
    Get students needing attention (with violations).
    """
    user = request.user

    from apps.core.models import TahunAjaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

    if not tahun_ajaran:
        return Response({'success': False, 'message': 'Tidak ada tahun ajaran aktif'}, status=400)

    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if not assignment:
        return Response({'success': False, 'message': 'Anda bukan wali kelas aktif'}, status=403)

    kelas = assignment.kelas

    from apps.students.models import Student
    from apps.evaluations.models import Evaluation
    from django.db.models import Count

    # Get students with pelanggaran
    students_with_violations = Evaluation.objects.filter(
        nisn__kelas=kelas,
        jenis='pelanggaran'
    ).values(
        'nisn__nisn', 'nisn__nama'
    ).annotate(
        total_pelanggaran=Count('id')
    ).order_by('-total_pelanggaran')

    result = []
    for item in students_with_violations:
        # Get recent violations
        recent = Evaluation.objects.filter(
            nisn__nisn=item['nisn__nisn'],
            jenis='pelanggaran'
        ).order_by('-tanggal')[:3]

        result.append({
            'nisn': item['nisn__nisn'],
            'nama': item['nisn__nama'],
            'total_pelanggaran': item['total_pelanggaran'],
            'recent_violations': [
                {
                    'tanggal': str(v.tanggal),
                    'kategori': v.kategori,
                    'name': v.name,
                    'summary': v.summary[:100] if v.summary else ''
                }
                for v in recent
            ]
        })

    return Response({
        'success': True,
        'kelas': kelas,
        'count': len(result),
        'pembinaan': result
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def kelas_student_detail(request, nisn):
    """
    GET /api/auth/kelas-saya/siswa/<nisn>/detail/
    Get detailed info for a student in wali kelas's class.

    Returns:
    - profile: nama, nisn, jenis_kelamin, kelas
    - akademik: nilai rata-rata per mata pelajaran
    - kehadiran: persentase H/S/I/A bulan ini
    - evaluasi: total prestasi & pelanggaran + 5 riwayat terbaru
    - hafalan: progress juz (target vs tercapai)
    """
    user = request.user

    from apps.core.models import TahunAjaran
    from apps.students.models import Student
    from apps.grades.models import Grade
    from apps.attendance.models import Attendance
    from apps.evaluations.models import Evaluation
    from apps.kesantrian.models import TargetHafalan
    from django.db.models import Avg, Count, Q
    from datetime import date, timedelta

    # Get active tahun ajaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()
    if not tahun_ajaran:
        return Response({'success': False, 'message': 'Tidak ada tahun ajaran aktif'}, status=400)

    # Check wali kelas assignment
    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if not assignment:
        return Response({'success': False, 'message': 'Anda bukan wali kelas aktif'}, status=403)

    kelas = assignment.kelas

    # Get student - must be in wali kelas's class
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({'success': False, 'message': 'Siswa tidak ditemukan'}, status=404)

    if student.kelas != kelas:
        return Response({'success': False, 'message': 'Siswa bukan dari kelas Anda'}, status=403)

    # === 1. PROFILE ===
    profile = {
        'nisn': student.nisn,
        'nama': student.nama,
        'jenis_kelamin': student.jenis_kelamin,
        'kelas': student.kelas,
        'program': student.program,
    }

    # === 2. AKADEMIK - Rata-rata nilai per mata pelajaran ===
    grades = Grade.objects.filter(
        nisn=student,
        semester=tahun_ajaran.semester,
        tahun_ajaran=tahun_ajaran.nama
    ).values('mata_pelajaran').annotate(
        rata_rata=Avg('nilai'),
        jumlah=Count('id')
    ).order_by('mata_pelajaran')

    akademik = {
        'mata_pelajaran': [
            {
                'nama': g['mata_pelajaran'],
                'rata_rata': round(g['rata_rata'], 1) if g['rata_rata'] else 0,
                'jumlah_nilai': g['jumlah']
            }
            for g in grades
        ],
        'rata_rata_keseluruhan': round(
            Grade.objects.filter(
                nisn=student,
                semester=tahun_ajaran.semester,
                tahun_ajaran=tahun_ajaran.nama
            ).aggregate(avg=Avg('nilai'))['avg'] or 0, 1
        )
    }

    # === 3. KEHADIRAN - Persentase bulan ini ===
    today = date.today()
    first_day_of_month = today.replace(day=1)

    attendance_this_month = Attendance.objects.filter(
        nisn=student,
        tanggal__gte=first_day_of_month,
        tanggal__lte=today
    )

    total_attendance = attendance_this_month.count()
    hadir_count = attendance_this_month.filter(status='H').count()
    sakit_count = attendance_this_month.filter(status='S').count()
    izin_count = attendance_this_month.filter(status='I').count()
    alpha_count = attendance_this_month.filter(status='A').count()

    kehadiran = {
        'total_record': total_attendance,
        'hadir': hadir_count,
        'sakit': sakit_count,
        'izin': izin_count,
        'alpha': alpha_count,
        'persentase_hadir': round((hadir_count / total_attendance * 100), 1) if total_attendance > 0 else 0,
        'persentase_sakit': round((sakit_count / total_attendance * 100), 1) if total_attendance > 0 else 0,
        'persentase_izin': round((izin_count / total_attendance * 100), 1) if total_attendance > 0 else 0,
        'persentase_alpha': round((alpha_count / total_attendance * 100), 1) if total_attendance > 0 else 0,
    }

    # === 4. EVALUASI - Prestasi & Pelanggaran ===
    evaluations = Evaluation.objects.filter(nisn=student)
    prestasi_count = evaluations.filter(jenis='prestasi').count()
    pelanggaran_count = evaluations.filter(jenis='pelanggaran').count()

    # 5 riwayat terbaru
    recent_evaluations = evaluations.order_by('-tanggal', '-created_at')[:5]

    evaluasi = {
        'total_prestasi': prestasi_count,
        'total_pelanggaran': pelanggaran_count,
        'riwayat': [
            {
                'tanggal': str(e.tanggal),
                'jenis': e.jenis,
                'kategori': e.kategori,
                'name': e.name,
                'summary': e.summary[:150] if e.summary else '',
                'evaluator': e.evaluator
            }
            for e in recent_evaluations
        ]
    }

    # === 5. HAFALAN - Progress juz ===
    target_hafalan = TargetHafalan.objects.filter(
        siswa=student,
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if target_hafalan:
        hafalan = {
            'target_juz': float(target_hafalan.target_juz),
            'tercapai_juz': float(target_hafalan.tercapai_juz),
            'persentase': target_hafalan.persentase_tercapai,
            'catatan': target_hafalan.catatan
        }
    else:
        # Fallback to Student model fields
        hafalan = {
            'target_juz': float(student.target_hafalan) if student.target_hafalan else 0,
            'tercapai_juz': float(student.current_hafalan) if student.current_hafalan else 0,
            'persentase': round(
                (student.current_hafalan / student.target_hafalan * 100), 1
            ) if student.target_hafalan and student.target_hafalan > 0 else 0,
            'catatan': None
        }

    return Response({
        'success': True,
        'profile': profile,
        'akademik': akademik,
        'kehadiran': kehadiran,
        'evaluasi': evaluasi,
        'hafalan': hafalan
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def kelas_catatan(request):
    """
    GET /api/accounts/kelas-saya/catatan/
    POST /api/accounts/kelas-saya/catatan/
    Manage catatan kelas (wali kelas notes).
    """
    user = request.user

    from apps.core.models import TahunAjaran
    from .models import CatatanKelas

    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

    if not tahun_ajaran:
        return Response({'success': False, 'message': 'Tidak ada tahun ajaran aktif'}, status=400)

    assignment = Assignment.objects.filter(
        user=user,
        assignment_type='wali_kelas',
        status='active',
        tahun_ajaran=tahun_ajaran.nama,
        semester=tahun_ajaran.semester
    ).first()

    if not assignment:
        return Response({'success': False, 'message': 'Anda bukan wali kelas aktif'}, status=403)

    kelas = assignment.kelas

    if request.method == 'GET':
        catatan_list = CatatanKelas.objects.filter(
            kelas=kelas,
            tahun_ajaran=tahun_ajaran.nama,
            semester=tahun_ajaran.semester
        ).order_by('-tanggal', '-created_at')

        result = []
        for c in catatan_list:
            result.append({
                'id': c.id,
                'tanggal': str(c.tanggal),
                'kategori': c.kategori,
                'judul': c.judul,
                'isi': c.isi,
                'created_at': c.created_at.isoformat()
            })

        return Response({
            'success': True,
            'kelas': kelas,
            'count': len(result),
            'catatan': result
        })

    elif request.method == 'POST':
        data = request.data

        # Validate required fields
        if not data.get('judul') or not data.get('isi'):
            return Response({
                'success': False,
                'message': 'Judul dan isi catatan wajib diisi'
            }, status=400)

        from datetime import date

        catatan = CatatanKelas.objects.create(
            wali_kelas=user,
            kelas=kelas,
            tanggal=data.get('tanggal', date.today()),
            kategori=data.get('kategori', 'harian'),
            judul=data.get('judul'),
            isi=data.get('isi'),
            tahun_ajaran=tahun_ajaran.nama,
            semester=tahun_ajaran.semester
        )

        return Response({
            'success': True,
            'message': 'Catatan berhasil disimpan',
            'catatan': {
                'id': catatan.id,
                'tanggal': str(catatan.tanggal),
                'kategori': catatan.kategori,
                'judul': catatan.judul,
                'isi': catatan.isi
            }
        }, status=201)
