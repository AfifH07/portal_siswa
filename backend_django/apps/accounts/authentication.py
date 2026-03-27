"""
Custom Authentication Classes
=============================

Provides safe JWT authentication that handles malformed Authorization headers
gracefully without raising ValueError exceptions.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed


class SafeJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that safely handles malformed Authorization headers.

    Prevents ValueError when:
    - Authorization header is empty
    - Authorization header has no space (e.g., "Bearer" without token)
    - Authorization header has incorrect format

    Returns None (unauthenticated) instead of raising ValueError.
    """

    def authenticate(self, request):
        """
        Override authenticate to safely parse Authorization header.
        """
        header = self.get_header(request)

        if header is None:
            return None

        # Safely extract the raw token
        raw_token = self.get_raw_token_safe(header)

        if raw_token is None:
            return None

        # Validate the token
        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None

        return self.get_user(validated_token), validated_token

    def get_raw_token_safe(self, header):
        """
        Safely extract the raw token from the header.

        Expected format: "Bearer <token>"

        Returns None if:
        - Header is empty
        - Header doesn't contain exactly 2 parts (auth_type and token)
        - Auth type doesn't match expected prefix
        """
        if not header:
            return None

        # Decode header if it's bytes
        if isinstance(header, bytes):
            try:
                header = header.decode('utf-8')
            except UnicodeDecodeError:
                return None

        # Strip whitespace
        header = header.strip()

        if not header:
            return None

        # Split with maxsplit=1 to handle tokens that might contain spaces
        parts = header.split(' ', 1)

        # Must have exactly 2 parts: auth_type and token
        if len(parts) != 2:
            # Header is malformed (e.g., "Bearer" without token)
            return None

        auth_type, token = parts

        # Validate auth type (case-insensitive)
        auth_keyword = getattr(self, 'AUTH_HEADER_TYPES', ('Bearer',))
        if isinstance(auth_keyword, (list, tuple)):
            auth_keyword = auth_keyword[0] if auth_keyword else 'Bearer'

        if auth_type.lower() != auth_keyword.lower():
            return None

        # Validate token is not empty
        token = token.strip()
        if not token:
            return None

        return token.encode('utf-8') if isinstance(token, str) else token


class SafeJWTAuthenticationWithLogging(SafeJWTAuthentication):
    """
    SafeJWTAuthentication with additional logging for debugging.
    Use this during development to track authentication issues.
    """

    def authenticate(self, request):
        import logging
        logger = logging.getLogger(__name__)

        header = self.get_header(request)

        if header is None:
            logger.debug("[SafeJWT] No Authorization header present")
            return None

        # Log header format (sanitized - don't log the actual token)
        if isinstance(header, bytes):
            header_str = header.decode('utf-8', errors='replace')
        else:
            header_str = str(header)

        parts = header_str.split(' ', 1)
        if len(parts) == 2:
            logger.debug(f"[SafeJWT] Auth type: {parts[0]}, token length: {len(parts[1])}")
        else:
            logger.warning(f"[SafeJWT] Malformed Authorization header: {len(parts)} parts")

        return super().authenticate(request)
