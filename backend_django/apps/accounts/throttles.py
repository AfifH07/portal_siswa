from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """
    Strict throttle for login attempts to prevent brute-force attacks.
    Rate: 5 attempts per minute per IP address.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        # Use IP address as identifier for login throttling
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request)
        }


class PasswordResetRateThrottle(SimpleRateThrottle):
    """
    Strict throttle for password reset requests to prevent abuse.
    Rate: 3 attempts per minute per IP address.
    """
    scope = 'password_reset'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request)
        }
