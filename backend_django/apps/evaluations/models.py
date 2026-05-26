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

    # PERUBAHAN 1: Foto field
    foto = models.ImageField(
        upload_to='evaluations/foto/',
        null=True,
        blank=True
    )

    # Status field
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='dalam_pembahasan'
    )

    # Visibility field
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='internal'
    )

    # PERUBAHAN 2: Approval fields
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_evaluations'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # PERUBAHAN 5: Created by field
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_evaluations'
    )

    # Field baru: Close case (keputusan final oleh pimpinan)
    keputusan_final = models.TextField(blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_evaluations'
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.nisn.nama} ({self.tanggal})"


class EvaluationPhoto(models.Model):
    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    foto = models.ImageField(upload_to='evaluations/foto/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evaluation_photos'
        ordering = ['created_at']


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

    VISIBILITY_CHOICES = [
        ('internal', 'Internal (Guru & Admin)'),
        ('semua', 'Semua Pihak'),
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
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='replies',
        null=True,
        blank=True
    )
    jenis = models.CharField(
        max_length=20,
        choices=JENIS_CHOICES,
        default='diskusi'
    )
    content = models.TextField(help_text="Isi tanggapan/pembinaan")

    # Field baru: visibility untuk kontrol siapa yang bisa lihat komentar
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default='internal'
    )

    # Field baru: foto bukti pembinaan
    foto = models.ImageField(
        upload_to='evaluations/pembinaan/',
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluation_comments'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.get_jenis_display()} oleh {self.user.name or self.user.username} ({self.created_at})"


class PoinIntegritas(models.Model):
    nama = models.CharField(max_length=100)
    urutan = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['urutan', 'nama']

    def __str__(self):
        return self.nama


class PenilaianIntegritasSantri(models.Model):
    SKALA_CHOICES = [
        (1, '1'),
        (2, '2'),
        (3, '3'),
        (4, '4'),
        (5, '5'),
    ]

    penilai = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='penilaian_integritas_santri_dibuat'
    )
    santri = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='penilaian_integritas'
    )
    poin = models.ForeignKey(PoinIntegritas, on_delete=models.CASCADE)
    skala = models.IntegerField(choices=SKALA_CHOICES)
    catatan = models.TextField(blank=True, default='')
    tanggal = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-tanggal', '-id']

    def __str__(self):
        return f"{self.santri} - {self.poin} - {self.skala}"


class PenilaianIntegritasGuru(models.Model):
    SKALA_CHOICES = [
        (1, '1'),
        (2, '2'),
        (3, '3'),
        (4, '4'),
        (5, '5'),
    ]

    penilai = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='penilaian_integritas_guru_dibuat'
    )
    guru = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='penilaian_integritas_diterima'
    )
    poin = models.ForeignKey(PoinIntegritas, on_delete=models.CASCADE)
    skala = models.IntegerField(choices=SKALA_CHOICES)
    catatan = models.TextField(blank=True, default='')
    tanggal = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-tanggal', '-id']

    def __str__(self):
        return f"{self.guru} - {self.poin} - {self.skala}"
