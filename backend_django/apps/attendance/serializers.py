from rest_framework import serializers
from .models import Attendance, AttendanceDraft, TitipanTugas


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
    # New fields v2.3.9
    tipe_pengajar_display = serializers.SerializerMethodField()
    guru_pengganti_nama = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'nisn', 'tanggal', 'jam_ke', 'jam_label', 'waktu_kategori',
            'mata_pelajaran', 'status', 'keterangan',
            # New fields v2.3.9
            'tipe_pengajar', 'tipe_pengajar_display', 'guru_pengganti', 'guru_pengganti_nama',
            'capaian_pembelajaran', 'materi', 'catatan',
            # Timestamps & relations
            'created_at', 'updated_at', 'student_name', 'student_kelas'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_jam_label(self, obj):
        return Attendance.get_jam_label(obj.jam_ke)

    def get_tipe_pengajar_display(self, obj):
        return obj.get_tipe_pengajar_display() if obj.tipe_pengajar else 'Guru Asli'

    def get_guru_pengganti_nama(self, obj):
        if obj.guru_pengganti:
            return obj.guru_pengganti.name or obj.guru_pengganti.username
        return None

    def validate(self, data):
        status = data.get('status')
        if status not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError({'status': 'Status harus Hadir, Sakit, Izin, atau Alpha'})
        return data


class AttendanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = [
            'nisn', 'tanggal', 'jam_ke', 'mata_pelajaran', 'status', 'keterangan',
            # New fields v2.3.9
            'tipe_pengajar', 'guru_pengganti', 'capaian_pembelajaran', 'materi', 'catatan'
        ]

    def validate(self, data):
        nisn = data.get('nisn')
        tanggal = data.get('tanggal')
        jam_ke = data.get('jam_ke', 1)
        status = data.get('status')
        tipe_pengajar = data.get('tipe_pengajar', 'guru_asli')
        guru_pengganti = data.get('guru_pengganti')

        if status not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError({'status': 'Status harus Hadir, Sakit, Izin, atau Alpha'})

        if jam_ke < 1 or jam_ke > 9:
            raise serializers.ValidationError({'jam_ke': 'Jam pelajaran harus antara 1-9'})

        # Validate guru_pengganti logic
        if tipe_pengajar == 'guru_pengganti' and not guru_pengganti:
            raise serializers.ValidationError({
                'guru_pengganti': 'Guru pengganti harus diisi jika tipe_pengajar adalah guru_pengganti'
            })

        if tipe_pengajar == 'guru_asli' and guru_pengganti:
            # Clear guru_pengganti if tipe is guru_asli
            data['guru_pengganti'] = None

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
        fields = [
            'status', 'keterangan',
            # New fields v2.3.9
            'tipe_pengajar', 'guru_pengganti', 'capaian_pembelajaran', 'materi', 'catatan'
        ]

    def validate_status(self, value):
        if value not in ['Hadir', 'Sakit', 'Izin', 'Alpha']:
            raise serializers.ValidationError('Status harus Hadir, Sakit, Izin, atau Alpha')
        return value

    def validate(self, data):
        tipe_pengajar = data.get('tipe_pengajar')
        guru_pengganti = data.get('guru_pengganti')

        # Only validate if both fields are being updated
        if tipe_pengajar == 'guru_pengganti' and guru_pengganti is None:
            # Check if existing record has guru_pengganti
            if self.instance and not self.instance.guru_pengganti:
                raise serializers.ValidationError({
                    'guru_pengganti': 'Guru pengganti harus diisi jika tipe_pengajar adalah guru_pengganti'
                })

        if tipe_pengajar == 'guru_asli' and guru_pengganti:
            data['guru_pengganti'] = None

        return data


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


class TitipanTugasSerializer(serializers.ModelSerializer):
    guru_nama = serializers.SerializerMethodField()
    guru_piket_nama = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    tahun_ajaran_nama = serializers.CharField(source='tahun_ajaran.nama', read_only=True)

    class Meta:
        model = TitipanTugas
        fields = [
            'id', 'guru', 'guru_nama', 'kelas', 'mata_pelajaran',
            'tanggal_berlaku', 'deskripsi_tugas', 'status', 'status_display',
            'guru_piket', 'guru_piket_nama', 'catatan_piket',
            'tahun_ajaran', 'tahun_ajaran_nama',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'guru', 'guru_piket', 'tahun_ajaran', 'created_at', 'updated_at']

    def get_guru_nama(self, obj):
        if obj.guru:
            return obj.guru.name or obj.guru.username
        return None

    def get_guru_piket_nama(self, obj):
        if obj.guru_piket:
            return obj.guru_piket.name or obj.guru_piket.username
        return None

    def get_status_display(self, obj):
        return obj.get_status_display()


class TitipanTugasCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TitipanTugas
        fields = ['kelas', 'mata_pelajaran', 'tanggal_berlaku', 'deskripsi_tugas']

    def validate_tanggal_berlaku(self, value):
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError('Tanggal berlaku tidak boleh di masa lalu')
        return value


class TitipanTugasTandaiSerializer(serializers.ModelSerializer):
    class Meta:
        model = TitipanTugas
        fields = ['catatan_piket']
