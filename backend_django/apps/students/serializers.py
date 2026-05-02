import re
from rest_framework import serializers
from .models import Student, Schedule


# Valid class format: "X A", "X B", "X C", "X D", "XI A", etc.
VALID_GRADES = ['X', 'XI', 'XII']
VALID_SECTIONS = ['A', 'B', 'C', 'D']


def validate_kelas_format(value):
    """
    Validate and normalize class format.
    Expected: "X A", "XI B", "XII C", etc.
    Also accepts: "X-A", "XA", "x a", etc. and normalizes them.
    """
    if not value:
        return value

    # Normalize: uppercase, remove extra spaces
    value = value.strip().upper()

    # Pattern: "X A", "XI B", "XII C" (with optional dash/underscore separator)
    # Note: XII must come first in alternation to avoid partial match
    match = re.match(r'^(XII|XI|X)\s*[-_]?\s*([A-D])$', value)

    if match:
        grade = match.group(1)
        section = match.group(2)

        if grade in VALID_GRADES and section in VALID_SECTIONS:
            return f"{grade} {section}"  # Normalized format

    raise serializers.ValidationError(
        f'Format kelas tidak valid. Gunakan format seperti "X A", "XI B", "XII C". '
        f'Tingkat: {", ".join(VALID_GRADES)}. Kelas: {", ".join(VALID_SECTIONS)}.'
    )


class StudentListSerializer(serializers.ModelSerializer):
    progress_hafalan_percentage = serializers.SerializerMethodField()
    hafalan_status = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'nisn', 'nis', 'nama', 'kelas', 'program', 'jenis_kelamin',
            'aktif', 'progress_hafalan_percentage', 'hafalan_status',
            'current_hafalan', 'target_hafalan'
        ]

    def get_progress_hafalan_percentage(self, obj):
        if obj.target_hafalan > 0:
            return round((obj.current_hafalan / obj.target_hafalan) * 100, 2)
        return 0

    def get_hafalan_status(self, obj):
        if obj.target_hafalan == 0:
            return 'target'
        return 'above_target' if obj.current_hafalan >= obj.target_hafalan else 'below_target'


