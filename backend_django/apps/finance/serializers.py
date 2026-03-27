"""
Finance Serializers - Portal Ponpes Baron
==========================================

Serializers untuk API Keuangan dengan dukungan:
- Nested data untuk relasi (siswa, tarif)
- Validasi nominal dan tanggal
- Read-only computed fields
"""

from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone

from .models import Tarif, Tagihan, Pembayaran, LaporanKeuangan
from apps.students.models import Student


# ============================================
# TARIF SERIALIZERS
# ============================================

class TarifSerializer(serializers.ModelSerializer):
    """Serializer untuk list/retrieve Tarif"""

    kategori_display = serializers.CharField(
        source='get_kategori_display',
        read_only=True
    )
    frekuensi_display = serializers.CharField(
        source='get_frekuensi_display',
        read_only=True
    )

    class Meta:
        model = Tarif
        fields = [
            'id', 'nama', 'kategori', 'kategori_display',
            'frekuensi', 'frekuensi_display', 'nominal',
            'tahun_ajaran', 'kelas', 'program', 'deskripsi',
            'aktif', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']


class TarifCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create/update Tarif"""

    class Meta:
        model = Tarif
        fields = [
            'nama', 'kategori', 'frekuensi', 'nominal',
            'tahun_ajaran', 'kelas', 'program', 'deskripsi', 'aktif'
        ]

    def validate_nominal(self, value):
        if value < Decimal('0'):
            raise serializers.ValidationError("Nominal tidak boleh negatif")
        return value

    def validate_tahun_ajaran(self, value):
        # Validate format: 2024/2025
        import re
        if not re.match(r'^\d{4}/\d{4}$', value):
            raise serializers.ValidationError("Format tahun ajaran harus YYYY/YYYY (contoh: 2024/2025)")
        return value


# ============================================
# TAGIHAN SERIALIZERS
# ============================================

class TagihanSerializer(serializers.ModelSerializer):
    """Serializer untuk list/retrieve Tagihan"""

    # Nested data
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_kelas = serializers.CharField(source='siswa.kelas', read_only=True)
    tarif_nama = serializers.CharField(source='tarif.nama', read_only=True)
    tarif_kategori = serializers.CharField(source='tarif.kategori', read_only=True)

    # Computed fields
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    bulan_display = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    persentase_bayar = serializers.FloatField(read_only=True)

    class Meta:
        model = Tagihan
        fields = [
            'id', 'no_invoice',
            'siswa', 'siswa_nisn', 'siswa_nama', 'siswa_kelas',
            'tarif', 'tarif_nama', 'tarif_kategori',
            'bulan', 'bulan_display', 'tahun',
            'nominal', 'diskon', 'denda', 'total', 'terbayar', 'sisa',
            'status', 'status_display', 'jatuh_tempo',
            'is_overdue', 'persentase_bayar',
            'keterangan', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = [
            'id', 'no_invoice', 'total', 'terbayar', 'sisa', 'status',
            'created_at', 'updated_at'
        ]

    def get_bulan_display(self, obj):
        if obj.bulan:
            return dict(Tagihan.BULAN_CHOICES).get(obj.bulan, '')
        return None


class TagihanCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create Tagihan"""

    siswa_nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Tagihan
        fields = [
            'siswa_nisn', 'tarif', 'bulan', 'tahun',
            'nominal', 'diskon', 'denda', 'jatuh_tempo', 'keterangan'
        ]

    def validate_siswa_nisn(self, value):
        try:
            student = Student.objects.get(nisn=value, aktif=True)
            return student
        except Student.DoesNotExist:
            raise serializers.ValidationError(f"Siswa dengan NISN {value} tidak ditemukan atau tidak aktif")

    def validate(self, data):
        # Check for duplicate tagihan
        siswa = data.get('siswa_nisn')
        tarif = data.get('tarif')
        bulan = data.get('bulan')
        tahun = data.get('tahun')

        existing = Tagihan.objects.filter(
            siswa=siswa,
            tarif=tarif,
            bulan=bulan,
            tahun=tahun
        ).exists()

        if existing:
            raise serializers.ValidationError(
                "Tagihan untuk siswa ini dengan tarif dan periode yang sama sudah ada"
            )

        return data

    def create(self, validated_data):
        siswa = validated_data.pop('siswa_nisn')
        validated_data['siswa'] = siswa

        # Set nominal from tarif if not provided
        if 'nominal' not in validated_data or validated_data['nominal'] is None:
            validated_data['nominal'] = validated_data['tarif'].nominal

        # Set created_by from request user
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user.username

        return super().create(validated_data)


class TagihanUpdateSerializer(serializers.ModelSerializer):
    """Serializer untuk update Tagihan"""

    class Meta:
        model = Tagihan
        fields = [
            'nominal', 'diskon', 'denda', 'jatuh_tempo', 'keterangan'
        ]

    def validate_nominal(self, value):
        if value < Decimal('0'):
            raise serializers.ValidationError("Nominal tidak boleh negatif")
        return value


class TagihanSummarySerializer(serializers.Serializer):
    """Serializer untuk ringkasan tagihan siswa"""

    siswa_nisn = serializers.CharField()
    siswa_nama = serializers.CharField()
    siswa_kelas = serializers.CharField()
    total_tagihan = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_terbayar = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_tunggakan = serializers.DecimalField(max_digits=15, decimal_places=2)
    jumlah_tagihan = serializers.IntegerField()
    jumlah_lunas = serializers.IntegerField()
    jumlah_belum_lunas = serializers.IntegerField()


# ============================================
# PEMBAYARAN SERIALIZERS
# ============================================

class PembayaranSerializer(serializers.ModelSerializer):
    """Serializer untuk list/retrieve Pembayaran"""

    # Nested data
    tagihan_id = serializers.IntegerField(source='tagihan.id', read_only=True)
    siswa_nisn = serializers.CharField(source='tagihan.siswa.nisn', read_only=True)
    siswa_nama = serializers.CharField(source='tagihan.siswa.nama', read_only=True)
    tarif_nama = serializers.CharField(source='tagihan.tarif.nama', read_only=True)

    # Display fields
    metode_display = serializers.CharField(source='get_metode_display', read_only=True)

    # Full URL for bukti image
    bukti = serializers.SerializerMethodField()

    class Meta:
        model = Pembayaran
        fields = [
            'id', 'tagihan', 'tagihan_id',
            'siswa_nisn', 'siswa_nama', 'tarif_nama',
            'tanggal', 'nominal', 'metode', 'metode_display',
            'bukti', 'nomor_referensi',
            'terverifikasi', 'tanggal_verifikasi', 'verified_by',
            'keterangan', 'created_at', 'created_by', 'updated_by'
        ]
        read_only_fields = [
            'id', 'tanggal_verifikasi', 'verified_by',
            'created_at', 'updated_by'
        ]

    def get_bukti(self, obj):
        """Return full URL for bukti image or None if not exists."""
        if obj.bukti:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.bukti.url)
            return obj.bukti.url
        return None


