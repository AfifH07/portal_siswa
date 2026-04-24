from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('Username harus diisi')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('role', 'superadmin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('superadmin', 'Superadmin'),
        ('pimpinan', 'Pimpinan'),
        ('guru', 'Guru'),
        ('musyrif', 'Musyrif'),           # Pengawas asrama/halaqoh
        ('bk', 'Guru BK'),                # Guru Bimbingan Konseling
        ('bendahara', 'Bendahara'),
        ('walisantri', 'Walisantri'),
        ('adituren', 'Adituren/Alumni'),  # Alumni access
        ('pendaftar', 'Pendaftar'),
    ]

    id = models.BigAutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='pendaftar')
    name = models.CharField(max_length=100)
    nisn = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)

    # Multi-child support: JSONField untuk menyimpan array NISN
    # Format: ["20260001", "20260002"] atau null/[] jika kosong
    linked_student_nisn = models.CharField(max_length=20, blank=True, null=True)  # Legacy - kept for backward compatibility
    linked_student_nisns = models.JSONField(
        default=list,
        blank=True,
        help_text="Array of NISN for multi-child support, e.g. ['20260001', '20260002']"
    )

    kelas = models.CharField(max_length=20, blank=True, null=True)
    mata_pelajaran = models.CharField(max_length=100, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'
        ordering = ['-date_joined']  # Fix UnorderedObjectListWarning
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username} ({self.name})"

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    def get_linked_students(self):
        """
        Get all linked student NISNs.
        Supports both legacy single NISN and new multi-child format.
        Returns: List of NISN strings
        """
        nisns = []

        # Add from new JSONField
        if self.linked_student_nisns:
            if isinstance(self.linked_student_nisns, list):
                nisns.extend(self.linked_student_nisns)
            elif isinstance(self.linked_student_nisns, str):
                nisns.append(self.linked_student_nisns)

        # Add legacy single NISN if not already included
        if self.linked_student_nisn and self.linked_student_nisn not in nisns:
            nisns.append(self.linked_student_nisn)

        return nisns

    def add_linked_student(self, nisn):
        """Add a student NISN to linked_student_nisns."""
        if not self.linked_student_nisns:
            self.linked_student_nisns = []
        if nisn not in self.linked_student_nisns:
            self.linked_student_nisns.append(nisn)
            # Also set legacy field if empty
            if not self.linked_student_nisn:
                self.linked_student_nisn = nisn
            self.save()

    def remove_linked_student(self, nisn):
        """Remove a student NISN from linked_student_nisns."""
        if self.linked_student_nisns and nisn in self.linked_student_nisns:
            self.linked_student_nisns.remove(nisn)
            # Update legacy field if needed
            if self.linked_student_nisn == nisn:
                self.linked_student_nisn = self.linked_student_nisns[0] if self.linked_student_nisns else None
            self.save()


