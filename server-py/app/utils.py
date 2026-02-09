import hashlib
import hmac
import os
import re
import time


def generate_hash_key(secret: str) -> str:
    """Generate an HMAC-SHA256 hash key, matching the Node.js implementation."""
    random_hex = os.urandom(32).hex()
    timestamp = _base36_encode(int(time.time() * 1000))
    data = random_hex + timestamp
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()


def is_valid_hash_key_format(key: str) -> bool:
    """Validate a hash key format (64-char hex string)."""
    return isinstance(key, str) and bool(re.fullmatch(r"[a-f0-9]{64}", key))


def _base36_encode(number: int) -> str:
    """Encode an integer to base36 string."""
    if number == 0:
        return "0"
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    result = []
    while number:
        number, remainder = divmod(number, 36)
        result.append(chars[remainder])
    return "".join(reversed(result))
