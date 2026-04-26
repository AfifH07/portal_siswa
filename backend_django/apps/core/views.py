"""
Core Views - Master Data API
Portal Ponpes Baron v2.3.3
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import TahunAjaran, MasterJam
from .serializers import TahunAjaranSerializer, ActiveTahunAjaranSerializer


class ActiveTahunAjaranView(APIView):
    """
    GET /api/core/tahun-ajaran/active/

    Returns the currently active TahunAjaran.
    If no active record exists, returns calculated values based on current date.

    Response:
    {
        "success": true,
        "data": {
            "id": 1,
            "nama": "2025/2026",
            "semester": "Genap",
            "tanggal_mulai": "2026-01-01",
            "tanggal_selesai": "2026-06-30",
            "is_calculated": false
        }
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = TahunAjaran.get_active_or_default()
        serializer = ActiveTahunAjaranSerializer(data)

        return Response({
            'success': True,
            'data': serializer.data
        })


class TahunAjaranListCreateView(ListCreateAPIView):
    """
    GET  /api/core/tahun-ajaran/     - List all TahunAjaran
    POST /api/core/tahun-ajaran/     - Create new TahunAjaran

    Query Params:
        - is_active: Filter by active status (true/false)
    """
    queryset = TahunAjaran.objects.all()
    serializer_class = TahunAjaranSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by is_active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response({
            'success': True,
            'message': 'Tahun Ajaran berhasil dibuat',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)


class TahunAjaranDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET    /api/core/tahun-ajaran/<pk>/  - Get single TahunAjaran
    PUT    /api/core/tahun-ajaran/<pk>/  - Update TahunAjaran
    DELETE /api/core/tahun-ajaran/<pk>/  - Delete TahunAjaran
    """
    queryset = TahunAjaran.objects.all()
    serializer_class = TahunAjaranSerializer
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)

        return Response({
            'success': True,
            'data': serializer.data
        })

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            'success': True,
            'message': 'Tahun Ajaran berhasil diupdate',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Prevent deletion of active TahunAjaran
        if instance.is_active:
            return Response({
                'success': False,
                'message': 'Tidak dapat menghapus Tahun Ajaran yang sedang aktif. Aktifkan tahun ajaran lain terlebih dahulu.'
            }, status=status.HTTP_400_BAD_REQUEST)

        self.perform_destroy(instance)

        return Response({
            'success': True,
            'message': 'Tahun Ajaran berhasil dihapus'
        }, status=status.HTTP_200_OK)


class MasterJamListView(APIView):
    """
    GET /api/core/master-jam/

    Returns all MasterJam grouped by sesi.

    Response:
    {
        "success": true,
        "data": {
            "tahfidz": [{ id, jam_ke, jam_mulai, jam_selesai, label }],
            "kbm": [...],
            "diniyah": [...]
        }
    }

    Query params:
        - sesi: Filter by sesi (tahfidz, kbm, diniyah)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sesi_filter = request.query_params.get('sesi')

        # If specific sesi requested
        if sesi_filter:
            queryset = MasterJam.objects.filter(sesi=sesi_filter, is_active=True).order_by('jam_ke')
            data = [
                {
                    'id': mj.id,
                    'jam_ke': mj.jam_ke,
                    'jam_mulai': mj.jam_mulai.strftime('%H:%M'),
                    'jam_selesai': mj.jam_selesai.strftime('%H:%M'),
                    'label': mj.label,
                    'keterangan': mj.keterangan,
                }
                for mj in queryset
            ]
            return Response({
                'success': True,
                'sesi': sesi_filter,
                'data': data
            })

        # Return all grouped by sesi
        result = {}
        for sesi_code, sesi_label in MasterJam.SESI_CHOICES:
            queryset = MasterJam.objects.filter(sesi=sesi_code, is_active=True).order_by('jam_ke')
            result[sesi_code] = [
                {
                    'id': mj.id,
                    'jam_ke': mj.jam_ke,
                    'jam_mulai': mj.jam_mulai.strftime('%H:%M'),
                    'jam_selesai': mj.jam_selesai.strftime('%H:%M'),
                    'label': mj.label,
                    'keterangan': mj.keterangan,
                }
                for mj in queryset
            ]

        return Response({
            'success': True,
            'data': result
        })
