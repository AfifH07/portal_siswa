from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from apps.students.models import Student, normalize_kelas_format


class Attendance(models.Model):
    """
    Model Absensi dengan dukungan Jam Pelajaran (JP)

    Struktur Jam Pelajaran:
    - Pagi: JP 1
    - Siang: JP 2-7
    - Sore: JP 8-9

    Unique constraint: (nisn, tanggal, jam_ke) - satu record per siswa per jam
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
