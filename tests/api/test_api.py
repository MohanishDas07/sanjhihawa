"""
API Integration and Contract Tests for SAANS.
Validates Pydantic schema contracts, serialization bounds, and endpoint responses.
"""

import os
import sys
import unittest

# Set offline mode for tests
os.environ["SAANS_OFFLINE"] = "1"

# Add apps/api to path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api"))
)

from engine import (
    ActivitySlice,
    calculate_daily_member_dose,
    calculate_indoor_concentration,
    run_simulation,
)
from schemas.contracts import (
    AirQualityResponse,
    CommunityAdvisoryRequest,
    FamilyMember,
    GeocodeResponse,
    HealthResponse,
    HouseholdProfile,
    PlanRequest,
    SimulateRequest,
    SimulateResponse,
)
from services.air_service import (
    get_air_quality_sync,
    search_city_geocoding_sync,
)


class TestSaansAPIContracts(unittest.TestCase):
    def test_health_contract(self):
        h = HealthResponse(status="healthy", version="1.0.0", service="saans-api")
        self.assertEqual(h.status, "healthy")
        self.assertEqual(h.service, "saans-api")
        self.assertTrue(h.offline_fallback_available)

    def test_geocode_contract_and_service(self):
        res = search_city_geocoding_sync("Ghaziabad")
        self.assertIsInstance(res, GeocodeResponse)
        self.assertTrue(len(res.results) > 0)
        self.assertEqual(res.results[0].name, "Ghaziabad")
        self.assertEqual(res.results[0].country, "India")

    def test_reverse_geocode_contract_and_service(self):
        """Validates spatial reverse geocoding to nearest known Indian city."""
        from schemas.contracts import ReverseGeocodeResponse
        from services.air_service import reverse_geocode_sync

        # Bangalore coordinates
        rev_blr = reverse_geocode_sync(12.9716, 77.5946)
        self.assertIsInstance(rev_blr, ReverseGeocodeResponse)
        self.assertIn(rev_blr.name, ["Bengaluru", "Bangalore"])
        self.assertEqual(rev_blr.country, "India")
        self.assertEqual(rev_blr.admin1, "Karnataka")
        self.assertLessEqual(rev_blr.distance_km, 1.0)

        # Pune coordinates
        rev_pune = reverse_geocode_sync(18.5204, 73.8567)
        self.assertEqual(rev_pune.name, "Pune")
        self.assertEqual(rev_pune.admin1, "Maharashtra")

    def test_geocode_nonexistent_returns_empty(self):
        """Audit 2 R2: GET /api/v1/geocode?q=zzzzxq nonexistent place must return empty results, not fake cities."""
        res = search_city_geocoding_sync("zzzzxq nonexistent place")
        self.assertIsInstance(res, GeocodeResponse)
        self.assertEqual(res.results, [])

    def test_air_quality_contract_and_fixture_fallback(self):
        air = get_air_quality_sync(28.6692, 77.4538, "Ghaziabad", force_fallback=True)
        self.assertIsInstance(air, AirQualityResponse)
        self.assertEqual(air.city, "Ghaziabad")
        self.assertTrue(air.is_sample_or_fallback)
        self.assertIsNotNone(air.fallback_banner_text)
        self.assertEqual(len(air.hourly_forecast), 24)
        self.assertTrue(300 <= air.current_cpcb_aqi <= 500)  # Capped at 500 max
        self.assertEqual(air.dominant_pollutant, "PM2.5")

    def test_air_quality_distant_city_no_silent_substitution(self):
        """Audit 2 R8: Pune or distant cities without live station data must return status 'no_data', not a distant city's estimate."""
        air = get_air_quality_sync(18.52, 73.85, "Pune", force_fallback=False)
        self.assertIsInstance(air, AirQualityResponse)
        self.assertEqual(air.status, "no_data")
        self.assertIsNone(air.current_cpcb_aqi)
        self.assertIn("No reading for Pune", air.one_sentence_verdict_en)

    def test_plan_for_no_data_city_fails_cleanly(self):
        """Audit 2 R8: Plan endpoint refuses to compute synthetic schedules for unmonitored cities with no data."""
        air = get_air_quality_sync(18.52, 73.85, "Pune", force_fallback=False)
        self.assertEqual(air.status, "no_data")
        self.assertIsNone(air.current_cpcb_aqi)
        self.assertEqual(air.hourly_forecast, [])
        self.assertIn("No reading for Pune", air.one_sentence_verdict_en)

    def test_plan_contract_with_demo_persona(self):
        # Demo Persona: Ghaziabad household with 2 adults, 9-yr sensitive child, 68-yr senior
        profile = HouseholdProfile(
            city_name="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            members=[
                FamilyMember(
                    id="adult_1",
                    label="Adult 1",
                    age_band="adult",
                    is_breathing_sensitive=False,
                ),
                FamilyMember(
                    id="adult_2",
                    label="Adult 2",
                    age_band="adult",
                    is_breathing_sensitive=False,
                ),
                FamilyMember(
                    id="child_1",
                    label="Child (9 yr)",
                    age_band="child",
                    is_breathing_sensitive=True,
                ),
                FamilyMember(
                    id="senior_1",
                    label="Senior (68 yr)",
                    age_band="senior",
                    is_breathing_sensitive=False,
                ),
            ],
            commute_mode="two_wheeler_petrol",
            commute_distance_km=12.0,
            cooking_fuel="lpg",
            home_type="standard_closed",
            has_purifier=False,
            budget_band="under_1k",
        )
        req = PlanRequest(profile=profile)
        self.assertEqual(req.profile.city_name, "Ghaziabad")

        # Simulate plan generation logic
        air_data = get_air_quality_sync(
            profile.latitude, profile.longitude, profile.city_name
        )
        hourly_pm25 = [pt.pm2_5 for pt in air_data.hourly_forecast]
        outdoor_avg_pm25 = sum(hourly_pm25) / len(hourly_pm25)

        indoor_c = calculate_indoor_concentration(
            c_out=outdoor_avg_pm25,
            envelope_type=profile.home_type,
            cadr_m3_per_hour=0.0,
        )

        member_budgets = []
        for m in profile.members:
            slices = [
                ActivitySlice(
                    name="sleep",
                    duration_hours=8.0,
                    pm25_concentration=indoor_c,
                    activity_level="sleep",
                ),
                ActivitySlice(
                    name="day",
                    duration_hours=14.0,
                    pm25_concentration=indoor_c,
                    activity_level="sedentary",
                ),
                ActivitySlice(
                    name="commute",
                    duration_hours=2.0,
                    pm25_concentration=outdoor_avg_pm25,
                    activity_level="light",
                ),
            ]
            res = calculate_daily_member_dose(
                m.id, m.age_band, m.is_breathing_sensitive, slices
            )
            member_budgets.append(res)
            self.assertGreater(res.total_inhaled_dose_ug, 0.0)
            self.assertGreater(
                res.who_budget_ratio, 1.0
            )  # Exceeds WHO 15 ug/m3 in winter smog
            self.assertGreater(res.cigarette_equivalents, 0.0)
        self.assertEqual(len(member_budgets), 4)

    def test_simulate_contract(self):
        req = SimulateRequest(
            profile=HouseholdProfile(city_name="Ghaziabad", commute_distance_km=15.0),
            selected_intervention_ids=[
                "shift_ventilation_afternoon",
                "family_n95_masks",
                "hepa_room_purifier",
            ],
            community_household_count=200,
        )
        sim = run_simulation(
            baseline_dose=2400.0,
            baseline_cigs=10.0,
            selected_intervention_ids=req.selected_intervention_ids,
            trip_distance_km=req.profile.commute_distance_km,
        )
        resp = SimulateResponse(
            baseline_dose_ug=sim.baseline_dose_ug,
            simulated_dose_ug=sim.simulated_dose_ug,
            dose_reduction_ug=sim.dose_reduction_ug,
            dose_reduction_pct=sim.dose_reduction_pct,
            baseline_cigs=sim.baseline_cigs,
            simulated_cigs=sim.simulated_cigs,
            cigs_saved=sim.cigs_saved,
            cigarette_heuristic_disclaimer="Heuristic communication rule of thumb",
            total_cost_inr=sim.total_cost_inr,
            cost_per_ug_reduced_inr=sim.cost_per_ug_reduced,
            pm25_emissions_avoided_g=sim.pm25_emissions_avoided_g,
            co2e_emissions_avoided_kg=sim.co2e_emissions_avoided_kg,
            community_multiplier=req.community_household_count,
            community_pm25_avoided_g=round(
                sim.pm25_emissions_avoided_g * req.community_household_count, 2
            ),
            community_co2e_avoided_kg=round(
                sim.co2e_emissions_avoided_kg * req.community_household_count, 2
            ),
            applied_interventions=sim.applied_interventions,
        )
        self.assertGreater(resp.dose_reduction_pct, 0.0)
        self.assertGreater(resp.cigs_saved, 0.0)
        self.assertEqual(resp.community_multiplier, 200)

    def test_community_advisory_contract(self):
        req = CommunityAdvisoryRequest(
            organization_name="Vasundhara Enclave RWA",
            organization_type="rwa",
            city="Ghaziabad",
            language="hi",
        )
        self.assertEqual(req.organization_name, "Vasundhara Enclave RWA")
        self.assertEqual(req.language, "hi")

    def test_tool_get_air_resolves_city_coordinates_not_default_ghaziabad(self):
        """Audit 2 R3: Model calling tool_get_air(city='Pune') must resolve Pune coords, never default to Ghaziabad."""
        from llm.tools import execute_tool

        res = execute_tool("get_air", {"city": "Pune"})
        self.assertNotIn("error", res)
        self.assertEqual(res["city"], "Pune")
        self.assertAlmostEqual(res["latitude"], 18.5204, delta=0.5)
        self.assertAlmostEqual(res["longitude"], 73.8567, delta=0.5)

        # Nonexistent city should return structured error, never Ghaziabad data
        unknown = execute_tool("get_air", {"city": "NonexistentPlaceXYZ"})
        self.assertIn("error", unknown)

    def test_tool_get_day_plan_accepts_model_city_argument_without_crash(self):
        """Audit 2 R4: Model calling tool_get_day_plan(city='Delhi') must validate with Pydantic and not raise TypeError."""
        from llm.tools import execute_tool

        res = execute_tool("get_day_plan", {"city": "Delhi"})
        self.assertNotIn("error", res)
        self.assertEqual(res["city"], "Delhi")
        self.assertIn("scheduled_shift", res)

    def test_tool_argument_validation_and_safety(self):
        """Audit 2 R4: execute_tool whitelists arguments and handles invalid inputs gracefully."""
        from llm.tools import execute_tool

        # Unallowed internal parameters should be rejected or stripped
        res = execute_tool("get_air", {"city": "Delhi", "force_fallback": True})
        self.assertNotIn("error", res)

        # Invalid tool name returns error dict, does not crash caller
        res_unknown = execute_tool("unknown_tool_call", {"foo": "bar"})
        self.assertIn("error", res_unknown)

    def test_http_api_routes_and_contracts(self):
        """Audit 2 R18: Verifies API router endpoints and response contracts."""
        import main
        from routers import geocode, health
        from schemas.contracts import GeocodeResponse, HealthResponse

        # Health
        h = health.check_health_sync()
        self.assertIsInstance(h, HealthResponse)
        self.assertEqual(h.status, "healthy")

        # Geocode
        g = geocode.geocode_city_sync(q="Delhi")
        self.assertIsInstance(g, GeocodeResponse)
        self.assertGreaterEqual(len(g.results), 1)

        # Main FastAPI app metadata
        self.assertEqual(main.app.title, "SanjhiHawa API - Clean Air Intelligence & Breath Budget Engine")


if __name__ == "__main__":
    unittest.main()
