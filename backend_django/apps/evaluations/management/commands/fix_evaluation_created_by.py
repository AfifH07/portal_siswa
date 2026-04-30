"""
Management command to fix old Evaluation records with created_by=None.
Assigns them to the first superadmin user.

Usage:
    python manage.py fix_evaluation_created_by
    python manage.py fix_evaluation_created_by --dry-run  # Preview only
"""

from django.core.management.base import BaseCommand
from apps.evaluations.models import Evaluation
from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Fix old Evaluation records that have created_by=None by assigning to superadmin'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without actually updating the database',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Find evaluations with no created_by
        null_evaluations = Evaluation.objects.filter(created_by=None)
        count = null_evaluations.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS('No evaluations with created_by=None found.'))
            return

        self.stdout.write(f'Found {count} evaluations with created_by=None')

        # Get first superadmin
        admin = User.objects.filter(role='superadmin', is_active=True).first()

        if not admin:
            self.stdout.write(self.style.ERROR('No active superadmin user found!'))
            return

        self.stdout.write(f'Will assign to: {admin.username} ({admin.name or admin.username})')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes made'))
            self.stdout.write('Evaluations that would be updated:')
            for eval in null_evaluations[:10]:  # Show first 10
                self.stdout.write(f'  - ID {eval.id}: {eval.name} ({eval.tanggal})')
            if count > 10:
                self.stdout.write(f'  ... and {count - 10} more')
        else:
            # Update all null evaluations
            updated = null_evaluations.update(created_by=admin)
            self.stdout.write(self.style.SUCCESS(f'Successfully updated {updated} evaluations'))
