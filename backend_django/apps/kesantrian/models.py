"""
Kesantrian Models - Portal Ponpes Baron v2.3
=============================================

Modul Kesantrian mengelola aspek kehidupan pesantren:
1. Ibadah - Tracking sholat wajib, sunnah, dan amalan harian
2. Halaqoh - Kelompok belajar Al-Quran dan kajian
3. Pembinaan - BLP (Buku Lapangan Pesantren) dan catatan pembinaan
4. BLPEntry - Penilaian karakter mingguan dengan 59 indikator (JSONField)
5. EmployeeEvaluation - Evaluasi kinerja Ustadz/Ustadzah
6. InvalRecord - Pencatatan penggantian mengajar (Auto-Inval)

ERD:
    Student (1) ──── (N) Ibadah
            │
            ├──── (N) Pembinaan
            │
            ├──── (N) BLPEntry
            │
            └──── (N) HalaqohMember ──── (1) Halaqoh

    User (Ustadz) (1) ──── (N) EmployeeEvaluation
                  │
                  └──── (N) InvalRecord (as absent/substitute)
"""

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from apps.students.models import Student, normalize_kelas_format


class Ibadah(models.Model):
    """
    Model untuk tracking ibadah harian santri.

    Mencakup:
    - Sholat 5 waktu (wajib)
    - Sholat sunnah (Dhuha, Tahajud, Rawatib)
    - Puasa sunnah
    - Dzikir/Wirid
    """

    JENIS_CHOICES = [
        ('sholat_wajib', 'Sholat Wajib'),
        ('sholat_sunnah', 'Sholat Sunnah'),
        ('puasa', 'Puasa'),
        ('dzikir', 'Dzikir/Wirid'),
        ('tilawah', 'Tilawah Al-Quran'),
    ]

    WAKTU_SHOLAT_CHOICES = [
        ('subuh', 'Subuh'),
        ('dzuhur', 'Dzuhur'),
        ('ashar', 'Ashar'),
        ('maghrib', 'Maghrib'),
        ('isya', 'Isya'),
        ('dhuha', 'Dhuha'),
        ('tahajud', 'Tahajud'),
        ('rawatib_qabliyah', 'Rawatib Qabliyah'),
        ('rawatib_badiyah', "Rawatib Ba'diyah"),
        ('witir', 'Witir'),
        ('tarawih', 'Tarawih'),
    ]

    STATUS_CHOICES = [
        ('hadir', 'Hadir/Terlaksana'),
        ('tidak_hadir', 'Tidak Hadir'),
        ('terlambat', 'Terlambat'),
        ('izin', 'Izin'),
        ('sakit', 'Sakit'),
    ]

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='ibadah_records',
        help_text="Santri yang dicatat ibadahnya"
    )
    tanggal = models.DateField(
        help_text="Tanggal pelaksanaan ibadah"
    )
    jenis = models.CharField(
        max_length=20,
        choices=JENIS_CHOICES,
        help_text="Jenis ibadah"
    )
    waktu = models.CharField(
        max_length=30,
        choices=WAKTU_SHOLAT_CHOICES,
        blank=True,
        null=True,
        help_text="Waktu sholat (untuk jenis sholat)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='hadir'
    )
    catatan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan tambahan"
    )
    pencatat = models.CharField(
        max_length=100,
        help_text="Username musyrif/guru yang mencatat"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_ibadah'
        ordering = ['-tanggal', 'waktu']
        verbose_name = 'Ibadah'
        verbose_name_plural = 'Ibadah'
        indexes = [
            models.Index(fields=['siswa', 'tanggal'], name='idx_ibadah_siswa_tgl'),
            models.Index(fields=['tanggal', 'jenis'], name='idx_ibadah_tgl_jenis'),
            models.Index(fields=['jenis', 'waktu'], name='idx_ibadah_jenis_waktu'),
            models.Index(fields=['siswa', 'jenis', 'status'], name='idx_ibadah_siswa_jenis_status'),
            models.Index(fields=['tanggal'], name='idx_ibadah_tanggal'),
            models.Index(fields=['status'], name='idx_ibadah_status'),
        ]
        # Unique: satu record per siswa per tanggal per jenis per waktu
        unique_together = ['siswa', 'tanggal', 'jenis', 'waktu']

    def __str__(self):
        waktu_str = f" ({self.waktu})" if self.waktu else ""
        return f"{self.siswa.nama} - {self.get_jenis_display()}{waktu_str} - {self.tanggal}"


class Halaqoh(models.Model):
    """
    Model untuk kelompok halaqoh (lingkaran belajar).

    Halaqoh bisa berupa:
    - Halaqoh Tahfidz (menghafal Al-Quran)
    - Halaqoh Tahsin (perbaikan bacaan)
    - Halaqoh Kajian (kajian kitab)
    """

    JENIS_CHOICES = [
        ('tahfidz', 'Tahfidz'),
        ('tahsin', 'Tahsin'),
        ('kajian', 'Kajian Kitab'),
        ('bahasa', 'Bahasa Arab/Inggris'),
    ]

    id = models.BigAutoField(primary_key=True)
    nama = models.CharField(
        max_length=100,
        help_text="Nama halaqoh, misal: Halaqoh Tahfidz A"
    )
    jenis = models.CharField(
        max_length=20,
        choices=JENIS_CHOICES,
        default='tahfidz'
    )
    musyrif = models.CharField(
        max_length=100,
        help_text="Nama ustadz/musyrif pembimbing"
    )
    musyrif_username = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Username musyrif di sistem"
    )
    jadwal = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Jadwal halaqoh, misal: Senin-Kamis 05:00-06:00"
    )
    lokasi = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Lokasi halaqoh"
    )
    kapasitas = models.PositiveIntegerField(
        default=15,
        help_text="Maksimal anggota halaqoh"
    )
    aktif = models.BooleanField(default=True)
    tahun_ajaran = models.CharField(
        max_length=10,
        help_text="Format: 2025/2026"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_halaqoh'
        ordering = ['jenis', 'nama']
        verbose_name = 'Halaqoh'
        verbose_name_plural = 'Halaqoh'

    def __str__(self):
        return f"{self.nama} ({self.get_jenis_display()}) - {self.musyrif}"

    @property
    def jumlah_anggota(self):
        return self.anggota.filter(aktif=True).count()


class HalaqohMember(models.Model):
    """
    Keanggotaan santri dalam halaqoh.
    Satu santri bisa ikut beberapa halaqoh berbeda.
    """

    id = models.BigAutoField(primary_key=True)
    halaqoh = models.ForeignKey(
        Halaqoh,
        on_delete=models.CASCADE,
        related_name='anggota'
    )
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='halaqoh_membership'
    )
    tanggal_gabung = models.DateField(auto_now_add=True)
    aktif = models.BooleanField(default=True)
    catatan = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'kesantrian_halaqoh_member'
        unique_together = ['halaqoh', 'siswa']
        verbose_name = 'Anggota Halaqoh'
        verbose_name_plural = 'Anggota Halaqoh'
        indexes = [
            models.Index(fields=['siswa', 'aktif'], name='idx_halaqoh_member_siswa'),
            models.Index(fields=['halaqoh', 'aktif'], name='idx_halaqoh_member_halaqoh'),
            models.Index(fields=['tanggal_gabung'], name='idx_halaqoh_member_tgl'),
        ]

    def __str__(self):
        return f"{self.siswa.nama} @ {self.halaqoh.nama}"


