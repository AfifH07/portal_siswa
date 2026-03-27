from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver


class PendingRegistration(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Menunggu Persetujuan'),
        ('approved', 'Disetujui'),
        ('rejected', 'Ditolak'),
    ]

    nisn = models.CharField(max_length=20, unique=True)
    nama = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    kelas = models.CharField(max_length=20, blank=True, null=True)
    program = models.CharField(max_length=50, blank=True, null=True)
    wali_nama = models.CharField(max_length=100, blank=True, null=True)
    wali_phone = models.CharField(max_length=20, blank=True, null=True)
    alamat = models.TextField(blank=True, null=True)
    tanggal_lahir = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = 'pending_registrations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.nisn} - {self.nama} ({self.status})"


# =============================================================
# KELAS NORMALIZATION - Database Level Guard
# =============================================================

def _get_normalize_kelas_format():
    """Lazy import to avoid circular imports."""
    from apps.students.models import normalize_kelas_format
    return normalize_kelas_format


@receiver(pre_save, sender=PendingRegistration)
def normalize_registration_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in PendingRegistration model.
    """
    if instance.kelas:
        normalize_fn = _get_normalize_kelas_format()
        normalized = normalize_fn(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
