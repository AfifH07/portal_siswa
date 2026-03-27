import re
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, ResetToken, Assignment, UserActivity
from .utils import generate_token


# Valid class format: "X A", "X B", "X C", "X D", "XI A", etc.
VALID_GRADES = ['X', 'XI', 'XII']
VALID_SECTIONS = ['A', 'B', 'C', 'D']


def validate_kelas_format(value):
    """
    Validate and normalize class format for teacher/guru assignment.
    Expected: "X A", "XI B", "XII C", etc.
    """
    if not value:
        return value

    # Normalize: uppercase, remove extra spaces
    value = value.strip().upper()

    # Pattern: "XII A" or "XII-A" or "XII_A"
    match = re.match(r'^(X{1,2}I{0,1})\s*[-_]?\s*([A-D])$', value)

    if match:
        grade = match.group(1)
        section = match.group(2)

        if grade in VALID_GRADES and section in VALID_SECTIONS:
            return f"{grade} {section}"  # Normalized format

    raise serializers.ValidationError(
        f'Format kelas tidak valid. Gunakan format seperti "X A", "XI B", "XII C".'
    )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        user = authenticate(username=username, password=password)
        if user and user.is_active:
            return user
        raise serializers.ValidationError('Username atau Password salah')


class ChangePasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError('Username tidak ditemukan!')

        if not user.check_password(old_password):
            raise serializers.ValidationError('Password lama salah!')

        return data


class RequestResetSerializer(serializers.Serializer):
    username = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        try:
            User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError('Username tidak ditemukan!')
        return data


class ResetPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()
    token = serializers.CharField(max_length=10)
    new_password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    linked_student_name = serializers.SerializerMethodField()
    linked_students = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'role', 'name', 'nisn', 'email', 'phone',
            'linked_student_nisn', 'linked_student_nisns', 'linked_student_name',
            'linked_students', 'kelas'
        ]
        read_only_fields = ['id']

    def get_linked_student_name(self, obj):
        """Get the linked student's name for walisantri users (legacy - single child)"""
        if obj.role == 'walisantri' and obj.linked_student_nisn:
            try:
                from apps.students.models import Student
                student = Student.objects.get(nisn=obj.linked_student_nisn)
                return student.nama
            except Student.DoesNotExist:
                return None
        return None

    def get_linked_students(self, obj):
        """
        Get all linked students' info for walisantri users (multi-child support).
        Returns: [{"nisn": "...", "nama": "...", "kelas": "..."}, ...]
        """
        if obj.role != 'walisantri':
            return []

        from apps.students.models import Student

        nisn_list = obj.get_linked_students()
        students = []

        for nisn in nisn_list:
            try:
                student = Student.objects.get(nisn=nisn)
                students.append({
                    'nisn': student.nisn,
                    'nama': student.nama,
                    'kelas': student.kelas
                })
            except Student.DoesNotExist:
                pass

        return students

    def validate_kelas(self, value):
        """Validate and normalize class format for teacher assignment"""
        if value:
            return validate_kelas_format(value)
        return value


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'name', 'nisn', 'email']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'name', 'nisn', 'email', 'kelas']

    def validate_kelas(self, value):
        """Validate and normalize class format for teacher assignment"""
        if value:
            return validate_kelas_format(value)
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        return super().update(instance, validated_data)


# ============================================
# ADMIN USER MANAGEMENT SERIALIZERS
# ============================================

