from django.contrib import admin
from .models import Attendance, AttendanceDraft, TitipanTugas


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['nisn', 'tanggal', 'jam_ke', 'mata_pelajaran', 'status', 'tipe_pengajar']
    list_filter = ['status', 'jam_ke', 'tipe_pengajar', 'tanggal']
    search_fields = ['nisn__nama', 'nisn__nisn', 'mata_pelajaran']
    date_hierarchy = 'tanggal'


@admin.register(AttendanceDraft)
class AttendanceDraftAdmin(admin.ModelAdmin):
    list_display = ['username', 'kelas', 'tanggal', 'mata_pelajaran', 'created_at']
    list_filter = ['kelas', 'tanggal']
    search_fields = ['username', 'kelas', 'mata_pelajaran']


@admin.register(TitipanTugas)
class TitipanTugasAdmin(admin.ModelAdmin):
    list_display = ['guru', 'kelas', 'mata_pelajaran', 'tanggal_berlaku', 'status', 'guru_piket']
    list_filter = ['status', 'kelas', 'tanggal_berlaku', 'tahun_ajaran']
    search_fields = ['guru__username', 'guru__first_name', 'kelas', 'mata_pelajaran', 'deskripsi_tugas']
    date_hierarchy = 'tanggal_berlaku'
    raw_id_fields = ['guru', 'guru_piket', 'tahun_ajaran']
