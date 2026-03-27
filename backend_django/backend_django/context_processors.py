"""
Context processors for Portal Ponpes Baron.
Injects common data into all templates.
"""


def user_profile(request):
    """
    Context processor that injects user profile data into all templates.
    This data is available as template variables without needing to pass them explicitly.

    Note: Since we use JWT-based auth (tokens stored in localStorage),
    request.user is typically Anonymous in template views.
    The actual user data is fetched client-side via API.

    This context processor provides fallback/default values that JavaScript
    can override once authentication is verified.
    """
    context = {
        'user_profile': {
            'is_authenticated': request.user.is_authenticated,
            'username': getattr(request.user, 'username', ''),
            'name': getattr(request.user, 'name', getattr(request.user, 'username', '')),
            'role': getattr(request.user, 'role', ''),
            'email': getattr(request.user, 'email', ''),
        },
        # Role display names for templates
        'role_display_map': {
            'superadmin': 'Super Admin',
            'pimpinan': 'Pimpinan',
            'guru': 'Guru/Ustadz',
            'musyrif': 'Musyrif',
            'wali_kelas': 'Wali Kelas',
            'bk': 'Guru BK',
            'bendahara': 'Bendahara',
            'walisantri': 'Wali Santri',
            'pendaftar': 'Pendaftar',
            'adituren': 'Alumni',
        },
        # 7-menu structure for walisantri sidebar
        'walisantri_menu': [
            {'url': '/dashboard/', 'icon': '📊', 'label': 'Dashboard'},
            {'url': '/attendance', 'icon': '📋', 'label': 'Presensi'},
            {'url': '/ibadah', 'icon': '🕌', 'label': 'Ibadah'},
            {'url': '/grades', 'icon': '📝', 'label': 'Akademik'},
            {'url': '/hafalan', 'icon': '📖', 'label': 'Hafalan'},
            {'url': '/blp', 'icon': '⭐', 'label': 'Karakter (BLP)'},
            {'url': '/finance', 'icon': '💰', 'label': 'Tagihan'},
        ],
    }

    return context


def app_info(request):
    """
    Context processor for application-level information.
    """
    return {
        'app_name': 'Portal Ponpes Baron',
        'app_version': '2.3',
        'app_tagline': 'Portal Kesantrian Terpadu',
        'current_year': '2024/2025',
    }
