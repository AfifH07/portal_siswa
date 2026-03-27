from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, ResetToken, Assignment, UserActivity


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Custom admin for User model with role-based fields.
    """

    # List display columns
    list_display = (
        'username', 'name', 'role_badge', 'kelas',
        'is_active', 'is_staff', 'date_joined'
    )
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser', 'kelas')
    search_fields = ('username', 'name', 'email', 'nisn', 'phone')
    ordering = ('-date_joined',)

    # Form fieldsets for editing existing users
    fieldsets = (
        (None, {
            'fields': ('username', 'password')
        }),
        ('Informasi Personal', {
            'fields': ('name', 'email', 'phone', 'nisn')
        }),
        ('Role & Penugasan', {
            'fields': ('role', 'kelas', 'mata_pelajaran'),
            'description': 'Tentukan role dan penugasan kelas untuk user ini.'
        }),
        ('Link ke Santri (untuk Walisantri)', {
            'fields': ('linked_student_nisn', 'linked_student_nisns'),
            'classes': ('collapse',),
            'description': 'Untuk akun walisantri, link ke NISN anak.'
        }),
        ('Status & Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
        }),
        ('Tanggal Penting', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',),
        }),
    )

    # Form fieldsets for creating new users
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2'),
        }),
        ('Informasi Personal', {
            'classes': ('wide',),
            'fields': ('name', 'email', 'phone'),
        }),
        ('Role & Penugasan', {
            'classes': ('wide',),
            'fields': ('role', 'kelas', 'mata_pelajaran'),
        }),
    )

    readonly_fields = ('date_joined', 'last_login')

    def role_badge(self, obj):
        """Display role as colored badge"""
        colors = {
            'superadmin': '#dc2626',    # Red
            'pimpinan': '#7c3aed',      # Purple
            'guru': '#2563eb',          # Blue
            'musyrif': '#0891b2',       # Cyan
            'wali_kelas': '#059669',    # Green
            'bk': '#d97706',            # Amber
            'bendahara': '#65a30d',     # Lime
            'walisantri': '#6366f1',    # Indigo
            'adituren': '#64748b',      # Slate
            'pendaftar': '#a3a3a3',     # Gray
        }
        color = colors.get(obj.role, '#6b7280')
        return format_html(
            '<span style="background:{}; color:white; padding:3px 8px; '
            'border-radius:4px; font-size:11px; font-weight:600;">{}</span>',
            color, obj.get_role_display()
        )
    role_badge.short_description = 'Role'
    role_badge.admin_order_field = 'role'


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    """
    Admin for managing user assignments (KBM, Halaqoh, Piket, etc.)
    """

    list_display = (
        'user', 'assignment_type', 'target_display',
        'tahun_ajaran', 'semester', 'status_badge'
    )
    list_filter = ('assignment_type', 'status', 'tahun_ajaran', 'semester', 'kelas')
    search_fields = ('user__username', 'user__name', 'kelas', 'mata_pelajaran')
    ordering = ('-created_at',)

    fieldsets = (
        ('Penugasan', {
            'fields': ('user', 'assignment_type', 'status')
        }),
        ('Target', {
            'fields': ('kelas', 'halaqoh_id', 'mata_pelajaran', 'hari'),
            'description': 'Isi sesuai jenis assignment (kelas untuk KBM/Diniyah, halaqoh_id untuk Halaqoh, hari untuk Piket)'
        }),
        ('Periode', {
            'fields': ('tahun_ajaran', 'semester')
        }),
        ('Catatan', {
            'fields': ('catatan',),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ['user']

    def status_badge(self, obj):
        colors = {
            'active': '#22c55e',
            'inactive': '#ef4444',
            'pending': '#f59e0b',
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background:{}; color:white; padding:2px 6px; '
            'border-radius:3px; font-size:10px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(ResetToken)
class ResetTokenAdmin(admin.ModelAdmin):
    """
    Admin for password reset tokens (read-only for security)
    """

    list_display = ('username', 'token_masked', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('username',)
    ordering = ('-created_at',)

    readonly_fields = ('username', 'token', 'created_at')

    def token_masked(self, obj):
        """Mask token for security"""
        if obj.token:
            return f"{obj.token[:3]}****"
        return "-"
    token_masked.short_description = 'Token'

    def has_add_permission(self, request):
        """Disable manual token creation"""
        return False


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    """
    Admin for viewing user activity logs (read-only audit trail)
    """

    list_display = ('timestamp', 'user', 'action_badge', 'target_user', 'ip_address')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__username', 'target_user__username', 'ip_address')
    ordering = ('-timestamp',)
    date_hierarchy = 'timestamp'

    readonly_fields = (
        'user', 'target_user', 'action', 'details',
        'ip_address', 'user_agent', 'timestamp'
    )

    def action_badge(self, obj):
        colors = {
            'create': '#22c55e',
            'update': '#3b82f6',
            'delete': '#ef4444',
            'reset_password': '#f59e0b',
            'login': '#10b981',
            'logout': '#6b7280',
        }
        color = colors.get(obj.action, '#6b7280')
        return format_html(
            '<span style="background:{}; color:white; padding:2px 6px; '
            'border-radius:3px; font-size:10px;">{}</span>',
            color, obj.get_action_display()
        )
    action_badge.short_description = 'Action'

    def has_add_permission(self, request):
        """Disable manual activity creation"""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing - audit logs are immutable"""
        return False

    def has_delete_permission(self, request, obj=None):
        """Disable deletion - audit logs should be preserved"""
        return False
