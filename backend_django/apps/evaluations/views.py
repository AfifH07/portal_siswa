from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q

from .models import Evaluation, EvaluationComment
from .serializers import (
    EvaluationSerializer, EvaluationCreateSerializer,
    EvaluationCommentSerializer, EvaluationCommentCreateSerializer
)
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsGuru, IsWalisantri
from apps.accounts.models import Assignment
from apps.students.models import Student


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
        queryset = Evaluation.objects.select_related('nisn', 'approved_by').prefetch_related('comments__user')
        user = self.request.user
        evaluator_name = user.name if user.name else user.username

        if user.role == 'walisantri':
            # Walisantri: hanya lihat evaluasi anak yang sudah approved & public
            linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
            if linked_nisns:
                queryset = queryset.filter(
                    nisn__nisn__in=linked_nisns,
                    is_approved=True,
                    visibility='public'
                )
            else:
                queryset = queryset.filter(
                    nisn__nisn=user.linked_student_nisn,
                    is_approved=True,
                    visibility='public'
                )
        elif user.role in ['guru', 'musyrif']:
            # PERUBAHAN 4: Guru lihat kasus yang ia buat ATAU kasus di kelas yang ia ampu
            # Get kelas yang diampu dari Assignment (wali_kelas)
            assigned_kelas = list(Assignment.objects.filter(
                user=user,
                assignment_type='wali_kelas',
                status='active'
            ).values_list('kelas', flat=True))

            # Logic:
            # - Evaluasi yang dibuat sendiri (termasuk yang belum approved)
            # - ATAU evaluasi di kelas yang diampu (hanya yang sudah approved)
            if assigned_kelas:
                queryset = queryset.filter(
                    Q(evaluator=evaluator_name) |  # Kasus yang dibuat sendiri
                    Q(nisn__kelas__in=assigned_kelas, is_approved=True)  # Kasus di kelas ampu (approved)
                )
            else:
                # Guru tanpa wali kelas: hanya lihat kasus yang dibuat sendiri
                queryset = queryset.filter(evaluator=evaluator_name)
        # Superadmin, pimpinan, bk: lihat semua evaluasi (termasuk yang belum approved)

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
        evaluator_name = self.request.user.name if hasattr(self.request.user, 'name') and self.request.user.name else self.request.user.username
        serializer.save(evaluator=evaluator_name)

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
        
        if evaluation.evaluator != request.user.name and request.user.role != 'superadmin':
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
        
        if evaluation.evaluator != request.user.name and request.user.role != 'superadmin':
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
    user = request.user
    evaluator_name = user.name if user.name else user.username

    try:
        queryset = Evaluation.objects.all()

        if user.role == 'walisantri':
            # Walisantri: hanya evaluasi anak yang sudah approved & public
            linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else []
            if linked_nisns:
                queryset = queryset.filter(
                    nisn__nisn__in=linked_nisns,
                    is_approved=True,
                    visibility='public'
                )
            else:
                queryset = queryset.filter(
                    nisn__nisn=user.linked_student_nisn,
                    is_approved=True,
                    visibility='public'
                )
        elif user.role in ['guru', 'musyrif']:
            # Guru: kasus yang dibuat sendiri ATAU kasus di kelas yang diampu (approved)
            assigned_kelas = list(Assignment.objects.filter(
                user=user,
                assignment_type='wali_kelas',
                status='active'
            ).values_list('kelas', flat=True))

            if assigned_kelas:
                queryset = queryset.filter(
                    Q(evaluator=evaluator_name) |
                    Q(nisn__kelas__in=assigned_kelas, is_approved=True)
                )
            else:
                queryset = queryset.filter(evaluator=evaluator_name)

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

        evaluation.is_approved = True
        evaluation.approved_by = request.user
        evaluation.save()

        return Response({
            'success': True,
            'message': 'Evaluasi berhasil diapprove',
            'data': {
                'id': evaluation.id,
                'is_approved': evaluation.is_approved,
                'approved_by': request.user.name or request.user.username
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
def evaluation_comments(request, evaluation_id):
    """
    GET: Ambil semua komentar untuk evaluasi tertentu
    POST: Tambah komentar baru (jenis: diskusi/pembinaan)
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
        serializer = EvaluationCommentSerializer(comments, many=True)
        return Response({
            'success': True,
            'comments': serializer.data
        })

    elif request.method == 'POST':
        # Only guru, bk, pimpinan, superadmin can add comments
        if request.user.role not in ['guru', 'musyrif', 'bk', 'pimpinan', 'superadmin']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk menambah tanggapan'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['evaluation'] = evaluation_id

        serializer = EvaluationCommentCreateSerializer(data=data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({
                'success': True,
                'message': 'Tanggapan berhasil ditambahkan',
                'data': EvaluationCommentSerializer(serializer.instance).data
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
        if comment.user != request.user and request.user.role not in ['superadmin', 'pimpinan']:
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
