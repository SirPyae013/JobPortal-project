import hashlib
from collections.abc import Mapping

from rest_framework.throttling import SimpleRateThrottle


class AuthEmailIPThrottle(SimpleRateThrottle):
    scope = "auth_email_ip"
    rate = "10/minute"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class VerificationEmailThrottle(SimpleRateThrottle):
    scope = "verification_email"
    rate = "1/minute"

    def get_cache_key(self, request, view):
        if not isinstance(request.data, Mapping):
            return None
        email = request.data.get("email", "")
        if not isinstance(email, str) or not email.strip():
            return None
        # Unknown and verified addresses get the same limit; cache keys omit the address.
        identity = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": identity}
