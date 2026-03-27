"""
Script untuk memasukkan data evaluasi dummy ke database.
Mendistribusikan 100 evaluasi ke berbagai kategori dan jenis.

Usage:
    cd backend_django
    python manage.py shell < insert_dummy_evaluations.py

    OR

    python insert_dummy_evaluations.py
"""

import os
import sys
import django
import random
from datetime import datetime, timedelta

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.students.models import Student
from apps.evaluations.models import Evaluation

# Data template untuk evaluasi
EVALUASI_TEMPLATES = {
    'adab': {
        'prestasi': [
            ('Sopan Santun Terbaik', 'Menunjukkan sikap sopan santun yang sangat baik kepada guru dan teman'),
            ('Menghormati Guru', 'Selalu menyapa dan memberi salam kepada guru dengan baik'),
            ('Berbicara Sopan', 'Menggunakan bahasa yang sopan dan santun dalam berkomunikasi'),
            ('Toleransi Tinggi', 'Menunjukkan sikap toleransi yang tinggi terhadap perbedaan'),
        ],
        'pelanggaran': [
            ('Berbicara Kasar', 'Menggunakan kata-kata kasar kepada teman'),
            ('Tidak Sopan', 'Bersikap tidak sopan kepada guru saat pembelajaran'),
            ('Mengejek Teman', 'Mengejek teman dengan sebutan yang tidak pantas'),
        ]
    },
    'kedisiplinan': {
        'prestasi': [
            ('Tepat Waktu', 'Selalu hadir tepat waktu selama sebulan penuh'),
            ('Atribut Lengkap', 'Memakai seragam dengan atribut lengkap setiap hari'),
            ('Mengikuti Aturan', 'Selalu patuh terhadap peraturan pondok'),
            ('Disiplin Belajar', 'Menunjukkan kedisiplinan tinggi dalam mengikuti jadwal belajar'),
        ],
        'pelanggaran': [
            ('Terlambat Masuk', 'Terlambat masuk ke kelas tanpa alasan yang jelas'),
            ('Bolos Kelas', 'Tidak mengikuti pembelajaran tanpa izin'),
            ('Seragam Tidak Lengkap', 'Tidak memakai seragam sesuai ketentuan'),
            ('Melanggar Jam Malam', 'Keluar asrama melewati jam malam'),
        ]
    },
    'akademik': {
        'prestasi': [
            ('Juara Kelas', 'Meraih peringkat pertama di kelas'),
            ('Nilai Sempurna', 'Mendapat nilai sempurna pada ujian matematika'),
            ('Aktif Bertanya', 'Aktif bertanya dan berpartisipasi dalam diskusi kelas'),
            ('Membantu Teman Belajar', 'Membantu teman yang kesulitan memahami pelajaran'),
            ('Lomba Sains', 'Mewakili sekolah dalam lomba sains tingkat kabupaten'),
        ],
        'pelanggaran': [
            ('Tidak Mengerjakan PR', 'Tidak mengumpulkan tugas rumah yang diberikan'),
            ('Mencontek', 'Tertangkap mencontek saat ujian'),
            ('Tidur di Kelas', 'Tertidur saat pembelajaran berlangsung'),
        ]
    },
    'kebersihan': {
        'prestasi': [
            ('Kamar Terbersih', 'Kamar dinobatkan sebagai kamar terbersih minggu ini'),
            ('Rajin Piket', 'Selalu melaksanakan tugas piket dengan baik'),
            ('Menjaga Kebersihan', 'Konsisten menjaga kebersihan lingkungan pondok'),
            ('Inisiatif Bersih', 'Berinisiatif membersihkan area umum tanpa diminta'),
        ],
        'pelanggaran': [
            ('Kamar Kotor', 'Kamar dalam kondisi tidak bersih saat inspeksi'),
            ('Membuang Sampah Sembarangan', 'Membuang sampah tidak pada tempatnya'),
            ('Tidak Piket', 'Tidak melaksanakan tugas piket yang dijadwalkan'),
        ]
    },
    'hafalan': {
        'prestasi': [
            ('Hafal Juz Baru', 'Berhasil menyelesaikan hafalan 1 juz Al-Quran'),
            ('Muroja\'ah Lancar', 'Muroja\'ah hafalan dengan lancar tanpa kesalahan'),
            ('Target Tercapai', 'Mencapai target hafalan bulanan lebih awal'),
            ('Tajwid Baik', 'Menunjukkan penguasaan tajwid yang sangat baik'),
            ('Hafal Hadits', 'Menghafal 10 hadits arbain dengan baik'),
        ],
        'pelanggaran': [
            ('Hafalan Tertinggal', 'Tidak mencapai target hafalan yang ditentukan'),
            ('Lupa Hafalan', 'Banyak hafalan yang sudah lupa saat muroja\'ah'),
        ]
    },
    'sosial': {
        'prestasi': [
            ('Suka Menolong', 'Selalu siap membantu teman yang membutuhkan'),
            ('Pemimpin Baik', 'Mampu memimpin kelompok dengan baik'),
            ('Kerja Sama', 'Menunjukkan kemampuan kerja sama tim yang excellent'),
            ('Menyelesaikan Konflik', 'Membantu menyelesaikan konflik antar teman'),
            ('Bakti Sosial', 'Aktif berpartisipasi dalam kegiatan bakti sosial'),
        ],
        'pelanggaran': [
            ('Berkelahi', 'Terlibat perkelahian dengan teman'),
            ('Mengucilkan Teman', 'Mengucilkan teman dari kelompok'),
            ('Tidak Mau Kerja Sama', 'Menolak bekerja sama dalam kegiatan kelompok'),
        ]
    }
}

