from django.contrib import admin
from .models import Tarif, Tagihan, Pembayaran, LaporanKeuangan


@admin.register(Tarif)
class TarifAdmin(admin.ModelAdmin):
    list_display = ['nama', 'kategori', 'nominal', 'tahun_ajaran', 'kelas', 'aktif']
    list_filter = ['kategori', 'tahun_ajaran', 'aktif', 'frekuensi']
    search_fields = ['nama', 'deskripsi']
    ordering = ['kategori', 'nama']


@admin.register(Tagihan)
class TagihanAdmin(admin.ModelAdmin):
    list_display = ['siswa', 'tarif', 'bulan', 'tahun', 'total', 'terbayar', 'sisa', 'status', 'jatuh_tempo']
    list_filter = ['status', 'tahun', 'bulan', 'tarif__kategori']
    search_fields = ['siswa__nama', 'siswa__nisn']
    raw_id_fields = ['siswa', 'tarif']
    ordering = ['-tahun', '-bulan', 'siswa']
    readonly_fields = ['total', 'sisa', 'terbayar', 'status']


@admin.register(Pembayaran)
class PembayaranAdmin(admin.ModelAdmin):
    list_display = ['tagihan', 'tanggal', 'nominal', 'metode', 'terverifikasi', 'verified_by']
    list_filter = ['terverifikasi', 'metode', 'tanggal']
    search_fields = ['tagihan__siswa__nama', 'nomor_referensi']
    raw_id_fields = ['tagihan']
    ordering = ['-tanggal']


@admin.register(LaporanKeuangan)
class LaporanKeuanganAdmin(admin.ModelAdmin):
    list_display = ['bulan', 'tahun', 'total_tagihan', 'total_terbayar', 'total_tunggakan', 'generated_at']
    list_filter = ['tahun']
    ordering = ['-tahun', '-bulan']
    readonly_fields = ['total_tagihan', 'total_terbayar', 'total_tunggakan', 'jumlah_siswa_lunas', 'jumlah_siswa_tunggakan']
