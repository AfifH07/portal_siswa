"""
Kesantrian Logic Engine
========================
Reusable utility functions for calculating student behavior metrics.
"""

from django.db.models import Count, Q, Avg
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import Ibadah, Pembinaan, HalaqohMember, TargetHafalan
from apps.students.models import Student
from apps.grades.models import Grade


def get_student_behavior_summary(nisn, days=30):
    """
    Calculate comprehensive behavior summary for a student.

    Returns:
    {
        "success": True,
        "nisn": "0012345634",
        "nama": "Ahmad Abdullah",
        "period_days": 30,
        "ibadah": {
            "sholat_wajib": {
                "total_expected": 150,  # 5 waktu × 30 hari
                "total_recorded": 140,
                "hadir": 130,
                "terlambat": 5,
                "tidak_hadir": 5,
                "persentase_kehadiran": 92.9
            },
            "by_waktu": {
                "subuh": {"hadir": 25, "terlambat": 2, "tidak_hadir": 3, "persentase": 83.3},
                ...
            }
        },
        "pembinaan": {
            "total_records": 10,
            "prestasi": 7,
            "pelanggaran": 2,
            "netral": 1,
            "skor_perilaku": 85.0,
            "by_kategori": {"akhlak": 3, "kedisiplinan": 2, ...}
        },
        "hafalan": {
            "target_juz": 3,
            "tercapai_juz": 1.5,
            "persentase": 50.0
        },
        "overall_score": 82.5
    }
    """
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return {
            "success": False,
            "message": "Siswa tidak ditemukan",
            "nisn": nisn
        }

    today = timezone.now().date()
    start_date = today - timedelta(days=days)

    # ========================
    # 1. IBADAH (SHOLAT) ANALYSIS
    # ========================
    waktu_sholat_wajib = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']

    # Get all ibadah records for sholat wajib
    ibadah_qs = Ibadah.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today,
        jenis='sholat_wajib'
    )

    # Overall stats
    total_recorded = ibadah_qs.count()
    total_hadir = ibadah_qs.filter(status='hadir').count()
    total_terlambat = ibadah_qs.filter(status='terlambat').count()
    total_tidak_hadir = ibadah_qs.filter(status='tidak_hadir').count()
    total_izin = ibadah_qs.filter(status='izin').count()
    total_sakit = ibadah_qs.filter(status='sakit').count()

    # Expected = 5 waktu × days
    total_expected = 5 * days

    # Calculate kehadiran percentage (hadir + terlambat count as present)
    present_count = total_hadir + total_terlambat
    persentase_kehadiran = round((present_count / total_expected * 100), 1) if total_expected > 0 else 0

    # By waktu breakdown
    by_waktu = {}
    for waktu in waktu_sholat_wajib:
        waktu_qs = ibadah_qs.filter(waktu=waktu)
        waktu_hadir = waktu_qs.filter(status='hadir').count()
        waktu_terlambat = waktu_qs.filter(status='terlambat').count()
        waktu_tidak = waktu_qs.filter(status='tidak_hadir').count()
        waktu_total = waktu_hadir + waktu_terlambat + waktu_tidak

        by_waktu[waktu] = {
            "hadir": waktu_hadir,
            "terlambat": waktu_terlambat,
            "tidak_hadir": waktu_tidak,
            "total": waktu_total,
            "persentase": round(((waktu_hadir + waktu_terlambat) / days * 100), 1) if days > 0 else 0
        }

    ibadah_summary = {
        "total_expected": total_expected,
        "total_recorded": total_recorded,
        "hadir": total_hadir,
        "terlambat": total_terlambat,
        "tidak_hadir": total_tidak_hadir,
        "izin": total_izin,
        "sakit": total_sakit,
        "persentase_kehadiran": persentase_kehadiran,
        "by_waktu": by_waktu
    }

    # ========================
    # 2. PEMBINAAN ANALYSIS
    # ========================
    pembinaan_qs = Pembinaan.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today
    )

    total_pembinaan = pembinaan_qs.count()

    # Categorize by tingkat
    # Prestasi: sangat_baik, baik
    # Netral: cukup
    # Pelanggaran/Perlu Perhatian: perlu_perhatian, perlu_pembinaan
    prestasi_count = pembinaan_qs.filter(tingkat__in=['sangat_baik', 'baik']).count()
    netral_count = pembinaan_qs.filter(tingkat='cukup').count()
    pelanggaran_count = pembinaan_qs.filter(tingkat__in=['perlu_perhatian', 'perlu_pembinaan']).count()

    # Calculate behavior score (0-100)
    # Formula: (prestasi * 10 - pelanggaran * 15) capped at 0-100, baseline 75
    if total_pembinaan > 0:
        skor_perilaku = 75 + (prestasi_count * 5) - (pelanggaran_count * 10)
        skor_perilaku = max(0, min(100, skor_perilaku))  # Cap between 0-100
    else:
        skor_perilaku = 75  # Default if no records

    # By kategori
    by_kategori = {}
    kategori_counts = pembinaan_qs.values('kategori').annotate(count=Count('id'))
    for k in kategori_counts:
        by_kategori[k['kategori']] = k['count']

    pembinaan_summary = {
        "total_records": total_pembinaan,
        "prestasi": prestasi_count,
        "pelanggaran": pelanggaran_count,
        "netral": netral_count,
        "skor_perilaku": round(skor_perilaku, 1),
        "by_kategori": by_kategori
    }

    # ========================
    # 3. HAFALAN PROGRESS
    # ========================
    # Get current semester target
    current_month = today.month
    current_semester = 'Ganjil' if current_month >= 7 or current_month <= 12 else 'Genap'
    current_year = f"{today.year}/{today.year + 1}" if current_month >= 7 else f"{today.year - 1}/{today.year}"

    hafalan = TargetHafalan.objects.filter(
        siswa=student,
        semester=current_semester,
        tahun_ajaran=current_year
    ).first()

    if hafalan:
        hafalan_summary = {
            "target_juz": float(hafalan.target_juz),
            "tercapai_juz": float(hafalan.tercapai_juz),
            "persentase": hafalan.persentase_tercapai
        }
    else:
        # Fallback to student fields
        target = float(student.target_hafalan) if student.target_hafalan else 0
        tercapai = float(student.current_hafalan) if student.current_hafalan else 0
        hafalan_summary = {
            "target_juz": target,
            "tercapai_juz": tercapai,
            "persentase": round((tercapai / target * 100), 1) if target > 0 else 0
        }

    # ========================
    # 4. OVERALL SCORE
    # ========================
    # Weighted average: Ibadah 40%, Perilaku 30%, Hafalan 30%
    ibadah_score = persentase_kehadiran
    perilaku_score = skor_perilaku
    hafalan_score = hafalan_summary['persentase']

    overall_score = round(
        (ibadah_score * 0.4) + (perilaku_score * 0.3) + (hafalan_score * 0.3),
        1
    )

    return {
        "success": True,
        "nisn": nisn,
        "nama": student.nama,
        "kelas": student.kelas or "",
        "period_days": days,
        "period_start": start_date.isoformat(),
        "period_end": today.isoformat(),
        "ibadah": ibadah_summary,
        "pembinaan": pembinaan_summary,
        "hafalan": hafalan_summary,
        "overall_score": overall_score,
        "grade": _get_grade_letter(overall_score)
    }


