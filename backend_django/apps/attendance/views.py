from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from calendar import monthrange

from .models import Attendance, AttendanceDraft, TitipanTugas
from .serializers import (
    AttendanceSerializer, AttendanceCreateSerializer,
    AttendanceUpdateSerializer, AttendanceDraftSerializer,
    AttendanceStatsSerializer, AttendanceStatsSummarySerializer,
    MonthlyAttendanceSerializer, TitipanTugasSerializer,
    TitipanTugasCreateSerializer, TitipanTugasTandaiSerializer
)
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsGuru


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGuru])
def initialize_attendance(request):
    """
    Initialize attendance draft dengan dukungan jam pelajaran (JP 1-9)

    Request body:
    {
        "kelas": "XII A",
        "tanggal": "2024-02-07",
        "mata_pelajaran": "Matematika",
        "jam_ke": [2, 3]  // Array jam pelajaran (opsional, default [1])
    }
    """
    kelas = request.data.get('kelas')
    tanggal = request.data.get('tanggal')
    mata_pelajaran = request.data.get('mata_pelajaran')
    jam_ke = request.data.get('jam_ke', [1])  # Default JP 1

    # Normalize jam_ke to list
    if isinstance(jam_ke, int):
        jam_ke = [jam_ke]
    elif isinstance(jam_ke, str):
        jam_ke = [int(jam_ke)]

    # Validate jam_ke range (1-9)
    valid_jam = [j for j in jam_ke if 1 <= j <= 9]
    if not valid_jam:
        return Response({
            'success': False,
            'message': 'Jam pelajaran harus antara 1-9'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not kelas or not tanggal or not mata_pelajaran:
        return Response({
            'success': False,
            'message': 'Kelas, tanggal, dan mata pelajaran harus diisi'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        tanggal_obj = datetime.strptime(tanggal, '%Y-%m-%d').date()
    except ValueError:
        return Response({
            'success': False,
            'message': 'Format tanggal tidak valid (gunakan YYYY-MM-DD)'
        }, status=status.HTTP_400_BAD_REQUEST)

    from apps.students.models import Student

    students = Student.objects.filter(kelas=kelas, aktif=True)

    if not students.exists():
        return Response({
            'success': False,
            'message': 'Tidak ada siswa aktif di kelas ini'
        }, status=status.HTTP_404_NOT_FOUND)

    # Check existing attendance for first jam_ke in list
    first_jam = valid_jam[0]
    draft_data = []

    for student in students:
        existing_attendance = Attendance.objects.filter(
            nisn=student,
            tanggal=tanggal_obj,
            jam_ke=first_jam
        ).first()

        if existing_attendance:
            draft_data.append({
                'nisn': student.nisn,
                'nama': student.nama,
                'status': existing_attendance.status,
                'keterangan': existing_attendance.keterangan or ''
            })
        else:
            draft_data.append({
                'nisn': student.nisn,
                'nama': student.nama,
                'status': None,  # Belum diisi
                'keterangan': ''
            })

    draft = AttendanceDraft.objects.create(
        username=request.user.username,
        kelas=kelas,
        tanggal=tanggal_obj,
        mata_pelajaran=mata_pelajaran,
        data={
            'jam_ke': valid_jam,
            'students': draft_data
        }
    )

    # Generate jam labels
    jam_labels = [Attendance.get_jam_label(j) for j in valid_jam]

    return Response({
        'success': True,
        'message': 'Draft absensi berhasil dibuat',
        'draft_id': draft.id,
        'jam_ke': valid_jam,
        'jam_labels': jam_labels,
        'data': draft_data,
        'total_students': len(draft_data)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGuru])
def save_batch_attendance(request):
    """
    Save batch attendance dengan dukungan multiple jam pelajaran

    Request body (2 modes):

    Mode 1 - Via Draft ID:
    {
        "draft_id": 123,
        "attendance_data": [
            {"nisn": "xxx", "status": "Hadir", "keterangan": ""}
        ],
        // Optional new fields v2.3.9 (session-level, same for all students):
        "tipe_pengajar": "guru_asli" | "guru_pengganti",
        "guru_pengganti": <user_id>,  // Required if tipe_pengajar="guru_pengganti"
        "capaian_pembelajaran": "...",
        "materi": "...",
        "catatan": "..."
    }

    Mode 2 - Direct (tanpa draft):
    {
        "kelas": "XII A",
        "tanggal": "2024-02-07",
        "mata_pelajaran": "Matematika",
        "jam_ke": [2, 3],  // Array - akan disimpan untuk SETIAP jam
        "attendance_data": [
            {"nisn": "xxx", "status": "Hadir", "keterangan": ""}
        ],
        // Optional new fields v2.3.9:
        "tipe_pengajar": "guru_pengampu" | "guru_piket",
        "guru_pengganti": <user_id>,
        "tujuan_pembelajaran": "...",
        "capaian_pembelajaran": "...",
        "materi": "...",
        "catatan": "..."
    }
    """
    draft_id = request.data.get('draft_id')
    attendance_data = request.data.get('attendance_data', [])

    # === NEW FIELDS v2.3.9 (session-level) ===
    tipe_pengajar = request.data.get('tipe_pengajar', 'guru_pengampu')
    tujuan_pembelajaran = request.data.get('tujuan_pembelajaran', '')
    capaian_pembelajaran = request.data.get('capaian_pembelajaran', '')
    materi = request.data.get('materi', '')
    catatan = request.data.get('catatan', '')

    # === NEW FIELDS v2.3.11 ===
    ada_penilaian = request.data.get('ada_penilaian', False)
    ketuntasan_materi = request.data.get('ketuntasan_materi', 0)

    # Validate ada_penilaian (convert to bool)
    if isinstance(ada_penilaian, str):
        ada_penilaian = ada_penilaian.lower() in ('true', '1', 'yes')

    # Validate ketuntasan_materi (0-100)
    try:
        ketuntasan_materi = int(ketuntasan_materi)
        ketuntasan_materi = max(0, min(100, ketuntasan_materi))
    except (ValueError, TypeError):
        ketuntasan_materi = 0

    # Validate tipe_pengajar
    if tipe_pengajar not in ['guru_pengampu', 'guru_piket']:
        tipe_pengajar = 'guru_pengampu'

    # Auto-use request.user as guru_pengganti (no manual selection needed)
    guru_pengganti = None
    if tipe_pengajar == 'guru_piket':
        guru_pengganti = request.user
    # === END NEW FIELDS ===

    # Determine source of metadata
    if draft_id:
        # Mode 1: Via draft
        try:
            draft = AttendanceDraft.objects.get(id=draft_id, username=request.user.username)
            kelas = draft.kelas
            tanggal = draft.tanggal
            mata_pelajaran = draft.mata_pelajaran
            jam_ke_list = draft.data.get('jam_ke', [1])
        except AttendanceDraft.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Draft tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
    else:
        # Mode 2: Direct submission
        kelas = request.data.get('kelas')
        tanggal_str = request.data.get('tanggal')
        mata_pelajaran = request.data.get('mata_pelajaran')
        jam_ke = request.data.get('jam_ke', [1])

        if not kelas or not tanggal_str or not mata_pelajaran:
            return Response({
                'success': False,
                'message': 'Kelas, tanggal, dan mata pelajaran harus diisi'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Format tanggal tidak valid'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Normalize jam_ke to list
        if isinstance(jam_ke, int):
            jam_ke_list = [jam_ke]
        elif isinstance(jam_ke, str):
            jam_ke_list = [int(jam_ke)]
        else:
            jam_ke_list = jam_ke

    # Validate jam_ke range
    jam_ke_list = [j for j in jam_ke_list if 1 <= j <= 9]
    if not jam_ke_list:
        return Response({
            'success': False,
            'message': 'Jam pelajaran harus antara 1-9'
        }, status=status.HTTP_400_BAD_REQUEST)

    saved_count = 0
    updated_count = 0
    error_count = 0
    errors = []

    from apps.students.models import Student

    # Loop through each student
    for item in attendance_data:
        try:
            nisn = item.get('nisn')
            status_val = item.get('status')
            keterangan = item.get('keterangan', '')

            if not nisn or not status_val:
                error_count += 1
                errors.append(f'NISN atau status kosong')
                continue

            student = Student.objects.get(nisn=nisn)

            # Loop through each jam_ke and create/update attendance
            for jam in jam_ke_list:
                existing = Attendance.objects.filter(
                    nisn=student,
                    tanggal=tanggal,
                    jam_ke=jam
                ).first()

                if existing:
                    existing.status = status_val
                    existing.keterangan = keterangan
                    existing.mata_pelajaran = mata_pelajaran
                    # Update new fields v2.3.9
                    existing.tipe_pengajar = tipe_pengajar
                    existing.guru_pengganti = guru_pengganti
                    existing.tujuan_pembelajaran = tujuan_pembelajaran or existing.tujuan_pembelajaran
                    existing.capaian_pembelajaran = capaian_pembelajaran or existing.capaian_pembelajaran
                    existing.materi = materi or existing.materi
                    existing.catatan = catatan or existing.catatan
                    # Update new fields v2.3.11
                    existing.ada_penilaian = ada_penilaian
                    existing.ketuntasan_materi = ketuntasan_materi
                    existing.save()
                    updated_count += 1
                else:
                    Attendance.objects.create(
                        nisn=student,
                        tanggal=tanggal,
                        jam_ke=jam,
                        mata_pelajaran=mata_pelajaran,
                        status=status_val,
                        keterangan=keterangan,
                        # New fields v2.3.9
                        tipe_pengajar=tipe_pengajar,
                        guru_pengganti=guru_pengganti,
                        tujuan_pembelajaran=tujuan_pembelajaran,
                        capaian_pembelajaran=capaian_pembelajaran,
                        materi=materi,
                        catatan=catatan,
                        # New fields v2.3.11
                        ada_penilaian=ada_penilaian,
                        ketuntasan_materi=ketuntasan_materi
                    )
                    saved_count += 1

        except Student.DoesNotExist:
            error_count += 1
            errors.append(f'Siswa dengan NISN {item.get("nisn")} tidak ditemukan')
        except Exception as e:
            error_count += 1
            errors.append(f'Error: {str(e)}')

    # === AUTO POIN GURU PIKET v2.3.9 ===
    # Create EmployeeEvaluation record for guru_piket (+5 poin)
    if tipe_pengajar == 'guru_piket' and guru_pengganti and (saved_count > 0 or updated_count > 0):
        try:
            from apps.kesantrian.models import EmployeeEvaluation
            from apps.kesantrian.signals import get_current_tahun_ajaran, get_current_semester

            # Format tanggal for keterangan
            tanggal_str = tanggal.strftime('%d/%m/%Y') if hasattr(tanggal, 'strftime') else str(tanggal)
            jam_str = ', '.join(map(str, jam_ke_list))

            EmployeeEvaluation.objects.create(
                user=guru_pengganti,
                tanggal=tanggal,
                jenis='tugas_tambahan',
                poin=5,
                keterangan=f"Guru Piket - {kelas} - {tanggal_str} (JP {jam_str})",
                tahun_ajaran=get_current_tahun_ajaran(),
                semester=get_current_semester(),
                created_by=f'SYSTEM_ATTENDANCE_{request.user.username}'
            )

            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"[AUTO-PIKET] Created +5 poin for {guru_pengganti.username}: "
                f"Piket kelas {kelas} tanggal {tanggal_str}"
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"[AUTO-PIKET] Failed to create evaluation: {str(e)}")
            # Don't fail the whole operation, just log the error
    # === END AUTO POIN ===

    # Delete draft if used
    if draft_id:
        try:
            AttendanceDraft.objects.filter(id=draft_id).delete()
        except:
            pass

    return Response({
        'success': True,
        'message': f'Absensi berhasil disimpan untuk JP {", ".join(map(str, jam_ke_list))}',
        'jam_ke': jam_ke_list,
        'saved': saved_count,
        'updated': updated_count,
        'errors': error_count,
        'error_details': errors if errors else None
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_today_attendance(request, nisn):
    """Get today's attendance for a student, ordered by jam_ke"""
    today = timezone.now().date()

    try:
        from apps.students.models import Student
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Siswa tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if user.role == 'walisantri' and user.linked_student_nisn != nisn:
        return Response({
            'success': False,
            'message': 'Anda tidak memiliki akses ke data siswa ini'
        }, status=status.HTTP_403_FORBIDDEN)

    attendances = Attendance.objects.filter(
        nisn=student,
        tanggal=today
    ).order_by('jam_ke')

    # Format with jam labels
    attendance_list = []
    for att in attendances:
        attendance_list.append({
            'id': att.id,
            'jam_ke': att.jam_ke,
            'jam_label': Attendance.get_jam_label(att.jam_ke),
            'waktu_kategori': att.waktu_kategori,
            'mata_pelajaran': att.mata_pelajaran,
            'status': att.status,
            'keterangan': att.keterangan
        })

    return Response({
        'success': True,
        'date': today,
        'attendances': attendance_list
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_monthly_attendance(request, nisn, month, year):
    try:
        month = int(month)
        year = int(year)
    except ValueError:
        return Response({
            'success': False,
            'message': 'Month dan year harus angka'
        }, status=status.HTTP_400_BAD_REQUEST)

    if month < 1 or month > 12:
        return Response({
            'success': False,
            'message': 'Month harus antara 1-12'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from apps.students.models import Student
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Siswa tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if user.role == 'walisantri' and user.linked_student_nisn != nisn:
        return Response({
            'success': False,
            'message': 'Anda tidak memiliki akses ke data siswa ini'
        }, status=status.HTTP_403_FORBIDDEN)

    days_in_month = monthrange(year, month)[1]

    attendances = Attendance.objects.filter(
        nisn=student,
        tanggal__year=year,
        tanggal__month=month
    ).order_by('tanggal', 'jam_ke')

    attendance_data = []
    hari_indo = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

    for attendance in attendances:
        attendance_data.append({
            'nisn': student.nisn,
            'nama': student.nama,
            'tanggal': attendance.tanggal,
            'hari': hari_indo[attendance.tanggal.weekday()],
            'jam_ke': attendance.jam_ke,
            'jam_label': Attendance.get_jam_label(attendance.jam_ke),
            'mata_pelajaran': attendance.mata_pelajaran,
            'status': attendance.status,
            'keterangan': attendance.keterangan
        })

    total_hadir = attendances.filter(status='Hadir').count()
    total_sakit = attendances.filter(status='Sakit').count()
    total_izin = attendances.filter(status='Izin').count()
    total_alpha = attendances.filter(status='Alpha').count()

    total_kehadiran = attendances.count()
    persentase_kehadiran = 0
    if total_kehadiran > 0:
        persentase_kehadiran = round((total_hadir / total_kehadiran) * 100, 2)

    summary = {
        'total_hadir': total_hadir,
        'total_sakit': total_sakit,
        'total_izin': total_izin,
        'total_alpha': total_alpha,
        'total_kehadiran': total_kehadiran,
        'persentase_kehadiran': persentase_kehadiran
    }

    return Response({
        'success': True,
        'month': month,
        'year': year,
        'attendance_data': attendance_data,
        'summary': summary
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attendance_stats(request, nisn):
    try:
        from apps.students.models import Student
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Siswa tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if user.role == 'walisantri' and user.linked_student_nisn != nisn:
        return Response({
            'success': False,
            'message': 'Anda tidak memiliki akses ke data siswa ini'
        }, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()
    thirty_days_ago = today - timedelta(days=30)

    recent_attendance = Attendance.objects.filter(
        nisn=student,
        tanggal__gte=thirty_days_ago
    )

    total_hadir = recent_attendance.filter(status='Hadir').count()
    total_sakit = recent_attendance.filter(status='Sakit').count()
    total_izin = recent_attendance.filter(status='Izin').count()
    total_alpha = recent_attendance.filter(status='Alpha').count()

    total_kehadiran = recent_attendance.count()
    persentase_kehadiran = 0
    if total_kehadiran > 0:
        persentase_kehadiran = round((total_hadir / total_kehadiran) * 100, 2)

    last_30_days_data = []
    for i in range(30):
        date = thirty_days_ago + timedelta(days=i)
        attendance = recent_attendance.filter(tanggal=date).first()
        last_30_days_data.append({
            'date': date,
            'status': attendance.status if attendance else 'Tidak ada data'
        })

    return Response({
        'success': True,
        'student': {
            'nisn': student.nisn,
            'nama': student.nama,
            'kelas': student.kelas
        },
        'period': {
            'start': thirty_days_ago,
            'end': today,
            'days': 30
        },
        'statistics': {
            'total_hadir': total_hadir,
            'total_sakit': total_sakit,
            'total_izin': total_izin,
            'total_alpha': total_alpha,
            'total_kehadiran': total_kehadiran,
            'persentase_kehadiran': persentase_kehadiran
        },
        'last_30_days': last_30_days_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_class_attendance(request, kelas, tanggal):
    """
    Get class attendance for a specific date

    Query params:
    - jam_ke: Filter by specific jam pelajaran (optional)
    """
    try:
        tanggal_obj = datetime.strptime(tanggal, '%Y-%m-%d').date()
    except ValueError:
        return Response({
            'success': False,
            'message': 'Format tanggal tidak valid (gunakan YYYY-MM-DD)'
        }, status=status.HTTP_400_BAD_REQUEST)

    user = request.user

    if user.role == 'walisantri':
        return Response({
            'success': False,
            'message': 'Walisantri tidak dapat mengakses data kelas'
        }, status=status.HTTP_403_FORBIDDEN)

    # Optional jam_ke filter
    jam_ke_filter = request.query_params.get('jam_ke')

    from apps.students.models import Student

    students = Student.objects.filter(kelas=kelas, aktif=True).order_by('nama')

    student_ids = list(students.values_list('id', flat=True))

    # Build attendance query
    att_queryset = Attendance.objects.filter(
        nisn_id__in=student_ids,
        tanggal=tanggal_obj
    )

    if jam_ke_filter:
        att_queryset = att_queryset.filter(jam_ke=int(jam_ke_filter))

    attendances = att_queryset.order_by('jam_ke', 'nisn_id')

    # Group by student
    attendance_dict = {}
    for att in attendances:
        nisn_id = att.nisn_id
        if nisn_id not in attendance_dict:
            attendance_dict[nisn_id] = []
        attendance_dict[nisn_id].append({
            'jam_ke': att.jam_ke,
            'jam_label': Attendance.get_jam_label(att.jam_ke),
            'mata_pelajaran': att.mata_pelajaran,
            'status': att.status,
            'keterangan': att.keterangan
        })

    attendance_data = []
    for student in students:
        student_data = {
            'nisn': student.nisn,
            'nama': student.nama,
            'attendances': attendance_dict.get(student.id, [])
        }
        attendance_data.append(student_data)

    # Get unique jam_ke for this date/class
    jam_ke_list = list(att_queryset.values_list('jam_ke', flat=True).distinct().order_by('jam_ke'))

    return Response({
        'success': True,
        'kelas': kelas,
        'tanggal': tanggal,
        'jam_ke_available': jam_ke_list,
        'attendance_data': attendance_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsPimpinan])
def get_all_attendance(request):
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 25))

    kelas = request.query_params.get('kelas')
    status_filter = request.query_params.get('status')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    queryset = Attendance.objects.select_related('nisn')

    if kelas:
        queryset = queryset.filter(nisn__kelas=kelas)

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    if start_date:
        queryset = queryset.filter(tanggal__gte=start_date)

    if end_date:
        queryset = queryset.filter(tanggal__lte=end_date)

    queryset = queryset.order_by('-tanggal', 'jam_ke')

    start = (page - 1) * page_size
    end = start + page_size

    total = queryset.count()
    attendances = queryset[start:end]

    serializer = AttendanceSerializer(attendances, many=True)

    return Response({
        'success': True,
        'count': total,
        'page': page,
        'page_size': page_size,
        'next': page * page_size < total,
        'previous': page > 1,
        'results': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attendance_history(request):
    """
    Get attendance history.

    - Walisantri: Returns individual attendance records for their child (simple list)
    - Guru: Returns grouped class statistics FILTERED by guru's schedule
    - Pimpinan/SuperAdmin: Returns ALL grouped class statistics (no filter)
      - Can filter by specific guru using `guru` parameter

    Query params:
    - page: Page number (default 1)
    - page_size: Items per page (default 10)
    - kelas: Filter by class
    - start_date: Filter start date
    - end_date: Filter end date
    - jam_ke: Filter by specific jam pelajaran
    - guru: Filter by specific guru username (admin only)
    """
    from apps.students.models import Schedule
    from apps.accounts.models import User

    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 10))

    kelas = request.query_params.get('kelas')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    jam_ke_filter = request.query_params.get('jam_ke')
    guru_filter = request.query_params.get('guru')  # Admin only

    user = request.user
    queryset = Attendance.objects.select_related('nisn')

    # DEBUG: Log user role
    print(f"[DEBUG] get_attendance_history - User: {user.username}, Role: {user.role}")

    # For walisantri, use larger page_size to ensure complete daily data
    if user.role == 'walisantri':
        page_size = max(page_size, 50)  # At least 50 records for parent view

    # ========== WALISANTRI VIEW: Simple personal attendance list ==========
    if user.role == 'walisantri':
        print(f"[DEBUG] Walisantri detected - returning parent view")
        if not user.linked_student_nisn:
            return Response({
                'success': True,
                'view_type': 'parent',
                'count': 0,
                'page': page,
                'page_size': page_size,
                'next': False,
                'previous': False,
                'results': []
            })

        # Filter for linked student only
        queryset = queryset.filter(nisn__nisn=user.linked_student_nisn)

        if start_date:
            queryset = queryset.filter(tanggal__gte=start_date)
        if end_date:
            queryset = queryset.filter(tanggal__lte=end_date)

        # Order by date descending, then jam_ke
        queryset = queryset.order_by('-tanggal', 'jam_ke')

        # Pagination
        total = queryset.count()
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated = queryset[start_idx:end_idx]

        # Format results for walisantri (simple list)
        results = []
        for att in paginated:
            results.append({
                'id': att.id,
                'tanggal': att.tanggal,
                'jam_ke': att.jam_ke,
                'jam_label': Attendance.get_jam_label(att.jam_ke),
                'mata_pelajaran': att.mata_pelajaran or '-',
                'status': att.status,
                'keterangan': att.keterangan or ''
            })

        return Response({
            'success': True,
            'view_type': 'parent',  # Indicator for frontend
            'count': total,
            'page': page,
            'page_size': page_size,
            'next': page * page_size < total,
            'previous': page > 1,
            'results': results
        })

    # ========== GURU VIEW: Filter by guru's schedule ==========
    # Role superadmin/pimpinan/admin → tampilkan semua (tidak difilter)
    if user.role == 'guru' or user.role == 'musyrif':
        # Get jadwal guru yang login dari Schedule
        jadwal_guru = Schedule.objects.filter(
            username=user.username,
            is_active=True
        ).values_list('jam_ke', 'mata_pelajaran', 'kelas')

        # Build query filter: (jam_ke, mata_pelajaran) combinations
        if jadwal_guru.exists():
            query = Q()
            for jam_ke, mapel, kelas_jadwal in jadwal_guru:
                query |= Q(jam_ke=jam_ke, mata_pelajaran=mapel)

            # Also include where user is guru_pengganti
            query |= Q(guru_pengganti=user)

            queryset = queryset.filter(query)
        else:
            # Guru tidak punya jadwal, hanya tampilkan di mana dia guru_pengganti
            queryset = queryset.filter(guru_pengganti=user)

    # ========== ADMIN VIEW: Filter by specific guru (optional) ==========
    elif user.role in ['superadmin', 'pimpinan', 'admin'] and guru_filter:
        # Admin wants to filter by specific guru
        try:
            target_guru = User.objects.get(username=guru_filter)
            # Get jadwal for target guru
            jadwal_target = Schedule.objects.filter(
                username=guru_filter,
                is_active=True
            ).values_list('jam_ke', 'mata_pelajaran', 'kelas')

            if jadwal_target.exists():
                query = Q()
                for jam_ke, mapel, kelas_jadwal in jadwal_target:
                    query |= Q(jam_ke=jam_ke, mata_pelajaran=mapel)

                # Also include where target is guru_pengganti
                query |= Q(guru_pengganti=target_guru)

                queryset = queryset.filter(query)
            else:
                # Target guru tidak punya jadwal, hanya tampilkan di mana dia guru_pengganti
                queryset = queryset.filter(guru_pengganti=target_guru)
        except User.DoesNotExist:
            pass  # Invalid guru username, ignore filter

    # ========== GURU/ADMIN VIEW: Grouped class statistics ==========
    if kelas:
        queryset = queryset.filter(nisn__kelas=kelas)

    if start_date:
        queryset = queryset.filter(tanggal__gte=start_date)

    if end_date:
        queryset = queryset.filter(tanggal__lte=end_date)

    if jam_ke_filter:
        queryset = queryset.filter(jam_ke=int(jam_ke_filter))

    # First, get all data grouped by tanggal, kelas, jam_ke, mata_pelajaran
    raw_data = queryset.values(
        'tanggal', 'nisn__kelas', 'jam_ke', 'mata_pelajaran'
    ).annotate(
        total_students=Count('nisn', distinct=True),
        hadir=Count('id', filter=Q(status='Hadir')),
        sakit=Count('id', filter=Q(status='Sakit')),
        izin=Count('id', filter=Q(status='Izin')),
        alpha=Count('id', filter=Q(status='Alpha'))
    ).order_by('-tanggal', 'nisn__kelas', 'mata_pelajaran', 'jam_ke')

    # Merge rows with same tanggal, kelas, mata_pelajaran
    merged_data = {}
    for item in raw_data:
        key = (item['tanggal'], item['nisn__kelas'], item['mata_pelajaran'] or '-')

        if key not in merged_data:
            merged_data[key] = {
                'tanggal': item['tanggal'],
                'kelas': item['nisn__kelas'],
                'mata_pelajaran': item['mata_pelajaran'] or '-',
                'jam_ke_list': [],
                'total_students': 0,
                'hadir': 0,
                'sakit': 0,
                'izin': 0,
                'alpha': 0
            }

        # Append jam_ke to list
        merged_data[key]['jam_ke_list'].append(item['jam_ke'])
        # Use max for total_students (same students across JPs)
        merged_data[key]['total_students'] = max(
            merged_data[key]['total_students'],
            item['total_students']
        )
        # Sum attendance counts
        merged_data[key]['hadir'] += item['hadir']
        merged_data[key]['sakit'] += item['sakit']
        merged_data[key]['izin'] += item['izin']
        merged_data[key]['alpha'] += item['alpha']

    # Convert to list and sort
    merged_list = list(merged_data.values())
    merged_list.sort(key=lambda x: (x['tanggal'], x['kelas']), reverse=True)

    # Pagination
    total = len(merged_list)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_data = merged_list[start:end]

    # Format results
    results = []
    for item in paginated_data:
        jam_ke_list = sorted(item['jam_ke_list'])
        jam_labels = [f"JP {j}" for j in jam_ke_list]

        results.append({
            'id': f"{item['tanggal']}_{item['kelas']}_{'-'.join(map(str, jam_ke_list))}",
            'tanggal': item['tanggal'],
            'kelas': item['kelas'],
            'jam_ke': jam_ke_list,  # Array of JP numbers
            'jam_ke_display': ', '.join(map(str, jam_ke_list)),  # "2, 3, 4"
            'jam_labels': jam_labels,  # ["JP 2", "JP 3", "JP 4"]
            'mata_pelajaran': item['mata_pelajaran'],
            'total_students': item['total_students'],
            'hadir': item['hadir'],
            'sakit': item['sakit'],
            'izin': item['izin'],
            'alpha': item['alpha']
        })

    return Response({
        'success': True,
        'view_type': 'teacher',  # Indicator for frontend
        'count': total,
        'page': page,
        'page_size': page_size,
        'next': page * page_size < total,
        'previous': page > 1,
        'results': results
    })


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Attendance.objects.all()
        user = self.request.user

        if user.role == 'walisantri':
            queryset = queryset.filter(nisn=user.linked_student_nisn)

        return queryset.select_related('nisn')

    def get_serializer_class(self):
        if self.action == 'create':
            return AttendanceCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return AttendanceUpdateSerializer
        return AttendanceSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, IsGuru]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


# ============================================
# JURNAL PIKET - v2.3.9
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def jurnal_piket(request):
    """
    GET /api/attendance/jurnal-piket/?tanggal=YYYY-MM-DD

    Menampilkan daftar sesi mengajar hari ini yang:
    1. tipe_pengajar = 'guru_pengganti' (sudah ada pengganti), ATAU
    2. Ada siswa dengan status tidak_hadir/izin/sakit (indikasi guru tidak hadir)

    Grouped by: kelas + mata_pelajaran + jam_ke
    """
    from django.db.models import Count, F
    from apps.students.models import Student

    # Get tanggal parameter (default: hari ini)
    tanggal_str = request.query_params.get('tanggal')
    if tanggal_str:
        try:
            tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Format tanggal tidak valid (gunakan YYYY-MM-DD)'
            }, status=status.HTTP_400_BAD_REQUEST)
    else:
        tanggal = timezone.now().date()

    # Query attendance records for the date
    # Group by kelas, mata_pelajaran, jam_ke to get unique sessions
    attendance_qs = Attendance.objects.filter(tanggal=tanggal)

    # Get distinct sessions (kelas + mapel + jam_ke)
    sessions = attendance_qs.values(
        'nisn__kelas', 'mata_pelajaran', 'jam_ke',
        'tipe_pengajar', 'guru_pengganti', 'guru_pengganti__name',
        'materi', 'capaian_pembelajaran', 'catatan'
    ).annotate(
        total_siswa=Count('id'),
        hadir=Count('id', filter=Q(status__iexact='Hadir')),
        tidak_hadir=Count('id', filter=Q(status__iexact='Tidak Hadir')),
        izin=Count('id', filter=Q(status__iexact='Izin')),
        sakit=Count('id', filter=Q(status__iexact='Sakit')),
        alpha=Count('id', filter=Q(status__iexact='Alpha'))
    ).order_by('nisn__kelas', 'jam_ke')

    # Filter: hanya sesi dengan guru_pengganti ATAU ada ketidakhadiran massal
    result = []
    for session in sessions:
        kelas = session['nisn__kelas']
        mapel = session['mata_pelajaran']
        jam_ke = session['jam_ke']
        tipe = session['tipe_pengajar']
        guru_pengganti_id = session['guru_pengganti']
        guru_pengganti_name = session['guru_pengganti__name']

        # Hitung persentase ketidakhadiran
        total = session['total_siswa']
        absen = session['tidak_hadir'] + session['izin'] + session['sakit'] + session['alpha']
        persen_absen = (absen / total * 100) if total > 0 else 0

        # Include jika:
        # 1. Ada guru pengganti, ATAU
        # 2. Ketidakhadiran > 50% (indikasi kelas kosong/guru tidak hadir)
        is_piket = tipe == 'guru_pengganti'
        is_kosong = persen_absen > 50

        if is_piket or is_kosong:
            # Determine status
            if is_piket:
                status_text = 'Sudah Ditangani'
                status_code = 'handled'
            else:
                status_text = 'Belum Ada Pengganti'
                status_code = 'pending'

            # Get JP label
            jp_labels = {
                1: 'JP 1 (Pagi)',
                2: 'JP 2', 3: 'JP 3', 4: 'JP 4', 5: 'JP 5', 6: 'JP 6', 7: 'JP 7',
                8: 'JP 8 (Sore)', 9: 'JP 9 (Sore)'
            }

            result.append({
                'kelas': kelas,
                'mata_pelajaran': mapel,
                'jam_ke': jam_ke,
                'jam_ke_label': jp_labels.get(jam_ke, f'JP {jam_ke}'),
                'tipe_pengajar': tipe,
                'guru_pengganti_id': guru_pengganti_id,
                'guru_pengganti_nama': guru_pengganti_name,
                'materi': session['materi'] or '',
                'capaian_pembelajaran': session['capaian_pembelajaran'] or '',
                'catatan': session['catatan'] or '',
                'total_siswa': total,
                'hadir': session['hadir'],
                'tidak_hadir': absen,
                'persen_hadir': round((session['hadir'] / total * 100) if total > 0 else 0, 1),
                'status': status_code,
                'status_display': status_text
            })

    # Summary stats
    total_sesi = len(result)
    handled = sum(1 for r in result if r['status'] == 'handled')
    pending = sum(1 for r in result if r['status'] == 'pending')

    # Get titipan tugas for this date
    titipan_qs = TitipanTugas.objects.filter(tanggal_berlaku=tanggal).select_related('guru', 'guru_piket')
    titipan_list = []
    for t in titipan_qs:
        titipan_list.append({
            'id': t.id,
            'guru_nama': t.guru.name or t.guru.username if t.guru else None,
            'kelas': t.kelas,
            'mata_pelajaran': t.mata_pelajaran,
            'deskripsi_tugas': t.deskripsi_tugas,
            'status': t.status,
            'status_display': t.get_status_display(),
            'guru_piket_nama': t.guru_piket.name or t.guru_piket.username if t.guru_piket else None,
            'catatan_piket': t.catatan_piket
        })

    return Response({
        'success': True,
        'tanggal': tanggal.strftime('%Y-%m-%d'),
        'tanggal_display': tanggal.strftime('%d %B %Y'),
        'summary': {
            'total_sesi': total_sesi,
            'sudah_ditangani': handled,
            'belum_pengganti': pending,
            'titipan_total': len(titipan_list),
            'titipan_menunggu': sum(1 for t in titipan_list if t['status'] == 'menunggu')
        },
        'data': result,
        'titipan_tugas': titipan_list
    })


# =============================================================
# TITIPAN TUGAS
# =============================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def titipan_tugas_list_create(request):
    """
    GET: List titipan tugas (filter by tanggal_berlaku, status)
    POST: Create titipan tugas (auto-set guru=request.user, tahun_ajaran=active)
    """
    if request.method == 'GET':
        queryset = TitipanTugas.objects.all()

        # Filter by tanggal_berlaku
        tanggal = request.query_params.get('tanggal_berlaku')
        if tanggal:
            try:
                tanggal_obj = datetime.strptime(tanggal, '%Y-%m-%d').date()
                queryset = queryset.filter(tanggal_berlaku=tanggal_obj)
            except ValueError:
                pass

        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter in ['menunggu', 'dikerjakan']:
            queryset = queryset.filter(status=status_filter)

        # Filter by kelas
        kelas = request.query_params.get('kelas')
        if kelas:
            queryset = queryset.filter(kelas=kelas)

        serializer = TitipanTugasSerializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    elif request.method == 'POST':
        serializer = TitipanTugasCreateSerializer(data=request.data)
        if serializer.is_valid():
            # Get active tahun_ajaran
            from apps.core.models import TahunAjaran
            tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()
            if not tahun_ajaran:
                return Response({
                    'success': False,
                    'message': 'Tidak ada tahun ajaran aktif'
                }, status=status.HTTP_400_BAD_REQUEST)

            titipan = serializer.save(
                guru=request.user,
                tahun_ajaran=tahun_ajaran
            )
            return Response({
                'success': True,
                'message': 'Titipan tugas berhasil dibuat',
                'data': TitipanTugasSerializer(titipan).data
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Data tidak valid',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def titipan_tugas_tandai(request, pk):
    """
    Mark titipan tugas as dikerjakan by guru piket.
    Auto-set guru_piket=request.user, status='dikerjakan'
    """
    try:
        titipan = TitipanTugas.objects.get(pk=pk)
    except TitipanTugas.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Titipan tugas tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    if titipan.status == 'dikerjakan':
        return Response({
            'success': False,
            'message': 'Titipan tugas sudah dikerjakan sebelumnya'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = TitipanTugasTandaiSerializer(titipan, data=request.data, partial=True)
    if serializer.is_valid():
        titipan = serializer.save(
            guru_piket=request.user,
            status='dikerjakan'
        )
        return Response({
            'success': True,
            'message': 'Titipan tugas berhasil ditandai sebagai dikerjakan',
            'data': TitipanTugasSerializer(titipan).data
        })
    return Response({
        'success': False,
        'message': 'Data tidak valid',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def titipan_tugas_detail(request, pk):
    """
    Get detail of a titipan tugas.
    """
    try:
        titipan = TitipanTugas.objects.get(pk=pk)
    except TitipanTugas.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Titipan tugas tidak ditemukan'
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = TitipanTugasSerializer(titipan)
    return Response({
        'success': True,
        'data': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def guru_assignment_info(request):
    """
    GET /api/attendance/guru/assignment-info/

    Returns kelas and mapel lists based on guru's active assignments.

    Response:
    {
        "success": true,
        "kelas_list": ["XII A", "XII B", ...],
        "mapel_list": ["Matematika", "Al-Quran", ...],
        "assignment_detail": [
            {
                "kelas": "XII A",
                "mapel": "Matematika",
                "tipe": "kbm"
            },
            ...
        ]
    }
    """
    from apps.accounts.models import Assignment
    from apps.core.models import TahunAjaran

    user = request.user

    # Get active tahun ajaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()
    if not tahun_ajaran:
        return Response({
            'success': True,
            'kelas_list': [],
            'mapel_list': [],
            'assignment_detail': []
        })

    # Get user's active assignments (exclude piket)
    assignments = Assignment.objects.filter(
        user=user,
        status='active',
        tahun_ajaran=tahun_ajaran.nama
    ).exclude(
        assignment_type='piket'
    )

    kelas_set = set()
    mapel_set = set()
    assignment_detail = []

    for a in assignments:
        # For kbm, diniyah, wali_kelas - kelas is available
        if a.kelas:
            kelas_set.add(a.kelas)

        # For kbm - mata_pelajaran is available
        if a.mata_pelajaran:
            mapel_set.add(a.mata_pelajaran)

        # Build detail record
        if a.kelas or a.mata_pelajaran:
            assignment_detail.append({
                'kelas': a.kelas or '',
                'mapel': a.mata_pelajaran or '',
                'tipe': a.assignment_type
            })

    return Response({
        'success': True,
        'kelas_list': sorted(list(kelas_set)),
        'mapel_list': sorted(list(mapel_set)),
        'assignment_detail': assignment_detail
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def titipan_tugas_kelas_saya(request):
    """
    Get list of kelas & mata pelajaran assigned to current user.
    Returns unique combinations of (kelas, mata_pelajaran) from active KBM assignments.
    """
    from apps.accounts.models import Assignment
    from apps.core.models import TahunAjaran

    # Get active tahun ajaran
    tahun_ajaran = TahunAjaran.objects.filter(is_active=True).first()
    if not tahun_ajaran:
        return Response({
            'success': True,
            'data': []
        })

    # Get user's active teaching assignments (exclude piket & wali_kelas)
    assignments = Assignment.objects.filter(
        user=request.user,
        status='active',
        tahun_ajaran=tahun_ajaran.nama
    ).exclude(
        assignment_type__in=['piket', 'wali_kelas']
    ).values('kelas', 'mata_pelajaran').distinct()

    result = []
    for a in assignments:
        if a['kelas'] and a['mata_pelajaran']:
            result.append({
                'kelas': a['kelas'],
                'mata_pelajaran': a['mata_pelajaran'],
                'label': f"{a['kelas']} — {a['mata_pelajaran']}"
            })

    return Response({
        'success': True,
        'data': result
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def titipan_tugas_riwayat(request):
    """
    Get titipan tugas created by current user (riwayat guru).
    """
    queryset = TitipanTugas.objects.filter(guru=request.user).order_by('-tanggal_berlaku', '-created_at')

    serializer = TitipanTugasSerializer(queryset, many=True)
    return Response({
        'success': True,
        'count': queryset.count(),
        'data': serializer.data
    })


# =============================================================
# JURNAL HISTORY (PERSONAL) - v2.3.11
# =============================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def jurnal_history(request):
    """
    GET /api/attendance/jurnal/history/

    Mengembalikan riwayat jurnal mengajar HANYA milik guru yang login.
    Filter berdasarkan kelas yang diajar guru (dari Schedule) atau
    attendance dengan guru_pengganti = user.

    Query params:
    - page: Page number (default 1)
    - page_size: Items per page (default 10)
    - start_date: Filter start date (YYYY-MM-DD)
    - end_date: Filter end date (YYYY-MM-DD)
    - kelas: Filter by class
    """
    from django.db.models import Q
    from apps.students.models import Schedule
    from apps.core.models import MasterJam

    user = request.user

    # Only for guru role
    if user.role not in ['guru', 'superadmin', 'pimpinan']:
        return Response({
            'success': False,
            'message': 'Endpoint ini hanya untuk guru'
        }, status=status.HTTP_403_FORBIDDEN)

    # Parse query params
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 10))
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    kelas_filter = request.query_params.get('kelas')

    # Get kelas yang diajar guru dari Schedule
    guru_kelas = Schedule.objects.filter(
        username=user.username,
        is_active=True
    ).values_list('kelas', flat=True).distinct()

    # Build queryset - filter attendance by:
    # 1. Kelas yang diajar guru, ATAU
    # 2. guru_pengganti = user (jika menggantikan)
    # 3. Harus ada materi yang diisi (bukan empty string)
    queryset = Attendance.objects.filter(
        Q(nisn__kelas__in=guru_kelas) | Q(guru_pengganti=user)
    ).exclude(
        Q(materi__isnull=True) | Q(materi__exact='')
    ).select_related('nisn')

    # Apply filters
    if start_date:
        queryset = queryset.filter(tanggal__gte=start_date)
    if end_date:
        queryset = queryset.filter(tanggal__lte=end_date)
    if kelas_filter:
        queryset = queryset.filter(nisn__kelas=kelas_filter)

    # Group by tanggal + kelas + jam_ke + mata_pelajaran (unique session)
    # Use distinct values to avoid duplicate rows for same session
    jurnal_sessions = queryset.values(
        'tanggal', 'jam_ke', 'nisn__kelas', 'mata_pelajaran',
        'materi', 'capaian_pembelajaran', 'catatan',
        'tipe_pengajar', 'guru_pengganti__name',
        'ada_penilaian', 'ketuntasan_materi'
    ).distinct().order_by('-tanggal', '-jam_ke')

    # Pagination
    total = len(jurnal_sessions)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated = list(jurnal_sessions[start_idx:end_idx])

    # Format results
    results = []
    for item in paginated:
        # Get jam_mulai from MasterJam if available
        jam_mulai = None
        try:
            master_jam = MasterJam.objects.filter(jam_ke=item['jam_ke']).first()
            if master_jam and master_jam.jam_mulai:
                jam_mulai = master_jam.jam_mulai.strftime('%H:%M')
        except Exception:
            pass

        results.append({
            'tanggal': item['tanggal'].strftime('%Y-%m-%d') if item['tanggal'] else None,
            'tanggal_display': item['tanggal'].strftime('%d %b %Y') if item['tanggal'] else None,
            'jam_ke': item['jam_ke'],
            'jam_label': Attendance.get_jam_label(item['jam_ke']),
            'jam_mulai': jam_mulai,
            'kelas': item['nisn__kelas'],
            'mapel': item['mata_pelajaran'] or '-',
            'materi': item['materi'] or '',
            'tujuan_pembelajaran': item['capaian_pembelajaran'] or '',
            'catatan': item['catatan'] or '',
            'tipe_pengajar': item['tipe_pengajar'],
            'guru_pengganti_nama': item['guru_pengganti__name'],
            'ada_penilaian': item['ada_penilaian'],
            'ketuntasan_materi': item['ketuntasan_materi']
        })

    return Response({
        'success': True,
        'count': total,
        'page': page,
        'page_size': page_size,
        'next': page * page_size < total,
        'previous': page > 1,
        'results': results
    })