class Pembinaan(models.Model):
    """
    Model BLP (Buku Lapangan Pesantren) / Catatan Pembinaan.

    Mencatat:
    - Progress hafalan
    - Catatan perilaku/akhlak
    - Hasil evaluasi berkala
    - Rekomendasi pembinaan
    """

    KATEGORI_CHOICES = [
        ('hafalan', 'Progress Hafalan'),
        ('akhlak', 'Pembinaan Akhlak'),
        ('kedisiplinan', 'Kedisiplinan'),
        ('akademik', 'Akademik Keagamaan'),
        ('kesehatan', 'Kesehatan'),
        ('sosial', 'Interaksi Sosial'),
        ('bakat', 'Pengembangan Bakat'),
        ('lainnya', 'Lainnya'),
    ]

    TINGKAT_CHOICES = [
        ('sangat_baik', 'Sangat Baik'),
        ('baik', 'Baik'),
        ('cukup', 'Cukup'),
        ('perlu_perhatian', 'Perlu Perhatian'),
        ('perlu_pembinaan', 'Perlu Pembinaan Khusus'),
    ]

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='pembinaan_records'
    )
    tanggal = models.DateField()
    kategori = models.CharField(
        max_length=30,
        choices=KATEGORI_CHOICES
    )
    judul = models.CharField(
        max_length=200,
        help_text="Judul/ringkasan pembinaan"
    )
    deskripsi = models.TextField(
        help_text="Deskripsi lengkap"
    )
    tingkat = models.CharField(
        max_length=20,
        choices=TINGKAT_CHOICES,
        default='baik'
    )
    tindak_lanjut = models.TextField(
        blank=True,
        null=True,
        help_text="Rekomendasi tindak lanjut"
    )
    pembina = models.CharField(
        max_length=100,
        help_text="Nama pembina/musyrif"
    )
    pembina_username = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    # Khusus untuk hafalan
    surah = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Nama surah (untuk kategori hafalan)"
    )
    ayat_mulai = models.PositiveIntegerField(
        blank=True,
        null=True
    )
    ayat_selesai = models.PositiveIntegerField(
        blank=True,
        null=True
    )
    jumlah_halaman = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Jumlah halaman yang dihafal/dimurojaah"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_pembinaan'
        ordering = ['-tanggal', '-created_at']
        verbose_name = 'Pembinaan'
        verbose_name_plural = 'Pembinaan'
        indexes = [
            models.Index(fields=['siswa', 'tanggal'], name='idx_pembinaan_siswa_tgl'),
            models.Index(fields=['kategori'], name='idx_pembinaan_kategori'),
            models.Index(fields=['tingkat'], name='idx_pembinaan_tingkat'),
            models.Index(fields=['siswa', 'kategori'], name='idx_pembinaan_siswa_kat'),
            models.Index(fields=['tanggal'], name='idx_pembinaan_tanggal'),
        ]

    def __str__(self):
        return f"{self.siswa.nama} - {self.judul} ({self.tanggal})"


class TargetHafalan(models.Model):
    """
    Target hafalan per santri per semester.
    """

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='target_hafalan_records'
    )
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')]
    )
    tahun_ajaran = models.CharField(max_length=10)
    target_juz = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(30)],
        help_text="Target hafalan dalam juz"
    )
    tercapai_juz = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(30)],
        help_text="Hafalan yang sudah tercapai"
    )
    catatan = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_target_hafalan'
        unique_together = ['siswa', 'semester', 'tahun_ajaran']
        verbose_name = 'Target Hafalan'
        verbose_name_plural = 'Target Hafalan'
        indexes = [
            models.Index(fields=['siswa', 'tahun_ajaran'], name='idx_hafalan_siswa_tahun'),
            models.Index(fields=['semester', 'tahun_ajaran'], name='idx_hafalan_sem_tahun'),
        ]

    def __str__(self):
        return f"{self.siswa.nama} - {self.semester} {self.tahun_ajaran}"

    @property
    def persentase_tercapai(self):
        if self.target_juz == 0:
            return 0
        return round((self.tercapai_juz / self.target_juz) * 100, 1)


# ============================================
# BLP (BUKU LAPANGAN PESANTREN) - 59 INDIKATOR
# ============================================

