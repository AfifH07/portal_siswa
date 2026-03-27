"""
Management Command: Generate Invoice Numbers
=============================================

Generate invoice numbers untuk tagihan yang belum memiliki no_invoice.

Usage:
    python manage.py generate_invoices          # Generate untuk semua tagihan tanpa invoice
    python manage.py generate_invoices --dry-run # Preview tanpa menyimpan
    python manage.py generate_invoices --force  # Regenerate untuk semua tagihan
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.finance.models import Tagihan, generate_invoice_number


class Command(BaseCommand):
    help = 'Generate invoice numbers for tagihan without no_invoice'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate invoice numbers for ALL tagihan (including existing ones)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']

        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(self.style.NOTICE('Generate Invoice Numbers'))
        self.stdout.write(self.style.NOTICE('=' * 60))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        if force:
            self.stdout.write(self.style.WARNING('FORCE MODE - Regenerating ALL invoices'))

        # Get tagihan to process
        if force:
            tagihan_qs = Tagihan.objects.select_related('siswa', 'tarif').all()
        else:
            tagihan_qs = Tagihan.objects.select_related('siswa', 'tarif').filter(
                no_invoice__isnull=True
            ) | Tagihan.objects.select_related('siswa', 'tarif').filter(
                no_invoice=''
            )

        total_count = tagihan_qs.count()

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No tagihan need invoice numbers. All done!'))
            return

        self.stdout.write(f'Found {total_count} tagihan to process...')
        self.stdout.write('')

        success_count = 0
        error_count = 0

        with transaction.atomic():
            for tagihan in tagihan_qs:
                try:
                    # Generate invoice number
                    new_invoice = generate_invoice_number(
                        siswa_nisn=tagihan.siswa.nisn,
                        tarif_kategori=tagihan.tarif.kategori,
                        bulan=tagihan.bulan or 0,
                        tahun=tagihan.tahun
                    )

                    old_invoice = tagihan.no_invoice or '-'

                    self.stdout.write(
                        f'  [{tagihan.id}] {tagihan.siswa.nama[:20]:<20} | '
                        f'{old_invoice} -> {new_invoice}'
                    )

                    if not dry_run:
                        tagihan.no_invoice = new_invoice
                        tagihan.save(update_fields=['no_invoice', 'updated_at'])

                    success_count += 1

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'  [{tagihan.id}] ERROR: {str(e)}')
                    )
                    error_count += 1

            if dry_run:
                # Rollback in dry-run mode
                transaction.set_rollback(True)

        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(self.style.NOTICE('Summary'))
        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(f'Total processed: {total_count}')
        self.stdout.write(self.style.SUCCESS(f'Success: {success_count}'))
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'Errors: {error_count}'))

        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                'DRY RUN complete. Run without --dry-run to apply changes.'
            ))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('Invoice generation complete!'))
