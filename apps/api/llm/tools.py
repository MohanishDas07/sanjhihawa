"""
Tool Definitions and Execution for SAANS AI Assistant.
Tools exposed to GenAI model:
- get_air(city, lat, lon)
- get_day_plan(city, profile_data)
- simulate(selected_intervention_ids, community_count)
- lookup_guidance(query, top_k)

Strict Guarantees (Audit 2 R3, R4, R5):
- Validates model arguments using Pydantic schemas.
- Catches errors and returns structured JSON error dicts instead of raising exceptions.
- Whitelists arguments to prevent model from passing internal flags (e.g., force_fallback).
- Dynamically resolves city coordinates via geocoding; never defaults unknown cities to Ghaziabad.
- Derives baseline doses and window advice from actual forecast and engine constants.
"""

from typing import Any

from engine import (
    FlexibleActivity,
    optimize_activity_schedule,
    run_simulation,
)
from pydantic import BaseModel, Field, ValidationError
from retrieval import lookup_guidance as retrieve_guidance
from schemas.contracts import HouseholdProfile
from services.air_service import get_air_quality_sync, search_city_geocoding_sync


class ToolGetAirArgs(BaseModel):
    city: str | None = None
    lat: float | None = None
    lon: float | None = None


class ToolGetDayPlanArgs(BaseModel):
    city: str | None = None
    lat: float | None = None
    lon: float | None = None
    profile_data: dict[str, Any] | None = None


class ToolSimulateArgs(BaseModel):
    selected_intervention_ids: list[str] = Field(
        default_factory=lambda: ["shift_ventilation_afternoon", "family_n95_masks"]
    )
    community_count: int = 1
    current_pm2_5: float | None = None


class ToolLookupArgs(BaseModel):
    query: str
    top_k: int = 3


def _resolve_coordinates(city: str | None, lat: float | None, lon: float | None) -> tuple[str, float, float] | None:
    """Resolves coordinates for a city using geocoding if lat/lon not supplied."""
    if lat is not None and lon is not None:
        c_name = city or "Custom Location"
        return c_name, float(lat), float(lon)

    if not city or not city.strip():
        # Default to Delhi-NCR reference station if neither city nor coords provided
        return "Ghaziabad", 28.6692, 77.4538

    geocode_res = search_city_geocoding_sync(city.strip())
    if not geocode_res.results:
        return None

    best = geocode_res.results[0]
    return best.name, best.latitude, best.longitude


def tool_get_air(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
) -> dict[str, Any]:
    """Retrieves current CPCB AQI, PM2.5 concentration, and active CAQM GRAP stage."""
    coords = _resolve_coordinates(city, lat, lon)
    if coords is None:
        return {"error": f"Unknown city '{city}'. No coordinates found."}

    resolved_city, resolved_lat, resolved_lon = coords
    res = get_air_quality_sync(
        latitude=resolved_lat, longitude=resolved_lon, city_name=resolved_city, force_fallback=False
    )

    if res.status == "no_data":
        return {
            "status": "no_data",
            "city": res.city,
            "latitude": res.latitude,
            "longitude": res.longitude,
            "current_cpcb_aqi": None,
            "current_pm2_5": None,
            "message": f"No air quality readings available for {res.city} right now (no monitoring station or model within 150 km).",
            "data_source": res.data_source,
        }

    return {
        "status": "ok",
        "city": res.city,
        "latitude": res.latitude,
        "longitude": res.longitude,
        "current_cpcb_aqi": res.current_cpcb_aqi,
        "current_pm2_5": res.current_pm2_5,
        "aqi_band": res.current_aqi_band,
        "active_grap_stage": (
            res.active_grap_stage.stage_number if res.active_grap_stage else None
        ),
        "one_sentence_verdict_en": res.one_sentence_verdict_en,
        "one_sentence_verdict_hi": res.one_sentence_verdict_hi,
        "one_sentence_verdict_mr": res.one_sentence_verdict_mr,
        "is_sample_or_fallback": res.is_sample_or_fallback,
        "data_source": res.data_source,
    }


