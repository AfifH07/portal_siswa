from django.contrib import admin
from .models import Grade


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ('nisn', 'mata_pelajaran', 'nilai', 'semester', 'jenis', 'kelas', 'guru', 'created_at')
    list_filter = ('kelas', 'semester', 'jenis', 'tahun_ajaran', 'mata_pelajaran')
    search_fields = ('nisn__nama', 'nisn__nisn', 'mata_pelajaran', 'guru')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Informasi Siswa', {
            'fields': ('nisn', 'kelas')
        }),
        ('Informasi Nilai', {
            'fields': ('mata_pelajaran', 'nilai', 'jenis', 'semester', 'tahun_ajaran')
        }),
        ('Informasi Guru', {
            'fields': ('guru',)
        }),
        ('Timestamp', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
