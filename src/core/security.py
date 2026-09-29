"""Password hashing with a random salt (PBKDF2-SHA256, standard library only).

Stored format: pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>. The salt means two users
with the same password get different hashes, and the iterations make guessing slow.
"""
import hashlib
import hmac
import secrets

ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(plain_password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, hash_hex = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations))
    return hmac.compare_digest(digest.hex(), hash_hex)   # constant-time comparison
