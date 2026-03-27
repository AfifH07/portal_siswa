"""
Finance Views - Portal Ponpes Baron
====================================

API Endpoints untuk Modul Keuangan dengan RBAC:
- Bendahara/Superadmin: Full CRUD access
- Pimpinan: Read all, approve payments
- Walisantri: Read own student's tagihan only

"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db import transaction
from django.db.models import Sum, Count, Q, F
from django.utils import timezone
from decimal import Decimal
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

from .models import Tarif, Tagihan, Pembayaran, LaporanKeuangan
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsBendahara, IsWalisantri
from .serializers import (
    TarifSerializer, TarifCreateSerializer,
    TagihanSerializer, TagihanCreateSerializer, TagihanUpdateSerializer,
    TagihanSummarySerializer,
    PembayaranSerializer, PembayaranCreateSerializer, PembayaranVerifySerializer,
    LaporanKeuanganSerializer, FinanceStatisticsSerializer
)
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsBendahara, IsWalisantri
from apps.students.models import Student


class FinancePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


# ============================================
# TARIF VIEWSET
# ============================================

class TarifViewSet(viewsets.ModelViewSet):
    """
    ViewSet untuk manajemen Tarif.
    RBAC: Hanya Bendahara dan Superadmin yang bisa CRUD.
    Audit Trail: created_by, updated_by otomatis diisi.
    """
    queryset = Tarif.objects.all()
    pagination_class = FinancePagination

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TarifCreateSerializer
        return TarifSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            # Pimpinan bisa lihat tarif
            permission_classes = [IsAuthenticated, IsBendahara | IsPimpinan]
        else:
            # CRUD hanya bendahara/superadmin
            permission_classes = [IsAuthenticated, IsBendahara]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Tarif.objects.all()

        # Filter by kategori
        kategori = self.request.query_params.get('kategori')
        if kategori:
            queryset = queryset.filter(kategori=kategori)

        # Filter by tahun_ajaran
        tahun_ajaran = self.request.query_params.get('tahun_ajaran')
        if tahun_ajaran:
            queryset = queryset.filter(tahun_ajaran=tahun_ajaran)

        # Filter aktif only
        aktif = self.request.query_params.get('aktif')
        if aktif is not None:
            queryset = queryset.filter(aktif=aktif.lower() == 'true')

        return queryset.order_by('kategori', 'nama')

    def perform_create(self, serializer):
        """Set created_by saat create."""
        serializer.save(created_by=self.request.user.username)

    def perform_update(self, serializer):
        """Set updated_by saat update."""
        serializer.save(updated_by=self.request.user.username)


# ============================================
# TAGIHAN VIEWSET
# ============================================

class TagihanViewSet(viewsets.ModelViewSet):
    """
    ViewSet untuk manajemen Tagihan.

    RBAC:
    - Bendahara/Superadmin: Full CRUD, lihat semua tagihan
    - Pimpinan: Read all
    - Walisantri: Read tagihan anak sendiri saja

    Features:
    - Auto-generate no_invoice unik
    - Audit Trail (created_by, updated_by)
    """
    queryset = Tagihan.objects.select_related('siswa', 'tarif')
    pagination_class = FinancePagination

    def get_serializer_class(self):
        if self.action == 'create':
            return TagihanCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TagihanUpdateSerializer
        return TagihanSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, IsBendahara]
        elif self.action in ['list', 'retrieve']:
            # Walisantri bisa lihat tagihan anaknya
            permission_classes = [IsAuthenticated, IsBendahara | IsPimpinan | IsWalisantri]
        else:
            permission_classes = [IsAuthenticated, IsBendahara]
        return [permission() for permission in permission_classes]

    def perform_update(self, serializer):
        """Set updated_by saat update."""
        serializer.save(updated_by=self.request.user.username)

    def get_queryset(self):
        user = self.request.user
        queryset = Tagihan.objects.select_related('siswa', 'tarif')

        # RBAC: Walisantri hanya lihat tagihan anaknya
        if user.role == 'walisantri':
            linked_nisn = getattr(user, 'linked_student_nisn', None)
            if linked_nisn:
                queryset = queryset.filter(siswa__nisn=linked_nisn)
            else:
                queryset = queryset.none()

        # Filter by siswa
        siswa_nisn = self.request.query_params.get('siswa')
        if siswa_nisn:
            queryset = queryset.filter(siswa__nisn=siswa_nisn)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by tahun
        tahun = self.request.query_params.get('tahun')
        if tahun:
            queryset = queryset.filter(tahun=int(tahun))

        # Filter by bulan
        bulan = self.request.query_params.get('bulan')
        if bulan:
            queryset = queryset.filter(bulan=int(bulan))

        # Filter by kelas
        kelas = self.request.query_params.get('kelas')
        if kelas:
            queryset = queryset.filter(siswa__kelas=kelas)

        # Filter overdue
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() == 'true':
            queryset = queryset.filter(
                jatuh_tempo__lt=timezone.now().date(),
                status__in=['belum_bayar', 'sebagian']
            )

        # Search by nama/nisn
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(siswa__nama__icontains=search) |
                Q(siswa__nisn__icontains=search)
            )

        return queryset.order_by('-tahun', '-bulan', 'siswa__nama')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Get summary tagihan per siswa.
        """
        user = request.user
        queryset = self.get_queryset()

        # Aggregate by siswa
        summary = queryset.values(
            'siswa__nisn', 'siswa__nama', 'siswa__kelas'
        ).annotate(
            total_tagihan=Sum('total'),
            total_terbayar=Sum('terbayar'),
            total_tunggakan=Sum('sisa'),
            jumlah_tagihan=Count('id'),
            jumlah_lunas=Count('id', filter=Q(status='lunas')),
            jumlah_belum_lunas=Count('id', filter=~Q(status='lunas'))
        ).order_by('siswa__kelas', 'siswa__nama')

        # Convert to serializer format
        result = []
        for item in summary:
            result.append({
                'siswa_nisn': item['siswa__nisn'],
                'siswa_nama': item['siswa__nama'],
                'siswa_kelas': item['siswa__kelas'],
                'total_tagihan': item['total_tagihan'] or Decimal('0.00'),
                'total_terbayar': item['total_terbayar'] or Decimal('0.00'),
                'total_tunggakan': item['total_tunggakan'] or Decimal('0.00'),
                'jumlah_tagihan': item['jumlah_tagihan'],
                'jumlah_lunas': item['jumlah_lunas'],
                'jumlah_belum_lunas': item['jumlah_belum_lunas']
            })

        return Response({
            'success': True,
            'count': len(result),
            'results': result
        })

    @action(detail=False, methods=['post'])
    def generate_bulk(self, request):
        """
        Generate tagihan massal untuk semua siswa aktif.

        POST body:
        {
            "tarif_id": 1,
            "bulan": 3,
            "tahun": 2025,
            "jatuh_tempo": "2025-03-15",
            "kelas": "X A"  // optional, kosongkan untuk semua kelas
        }

        Features:
        - Duplicate Prevention: Skip jika tagihan sudah ada
        - Transaction Safety: Batch insert dengan atomic
        - Auto Invoice Number: Setiap tagihan dapat no_invoice unik
        """
        if request.user.role not in ['superadmin', 'bendahara']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki izin untuk generate tagihan massal'
            }, status=status.HTTP_403_FORBIDDEN)

        tarif_id = request.data.get('tarif_id')
        bulan = request.data.get('bulan')
        tahun = request.data.get('tahun')
        jatuh_tempo = request.data.get('jatuh_tempo')
        kelas_filter = request.data.get('kelas')

        # Validate
        if not all([tarif_id, tahun, jatuh_tempo]):
            return Response({
                'success': False,
                'message': 'tarif_id, tahun, dan jatuh_tempo wajib diisi'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            tarif = Tarif.objects.get(id=tarif_id, aktif=True)
        except Tarif.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Tarif tidak ditemukan atau tidak aktif'
            }, status=status.HTTP_404_NOT_FOUND)

        # Get active students
        students_qs = Student.objects.filter(aktif=True)
        if kelas_filter:
            students_qs = students_qs.filter(kelas=kelas_filter)
        if tarif.kelas:
            students_qs = students_qs.filter(kelas=tarif.kelas)
        if tarif.program:
            students_qs = students_qs.filter(program=tarif.program)

        students = list(students_qs)

        created_count = 0
        skipped_count = 0
        errors = []

        # Use transaction for bulk operation
        try:
            with transaction.atomic():
                for student in students:
                    # SMART GENERATION: Check if tagihan already exists
                    exists = Tagihan.objects.filter(
                        siswa=student,
                        tarif=tarif,
                        bulan=bulan,
                        tahun=tahun
                    ).exists()

                    if exists:
                        skipped_count += 1
                        continue

                    try:
                        # no_invoice akan di-generate otomatis oleh model.save()
                        Tagihan.objects.create(
                            siswa=student,
                            tarif=tarif,
                            bulan=bulan,
                            tahun=tahun,
                            nominal=tarif.nominal,
                            jatuh_tempo=jatuh_tempo,
                            created_by=request.user.username
                        )
                        created_count += 1
                    except Exception as e:
                        errors.append(f"{student.nisn}: {str(e)}")

            logger.info(
                f"[FINANCE] Bulk generate by {request.user.username}: "
                f"tarif={tarif.nama}, created={created_count}, skipped={skipped_count}"
            )

        except Exception as e:
            logger.error(f"[FINANCE] Bulk generate failed: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': f'Gagal generate tagihan: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'success': True,
            'message': f'Generate tagihan selesai',
            'created': created_count,
            'skipped': skipped_count,
            'total_students': len(students),
            'errors': errors if errors else None
        })