class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer untuk model Assignment"""
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    assignment_type_display = serializers.CharField(
        source='get_assignment_type_display', read_only=True
    )
    target_display = serializers.CharField(read_only=True)
    halaqoh_name = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'user', 'user_name', 'user_username',
            'assignment_type', 'assignment_type_display',
            'kelas', 'halaqoh_id', 'halaqoh_name',
            'mata_pelajaran', 'hari',
            'tahun_ajaran', 'semester', 'status',
            'target_display', 'catatan',
            'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_halaqoh_name(self, obj):
        """Get halaqoh name if assignment is for halaqoh"""
        if obj.halaqoh_id:
            try:
                from apps.kesantrian.models import Halaqoh
                halaqoh = Halaqoh.objects.get(id=obj.halaqoh_id)
                return halaqoh.nama
            except:
                return None
        return None

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk membuat Assignment baru"""

    class Meta:
        model = Assignment
        fields = [
            'user', 'assignment_type', 'kelas', 'halaqoh_id',
            'mata_pelajaran', 'hari', 'tahun_ajaran', 'semester',
            'status', 'catatan'
        ]

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value

    def validate(self, data):
        assignment_type = data.get('assignment_type')
        kelas = data.get('kelas')
        halaqoh_id = data.get('halaqoh_id')
        hari = data.get('hari')

        # Halaqoh assignment must have halaqoh_id
        if assignment_type == 'halaqoh' and not halaqoh_id:
            raise serializers.ValidationError(
                "Assignment Halaqoh harus memiliki halaqoh_id"
            )

        # KBM/Diniyah/Wali Kelas must have kelas
        if assignment_type in ['kbm', 'diniyah', 'wali_kelas'] and not kelas:
            raise serializers.ValidationError(
                f"Assignment {assignment_type} harus memiliki kelas"
            )

        # Piket must have hari
        if assignment_type == 'piket' and not hari:
            raise serializers.ValidationError(
                "Assignment Piket harus memiliki hari"
            )

        return data

    def create(self, validated_data):
        # Set created_by from request context
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user.username
        return super().create(validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    """
    Serializer untuk Admin User Management.
    Includes assignments and activity summary.
    """
    assignments = AssignmentSerializer(many=True, read_only=True)
    active_assignments_count = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    last_login_formatted = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'name', 'email', 'phone',
            'role', 'role_display', 'kelas', 'mata_pelajaran',
            'is_active', 'is_staff',
            'date_joined', 'last_login', 'last_login_formatted',
            'linked_student_nisn', 'linked_student_nisns',
            'assignments', 'active_assignments_count'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_active_assignments_count(self, obj):
        return obj.assignments.filter(status='active').count()

    def get_last_login_formatted(self, obj):
        if obj.last_login:
            return obj.last_login.strftime('%d %b %Y %H:%M')
        return 'Belum pernah login'


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk Superadmin membuat user baru"""
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = User
        fields = [
            'username', 'password', 'confirm_password',
            'name', 'email', 'phone', 'role',
            'kelas', 'mata_pelajaran', 'is_active',
            'linked_student_nisn', 'linked_student_nisns'
        ]

    def validate_username(self, value):
        # Username harus alphanumeric dan underscore
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "Username hanya boleh berisi huruf, angka, dan underscore"
            )
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username sudah digunakan")
        return value.lower()

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({
                'confirm_password': 'Password tidak cocok'
            })
        return data

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Serializer untuk Superadmin update user"""

    class Meta:
        model = User
        fields = [
            'name', 'email', 'phone', 'role',
            'kelas', 'mata_pelajaran', 'is_active',
            'linked_student_nisn', 'linked_student_nisns'
        ]

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value


class PasswordResetByAdminSerializer(serializers.Serializer):
    """Serializer untuk Superadmin reset password user"""
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data.get('new_password') != data.get('confirm_password'):
            raise serializers.ValidationError({
                'confirm_password': 'Password tidak cocok'
            })
        return data


class UserAssignSerializer(serializers.Serializer):
    """Serializer untuk assign tugas ke user"""
    assignment_type = serializers.ChoiceField(
        choices=Assignment.ASSIGNMENT_TYPE_CHOICES
    )
    kelas = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    halaqoh_id = serializers.IntegerField(required=False, allow_null=True)
    mata_pelajaran = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    hari = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    tahun_ajaran = serializers.CharField(required=True)
    semester = serializers.ChoiceField(choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')])
    catatan = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value

    def validate(self, data):
        assignment_type = data.get('assignment_type')
        kelas = data.get('kelas')
        halaqoh_id = data.get('halaqoh_id')
        hari = data.get('hari')

        if assignment_type == 'halaqoh' and not halaqoh_id:
            raise serializers.ValidationError({
                'halaqoh_id': 'Halaqoh ID diperlukan untuk assignment Halaqoh'
            })

        if assignment_type in ['kbm', 'diniyah', 'wali_kelas'] and not kelas:
            raise serializers.ValidationError({
                'kelas': f'Kelas diperlukan untuk assignment {assignment_type}'
            })

        if assignment_type == 'piket' and not hari:
            raise serializers.ValidationError({
                'hari': 'Hari diperlukan untuk assignment Piket'
            })

        return data


class UserActivitySerializer(serializers.ModelSerializer):
    """
    Serializer untuk User Activity log.

    Note: ip_address di-override ke CharField untuk menghindari bug
    kompatibilitas Django 5.0+ dengan DRF pada GenericIPAddressField
    yang menyebabkan ValueError: not enough values to unpack.
    """
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    target_username = serializers.CharField(source='target_user.username', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    # Override GenericIPAddressField to avoid Django 5.0+ / DRF compatibility bug
    ip_address = serializers.CharField(read_only=True, allow_null=True, allow_blank=True)

    class Meta:
        model = UserActivity
        fields = [
            'id', 'user', 'user_username',
            'target_user', 'target_username',
            'action', 'action_display',
            'details', 'ip_address', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp', 'ip_address']


class BulkAssignSerializer(serializers.Serializer):
    """Serializer untuk bulk assign users ke kelas/halaqoh"""
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    assignment_type = serializers.ChoiceField(
        choices=Assignment.ASSIGNMENT_TYPE_CHOICES
    )
    kelas = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    halaqoh_id = serializers.IntegerField(required=False, allow_null=True)
    tahun_ajaran = serializers.CharField(required=True)
    semester = serializers.ChoiceField(choices=[('Ganjil', 'Ganjil'), ('Genap', 'Genap')])

    def validate_kelas(self, value):
        if value:
            return validate_kelas_format(value)
        return value
