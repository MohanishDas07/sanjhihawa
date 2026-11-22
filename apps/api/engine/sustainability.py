"""
Sustainability Layer - Emissions Avoided Calculations.
Calculates personal and collective emissions avoided (grams PM2.5 and kg CO2e)
when transitioning to cleaner transport, clean cooking, and efficient routines.
"""

from dataclasses import dataclass

from .constants import (
    COOKING_EMISSION_FACTORS,
    TRANSPORT_EMISSION_FACTORS,
)


@dataclass(frozen=True)
class AvoidedEmissionsResult:
    baseline_mode: str
    sustainable_mode: str
    pm25_avoided_grams: float
    co2e_avoided_kg: float
    description_en: str
    description_hi: str
    description_mr: str


def calculate_transport_emissions_avoided(
    baseline_mode: str,
    sustainable_mode: str,
    trip_distance_km: float,
    community_multiplier: int = 1,
) -> AvoidedEmissionsResult:
    """
    Computes direct tailpipe/grid PM2.5 (g) and CO2e (kg) avoided for a commute.
    Multiplies by community scale (e.g., 200 households) for collective view.
    """
    base = TRANSPORT_EMISSION_FACTORS.get(
        baseline_mode, TRANSPORT_EMISSION_FACTORS["two_wheeler_petrol"]
    )
    sust = TRANSPORT_EMISSION_FACTORS.get(sustainable_mode, TRANSPORT_EMISSION_FACTORS["metro"])

    pm25_avoided_per_trip = max(0.0, (base.pm25_g_per_km - sust.pm25_g_per_km) * trip_distance_km)
    co2e_avoided_per_trip = max(0.0, (base.co2e_kg_per_km - sust.co2e_kg_per_km) * trip_distance_km)

    total_pm25 = round(pm25_avoided_per_trip * community_multiplier, 3)
    total_co2e = round(co2e_avoided_per_trip * community_multiplier, 3)

    return AvoidedEmissionsResult(
        baseline_mode=baseline_mode,
        sustainable_mode=sustainable_mode,
        pm25_avoided_grams=total_pm25,
        co2e_avoided_kg=total_co2e,
        description_en=f"Avoids {total_pm25}g of direct PM2.5 and {total_co2e}kg of CO2e per day.",
        description_hi=f"प्रतिदिन {total_pm25} ग्राम PM2.5 और {total_co2e} किग्रा CO2e उत्सर्जन रोकता है।",
        description_mr=f"दररोज {total_pm25} ग्रॅम PM2.5 आणि {total_co2e} किलोग्रॅम CO2e उत्सर्जन टाळते.",
    )


def calculate_cooking_emissions_avoided(
    baseline_fuel: str,
    sustainable_fuel: str,
    meals_per_day: int = 3,
    community_multiplier: int = 1,
) -> AvoidedEmissionsResult:
    """
    Computes indoor and ambient PM2.5 and CO2e avoided from cleaner cooking fuels.
    """
    base = COOKING_EMISSION_FACTORS.get(baseline_fuel, COOKING_EMISSION_FACTORS["lpg"])
    sust = COOKING_EMISSION_FACTORS.get(sustainable_fuel, COOKING_EMISSION_FACTORS["induction"])

    pm25_avoided = max(0.0, (base.pm25_g_per_meal - sust.pm25_g_per_meal) * meals_per_day)
    co2e_avoided = max(0.0, (base.co2e_kg_per_meal - sust.co2e_kg_per_meal) * meals_per_day)

    total_pm25 = round(pm25_avoided * community_multiplier, 2)
    total_co2e = round(co2e_avoided * community_multiplier, 2)

    return AvoidedEmissionsResult(
        baseline_mode=baseline_fuel,
        sustainable_mode=sustainable_fuel,
        pm25_avoided_grams=total_pm25,
        co2e_avoided_kg=total_co2e,
        description_en=f"Avoids {total_pm25}g of indoor PM2.5 and {total_co2e}kg of CO2e daily.",
        description_hi=f"प्रतिदिन {total_pm25} ग्राम इनडोर PM2.5 और {total_co2e} किग्रा CO2e उत्सर्जन बचाता है।",
        description_mr=f"दररोज {total_pm25} ग्रॅम इनडोअर PM2.5 आणि {total_co2e} किलोग्रॅम CO2e उत्सर्जन रोखते.",
    )