def tool_get_day_plan(
    city: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    profile_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Computes personalized schedule optimization and member Breath Budgets."""
    prof = HouseholdProfile(**profile_data) if profile_data else HouseholdProfile()

    # If city or coordinates provided in tool call, override profile location
    target_city = city or (prof.city_name if prof.city_name != "Ghaziabad" else None)
    coords = _resolve_coordinates(target_city, lat, lon)
    if coords is None:
        return {"error": f"Unknown city '{city}'. Cannot compute day plan without location."}

    resolved_city, resolved_lat, resolved_lon = coords
    air = get_air_quality_sync(
        resolved_lat, resolved_lon, resolved_city, force_fallback=False
    )

    if air.status == "no_data":
        return {
            "error": f"No air quality readings available for {resolved_city} to compute day plan. Please select a recorded demo day."
        }

    hourly_pm25 = [p.pm2_5 for p in air.hourly_forecast]
    if not hourly_pm25:
        return {"error": f"No hourly forecast available for {resolved_city}."}

    # Scheduler activity: morning walk
    walk_task = FlexibleActivity(
        id="morning_walk",
        name_en="Morning Walk",
        name_hi="सुबह की सैर",
        name_mr="सकाळचा व्यायाम",
        duration_hours=1,
        feasible_start_hour=6,
        feasible_end_hour=17,
        default_hour=7,
        activity_level="moderate",
        is_outdoor=True,
    )
    scheduled_walk = optimize_activity_schedule(walk_task, hourly_pm25)

    # Derive dynamic window ventilation advice from hourly forecast (R5)
    # Find the daytime window (10:00 to 17:00) with minimum PM2.5
    daytime_forecast = [p for p in air.hourly_forecast if 10 <= p.hour <= 17]
    if daytime_forecast:
        best_pt = min(daytime_forecast, key=lambda p: p.pm2_5)
        window_start = best_pt.hour
        window_end = min(23, window_start + 2)
        window_str = f"{window_start:02d}:00 - {window_end:02d}:00"
    else:
        window_str = "12:00 - 15:00"

    return {
        "city": resolved_city,
        "current_aqi": air.current_cpcb_aqi,
        "active_grap_stage": air.active_grap_stage.stage_number if air.active_grap_stage else None,
        "scheduled_shift": {
            "activity": "Morning Walk",
            "baseline_time": f"{scheduled_walk.baseline_hour:02d}:00",
            "optimized_time": f"{scheduled_walk.optimized_hour:02d}:00",
            "baseline_pm25": scheduled_walk.baseline_avg_pm25,
            "optimized_pm25": scheduled_walk.optimized_avg_pm25,
            "reduction_pct": scheduled_walk.percentage_reduction,
        },
        "recommendation_free": f"Open windows during midday dispersion ({window_str}) when atmospheric inversion breaks.",
        "recommendation_budget": "Wear certified ISI/BIS N95 masks for outdoor commutes (~85% particulate filtration efficiency per IS 9473).",
    }


def tool_simulate(
    selected_intervention_ids: list[str] | None = None,
    community_count: int = 1,
    current_pm2_5: float | None = None,
) -> dict[str, Any]:
    """Simulates exposure and emissions deltas for chosen interventions with dynamic baselines."""
    ids = selected_intervention_ids or [
        "shift_ventilation_afternoon",
        "family_n95_masks",
    ]

    # Dynamically derive baseline dose from ambient PM2.5 or standard Indian winter baseline
    # 24h standard adult inhalation is ~15 m3 air/day
    pm = current_pm2_5 if current_pm2_5 and current_pm2_5 > 0 else 160.0
    dynamic_baseline_dose = round(pm * 15.0, 1)
    # Berkeley Earth rule of thumb: 22 ug/m3 * 15 m3 = 330 ug ≈ 1 cigarette
    dynamic_baseline_cigs = max(1.0, round(dynamic_baseline_dose / 330.0, 1))

    sim = run_simulation(
        baseline_dose=dynamic_baseline_dose,
        baseline_cigs=dynamic_baseline_cigs,
        selected_intervention_ids=ids,
    )
    return {
        "baseline_dose_ug": dynamic_baseline_dose,
        "simulated_dose_ug": sim.simulated_dose_ug,
        "dose_reduction_pct": sim.dose_reduction_pct,
        "dose_reduction_ug": sim.dose_reduction_ug,
        "baseline_cigs": dynamic_baseline_cigs,
        "cigs_saved": sim.cigs_saved,
        "total_cost_inr": sim.total_cost_inr,
        "pm25_emissions_avoided_g": sim.pm25_emissions_avoided_g,
        "community_pm25_avoided_g": round(
            sim.pm25_emissions_avoided_g * community_count, 2
        ),
        "community_multiplier": community_count,
    }


def tool_lookup_guidance(query: str, top_k: int = 3) -> dict[str, Any]:
    """Looks up authoritative guidance and myth corrections from the 30-chunk corpus."""
    chunks = retrieve_guidance(query, top_k=top_k)
    return {
        "query": query,
        "results": chunks,
    }


AVAILABLE_TOOLS = {
    "get_air": (tool_get_air, ToolGetAirArgs),
    "get_day_plan": (tool_get_day_plan, ToolGetDayPlanArgs),
    "simulate": (tool_simulate, ToolSimulateArgs),
    "lookup_guidance": (tool_lookup_guidance, ToolLookupArgs),
}


def execute_tool(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
    """
    Safely dispatches and executes a tool with parameter validation.
    Catches all validation and execution errors and returns structured JSON error dicts.
    """
    if tool_name not in AVAILABLE_TOOLS:
        return {"error": f"Unknown tool: '{tool_name}'. Available: {list(AVAILABLE_TOOLS.keys())}"}

    fn, schema_cls = AVAILABLE_TOOLS[tool_name]

    try:
        validated_args = schema_cls(**args)
    except ValidationError as ve:
        return {"error": f"Invalid arguments for tool '{tool_name}': {ve.errors()}"}
    except (ValueError, TypeError, KeyError) as ex:
        return {"error": f"Argument parsing failed for tool '{tool_name}': {ex!s}"}

    try:
        # Pass only validated model fields to function
        return fn(**validated_args.model_dump())
    except (ValueError, TypeError, KeyError, RuntimeError) as ex:
        return {"error": f"Tool execution failed for '{tool_name}': {ex!s}"}
