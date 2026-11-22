"""
SAANS Exposure Engine - Locked Physical and Epidemiological Constants.
All values are approximate, for atmospheric and exposure decision support.
See docs/ASSUMPTIONS.md for full literature provenance.
"""

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Inhalation Rates (m^3 / hour)
# Source: US EPA Exposure Factors Handbook (2011) Chapter 6 & ICMR Norms
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ActivityInhalationRates:
    sleep: float
    sedentary: float
    light: float
    moderate: float


INHALATION_RATES: dict[str, ActivityInhalationRates] = {
    "infant": ActivityInhalationRates(
        sleep=0.15, sedentary=0.22, light=0.35, moderate=0.50
    ),  # 0-2 yrs
    "child": ActivityInhalationRates(
        sleep=0.25, sedentary=0.35, light=0.55, moderate=0.90
    ),  # 3-14 yrs
    "adult": ActivityInhalationRates(
        sleep=0.30, sedentary=0.45, light=0.75, moderate=1.25
    ),  # 15-64 yrs
    "senior": ActivityInhalationRates(
        sleep=0.28, sedentary=0.40, light=0.65, moderate=1.05
    ),  # 65+ yrs
}

# ---------------------------------------------------------------------------
# Building Envelope Parameters
# Source: Chen & Zhao (2011), Atmospheric Environment; Nazaroff (2004)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BuildingEnvelope:
    air_exchange_rate: float  # a (h^-1)
    penetration_factor: float  # P (dimensionless, 0-1)
    natural_deposition_rate: float = 0.25  # k_nat (h^-1) for PM2.5


ENVELOPE_PROFILES: dict[str, BuildingEnvelope] = {
    "standard_closed": BuildingEnvelope(air_exchange_rate=0.8, penetration_factor=0.70),
    "sealed_closed": BuildingEnvelope(air_exchange_rate=0.4, penetration_factor=0.55),
    "leaky_closed": BuildingEnvelope(air_exchange_rate=1.5, penetration_factor=0.85),
    "windows_open": BuildingEnvelope(air_exchange_rate=4.0, penetration_factor=0.98),
}

# Room mixing efficiency factor (dimensionless)
ROOM_MIXING_FACTOR: float = 0.85

# ---------------------------------------------------------------------------
# Mask Effective Filtration Efficiencies (Fit-Adjusted)
# Deliberately conservative values reflecting real-world inward leakage.
# Source: CDC / NIOSH real-world leakage & ICMR mask studies
# ---------------------------------------------------------------------------

MASK_EFFICIENCIES: dict[str, float] = {
    "none": 0.0,
    "cloth": 0.20,  # Double cloth / cotton (nominal 40%, ~60% leakage)
    "surgical": 0.40,  # Surgical 3-ply (~40% leakage through perimeter)
    "n95_loose": 0.70,  # N95 without strict fit-testing / typical public fit
    "n95": 0.85,  # N95 / FFP2 properly fitted (conservative vs lab 95%)
}

# ---------------------------------------------------------------------------
# Health and Exposure Benchmarks
# ---------------------------------------------------------------------------

# WHO 24-hour Air Quality Guideline for PM2.5 (ug/m^3) - WHO 2021
WHO_PM25_24H_GUIDELINE: float = 15.0

# India National Ambient Air Quality Standard (NAAQS) 24-hour limit (ug/m^3) - CPCB
INDIA_NAAQS_PM25_24H_LIMIT: float = 60.0

# Berkeley Earth Cigarette-Equivalent Rule of Thumb (ug/m^3 per cigarette/day)
# Muller & Muller (2015). Environmental communication heuristic.
BERKELEY_EARTH_PM25_PER_CIGARETTE: float = 22.0

# ---------------------------------------------------------------------------
# Emission Factors (Sustainability Layer)
# Tailpipe / Direct PM2.5 (g/km or g/meal) and CO2e (kg/km or kg/meal)
# Source: ARAI / CPCB (2020), CEA CO2 Baseline Database (2023)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TransportEmissionFactor:
    pm25_g_per_km: float
    co2e_kg_per_km: float


TRANSPORT_EMISSION_FACTORS: dict[str, TransportEmissionFactor] = {
    "two_wheeler_petrol": TransportEmissionFactor(
        pm25_g_per_km=0.045, co2e_kg_per_km=0.042
    ),
    "car_petrol": TransportEmissionFactor(pm25_g_per_km=0.035, co2e_kg_per_km=0.145),
    "two_wheeler_ev": TransportEmissionFactor(
        pm25_g_per_km=0.003, co2e_kg_per_km=0.016
    ),
    "bus_cng": TransportEmissionFactor(pm25_g_per_km=0.005, co2e_kg_per_km=0.038),
    "metro": TransportEmissionFactor(pm25_g_per_km=0.001, co2e_kg_per_km=0.019),
    "walking": TransportEmissionFactor(pm25_g_per_km=0.0, co2e_kg_per_km=0.0),
    "cycling": TransportEmissionFactor(pm25_g_per_km=0.0, co2e_kg_per_km=0.0),
}


@dataclass(frozen=True)
class CookingEmissionFactor:
    pm25_g_per_meal: float
    co2e_kg_per_meal: float


COOKING_EMISSION_FACTORS: dict[str, CookingEmissionFactor] = {
    "biomass": CookingEmissionFactor(pm25_g_per_meal=12.50, co2e_kg_per_meal=2.80),
    "lpg": CookingEmissionFactor(pm25_g_per_meal=0.08, co2e_kg_per_meal=0.42),
    "induction": CookingEmissionFactor(pm25_g_per_meal=0.01, co2e_kg_per_meal=0.31),
}
