from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from .models import PendingRegistration
from .serializers import RegistrationSerializer, RegistrationReviewSerializer
from apps.students.models import Student
from apps.accounts.models import User


@method_decorator(csrf_exempt, name='dispatch')
class RegistrationView(APIView):
    """
    Registration endpoint that accepts and saves registration data
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        if serializer.is_valid():
            registration = serializer.save()
            return Response({
                'success': True,
                'message': 'Pendaftaran berhasil dikirim. Menunggu persetujuan admin.',
                'data': {
                    'id': registration.id,
                    'nisn': registration.nisn,
                    'nama': registration.nama,
                    'status': registration.status
                }
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Gagal mengirim pendaftaran',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class RegistrationListView(APIView):
    """
    List all pending registrations (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only superadmin and pimpinan can view registrations
        if request.user.role not in ['superadmin', 'pimpinan']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki akses untuk melihat pendaftaran'
            }, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status', None)
        registrations = PendingRegistration.objects.all()
        if status_filter:
            registrations = registrations.filter(status=status_filter)

        serializer = RegistrationSerializer(registrations, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


class RegistrationReviewView(APIView):
    """
    Approve or reject a registration (admin only)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Only superadmin and pimpinan can review registrations
        if request.user.role not in ['superadmin', 'pimpinan']:
            return Response({
                'success': False,
                'message': 'Anda tidak memiliki akses untuk memproses pendaftaran'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            registration = PendingRegistration.objects.get(pk=pk)
        except PendingRegistration.DoesNotExist:
            return Response({
                'success': False,
                'message': 'Pendaftaran tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)

        if registration.status != 'pending':
            return Response({
                'success': False,
                'message': 'Pendaftaran sudah diproses sebelumnya'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = RegistrationReviewSerializer(data=request.data)
        if serializer.is_valid():
            new_status = serializer.validated_data['status']
            notes = serializer.validated_data.get('notes', '')

            registration.status = new_status
            registration.notes = notes
            registration.reviewed_at = timezone.now()
            registration.reviewed_by = request.user.username
            registration.save()

            # If approved, create the student and user account
            if new_status == 'approved':
                # Create student record
                Student.objects.create(
                    nisn=registration.nisn,
                    nama=registration.nama,
                    email=registration.email,
                    phone=registration.phone,
                    kelas=registration.kelas,
                    program=registration.program,
                    wali_nama=registration.wali_nama,
                    wali_phone=registration.wali_phone,
                )

                # Create user account for walisantri
                import secrets
                temp_password = secrets.token_urlsafe(8)
                user = User.objects.create_user(
                    username=registration.nisn,
                    password=temp_password,
                    name=registration.nama,
                    nisn=registration.nisn,
                    role='walisantri'
                )

                return Response({
                    'success': True,
                    'message': 'Pendaftaran disetujui. Akun walisantri telah dibuat.',
                    'data': {
                        'username': registration.nisn,
                        'temp_password': temp_password
                    }
                })

            return Response({
                'success': True,
                'message': f'Pendaftaran telah {new_status}'
            })

        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
