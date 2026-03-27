"""
Finance Signals - Portal Ponpes Baron
======================================

Signal handlers untuk:
1. Auto-generate no_invoice ketika Tagihan dibuat
2. Auto-update sisa tagihan & status ketika Pembayaran diverifikasi
3. Auto-update status ketika Pembayaran dibuat/dihapus
4. Logging perubahan data keuangan untuk audit trail

Logic Status:
- 'lunas' -> terbayar >= total
- 'sebagian' -> 0 < terbayar < total
- 'lewat_jatuh_tempo' -> belum lunas & jatuh_tempo < today
- 'belum_bayar' -> terbayar = 0

IMPORTANT: Status hanya dihitung dari pembayaran yang TERVERIFIKASI (terverifikasi=True)
"""

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum
from decimal import Decimal
import logging

from .models import Pembayaran, Tagihan, generate_invoice_number

logger = logging.getLogger(__name__)


# ============================================
# TAGIHAN SIGNALS
# ============================================

@receiver(pre_save, sender=Tagihan)
def tagihan_pre_save(sender, instance, **kwargs):
    """
    Pre-save signal untuk Tagihan:
    1. Auto-generate no_invoice jika belum ada
    2. Auto-calculate total dan sisa
    """
    # Auto-generate invoice number if new and not set
    if not instance.no_invoice:
        instance.no_invoice = generate_invoice_number(
            siswa_nisn=instance.siswa.nisn,
            tarif_kategori=instance.tarif.kategori,
            bulan=instance.bulan or 0,
            tahun=instance.tahun
        )
        logger.info(
            f"[FINANCE] Invoice generated: {instance.no_invoice} "
            f"for {instance.siswa.nama} - {instance.tarif.nama}"
        )


@receiver(post_save, sender=Tagihan)
def tagihan_post_save(sender, instance, created, **kwargs):
    """
    Post-save signal untuk Tagihan:
    1. Log tagihan creation dengan no_invoice
    2. Log status changes
    """
    if created:
        logger.info(
            f"[FINANCE] Tagihan CREATED: #{instance.id} "
            f"| Invoice: {instance.no_invoice} "
            f"| Siswa: {instance.siswa.nama} ({instance.siswa.nisn}) "
            f"| Tarif: {instance.tarif.nama} "
            f"| Total: Rp {instance.total:,.0f} "
            f"| Jatuh Tempo: {instance.jatuh_tempo} "
            f"| Created By: {instance.created_by or 'system'}"
        )


# ============================================
# PEMBAYARAN SIGNALS
# ============================================

@receiver(pre_save, sender=Pembayaran)
def pembayaran_pre_save(sender, instance, **kwargs):
    """
    Capture old state before save to detect verification changes.
    """
    if instance.pk:
        try:
            old = Pembayaran.objects.get(pk=instance.pk)
            instance._old_terverifikasi = old.terverifikasi
            instance._old_nominal = old.nominal
        except Pembayaran.DoesNotExist:
            instance._old_terverifikasi = None
            instance._old_nominal = None
    else:
        instance._old_terverifikasi = None
        instance._old_nominal = None


