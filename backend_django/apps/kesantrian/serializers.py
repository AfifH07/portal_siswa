"""
Kesantrian Serializers v2.3
===========================
Serializers for Ibadah, Pembinaan, Halaqoh, TargetHafalan,
BLPEntry, EmployeeEvaluation, and InvalRecord models.
"""

from rest_framework import serializers
from django.db.models import Count, Avg
from .models import (
    Ibadah, Halaqoh, HalaqohMember, Pembinaan, TargetHafalan,
    BLPEntry, EmployeeEvaluation, InvalRecord, BLP_INDICATORS,
    Incident, IncidentComment, AsatidzEvaluation,
    IndikatorKinerja, PenilaianKinerjaAsatidz, DetailPenilaianKinerja
)
from apps.students.models import Student


class IbadahSerializer(serializers.ModelSerializer):
    """Serializer for individual Ibadah records."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    jenis_display = serializers.CharField(source='get_jenis_display', read_only=True)
    waktu_display = serializers.CharField(source='get_waktu_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Ibadah
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_nisn',
            'tanggal', 'jenis', 'jenis_display',
            'waktu', 'waktu_display',
            'status', 'status_display',
            'catatan', 'pencatat', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class IbadahCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating Ibadah records."""
    siswa_nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Ibadah
        fields = [
            'siswa_nisn', 'tanggal', 'jenis', 'waktu',
            'status', 'catatan', 'pencatat'
        ]

    def create(self, validated_data):
        nisn = validated_data.pop('siswa_nisn')
        try:
            student = Student.objects.get(nisn=nisn)
        except Student.DoesNotExist:
            raise serializers.ValidationError({'siswa_nisn': 'Siswa tidak ditemukan'})

        validated_data['siswa'] = student
        return super().create(validated_data)


class IbadahDailySummarySerializer(serializers.Serializer):
    """Summary of daily ibadah (sholat 5 waktu) for a student."""
    tanggal = serializers.DateField()
    subuh = serializers.CharField(allow_null=True)
    dzuhur = serializers.CharField(allow_null=True)
    ashar = serializers.CharField(allow_null=True)
    maghrib = serializers.CharField(allow_null=True)
    isya = serializers.CharField(allow_null=True)
    total_hadir = serializers.IntegerField()
    total_sholat = serializers.IntegerField()
    persentase = serializers.FloatField()


class PembinaanSerializer(serializers.ModelSerializer):
    """Serializer for Pembinaan (BLP) records."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    kategori_display = serializers.CharField(source='get_kategori_display', read_only=True)
    tingkat_display = serializers.CharField(source='get_tingkat_display', read_only=True)

    class Meta:
        model = Pembinaan
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_nisn',
            'tanggal', 'kategori', 'kategori_display',
            'judul', 'deskripsi', 'tingkat', 'tingkat_display',
            'tindak_lanjut', 'pembina', 'pembina_username',
            'surah', 'ayat_mulai', 'ayat_selesai', 'jumlah_halaman',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PembinaanCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Pembinaan records."""
    siswa_nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Pembinaan
        fields = [
            'siswa_nisn', 'tanggal', 'kategori', 'judul', 'deskripsi',
            'tingkat', 'tindak_lanjut', 'pembina', 'pembina_username',
            'surah', 'ayat_mulai', 'ayat_selesai', 'jumlah_halaman'
        ]

    def create(self, validated_data):
        nisn = validated_data.pop('siswa_nisn')
        try:
            student = Student.objects.get(nisn=nisn)
        except Student.DoesNotExist:
            raise serializers.ValidationError({'siswa_nisn': 'Siswa tidak ditemukan'})

        validated_data['siswa'] = student
        return super().create(validated_data)


class TargetHafalanSerializer(serializers.ModelSerializer):
    """Serializer for TargetHafalan records."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    persentase_tercapai = serializers.FloatField(read_only=True)

    class Meta:
        model = TargetHafalan
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_nisn',
            'semester', 'tahun_ajaran',
            'target_juz', 'tercapai_juz', 'persentase_tercapai',
            'catatan', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'persentase_tercapai']


class HalaqohSerializer(serializers.ModelSerializer):
    """Serializer for Halaqoh groups."""
    jenis_display = serializers.CharField(source='get_jenis_display', read_only=True)
    jumlah_anggota = serializers.IntegerField(read_only=True)

    class Meta:
        model = Halaqoh
        fields = [
            'id', 'nama', 'jenis', 'jenis_display',
            'musyrif', 'musyrif_username',
            'jadwal', 'lokasi', 'kapasitas', 'jumlah_anggota',
            'aktif', 'tahun_ajaran'
        ]


class HalaqohMemberSerializer(serializers.ModelSerializer):
    """Serializer for Halaqoh membership."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    halaqoh_nama = serializers.CharField(source='halaqoh.nama', read_only=True)

    class Meta:
        model = HalaqohMember
        fields = [
            'id', 'halaqoh', 'halaqoh_nama',
            'siswa', 'siswa_nama', 'siswa_nisn',
            'tanggal_gabung', 'aktif', 'catatan'
        ]


