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
        fields = ['nisn', 'nama', 'kelas', 'program', 'aktif', 'progress_hafalan_percentage', 'hafalan_status', 'current_hafalan', 'target_hafalan']

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
            'nisn', 'nama', 'kelas', 'program', 'email', 'phone',
            'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'current_hafalan', 'target_nilai',
            'aktif', 'progress_hafalan_percentage',
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
            'nisn', 'nama', 'kelas', 'program', 'email', 'phone',
            'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'target_nilai', 'aktif'
        ]

    def validate_nisn(self, value):
        if Student.objects.filter(nisn=value).exists():
            raise serializers.ValidationError('NISN sudah terdaftar!')
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
            'nama', 'kelas', 'program', 'email', 'phone',
            'wali_nama', 'wali_phone', 'tanggal_masuk',
            'target_hafalan', 'current_hafalan', 'target_nilai', 'aktif'
        ]

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
    class Meta:
        model = Schedule
        fields = '__all__'


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
