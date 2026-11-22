"""
Inverse Distance Weighting (IDW) Station Interpolation Engine.
Interpolates fine particulate concentrations between air quality monitoring stations.
Provides distance-to-nearest-station confidence metrics and distinguishes measured vs. estimated points.
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class AirStation:
    station_id: str
    name: str
    latitude: float
    longitude: float
    pm25: float
    aqi: int
    last_updated_iso: str


@dataclass
class InterpolatedPoint:
    latitude: float
    longitude: float
    estimated_pm25: float
    distance_to_nearest_station_km: float
    confidence_tier: str  # "high" (<5km), "moderate" (5-15km), "low" (>15km)
    is_measured_station: bool
    nearest_station_name: str


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two geographic coordinates in kilometers.
    """
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_km * c


def interpolate_idw(
    target_lat: float, target_lon: float, stations: list[AirStation], power: float = 2.0
) -> InterpolatedPoint:
    """
    Computes spatial inverse-distance weighted PM2.5 at (target_lat, target_lon).
    If within 0.2 km of a known station, snaps directly to the measured value.
    """
    if not stations:
        raise ValueError("Cannot interpolate without monitoring stations.")

    nearest_dist = float("inf")
    nearest_station = stations[0]

    # Check for direct station match
    for s in stations:
        dist = haversine_distance_km(target_lat, target_lon, s.latitude, s.longitude)
        if dist < nearest_dist:
            nearest_dist = dist
            nearest_station = s

        # Within 200 meters: consider as measured station reading
        if dist <= 0.2:
            return InterpolatedPoint(
                latitude=target_lat,
                longitude=target_lon,
                estimated_pm25=round(s.pm25, 1),
                distance_to_nearest_station_km=round(dist, 2),
                confidence_tier="high",
                is_measured_station=True,
                nearest_station_name=s.name,
            )

    # Compute IDW weighted average
    weighted_sum = 0.0
    weight_total = 0.0

    for s in stations:
        dist = haversine_distance_km(target_lat, target_lon, s.latitude, s.longitude)
        weight = 1.0 / (dist**power)
        weighted_sum += s.pm25 * weight
        weight_total += weight

    estimated = weighted_sum / weight_total if weight_total > 0 else nearest_station.pm25

    confidence = "high" if nearest_dist < 5.0 else ("moderate" if nearest_dist <= 15.0 else "low")

    return InterpolatedPoint(
        latitude=target_lat,
        longitude=target_lon,
        estimated_pm25=round(estimated, 1),
        distance_to_nearest_station_km=round(nearest_dist, 2),
        confidence_tier=confidence,
        is_measured_station=False,
        nearest_station_name=nearest_station.name,
    )
