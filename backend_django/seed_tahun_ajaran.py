#!/usr/bin/env python
"""
Seed script for TahunAjaran master data.
Creates initial academic year records.

Usage:
    python seed_tahun_ajaran.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

from datetime import date
from apps.core.models import TahunAjaran


def seed_tahun_ajaran():
    """Seed TahunAjaran with initial data."""

    print("=" * 50)
    print("SEEDING TAHUN AJARAN")
    print("=" * 50)

    # Calculate current academic year
    today = date.today()
    year = today.year
    month = today.month

    # Academic year starts in July
    if month >= 7:
        current_year = f"{year}/{year + 1}"
        current_semester = "Ganjil"
        start_date = date(year, 7, 1)
        end_date = date(year, 12, 31)
    else:
        current_year = f"{year - 1}/{year}"
        current_semester = "Genap"
        start_date = date(year, 1, 1)
        end_date = date(year, 6, 30)

    # Data to seed
    data = [
        # Previous year
        {
            'nama': f"{year - 2}/{year - 1}",
            'semester': 'Ganjil',
            'is_active': False,
            'tanggal_mulai': date(year - 2, 7, 1),
            'tanggal_selesai': date(year - 2, 12, 31),
        },
        {
            'nama': f"{year - 2}/{year - 1}",
            'semester': 'Genap',
            'is_active': False,
            'tanggal_mulai': date(year - 1, 1, 1),
            'tanggal_selesai': date(year - 1, 6, 30),
        },
        # Current academic year
        {
            'nama': f"{year - 1}/{year}",
            'semester': 'Ganjil',
            'is_active': False,
            'tanggal_mulai': date(year - 1, 7, 1),
            'tanggal_selesai': date(year - 1, 12, 31),
        },
        {
            'nama': f"{year - 1}/{year}",
            'semester': 'Genap',
            'is_active': (current_year == f"{year - 1}/{year}" and current_semester == "Genap"),
            'tanggal_mulai': date(year, 1, 1),
            'tanggal_selesai': date(year, 6, 30),
        },
        # Next academic year
        {
            'nama': f"{year}/{year + 1}",
            'semester': 'Ganjil',
            'is_active': (current_year == f"{year}/{year + 1}" and current_semester == "Ganjil"),
            'tanggal_mulai': date(year, 7, 1),
            'tanggal_selesai': date(year, 12, 31),
        },
        {
            'nama': f"{year}/{year + 1}",
            'semester': 'Genap',
            'is_active': False,
            'tanggal_mulai': date(year + 1, 1, 1),
            'tanggal_selesai': date(year + 1, 6, 30),
        },
    ]

    created_count = 0
    updated_count = 0

    for item in data:
        obj, created = TahunAjaran.objects.update_or_create(
            nama=item['nama'],
            semester=item['semester'],
            defaults={
                'is_active': item['is_active'],
                'tanggal_mulai': item['tanggal_mulai'],
                'tanggal_selesai': item['tanggal_selesai'],
            }
        )

        status = "CREATED" if created else "UPDATED"
        active_flag = " [ACTIVE]" if obj.is_active else ""
        print(f"  {status}: {obj.nama} - {obj.semester}{active_flag}")

        if created:
            created_count += 1
        else:
            updated_count += 1

    print()
    print(f"Created: {created_count}")
    print(f"Updated: {updated_count}")
    print()

    # Show active tahun ajaran
    active = TahunAjaran.get_active()
    if active:
        print(f"Active Tahun Ajaran: {active.nama} - {active.semester}")
    else:
        print("WARNING: No active Tahun Ajaran set!")

    print("=" * 50)
    print("DONE")
    print("=" * 50)


if __name__ == '__main__':
    seed_tahun_ajaran()
