from django.db import models
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

    id = models.BigAutoField(primary_key=True)
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE)
    tanggal = models.DateField()
    jenis = models.CharField(max_length=20, choices=JENIS_CHOICES)
    kategori = models.CharField(max_length=30, choices=KATEGORI_CHOICES, default='adab')
    evaluator = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    summary = models.TextField()
    catatan = models.TextField(blank=True, null=True)
    photo = models.ImageField(upload_to='evaluations/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluations'
        ordering = ['-created_at']
