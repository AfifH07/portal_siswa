"""
Kesantrian Demo Data Seeder
============================
Seeds demo data for the kesantrian module (Ibadah, Halaqoh, Pembinaan).

Run with: python manage.py shell < seed_kesantrian_demo.py
"""

from django.utils import timezone
from django.db import transaction
from apps.accounts.models import User
from apps.students.models import Student
from apps.kesantrian.models import Ibadah, Halaqoh, HalaqohMember, Pembinaan, TargetHafalan
import datetime
import random

print("=" * 60)
print("KESANTRIAN DEMO DATA SEEDER")
print("=" * 60)

with transaction.atomic():
    # ============================================
    # 1. CREATE MUSYRIF USER
    # ============================================
    print("\n[1] Creating musyrif user...")

    musyrif, created = User.objects.update_or_create(
        username="musyrif_demo",
        defaults={
            "role": "musyrif",
            "name": "Ustadz Ahmad Fauzi",
            "phone": "081234567200"
        }
    )
    if created:
        musyrif.set_password("password123")
        musyrif.save()
    print(f"    {'+ Created' if created else '= Existing'} musyrif: {musyrif.name}")

    # ============================================
    # 2. CREATE HALAQOH GROUPS
    # ============================================
    print("\n[2] Creating halaqoh groups...")

    halaqoh_data = [
        ("Halaqoh Tahfidz A", "tahfidz", "Ustadz Ahmad Fauzi", "musyrif_demo"),
        ("Halaqoh Tahfidz B", "tahfidz", "Ustadz Mahmud", None),
        ("Halaqoh Tahsin Pemula", "tahsin", "Ustadzah Fatimah", None),
        ("Halaqoh Kajian Fiqih", "kajian", "Ustadz Ibrahim", None),
    ]

    halaqoh_objs = []
    for nama, jenis, musyrif_name, musyrif_user in halaqoh_data:
        halaqoh, created = Halaqoh.objects.update_or_create(
            nama=nama,
            tahun_ajaran="2025/2026",
            defaults={
                "jenis": jenis,
                "musyrif": musyrif_name,
                "musyrif_username": musyrif_user,
                "jadwal": "Senin-Kamis 05:00-06:00",
                "lokasi": "Masjid Pesantren",
                "kapasitas": 15,
                "aktif": True
            }
        )
        halaqoh_objs.append(halaqoh)
        print(f"    {'+ Created' if created else '= Existing'} halaqoh: {nama}")

    # ============================================
    # 3. ADD STUDENTS TO HALAQOH
    # ============================================
    print("\n[3] Adding students to halaqoh...")

    students = list(Student.objects.filter(aktif=True)[:10])
    if students:
        for i, student in enumerate(students):
            halaqoh = halaqoh_objs[i % len(halaqoh_objs)]
            member, created = HalaqohMember.objects.update_or_create(
                halaqoh=halaqoh,
                siswa=student,
                defaults={"aktif": True}
            )
            if created:
                print(f"    + {student.nama} -> {halaqoh.nama}")
    else:
        print("    ! No students found")

    # ============================================
    # 4. CREATE IBADAH RECORDS
    # ============================================
    print("\n[4] Creating ibadah records...")

    today = timezone.now().date()
    waktu_sholat = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']
    status_options = ['hadir', 'hadir', 'hadir', 'terlambat', 'tidak_hadir']  # Weighted towards hadir

    ibadah_count = 0
    for student in students[:5]:  # First 5 students
        for day_offset in range(7):  # Last 7 days
            tanggal = today - datetime.timedelta(days=day_offset)

            for waktu in waktu_sholat:
                _, created = Ibadah.objects.update_or_create(
                    siswa=student,
                    tanggal=tanggal,
                    jenis='sholat_wajib',
                    waktu=waktu,
                    defaults={
                        "status": random.choice(status_options),
                        "pencatat": "musyrif_demo"
                    }
                )
                if created:
                    ibadah_count += 1

    print(f"    + Created {ibadah_count} ibadah records")

    # ============================================
    # 5. CREATE PEMBINAAN (BLP) RECORDS
    # ============================================
    print("\n[5] Creating pembinaan records...")

    pembinaan_samples = [
        ("hafalan", "Setoran Surah Al-Baqarah", "Menghafal ayat 1-50", "baik", "Al-Baqarah", 1, 50),
        ("akhlak", "Evaluasi Akhlak Bulanan", "Santri menunjukkan perilaku sopan dan disiplin", "sangat_baik", None, None, None),
        ("kedisiplinan", "Catatan Kedisiplinan", "Tepat waktu dalam semua kegiatan", "baik", None, None, None),
    ]

    pembinaan_count = 0
    for student in students[:3]:
        for kategori, judul, deskripsi, tingkat, surah, ayat_mulai, ayat_selesai in pembinaan_samples:
            _, created = Pembinaan.objects.update_or_create(
                siswa=student,
                tanggal=today - datetime.timedelta(days=random.randint(1, 30)),
                kategori=kategori,
                judul=judul,
                defaults={
                    "deskripsi": deskripsi,
                    "tingkat": tingkat,
                    "pembina": "Ustadz Ahmad Fauzi",
                    "pembina_username": "musyrif_demo",
                    "surah": surah,
                    "ayat_mulai": ayat_mulai,
                    "ayat_selesai": ayat_selesai
                }
            )
            if created:
                pembinaan_count += 1

    print(f"    + Created {pembinaan_count} pembinaan records")

    # ============================================
    # 6. CREATE TARGET HAFALAN
    # ============================================
    print("\n[6] Creating target hafalan...")

    target_count = 0
    for student in students[:5]:
        target_juz = random.choice([1, 2, 3, 5])
        tercapai = round(random.uniform(0, target_juz), 2)

        _, created = TargetHafalan.objects.update_or_create(
            siswa=student,
            semester="Ganjil",
            tahun_ajaran="2025/2026",
            defaults={
                "target_juz": target_juz,
                "tercapai_juz": tercapai
            }
        )
        if created:
            target_count += 1

    print(f"    + Created {target_count} target hafalan records")

    # ============================================
    # 7. CREATE MULTI-CHILD WALISANTRI ACCOUNT
    # ============================================
    print("\n[7] Creating multi-child walisantri account...")

    if len(students) >= 2:
        wali, created = User.objects.update_or_create(
            username="wali_multi",
            defaults={
                "role": "walisantri",
                "name": "Bapak Ahmad (2 Anak)",
                "phone": "081234567300",
                "email": "wali_multi@test.com",
                "linked_student_nisn": students[0].nisn,  # Legacy single-child
                "linked_student_nisns": [students[0].nisn, students[1].nisn],  # Multi-child
            }
        )
        if created:
            wali.set_password("wali123")
            wali.save()
        print(f"    {'+ Created' if created else '= Updated'} walisantri: {wali.username}")
        print(f"      - Anak 1: {students[0].nama} (NISN: {students[0].nisn})")
        print(f"      - Anak 2: {students[1].nama} (NISN: {students[1].nisn})")
    else:
        print("    ! Not enough students for multi-child walisantri")

print("\n" + "=" * 60)
print("KESANTRIAN DEMO DATA CREATED!")
print("=" * 60)

# Final counts
print("\nFinal Record Counts:")
print(f"  - Halaqoh:       {Halaqoh.objects.count()}")
print(f"  - HalaqohMember: {HalaqohMember.objects.count()}")
print(f"  - Ibadah:        {Ibadah.objects.count()}")
print(f"  - Pembinaan:     {Pembinaan.objects.count()}")
print(f"  - TargetHafalan: {TargetHafalan.objects.count()}")

print("\nTest Accounts:")
print("  - Musyrif: musyrif_demo / password123")
print("  - Walisantri (multi-child): wali_multi / wali123")
print("\nAPI Endpoints to test:")
print("  GET /api/kesantrian/my-children-summary/")
print("  GET /api/kesantrian/worship-tracker/<nisn>/")
print("  GET /api/kesantrian/ibadah/<nisn>/")
print("  GET /api/kesantrian/pembinaan/<nisn>/")
