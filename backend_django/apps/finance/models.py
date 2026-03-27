"""
Finance Models - Portal Ponpes Baron
=====================================

Struktur Data Keuangan:
1. Tarif: Master data tarif pembayaran (SPP, Gedung, Seragam, dll)
2. Tagihan: Tagihan per siswa berdasarkan tarif
3. Pembayaran: Riwayat pembayaran terhadap tagihan

ERD:
    Student (1) ──── (N) Tagihan (N) ──── (1) Tarif
                           │
                           └── (N) Pembayaran

"""

from django.db import models, transaction
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from apps.students.models import Student
import uuid


def generate_invoice_number(siswa_nisn: str, tarif_kategori: str, bulan: int, tahun: int) -> str:
    """
    Generate unique invoice number.

    Format: INV-{TAHUN}{BULAN:02d}-{KATEGORI[:3]}-{NISN[-4:]}-{UUID[:4]}
    Example: INV-202503-SPP-1234-A1B2

    Komponen:
    - Prefix: INV
    - Tahun & Bulan: 202503
    - Kategori (3 huruf): SPP, GED, SER, dll
    - 4 digit terakhir NISN: 1234
    - UUID 4 karakter: A1B2 (untuk memastikan uniqueness)
    """
    kategori_map = {
        'spp': 'SPP',
        'gedung': 'GED',
        'seragam': 'SER',
        'buku': 'BUK',
        'kegiatan': 'KEG',
        'wisuda': 'WIS',
        'lainnya': 'LNY',
    }

    kategori_code = kategori_map.get(tarif_kategori, 'LNY')[:3].upper()
    nisn_suffix = siswa_nisn[-4:] if len(siswa_nisn) >= 4 else siswa_nisn.zfill(4)
    unique_suffix = uuid.uuid4().hex[:4].upper()

    bulan_str = f"{bulan:02d}" if bulan else "00"

    return f"INV-{tahun}{bulan_str}-{kategori_code}-{nisn_suffix}-{unique_suffix}"


class Tarif(models.Model):
    """
    Master Tarif Pembayaran

    Menyimpan definisi tarif yang berlaku per tahun ajaran.
    Kategori menentukan jenis pembayaran: bulanan, tahunan, atau insidental.
    """

    KATEGORI_CHOICES = [
        ('spp', 'SPP (Bulanan)'),
        ('gedung', 'Uang Gedung (Tahunan)'),
        ('seragam', 'Seragam'),
        ('buku', 'Buku & Perlengkapan'),
        ('kegiatan', 'Kegiatan Sekolah'),
        ('wisuda', 'Wisuda/Kelulusan'),
        ('lainnya', 'Lainnya'),
    ]

    FREKUENSI_CHOICES = [
        ('bulanan', 'Bulanan'),
        ('semester', 'Per Semester'),
        ('tahunan', 'Tahunan'),
        ('sekali', 'Sekali Bayar'),
    ]

    id = models.BigAutoField(primary_key=True)
    nama = models.CharField(
        max_length=100,
        help_text="Nama tarif, misal: SPP Kelas X, Uang Gedung 2024"
    )
    kategori = models.CharField(
        max_length=20,
        choices=KATEGORI_CHOICES,
        default='spp'
    )
    frekuensi = models.CharField(
        max_length=20,
        choices=FREKUENSI_CHOICES,
        default='bulanan',
        help_text="Frekuensi pembayaran"
    )
    nominal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Nominal tarif dalam Rupiah"
    )
    tahun_ajaran = models.CharField(
        max_length=10,
        help_text="Format: 2024/2025"
    )
    kelas = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Kosongkan jika berlaku untuk semua kelas"
    )
    program = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Kosongkan jika berlaku untuk semua program"
    )
    deskripsi = models.TextField(
        blank=True,
        null=True,
        help_text="Keterangan tambahan tentang tarif"
    )
    aktif = models.BooleanField(
        default=True,
        help_text="Tarif aktif akan digunakan untuk generate tagihan"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Audit Trail
    created_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username pembuat tarif"
    )
    updated_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username terakhir yang mengubah tarif"
    )

    class Meta:
        db_table = 'finance_tarif'
        ordering = ['kategori', 'nama']
        verbose_name = 'Tarif'
        verbose_name_plural = 'Tarif'
        indexes = [
            models.Index(fields=['kategori']),
            models.Index(fields=['tahun_ajaran']),
            models.Index(fields=['aktif']),
        ]

    def __str__(self):
        return f"{self.nama} - Rp {self.nominal:,.0f} ({self.tahun_ajaran})"


