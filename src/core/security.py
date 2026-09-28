import hashlib


def hash_password(password: str) -> str:
    """Returns SHA-256 hash of password string."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain text password against stored hash."""
    return hash_password(plain_password) == hashed_password