class StudentSerializer(serializers.ModelSerializer):
    progress_hafalan_percentage = serializers.SerializerMethodField()
    progress_nilai_percentage = serializers.SerializerMethodField()
    hafalan_status = serializers.SerializerMethodField()
    nilai_status = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'nisn', 'nis', 'nama', 'kelas', 'program', 'jenis_kelamin',
            'email', 'phone', 'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'current_hafalan', 'target_nilai',
            'aktif', 'catatan', 'progress_hafalan_percentage',
            'progress_nilai_percentage', 'hafalan_status', 'nilai_status'
        ]

    def get_progress_hafalan_percentage(self, obj):
        if obj.target_hafalan > 0:
            return round((obj.current_hafalan / obj.target_hafalan) * 100, 2)
        return 0

    def get_progress_nilai_percentage(self, obj):
        if obj.target_nilai > 0:
            return round(75, 2)
        return 0

    def get_hafalan_status(self, obj):
        if obj.target_hafalan == 0:
            return 'target'
        return 'above_target' if obj.current_hafalan >= obj.target_hafalan else 'below_target'

    def get_nilai_status(self, obj):
        return 'above_target' if 75 >= obj.target_nilai else 'below_target'


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'nisn', 'nis', 'nama', 'kelas', 'program', 'jenis_kelamin',
            'email', 'phone', 'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'target_nilai', 'aktif', 'catatan'
        ]

    def validate_nisn(self, value):
        if Student.objects.filter(nisn=value).exists():
            raise serializers.ValidationError('NISN sudah terdaftar!')
        return value

    def validate_nis(self, value):
        if value and Student.objects.filter(nis=value).exists():
            raise serializers.ValidationError('NIS sudah terdaftar!')
        return value

    def validate_jenis_kelamin(self, value):
        if value and value not in ['L', 'P']:
            raise serializers.ValidationError('Jenis kelamin harus L atau P!')
        return value

    def validate_kelas(self, value):
        """Validate and normalize class format"""
        return validate_kelas_format(value)

    def validate_target_hafalan(self, value):
        if value < 0:
            raise serializers.ValidationError('Target hafalan tidak boleh negatif!')
        if value > 30:
            raise serializers.ValidationError('Target hafalan maksimal 30 juz!')
        return value

    def validate_target_nilai(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Target nilai harus antara 0-100!')
        return value


class StudentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'nis', 'nama', 'kelas', 'program', 'jenis_kelamin',
            'email', 'phone', 'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'current_hafalan', 'target_nilai', 'aktif', 'catatan'
        ]

    def validate_nis(self, value):
        instance = self.instance
        if value and Student.objects.filter(nis=value).exclude(nisn=instance.nisn).exists():
            raise serializers.ValidationError('NIS sudah terdaftar!')
        return value

    def validate_jenis_kelamin(self, value):
        if value and value not in ['L', 'P']:
            raise serializers.ValidationError('Jenis kelamin harus L atau P!')
        return value

    def validate_kelas(self, value):
        """Validate and normalize class format"""
        return validate_kelas_format(value)

    def validate_target_hafalan(self, value):
        if value < 0:
            raise serializers.ValidationError('Target hafalan tidak boleh negatif!')
        if value > 30:
            raise serializers.ValidationError('Target hafalan maksimal 30 juz!')
        return value

    def validate_target_nilai(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Target nilai harus antara 0-100!')
        return value

    def validate_current_hafalan(self, value):
        if value < 0:
            raise serializers.ValidationError('Current hafalan tidak boleh negatif!')
        return value


class ScheduleSerializer(serializers.ModelSerializer):
    waktu_display = serializers.SerializerMethodField()
    jam_ke_display = serializers.SerializerMethodField()
    guru_name = serializers.SerializerMethodField()
    sesi = serializers.SerializerMethodField()
    master_jam_id = serializers.IntegerField(source='master_jam.id', read_only=True, allow_null=True)
    master_jam_akhir_id = serializers.IntegerField(source='master_jam_akhir.id', read_only=True, allow_null=True)

    class Meta:
        model = Schedule
        fields = [
            'id', 'username', 'guru_name', 'kelas', 'hari', 'jam',
            'jam_ke', 'jam_mulai', 'jam_selesai',
            'master_jam', 'master_jam_id', 'sesi',
            'master_jam_akhir', 'master_jam_akhir_id',
            'jam_ke_akhir', 'jam_selesai_akhir',
            'waktu_display', 'jam_ke_display',
            'mata_pelajaran', 'tahun_ajaran', 'semester',
            'is_active', 'created_at', 'updated_at'
        ]

    def get_guru_name(self, obj):
        """Return guru's full name from User model."""
        from apps.accounts.models import User
        user = User.objects.filter(username=obj.username).first()
        return (user.name or user.username) if user else obj.username

    def get_sesi(self, obj):
        """Return sesi from master_jam (tahfidz/kbm/diniyah)."""
        return obj.master_jam.sesi if obj.master_jam else None

    def get_waktu_display(self, obj):
        """Return formatted time range (uses jam_selesai_akhir if available)."""
        if obj.jam_mulai:
            # Jika ada jam_selesai_akhir (rentang), gunakan itu
            if obj.jam_selesai_akhir:
                return f"{obj.jam_mulai.strftime('%H:%M')} - {obj.jam_selesai_akhir.strftime('%H:%M')}"
            elif obj.jam_selesai:
                return f"{obj.jam_mulai.strftime('%H:%M')} - {obj.jam_selesai.strftime('%H:%M')}"
        elif obj.jam:
            return obj.jam
        return "-"

    def get_jam_ke_display(self, obj):
        """Return formatted jam ke range (e.g., '1-3' or '1')."""
        if obj.jam_ke:
            if obj.jam_ke_akhir and obj.jam_ke_akhir != obj.jam_ke:
                return f"{obj.jam_ke}-{obj.jam_ke_akhir}"
            return str(obj.jam_ke)
        return "-"


# ============================================
# ALUMNI SERIALIZERS
# ============================================

class AlumniListSerializer(serializers.ModelSerializer):
    """Serializer for listing alumni students (read-only)."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Student
        fields = [
            'nisn', 'nama', 'kelas', 'program', 'status', 'status_display',
            'tahun_lulus', 'tanggal_keluar', 'ijazah_diterima', 'catatan_alumni',
            'wali_nama', 'wali_phone'
        ]
        read_only_fields = fields


class AlumniDetailSerializer(serializers.ModelSerializer):
    """Full alumni detail (read-only for walisantri)."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_alumni = serializers.BooleanField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'nisn', 'nama', 'kelas', 'program', 'email', 'phone',
            'tempat_lahir', 'tanggal_lahir', 'alamat', 'jenis_kelamin',
            'wali_nama', 'wali_name', 'wali_phone', 'wali_hubungan',
            'tanggal_masuk', 'target_hafalan', 'current_hafalan',
            'status', 'status_display', 'is_alumni',
            'tahun_lulus', 'tanggal_keluar', 'alasan_keluar',
            'ijazah_diterima', 'catatan_alumni',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields


class SetAlumniSerializer(serializers.Serializer):
    """Serializer for converting student to alumni status."""
    nisn = serializers.CharField(required=True)
    tahun_lulus = serializers.CharField(required=False, allow_blank=True)
    catatan = serializers.CharField(required=False, allow_blank=True)
    alasan_keluar = serializers.CharField(required=False, allow_blank=True)

    def validate_nisn(self, value):
        try:
            student = Student.objects.get(nisn=value)
            if student.status == 'alumni':
                raise serializers.ValidationError('Santri sudah berstatus alumni')
            return value
        except Student.DoesNotExist:
            raise serializers.ValidationError('Santri tidak ditemukan')


class BulkSetAlumniSerializer(serializers.Serializer):
    """Serializer for bulk converting students to alumni."""
    nisn_list = serializers.ListField(
        child=serializers.CharField(),
        min_length=1
    )
    tahun_lulus = serializers.CharField(required=True)
    catatan = serializers.CharField(required=False, allow_blank=True)


class ReactivateStudentSerializer(serializers.Serializer):
    """Serializer for reactivating alumni back to active status."""
    nisn = serializers.CharField(required=True)
    kelas_baru = serializers.CharField(required=False, allow_blank=True)

    def validate_nisn(self, value):
        try:
            student = Student.objects.get(nisn=value)
            if student.status == 'aktif':
                raise serializers.ValidationError('Santri sudah berstatus aktif')
            return value
        except Student.DoesNotExist:
            raise serializers.ValidationError('Santri tidak ditemukan')
