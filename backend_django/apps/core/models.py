"""
Core Models - Master Data
Portal Ponpes Baron v2.3.3
"""

from django.db import models


class TahunAjaran(models.Model):
    """
    Master data untuk Tahun Ajaran.
    Hanya boleh ada 1 record dengan is_active=True.

    Contoh:
        nama: "2025/2026"
        semester: "Ganjil"
        is_active: True
    """

    SEMESTER_CHOICES = [
        ('Ganjil', 'Ganjil'),
        ('Genap', 'Genap'),
    ]

    nama = models.CharField(
        max_length=20,
        verbose_name="Tahun Ajaran",
        help_text="Format: YYYY/YYYY (contoh: 2025/2026)"
    )
    semester = models.CharField(
        max_length=10,
        choices=SEMESTER_CHOICES,
        verbose_name="Semester"
    )
    is_active = models.BooleanField(
        default=False,
        verbose_name="Aktif",
        help_text="Tandai sebagai tahun ajaran aktif"
    )
    tanggal_mulai = models.DateField(
        null=True,
        blank=True,
        verbose_name="Tanggal Mulai"
    )
    tanggal_selesai = models.DateField(
        null=True,
        blank=True,
        verbose_name="Tanggal Selesai"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tahun Ajaran"
        verbose_name_plural = "Tahun Ajaran"
        ordering = ['-nama', '-semester']
        # Ensure unique combination of nama + semester
        unique_together = ['nama', 'semester']

    def __str__(self):
        status = " (Aktif)" if self.is_active else ""
        return f"{self.nama} - {self.semester}{status}"

    def save(self, *args, **kwargs):
        """
        Override save to ensure only ONE TahunAjaran can be active at a time.
        When this instance is saved with is_active=True,
        all other records are set to is_active=False.
        """
        if self.is_active:
            # Deactivate all other TahunAjaran records
            TahunAjaran.objects.exclude(pk=self.pk).update(is_active=False)

        super().save(*args, **kwargs)

    @classmethod
    def get_active(cls):
        """
        Get the currently active TahunAjaran.
        Returns None if no active record exists.
        """
        return cls.objects.filter(is_active=True).first()

    @classmethod
    def get_active_or_default(cls):
        """
        Get active TahunAjaran or generate default values based on current date.
        Returns dict with 'nama' and 'semester' keys.
        """
        active = cls.get_active()
        if active:
            return {
                'id': active.id,
                'nama': active.nama,
                'semester': active.semester,
                'tanggal_mulai': active.tanggal_mulai,
                'tanggal_selesai': active.tanggal_selesai,
            }

        # Fallback: Calculate from current date
        from datetime import date
        today = date.today()
        year = today.year
        month = today.month

        # Academic year starts in July
        if month >= 7:
            nama = f"{year}/{year + 1}"
            semester = "Ganjil"
        else:
            nama = f"{year - 1}/{year}"
            semester = "Genap"

        return {
            'id': None,
            'nama': nama,
            'semester': semester,
            'tanggal_mulai': None,
            'tanggal_selesai': None,
            'is_calculated': True,  # Flag indicating this is calculated, not from DB
        }


class MasterJam(models.Model):
    """
    Master data untuk jam pelajaran per sesi.
    Digunakan sebagai referensi waktu di jadwal mengajar.

    Sesi:
    - tahfidz: Jam tahfidz pagi
    - kbm: Kegiatan Belajar Mengajar (formal)
    - diniyah: Pelajaran diniyah sore
    """

    SESI_CHOICES = [
        ('tahfidz', 'Tahfidz'),
        ('kbm', 'KBM'),
        ('diniyah', 'Diniyah'),
    ]

    sesi = models.CharField(
        max_length=20,
        choices=SESI_CHOICES,
        verbose_name="Sesi"
    )
    jam_ke = models.IntegerField(
        verbose_name="Jam Ke"
    )
    jam_mulai = models.TimeField(
        verbose_name="Jam Mulai"
    )
    jam_selesai = models.TimeField(
        verbose_name="Jam Selesai"
    )
    keterangan = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Keterangan"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Aktif"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Master Jam"
        verbose_name_plural = "Master Jam"
        unique_together = ['sesi', 'jam_ke']
        ordering = ['sesi', 'jam_ke']

    def __str__(self):
        return f"{self.get_sesi_display()} - Jam {self.jam_ke} ({self.jam_mulai.strftime('%H:%M')}-{self.jam_selesai.strftime('%H:%M')})"

    @property
    def label(self):
        """Label untuk dropdown"""
        return f"Jam {self.jam_ke} ({self.jam_mulai.strftime('%H:%M')}-{self.jam_selesai.strftime('%H:%M')})"

    @classmethod
    def get_by_sesi(cls, sesi):
        """Get all active MasterJam for a specific sesi"""
        return cls.objects.filter(sesi=sesi, is_active=True).order_by('jam_ke')


class MasterMapel(models.Model):
    """
    Master data untuk Mata Pelajaran.
    Digunakan sebagai referensi di jadwal mengajar dan assignment.
    """

    SESI_CHOICES = [
        ('kbm', 'KBM'),
        ('diniyah', 'Diniyah'),
        ('tahfidz', 'Tahfidz'),
    ]

    nama = models.CharField(
        max_length=100,
        verbose_name="Nama Mata Pelajaran"
    )
    kode = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Kode",
        help_text="Singkatan/kode mapel (opsional)"
    )
    sesi = models.CharField(
        max_length=20,
        choices=SESI_CHOICES,
        verbose_name="Sesi"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Aktif"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Master Mata Pelajaran"
        verbose_name_plural = "Master Mata Pelajaran"
        unique_together = ['nama', 'sesi']
        ordering = ['sesi', 'nama']

    def __str__(self):
        return f"{self.nama} ({self.get_sesi_display()})"

    @classmethod
    def get_by_sesi(cls, sesi):
        """Get all active MasterMapel for a specific sesi"""
        return cls.objects.filter(sesi=sesi, is_active=True).order_by('nama')
