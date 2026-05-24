from rest_framework import serializers
from .models import (
    Evaluation, EvaluationComment, PoinIntegritas,
    PenilaianIntegritasSantri, PenilaianIntegritasGuru
)
from apps.students.models import Student


class EvaluationCommentSerializer(serializers.ModelSerializer):
    """Serializer untuk tanggapan evaluasi"""
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_nama = serializers.SerializerMethodField()
    parent_user_nama = serializers.SerializerMethodField()
    jenis_display = serializers.CharField(source='get_jenis_display', read_only=True)
    visibility_display = serializers.CharField(source='get_visibility_display', read_only=True)
    foto_url = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationComment
        fields = [
            'id', 'evaluation', 'user', 'user_id', 'user_name', 'user_username', 'user_role', 'user_nama',
            'parent', 'parent_user_nama',
            'jenis', 'jenis_display', 'content', 'visibility', 'visibility_display',
            'foto', 'foto_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_user_nama(self, obj):
        """Return user.name or user.username"""
        if obj.user:
            return obj.user.name or obj.user.username
        return None

    def get_parent_user_nama(self, obj):
        """Return parent comment author name for reply context"""
        if obj.parent and obj.parent.user:
            return obj.parent.user.name or obj.parent.user.username
        return None

    def get_foto_url(self, obj):
        """Return absolute URL for foto field"""
        if obj.foto:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.foto.url)
            return obj.foto.url
        return None


class EvaluationSerializer(serializers.ModelSerializer):
    nisn_nisn = serializers.CharField(source='nisn.nisn', read_only=True)
    nisn_nama = serializers.CharField(source='nisn.nama', read_only=True)
    nisn_kelas = serializers.CharField(source='nisn.kelas', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    visibility_display = serializers.CharField(source='get_visibility_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    foto_url = serializers.SerializerMethodField()
    comments = EvaluationCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'id', 'nisn', 'nisn_nisn', 'nisn_nama', 'nisn_kelas', 'tanggal',
            'jenis', 'kategori', 'evaluator', 'name', 'summary', 'catatan',
            'foto', 'foto_url', 'status', 'status_display', 'visibility', 'visibility_display',
            'is_approved', 'approved_by', 'approved_by_name', 'approved_at',
            'created_by', 'created_by_name',
            'keputusan_final', 'closed_by', 'closed_by_name', 'closed_at',
            'comments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'approved_by', 'approved_at', 'is_approved', 'created_by', 'closed_by', 'closed_at']

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.name or obj.approved_by.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.username
        return None

    def get_closed_by_name(self, obj):
        if obj.closed_by:
            return obj.closed_by.name or obj.closed_by.username
        return None

    def get_foto_url(self, obj):
        """Return absolute URL for foto field"""
        if obj.foto:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.foto.url)
            return obj.foto.url
        return None


class EvaluationCreateSerializer(serializers.ModelSerializer):
    # Accept NISN string but map to Student FK
    nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'nisn', 'tanggal', 'jenis', 'kategori', 'evaluator',
            'name', 'summary', 'catatan', 'foto', 'status', 'visibility'
        ]
        extra_kwargs = {
            'evaluator': {'required': False},  # Set by backend
            'catatan': {'required': False, 'allow_blank': True},
            'foto': {'required': False},
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
        fields = ['evaluation', 'parent', 'jenis', 'content', 'visibility']
        extra_kwargs = {
            'visibility': {'required': False},  # Default: internal
            'parent': {'required': False, 'allow_null': True}
        }

    def validate(self, data):
        parent = data.get('parent')
        evaluation = data.get('evaluation')
        if parent and evaluation and parent.evaluation_id != evaluation.id:
            raise serializers.ValidationError({
                'parent': 'Parent komentar harus berasal dari evaluasi yang sama'
            })
        return data

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

    def validate_visibility(self, value):
        if value:
            valid_visibility = [choice[0] for choice in EvaluationComment.VISIBILITY_CHOICES]
            if value not in valid_visibility:
                raise serializers.ValidationError(f"Visibility harus 'internal' atau 'semua'")
        return value or 'internal'

    def create(self, validated_data):
        return EvaluationComment.objects.create(**validated_data)


class PoinIntegritasSerializer(serializers.ModelSerializer):
    class Meta:
        model = PoinIntegritas
        fields = ['id', 'nama', 'urutan', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class PenilaianIntegritasSantriSerializer(serializers.ModelSerializer):
    santri = serializers.CharField(source='santri.nisn', read_only=True)
    poin = serializers.IntegerField(source='poin.id', read_only=True)
    santri_nisn = serializers.CharField(write_only=True)
    poin_id = serializers.IntegerField(write_only=True)
    penilai_name = serializers.SerializerMethodField()
    poin_nama = serializers.SerializerMethodField()
    santri_nama = serializers.SerializerMethodField()

    class Meta:
        model = PenilaianIntegritasSantri
        fields = [
            'id', 'penilai', 'penilai_name', 'santri', 'santri_nisn', 'santri_nama',
            'poin', 'poin_id', 'poin_nama', 'skala', 'catatan', 'tanggal'
        ]
        read_only_fields = ['id', 'penilai_name', 'poin_nama', 'santri_nama', 'tanggal']

    def validate_santri_nisn(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('NISN santri wajib diisi')
        if not Student.objects.filter(nisn=value).exists():
            raise serializers.ValidationError('Santri tidak ditemukan')
        return value

    def validate_poin_id(self, value):
        if not PoinIntegritas.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError('Poin integritas tidak ditemukan')
        return value

    def validate_skala(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Skala harus 1 sampai 5')
        return value

    def create(self, validated_data):
        santri_nisn = validated_data.pop('santri_nisn', '')
        poin_id = validated_data.pop('poin_id', None)
        santri = Student.objects.get(nisn=santri_nisn)
        poin = PoinIntegritas.objects.get(pk=poin_id, is_active=True)
        return PenilaianIntegritasSantri.objects.create(
            santri=santri,
            poin=poin,
            **validated_data
        )

    def get_penilai_name(self, obj):
        return obj.penilai.name or obj.penilai.username if obj.penilai else ''

    def get_poin_nama(self, obj):
        return obj.poin.nama if obj.poin else ''

    def get_santri_nama(self, obj):
        return obj.santri.nama if obj.santri else ''


class PenilaianIntegritasGuruSerializer(serializers.ModelSerializer):
    penilai_name = serializers.SerializerMethodField()
    poin_nama = serializers.SerializerMethodField()
    guru_name = serializers.SerializerMethodField()

    class Meta:
        model = PenilaianIntegritasGuru
        fields = [
            'id', 'penilai', 'penilai_name', 'guru', 'guru_name',
            'poin', 'poin_nama', 'skala', 'catatan', 'tanggal'
        ]
        read_only_fields = ['id', 'penilai_name', 'poin_nama', 'guru_name', 'tanggal']

    def get_penilai_name(self, obj):
        return obj.penilai.name or obj.penilai.username if obj.penilai else ''

    def get_poin_nama(self, obj):
        return obj.poin.nama if obj.poin else ''

    def get_guru_name(self, obj):
        return obj.guru.name or obj.guru.username if obj.guru else ''
