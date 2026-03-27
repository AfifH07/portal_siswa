"""
Core Serializers - Master Data
Portal Ponpes Baron v2.3.3
"""

from rest_framework import serializers
from .models import TahunAjaran


class TahunAjaranSerializer(serializers.ModelSerializer):
    """
    Serializer for TahunAjaran model.
    """

    class Meta:
        model = TahunAjaran
        fields = [
            'id',
            'nama',
            'semester',
            'is_active',
            'tanggal_mulai',
            'tanggal_selesai',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActiveTahunAjaranSerializer(serializers.Serializer):
    """
    Serializer for active TahunAjaran response.
    Supports both database record and calculated fallback.
    """
    id = serializers.IntegerField(allow_null=True)
    nama = serializers.CharField()
    semester = serializers.CharField()
    tanggal_mulai = serializers.DateField(allow_null=True)
    tanggal_selesai = serializers.DateField(allow_null=True)
    is_calculated = serializers.BooleanField(default=False, required=False)
