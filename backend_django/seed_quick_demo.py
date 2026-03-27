"""
Quick Demo Data Seeder
======================

Script untuk membuat data demo cepat via Django shell.
Jalankan dengan: python manage.py shell < seed_quick_demo.py

Atau copy-paste ke Django shell interaktif.
"""

from django.utils import timezone
from django.db import transaction
from apps.accounts.models import User
from apps.students.models import Student
from apps.finance.models import Tagihan, Tarif, Pembayaran
from apps.attendance.models import Attendance
from apps.grades.models import Grade
from apps.evaluations.models import Evaluation
from decimal import Decimal
import datetime

print("=" * 60)
print("BARON PONPES PORTAL - QUICK DEMO DATA SEEDER")
print("=" * 60)

with transaction.atomic():
    # ============================================
    # 1. ACCOUNT & STUDENT SETUP
    # ============================================
    print("\n[1] Creating accounts and students...")

    nisn_val = "20260001"

    # Create walisantri user
    user, created = User.objects.get_or_create(
        username="walidummy",
        defaults={
            "role": "walisantri",
            "name": "Bpk. Walisantri Demo",
            "linked_student_nisn": nisn_val,
            "phone": "081234567001"
        }
    )
    if created:
        user.set_password("password123")
        user.save()
        print(f"   + Created user: walidummy (walisantri)")
    else:
        print(f"   = Existing user: walidummy")

    # Create bendahara
    bendahara, created = User.objects.get_or_create(
        username="bendahara_demo",
        defaults={
            "role": "bendahara",
            "name": "Ibu Bendahara Demo",
            "phone": "081234567100"
        }
    )
    if created:
        bendahara.set_password("password123")
        bendahara.save()
        print(f"   + Created user: bendahara_demo")

    # Create student
    student, created = Student.objects.get_or_create(
        nisn=nisn_val,
        defaults={
            "nama": "Santri Akun Dummy",
            "kelas": "X A",
            "program": "Reguler",
            "aktif": True,
            "wali_nama": "Bpk. Walisantri Demo",
            "wali_phone": "081234567001",
            "target_hafalan": 5,
            "current_hafalan": 2
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} student: {student.nama} ({student.kelas})")

    # ============================================
    # 2. FINANCE SETUP
    # ============================================
    print("\n[2] Creating finance data...")

    # Create Tarif
    tarif, created = Tarif.objects.get_or_create(
        nama="SPP Bulanan Demo",
        tahun_ajaran="2025/2026",
        defaults={
            "kategori": "spp",
            "frekuensi": "bulanan",
            "nominal": Decimal("500000"),
            "aktif": True
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} tarif: {tarif.nama}")

    # Create Tagihan - LUNAS
    tagihan_lunas, created = Tagihan.objects.get_or_create(
        no_invoice=f"INV-DEMO-{nisn_val}-01",
        defaults={
            "siswa_id": nisn_val,
            "tarif": tarif,
            "bulan": 1,  # Januari
            "tahun": 2026,
            "nominal": Decimal("500000"),
            "diskon": Decimal("0"),
            "denda": Decimal("0"),
            "total": Decimal("500000"),
            "terbayar": Decimal("500000"),
            "sisa": Decimal("0"),
            "status": "lunas",
            "jatuh_tempo": datetime.date(2026, 1, 10)
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} tagihan LUNAS: {tagihan_lunas.no_invoice}")

    # Create Tagihan - BELUM BAYAR
    tagihan_belum, created = Tagihan.objects.get_or_create(
        no_invoice=f"INV-DEMO-{nisn_val}-03",
        defaults={
            "siswa_id": nisn_val,
            "tarif": tarif,
            "bulan": 3,  # Maret
            "tahun": 2026,
            "nominal": Decimal("500000"),
            "diskon": Decimal("0"),
            "denda": Decimal("0"),
            "total": Decimal("500000"),
            "terbayar": Decimal("0"),
            "sisa": Decimal("500000"),
            "status": "belum_bayar",
            "jatuh_tempo": datetime.date(2026, 3, 10)
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} tagihan BELUM BAYAR: {tagihan_belum.no_invoice}")

    # Create Tagihan - SEBAGIAN
    tagihan_sebagian, created = Tagihan.objects.get_or_create(
        no_invoice=f"INV-DEMO-{nisn_val}-02",
        defaults={
            "siswa_id": nisn_val,
            "tarif": tarif,
            "bulan": 2,  # Februari
            "tahun": 2026,
            "nominal": Decimal("500000"),
            "diskon": Decimal("0"),
            "denda": Decimal("0"),
            "total": Decimal("500000"),
            "terbayar": Decimal("250000"),
            "sisa": Decimal("250000"),
            "status": "sebagian",
            "jatuh_tempo": datetime.date(2026, 2, 10)
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} tagihan SEBAGIAN: {tagihan_sebagian.no_invoice}")

    # ============================================
    # 3. PEMBAYARAN (VERIFIED)
    # ============================================
    print("\n[3] Creating payment records...")

    # Payment for LUNAS tagihan
    if not Pembayaran.objects.filter(tagihan=tagihan_lunas).exists():
        Pembayaran.objects.create(
            tagihan=tagihan_lunas,
            tanggal=timezone.now() - datetime.timedelta(days=30),
            nominal=Decimal("500000"),
            metode="transfer",
            terverifikasi=True,
            verified_by="bendahara_demo",
            tanggal_verifikasi=timezone.now() - datetime.timedelta(days=29),
            keterangan="Pembayaran SPP Januari verified"
        )
        print("   + Created pembayaran VERIFIED for January")

    # Payment for SEBAGIAN tagihan (unverified)
    if not Pembayaran.objects.filter(tagihan=tagihan_sebagian).exists():
        Pembayaran.objects.create(
            tagihan=tagihan_sebagian,
            tanggal=timezone.now() - datetime.timedelta(days=15),
            nominal=Decimal("250000"),
            metode="qris",
            terverifikasi=False,
            keterangan="Pembayaran cicilan - menunggu verifikasi"
        )
        print("   + Created pembayaran PENDING for February (partial)")

    # ============================================
    # 4. ACADEMIC DATA - GRADES (Multiple jenis per subject)
    # ============================================
    print("\n[4] Creating academic grades...")

    # Multiple grades per subject for better aggregation demo
    grade_data = [
        # (mata_pelajaran, jenis, nilai)
        ('Bahasa Arab', 'UH', 82),
        ('Bahasa Arab', 'UTS', 85),
        ('Bahasa Arab', 'UAS', 88),
        ('Fiqih', 'UH', 75),
        ('Fiqih', 'UTS', 78),
        ('Fiqih', 'UAS', 80),
        ('Aqidah', 'UH', 88),
        ('Aqidah', 'UTS', 90),
        ('Aqidah', 'UAS', 92),
        ('Tahfidz', 'UH', 85),
        ('Tahfidz', 'UTS', 88),
        ('Tahfidz', 'UAS', 90),
        ('Bahasa Indonesia', 'UH', 78),
        ('Bahasa Indonesia', 'UTS', 82),
        ('Matematika', 'UH', 70),
        ('Matematika', 'UTS', 72),
        ('Matematika', 'UAS', 75),
    ]

    grades_created = 0
    for mata_pelajaran, jenis, nilai in grade_data:
        grade, created = Grade.objects.get_or_create(
            nisn_id=nisn_val,
            mata_pelajaran=mata_pelajaran,
            jenis=jenis,
            semester="Ganjil",
            tahun_ajaran="2025/2026",
            defaults={
                "nilai": nilai,
                "kelas": "X A",
                "guru": f"Guru {mata_pelajaran}"
            }
        )
        if created:
            grades_created += 1

    print(f"   + Created {grades_created} grade records for {len(set([g[0] for g in grade_data]))} subjects")

    # ============================================
    # 5. ATTENDANCE
    # ============================================
    print("\n[5] Creating attendance records...")

    today = timezone.now().date()
    attendance_count = 0

    for day_offset in range(1, 6):  # Last 5 days
        date = today - datetime.timedelta(days=day_offset)
        if date.weekday() >= 5:  # Skip weekend
            continue

        for jam_ke in [1, 2, 3, 4]:
            _, created = Attendance.objects.get_or_create(
                nisn_id=nisn_val,
                tanggal=date,
                jam_ke=jam_ke,
                defaults={
                    "mata_pelajaran": f"Mapel JP{jam_ke}",
                    "status": "Hadir",
                    "keterangan": None
                }
            )
            if created:
                attendance_count += 1

    print(f"   + Created {attendance_count} attendance records")

    # ============================================
    # 6. EVALUATIONS
    # ============================================
    print("\n[6] Creating evaluations...")

    # Prestasi
    eval_prestasi, created = Evaluation.objects.get_or_create(
        nisn_id=nisn_val,
        jenis="prestasi",
        name="Hafal Al-Mulk",
        defaults={
            "tanggal": today - datetime.timedelta(days=7),
            "kategori": "hafalan",
            "evaluator": "demo_guru1",
            "summary": "Berhasil menghafal Surat Al-Mulk dengan tajwid yang baik",
            "catatan": "Lanjutkan dengan Surat Ar-Rahman"
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} evaluation: Prestasi - Hafal Al-Mulk")

    # Pelanggaran
    eval_pelanggaran, created = Evaluation.objects.get_or_create(
        nisn_id=nisn_val,
        jenis="pelanggaran",
        name="Terlambat Sholat Berjamaah",
        defaults={
            "tanggal": today - datetime.timedelta(days=3),
            "kategori": "kedisiplinan",
            "evaluator": "demo_guru2",
            "summary": "Terlambat mengikuti sholat Dzuhur berjamaah",
            "catatan": "Diberi teguran lisan"
        }
    )
    print(f"   {'+ Created' if created else '= Existing'} evaluation: Pelanggaran - Terlambat")

print("\n" + "=" * 60)
print("DEMO DATA CREATED SUCCESSFULLY!")
print("=" * 60)

print("\n--- INTEGRITY CHECK ---")
print(f"Student: {Student.objects.filter(nisn=nisn_val).count()} record(s)")
print(f"Tagihan: {Tagihan.objects.filter(siswa_id=nisn_val).count()} record(s)")
print(f"  - Lunas: {Tagihan.objects.filter(siswa_id=nisn_val, status='lunas').count()}")
print(f"  - Sebagian: {Tagihan.objects.filter(siswa_id=nisn_val, status='sebagian').count()}")
print(f"  - Belum Bayar: {Tagihan.objects.filter(siswa_id=nisn_val, status='belum_bayar').count()}")
print(f"Pembayaran: {Pembayaran.objects.filter(tagihan__siswa_id=nisn_val).count()} record(s)")
print(f"  - Verified: {Pembayaran.objects.filter(tagihan__siswa_id=nisn_val, terverifikasi=True).count()}")
print(f"  - Pending: {Pembayaran.objects.filter(tagihan__siswa_id=nisn_val, terverifikasi=False).count()}")
print(f"Grades: {Grade.objects.filter(nisn_id=nisn_val).count()} record(s)")
print(f"Attendance: {Attendance.objects.filter(nisn_id=nisn_val).count()} record(s)")
print(f"Evaluations: {Evaluation.objects.filter(nisn_id=nisn_val).count()} record(s)")

print("\n--- LOGIN CREDENTIALS ---")
print("Walisantri: walidummy / password123")
print("Bendahara: bendahara_demo / password123")
