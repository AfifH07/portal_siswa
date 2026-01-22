from django.db import models
from apps.students.models import Student


class Attendance(models.Model):
    nisn = models.ForeignKey(Student, on_delete=models.CASCADE, db_column='nisn')
    tanggal = models.DateField()
    waktu = models.CharField(max_length=20)
    status = models.CharField(max_length=50)
    keterangan = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance'
        indexes = [
            models.Index(fields=['nisn']),
            models.Index(fields=['tanggal']),
        ]

    def __str__(self):
        return f"{self.nisn} - {self.tanggal} {self.waktu}"


class AttendanceDraft(models.Model):
    username = models.CharField(max_length=50)
    kelas = models.CharField(max_length=20)
    tanggal = models.DateField()
    mata_pelajaran = models.CharField(max_length=100)
    data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_draft'
