"""
Pydantic v2 schemas and data contracts for SAANS API.
Enforces strict bounds and validation on every field.
Used for OpenAPI generation and TypeScript client synchronization.
"""

from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Health & Geocoding
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "offline"] = "healthy"
    version: str = "1.0.0"
    service: str = "saans-api"
    offline_fallback_available: bool = True
    cache_backend: str = "sqlite"


class GeocodeItem(BaseModel):
    name: str = Field(..., max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    country: str = Field("India", max_length=100)
    admin1: str | None = Field(None, max_length=100)


class GeocodeResponse(BaseModel):
    query: str
    results: list[GeocodeItem] = Field(default_factory=list)


class ReverseGeocodeResponse(BaseModel):
    name: str = Field(..., max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    country: str = Field("India", max_length=100)
    admin1: str | None = Field(None, max_length=100)
    distance_km: float = Field(0.0, ge=0.0)
    display_name: str = Field(..., max_length=200)


# ---------------------------------------------------------------------------
# Air Quality Models
# ---------------------------------------------------------------------------


class HourlyAirPoint(BaseModel):
    hour: int = Field(..., ge=0, le=23)
    time_iso: str
    pm2_5: float = Field(..., ge=0.0)
    pm10: float | None = Field(None, ge=0.0)
    cpcb_aqi: int = Field(..., ge=0)
    aqi_band_code: (
        str  # "good", "satisfactory", "moderate", "poor", "very_poor", "severe"
    )
    aqi_band_name: str
    aqi_color_hex: str
    health_statement_en: str
    health_statement_hi: str
    health_statement_mr: str
    grap_stage: int | None = Field(None, ge=1, le=4)
    is_filled: bool = False  # Audit 2 R9: explicitly mark any forward-filled hour


class GRAPStageInfo(BaseModel):
    stage_number: int = Field(..., ge=1, le=4)
    name: str
    aqi_threshold: str
    mandatory_actions: list[str]
    citizen_advisory: list[str]


class AirQualityResponse(BaseModel):
    status: Literal["ok", "no_data"] = "ok"
    city: str
    state: str | None = None
    country: str = "India"
    latitude: float
    longitude: float
    current_pm2_5: float | None = None
    current_pm10: float | None = None
    current_cpcb_aqi: int | None = None
    current_aqi_band: str | None = None
    current_aqi_color: str | None = None
    dominant_pollutant: str = "PM2.5"
    one_sentence_verdict_en: str
    one_sentence_verdict_hi: str
    one_sentence_verdict_mr: str
    data_as_of: str
    data_source: str
    is_sample_or_fallback: bool
    fallback_banner_text: str | None = None
    active_grap_stage: GRAPStageInfo | None = None
    hourly_forecast: list[HourlyAirPoint] = Field(default_factory=list)
    is_modelled: bool = True  # Audit 2 R10: explicitly label modelled data as modelled


# ---------------------------------------------------------------------------
# Household Profile Models (Client-Side Storage, Transient Request Data)
# ---------------------------------------------------------------------------


class FamilyMember(BaseModel):
    id: str = Field(..., max_length=50)
    label: str = Field(..., max_length=50)  # e.g., "Grandmother", "9-year-old child"
    age_band: Literal["infant", "child", "adult", "senior"]
    is_breathing_sensitive: bool = False
    is_outdoor_worker: bool = False


class HouseholdProfile(BaseModel):
    city_name: str = Field("Ghaziabad", max_length=100)
    latitude: float = Field(28.6692, ge=-90.0, le=90.0)
    longitude: float = Field(77.4538, ge=-180.0, le=180.0)
    members: list[FamilyMember] = Field(default_factory=list)
    commute_mode: Literal[
        "walking",
        "cycling",
        "two_wheeler_petrol",
        "two_wheeler_ev",
        "car_petrol",
        "bus_cng",
        "metro",
        "none",
    ] = "two_wheeler_petrol"
    commute_distance_km: float = Field(10.0, ge=0.0, le=200.0)
    cooking_fuel: Literal["lpg", "induction", "biomass"] = "lpg"
    home_type: Literal[
        "standard_closed", "sealed_closed", "leaky_closed", "windows_open"
    ] = "standard_closed"
    has_purifier: bool = False
    purifier_cadr: float = Field(0.0, ge=0.0, le=1500.0)
    budget_band: Literal["zero", "under_1k", "over_5k"] = "under_1k"


# ---------------------------------------------------------------------------
# Plan Request & Response
# ---------------------------------------------------------------------------


class ActivityScheduleItem(BaseModel):
    activity_id: str
    name_en: str
    name_hi: str
    name_mr: str
    baseline_time: str
    optimized_time: str
    duration_hours: int
    baseline_pm25: float
    optimized_pm25: float
    reduction_ug_m3: float
    reduction_pct: float
    rationale_en: str
    rationale_hi: str
    rationale_mr: str


class MemberBudgetSummary(BaseModel):
    member_id: str
    label: str
    age_band: str
    is_sensitive: bool
    total_inhaled_dose_ug: float
    time_weighted_avg_pm25: float
    who_budget_ratio: float  # TWA / 15 ug/m^3
    india_naaqs_ratio: float  # TWA / 60 ug/m^3
    cigarette_equivalents: float  # TWA / 22 ug/m^3 (heuristic)
    heuristic_disclaimer: str


class RankedIntervention(BaseModel):
    id: str
    tier: Literal["zero", "under_1k", "over_5k"]
    tier_label: str
    cost_inr: float
    name_en: str
    name_hi: str
    name_mr: str
    description_en: str
    description_hi: str
    description_mr: str
    category: str
    dose_saved_pct: float
    cost_efficiency_score: (
        float  # higher = more ug saved per rupee (Tier 0 gets top priority)
    )


class PlanRequest(BaseModel):
    profile: HouseholdProfile
    custom_forecast: list[float] | None = None  # 24 hours pm2.5 if overriding


class PlanResponse(BaseModel):
    city: str
    data_as_of: str
    data_source: str
    is_sample_or_fallback: bool
    current_aqi: int
    current_band: str
    active_grap_stage: int | None
    schedules: list[ActivityScheduleItem]
    member_budgets: list[MemberBudgetSummary]
    recommendations: list[RankedIntervention]
    outdoor_worker_advice_en: str | None = None
    outdoor_worker_advice_hi: str | None = None
    outdoor_worker_advice_mr: str | None = None


# ---------------------------------------------------------------------------
# Simulation Models
# ---------------------------------------------------------------------------


class SimulateRequest(BaseModel):
    profile: HouseholdProfile
    selected_intervention_ids: list[str] = Field(default_factory=list)
    community_household_count: int = Field(1, ge=1, le=100000)


class SimulateResponse(BaseModel):
    baseline_dose_ug: float
    simulated_dose_ug: float
    dose_reduction_ug: float
    dose_reduction_pct: float
    baseline_cigs: float
    simulated_cigs: float
    cigs_saved: float
    cigarette_heuristic_disclaimer: str
    total_cost_inr: float
    cost_per_ug_reduced_inr: float
    pm25_emissions_avoided_g: float
    co2e_emissions_avoided_kg: float
    community_multiplier: int
    community_pm25_avoided_g: float
    community_co2e_avoided_kg: float
    applied_interventions: list[str]


# ---------------------------------------------------------------------------
# Community Advisory Card Models
# ---------------------------------------------------------------------------


class CommunityAdvisoryRequest(BaseModel):
    organization_name: str = Field("Vasundhara Enclave RWA", max_length=120)
    organization_type: Literal["rwa", "school", "office", "community"] = "rwa"
    city: str = Field("Ghaziabad", max_length=100)
    latitude: float = 28.6692
    longitude: float = 77.4538
    language: Literal["en", "hi", "mr"] = "en"


class CommunityAdvisoryResponse(BaseModel):
    organization_name: str
    date_formatted: str
    city: str
    aqi: int
    aqi_band: str
    aqi_color_hex: str
    headline: str
    bulletin_points: list[str]
    school_advisory: str | None = None
    rwa_actions: list[str]
    verification_source: str
    generated_at_iso: str
