"""
Management command to seed MasterJam data.

Usage:
    python manage.py seed_master_jam
    python manage.py seed_master_jam --clear  # Clear existing data first
"""

from django.core.management.base import BaseCommand
from datetime import time
from apps.core.models import MasterJam


class Command(BaseCommand):
    help = 'Seed MasterJam data for Tahfidz, KBM, and Diniyah sessions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing MasterJam data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted_count = MasterJam.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} existing MasterJam records'))

        # Data to seed
        master_jam_data = [
            # Tahfidz (pagi)
            {'sesi': 'tahfidz', 'jam_ke': 1, 'jam_mulai': time(4, 30), 'jam_selesai': time(5, 45), 'keterangan': 'Tahfidz Pagi'},

            # KBM (Kegiatan Belajar Mengajar)
            {'sesi': 'kbm', 'jam_ke': 1, 'jam_mulai': time(7, 0), 'jam_selesai': time(7, 45), 'keterangan': ''},
            {'sesi': 'kbm', 'jam_ke': 2, 'jam_mulai': time(7, 45), 'jam_selesai': time(8, 30), 'keterangan': ''},
            {'sesi': 'kbm', 'jam_ke': 3, 'jam_mulai': time(8, 30), 'jam_selesai': time(9, 15), 'keterangan': ''},
            {'sesi': 'kbm', 'jam_ke': 4, 'jam_mulai': time(9, 15), 'jam_selesai': time(10, 0), 'keterangan': ''},
            {'sesi': 'kbm', 'jam_ke': 5, 'jam_mulai': time(10, 30), 'jam_selesai': time(11, 15), 'keterangan': 'Setelah istirahat'},
            {'sesi': 'kbm', 'jam_ke': 6, 'jam_mulai': time(11, 15), 'jam_selesai': time(12, 0), 'keterangan': ''},

            # Diniyah (sore)
            {'sesi': 'diniyah', 'jam_ke': 1, 'jam_mulai': time(14, 0), 'jam_selesai': time(15, 0), 'keterangan': 'Diniyah Sore 1'},
            {'sesi': 'diniyah', 'jam_ke': 2, 'jam_mulai': time(16, 0), 'jam_selesai': time(17, 0), 'keterangan': 'Diniyah Sore 2'},
        ]

        created_count = 0
        updated_count = 0

        for data in master_jam_data:
            obj, created = MasterJam.objects.update_or_create(
                sesi=data['sesi'],
                jam_ke=data['jam_ke'],
                defaults={
                    'jam_mulai': data['jam_mulai'],
                    'jam_selesai': data['jam_selesai'],
                    'keterangan': data['keterangan'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Successfully seeded MasterJam: {created_count} created, {updated_count} updated'
        ))

        # Display summary
        self.stdout.write('\nMasterJam Summary:')
        for sesi in ['tahfidz', 'kbm', 'diniyah']:
            count = MasterJam.objects.filter(sesi=sesi).count()
            self.stdout.write(f'  - {sesi.upper()}: {count} jam')