@receiver(post_save, sender=Pembayaran)
def pembayaran_post_save_update_tagihan(sender, instance, created, **kwargs):
    """
    Post-save signal untuk Pembayaran:

    TRIGGER RECALCULATION KETIKA:
    1. Pembayaran baru dibuat dan sudah terverifikasi
    2. Pembayaran existing diverifikasi (terverifikasi: False -> True)
    3. Verifikasi dibatalkan (terverifikasi: True -> False)
    4. Nominal diubah pada pembayaran yang sudah terverifikasi

    LOGIC UPDATE:
    1. Hitung total terbayar = SUM(nominal) dari semua pembayaran terverifikasi
    2. Update tagihan.terbayar
    3. Update tagihan.sisa = tagihan.total - tagihan.terbayar
    4. Update tagihan.status berdasarkan perbandingan terbayar vs total
    """
    try:
        old_terverifikasi = getattr(instance, '_old_terverifikasi', None)
        old_nominal = getattr(instance, '_old_nominal', None)

        # Determine if we need to recalculate
        should_recalculate = False
        reason = ""

        if created:
            if instance.terverifikasi:
                should_recalculate = True
                reason = "New VERIFIED payment"
                logger.info(
                    f"[FINANCE] Payment CREATED (VERIFIED): "
                    f"| ID: #{instance.id} "
                    f"| Nominal: Rp {instance.nominal:,.0f} "
                    f"| Tagihan: #{instance.tagihan.id} "
                    f"| Siswa: {instance.tagihan.siswa.nisn}"
                )
            else:
                logger.info(
                    f"[FINANCE] Payment CREATED (PENDING): "
                    f"| ID: #{instance.id} "
                    f"| Nominal: Rp {instance.nominal:,.0f} "
                    f"| Tagihan: #{instance.tagihan.id} "
                    f"| Menunggu verifikasi"
                )

        elif old_terverifikasi != instance.terverifikasi:
            # Verification status changed
            should_recalculate = True

            if instance.terverifikasi:
                # ========================================
                # KASUS: terverifikasi False -> True
                # AKSI: Tambah ke terbayar, kurangi sisa
                # ========================================
                reason = "Payment VERIFIED"
                logger.info(
                    f"[FINANCE] Payment VERIFIED: "
                    f"| ID: #{instance.id} "
                    f"| Nominal: Rp {instance.nominal:,.0f} "
                    f"| Tagihan: #{instance.tagihan.id} "
                    f"| Verified By: {instance.verified_by}"
                )
            else:
                # ========================================
                # KASUS: terverifikasi True -> False
                # AKSI: Kurangi dari terbayar, tambah sisa
                # ========================================
                reason = "Payment UNVERIFIED"
                logger.warning(
                    f"[FINANCE] Payment UNVERIFIED: "
                    f"| ID: #{instance.id} "
                    f"| Nominal: Rp {instance.nominal:,.0f} "
                    f"| Tagihan: #{instance.tagihan.id}"
                )

        elif instance.terverifikasi and old_nominal is not None and old_nominal != instance.nominal:
            # Nominal changed on verified payment
            should_recalculate = True
            reason = f"Verified payment UPDATED: Rp {old_nominal:,.0f} -> Rp {instance.nominal:,.0f}"
            logger.info(
                f"[FINANCE] Verified Payment UPDATED: "
                f"| ID: #{instance.id} "
                f"| Old: Rp {old_nominal:,.0f} -> New: Rp {instance.nominal:,.0f} "
                f"| Tagihan: #{instance.tagihan.id}"
            )

        # ============================================
        # RECALCULATE TAGIHAN
        # ============================================
        if should_recalculate:
            tagihan = instance.tagihan
            old_status = tagihan.status
            old_terbayar = tagihan.terbayar
            old_sisa = tagihan.sisa

            # Hitung total dari semua pembayaran TERVERIFIKASI
            total_verified = Pembayaran.objects.filter(
                tagihan=tagihan,
                terverifikasi=True
            ).aggregate(
                total=Sum('nominal')
            )['total'] or Decimal('0.00')

            # Update tagihan fields
            tagihan.terbayar = total_verified
            tagihan.sisa = tagihan.total - tagihan.terbayar

            # Determine new status
            if tagihan.terbayar >= tagihan.total:
                tagihan.status = 'lunas'
            elif tagihan.terbayar > 0:
                tagihan.status = 'sebagian'
            elif tagihan.jatuh_tempo and tagihan.jatuh_tempo < timezone.now().date():
                tagihan.status = 'lewat_jatuh_tempo'
            else:
                tagihan.status = 'belum_bayar'

            # Save without triggering signals again (use update)
            Tagihan.objects.filter(pk=tagihan.pk).update(
                terbayar=tagihan.terbayar,
                sisa=tagihan.sisa,
                status=tagihan.status,
                updated_at=timezone.now()
            )

            # Log the change
            logger.info(
                f"[FINANCE] Tagihan UPDATED (via {reason}): "
                f"| ID: #{tagihan.id} "
                f"| Invoice: {tagihan.no_invoice} "
                f"| Terbayar: Rp {old_terbayar:,.0f} -> Rp {tagihan.terbayar:,.0f} "
                f"| Sisa: Rp {old_sisa:,.0f} -> Rp {tagihan.sisa:,.0f} "
                f"| Status: {old_status} -> {tagihan.status}"
            )

            # Special log for LUNAS status
            if tagihan.status == 'lunas' and old_status != 'lunas':
                logger.info(
                    f"[FINANCE] *** TAGIHAN LUNAS *** "
                    f"| Invoice: {tagihan.no_invoice} "
                    f"| Siswa: {tagihan.siswa.nama} "
                    f"| Total: Rp {tagihan.total:,.0f}"
                )

    except Exception as e:
        logger.error(
            f"[FINANCE] ERROR updating tagihan from payment signal: {str(e)}",
            exc_info=True
        )


