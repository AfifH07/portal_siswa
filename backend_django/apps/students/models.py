from django.db import models


class Student(models.Model):
    nisn = models.CharField(max_length=20, unique=True)
    nama = models.CharField(max_length=100)
    kelas = models.CharField(max_length=20, blank=True, null=True)
    program = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        ordering = ['nisn']

    def __str__(self):
        return f"{self.nisn} - {self.nama}"


class Schedule(models.Model):
    username = models.CharField(max_length=50)
    kelas = models.CharField(max_length=20)
    hari = models.CharField(max_length=20)
    jam = models.CharField(max_length=20)
    mata_pelajaran = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'schedules'

    def __str__(self):
        return f"{self.kelas} - {self.hari} {self.jam}"