class Tagihan(models.Model):
    """
    Tagihan per Siswa

    Setiap tagihan merujuk ke satu Tarif dan satu Student.
    Untuk pembayaran bulanan (SPP), gunakan field bulan dan tahun.
    Status dihitung otomatis berdasarkan total pembayaran.
    """

    STATUS_CHOICES = [
        ('belum_bayar', 'Belum Bayar'),
        ('sebagian', 'Dibayar Sebagian'),
        ('lunas', 'Lunas'),
        ('lewat_jatuh_tempo', 'Lewat Jatuh Tempo'),
    ]

    BULAN_CHOICES = [
        (1, 'Januari'),
        (2, 'Februari'),
        (3, 'Maret'),
        (4, 'April'),
        (5, 'Mei'),
        (6, 'Juni'),
        (7, 'Juli'),
        (8, 'Agustus'),
        (9, 'September'),
        (10, 'Oktober'),
        (11, 'November'),
        (12, 'Desember'),
    ]

    id = models.BigAutoField(primary_key=True)
    siswa = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name='tagihan',
        help_text="Siswa yang memiliki tagihan"
    )
    tarif = models.ForeignKey(
        Tarif,
        on_delete=models.PROTECT,
        related_name='tagihan',
        help_text="Tarif yang ditagihkan"
    )
    bulan = models.PositiveSmallIntegerField(
        choices=BULAN_CHOICES,
        blank=True,
        null=True,
        help_text="Bulan tagihan (untuk pembayaran bulanan)"
    )
    tahun = models.PositiveIntegerField(
        help_text="Tahun tagihan"
    )
    nominal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Nominal tagihan (bisa berbeda dari tarif jika ada diskon/denda)"
    )
    diskon = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Potongan/diskon"
    )
    denda = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Denda keterlambatan"
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total = Nominal - Diskon + Denda"
    )
    terbayar = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Jumlah yang sudah dibayar"
    )
    sisa = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Sisa tagihan = Total - Terbayar"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='belum_bayar'
    )
    jatuh_tempo = models.DateField(
        help_text="Tanggal jatuh tempo pembayaran"
    )
    keterangan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan tambahan"
    )

    # Invoice
    no_invoice = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        null=True,
        help_text="Nomor invoice otomatis, format: INV-YYYYMM-KAT-NISN-UUID"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Audit Trail
    created_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username pembuat tagihan"
    )
    updated_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username terakhir yang mengubah tagihan"
    )

    class Meta:
        db_table = 'finance_tagihan'
        ordering = ['-tahun', '-bulan', 'siswa']
        verbose_name = 'Tagihan'
        verbose_name_plural = 'Tagihan'
        indexes = [
            models.Index(fields=['siswa']),
            models.Index(fields=['tarif']),
            models.Index(fields=['status']),
            models.Index(fields=['tahun', 'bulan']),
            models.Index(fields=['jatuh_tempo']),
        ]
        # Unique constraint: satu siswa hanya punya satu tagihan per tarif per periode
        unique_together = ['siswa', 'tarif', 'bulan', 'tahun']

    def __str__(self):
        if self.bulan:
            bulan_nama = dict(self.BULAN_CHOICES).get(self.bulan, '')
            return f"{self.siswa.nama} - {self.tarif.nama} ({bulan_nama} {self.tahun})"
        return f"{self.siswa.nama} - {self.tarif.nama} ({self.tahun})"

    def save(self, *args, **kwargs):
        """
        Save tagihan dengan auto-calculation.

        NOTE: no_invoice di-generate oleh signal pre_save (signals.py)
        untuk memastikan consistency dan audit trail.
        """
        # Auto-calculate total dan sisa
        self.total = self.nominal - self.diskon + self.denda
        self.sisa = self.total - self.terbayar

        # Auto-update status berdasarkan terbayar
        if self.terbayar >= self.total:
            self.status = 'lunas'
        elif self.terbayar > 0:
            self.status = 'sebagian'
        elif self.jatuh_tempo and self.jatuh_tempo < timezone.now().date():
            self.status = 'lewat_jatuh_tempo'
        else:
            self.status = 'belum_bayar'

        super().save(*args, **kwargs)

    def update_payment_status(self):
        """
        Recalculate terbayar from all verified pembayaran and update status.

        NOTE: Fungsi ini tetap tersedia untuk:
        1. Manual recalculation jika diperlukan
        2. Fallback dari views yang membutuhkan explicit recalc
        3. Migrasi data atau batch processing

        Untuk operasi normal, signal post_save Pembayaran
        sudah otomatis mengupdate tagihan.
        """
        total_bayar = self.pembayaran.filter(
            terverifikasi=True
        ).aggregate(
            total=models.Sum('nominal')
        )['total'] or Decimal('0.00')

        self.terbayar = total_bayar
        self.save()

    @property
    def is_overdue(self):
        """Check if tagihan is overdue"""
        if self.status == 'lunas':
            return False
        return self.jatuh_tempo and self.jatuh_tempo < timezone.now().date()

    @property
    def persentase_bayar(self):
        """Percentage of payment completed"""
        if self.total == 0:
            return 100
        return round((self.terbayar / self.total) * 100, 1)


