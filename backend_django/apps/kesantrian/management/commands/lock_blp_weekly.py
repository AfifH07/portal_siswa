"""
Management Command: Lock BLP Weekly
====================================

Mengunci semua BLP entries yang periode-nya sudah berakhir.

Penggunaan:
    python manage.py lock_blp_weekly

Jadwal (cron):
    # Jalankan setiap Sabtu jam 23:59
    59 23 * * 6 cd /path/to/project && python manage.py lock_blp_weekly

    # Atau menggunakan django-crontab
    CRONJOBS = [
        ('59 23 * * 6', 'apps.kesantrian.management.commands.lock_blp_weekly.lock_entries')
    ]
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.kesantrian.models import BLPEntry


class Command(BaseCommand):
    help = 'Lock semua BLP entries yang periode-nya sudah berakhir (Weekly Lockdown)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Hanya tampilkan entries yang akan dikunci tanpa mengunci',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Kunci semua entries yang belum dikunci (termasuk yang masih dalam periode)',
        )
        parser.add_argument(
            '--week-end',
            type=str,
            help='Kunci entries dengan week_end tertentu (format: YYYY-MM-DD)',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('='*60))
        self.stdout.write(self.style.NOTICE('BLP Weekly Lockdown'))
        self.stdout.write(self.style.NOTICE(f'Timestamp: {timezone.now()}'))
        self.stdout.write(self.style.NOTICE('='*60))

        dry_run = options.get('dry_run', False)
        force = options.get('force', False)
        specific_week_end = options.get('week_end')

        if dry_run:
            self.stdout.write(self.style.WARNING('[DRY RUN MODE] Tidak ada perubahan yang akan disimpan'))

        # Build queryset
        queryset = BLPEntry.objects.filter(is_locked=False)

        if specific_week_end:
            from datetime import datetime
            try:
                week_end_date = datetime.strptime(specific_week_end, '%Y-%m-%d').date()
                queryset = queryset.filter(week_end=week_end_date)
                self.stdout.write(f'Filter: week_end = {week_end_date}')
            except ValueError:
                self.stdout.write(self.style.ERROR('Format tanggal tidak valid. Gunakan: YYYY-MM-DD'))
                return

        elif not force:
            # Default: hanya kunci yang sudah expired (week_end < yesterday)
            today = timezone.now().date()
            yesterday = today - timedelta(days=1)
            queryset = queryset.filter(week_end__lt=yesterday)
            self.stdout.write(f'Filter: week_end < {yesterday} (expired entries)')

        # Count and list
        entries = queryset.select_related('siswa').order_by('week_start', 'siswa__nama')
        count = entries.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS('Tidak ada BLP entry yang perlu dikunci.'))
            return

        self.stdout.write(f'\nDitemukan {count} BLP entries untuk dikunci:\n')

        # Show list
        for i, entry in enumerate(entries[:20], 1):  # Show max 20
            self.stdout.write(
                f'  {i}. {entry.siswa.nama} | '
                f'{entry.week_start} - {entry.week_end} | '
                f'Score: {entry.total_score} | '
                f'Status: {entry.status}'
            )

        if count > 20:
            self.stdout.write(f'  ... dan {count - 20} lainnya')

        # Execute lock
        if not dry_run:
            self.stdout.write('\n' + '-'*40)
            self.stdout.write('Mengunci entries...')

            locked_count = 0
            for entry in entries:
                try:
                    entry.lock('SYSTEM_WEEKLY_LOCK')
                    locked_count += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'  ERROR: Gagal mengunci {entry.siswa.nama}: {str(e)}')
                    )

            self.stdout.write(self.style.SUCCESS(f'\nBerhasil mengunci {locked_count} BLP entries.'))

        else:
            self.stdout.write(self.style.WARNING(f'\n[DRY RUN] {count} entries akan dikunci.'))

        self.stdout.write(self.style.NOTICE('='*60))


def lock_entries():
    """
    Function untuk dipanggil oleh django-crontab atau scheduler lain.
    """
    from django.utils import timezone
    from datetime import timedelta

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    entries = BLPEntry.objects.filter(
        is_locked=False,
        week_end__lt=yesterday
    )

    count = 0
    for entry in entries:
        entry.lock('SYSTEM_WEEKLY_LOCK')
        count += 1

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f'[WEEKLY_LOCK] Locked {count} BLP entries at {timezone.now()}')

    return count