EVALUATOR_NAMES = [
    'Ustadz Ahmad',
    'Ustadzah Fatimah',
    'Ustadz Muhammad',
    'Ustadzah Aisyah',
    'Ustadz Ibrahim',
    'Ustadzah Khadijah',
]

def generate_random_date(start_days_ago=180, end_days_ago=1):
    """Generate random date between start_days_ago and end_days_ago"""
    start_date = datetime.now() - timedelta(days=start_days_ago)
    end_date = datetime.now() - timedelta(days=end_days_ago)
    time_between = end_date - start_date
    days_between = time_between.days
    random_days = random.randrange(days_between)
    return start_date + timedelta(days=random_days)


def insert_dummy_evaluations(count=100):
    """Insert dummy evaluation data"""

    # Get all students
    students = list(Student.objects.all())
    if not students:
        print("Error: Tidak ada data siswa. Pastikan tabel students sudah terisi.")
        return

    print(f"Found {len(students)} students")

    # Distribution weights for categories (to make data more realistic)
    kategori_weights = {
        'adab': 0.18,
        'kedisiplinan': 0.22,
        'akademik': 0.20,
        'kebersihan': 0.15,
        'hafalan': 0.15,
        'sosial': 0.10,
    }

    # Distribution weights for jenis (60% prestasi, 40% pelanggaran)
    jenis_weights = {
        'prestasi': 0.60,
        'pelanggaran': 0.40,
    }

    created_count = 0
    categories = list(EVALUASI_TEMPLATES.keys())

    print(f"\nInserting {count} dummy evaluations...")

    for i in range(count):
        # Select random student
        student = random.choice(students)

        # Select category based on weights
        kategori = random.choices(
            categories,
            weights=[kategori_weights[k] for k in categories]
        )[0]

        # Select jenis based on weights
        jenis = random.choices(
            ['prestasi', 'pelanggaran'],
            weights=[jenis_weights['prestasi'], jenis_weights['pelanggaran']]
        )[0]

        # Get template for this category and jenis
        templates = EVALUASI_TEMPLATES[kategori][jenis]
        name, summary = random.choice(templates)

        # Random evaluator
        evaluator = random.choice(EVALUATOR_NAMES)

        # Random date within last 6 months
        tanggal = generate_random_date()

        # Optional catatan (30% chance)
        catatan = None
        if random.random() < 0.3:
            catatan_templates = [
                "Perlu perhatian lebih lanjut.",
                "Sudah dinasehati oleh wali kelas.",
                "Orang tua sudah dihubungi.",
                "Akan dimonitoring perkembangannya.",
                "Patut diapresiasi.",
                "Bisa menjadi contoh bagi teman-temannya.",
                "Terus pertahankan.",
            ]
            catatan = random.choice(catatan_templates)

        try:
            evaluation = Evaluation.objects.create(
                nisn=student,
                tanggal=tanggal.date(),
                jenis=jenis,
                kategori=kategori,
                evaluator=evaluator,
                name=name,
                summary=summary,
                catatan=catatan,
            )
            created_count += 1

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/{count} evaluations created...")

        except Exception as e:
            print(f"  Error creating evaluation {i + 1}: {e}")

    print(f"\n[OK] Successfully created {created_count} dummy evaluations!")

    # Print distribution summary
    print("\n[STATS] Distribution Summary:")
    print("-" * 40)

    total = Evaluation.objects.count()
    print(f"Total evaluations in database: {total}")

    print("\nBy Kategori:")
    for kategori in categories:
        count_kat = Evaluation.objects.filter(kategori=kategori).count()
        pct = (count_kat / total * 100) if total > 0 else 0
        print(f"  {kategori.capitalize():15} : {count_kat:4} ({pct:.1f}%)")

    print("\nBy Jenis:")
    for jenis in ['prestasi', 'pelanggaran']:
        count_jenis = Evaluation.objects.filter(jenis=jenis).count()
        pct = (count_jenis / total * 100) if total > 0 else 0
        print(f"  {jenis.capitalize():15} : {count_jenis:4} ({pct:.1f}%)")

    print("\nBy Kategori & Jenis:")
    for kategori in categories:
        prestasi = Evaluation.objects.filter(kategori=kategori, jenis='prestasi').count()
        pelanggaran = Evaluation.objects.filter(kategori=kategori, jenis='pelanggaran').count()
        print(f"  {kategori.capitalize():15} : Prestasi={prestasi:3}, Pelanggaran={pelanggaran:3}")


if __name__ == '__main__':
    print("=" * 50)
    print("  DUMMY EVALUATION DATA INSERTION SCRIPT")
    print("=" * 50)

    # Check if we should clear existing data
    existing_count = Evaluation.objects.count()
    if existing_count > 0:
        print(f"\n[WARNING] There are already {existing_count} evaluations in the database.")
        response = input("Do you want to continue adding more? (y/n): ").strip().lower()
        if response != 'y':
            print("Aborted.")
            sys.exit(0)

    insert_dummy_evaluations(100)

    print("\n" + "=" * 50)
    print("  DONE!")
    print("=" * 50)