# Definisi 59 Indikator BLP
BLP_INDICATORS = {
    'akhlak': {
        'label': 'Akhlak & Adab',
        'max_score': 60,  # 12 indikator × 5 poin
        'indicators': [
            ('sopan_santun', 'Sopan Santun kepada Ustadz/Ustadzah'),
            ('hormat_orang_tua', 'Hormat kepada Orang Tua'),
            ('kejujuran', 'Kejujuran dalam Perkataan'),
            ('amanah', 'Menjaga Amanah'),
            ('rendah_hati', 'Rendah Hati (Tawadhu)'),
            ('sabar', 'Kesabaran'),
            ('syukur', 'Sikap Syukur'),
            ('pemaaf', 'Sifat Pemaaf'),
            ('adab_makan', 'Adab Makan & Minum'),
            ('adab_berbicara', 'Adab Berbicara'),
            ('adab_berpakaian', 'Adab Berpakaian'),
            ('adab_tidur', 'Adab Tidur & Bangun'),
        ]
    },
    'kedisiplinan': {
        'label': 'Kedisiplinan',
        'max_score': 50,  # 10 indikator × 5 poin
        'indicators': [
            ('tepat_waktu_sholat', 'Tepat Waktu Sholat Berjamaah'),
            ('tepat_waktu_kelas', 'Tepat Waktu Masuk Kelas'),
            ('tepat_waktu_makan', 'Tepat Waktu Makan'),
            ('seragam', 'Kerapihan Seragam'),
            ('kebersihan_diri', 'Kebersihan Diri'),
            ('kebersihan_kamar', 'Kebersihan Kamar/Asrama'),
            ('izin_keluar', 'Prosedur Izin Keluar'),
            ('penggunaan_hp', 'Penggunaan HP Sesuai Aturan'),
            ('jam_malam', 'Kepatuhan Jam Malam'),
            ('antrian', 'Tertib Antrian'),
        ]
    },
    'ibadah': {
        'label': 'Ibadah & Spiritual',
        'max_score': 75,  # 15 indikator × 5 poin
        'indicators': [
            ('sholat_subuh', 'Kehadiran Sholat Subuh'),
            ('sholat_dzuhur', 'Kehadiran Sholat Dzuhur'),
            ('sholat_ashar', 'Kehadiran Sholat Ashar'),
            ('sholat_maghrib', 'Kehadiran Sholat Maghrib'),
            ('sholat_isya', 'Kehadiran Sholat Isya'),
            ('sholat_dhuha', 'Sholat Dhuha'),
            ('sholat_tahajud', 'Sholat Tahajud'),
            ('sholat_rawatib', 'Sholat Rawatib'),
            ('tilawah_harian', 'Tilawah Al-Quran Harian'),
            ('dzikir_pagi', 'Dzikir Pagi'),
            ('dzikir_sore', 'Dzikir Sore'),
            ('puasa_sunnah', 'Puasa Sunnah'),
            ('sedekah', 'Sedekah/Infaq'),
            ('doa_sebelum_aktivitas', 'Doa Sebelum Aktivitas'),
            ('khusyuk_sholat', 'Kekhusyukan Sholat'),
        ]
    },
    'akademik': {
        'label': 'Akademik Keagamaan',
        'max_score': 40,  # 8 indikator × 5 poin
        'indicators': [
            ('hafalan_quran', 'Progress Hafalan Al-Quran'),
            ('murojaah', 'Konsistensi Murojaah'),
            ('tajwid', 'Penguasaan Tajwid'),
            ('makhorijul_huruf', 'Makhorijul Huruf'),
            ('kehadiran_diniyah', 'Kehadiran Kelas Diniyah'),
            ('tugas_diniyah', 'Pengumpulan Tugas Diniyah'),
            ('bahasa_arab', 'Kemampuan Bahasa Arab'),
            ('hafalan_hadits', 'Hafalan Hadits'),
        ]
    },
    'sosial': {
        'label': 'Interaksi Sosial',
        'max_score': 40,  # 8 indikator × 5 poin
        'indicators': [
            ('kerjasama', 'Kerjasama Tim'),
            ('tolong_menolong', 'Sikap Tolong Menolong'),
            ('menghargai_perbedaan', 'Menghargai Perbedaan'),
            ('komunikasi', 'Kemampuan Komunikasi'),
            ('empati', 'Empati terhadap Teman'),
            ('tidak_bullying', 'Tidak Melakukan Bullying'),
            ('partisipasi_kegiatan', 'Partisipasi Kegiatan Bersama'),
            ('kepemimpinan', 'Jiwa Kepemimpinan'),
        ]
    },
    'pengembangan_diri': {
        'label': 'Pengembangan Diri',
        'max_score': 30,  # 6 indikator × 5 poin
        'indicators': [
            ('minat_baca', 'Minat Baca'),
            ('kreativitas', 'Kreativitas'),
            ('public_speaking', 'Kemampuan Public Speaking'),
            ('manajemen_waktu', 'Manajemen Waktu'),
            ('kemandirian', 'Kemandirian'),
            ('inisiatif', 'Inisiatif'),
        ]
    }
}

# Total: 12 + 10 + 15 + 8 + 8 + 6 = 59 indikator
# Max score: 60 + 50 + 75 + 40 + 40 + 30 = 295 (jika max per indikator = 5)
# Untuk mencapai 390, kita bisa adjust max per indikator atau tambah bonus


# ============================================
# BLP CORE INDICATORS (25 Indikator Inti)
# ============================================
# Versi ringkas untuk dashboard dan laporan cepat
BLP_CORE_INDICATORS = {
    'akhlak': {
        'label': 'Akhlak & Adab',
        'max_score': 25,  # 5 indikator × 5 poin
        'indicators': [
            ('sopan_santun', 'Sopan Santun kepada Ustadz'),
            ('kejujuran', 'Kejujuran'),
            ('rendah_hati', 'Rendah Hati (Tawadhu)'),
            ('adab_makan', 'Adab Makan & Minum'),
            ('adab_berbicara', 'Adab Berbicara'),
        ]
    },
    'kedisiplinan': {
        'label': 'Kedisiplinan',
        'max_score': 20,  # 4 indikator × 5 poin
        'indicators': [
            ('tepat_waktu_sholat', 'Tepat Waktu Sholat'),
            ('tepat_waktu_kelas', 'Tepat Waktu Kelas'),
            ('kebersihan_diri', 'Kebersihan Diri'),
            ('jam_malam', 'Kepatuhan Jam Malam'),
        ]
    },
    'ibadah': {
        'label': 'Ibadah & Spiritual',
        'max_score': 30,  # 6 indikator × 5 poin
        'indicators': [
            ('sholat_wajib', 'Kehadiran Sholat Wajib'),
            ('sholat_dhuha', 'Sholat Dhuha'),
            ('sholat_tahajud', 'Sholat Tahajud'),
            ('tilawah_harian', 'Tilawah Al-Quran'),
            ('dzikir', 'Dzikir Pagi/Sore'),
            ('khusyuk_sholat', 'Kekhusyukan Sholat'),
        ]
    },
    'akademik': {
        'label': 'Akademik Keagamaan',
        'max_score': 20,  # 4 indikator × 5 poin
        'indicators': [
            ('hafalan_quran', 'Progress Hafalan'),
            ('murojaah', 'Konsistensi Murojaah'),
            ('tajwid', 'Penguasaan Tajwid'),
            ('kehadiran_diniyah', 'Kehadiran Diniyah'),
        ]
    },
    'sosial': {
        'label': 'Interaksi Sosial',
        'max_score': 15,  # 3 indikator × 5 poin
        'indicators': [
            ('kerjasama', 'Kerjasama Tim'),
            ('tolong_menolong', 'Tolong Menolong'),
            ('tidak_bullying', 'Anti Bullying'),
        ]
    },
    'pengembangan_diri': {
        'label': 'Pengembangan Diri',
        'max_score': 15,  # 3 indikator × 5 poin
        'indicators': [
            ('kemandirian', 'Kemandirian'),
            ('inisiatif', 'Inisiatif'),
            ('public_speaking', 'Public Speaking'),
        ]
    }
}

