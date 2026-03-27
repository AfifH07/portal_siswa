"""
Data Migration: Clean Class Name Format
========================================

This migration normalizes all 'kelas' field values across the database
to the standard format: "X A", "XI B", "XII C".

Conversions:
- "10-A", "10 A", "10A" → "X A"
- "11-B", "11 B", "11B" → "XI B"
- "12-C", "12 C", "12C" → "XII C"
- "X-A", "X_A", "XA" → "X A"
- Lowercase → Uppercase

Tables affected:
- students (Student.kelas)
- schedules (Schedule.kelas)
- grades (Grade.kelas)
- users (User.kelas)
- user_assignments (Assignment.kelas)
- attendance_draft (AttendanceDraft.kelas)
- pending_registrations (PendingRegistration.kelas)
- inval_records (InvalRecord.kelas)
- tarif (Tarif.kelas)

Author: Claude Code
Date: 2026-03-26
"""

import re
from django.db import migrations


# =============================================================
# NORMALIZATION LOGIC (copied to avoid import issues)
# =============================================================

ARABIC_TO_ROMAN = {
    '10': 'X',
    '11': 'XI',
    '12': 'XII',
}

VALID_GRADES = ['X', 'XI', 'XII']
VALID_SECTIONS = ['A', 'B', 'C', 'D']


def normalize_kelas(value):
    """
    Normalize class name to standard format: "X A", "XI B", "XII C".
    """
    if not value:
        return value

    original = value
    value = str(value).strip().upper()

    # Step 1: Replace Arabic numerals with Roman numerals
    for arabic, roman in ARABIC_TO_ROMAN.items():
        if value.startswith(arabic):
            value = roman + value[len(arabic):]
            break

    # Step 2: Try to parse with regex
    match = re.match(r'^(XII|XI|X)\s*[-_]?\s*([A-D])$', value)

    if match:
        grade = match.group(1)
        section = match.group(2)

        if grade in VALID_GRADES and section in VALID_SECTIONS:
            return f"{grade} {section}"

    # If we can't parse it, return original
    return original


# =============================================================
# MIGRATION FUNCTIONS
# =============================================================

def clean_kelas_forward(apps, schema_editor):
    """
    Forward migration: Normalize all kelas values to "X A" format.
    """
    # Track statistics
    stats = {
        'total_checked': 0,
        'total_updated': 0,
        'by_table': {}
    }

    # List of (app_label, model_name, field_name) tuples
    models_to_clean = [
        ('students', 'Student', 'kelas'),
        ('students', 'Schedule', 'kelas'),
        ('grades', 'Grade', 'kelas'),
        ('accounts', 'User', 'kelas'),
        ('accounts', 'Assignment', 'kelas'),
        ('attendance', 'AttendanceDraft', 'kelas'),
        ('registration', 'PendingRegistration', 'kelas'),
        ('kesantrian', 'InvalRecord', 'kelas'),
        ('finance', 'Tarif', 'kelas'),
    ]

    for app_label, model_name, field_name in models_to_clean:
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            print(f"  [SKIP] Model {app_label}.{model_name} not found")
            continue

        table_key = f"{app_label}.{model_name}"
        stats['by_table'][table_key] = {'checked': 0, 'updated': 0}

        # Get all records with non-empty kelas
        filter_kwargs = {f'{field_name}__isnull': False}
        exclude_kwargs = {field_name: ''}

        queryset = Model.objects.filter(**filter_kwargs).exclude(**exclude_kwargs)

        for obj in queryset:
            old_value = getattr(obj, field_name)
            new_value = normalize_kelas(old_value)

            stats['total_checked'] += 1
            stats['by_table'][table_key]['checked'] += 1

            if old_value != new_value:
                setattr(obj, field_name, new_value)
                obj.save(update_fields=[field_name])

                stats['total_updated'] += 1
                stats['by_table'][table_key]['updated'] += 1

                print(f"  [{model_name}] '{old_value}' → '{new_value}'")

    # Print summary
    print("\n" + "=" * 50)
    print("KELAS FORMAT MIGRATION SUMMARY")
    print("=" * 50)
    print(f"Total records checked: {stats['total_checked']}")
    print(f"Total records updated: {stats['total_updated']}")
    print("\nBy table:")
    for table, counts in stats['by_table'].items():
        if counts['checked'] > 0:
            print(f"  {table}: {counts['updated']}/{counts['checked']} updated")
    print("=" * 50)


def clean_kelas_reverse(apps, schema_editor):
    """
    Reverse migration: No-op (we don't want to revert to inconsistent format).
    """
    print("[NOTICE] Reverse migration is a no-op - data will remain normalized.")


# =============================================================
# MIGRATION CLASS
# =============================================================

class Migration(migrations.Migration):

    dependencies = [
        ('students', '0003_alumni_system'),
        # Cross-app dependencies to ensure models exist
        ('grades', '0001_initial'),
        ('accounts', '0001_initial'),
        ('attendance', '0001_initial'),
        ('registration', '0001_initial'),
        ('kesantrian', '0001_initial_kesantrian'),
        ('finance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            clean_kelas_forward,
            clean_kelas_reverse,
            elidable=True,  # Can be squashed
        ),
    ]
