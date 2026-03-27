"""
Seed Script: Demo Incidents for Testing
========================================
Run: python manage.py shell < seed_incidents_demo.py
Or:  python seed_incidents_demo.py (with Django setup)

Creates sample incidents for testing the Catatan & Bimbingan module.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.utils import timezone
from datetime import timedelta
from apps.kesantrian.models import Incident, IncidentComment
from apps.students.models import Student
from apps.accounts.models import User

def create_demo_incidents():
    """Create demo incidents for testing"""

    print("=" * 60)
    print("SEED INCIDENTS DEMO")
    print("=" * 60)

    # Find test students
    test_nisns = ['0012345678', '0012345634']
    students = Student.objects.filter(nisn__in=test_nisns)

    if not students.exists():
        print("\n[WARNING] Test students not found. Looking for any student...")
        students = Student.objects.all()[:3]

    if not students.exists():
        print("[ERROR] No students in database! Please seed students first.")
        return

    print(f"\nFound {students.count()} student(s) for testing:")
    for s in students:
        print(f"  - {s.nama} (NISN: {s.nisn}, Kelas: {s.kelas})")

    # Find a user to be the pelapor (reporter)
    pelapor = User.objects.filter(role__in=['guru', 'musyrif', 'superadmin']).first()
    if not pelapor:
        pelapor = User.objects.first()

    if not pelapor:
        print("[ERROR] No users in database! Please create a user first.")
        return

    print(f"\nUsing pelapor: {pelapor.username} ({pelapor.role})")

    # Demo incidents data
    demo_incidents = [
        {
            'judul': 'Terlambat Masuk Kelas',
            'deskripsi': 'Santri terlambat masuk kelas lebih dari 15 menit tanpa keterangan yang jelas. Ini sudah terjadi 3 kali dalam minggu ini.',
            'kategori': 'kedisiplinan',
            'tingkat': 'ringan',
            'status': 'open',
            'lokasi': 'Ruang Kelas XI A',
        },
        {
            'judul': 'Tidak Mengikuti Sholat Berjamaah',
            'deskripsi': 'Santri tidak hadir pada sholat Dzuhur berjamaah. Saat dicari, santri ditemukan tidur di kamar asrama.',
            'kategori': 'kedisiplinan',
            'tingkat': 'sedang',
            'status': 'in_discussion',
            'lokasi': 'Masjid Pesantren',
        },
        {
            'judul': 'Prestasi Lomba Tahfidz',
            'deskripsi': 'Santri meraih juara 2 dalam lomba tahfidz tingkat kabupaten. Hafalan yang dilombakan adalah Juz 30.',
            'kategori': 'akademik',
            'tingkat': 'ringan',
            'status': 'resolved',
            'lokasi': 'Aula Kabupaten',
        },
        {
            'judul': 'Perkelahian Antar Santri',
            'deskripsi': 'Terjadi perselisihan yang berujung perkelahian antara santri dengan teman sekamarnya. Perlu mediasi dan pembinaan.',
            'kategori': 'sosial',
            'tingkat': 'berat',
            'status': 'open',
            'lokasi': 'Asrama Putra Lantai 2',
        },
        {
            'judul': 'Membawa HP ke Asrama',
            'deskripsi': 'Ditemukan HP di dalam tas santri saat razia kamar. HP diamankan oleh musyrif untuk ditindaklanjuti.',
            'kategori': 'kedisiplinan',
            'tingkat': 'sedang',
            'status': 'in_discussion',
            'lokasi': 'Kamar 12 Asrama Putra',
        },
    ]

    created_count = 0
    today = timezone.now().date()

    for i, incident_data in enumerate(demo_incidents):
        # Cycle through available students
        student = students[i % students.count()]

        # Check if similar incident exists
        existing = Incident.objects.filter(
            siswa=student,
            judul=incident_data['judul']
        ).first()

        if existing:
            print(f"\n[SKIP] '{incident_data['judul']}' already exists for {student.nama}")
            continue

        # Create incident
        incident = Incident.objects.create(
            siswa=student,
            judul=incident_data['judul'],
            deskripsi=incident_data['deskripsi'],
            kategori=incident_data['kategori'],
            tingkat=incident_data['tingkat'],
            status=incident_data['status'],
            lokasi=incident_data['lokasi'],
            tanggal_kejadian=today - timedelta(days=i),
            pelapor=pelapor,
            pelapor_role=pelapor.role,
            tahun_ajaran='2025/2026',
            semester='Genap',
        )

        created_count += 1
        print(f"\n[CREATED] Incident #{incident.id}: {incident.judul}")
        print(f"          Siswa: {student.nama}")
        print(f"          Status: {incident.status}")
        print(f"          Kategori: {incident.kategori}")

        # Add sample comments for some incidents
        if incident.status == 'in_discussion':
            IncidentComment.objects.create(
                incident=incident,
                content='Sudah dilakukan pemanggilan santri dan wawancara awal.',
                comment_type='observation',
                author=pelapor,
                author_role=pelapor.role,
                author_role_display='Guru/Ustadz',
                visibility='public'
            )
            print(f"          + Added comment (public)")

            IncidentComment.objects.create(
                incident=incident,
                content='[Internal] Perlu koordinasi dengan wali kelas sebelum memanggil orang tua.',
                comment_type='note',
                author=pelapor,
                author_role=pelapor.role,
                author_role_display='Guru/Ustadz',
                visibility='internal'
            )
            print(f"          + Added comment (internal)")

        elif incident.status == 'resolved':
            incident.keputusan_final = 'Santri diberikan apresiasi dan sertifikat penghargaan dari pesantren.'
            incident.diputuskan_oleh = pelapor
            incident.tanggal_keputusan = timezone.now()
            incident.save()

            IncidentComment.objects.create(
                incident=incident,
                content='Selamat atas prestasinya! Semoga bisa mempertahankan dan meningkatkan di lomba berikutnya.',
                comment_type='decision',
                author=pelapor,
                author_role=pelapor.role,
                author_role_display='Pimpinan/Mudir',
                visibility='final_decision'
            )
            print(f"          + Added final decision comment")

    # Summary
    total_incidents = Incident.objects.count()
    total_comments = IncidentComment.objects.count()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Created {created_count} new incident(s)")
    print(f"Total incidents in DB: {total_incidents}")
    print(f"Total comments in DB: {total_comments}")

    # Show incidents by status
    print("\nIncidents by Status:")
    for status in ['open', 'in_discussion', 'resolved', 'closed']:
        count = Incident.objects.filter(status=status).count()
        if count > 0:
            print(f"  - {status}: {count}")

    print("\n" + "=" * 60)
    print("DONE! You can now test the Catatan & Bimbingan page.")
    print("=" * 60)


if __name__ == '__main__':
    create_demo_incidents()