# Total Core: 5 + 4 + 6 + 4 + 3 + 3 = 25 indikator
# Max Core Score: 25 + 20 + 30 + 20 + 15 + 15 = 125


def get_blp_core_default_values():
    """Generate default BLP core values (25 indikator, semua = 0)"""
    values = {}
    for domain, data in BLP_CORE_INDICATORS.items():
        values[domain] = {}
        for code, label in data['indicators']:
            values[domain][code] = 0
    return values


def calculate_core_scores(indicator_values):
    """
    Calculate scores using only core 25 indicators.
    Maps full indicator_values to core indicators only.
    """
    domain_scores = {}
    total = 0

    for domain, data in BLP_CORE_INDICATORS.items():
        domain_total = 0
        values = indicator_values.get(domain, {})

        for code, label in data['indicators']:
            score = values.get(code, 0)
            score = max(0, min(5, int(score) if score else 0))
            domain_total += score

        domain_scores[domain] = {
            'score': domain_total,
            'max_score': data['max_score'],
            'percentage': round((domain_total / data['max_score']) * 100, 1) if data['max_score'] > 0 else 0
        }
        total += domain_total

    return total, domain_scores


def get_blp_default_values():
    """Generate default BLP values (semua indikator = 0)"""
    values = {}
    for domain, data in BLP_INDICATORS.items():
        values[domain] = {}
        for code, label in data['indicators']:
            values[domain][code] = 0
    return values


