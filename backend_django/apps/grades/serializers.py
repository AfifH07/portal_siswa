from rest_framework import serializers
from django.db.models import Avg
from .models import Grade
from apps.students.models import Student


class GradeSerializer(serializers.ModelSerializer):
    nisn_nisn = serializers.CharField(source='nisn.nisn', read_only=True)
    nisn_nama = serializers.CharField(source='nisn.nama', read_only=True)
    nisn_kelas = serializers.CharField(source='nisn.kelas', read_only=True)
    rata_rata_kelas = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Grade
        fields = [
            'id', 'nisn', 'nisn_nisn', 'nisn_nama', 'nisn_kelas',
            'mata_pelajaran', 'nilai', 'semester', 'tahun_ajaran',
            'jenis', 'kelas', 'guru', 'materi', 'created_at', 'updated_at',
            'created_at_formatted', 'rata_rata_kelas'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_rata_rata_kelas(self, obj):
        # Check if pre-computed average is available from view annotation
        if hasattr(obj, 'rata_rata_kelas_computed'):
            return obj.rata_rata_kelas_computed or 0

        # Fallback: use aggregate instead of looping (single query)
        result = Grade.objects.filter(
            mata_pelajaran=obj.mata_pelajaran,
            kelas=obj.kelas,
            semester=obj.semester,
            tahun_ajaran=obj.tahun_ajaran,
            jenis=obj.jenis
        ).aggregate(avg=Avg('nilai'))
        return round(result['avg'], 2) if result['avg'] else 0

    def get_created_at_formatted(self, obj):
        return obj.created_at.strftime('%d/%m/%Y %H:%M')


class GradeCreateSerializer(serializers.ModelSerializer):
    nisn = serializers.CharField(write_only=True)
    # guru is set automatically by perform_create, so make it optional
    guru = serializers.CharField(required=False, allow_blank=True)
    materi = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = Grade
        fields = [
            'nisn', 'mata_pelajaran', 'nilai', 'semester',
            'tahun_ajaran', 'jenis', 'kelas', 'guru', 'materi'
        ]
        extra_kwargs = {
            'guru': {'required': False},
            'materi': {'required': False}
        }

    def validate_nisn(self, value):
        try:
            student = Student.objects.get(nisn=value)
            return value
        except Student.DoesNotExist:
            raise serializers.ValidationError("NISN tidak ditemukan")

    def validate_nilai(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Nilai harus antara 0-100")
        return value

    def validate_semester(self, value):
        valid_semesters = ['Ganjil', 'Genap']
        if value not in valid_semesters:
            raise serializers.ValidationError("Semester harus Ganjil atau Genap")
        return value

    def validate_jenis(self, value):
        # New jenis values + legacy values for backward compatibility
        valid_jenis = [
            'penugasan', 'tes_tulis', 'tes_lisan', 'portofolio',
            'praktek', 'proyek', 'uts', 'uas',
            # Legacy values
            'UH', 'UTS', 'UAS', 'Tugas', 'Proyek'
        ]
        if value not in valid_jenis:
            raise serializers.ValidationError(
                "Jenis harus salah satu dari: penugasan, tes_tulis, tes_lisan, "
                "portofolio, praktek, proyek, uts, uas"
            )
        return value

    def create(self, validated_data):
        nisn = validated_data.pop('nisn')
        student = Student.objects.get(nisn=nisn)
        grade = Grade.objects.create(nisn=student, **validated_data)
        return grade

    def update(self, instance, validated_data):
        nisn = validated_data.pop('nisn', None)
        if nisn:
            student = Student.objects.get(nisn=nisn)
            instance.nisn = student
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class GradeStatsSerializer(serializers.Serializer):
    mata_pelajaran = serializers.CharField()
    rata_rata = serializers.FloatField()
    nilai_tertinggi = serializers.IntegerField()
    nilai_terendah = serializers.IntegerField()
    jumlah_siswa = serializers.IntegerField()


class GradeAverageSerializer(serializers.Serializer):
    nisn = serializers.CharField()
    nama = serializers.CharField()
    semester = serializers.CharField()
    tahun_ajaran = serializers.CharField()
    rata_rata = serializers.FloatField()
    jumlah_mata_pelajaran = serializers.IntegerField()
    mata_pelajaran = serializers.ListField()


class ClassGradesSerializer(serializers.Serializer):
    nisn = serializers.CharField()
    nama = serializers.CharField()
    rata_rata = serializers.FloatField()
    total_nilai = serializers.IntegerField()


class WalisantriGradeSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for Walisantri view.
    Maps fields correctly for frontend consumption.
    """
    class Meta:
        model = Grade
        fields = [
            'id', 'mata_pelajaran', 'nilai', 'jenis',
            'semester', 'tahun_ajaran', 'kelas', 'guru',
            'materi', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class WalisantriGradeSummarySerializer(serializers.Serializer):
    """
    Grouped grade summary for Walisantri dashboard.
    Returns grades grouped by mata_pelajaran with calculated averages.
    """
    mata_pelajaran = serializers.CharField()
    rata_rata = serializers.FloatField()
    nilai_tertinggi = serializers.IntegerField()
    nilai_terendah = serializers.IntegerField()
    jumlah_nilai = serializers.IntegerField()
    detail = serializers.ListField()
