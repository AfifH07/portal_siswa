from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from apps.students.models import Student, normalize_kelas_format


class Grade(models.Model):
    SEMESTER_CHOICES = [
        ('Ganjil', 'Ganjil'),
        ('Genap', 'Genap'),
    ]

    # JENIS_CHOICES v2 - extended with more assessment types
    # NOTE: Old values ('UH', 'Tugas', 'Proyek', 'UTS', 'UAS') tetap valid di database
    JENIS_CHOICES = [
        ('penugasan', 'Penugasan'),
        ('tes_tulis', 'Tes Tulis'),
        ('tes_lisan', 'Tes Lisan'),
        ('portofolio', 'Portofolio'),
        ('praktek', 'Praktek'),
        ('proyek', 'Proyek'),
        ('uts', 'UTS'),
        ('uas', 'UAS'),
        # Legacy values (untuk backward compatibility)
        ('UH', 'Ulangan Harian'),
        ('UTS', 'Ujian Tengah Semester'),
        ('UAS', 'Ujian Akhir Semester'),
        ('Tugas', 'Tugas'),
        ('Proyek', 'Proyek (Legacy)'),
    ]

    nisn = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        db_column='nisn',
        related_name='grades'
    )
    mata_pelajaran = models.CharField(max_length=100)
    nilai = models.IntegerField()
    semester = models.CharField(max_length=20, choices=SEMESTER_CHOICES)
    tahun_ajaran = models.CharField(max_length=10)
    jenis = models.CharField(max_length=50, choices=JENIS_CHOICES)
    kelas = models.CharField(max_length=20)
    guru = models.CharField(max_length=100)
    materi = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Materi/topik yang dinilai"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'grades'
        ordering = ['-created_at']
        verbose_name = 'Nilai'
        verbose_name_plural = 'Nilai'
        indexes = [
            models.Index(fields=['nisn']),
            models.Index(fields=['kelas']),
            models.Index(fields=['semester']),
            models.Index(fields=['tahun_ajaran']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        
        if self.nilai < 0 or self.nilai > 100:
            raise ValidationError({'nilai': 'Nilai harus antara 0-100'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nisn.nama} - {self.mata_pelajaran} ({self.jenis})"


@receiver(pre_save, sender=Grade)
def normalize_grade_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in Grade model.
    Ensures consistent format: "X A", "XI B", "XII C".
    """
    if instance.kelas:
        normalized = normalize_kelas_format(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
