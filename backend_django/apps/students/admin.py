from django.contrib import admin
from django.utils.html import format_html
from import_export import resources, fields
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import DateWidget

from .models import Student, Schedule, normalize_kelas_format


# =============================================================
# STUDENT RESOURCE - Excel/CSV Import/Export Configuration
# =============================================================

class StudentResource(resources.ModelResource):
    """
    Resource class for importing/exporting Student data via Excel/CSV.

    Excel Column Mapping:
    - NISN (required, unique identifier)
    - Nama
    - Kelas (will be auto-normalized to "X A" format)
    - Program
    - Jenis Kelamin (L/P)
    - Tempat Lahir
    - Tanggal Lahir (format: YYYY-MM-DD or DD/MM/YYYY)
    - Alamat
    - Email
    - Phone
    - Wali Nama
    - Wali Phone
    - Wali Hubungan
    - Tanggal Masuk
    - Status (aktif/alumni/pindah/dikeluarkan)
    """

    # Custom field definitions for better Excel headers
    tanggal_lahir = fields.Field(
        column_name='Tanggal Lahir',
        attribute='tanggal_lahir',
        widget=DateWidget(format='%Y-%m-%d')
    )
    tanggal_masuk = fields.Field(
        column_name='Tanggal Masuk',
        attribute='tanggal_masuk',
        widget=DateWidget(format='%Y-%m-%d')
    )
    tanggal_keluar = fields.Field(
        column_name='Tanggal Keluar',
        attribute='tanggal_keluar',
        widget=DateWidget(format='%Y-%m-%d')
    )

    class Meta:
        model = Student
        # Use NISN as unique identifier to prevent duplicates
        import_id_fields = ['nisn']

        # Fields to include in import/export
        fields = (
            'nisn',
            'nama',
            'kelas',
            'program',
            'jenis_kelamin',
            'tempat_lahir',
            'tanggal_lahir',
            'alamat',
            'email',
            'phone',
            'wali_nama',
            'wali_phone',
            'wali_hubungan',
            'tanggal_masuk',
            'target_hafalan',
            'current_hafalan',
            'status',
            'tahun_lulus',
            'tanggal_keluar',
        )

        # Export column order
        export_order = fields

        # Skip unchanged rows on import (performance)
        skip_unchanged = True
        report_skipped = True

        # Use bulk operations for better performance
        use_bulk = True
        batch_size = 100

    def before_import_row(self, row, row_number=None, **kwargs):
        """
        Pre-process each row before import.
        - Normalize kelas format
        - Clean whitespace from fields
        - Handle empty values
        """
        # Normalize kelas if present
        if 'kelas' in row and row['kelas']:
            row['kelas'] = normalize_kelas_format(row['kelas'])

        # Handle alternate column names (Indonesian)
        column_mappings = {
            'Nama': 'nama',
            'Kelas': 'kelas',
            'Program': 'program',
            'Jenis Kelamin': 'jenis_kelamin',
            'JK': 'jenis_kelamin',
            'Tempat Lahir': 'tempat_lahir',
            'TTL': 'tempat_lahir',
            'Alamat': 'alamat',
            'Email': 'email',
            'Phone': 'phone',
            'Telepon': 'phone',
            'HP': 'phone',
            'No HP': 'phone',
            'Wali': 'wali_nama',
            'Nama Wali': 'wali_nama',
            'HP Wali': 'wali_phone',
            'Telepon Wali': 'wali_phone',
            'Hubungan Wali': 'wali_hubungan',
            'Hubungan': 'wali_hubungan',
            'Tgl Masuk': 'tanggal_masuk',
            'Target Hafalan': 'target_hafalan',
            'Hafalan Saat Ini': 'current_hafalan',
            'Status': 'status',
            'Tahun Lulus': 'tahun_lulus',
        }

        for indo_name, field_name in column_mappings.items():
            if indo_name in row and indo_name != field_name:
                row[field_name] = row[indo_name]

        # Clean whitespace
        for key, value in row.items():
            if isinstance(value, str):
                row[key] = value.strip()

    def get_export_headers(self):
        """
        Return Indonesian headers for export.
        """
        headers = super().get_export_headers()
        # Map to Indonesian names for better readability
        header_map = {
            'nisn': 'NISN',
            'nama': 'Nama',
            'kelas': 'Kelas',
            'program': 'Program',
            'jenis_kelamin': 'JK',
            'tempat_lahir': 'Tempat Lahir',
            'tanggal_lahir': 'Tanggal Lahir',
            'alamat': 'Alamat',
            'email': 'Email',
            'phone': 'No HP',
            'wali_nama': 'Nama Wali',
            'wali_phone': 'HP Wali',
            'wali_hubungan': 'Hubungan Wali',
            'tanggal_masuk': 'Tanggal Masuk',
            'target_hafalan': 'Target Hafalan',
            'current_hafalan': 'Hafalan Saat Ini',
            'status': 'Status',
            'tahun_lulus': 'Tahun Lulus',
            'tanggal_keluar': 'Tanggal Keluar',
        }
        return [header_map.get(h, h) for h in headers]


