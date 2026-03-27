# Generated manually for hardening finance module

from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Hardening Migration - Audit Trail & Invoice Number

    Menambahkan:
    1. Tarif: created_by, updated_by (audit trail)
    2. Tagihan: updated_by, no_invoice (audit trail + invoice)
    3. Pembayaran: updated_by (audit trail)
    """

    dependencies = [
        ('finance', '0001_initial'),
    ]

    operations = [
        # ============================================
        # TARIF - Audit Trail
        # ============================================
        migrations.AddField(
            model_name='tarif',
            name='created_by',
            field=models.CharField(
                blank=True,
                help_text='Username pembuat tarif',
                max_length=100,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='tarif',
            name='updated_by',
            field=models.CharField(
                blank=True,
                help_text='Username terakhir yang mengubah tarif',
                max_length=100,
                null=True
            ),
        ),

        # ============================================
        # TAGIHAN - Audit Trail + Invoice
        # ============================================
        migrations.AddField(
            model_name='tagihan',
            name='updated_by',
            field=models.CharField(
                blank=True,
                help_text='Username terakhir yang mengubah tagihan',
                max_length=100,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='tagihan',
            name='no_invoice',
            field=models.CharField(
                blank=True,
                help_text='Nomor invoice otomatis, format: INV-YYYYMM-KAT-NISN-UUID',
                max_length=50,
                null=True,
                unique=True
            ),
        ),

        # ============================================
        # PEMBAYARAN - Audit Trail
        # ============================================
        migrations.AddField(
            model_name='pembayaran',
            name='updated_by',
            field=models.CharField(
                blank=True,
                help_text='Username terakhir yang mengubah record',
                max_length=100,
                null=True
            ),
        ),

        # ============================================
        # INDEX untuk no_invoice (untuk lookup cepat)
        # ============================================
        migrations.AddIndex(
            model_name='tagihan',
            index=models.Index(
                fields=['no_invoice'],
                name='finance_tag_no_invo_idx'
            ),
        ),
    ]
