from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import User
from .permissions import IsSuperAdmin, IsGuru

class UserDetailView(APIView):
    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
            if not user:
                return Response({'success': False, 'message': 'User not found'}, status=404)
            
            data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'nisn': user.linked_student_nisn,
                'kelas': user.kelas,
                'role': user.role
            }
            return Response(data, status=200)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)


class UserListView(APIView):
    def get(self, request):
        try:
            users = User.objects.all()
            
            search_query = request.query_params.get('search', '')
            role = request.query_params.get('role', '')
            
            if search_query:
                users = users.filter(
                    Q(username__icontains=search_query) |
                    Q(email__icontains=search_query)
                )
            elif role:
                users = users.filter(role=role)
            else:
                users = User.objects.all()
            
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 25))
            
            start = (page - 1) * page_size
            end = start + page_size
            
            users = users[start:end]
            
            total = users.count()
            
            from django.core.paginator import Paginator
            
            paginator = Paginator(users, page_size)
            paginated_users = paginator.get_page(start // end)
            
            return Response({
                'success': True,
                'count': total,
                'next': paginator.page(paginated_users.number) < paginator.num_pages,
                'previous': paginated_users.has_prev(),
                'results': [
                    {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'nisn': user.nisn,
                        'kelas': user.kelas,
                        'role': user.role
                    } for user in paginated_users.object_list
                ]
            }, status=200)
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, status=500)