def _get_grade_letter(score):
    """Convert numeric score to letter grade."""
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "E"


def clean_null_values(data, default_string="", default_number=0, default_list=None):
    """
    Recursively clean null/None values from a dictionary.
    Ensures API responses have no null values.
    """
    if default_list is None:
        default_list = []

    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            cleaned[key] = clean_null_values(value, default_string, default_number, default_list)
        return cleaned
    elif isinstance(data, list):
        return [clean_null_values(item, default_string, default_number, default_list) for item in data]
    elif data is None:
        # Determine default based on key context (if available) or return string
        return default_string
    elif isinstance(data, (int, float, Decimal)):
        return data
    else:
        return data


def safe_response(data):
    """
    Wrapper to ensure API responses have no null values.
    Replaces None with appropriate defaults.
    """
    if not isinstance(data, dict):
        return data

    def process_value(value, key=""):
        if value is None:
            # Determine default based on key name patterns
            if any(x in key.lower() for x in ['count', 'total', 'jumlah', 'nilai', 'score', 'percentage', 'persentase']):
                return 0
            elif any(x in key.lower() for x in ['list', 'records', 'data', 'grades', 'items']):
                return []
            elif any(x in key.lower() for x in ['detail', 'summary', 'info', 'stats']):
                return {}
            else:
                return ""
        elif isinstance(value, dict):
            return {k: process_value(v, k) for k, v in value.items()}
        elif isinstance(value, list):
            return [process_value(item) for item in value]
        else:
            return value

    return {k: process_value(v, k) for k, v in data.items()}


