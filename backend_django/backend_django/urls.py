from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/users/', include('apps.accounts.urls_users')),
    path('api/students/', include('apps.students.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/grades/', include('apps.grades.urls')),
    path('api/evaluations/', include('apps.evaluations.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/upload/', include('apps.evaluations.urls_upload')),
]

# Serve frontend index.html at root
from django.views.generic import TemplateView
urlpatterns.append(path('', TemplateView.as_view(template_name='index.html')))

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
