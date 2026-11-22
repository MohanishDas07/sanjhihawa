"""
Geocoding Router for City Search and Reverse Geocoding.
"""

from fastapi import APIRouter, Query
from schemas.contracts import GeocodeResponse, ReverseGeocodeResponse
from services.air_service import (
    reverse_geocode,
    reverse_geocode_sync,
    search_city_geocoding,
    search_city_geocoding_sync,
)

router = APIRouter(tags=["Geocoding"])


def geocode_city_sync(q: str = "Ghaziabad") -> GeocodeResponse:
    return search_city_geocoding_sync(q)


def reverse_geocode_coords_sync(lat: float, lon: float) -> ReverseGeocodeResponse:
    return reverse_geocode_sync(lat, lon)


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode_city(q: str = Query("Ghaziabad", description="City name to search")):
    return await search_city_geocoding(q)


@router.get("/reverse-geocode", response_model=ReverseGeocodeResponse)
async def reverse_geocode_coords(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Longitude"),
):
    return await reverse_geocode(lat, lon)