class Pembayaran(models.Model):
    """
    Riwayat Pembayaran

    Setiap pembayaran merujuk ke satu Tagihan.
    Satu tagihan bisa memiliki multiple pembayaran (cicilan).
    Pembayaran perlu verifikasi sebelum dihitung ke tagihan.
    """

    METODE_CHOICES = [
        ('tunai', 'Tunai'),
        ('transfer', 'Transfer Bank'),
        ('qris', 'QRIS'),
        ('virtual_account', 'Virtual Account'),
        ('lainnya', 'Lainnya'),
    ]

    id = models.BigAutoField(primary_key=True)
    tagihan = models.ForeignKey(
        Tagihan,
        on_delete=models.PROTECT,
        related_name='pembayaran',
        help_text="Tagihan yang dibayar"
    )
    tanggal = models.DateTimeField(
        default=timezone.now,
        help_text="Tanggal pembayaran"
    )
    nominal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Nominal pembayaran"
    )
    metode = models.CharField(
        max_length=20,
        choices=METODE_CHOICES,
        default='tunai'
    )
    bukti = models.ImageField(
        upload_to='pembayaran/%Y/%m/',
        blank=True,
        null=True,
        help_text="Bukti pembayaran (foto struk/transfer)"
    )
    nomor_referensi = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Nomor referensi transfer/transaksi"
    )
    terverifikasi = models.BooleanField(
        default=False,
        help_text="Apakah pembayaran sudah diverifikasi"
    )
    tanggal_verifikasi = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Tanggal verifikasi pembayaran"
    )
    verified_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username yang memverifikasi"
    )
    keterangan = models.TextField(
        blank=True,
        null=True,
        help_text="Catatan tambahan"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Audit Trail
    created_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username yang membuat record"
    )
    updated_by = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Username terakhir yang mengubah record"
    )

    class Meta:
        db_table = 'finance_pembayaran'
        ordering = ['-tanggal']
        verbose_name = 'Pembayaran'
        verbose_name_plural = 'Pembayaran'
        indexes = [
            models.Index(fields=['tagihan']),
            models.Index(fields=['tanggal']),
            models.Index(fields=['terverifikasi']),
            models.Index(fields=['metode']),
        ]

    def __str__(self):
        return f"Bayar {self.tagihan.siswa.nama} - Rp {self.nominal:,.0f} ({self.tanggal.strftime('%d/%m/%Y')})"

    def save(self, *args, **kwargs):
        """
        Save pembayaran.

        NOTE: Update tagihan (terbayar, sisa, status) ditangani oleh
        signal post_save di signals.py untuk memastikan:
        1. Atomicity dengan transaction
        2. Audit trail yang proper
        3. Konsistensi saat verifikasi berubah
        """
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Delete pembayaran.

        NOTE: Update tagihan setelah delete ditangani oleh
        signal post_delete di signals.py.
        """
        super().delete(*args, **kwargs)


class LaporanKeuangan(models.Model):
    """
    Model untuk menyimpan snapshot laporan keuangan bulanan.
    Berguna untuk reporting dan audit trail.
    """

    id = models.BigAutoField(primary_key=True)
    bulan = models.PositiveSmallIntegerField()
    tahun = models.PositiveIntegerField()
    total_tagihan = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_terbayar = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_tunggakan = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00')
    )
    jumlah_siswa_lunas = models.PositiveIntegerField(default=0)
    jumlah_siswa_tunggakan = models.PositiveIntegerField(default=0)
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'finance_laporan'
        ordering = ['-tahun', '-bulan']
        verbose_name = 'Laporan Keuangan'
        verbose_name_plural = 'Laporan Keuangan'
        unique_together = ['bulan', 'tahun']

    def __str__(self):
        bulan_nama = dict(Tagihan.BULAN_CHOICES).get(self.bulan, '')
        return f"Laporan {bulan_nama} {self.tahun}"


# =============================================================
# KELAS NORMALIZATION - Database Level Guard
# =============================================================

def _get_normalize_kelas_format():
    """Lazy import to avoid circular imports."""
    from apps.students.models import normalize_kelas_format
    return normalize_kelas_format


@receiver(pre_save, sender=Tarif)
def normalize_tarif_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in Tarif model.
    """
    if instance.kelas:
        normalize_fn = _get_normalize_kelas_format()
        normalized = normalize_fn(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