# ============================================
# PEMBAYARAN VIEWSET
# ============================================

class PembayaranViewSet(viewsets.ModelViewSet):
    """
    ViewSet untuk manajemen Pembayaran.

    RBAC:
    - Bendahara/Superadmin: Full CRUD, verifikasi
    - Pimpinan: Read all, verifikasi
    - Walisantri: Read & Create (upload bukti bayar)
    """
    queryset = Pembayaran.objects.select_related('tagihan__siswa', 'tagihan__tarif')
    pagination_class = FinancePagination

    def get_serializer_class(self):
        if self.action == 'create':
            return PembayaranCreateSerializer
        elif self.action == 'verify':
            return PembayaranVerifySerializer
        return PembayaranSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            # Delete hanya bendahara
            permission_classes = [IsAuthenticated, IsBendahara]
        elif self.action == 'verify':
            # Verifikasi: bendahara atau pimpinan
            permission_classes = [IsAuthenticated, IsBendahara | IsPimpinan]
        elif self.action == 'create':
            # Walisantri bisa upload bukti bayar
            permission_classes = [IsAuthenticated, IsBendahara | IsWalisantri]
        else:
            permission_classes = [IsAuthenticated, IsBendahara | IsPimpinan | IsWalisantri]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        queryset = Pembayaran.objects.select_related('tagihan__siswa', 'tagihan__tarif')

        # RBAC: Walisantri hanya lihat pembayaran anaknya
        if user.role == 'walisantri':
            linked_nisn = getattr(user, 'linked_student_nisn', None)
            if linked_nisn:
                queryset = queryset.filter(tagihan__siswa__nisn=linked_nisn)
            else:
                queryset = queryset.none()

        # Filter by tagihan
        tagihan_id = self.request.query_params.get('tagihan')
        if tagihan_id:
            queryset = queryset.filter(tagihan_id=tagihan_id)

        # Filter by terverifikasi
        terverifikasi = self.request.query_params.get('terverifikasi')
        if terverifikasi is not None:
            queryset = queryset.filter(terverifikasi=terverifikasi.lower() == 'true')

        # Filter by metode
        metode = self.request.query_params.get('metode')
        if metode:
            queryset = queryset.filter(metode=metode)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(tanggal__gte=start_date)
        if end_date:
            queryset = queryset.filter(tanggal__lte=end_date)

        return queryset.order_by('-tanggal')

    def create(self, request, *args, **kwargs):
        """Override create untuk validasi RBAC walisantri"""
        user = request.user

        # Walisantri hanya bisa bayar tagihan anaknya
        if user.role == 'walisantri':
            tagihan_id = request.data.get('tagihan')
            try:
                tagihan = Tagihan.objects.get(id=tagihan_id)
                if tagihan.siswa.nisn != user.linked_student_nisn:
                    return Response({
                        'success': False,
                        'message': 'Anda hanya bisa membayar tagihan anak Anda sendiri'
                    }, status=status.HTTP_403_FORBIDDEN)
            except Tagihan.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'Tagihan tidak ditemukan'
                }, status=status.HTTP_404_NOT_FOUND)

        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Verifikasi pembayaran dengan Transaction Safety.

        Flow:
        1. Lock pembayaran row untuk update
        2. Update Pembayaran.terverifikasi
        3. Signal post_save akan auto-update Tagihan (terbayar, sisa, status)
        4. Semua dalam transaction.atomic() - berhasil semua atau rollback

        Signal yang terlibat:
        - pre_save Pembayaran: Capture old state
        - post_save Pembayaran: Update tagihan berdasarkan perubahan verifikasi
        """
        pembayaran = self.get_object()

        serializer = PembayaranVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Lock pembayaran row for update
                pembayaran = Pembayaran.objects.select_for_update().get(pk=pembayaran.pk)

                # Update pembayaran fields
                pembayaran.terverifikasi = serializer.validated_data['terverifikasi']
                pembayaran.verified_by = request.user.username
                pembayaran.updated_by = request.user.username
                pembayaran.tanggal_verifikasi = timezone.now()

                if 'keterangan' in serializer.validated_data:
                    pembayaran.keterangan = serializer.validated_data['keterangan']

                # Save akan trigger signal post_save yang akan:
                # 1. Detect perubahan terverifikasi
                # 2. Recalculate tagihan.terbayar dari semua pembayaran verified
                # 3. Update tagihan.sisa dan tagihan.status
                pembayaran.save()

            # Refresh untuk mendapatkan data terbaru (setelah signal update)
            pembayaran.refresh_from_db()

            # Log verification action
            logger.info(
                f"[FINANCE] Payment #{pembayaran.id} {'VERIFIED' if pembayaran.terverifikasi else 'UNVERIFIED'} "
                f"by {request.user.username}"
            )

            return Response({
                'success': True,
                'message': 'Pembayaran berhasil diverifikasi' if pembayaran.terverifikasi else 'Verifikasi dibatalkan',
                'data': PembayaranSerializer(pembayaran).data
            })

        except Exception as e:
            logger.error(f"[FINANCE] Error verifying payment #{pk}: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'message': f'Gagal memverifikasi pembayaran: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        Get pembayaran yang belum diverifikasi.
        """
        queryset = self.get_queryset().filter(terverifikasi=False)
        serializer = PembayaranSerializer(queryset[:50], many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data
        })