class BLPEntry(models.Model):
    """
    Buku Lapangan Pesantren (BLP) - Penilaian Karakter Mingguan

    Setiap entry mencakup 59 indikator yang dikelompokkan dalam 6 domain.
    Penilaian dilakukan setiap minggu (Minggu-Sabtu).

    Scoring:
    - Setiap indikator: 0-5 poin (Belum/Sangat Kurang/Kurang/Cukup/Baik/Sangat Baik)
    - Total maksimal: 59 × 5 = 295 poin dasar
    - Bonus poin: max 95 poin (untuk pencapaian luar biasa)
    - Grand total maksimal: 390 poin
    """

    WEEK_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('locked', 'Locked'),
        ('archived', 'Archived'),
    ]

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='blp_entries'
    )

    # Periode mingguan
    week_start = models.DateField(
        help_text="Tanggal mulai minggu (Minggu)"
    )
    week_end = models.DateField(
        help_text="Tanggal akhir minggu (Sabtu)"
    )
    tahun_ajaran = models.CharField(max_length=10)
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')]
    )

    # JSONField untuk 59 indikator
    # Struktur: {"akhlak": {"sopan_santun": 4, "kejujuran": 5, ...}, ...}
    indicator_values = models.JSONField(
        default=get_blp_default_values,
        help_text="Nilai untuk setiap indikator BLP (59 total)"
    )

    # Bonus poin (untuk pencapaian luar biasa)
    bonus_points = models.PositiveIntegerField(
        default=0,
        validators=[MaxValueValidator(95)],
        help_text="Bonus poin untuk pencapaian luar biasa (max 95)"
    )
    bonus_notes = models.TextField(
        blank=True, null=True,
        help_text="Catatan untuk bonus poin"
    )

    # Calculated scores (di-cache untuk performa)
    total_score = models.PositiveIntegerField(
        default=0,
        help_text="Total skor (max 390)"
    )
    domain_scores = models.JSONField(
        default=dict,
        help_text="Skor per domain"
    )

    # Status & locking
    status = models.CharField(
        max_length=20,
        choices=WEEK_STATUS_CHOICES,
        default='draft'
    )
    is_locked = models.BooleanField(
        default=False,
        help_text="Jika True, entry tidak dapat diedit"
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.CharField(max_length=50, null=True, blank=True)

    # Catatan umum
    catatan = models.TextField(blank=True, null=True)
    tindak_lanjut = models.TextField(blank=True, null=True)

    # Pencatat
    pencatat = models.CharField(max_length=100)
    pencatat_username = models.CharField(max_length=50, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_blp_entry'
        ordering = ['-week_start', 'siswa']
        verbose_name = 'BLP Entry'
        verbose_name_plural = 'BLP Entries'
        unique_together = ['siswa', 'week_start']
        indexes = [
            models.Index(fields=['siswa', 'week_start'], name='idx_blp_siswa_week'),
            models.Index(fields=['week_start', 'week_end'], name='idx_blp_week_range'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_blp_periode'),
            models.Index(fields=['status'], name='idx_blp_status'),
            models.Index(fields=['is_locked'], name='idx_blp_locked'),
            models.Index(fields=['total_score'], name='idx_blp_score'),
        ]

    def __str__(self):
        return f"{self.siswa.nama} - {self.week_start} to {self.week_end} (Score: {self.total_score})"

    def calculate_scores(self):
        """Hitung total_score dan domain_scores dari indicator_values"""
        domain_scores = {}
        total = 0

        for domain, data in BLP_INDICATORS.items():
            domain_total = 0
            values = self.indicator_values.get(domain, {})

            for code, label in data['indicators']:
                score = values.get(code, 0)
                # Validasi range 0-5
                score = max(0, min(5, int(score) if score else 0))
                domain_total += score

            domain_scores[domain] = {
                'score': domain_total,
                'max_score': data['max_score'],
                'percentage': round((domain_total / data['max_score']) * 100, 1) if data['max_score'] > 0 else 0
            }
            total += domain_total

        # Tambah bonus
        total += self.bonus_points

        self.domain_scores = domain_scores
        self.total_score = min(total, 390)  # Cap at 390

        return self.total_score

    def save(self, *args, **kwargs):
        # Hitung scores sebelum save
        self.calculate_scores()
        super().save(*args, **kwargs)

    def lock(self, username=None):
        """Lock entry untuk mencegah edit"""
        if not self.is_locked:
            self.is_locked = True
            self.status = 'locked'
            self.locked_at = timezone.now()
            self.locked_by = username or 'SYSTEM'
            self.save()

    def is_editable(self):
        """Check apakah entry masih bisa diedit"""
        if self.is_locked or self.status == 'locked':
            return False

        # Auto-lock setelah minggu berakhir + 1 hari buffer
        today = timezone.now().date()
        from datetime import timedelta
        lock_date = self.week_end + timedelta(days=1)

        if today > lock_date:
            self.lock()
            return False

        return True

    @property
    def predikat(self):
        """Return predikat berdasarkan total_score"""
        percentage = (self.total_score / 390) * 100 if self.total_score else 0

        if percentage >= 90:
            return 'Mumtaz'
        elif percentage >= 75:
            return 'Jayyid Jiddan'
        elif percentage >= 60:
            return 'Jayyid'
        elif percentage >= 40:
            return 'Maqbul'
        else:
            return 'Perlu Pembinaan'


# ============================================
# EMPLOYEE EVALUATION (EVALUASI USTADZ/USTADZAH)
# ============================================

class EmployeeEvaluation(models.Model):
    """
    Model untuk menyimpan poin prestasi/pelanggaran Ustadz/Ustadzah.

    Poin diberikan berdasarkan:
    - Kehadiran mengajar (+5 per sesi)
    - Inval/penggantian (+5 untuk pengganti, -5 untuk yang digantikan)
    - Prestasi khusus (+10 - +50)
    - Pelanggaran (-5 - -50)
    """

    JENIS_CHOICES = [
        ('prestasi', 'Prestasi'),
        ('pelanggaran', 'Pelanggaran'),
        ('inval_plus', 'Bonus Inval (Pengganti)'),
        ('inval_minus', 'Potongan Inval (Absen)'),
        ('kehadiran', 'Bonus Kehadiran'),
        ('tugas_tambahan', 'Tugas Tambahan'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='employee_evaluations',
        help_text="Ustadz/Ustadzah yang dievaluasi"
    )

    tanggal = models.DateField()
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    poin = models.IntegerField(
        help_text="Poin evaluasi (positif untuk prestasi, negatif untuk pelanggaran)"
    )
    keterangan = models.TextField(
        help_text="Deskripsi evaluasi"
    )

    # Referensi ke InvalRecord jika ini adalah evaluasi auto-inval
    inval_record = models.ForeignKey(
        'InvalRecord',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='evaluations'
    )

    # Periode
    tahun_ajaran = models.CharField(max_length=10)
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')]
    )

    # Pencatat
    created_by = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_evaluations'
        ordering = ['-tanggal', '-created_at']
        verbose_name = 'Employee Evaluation'
        verbose_name_plural = 'Employee Evaluations'
        indexes = [
            models.Index(fields=['user', 'tanggal'], name='idx_emp_eval_user_tgl'),
            models.Index(fields=['jenis'], name='idx_emp_eval_jenis'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_emp_eval_periode'),
            models.Index(fields=['poin'], name='idx_emp_eval_poin'),
        ]

    def __str__(self):
        sign = '+' if self.poin > 0 else ''
        return f"{self.user.name} - {self.get_jenis_display()} ({sign}{self.poin}) - {self.tanggal}"


# ============================================
# INVAL RECORD (PENCATATAN PENGGANTIAN MENGAJAR)
# ============================================

class InvalRecord(models.Model):
    """
    Pencatatan penggantian mengajar (Inval).

    Ketika Ustadz tidak hadir dan digantikan, record ini dibuat.
    Sistem akan otomatis:
    - Memberi poin -5 ke Ustadz yang tidak hadir
    - Memberi poin +5 ke Ustadz pengganti

    Alur:
    1. Ustadz Piket input data inval via form
    2. Django Signal (post_save) triggered
    3. Signal handler membuat 2 EmployeeEvaluation records
    """

    ALASAN_CHOICES = [
        ('sakit', 'Sakit'),
        ('izin', 'Izin Pribadi'),
        ('dinas', 'Tugas Dinas'),
        ('darurat', 'Keperluan Darurat'),
        ('cuti', 'Cuti'),
        ('lainnya', 'Lainnya'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Verifikasi'),
        ('verified', 'Terverifikasi'),
        ('rejected', 'Ditolak'),
    ]

    id = models.BigAutoField(primary_key=True)

    # Ustadz yang tidak hadir
    guru_absent = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='inval_absences',
        help_text="Ustadz yang tidak hadir"
    )

    # Ustadz pengganti
    guru_pengganti = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='inval_substitutes',
        help_text="Ustadz pengganti"
    )

    # Detail penggantian
    tanggal = models.DateField()
    jam_pelajaran = models.CharField(
        max_length=20,
        help_text="Jam pelajaran yang digantikan, misal: JP 1-2"
    )
    kelas = models.CharField(max_length=20)
    mata_pelajaran = models.CharField(max_length=100)

    # Alasan
    alasan = models.CharField(max_length=20, choices=ALASAN_CHOICES)
    keterangan = models.TextField(
        blank=True, null=True,
        help_text="Keterangan tambahan"
    )

    # Bukti (opsional)
    bukti_file = models.FileField(
        upload_to='inval_bukti/',
        blank=True, null=True,
        help_text="Bukti surat izin/keterangan"
    )

    # Status verifikasi
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    verified_by = models.CharField(max_length=50, blank=True, null=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)

    # Auto-evaluation flags
    evaluation_created = models.BooleanField(
        default=False,
        help_text="Flag apakah evaluasi sudah dibuat"
    )

    # Pencatat (Ustadz Piket)
    recorded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='inval_records_created',
        help_text="Ustadz Piket yang mencatat"
    )
    recorded_by_username = models.CharField(max_length=50)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inval_records'
        ordering = ['-tanggal', '-created_at']
        verbose_name = 'Inval Record'
        verbose_name_plural = 'Inval Records'
        indexes = [
            models.Index(fields=['guru_absent', 'tanggal'], name='idx_inval_absent_tgl'),
            models.Index(fields=['guru_pengganti', 'tanggal'], name='idx_inval_pengganti_tgl'),
            models.Index(fields=['tanggal'], name='idx_inval_tanggal'),
            models.Index(fields=['status'], name='idx_inval_status'),
            models.Index(fields=['kelas'], name='idx_inval_kelas'),
        ]

    def __str__(self):
        return f"{self.guru_absent.name} → {self.guru_pengganti.name} ({self.kelas} {self.tanggal})"

    def verify(self, username):
        """Verifikasi inval record"""
        self.status = 'verified'
        self.verified_by = username
        self.verified_at = timezone.now()
        self.save()

    def reject(self, username, reason):
        """Tolak inval record"""
        self.status = 'rejected'
        self.verified_by = username
        self.verified_at = timezone.now()
        self.rejection_reason = reason
        self.save()


# ============================================
# INCIDENT (CATATAN & BIMBINGAN / CASE MANAGEMENT)
# ============================================

class Incident(models.Model):
    """
    Model untuk mencatat kejadian/masalah santri yang perlu pembahasan
    antar stakeholder (BK, Mudir, Wali Kelas).

    Workflow:
    1. BK/Wali Kelas mencatat kejadian (status: open)
    2. Pimpinan/BK menambah komentar (status: in_discussion)
    3. Mudir memberikan keputusan final (status: resolved)

    Wali Santri hanya melihat komentar yang visibility='public' atau 'final_decision'.
    """

    KATEGORI_CHOICES = [
        ('perilaku', 'Perilaku/Akhlak'),
        ('kedisiplinan', 'Kedisiplinan'),
        ('akademik', 'Akademik'),
        ('kesehatan', 'Kesehatan'),
        ('sosial', 'Interaksi Sosial'),
        ('keluarga', 'Masalah Keluarga'),
        ('lainnya', 'Lainnya'),
    ]

    TINGKAT_CHOICES = [
        ('ringan', 'Ringan'),
        ('sedang', 'Sedang'),
        ('berat', 'Berat'),
        ('kritis', 'Kritis'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_discussion', 'In Discussion'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='incidents',
        help_text="Santri yang terkait"
    )

    # Incident details
    judul = models.CharField(
        max_length=200,
        help_text="Judul/ringkasan kejadian"
    )
    deskripsi = models.TextField(
        help_text="Deskripsi lengkap kejadian"
    )
    kategori = models.CharField(
        max_length=20,
        choices=KATEGORI_CHOICES,
        default='perilaku'
    )
    tingkat = models.CharField(
        max_length=20,
        choices=TINGKAT_CHOICES,
        default='ringan'
    )
    tanggal_kejadian = models.DateField(
        help_text="Tanggal kejadian terjadi"
    )
    lokasi = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Lokasi kejadian"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open'
    )

    # Pelapor
    pelapor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='incidents_reported',
        help_text="Ustadz yang melaporkan"
    )
    pelapor_role = models.CharField(
        max_length=50,
        help_text="Role pelapor saat melapor (BK, Wali Kelas, etc.)"
    )

    # Assignment
    assigned_to = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incidents_assigned',
        help_text="Ustadz yang ditugaskan menangani"
    )

    # Final decision
    keputusan_final = models.TextField(
        blank=True,
        null=True,
        help_text="Keputusan akhir dari Mudir"
    )
    diputuskan_oleh = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incidents_decided',
        help_text="Pimpinan yang memberikan keputusan"
    )
    tanggal_keputusan = models.DateTimeField(null=True, blank=True)

    # Tindak lanjut
    tindak_lanjut = models.TextField(
        blank=True,
        null=True,
        help_text="Rencana tindak lanjut"
    )
    deadline_tindak_lanjut = models.DateField(null=True, blank=True)

    # Tahun ajaran
    tahun_ajaran = models.CharField(max_length=10, default='2025/2026')
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')],
        default='Ganjil'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_incident'
        ordering = ['-created_at', '-tanggal_kejadian']
        verbose_name = 'Incident'
        verbose_name_plural = 'Incidents'
        indexes = [
            models.Index(fields=['siswa', 'status'], name='idx_incident_siswa_status'),
            models.Index(fields=['status'], name='idx_incident_status'),
            models.Index(fields=['kategori'], name='idx_incident_kategori'),
            models.Index(fields=['tingkat'], name='idx_incident_tingkat'),
            models.Index(fields=['tanggal_kejadian'], name='idx_incident_tanggal'),
            models.Index(fields=['pelapor'], name='idx_incident_pelapor'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_incident_periode'),
        ]

    def __str__(self):
        return f"{self.siswa.nama} - {self.judul} ({self.get_status_display()})"

    @property
    def status_icon(self):
        """Return emoji icon for status"""
        icons = {
            'open': '🔴',
            'in_discussion': '🟡',
            'resolved': '🟢',
            'closed': '⚫',
        }
        return icons.get(self.status, '⚪')

    @property
    def comment_count(self):
        return self.comments.count()

    def resolve(self, user, keputusan):
        """Resolve incident with final decision"""
        self.status = 'resolved'
        self.keputusan_final = keputusan
        self.diputuskan_oleh = user
        self.tanggal_keputusan = timezone.now()
        self.save()


class IncidentComment(models.Model):
    """
    Komentar/tanggapan pada sebuah Incident.

    Setiap komentar mencatat:
    - Role pengirim (BK, Mudir, Wali Kelas, etc.)
    - Visibility level (internal, public, final_decision)

    Wali Santri hanya bisa melihat komentar dengan visibility:
    - 'public': Komentar yang boleh dilihat wali santri
    - 'final_decision': Keputusan final dari Mudir
    """

    VISIBILITY_CHOICES = [
        ('internal', 'Internal (Hanya Ustadz)'),
        ('public', 'Public (Termasuk Wali Santri)'),
        ('final_decision', 'Final Decision'),
    ]

    COMMENT_TYPE_CHOICES = [
        ('observation', 'Observasi'),
        ('suggestion', 'Saran'),
        ('evaluation', 'Evaluasi'),
        ('decision', 'Keputusan'),
        ('follow_up', 'Tindak Lanjut'),
        ('note', 'Catatan'),
    ]

    id = models.BigAutoField(primary_key=True)
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='comments'
    )

    # Comment content
    content = models.TextField(
        help_text="Isi komentar/tanggapan"
    )
    comment_type = models.CharField(
        max_length=20,
        choices=COMMENT_TYPE_CHOICES,
        default='note'
    )

    # Author info
    author = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='incident_comments'
    )
    author_role = models.CharField(
        max_length=50,
        help_text="Role penulis saat berkomentar"
    )
    author_role_display = models.CharField(
        max_length=100,
        blank=True,
        help_text="Nama jabatan untuk display (e.g., 'Guru BK', 'Mudir')"
    )

    # Visibility control
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='internal',
        help_text="Siapa yang bisa melihat komentar ini"
    )

    # For threaded replies
    parent_comment = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )

    # Attachments (optional)
    attachment = models.FileField(
        upload_to='incident_attachments/',
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_incident_comment'
        ordering = ['created_at']
        verbose_name = 'Incident Comment'
        verbose_name_plural = 'Incident Comments'
        indexes = [
            models.Index(fields=['incident', 'created_at'], name='idx_comment_incident_time'),
            models.Index(fields=['author'], name='idx_comment_author'),
            models.Index(fields=['visibility'], name='idx_comment_visibility'),
            models.Index(fields=['comment_type'], name='idx_comment_type'),
        ]

    def __str__(self):
        return f"Comment by {self.author_role_display or self.author_role} on {self.incident.judul}"

    @property
    def is_visible_to_walisantri(self):
        """Check if comment is visible to walisantri"""
        return self.visibility in ['public', 'final_decision']

    def save(self, *args, **kwargs):
        # Auto-set author_role_display if not provided
        if not self.author_role_display and self.author:
            role_map = {
                'superadmin': 'Administrator',
                'pimpinan': 'Mudir/Pimpinan',
                'guru': 'Guru/Ustadz',
                'musyrif': 'Musyrif',
                'wali_kelas': 'Wali Kelas',
                'bk': 'Guru BK',
            }
            self.author_role_display = role_map.get(self.author.role, self.author.role)

        # Update incident status when comment is added
        if self.incident.status == 'open':
            self.incident.status = 'in_discussion'
            self.incident.save(update_fields=['status', 'updated_at'])

        super().save(*args, **kwargs)


# ============================================
# ASATIDZ EVALUATION (CATATAN EVALUASI USTADZ/KARYAWAN)
# ============================================

class AsatidzEvaluation(models.Model):
    """
    Model untuk mencatat evaluasi Ustadz/Karyawan oleh Mudir.

    Berbeda dengan EmployeeEvaluation (poin-based), model ini bersifat
    narrative/descriptive seperti sistem Catatan Santri.

    Kategori:
    - apresiasi: Pencapaian positif yang perlu diapresiasi
    - administratif: Catatan terkait administrasi (izin, dokumen, dll)
    - kedisiplinan: Catatan terkait kedisiplinan kerja

    Workflow:
    1. Mudir mencatat evaluasi
    2. (Opsional) Dapat dilihat ustadz yang bersangkutan
    3. Data digunakan untuk review kinerja berkala
    """

    KATEGORI_CHOICES = [
        ('apresiasi', 'Apresiasi'),
        ('administratif', 'Administratif'),
        ('kedisiplinan', 'Kedisiplinan'),
    ]

    id = models.BigAutoField(primary_key=True)

    # Target evaluasi (Ustadz/Karyawan)
    ustadz = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='asatidz_evaluations',
        help_text="Ustadz/Karyawan yang dievaluasi"
    )

    # Detail evaluasi
    tanggal_kejadian = models.DateField(
        help_text="Tanggal kejadian/observasi"
    )
    kategori = models.CharField(
        max_length=20,
        choices=KATEGORI_CHOICES,
        default='administratif'
    )
    deskripsi = models.TextField(
        help_text="Deskripsi lengkap evaluasi"
    )

    # Pelapor (auto-filled dengan akun Mudir)
    dilaporkan_oleh = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='asatidz_evaluations_reported',
        help_text="Mudir/Pimpinan yang membuat evaluasi"
    )

    # Periode
    tahun_ajaran = models.CharField(max_length=10, default='2025/2026')
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')],
        default='Ganjil'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_asatidz_evaluation'
        ordering = ['-tanggal_kejadian', '-created_at']
        verbose_name = 'Asatidz Evaluation'
        verbose_name_plural = 'Asatidz Evaluations'
        indexes = [
            models.Index(fields=['ustadz', 'tanggal_kejadian'], name='idx_asatidz_ustadz_tgl'),
            models.Index(fields=['kategori'], name='idx_asatidz_kategori'),
            models.Index(fields=['dilaporkan_oleh'], name='idx_asatidz_pelapor'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_asatidz_periode'),
            models.Index(fields=['tanggal_kejadian'], name='idx_asatidz_tanggal'),
        ]

    def __str__(self):
        return f"{self.ustadz.name} - {self.get_kategori_display()} ({self.tanggal_kejadian})"

    @property
    def kategori_icon(self):
        """Return emoji icon for kategori"""
        icons = {
            'apresiasi': '🌟',
            'administratif': '📋',
            'kedisiplinan': '⚠️',
        }
        return icons.get(self.kategori, '📝')


# ============================================
# PENILAIAN KINERJA ASATIDZ (STAR RATING SYSTEM)
# ============================================

class IndikatorKinerja(models.Model):
    """
    Master data untuk indikator penilaian kinerja Ustadz/Karyawan.

    Indikator dapat bersifat:
    - Manual: Diisi langsung oleh penilai (rating bintang 1-5)
    - Auto-calculated: Ditarik dari data lain (misal: Kedisiplinan dari absensi)

    Contoh indikator:
    - Kerjasama Tim (manual)
    - Integritas (manual)
    - Kedisiplinan (auto dari absensi)
    - Kualitas Mengajar (manual)
    """

    id = models.BigAutoField(primary_key=True)
    nama_indikator = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nama indikator penilaian, misal: 'Kerjasama Tim'"
    )
    deskripsi = models.TextField(
        blank=True,
        null=True,
        help_text="Deskripsi lengkap tentang indikator ini"
    )
    urutan = models.PositiveIntegerField(
        default=0,
        help_text="Urutan tampilan (0 = paling atas)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Jika False, indikator tidak akan muncul di form penilaian"
    )
    is_auto_calculated = models.BooleanField(
        default=False,
        help_text="Jika True, nilai diambil dari data lain (misal: absensi untuk Kedisiplinan)"
    )
    auto_source = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        choices=[
            ('attendance', 'Absensi Kelas'),
            ('inval', 'Data Penggantian Mengajar'),
            ('evaluation', 'Evaluasi Santri'),
        ],
        help_text="Sumber data untuk indikator auto-calculated"
    )
    bobot = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.00,
        help_text="Bobot indikator untuk perhitungan rata-rata tertimbang"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_indikator_kinerja'
        ordering = ['urutan', 'nama_indikator']
        verbose_name = 'Indikator Kinerja'
        verbose_name_plural = 'Indikator Kinerja'

    def __str__(self):
        auto_tag = " [AUTO]" if self.is_auto_calculated else ""
        status = "" if self.is_active else " (Nonaktif)"
        return f"{self.nama_indikator}{auto_tag}{status}"


