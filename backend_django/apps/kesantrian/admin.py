from django.contrib import admin
from .models import Ibadah, Halaqoh, HalaqohMember, Pembinaan, TargetHafalan


@admin.register(Ibadah)
class IbadahAdmin(admin.ModelAdmin):
    list_display = ['siswa', 'tanggal', 'jenis', 'waktu', 'status', 'pencatat']
    list_filter = ['jenis', 'waktu', 'status', 'tanggal']
    search_fields = ['siswa__nama', 'siswa__nisn', 'pencatat']
    date_hierarchy = 'tanggal'
    ordering = ['-tanggal', 'waktu']


@admin.register(Halaqoh)
class HalaqohAdmin(admin.ModelAdmin):
    list_display = ['nama', 'jenis', 'musyrif', 'jumlah_anggota', 'kapasitas', 'aktif']
    list_filter = ['jenis', 'aktif', 'tahun_ajaran']
    search_fields = ['nama', 'musyrif']


@admin.register(HalaqohMember)
class HalaqohMemberAdmin(admin.ModelAdmin):
    list_display = ['siswa', 'halaqoh', 'tanggal_gabung', 'aktif']
    list_filter = ['halaqoh', 'aktif']
    search_fields = ['siswa__nama', 'siswa__nisn']


@admin.register(Pembinaan)
class PembinaanAdmin(admin.ModelAdmin):
    list_display = ['siswa', 'tanggal', 'kategori', 'judul', 'tingkat', 'pembina']
    list_filter = ['kategori', 'tingkat', 'tanggal']
    search_fields = ['siswa__nama', 'siswa__nisn', 'judul', 'pembina']
    date_hierarchy = 'tanggal'


@admin.register(TargetHafalan)
class TargetHafalanAdmin(admin.ModelAdmin):
    list_display = ['siswa', 'semester', 'tahun_ajaran', 'target_juz', 'tercapai_juz', 'persentase_tercapai']
    list_filter = ['semester', 'tahun_ajaran']
    search_fields = ['siswa__nama', 'siswa__nisn']
