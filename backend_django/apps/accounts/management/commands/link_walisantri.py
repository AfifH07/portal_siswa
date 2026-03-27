"""
Management command to link walisantri users to students.

Usage:
    python manage.py link_walisantri
    python manage.py link_walisantri --username=walisantri --nisn=12345
    python manage.py link_walisantri --list-students
    python manage.py link_walisantri --list-walisantri
"""

from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.students.models import Student


class Command(BaseCommand):
    help = 'Link walisantri users to students or debug linkage issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username of the walisantri user to link',
            default='walisantri'
        )
        parser.add_argument(
            '--nisn',
            type=str,
            help='NISN of the student to link to',
        )
        parser.add_argument(
            '--list-students',
            action='store_true',
            help='List all students in the database',
        )
        parser.add_argument(
            '--list-walisantri',
            action='store_true',
            help='List all walisantri users and their linked students',
        )
        parser.add_argument(
            '--auto',
            action='store_true',
            help='Auto-link walisantri to the first available student',
        )

    def handle(self, *args, **options):
        # List students
        if options['list_students']:
            self.list_students()
            return

        # List walisantri users
        if options['list_walisantri']:
            self.list_walisantri()
            return

        # Auto-link
        if options['auto']:
            self.auto_link(options['username'])
            return

        # Manual link
        if options['nisn']:
            self.link_user(options['username'], options['nisn'])
        else:
            # Default: debug mode - show current state
            self.debug_linkage(options['username'])

    def list_students(self):
        students = Student.objects.all()[:20]
        self.stdout.write(self.style.SUCCESS(f'\n=== Students in Database ({Student.objects.count()} total) ==='))

        if not students:
            self.stdout.write(self.style.WARNING('No students found in database!'))
            self.stdout.write('You may need to create test students first.')
            return

        for s in students:
            self.stdout.write(f'  NISN: {s.nisn} | Name: {s.nama} | Class: {s.kelas or "-"} | Active: {s.aktif}')

    def list_walisantri(self):
        users = User.objects.filter(role='walisantri')
        self.stdout.write(self.style.SUCCESS(f'\n=== Walisantri Users ({users.count()} total) ==='))

        if not users:
            self.stdout.write(self.style.WARNING('No walisantri users found!'))
            return

        for u in users:
            linked_status = self.style.SUCCESS(u.linked_student_nisn) if u.linked_student_nisn else self.style.WARNING('NOT LINKED')

            # Check if linked student exists
            student_name = '-'
            if u.linked_student_nisn:
                try:
                    student = Student.objects.get(nisn=u.linked_student_nisn)
                    student_name = student.nama
                except Student.DoesNotExist:
                    student_name = self.style.ERROR('STUDENT NOT FOUND!')

            self.stdout.write(f'  Username: {u.username} | Linked NISN: {linked_status} | Student: {student_name}')

    def debug_linkage(self, username):
        self.stdout.write(self.style.SUCCESS(f'\n=== Debug Linkage for "{username}" ==='))

        try:
            user = User.objects.get(username=username)
            self.stdout.write(f'  User found: {user.name} (role: {user.role})')
            self.stdout.write(f'  linked_student_nisn: {user.linked_student_nisn or "NULL/EMPTY"}')

            if user.linked_student_nisn:
                try:
                    student = Student.objects.get(nisn=user.linked_student_nisn)
                    self.stdout.write(self.style.SUCCESS(f'  Linked student found: {student.nama} (NISN: {student.nisn})'))
                except Student.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  ERROR: Student with NISN "{user.linked_student_nisn}" NOT FOUND!'))
                    self.stdout.write('  Use --list-students to see available students')
                    self.stdout.write('  Use --auto to auto-link to first available student')
            else:
                self.stdout.write(self.style.WARNING('  User has no linked student NISN!'))
                self.stdout.write('  Use --nisn=<NISN> to link manually')
                self.stdout.write('  Use --auto to auto-link to first available student')

        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'  User "{username}" not found!'))

    def auto_link(self, username):
        try:
            user = User.objects.get(username=username)

            # Find first active student
            student = Student.objects.filter(aktif=True).first()
            if not student:
                student = Student.objects.first()

            if not student:
                self.stdout.write(self.style.ERROR('No students in database! Create students first.'))
                return

            user.linked_student_nisn = student.nisn
            user.save()

            self.stdout.write(self.style.SUCCESS(
                f'Successfully linked "{username}" to student "{student.nama}" (NISN: {student.nisn})'
            ))

        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found!'))

    def link_user(self, username, nisn):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User "{username}" not found!'))
            return

        try:
            student = Student.objects.get(nisn=nisn)
        except Student.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Student with NISN "{nisn}" not found!'))
            self.list_students()
            return

        user.linked_student_nisn = nisn
        user.save()

        self.stdout.write(self.style.SUCCESS(
            f'Successfully linked "{username}" to student "{student.nama}" (NISN: {nisn})'
        ))
