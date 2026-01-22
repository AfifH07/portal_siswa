from rest_framework import serializers
from .models import Student, Schedule


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['nisn', 'nama', 'kelas', 'program']


class StudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['nisn', 'nama', 'kelas', 'program']


class StudentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ['nama', 'kelas', 'program']


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = '__all__'