@receiver(post_delete, sender=Pembayaran)
def pembayaran_post_delete_update_tagihan(sender, instance, **kwargs):
    """
    Update tagihan status when payment is deleted.
    Only recalculates if the deleted payment was VERIFIED.
    """
    try:
        # Only recalculate if deleted payment was verified
        if not instance.terverifikasi:
            logger.info(
                f"[FINANCE] Unverified payment DELETED: "
                f"| ID: #{instance.id} "
                f"| No tagihan update needed"
            )
            return

        # Check if tagihan still exists (might be cascade deleted)
        tagihan_id = instance.tagihan_id
        if not Tagihan.objects.filter(id=tagihan_id).exists():
            logger.warning(
                f"[FINANCE] Tagihan #{tagihan_id} not found (may be deleted)"
            )
            return

        tagihan = Tagihan.objects.get(id=tagihan_id)
        old_status = tagihan.status
        old_terbayar = tagihan.terbayar
        old_sisa = tagihan.sisa

        # Recalculate from remaining verified payments
        total_verified = Pembayaran.objects.filter(
            tagihan=tagihan,
            terverifikasi=True
        ).aggregate(
            total=Sum('nominal')
        )['total'] or Decimal('0.00')

        # Update tagihan
        tagihan.terbayar = total_verified
        tagihan.sisa = tagihan.total - tagihan.terbayar

        # Determine new status
        if tagihan.terbayar >= tagihan.total:
            tagihan.status = 'lunas'
        elif tagihan.terbayar > 0:
            tagihan.status = 'sebagian'
        elif tagihan.jatuh_tempo and tagihan.jatuh_tempo < timezone.now().date():
            tagihan.status = 'lewat_jatuh_tempo'
        else:
            tagihan.status = 'belum_bayar'

        # Save
        Tagihan.objects.filter(pk=tagihan.pk).update(
            terbayar=tagihan.terbayar,
            sisa=tagihan.sisa,
            status=tagihan.status,
            updated_at=timezone.now()
        )

        logger.info(
            f"[FINANCE] Tagihan UPDATED (payment deleted): "
            f"| ID: #{tagihan.id} "
            f"| Deleted Payment: #{instance.id} (Rp {instance.nominal:,.0f}) "
            f"| Terbayar: Rp {old_terbayar:,.0f} -> Rp {tagihan.terbayar:,.0f} "
            f"| Sisa: Rp {old_sisa:,.0f} -> Rp {tagihan.sisa:,.0f} "
            f"| Status: {old_status} -> {tagihan.status}"
        )

    except Exception as e:
        logger.error(
            f"[FINANCE] ERROR updating tagihan after payment delete: {str(e)}",
            exc_info=True
        )
