"""
Core Admin - Master Data
Portal Ponpes Baron v2.3.3
"""

from django.contrib import admin
from .models import TahunAjaran


@admin.register(TahunAjaran)
class TahunAjaranAdmin(admin.ModelAdmin):
    list_display = ['nama', 'semester', 'is_active', 'tanggal_mulai', 'tanggal_selesai', 'updated_at']
    list_filter = ['semester', 'is_active']
    search_fields = ['nama']
    ordering = ['-nama', '-semester']
    list_editable = ['is_active']

    fieldsets = (
        ('Informasi Tahun Ajaran', {
            'fields': ('nama', 'semester', 'is_active')
        }),
        ('Periode', {
            'fields': ('tanggal_mulai', 'tanggal_selesai'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """
        Use the model's save() method which handles is_active logic.
        """
        obj.save()