class ResetToken(models.Model):
    username = models.CharField(max_length=50)
    token = models.CharField(max_length=10, unique=True)
    status = models.CharField(max_length=10, choices=[('Active', 'Active'), ('Used', 'Used')], default='Active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reset_tokens'

    def __str__(self):
        return f"{self.username} - {self.token}"


class Assignment(models.Model):
    """
    Model untuk Assignment Ustadz/Ustadzah ke Kelas atau Halaqoh.

    Jenis Assignment:
    - kbm: Kegiatan Belajar Mengajar (mata pelajaran formal)
    - diniyah: Pembelajaran Diniyah (kitab kuning, dll)
    - halaqoh: Kelompok Halaqoh Tahfidz/Tahsin
    - piket: Tugas Piket Harian
    - wali_kelas: Wali Kelas
    """

    ASSIGNMENT_TYPE_CHOICES = [
        ('kbm', 'KBM (Kegiatan Belajar Mengajar)'),
        ('diniyah', 'Diniyah'),
        ('halaqoh', 'Halaqoh Tahfidz/Tahsin'),
        ('piket', 'Piket Harian'),
        ('wali_kelas', 'Wali Kelas'),
    ]

    STATUS_CHOICES = [
        ('active', 'Aktif'),
        ('inactive', 'Tidak Aktif'),
        ('pending', 'Pending'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='assignments',
        help_text="Ustadz/Ustadzah yang ditugaskan"
    )
    assignment_type = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_TYPE_CHOICES,
        help_text="Jenis penugasan"
    )

    # Target assignment (salah satu yang diisi)
    kelas = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Kelas yang ditugaskan (untuk KBM/Diniyah/Wali Kelas)"
    )
    halaqoh_id = models.BigIntegerField(
        blank=True,
        null=True,
        help_text="ID Halaqoh yang ditugaskan (untuk assignment Halaqoh)"
    )

    # Detail assignment
    mata_pelajaran = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Mata pelajaran (untuk KBM)"
    )
    hari = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Hari tugas (untuk piket), format: Senin,Selasa,Rabu"
    )

    # Periode
    tahun_ajaran = models.CharField(
        max_length=10,
        help_text="Tahun ajaran, format: 2025/2026"
    )
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')],
        default='Ganjil'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    catatan = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Username admin yang membuat assignment"
    )

    class Meta:
        db_table = 'user_assignments'
        ordering = ['-created_at']
        verbose_name = 'Assignment'
        verbose_name_plural = 'Assignments'
        indexes = [
            models.Index(fields=['user', 'assignment_type'], name='idx_assign_user_type'),
            models.Index(fields=['kelas', 'assignment_type'], name='idx_assign_kelas_type'),
            models.Index(fields=['tahun_ajaran', 'semester'], name='idx_assign_periode'),
            models.Index(fields=['status'], name='idx_assign_status'),
        ]
        # Unique constraint: satu user tidak bisa double assignment yang sama
        unique_together = ['user', 'assignment_type', 'kelas', 'halaqoh_id', 'tahun_ajaran', 'semester']

    def __str__(self):
        target = self.kelas or f"Halaqoh #{self.halaqoh_id}" or "N/A"
        return f"{self.user.name} - {self.get_assignment_type_display()} - {target}"

    @property
    def target_display(self):
        """Return human-readable target assignment"""
        if self.assignment_type == 'halaqoh' and self.halaqoh_id:
            try:
                from apps.kesantrian.models import Halaqoh
                halaqoh = Halaqoh.objects.get(id=self.halaqoh_id)
                return f"Halaqoh: {halaqoh.nama}"
            except:
                return f"Halaqoh #{self.halaqoh_id}"
        elif self.kelas:
            if self.mata_pelajaran:
                return f"{self.kelas} - {self.mata_pelajaran}"
            return self.kelas
        elif self.hari:
            return f"Piket: {self.hari}"
        return "-"

    def clean(self):
        """Validate assignment data"""
        from django.core.exceptions import ValidationError

        # Halaqoh assignment must have halaqoh_id
        if self.assignment_type == 'halaqoh' and not self.halaqoh_id:
            raise ValidationError("Assignment Halaqoh harus memiliki halaqoh_id")

        # KBM/Diniyah/Wali Kelas must have kelas
        if self.assignment_type in ['kbm', 'diniyah', 'wali_kelas'] and not self.kelas:
            raise ValidationError(f"Assignment {self.get_assignment_type_display()} harus memiliki kelas")

        # Piket must have hari
        if self.assignment_type == 'piket' and not self.hari:
            raise ValidationError("Assignment Piket harus memiliki hari")

        # Wali Kelas: Only one active wali per class
        if self.assignment_type == 'wali_kelas' and self.kelas and self.status == 'active':
            existing = Assignment.objects.filter(
                assignment_type='wali_kelas',
                kelas=self.kelas,
                status='active',
                tahun_ajaran=self.tahun_ajaran,
                semester=self.semester
            ).exclude(pk=self.pk).first()
            if existing:
                raise ValidationError(
                    f"Kelas {self.kelas} sudah memiliki wali kelas aktif: {existing.user.name or existing.user.username}"
                )


