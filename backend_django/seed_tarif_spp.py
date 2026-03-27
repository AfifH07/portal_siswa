#!/usr/bin/env python
"""
Seed Script: Tarif SPP
======================

Script untuk membuat data Tarif SPP awal.
Jalankan dengan: python manage.py shell < seed_tarif_spp.py
Atau: python seed_tarif_spp.py (pastikan DJANGO_SETTINGS_MODULE sudah di-set)

"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from decimal import Decimal
from apps.finance.models import Tarif

def seed_tarif():
    """Create default SPP tarif if not exists."""

    tahun_ajaran = '2024/2025'

    tarif_data = [
        # SPP Bulanan - General (semua kelas)
        {
            'nama': 'SPP Bulanan',
            'kategori': 'spp',
            'frekuensi': 'bulanan',
            'nominal': Decimal('500000.00'),
            'tahun_ajaran': tahun_ajaran,
            'kelas': None,  # Berlaku untuk semua kelas
            'program': None,
            'deskripsi': 'Sumbangan Pembinaan Pendidikan bulanan',
            'aktif': True,
        },
        # Uang Gedung - Tahunan
        {
            'nama': 'Uang Gedung',
            'kategori': 'gedung',
            'frekuensi': 'tahunan',
            'nominal': Decimal('2000000.00'),
            'tahun_ajaran': tahun_ajaran,
            'kelas': None,
            'program': None,
            'deskripsi': 'Uang gedung/pangkal tahun ajaran baru',
            'aktif': True,
        },
        # Uang Kegiatan - Per Semester
        {
            'nama': 'Uang Kegiatan',
            'kategori': 'kegiatan',
            'frekuensi': 'semester',
            'nominal': Decimal('300000.00'),
            'tahun_ajaran': tahun_ajaran,
            'kelas': None,
            'program': None,
            'deskripsi': 'Biaya kegiatan ekstrakurikuler dan acara sekolah',
            'aktif': True,
        },
    ]

    created_count = 0
    updated_count = 0

    for data in tarif_data:
        tarif, created = Tarif.objects.update_or_create(
            nama=data['nama'],
            tahun_ajaran=data['tahun_ajaran'],
            defaults=data
        )

        if created:
            created_count += 1
            print(f"[CREATED] {tarif.nama} - Rp {tarif.nominal:,.0f}")
        else:
            updated_count += 1
            print(f"[UPDATED] {tarif.nama} - Rp {tarif.nominal:,.0f}")

    print(f"\n✅ Selesai! Created: {created_count}, Updated: {updated_count}")
    print(f"📋 Total Tarif aktif: {Tarif.objects.filter(aktif=True).count()}")

    # List semua tarif SPP bulanan aktif
    spp_list = Tarif.objects.filter(kategori='spp', frekuensi='bulanan', aktif=True)
    print(f"\n📌 Tarif SPP Bulanan Aktif:")
    for t in spp_list:
        print(f"   - {t.nama}: Rp {t.nominal:,.0f} ({t.tahun_ajaran})")

if __name__ == '__main__':
    seed_tarif()
