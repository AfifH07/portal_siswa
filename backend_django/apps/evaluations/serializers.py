from rest_framework import serializers
from .models import Evaluation, EvaluationComment
from apps.students.models import Student


class EvaluationCommentSerializer(serializers.ModelSerializer):
    """Serializer untuk tanggapan evaluasi"""
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    jenis_display = serializers.CharField(source='get_jenis_display', read_only=True)

    class Meta:
        model = EvaluationComment
        fields = [
            'id', 'evaluation', 'user', 'user_name', 'user_username', 'user_role',
            'jenis', 'jenis_display', 'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class EvaluationSerializer(serializers.ModelSerializer):
    nisn_nisn = serializers.CharField(source='nisn.nisn', read_only=True)
    nisn_nama = serializers.CharField(source='nisn.nama', read_only=True)
    nisn_kelas = serializers.CharField(source='nisn.kelas', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    visibility_display = serializers.CharField(source='get_visibility_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    comments = EvaluationCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'id', 'nisn', 'nisn_nisn', 'nisn_nama', 'nisn_kelas', 'tanggal',
            'jenis', 'kategori', 'evaluator', 'name', 'summary', 'catatan',
            'photo', 'status', 'status_display', 'visibility', 'visibility_display',
            'is_approved', 'approved_by', 'approved_by_name', 'comments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'approved_by', 'is_approved']

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.name or obj.approved_by.username
        return None


class EvaluationCreateSerializer(serializers.ModelSerializer):
    # Accept NISN string but map to Student FK
    nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'nisn', 'tanggal', 'jenis', 'kategori', 'evaluator',
            'name', 'summary', 'catatan', 'photo', 'status', 'visibility'
        ]
        extra_kwargs = {
            'evaluator': {'required': False},  # Set by backend
            'catatan': {'required': False, 'allow_blank': True},
            'photo': {'required': False},
            'status': {'required': False},  # Default: dalam_pembahasan
            'visibility': {'required': False},  # Default: internal
        }

    def validate_nisn(self, value):
        """Validate NISN and return the Student instance"""
        if not value:
            raise serializers.ValidationError("NISN wajib diisi")

        value = str(value).strip()
        try:
            student = Student.objects.get(nisn=value)
            return student  # Return Student instance, not string
        except Student.DoesNotExist:
            raise serializers.ValidationError(f"Siswa dengan NISN '{value}' tidak ditemukan")

    def validate_jenis(self, value):
        if not value:
            raise serializers.ValidationError("Jenis evaluasi wajib diisi")

        value = str(value).strip().lower()
        valid_jenis = [choice[0] for choice in Evaluation.JENIS_CHOICES]
        if value not in valid_jenis:
            raise serializers.ValidationError(f"Jenis harus 'prestasi' atau 'pelanggaran', bukan '{value}'")
        return value

    def validate_kategori(self, value):
        if not value:
            raise serializers.ValidationError("Kategori wajib diisi")

        value = str(value).strip().lower()
        valid_kategori = [choice[0] for choice in Evaluation.KATEGORI_CHOICES]
        if value not in valid_kategori:
            valid_list = ', '.join(valid_kategori)
            raise serializers.ValidationError(f"Kategori tidak valid. Pilihan: {valid_list}")
        return value

    def validate_tanggal(self, value):
        if not value:
            raise serializers.ValidationError("Tanggal wajib diisi")
        return value

    def validate_name(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Nama evaluasi wajib diisi")
        return str(value).strip()

    def validate_summary(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Ringkasan wajib diisi")
        return str(value).strip()

    def create(self, validated_data):
        """Create evaluation with Student FK properly set"""
        return Evaluation.objects.create(**validated_data)

    def update(self, instance, validated_data):
        """Update evaluation"""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class EvaluationCommentCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk membuat tanggapan baru"""

    class Meta:
        model = EvaluationComment
        fields = ['evaluation', 'jenis', 'content']

    def validate_jenis(self, value):
        if not value:
            raise serializers.ValidationError("Jenis tanggapan wajib diisi")
        valid_jenis = [choice[0] for choice in EvaluationComment.JENIS_CHOICES]
        if value not in valid_jenis:
            raise serializers.ValidationError(f"Jenis harus 'diskusi' atau 'pembinaan'")
        return value

    def validate_content(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Isi tanggapan wajib diisi")
        return str(value).strip()

    def create(self, validated_data):
        return EvaluationComment.objects.create(**validated_data)