def calculate_student_metrics(nisn, days=30):
    """
    Calculate comprehensive student metrics with weighted scoring.

    Weights:
    - Ibadah (40%): Sholat Wajib & Sunnah attendance (30 days)
    - Akademik (30%): Average grades from apps.grades
    - Hafalan (20%): Progress (tercapai_juz / target_juz)
    - Perilaku (10%): Pembinaan points (prestasi vs pelanggaran)

    Predikat:
    - Mumtaz (>85)
    - Jayyid Jiddan (70-85)
    - Jayyid (60-70)
    - Perlu Pembinaan (<60)

    Returns:
    {
        "success": True,
        "nisn": "0012345634",
        "nama": "Ahmad Abdullah",
        "kelas": "XI A",
        "period_days": 30,
        "components": {
            "ibadah": {"score": 85.0, "weight": 0.4, "weighted": 34.0, ...},
            "akademik": {"score": 78.5, "weight": 0.3, "weighted": 23.55, ...},
            "hafalan": {"score": 60.0, "weight": 0.2, "weighted": 12.0, ...},
            "perilaku": {"score": 90.0, "weight": 0.1, "weighted": 9.0, ...}
        },
        "total_score": 78.55,
        "predikat": "Jayyid Jiddan",
        "predikat_code": "JJ"
    }
    """
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return {
            "success": False,
            "message": "Siswa tidak ditemukan",
            "nisn": nisn
        }

    today = timezone.now().date()
    start_date = today - timedelta(days=days)

    # ================================================================
    # 1. IBADAH SCORE (40%)
    # ================================================================
    # Include both sholat_wajib and sholat_sunnah
    ibadah_qs = Ibadah.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today,
        jenis__in=['sholat_wajib', 'sholat_sunnah']
    )

    # Sholat Wajib (5 waktu per hari)
    wajib_qs = ibadah_qs.filter(jenis='sholat_wajib')
    wajib_total = wajib_qs.count()
    wajib_hadir = wajib_qs.filter(status__in=['hadir', 'terlambat']).count()
    wajib_expected = 5 * days

    # Sholat Sunnah (bonus, max 2 per day counted)
    sunnah_qs = ibadah_qs.filter(jenis='sholat_sunnah')
    sunnah_hadir = sunnah_qs.filter(status='hadir').count()
    sunnah_expected = 2 * days  # Dhuha + Tahajud as baseline

    # Combined ibadah score
    # Wajib contributes 80% of ibadah score, Sunnah contributes 20%
    wajib_percentage = (wajib_hadir / wajib_expected * 100) if wajib_expected > 0 else 0
    sunnah_percentage = min((sunnah_hadir / sunnah_expected * 100), 100) if sunnah_expected > 0 else 0

    ibadah_score = (wajib_percentage * 0.8) + (sunnah_percentage * 0.2)
    ibadah_score = min(100, round(ibadah_score, 1))

    ibadah_data = {
        "score": ibadah_score,
        "weight": 0.4,
        "weighted": round(ibadah_score * 0.4, 2),
        "detail": {
            "sholat_wajib": {
                "hadir": wajib_hadir,
                "expected": wajib_expected,
                "percentage": round(wajib_percentage, 1)
            },
            "sholat_sunnah": {
                "hadir": sunnah_hadir,
                "expected": sunnah_expected,
                "percentage": round(sunnah_percentage, 1)
            }
        }
    }

    # ================================================================
    # 2. AKADEMIK SCORE (30%)
    # ================================================================
    # Get average of all grades for this student
    grades_avg = Grade.objects.filter(nisn=student).aggregate(
        rata_rata=Avg('nilai')
    )

    akademik_score = float(grades_avg['rata_rata']) if grades_avg['rata_rata'] else 0
    akademik_score = min(100, round(akademik_score, 1))

    # Get subject breakdown
    subjects_data = Grade.objects.filter(nisn=student).values(
        'mata_pelajaran'
    ).annotate(
        nilai=Avg('nilai')
    ).order_by('-nilai')[:5]  # Top 5 subjects

    top_subjects = [
        {"mata_pelajaran": s['mata_pelajaran'], "nilai": round(s['nilai'], 1)}
        for s in subjects_data
    ]

    akademik_data = {
        "score": akademik_score,
        "weight": 0.3,
        "weighted": round(akademik_score * 0.3, 2),
        "detail": {
            "total_grades": Grade.objects.filter(nisn=student).count(),
            "rata_rata": akademik_score,
            "top_subjects": top_subjects
        }
    }

    # ================================================================
    # 3. HAFALAN SCORE (20%)
    # ================================================================
    # Get current semester target
    current_month = today.month
    current_semester = 'Ganjil' if current_month >= 7 else 'Genap'
    current_year = f"{today.year}/{today.year + 1}" if current_month >= 7 else f"{today.year - 1}/{today.year}"

    hafalan = TargetHafalan.objects.filter(
        siswa=student,
        semester=current_semester,
        tahun_ajaran=current_year
    ).first()

    if hafalan:
        target_juz = float(hafalan.target_juz)
        tercapai_juz = float(hafalan.tercapai_juz)
    else:
        # Fallback to student fields
        target_juz = float(student.target_hafalan) if student.target_hafalan else 0
        tercapai_juz = float(student.current_hafalan) if student.current_hafalan else 0

    # Calculate progress percentage
    hafalan_score = round((tercapai_juz / target_juz * 100), 1) if target_juz > 0 else 0
    hafalan_score = min(100, hafalan_score)

    # Calculate gap (selisih)
    selisih_juz = round(target_juz - tercapai_juz, 2)

    hafalan_data = {
        "score": hafalan_score,
        "weight": 0.2,
        "weighted": round(hafalan_score * 0.2, 2),
        "detail": {
            "target_juz": target_juz,
            "tercapai_juz": tercapai_juz,
            "selisih_juz": selisih_juz,
            "percentage": hafalan_score
        }
    }

    # ================================================================
    # 4. PERILAKU SCORE (10%)
    # ================================================================
    pembinaan_qs = Pembinaan.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today
    )

    total_pembinaan = pembinaan_qs.count()

    # Count by tingkat
    # Prestasi (positive): sangat_baik (+10), baik (+5)
    # Netral: cukup (0)
    # Pelanggaran (negative): perlu_perhatian (-5), perlu_pembinaan (-10)
    sangat_baik = pembinaan_qs.filter(tingkat='sangat_baik').count()
    baik = pembinaan_qs.filter(tingkat='baik').count()
    cukup = pembinaan_qs.filter(tingkat='cukup').count()
    perlu_perhatian = pembinaan_qs.filter(tingkat='perlu_perhatian').count()
    perlu_pembinaan = pembinaan_qs.filter(tingkat='perlu_pembinaan').count()

    # Calculate behavior score with point system
    # Baseline: 75, max: 100, min: 0
    poin_prestasi = (sangat_baik * 10) + (baik * 5)
    poin_pelanggaran = (perlu_perhatian * 5) + (perlu_pembinaan * 10)

    perilaku_score = 75 + poin_prestasi - poin_pelanggaran
    perilaku_score = max(0, min(100, perilaku_score))

    perilaku_data = {
        "score": perilaku_score,
        "weight": 0.1,
        "weighted": round(perilaku_score * 0.1, 2),
        "detail": {
            "total_records": total_pembinaan,
            "prestasi": {
                "sangat_baik": sangat_baik,
                "baik": baik,
                "poin": poin_prestasi
            },
            "pelanggaran": {
                "perlu_perhatian": perlu_perhatian,
                "perlu_pembinaan": perlu_pembinaan,
                "poin": poin_pelanggaran
            },
            "netral": cukup
        }
    }

    # ================================================================
    # 5. TOTAL WEIGHTED SCORE
    # ================================================================
    total_score = round(
        ibadah_data['weighted'] +
        akademik_data['weighted'] +
        hafalan_data['weighted'] +
        perilaku_data['weighted'],
        2
    )

    # Determine predikat
    predikat, predikat_code = _get_predikat(total_score)

    return {
        "success": True,
        "nisn": nisn,
        "nama": student.nama,
        "kelas": student.kelas or "",
        "period_days": days,
        "period_start": start_date.isoformat(),
        "period_end": today.isoformat(),
        "components": {
            "ibadah": ibadah_data,
            "akademik": akademik_data,
            "hafalan": hafalan_data,
            "perilaku": perilaku_data
        },
        "total_score": total_score,
        "predikat": predikat,
        "predikat_code": predikat_code
    }


