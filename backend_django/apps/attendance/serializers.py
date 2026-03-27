from rest_framework import serializers
from .models import Attendance, AttendanceDraft


class AttendanceDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceDraft
        fields = ['id', 'username', 'kelas', 'tanggal', 'mata_pelajaran', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='nisn.nama', read_only=True)
    student_kelas = serializers.CharField(source='nisn.kelas', read_only=True)
    jam_label = serializers.SerializerMethodField()
    waktu_kategori = serializers.CharField(read_only=True)

    class Meta:
        model = Attendance
        fields = ['id', 'nisn', 'tanggal', 'jam_ke', 'jam_label', 'waktu_kategori', 'mata_pelajaran', 'status', 'keterangan', 'created_at', 'updated_at', 'student_name', 'student_kelas']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_jam_label(self, obj):
        return Attendance.get_jam_label(obj.jam_ke)

    def validate(self, data):
        status = data.get('status')
        if status not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError({'status': 'Status harus Hadir, Sakit, Izin, atau Alpha'})
        return data


class AttendanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['nisn', 'tanggal', 'jam_ke', 'mata_pelajaran', 'status', 'keterangan']

    def validate(self, data):
        nisn = data.get('nisn')
        tanggal = data.get('tanggal')
        jam_ke = data.get('jam_ke', 1)
        status = data.get('status')

        if status not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError({'status': 'Status harus Hadir, Sakit, Izin, atau Alpha'})

        if jam_ke < 1 or jam_ke > 9:
            raise serializers.ValidationError({'jam_ke': 'Jam pelajaran harus antara 1-9'})

        existing = Attendance.objects.filter(
            nisn=nisn,
            tanggal=tanggal,
            jam_ke=jam_ke
        ).first()

        if existing:
            raise serializers.ValidationError('Absensi untuk siswa ini pada tanggal dan jam pelajaran tersebut sudah ada')

        return data


class AttendanceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['status', 'keterangan']

    def validate_status(self, value):
        if value not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError('Status harus Hadir, Sakit, Izin, atau Alpha')
        return value


class AttendanceStatsSerializer(serializers.Serializer):
    nisn = serializers.CharField()
    nama = serializers.CharField()
    tanggal = serializers.DateField()
    hari = serializers.CharField()
    jam_ke = serializers.IntegerField(required=False)
    jam_label = serializers.CharField(required=False)
    mata_pelajaran = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    status = serializers.CharField()
    keterangan = serializers.CharField(allow_blank=True, allow_null=True)


class AttendanceStatsSummarySerializer(serializers.Serializer):
    total_hadir = serializers.IntegerField()
    total_sakit = serializers.IntegerField()
    total_izin = serializers.IntegerField()
    total_alpha = serializers.IntegerField()
    total_kehadiran = serializers.IntegerField()
    persentase_kehadiran = serializers.FloatField()


class MonthlyAttendanceSerializer(serializers.Serializer):
    month = serializers.IntegerField()
    year = serializers.IntegerField()
    attendance_data = AttendanceStatsSerializer(many=True)
    summary = AttendanceStatsSummarySerializer()