# ============================================
# STATISTICS & REPORTS
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsBendahara | IsPimpinan])
def finance_statistics(request):
    """
    Get finance statistics overview.
    """
    tahun = request.query_params.get('tahun', timezone.now().year)
    bulan = request.query_params.get('bulan')

    # Base queryset
    tagihan_qs = Tagihan.objects.filter(tahun=tahun)
    if bulan:
        tagihan_qs = tagihan_qs.filter(bulan=int(bulan))

    # Aggregate statistics
    stats = tagihan_qs.aggregate(
        total_tagihan=Sum('total'),
        total_terbayar=Sum('terbayar'),
        total_tunggakan=Sum('sisa')
    )

    total_tagihan = stats['total_tagihan'] or Decimal('0.00')
    total_terbayar = stats['total_terbayar'] or Decimal('0.00')
    total_tunggakan = stats['total_tunggakan'] or Decimal('0.00')

    # Count by status
    jumlah_siswa_lunas = tagihan_qs.filter(status='lunas').values('siswa').distinct().count()
    jumlah_siswa_tunggakan = tagihan_qs.filter(status__in=['belum_bayar', 'sebagian', 'lewat_jatuh_tempo']).values('siswa').distinct().count()

    # Pending payments
    jumlah_pembayaran_pending = Pembayaran.objects.filter(terverifikasi=False).count()

    # Percentage
    persentase_lunas = 0
    if total_tagihan > 0:
        persentase_lunas = round((total_terbayar / total_tagihan) * 100, 1)

    # Breakdown by kategori
    by_kategori = {}
    kategori_stats = tagihan_qs.values('tarif__kategori').annotate(
        total=Sum('total'),
        terbayar=Sum('terbayar'),
        tunggakan=Sum('sisa')
    )
    for item in kategori_stats:
        kategori = item['tarif__kategori']
        by_kategori[kategori] = {
            'total': item['total'] or Decimal('0.00'),
            'terbayar': item['terbayar'] or Decimal('0.00'),
            'tunggakan': item['tunggakan'] or Decimal('0.00')
        }

    # Recent payments (last 10)
    recent_payments = Pembayaran.objects.select_related(
        'tagihan__siswa', 'tagihan__tarif'
    ).order_by('-tanggal')[:10]

    # Overdue tagihan (top 10)
    overdue_tagihan = tagihan_qs.filter(
        jatuh_tempo__lt=timezone.now().date(),
        status__in=['belum_bayar', 'sebagian']
    ).order_by('jatuh_tempo')[:10]

    return Response({
        'success': True,
        'statistics': {
            'total_tagihan': total_tagihan,
            'total_terbayar': total_terbayar,
            'total_tunggakan': total_tunggakan,
            'jumlah_siswa_lunas': jumlah_siswa_lunas,
            'jumlah_siswa_tunggakan': jumlah_siswa_tunggakan,
            'jumlah_pembayaran_pending': jumlah_pembayaran_pending,
            'persentase_lunas': persentase_lunas
        },
        'by_kategori': by_kategori,
        'recent_payments': PembayaranSerializer(recent_payments, many=True).data,
        'overdue_tagihan': TagihanSerializer(overdue_tagihan, many=True).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsWalisantri | IsBendahara | IsPimpinan])
