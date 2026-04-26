"""
Management command to seed MasterMapel data.

Usage:
    python manage.py seed_master_mapel
    python manage.py seed_master_mapel --clear  # Clear existing data first
"""

from django.core.management.base import BaseCommand
from apps.core.models import MasterMapel


class Command(BaseCommand):
    help = 'Seed MasterMapel data for KBM, Diniyah, and Tahfidz'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing MasterMapel data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted_count = MasterMapel.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} existing MasterMapel records'))

        # Data to seed
        mapel_data = [
            # KBM (Formal)
            {'nama': 'Matematika', 'kode': 'MTK', 'sesi': 'kbm'},
            {'nama': 'Fisika', 'kode': 'FIS', 'sesi': 'kbm'},
            {'nama': 'Biologi', 'kode': 'BIO', 'sesi': 'kbm'},
            {'nama': 'Kimia', 'kode': 'KIM', 'sesi': 'kbm'},
            {'nama': 'Bahasa Inggris', 'kode': 'BIG', 'sesi': 'kbm'},
            {'nama': 'Bahasa Indonesia', 'kode': 'BIN', 'sesi': 'kbm'},
            {'nama': 'IPS', 'kode': 'IPS', 'sesi': 'kbm'},
            {'nama': 'PKN', 'kode': 'PKN', 'sesi': 'kbm'},
            {'nama': 'PJOK', 'kode': 'PJK', 'sesi': 'kbm'},
            {'nama': 'Seni Budaya', 'kode': 'SBD', 'sesi': 'kbm'},
            {'nama': 'TIK', 'kode': 'TIK', 'sesi': 'kbm'},
            {'nama': 'PKWU', 'kode': 'PKW', 'sesi': 'kbm'},
            {'nama': 'Bahasa Jawa', 'kode': 'BJW', 'sesi': 'kbm'},
            {'nama': 'Ekonomi', 'kode': 'EKO', 'sesi': 'kbm'},
            {'nama': 'Sejarah', 'kode': 'SEJ', 'sesi': 'kbm'},
            {'nama': 'BK', 'kode': 'BK', 'sesi': 'kbm'},
            {'nama': 'Matematika Peminatan', 'kode': 'MTP', 'sesi': 'kbm'},
            {'nama': 'Biologi Peminatan', 'kode': 'BIP', 'sesi': 'kbm'},

            # Diniyah
            {'nama': 'Hadits', 'kode': 'HDT', 'sesi': 'diniyah'},
            {'nama': 'Aqidah', 'kode': 'AQD', 'sesi': 'diniyah'},
            {'nama': 'Fiqih', 'kode': 'FQH', 'sesi': 'diniyah'},
            {'nama': 'Bahasa Arab', 'kode': 'BAR', 'sesi': 'diniyah'},
            {'nama': 'Taklim', 'kode': 'TKL', 'sesi': 'diniyah'},
            {'nama': 'Tahsin', 'kode': 'TSN', 'sesi': 'diniyah'},
            {'nama': 'Fiqih Praktis', 'kode': 'FQP', 'sesi': 'diniyah'},
            {'nama': 'Kajian Siroh Nabawi', 'kode': 'KSN', 'sesi': 'diniyah'},

            # Tahfidz
            {'nama': 'Al-Quran', 'kode': 'QRN', 'sesi': 'tahfidz'},
        ]

        created_count = 0
        updated_count = 0

        for data in mapel_data:
            obj, created = MasterMapel.objects.update_or_create(
                nama=data['nama'],
                sesi=data['sesi'],
                defaults={
                    'kode': data['kode'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Successfully seeded MasterMapel: {created_count} created, {updated_count} updated'
        ))

        # Display summary
        self.stdout.write('\nMasterMapel Summary:')
        for sesi_code, sesi_label in MasterMapel.SESI_CHOICES:
            count = MasterMapel.objects.filter(sesi=sesi_code, is_active=True).count()
            self.stdout.write(f'  - {sesi_label}: {count} mapel')
