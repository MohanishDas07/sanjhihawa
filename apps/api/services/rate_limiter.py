"""
Sliding-window IP rate limiter with proxy header extraction and idle key eviction.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._store: dict[str, list[float]] = defaultdict(list)
        self._last_prune = time.time()

    def _extract_ip(self, request: Request) -> str:
        """Extracts client IP, respecting X-Forwarded-For and X-Real-IP behind reverse proxies."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "127.0.0.1"

    def check(self, request: Request, cost: int = 1) -> bool:
        """Checks rate limit for request. Returns True if allowed, False if exceeded."""
        client_ip = self._extract_ip(request)
        now = time.time()

        # Periodically evict completely idle IPs to prevent memory leak
        if now - self._last_prune > 300.0:
            self._prune_idle_keys(now)

        timestamps = [t for t in self._store[client_ip] if now - t < self.window_seconds]
        if len(timestamps) + cost > self.max_requests:
            self._store[client_ip] = timestamps
            return False

        timestamps.append(now)
        self._store[client_ip] = timestamps
        return True

    def enforce(self, request: Request, cost: int = 1) -> None:
        """Raises HTTPException 429 if rate limit is exceeded."""
        if not self.check(request, cost):
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded (max {self.max_requests} requests/min). Please pause before retrying.",
            )

    def _prune_idle_keys(self, now: float) -> None:
        """Evicts IPs with no timestamps inside the sliding window."""
        idle_keys = [
            ip for ip, ts in self._store.items() if not ts or (now - ts[-1] >= self.window_seconds)
        ]
        for ip in idle_keys:
            del self._store[ip]
        self._last_prune = now


# Shared singleton limiters for chat and air endpoints
chat_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60.0)
air_rate_limiter = SlidingWindowRateLimiter(max_requests=120, window_seconds=60.0)