def _get_predikat(score):
    """
    Convert numeric score to predikat (Islamic grading system).

    Returns:
        tuple: (predikat_name, predikat_code)
    """
    if score > 85:
        return ("Mumtaz", "M")
    elif score >= 70:
        return ("Jayyid Jiddan", "JJ")
    elif score >= 60:
        return ("Jayyid", "J")
    else:
        return ("Perlu Pembinaan", "PP")


def aggregate_student_rapor_data(nisn, semester='Ganjil', tahun_ajaran='2025/2026', days=30):
    """
    Unified Data Aggregator for Rapor v1.1.

    Optimized for minimal database queries (5-7 queries max).
    Uses select_related and prefetch_related where applicable.

    Collects:
    1. Student Profile (1 query)
    2. All Grades - Academic & Diniyah (1 query with aggregation)
    3. School Attendance (1 query with aggregation)
    4. Ibadah/Sholat Records (1 query with aggregation)
    5. Pembinaan Records (1 query)
    6. Hafalan Target (1 query)
    7. Halaqoh Membership (1 query with select_related)

    Returns:
    {
        "success": True,
        "meta": {"generated_at": ..., "semester": ..., "tahun_ajaran": ...},
        "student": {...},
        "academic": {"grades": [...], "average": ...},
        "diniyah": {"grades": [...], "average": ...},
        "hafalan": {...},
        "attendance": {"sekolah": {...}, "ibadah": {...}},
        "pembinaan": {...},
        "halaqoh": [...],
        "metrics": {"total_score": ..., "predikat": ...}
    }
    """
    from apps.attendance.models import Attendance

    # ================================================================
    # QUERY 1: Student Profile
    # ================================================================
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        return {
            "success": False,
            "message": "Siswa tidak ditemukan",
            "nisn": nisn
        }

    today = timezone.now().date()
    start_date = today - timedelta(days=days)

    # Subject categories
    ACADEMIC_SUBJECTS = [
        'Bahasa Indonesia', 'Matematika', 'Bahasa Inggris', 'IPA', 'IPS',
        'PKN', 'Seni Budaya', 'PJOK', 'Prakarya', 'Informatika'
    ]
    DINIYAH_SUBJECTS = [
        'Aqidah', 'Akhlak', 'Fiqih', 'Al-Quran Hadist', 'SKI',
        'Bahasa Arab', 'Tahfidz', 'Tajwid'
    ]

    # ================================================================
    # QUERY 2: All Grades (single aggregated query)
    # ================================================================
    grade_aggregates = Grade.objects.filter(nisn=student).values(
        'mata_pelajaran'
    ).annotate(
        rata_rata=Avg('nilai'),
        total_nilai=Count('id')
    ).order_by('mata_pelajaran')

    academic_grades = []
    diniyah_grades = []
    academic_sum = 0
    diniyah_sum = 0

    for g in grade_aggregates:
        subj = g['mata_pelajaran']
        nilai = round(g['rata_rata'], 1) if g['rata_rata'] else 0
        entry = {
            'mata_pelajaran': subj,
            'nilai': nilai,
            'total_data': g['total_nilai']
        }

        if subj in DINIYAH_SUBJECTS:
            diniyah_grades.append(entry)
            diniyah_sum += nilai
        else:
            academic_grades.append(entry)
            academic_sum += nilai

    academic_avg = round(academic_sum / len(academic_grades), 1) if academic_grades else 0
    diniyah_avg = round(diniyah_sum / len(diniyah_grades), 1) if diniyah_grades else 0

    # ================================================================
    # QUERY 3: School Attendance (single aggregated query)
    # ================================================================
    attendance_agg = Attendance.objects.filter(
        nisn=student,
        tanggal__gte=start_date,
        tanggal__lte=today
    ).values('status').annotate(count=Count('id'))

    attendance_counts = {'H': 0, 'S': 0, 'I': 0, 'A': 0}
    for a in attendance_agg:
        if a['status'] in attendance_counts:
            attendance_counts[a['status']] = a['count']

    total_attendance = sum(attendance_counts.values())
    attendance_percentage = round(
        (attendance_counts['H'] / total_attendance * 100), 1
    ) if total_attendance > 0 else 0

    sekolah_attendance = {
        'total_hari': total_attendance,
        'hadir': attendance_counts['H'],
        'sakit': attendance_counts['S'],
        'izin': attendance_counts['I'],
        'alpha': attendance_counts['A'],
        'persentase': attendance_percentage
    }

    # ================================================================
    # QUERY 4: Ibadah/Sholat Records (single aggregated query)
    # ================================================================
    ibadah_agg = Ibadah.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today,
        jenis='sholat_wajib'
    ).values('waktu', 'status').annotate(count=Count('id'))

    # Initialize waktu structure
    WAKTU_SHOLAT = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']
    ibadah_by_waktu = {w: {'hadir': 0, 'terlambat': 0, 'tidak_hadir': 0, 'izin': 0, 'sakit': 0} for w in WAKTU_SHOLAT}

    for rec in ibadah_agg:
        waktu = rec['waktu']
        stat = rec['status']
        if waktu in ibadah_by_waktu and stat in ibadah_by_waktu[waktu]:
            ibadah_by_waktu[waktu][stat] = rec['count']

    # Calculate totals and percentages
    ibadah_detail = {}
    total_ibadah_hadir = 0
    total_ibadah_expected = days * 5  # 5 sholat × days

    for waktu in WAKTU_SHOLAT:
        data = ibadah_by_waktu[waktu]
        present = data['hadir'] + data['terlambat']
        total_ibadah_hadir += present
        ibadah_detail[waktu] = {
            'hadir': data['hadir'],
            'terlambat': data['terlambat'],
            'tidak_hadir': data['tidak_hadir'],
            'izin': data['izin'],
            'sakit': data['sakit'],
            'total': sum(data.values()),
            'persentase': round((present / days * 100), 1) if days > 0 else 0
        }

    ibadah_overall = round(
        (total_ibadah_hadir / total_ibadah_expected * 100), 1
    ) if total_ibadah_expected > 0 else 0

    ibadah_attendance = {
        'total_expected': total_ibadah_expected,
        'total_hadir': total_ibadah_hadir,
        'overall_percentage': ibadah_overall,
        'detail': ibadah_detail
    }

    # ================================================================
    # QUERY 5: Pembinaan Records (single query)
    # ================================================================
    pembinaan_qs = Pembinaan.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today
    ).order_by('-tanggal')[:10]

    # Count by tingkat using values
    pembinaan_counts = Pembinaan.objects.filter(
        siswa=student,
        tanggal__gte=start_date,
        tanggal__lte=today
    ).values('tingkat').annotate(count=Count('id'))

    tingkat_map = {t['tingkat']: t['count'] for t in pembinaan_counts}

    prestasi_count = tingkat_map.get('sangat_baik', 0) + tingkat_map.get('baik', 0)
    pelanggaran_count = tingkat_map.get('perlu_perhatian', 0) + tingkat_map.get('perlu_pembinaan', 0)
    netral_count = tingkat_map.get('cukup', 0)

    # Build recent list
    pembinaan_recent = []
    for p in pembinaan_qs:
        pembinaan_recent.append({
            'id': p.id,
            'tanggal': p.tanggal.isoformat(),
            'kategori': p.get_kategori_display(),
            'kategori_code': p.kategori,
            'judul': p.judul,
            'deskripsi': p.deskripsi[:100] + '...' if len(p.deskripsi) > 100 else p.deskripsi,
            'tingkat': p.get_tingkat_display(),
            'tingkat_code': p.tingkat,
            'pembina': p.pembina
        })

    pembinaan_data = {
        'total': sum(tingkat_map.values()),
        'prestasi': prestasi_count,
        'pelanggaran': pelanggaran_count,
        'netral': netral_count,
        'skor_perilaku': max(0, min(100, 75 + (prestasi_count * 5) - (pelanggaran_count * 10))),
        'recent': pembinaan_recent
    }

    # ================================================================
    # QUERY 6: Hafalan Target (single query)
    # ================================================================
    hafalan = TargetHafalan.objects.filter(
        siswa=student,
        semester=semester,
        tahun_ajaran=tahun_ajaran
    ).first()

    if hafalan:
        target_juz = float(hafalan.target_juz)
        tercapai_juz = float(hafalan.tercapai_juz)
        catatan_hafalan = hafalan.catatan or ""
    else:
        target_juz = float(student.target_hafalan) if student.target_hafalan else 0
        tercapai_juz = float(student.current_hafalan) if student.current_hafalan else 0
        catatan_hafalan = ""

    hafalan_percentage = round((tercapai_juz / target_juz * 100), 1) if target_juz > 0 else 0

    hafalan_data = {
        'target_juz': target_juz,
        'tercapai_juz': tercapai_juz,
        'selisih_juz': round(target_juz - tercapai_juz, 2),
        'persentase': hafalan_percentage,
        'catatan': catatan_hafalan
    }

    # ================================================================
    # QUERY 7: Halaqoh Membership (with select_related)
    # ================================================================
    halaqoh_memberships = HalaqohMember.objects.filter(
        siswa=student,
        aktif=True
    ).select_related('halaqoh')

    halaqoh_list = []
    for hm in halaqoh_memberships:
        halaqoh_list.append({
            'id': hm.halaqoh.id,
            'nama': hm.halaqoh.nama,
            'jenis': hm.halaqoh.get_jenis_display(),
            'jenis_code': hm.halaqoh.jenis,
            'musyrif': hm.halaqoh.musyrif,
            'jadwal': hm.halaqoh.jadwal or "",
            'lokasi': hm.halaqoh.lokasi or "",
            'tanggal_gabung': hm.tanggal_gabung.isoformat()
        })

    # ================================================================
    # CALCULATE METRICS (weighted scoring)
    # ================================================================
    # Using v2 weights: Ibadah 40%, Akademik 30%, Hafalan 20%, Perilaku 10%
    ibadah_score = ibadah_overall
    akademik_score = academic_avg
    hafalan_score = hafalan_percentage
    perilaku_score = pembinaan_data['skor_perilaku']

    total_score = round(
        (ibadah_score * 0.4) +
        (akademik_score * 0.3) +
        (hafalan_score * 0.2) +
        (perilaku_score * 0.1),
        2
    )

    predikat, predikat_code = _get_predikat(total_score)

    metrics = {
        'components': {
            'ibadah': {'score': ibadah_score, 'weight': 0.4, 'weighted': round(ibadah_score * 0.4, 2)},
            'akademik': {'score': akademik_score, 'weight': 0.3, 'weighted': round(akademik_score * 0.3, 2)},
            'hafalan': {'score': hafalan_score, 'weight': 0.2, 'weighted': round(hafalan_score * 0.2, 2)},
            'perilaku': {'score': perilaku_score, 'weight': 0.1, 'weighted': round(perilaku_score * 0.1, 2)}
        },
        'total_score': total_score,
        'predikat': predikat,
        'predikat_code': predikat_code,
        'grade_letter': _get_grade_letter(total_score)
    }

    # ================================================================
    # BUILD FINAL RESPONSE
    # ================================================================
    return {
        "success": True,
        "meta": {
            "generated_at": timezone.now().isoformat(),
            "semester": semester,
            "tahun_ajaran": tahun_ajaran,
            "period_days": days,
            "period_start": start_date.isoformat(),
            "period_end": today.isoformat(),
            "query_count": 7
        },
        "student": {
            "nisn": student.nisn,
            "nama": student.nama,
            "kelas": student.kelas or "",
            "program": getattr(student, 'program', None) or "",
            "tempat_lahir": getattr(student, 'tempat_lahir', None) or "",
            "tanggal_lahir": student.tanggal_lahir.isoformat() if hasattr(student, 'tanggal_lahir') and student.tanggal_lahir else "",
            "jenis_kelamin": getattr(student, 'jenis_kelamin', None) or "",
            "alamat": getattr(student, 'alamat', None) or "",
            "nama_wali": getattr(student, 'nama_wali', None) or "",
            "telepon_wali": getattr(student, 'telepon_wali', None) or ""
        },
        "academic": {
            "grades": academic_grades,
            "count": len(academic_grades),
            "average": academic_avg
        },
        "diniyah": {
            "grades": diniyah_grades,
            "count": len(diniyah_grades),
            "average": diniyah_avg
        },
        "hafalan": hafalan_data,
        "attendance": {
            "sekolah": sekolah_attendance,
            "ibadah": ibadah_attendance
        },
        "pembinaan": pembinaan_data,
        "halaqoh": halaqoh_list,
        "metrics": metrics
    }
