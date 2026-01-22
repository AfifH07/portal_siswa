from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count

from .models import Student
from .serializers import StudentSerializer, StudentCreateSerializer, StudentUpdateSerializer
from apps.accounts.permissions import IsAdmin


@api_view(['GET'])
@permission_classes([IsAdmin])
def get_distinct_classes(request):
    classes = Student.objects.values_list('kelas', flat=True).distinct()
    classes = [c for c in classes if c]
    return Response({'success': True, 'classes': sorted(classes)})


class StudentListView(generics.ListCreateAPIView):
    queryset = Student.objects.all()
    permission_classes = [IsAdmin]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StudentCreateSerializer
        return StudentSerializer


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Student.objects.all()
    lookup_field = 'nisn'
    permission_classes = [IsAdmin]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StudentUpdateSerializer
        return StudentSerializer
