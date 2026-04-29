from django.db import models
from django.conf import settings
from apps.students.models import Student


class Evaluation(models.Model):
    JENIS_CHOICES = [
        ('prestasi', 'Prestasi'),
        ('pelanggaran', 'Pelanggaran'),
    ]

    KATEGORI_CHOICES = [
        ('adab', 'Adab'),
        ('kedisiplinan', 'Kedisiplinan'),
        ('akademik', 'Akademik'),
        ('kebersihan', 'Kebersihan'),
        ('hafalan', 'Hafalan'),
        ('sosial', 'Sosial'),
    ]

    # PERUBAHAN 1: Status dengan label "Dalam Penanganan"
    STATUS_CHOICES = [
        ('dalam_pembahasan', 'Dalam Penanganan'),  # Label diubah dari "Dalam Pembahasan"
        ('resolved', 'Selesai'),
    ]

    # PERUBAHAN 3: Visibility dengan 2 pilihan saja
    VISIBILITY_CHOICES = [
        ('internal', 'Internal (Guru & Admin)'),
        ('public', 'Semua Pihak'),
    ]

    id = models.BigAutoField(primary_key=True)
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE)
    tanggal = models.DateField()
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    kategori = models.CharField(max_length=30, choices=KATEGORI_CHOICES, default='adab')
    evaluator = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    summary = models.TextField()
    catatan = models.TextField(blank=True, null=True)

    # PERUBAHAN 2: Foto (sudah ada, update path)
    photo = models.ImageField(upload_to='evaluations/foto/', blank=True, null=True)

    # PERUBAHAN 1: Status field
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='dalam_pembahasan'
    )

    # PERUBAHAN 3: Visibility field
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='internal'
    )

    # PERUBAHAN 4: Approval fields
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_evaluations'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.nisn.nama} ({self.tanggal})"


# PERUBAHAN 5: Model Tanggapan dengan jenis Diskusi dan Pembinaan
class EvaluationComment(models.Model):
    """
    Tanggapan/komentar pada sebuah Evaluasi.
    Mendukung jenis: Diskusi dan Pembinaan.
    """

    JENIS_CHOICES = [
        ('diskusi', 'Diskusi'),
        ('pembinaan', 'Pembinaan'),
    ]

    id = models.BigAutoField(primary_key=True)
    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='evaluation_comments'
    )
    jenis = models.CharField(
        max_length=20,
        choices=JENIS_CHOICES,
        default='diskusi'
    )
    content = models.TextField(help_text="Isi tanggapan/pembinaan")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluation_comments'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.get_jenis_display()} oleh {self.user.name or self.user.username} ({self.created_at})"