def student_finance_summary(request, nisn):
    """
    Get finance summary for a specific student.
    Walisantri can only access their linked student's data.
    """
    user = request.user

    # RBAC: Walisantri only access own children (supports multi-child)
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students() if hasattr(user, 'get_linked_students') else [user.linked_student_nisn]
        if nisn not in linked_nisns:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki akses ke data siswa ini'
            }, status=status.HTTP_403_FORBIDDEN)

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Siswa tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    # Get all tagihan
    tagihan_qs = Tagihan.objects.filter(siswa=student).select_related('tarif')

    # Aggregate
    stats = tagihan_qs.aggregate(
        total_tagihan=Sum('total'),
        total_terbayar=Sum('terbayar'),
        total_tunggakan=Sum('sisa')
    )

    # Recent tagihan
    recent_tagihan = tagihan_qs.order_by('-tahun', '-bulan')[:12]

    # Recent pembayaran
    recent_pembayaran = Pembayaran.objects.filter(
        tagihan__siswa=student
    ).select_related('tagihan__tarif').order_by('-tanggal')[:10]

    # Tagihan belum lunas (for dashboard tunggakan card)
    tagihan_belum_lunas = tagihan_qs.filter(status__in=['belum_bayar', 'sebagian', 'lewat_jatuh_tempo'])
    bulan_tertunggak = tagihan_belum_lunas.count()

    # Get earliest due date from unpaid tagihan
    earliest_due = tagihan_belum_lunas.order_by('jatuh_tempo').first()
    jatuh_tempo_str = earliest_due.jatuh_tempo.strftime('%d %b %Y') if earliest_due and earliest_due.jatuh_tempo else '-'

    return Response({
        'success': True,
        'student': {
            'nisn': student.nisn,
            'nama': student.nama,
            'kelas': student.kelas
        },
        'summary': {
            'total_tagihan': stats['total_tagihan'] or Decimal('0.00'),
            'total_terbayar': stats['total_terbayar'] or Decimal('0.00'),
            'total_tunggakan': stats['total_tunggakan'] or Decimal('0.00'),
            'jumlah_tagihan': tagihan_qs.count(),
            'jumlah_lunas': tagihan_qs.filter(status='lunas').count(),
            'bulan_tertunggak': bulan_tertunggak,
            'jatuh_tempo': jatuh_tempo_str
        },
        'recent_tagihan': TagihanSerializer(recent_tagihan, many=True).data,
        'recent_pembayaran': PembayaranSerializer(recent_pembayaran, many=True).data
    })