class PenilaianKinerjaAsatidz(models.Model):
    """
    Header penilaian kinerja Ustadz/Karyawan.

    Setiap record merepresentasikan satu sesi penilaian untuk satu ustadz
    pada satu periode (tahun ajaran + semester).

    Workflow:
    1. Mudir membuat penilaian baru untuk ustadz
    2. Sistem mengisi detail untuk setiap indikator aktif
    3. Mudir mengisi rating bintang (1-5) per indikator
    4. Sistem menghitung rata-rata tertimbang otomatis
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('finalized', 'Finalized'),
    ]

    id = models.BigAutoField(primary_key=True)

    # Target penilaian
    ustadz = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='penilaian_kinerja',
        help_text="Ustadz/Karyawan yang dinilai"
    )

    # Periode penilaian
    tahun_ajaran = models.ForeignKey(
        'core.TahunAjaran',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='penilaian_kinerja',
        help_text="Periode tahun ajaran"
    )
    tahun_ajaran_nama = models.CharField(
        max_length=20,
        default='2025/2026',
        help_text="Nama tahun ajaran (backup jika FK null)"
    )
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')],
        default='Ganjil'
    )

    # Penilai
    penilai = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='penilaian_diberikan',
        help_text="Mudir/Pimpinan yang memberikan penilaian"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Catatan tambahan
    catatan_tambahan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan umum dari penilai"
    )

    # Calculated fields (auto-updated on save)
    rata_rata_nilai = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
        help_text="Rata-rata tertimbang (1.00 - 5.00)"
    )
    total_indikator = models.PositiveIntegerField(
        default=0,
        help_text="Jumlah indikator yang dinilai"
    )

    # Timestamps
    tanggal_penilaian = models.DateField(
        auto_now_add=True,
        help_text="Tanggal penilaian dibuat"
    )
    finalized_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Waktu finalisasi penilaian"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_penilaian_kinerja'
        ordering = ['-created_at']
        verbose_name = 'Penilaian Kinerja Asatidz'
        verbose_name_plural = 'Penilaian Kinerja Asatidz'
        # Satu ustadz hanya bisa punya 1 penilaian per periode
        unique_together = ['ustadz', 'tahun_ajaran_nama', 'semester']
        indexes = [
            models.Index(fields=['ustadz', 'tahun_ajaran_nama'], name='idx_penilaian_ustadz_tahun'),
            models.Index(fields=['status'], name='idx_penilaian_status'),
            models.Index(fields=['penilai'], name='idx_penilaian_penilai'),
            models.Index(fields=['tanggal_penilaian'], name='idx_penilaian_tanggal'),
        ]

    def __str__(self):
        return f"Penilaian {self.ustadz.name} - {self.tahun_ajaran_nama} {self.semester}"

    def calculate_rata_rata(self):
        """Hitung rata-rata tertimbang dari semua detail penilaian."""
        details = self.detail_penilaian.all()

        if not details.exists():
            self.rata_rata_nilai = 0
            self.total_indikator = 0
            return

        total_bobot = 0
        total_nilai_tertimbang = 0

        for detail in details:
            if detail.nilai_bintang and detail.nilai_bintang > 0:
                bobot = float(detail.indikator.bobot)
                total_bobot += bobot
                total_nilai_tertimbang += detail.nilai_bintang * bobot

        if total_bobot > 0:
            self.rata_rata_nilai = round(total_nilai_tertimbang / total_bobot, 2)
        else:
            self.rata_rata_nilai = 0

        self.total_indikator = details.filter(nilai_bintang__gt=0).count()

    def save(self, *args, **kwargs):
        # Auto-calculate rata-rata sebelum save
        if self.pk:  # Only if already saved (has details)
            self.calculate_rata_rata()
        super().save(*args, **kwargs)

    def finalize(self):
        """Finalisasi penilaian (tidak bisa diedit lagi)."""
        self.status = 'finalized'
        self.finalized_at = timezone.now()
        self.calculate_rata_rata()
        self.save()

    @property
    def predikat(self):
        """Return predikat berdasarkan rata-rata nilai."""
        avg = float(self.rata_rata_nilai)
        if avg >= 4.5:
            return 'Sangat Baik'
        elif avg >= 3.5:
            return 'Baik'
        elif avg >= 2.5:
            return 'Cukup'
        elif avg >= 1.5:
            return 'Kurang'
        else:
            return 'Sangat Kurang'

    @property
    def is_complete(self):
        """Check apakah semua indikator sudah dinilai."""
        active_indicators = IndikatorKinerja.objects.filter(is_active=True).count()
        filled_details = self.detail_penilaian.filter(nilai_bintang__gt=0).count()
        return filled_details >= active_indicators


class DetailPenilaianKinerja(models.Model):
    """
    Detail penilaian per indikator.

    Setiap record merepresentasikan nilai untuk satu indikator
    dalam satu penilaian.
    """

    NILAI_CHOICES = [
        (1, '⭐ Sangat Kurang'),
        (2, '⭐⭐ Kurang'),
        (3, '⭐⭐⭐ Cukup'),
        (4, '⭐⭐⭐⭐ Baik'),
        (5, '⭐⭐⭐⭐⭐ Sangat Baik'),
    ]

    id = models.BigAutoField(primary_key=True)

    # Relasi ke header penilaian
    penilaian = models.ForeignKey(
        PenilaianKinerjaAsatidz,
        on_delete=models.CASCADE,
        related_name='detail_penilaian'
    )

    # Relasi ke indikator
    indikator = models.ForeignKey(
        IndikatorKinerja,
        on_delete=models.PROTECT,
        related_name='detail_penilaian'
    )

    # Nilai bintang (1-5)
    nilai_bintang = models.PositiveSmallIntegerField(
        choices=NILAI_CHOICES,
        null=True,
        blank=True,
        help_text="Rating bintang 1-5"
    )

    # Catatan per indikator (opsional)
    catatan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan khusus untuk indikator ini"
    )

    # Flag untuk nilai auto-calculated
    is_auto_filled = models.BooleanField(
        default=False,
        help_text="True jika nilai diisi otomatis dari data lain"
    )
    auto_calculation_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Data detail perhitungan otomatis"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kesantrian_detail_penilaian_kinerja'
        ordering = ['indikator__urutan', 'indikator__nama_indikator']
        verbose_name = 'Detail Penilaian Kinerja'
        verbose_name_plural = 'Detail Penilaian Kinerja'
        # Satu indikator per penilaian
        unique_together = ['penilaian', 'indikator']
        indexes = [
            models.Index(fields=['penilaian', 'indikator'], name='idx_detail_penilaian_indikator'),
            models.Index(fields=['nilai_bintang'], name='idx_detail_nilai'),
        ]

    def __str__(self):
        stars = '⭐' * (self.nilai_bintang or 0)
        return f"{self.penilaian.ustadz.name} - {self.indikator.nama_indikator}: {stars}"

    @property
    def nilai_display(self):
        """Return display text for nilai."""
        if not self.nilai_bintang:
            return "Belum dinilai"
        return dict(self.NILAI_CHOICES).get(self.nilai_bintang, "-")


# =============================================================
# KELAS NORMALIZATION - Database Level Guard
# =============================================================

@receiver(pre_save, sender=InvalRecord)
def normalize_inval_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in InvalRecord model.
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