class UserActivity(models.Model):
    """
    Model untuk logging aktivitas user management.
    Audit trail untuk keamanan dan compliance.
    """

    ACTION_CHOICES = [
        ('create', 'Create User'),
        ('update', 'Update User'),
        ('delete', 'Delete User'),
        ('reset_password', 'Reset Password'),
        ('assign', 'Assign Role/Task'),
        ('unassign', 'Remove Assignment'),
        ('activate', 'Activate User'),
        ('deactivate', 'Deactivate User'),
        ('login', 'Login'),
        ('logout', 'Logout'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='activities_performed',
        help_text="User yang melakukan aksi"
    )
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='activities_received',
        help_text="User yang menjadi target aksi"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detail perubahan dalam format JSON"
    )
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_activities'
        ordering = ['-timestamp']
        verbose_name = 'User Activity'
        verbose_name_plural = 'User Activities'
        indexes = [
            models.Index(fields=['user', 'timestamp'], name='idx_activity_user_time'),
            models.Index(fields=['action', 'timestamp'], name='idx_activity_action_time'),
            models.Index(fields=['target_user'], name='idx_activity_target'),
        ]

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.get_action_display()} - {self.timestamp}"


# =============================================================
# KELAS NORMALIZATION - Database Level Guard for accounts models
# =============================================================

def _get_normalize_kelas_format():
    """
    Lazy import to avoid circular import issues.
    Returns the normalize_kelas_format function from students.models.
    """
    from apps.students.models import normalize_kelas_format
    return normalize_kelas_format


@receiver(pre_save, sender=User)
def normalize_user_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in User model.
    Applies to Guru/Wali_Kelas who have assigned classes.
    """
    if instance.kelas:
        normalize_fn = _get_normalize_kelas_format()
        normalized = normalize_fn(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized


@receiver(pre_save, sender=Assignment)
def normalize_assignment_kelas(sender, instance, **kwargs):
    """
    Pre-save signal to normalize kelas field in Assignment model.
    """
    if instance.kelas:
        normalize_fn = _get_normalize_kelas_format()
        normalized = normalize_fn(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized


class CatatanKelas(models.Model):
    """
    Model untuk catatan harian Wali Kelas.
    Digunakan untuk mencatat perkembangan kelas secara berkala.
    """
    KATEGORI_CHOICES = [
        ('harian', 'Catatan Harian'),
        ('akademik', 'Akademik'),
        ('kedisiplinan', 'Kedisiplinan'),
        ('kegiatan', 'Kegiatan Kelas'),
        ('lainnya', 'Lainnya'),
    ]

    id = models.BigAutoField(primary_key=True)
    wali_kelas = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='catatan_kelas',
        help_text="Wali Kelas yang membuat catatan"
    )
    kelas = models.CharField(
        max_length=20,
        help_text="Kelas yang dicatat"
    )
    tanggal = models.DateField(
        help_text="Tanggal catatan"
    )
    kategori = models.CharField(
        max_length=20,
        choices=KATEGORI_CHOICES,
        default='harian'
    )
    judul = models.CharField(
        max_length=200,
        help_text="Judul singkat catatan"
    )
    isi = models.TextField(
        help_text="Isi catatan lengkap"
    )
    tahun_ajaran = models.CharField(
        max_length=10,
        help_text="Tahun ajaran, format: 2025/2026"
    )
    semester = models.CharField(
        max_length=10,
        choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')],
        default='Ganjil'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catatan_kelas'
        ordering = ['-tanggal', '-created_at']
        verbose_name = 'Catatan Kelas'
        verbose_name_plural = 'Catatan Kelas'

    def __str__(self):
        return f"{self.kelas} - {self.tanggal} - {self.judul}"


@receiver(pre_save, sender=CatatanKelas)
def normalize_catatan_kelas(sender, instance, **kwargs):
    """Normalize kelas field in CatatanKelas."""
    if instance.kelas:
        normalize_fn = _get_normalize_kelas_format()
        normalized = normalize_fn(instance.kelas)
        if normalized != instance.kelas:
            instance.kelas = normalized
