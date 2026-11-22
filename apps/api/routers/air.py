"""
Air Quality Forecast Router.
"""

from fastapi import APIRouter, Query, Request
from schemas.contracts import AirQualityResponse
from services.air_service import get_air_quality, get_air_quality_sync
from services.rate_limiter import air_rate_limiter

router = APIRouter(tags=["Air Quality"])


def get_air_sync(
    lat: float = 28.6692,
    lon: float = 77.4538,
    city: str | None = "Ghaziabad",
    fallback: bool = False,
) -> AirQualityResponse:
    return get_air_quality_sync(
        latitude=lat, longitude=lon, city_name=city, force_fallback=fallback
    )


@router.get("/air", response_model=AirQualityResponse)
async def get_air(
    request: Request,
    lat: float = Query(28.6692, ge=-90.0, le=90.0, description="Latitude"),
    lon: float = Query(77.4538, ge=-180.0, le=180.0, description="Longitude"),
    city: str | None = Query("Ghaziabad", description="City name"),
    fallback: bool = Query(False, description="Force labeled offline sample fixture"),
):
    air_rate_limiter.enforce(request)
    return await get_air_quality(
        latitude=lat, longitude=lon, city_name=city, force_fallback=fallback
    )
