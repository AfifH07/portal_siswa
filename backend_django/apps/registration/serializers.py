from rest_framework import serializers
from .models import PendingRegistration
from apps.students.models import Student


class RegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingRegistration
        fields = [
            'id', 'nisn', 'nama', 'email', 'phone', 'kelas', 'program',
            'wali_nama', 'wali_phone', 'alamat', 'tanggal_lahir',
            'status', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'notes', 'created_at']

    def validate_nisn(self, value):
        # Check if NISN already exists in students table
        if Student.objects.filter(nisn=value).exists():
            raise serializers.ValidationError('NISN sudah terdaftar sebagai siswa aktif.')
        # Check if NISN already has a pending registration
        if PendingRegistration.objects.filter(nisn=value, status='pending').exists():
            raise serializers.ValidationError('NISN sudah memiliki pendaftaran yang sedang diproses.')
        return value


class RegistrationReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingRegistration
        fields = ['status', 'notes']
