import re
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone


class Student(models.Model):
    """
    Model Santri dengan dukungan sistem Alumni.

    Status:
    - aktif: Santri masih terdaftar dan mengikuti kegiatan
    - alumni: Santri sudah lulus/keluar, data read-only
    - pindah: Santri pindah ke lembaga lain
    - dikeluarkan: Santri dikeluarkan dari pesantren
    """

    STATUS_CHOICES = [
        ('aktif', 'Aktif'),
        ('alumni', 'Alumni'),
        ('pindah', 'Pindah'),
        ('dikeluarkan', 'Dikeluarkan'),
    ]

    nisn = models.CharField(max_length=20, unique=True)
    nama = models.CharField(max_length=100)
    kelas = models.CharField(max_length=20, blank=True, null=True)
    program = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)

    # Personal info
    tempat_lahir = models.CharField(max_length=100, blank=True, null=True)
    tanggal_lahir = models.DateField(blank=True, null=True)
    alamat = models.TextField(blank=True, null=True)
    jenis_kelamin = models.CharField(
        max_length=1,
        choices=[('L', 'Laki-laki'), ('P', 'Perempuan')],
        blank=True, null=True
    )

    # Wali (Guardian) info
    wali_nama = models.CharField(max_length=100, blank=True, null=True)
    wali_name = models.CharField(max_length=100, blank=True, null=True)  # Alias for compatibility
    wali_phone = models.CharField(max_length=20, blank=True, null=True)
    wali_hubungan = models.CharField(max_length=50, blank=True, null=True)  # Ayah/Ibu/Wali

    # Academic
    tanggal_masuk = models.DateField(blank=True, null=True)
    target_hafalan = models.IntegerField(default=0)
    current_hafalan = models.IntegerField(default=0)
    target_nilai = models.IntegerField(default=75)

    # Status fields
    aktif = models.BooleanField(default=True)  # Legacy field, kept for compatibility
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='aktif',
        help_text="Status santri (aktif/alumni/pindah/dikeluarkan)"
    )

    # Alumni specific fields
    tahun_lulus = models.CharField(max_length=10, blank=True, null=True)  # e.g., "2025/2026"
    tanggal_keluar = models.DateField(blank=True, null=True)
    alasan_keluar = models.TextField(blank=True, null=True)
    ijazah_diterima = models.BooleanField(default=False)
    catatan_alumni = models.TextField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        ordering = ['nisn']
        indexes = [
            models.Index(fields=['nisn']),
            models.Index(fields=['nama']),
            models.Index(fields=['kelas']),
            models.Index(fields=['program']),
            models.Index(fields=['aktif']),
            models.Index(fields=['status']),
            models.Index(fields=['tahun_lulus']),
        ]

    def __str__(self):
        return f"{self.nisn} - {self.nama}"

    def save(self, *args, **kwargs):
        # Sync aktif field with status
        self.aktif = (self.status == 'aktif')

        # Set wali_name from wali_nama for compatibility
        if self.wali_nama and not self.wali_name:
            self.wali_name = self.wali_nama

        super().save(*args, **kwargs)

    def set_alumni(self, tahun_lulus=None, catatan=None):
        """
        Convert student to alumni status.

        Args:
            tahun_lulus: Academic year of graduation (e.g., '2025/2026')
            catatan: Additional notes
        """
        self.status = 'alumni'
        self.aktif = False
        self.tanggal_keluar = timezone.now().date()
        if tahun_lulus:
            self.tahun_lulus = tahun_lulus
        if catatan:
            self.catatan_alumni = catatan
        self.save()

    @property
    def is_alumni(self):
        return self.status == 'alumni'

    @property
    def is_active(self):
        return self.status == 'aktif'