# ============================================
# AUTOMATED TAGIHAN GENERATION
# ============================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsBendahara])
def generate_monthly_spp(request):
    """
    Generate tagihan SPP bulanan untuk semua siswa aktif.

    Endpoint ini bisa dipanggil:
    1. Manual oleh bendahara
    2. Otomatis via cron job / celery task

    POST body (semua optional):
    {
        "bulan": 3,          // default: bulan sekarang
        "tahun": 2025,       // default: tahun sekarang
        "jatuh_tempo": "2025-03-15"  // default: tanggal 15
    }

    Response:
    - success: bool
    - created: jumlah tagihan baru dibuat
    - skipped: jumlah tagihan yang sudah ada
    - message: pesan hasil
    - details: breakdown per tarif

    Features:
    - Smart Generation: Skip jika tagihan sudah ada
    - Transaction Safety: Atomic operation
    - Auto Invoice Number: Setiap tagihan dapat no_invoice unik
    """
    bulan = request.data.get('bulan', timezone.now().month)
    tahun = request.data.get('tahun', timezone.now().year)
    jatuh_tempo_str = request.data.get('jatuh_tempo')

    # Validate bulan
    if not isinstance(bulan, int) or bulan < 1 or bulan > 12:
        return Response({
            'success': False,
            'message': 'Bulan harus antara 1-12'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Parse jatuh_tempo or use default
    if jatuh_tempo_str:
        try:
            if isinstance(jatuh_tempo_str, str):
                jatuh_tempo = date.fromisoformat(jatuh_tempo_str)
            else:
                jatuh_tempo = jatuh_tempo_str
        except ValueError:
            return Response({
                'success': False,
                'message': 'Format jatuh_tempo tidak valid. Gunakan format: YYYY-MM-DD'
            }, status=status.HTTP_400_BAD_REQUEST)
    else:
        # Default: tanggal 15 bulan tersebut
        jatuh_tempo = date(tahun, bulan, 15)

    # Get bulan name for logging
    bulan_names = {
        1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
        5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
        9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
    }
    bulan_nama = bulan_names.get(bulan, str(bulan))

    logger.info(f"[FINANCE] Generating SPP for {bulan_nama} {tahun} by {request.user.username}")

    # Get all active SPP tarif (kategori=spp, frekuensi=bulanan)
    spp_tarif_list = Tarif.objects.filter(
        kategori='spp',
        frekuensi='bulanan',
        aktif=True
    )

    if not spp_tarif_list.exists():
        logger.warning("[FINANCE] No active SPP tarif found")
        return Response({
            'success': False,
            'message': 'Tidak ada tarif SPP aktif. Silakan buat tarif dengan kategori "SPP" dan frekuensi "Bulanan" terlebih dahulu.',
            'hint': 'Buka tab Master Tarif > Tambah Tarif > Pilih kategori SPP dan frekuensi Bulanan'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if there are active students
    total_active_students = Student.objects.filter(aktif=True).count()
    if total_active_students == 0:
        logger.warning("[FINANCE] No active students found")
        return Response({
            'success': False,
            'message': 'Tidak ada siswa aktif. Pastikan ada siswa dengan status aktif=True.'
        }, status=status.HTTP_400_BAD_REQUEST)

    total_created = 0
    total_skipped = 0
    total_errors = 0
    results = []
    errors = []

    # Use transaction for atomic operation
    try:
        with transaction.atomic():
            for tarif in spp_tarif_list:
                # Get students matching this tarif
                students_qs = Student.objects.filter(aktif=True)

                # Filter by kelas if specified in tarif
                if tarif.kelas:
                    students_qs = students_qs.filter(kelas=tarif.kelas)

                # Filter by program if specified in tarif
                if tarif.program:
                    students_qs = students_qs.filter(program=tarif.program)

                created = 0
                skipped = 0
                student_count = students_qs.count()

                for student in students_qs:
                    # SMART GENERATION: Check if tagihan already exists for this period
                    # Menghindari duplikasi untuk kombinasi: Student + Tarif + Bulan + Tahun
                    exists = Tagihan.objects.filter(
                        siswa=student,
                        tarif=tarif,
                        bulan=bulan,
                        tahun=tahun
                    ).exists()

                    if exists:
                        skipped += 1
                        continue

                    try:
                        # no_invoice akan di-generate otomatis oleh model.save()
                        Tagihan.objects.create(
                            siswa=student,
                            tarif=tarif,
                            bulan=bulan,
                            tahun=tahun,
                            nominal=tarif.nominal,
                            jatuh_tempo=jatuh_tempo,
                            created_by=request.user.username
                        )
                        created += 1
                    except Exception as e:
                        total_errors += 1
                        errors.append({
                            'student': student.nisn,
                            'tarif': tarif.nama,
                            'error': str(e)
                        })
                        logger.error(f"[FINANCE] Error creating tagihan for {student.nisn}: {str(e)}")

                total_created += created
                total_skipped += skipped
                results.append({
                    'tarif': tarif.nama,
                    'nominal': float(tarif.nominal),
                    'target_students': student_count,
                    'created': created,
                    'skipped': skipped
                })

                logger.info(f"[FINANCE] Tarif '{tarif.nama}': created={created}, skipped={skipped}")

    except Exception as e:
        logger.error(f"[FINANCE] Generate SPP failed: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Gagal generate SPP: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Build response message
    if total_created > 0:
        message = f'Berhasil generate {total_created} tagihan SPP untuk {bulan_nama} {tahun}'
    elif total_skipped > 0:
        message = f'Semua tagihan SPP {bulan_nama} {tahun} sudah ada ({total_skipped} tagihan)'
    else:
        message = 'Tidak ada tagihan yang di-generate'

    logger.info(f"[FINANCE] Generate SPP complete: created={total_created}, skipped={total_skipped}")

    response_data = {
        'success': True,
        'message': message,
        'created': total_created,
        'skipped': total_skipped,
        'periode': f'{bulan_nama} {tahun}',
        'jatuh_tempo': str(jatuh_tempo),
        'details': results
    }

    if errors:
        response_data['errors'] = errors
        response_data['error_count'] = total_errors

    return Response(response_data)