class PembayaranCreateSerializer(serializers.ModelSerializer):
    """
    Serializer untuk create Pembayaran dengan validasi:
    - Nominal harus > 0
    - Tagihan tidak boleh lunas
    - Bukti harus .jpg/.jpeg/.png, maksimal 2MB
    """

    # Allowed file extensions and max size
    ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png']
    MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB in bytes

    class Meta:
        model = Pembayaran
        fields = [
            'tagihan', 'nominal', 'metode',
            'bukti', 'nomor_referensi', 'keterangan'
        ]

    def validate_nominal(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Nominal pembayaran harus lebih dari 0")
        return value

    def validate_tagihan(self, value):
        if value.status == 'lunas':
            raise serializers.ValidationError("Tagihan ini sudah lunas")
        return value

    def validate_bukti(self, value):
        """
        Validasi file bukti transfer:
        1. Format harus .jpg, .jpeg, atau .png
        2. Ukuran maksimal 2MB
        """
        if value is None:
            return value

        # Validate file extension
        file_name = value.name.lower()
        extension = file_name.split('.')[-1] if '.' in file_name else ''

        if extension not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Format file tidak diizinkan. Hanya menerima: {', '.join(self.ALLOWED_EXTENSIONS)}"
            )

        # Validate file size
        if value.size > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            actual_mb = value.size / (1024 * 1024)
            raise serializers.ValidationError(
                f"Ukuran file terlalu besar ({actual_mb:.1f}MB). Maksimal {max_mb:.0f}MB."
            )

        # Validate file content type (extra security)
        content_type = getattr(value, 'content_type', '')
        valid_content_types = ['image/jpeg', 'image/jpg', 'image/png']
        if content_type and content_type not in valid_content_types:
            raise serializers.ValidationError(
                "Tipe konten file tidak valid. Hanya menerima gambar JPG/PNG."
            )

        return value

    def validate(self, data):
        tagihan = data.get('tagihan')
        nominal = data.get('nominal')
        metode = data.get('metode')
        bukti = data.get('bukti')

        # Require bukti for transfer/qris
        if metode in ['transfer', 'qris'] and not bukti:
            raise serializers.ValidationError({
                'bukti': 'Bukti transfer wajib diupload untuk metode pembayaran ini.'
            })

        # STRICT VALIDATION: Nominal tidak boleh melebihi sisa tagihan
        if tagihan and nominal:
            sisa = tagihan.sisa
            if nominal > sisa:
                raise serializers.ValidationError({
                    'nominal': f'Nominal pembayaran (Rp {nominal:,.0f}) melebihi sisa tagihan (Rp {sisa:,.0f}). '
                               f'Maksimal yang dapat dibayar: Rp {sisa:,.0f}'
                })

            # Minimum pembayaran: Rp 10.000 atau sisa (mana yang lebih kecil)
            min_payment = min(Decimal('10000'), sisa)
            if nominal < min_payment:
                raise serializers.ValidationError({
                    'nominal': f'Nominal pembayaran minimal Rp {min_payment:,.0f}'
                })

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user.username

        return super().create(validated_data)


