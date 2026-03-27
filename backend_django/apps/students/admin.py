from django.contrib import admin
from django.utils.html import format_html
from import_export import resources, fields
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import DateWidget
from import_export.results import RowResult
import re
import logging

from .models import Student, Schedule, normalize_kelas_format

logger = logging.getLogger(__name__)


# =============================================================
# FLEXIBLE DATE WIDGET - Handles multiple date formats
# =============================================================

class FlexibleDateWidget(DateWidget):
    """
    Custom DateWidget that handles multiple date formats from school Excel files.
    Supports: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, D/M/YYYY, etc.
    """

    def clean(self, value, row=None, *args, **kwargs):
        if not value:
            return None

        # If already a date object, return as is
        if hasattr(value, 'year'):
            return value

        value = str(value).strip()

        # Try multiple date formats
        date_formats = [
            '%Y-%m-%d',      # 2024-03-27
            '%d/%m/%Y',      # 27/03/2024
            '%d-%m-%Y',      # 27-03-2024
            '%d %B %Y',      # 27 March 2024
            '%d %b %Y',      # 27 Mar 2024
            '%Y/%m/%d',      # 2024/03/27
            '%m/%d/%Y',      # 03/27/2024 (US format)
        ]

        from datetime import datetime
        for fmt in date_formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

        # If nothing works, log warning and return None
        logger.warning(f"[FlexibleDateWidget] Could not parse date: '{value}'")
        return None


# =============================================================
# STUDENT RESOURCE - Excel/CSV Import/Export Configuration
# =============================================================

