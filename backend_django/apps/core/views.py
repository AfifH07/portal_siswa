"""
Core Views - Master Data API
Portal Ponpes Baron v2.3.3
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import TahunAjaran, MasterJam, MasterMapel
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


from apps.accounts.permissions import IsSuperAdmin


class MasterMapelListView(APIView):
    """
    GET  /api/core/master-mapel/  - List all mapel (filter: ?sesi=kbm)
    POST /api/core/master-mapel/  - Create new mapel (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sesi_filter = request.query_params.get('sesi')
        include_inactive = request.query_params.get('include_inactive', 'false').lower() == 'true'

        # Base queryset
        if include_inactive:
            queryset = MasterMapel.objects.all()
        else:
            queryset = MasterMapel.objects.filter(is_active=True)

        # Filter by sesi
        if sesi_filter:
            queryset = queryset.filter(sesi=sesi_filter)

        queryset = queryset.order_by('sesi', 'nama')

        data = [
            {
                'id': m.id,
                'nama': m.nama,
                'kode': m.kode,
                'sesi': m.sesi,
                'sesi_display': m.get_sesi_display(),
                'is_active': m.is_active,
            }
            for m in queryset
        ]

        return Response({
            'success': True,
            'count': len(data),
            'data': data
        })

    def post(self, request):
        # Only superadmin can create
        if request.user.role not in ['superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Tidak memiliki akses'
            }, status=status.HTTP_403_FORBIDDEN)

        nama = request.data.get('nama', '').strip()
        kode = request.data.get('kode', '').strip()
        sesi = request.data.get('sesi', '')

        if not nama:
            return Response({
                'success': False,
                'message': 'Nama mata pelajaran harus diisi'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not sesi or sesi not in ['kbm', 'diniyah', 'tahfidz']:
            return Response({
                'success': False,
                'message': 'Sesi harus dipilih (kbm/diniyah/tahfidz)'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check duplicate
        if MasterMapel.objects.filter(nama=nama, sesi=sesi).exists():
            return Response({
                'success': False,
                'message': f'Mapel "{nama}" sudah ada di sesi {sesi.upper()}'
            }, status=status.HTTP_400_BAD_REQUEST)

        mapel = MasterMapel.objects.create(
            nama=nama,
            kode=kode,
            sesi=sesi,
            is_active=True
        )

        return Response({
            'success': True,
            'message': f'Mapel "{nama}" berhasil ditambahkan',
            'data': {
                'id': mapel.id,
                'nama': mapel.nama,
                'kode': mapel.kode,
                'sesi': mapel.sesi,
                'sesi_display': mapel.get_sesi_display(),
                'is_active': mapel.is_active,
            }
        }, status=status.HTTP_201_CREATED)


class MasterMapelDetailView(APIView):
    """
    GET    /api/core/master-mapel/<id>/  - Get single mapel
    PATCH  /api/core/master-mapel/<id>/  - Update mapel
    DELETE /api/core/master-mapel/<id>/  - Soft delete (is_active=False)
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return MasterMapel.objects.get(pk=pk)
        except MasterMapel.DoesNotExist:
            return None

    def get(self, request, pk):
        mapel = self.get_object(pk)
        if not mapel:
            return Response({
                'success': False,
                'message': 'Mapel tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'data': {
                'id': mapel.id,
                'nama': mapel.nama,
                'kode': mapel.kode,
                'sesi': mapel.sesi,
                'sesi_display': mapel.get_sesi_display(),
                'is_active': mapel.is_active,
            }
        })

    def patch(self, request, pk):
        if request.user.role not in ['superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Tidak memiliki akses'
            }, status=status.HTTP_403_FORBIDDEN)

        mapel = self.get_object(pk)
        if not mapel:
            return Response({
                'success': False,
                'message': 'Mapel tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)

        # Update fields
        if 'nama' in request.data:
            mapel.nama = request.data['nama'].strip()
        if 'kode' in request.data:
            mapel.kode = request.data['kode'].strip()
        if 'sesi' in request.data:
            mapel.sesi = request.data['sesi']
        if 'is_active' in request.data:
            mapel.is_active = request.data['is_active']

        # Check duplicate (excluding self)
        if MasterMapel.objects.filter(nama=mapel.nama, sesi=mapel.sesi).exclude(pk=pk).exists():
            return Response({
                'success': False,
                'message': f'Mapel "{mapel.nama}" sudah ada di sesi {mapel.sesi.upper()}'
            }, status=status.HTTP_400_BAD_REQUEST)

        mapel.save()

        return Response({
            'success': True,
            'message': 'Mapel berhasil diupdate',
            'data': {
                'id': mapel.id,
                'nama': mapel.nama,
                'kode': mapel.kode,
                'sesi': mapel.sesi,
                'sesi_display': mapel.get_sesi_display(),
                'is_active': mapel.is_active,
            }
        })

    def delete(self, request, pk):
        if request.user.role not in ['superadmin', 'admin']:
            return Response({
                'success': False,
                'message': 'Tidak memiliki akses'
            }, status=status.HTTP_403_FORBIDDEN)

        mapel = self.get_object(pk)
        if not mapel:
            return Response({
                'success': False,
                'message': 'Mapel tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)

        # Soft delete
        mapel.is_active = False
        mapel.save()

        return Response({
            'success': True,
            'message': f'Mapel "{mapel.nama}" berhasil dinonaktifkan'
        })


class MasterMapelGroupedView(APIView):
    """
    GET /api/core/master-mapel/grouped/

    Returns mapel grouped by sesi (for dropdowns).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        result = {}
        for sesi_code, sesi_label in MasterMapel.SESI_CHOICES:
            queryset = MasterMapel.objects.filter(sesi=sesi_code, is_active=True).order_by('nama')
            result[sesi_code] = [
                {
                    'id': m.id,
                    'nama': m.nama,
                    'kode': m.kode,
                }
                for m in queryset
            ]

        return Response({
            'success': True,
            'data': result
        })