class Schedule(models.Model):
    """
    Model Jadwal Mengajar Guru.

    Field `jam` (legacy) dipertahankan untuk kompatibilitas data lama.
    Field baru (jam_mulai, jam_selesai, jam_ke, tahun_ajaran, semester)
    ditambahkan dengan nullable=True.
    """
    HARI_CHOICES = [
        ('Senin', 'Senin'),
        ('Selasa', 'Selasa'),
        ('Rabu', 'Rabu'),
        ('Kamis', 'Kamis'),
        ('Jumat', 'Jumat'),
        ('Sabtu', 'Sabtu'),
    ]

    SEMESTER_CHOICES = [
        ('Ganjil', 'Ganjil'),
        ('Genap', 'Genap'),
    ]

    username = models.CharField(max_length=50, help_text="Username guru")
    kelas = models.CharField(max_length=20)
    hari = models.CharField(max_length=20, choices=HARI_CHOICES)

    # Legacy field - dipertahankan untuk kompatibilitas
    jam = models.CharField(max_length=20, blank=True, null=True, help_text="Legacy: format bebas jam")

    # New fields untuk jadwal terstruktur
    jam_ke = models.IntegerField(
        blank=True, null=True,
        help_text="Jam pelajaran ke-N (1-10)"
    )
    jam_mulai = models.TimeField(
        blank=True, null=True,
        help_text="Waktu mulai pelajaran"
    )
    jam_selesai = models.TimeField(
        blank=True, null=True,
        help_text="Waktu selesai pelajaran"
    )

    mata_pelajaran = models.CharField(max_length=100, blank=True, null=True)

    # Periode akademik
    tahun_ajaran = models.ForeignKey(
        'core.TahunAjaran',
        on_delete=models.SET_NULL,
        blank=True, null=True,
        related_name='schedules',
        help_text="Tahun ajaran jadwal ini berlaku"
    )
    semester = models.CharField(
        max_length=10,
        choices=SEMESTER_CHOICES,
        blank=True, null=True
    )

    # Status aktif
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'schedules'
        ordering = ['hari', 'jam_ke', 'jam_mulai']
        indexes = [
            models.Index(fields=['username', 'hari'], name='idx_schedule_user_hari'),
            models.Index(fields=['kelas', 'hari'], name='idx_schedule_kelas_hari'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_schedule_periode'),
        ]

    def __str__(self):
        jam_display = f"Jam ke-{self.jam_ke}" if self.jam_ke else self.jam or "-"
        return f"{self.kelas} - {self.hari} {jam_display} - {self.mata_pelajaran or 'N/A'}"

    @property
    def waktu_display(self):
        """Return formatted time range."""
        if self.jam_mulai and self.jam_selesai:
            return f"{self.jam_mulai.strftime('%H:%M')} - {self.jam_selesai.strftime('%H:%M')}"
        elif self.jam:
            return self.jam
        return "-"


# =============================================================
# KELAS NORMALIZATION - Database Level Guard
# =============================================================
# Ensures all kelas values are stored in standard format: "X A", "XI B", "XII C"
# This catches data from seeders, scripts, and any other bypass of serializer validation.

# Mapping Arabic numerals to Roman numerals
ARABIC_TO_ROMAN = {
    '10': 'X',
    '11': 'XI',
    '12': 'XII',
}

# Valid values
VALID_GRADES = ['X', 'XI', 'XII']
VALID_SECTIONS = ['A', 'B', 'C', 'D']


def normalize_kelas_format(value):
    """
    Normalize class name to standard format: "X A", "XI B", "XII C".

    Handles various input formats:
    - "10-A", "11-B", "12-C" → "X A", "XI B", "XII C"
    - "X-A", "XI-B", "XII-C" → "X A", "XI B", "XII C"
    - "XA", "XIB", "XIIC" → "X A", "XI B", "XII C"
    - "x a", "xi b" → "X A", "XI B" (case insensitive)

    Returns None if value is empty/None.
    Returns original value if format cannot be parsed (logs warning).
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
    # Matches: "XII A", "XII-A", "XII_A", "XIIA", "XII  A"
    match = re.match(r'^(XII|XI|X)\s*[-_]?\s*([A-D])$', value)

    if match:
        grade = match.group(1)
        section = match.group(2)

        if grade in VALID_GRADES and section in VALID_SECTIONS:
            return f"{grade} {section}"

    # If we can't parse it, return original and log warning
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"[normalize_kelas] Could not parse kelas format: '{original}' → keeping as-is")

    return original


@receiver(pre_save, sender=Student)
def normalize_student_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field before saving to database.
    Acts as a "database guard" to ensure consistent format even when
    serializer validation is bypassed (e.g., direct ORM operations, seeders).
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[Student.pre_save] Normalized kelas: '{instance.kelas}' → '{normalized}'")
            instance.kelas = normalized


@receiver(pre_save, sender=Schedule)
def normalize_schedule_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in Schedule model.
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
