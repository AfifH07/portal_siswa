"""
Admin User Management Views
===========================

Endpoints khusus untuk Superadmin mengelola users:
- GET  /api/admin/users/              - List semua users dengan filter & search
- POST /api/admin/users/create/       - Buat user baru
- GET  /api/admin/users/<id>/         - Detail user dengan assignments
- PATCH /api/admin/users/<id>/        - Update user
- DELETE /api/admin/users/<id>/       - Soft delete (deactivate) user
- PATCH /api/admin/users/<id>/assign/ - Assign tugas ke user
- POST /api/admin/users/<id>/reset-password/ - Reset password user
- GET  /api/admin/users/<id>/assignments/    - List assignments user
- DELETE /api/admin/users/<id>/assignments/<aid>/ - Hapus assignment
- GET  /api/admin/activities/         - Activity log
- GET  /api/admin/halaqoh-options/    - List halaqoh untuk dropdown
"""

from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count
from django.utils import timezone

from .models import User, Assignment, UserActivity
from .serializers import (
    AdminUserSerializer, AdminUserCreateSerializer, AdminUserUpdateSerializer,
    AssignmentSerializer, AssignmentCreateSerializer,
    PasswordResetByAdminSerializer, UserAssignSerializer,
    UserActivitySerializer, BulkAssignSerializer
)
from .permissions import IsSuperAdmin


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def log_activity(user, target_user, action, details=None, request=None):
    """Helper untuk mencatat aktivitas user management"""
    ip_address = None
    user_agent = None

    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]

    UserActivity.objects.create(
        user=user,
        target_user=target_user,
        action=action,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent
    )


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def admin_user_list(request):
    """
    GET /api/admin/users/

    List semua users dengan filter dan search.

    Query params:
    - search: Search by username, name, email
    - role: Filter by role (guru, walisantri, etc)
    - status: Filter by is_active (active, inactive, all)
    - has_assignment: Filter users with/without assignments (true/false)
    - kelas: Filter by assigned kelas
    - page: Page number
    - page_size: Items per page (default 20, max 100)
    """
    queryset = User.objects.all().prefetch_related('assignments')

    # Search
    search = request.query_params.get('search', '')
    if search:
        queryset = queryset.filter(
            Q(username__icontains=search) |
            Q(name__icontains=search) |
            Q(email__icontains=search) |
            Q(phone__icontains=search)
        )

    # Filter by role
    role = request.query_params.get('role', '')
    if role:
        queryset = queryset.filter(role=role)

    # Filter by status
    status_filter = request.query_params.get('status', 'all')
    if status_filter == 'active':
        queryset = queryset.filter(is_active=True)
    elif status_filter == 'inactive':
        queryset = queryset.filter(is_active=False)

    # Filter by assignment
    has_assignment = request.query_params.get('has_assignment', '')
    if has_assignment == 'true':
        queryset = queryset.filter(assignments__status='active').distinct()
    elif has_assignment == 'false':
        queryset = queryset.exclude(assignments__status='active').distinct()

    # Filter by kelas
    kelas = request.query_params.get('kelas', '')
    if kelas:
        queryset = queryset.filter(
            Q(kelas=kelas) | Q(assignments__kelas=kelas)
        ).distinct()

    # Order by
    order_by = request.query_params.get('order_by', '-date_joined')
    queryset = queryset.order_by(order_by)

    # Paginate
    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(queryset, request)

    if page is not None:
        serializer = AdminUserSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = AdminUserSerializer(queryset, many=True)
    return Response({
        'success': True,
        'count': queryset.count(),
        'results': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsSuperAdmin])