class StudentResource(resources.ModelResource):
    """
    Resource class for importing/exporting Student data via Excel/CSV.

    SUPPORTS SCHOOL EXCEL FORMAT:
    ┌─────────────────────────────────────────────────────┐
    │ Row 1: "Daftar Peserta Didik"        (SKIPPED)      │
    │ Row 2: "SMA Bina Insan Mandiri"      (SKIPPED)      │
    │ Row 3: "Tahun Pelajaran 2025/2026"   (SKIPPED)      │
    │ Row 4: (empty row)                   (SKIPPED)      │
    │ Row 5: No | Nama | NISN | JK | ...   (HEADER ROW)   │
    │ Row 6+: Data rows                    (IMPORTED)     │
    └─────────────────────────────────────────────────────┘

    Column Mapping (School Excel → Database Field):
    - "Nama"              → nama
    - "NISN"              → nisn (unique identifier)
    - "JK"                → jenis_kelamin (L/P)
    - "Tempat Lahir"      → tempat_lahir
    - "Tanggal Lahir"     → tanggal_lahir
    - "Rombel Saat Ini"   → kelas (auto-normalized to "X A" format)
    - "Alamat"            → alamat
    - "Email"             → email
    - "No HP"             → phone
    """

    # =============================================================
    # FIELD DEFINITIONS - Map Excel columns to model fields
    # =============================================================

    # Primary fields with exact column name mapping
    nisn = fields.Field(
        column_name='NISN',
        attribute='nisn'
    )
    nama = fields.Field(
        column_name='Nama',
        attribute='nama'
    )
    jenis_kelamin = fields.Field(
        column_name='JK',
        attribute='jenis_kelamin'
    )
    tempat_lahir = fields.Field(
        column_name='Tempat Lahir',
        attribute='tempat_lahir'
    )
    tanggal_lahir = fields.Field(
        column_name='Tanggal Lahir',
        attribute='tanggal_lahir',
        widget=FlexibleDateWidget()
    )

    # "Rombel Saat Ini" is the school's column name for class
    kelas = fields.Field(
        column_name='Rombel Saat Ini',
        attribute='kelas'
    )

    # Optional fields that may or may not exist in school Excel
    alamat = fields.Field(
        column_name='Alamat',
        attribute='alamat'
    )
    email = fields.Field(
        column_name='Email',
        attribute='email'
    )
    phone = fields.Field(
        column_name='No HP',
        attribute='phone'
    )

    # Additional optional fields with alternate column names
    program = fields.Field(
        column_name='Program',
        attribute='program'
    )
    wali_nama = fields.Field(
        column_name='Nama Wali',
        attribute='wali_nama'
    )
    wali_phone = fields.Field(
        column_name='HP Wali',
        attribute='wali_phone'
    )
    tanggal_masuk = fields.Field(
        column_name='Tanggal Masuk',
        attribute='tanggal_masuk',
        widget=FlexibleDateWidget()
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
        - Map alternate column names to standard field names
        - Normalize kelas format
        - Clean whitespace from fields
        - Skip junk/header rows
        """
        # =============================================================
        # STEP 1: Map alternate column names (handles variations)
        # =============================================================
        column_mappings = {
            # NISN variations
            'Nisn': 'NISN',
            'nisn': 'NISN',
            'NIS': 'NISN',
            'Nis': 'NISN',

            # Nama variations
            'nama': 'Nama',
            'NAMA': 'Nama',
            'Nama Lengkap': 'Nama',
            'Nama Siswa': 'Nama',
            'Nama Peserta Didik': 'Nama',

            # Jenis Kelamin variations
            'Jenis Kelamin': 'JK',
            'jenis_kelamin': 'JK',
            'Gender': 'JK',
            'L/P': 'JK',

            # Kelas variations (map to "Rombel Saat Ini")
            'Kelas': 'Rombel Saat Ini',
            'kelas': 'Rombel Saat Ini',
            'Rombel': 'Rombel Saat Ini',
            'Tingkat': 'Rombel Saat Ini',

            # Phone variations
            'HP': 'No HP',
            'Telepon': 'No HP',
            'Phone': 'No HP',
            'No Telepon': 'No HP',
            'No. HP': 'No HP',

            # Wali variations
            'Wali': 'Nama Wali',
            'Nama Orang Tua': 'Nama Wali',
            'Orang Tua': 'Nama Wali',
            'HP Orang Tua': 'HP Wali',
            'Telepon Wali': 'HP Wali',
        }

        # Apply column mappings
        for alt_name, standard_name in column_mappings.items():
            if alt_name in row and alt_name != standard_name:
                if standard_name not in row or not row.get(standard_name):
                    row[standard_name] = row[alt_name]

        # =============================================================
        # STEP 2: Clean whitespace and normalize values
        # =============================================================
        for key, value in list(row.items()):
            if isinstance(value, str):
                row[key] = value.strip()

        # =============================================================
        # STEP 3: Normalize kelas format (10-A → X A, etc.)
        # =============================================================
        kelas_value = row.get('Rombel Saat Ini') or row.get('kelas') or row.get('Kelas')
        if kelas_value:
            row['Rombel Saat Ini'] = normalize_kelas_format(kelas_value)

        # =============================================================
        # STEP 4: Normalize jenis kelamin (ensure L or P)
        # =============================================================
        jk_value = row.get('JK', '')
        if jk_value:
            jk_upper = str(jk_value).strip().upper()
            if jk_upper in ['LAKI-LAKI', 'LAKI', 'MALE', 'M', 'L']:
                row['JK'] = 'L'
            elif jk_upper in ['PEREMPUAN', 'WANITA', 'FEMALE', 'F', 'P']:
                row['JK'] = 'P'

        # Log for debugging
        nisn = row.get('NISN', 'N/A')
        nama = row.get('Nama', 'N/A')
        logger.debug(f"[StudentImport] Row {row_number}: NISN={nisn}, Nama={nama}")

    def skip_row(self, instance, original, row, import_validation_errors=None):
        """
        Determine if a row should be skipped.
        Skip rows that:
        - Are junk header rows (no valid NISN)
        - Have empty NISN
        - Are title rows like "Daftar Peserta Didik"
        """
        # Get NISN value
        nisn = row.get('NISN', '')

        # Skip if NISN is empty
        if not nisn:
            logger.debug(f"[StudentImport] Skipping row - empty NISN")
            return True

        # Skip if NISN is not a valid number (likely a header row)
        nisn_str = str(nisn).strip()

        # Skip junk rows (titles, headers, etc.)
        junk_patterns = [
            'nisn',              # Header row
            'daftar',           # "Daftar Peserta Didik"
            'peserta',          # "Peserta Didik"
            'tahun',            # "Tahun Pelajaran"
            'no',               # "No" column header
            'nama sekolah',     # School name row
            'sma',              # School name
            'smp',              # School name
            'mts',              # School name
            'ma ',              # School name
        ]

        nisn_lower = nisn_str.lower()
        for pattern in junk_patterns:
            if pattern in nisn_lower:
                logger.debug(f"[StudentImport] Skipping junk row: NISN='{nisn_str}'")
                return True

        # Skip if NISN doesn't look like a valid ID (should be mostly digits)
        # NISN is typically 10 digits, but allow some flexibility
        clean_nisn = re.sub(r'[^0-9]', '', nisn_str)
        if len(clean_nisn) < 5:  # Too short to be valid NISN
            logger.debug(f"[StudentImport] Skipping row - invalid NISN format: '{nisn_str}'")
            return True

        return super().skip_row(instance, original, row, import_validation_errors)

    def get_export_headers(self):
        """
        Return Indonesian headers for export.
        """
        headers = super().get_export_headers()
        # Map to Indonesian names for better readability
        header_map = {
            'nisn': 'NISN',
            'nama': 'Nama',
            'kelas': 'Rombel Saat Ini',
            'program': 'Program',
            'jenis_kelamin': 'JK',
            'tempat_lahir': 'Tempat Lahir',
            'tanggal_lahir': 'Tanggal Lahir',
            'alamat': 'Alamat',
            'email': 'Email',
            'phone': 'No HP',
            'wali_nama': 'Nama Wali',
            'wali_phone': 'HP Wali',
        }
        return [header_map.get(h, h) for h in headers]

    def after_import(self, dataset, result, using_transactions, dry_run, **kwargs):
        """
        Called after import is complete. Log summary.
        """
        logger.info(f"[StudentImport] Import complete: "
                   f"{result.totals['new']} new, "
                   f"{result.totals['update']} updated, "
                   f"{result.totals['skip']} skipped, "
                   f"{result.totals['error']} errors")


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
