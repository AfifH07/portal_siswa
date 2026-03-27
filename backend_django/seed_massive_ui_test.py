"""
MASSIVE DATA INJECTION FOR UI TESTING
======================================
Script ini mengisi data lengkap untuk testing Dashboard Wali Santri.

Run: python manage.py shell < seed_massive_ui_test.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

from django.utils import timezone
from django.db import transaction
from decimal import Decimal
import datetime
import random

from apps.accounts.models import User
from apps.students.models import Student
from apps.kesantrian.models import (
    Ibadah, Halaqoh, HalaqohMember, Pembinaan, TargetHafalan,
    BLPEntry, EmployeeEvaluation, InvalRecord, BLP_INDICATORS
)
from apps.attendance.models import Attendance
from apps.grades.models import Grade

print("=" * 70)
print("MASSIVE DATA INJECTION FOR UI TESTING")
print("=" * 70)

# ============================================
# 1. IDENTIFY TARGET USER & STUDENTS
# ============================================
print("\n[1] Identifying target user and students...")

try:
    wali = User.objects.get(username='wali_multi')
    print(f"    Found wali: {wali.name} ({wali.username})")
except User.DoesNotExist:
    print("    Creating wali_multi user...")
    wali = User.objects.create_user(
        username='wali_multi',
        password='wali123',
        name='Bapak Ahmad (2 Anak)',
        role='walisantri',
        phone='081234567300',
        email='wali_multi@test.com'
    )

# Get or create linked students
students = []
nisn_list = wali.get_linked_students()

if not nisn_list:
    # Get first 2 active students or create them
    existing_students = list(Student.objects.filter(aktif=True)[:2])

    if len(existing_students) < 2:
        # Create test students
        for i, data in enumerate([
            ('0012345634', 'Ahmad Abdullaha', 'XI A'),
            ('0012345678', 'Ahmad Abdullah', 'XI A'),
        ]):
            student, created = Student.objects.get_or_create(
                nisn=data[0],
                defaults={
                    'nama': data[1],
                    'kelas': data[2],
                    'program': 'Reguler',
                    'aktif': True,
                    'target_hafalan': 5,
                    'current_hafalan': random.uniform(1, 4),
                    'wali_nama': wali.name,
                    'wali_phone': wali.phone
                }
            )
            students.append(student)
            if created:
                print(f"    + Created student: {student.nama}")
    else:
        students = existing_students

    # Link students to wali
    nisn_list = [s.nisn for s in students]
    wali.linked_student_nisns = nisn_list
    wali.linked_student_nisn = nisn_list[0]
    wali.save()
    print(f"    Linked {len(nisn_list)} students to wali")
else:
    for nisn in nisn_list:
        try:
            student = Student.objects.get(nisn=nisn)
            students.append(student)
            print(f"    Found student: {student.nama} (NISN: {nisn})")
        except Student.DoesNotExist:
            print(f"    ! Student with NISN {nisn} not found")

if not students:
    print("ERROR: No students found!")
    sys.exit(1)

print(f"\n    Total students to populate: {len(students)}")

# ============================================
# 2. INJECT IBADAH DATA (30 DAYS)
# ============================================
print("\n[2] Injecting Ibadah data (30 days)...")

today = timezone.now().date()
waktu_sholat = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']
sholat_sunnah = ['dhuha', 'tahajud', 'rawatib_qabliyah', 'rawatib_badiyah']
status_weights = ['hadir'] * 85 + ['terlambat'] * 10 + ['tidak_hadir'] * 3 + ['izin'] * 2

ibadah_count = 0

with transaction.atomic():
    for student in students:
        for day_offset in range(30):
            tanggal = today - datetime.timedelta(days=day_offset)

            # Sholat Wajib 5 waktu
            for waktu in waktu_sholat:
                status = random.choice(status_weights)
                obj, created = Ibadah.objects.update_or_create(
                    siswa=student,
                    tanggal=tanggal,
                    jenis='sholat_wajib',
                    waktu=waktu,
                    defaults={
                        'status': status,
                        'pencatat': 'musyrif_demo'
                    }
                )
                if created:
                    ibadah_count += 1

            # Sholat Sunnah (random participation)
            for waktu in sholat_sunnah:
                if random.random() > 0.3:  # 70% chance
                    status = random.choice(['hadir'] * 90 + ['tidak_hadir'] * 10)
                    obj, created = Ibadah.objects.update_or_create(
                        siswa=student,
                        tanggal=tanggal,
                        jenis='sholat_sunnah',
                        waktu=waktu,
                        defaults={
                            'status': status,
                            'pencatat': 'musyrif_demo'
                        }
                    )
                    if created:
                        ibadah_count += 1

            # Puasa Sunnah (Senin & Kamis)
            if tanggal.weekday() in [0, 3]:  # Monday, Thursday
                if random.random() > 0.2:  # 80% chance
                    obj, created = Ibadah.objects.update_or_create(
                        siswa=student,
                        tanggal=tanggal,
                        jenis='puasa',
                        waktu=None,
                        defaults={
                            'status': 'hadir',
                            'catatan': 'Puasa Sunnah Senin/Kamis',
                            'pencatat': 'musyrif_demo'
                        }
                    )
                    if created:
                        ibadah_count += 1

            # Tilawah Harian
            if random.random() > 0.15:  # 85% chance
                obj, created = Ibadah.objects.update_or_create(
                    siswa=student,
                    tanggal=tanggal,
                    jenis='tilawah',
                    waktu=None,
                    defaults={
                        'status': 'hadir',
                        'catatan': f'Tilawah {random.randint(1,5)} halaman',
                        'pencatat': 'musyrif_demo'
                    }
                )
                if created:
                    ibadah_count += 1

print(f"    + Created {ibadah_count} ibadah records")

# ============================================
# 3. INJECT ATTENDANCE DATA (KBM, Diniyah)
# ============================================
print("\n[3] Injecting Attendance data (KBM & Diniyah)...")

attendance_count = 0
mapel_kbm = ['Bahasa Arab', 'Fiqih', 'Aqidah', 'Tahfidz', 'Bahasa Indonesia', 'Matematika', 'IPA', 'IPS']
mapel_diniyah = ['Nahwu', 'Shorof', 'Tafsir', 'Hadits', 'Ushul Fiqh']

with transaction.atomic():
    for student in students:
        for day_offset in range(30):
            tanggal = today - datetime.timedelta(days=day_offset)

            # Skip weekend
            if tanggal.weekday() >= 5:
                continue

            # KBM (4 jam pelajaran)
            for jam_ke in range(1, 5):
                mapel = random.choice(mapel_kbm)
                status = random.choice(['Hadir'] * 90 + ['Izin'] * 5 + ['Sakit'] * 3 + ['Alpa'] * 2)

                obj, created = Attendance.objects.update_or_create(
                    nisn=student,
                    tanggal=tanggal,
                    jam_ke=jam_ke,
                    defaults={
                        'mata_pelajaran': mapel,
                        'status': status,
                        'keterangan': None if status == 'Hadir' else f'{status} - {mapel}'
                    }
                )
                if created:
                    attendance_count += 1

            # Diniyah (2 jam malam)
            for jam_ke in range(5, 7):
                mapel = random.choice(mapel_diniyah)
                status = random.choice(['Hadir'] * 92 + ['Izin'] * 4 + ['Sakit'] * 2 + ['Alpa'] * 2)

                obj, created = Attendance.objects.update_or_create(
                    nisn=student,
                    tanggal=tanggal,
                    jam_ke=jam_ke,
                    defaults={
                        'mata_pelajaran': mapel,
                        'status': status,
                        'keterangan': None if status == 'Hadir' else f'{status} - Diniyah'
                    }
                )
                if created:
                    attendance_count += 1

print(f"    + Created {attendance_count} attendance records")

# ============================================
# 4. INJECT HAFALAN/ZIYADAH DATA
# ============================================
print("\n[4] Injecting Hafalan/Ziyadah data...")

hafalan_count = 0
surah_data = [
    ('Al-Mulk', 30), ('Al-Qalam', 52), ('Al-Haqqah', 52), ('Al-Maarij', 44),
    ('Nuh', 28), ('Al-Jinn', 28), ('Al-Muzzammil', 20), ('Al-Muddathir', 56),
    ('Al-Qiyamah', 40), ('Al-Insan', 31), ('Al-Mursalat', 50), ('An-Naba', 40),
    ('An-Naziat', 46), ('Abasa', 42), ('At-Takwir', 29), ('Al-Infitar', 19),
]

with transaction.atomic():
    for student in students:
        # Update target hafalan
        target, created = TargetHafalan.objects.update_or_create(
            siswa=student,
            semester='Ganjil',
            tahun_ajaran='2025/2026',
            defaults={
                'target_juz': 5,
                'tercapai_juz': round(random.uniform(2.5, 4.5), 2)
            }
        )

        # Update student's hafalan
        student.target_hafalan = 5
        student.current_hafalan = target.tercapai_juz
        student.save()

        hafalan_count += 1

        # Pembinaan hafalan records
        for i in range(10):
            surah, total_ayat = random.choice(surah_data)
            ayat_mulai = random.randint(1, total_ayat - 10)
            ayat_selesai = min(ayat_mulai + random.randint(5, 15), total_ayat)

            tanggal = today - datetime.timedelta(days=random.randint(1, 30))

            tingkat = random.choice(['sangat_baik'] * 30 + ['baik'] * 50 + ['cukup'] * 15 + ['perlu_perhatian'] * 5)

            Pembinaan.objects.create(
                siswa=student,
                tanggal=tanggal,
                kategori='hafalan',
                judul=f'Setoran {surah} ayat {ayat_mulai}-{ayat_selesai}',
                deskripsi=f'Santri menghafal surah {surah} ayat {ayat_mulai} sampai {ayat_selesai} dengan baik.',
                tingkat=tingkat,
                pembina='Ustadz Ahmad Fauzi',
                pembina_username='musyrif_demo',
                surah=surah,
                ayat_mulai=ayat_mulai,
                ayat_selesai=ayat_selesai,
                jumlah_halaman=round((ayat_selesai - ayat_mulai) / 15, 2)
            )
            hafalan_count += 1

print(f"    + Created {hafalan_count} hafalan/pembinaan records")

# ============================================
# 5. INJECT BLP ENTRY (59 INDICATORS)
# ============================================
print("\n[5] Injecting BLP Entry (59 indicators)...")

blp_count = 0

def generate_blp_values():
    """Generate random BLP values for all 59 indicators"""
    values = {}
    for domain, data in BLP_INDICATORS.items():
        values[domain] = {}
        for code, label in data['indicators']:
            # Weighted random: more likely to get good scores
            score = random.choices(
                [1, 2, 3, 4, 5],
                weights=[5, 10, 20, 35, 30]
            )[0]
            values[domain][code] = score
    return values

# Get week boundaries
def get_week_boundaries(date):
    days_since_sunday = (date.weekday() + 1) % 7
    week_start = date - datetime.timedelta(days=days_since_sunday)
    week_end = week_start + datetime.timedelta(days=6)
    return week_start, week_end

with transaction.atomic():
    # IMPORTANT: Delete existing BLP entries first to avoid locked validation error
    for student in students:
        deleted_count = BLPEntry.objects.filter(siswa=student).delete()[0]
        if deleted_count > 0:
            print(f"    - Deleted {deleted_count} existing BLP entries for {student.nama}")

    blp_ids_to_lock = []

    for student in students:
        # Create BLP for last 4 weeks
        for week_offset in range(4):
            target_date = today - datetime.timedelta(weeks=week_offset)
            week_start, week_end = get_week_boundaries(target_date)

            indicator_values = generate_blp_values()
            bonus = random.randint(0, 20) if random.random() > 0.7 else 0

            # Create with is_locked=False first to allow calculate_scores()
            blp = BLPEntry.objects.create(
                siswa=student,
                week_start=week_start,
                week_end=week_end,
                tahun_ajaran='2025/2026',
                semester='Ganjil',
                indicator_values=indicator_values,
                bonus_points=bonus,
                bonus_notes='Bonus partisipasi kegiatan' if bonus > 0 else None,
                status='submitted',
                is_locked=False,  # Always create unlocked first
                catatan=f'Penilaian minggu ke-{4-week_offset}',
                pencatat='Ustadz Ahmad Fauzi',
                pencatat_username='musyrif_demo'
            )

            # Calculate scores
            blp.calculate_scores()
            blp.save()
            blp_count += 1

            # Mark for locking if not current week
            if week_offset > 0:
                blp_ids_to_lock.append(blp.pk)

    # Lock older entries using queryset.update() to bypass signals
    if blp_ids_to_lock:
        BLPEntry.objects.filter(pk__in=blp_ids_to_lock).update(
            is_locked=True,
            status='locked'
        )
        print(f"    - Locked {len(blp_ids_to_lock)} older BLP entries")

print(f"    + Created {blp_count} BLP entries")

# ============================================
# 6. INJECT KEUANGAN/TUNGGAKAN DATA
# ============================================
print("\n[6] Injecting Keuangan/Tunggakan data...")

finance_count = 0

try:
    from apps.finance.models import Tarif, Tagihan, Pembayaran

    with transaction.atomic():
        # Create or get Tarif SPP
        tarif, _ = Tarif.objects.get_or_create(
            nama='SPP Bulanan',
            tahun_ajaran='2025/2026',
            defaults={
                'kategori': 'spp',
                'frekuensi': 'bulanan',
                'nominal': Decimal('750000'),
                'aktif': True
            }
        )

        for student in students:
            # Create tagihan for last 4 months
            for month_offset in range(4):
                bulan = today.month - month_offset
                tahun = today.year
                if bulan <= 0:
                    bulan += 12
                    tahun -= 1

                jatuh_tempo = datetime.date(tahun, bulan, 10)
                no_invoice = f"INV-{tahun}{bulan:02d}-{student.nisn}"

                # Determine status
                if month_offset >= 3:
                    # Oldest month - LUNAS
                    status = 'lunas'
                    terbayar = Decimal('750000')
                    sisa = Decimal('0')
                elif month_offset == 2:
                    # LUNAS
                    status = 'lunas'
                    terbayar = Decimal('750000')
                    sisa = Decimal('0')
                elif month_offset == 1:
                    # SEBAGIAN
                    status = 'sebagian'
                    terbayar = Decimal('400000')
                    sisa = Decimal('350000')
                else:
                    # Current month - BELUM BAYAR
                    status = 'belum_bayar'
                    terbayar = Decimal('0')
                    sisa = Decimal('750000')

                tagihan, created = Tagihan.objects.update_or_create(
                    no_invoice=no_invoice,
                    defaults={
                        'siswa': student,  # ForeignKey to Student object
                        'tarif': tarif,
                        'bulan': bulan,
                        'tahun': tahun,
                        'nominal': Decimal('750000'),
                        'diskon': Decimal('0'),
                        'denda': Decimal('0'),
                        'total': Decimal('750000'),
                        'terbayar': terbayar,
                        'sisa': sisa,
                        'status': status,
                        'jatuh_tempo': jatuh_tempo
                    }
                )

                if created:
                    finance_count += 1

                # Create pembayaran for paid tagihan
                if status in ['lunas', 'sebagian'] and not Pembayaran.objects.filter(tagihan=tagihan).exists():
                    Pembayaran.objects.create(
                        tagihan=tagihan,
                        tanggal=timezone.now() - datetime.timedelta(days=month_offset * 30),
                        nominal=terbayar,
                        metode=random.choice(['transfer', 'tunai', 'qris']),
                        terverifikasi=True,
                        verified_by='bendahara_demo',
                        tanggal_verifikasi=timezone.now() - datetime.timedelta(days=month_offset * 30 - 1),
                        keterangan=f'Pembayaran SPP bulan {bulan}/{tahun}'
                    )

    print(f"    + Created {finance_count} tagihan records")

except ImportError:
    print("    ! Finance module not found, skipping...")

# ============================================
# 7. INJECT GRADES DATA
# ============================================
print("\n[7] Injecting Grades data...")

grades_count = 0
mapel_list = ['Bahasa Arab', 'Fiqih', 'Aqidah', 'Tahfidz', 'Hadits', 'Bahasa Indonesia', 'Matematika', 'IPA']
jenis_list = ['UH', 'UTS', 'UAS']

with transaction.atomic():
    for student in students:
        for mapel in mapel_list:
            for jenis in jenis_list:
                # Generate good scores (75-100)
                nilai = random.randint(75, 98)

                grade, created = Grade.objects.update_or_create(
                    nisn=student,
                    mata_pelajaran=mapel,
                    jenis=jenis,
                    semester='Ganjil',
                    tahun_ajaran='2025/2026',
                    defaults={
                        'nilai': nilai,
                        'kelas': student.kelas,
                        'guru': f'Guru {mapel}'
                    }
                )

                if created:
                    grades_count += 1

print(f"    + Created {grades_count} grade records")

# ============================================
# 8. INJECT PEMBINAAN (NON-HAFALAN)
# ============================================
print("\n[8] Injecting Pembinaan records...")

pembinaan_count = 0
pembinaan_samples = [
    ('akhlak', 'Evaluasi Akhlak Bulanan', 'Santri menunjukkan perilaku sopan dan disiplin'),
    ('kedisiplinan', 'Catatan Kedisiplinan', 'Tepat waktu dalam semua kegiatan'),
    ('akademik', 'Evaluasi Akademik', 'Menunjukkan peningkatan dalam pembelajaran'),
    ('sosial', 'Interaksi Sosial', 'Berpartisipasi aktif dalam kegiatan kelompok'),
    ('bakat', 'Pengembangan Bakat', 'Aktif dalam kegiatan ekstrakurikuler'),
]

with transaction.atomic():
    for student in students:
        for kategori, judul, deskripsi in pembinaan_samples:
            tingkat = random.choice(['sangat_baik', 'baik', 'baik', 'cukup'])

            Pembinaan.objects.create(
                siswa=student,
                tanggal=today - datetime.timedelta(days=random.randint(1, 30)),
                kategori=kategori,
                judul=judul,
                deskripsi=deskripsi,
                tingkat=tingkat,
                pembina='Ustadz Ahmad Fauzi',
                pembina_username='musyrif_demo'
            )
            pembinaan_count += 1

print(f"    + Created {pembinaan_count} pembinaan records")

# ============================================
# 9. CREATE HALAQOH MEMBERSHIP
# ============================================
print("\n[9] Creating Halaqoh membership...")

halaqoh_count = 0

with transaction.atomic():
    # Create or get halaqoh
    halaqoh, _ = Halaqoh.objects.get_or_create(
        nama='Halaqoh Tahfidz Mumtaz',
        tahun_ajaran='2025/2026',
        defaults={
            'jenis': 'tahfidz',
            'musyrif': 'Ustadz Ahmad Fauzi',
            'musyrif_username': 'musyrif_demo',
            'jadwal': 'Senin-Kamis 05:00-06:00',
            'lokasi': 'Masjid Pesantren',
            'kapasitas': 15,
            'aktif': True
        }
    )

    for student in students:
        member, created = HalaqohMember.objects.get_or_create(
            halaqoh=halaqoh,
            siswa=student,
            defaults={'aktif': True}
        )
        if created:
            halaqoh_count += 1

print(f"    + Created {halaqoh_count} halaqoh memberships")

# ============================================
# FINAL SUMMARY
# ============================================
print("\n" + "=" * 70)
print("DATA INJECTION COMPLETE!")
print("=" * 70)

print(f"""
Summary for account: {wali.username} / wali123

Linked Students:
""")

for student in students:
    print(f"  - {student.nama} (NISN: {student.nisn}, Kelas: {student.kelas})")

    # Get stats
    ibadah = Ibadah.objects.filter(siswa=student).count()
    attendance = Attendance.objects.filter(nisn=student).count()
    grades = Grade.objects.filter(nisn=student).count()
    pembinaan = Pembinaan.objects.filter(siswa=student).count()
    blp = BLPEntry.objects.filter(siswa=student).count()

    print(f"    Ibadah: {ibadah} | Attendance: {attendance} | Grades: {grades}")
    print(f"    Pembinaan: {pembinaan} | BLP: {blp} entries")

    # Get latest BLP
    latest_blp = BLPEntry.objects.filter(siswa=student).order_by('-week_start').first()
    if latest_blp:
        print(f"    Latest BLP: {latest_blp.total_score}/390 ({latest_blp.predikat})")

print(f"""
Test URLs:
  - Dashboard: http://127.0.0.1:8000/dashboard/parent/
  - Login:     http://127.0.0.1:8000/login

Login Credentials:
  Username: wali_multi
  Password: wali123
""")