# =============================================================
# STUDENT ADMIN - With Import/Export
# =============================================================

@admin.register(Student)
class StudentAdmin(ImportExportModelAdmin):
    """
    Admin for Student model with Excel/CSV import/export functionality.

    Features:
    - Import button: Upload Excel/CSV to bulk create/update students
    - Export button: Download all students as Excel/CSV
    - Colored status badges
    - Quick filters and search
    """

    resource_class = StudentResource

    # List display
    list_display = (
        'nisn', 'nama', 'kelas', 'program',
        'jenis_kelamin', 'status_badge', 'aktif'
    )

    # Filters
    list_filter = ('kelas', 'program', 'status', 'aktif', 'jenis_kelamin', 'tahun_lulus')

    # Search
    search_fields = ('nisn', 'nama', 'email', 'phone', 'wali_nama')

    # Default ordering
    ordering = ('kelas', 'nama')

    # List per page
    list_per_page = 50

    # Fieldsets for detail view
    fieldsets = (
        ('Identitas Santri', {
            'fields': ('nisn', 'nama', 'jenis_kelamin')
        }),
        ('Akademik', {
            'fields': ('kelas', 'program', 'tanggal_masuk', 'status')
        }),
        ('Data Pribadi', {
            'fields': ('tempat_lahir', 'tanggal_lahir', 'alamat', 'email', 'phone'),
            'classes': ('collapse',)
        }),
        ('Data Wali', {
            'fields': ('wali_nama', 'wali_phone', 'wali_hubungan'),
            'classes': ('collapse',)
        }),
        ('Hafalan', {
            'fields': ('target_hafalan', 'current_hafalan', 'target_nilai'),
            'classes': ('collapse',)
        }),
        ('Alumni (jika sudah lulus)', {
            'fields': ('tahun_lulus', 'tanggal_keluar', 'alasan_keluar', 'ijazah_diterima', 'catatan_alumni'),
            'classes': ('collapse',)
        }),
    )

    # Read-only fields
    readonly_fields = ('created_at', 'updated_at')

    # Actions
    actions = ['set_as_alumni', 'set_as_active']

    def status_badge(self, obj):
        """Display status as colored badge"""
        colors = {
            'aktif': '#22c55e',      # Green
            'alumni': '#6366f1',     # Indigo
            'pindah': '#f59e0b',     # Amber
            'dikeluarkan': '#ef4444', # Red
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background:{}; color:white; padding:3px 8px; '
            'border-radius:4px; font-size:11px; font-weight:600;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'

    @admin.action(description='Set selected students as Alumni')
    def set_as_alumni(self, request, queryset):
        """Bulk action to set students as alumni"""
        from django.utils import timezone
        count = queryset.update(
            status='alumni',
            aktif=False,
            tanggal_keluar=timezone.now().date()
        )
        self.message_user(request, f'{count} santri berhasil diubah menjadi Alumni.')

    @admin.action(description='Set selected students as Active')
    def set_as_active(self, request, queryset):
        """Bulk action to reactivate students"""
        count = queryset.update(
            status='aktif',
            aktif=True,
            tanggal_keluar=None
        )
        self.message_user(request, f'{count} santri berhasil diaktifkan kembali.')


# =============================================================
# SCHEDULE ADMIN
# =============================================================

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    """
    Admin for Schedule model.
    """

    list_display = ('kelas', 'hari', 'jam', 'mata_pelajaran', 'username')
    list_filter = ('kelas', 'hari')
    search_fields = ('kelas', 'mata_pelajaran', 'username')
    ordering = ('kelas', 'hari', 'jam')
