"""
What-If Simulator Router - Evaluates Intervention Deltas and Community Emissions Avoided.
"""

from engine import run_simulation
from fastapi import APIRouter
from schemas.contracts import SimulateRequest, SimulateResponse
from services.air_service import get_air_quality

router = APIRouter(tags=["Simulation"])

DISCLAIMER_CIGS = (
    "Communication heuristic developed by Muller & Muller (Berkeley Earth, 2015), "
    "relating 24h PM2.5 exposure to smoking one cigarette per 22 µg/m³. "
    "This is an illustrative communication metric from peer-reviewed environmental health literature."
)


@router.post("/simulate", response_model=SimulateResponse)
async def simulate_interventions(req: SimulateRequest):
    profile = req.profile

    # Fetch ambient data to ground baseline
    air_data = await get_air_quality(
        latitude=profile.latitude,
        longitude=profile.longitude,
        city_name=profile.city_name,
    )

    hourly_pm25 = [pt.pm2_5 for pt in air_data.hourly_forecast]
    baseline_ambient = sum(hourly_pm25) / len(hourly_pm25) if hourly_pm25 else 250.0

    # Approximate baseline daily inhaled dose for typical adult (~16 m3/day)
    baseline_dose = round(baseline_ambient * 0.75 * 15.0, 1)  # ~2800 ug in severe smog
    baseline_cigs = round(baseline_ambient / 22.0, 1)

    sim_res = run_simulation(
        baseline_dose=baseline_dose,
        baseline_cigs=baseline_cigs,
        selected_intervention_ids=req.selected_intervention_ids,
        trip_distance_km=profile.commute_distance_km,
    )

    # Scale community view
    mult = req.community_household_count
    comm_pm25 = round(sim_res.pm25_emissions_avoided_g * mult, 2)
    comm_co2e = round(sim_res.co2e_emissions_avoided_kg * mult, 2)

    return SimulateResponse(
        baseline_dose_ug=sim_res.baseline_dose_ug,
        simulated_dose_ug=sim_res.simulated_dose_ug,
        dose_reduction_ug=sim_res.dose_reduction_ug,
        dose_reduction_pct=sim_res.dose_reduction_pct,
        baseline_cigs=sim_res.baseline_cigs,
        simulated_cigs=sim_res.simulated_cigs,
        cigs_saved=sim_res.cigs_saved,
        cigarette_heuristic_disclaimer=DISCLAIMER_CIGS,
        total_cost_inr=sim_res.total_cost_inr,
        cost_per_ug_reduced_inr=sim_res.cost_per_ug_reduced,
        pm25_emissions_avoided_g=sim_res.pm25_emissions_avoided_g,
        co2e_emissions_avoided_kg=sim_res.co2e_emissions_avoided_kg,
        community_multiplier=mult,
        community_pm25_avoided_g=comm_pm25,
        community_co2e_avoided_kg=comm_co2e,
        applied_interventions=sim_res.applied_interventions,
    )
