from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404

from .models import (
    Evaluation, EvaluationComment, PoinIntegritas,
    PenilaianIntegritasSantri, PenilaianIntegritasGuru
)
from .serializers import (
    EvaluationSerializer, EvaluationCreateSerializer,
    EvaluationCommentSerializer, EvaluationCommentCreateSerializer,
    PoinIntegritasSerializer, PenilaianIntegritasSantriSerializer,
    PenilaianIntegritasGuruSerializer
)
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsGuru, IsWalisantri
from apps.accounts.models import Assignment, User
from apps.students.models import Student


# =============================================================
# HELPER: Reusable queryset filter by role
# =============================================================

def get_filtered_queryset_for_user(user, base_queryset=None):
    """
    Get filtered queryset based on user role.
    Reusable for both EvaluationViewSet.get_queryset() and evaluation_statistics().
    """
    if base_queryset is None:
        base_queryset = Evaluation.objects.select_related('nisn', 'approved_by', 'created_by').prefetch_related('comments__user')

    queryset = base_queryset

    # superadmin, admin: lihat semua evaluasi
    if user.role in ['superadmin', 'admin']:
        pass  # No filter, see all

    # pimpinan: lihat semua yang is_approved=True
    elif user.role == 'pimpinan':
        queryset = queryset.filter(is_approved=True)

    # bk: lihat semua evaluasi yang is_approved=True (semua santri)
    elif user.role == 'bk':
        queryset = queryset.filter(is_approved=True)

    # musyrif: lihat is_approved=True untuk santri di halaqoh yang dia handle
    # Note: Untuk implementasi penuh perlu model HalaqohAssignment
    # Sementara: musyrif lihat semua yang approved
    elif user.role == 'musyrif':
        queryset = queryset.filter(is_approved=True)

    # guru (wali kelas): is_approved=True AND nisn__kelas IN wali_classes OR created_by=user
    # guru (bukan wali kelas): created_by=user SAJA
    elif user.role == 'guru':
        own_cases = Q(created_by=user)

        wali_assignments = Assignment.objects.filter(
            user=user,
            assignment_type='wali_kelas',
            status='active'
        ).values_list('kelas', flat=True)

        if wali_assignments.exists():
            wali_cases = Q(
                nisn__kelas__in=list(wali_assignments),
                is_approved=True
            )
            queryset = queryset.filter(own_cases | wali_cases)
        else:
            # Guru biasa tanpa wali kelas: hanya lihat kasus yang dia buat
            queryset = queryset.filter(own_cases)

    # walisantri: nisn__nisn__in=linked_nisns AND is_approved=True
    elif user.role == 'walisantri':
        nisn_list = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
        if not nisn_list:
            nisn_list = [user.linked_student_nisn] if user.linked_student_nisn else []

        queryset = queryset.filter(
            nisn__nisn__in=nisn_list,
            is_approved=True
        )

    # Role lain: tidak bisa lihat apa-apa
    else:
        queryset = queryset.none()

    return queryset


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = Evaluation.objects.select_related('nisn')
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # Support file uploads

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EvaluationCreateSerializer
        return EvaluationSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Allow guru, pimpinan, and superadmin to create/edit
            permission_classes = [IsAuthenticated, IsGuru | IsPimpinan | IsSuperAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Get queryset filtered by user role using helper function.
        """
        user = self.request.user

        # Use helper function for role-based filtering
        queryset = get_filtered_queryset_for_user(user)

        # Filter by kelas (dari query parameter)
        kelas = self.request.query_params.get('kelas')
        if kelas:
            queryset = queryset.filter(nisn__kelas=kelas)

        # Filter by jenis (prestasi/pelanggaran)
        jenis = self.request.query_params.get('jenis')
        if jenis:
            queryset = queryset.filter(jenis=jenis)

        # Filter by kategori
        kategori = self.request.query_params.get('kategori')
        if kategori:
            queryset = queryset.filter(kategori=kategori)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by is_approved
        is_approved = self.request.query_params.get('is_approved')
        if is_approved is not None:
            queryset = queryset.filter(is_approved=(is_approved.lower() == 'true'))

        # Search by student name or NISN
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nisn__nama__icontains=search) |
                Q(nisn__nisn__icontains=search) |
                Q(name__icontains=search)
            )

        # Order by most recent
        queryset = queryset.order_by('-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        """Override create to add debug logging and better error response"""
        print(f"[Evaluation CREATE] Received data: {dict(request.data)}")
        print(f"[Evaluation CREATE] User: {request.user.username}, Role: {getattr(request.user, 'role', 'unknown')}")

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print(f"[Evaluation CREATE] Validation errors: {serializer.errors}")
            return Response({
                'success': False,
                'message': 'Data tidak valid',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        print(f"[Evaluation CREATE] Success - ID: {serializer.instance.id}")

        return Response({
            'success': True,
            'message': 'Evaluasi berhasil ditambahkan',
            'data': EvaluationSerializer(serializer.instance).data
        }, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        # PERUBAHAN 5: Set created_by dan evaluator otomatis
        user = self.request.user
        evaluator_name = user.name if hasattr(user, 'name') and user.name else user.username
        serializer.save(
            evaluator=evaluator_name,
            created_by=user  # Set created_by ke user yang membuat
        )

    def update(self, request, *args, **kwargs):
        """Override update to add debug logging and better error response"""
        print(f"[Evaluation UPDATE] Received data: {dict(request.data)}")

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            print(f"[Evaluation UPDATE] Validation errors: {serializer.errors}")
            return Response({
                'success': False,
                'message': 'Data tidak valid',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        print(f"[Evaluation UPDATE] Success - ID: {instance.id}")

        return Response({
            'success': True,
            'message': 'Evaluasi berhasil diperbarui',
            'data': EvaluationSerializer(serializer.instance).data
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_evaluations(request, nisn):
    """
    Get evaluations for a specific student.
    Walisantri can only access their linked student's data.
    """
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Siswa tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    # Walisantri can only see their linked student's evaluations
    if user.role == 'walisantri':
        # Support multi-child
        linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
        if not linked_nisns:
            linked_nisns = [user.linked_student_nisn] if user.linked_student_nisn else []
        if nisn not in linked_nisns:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki akses ke data siswa ini'
            }, status=status.HTTP_403_FORBIDDEN)

    evaluations = Evaluation.objects.filter(nisn=student).order_by('-tanggal')
    serializer = EvaluationSerializer(evaluations, many=True)

    # Calculate summary stats for flashcard
    prestasi_count = evaluations.filter(jenis='prestasi').count()
    pelanggaran_count = evaluations.filter(jenis='pelanggaran').count()

    return Response({
        'success': True,
        'nisn': nisn,
        'nama': student.nama,
        'evaluations': serializer.data,
        'summary': {
            'total': evaluations.count(),
            'prestasi_count': prestasi_count,
            'pelanggaran_count': pelanggaran_count
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsGuru | IsPimpinan | IsSuperAdmin])
def get_all_evaluations(request):
    queryset = Evaluation.objects.select_related('nisn')
    
    jenis = request.query_params.get('jenis')
    if jenis:
        queryset = queryset.filter(jenis=jenis)
    
    start_date = request.query_params.get('start_date')
    if start_date:
        queryset = queryset.filter(tanggal__gte=start_date)
    
    end_date = request.query_params.get('end_date')
    if end_date:
        queryset = queryset.filter(tanggal__lte=end_date)
    
    serializer = EvaluationSerializer(queryset, many=True)
    
    return Response({
        'success': True,
        'count': queryset.count(),
        'evaluations': serializer.data
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated, IsGuru | IsSuperAdmin])
def update_evaluation(request, pk):
    try:
        evaluation = Evaluation.objects.get(pk=pk)
        
        if evaluation.evaluator != request.user.name and request.user.role not in ['superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk mengedit evaluasi ini'
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = EvaluationCreateSerializer(evaluation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Evaluasi berhasil diupdate'
            })
        else:
            return Response({
                'success': False,
                'message': 'Data tidak valid',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
    except Evaluation.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Evaluasi tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Terjadi kesalahan: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsGuru | IsSuperAdmin])
def delete_evaluation(request, pk):
    try:
        evaluation = Evaluation.objects.get(pk=pk)
        
        if evaluation.evaluator != request.user.name and request.user.role not in ['superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk menghapus evaluasi ini'
            }, status=status.HTTP_403_FORBIDDEN)
        
        evaluation.delete()
        return Response({
            'success': True,
            'message': 'Evaluasi berhasil dihapus'
        })
    except Evaluation.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Evaluasi tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Terjadi kesalahan: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def evaluation_statistics(request):
    """
    Get evaluation statistics filtered by user role.
    Uses the same queryset logic as EvaluationViewSet.get_queryset().
    """
    user = request.user

    try:
        # FIXED: Use the same helper function as get_queryset()
        queryset = get_filtered_queryset_for_user(user, Evaluation.objects.all())

        total_evaluations = queryset.count()
        total_prestasi = queryset.filter(jenis='prestasi').count()
        total_pelanggaran = queryset.filter(jenis='pelanggaran').count()

        # DEBUG: Check actual kategori values in database
        kategori_values = list(queryset.values_list('kategori', flat=True))
        kategori_unique = list(set(kategori_values))
        print(f"[Evaluation Statistics] DEBUG - User: {user.username}, Role: {user.role}")
        print(f"[Evaluation Statistics] DEBUG - Queryset count: {total_evaluations}")
        print(f"[Evaluation Statistics] DEBUG - Unique kategori: {kategori_unique}")
        print(f"[Evaluation Statistics] DEBUG - All kategori values: {kategori_values[:20]}")  # First 20

        from django.utils import timezone
        from django.db.models.functions import TruncMonth
        from django.db.models import Count
        from collections import defaultdict

        now = timezone.now()
        evaluations_this_month = queryset.filter(
            created_at__month=now.month,
            created_at__year=now.year
        ).count()

        # Category statistics - use __iexact for case-insensitive matching
        # Also count null/empty as 'lainnya'
        category_stats = {
            'adab': queryset.filter(kategori__iexact='adab').count(),
            'kedisiplinan': queryset.filter(kategori__iexact='kedisiplinan').count(),
            'akademik': queryset.filter(kategori__iexact='akademik').count(),
            'kebersihan': queryset.filter(kategori__iexact='kebersihan').count(),
            'hafalan': queryset.filter(kategori__iexact='hafalan').count(),
            'sosial': queryset.filter(kategori__iexact='sosial').count(),
        }

        # Count null/empty kategori as "lainnya"
        lainnya_count = queryset.filter(
            Q(kategori__isnull=True) | Q(kategori='') | Q(kategori__exact=' ')
        ).count()
        if lainnya_count > 0:
            category_stats['lainnya'] = lainnya_count
            print(f"[Evaluation Statistics] DEBUG - Found {lainnya_count} records with null/empty kategori")

        # Category breakdown by jenis - use __iexact for case-insensitive matching
        category_prestasi = {
            'adab': queryset.filter(kategori__iexact='adab', jenis='prestasi').count(),
            'kedisiplinan': queryset.filter(kategori__iexact='kedisiplinan', jenis='prestasi').count(),
            'akademik': queryset.filter(kategori__iexact='akademik', jenis='prestasi').count(),
            'kebersihan': queryset.filter(kategori__iexact='kebersihan', jenis='prestasi').count(),
            'hafalan': queryset.filter(kategori__iexact='hafalan', jenis='prestasi').count(),
            'sosial': queryset.filter(kategori__iexact='sosial', jenis='prestasi').count(),
        }

        category_pelanggaran = {
            'adab': queryset.filter(kategori__iexact='adab', jenis='pelanggaran').count(),
            'kedisiplinan': queryset.filter(kategori__iexact='kedisiplinan', jenis='pelanggaran').count(),
            'akademik': queryset.filter(kategori__iexact='akademik', jenis='pelanggaran').count(),
            'kebersihan': queryset.filter(kategori__iexact='kebersihan', jenis='pelanggaran').count(),
            'hafalan': queryset.filter(kategori__iexact='hafalan', jenis='pelanggaran').count(),
            'sosial': queryset.filter(kategori__iexact='sosial', jenis='pelanggaran').count(),
        }

        # Monthly trend (last 6 months)
        # Calculate start date (6 months ago) using datetime
        from datetime import timedelta
        import calendar

        def subtract_months(source_date, months):
            """Subtract months from a date safely"""
            month = source_date.month - 1 - months
            year = source_date.year + month // 12
            month = month % 12 + 1
            day = min(source_date.day, calendar.monthrange(year, month)[1])
            return source_date.replace(year=year, month=month, day=day)

        six_months_ago = subtract_months(now, 5)
        start_of_period = six_months_ago.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        monthly_data = queryset.filter(
            tanggal__gte=start_of_period.date()
        ).annotate(
            month=TruncMonth('tanggal')
        ).values('month', 'jenis').annotate(
            count=Count('id')
        ).order_by('month')

        # Build monthly trend dict
        month_names_id = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        trend_dict = defaultdict(lambda: {'prestasi': 0, 'pelanggaran': 0})

        for entry in monthly_data:
            month_key = entry['month'].strftime('%Y-%m') if entry['month'] else None
            if month_key:
                trend_dict[month_key][entry['jenis']] = entry['count']

        # Generate last 6 months in order
        monthly_trend = []
        for i in range(6):
            target_date = subtract_months(now, 5 - i)
            month_key = target_date.strftime('%Y-%m')
            month_label = f"{month_names_id[target_date.month]} {target_date.year}"
            monthly_trend.append({
                'month': month_label,
                'prestasi': trend_dict[month_key]['prestasi'],
                'pelanggaran': trend_dict[month_key]['pelanggaran']
            })

        return Response({
            'success': True,
            'statistics': {
                'total_evaluations': total_evaluations,
                'total_prestasi': total_prestasi,
                'total_pelanggaran': total_pelanggaran,
                'evaluations_this_month': evaluations_this_month,
                'by_category': category_stats,
                'prestasi_by_category': category_prestasi,
                'pelanggaran_by_category': category_pelanggaran,
                'monthly_trend': monthly_trend,
                # DEBUG: Remove after testing
                '_debug': {
                    'user': user.username,
                    'role': user.role,
                    'queryset_count': total_evaluations,
                    'unique_kategori': kategori_unique,
                    'sample_kategori': kategori_values[:10],
                }
            }
        })
    except Exception as e:
        import traceback
        print(f"[Evaluation Statistics] Error: {str(e)}")
        print(traceback.format_exc())
        return Response({
            'success': False,
            'message': f'Terjadi kesalahan: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================
# PERUBAHAN 4: Endpoint Approval
# =============================================================

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsSuperAdmin | IsPimpinan])
def approve_evaluation(request, pk):
    """
    Approve evaluasi. Hanya admin/superadmin/pimpinan yang bisa approve.
    PATCH /api/evaluations/<id>/approve/
    """
    try:
        evaluation = Evaluation.objects.get(pk=pk)

        if evaluation.is_approved:
            return Response({
                'success': False,
                'message': 'Evaluasi sudah diapprove sebelumnya'
            }, status=status.HTTP_400_BAD_REQUEST)

        # PERUBAHAN 3: Set is_approved, approved_by, dan approved_at
        evaluation.is_approved = True
        evaluation.approved_by = request.user
        evaluation.approved_at = timezone.now()
        evaluation.save()

        return Response({
            'success': True,
            'message': 'Evaluasi berhasil diapprove',
            'data': {
                'id': evaluation.id,
                'is_approved': evaluation.is_approved,
                'approved_by': request.user.name or request.user.username,
                'approved_at': evaluation.approved_at.isoformat()
            }
        })
    except Evaluation.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Evaluasi tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Terjadi kesalahan: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsSuperAdmin | IsPimpinan])
def unapprove_evaluation(request, pk):
    """
    Batalkan approval evaluasi.
    PATCH /api/evaluations/<id>/unapprove/
    """
    try:
        evaluation = Evaluation.objects.get(pk=pk)

        if not evaluation.is_approved:
            return Response({
                'success': False,
                'message': 'Evaluasi belum diapprove'
            }, status=status.HTTP_400_BAD_REQUEST)

        evaluation.is_approved = False
        evaluation.approved_by = None
        evaluation.approved_at = None
        evaluation.save()

        return Response({
            'success': True,
            'message': 'Approval evaluasi dibatalkan'
        })
    except Evaluation.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Evaluasi tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)


# =============================================================
# PERUBAHAN 5: Endpoint Tanggapan (Diskusi & Pembinaan)
# =============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def evaluation_comments(request, evaluation_id):
    """
    GET: Ambil semua komentar untuk evaluasi tertentu
         - Walisantri hanya lihat comment dengan visibility='semua'
    POST: Tambah komentar baru (jenis: diskusi/pembinaan, dengan foto opsional)
    """
    try:
        evaluation = Evaluation.objects.get(pk=evaluation_id)
    except Evaluation.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Evaluasi tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        comments = EvaluationComment.objects.filter(evaluation=evaluation).select_related('user')

        # Walisantri hanya bisa lihat comment dengan visibility='semua'
        if request.user.role == 'walisantri':
            comments = comments.filter(visibility='semua')

        serializer = EvaluationCommentSerializer(comments, many=True, context={'request': request})
        return Response({
            'success': True,
            'comments': serializer.data
        })

    elif request.method == 'POST':
        # Only guru, bk, musyrif, pimpinan, superadmin, admin can add comments
        if request.user.role not in ['guru', 'musyrif', 'bk', 'pimpinan', 'superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk menambah tanggapan'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['evaluation'] = evaluation_id

        serializer = EvaluationCommentCreateSerializer(data=data)
        if serializer.is_valid():
            # Handle foto upload if present
            foto = request.FILES.get('foto')
            serializer.save(user=request.user, foto=foto)
            return Response({
                'success': True,
                'message': 'Tanggapan berhasil ditambahkan',
                'data': EvaluationCommentSerializer(serializer.instance, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'success': False,
                'message': 'Data tidak valid',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_comment(request, comment_id):
    """
    Hapus komentar. Hanya pemilik komentar atau admin yang bisa hapus.
    DELETE /api/evaluations/comments/<comment_id>/
    """
    try:
        comment = EvaluationComment.objects.get(pk=comment_id)

        # Check permission: owner or admin
        if comment.user != request.user and request.user.role not in ['superadmin', 'admin', 'pimpinan']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk menghapus tanggapan ini'
            }, status=status.HTTP_403_FORBIDDEN)

        comment.delete()
        return Response({
            'success': True,
            'message': 'Tanggapan berhasil dihapus'
        })
    except EvaluationComment.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Tanggapan tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)


# =============================================================
# ENDPOINT: Close Evaluation (Keputusan Final oleh Pimpinan)
# =============================================================

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def close_evaluation(request, pk):
    """
    Close/selesaikan kasus evaluasi dengan keputusan final.
    Hanya pimpinan atau superadmin yang bisa close kasus.
    PATCH /api/evaluations/<id>/close/
    """
    # Permission check: hanya pimpinan atau superadmin
    if request.user.role not in ['pimpinan', 'superadmin']:
        return Response({
            'success': False,
            'message': 'Hanya pimpinan yang dapat menyelesaikan kasus'
        }, status=status.HTTP_403_FORBIDDEN)

    evaluation = get_object_or_404(Evaluation, pk=pk)

    keputusan = request.data.get('keputusan_final', '').strip()

    if not keputusan:
        return Response({
            'success': False,
            'message': 'Keputusan final wajib diisi'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Update evaluation
    evaluation.keputusan_final = keputusan
    evaluation.status = 'resolved'
    evaluation.closed_by = request.user
    evaluation.closed_at = timezone.now()
    evaluation.save()

    return Response({
        'success': True,
        'message': 'Kasus berhasil diselesaikan',
        'data': {
            'id': evaluation.id,
            'status': evaluation.status,
            'keputusan_final': evaluation.keputusan_final,
            'closed_by': request.user.name or request.user.username,
            'closed_at': evaluation.closed_at.isoformat()
        }
    })


# =============================================================
# INTEGRITAS
# =============================================================

def _is_point_manager(user):
    return user.role in ['superadmin', 'admin', 'pimpinan']


def _can_score_santri(user):
    return user.role in ['superadmin', 'admin', 'pimpinan', 'guru', 'musyrif']


def _get_assigned_classes(user):
    return list(
        Assignment.objects.filter(
            user=user,
            status='active'
        ).exclude(
            kelas__isnull=True
        ).exclude(
            kelas__exact=''
        ).values_list('kelas', flat=True).distinct()
    )


@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def poin_integritas_list(request, pk=None):
    if request.method == 'GET':
        if pk is not None:
            poin = get_object_or_404(PoinIntegritas, pk=pk)
            return Response({'success': True, 'data': PoinIntegritasSerializer(poin).data})

        queryset = PoinIntegritas.objects.filter(is_active=True).order_by('urutan', 'nama')
        serializer = PoinIntegritasSerializer(queryset, many=True)
        return Response({'success': True, 'count': queryset.count(), 'data': serializer.data})

    if not _is_point_manager(request.user):
        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'POST':
        nama = (request.data.get('nama') or '').strip()
        urutan = request.data.get('urutan', 0)
        if not nama:
            return Response({'success': False, 'message': 'Nama wajib diisi'}, status=status.HTTP_400_BAD_REQUEST)

        poin = PoinIntegritas.objects.create(
            nama=nama,
            urutan=int(urutan or 0),
            is_active=True
        )
        return Response({'success': True, 'message': 'Poin berhasil ditambahkan', 'data': PoinIntegritasSerializer(poin).data}, status=status.HTTP_201_CREATED)

    poin = get_object_or_404(PoinIntegritas, pk=pk)

    if request.method == 'PUT':
        nama = (request.data.get('nama') or poin.nama).strip()
        urutan = request.data.get('urutan', poin.urutan)
        poin.nama = nama
        poin.urutan = int(urutan or 0)
        poin.save()
        return Response({'success': True, 'message': 'Poin berhasil diperbarui', 'data': PoinIntegritasSerializer(poin).data})

    if request.method == 'DELETE':
        poin.is_active = False
        poin.save(update_fields=['is_active'])
        return Response({'success': True, 'message': 'Poin berhasil dihapus'})

    return Response({'success': False, 'message': 'Method tidak didukung'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def penilaian_integritas_santri(request):
    user = request.user

    if request.method == 'GET':
        if user.role == 'walisantri':
            return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

        queryset = PenilaianIntegritasSantri.objects.select_related('penilai', 'poin', 'santri')
        santri_nisn = request.query_params.get('santri_nisn')

        if user.role in ['guru', 'musyrif']:
            allowed_classes = _get_assigned_classes(user)
            if not allowed_classes:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(santri__kelas__in=allowed_classes)
                if santri_nisn:
                    try:
                        student = Student.objects.get(nisn=santri_nisn)
                    except Student.DoesNotExist:
                        return Response({'success': True, 'count': 0, 'data': []})
                    if student.kelas not in allowed_classes:
                        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)
                    queryset = queryset.filter(santri__nisn=santri_nisn)
        else:
            if santri_nisn:
                queryset = queryset.filter(santri__nisn=santri_nisn)

        serializer = PenilaianIntegritasSantriSerializer(queryset.order_by('-tanggal', '-id'), many=True)
        return Response({'success': True, 'count': queryset.count(), 'data': serializer.data})

    if not _can_score_santri(user):
        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    try:
        santri = Student.objects.get(nisn=request.data.get('santri_nisn'))
    except Student.DoesNotExist:
        return Response({'success': False, 'message': 'Santri tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

    if user.role in ['guru', 'musyrif']:
        allowed_classes = _get_assigned_classes(user)
        if santri.kelas not in allowed_classes:
            return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    serializer = PenilaianIntegritasSantriSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    penilaian = serializer.save(penilai=user)
    return Response({
        'success': True,
        'message': 'Penilaian berhasil disimpan',
        'data': PenilaianIntegritasSantriSerializer(penilaian).data
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def penilaian_integritas_santri_delete(request, pk):
    user = request.user
    penilaian = get_object_or_404(PenilaianIntegritasSantri, pk=pk)

    if penilaian.penilai_id != user.id and user.role not in ['superadmin', 'admin', 'pimpinan']:
        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    penilaian.delete()
    return Response({'success': True, 'message': 'Penilaian berhasil dihapus'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def penilaian_integritas_guru(request):
    user = request.user

    if request.method == 'GET':
        if user.role == 'guru':
            return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

        queryset = PenilaianIntegritasGuru.objects.select_related('penilai', 'guru', 'poin')
        guru_id = request.query_params.get('guru_id')
        if guru_id:
            queryset = queryset.filter(guru_id=guru_id)
        serializer = PenilaianIntegritasGuruSerializer(queryset.order_by('-tanggal', '-id'), many=True)
        return Response({'success': True, 'count': queryset.count(), 'data': serializer.data})

    if user.role not in ['superadmin', 'pimpinan']:
        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    guru_id = request.data.get('guru_id')
    poin_id = request.data.get('poin_id')
    skala = request.data.get('skala')
    catatan = request.data.get('catatan', '')

    if not guru_id or not poin_id or not skala:
        return Response({'success': False, 'message': 'Data wajib belum lengkap'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        skala = int(skala)
    except (TypeError, ValueError):
        return Response({'success': False, 'message': 'Skala tidak valid'}, status=status.HTTP_400_BAD_REQUEST)

    if skala < 1 or skala > 5:
        return Response({'success': False, 'message': 'Skala harus 1 sampai 5'}, status=status.HTTP_400_BAD_REQUEST)

    guru = get_object_or_404(User, pk=guru_id, role='guru')
    poin = get_object_or_404(PoinIntegritas, pk=poin_id, is_active=True)

    penilaian = PenilaianIntegritasGuru.objects.create(
        penilai=user,
        guru=guru,
        poin=poin,
        skala=skala,
        catatan=catatan or ''
    )
    return Response({
        'success': True,
        'message': 'Penilaian berhasil disimpan',
        'data': PenilaianIntegritasGuruSerializer(penilaian).data
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def penilaian_integritas_guru_delete(request, pk):
    user = request.user
    if user.role not in ['superadmin', 'admin', 'pimpinan']:
        return Response({'success': False, 'message': 'Tidak memiliki akses'}, status=status.HTTP_403_FORBIDDEN)

    penilaian = get_object_or_404(PenilaianIntegritasGuru, pk=pk)
    penilaian.delete()
    return Response({'success': True, 'message': 'Penilaian berhasil dihapus'})
