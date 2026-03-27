"""
Grade Data Injection Script
============================
Injects dummy grade data for NISN 20260001.

Run with: python manage.py shell < inject_grades.py
"""

from apps.grades.models import Grade
from apps.students.models import Student
from django.db import transaction
import random

print("=" * 60)
print("GRADE DATA INJECTION FOR NISN 20260001")
print("=" * 60)

NISN = "20260001"

with transaction.atomic():
    # 1. Pastikan Siswa Ada
    student, created = Student.objects.get_or_create(
        nisn=NISN,
        defaults={
            "nama": "Ahmad Rizki Pratama",
            "kelas": "X A",
            "program": "Reguler",
            "aktif": True,
            "target_hafalan": 5,
            "current_hafalan": 2
        }
    )
    print(f"\n[1] Student: {student.nama} ({'CREATED' if created else 'EXISTS'})")

    # 2. Hapus data lama untuk kebersihan
    old_count = Grade.objects.filter(nisn_id=NISN).count()
    Grade.objects.filter(nisn_id=NISN).delete()
    print(f"[2] Deleted {old_count} old grade records")

    # 3. Data Nilai yang akan diinjeksi
    mapel_list = [
        "Aqidah",
        "Bahasa Arab",
        "Bahasa Indonesia",
        "Fiqih",
        "Matematika",
        "Tahfidz"
    ]

    # Note: jenis harus sesuai dengan JENIS_CHOICES di model: UH, UTS, UAS, Tugas, Proyek
    jenis_nilai = ["UH", "UTS", "UAS"]

    # Base scores per subject (will add some variance)
    base_scores = {
        "Aqidah": 88,
        "Bahasa Arab": 82,
        "Bahasa Indonesia": 78,
        "Fiqih": 85,
        "Matematika": 72,
        "Tahfidz": 90
    }

    grades_to_create = []

    for mapel in mapel_list:
        base = base_scores.get(mapel, 80)
        for jenis in jenis_nilai:
            # Add variance: -5 to +5
            nilai = base + random.randint(-5, 8)
            nilai = max(0, min(100, nilai))  # Clamp to 0-100

            grades_to_create.append(
                Grade(
                    nisn_id=NISN,
                    mata_pelajaran=mapel,
                    nilai=nilai,
                    jenis=jenis,
                    semester="Ganjil",
                    tahun_ajaran="2025/2026",
                    kelas="X A",
                    guru=f"Ustadz {mapel.split()[0]}"
                )
            )

    # 4. Bulk create for efficiency
    Grade.objects.bulk_create(grades_to_create)
    print(f"[3] Created {len(grades_to_create)} grade records")

    # 5. Verification
    print("\n" + "-" * 60)
    print("VERIFICATION - Grade Aggregation Preview:")
    print("-" * 60)

    from django.db.models import Avg, Max, Min, Count

    stats = Grade.objects.filter(nisn_id=NISN).values('mata_pelajaran').annotate(
        rata_rata=Avg('nilai'),
        nilai_tertinggi=Max('nilai'),
        nilai_terendah=Min('nilai'),
        jumlah_nilai=Count('id')
    ).order_by('mata_pelajaran')

    print(f"\n{'Mata Pelajaran':<20} {'Avg':>8} {'Min':>6} {'Max':>6} {'Count':>6}")
    print("-" * 50)

    for s in stats:
        print(f"{s['mata_pelajaran']:<20} {s['rata_rata']:>8.1f} {s['nilai_terendah']:>6} {s['nilai_tertinggi']:>6} {s['jumlah_nilai']:>6}")

    # Total average
    total = Grade.objects.filter(nisn_id=NISN).aggregate(avg=Avg('nilai'))
    print("-" * 50)
    print(f"{'TOTAL RATA-RATA':<20} {total['avg']:>8.1f}")

    print("\n" + "=" * 60)
    print("INJECTION COMPLETE!")
    print(f"Total grades for NISN {NISN}: {Grade.objects.filter(nisn_id=NISN).count()}")
    print("=" * 60)