class PembayaranVerifySerializer(serializers.Serializer):
    """Serializer untuk verifikasi pembayaran"""

    terverifikasi = serializers.BooleanField()
    keterangan = serializers.CharField(required=False, allow_blank=True)


# ============================================
# LAPORAN SERIALIZERS
# ============================================

class LaporanKeuanganSerializer(serializers.ModelSerializer):
    """Serializer untuk Laporan Keuangan"""

    bulan_display = serializers.SerializerMethodField()
    persentase_terbayar = serializers.SerializerMethodField()

    class Meta:
        model = LaporanKeuangan
        fields = [
            'id', 'bulan', 'bulan_display', 'tahun',
            'total_tagihan', 'total_terbayar', 'total_tunggakan',
            'persentase_terbayar',
            'jumlah_siswa_lunas', 'jumlah_siswa_tunggakan',
            'generated_at', 'generated_by'
        ]

    def get_bulan_display(self, obj):
        return dict(Tagihan.BULAN_CHOICES).get(obj.bulan, '')

    def get_persentase_terbayar(self, obj):
        if obj.total_tagihan == 0:
            return 100.0
        return round((obj.total_terbayar / obj.total_tagihan) * 100, 1)


# ============================================
# STATISTICS SERIALIZERS
# ============================================

class FinanceStatisticsSerializer(serializers.Serializer):
    """Serializer untuk statistik keuangan"""

    total_tagihan = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_terbayar = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_tunggakan = serializers.DecimalField(max_digits=15, decimal_places=2)
    jumlah_siswa_lunas = serializers.IntegerField()
    jumlah_siswa_tunggakan = serializers.IntegerField()
    jumlah_pembayaran_pending = serializers.IntegerField()
    persentase_lunas = serializers.FloatField()

    # Breakdown by kategori
    by_kategori = serializers.DictField()

    # Recent activity
    recent_payments = PembayaranSerializer(many=True)
    overdue_tagihan = TagihanSerializer(many=True)
