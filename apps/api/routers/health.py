"""
Health and Diagnostic Router for SAANS API.
"""

from fastapi import APIRouter
from schemas.contracts import HealthResponse

router = APIRouter(tags=["Health"])


def check_health_sync() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        service="saans-api",
        offline_fallback_available=True,
        cache_backend="sqlite",
    )


@router.get("/health", response_model=HealthResponse)
def check_health():
    return check_health_sync()
