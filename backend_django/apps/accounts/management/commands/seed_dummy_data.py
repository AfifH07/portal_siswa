"""
Seed Dummy Data - Baron Ponpes Portal Akademik
===============================================

Management command untuk membuat data dummy yang komprehensif
untuk testing dan demonstrasi sistem.

Usage:
    python manage.py seed_dummy_data
    python manage.py seed_dummy_data --clean   # Hapus data lama dulu
    python manage.py seed_dummy_data --minimal # Data minimal saja

Data yang dibuat:
1. User accounts (walisantri, guru, bendahara)
2. Students (santri)
3. Tarif (master harga)
4. Tagihan (invoices dengan berbagai status)
5. Pembayaran (verified dan pending)
6. Grades (nilai dengan berbagai jenis)
7. Attendance (absensi beberapa hari)
8. Evaluations (prestasi dan pelanggaran)
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
import datetime
import random


class Command(BaseCommand):
    help = 'Generate comprehensive dummy data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Remove existing dummy data before creating new ones'
        )
        parser.add_argument(
            '--minimal',
            action='store_true',
            help='Create minimal data set only'
        )

    def handle(self, *args, **options):
        # Import models here to avoid circular imports
        from apps.accounts.models import User
        from apps.students.models import Student
        from apps.finance.models import Tarif, Tagihan, Pembayaran
        from apps.attendance.models import Attendance
        from apps.grades.models import Grade
        from apps.evaluations.models import Evaluation

        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(self.style.NOTICE('BARON PONPES PORTAL - SEED DUMMY DATA'))
        self.stdout.write(self.style.NOTICE('=' * 60))

        if options['clean']:
            self.clean_data()

        with transaction.atomic():
            # 1. Create Users
            self.stdout.write('\n[1/8] Creating User Accounts...')
            users = self.create_users()

            # 2. Create Students
            self.stdout.write('[2/8] Creating Students...')
            students = self.create_students(options['minimal'])

            # 3. Link Walisantri to Students
            self.stdout.write('[3/8] Linking Walisantri to Students...')
            self.link_walisantri(users, students)

            # 4. Create Tarif
            self.stdout.write('[4/8] Creating Tarif (Pricing)...')
            tarif_list = self.create_tarif()

            # 5. Create Tagihan
            self.stdout.write('[5/8] Creating Tagihan (Invoices)...')
            tagihan_list = self.create_tagihan(students, tarif_list)

            # 6. Create Pembayaran
            self.stdout.write('[6/8] Creating Pembayaran (Payments)...')
            self.create_pembayaran(tagihan_list)

            # 7. Create Grades
            self.stdout.write('[7/8] Creating Grades...')
            self.create_grades(students, options['minimal'])

            # 8. Create Attendance
            self.stdout.write('[8/8] Creating Attendance & Evaluations...')
            self.create_attendance(students, options['minimal'])
            self.create_evaluations(students)

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('DUMMY DATA CREATED SUCCESSFULLY!'))
        self.stdout.write('=' * 60)
        self.print_summary()

    def clean_data(self):
        """Remove existing dummy data"""
        from apps.accounts.models import User
        from apps.students.models import Student
        from apps.finance.models import Tarif, Tagihan, Pembayaran
        from apps.attendance.models import Attendance
        from apps.grades.models import Grade
        from apps.evaluations.models import Evaluation

        self.stdout.write(self.style.WARNING('\nCleaning existing dummy data...'))

        # Delete in order (respecting FK constraints)
        Pembayaran.objects.filter(tagihan__siswa__nisn__startswith='2026').delete()
        Tagihan.objects.filter(siswa__nisn__startswith='2026').delete()
        Attendance.objects.filter(nisn__nisn__startswith='2026').delete()
        Grade.objects.filter(nisn__nisn__startswith='2026').delete()
        Evaluation.objects.filter(nisn__nisn__startswith='2026').delete()
        Student.objects.filter(nisn__startswith='2026').delete()
        User.objects.filter(username__startswith='demo_').delete()
        Tarif.objects.filter(created_by='seed_dummy_data').delete()

        self.stdout.write(self.style.SUCCESS('Existing dummy data cleaned.'))

    def create_users(self):
        """Create demo user accounts"""
        from apps.accounts.models import User

        users = {}
        user_data = [
            # Walisantri accounts
            {'username': 'demo_wali1', 'role': 'walisantri', 'name': 'Bpk. Ahmad Fauzi', 'phone': '081234567001'},
            {'username': 'demo_wali2', 'role': 'walisantri', 'name': 'Ibu Siti Fatimah', 'phone': '081234567002'},
            {'username': 'demo_wali3', 'role': 'walisantri', 'name': 'Bpk. Muhammad Ridwan', 'phone': '081234567003'},
            # Guru accounts
            {'username': 'demo_guru1', 'role': 'guru', 'name': 'Ust. Abdul Rahman', 'kelas': '10-A', 'mata_pelajaran': 'Bahasa Arab'},
            {'username': 'demo_guru2', 'role': 'guru', 'name': 'Ust. Hasan Basri', 'kelas': '10-B', 'mata_pelajaran': 'Fiqih'},
            # Bendahara
            {'username': 'demo_bendahara', 'role': 'bendahara', 'name': 'Ibu Aminah', 'phone': '081234567100'},
            # Pimpinan
            {'username': 'demo_pimpinan', 'role': 'pimpinan', 'name': 'KH. Abdullah Gymnastiar', 'phone': '081234567200'},
        ]

        for data in user_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'role': data['role'],
                    'name': data['name'],
                    'phone': data.get('phone', ''),
                    'kelas': data.get('kelas', ''),
                    'mata_pelajaran': data.get('mata_pelajaran', ''),
                    'is_active': True
                }
            )
            if created:
                user.set_password('password123')
                user.save()
                self.stdout.write(f'   + Created user: {data["username"]} ({data["role"]})')
            else:
                self.stdout.write(f'   = Existing user: {data["username"]}')
            users[data['username']] = user

        return users

    def create_students(self, minimal=False):
        """Create demo students"""
        from apps.students.models import Student

        students = []
        student_data = [
            # Kelas 10-A
            {'nisn': '20260001', 'nama': 'Ahmad Rizki Pratama', 'kelas': '10-A', 'program': 'Reguler'},
            {'nisn': '20260002', 'nama': 'Fatimah Azzahra', 'kelas': '10-A', 'program': 'Reguler'},
            {'nisn': '20260003', 'nama': 'Muhammad Hafiz', 'kelas': '10-A', 'program': 'Tahfidz'},
            # Kelas 10-B
            {'nisn': '20260004', 'nama': 'Aisyah Putri', 'kelas': '10-B', 'program': 'Reguler'},
            {'nisn': '20260005', 'nama': 'Umar Faruq', 'kelas': '10-B', 'program': 'Tahfidz'},
        ]

        if not minimal:
            # Add more students
            student_data.extend([
                {'nisn': '20260006', 'nama': 'Khadijah Nur', 'kelas': '10-A', 'program': 'Reguler'},
                {'nisn': '20260007', 'nama': 'Ali Imran', 'kelas': '10-B', 'program': 'Tahfidz'},
                {'nisn': '20260008', 'nama': 'Zainab Safira', 'kelas': '11-A', 'program': 'Reguler'},
                {'nisn': '20260009', 'nama': 'Bilal Ahmad', 'kelas': '11-A', 'program': 'Tahfidz'},
                {'nisn': '20260010', 'nama': 'Maryam Husna', 'kelas': '11-B', 'program': 'Reguler'},
            ])

        for data in student_data:
            student, created = Student.objects.get_or_create(
                nisn=data['nisn'],
                defaults={
                    'nama': data['nama'],
                    'kelas': data['kelas'],
                    'program': data['program'],
                    'aktif': True,
                    'wali_nama': f"Wali {data['nama'].split()[0]}",
                    'wali_phone': f"08123456{data['nisn'][-4:]}",
                    'target_hafalan': 30 if data['program'] == 'Tahfidz' else 5,
                    'current_hafalan': random.randint(0, 10),
                }
            )
            students.append(student)
            status = 'Created' if created else 'Existing'
            self.stdout.write(f'   {"+" if created else "="} {status}: {data["nama"]} ({data["kelas"]})')

        return students

    def link_walisantri(self, users, students):
        """Link walisantri accounts to students"""
        from apps.accounts.models import User

        links = [
            ('demo_wali1', '20260001'),
            ('demo_wali2', '20260002'),
            ('demo_wali3', '20260003'),
        ]

        for username, nisn in links:
            if username in users:
                user = users[username]
                user.linked_student_nisn = nisn
                user.save()
                self.stdout.write(f'   + Linked {username} -> {nisn}')

    def create_tarif(self):
        """Create pricing master data"""
        from apps.finance.models import Tarif

        tarif_list = []
        tarif_data = [
            {'nama': 'SPP Reguler', 'kategori': 'spp', 'frekuensi': 'bulanan', 'nominal': Decimal('500000')},
            {'nama': 'SPP Tahfidz', 'kategori': 'spp', 'frekuensi': 'bulanan', 'nominal': Decimal('650000')},
            {'nama': 'Uang Gedung', 'kategori': 'gedung', 'frekuensi': 'tahunan', 'nominal': Decimal('2500000')},
            {'nama': 'Seragam Lengkap', 'kategori': 'seragam', 'frekuensi': 'sekali', 'nominal': Decimal('1200000')},
            {'nama': 'Buku Paket', 'kategori': 'buku', 'frekuensi': 'tahunan', 'nominal': Decimal('750000')},
            {'nama': 'Kegiatan PHBI', 'kategori': 'kegiatan', 'frekuensi': 'tahunan', 'nominal': Decimal('200000')},
        ]

        for data in tarif_data:
            tarif, created = Tarif.objects.get_or_create(
                nama=data['nama'],
                tahun_ajaran='2025/2026',
                defaults={
                    'kategori': data['kategori'],
                    'frekuensi': data['frekuensi'],
                    'nominal': data['nominal'],
                    'aktif': True,
                    'created_by': 'seed_dummy_data'
                }
            )
            tarif_list.append(tarif)
            status = 'Created' if created else 'Existing'
            self.stdout.write(f'   {"+" if created else "="} {status}: {data["nama"]} - Rp {data["nominal"]:,.0f}')

        return tarif_list

    def create_tagihan(self, students, tarif_list):
        """Create invoices with various statuses"""
        from apps.finance.models import Tagihan

        tagihan_list = []
        spp_tarif = next((t for t in tarif_list if 'SPP' in t.nama), tarif_list[0])

        # Create SPP for Jan-Mar 2026
        for student in students:
            # Determine tarif based on program
            if student.program == 'Tahfidz':
                tarif = next((t for t in tarif_list if 'Tahfidz' in t.nama), spp_tarif)
            else:
                tarif = next((t for t in tarif_list if 'Reguler' in t.nama), spp_tarif)

            for bulan in [1, 2, 3]:  # Jan, Feb, Mar
                # Vary status based on NISN and month
                nisn_num = int(student.nisn[-1])

                if bulan == 3:  # March - mix of statuses
                    if nisn_num <= 3:
                        status = 'lunas'
                        terbayar = tarif.nominal
                    elif nisn_num <= 6:
                        status = 'sebagian'
                        terbayar = tarif.nominal * Decimal('0.5')
                    else:
                        status = 'belum_bayar'
                        terbayar = Decimal('0')
                elif bulan == 2:  # February - mostly paid
                    if nisn_num <= 7:
                        status = 'lunas'
                        terbayar = tarif.nominal
                    else:
                        status = 'sebagian'
                        terbayar = tarif.nominal * Decimal('0.6')
                else:  # January - all paid
                    status = 'lunas'
                    terbayar = tarif.nominal

                invoice_no = f"INV-2026{bulan:02d}-SPP-{student.nisn[-4:]}-{bulan:02d}{nisn_num:02d}"

                tagihan, created = Tagihan.objects.get_or_create(
                    siswa=student,
                    tarif=tarif,
                    bulan=bulan,
                    tahun=2026,
                    defaults={
                        'no_invoice': invoice_no,
                        'nominal': tarif.nominal,
                        'diskon': Decimal('0'),
                        'denda': Decimal('0'),
                        'total': tarif.nominal,
                        'terbayar': terbayar,
                        'sisa': tarif.nominal - terbayar,
                        'status': status,
                        'jatuh_tempo': datetime.date(2026, bulan, 10),
                        'created_by': 'seed_dummy_data'
                    }
                )
                tagihan_list.append(tagihan)

        self.stdout.write(f'   + Created {len(tagihan_list)} tagihan records')
        return tagihan_list

    def create_pembayaran(self, tagihan_list):
        """Create payment records for tagihan"""
        from apps.finance.models import Pembayaran

        payment_count = 0

        for tagihan in tagihan_list:
            if tagihan.terbayar > 0:
                # Check if payment already exists
                if not Pembayaran.objects.filter(tagihan=tagihan).exists():
                    Pembayaran.objects.create(
                        tagihan=tagihan,
                        tanggal=timezone.now() - datetime.timedelta(days=random.randint(1, 30)),
                        nominal=tagihan.terbayar,
                        metode=random.choice(['transfer', 'tunai', 'qris']),
                        terverifikasi=tagihan.status == 'lunas',
                        verified_by='demo_bendahara' if tagihan.status == 'lunas' else None,
                        tanggal_verifikasi=timezone.now() if tagihan.status == 'lunas' else None,
                        created_by='seed_dummy_data',
                        keterangan='Auto-generated payment'
                    )
                    payment_count += 1

        self.stdout.write(f'   + Created {payment_count} pembayaran records')

    def create_grades(self, students, minimal=False):
        """Create grade records"""
        from apps.grades.models import Grade

        subjects = ['Bahasa Arab', 'Fiqih', 'Aqidah', 'Tahfidz', 'Bahasa Indonesia', 'Matematika']
        grade_types = ['UH', 'UTS', 'UAS', 'Tugas']
        grade_count = 0

        for student in students:
            # Create grades for each subject
            selected_subjects = subjects[:3] if minimal else subjects

            for subject in selected_subjects:
                for grade_type in (grade_types[:2] if minimal else grade_types):
                    # Generate realistic score
                    base_score = random.randint(65, 95)
                    score = min(100, base_score + random.randint(-5, 10))

                    grade, created = Grade.objects.get_or_create(
                        nisn=student,
                        mata_pelajaran=subject,
                        jenis=grade_type,
                        semester='Ganjil',
                        tahun_ajaran='2025/2026',
                        defaults={
                            'nilai': score,
                            'kelas': student.kelas,
                            'guru': f'Guru {subject}'
                        }
                    )
                    if created:
                        grade_count += 1

        self.stdout.write(f'   + Created {grade_count} grade records')

    def create_attendance(self, students, minimal=False):
        """Create attendance records"""
        from apps.attendance.models import Attendance

        # Create attendance for past week
        days = 3 if minimal else 7
        today = timezone.now().date()
        attendance_count = 0

        for student in students:
            for day_offset in range(1, days + 1):
                date = today - datetime.timedelta(days=day_offset)

                # Skip weekends
                if date.weekday() >= 5:
                    continue

                # Create attendance for JP 1-4
                for jam_ke in range(1, 5):
                    # 90% hadir, 5% sakit, 3% izin, 2% alpha
                    rand = random.random()
                    if rand < 0.90:
                        status = 'Hadir'
                        keterangan = None
                    elif rand < 0.95:
                        status = 'Sakit'
                        keterangan = 'Demam'
                    elif rand < 0.98:
                        status = 'Izin'
                        keterangan = 'Keperluan keluarga'
                    else:
                        status = 'Alpha'
                        keterangan = None

                    _, created = Attendance.objects.get_or_create(
                        nisn=student,
                        tanggal=date,
                        jam_ke=jam_ke,
                        defaults={
                            'mata_pelajaran': f'Mapel JP{jam_ke}',
                            'status': status,
                            'keterangan': keterangan
                        }
                    )
                    if created:
                        attendance_count += 1

        self.stdout.write(f'   + Created {attendance_count} attendance records')

    def create_evaluations(self, students):
        """Create evaluation records (achievements and violations)"""
        from apps.evaluations.models import Evaluation

        eval_count = 0
        today = timezone.now().date()

        # Sample evaluations
        prestasi_data = [
            {'kategori': 'hafalan', 'name': 'Hafal Juz 30', 'summary': 'Berhasil menghafal Juz 30 dengan baik'},
            {'kategori': 'akademik', 'name': 'Juara Kelas', 'summary': 'Meraih peringkat 1 di kelas'},
            {'kategori': 'adab', 'name': 'Akhlak Terpuji', 'summary': 'Menunjukkan akhlak yang baik terhadap guru dan teman'},
        ]

        pelanggaran_data = [
            {'kategori': 'kedisiplinan', 'name': 'Terlambat', 'summary': 'Terlambat masuk kelas'},
            {'kategori': 'kebersihan', 'name': 'Kamar Tidak Rapi', 'summary': 'Kondisi kamar tidak rapi saat inspeksi'},
        ]

        for i, student in enumerate(students):
            # Give some students achievements
            if i % 2 == 0:
                data = random.choice(prestasi_data)
                _, created = Evaluation.objects.get_or_create(
                    nisn=student,
                    jenis='prestasi',
                    name=data['name'],
                    defaults={
                        'tanggal': today - datetime.timedelta(days=random.randint(1, 30)),
                        'kategori': data['kategori'],
                        'evaluator': 'demo_guru1',
                        'summary': data['summary'],
                        'catatan': f'Evaluasi untuk {student.nama}'
                    }
                )
                if created:
                    eval_count += 1

            # Give some students violations
            if i % 3 == 0:
                data = random.choice(pelanggaran_data)
                _, created = Evaluation.objects.get_or_create(
                    nisn=student,
                    jenis='pelanggaran',
                    name=data['name'],
                    defaults={
                        'tanggal': today - datetime.timedelta(days=random.randint(1, 14)),
                        'kategori': data['kategori'],
                        'evaluator': 'demo_guru2',
                        'summary': data['summary'],
                        'catatan': f'Perlu pembinaan untuk {student.nama}'
                    }
                )
                if created:
                    eval_count += 1

        self.stdout.write(f'   + Created {eval_count} evaluation records')

    def print_summary(self):
        """Print summary of created data"""
        from apps.accounts.models import User
        from apps.students.models import Student
        from apps.finance.models import Tarif, Tagihan, Pembayaran
        from apps.attendance.models import Attendance
        from apps.grades.models import Grade
        from apps.evaluations.models import Evaluation

        self.stdout.write('\n--- DATA SUMMARY ---')
        self.stdout.write(f'Users (demo_*): {User.objects.filter(username__startswith="demo_").count()}')
        self.stdout.write(f'Students (2026*): {Student.objects.filter(nisn__startswith="2026").count()}')
        self.stdout.write(f'Tarif: {Tarif.objects.filter(tahun_ajaran="2025/2026").count()}')
        self.stdout.write(f'Tagihan: {Tagihan.objects.filter(siswa__nisn__startswith="2026").count()}')
        self.stdout.write(f'Pembayaran: {Pembayaran.objects.filter(tagihan__siswa__nisn__startswith="2026").count()}')
        self.stdout.write(f'Grades: {Grade.objects.filter(nisn__nisn__startswith="2026").count()}')
        self.stdout.write(f'Attendance: {Attendance.objects.filter(nisn__nisn__startswith="2026").count()}')
        self.stdout.write(f'Evaluations: {Evaluation.objects.filter(nisn__nisn__startswith="2026").count()}')

        self.stdout.write('\n--- LOGIN CREDENTIALS ---')
        self.stdout.write('Walisantri: demo_wali1 / password123')
        self.stdout.write('Guru: demo_guru1 / password123')
        self.stdout.write('Bendahara: demo_bendahara / password123')
        self.stdout.write('Pimpinan: demo_pimpinan / password123')