def admin_user_create(request):
    """
    POST /api/admin/users/create/

    Buat user baru.
    """
    serializer = AdminUserCreateSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # Log activity
        log_activity(
            user=request.user,
            target_user=user,
            action='create',
            details={'role': user.role, 'created_fields': list(request.data.keys())},
            request=request
        )

        return Response({
            'success': True,
            'message': f'User {user.username} berhasil dibuat',
            'user': AdminUserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

    return Response({
        'success': False,
        'message': 'Validasi gagal',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsSuperAdmin])
def admin_user_detail(request, user_id):
    """
    GET/PATCH/DELETE /api/admin/users/<id>/

    Detail, update, atau delete user.
    """
    try:
        user = User.objects.prefetch_related('assignments').get(id=user_id)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = AdminUserSerializer(user)
        return Response({
            'success': True,
            'user': serializer.data
        })

    elif request.method == 'PATCH':
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)

        if serializer.is_valid():
            old_data = AdminUserSerializer(user).data
            serializer.save()

            # Log activity
            log_activity(
                user=request.user,
                target_user=user,
                action='update',
                details={
                    'updated_fields': list(request.data.keys()),
                    'old_values': {k: old_data.get(k) for k in request.data.keys()}
                },
                request=request
            )

            return Response({
                'success': True,
                'message': f'User {user.username} berhasil diupdate',
                'user': AdminUserSerializer(user).data
            })

        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # Soft delete - deactivate instead of hard delete
        if user.role == 'superadmin' and user.id == request.user.id:
            return Response({
                'success': False,
                'message': 'Tidak dapat menghapus akun sendiri'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = False
        user.save()

        # Log activity
        log_activity(
            user=request.user,
            target_user=user,
            action='deactivate',
            details={'reason': request.data.get('reason', 'Admin deactivation')},
            request=request
        )

        return Response({
            'success': True,
            'message': f'User {user.username} berhasil dinonaktifkan'
        })


@api_view(['PATCH'])
@permission_classes([IsSuperAdmin])
def admin_user_assign(request, user_id):
    """
    PATCH /api/admin/users/<id>/assign/

    Assign tugas (Kelas/Halaqoh) ke user.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    # Validate user role - only guru, musyrif, wali_kelas can be assigned
    allowed_roles = ['guru', 'musyrif', 'wali_kelas', 'pimpinan']
    if user.role not in allowed_roles:
        return Response({
            'success': False,
            'message': f'User dengan role {user.role} tidak dapat diberi tugas assignment'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = UserAssignSerializer(data=request.data)

    if serializer.is_valid():
        data = serializer.validated_data

        # Check if assignment already exists
        existing = Assignment.objects.filter(
            user=user,
            assignment_type=data['assignment_type'],
            kelas=data.get('kelas'),
            halaqoh_id=data.get('halaqoh_id'),
            tahun_ajaran=data['tahun_ajaran'],
            semester=data['semester'],
            status='active'
        ).first()

        if existing:
            return Response({
                'success': False,
                'message': 'Assignment ini sudah ada untuk user tersebut'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create assignment
        assignment = Assignment.objects.create(
            user=user,
            assignment_type=data['assignment_type'],
            kelas=data.get('kelas'),
            halaqoh_id=data.get('halaqoh_id'),
            mata_pelajaran=data.get('mata_pelajaran'),
            hari=data.get('hari'),
            tahun_ajaran=data['tahun_ajaran'],
            semester=data['semester'],
            catatan=data.get('catatan'),
            status='active',
            created_by=request.user.username
        )

        # Update user's kelas field if assignment is kbm/diniyah/wali_kelas
        if data['assignment_type'] in ['kbm', 'diniyah', 'wali_kelas'] and data.get('kelas'):
            user.kelas = data['kelas']
            if data.get('mata_pelajaran'):
                user.mata_pelajaran = data['mata_pelajaran']
            user.save()

        # Log activity
        log_activity(
            user=request.user,
            target_user=user,
            action='assign',
            details={
                'assignment_type': data['assignment_type'],
                'target': data.get('kelas') or f"Halaqoh #{data.get('halaqoh_id')}",
                'assignment_id': assignment.id
            },
            request=request
        )

        return Response({
            'success': True,
            'message': f'Berhasil assign {data["assignment_type"]} ke {user.name}',
            'assignment': AssignmentSerializer(assignment).data
        }, status=status.HTTP_201_CREATED)

    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsSuperAdmin])
def admin_reset_password(request, user_id):
    """
    POST /api/admin/users/<id>/reset-password/

    Reset password user oleh Superadmin.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = PasswordResetByAdminSerializer(data=request.data)

    if serializer.is_valid():
        new_password = serializer.validated_data['new_password']
        user.set_password(new_password)
        user.save()

        # Log activity
        log_activity(
            user=request.user,
            target_user=user,
            action='reset_password',
            details={'reset_by': request.user.username},
            request=request
        )

        return Response({
            'success': True,
            'message': f'Password untuk {user.username} berhasil direset'
        })

    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def admin_user_assignments(request, user_id):
    """
    GET /api/admin/users/<id>/assignments/

    List semua assignments untuk user tertentu.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    # Filter by status
    status_filter = request.query_params.get('status', 'active')
    assignments = user.assignments.all()

    if status_filter != 'all':
        assignments = assignments.filter(status=status_filter)

    serializer = AssignmentSerializer(assignments, many=True)

    return Response({
        'success': True,
        'user_id': user_id,
        'user_name': user.name,
        'assignments': serializer.data
    })


@api_view(['DELETE'])
@permission_classes([IsSuperAdmin])
def admin_delete_assignment(request, user_id, assignment_id):
    """
    DELETE /api/admin/users/<id>/assignments/<aid>/

    Hapus (deactivate) assignment.
    """
    try:
        assignment = Assignment.objects.get(id=assignment_id, user_id=user_id)
    except Assignment.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Assignment tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    # Soft delete - set status to inactive
    assignment.status = 'inactive'
    assignment.save()

    # Log activity
    log_activity(
        user=request.user,
        target_user=assignment.user,
        action='unassign',
        details={
            'assignment_type': assignment.assignment_type,
            'target': assignment.target_display,
            'assignment_id': assignment.id
        },
        request=request
    )

    return Response({
        'success': True,
        'message': 'Assignment berhasil dihapus'
    })


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def admin_activity_log(request):
    """
    GET /api/admin/activities/

    List activity log untuk audit trail.

    Query params:
    - user_id: Filter by user who performed action
    - target_id: Filter by target user
    - action: Filter by action type
    - from_date: Filter from date (YYYY-MM-DD)
    - to_date: Filter to date (YYYY-MM-DD)
    """
    try:
        queryset = UserActivity.objects.select_related('user', 'target_user').all()

        # Filters
        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        target_id = request.query_params.get('target_id')
        if target_id:
            queryset = queryset.filter(target_user_id=target_id)

        action = request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)

        from_date = request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(timestamp__date__gte=from_date)

        to_date = request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(timestamp__date__lte=to_date)

        # Order by newest first
        queryset = queryset.order_by('-timestamp')

        # Paginate
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)

        if page is not None:
            serializer = UserActivitySerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = UserActivitySerializer(queryset[:100], many=True)
        return Response({
            'success': True,
            'activities': serializer.data
        })

    except Exception as e:
        import logging
        import traceback
        logger = logging.getLogger(__name__)

        # Log full traceback for debugging
        tb_str = traceback.format_exc()
        logger.error(f"[admin_activity_log] Error: {str(e)}\n{tb_str}")

        return Response({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'message': 'Terjadi kesalahan saat memuat activity log'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def admin_halaqoh_options(request):
    """
    GET /api/admin/halaqoh-options/

    List halaqoh untuk dropdown di form assignment.
    """
    try:
        from apps.kesantrian.models import Halaqoh
        halaqohs = Halaqoh.objects.filter(aktif=True).values(
            'id', 'nama', 'jenis', 'musyrif', 'kapasitas'
        )
        return Response({
            'success': True,
            'halaqohs': list(halaqohs)
        })
    except Exception as e:
        return Response({
            'success': True,
            'halaqohs': [],
            'message': 'Modul Kesantrian belum tersedia'
        })


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def admin_stats(request):
    """
    GET /api/admin/stats/

    Statistics untuk dashboard admin.
    """
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()

    # Role distribution
    role_stats = User.objects.values('role').annotate(count=Count('id')).order_by('role')

    # Recent logins (last 7 days)
    from datetime import timedelta
    week_ago = timezone.now() - timedelta(days=7)
    recent_logins = User.objects.filter(last_login__gte=week_ago).count()

    # Active assignments
    active_assignments = Assignment.objects.filter(status='active').count()

    # Users without assignments (guru/musyrif only)
    unassigned_teachers = User.objects.filter(
        role__in=['guru', 'musyrif'],
        is_active=True
    ).exclude(
        assignments__status='active'
    ).count()

    return Response({
        'success': True,
        'stats': {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': total_users - active_users,
            'recent_logins': recent_logins,
            'active_assignments': active_assignments,
            'unassigned_teachers': unassigned_teachers,
            'role_distribution': list(role_stats)
        }
    })


@api_view(['POST'])
@permission_classes([IsSuperAdmin])
def admin_bulk_assign(request):
    """
    POST /api/admin/bulk-assign/

    Bulk assign multiple users ke kelas/halaqoh yang sama.
    """
    serializer = BulkAssignSerializer(data=request.data)

    if serializer.is_valid():
        data = serializer.validated_data
        user_ids = data['user_ids']

        success_count = 0
        errors = []

        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)

                # Skip if not allowed role
                if user.role not in ['guru', 'musyrif', 'wali_kelas', 'pimpinan']:
                    errors.append(f"User {user.username}: role tidak diizinkan")
                    continue

                # Check if exists
                existing = Assignment.objects.filter(
                    user=user,
                    assignment_type=data['assignment_type'],
                    kelas=data.get('kelas'),
                    halaqoh_id=data.get('halaqoh_id'),
                    tahun_ajaran=data['tahun_ajaran'],
                    semester=data['semester'],
                    status='active'
                ).exists()

                if existing:
                    errors.append(f"User {user.username}: sudah memiliki assignment ini")
                    continue

                Assignment.objects.create(
                    user=user,
                    assignment_type=data['assignment_type'],
                    kelas=data.get('kelas'),
                    halaqoh_id=data.get('halaqoh_id'),
                    tahun_ajaran=data['tahun_ajaran'],
                    semester=data['semester'],
                    status='active',
                    created_by=request.user.username
                )
                success_count += 1

            except User.DoesNotExist:
                errors.append(f"User ID {user_id}: tidak ditemukan")

        return Response({
            'success': True,
            'message': f'{success_count} user berhasil di-assign',
            'success_count': success_count,
            'errors': errors
        })

    return Response({
        'success': False,
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsSuperAdmin])
def admin_activate_user(request, user_id):
    """
    POST /api/admin/users/<id>/activate/

    Aktivasi kembali user yang di-deactivate.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    if user.is_active:
        return Response({
            'success': False,
            'message': 'User sudah aktif'
        }, status=status.HTTP_400_BAD_REQUEST)

    user.is_active = True
    user.save()

    log_activity(
        user=request.user,
        target_user=user,
        action='activate',
        details={'reactivated_by': request.user.username},
        request=request
    )

    return Response({
        'success': True,
        'message': f'User {user.username} berhasil diaktifkan kembali'
    })
