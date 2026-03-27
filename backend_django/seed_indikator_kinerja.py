"""
Seed script untuk IndikatorKinerja (Star Rating Performance Review)
Portal Ponpes Baron v2.3.4

Jalankan dengan:
    python manage.py shell < seed_indikator_kinerja.py

Atau:
    python seed_indikator_kinerja.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

from apps.kesantrian.models import IndikatorKinerja


def seed_indikator_kinerja():
    """Seed default indikator kinerja untuk penilaian ustadz."""

    indikator_data = [
        # Manual Indicators (diisi langsung oleh penilai)
        {
            'nama_indikator': 'Kerjasama Tim',
            'deskripsi': 'Kemampuan bekerja sama dengan rekan kerja, berkontribusi dalam kegiatan bersama, dan membangun hubungan profesional yang baik.',
            'urutan': 1,
            'is_auto_calculated': False,
            'bobot': 1.0,
        },
        {
            'nama_indikator': 'Integritas',
            'deskripsi': 'Kejujuran, konsistensi antara perkataan dan perbuatan, menjaga amanah, dan bertanggung jawab atas tugas yang diberikan.',
            'urutan': 2,
            'is_auto_calculated': False,
            'bobot': 1.2,
        },
        {
            'nama_indikator': 'Kualitas Mengajar',
            'deskripsi': 'Kemampuan menyampaikan materi dengan jelas, menggunakan metode yang efektif, dan memastikan pemahaman santri.',
            'urutan': 3,
            'is_auto_calculated': False,
            'bobot': 1.5,
        },
        {
            'nama_indikator': 'Kompetensi Profesional',
            'deskripsi': 'Penguasaan materi ajar, kemampuan menjawab pertanyaan, dan terus mengembangkan ilmu pengetahuan.',
            'urutan': 4,
            'is_auto_calculated': False,
            'bobot': 1.3,
        },
        {
            'nama_indikator': 'Komunikasi',
            'deskripsi': 'Kemampuan berkomunikasi efektif dengan santri, wali santri, dan sesama ustadz/ustadzah.',
            'urutan': 5,
            'is_auto_calculated': False,
            'bobot': 1.0,
        },
        {
            'nama_indikator': 'Keteladanan (Uswah Hasanah)',
            'deskripsi': 'Menjadi contoh yang baik dalam perilaku, ibadah, dan akhlak bagi santri dan lingkungan pesantren.',
            'urutan': 6,
            'is_auto_calculated': False,
            'bobot': 1.5,
        },
        {
            'nama_indikator': 'Kreativitas & Inovasi',
            'deskripsi': 'Kemampuan mengembangkan metode pembelajaran baru, memberikan solusi kreatif, dan inisiatif dalam meningkatkan kualitas.',
            'urutan': 7,
            'is_auto_calculated': False,
            'bobot': 1.0,
        },
        {
            'nama_indikator': 'Kepemimpinan',
            'deskripsi': 'Kemampuan memimpin, mengambil keputusan, dan memotivasi santri serta rekan kerja.',
            'urutan': 8,
            'is_auto_calculated': False,
            'bobot': 1.0,
        },
        {
            'nama_indikator': 'Loyalitas & Komitmen',
            'deskripsi': 'Dedikasi terhadap pesantren, kesediaan berkontribusi lebih, dan komitmen terhadap visi misi lembaga.',
            'urutan': 9,
            'is_auto_calculated': False,
            'bobot': 1.2,
        },
        {
            'nama_indikator': 'Pengelolaan Kelas',
            'deskripsi': 'Kemampuan menciptakan suasana belajar yang kondusif, mengelola waktu, dan menangani berbagai karakter santri.',
            'urutan': 10,
            'is_auto_calculated': False,
            'bobot': 1.3,
        },

        # Auto-calculated Indicators (akan diambil dari data lain)
        {
            'nama_indikator': 'Kedisiplinan Kehadiran',
            'deskripsi': 'Tingkat kehadiran dan ketepatan waktu dalam mengajar (dihitung otomatis dari data absensi).',
            'urutan': 11,
            'is_auto_calculated': True,
            'auto_source': 'attendance',
            'bobot': 1.2,
        },
        {
            'nama_indikator': 'Kontribusi Penggantian (Inval)',
            'deskripsi': 'Kesediaan menggantikan rekan yang berhalangan (dihitung otomatis dari data inval).',
            'urutan': 12,
            'is_auto_calculated': True,
            'auto_source': 'inval',
            'bobot': 0.8,
        },
    ]

    created_count = 0
    updated_count = 0

    for data in indikator_data:
        indikator, created = IndikatorKinerja.objects.update_or_create(
            nama_indikator=data['nama_indikator'],
            defaults=data
        )

        if created:
            created_count += 1
            print(f"[+] Created: {indikator.nama_indikator}")
        else:
            updated_count += 1
            print(f"[~] Updated: {indikator.nama_indikator}")

    print(f"\n{'='*50}")
    print(f"Total Created: {created_count}")
    print(f"Total Updated: {updated_count}")
    print(f"Total Indikator: {IndikatorKinerja.objects.count()}")
    print(f"{'='*50}")


if __name__ == '__main__':
    print("Seeding IndikatorKinerja data...")
    print("="*50)
    seed_indikator_kinerja()
    print("\nDone!")
