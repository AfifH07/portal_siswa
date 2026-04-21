"""
Kesantrian API Views
====================
API endpoints for Ibadah, Pembinaan, Halaqoh tracking.
Includes Universal Print Engine for rapor generation.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Avg
from django.utils import timezone
from django.http import HttpResponse
from django.template.loader import render_to_string
from datetime import timedelta

from .models import Ibadah, Halaqoh, HalaqohMember, Pembinaan, TargetHafalan
from .serializers import (
    IbadahSerializer, IbadahCreateSerializer,
    PembinaanSerializer, PembinaanCreateSerializer,
    TargetHafalanSerializer, HalaqohSerializer, HalaqohMemberSerializer
)
from .utils import (
    get_student_behavior_summary,
    safe_response,
    calculate_student_metrics,
    aggregate_student_rapor_data
)
from apps.students.models import Student
from apps.grades.models import Grade
from apps.attendance.models import Attendance
from apps.accounts.permissions import IsWalisantri


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_children_summary(request):
    """
    Get summary of all linked children for walisantri.

    Returns ibadah (sholat) summary, hafalan progress, and recent pembinaan
    for each child linked to the walisantri account.

    Response:
    {
        "success": true,
        "total_children": 2,
        "children": [
            {
                "nisn": "20260001",
                "nama": "Ahmad Rizki",
                "kelas": "X A",
                "ibadah_summary": {
                    "today": {"subuh": "hadir", "dzuhur": "hadir", ...},
                    "week_percentage": 85.7,
                    "total_hadir": 30,
                    "total_sholat": 35
                },
                "hafalan_progress": {
                    "target_juz": 3,
                    "tercapai_juz": 1.5,
                    "persentase": 50.0
                },
                "recent_pembinaan": [...],
                "halaqoh": [...]
            }
        ]
    }
    """
    user = request.user

    # Only walisantri can access
    if user.role != 'walisantri':
        return Response(
            {'success': False, 'message': 'Endpoint ini hanya untuk walisantri'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get all linked student NISNs
    nisn_list = user.get_linked_students()

    if not nisn_list:
        return Response({
            'success': True,
            'total_children': 0,
            'children': [],
            'message': 'Belum ada anak yang terhubung'
        })

    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    waktu_sholat_wajib = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']

    children_data = []

    for nisn in nisn_list:
        try:
            student = Student.objects.get(nisn=nisn)
        except Student.DoesNotExist:
            continue

        # ========================
        # IBADAH SUMMARY
        # ========================
        # Today's sholat status
        today_ibadah = Ibadah.objects.filter(
            siswa=student,
            tanggal=today,
            jenis='sholat_wajib'
        ).values('waktu', 'status')

        today_status = {w: None for w in waktu_sholat_wajib}
        for ib in today_ibadah:
            if ib['waktu'] in today_status:
                today_status[ib['waktu']] = ib['status']

        # Week summary
        week_ibadah = Ibadah.objects.filter(
            siswa=student,
            tanggal__gte=week_ago,
            tanggal__lte=today,
            jenis='sholat_wajib',
            waktu__in=waktu_sholat_wajib
        )

        total_sholat = week_ibadah.count()
        total_hadir = week_ibadah.filter(status='hadir').count()
        week_percentage = round((total_hadir / total_sholat * 100), 1) if total_sholat > 0 else 0

        ibadah_summary = {
            'today': today_status,
            'week_percentage': week_percentage,
            'total_hadir': total_hadir,
            'total_sholat': total_sholat,
            'expected_week': 7 * 5  # 7 days × 5 sholat wajib
        }

        # ========================
        # HAFALAN PROGRESS
        # ========================
        current_semester = 'Ganjil'  # TODO: Calculate based on current date
        current_year = '2025/2026'

        hafalan = TargetHafalan.objects.filter(
            siswa=student,
            semester=current_semester,
            tahun_ajaran=current_year
        ).first()

        if hafalan:
            hafalan_progress = {
                'target_juz': float(hafalan.target_juz),
                'tercapai_juz': float(hafalan.tercapai_juz),
                'persentase': hafalan.persentase_tercapai
            }
        else:
            # Fallback to student's current_hafalan field
            hafalan_progress = {
                'target_juz': student.target_hafalan or 0,
                'tercapai_juz': student.current_hafalan or 0,
                'persentase': round((student.current_hafalan / student.target_hafalan * 100), 1) if student.target_hafalan else 0
            }

        # ========================
        # RECENT PEMBINAAN
        # ========================
        recent_pembinaan = Pembinaan.objects.filter(
            siswa=student
        ).order_by('-tanggal')[:5]

        pembinaan_list = []
        for p in recent_pembinaan:
            pembinaan_list.append({
                'id': p.id,
                'tanggal': p.tanggal.isoformat(),
                'kategori': p.kategori,
                'kategori_display': p.get_kategori_display(),
                'judul': p.judul,
                'tingkat': p.tingkat,
                'tingkat_display': p.get_tingkat_display()
            })

        # ========================
        # HALAQOH MEMBERSHIP
        # ========================
        halaqoh_memberships = HalaqohMember.objects.filter(
            siswa=student,
            aktif=True
        ).select_related('halaqoh')

        halaqoh_list = []
        for hm in halaqoh_memberships:
            halaqoh_list.append({
                'nama': hm.halaqoh.nama,
                'jenis': hm.halaqoh.jenis,
                'musyrif': hm.halaqoh.musyrif,
                'jadwal': hm.halaqoh.jadwal
            })

        # Build child data
        children_data.append({
            'nisn': student.nisn,
            'nama': student.nama,
            'kelas': student.kelas,
            'foto': None,  # TODO: Add foto field
            'ibadah_summary': ibadah_summary,
            'hafalan_progress': hafalan_progress,
            'recent_pembinaan': pembinaan_list,
            'halaqoh': halaqoh_list
        })

    return Response({
        'success': True,
        'total_children': len(children_data),
        'children': children_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_ibadah_detail(request, nisn):
    """
    Get detailed ibadah records for a specific child.

    Query params:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - jenis: Filter by jenis (sholat_wajib, sholat_sunnah, puasa, etc.)
    """
    user = request.user

    # Walisantri can only access their linked children
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Parse query params
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    jenis = request.query_params.get('jenis')

    queryset = Ibadah.objects.filter(siswa=student)

    if start_date:
        queryset = queryset.filter(tanggal__gte=start_date)
    if end_date:
        queryset = queryset.filter(tanggal__lte=end_date)
    if jenis:
        queryset = queryset.filter(jenis=jenis)

    queryset = queryset.order_by('-tanggal', 'waktu')

    serializer = IbadahSerializer(queryset, many=True)

    return Response({
        'success': True,
        'nisn': nisn,
        'nama': student.nama,
        'count': queryset.count(),
        'data': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_child_pembinaan(request, nisn):
    """Get pembinaan records for a specific child."""
    user = request.user

    # Walisantri can only access their linked children
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    kategori = request.query_params.get('kategori')

    queryset = Pembinaan.objects.filter(siswa=student)

    if kategori:
        queryset = queryset.filter(kategori=kategori)

    queryset = queryset.order_by('-tanggal')

    serializer = PembinaanSerializer(queryset, many=True)

    return Response({
        'success': True,
        'nisn': nisn,
        'nama': student.nama,
        'count': queryset.count(),
        'data': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_ibadah(request):
    """
    Record ibadah for a student.
    Only musyrif, guru, or superadmin can record ibadah.
    """
    user = request.user

    if user.role not in ['musyrif', 'guru', 'superadmin']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin untuk mencatat ibadah'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = IbadahCreateSerializer(data=request.data)

    if serializer.is_valid():
        # Set pencatat from logged-in user
        ibadah = serializer.save(pencatat=user.username)
        return Response({
            'success': True,
            'message': 'Ibadah berhasil dicatat',
            'data': IbadahSerializer(ibadah).data
        }, status=status.HTTP_201_CREATED)

    return Response({
        'success': False,
        'message': 'Data tidak valid',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_ibadah_bulk(request):
    """
    Bulk record ibadah for multiple students.

    Request body:
    {
        "tanggal": "2026-03-05",
        "jenis": "sholat_wajib",
        "waktu": "subuh",
        "records": [
            {"nisn": "20260001", "status": "hadir"},
            {"nisn": "20260002", "status": "terlambat"},
            ...
        ]
    }
    """
    user = request.user

    if user.role not in ['musyrif', 'guru', 'superadmin']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    tanggal = request.data.get('tanggal')
    jenis = request.data.get('jenis')
    waktu = request.data.get('waktu')
    records = request.data.get('records', [])

    if not all([tanggal, jenis, records]):
        return Response(
            {'success': False, 'message': 'tanggal, jenis, dan records wajib diisi'},
            status=status.HTTP_400_BAD_REQUEST
        )

    success_count = 0
    error_count = 0
    errors = []

    for record in records:
        nisn = record.get('nisn')
        record_status = record.get('status', 'hadir')

        try:
            student = Student.objects.get(nisn=nisn)

            ibadah, created = Ibadah.objects.update_or_create(
                siswa=student,
                tanggal=tanggal,
                jenis=jenis,
                waktu=waktu,
                defaults={
                    'status': record_status,
                    'catatan': record.get('catatan'),
                    'pencatat': user.username
                }
            )
            success_count += 1

        except Student.DoesNotExist:
            error_count += 1
            errors.append(f'NISN {nisn} tidak ditemukan')
        except Exception as e:
            error_count += 1
            errors.append(f'Error untuk {nisn}: {str(e)}')

    return Response({
        'success': True,
        'message': f'Berhasil mencatat {success_count} ibadah, {error_count} gagal',
        'success_count': success_count,
        'error_count': error_count,
        'errors': errors if errors else None
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_worship_tracker(request, nisn):
    """
    Get worship (sholat) tracker for a student.

    Query params:
    - days: Number of days to fetch (default: 7, max: 30)

    Returns status of 5 daily prayers for the specified period.

    Response:
    {
        "success": true,
        "nisn": "20260001",
        "nama": "Ahmad Rizki",
        "days": 7,
        "week_data": [
            {
                "tanggal": "2026-03-05",
                "hari": "Rabu",
                "subuh": "hadir",
                "dzuhur": "hadir",
                "ashar": "terlambat",
                "maghrib": "hadir",
                "isya": "hadir"
            },
            ...
        ],
        "summary": {
            "total_hadir": 30,
            "total_sholat": 35,
            "persentase": 85.7
        }
    }
    """
    user = request.user

    # Walisantri can only access their linked children
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get days parameter (default 7, max 30)
    try:
        days = int(request.query_params.get('days', 7))
        days = min(max(days, 1), 30)  # Clamp between 1-30
    except (ValueError, TypeError):
        days = 7

    today = timezone.now().date()
    waktu_list = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']
    hari_names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

    week_data = []
    total_hadir = 0
    total_sholat = 0

    for i in range(days):
        tanggal = today - timedelta(days=i)
        hari = hari_names[tanggal.weekday()]

        day_ibadah = Ibadah.objects.filter(
            siswa=student,
            tanggal=tanggal,
            jenis='sholat_wajib'
        ).values('waktu', 'status')

        day_status = {w: None for w in waktu_list}
        for ib in day_ibadah:
            if ib['waktu'] in day_status:
                day_status[ib['waktu']] = ib['status']
                total_sholat += 1
                if ib['status'] == 'hadir':
                    total_hadir += 1

        week_data.append({
            'tanggal': tanggal.isoformat(),
            'hari': hari,
            **day_status
        })

    persentase = round((total_hadir / total_sholat * 100), 1) if total_sholat > 0 else 0

    return Response({
        'success': True,
        'nisn': nisn,
        'nama': student.nama,
        'days': days,
        'week_data': week_data,
        'summary': {
            'total_hadir': total_hadir,
            'total_sholat': total_sholat,
            'persentase': persentase
        }
    })


# ============================================================
# UNIVERSAL PRINT ENGINE - Rapor Generation
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_rapor_data(request, nisn):
    """
    Get comprehensive rapor data for a student (JSON format).

    Uses the Unified Data Aggregator for optimized queries (max 7 queries).

    Security:
    - walisantri: Only allowed if NISN is in linked_student_nisns
    - superadmin/pimpinan/guru/musyrif: Allowed for all students

    Query params:
    - semester: 'Ganjil' or 'Genap' (default: 'Ganjil')
    - tahun_ajaran: e.g., '2025/2026' (default: '2025/2026')
    - days: Period for ibadah/pembinaan analysis (default: 30)
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Parse query params
    semester = request.query_params.get('semester', 'Ganjil')
    tahun_ajaran = request.query_params.get('tahun_ajaran', '2025/2026')

    try:
        days = int(request.query_params.get('days', 30))
        days = max(1, min(365, days))
    except ValueError:
        days = 30

    # Use Unified Data Aggregator (optimized: max 7 queries)
    rapor_data = aggregate_student_rapor_data(
        nisn=nisn,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        days=days
    )

    # Ensure null-safe response
    rapor_data = safe_response(rapor_data)

    if not rapor_data.get('success'):
        return Response(rapor_data, status=status.HTTP_404_NOT_FOUND)

    return Response(rapor_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_rapor_html(request, nisn):
    """
    Get rapor as HTML for printing.

    Uses the Unified Data Aggregator for optimized queries (max 7 queries).

    Query params:
    - semester: 'Ganjil' or 'Genap' (default: 'Ganjil')
    - tahun_ajaran: e.g., '2025/2026' (default: '2025/2026')
    - days: Period for ibadah/pembinaan analysis (default: 30)
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Parse query params
    semester = request.query_params.get('semester', 'Ganjil')
    tahun_ajaran = request.query_params.get('tahun_ajaran', '2025/2026')

    try:
        days = int(request.query_params.get('days', 30))
        days = max(1, min(365, days))
    except ValueError:
        days = 30

    # Use Unified Data Aggregator (optimized: max 7 queries)
    rapor_data = aggregate_student_rapor_data(
        nisn=nisn,
        semester=semester,
        tahun_ajaran=tahun_ajaran,
        days=days
    )

    # Ensure null-safe response
    rapor_data = safe_response(rapor_data)

    if not rapor_data.get('success'):
        return Response(rapor_data, status=status.HTTP_404_NOT_FOUND)

    # Get student object for template
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Transform data for template compatibility
    template_data = {
        'rapor': {
            'success': True,
            'generated_at': rapor_data['meta']['generated_at'],
            'semester': rapor_data['meta']['semester'],
            'tahun_ajaran': rapor_data['meta']['tahun_ajaran'],
            'student': rapor_data['student'],
            'academic': rapor_data['academic'],
            'diniyah': rapor_data['diniyah'],
            'hafalan': rapor_data['hafalan'],
            'ibadah': {
                'detail': rapor_data['attendance']['ibadah']['detail'],
                'overall_percentage': rapor_data['attendance']['ibadah']['overall_percentage']
            },
            'attendance': rapor_data['attendance']['sekolah'],
            'pembinaan': rapor_data['pembinaan'],
            'halaqoh': rapor_data['halaqoh'],
            'metrics': rapor_data['metrics']
        },
        'student': student
    }

    try:
        html_content = render_to_string('kesantrian/rapor_template.html', template_data)
        return HttpResponse(html_content, content_type='text/html')
    except Exception as e:
        import traceback
        return HttpResponse(
            f"<h1>Error rendering template</h1><pre>{traceback.format_exc()}</pre>",
            content_type='text/html',
            status=500
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chart_data(request, nisn):
    """
    Get data formatted for dual-chart visualization.

    Returns:
    - academic_chart: Data for radar/bar chart (academic subjects)
    - diniyah_chart: Data for hafalan + diniyah subjects chart
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Akses ditolak'},
                status=status.HTTP_403_FORBIDDEN
            )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get grades
    grades = Grade.objects.filter(nisn=student)

    # Define subject categories
    academic_subjects = ['Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'IPA', 'IPS', 'PKN']
    diniyah_subjects = ['Aqidah', 'Fiqih', 'Al-Quran Hadist', 'Bahasa Arab', 'Akhlak']

    # Chart A: Academic subjects
    academic_data = {
        'labels': [],
        'values': [],
        'colors': {
            'background': 'rgba(31, 168, 122, 0.2)',  # emerald600 with opacity
            'border': '#1fa87a'  # emerald600
        }
    }

    for subj in academic_subjects:
        avg = grades.filter(mata_pelajaran=subj).aggregate(avg=Avg('nilai'))['avg']
        academic_data['labels'].append(subj)
        academic_data['values'].append(round(avg, 1) if avg else 0)

    # Chart B: Diniyah + Hafalan
    diniyah_data = {
        'labels': [],
        'values': [],
        'colors': {
            'background': 'rgba(200, 150, 28, 0.2)',  # baronGold with opacity
            'border': '#c8961c'  # baronGold
        }
    }

    for subj in diniyah_subjects:
        avg = grades.filter(mata_pelajaran=subj).aggregate(avg=Avg('nilai'))['avg']
        diniyah_data['labels'].append(subj)
        diniyah_data['values'].append(round(avg, 1) if avg else 0)

    # Add hafalan progress to diniyah chart
    hafalan_progress = round((student.current_hafalan / student.target_hafalan * 100), 1) if student.target_hafalan else 0
    diniyah_data['labels'].append('Hafalan')
    diniyah_data['values'].append(hafalan_progress)

    return Response({
        'success': True,
        'nisn': nisn,
        'nama': student.nama,
        'academic_chart': academic_data,
        'diniyah_chart': diniyah_data
    })


# ============================================================
# BEHAVIOR SUMMARY API - Logic Engine Endpoint
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_behavior_summary(request, nisn):
    """
    Get comprehensive behavior summary for a student.

    Uses the Logic Engine (utils.py) to calculate:
    - Ibadah (sholat) attendance percentage by waktu
    - Pembinaan scores (prestasi vs pelanggaran)
    - Hafalan progress
    - Overall weighted score (Ibadah 40%, Perilaku 30%, Hafalan 30%)

    Query params:
    - days: Number of days to analyze (default: 30)

    Response uses safe_response() to ensure no null values.
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get days parameter
    try:
        days = int(request.query_params.get('days', 30))
        days = max(1, min(365, days))  # Clamp between 1-365 days
    except ValueError:
        days = 30

    # Call Logic Engine
    result = get_student_behavior_summary(nisn, days=days)

    # Ensure clean response (no null values)
    clean_result = safe_response(result)

    if not clean_result.get('success'):
        return Response(clean_result, status=status.HTTP_404_NOT_FOUND)

    return Response(clean_result)


# ============================================================
# STUDENT METRICS API - Weighted Scoring (v2)
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_metrics(request, nisn):
    """
    Get comprehensive student metrics with weighted scoring.

    Weights:
    - Ibadah (40%): Sholat Wajib & Sunnah attendance
    - Akademik (30%): Average grades
    - Hafalan (20%): Progress toward target
    - Perilaku (10%): Pembinaan points

    Predikat System:
    - Mumtaz (>85): Excellent
    - Jayyid Jiddan (70-85): Very Good
    - Jayyid (60-70): Good
    - Perlu Pembinaan (<60): Needs Guidance

    Query params:
    - days: Number of days to analyze (default: 30)

    Response is null-safe via safe_response() wrapper.
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get days parameter
    try:
        days = int(request.query_params.get('days', 30))
        days = max(1, min(365, days))  # Clamp between 1-365 days
    except ValueError:
        days = 30

    # Call weighted metrics calculator
    result = calculate_student_metrics(nisn, days=days)

    # Ensure clean response (no null values)
    clean_result = safe_response(result)

    if not clean_result.get('success'):
        return Response(clean_result, status=status.HTTP_404_NOT_FOUND)

    return Response(clean_result)


# ============================================================
# BLP (BUKU LAPANGAN PESANTREN) API
# ============================================================

from .models import BLPEntry, EmployeeEvaluation, InvalRecord, BLP_INDICATORS, Incident, IncidentComment, AsatidzEvaluation
from .serializers import (
    BLPEntrySerializer, BLPEntryCreateSerializer, BLPEntryListSerializer,
    BLPIndicatorInfoSerializer,
    EmployeeEvaluationSerializer, EmployeeEvaluationCreateSerializer,
    InvalRecordSerializer, InvalRecordCreateSerializer, InvalRecordVerifySerializer,
    IncidentSerializer, IncidentListSerializer, IncidentCreateSerializer,
    IncidentResolveSerializer, IncidentSummarySerializer,
    IncidentCommentSerializer, IncidentCommentCreateSerializer,
    AsatidzEvaluationSerializer, AsatidzEvaluationListSerializer,
    AsatidzEvaluationCreateSerializer, AsatidzEvaluationSummarySerializer
)
from apps.accounts.permissions import IsAsatidzEvaluationAllowed


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_blp_indicators(request):
    """
    Get all BLP indicators structure.

    Returns 59 indicators grouped in 6 domains:
    - akhlak (12 indicators)
    - kedisiplinan (10 indicators)
    - ibadah (15 indicators)
    - akademik (8 indicators)
    - sosial (8 indicators)
    - pengembangan_diri (6 indicators)

    Each indicator scored 0-5, total max 295 + 95 bonus = 390
    """
    indicators = BLPIndicatorInfoSerializer.get_all_indicators()

    return Response({
        'success': True,
        'total_indicators': 59,
        'max_base_score': 295,
        'max_bonus': 95,
        'max_total_score': 390,
        'domains': indicators
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def blp_list_create(request):
    """
    GET: List BLP entries with filters
    POST: Create new BLP entry

    Query params (GET):
    - siswa_nisn: Filter by student NISN
    - kelas: Filter by class
    - week_start: Filter by week start date
    - tahun_ajaran: Filter by academic year
    - semester: Filter by semester
    - status: Filter by status (draft/submitted/locked)

    Permissions:
    - musyrif, guru: Can create/view
    - walisantri: Can view own children only
    - superadmin, pimpinan: Full access
    """
    user = request.user

    # Check permissions
    allowed_roles = ['musyrif', 'guru', 'superadmin', 'pimpinan']

    if request.method == 'GET':
        # Walisantri can view their children's BLP
        if user.role == 'walisantri':
            linked_nisns = user.get_linked_students()
            queryset = BLPEntry.objects.filter(
                siswa__nisn__in=linked_nisns
            ).select_related('siswa')
        elif user.role in allowed_roles:
            queryset = BLPEntry.objects.all().select_related('siswa')

            # Apply filters
            siswa_nisn = request.query_params.get('siswa_nisn')
            kelas = request.query_params.get('kelas')
            week_start = request.query_params.get('week_start')
            tahun_ajaran = request.query_params.get('tahun_ajaran')
            semester = request.query_params.get('semester')
            blp_status = request.query_params.get('status')

            if siswa_nisn:
                queryset = queryset.filter(siswa__nisn=siswa_nisn)
            if kelas:
                queryset = queryset.filter(siswa__kelas=kelas)
            if week_start:
                queryset = queryset.filter(week_start=week_start)
            if tahun_ajaran:
                queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
            if semester:
                queryset = queryset.filter(semester=semester)
            if blp_status:
                queryset = queryset.filter(status=blp_status)
        else:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin'},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = queryset.order_by('-week_start', 'siswa__nama')
        serializer = BLPEntryListSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        if user.role not in allowed_roles:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin untuk membuat BLP'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Set pencatat from logged-in user
        data = request.data.copy()
        data['pencatat'] = user.name if hasattr(user, 'name') else user.username
        data['pencatat_username'] = user.username

        serializer = BLPEntryCreateSerializer(data=data)

        if serializer.is_valid():
            blp_entry = serializer.save()
            return Response({
                'success': True,
                'message': 'BLP Entry berhasil dibuat',
                'data': BLPEntrySerializer(blp_entry).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def blp_detail(request, pk):
    """
    GET: Retrieve BLP entry detail
    PUT/PATCH: Update BLP entry

    Only editable if:
    - status != 'locked'
    - is_locked = False
    - week_end + 1 day hasn't passed
    """
    user = request.user

    try:
        blp_entry = BLPEntry.objects.select_related('siswa').get(pk=pk)
    except BLPEntry.DoesNotExist:
        return Response(
            {'success': False, 'message': 'BLP Entry tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Security check
    allowed_roles = ['musyrif', 'guru', 'superadmin', 'pimpinan']

    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if blp_entry.siswa.nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in allowed_roles:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        serializer = BLPEntrySerializer(blp_entry)
        return Response({
            'success': True,
            'data': serializer.data
        })

    elif request.method in ['PUT', 'PATCH']:
        # Walisantri cannot edit
        if user.role == 'walisantri':
            return Response(
                {'success': False, 'message': 'Walisantri tidak dapat mengedit BLP'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if editable
        if not blp_entry.is_editable():
            return Response(
                {'success': False, 'message': 'BLP Entry sudah dikunci dan tidak dapat diubah'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = BLPEntryCreateSerializer(
            blp_entry,
            data=request.data,
            partial=(request.method == 'PATCH')
        )

        if serializer.is_valid():
            blp_entry = serializer.save()
            return Response({
                'success': True,
                'message': 'BLP Entry berhasil diupdate',
                'data': BLPEntrySerializer(blp_entry).data
            })

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def blp_lock(request, pk):
    """
    Lock BLP entry manually.

    Only superadmin, pimpinan, or the original pencatat can lock.
    """
    user = request.user

    try:
        blp_entry = BLPEntry.objects.get(pk=pk)
    except BLPEntry.DoesNotExist:
        return Response(
            {'success': False, 'message': 'BLP Entry tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check permissions
    if user.role not in ['superadmin', 'pimpinan'] and user.username != blp_entry.pencatat_username:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin untuk mengunci BLP ini'},
            status=status.HTTP_403_FORBIDDEN
        )

    if blp_entry.is_locked:
        return Response({
            'success': False,
            'message': 'BLP Entry sudah dikunci sebelumnya'
        }, status=status.HTTP_400_BAD_REQUEST)

    blp_entry.lock(user.username)

    return Response({
        'success': True,
        'message': 'BLP Entry berhasil dikunci',
        'data': BLPEntrySerializer(blp_entry).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def blp_student_history(request, nisn):
    """
    Get BLP history for a specific student.

    Query params:
    - tahun_ajaran: Filter by academic year
    - semester: Filter by semester
    - limit: Number of records (default: 10)
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['musyrif', 'guru', 'superadmin', 'pimpinan']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    queryset = BLPEntry.objects.filter(siswa=student)

    # Apply filters
    tahun_ajaran = request.query_params.get('tahun_ajaran')
    semester = request.query_params.get('semester')

    if tahun_ajaran:
        queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
    if semester:
        queryset = queryset.filter(semester=semester)

    try:
        limit = int(request.query_params.get('limit', 10))
        limit = max(1, min(100, limit))
    except ValueError:
        limit = 10

    queryset = queryset.order_by('-week_start')[:limit]

    # Calculate summary
    all_entries = BLPEntry.objects.filter(siswa=student)
    avg_score = all_entries.aggregate(avg=Avg('total_score'))['avg'] or 0

    serializer = BLPEntryListSerializer(queryset, many=True)

    return Response({
        'success': True,
        'student': {
            'nisn': student.nisn,
            'nama': student.nama,
            'kelas': student.kelas
        },
        'summary': {
            'total_entries': all_entries.count(),
            'average_score': round(avg_score, 1),
            'latest_score': queryset.first().total_score if queryset.exists() else 0
        },
        'count': queryset.count(),
        'data': serializer.data
    })


# ============================================================
# INVAL RECORD API (AUTO-INVAL SYSTEM)
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def inval_list_create(request):
    """
    GET: List inval records
    POST: Create new inval record (triggers Auto-Inval signal)

    Query params (GET):
    - tanggal: Filter by date
    - kelas: Filter by class
    - status: Filter by status (pending/verified/rejected)
    - guru_absent: Filter by absent teacher ID
    - guru_pengganti: Filter by substitute teacher ID

    Permissions:
    - guru, musyrif (piket): Can create inval records
    - superadmin, pimpinan: Full access
    """
    user = request.user

    allowed_roles = ['guru', 'musyrif', 'superadmin', 'pimpinan']

    if user.role not in allowed_roles:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        queryset = InvalRecord.objects.all().select_related(
            'guru_absent', 'guru_pengganti', 'recorded_by'
        )

        # Apply filters
        tanggal = request.query_params.get('tanggal')
        kelas = request.query_params.get('kelas')
        inval_status = request.query_params.get('status')
        guru_absent = request.query_params.get('guru_absent')
        guru_pengganti = request.query_params.get('guru_pengganti')

        if tanggal:
            queryset = queryset.filter(tanggal=tanggal)
        if kelas:
            queryset = queryset.filter(kelas=kelas)
        if inval_status:
            queryset = queryset.filter(status=inval_status)
        if guru_absent:
            queryset = queryset.filter(guru_absent_id=guru_absent)
        if guru_pengganti:
            queryset = queryset.filter(guru_pengganti_id=guru_pengganti)

        queryset = queryset.order_by('-tanggal', '-created_at')
        serializer = InvalRecordSerializer(queryset, many=True)

        # Summary stats
        total = queryset.count()
        pending = queryset.filter(status='pending').count()
        verified = queryset.filter(status='verified').count()

        return Response({
            'success': True,
            'summary': {
                'total': total,
                'pending': pending,
                'verified': verified,
                'rejected': total - pending - verified
            },
            'count': total,
            'data': serializer.data
        })

    elif request.method == 'POST':
        data = request.data.copy()
        data['recorded_by'] = user.id
        data['recorded_by_username'] = user.username

        serializer = InvalRecordCreateSerializer(data=data)

        if serializer.is_valid():
            inval_record = serializer.save()

            # Signal will auto-create EmployeeEvaluation records
            return Response({
                'success': True,
                'message': 'Inval record berhasil dibuat. Evaluasi akan otomatis diproses.',
                'data': InvalRecordSerializer(inval_record).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inval_detail(request, pk):
    """Get inval record detail."""
    user = request.user

    allowed_roles = ['guru', 'musyrif', 'superadmin', 'pimpinan']

    if user.role not in allowed_roles:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        inval_record = InvalRecord.objects.select_related(
            'guru_absent', 'guru_pengganti', 'recorded_by'
        ).get(pk=pk)
    except InvalRecord.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Inval record tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get related evaluations
    evaluations = EmployeeEvaluation.objects.filter(inval_record=inval_record)

    return Response({
        'success': True,
        'data': InvalRecordSerializer(inval_record).data,
        'evaluations': EmployeeEvaluationSerializer(evaluations, many=True).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def inval_verify(request, pk):
    """
    Verify or reject inval record.

    Request body:
    {
        "action": "verify" | "reject",
        "rejection_reason": "..." (required if action=reject)
    }

    Only superadmin, pimpinan, or kepala_sekolah can verify.
    """
    user = request.user

    if user.role not in ['superadmin', 'pimpinan']:
        return Response(
            {'success': False, 'message': 'Hanya pimpinan yang dapat memverifikasi inval'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        inval_record = InvalRecord.objects.get(pk=pk)
    except InvalRecord.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Inval record tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    if inval_record.status != 'pending':
        return Response({
            'success': False,
            'message': f'Inval record sudah {inval_record.get_status_display()}'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = InvalRecordVerifySerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    action = serializer.validated_data['action']

    if action == 'verify':
        inval_record.verify(user.username)
        message = 'Inval record berhasil diverifikasi'
    else:
        rejection_reason = serializer.validated_data['rejection_reason']
        inval_record.reject(user.username, rejection_reason)
        message = 'Inval record ditolak'

    return Response({
        'success': True,
        'message': message,
        'data': InvalRecordSerializer(inval_record).data
    })


# ============================================================
# EMPLOYEE EVALUATION API
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_evaluation_list(request):
    """
    Get employee evaluation list.

    Query params:
    - user_id: Filter by user ID
    - jenis: Filter by type
    - tahun_ajaran: Filter by academic year
    - semester: Filter by semester
    """
    user = request.user

    # Only admin roles can view all, teachers can view their own
    if user.role in ['superadmin', 'pimpinan']:
        queryset = EmployeeEvaluation.objects.all()
    elif user.role in ['guru', 'musyrif']:
        # Can view their own evaluations
        queryset = EmployeeEvaluation.objects.filter(user=user)
    else:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Apply filters (admin only)
    if user.role in ['superadmin', 'pimpinan']:
        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

    jenis = request.query_params.get('jenis')
    tahun_ajaran = request.query_params.get('tahun_ajaran')
    semester = request.query_params.get('semester')

    if jenis:
        queryset = queryset.filter(jenis=jenis)
    if tahun_ajaran:
        queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
    if semester:
        queryset = queryset.filter(semester=semester)

    queryset = queryset.select_related('user').order_by('-tanggal', '-created_at')

    # Calculate totals
    from django.db.models import Sum
    total_poin = queryset.aggregate(total=Sum('poin'))['total'] or 0

    serializer = EmployeeEvaluationSerializer(queryset, many=True)

    return Response({
        'success': True,
        'summary': {
            'total_records': queryset.count(),
            'total_poin': total_poin
        },
        'data': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_evaluation_summary(request, user_id):
    """
    Get evaluation summary for a specific employee.

    Query params:
    - tahun_ajaran: Filter by academic year
    - semester: Filter by semester
    """
    user = request.user

    # Check permissions
    if user.role not in ['superadmin', 'pimpinan']:
        if user.id != user_id:
            return Response(
                {'success': False, 'message': 'Anda hanya dapat melihat evaluasi Anda sendiri'},
                status=status.HTTP_403_FORBIDDEN
            )

    from apps.accounts.models import User
    from django.db.models import Sum, Count

    try:
        target_user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response(
            {'success': False, 'message': 'User tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    queryset = EmployeeEvaluation.objects.filter(user=target_user)

    # Apply filters
    tahun_ajaran = request.query_params.get('tahun_ajaran')
    semester = request.query_params.get('semester')

    if tahun_ajaran:
        queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
    if semester:
        queryset = queryset.filter(semester=semester)

    # Calculate summary
    summary = queryset.aggregate(
        total_poin=Sum('poin'),
        total_records=Count('id')
    )

    # Count by jenis
    prestasi_count = queryset.filter(jenis='prestasi').count()
    pelanggaran_count = queryset.filter(jenis='pelanggaran').count()
    inval_plus = queryset.filter(jenis='inval_plus').count()
    inval_minus = queryset.filter(jenis='inval_minus').count()

    # Recent evaluations
    recent = queryset.order_by('-tanggal', '-created_at')[:10]

    return Response({
        'success': True,
        'user': {
            'id': target_user.id,
            'name': target_user.name,
            'username': target_user.username,
            'role': target_user.role
        },
        'summary': {
            'total_poin': summary['total_poin'] or 0,
            'total_records': summary['total_records'] or 0,
            'prestasi_count': prestasi_count,
            'pelanggaran_count': pelanggaran_count,
            'inval_plus_count': inval_plus,
            'inval_minus_count': inval_minus
        },
        'recent_evaluations': EmployeeEvaluationSerializer(recent, many=True).data
    })


# ============================================================
# PDF REPORT DOWNLOAD API
# ============================================================

from .pdf_generator import generate_rapor_pdf, generate_blp_report_pdf


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_rapor_pdf(request, nisn):
    """
    Download comprehensive rapor as PDF.

    Query params:
    - semester: 'Ganjil' or 'Genap' (default: 'Ganjil')
    - tahun_ajaran: e.g., '2025/2026' (default: '2025/2026')

    Security:
    - walisantri: Only allowed if NISN is in linked_student_nisns
    - superadmin/pimpinan/guru/musyrif: Allowed for all students
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Parse query params
    semester = request.query_params.get('semester', 'Ganjil')
    tahun_ajaran = request.query_params.get('tahun_ajaran', '2025/2026')

    try:
        # Generate PDF
        pdf_buffer = generate_rapor_pdf(nisn, semester, tahun_ajaran)

        # Get student name for filename
        try:
            student = Student.objects.get(nisn=nisn)
            filename = f"Rapor_{student.nama.replace(' ', '_')}_{semester}_{tahun_ajaran.replace('/', '-')}.pdf"
        except Student.DoesNotExist:
            filename = f"Rapor_{nisn}_{semester}_{tahun_ajaran.replace('/', '-')}.pdf"

        # Return PDF response
        from django.http import FileResponse
        response = FileResponse(
            pdf_buffer,
            content_type='application/pdf',
            as_attachment=True,
            filename=filename
        )

        return response

    except ValueError as e:
        return Response(
            {'success': False, 'message': str(e)},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        return Response(
            {'success': False, 'message': f'Error generating PDF: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_blp_pdf(request, nisn):
    """
    Download BLP-specific report as PDF.

    Query params:
    - week_start: Optional specific week start date (YYYY-MM-DD)

    Security: Same as download_rapor_pdf
    """
    user = request.user

    # Security check
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )
    elif user.role not in ['superadmin', 'pimpinan', 'guru', 'musyrif']:
        return Response(
            {'success': False, 'message': 'Anda tidak memiliki izin'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Parse query params
    week_start = request.query_params.get('week_start')

    try:
        # Generate PDF
        pdf_buffer = generate_blp_report_pdf(nisn, week_start)

        # Get student name for filename
        try:
            student = Student.objects.get(nisn=nisn)
            filename = f"BLP_{student.nama.replace(' ', '_')}_{week_start or 'latest'}.pdf"
        except Student.DoesNotExist:
            filename = f"BLP_{nisn}_{week_start or 'latest'}.pdf"

        # Return PDF response
        from django.http import FileResponse
        response = FileResponse(
            pdf_buffer,
            content_type='application/pdf',
            as_attachment=True,
            filename=filename
        )

        return response

    except ValueError as e:
        return Response(
            {'success': False, 'message': str(e)},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'success': False, 'message': f'Error generating PDF: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================================
# INCIDENT (CASE MANAGEMENT / CATATAN & BIMBINGAN) API
# ============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def incident_summary(request):
    """
    Get incident summary statistics for dashboard.

    Returns:
    - total_bulan_ini: Total incidents this month
    - total_resolved: Resolved incidents
    - total_open: Open incidents
    - total_in_discussion: Incidents being discussed
    - by_kategori: Count by category
    - by_tingkat: Count by severity
    - latest_bk_suggestion: Latest BK suggestion
    """
    user = request.user
    today = timezone.now().date()
    month_start = today.replace(day=1)

    # Base queryset
    queryset = Incident.objects.all()

    # Filter for walisantri - only their children's incidents
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        queryset = queryset.filter(siswa__nisn__in=linked_nisns)

    # Additional filter by specific siswa (for walisantri multi-child)
    siswa_nisn = request.query_params.get('siswa') or request.query_params.get('siswa_nisn')
    if siswa_nisn:
        queryset = queryset.filter(siswa__nisn=siswa_nisn)

    # Monthly stats
    monthly_incidents = queryset.filter(created_at__date__gte=month_start)
    total_bulan_ini = monthly_incidents.count()
    total_resolved = monthly_incidents.filter(status='resolved').count()
    total_open = monthly_incidents.filter(status='open').count()
    total_in_discussion = monthly_incidents.filter(status='in_discussion').count()

    # Count by kategori
    by_kategori = dict(
        monthly_incidents.values('kategori').annotate(count=Count('id')).values_list('kategori', 'count')
    )

    # Count by tingkat
    by_tingkat = dict(
        monthly_incidents.values('tingkat').annotate(count=Count('id')).values_list('tingkat', 'count')
    )

    # Latest BK suggestion (from comments)
    latest_suggestion = None
    if user.role != 'walisantri':
        suggestion_comment = IncidentComment.objects.filter(
            comment_type='suggestion',
            author_role__in=['guru', 'pimpinan']
        ).order_by('-created_at').first()
        if suggestion_comment:
            latest_suggestion = suggestion_comment.content[:200]

    return Response({
        'success': True,
        'summary': {
            'total_bulan_ini': total_bulan_ini,
            'total_resolved': total_resolved,
            'total_open': total_open,
            'total_in_discussion': total_in_discussion,
            'by_kategori': by_kategori,
            'by_tingkat': by_tingkat,
            'latest_bk_suggestion': latest_suggestion
        }
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def incident_list_create(request):
    """
    GET: List incidents with filters
    POST: Create new incident

    Query params (GET):
    - siswa_nisn: Filter by student NISN
    - status: Filter by status (open, in_discussion, resolved, closed)
    - kategori: Filter by category
    - tingkat: Filter by severity
    - tahun_ajaran: Filter by academic year

    Permissions:
    - walisantri: Can only view their children's incidents (public comments only)
    - guru/musyrif: Can create and view all
    - pimpinan/superadmin: Full access
    """
    import logging
    logger = logging.getLogger(__name__)

    user = request.user
    allowed_create_roles = ['guru', 'musyrif', 'superadmin', 'pimpinan']

    if request.method == 'GET':
        # Debug logging
        logger.info(f"[Incident API] User: {user.username}, Role: {user.role}")
        logger.info(f"[Incident API] Query params: {dict(request.query_params)}")

        queryset = Incident.objects.select_related('siswa', 'pelapor', 'assigned_to')

        # Log total incidents before filtering
        total_all = Incident.objects.count()
        logger.info(f"[Incident API] Total incidents in DB: {total_all}")

        # Walisantri can only see their children's incidents
        if user.role == 'walisantri':
            linked_nisns = user.get_linked_students()
            logger.info(f"[Incident API] Walisantri linked NISNs: {linked_nisns}")
            queryset = queryset.filter(siswa__nisn__in=linked_nisns)
            logger.info(f"[Incident API] After walisantri filter: {queryset.count()}")

        # Apply filters
        # Support both 'siswa' and 'siswa_nisn' as filter params
        siswa_nisn = request.query_params.get('siswa_nisn') or request.query_params.get('siswa')
        incident_status = request.query_params.get('status')
        kategori = request.query_params.get('kategori')
        tingkat = request.query_params.get('tingkat')
        tahun_ajaran = request.query_params.get('tahun_ajaran')

        if siswa_nisn:
            logger.info(f"[Incident API] Filtering by siswa NISN: {siswa_nisn}")
            queryset = queryset.filter(siswa__nisn=siswa_nisn)
        if incident_status:
            queryset = queryset.filter(status=incident_status)
        if kategori:
            queryset = queryset.filter(kategori=kategori)
        if tingkat:
            queryset = queryset.filter(tingkat=tingkat)
        if tahun_ajaran:
            queryset = queryset.filter(tahun_ajaran=tahun_ajaran)

        queryset = queryset.order_by('-created_at')
        final_count = queryset.count()
        logger.info(f"[Incident API] Final count after all filters: {final_count}")

        serializer = IncidentListSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': final_count,
            'data': serializer.data
        })

    elif request.method == 'POST':
        if user.role not in allowed_create_roles:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin untuk membuat incident'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['pelapor'] = user.id
        data['pelapor_role'] = user.role

        serializer = IncidentCreateSerializer(data=data)

        if serializer.is_valid():
            incident = serializer.save()
            return Response({
                'success': True,
                'message': 'Incident berhasil dibuat',
                'data': IncidentSerializer(incident, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def incident_detail(request, pk):
    """
    GET: Get incident detail with comments
    PUT/PATCH: Update incident

    Walisantri can only see public/final_decision comments.
    """
    user = request.user

    try:
        incident = Incident.objects.select_related(
            'siswa', 'pelapor', 'assigned_to', 'diputuskan_oleh'
        ).get(pk=pk)
    except Incident.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Incident tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Security check for walisantri
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if incident.siswa.nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke incident ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    if request.method == 'GET':
        serializer = IncidentSerializer(incident, context={'request': request})
        return Response({
            'success': True,
            'data': serializer.data
        })

    elif request.method in ['PUT', 'PATCH']:
        # Walisantri cannot edit
        if user.role == 'walisantri':
            return Response(
                {'success': False, 'message': 'Walisantri tidak dapat mengedit incident'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if incident is closed
        if incident.status == 'closed':
            return Response(
                {'success': False, 'message': 'Incident sudah ditutup dan tidak dapat diubah'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = IncidentCreateSerializer(
            incident,
            data=request.data,
            partial=(request.method == 'PATCH')
        )

        if serializer.is_valid():
            incident = serializer.save()
            return Response({
                'success': True,
                'message': 'Incident berhasil diupdate',
                'data': IncidentSerializer(incident, context={'request': request}).data
            })

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def incident_resolve(request, pk):
    """
    Resolve incident with final decision.

    Only pimpinan or superadmin can resolve.
    """
    user = request.user

    if user.role not in ['pimpinan', 'superadmin']:
        return Response(
            {'success': False, 'message': 'Hanya pimpinan yang dapat memberikan keputusan'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        incident = Incident.objects.get(pk=pk)
    except Incident.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Incident tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    if incident.status == 'resolved':
        return Response({
            'success': False,
            'message': 'Incident sudah diselesaikan sebelumnya'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = IncidentResolveSerializer(data=request.data)

    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    # Resolve incident
    incident.resolve(user, serializer.validated_data['keputusan_final'])

    # Update tindak lanjut if provided
    if serializer.validated_data.get('tindak_lanjut'):
        incident.tindak_lanjut = serializer.validated_data['tindak_lanjut']
    if serializer.validated_data.get('deadline_tindak_lanjut'):
        incident.deadline_tindak_lanjut = serializer.validated_data['deadline_tindak_lanjut']
    incident.save()

    # Auto-create final decision comment
    IncidentComment.objects.create(
        incident=incident,
        content=serializer.validated_data['keputusan_final'],
        comment_type='decision',
        author=user,
        author_role=user.role,
        author_role_display='Mudir/Pimpinan',
        visibility='final_decision'
    )

    return Response({
        'success': True,
        'message': 'Incident berhasil diselesaikan',
        'data': IncidentSerializer(incident, context={'request': request}).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def incident_student_history(request, nisn):
    """
    Get incident history for a specific student.
    """
    user = request.user

    # Security check for walisantri
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke data ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Siswa tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    queryset = Incident.objects.filter(siswa=student).order_by('-created_at')

    try:
        limit = int(request.query_params.get('limit', 20))
        limit = max(1, min(100, limit))
    except ValueError:
        limit = 20

    queryset = queryset[:limit]

    serializer = IncidentListSerializer(queryset, many=True)

    return Response({
        'success': True,
        'student': {
            'nisn': student.nisn,
            'nama': student.nama,
            'kelas': student.kelas
        },
        'count': queryset.count(),
        'data': serializer.data
    })


# ============================================================
# INCIDENT COMMENTS API
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def incident_comments(request, incident_id):
    """
    GET: List comments for an incident
    POST: Add comment to incident

    Walisantri can only see public/final_decision comments and cannot post.
    """
    user = request.user

    try:
        incident = Incident.objects.get(pk=incident_id)
    except Incident.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Incident tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Security check for walisantri
    if user.role == 'walisantri':
        linked_nisns = user.get_linked_students()
        if incident.siswa.nisn not in linked_nisns:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses'},
                status=status.HTTP_403_FORBIDDEN
            )

    if request.method == 'GET':
        comments = incident.comments.filter(parent_comment__isnull=True)

        # Walisantri only see public comments
        if user.role == 'walisantri':
            comments = comments.filter(visibility__in=['public', 'final_decision'])

        comments = comments.order_by('created_at')
        serializer = IncidentCommentSerializer(comments, many=True)

        return Response({
            'success': True,
            'count': comments.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        # Walisantri cannot post comments
        if user.role == 'walisantri':
            return Response(
                {'success': False, 'message': 'Walisantri tidak dapat menambah komentar'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Map role to display name
        role_display_map = {
            'superadmin': 'Administrator',
            'pimpinan': 'Pimpinan/Mudir',
            'guru': 'Guru/Ustadz',
            'bk': 'Guru BK',
            'musyrif': 'Musyrif',
        }

        data = request.data.copy()
        data['incident'] = incident_id
        data['author'] = user.id
        data['author_role'] = user.role
        data['author_role_display'] = role_display_map.get(user.role, user.role.replace('_', ' ').title())

        serializer = IncidentCommentCreateSerializer(data=data)

        if serializer.is_valid():
            comment = serializer.save()
            return Response({
                'success': True,
                'message': 'Komentar berhasil ditambahkan',
                'data': IncidentCommentSerializer(comment).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def incident_comment_detail(request, pk):
    """
    GET: Get comment detail with replies
    PUT: Update comment (author only)
    DELETE: Delete comment (author or admin only)
    """
    user = request.user

    try:
        comment = IncidentComment.objects.select_related('incident', 'author').get(pk=pk)
    except IncidentComment.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Komentar tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        # Get comment with replies
        data = IncidentCommentSerializer(comment).data
        replies = comment.replies.order_by('created_at')

        # Filter for walisantri
        if user.role == 'walisantri':
            replies = replies.filter(visibility__in=['public', 'final_decision'])

        data['replies'] = IncidentCommentSerializer(replies, many=True).data

        return Response({
            'success': True,
            'data': data
        })

    elif request.method == 'PUT':
        # Only author can edit
        if comment.author != user and user.role not in ['superadmin', 'pimpinan']:
            return Response(
                {'success': False, 'message': 'Anda tidak dapat mengedit komentar ini'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = IncidentCommentCreateSerializer(
            comment,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            comment = serializer.save()
            return Response({
                'success': True,
                'message': 'Komentar berhasil diupdate',
                'data': IncidentCommentSerializer(comment).data
            })

        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # Only author or admin can delete
        if comment.author != user and user.role not in ['superadmin', 'pimpinan']:
            return Response(
                {'success': False, 'message': 'Anda tidak dapat menghapus komentar ini'},
                status=status.HTTP_403_FORBIDDEN
            )

        comment.delete()

        return Response({
            'success': True,
            'message': 'Komentar berhasil dihapus'
        })


# ============================================================
# ASATIDZ EVALUATION API (Evaluasi Ustadz/Karyawan)
# ============================================================

import logging
logger = logging.getLogger(__name__)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAsatidzEvaluationAllowed])
def asatidz_evaluation_list_create(request):
    """
    GET: List evaluasi asatidz dengan RBAC
        - Pimpinan/Superadmin: Lihat semua
        - Ustadz (guru/musyrif): Lihat evaluasi diri sendiri saja

    POST: Buat evaluasi baru (hanya pimpinan/superadmin)
        - dilaporkan_oleh auto-filled dari request.user
    """
    user = request.user

    if request.method == 'GET':
        # Base queryset
        queryset = AsatidzEvaluation.objects.select_related(
            'ustadz', 'dilaporkan_oleh'
        ).order_by('-tanggal_kejadian', '-created_at')

        # RBAC: Filter berdasarkan role
        if user.role in ['superadmin', 'pimpinan']:
            # Pimpinan melihat semua evaluasi
            pass
        else:
            # Ustadz hanya melihat evaluasi diri sendiri
            queryset = queryset.filter(ustadz=user)

        # Optional filters
        ustadz_id = request.query_params.get('ustadz')
        kategori = request.query_params.get('kategori')
        tahun_ajaran = request.query_params.get('tahun_ajaran')
        semester = request.query_params.get('semester')

        if ustadz_id and user.role in ['superadmin', 'pimpinan']:
            queryset = queryset.filter(ustadz_id=ustadz_id)
        if kategori:
            queryset = queryset.filter(kategori=kategori)
        if tahun_ajaran:
            queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
        if semester:
            queryset = queryset.filter(semester=semester)

        serializer = AsatidzEvaluationListSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        # Hanya pimpinan/superadmin yang bisa POST (sudah dicek di permission)
        data = request.data.copy()

        # Auto-fill dilaporkan_oleh dari request.user
        data['dilaporkan_oleh'] = user.id

        # Default tahun_ajaran & semester jika tidak ada
        if 'tahun_ajaran' not in data:
            data['tahun_ajaran'] = '2025/2026'
        if 'semester' not in data:
            data['semester'] = 'Ganjil'

        serializer = AsatidzEvaluationCreateSerializer(data=data)

        if serializer.is_valid():
            evaluation = serializer.save()

            logger.info(f"[AsatidzEval] New evaluation created by {user.username}: "
                        f"ustadz={evaluation.ustadz.name}, kategori={evaluation.kategori}")

            return Response({
                'success': True,
                'message': 'Evaluasi berhasil dibuat',
                'data': AsatidzEvaluationSerializer(evaluation).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAsatidzEvaluationAllowed])
def asatidz_evaluation_detail(request, pk):
    """
    GET: Detail evaluasi
        - Pimpinan: bisa akses semua
        - Ustadz: hanya bisa akses evaluasi diri sendiri

    PUT: Update evaluasi (hanya pimpinan/superadmin)

    DELETE: Hapus evaluasi (hanya pimpinan/superadmin)
    """
    user = request.user

    try:
        evaluation = AsatidzEvaluation.objects.select_related(
            'ustadz', 'dilaporkan_oleh'
        ).get(pk=pk)
    except AsatidzEvaluation.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Evaluasi tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Object-level permission check
    if user.role not in ['superadmin', 'pimpinan']:
        # Ustadz hanya bisa lihat evaluasi diri sendiri
        if evaluation.ustadz_id != user.id:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke evaluasi ini'},
                status=status.HTTP_403_FORBIDDEN
            )
        # Ustadz tidak boleh PUT/DELETE
        if request.method in ['PUT', 'DELETE']:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin untuk operasi ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    if request.method == 'GET':
        serializer = AsatidzEvaluationSerializer(evaluation)
        return Response({
            'success': True,
            'data': serializer.data
        })

    elif request.method == 'PUT':
        data = request.data.copy()

        # Tidak boleh mengubah dilaporkan_oleh
        data.pop('dilaporkan_oleh', None)

        serializer = AsatidzEvaluationCreateSerializer(
            evaluation,
            data=data,
            partial=True
        )

        if serializer.is_valid():
            evaluation = serializer.save()

            logger.info(f"[AsatidzEval] Evaluation updated by {user.username}: "
                        f"id={evaluation.id}, ustadz={evaluation.ustadz.name}")

            return Response({
                'success': True,
                'message': 'Evaluasi berhasil diupdate',
                'data': AsatidzEvaluationSerializer(evaluation).data
            })

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        ustadz_name = evaluation.ustadz.name
        evaluation_id = evaluation.id
        evaluation.delete()

        logger.info(f"[AsatidzEval] Evaluation deleted by {user.username}: "
                    f"id={evaluation_id}, ustadz={ustadz_name}")

        return Response({
            'success': True,
            'message': 'Evaluasi berhasil dihapus'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAsatidzEvaluationAllowed])
def asatidz_evaluation_summary(request):
    """
    GET: Summary statistik evaluasi untuk dashboard pimpinan.

    Response:
    {
        "success": true,
        "summary": {
            "total_evaluasi": 25,
            "by_kategori": {"apresiasi": 10, "administratif": 8, "kedisiplinan": 7},
            "by_ustadz": [{"ustadz_id": 1, "ustadz_nama": "Ustadz A", "count": 5}, ...],
            "recent_evaluations": [...]
        }
    }
    """
    user = request.user

    # Hanya pimpinan/superadmin yang bisa lihat summary
    if user.role not in ['superadmin', 'pimpinan']:
        return Response(
            {'success': False, 'message': 'Hanya pimpinan yang dapat mengakses summary'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Filter by tahun_ajaran & semester if provided
    tahun_ajaran = request.query_params.get('tahun_ajaran', '2025/2026')
    semester = request.query_params.get('semester')

    queryset = AsatidzEvaluation.objects.all()

    if tahun_ajaran:
        queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
    if semester:
        queryset = queryset.filter(semester=semester)

    # Count by kategori
    kategori_counts = queryset.values('kategori').annotate(count=Count('id'))
    by_kategori = {item['kategori']: item['count'] for item in kategori_counts}

    # Count by ustadz (top 10)
    ustadz_counts = queryset.values(
        'ustadz__id', 'ustadz__name', 'ustadz__username'
    ).annotate(count=Count('id')).order_by('-count')[:10]

    by_ustadz = [
        {
            'ustadz_id': item['ustadz__id'],
            'ustadz_nama': item['ustadz__name'],
            'ustadz_username': item['ustadz__username'],
            'count': item['count']
        }
        for item in ustadz_counts
    ]

    # Recent evaluations (last 5)
    recent = queryset.select_related('ustadz', 'dilaporkan_oleh').order_by('-created_at')[:5]
    recent_data = AsatidzEvaluationListSerializer(recent, many=True).data

    return Response({
        'success': True,
        'summary': {
            'total_evaluasi': queryset.count(),
            'by_kategori': by_kategori,
            'by_ustadz': by_ustadz,
            'recent_evaluations': recent_data
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAsatidzEvaluationAllowed])
def asatidz_evaluation_by_ustadz(request, ustadz_id):
    """
    GET: List semua evaluasi untuk satu ustadz tertentu.

    RBAC:
        - Pimpinan: bisa akses evaluasi semua ustadz
        - Ustadz: hanya bisa akses jika ustadz_id == request.user.id
    """
    user = request.user

    # RBAC check
    if user.role not in ['superadmin', 'pimpinan']:
        # Ustadz hanya bisa akses data sendiri
        if ustadz_id != user.id:
            return Response(
                {'success': False, 'message': 'Anda hanya dapat melihat evaluasi Anda sendiri'},
                status=status.HTTP_403_FORBIDDEN
            )

    # Verify ustadz exists
    from apps.accounts.models import User
    try:
        ustadz = User.objects.get(pk=ustadz_id)
    except User.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Ustadz tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    queryset = AsatidzEvaluation.objects.filter(
        ustadz_id=ustadz_id
    ).select_related('dilaporkan_oleh').order_by('-tanggal_kejadian', '-created_at')

    # Optional filters
    kategori = request.query_params.get('kategori')
    tahun_ajaran = request.query_params.get('tahun_ajaran')
    semester = request.query_params.get('semester')

    if kategori:
        queryset = queryset.filter(kategori=kategori)
    if tahun_ajaran:
        queryset = queryset.filter(tahun_ajaran=tahun_ajaran)
    if semester:
        queryset = queryset.filter(semester=semester)

    # Calculate summary for this ustadz
    kategori_counts = queryset.values('kategori').annotate(count=Count('id'))
    by_kategori = {item['kategori']: item['count'] for item in kategori_counts}

    serializer = AsatidzEvaluationListSerializer(queryset, many=True)

    return Response({
        'success': True,
        'ustadz': {
            'id': ustadz.id,
            'name': ustadz.name,
            'username': ustadz.username,
            'role': ustadz.role
        },
        'summary': {
            'total': queryset.count(),
            'by_kategori': by_kategori
        },
        'data': serializer.data
    })


# ============================================================
# PENILAIAN KINERJA ASATIDZ (STAR RATING SYSTEM) API
# ============================================================

from .models import IndikatorKinerja, PenilaianKinerjaAsatidz, DetailPenilaianKinerja
from .serializers import (
    IndikatorKinerjaSerializer, IndikatorKinerjaCreateSerializer,
    PenilaianKinerjaAsatidzSerializer, PenilaianKinerjaAsatidzListSerializer,
    PenilaianKinerjaAsatidzCreateSerializer, PenilaianKinerjaAsatidzUpdateSerializer,
    DetailPenilaianKinerjaSerializer, PenilaianKinerjaSummarySerializer
)


# ============================================================
# INDIKATOR KINERJA API
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def indikator_kinerja_list_create(request):
    """
    GET: List semua indikator kinerja
        - Semua staff bisa melihat (untuk form penilaian)

    POST: Buat indikator baru (hanya pimpinan/superadmin)
    """
    user = request.user

    if request.method == 'GET':
        # Filter: show only active by default
        show_all = request.query_params.get('show_all', 'false').lower() == 'true'

        if show_all and user.role in ['superadmin', 'pimpinan']:
            queryset = IndikatorKinerja.objects.all()
        else:
            queryset = IndikatorKinerja.objects.filter(is_active=True)

        queryset = queryset.order_by('urutan', 'nama_indikator')
        serializer = IndikatorKinerjaSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        # Hanya pimpinan/superadmin yang bisa create
        if user.role not in ['superadmin', 'pimpinan']:
            return Response(
                {'success': False, 'message': 'Hanya pimpinan yang dapat membuat indikator'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = IndikatorKinerjaCreateSerializer(data=request.data)

        if serializer.is_valid():
            indikator = serializer.save()
            return Response({
                'success': True,
                'message': 'Indikator berhasil dibuat',
                'data': IndikatorKinerjaSerializer(indikator).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def indikator_kinerja_detail(request, pk):
    """
    GET: Detail indikator
    PUT: Update indikator (hanya pimpinan/superadmin)
    DELETE: Soft delete (set is_active=False)
    """
    user = request.user

    try:
        indikator = IndikatorKinerja.objects.get(pk=pk)
    except IndikatorKinerja.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Indikator tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = IndikatorKinerjaSerializer(indikator)
        return Response({
            'success': True,
            'data': serializer.data
        })

    elif request.method in ['PUT', 'DELETE']:
        # Hanya pimpinan/superadmin yang bisa update/delete
        if user.role not in ['superadmin', 'pimpinan']:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin'},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method == 'PUT':
            serializer = IndikatorKinerjaCreateSerializer(
                indikator,
                data=request.data,
                partial=True
            )

            if serializer.is_valid():
                indikator = serializer.save()
                return Response({
                    'success': True,
                    'message': 'Indikator berhasil diupdate',
                    'data': IndikatorKinerjaSerializer(indikator).data
                })

            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        elif request.method == 'DELETE':
            # Soft delete: set is_active=False
            indikator.is_active = False
            indikator.save()

            return Response({
                'success': True,
                'message': 'Indikator berhasil dinonaktifkan'
            })


# ============================================================
# PENILAIAN KINERJA API
# ============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def penilaian_kinerja_list_create(request):
    """
    GET: List penilaian kinerja
        - Pimpinan/Superadmin: Lihat semua
        - Ustadz: Lihat penilaian diri sendiri

    POST: Buat penilaian baru (hanya pimpinan/superadmin)

    Query params (GET):
        - ustadz: Filter by ustadz ID
        - status: Filter by status (draft/submitted/finalized)
        - tahun_ajaran: Filter by academic year
        - semester: Filter by semester
    """
    user = request.user

    if request.method == 'GET':
        queryset = PenilaianKinerjaAsatidz.objects.select_related(
            'ustadz', 'penilai', 'tahun_ajaran'
        ).order_by('-created_at')

        # RBAC filter
        if user.role in ['superadmin', 'pimpinan']:
            pass  # See all
        elif user.role in ['guru', 'musyrif', 'bendahara']:
            # See own evaluations only
            queryset = queryset.filter(ustadz=user)
        else:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Apply filters (admin only)
        if user.role in ['superadmin', 'pimpinan']:
            ustadz_id = request.query_params.get('ustadz')
            if ustadz_id:
                queryset = queryset.filter(ustadz_id=ustadz_id)

        penilaian_status = request.query_params.get('status')
        tahun_ajaran_nama = request.query_params.get('tahun_ajaran')
        semester = request.query_params.get('semester')

        if penilaian_status:
            queryset = queryset.filter(status=penilaian_status)
        if tahun_ajaran_nama:
            queryset = queryset.filter(tahun_ajaran_nama=tahun_ajaran_nama)
        if semester:
            queryset = queryset.filter(semester=semester)

        serializer = PenilaianKinerjaAsatidzListSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        # Hanya pimpinan/superadmin yang bisa create
        if user.role not in ['superadmin', 'pimpinan']:
            return Response(
                {'success': False, 'message': 'Hanya pimpinan yang dapat membuat penilaian'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['penilai'] = user.id

        # Get active TahunAjaran if not provided
        if not data.get('tahun_ajaran') and not data.get('tahun_ajaran_nama'):
            from apps.core.models import TahunAjaran
            active = TahunAjaran.get_active_or_default()
            data['tahun_ajaran_nama'] = active['nama']
            data['semester'] = active['semester']
            if active.get('id'):
                data['tahun_ajaran'] = active['id']

        serializer = PenilaianKinerjaAsatidzCreateSerializer(data=data)

        if serializer.is_valid():
            penilaian = serializer.save()
            logger.info(f"[PenilaianKinerja] New penilaian created by {user.username}: "
                        f"ustadz={penilaian.ustadz.name}")

            return Response({
                'success': True,
                'message': 'Penilaian berhasil dibuat',
                'data': PenilaianKinerjaAsatidzSerializer(penilaian).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def penilaian_kinerja_detail(request, pk):
    """
    GET: Detail penilaian dengan nested detail_penilaian
    PUT: Update rating values
    DELETE: Hapus penilaian (hanya jika masih draft)
    """
    user = request.user

    try:
        penilaian = PenilaianKinerjaAsatidz.objects.select_related(
            'ustadz', 'penilai', 'tahun_ajaran'
        ).prefetch_related(
            'detail_penilaian', 'detail_penilaian__indikator'
        ).get(pk=pk)
    except PenilaianKinerjaAsatidz.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Penilaian tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    # RBAC check
    if user.role not in ['superadmin', 'pimpinan']:
        if penilaian.ustadz_id != user.id:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki akses ke penilaian ini'},
                status=status.HTTP_403_FORBIDDEN
            )
        # Non-admin can only GET
        if request.method in ['PUT', 'DELETE']:
            return Response(
                {'success': False, 'message': 'Anda tidak memiliki izin untuk operasi ini'},
                status=status.HTTP_403_FORBIDDEN
            )

    if request.method == 'GET':
        serializer = PenilaianKinerjaAsatidzSerializer(penilaian)
        return Response({
            'success': True,
            'data': serializer.data
        })

    elif request.method == 'PUT':
        # Check if finalized
        if penilaian.status == 'finalized':
            return Response({
                'success': False,
                'message': 'Penilaian sudah final dan tidak dapat diubah'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = PenilaianKinerjaAsatidzUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update catatan_tambahan if provided
        if 'catatan_tambahan' in serializer.validated_data:
            penilaian.catatan_tambahan = serializer.validated_data['catatan_tambahan']

        # Update detail values
        detail_values = serializer.validated_data.get('detail_values', [])
        for detail_input in detail_values:
            indikator_id = detail_input['indikator_id']
            try:
                detail = DetailPenilaianKinerja.objects.get(
                    penilaian=penilaian,
                    indikator_id=indikator_id
                )
                if 'nilai_bintang' in detail_input:
                    detail.nilai_bintang = detail_input['nilai_bintang']
                if 'catatan' in detail_input:
                    detail.catatan = detail_input['catatan']
                detail.save()
            except DetailPenilaianKinerja.DoesNotExist:
                # Create new detail if not exists
                try:
                    indikator = IndikatorKinerja.objects.get(pk=indikator_id)
                    DetailPenilaianKinerja.objects.create(
                        penilaian=penilaian,
                        indikator=indikator,
                        nilai_bintang=detail_input.get('nilai_bintang'),
                        catatan=detail_input.get('catatan', '')
                    )
                except IndikatorKinerja.DoesNotExist:
                    pass

        # Check if should submit
        if serializer.validated_data.get('submit'):
            penilaian.status = 'submitted'

        # Recalculate and save
        penilaian.calculate_rata_rata()
        penilaian.save()

        return Response({
            'success': True,
            'message': 'Penilaian berhasil diupdate',
            'data': PenilaianKinerjaAsatidzSerializer(penilaian).data
        })

    elif request.method == 'DELETE':
        # Only draft can be deleted
        if penilaian.status != 'draft':
            return Response({
                'success': False,
                'message': 'Hanya penilaian dengan status draft yang dapat dihapus'
            }, status=status.HTTP_400_BAD_REQUEST)

        ustadz_name = penilaian.ustadz.name
        penilaian.delete()

        logger.info(f"[PenilaianKinerja] Penilaian deleted by {user.username}: "
                    f"ustadz={ustadz_name}")

        return Response({
            'success': True,
            'message': 'Penilaian berhasil dihapus'
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def penilaian_kinerja_finalize(request, pk):
    """
    Finalize penilaian (lock dari perubahan).

    Hanya pimpinan/superadmin yang bisa finalize.
    Setelah finalized, penilaian tidak dapat diubah.
    """
    user = request.user

    if user.role not in ['superadmin', 'pimpinan']:
        return Response(
            {'success': False, 'message': 'Hanya pimpinan yang dapat memfinalisasi penilaian'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        penilaian = PenilaianKinerjaAsatidz.objects.get(pk=pk)
    except PenilaianKinerjaAsatidz.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Penilaian tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    if penilaian.status == 'finalized':
        return Response({
            'success': False,
            'message': 'Penilaian sudah dalam status final'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if complete
    if not penilaian.is_complete:
        return Response({
            'success': False,
            'message': 'Semua indikator harus dinilai sebelum finalisasi'
        }, status=status.HTTP_400_BAD_REQUEST)

    penilaian.finalize()

    logger.info(f"[PenilaianKinerja] Penilaian finalized by {user.username}: "
                f"ustadz={penilaian.ustadz.name}, rata_rata={penilaian.rata_rata_nilai}")

    return Response({
        'success': True,
        'message': 'Penilaian berhasil difinalisasi',
        'data': PenilaianKinerjaAsatidzSerializer(penilaian).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def penilaian_kinerja_summary(request):
    """
    GET: Summary statistik penilaian kinerja untuk dashboard.

    Hanya pimpinan/superadmin yang bisa akses.

    Query params:
        - tahun_ajaran: Filter by academic year
        - semester: Filter by semester

    Response:
    {
        "success": true,
        "summary": {
            "total_penilaian": 50,
            "total_draft": 10,
            "total_submitted": 15,
            "total_finalized": 25,
            "rata_rata_keseluruhan": 3.75,
            "by_predikat": {"Sangat Baik": 10, "Baik": 20, ...},
            "top_performers": [...],
            "recent_penilaian": [...]
        }
    }
    """
    user = request.user

    if user.role not in ['superadmin', 'pimpinan']:
        return Response(
            {'success': False, 'message': 'Hanya pimpinan yang dapat mengakses summary'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Filters
    tahun_ajaran_nama = request.query_params.get('tahun_ajaran')
    semester = request.query_params.get('semester')

    queryset = PenilaianKinerjaAsatidz.objects.all()

    if tahun_ajaran_nama:
        queryset = queryset.filter(tahun_ajaran_nama=tahun_ajaran_nama)
    if semester:
        queryset = queryset.filter(semester=semester)

    # Status counts
    total_penilaian = queryset.count()
    total_draft = queryset.filter(status='draft').count()
    total_submitted = queryset.filter(status='submitted').count()
    total_finalized = queryset.filter(status='finalized').count()

    # Average overall (only finalized)
    from django.db.models import Avg
    finalized_qs = queryset.filter(status='finalized')
    avg_result = finalized_qs.aggregate(avg=Avg('rata_rata_nilai'))
    rata_rata_keseluruhan = round(avg_result['avg'] or 0, 2)

    # Count by predikat
    by_predikat = {
        'Sangat Baik': finalized_qs.filter(rata_rata_nilai__gte=4.5).count(),
        'Baik': finalized_qs.filter(rata_rata_nilai__gte=3.5, rata_rata_nilai__lt=4.5).count(),
        'Cukup': finalized_qs.filter(rata_rata_nilai__gte=2.5, rata_rata_nilai__lt=3.5).count(),
        'Kurang': finalized_qs.filter(rata_rata_nilai__gte=1.5, rata_rata_nilai__lt=2.5).count(),
        'Sangat Kurang': finalized_qs.filter(rata_rata_nilai__lt=1.5).count(),
    }

    # Top performers (top 5 finalized)
    top_performers = finalized_qs.select_related('ustadz').order_by('-rata_rata_nilai')[:5]
    top_performers_data = [
        {
            'ustadz_id': p.ustadz.id,
            'ustadz_nama': p.ustadz.name,
            'rata_rata_nilai': float(p.rata_rata_nilai),
            'predikat': p.predikat
        }
        for p in top_performers
    ]

    # Recent penilaian (last 5)
    recent = queryset.select_related('ustadz', 'penilai').order_by('-created_at')[:5]
    recent_data = PenilaianKinerjaAsatidzListSerializer(recent, many=True).data

    return Response({
        'success': True,
        'summary': {
            'total_penilaian': total_penilaian,
            'total_draft': total_draft,
            'total_submitted': total_submitted,
            'total_finalized': total_finalized,
            'rata_rata_keseluruhan': rata_rata_keseluruhan,
            'by_predikat': by_predikat,
            'top_performers': top_performers_data,
            'recent_penilaian': recent_data
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def penilaian_kinerja_by_ustadz(request, ustadz_id):
    """
    GET: List semua penilaian untuk satu ustadz.

    RBAC:
        - Pimpinan: bisa akses semua
        - Ustadz: hanya bisa akses jika ustadz_id == request.user.id
    """
    user = request.user

    # RBAC check
    if user.role not in ['superadmin', 'pimpinan']:
        if ustadz_id != user.id:
            return Response(
                {'success': False, 'message': 'Anda hanya dapat melihat penilaian Anda sendiri'},
                status=status.HTTP_403_FORBIDDEN
            )

    # Verify ustadz exists
    from apps.accounts.models import User
    try:
        ustadz = User.objects.get(pk=ustadz_id)
    except User.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Ustadz tidak ditemukan'},
            status=status.HTTP_404_NOT_FOUND
        )

    queryset = PenilaianKinerjaAsatidz.objects.filter(
        ustadz_id=ustadz_id
    ).select_related('penilai', 'tahun_ajaran').order_by('-created_at')

    # Filters
    penilaian_status = request.query_params.get('status')
    tahun_ajaran_nama = request.query_params.get('tahun_ajaran')

    if penilaian_status:
        queryset = queryset.filter(status=penilaian_status)
    if tahun_ajaran_nama:
        queryset = queryset.filter(tahun_ajaran_nama=tahun_ajaran_nama)

    # Calculate summary
    from django.db.models import Avg
    finalized_qs = queryset.filter(status='finalized')
    avg_result = finalized_qs.aggregate(avg=Avg('rata_rata_nilai'))

    serializer = PenilaianKinerjaAsatidzListSerializer(queryset, many=True)

    return Response({
        'success': True,
        'ustadz': {
            'id': ustadz.id,
            'name': ustadz.name,
            'username': ustadz.username,
            'role': ustadz.role
        },
        'summary': {
            'total': queryset.count(),
            'total_finalized': finalized_qs.count(),
            'rata_rata_keseluruhan': round(avg_result['avg'] or 0, 2)
        },
        'data': serializer.data
    })


# ============================================
# HAFALAN MODULE (Role-Based Views & Analytics)
# ============================================

from django.shortcuts import render


def hafalan_view(request):
    """
    Role-based hafalan page routing.

    Renders hafalan-router.html which validates via API and redirects.
    """
    return render(request, 'hafalan-router.html')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hafalan_dashboard_stats(request):
    """
    Dashboard statistics for Hafalan Manager view.

    RBAC: superadmin, pimpinan only.

    Query params:
    - kelas: Filter by specific class (optional)

    Returns:
    {
        "success": true,
        "data": {
            "total_santri_aktif": 150,
            "total_khatam": 12,
            "avg_juz_sekolah": 5.7,
            "chart_capaian_kelas": [
                {"kelas": "X A", "avg_juz": 4.5, "total_siswa": 30},
                {"kelas": "X B", "avg_juz": 5.2, "total_siswa": 28},
                ...
            ],
            "top_performers": [
                {"nisn": "001", "nama": "Ahmad", "kelas": "XI A", "tercapai_juz": 15},
                ...
            ],
            "distribution": {
                "khatam": 12,
                "above_15": 25,
                "above_10": 45,
                "above_5": 80,
                "below_5": 70
            }
        }
    }
    """
    user = request.user

    # RBAC: Only manager roles
    allowed_roles = ['superadmin', 'pimpinan']
    if user.role not in allowed_roles:
        return Response(
            {'success': False, 'message': 'Akses ditolak. Hanya untuk role manager.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        from django.db.models import Sum, Avg, Count, Max, F, Value, DecimalField
        from django.db.models.functions import Coalesce

        # Base queryset: Active students only
        students_qs = Student.objects.filter(status='aktif')

        # Filter by kelas if explicit filter provided
        kelas_filter = request.query_params.get('kelas', None)
        if kelas_filter:
            students_qs = students_qs.filter(kelas=kelas_filter)

        # Total active students
        total_santri_aktif = students_qs.count()

        # Get hafalan data from TargetHafalan model
        # Join with students to get latest tercapai_juz per student
        hafalan_data = TargetHafalan.objects.filter(
            siswa__in=students_qs
        ).values('siswa').annotate(
            max_tercapai=Max('tercapai_juz')
        )

        # Build mapping siswa_id -> max_tercapai
        hafalan_map = {item['siswa']: float(item['max_tercapai'] or 0) for item in hafalan_data}

        # Also consider Student.current_hafalan as fallback
        student_hafalan = students_qs.values('id', 'nisn', 'nama', 'kelas', 'current_hafalan')

        # Merge data
        student_scores = []
        for s in student_hafalan:
            tercapai = hafalan_map.get(s['id'], 0)
            if tercapai == 0:
                tercapai = float(s['current_hafalan'] or 0)
            student_scores.append({
                'id': s['id'],
                'nisn': s['nisn'],
                'nama': s['nama'],
                'kelas': s['kelas'],
                'tercapai_juz': tercapai
            })

        # Calculate statistics
        total_khatam = sum(1 for s in student_scores if s['tercapai_juz'] >= 30)
        total_juz = sum(s['tercapai_juz'] for s in student_scores)
        avg_juz_sekolah = round(total_juz / total_santri_aktif, 2) if total_santri_aktif > 0 else 0

        # Distribution
        distribution = {
            'khatam': total_khatam,
            'above_15': sum(1 for s in student_scores if 15 <= s['tercapai_juz'] < 30),
            'above_10': sum(1 for s in student_scores if 10 <= s['tercapai_juz'] < 15),
            'above_5': sum(1 for s in student_scores if 5 <= s['tercapai_juz'] < 10),
            'below_5': sum(1 for s in student_scores if s['tercapai_juz'] < 5)
        }

        # Chart: Average per class
        from collections import defaultdict
        kelas_data = defaultdict(lambda: {'total_juz': 0, 'count': 0})
        for s in student_scores:
            if s['kelas']:
                kelas_data[s['kelas']]['total_juz'] += s['tercapai_juz']
                kelas_data[s['kelas']]['count'] += 1

        chart_capaian_kelas = []
        for kelas, data in sorted(kelas_data.items()):
            avg = round(data['total_juz'] / data['count'], 2) if data['count'] > 0 else 0
            chart_capaian_kelas.append({
                'kelas': kelas,
                'avg_juz': avg,
                'total_siswa': data['count']
            })

        # Top performers (top 10)
        top_performers = sorted(student_scores, key=lambda x: x['tercapai_juz'], reverse=True)[:10]
        top_performers_clean = [
            {
                'nisn': s['nisn'],
                'nama': s['nama'],
                'kelas': s['kelas'],
                'tercapai_juz': s['tercapai_juz']
            }
            for s in top_performers
        ]

        return Response({
            'success': True,
            'data': {
                'total_santri_aktif': total_santri_aktif,
                'total_khatam': total_khatam,
                'avg_juz_sekolah': avg_juz_sekolah,
                'chart_capaian_kelas': chart_capaian_kelas,
                'top_performers': top_performers_clean,
                'distribution': distribution
            }
        })

    except Exception as e:
        import traceback
        return Response({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# IZIN GURU VIEWS
# ============================================

from .models import IzinGuru
from .serializers import IzinGuruSerializer, IzinGuruCreateSerializer
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser


@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([IsAuthenticated])
def izin_guru_list_create(request):
    """
    GET: List izin guru
    - Guru/Musyrif: Return izin milik sendiri
    - Pimpinan/Superadmin/BK: Return semua izin

    POST: Create izin baru
    - Otomatis set guru = request.user
    - Otomatis set tahun_ajaran = TahunAjaran aktif
    - Handle multipart/form-data untuk upload foto
    """
    user = request.user

    # Block walisantri
    if user.role == 'walisantri':
        return Response({
            'success': False,
            'message': 'Walisantri tidak memiliki akses ke fitur ini'
        }, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        # Filter by role
        admin_roles = ['superadmin', 'pimpinan', 'bk']
        if user.role in admin_roles:
            queryset = IzinGuru.objects.all()
        else:
            queryset = IzinGuru.objects.filter(guru=user)

        # Query params filters
        tanggal_mulai = request.query_params.get('tanggal_mulai')
        tanggal_selesai = request.query_params.get('tanggal_selesai')
        jenis = request.query_params.get('jenis')
        guru_id = request.query_params.get('guru')

        if tanggal_mulai:
            queryset = queryset.filter(tanggal_mulai__gte=tanggal_mulai)
        if tanggal_selesai:
            queryset = queryset.filter(tanggal_selesai__lte=tanggal_selesai)
        if jenis:
            queryset = queryset.filter(jenis_izin=jenis)
        if guru_id and user.role in admin_roles:
            queryset = queryset.filter(guru_id=guru_id)

        queryset = queryset.select_related('guru', 'tahun_ajaran')
        serializer = IzinGuruSerializer(queryset, many=True, context={'request': request})

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        serializer = IzinGuruCreateSerializer(data=request.data)

        if serializer.is_valid():
            # Get active tahun ajaran
            from apps.core.models import TahunAjaran
            tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()

            if not tahun_ajaran:
                return Response({
                    'success': False,
                    'message': 'Tidak ada tahun ajaran aktif'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Save with auto-filled fields
            izin = serializer.save(
                guru=user,
                tahun_ajaran=tahun_ajaran
            )

            return Response({
                'success': True,
                'message': 'Izin berhasil diajukan',
                'data': IzinGuruSerializer(izin, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'success': False,
            'message': 'Validasi gagal',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def izin_guru_detail(request, pk):
    """
    GET: Detail izin
    - Guru hanya bisa lihat miliknya sendiri
    - Pimpinan/Superadmin/BK bisa lihat semua
    """
    user = request.user

    if user.role == 'walisantri':
        return Response({
            'success': False,
            'message': 'Walisantri tidak memiliki akses ke fitur ini'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        izin = IzinGuru.objects.select_related('guru', 'tahun_ajaran').get(pk=pk)

        # Check permission
        admin_roles = ['superadmin', 'pimpinan', 'bk']
        if user.role not in admin_roles and izin.guru != user:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki akses ke data ini'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = IzinGuruSerializer(izin, context={'request': request})

        return Response({
            'success': True,
            'data': serializer.data
        })

    except IzinGuru.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Izin tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def izin_guru_export_pdf(request):
    """
    Export rekap izin guru ke PDF menggunakan reportlab.

    Query params:
    - tanggal_mulai: Filter tanggal mulai (YYYY-MM-DD)
    - tanggal_selesai: Filter tanggal selesai (YYYY-MM-DD)
    """
    user = request.user

    # Only admin roles can export
    admin_roles = ['superadmin', 'pimpinan', 'bk']
    if user.role not in admin_roles:
        return Response({
            'success': False,
            'message': 'Hanya pimpinan yang dapat mengekspor rekap izin'
        }, status=status.HTTP_403_FORBIDDEN)

    # Get filters
    tanggal_mulai = request.query_params.get('tanggal_mulai')
    tanggal_selesai = request.query_params.get('tanggal_selesai')

    queryset = IzinGuru.objects.select_related('guru', 'tahun_ajaran').all()

    if tanggal_mulai:
        queryset = queryset.filter(tanggal_mulai__gte=tanggal_mulai)
    if tanggal_selesai:
        queryset = queryset.filter(tanggal_selesai__lte=tanggal_selesai)

    queryset = queryset.order_by('tanggal_mulai')

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from io import BytesIO
        from datetime import datetime

        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )

        elements = []
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=12
        )

        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=20
        )

        # Header
        elements.append(Paragraph("REKAP IZIN GURU", title_style))
        elements.append(Paragraph("Pondok Pesantren Baron", subtitle_style))

        # Period info
        periode_text = "Periode: "
        if tanggal_mulai and tanggal_selesai:
            periode_text += f"{tanggal_mulai} s/d {tanggal_selesai}"
        elif tanggal_mulai:
            periode_text += f"Mulai {tanggal_mulai}"
        elif tanggal_selesai:
            periode_text += f"Sampai {tanggal_selesai}"
        else:
            periode_text += "Semua Data"

        elements.append(Paragraph(periode_text, subtitle_style))
        elements.append(Spacer(1, 0.5*cm))

        # Table header
        table_data = [
            ['No', 'Nama Guru', 'Jenis Izin', 'Tanggal Mulai', 'Tanggal Selesai', 'Durasi', 'Keterangan']
        ]

        # Table data
        for idx, izin in enumerate(queryset, start=1):
            table_data.append([
                str(idx),
                izin.guru.name or izin.guru.username,
                izin.get_jenis_izin_display(),
                izin.tanggal_mulai.strftime('%d/%m/%Y'),
                izin.tanggal_selesai.strftime('%d/%m/%Y'),
                f"{izin.durasi_hari} hari",
                izin.keterangan[:50] + '...' if len(izin.keterangan) > 50 else izin.keterangan
            ])

        # Create table
        col_widths = [1*cm, 5*cm, 3*cm, 3*cm, 3*cm, 2*cm, 7*cm]
        table = Table(table_data, colWidths=col_widths)

        table.setStyle(TableStyle([
            # Header style
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

            # Data style
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # No column
            ('ALIGN', (3, 1), (5, -1), 'CENTER'),  # Date & duration columns

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')])
        ]))

        elements.append(table)

        # Summary
        elements.append(Spacer(1, 1*cm))

        summary_style = ParagraphStyle(
            'Summary',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_LEFT
        )

        total_izin = queryset.count()
        total_hari = sum(izin.durasi_hari for izin in queryset)

        elements.append(Paragraph(f"<b>Total Izin:</b> {total_izin} pengajuan", summary_style))
        elements.append(Paragraph(f"<b>Total Hari Izin:</b> {total_hari} hari", summary_style))
        elements.append(Spacer(1, 0.5*cm))

        # Footer
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_LEFT,
            textColor=colors.grey
        )
        elements.append(Paragraph(
            f"Dicetak pada: {datetime.now().strftime('%d/%m/%Y %H:%M')} oleh {user.name or user.username}",
            footer_style
        ))

        # Build PDF
        doc.build(elements)

        # Get PDF value
        pdf = buffer.getvalue()
        buffer.close()

        # Return response
        response = HttpResponse(content_type='application/pdf')
        filename = f"rekap_izin_guru_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(pdf)

        return response

    except ImportError:
        return Response({
            'success': False,
            'message': 'reportlab tidak terinstall. Jalankan: pip install reportlab'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        import traceback
        return Response({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
