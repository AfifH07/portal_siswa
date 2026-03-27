from rest_framework import generics, status, viewsets, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Count, Q
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination
import base64

from .models import Student
from .serializers import (
    StudentSerializer, StudentListSerializer,
    StudentCreateSerializer, StudentUpdateSerializer,
    AlumniListSerializer, AlumniDetailSerializer,
    SetAlumniSerializer, BulkSetAlumniSerializer, ReactivateStudentSerializer
)
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsGuru, CanUpdateStudent
from .excel_parser import import_students, generate_import_template


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


def sort_class_key(kelas):
    """
    Custom sorting for class names like "X A", "XI B", "XII C"
    Returns tuple (grade_order, section) for proper sorting
    """
    if not kelas:
        return (999, 'Z')

    # Parse class name - expected format: "XII A", "XI B", "X C"
    parts = kelas.strip().split()
    if len(parts) < 2:
        return (999, kelas)

    grade = parts[0].upper()
    section = parts[1].upper() if len(parts) > 1 else 'A'

    # Roman numeral to number mapping
    grade_order = {
        'X': 10,
        'XI': 11,
        'XII': 12
    }.get(grade, 999)

    return (grade_order, section)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_distinct_classes(request):
    """
    Get distinct classes from students data.
    Only returns classes that have active students.
    Format: "X A", "X B", "XI A", "XII D", etc.

    Response: {"success": true, "classes": [...], "programs": [...]}
    """
    try:
        # Optimized query - only fetch distinct kelas values
        classes_qs = Student.objects.filter(
            aktif=True
        ).exclude(
            kelas__isnull=True
        ).exclude(
            kelas__exact=''
        ).values_list('kelas', flat=True).distinct()

        # Convert to list and clean
        classes = list(set([c.strip() for c in classes_qs if c and c.strip()]))

        # Sort using custom key (X before XI before XII, A before B before C before D)
        classes = sorted(classes, key=sort_class_key)

        # Get programs (optional, less critical)
        try:
            programs_qs = Student.objects.exclude(
                program__isnull=True
            ).exclude(
                program__exact=''
            ).values_list('program', flat=True).distinct()
            programs = sorted(list(set([p.strip() for p in programs_qs if p])))
        except Exception:
            programs = []

        return Response({
            'success': True,
            'classes': classes,
            'programs': programs,
            'count': len(classes)
        })

    except Exception as e:
        # Return error response instead of letting request hang
        return Response({
            'success': False,
            'classes': [],
            'programs': [],
            'error': str(e),
            'message': 'Gagal memuat daftar kelas'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['kelas', 'program', 'aktif']
    search_fields = ['nisn', 'nama']
    ordering_fields = ['nisn', 'nama', 'kelas', 'created_at']
    ordering = ['nisn']
    lookup_field = 'nisn'

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            permission_classes = [IsSuperAdmin]
        elif self.action in ['update', 'partial_update']:
            permission_classes = [IsAuthenticated, CanUpdateStudent]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Student.objects.all()
        user = self.request.user

        # Role-based filtering
        if user.role == 'walisantri':
            # Walisantri: only see their linked children
            linked_nisns = []
            if hasattr(user, 'get_linked_students'):
                linked_nisns = user.get_linked_students()
            if user.linked_student_nisn:
                linked_nisns.append(user.linked_student_nisn)
            if linked_nisns:
                queryset = queryset.filter(nisn__in=linked_nisns)
            else:
                queryset = queryset.none()

        elif user.role in ['guru', 'musyrif', 'wali_kelas']:
            # Teachers: filter by assigned kelas if available
            # If no kelas assigned, show ALL students (for input flexibility during testing)
            kelas_assigned = getattr(user, 'kelas', None)
            if kelas_assigned:
                queryset = queryset.filter(kelas=kelas_assigned)
            # else: queryset remains all() - allows dropdown to populate

        # Superadmin, pimpinan, bk: see all students (no additional filter)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nisn__icontains=search) |
                Q(nama__icontains=search)
            )

        kelas_filter = self.request.query_params.get('kelas')
        if kelas_filter:
            queryset = queryset.filter(kelas=kelas_filter)

        program_filter = self.request.query_params.get('program')
        if program_filter:
            queryset = queryset.filter(program=program_filter)

        aktif_filter = self.request.query_params.get('aktif')
        if aktif_filter is not None:
            queryset = queryset.filter(aktif=aktif_filter.lower() == 'true')

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return StudentListSerializer
        elif self.action == 'create':
            return StudentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return StudentUpdateSerializer
        return StudentSerializer

    def perform_update(self, serializer):
        user = self.request.user
        student = serializer.instance

        if user.role == 'guru':
            user_kelas = user.kelas
            if not user_kelas or student.kelas != user_kelas:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Guru hanya dapat mengedit siswa di kelasnya sendiri')

        super().perform_update(serializer)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if user.role != 'superadmin':
            return Response(
                {'success': False, 'message': 'Hanya superadmin yang dapat menghapus data siswa'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    @permission_classes([IsAuthenticated])
    def statistics(self, request):
        user = request.user
        queryset = self.get_queryset()

        total = queryset.count()
        aktif = queryset.filter(aktif=True).count()
        non_aktif = queryset.filter(aktif=False).count()

        hafalan_above = 0
        hafalan_below = 0
        for student in queryset:
            if student.target_hafalan > 0:
                if student.current_hafalan >= student.target_hafalan:
                    hafalan_above += 1
                else:
                    hafalan_below += 1

        return Response({
            'success': True,
            'statistics': {
                'total_students': total,
                'active_students': aktif,
                'inactive_students': non_aktif,
                'hafalan_above_target': hafalan_above,
                'hafalan_below_target': hafalan_below
            }
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_students_view(request):
    """
    Import students from Excel/CSV file.

    POST /api/students/import/
    - file: Excel or CSV file

    Returns:
    - success: bool
    - created: number of new students
    - updated: number of updated students
    - skipped: number of skipped rows
    - errors: list of error messages
    - error_file_base64: base64 encoded Excel error report (optional)
    """
    user = request.user

    # Only superadmin and guru can import
    if user.role not in ['superadmin', 'guru']:
        return Response(
            {'success': False, 'error': 'Anda tidak memiliki izin untuk import data'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if file is provided
    if 'file' not in request.FILES:
        return Response(
            {'success': False, 'error': 'File tidak ditemukan'},
            status=status.HTTP_400_BAD_REQUEST
        )

    uploaded_file = request.FILES['file']
    filename = uploaded_file.name

    # Validate file extension
    valid_extensions = ['.xlsx', '.xls', '.csv']
    if not any(filename.lower().endswith(ext) for ext in valid_extensions):
        return Response(
            {'success': False, 'error': 'Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Read file content
    try:
        file_content = uploaded_file.read()
    except Exception as e:
        return Response(
            {'success': False, 'error': f'Gagal membaca file: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Import students
    result = import_students(file_content, filename)

    # Prepare response
    response_data = {
        'success': result['success'],
        'created': result['created'],
        'updated': result['updated'],
        'skipped': result['skipped'],
        'errors': result['errors']
    }

    # Add error file if exists
    if result.get('error_file'):
        response_data['error_file_base64'] = base64.b64encode(result['error_file']).decode('utf-8')

    return Response(response_data, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_update_class(request):
    """
    Bulk update class for multiple students (Class Promotion).

    POST /api/students/bulk-update-class/
    Body:
    {
        "kelas_asal": "XI A",
        "kelas_tujuan": "XII A",
        "nisn_list": ["1234567890", "1234567891", ...]
    }

    If kelas_tujuan is "LULUS", students will be marked as inactive (alumni).
    """
    user = request.user

    # Only superadmin and guru can do bulk update
    if user.role not in ['superadmin', 'guru']:
        return Response(
            {'success': False, 'error': 'Anda tidak memiliki izin untuk kenaikan kelas'},
            status=status.HTTP_403_FORBIDDEN
        )

    kelas_asal = request.data.get('kelas_asal')
    kelas_tujuan = request.data.get('kelas_tujuan')
    nisn_list = request.data.get('nisn_list', [])

    # Validate input
    if not kelas_asal:
        return Response(
            {'success': False, 'error': 'Kelas asal harus diisi'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not kelas_tujuan:
        return Response(
            {'success': False, 'error': 'Kelas tujuan harus diisi'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not nisn_list or len(nisn_list) == 0:
        return Response(
            {'success': False, 'error': 'Pilih minimal satu siswa'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get students to update
        students = Student.objects.filter(nisn__in=nisn_list, kelas=kelas_asal, aktif=True)

        if students.count() == 0:
            return Response(
                {'success': False, 'error': 'Tidak ada siswa yang ditemukan'},
                status=status.HTTP_404_NOT_FOUND
            )

        updated_count = 0

        if kelas_tujuan == 'LULUS':
            # Mark as alumni (inactive)
            for student in students:
                student.aktif = False
                student.kelas = 'LULUS'
                student.save()
                updated_count += 1
        else:
            # Update to new class
            for student in students:
                student.kelas = kelas_tujuan
                student.save()
                updated_count += 1

        return Response({
            'success': True,
            'message': f'Berhasil memproses {updated_count} siswa',
            'updated': updated_count
        })

    except Exception as e:
        return Response(
            {'success': False, 'error': f'Terjadi kesalahan: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_import_template(request):
    """
    Download Excel template for student import.

    GET /api/students/download-template/

    Returns an Excel file (.xlsx) with:
    - Styled headers (Emerald Green)
    - Sample data row
    - NISN column formatted as Text
    - Instruction sheet
    """
    user = request.user

    # Only superadmin and guru can download template
    if user.role not in ['superadmin', 'guru']:
        return Response(
            {'success': False, 'error': 'Anda tidak memiliki izin untuk download template'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        # Generate template
        template_bytes = generate_import_template()

        # Create response with file download
        response = HttpResponse(
            template_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="Template_Siswa_Emerald.xlsx"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'

        return response

    except Exception as e:
        return Response(
            {'success': False, 'error': f'Gagal membuat template: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================
# ALUMNI MANAGEMENT ENDPOINTS
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alumni_list(request):
    """
    List all alumni students.

    GET /api/students/alumni/
    Query params:
    - tahun_lulus: Filter by graduation year (e.g., "2025/2026")
    - search: Search by NISN or name
    - page: Page number
    - page_size: Items per page (max 100)

    Access:
    - Superadmin: All alumni
    - Walisantri: Only their linked children (if alumni)
    """
    user = request.user

    # Base queryset - non-active students
    queryset = Student.objects.filter(status__in=['alumni', 'pindah', 'dikeluarkan'])

    # Role-based filtering
    if user.role == 'walisantri':
        # Walisantri can only see their linked children
        linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
        if user.linked_student_nisn:
            linked_nisns.append(user.linked_student_nisn)
        queryset = queryset.filter(nisn__in=linked_nisns)
    elif user.role not in ['superadmin', 'pimpinan', 'admin']:
        return Response(
            {'success': False, 'error': 'Akses tidak diizinkan'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Apply filters
    tahun_lulus = request.query_params.get('tahun_lulus')
    if tahun_lulus:
        queryset = queryset.filter(tahun_lulus=tahun_lulus)

    search = request.query_params.get('search')
    if search:
        queryset = queryset.filter(
            Q(nisn__icontains=search) |
            Q(nama__icontains=search)
        )

    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    # Ordering
    queryset = queryset.order_by('-tanggal_keluar', 'nama')

    # Pagination
    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(queryset, request)

    if page is not None:
        serializer = AlumniListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = AlumniListSerializer(queryset, many=True)
    return Response({
        'success': True,
        'results': serializer.data,
        'count': queryset.count()
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alumni_detail(request, nisn):
    """
    Get alumni detail by NISN.

    GET /api/students/alumni/<nisn>/

    Access:
    - Superadmin: Any alumni
    - Walisantri: Only their linked children
    """
    user = request.user

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Santri tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Access control
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
        if user.linked_student_nisn:
            linked_nisns.append(user.linked_student_nisn)
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'error': 'Akses tidak diizinkan'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'admin']:
        return Response(
            {'success': False, 'error': 'Akses tidak diizinkan'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = AlumniDetailSerializer(student)
    return Response({
        'success': True,
        'data': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_alumni_status(request):
    """
    Convert active student to alumni status.

    POST /api/students/set-alumni/
    Body:
    {
        "nisn": "1234567890",
        "tahun_lulus": "2025/2026",
        "catatan": "Lulus dengan predikat Mumtaz",
        "alasan_keluar": "Kelulusan"
    }

    Access: Superadmin only
    """
    user = request.user

    if user.role != 'superadmin':
        return Response(
            {'success': False, 'error': 'Hanya superadmin yang dapat mengubah status alumni'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = SetAlumniSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    nisn = serializer.validated_data['nisn']
    tahun_lulus = serializer.validated_data.get('tahun_lulus', '')
    catatan = serializer.validated_data.get('catatan', '')
    alasan_keluar = serializer.validated_data.get('alasan_keluar', 'Kelulusan')

    try:
        student = Student.objects.get(nisn=nisn)
        student.set_alumni(tahun_lulus=tahun_lulus, catatan=catatan)

        if alasan_keluar:
            student.alasan_keluar = alasan_keluar
            student.save()

        return Response({
            'success': True,
            'message': f'Santri {student.nama} berhasil diubah menjadi alumni',
            'data': AlumniDetailSerializer(student).data
        })

    except Student.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Santri tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'success': False, 'error': f'Terjadi kesalahan: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_set_alumni(request):
    """
    Bulk convert students to alumni (Kelulusan Massal).

    POST /api/students/bulk-set-alumni/
    Body:
    {
        "nisn_list": ["1234567890", "1234567891", ...],
        "tahun_lulus": "2025/2026",
        "catatan": "Kelulusan Angkatan 2026"
    }

    Access: Superadmin only
    """
    user = request.user

    if user.role != 'superadmin':
        return Response(
            {'success': False, 'error': 'Hanya superadmin yang dapat melakukan kelulusan massal'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BulkSetAlumniSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    nisn_list = serializer.validated_data['nisn_list']
    tahun_lulus = serializer.validated_data['tahun_lulus']
    catatan = serializer.validated_data.get('catatan', '')

    success_count = 0
    failed = []

    for nisn in nisn_list:
        try:
            student = Student.objects.get(nisn=nisn, status='aktif')
            student.set_alumni(tahun_lulus=tahun_lulus, catatan=catatan)
            student.alasan_keluar = 'Kelulusan'
            student.save()
            success_count += 1
        except Student.DoesNotExist:
            failed.append({'nisn': nisn, 'reason': 'Tidak ditemukan atau sudah alumni'})
        except Exception as e:
            failed.append({'nisn': nisn, 'reason': str(e)})

    return Response({
        'success': True,
        'message': f'Berhasil memproses {success_count} dari {len(nisn_list)} santri',
        'processed': success_count,
        'failed': failed
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reactivate_student(request):
    """
    Reactivate alumni back to active student status.

    POST /api/students/reactivate/
    Body:
    {
        "nisn": "1234567890",
        "kelas_baru": "X A"  // Optional
    }

    Access: Superadmin only
    """
    user = request.user

    if user.role != 'superadmin':
        return Response(
            {'success': False, 'error': 'Hanya superadmin yang dapat mengaktifkan kembali santri'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = ReactivateStudentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'success': False, 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    nisn = serializer.validated_data['nisn']
    kelas_baru = serializer.validated_data.get('kelas_baru', '')

    try:
        student = Student.objects.get(nisn=nisn)

        # Reset alumni fields
        student.status = 'aktif'
        student.aktif = True
        student.tanggal_keluar = None
        student.alasan_keluar = None

        if kelas_baru:
            student.kelas = kelas_baru

        student.save()

        return Response({
            'success': True,
            'message': f'Santri {student.nama} berhasil diaktifkan kembali',
            'data': StudentSerializer(student).data
        })

    except Student.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Santri tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'success': False, 'error': f'Terjadi kesalahan: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_alumni_info(request, nisn):
    """
    Update alumni information (ijazah status, catatan, etc).

    PUT /api/students/alumni/<nisn>/update/
    Body:
    {
        "ijazah_diterima": true,
        "catatan_alumni": "Melanjutkan ke Al-Azhar University"
    }

    Access: Superadmin only
    """
    user = request.user

    if user.role != 'superadmin':
        return Response(
            {'success': False, 'error': 'Hanya superadmin yang dapat mengubah data alumni'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Santri tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Fields that can be updated for alumni
    updateable_fields = ['ijazah_diterima', 'catatan_alumni', 'tahun_lulus']

    for field in updateable_fields:
        if field in request.data:
            setattr(student, field, request.data[field])

    student.save()

    return Response({
        'success': True,
        'message': 'Data alumni berhasil diperbarui',
        'data': AlumniDetailSerializer(student).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alumni_statistics(request):
    """
    Get alumni statistics.

    GET /api/students/alumni/statistics/

    Access: Superadmin, Pimpinan
    """
    user = request.user

    if user.role not in ['superadmin', 'pimpinan', 'admin']:
        return Response(
            {'success': False, 'error': 'Akses tidak diizinkan'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get counts by status
    alumni_count = Student.objects.filter(status='alumni').count()
    pindah_count = Student.objects.filter(status='pindah').count()
    dikeluarkan_count = Student.objects.filter(status='dikeluarkan').count()
    aktif_count = Student.objects.filter(status='aktif').count()

    # Get counts by tahun_lulus
    tahun_stats = Student.objects.filter(
        status='alumni'
    ).exclude(
        tahun_lulus__isnull=True
    ).exclude(
        tahun_lulus__exact=''
    ).values('tahun_lulus').annotate(
        count=Count('nisn')
    ).order_by('-tahun_lulus')[:5]

    # Ijazah statistics
    ijazah_diterima = Student.objects.filter(status='alumni', ijazah_diterima=True).count()
    ijazah_belum = Student.objects.filter(status='alumni', ijazah_diterima=False).count()

    return Response({
        'success': True,
        'statistics': {
            'total_alumni': alumni_count + pindah_count + dikeluarkan_count,
            'by_status': {
                'aktif': aktif_count,
                'alumni': alumni_count,
                'pindah': pindah_count,
                'dikeluarkan': dikeluarkan_count
            },
            'by_tahun_lulus': list(tahun_stats),
            'ijazah': {
                'diterima': ijazah_diterima,
                'belum_diterima': ijazah_belum
            }
        }
    })
