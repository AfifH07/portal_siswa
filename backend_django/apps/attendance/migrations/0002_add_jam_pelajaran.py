# Generated manually - Add jam_ke field for lesson hours support

from django.db import migrations, models


def remove_duplicates_and_set_jam_ke(apps, schema_editor):
    """
    Remove duplicate records and set jam_ke based on waktu.
    Keep only one record per nisn+tanggal combination.
    """
    Attendance = apps.get_model('attendance', 'Attendance')

    # Map old waktu values to jam_ke
    waktu_mapping = {
        'Pagi': 1,
        'Siang': 4,
        'Sore': 8,
    }

    # Find and remove duplicates - keep only the first record for each nisn+tanggal
    seen = set()
    duplicates_to_delete = []

    for attendance in Attendance.objects.all().order_by('id'):
        key = (attendance.nisn_id, str(attendance.tanggal))
        if key in seen:
            duplicates_to_delete.append(attendance.id)
        else:
            seen.add(key)
            # Set jam_ke based on waktu
            waktu = getattr(attendance, 'waktu', 'Pagi') or 'Pagi'
            attendance.jam_ke = waktu_mapping.get(waktu, 1)
            attendance.save()

    # Delete duplicates
    if duplicates_to_delete:
        Attendance.objects.filter(id__in=duplicates_to_delete).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0001_initial"),
    ]

    operations = [
        # Add jam_ke field with default value
        migrations.AddField(
            model_name="attendance",
            name="jam_ke",
            field=models.PositiveSmallIntegerField(
                choices=[
                    (1, "JP 1 (Pagi)"),
                    (2, "JP 2"),
                    (3, "JP 3"),
                    (4, "JP 4"),
                    (5, "JP 5"),
                    (6, "JP 6"),
                    (7, "JP 7"),
                    (8, "JP 8 (Sore)"),
                    (9, "JP 9 (Sore)"),
                ],
                default=1,
                help_text="Jam Pelajaran (1-9)",
            ),
        ),
        # Add mata_pelajaran field
        migrations.AddField(
            model_name="attendance",
            name="mata_pelajaran",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        # Remove duplicates and set jam_ke values
        migrations.RunPython(remove_duplicates_and_set_jam_ke, migrations.RunPython.noop),
        # Add index on jam_ke
        migrations.AddIndex(
            model_name="attendance",
            index=models.Index(fields=["jam_ke"], name="attendance_jam_ke_idx"),
        ),
        # Add unique constraint (nisn, tanggal, jam_ke)
        migrations.AlterUniqueTogether(
            name="attendance",
            unique_together={("nisn", "tanggal", "jam_ke")},
        ),
        # Remove old waktu field
        migrations.RemoveField(
            model_name="attendance",
            name="waktu",
        ),
    ]
