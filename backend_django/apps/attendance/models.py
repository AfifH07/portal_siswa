from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.students.models import Student, normalize_kelas_format


class Attendance(models.Model):
    """
    Model Absensi dengan dukungan Jam Pelajaran (JP)

    Struktur Jam Pelajaran:
    - Pagi: JP 1
    - Siang: JP 2-7
    - Sore: JP 8-9

    Unique constraint: (nisn, tanggal, jam_ke) - satu record per siswa per jam

    Fields tambahan v2.3.9:
    - tipe_pengajar: guru_pengampu atau guru_piket
    - guru_pengganti: FK ke User (jika tipe_pengajar='guru_piket')
    - tujuan_pembelajaran: Tujuan pembelajaran yang ingin dicapai
    - capaian_pembelajaran: Capaian pembelajaran yang dicapai
    - materi: Materi yang diajarkan
    - catatan: Catatan tambahan dari guru
    """

    # Choices untuk jam_ke
    JAM_PELAJARAN_CHOICES = [
        (1, 'JP 1 (Pagi)'),
        (2, 'JP 2'),
        (3, 'JP 3'),
        (4, 'JP 4'),
        (5, 'JP 5'),
        (6, 'JP 6'),
        (7, 'JP 7'),
        (8, 'JP 8 (Sore)'),
        (9, 'JP 9 (Sore)'),
    ]

    # Choices untuk tipe_pengajar
    TIPE_PENGAJAR_CHOICES = [
        ('guru_pengampu', 'Guru Pengampu'),
        ('guru_piket', 'Guru Piket'),
    ]

    nisn = models.ForeignKey(Student, on_delete=models.CASCADE, db_column='nisn')
    tanggal = models.DateField()
    jam_ke = models.PositiveSmallIntegerField(
        choices=JAM_PELAJARAN_CHOICES,
        default=1,
        help_text="Jam Pelajaran (1-9)"
    )
    mata_pelajaran = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50)
    keterangan = models.TextField(blank=True, null=True)

    # === NEW FIELDS v2.3.9 ===
    tipe_pengajar = models.CharField(
        max_length=20,
        choices=TIPE_PENGAJAR_CHOICES,
        default='guru_pengampu',
        help_text="Apakah yang mengajar guru pengampu atau guru piket"
    )
    guru_pengganti = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_as_pengganti',
        help_text="Diisi jika tipe_pengajar='guru_pengganti'"
    )
    tujuan_pembelajaran = models.TextField(
        blank=True,
        null=True,
        help_text="Tujuan pembelajaran yang ingin dicapai pada sesi ini"
    )
    capaian_pembelajaran = models.TextField(
        blank=True,
        null=True,
        help_text="Capaian pembelajaran yang dicapai pada sesi ini"
    )
    materi = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Materi yang diajarkan"
    )
    catatan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan tambahan dari guru"
    )
    ada_penilaian = models.BooleanField(
        default=False,
        help_text="Tandai jika sesi ini ada penilaian yang perlu diinput"
    )
    ketuntasan_materi = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Persentase ketuntasan materi (0-100)"
    )
    # === END NEW FIELDS ===

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance'
        indexes = [
            models.Index(fields=['nisn']),
            models.Index(fields=['tanggal']),
            models.Index(fields=['jam_ke']),
        ]
        # Unique constraint: satu record per siswa per tanggal per jam pelajaran
        unique_together = ['nisn', 'tanggal', 'jam_ke']
        ordering = ['tanggal', 'jam_ke', 'nisn']

    def __str__(self):
        return f"{self.nisn} - {self.tanggal} JP{self.jam_ke}"

    @property
    def waktu_kategori(self):
        """Return kategori waktu berdasarkan jam_ke"""
        if self.jam_ke == 1:
            return 'Pagi'
        elif self.jam_ke <= 7:
            return 'Siang'
        else:
            return 'Sore'

    @classmethod
    def get_jam_label(cls, jam_ke):
        """Return label untuk jam_ke tertentu"""
        for choice in cls.JAM_PELAJARAN_CHOICES:
            if choice[0] == jam_ke:
                return choice[1]
        return f'JP {jam_ke}'


class AttendanceDraft(models.Model):
    """
    Draft absensi untuk menyimpan data sementara sebelum submit

    Field `data` menyimpan JSON dengan struktur:
    {
        "jam_ke": [2, 3],  // Array jam pelajaran
        "students": [
            {"nisn": "xxx", "nama": "xxx", "status": "Hadir", "keterangan": ""}
        ]
    }
    """
    username = models.CharField(max_length=50)
    kelas = models.CharField(max_length=20)
    tanggal = models.DateField()
    mata_pelajaran = models.CharField(max_length=100)
    data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_draft'

    def __str__(self):
        return f"{self.kelas} - {self.tanggal} - {self.mata_pelajaran}"


# =============================================================
# KELAS NORMALIZATION - Database Level Guard
# =============================================================

@receiver(pre_save, sender=AttendanceDraft)
def normalize_attendance_draft_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in AttendanceDraft model.
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized


class TitipanTugas(models.Model):
    """
    Model untuk titipan tugas dari guru yang berhalangan mengajar.
    Guru piket dapat menandai tugas sebagai dikerjakan.
    """
    STATUS_CHOICES = [
        ('menunggu', 'Menunggu'),
        ('dikerjakan', 'Dikerjakan'),
    ]

    guru = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='titipan_tugas',
        help_text="Guru yang menitipkan tugas"
    )
    kelas = models.CharField(max_length=20)
    mata_pelajaran = models.CharField(max_length=100)
    jam_ke = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Jam pelajaran ke berapa (opsional)"
    )
    tanggal_berlaku = models.DateField(help_text="Tanggal tugas harus dikerjakan")
    deskripsi_tugas = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='menunggu'
    )
    guru_piket = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tugas_dikerjakan',
        help_text="Guru piket yang mengerjakan tugas"
    )
    catatan_piket = models.TextField(null=True, blank=True)
    tahun_ajaran = models.ForeignKey(
        'core.TahunAjaran',
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'titipan_tugas'
        ordering = ['tanggal_berlaku', 'kelas']
        verbose_name = 'Titipan Tugas'
        verbose_name_plural = 'Titipan Tugas'

    def __str__(self):
        return f"{self.kelas} - {self.mata_pelajaran} ({self.tanggal_berlaku})"


@receiver(pre_save, sender=TitipanTugas)
def normalize_titipan_tugas_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in TitipanTugas model.
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
