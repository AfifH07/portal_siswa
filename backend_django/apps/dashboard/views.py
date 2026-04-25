from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Count, Avg, Max, Min, Sum, Q, F
from django.db.models.functions import TruncMonth, ExtractMonth, ExtractYear, Coalesce
from django.utils import timezone
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from datetime import timedelta, datetime
from calendar import month_name

from apps.students.models import Student
from apps.attendance.models import Attendance
from apps.grades.models import Grade
from apps.accounts.models import User
from apps.evaluations.models import Evaluation
from apps.accounts.permissions import IsSuperAdmin, IsPimpinan, IsGuru, IsWalisantri


# ============================================
# UNIFIED DASHBOARD VIEW (Role-Based)
# ============================================

def unified_dashboard(request):
    """
    Single entry point for /dashboard/.

    Langsung render dashboard.html - template akan adapt via JS
    berdasarkan role dari API /users/me/
    """
    return render(request, 'dashboard.html')


# Alias for backwards compatibility
dynamic_dashboard_view = unified_dashboard
  
  
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    user = request.user
    
    try:
        total_students = Student.objects.filter(aktif=True).count()
        total_attendance_today = Attendance.objects.filter(
            tanggal=timezone.now().date()
        ).count()
        
        avg_grade = Grade.objects.filter(
            nisn__aktif=True
        ).aggregate(Avg('nilai'))['nilai__avg'] or 0
        avg_grade = round(avg_grade, 2) if avg_grade else 0
        
        evaluations_count = Evaluation.objects.filter(
            nisn__aktif=True
        ).count()
        
        attendance_rate = 0
        if total_students > 0:
            present_today = Attendance.objects.filter(
                tanggal=timezone.now().date(),
                status='Hadir'
            ).count()
            attendance_rate = round((present_today / total_students) * 100, 2)
        
        hafalan_progress = 0
        active_students = Student.objects.filter(aktif=True)
        if active_students.exists():
            total_current_hafalan = active_students.aggregate(Sum('current_hafalan'))['current_hafalan__sum'] or 0
            total_target_hafalan = active_students.aggregate(Sum('target_hafalan'))['target_hafalan__sum'] or 0
            if total_target_hafalan > 0:
                hafalan_progress = round((total_current_hafalan / total_target_hafalan) * 100, 2)
        
        return Response({
            'success': True,
            'stats': {
                'total_students': total_students,
                'total_classes': active_students.values('kelas').distinct().count(),
                'attendance_today': total_attendance_today,
                'attendance_rate': attendance_rate,
                'average_grade': avg_grade,
                'total_evaluations': evaluations_count,
                'hafalan_progress': hafalan_progress
            }
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_api(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Tidak terautentikasi'}, status=401)
    
    user = request.user
    role = user.role
    
    return Response({
        'success': True,
        'user': {
            'username': user.username,
            'full_name': user.name,
            'role': role,
            'email': user.email,
            'nisn': user.nisn,
            'phone': user.phone,
            'kelas': user.kelas
        },
        'debug_user_info': str(user),
        'debug_is_authenticated': user.is_authenticated
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_chart_data(request):
    user = request.user
    
    try:
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=180)
        
        queryset = Attendance.objects.filter(
            tanggal__range=[start_date, end_date]
        ).annotate(
            month=TruncMonth('tanggal')
        ).values('month', 'status').annotate(
            count=Count('id')
        ).order_by('month')
        
        months_data = {}
        current_date = start_date
        while current_date <= end_date:
            month_key = current_date.replace(day=1)
            month_label = f"{month_name[current_date.month]} {current_date.year}"
            months_data[month_label] = {
                'hadir': 0,
                'izin': 0,
                'sakit': 0,
                'alpha': 0
            }
            current_date = (current_date.replace(day=1) + timedelta(days=32)).replace(day=1)
        
        for item in queryset:
            month_label = f"{month_name[item['month'].month]} {item['month'].year}"
            status = item['status'].lower()
            if status in months_data.get(month_label, {}):
                months_data[month_label][status] = item['count']
        
        labels = list(months_data.keys())
        hadir_data = [months_data[m]['hadir'] for m in labels]
        izin_data = [months_data[m]['izin'] for m in labels]
        sakit_data = [months_data[m]['sakit'] for m in labels]
        alpha_data = [months_data[m]['alpha'] for m in labels]
        
        return Response({
            'success': True,
            'data': {
                'labels': labels,
                'datasets': [
                    {'label': 'Hadir', 'data': hadir_data, 'borderColor': 'rgb(75, 192, 192)', 'backgroundColor': 'rgba(75, 192, 192, 0.2)'},
                    {'label': 'Izin', 'data': izin_data, 'borderColor': 'rgb(255, 205, 86)', 'backgroundColor': 'rgba(255, 205, 86, 0.2)'},
                    {'label': 'Sakit', 'data': sakit_data, 'borderColor': 'rgb(255, 159, 64)', 'backgroundColor': 'rgba(255, 159, 64, 0.2)'},
                    {'label': 'Alpha', 'data': alpha_data, 'borderColor': 'rgb(255, 99, 132)', 'backgroundColor': 'rgba(255, 99, 132, 0.2)'}
                ]
            }
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def grades_distribution_data(request):
    user = request.user
    
    try:
        queryset = Grade.objects.filter(nisn__aktif=True)
        
        grade_a = queryset.filter(nilai__gte=85).count()
        grade_b = queryset.filter(nilai__gte=70, nilai__lt=85).count()
        grade_c = queryset.filter(nilai__gte=55, nilai__lt=70).count()
        grade_d = queryset.filter(nilai__lt=55).count()
        
        return Response({
            'success': True,
            'data': {
                'labels': ['A (85-100)', 'B (70-84)', 'C (55-69)', 'D (<55)'],
                'datasets': [{
                    'data': [grade_a, grade_b, grade_c, grade_d],
                    'backgroundColor': [
                        'rgb(75, 192, 192)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 205, 86)',
                        'rgb(255, 99, 132)'
                    ]
                }]
            }
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def progress_tracking_data(request):
    """
    Progress Tracking data for dashboard table.

    Query params:
    - limit: Max records to return (default: 50, max: 200)
    - order_by: Ordering field (default: 'avg_grade')
        Options: 'avg_grade', 'hafalan', 'nama', 'kelas'

    Returns up to 50 students ordered by average grade (descending).
    """
    user = request.user

    try:
        # Parse query params
        limit = min(int(request.GET.get('limit', 50)), 200)  # Max 200
        order_by = request.GET.get('order_by', 'avg_grade')

        # Use annotate to calculate average grade in single query (fixes N+1)
        from django.db.models import OuterRef, Subquery
        from django.db.models.functions import Coalesce as CoalesceFunc

        # Subquery for average grade per student
        avg_grade_subquery = Grade.objects.filter(
            nisn=OuterRef('pk')
        ).values('nisn').annotate(
            avg=Avg('nilai')
        ).values('avg')[:1]

        queryset = Student.objects.filter(aktif=True).annotate(
            avg_grade=Coalesce(Subquery(avg_grade_subquery), 0.0)
        )

        if user.role == 'guru':
            queryset = queryset.filter(kelas=user.kelas)
        elif user.role == 'walisantri':
            queryset = queryset.filter(nisn=user.linked_student_nisn)

        # Apply ordering
        if order_by == 'hafalan':
            queryset = queryset.order_by('-current_hafalan', '-avg_grade')
        elif order_by == 'nama':
            queryset = queryset.order_by('nama')
        elif order_by == 'kelas':
            queryset = queryset.order_by('kelas', '-avg_grade')
        else:  # default: avg_grade
            queryset = queryset.order_by('-avg_grade', '-current_hafalan')

        # Apply limit
        queryset = queryset[:limit]

        students_data = []

        for student in queryset:
            avg_grade = round(student.avg_grade, 2) if student.avg_grade else 0

            target_hafalan = student.target_hafalan or 0
            current_hafalan = student.current_hafalan or 0
            hafalan_percentage = 0
            if target_hafalan > 0:
                hafalan_percentage = round((current_hafalan / target_hafalan) * 100, 2)

            target_nilai = student.target_nilai or 75
            grade_percentage = 0
            if target_nilai > 0:
                grade_percentage = round((avg_grade / target_nilai) * 100, 2)

            hafalan_status = 'above' if hafalan_percentage >= target_hafalan else 'below'
            grade_status = 'above' if avg_grade >= target_nilai else 'below'

            students_data.append({
                'nisn': student.nisn,
                'nama': student.nama,
                'kelas': student.kelas,
                'target_hafalan': target_hafalan,
                'current_hafalan': current_hafalan,
                'hafalan_percentage': hafalan_percentage,
                'hafalan_status': hafalan_status,
                'target_nilai': target_nilai,
                'average_grade': avg_grade,
                'grade_percentage': grade_percentage,
                'grade_status': grade_status
            })

        return Response({
            'success': True,
            'data': students_data
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activity_data(request):
    user = request.user

    try:
        # Use select_related to prevent N+1 queries on ForeignKey access
        recent_evaluations = Evaluation.objects.select_related('nisn').order_by('-created_at')[:5]
        recent_grades = Grade.objects.select_related('nisn').order_by('-created_at')[:5]

        activities = []

        for eval in recent_evaluations:
            activities.append({
                'type': 'evaluation',
                'title': eval.name,
                'student': eval.nisn.nama if eval.nisn else 'Unknown',
                'nisn': eval.nisn.nisn if eval.nisn else '',
                'jenis': eval.jenis,
                'date': eval.created_at.strftime('%d %b %Y %H:%M'),
                'icon': '🏆' if eval.jenis == 'prestasi' else '⚠️'
            })

        for grade in recent_grades:
            activities.append({
                'type': 'grade',
                'title': f'{grade.mata_pelajaran} - {grade.jenis}',
                'student': grade.nisn.nama if grade.nisn else 'Unknown',
                'nisn': grade.nisn.nisn if grade.nisn else '',
                'nilai': grade.nilai,
                'date': grade.created_at.strftime('%d %b %Y %H:%M'),
                'icon': '📝'
            })

        activities.sort(key=lambda x: x['date'], reverse=True)
        activities = activities[:10]

        return Response({
            'success': True,
            'data': activities
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


# ============================================
# PARENT DASHBOARD SUMMARY (Wali Santri)
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parent_dashboard_summary(request):
    """
    Comprehensive dashboard summary for Wali Santri.

    Returns:
    - children: List of linked children with basic info
    - tunggakan: Financial summary
    - blp_latest: Latest BLP score for each child
    - attendance_summary: Attendance percentages
    """
    user = request.user

    if user.role != 'walisantri':
        return Response({
            'success': False,
            'message': 'Endpoint ini hanya untuk Wali Santri'
        }, status=403)

    try:
        nisn_list = user.get_linked_students()

        if not nisn_list:
            return Response({
                'success': True,
                'children': [],
                'message': 'Belum ada anak yang terhubung'
            })

        children_data = []

        for nisn in nisn_list:
            try:
                student = Student.objects.get(nisn=nisn)

                # Get BLP latest
                from apps.kesantrian.models import BLPEntry
                blp_latest = BLPEntry.objects.filter(siswa=student).order_by('-week_start').first()

                # Get attendance stats
                today = timezone.now().date()
                start_date = today - timedelta(days=30)
                attendance_count = Attendance.objects.filter(
                    nisn=student,
                    tanggal__gte=start_date,
                    status='Hadir'
                ).count()
                total_days = Attendance.objects.filter(
                    nisn=student,
                    tanggal__gte=start_date
                ).count()
                attendance_pct = round((attendance_count / total_days * 100), 1) if total_days > 0 else 0

                # Get average grade
                avg_grade = Grade.objects.filter(nisn=student).aggregate(Avg('nilai'))['nilai__avg'] or 0

                children_data.append({
                    'nisn': student.nisn,
                    'nama': student.nama,
                    'kelas': student.kelas,
                    'blp_score': blp_latest.total_score if blp_latest else 0,
                    'blp_predikat': blp_latest.predikat if blp_latest else 'Belum Ada',
                    'attendance_pct': attendance_pct,
                    'avg_grade': round(avg_grade, 1),
                    'hafalan_current': float(student.current_hafalan or 0),
                    'hafalan_target': float(student.target_hafalan or 0),
                })

            except Student.DoesNotExist:
                continue

        return Response({
            'success': True,
            'total_children': len(children_data),
            'children': children_data
        })

    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


# ============================================
# USTADZ DASHBOARD SUMMARY
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ustadz_dashboard_summary(request):
    """
    Comprehensive dashboard summary for Ustadz/Ustadzah.

    Returns:
    - assignments: List of active assignments
    - evaluation_summary: Personal evaluation stats
    - schedule_today: Today's schedule
    - class_summary: Class stats (if wali kelas)
    """
    user = request.user

    allowed_roles = ['guru', 'musyrif', 'superadmin', 'pimpinan']
    if user.role not in allowed_roles:
        return Response({
            'success': False,
            'message': 'Endpoint ini untuk Ustadz/Ustadzah'
        }, status=403)

    try:
        # Get assignments
        from apps.accounts.models import Assignment
        assignments = Assignment.objects.filter(
            user=user,
            status='active'
        ).values(
            'id', 'assignment_type', 'kelas', 'mata_pelajaran',
            'halaqoh_id', 'hari', 'tahun_ajaran', 'semester'
        )

        # Get evaluation summary
        from apps.kesantrian.models import EmployeeEvaluation
        from django.db.models import Sum

        eval_stats = EmployeeEvaluation.objects.filter(user=user).aggregate(
            total_poin=Sum('poin'),
            count=Count('id')
        )

        eval_by_type = EmployeeEvaluation.objects.filter(user=user).values('jenis').annotate(
            count=Count('id'),
            total=Sum('poin')
        )

        eval_summary = {
            'total_poin': eval_stats['total_poin'] or 0,
            'total_records': eval_stats['count'] or 0,
            'by_type': {item['jenis']: {'count': item['count'], 'total': item['total']} for item in eval_by_type}
        }

        # Check wali kelas
        wali_kelas_assignment = next(
            (a for a in assignments if a['assignment_type'] == 'wali_kelas'),
            None
        )

        class_summary = None
        if wali_kelas_assignment and wali_kelas_assignment['kelas']:
            kelas = wali_kelas_assignment['kelas']
            students = Student.objects.filter(kelas=kelas, aktif=True)

            today = timezone.now().date()
            hadir_today = Attendance.objects.filter(
                nisn__in=students,
                tanggal=today,
                status='Hadir'
            ).count()

            avg_grade = Grade.objects.filter(nisn__in=students).aggregate(Avg('nilai'))['nilai__avg'] or 0

            class_summary = {
                'kelas': kelas,
                'total_students': students.count(),
                'hadir_today': hadir_today,
                'avg_grade': round(avg_grade, 1)
            }

        # Check piket
        is_piket = any(a['assignment_type'] == 'piket' for a in assignments)

        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'name': user.name,
                'role': user.role
            },
            'assignments': list(assignments),
            'evaluation_summary': eval_summary,
            'class_summary': class_summary,
            'is_piket': is_piket
        })

    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)


# ============================================
# GURU TODAY DASHBOARD
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def guru_today_dashboard(request):
    """
    Dashboard khusus guru untuk hari ini.

    Returns:
    - jadwal_hari_ini: List jadwal mengajar hari ini dengan status absen
    - warning_belum_absen: Jadwal yang belum dilakukan absensi
    - statistik: Persentase kehadiran mengajar
    - e_report: Statistik nilai dan evaluasi
    """
    user = request.user

    # Validate role
    allowed_roles = ['guru', 'superadmin', 'pimpinan']
    if user.role not in allowed_roles:
        return Response({
            'success': False,
            'message': 'Endpoint ini hanya untuk Guru/Ustadz'
        }, status=403)

    try:
        from apps.students.models import Schedule

        # Get hari ini dalam Bahasa Indonesia
        hari_map = {
            0: 'Senin',
            1: 'Selasa',
            2: 'Rabu',
            3: 'Kamis',
            4: 'Jumat',
            5: 'Sabtu',
            6: 'Minggu'
        }
        today = timezone.now().date()
        hari_ini = hari_map.get(today.weekday(), 'Senin')

        # Get jadwal hari ini untuk user
        schedules = Schedule.objects.filter(
            username=user.username,
            hari=hari_ini,
            is_active=True
        ).order_by('jam_ke', 'jam_mulai', 'jam')

        jadwal_list = []
        warning_list = []
        total_sudah_absen = 0

        for schedule in schedules:
            # Cek apakah sudah ada Attendance record hari ini
            # untuk kelas + mata pelajaran ini
            sudah_absen = Attendance.objects.filter(
                nisn__kelas=schedule.kelas,
                tanggal=today,
                mata_pelajaran=schedule.mata_pelajaran
            ).exists()

            if sudah_absen:
                total_sudah_absen += 1

            jadwal_item = {
                'id': schedule.id,
                'kelas': schedule.kelas,
                'mata_pelajaran': schedule.mata_pelajaran or '-',
                'jam_ke': schedule.jam_ke,
                'jam_mulai': schedule.jam_mulai.strftime('%H:%M') if schedule.jam_mulai else None,
                'jam_selesai': schedule.jam_selesai.strftime('%H:%M') if schedule.jam_selesai else None,
                'jam_legacy': schedule.jam,  # Legacy field
                'waktu_display': schedule.waktu_display,
                'sudah_absen': sudah_absen
            }

            jadwal_list.append(jadwal_item)

            # Tambahkan ke warning jika belum absen
            if not sudah_absen:
                warning_list.append(jadwal_item)

        # Hitung statistik
        total_jadwal = len(jadwal_list)
        persentase_kehadiran = 0
        if total_jadwal > 0:
            persentase_kehadiran = round((total_sudah_absen / total_jadwal) * 100, 1)

        # E-Report: Nilai pending dan evaluasi bulan ini
        nilai_pending = 0
        evaluasi_bulan_ini = 0
        bulan_ini_start = today.replace(day=1)

        # Cek nilai pending dari jurnal dengan flag ada_penilaian=True
        # tapi belum ada Grade record
        try:
            from apps.attendance.models import JurnalMengajar

            # Jurnal dengan penilaian yang belum diinput nilai
            jurnal_pending = JurnalMengajar.objects.filter(
                guru=user,
                ada_penilaian=True,
                tanggal__gte=bulan_ini_start
            )

            for jurnal in jurnal_pending:
                # Cek apakah sudah ada grade untuk kelas + mapel + tanggal ini
                has_grade = Grade.objects.filter(
                    nisn__kelas=jurnal.kelas,
                    mata_pelajaran=jurnal.mata_pelajaran,
                    created_at__date=jurnal.tanggal
                ).exists()
                if not has_grade:
                    nilai_pending += 1

        except Exception:
            pass  # JurnalMengajar mungkin belum ada

        # Evaluasi bulan ini
        evaluator_name = user.name if user.name else user.username
        try:
            evaluasi_bulan_ini = Evaluation.objects.filter(
                evaluator=evaluator_name,
                created_at__gte=bulan_ini_start
            ).count()
        except Exception:
            pass

        # Get tahun ajaran aktif
        try:
            from apps.core.models import TahunAjaran
            ta_aktif = TahunAjaran.objects.filter(is_active=True).first()
            tahun_ajaran_display = f"{ta_aktif.nama} - {ta_aktif.semester}" if ta_aktif else "Tahun Ajaran Aktif"
        except Exception:
            tahun_ajaran_display = "Tahun Ajaran"

        # Generate chart data: 6 bulan terakhir kehadiran mengajar guru ini
        chart_labels = []
        chart_values = []
        try:
            for i in range(5, -1, -1):
                bulan = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
                bulan_nama = bulan.strftime('%b')
                chart_labels.append(bulan_nama)

                # Hitung persentase kehadiran mengajar di bulan ini
                # Total jadwal di bulan ini
                total_schedules_bulan = Schedule.objects.filter(
                    username=user.username,
                    is_active=True
                ).count() * 4  # Approx 4 weeks per month

                # Total attendance records di bulan ini
                attended = Attendance.objects.filter(
                    tanggal__year=bulan.year,
                    tanggal__month=bulan.month
                ).filter(
                    nisn__kelas__in=Schedule.objects.filter(
                        username=user.username
                    ).values_list('kelas', flat=True)
                ).values('tanggal', 'nisn__kelas').distinct().count()

                if total_schedules_bulan > 0:
                    pct = min(round((attended / total_schedules_bulan) * 100, 0), 100)
                else:
                    pct = 0
                chart_values.append(pct)
        except Exception:
            # Fallback to empty data
            chart_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun']
            chart_values = [0, 0, 0, 0, 0, 0]

        # E-report materi dari jurnal mengajar hari ini
        e_report_materi = []
        try:
            from apps.attendance.models import JurnalMengajar
            jurnals_today = JurnalMengajar.objects.filter(
                guru=user,
                tanggal=today
            ).order_by('created_at')

            for jurnal in jurnals_today:
                e_report_materi.append({
                    'kelas': jurnal.kelas,
                    'mata_pelajaran': jurnal.mata_pelajaran,
                    'materi': jurnal.materi,
                    'capaian_pembelajaran': jurnal.capaian_pembelajaran
                })
        except Exception:
            pass

        return Response({
            'success': True,
            'hari': hari_ini,
            'tanggal': today.strftime('%Y-%m-%d'),
            'tanggal_display': today.strftime('%d %B %Y'),
            'tahun_ajaran': tahun_ajaran_display,
            'jadwal_hari_ini': jadwal_list,
            'warning_belum_absen': warning_list,
            'statistik': {
                'persentase_kehadiran': persentase_kehadiran,
                'total_jadwal_hari_ini': total_jadwal,
                'sudah_absen': total_sudah_absen,
                'belum_absen': total_jadwal - total_sudah_absen,
                'nilai_pending': nilai_pending,
                'evaluasi_bulan_ini': evaluasi_bulan_ini,
                'chart_data': {
                    'labels': chart_labels,
                    'values': chart_values
                }
            },
            'e_report': e_report_materi
        })

    except Exception as e:
        import traceback
        return Response({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }, status=500)