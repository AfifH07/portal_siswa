"""
Kesantrian Signals - Auto-Inval System
=======================================

Signal handlers untuk otomasi:
1. Auto-create EmployeeEvaluation saat InvalRecord dibuat
2. Auto-lock BLPEntry saat periode berakhir

Signal Flow:
    InvalRecord.save() → post_save signal → create_inval_evaluations()
        ├── EmployeeEvaluation (guru_absent, -5 poin)
        └── EmployeeEvaluation (guru_pengganti, +5 poin)
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone

from .models import InvalRecord, EmployeeEvaluation, BLPEntry


# ============================================
# AUTO-INVAL: Create evaluations on InvalRecord
# ============================================

@receiver(post_save, sender=InvalRecord)
def create_inval_evaluations(sender, instance, created, **kwargs):
    """
    Signal handler: Otomatis buat EmployeeEvaluation saat InvalRecord dibuat.

    Logic:
    1. Hanya trigger untuk record baru (created=True)
    2. Hanya jika belum ada evaluation (evaluation_created=False)
    3. Buat 2 evaluation records:
       - Ustadz absent: -5 poin (inval_minus)
       - Ustadz pengganti: +5 poin (inval_plus)
    4. Set evaluation_created=True

    Atomic transaction untuk data integrity.
    """
    # Skip jika bukan record baru atau sudah ada evaluation
    if not created:
        return

    if instance.evaluation_created:
        return

    # Dapatkan tahun ajaran aktif
    tahun_ajaran = get_current_tahun_ajaran()
    semester = get_current_semester()

    try:
        with transaction.atomic():
            # 1. Evaluasi untuk Ustadz yang tidak hadir (-5 poin)
            EmployeeEvaluation.objects.create(
                user=instance.guru_absent,
                tanggal=instance.tanggal,
                jenis='inval_minus',
                poin=-5,
                keterangan=f"Auto-Inval: Tidak hadir mengajar {instance.mata_pelajaran} kelas {instance.kelas} ({instance.jam_pelajaran}). Alasan: {instance.get_alasan_display()}. Digantikan oleh {instance.guru_pengganti.name}.",
                inval_record=instance,
                tahun_ajaran=tahun_ajaran,
                semester=semester,
                created_by='SYSTEM_AUTO_INVAL'
            )

            # 2. Evaluasi untuk Ustadz pengganti (+5 poin)
            EmployeeEvaluation.objects.create(
                user=instance.guru_pengganti,
                tanggal=instance.tanggal,
                jenis='inval_plus',
                poin=5,
                keterangan=f"Auto-Inval: Menggantikan {instance.guru_absent.name} mengajar {instance.mata_pelajaran} kelas {instance.kelas} ({instance.jam_pelajaran}).",
                inval_record=instance,
                tahun_ajaran=tahun_ajaran,
                semester=semester,
                created_by='SYSTEM_AUTO_INVAL'
            )

            # 3. Update flag
            InvalRecord.objects.filter(id=instance.id).update(evaluation_created=True)

            # Log untuk debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"[AUTO-INVAL] Created evaluations for InvalRecord #{instance.id}: "
                f"{instance.guru_absent.username} (-5), {instance.guru_pengganti.username} (+5)"
            )

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[AUTO-INVAL] Failed to create evaluations: {str(e)}")
        raise


# ============================================
# WEEKLY LOCKDOWN: Lock BLP entries
# ============================================

@receiver(pre_save, sender=BLPEntry)
def validate_blp_edit(sender, instance, **kwargs):
    """
    Signal handler: Validasi sebelum save BLPEntry.

    Mencegah edit jika:
    1. Entry sudah locked
    2. Periode sudah berakhir (auto-lock)
    """
    if instance.pk:  # Update existing
        try:
            old_instance = BLPEntry.objects.get(pk=instance.pk)

            # Jika sudah locked, tolak perubahan (kecuali oleh admin)
            if old_instance.is_locked:
                from django.core.exceptions import ValidationError
                raise ValidationError("BLP Entry sudah dikunci dan tidak dapat diubah.")

        except BLPEntry.DoesNotExist:
            pass


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_current_tahun_ajaran():
    """Get tahun ajaran aktif berdasarkan tanggal sekarang"""
    today = timezone.now().date()
    year = today.year
    month = today.month

    # Tahun ajaran dimulai Juli
    if month >= 7:
        return f"{year}/{year + 1}"
    else:
        return f"{year - 1}/{year}"


def get_current_semester():
    """Get semester aktif berdasarkan tanggal sekarang"""
    today = timezone.now().date()
    month = today.month

    # Ganjil: Juli - Desember, Genap: Januari - Juni
    if month >= 7 or month <= 12:
        return "Ganjil"
    else:
        return "Genap"


def get_week_boundaries(date=None):
    """
    Get week start (Sunday) and end (Saturday) for a given date.

    Returns: (week_start, week_end)
    """
    from datetime import timedelta

    if date is None:
        date = timezone.now().date()

    # weekday(): Monday=0, Sunday=6
    # Kita ingin Sunday=0, Saturday=6
    days_since_sunday = (date.weekday() + 1) % 7

    week_start = date - timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=6)

    return week_start, week_end


def lock_expired_blp_entries():
    """
    Lock semua BLP entries yang periode-nya sudah lewat.

    Dipanggil oleh:
    1. Management command (scheduled)
    2. Celery task (jika ada)

    Returns: jumlah entries yang di-lock
    """
    from datetime import timedelta

    today = timezone.now().date()

    # Cari entries yang belum locked dan week_end < today - 1 day
    expired_entries = BLPEntry.objects.filter(
        is_locked=False,
        week_end__lt=today - timedelta(days=1)
    )

    count = 0
    for entry in expired_entries:
        entry.lock('SYSTEM_AUTO_LOCK')
        count += 1

    import logging
    logger = logging.getLogger(__name__)
    if count > 0:
        logger.info(f"[WEEKLY_LOCK] Locked {count} expired BLP entries")

    return count
