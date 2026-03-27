# Generated manually for role rename and addition
# Migration: Rename 'admin_kelas' to 'wali_kelas' and add 'bk' role

from django.db import migrations, models


def rename_admin_kelas_to_wali_kelas(apps, schema_editor):
    """
    Data migration: Update all users with role='admin_kelas' to role='wali_kelas'
    """
    User = apps.get_model('accounts', 'User')

    # Count affected records for logging
    count = User.objects.filter(role='admin_kelas').count()

    if count > 0:
        # Update all admin_kelas users to wali_kelas
        User.objects.filter(role='admin_kelas').update(role='wali_kelas')
        print(f"\n[Migration] Updated {count} user(s) from 'admin_kelas' to 'wali_kelas'")
    else:
        print("\n[Migration] No users with role 'admin_kelas' found. Skipping data update.")


def reverse_wali_kelas_to_admin_kelas(apps, schema_editor):
    """
    Reverse migration: Update all users with role='wali_kelas' back to role='admin_kelas'
    """
    User = apps.get_model('accounts', 'User')

    count = User.objects.filter(role='wali_kelas').count()

    if count > 0:
        User.objects.filter(role='wali_kelas').update(role='admin_kelas')
        print(f"\n[Migration Reverse] Reverted {count} user(s) from 'wali_kelas' to 'admin_kelas'")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_add_assignment_activity_models'),
    ]

    operations = [
        # Step 1: Run data migration to update existing records
        migrations.RunPython(
            rename_admin_kelas_to_wali_kelas,
            reverse_code=reverse_wali_kelas_to_admin_kelas,
        ),

        # Step 2: Alter the field to update choices
        # This updates the ROLE_CHOICES in the database schema
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('superadmin', 'Superadmin'),
                    ('pimpinan', 'Pimpinan'),
                    ('guru', 'Guru'),
                    ('musyrif', 'Musyrif'),
                    ('wali_kelas', 'Wali Kelas'),  # RENAMED from admin_kelas
                    ('bk', 'Guru BK'),              # NEW role
                    ('bendahara', 'Bendahara'),
                    ('walisantri', 'Walisantri'),
                    ('adituren', 'Adituren/Alumni'),
                    ('pendaftar', 'Pendaftar'),
                ],
                default='pendaftar',
                max_length=20
            ),
        ),
    ]