class ChildSummarySerializer(serializers.Serializer):
    """Summary data for a single child (for walisantri multi-child view)."""
    nisn = serializers.CharField()
    nama = serializers.CharField()
    kelas = serializers.CharField(allow_null=True)
    foto = serializers.CharField(allow_null=True)

    # Ibadah summary (last 7 days)
    ibadah_summary = serializers.DictField()

    # Hafalan progress
    hafalan_progress = serializers.DictField()

    # Recent pembinaan
    recent_pembinaan = serializers.ListField()

    # Halaqoh membership
    halaqoh = serializers.ListField()


class MultiChildSummarySerializer(serializers.Serializer):
    """Summary for all children of a walisantri."""
    total_children = serializers.IntegerField()
    children = ChildSummarySerializer(many=True)


# ============================================
# BLP ENTRY SERIALIZERS
# ============================================

class BLPIndicatorInfoSerializer(serializers.Serializer):
    """Serializer untuk menampilkan info indikator BLP."""

    @staticmethod
    def get_all_indicators():
        """Return semua indikator dengan struktur lengkap"""
        result = {}
        for domain, data in BLP_INDICATORS.items():
            result[domain] = {
                'label': data['label'],
                'max_score': data['max_score'],
                'indicators': [
                    {'code': code, 'label': label}
                    for code, label in data['indicators']
                ]
            }
        return result


class BLPEntrySerializer(serializers.ModelSerializer):
    """Serializer untuk BLP Entry (read)."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    siswa_kelas = serializers.CharField(source='siswa.kelas', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    predikat = serializers.CharField(read_only=True)
    is_editable = serializers.SerializerMethodField()

    class Meta:
        model = BLPEntry
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_nisn', 'siswa_kelas',
            'week_start', 'week_end', 'tahun_ajaran', 'semester',
            'indicator_values', 'bonus_points', 'bonus_notes',
            'total_score', 'domain_scores', 'predikat',
            'status', 'status_display', 'is_locked', 'locked_at', 'locked_by',
            'catatan', 'tindak_lanjut',
            'pencatat', 'pencatat_username',
            'is_editable', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'total_score', 'domain_scores', 'predikat',
            'is_locked', 'locked_at', 'locked_by',
            'created_at', 'updated_at'
        ]

    def get_is_editable(self, obj):
        return obj.is_editable()


class BLPEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create/update BLP Entry."""
    siswa_nisn = serializers.CharField(write_only=True)

    class Meta:
        model = BLPEntry
        fields = [
            'siswa_nisn', 'week_start', 'week_end',
            'tahun_ajaran', 'semester',
            'indicator_values', 'bonus_points', 'bonus_notes',
            'catatan', 'tindak_lanjut',
            'pencatat', 'pencatat_username'
        ]

    def validate_siswa_nisn(self, value):
        try:
            Student.objects.get(nisn=value)
        except Student.DoesNotExist:
            raise serializers.ValidationError('Siswa tidak ditemukan')
        return value

    def validate_indicator_values(self, value):
        """Validasi struktur dan nilai indikator"""
        if not isinstance(value, dict):
            raise serializers.ValidationError('indicator_values harus berupa object/dict')

        # Validasi setiap domain dan indikator
        for domain, data in BLP_INDICATORS.items():
            if domain not in value:
                continue

            domain_values = value[domain]
            if not isinstance(domain_values, dict):
                raise serializers.ValidationError(f'Domain {domain} harus berupa object/dict')

            for code, label in data['indicators']:
                if code in domain_values:
                    score = domain_values[code]
                    if not isinstance(score, (int, float)) or score < 0 or score > 5:
                        raise serializers.ValidationError(
                            f'Nilai {domain}.{code} harus 0-5, ditemukan: {score}'
                        )

        return value

    def validate(self, data):
        # Validasi week_start dan week_end
        if 'week_start' in data and 'week_end' in data:
            if data['week_end'] < data['week_start']:
                raise serializers.ValidationError({
                    'week_end': 'week_end harus >= week_start'
                })

        return data

    def create(self, validated_data):
        nisn = validated_data.pop('siswa_nisn')
        student = Student.objects.get(nisn=nisn)
        validated_data['siswa'] = student
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Cek apakah masih editable
        if not instance.is_editable():
            raise serializers.ValidationError('BLP Entry sudah dikunci dan tidak dapat diubah')

        # Remove siswa_nisn jika ada (tidak bisa update siswa)
        validated_data.pop('siswa_nisn', None)

        return super().update(instance, validated_data)


class BLPEntryListSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk list BLP Entry (includes domain_scores for dashboard)."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_kelas = serializers.CharField(source='siswa.kelas', read_only=True)
    predikat = serializers.CharField(read_only=True)

    class Meta:
        model = BLPEntry
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_kelas',
            'week_start', 'week_end',
            'total_score', 'domain_scores', 'indicator_values', 'predikat',
            'status', 'is_locked'
        ]


# ============================================
# EMPLOYEE EVALUATION SERIALIZERS
# ============================================

class EmployeeEvaluationSerializer(serializers.ModelSerializer):
    """Serializer untuk Employee Evaluation (read)."""
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    jenis_display = serializers.CharField(source='get_jenis_display', read_only=True)

    class Meta:
        model = EmployeeEvaluation
        fields = [
            'id', 'user', 'user_name', 'user_username',
            'tanggal', 'jenis', 'jenis_display',
            'poin', 'keterangan',
            'inval_record', 'tahun_ajaran', 'semester',
            'created_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EmployeeEvaluationCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create Employee Evaluation."""

    class Meta:
        model = EmployeeEvaluation
        fields = [
            'user', 'tanggal', 'jenis', 'poin', 'keterangan',
            'tahun_ajaran', 'semester', 'created_by'
        ]

    def validate_poin(self, value):
        # Validasi range poin berdasarkan jenis
        jenis = self.initial_data.get('jenis')

        if jenis in ['inval_plus', 'kehadiran', 'tugas_tambahan']:
            if value < 0:
                raise serializers.ValidationError('Poin untuk jenis ini harus positif')
        elif jenis in ['inval_minus', 'pelanggaran']:
            if value > 0:
                raise serializers.ValidationError('Poin untuk jenis ini harus negatif')

        return value


class EmployeeSummarySerializer(serializers.Serializer):
    """Summary evaluasi untuk satu Ustadz/Ustadzah."""
    user_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_username = serializers.CharField()
    total_poin = serializers.IntegerField()
    prestasi_count = serializers.IntegerField()
    pelanggaran_count = serializers.IntegerField()
    inval_plus_count = serializers.IntegerField()
    inval_minus_count = serializers.IntegerField()
    evaluations = EmployeeEvaluationSerializer(many=True)


# ============================================
# INVAL RECORD SERIALIZERS
# ============================================

class InvalRecordSerializer(serializers.ModelSerializer):
    """Serializer untuk Inval Record (read)."""
    guru_absent_name = serializers.CharField(source='guru_absent.name', read_only=True)
    guru_absent_username = serializers.CharField(source='guru_absent.username', read_only=True)
    guru_pengganti_name = serializers.CharField(source='guru_pengganti.name', read_only=True)
    guru_pengganti_username = serializers.CharField(source='guru_pengganti.username', read_only=True)
    alasan_display = serializers.CharField(source='get_alasan_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)

    class Meta:
        model = InvalRecord
        fields = [
            'id',
            'guru_absent', 'guru_absent_name', 'guru_absent_username',
            'guru_pengganti', 'guru_pengganti_name', 'guru_pengganti_username',
            'tanggal', 'jam_pelajaran', 'kelas', 'mata_pelajaran',
            'alasan', 'alasan_display', 'keterangan', 'bukti_file',
            'status', 'status_display',
            'verified_by', 'verified_at', 'rejection_reason',
            'evaluation_created',
            'recorded_by', 'recorded_by_name', 'recorded_by_username',
            'created_at'
        ]
        read_only_fields = [
            'id', 'evaluation_created',
            'verified_by', 'verified_at', 'rejection_reason',
            'created_at'
        ]


class InvalRecordCreateSerializer(serializers.ModelSerializer):
    """
    Serializer untuk create Inval Record.

    Digunakan oleh Ustadz Piket untuk mencatat penggantian.
    Setelah save, signal akan otomatis membuat EmployeeEvaluation.
    """

    class Meta:
        model = InvalRecord
        fields = [
            'guru_absent', 'guru_pengganti',
            'tanggal', 'jam_pelajaran', 'kelas', 'mata_pelajaran',
            'alasan', 'keterangan', 'bukti_file',
            'recorded_by', 'recorded_by_username'
        ]

    def validate(self, data):
        # Validasi guru_absent != guru_pengganti
        if data.get('guru_absent') == data.get('guru_pengganti'):
            raise serializers.ValidationError({
                'guru_pengganti': 'Guru pengganti tidak boleh sama dengan guru yang absent'
            })

        # Validasi role guru
        guru_absent = data.get('guru_absent')
        guru_pengganti = data.get('guru_pengganti')

        allowed_roles = ['guru', 'musyrif', 'wali_kelas', 'pimpinan']

        if guru_absent and guru_absent.role not in allowed_roles:
            raise serializers.ValidationError({
                'guru_absent': f'User dengan role {guru_absent.role} tidak dapat menjadi guru absent'
            })

        if guru_pengganti and guru_pengganti.role not in allowed_roles:
            raise serializers.ValidationError({
                'guru_pengganti': f'User dengan role {guru_pengganti.role} tidak dapat menjadi pengganti'
            })

        return data


class InvalRecordVerifySerializer(serializers.Serializer):
    """Serializer untuk verifikasi/reject Inval Record."""
    action = serializers.ChoiceField(choices=['verify', 'reject'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data.get('action') == 'reject' and not data.get('rejection_reason'):
            raise serializers.ValidationError({
                'rejection_reason': 'Alasan penolakan harus diisi'
            })
        return data


class InvalSummarySerializer(serializers.Serializer):
    """Summary inval untuk dashboard."""
    total_inval = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    verified_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()
    top_absent_teachers = serializers.ListField()
    top_substitute_teachers = serializers.ListField()


# ============================================
# INCIDENT (CASE MANAGEMENT) SERIALIZERS
# ============================================

class IncidentCommentSerializer(serializers.ModelSerializer):
    """Serializer untuk IncidentComment (read)."""
    author_name = serializers.CharField(source='author.name', read_only=True)
    author_nama = serializers.CharField(source='author.name', read_only=True)  # Alias for frontend
    author_username = serializers.CharField(source='author.username', read_only=True)
    visibility_display = serializers.CharField(source='get_visibility_display', read_only=True)
    comment_type_display = serializers.CharField(source='get_comment_type_display', read_only=True)
    is_visible_to_walisantri = serializers.BooleanField(read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = IncidentComment
        fields = [
            'id', 'incident', 'content', 'comment_type', 'comment_type_display',
            'author', 'author_name', 'author_nama', 'author_username',
            'author_role', 'author_role_display',
            'visibility', 'visibility_display', 'is_visible_to_walisantri',
            'parent_comment', 'reply_count',
            'attachment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_reply_count(self, obj):
        return obj.replies.count()


class IncidentCommentCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create IncidentComment."""

    class Meta:
        model = IncidentComment
        fields = [
            'incident', 'content', 'comment_type',
            'author', 'author_role', 'author_role_display',
            'visibility', 'parent_comment', 'attachment'
        ]

    def validate(self, data):
        # Validate parent_comment belongs to same incident
        if data.get('parent_comment'):
            parent = data['parent_comment']
            if parent.incident_id != data['incident'].id:
                raise serializers.ValidationError({
                    'parent_comment': 'Parent comment harus milik incident yang sama'
                })
        return data


class IncidentSerializer(serializers.ModelSerializer):
    """Serializer untuk Incident (read)."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_nisn = serializers.CharField(source='siswa.nisn', read_only=True)
    siswa_kelas = serializers.CharField(source='siswa.kelas', read_only=True)
    kategori_display = serializers.CharField(source='get_kategori_display', read_only=True)
    tingkat_display = serializers.CharField(source='get_tingkat_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_icon = serializers.CharField(read_only=True)
    pelapor_name = serializers.CharField(source='pelapor.name', read_only=True)
    pelapor_nama = serializers.CharField(source='pelapor.name', read_only=True)  # Alias for frontend
    pelapor_role_display = serializers.SerializerMethodField()
    assigned_to_name = serializers.CharField(source='assigned_to.name', read_only=True)
    diputuskan_oleh_name = serializers.CharField(source='diputuskan_oleh.name', read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(source='comment_count', read_only=True)  # Alias for frontend

    # Include comments in detail view
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_nisn', 'siswa_kelas',
            'judul', 'deskripsi', 'kategori', 'kategori_display',
            'tingkat', 'tingkat_display',
            'tanggal_kejadian', 'lokasi',
            'status', 'status_display', 'status_icon',
            'pelapor', 'pelapor_name', 'pelapor_nama', 'pelapor_role', 'pelapor_role_display',
            'assigned_to', 'assigned_to_name',
            'keputusan_final', 'diputuskan_oleh', 'diputuskan_oleh_name', 'tanggal_keputusan',
            'tindak_lanjut', 'deadline_tindak_lanjut',
            'tahun_ajaran', 'semester',
            'comment_count', 'comments_count', 'comments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_pelapor_role_display(self, obj):
        role_map = {
            'superadmin': 'Administrator',
            'pimpinan': 'Pimpinan/Mudir',
            'guru': 'Guru/Ustadz',
            'wali_kelas': 'Wali Kelas',
            'bk': 'Guru BK',
            'musyrif': 'Musyrif',
        }
        return role_map.get(obj.pelapor_role, obj.pelapor_role.replace('_', ' ').title() if obj.pelapor_role else '-')

    def get_comments(self, obj):
        """Get comments based on user role"""
        request = self.context.get('request')
        if not request or not request.user:
            return []

        user = request.user
        comments = obj.comments.filter(parent_comment__isnull=True)  # Only top-level

        # Walisantri can only see public/final_decision comments
        if user.role == 'walisantri':
            comments = comments.filter(visibility__in=['public', 'final_decision'])

        return IncidentCommentSerializer(comments, many=True).data


class IncidentListSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk list Incident."""
    siswa_nama = serializers.CharField(source='siswa.nama', read_only=True)
    siswa_kelas = serializers.CharField(source='siswa.kelas', read_only=True)
    kategori_display = serializers.CharField(source='get_kategori_display', read_only=True)
    tingkat_display = serializers.CharField(source='get_tingkat_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    status_icon = serializers.CharField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(source='comment_count', read_only=True)  # Alias for frontend
    pelapor_name = serializers.CharField(source='pelapor.name', read_only=True)
    pelapor_role_display = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            'id', 'siswa', 'siswa_nama', 'siswa_kelas',
            'judul', 'deskripsi', 'kategori', 'kategori_display',
            'tingkat', 'tingkat_display',
            'tanggal_kejadian',
            'status', 'status_display', 'status_icon',
            'pelapor_name', 'pelapor_role', 'pelapor_role_display',
            'keputusan_final',
            'comment_count', 'comments_count',
            'created_at'
        ]

    def get_pelapor_role_display(self, obj):
        role_map = {
            'superadmin': 'Administrator',
            'pimpinan': 'Pimpinan/Mudir',
            'guru': 'Guru/Ustadz',
            'wali_kelas': 'Wali Kelas',
            'bk': 'Guru BK',
            'musyrif': 'Musyrif',
        }
        return role_map.get(obj.pelapor_role, obj.pelapor_role.replace('_', ' ').title() if obj.pelapor_role else '-')


class IncidentCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create Incident."""
    siswa_nisn = serializers.CharField(write_only=True)

    class Meta:
        model = Incident
        fields = [
            'siswa_nisn', 'judul', 'deskripsi',
            'kategori', 'tingkat',
            'tanggal_kejadian', 'lokasi',
            'pelapor', 'pelapor_role',
            'assigned_to', 'tindak_lanjut', 'deadline_tindak_lanjut',
            'tahun_ajaran', 'semester'
        ]

    def validate_siswa_nisn(self, value):
        try:
            Student.objects.get(nisn=value)
        except Student.DoesNotExist:
            raise serializers.ValidationError('Siswa tidak ditemukan')
        return value

    def create(self, validated_data):
        nisn = validated_data.pop('siswa_nisn')
        student = Student.objects.get(nisn=nisn)
        validated_data['siswa'] = student
        return super().create(validated_data)


class IncidentResolveSerializer(serializers.Serializer):
    """Serializer untuk resolve Incident."""
    keputusan_final = serializers.CharField(required=True)
    tindak_lanjut = serializers.CharField(required=False, allow_blank=True)
    deadline_tindak_lanjut = serializers.DateField(required=False, allow_null=True)


class IncidentSummarySerializer(serializers.Serializer):
    """Summary incident untuk dashboard."""
    total_bulan_ini = serializers.IntegerField()
    total_resolved = serializers.IntegerField()
    total_open = serializers.IntegerField()
    total_in_discussion = serializers.IntegerField()
    by_kategori = serializers.DictField()
    by_tingkat = serializers.DictField()
    latest_bk_suggestion = serializers.CharField(allow_null=True)


# ============================================
# ASATIDZ EVALUATION SERIALIZERS
# ============================================

class AsatidzEvaluationSerializer(serializers.ModelSerializer):
    """Serializer untuk AsatidzEvaluation (read)."""
    ustadz_nama = serializers.CharField(source='ustadz.name', read_only=True)
    ustadz_username = serializers.CharField(source='ustadz.username', read_only=True)
    ustadz_role = serializers.CharField(source='ustadz.role', read_only=True)
    dilaporkan_oleh_nama = serializers.CharField(source='dilaporkan_oleh.name', read_only=True)
    dilaporkan_oleh_username = serializers.CharField(source='dilaporkan_oleh.username', read_only=True)
    kategori_display = serializers.CharField(source='get_kategori_display', read_only=True)
    kategori_icon = serializers.CharField(read_only=True)

    class Meta:
        model = AsatidzEvaluation
        fields = [
            'id',
            'ustadz', 'ustadz_nama', 'ustadz_username', 'ustadz_role',
            'tanggal_kejadian', 'kategori', 'kategori_display', 'kategori_icon',
            'deskripsi',
            'dilaporkan_oleh', 'dilaporkan_oleh_nama', 'dilaporkan_oleh_username',
            'tahun_ajaran', 'semester',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AsatidzEvaluationListSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk list AsatidzEvaluation."""
    ustadz_nama = serializers.CharField(source='ustadz.name', read_only=True)
    dilaporkan_oleh_nama = serializers.CharField(source='dilaporkan_oleh.name', read_only=True)
    kategori_display = serializers.CharField(source='get_kategori_display', read_only=True)
    kategori_icon = serializers.CharField(read_only=True)

    class Meta:
        model = AsatidzEvaluation
        fields = [
            'id', 'ustadz', 'ustadz_nama',
            'tanggal_kejadian', 'kategori', 'kategori_display', 'kategori_icon',
            'deskripsi', 'dilaporkan_oleh_nama',
            'created_at'
        ]


class AsatidzEvaluationCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create AsatidzEvaluation."""

    class Meta:
        model = AsatidzEvaluation
        fields = [
            'ustadz', 'tanggal_kejadian', 'kategori', 'deskripsi',
            'dilaporkan_oleh', 'tahun_ajaran', 'semester'
        ]

    def validate_ustadz(self, value):
        """Validasi bahwa target adalah ustadz/karyawan (bukan walisantri)."""
        if value.role == 'walisantri':
            raise serializers.ValidationError('Walisantri tidak dapat menjadi target evaluasi asatidz')
        return value


class AsatidzEvaluationSummarySerializer(serializers.Serializer):
    """Summary evaluasi asatidz untuk dashboard."""
    total_evaluasi = serializers.IntegerField()
    by_kategori = serializers.DictField()
    by_ustadz = serializers.ListField()
    recent_evaluations = AsatidzEvaluationListSerializer(many=True)


# ============================================
# PENILAIAN KINERJA (STAR RATING) SERIALIZERS
# ============================================

class IndikatorKinerjaSerializer(serializers.ModelSerializer):
    """Serializer untuk IndikatorKinerja (read)."""
    auto_source_display = serializers.SerializerMethodField()

    class Meta:
        model = IndikatorKinerja
        fields = [
            'id', 'nama_indikator', 'deskripsi', 'urutan',
            'is_active', 'is_auto_calculated', 'auto_source', 'auto_source_display',
            'bobot', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_auto_source_display(self, obj):
        if obj.auto_source:
            return dict(IndikatorKinerja._meta.get_field('auto_source').choices).get(obj.auto_source, obj.auto_source)
        return None


class IndikatorKinerjaCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create/update IndikatorKinerja."""

    class Meta:
        model = IndikatorKinerja
        fields = [
            'nama_indikator', 'deskripsi', 'urutan',
            'is_active', 'is_auto_calculated', 'auto_source', 'bobot'
        ]

    def validate(self, data):
        # Validasi: jika auto_calculated, harus ada auto_source
        if data.get('is_auto_calculated') and not data.get('auto_source'):
            raise serializers.ValidationError({
                'auto_source': 'Auto source harus diisi untuk indikator auto-calculated'
            })
        return data


class DetailPenilaianKinerjaSerializer(serializers.ModelSerializer):
    """Serializer untuk DetailPenilaianKinerja (read)."""
    indikator_nama = serializers.CharField(source='indikator.nama_indikator', read_only=True)
    indikator_deskripsi = serializers.CharField(source='indikator.deskripsi', read_only=True)
    indikator_bobot = serializers.DecimalField(source='indikator.bobot', max_digits=5, decimal_places=2, read_only=True)
    is_auto_calculated = serializers.BooleanField(source='indikator.is_auto_calculated', read_only=True)
    nilai_display = serializers.CharField(read_only=True)

    class Meta:
        model = DetailPenilaianKinerja
        fields = [
            'id', 'penilaian', 'indikator',
            'indikator_nama', 'indikator_deskripsi', 'indikator_bobot', 'is_auto_calculated',
            'nilai_bintang', 'nilai_display', 'catatan',
            'is_auto_filled', 'auto_calculation_data',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_auto_filled', 'auto_calculation_data']


class DetailPenilaianKinerjaInputSerializer(serializers.Serializer):
    """Serializer untuk input nilai per indikator."""
    indikator_id = serializers.IntegerField()
    nilai_bintang = serializers.IntegerField(min_value=1, max_value=5, allow_null=True, required=False)
    catatan = serializers.CharField(allow_blank=True, required=False)


class PenilaianKinerjaAsatidzSerializer(serializers.ModelSerializer):
    """Serializer untuk PenilaianKinerjaAsatidz (read) dengan nested details."""
    ustadz_nama = serializers.CharField(source='ustadz.name', read_only=True)
    ustadz_username = serializers.CharField(source='ustadz.username', read_only=True)
    ustadz_role = serializers.CharField(source='ustadz.role', read_only=True)
    penilai_nama = serializers.CharField(source='penilai.name', read_only=True)
    penilai_username = serializers.CharField(source='penilai.username', read_only=True)
    status_display = serializers.SerializerMethodField()
    predikat = serializers.CharField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)
    tahun_ajaran_display = serializers.SerializerMethodField()

    # Nested details
    detail_penilaian = DetailPenilaianKinerjaSerializer(many=True, read_only=True)

    class Meta:
        model = PenilaianKinerjaAsatidz
        fields = [
            'id',
            'ustadz', 'ustadz_nama', 'ustadz_username', 'ustadz_role',
            'tahun_ajaran', 'tahun_ajaran_nama', 'tahun_ajaran_display', 'semester',
            'penilai', 'penilai_nama', 'penilai_username',
            'status', 'status_display',
            'catatan_tambahan',
            'rata_rata_nilai', 'total_indikator', 'predikat', 'is_complete',
            'tanggal_penilaian', 'finalized_at',
            'detail_penilaian',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'rata_rata_nilai', 'total_indikator',
            'tanggal_penilaian', 'finalized_at',
            'created_at', 'updated_at'
        ]

    def get_status_display(self, obj):
        return dict(PenilaianKinerjaAsatidz.STATUS_CHOICES).get(obj.status, obj.status)

    def get_tahun_ajaran_display(self, obj):
        if obj.tahun_ajaran:
            return str(obj.tahun_ajaran)
        return f"{obj.tahun_ajaran_nama} - {obj.semester}"


class PenilaianKinerjaAsatidzListSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk list PenilaianKinerjaAsatidz."""
    ustadz_nama = serializers.CharField(source='ustadz.name', read_only=True)
    ustadz_role = serializers.CharField(source='ustadz.role', read_only=True)
    penilai_nama = serializers.CharField(source='penilai.name', read_only=True)
    status_display = serializers.SerializerMethodField()
    predikat = serializers.CharField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = PenilaianKinerjaAsatidz
        fields = [
            'id', 'ustadz', 'ustadz_nama', 'ustadz_role',
            'tahun_ajaran_nama', 'semester',
            'penilai_nama', 'status', 'status_display',
            'rata_rata_nilai', 'total_indikator', 'predikat', 'is_complete',
            'tanggal_penilaian', 'created_at'
        ]

    def get_status_display(self, obj):
        return dict(PenilaianKinerjaAsatidz.STATUS_CHOICES).get(obj.status, obj.status)


class PenilaianKinerjaAsatidzCreateSerializer(serializers.ModelSerializer):
    """Serializer untuk create PenilaianKinerjaAsatidz."""
    detail_values = DetailPenilaianKinerjaInputSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = PenilaianKinerjaAsatidz
        fields = [
            'ustadz', 'tahun_ajaran', 'tahun_ajaran_nama', 'semester',
            'penilai', 'catatan_tambahan', 'detail_values'
        ]

    def validate_ustadz(self, value):
        """Validasi bahwa target adalah ustadz/karyawan."""
        if value.role == 'walisantri':
            raise serializers.ValidationError('Walisantri tidak dapat menjadi target penilaian')
        return value

    def validate(self, data):
        # Check duplicate
        ustadz = data.get('ustadz')
        tahun_ajaran_nama = data.get('tahun_ajaran_nama', '2025/2026')
        semester = data.get('semester', 'Ganjil')

        # Get from TahunAjaran if provided
        tahun_ajaran = data.get('tahun_ajaran')
        if tahun_ajaran:
            tahun_ajaran_nama = tahun_ajaran.nama
            semester = tahun_ajaran.semester

        existing = PenilaianKinerjaAsatidz.objects.filter(
            ustadz=ustadz,
            tahun_ajaran_nama=tahun_ajaran_nama,
            semester=semester
        )
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError({
                'ustadz': f'Penilaian untuk {ustadz.name} pada periode {tahun_ajaran_nama} {semester} sudah ada'
            })

        return data

    def create(self, validated_data):
        detail_values = validated_data.pop('detail_values', [])

        # Set tahun_ajaran_nama and semester from TahunAjaran if provided
        tahun_ajaran = validated_data.get('tahun_ajaran')
        if tahun_ajaran:
            validated_data['tahun_ajaran_nama'] = tahun_ajaran.nama
            validated_data['semester'] = tahun_ajaran.semester

        # Create penilaian
        penilaian = PenilaianKinerjaAsatidz.objects.create(**validated_data)

        # Create detail for each active indicator
        active_indicators = IndikatorKinerja.objects.filter(is_active=True)
        detail_values_map = {dv['indikator_id']: dv for dv in detail_values}

        for indikator in active_indicators:
            detail_data = detail_values_map.get(indikator.id, {})
            DetailPenilaianKinerja.objects.create(
                penilaian=penilaian,
                indikator=indikator,
                nilai_bintang=detail_data.get('nilai_bintang'),
                catatan=detail_data.get('catatan', ''),
                is_auto_filled=indikator.is_auto_calculated
            )

        # Recalculate average
        penilaian.calculate_rata_rata()
        penilaian.save()

        return penilaian


class PenilaianKinerjaAsatidzUpdateSerializer(serializers.Serializer):
    """Serializer untuk update rating dalam PenilaianKinerja."""
    detail_values = DetailPenilaianKinerjaInputSerializer(many=True, required=True)
    catatan_tambahan = serializers.CharField(allow_blank=True, required=False)
    submit = serializers.BooleanField(default=False, help_text="Set True untuk submit penilaian")

    def validate(self, data):
        # Validate detail_values
        for detail in data.get('detail_values', []):
            if detail.get('nilai_bintang') is not None:
                if detail['nilai_bintang'] < 1 or detail['nilai_bintang'] > 5:
                    raise serializers.ValidationError({
                        'detail_values': f"Nilai bintang harus 1-5, ditemukan: {detail['nilai_bintang']}"
                    })
        return data


class PenilaianKinerjaSummarySerializer(serializers.Serializer):
    """Summary penilaian kinerja untuk dashboard."""
    total_penilaian = serializers.IntegerField()
    total_draft = serializers.IntegerField()
    total_submitted = serializers.IntegerField()
    total_finalized = serializers.IntegerField()
    rata_rata_keseluruhan = serializers.DecimalField(max_digits=3, decimal_places=2)
    by_predikat = serializers.DictField()
    top_performers = serializers.ListField()
    recent_penilaian = PenilaianKinerjaAsatidzListSerializer(many=True)
