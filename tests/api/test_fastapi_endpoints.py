"""
FastAPI Architecture, Middleware, and Router Contract Test Suite.
Validates pure ASGI middleware configurations, rate limiters,
geocode sync helpers, and router data contracts for plan, simulate,
community advisory, air quality, and chat.
"""

import os
import sys
import unittest

os.environ["SAANS_OFFLINE"] = "1"

_api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api"))
if _api_dir not in sys.path:
    sys.path.insert(0, _api_dir)

from fastapi import HTTPException  # noqa: E402
from main import RequestBodyLimitMiddleware, SecurityHeadersMiddleware  # noqa: E402
from routers import air, chat, community, geocode, health, plan, simulate  # noqa: E402
from routers.chat import ChatRequest, ChatSyncResponse, CitationItem  # noqa: E402
from schemas.contracts import (  # noqa: E402
    CommunityAdvisoryRequest,
    FamilyMember,
    HouseholdProfile,
    PlanRequest,
    SimulateRequest,
)
from starlette.requests import Request  # noqa: E402


class TestFastAPIRouterArchitecture(unittest.TestCase):
    def setUp(self):
        self.req = Request(
            {
                "type": "http",
                "method": "GET",
                "headers": [(b"x-forwarded-for", b"127.0.0.1")],
                "client": ("127.0.0.1", 54321),
                "query_string": b"",
            }
        )
        self.valid_profile = HouseholdProfile(
            city_name="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            members=[
                FamilyMember(
                    id="adult_1",
                    label="Adult Earner",
                    age_band="adult",
                    is_breathing_sensitive=False,
                ),
                FamilyMember(
                    id="child_1",
                    label="Child",
                    age_band="child",
                    is_breathing_sensitive=True,
                ),
            ],
            commute_mode="two_wheeler_petrol",
            commute_distance_km=15.0,
            cooking_fuel="lpg",
            home_type="standard_closed",
            has_purifier=False,
            purifier_cadr=0,
            budget_band="zero",
        )

    def test_health_router_sync_contract(self):
        res = health.check_health()
        self.assertEqual(res.status, "healthy")
        self.assertEqual(res.service, "saans-api")
        self.assertTrue(res.offline_fallback_available)

    def test_geocode_router_sync_known_city(self):
        res = geocode.geocode_city_sync("Delhi")
        self.assertTrue(len(res.results) > 0)
        self.assertEqual(res.results[0].name, "Delhi")

    def test_geocode_router_sync_empty_query(self):
        res = geocode.geocode_city_sync("")
        self.assertEqual(res.results, [])

    def test_reverse_geocode_router_sync(self):
        res = geocode.reverse_geocode_coords_sync(28.6692, 77.4538)
        self.assertEqual(res.name, "Ghaziabad")
        self.assertEqual(res.country, "India")

    def test_air_sync_router_fixture(self):
        res = air.get_air_sync(28.6692, 77.4538, "Ghaziabad", fallback=True)
        self.assertEqual(res.city, "Ghaziabad")
        self.assertEqual(len(res.hourly_forecast), 24)
        self.assertIsNotNone(res.current_cpcb_aqi)

    def test_air_sync_router_defaults(self):
        res = air.get_air_sync()
        self.assertIn("Ghaziabad", res.city)
        self.assertIsNotNone(res.current_aqi_band)

    def test_plan_sync_valid_household_profile(self):
        req = PlanRequest(profile=self.valid_profile)
        res = plan.generate_day_plan_sync(req)
        self.assertEqual(res.city, "Ghaziabad")
        self.assertEqual(len(res.member_budgets), 2)
        self.assertTrue(len(res.schedules) > 0)
        self.assertTrue(len(res.recommendations) > 0)

    def test_plan_sync_outdoor_worker_profile(self):
        worker_profile = HouseholdProfile(
            city_name="Delhi",
            latitude=28.6139,
            longitude=77.2090,
            members=[
                FamilyMember(
                    id="worker_1",
                    label="Delivery Partner",
                    age_band="adult",
                    is_breathing_sensitive=False,
                    is_outdoor_worker=True,
                )
            ],
            commute_mode="two_wheeler_petrol",
            commute_distance_km=40.0,
        )
        res = plan.generate_day_plan_sync(PlanRequest(profile=worker_profile))
        self.assertIsNotNone(res.outdoor_worker_advice_en)
        self.assertIn("N95", res.outdoor_worker_advice_en)

    def test_plan_sync_unmonitored_city_raises_404(self):
        unmonitored_profile = HouseholdProfile(
            city_name="Pune",
            latitude=18.5204,
            longitude=73.8567,
        )
        req = PlanRequest(profile=unmonitored_profile)
        with self.assertRaises(HTTPException) as ctx:
            plan.generate_day_plan_sync(req)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_simulate_sync_valid_interventions(self):
        req = SimulateRequest(
            profile=self.valid_profile,
            selected_intervention_ids=["family_n95_masks", "shift_ventilation_afternoon"],
            community_household_count=20,
        )
        res = simulate.simulate_interventions_sync(req)
        self.assertGreater(res.baseline_dose_ug, 0)
        self.assertGreater(res.dose_reduction_ug, 0)
        self.assertGreater(res.dose_reduction_pct, 0)

    def test_simulate_sync_zero_cost_interventions(self):
        req = SimulateRequest(
            profile=self.valid_profile,
            selected_intervention_ids=["shift_ventilation_afternoon"],
            community_household_count=1,
        )
        res = simulate.simulate_interventions_sync(req)
        self.assertEqual(res.total_cost_inr, 0.0)

    def test_community_advisory_sync_english_rwa(self):
        req = CommunityAdvisoryRequest(
            city="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            organization_name="Indirapuram RWA",
            organization_type="rwa",
            language="en",
        )
        res = community.generate_community_advisory_sync(req)
        self.assertIn("Indirapuram RWA", res.organization_name)
        self.assertIn("AIR QUALITY ADVISORY", res.headline)
        self.assertTrue(len(res.bulletin_points) >= 4)
        self.assertTrue(len(res.rwa_actions) > 0)

    def test_community_advisory_sync_hindi_school(self):
        req = CommunityAdvisoryRequest(
            city="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            organization_name="डीपीएस स्कूल",
            organization_type="school",
            language="hi",
        )
        res = community.generate_community_advisory_sync(req)
        self.assertIn("वायु गुणवत्ता चेतावनी", res.headline)
        self.assertIsNotNone(res.school_advisory)

    def test_community_advisory_sync_marathi(self):
        req = CommunityAdvisoryRequest(
            city="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            organization_name="सोसायटी",
            organization_type="rwa",
            language="mr",
        )
        res = community.generate_community_advisory_sync(req)
        self.assertIn("हवा गुणवत्ता सूचना", res.headline)

    def test_community_advisory_sync_unmonitored_city_raises_404(self):
        req = CommunityAdvisoryRequest(
            city="Pune",
            latitude=18.5204,
            longitude=73.8567,
        )
        with self.assertRaises(HTTPException) as ctx:
            community.generate_community_advisory_sync(req)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_chat_sync_service_normal_query(self):
        req = ChatRequest(
            message="Can I go for an evening jog in Indirapuram?",
            profile=self.valid_profile,
            language="en",
        )
        res = chat.chat_sync_service(req)
        self.assertFalse(res.is_medical_refusal)
        self.assertGreater(len(res.reply), 20)

    def test_chat_sync_service_emergency_intercept(self):
        req = ChatRequest(
            message="I am coughing up blood and have severe chest tightness",
            profile=self.valid_profile,
            language="en",
        )
        res = chat.chat_sync_service(req)
        self.assertTrue(res.is_medical_refusal)
        self.assertIn("112", res.reply)

    def test_chat_sync_service_child_simplification(self):
        req = ChatRequest(
            message="Why does the air smell like smoke today?",
            profile=self.valid_profile,
            language="en",
            simplify_for_child=True,
        )
        res = chat.chat_sync_service(req)
        self.assertFalse(res.is_medical_refusal)
        self.assertGreater(len(res.reply), 20)

    def test_air_rate_limiter_integrated(self):
        for _ in range(5):
            air.air_rate_limiter.enforce(self.req)
        self.assertTrue(air.air_rate_limiter.check(self.req))

    def test_chat_rate_limiter_integrated(self):
        for _ in range(5):
            chat.chat_rate_limiter.enforce(self.req)
        self.assertTrue(chat.chat_rate_limiter.check(self.req))

    def test_chat_request_validation(self):
        req = ChatRequest(
            message="What is the air quality today?",
            profile=self.valid_profile,
            language="hi",
            simplify_for_child=False,
        )
        self.assertEqual(req.language, "hi")
        self.assertFalse(req.simplify_for_child)

    def test_chat_sync_response_contract(self):
        citation = CitationItem(
            id="cpcb_naqi",
            title="National Air Quality Index Guidelines",
            publisher="Central Pollution Control Board",
        )
        resp = ChatSyncResponse(
            reply="Air quality is severe today in Ghaziabad.",
            is_medical_refusal=False,
            citations=[citation],
            language="en",
        )
        self.assertEqual(resp.language, "en")
        self.assertEqual(len(resp.citations), 1)
        self.assertEqual(resp.citations[0].id, "cpcb_naqi")

    def test_plan_and_simulate_disclaimers_present(self):
        self.assertIn("Berkeley Earth", plan.DISCLAIMER_CIGS)
        self.assertIn("Berkeley Earth", simulate.DISCLAIMER_CIGS)

    def test_request_body_size_middleware_properties(self):
        dummy_app = lambda s, r, send: None  # noqa: E731
        mw = RequestBodyLimitMiddleware(dummy_app, max_bytes=65536)
        self.assertEqual(mw.max_bytes, 65536)
        self.assertEqual(mw.app, dummy_app)

    def test_security_headers_middleware_properties(self):
        dummy_app = lambda s, r, send: None  # noqa: E731
        mw = SecurityHeadersMiddleware(dummy_app)
        self.assertEqual(mw.app, dummy_app)

    def test_cooking_emissions_avoided(self):
        from engine.sustainability import calculate_cooking_emissions_avoided

        res = calculate_cooking_emissions_avoided(
            "biomass", "induction", meals_per_day=3, community_multiplier=10
        )
        self.assertGreater(res.pm25_avoided_grams, 0)
        self.assertGreater(res.co2e_avoided_kg, 0)
        self.assertIn("प्रतिदिन", res.description_hi)
        self.assertIn("दररोज", res.description_mr)

    def test_air_service_distant_city_fallback(self):
        from services.air_service import get_air_quality_sync

        # Pune with force_fallback=True triggers regional sample fallback banner & multilingual text
        res = get_air_quality_sync(18.5204, 73.8567, "Pune", force_fallback=True)
        self.assertEqual(res.city, "Pune")
        self.assertTrue(res.is_sample_or_fallback)
        self.assertIn("OFFLINE SAMPLE REFERENCE", res.fallback_banner_text)
        self.assertIn("Pune", res.one_sentence_verdict_en)
        self.assertIn("Pune", res.one_sentence_verdict_mr)

    def test_search_city_geocoding_aliases_and_boundaries(self):
        from services.air_service import search_city_geocoding_sync

        for alias in ["Calcutta", "Bombay", "Bangalore", "Madras", "Gurgaon", "Allahabad"]:
            res = search_city_geocoding_sync(alias)
            self.assertTrue(len(res.results) > 0, f"Failed for alias {alias}")
            self.assertEqual(res.results[0].country, "India")

        # Unknown city
        res_empty = search_city_geocoding_sync("NonExistentCityXYZ789")
        self.assertEqual(res_empty.results, [])

        # Whitespace handling
        res_ws = search_city_geocoding_sync("   delhi   ")
        self.assertTrue(len(res_ws.results) > 0)
        self.assertEqual(res_ws.results[0].name, "Delhi")

    def test_reverse_geocode_sync_distant_and_exact(self):
        from services.air_service import reverse_geocode_sync

        # Coordinates far off in the Indian Ocean
        res_ocean = reverse_geocode_sync(5.0, 70.0)
        self.assertTrue(
            res_ocean.display_name.startswith("Near ") or "°N" in res_ocean.display_name
        )
        self.assertEqual(res_ocean.country, "India")

        # Coordinates near Delhi
        res_near = reverse_geocode_sync(28.5, 77.1)
        self.assertTrue("Gurugram" in res_near.display_name or "Delhi" in res_near.display_name)

    def test_interventions_envelope_and_transport(self):
        from engine.interventions import run_simulation

        res = run_simulation(
            baseline_dose=150.0,
            baseline_cigs=6.8,
            selected_intervention_ids=[
                "foam_weatherstripping_tape",
                "switch_metro_commute",
                "hepa_room_purifier",
            ],
            trip_distance_km=15.0,
        )
        self.assertGreater(res.dose_reduction_ug, 0)
        self.assertGreater(res.community_200_pm25_avoided_g, 0)
        self.assertGreater(res.community_200_co2e_avoided_kg, 0)

    def test_mass_balance_edge_cases(self):
        from engine.mass_balance import calculate_indoor_concentration, calculate_required_cadr

        # c_out <= 0
        self.assertEqual(calculate_indoor_concentration(0.0), 0.0)
        # room_volume <= 0 auto-clamps to 35.0
        c1 = calculate_indoor_concentration(100.0, room_volume_m3=-10.0, cadr_m3_per_hour=100.0)
        self.assertGreater(c1, 0.0)
        # zero air exchange + zero deposition returns c_out
        c2 = calculate_indoor_concentration(100.0, custom_air_exchange=0.0, custom_k_deposition=0.0)
        self.assertEqual(c2, 100.0)
        # required cadr when target is not achievable or already satisfied
        self.assertEqual(
            calculate_required_cadr(
                target_c_in=80, c_out=90, room_volume_m3=35, envelope_type="sealed_ac"
            ),
            0.0,
        )

    def test_scheduler_validation_and_household_batch(self):
        from engine.scheduler import (
            FlexibleActivity,
            optimize_activity_schedule,
            optimize_household_day_plan,
        )

        act = FlexibleActivity(
            id="test_act",
            name_en="Test",
            name_hi="टेस्ट",
            name_mr="चाचणी",
            duration_hours=1,
            feasible_start_hour=6,
            feasible_end_hour=12,
            default_hour=7,
            activity_level="moderate",
            is_outdoor=True,
        )
        with self.assertRaises(ValueError):
            optimize_activity_schedule(act, [100.0] * 10)

        plan_res = optimize_household_day_plan([act], [100.0] * 24)
        self.assertEqual(len(plan_res), 1)

    def test_dose_zero_duration_slices(self):
        from engine.dose import calculate_daily_member_dose

        # Empty slices defaults to 24 hours
        summary = calculate_daily_member_dose("member_1", "adult", False, [])
        self.assertEqual(summary.total_inhaled_dose_ug, 0.0)
        self.assertEqual(summary.time_weighted_avg_pm25, 0.0)

    def test_idw_empty_stations_raises(self):
        from engine.idw import interpolate_idw

        with self.assertRaises(ValueError):
            interpolate_idw(28.0, 77.0, [])

    def test_grap_stage_extreme_and_low(self):
        from engine.grap import get_grap_stage

        # aqi <= 200 returns None
        self.assertIsNone(get_grap_stage(150))
        # aqi > 500 returns Stage IV
        st4 = get_grap_stage(750)
        self.assertIsNotNone(st4)
        self.assertEqual(st4.stage_number, 4)

    def test_plan_sync_custom_forecast_and_default_members(self):
        # Test custom 24h forecast
        req_custom = PlanRequest(
            profile=self.valid_profile,
            custom_forecast=[80.0] * 24,
        )
        res_custom = plan.generate_day_plan_sync(req_custom)
        self.assertEqual(len(res_custom.schedules), 3)

        # Test empty members falling back to default 3 personas
        empty_members_prof = HouseholdProfile(
            city_name="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            members=[],
        )
        res_default_members = plan.generate_day_plan_sync(PlanRequest(profile=empty_members_prof))
        self.assertEqual(len(res_default_members.member_budgets), 3)

    def test_tools_dispatch_and_validation_errors(self):
        from llm.tools import execute_tool, tool_get_day_plan

        # Unknown tool
        err_tool = execute_tool("nonexistent_tool", {})
        self.assertIn("error", err_tool)

        # Validation error on args
        err_args = execute_tool("get_air", {"lat": "invalid_latitude"})
        self.assertIn("error", err_args)

        # Day plan tool for unknown city
        dp_err = tool_get_day_plan(city="FakeCityXYZ999")
        self.assertIn("error", dp_err)

        # Day plan tool for unmonitored city
        dp_pune = tool_get_day_plan(city="Pune")
        self.assertIn("error", dp_pune)

    def test_safety_symptom_distress_and_multilingual(self):
        from llm.safety import check_medical_emergency, detect_mild_respiratory_distress

        # Negated acute symptom detected as mild distress
        self.assertTrue(
            detect_mild_respiratory_distress("I am not wheezing, but have a mild cough.")
        )
        self.assertFalse(detect_mild_respiratory_distress("The weather is pleasant."))

        # Multilingual emergency checks
        hi_em = check_medical_emergency("मेरे सीने में बहुत तेज दर्द है और सांस फूल रही है", language="hi")
        self.assertIsNotNone(hi_em)
        self.assertIn("112", hi_em)

        mr_em = check_medical_emergency("माझ्या छातीत तीव्र वेदना होत आहेत", language="mr")
        self.assertIsNotNone(mr_em)
        self.assertIn("११२", mr_em)

    def test_llm_rate_limiting_and_client_routing(self):
        from llm.client import LLMService, check_ip_rate_limit

        ip = "192.168.1.99"
        for _ in range(60):
            check_ip_rate_limit(ip)
        # 61st call must be rate limited
        self.assertFalse(check_ip_rate_limit(ip))

        # Test stream_chat_sync with rate limited IP
        svc = LLMService()
        events = list(svc.stream_chat_sync("Hello", client_ip=ip))
        self.assertEqual(events[-1]["data"]["status"], "rate_limited")

        # Test stream_chat_sync with emergency
        em_events = list(
            svc.stream_chat_sync("I have blue lips and severe chest pain", client_ip="127.0.0.2")
        )
        self.assertEqual(em_events[-1]["data"]["status"], "emergency_refusal")

    def test_traceability_extraction_helpers(self):
        from llm.traceability import extract_numbers_from_object, extract_numbers_from_text

        text = "The PM2.5 level at 10:00 is 145.5 ug/m3 with AQI 320."
        nums = extract_numbers_from_text(text)
        self.assertIn("145.5", nums)
        self.assertIn("320", nums)

        obj = {"aqi": 350, "coords": [28.6, 77.4], "meta": {"reading": 42.0}}
        obj_nums = extract_numbers_from_object(obj)
        self.assertIn("350", obj_nums)
        self.assertIn("28.6", obj_nums)
        self.assertIn("42.0", obj_nums)

    def test_retrieval_index_empty_query_and_singleton(self):
        from retrieval.index import get_retrieval_index

        idx = get_retrieval_index()
        self.assertIsNotNone(idx)
        results = idx.search("", top_k=2)
        self.assertEqual(len(results), 2)

    def test_rate_limiter_edge_cases_and_pruning(self):
        import time

        from services.rate_limiter import SlidingWindowRateLimiter

        limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=10.0)

        # 1. Test X-Real-IP
        req_real = Request(
            {
                "type": "http",
                "method": "GET",
                "headers": [(b"x-real-ip", b"10.0.0.1")],
            }
        )
        self.assertEqual(limiter._extract_ip(req_real), "10.0.0.1")

        # 2. Test direct client host
        req_direct = Request(
            {
                "type": "http",
                "method": "GET",
                "headers": [],
                "client": ("10.0.0.2", 12345),
            }
        )
        self.assertEqual(limiter._extract_ip(req_direct), "10.0.0.2")

        # 3. Test enforce 429
        limiter.enforce(req_direct)
        limiter.enforce(req_direct)
        with self.assertRaises(HTTPException) as ctx:
            limiter.enforce(req_direct)
        self.assertEqual(ctx.exception.status_code, 429)

        # 4. Test pruning idle keys with ancient timestamp
        limiter._store["ancient_ip"] = [1.0]
        limiter._last_prune = 0.0  # Force prune trigger
        limiter._prune_idle_keys(time.time())
        self.assertNotIn("ancient_ip", limiter._store)

    def test_async_router_endpoints_via_coroutine_stepping(self):
        from routers import air, chat, community, geocode, plan, simulate
        from schemas.contracts import CommunityAdvisoryRequest, PlanRequest, SimulateRequest
        from services.air_service import reverse_geocode, search_city_geocoding

        def run_coro(coro):
            try:
                coro.send(None)
            except StopIteration as e:
                return e.value

        # Geocode async endpoints
        geo_res = run_coro(geocode.geocode_city("Delhi"))
        self.assertIsNotNone(geo_res)
        rev_res = run_coro(geocode.reverse_geocode_coords(28.6692, 77.4538))
        self.assertIsNotNone(rev_res)

        # Air async endpoint
        air_res = run_coro(
            air.get_air(self.req, lat=28.6692, lon=77.4538, city="Ghaziabad", fallback=True)
        )
        self.assertIsNotNone(air_res)

        # Community advisory async endpoint
        comm_req = CommunityAdvisoryRequest(city="Ghaziabad", latitude=28.6692, longitude=77.4538)
        comm_res = run_coro(community.generate_community_advisory(comm_req))
        self.assertIsNotNone(comm_res)

        # Plan async endpoint
        plan_res = run_coro(plan.generate_day_plan(PlanRequest(profile=self.valid_profile)))
        self.assertIsNotNone(plan_res)

        # Simulate async endpoint
        sim_req = SimulateRequest(
            profile=self.valid_profile, selected_intervention_ids=["shift_ventilation_afternoon"]
        )
        sim_res = run_coro(simulate.simulate_interventions(sim_req))
        self.assertIsNotNone(sim_res)

        # Chat async endpoint
        chat_res = run_coro(
            chat.chat_sync_endpoint(
                chat.ChatRequest(message="What is AQI?", profile=self.valid_profile), self.req
            )
        )
        self.assertIsNotNone(chat_res)

        # Air service async functions
        rg_res = run_coro(reverse_geocode(28.6692, 77.4538))
        self.assertIsNotNone(rg_res)
        sg_res = run_coro(search_city_geocoding("Delhi"))
        self.assertIsNotNone(sg_res)

    def test_air_service_cache_hits(self):
        import time

        from schemas.contracts import AirQualityResponse
        from services.air_service import _conn, _mem_air_cache, get_air_quality_sync

        dummy_resp = AirQualityResponse(
            status="ok",
            city="CachedCity",
            country="India",
            latitude=28.67,
            longitude=77.45,
            current_pm2_5=120.0,
            current_pm10=200.0,
            current_cpcb_aqi=300,
            current_aqi_band="very_poor",
            current_aqi_color="#FF0000",
            dominant_pollutant="PM2.5",
            one_sentence_verdict_en="Cached verdict",
            one_sentence_verdict_hi="कैश किया गया",
            one_sentence_verdict_mr="कॅश केलेले",
            data_as_of="2026-11-22T00:00:00Z",
            data_source="Test Memory Cache",
            is_sample_or_fallback=False,
            hourly_forecast=[],
        )

        old_offline = os.environ.get("SAANS_OFFLINE")
        old_testing = os.environ.get("SAANS_TESTING")
        try:
            os.environ["SAANS_OFFLINE"] = "0"
            os.environ["SAANS_TESTING"] = "0"

            # 1. Memory cache hit
            _mem_air_cache[(28.7, 77.5)] = (time.time(), dummy_resp)
            res_mem = get_air_quality_sync(28.67, 77.45, "CachedCity")
            self.assertEqual(res_mem.city, "CachedCity")

            # 2. SQLite cache hit
            _mem_air_cache.clear()
            _conn.execute(
                "INSERT OR REPLACE INTO air_cache (lat_rounded, lon_rounded, cached_at, payload) VALUES (?, ?, ?, ?)",
                (28.7, 77.5, int(time.time()), dummy_resp.model_dump_json()),
            )
            res_sqlite = get_air_quality_sync(28.67, 77.45, "CachedCity")
            self.assertEqual(res_sqlite.city, "CachedCity")
        finally:
            if old_offline is not None:
                os.environ["SAANS_OFFLINE"] = old_offline
            if old_testing is not None:
                os.environ["SAANS_TESTING"] = old_testing

    def test_security_headers_middleware_execution(self):
        from main import SecurityHeadersMiddleware

        def step_all(coro):
            stack = [coro]
            res = None
            while stack:
                top = stack[-1]
                try:
                    sub = top.send(res)
                    if hasattr(sub, "send"):
                        stack.append(sub)
                        res = None
                    else:
                        res = sub
                except StopIteration as e:
                    stack.pop()
                    res = e.value
            return res

        messages = []

        async def mock_send(m):
            messages.append(m)

        async def mock_app(scope, receive, send):
            await send({"type": "http.response.start", "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        mw = SecurityHeadersMiddleware(mock_app)
        # 1. Non-http scope
        step_all(mw({"type": "websocket"}, None, mock_send))
        self.assertEqual(messages[0]["headers"], [])

        # 2. HTTP scope with header injection
        messages.clear()
        step_all(mw({"type": "http"}, None, mock_send))
        self.assertTrue(len(messages) >= 1)
        resp_headers = dict(messages[0].get("headers", []))
        self.assertIn(b"x-content-type-options", resp_headers)
        self.assertIn(b"x-frame-options", resp_headers)
        self.assertIn(b"content-security-policy", resp_headers)

    def test_request_body_size_middleware_execution(self):
        from main import RequestBodyLimitMiddleware

        def step_all(coro):
            stack = [coro]
            res = None
            while stack:
                top = stack[-1]
                try:
                    sub = top.send(res)
                    if hasattr(sub, "send"):
                        stack.append(sub)
                        res = None
                    else:
                        res = sub
                except StopIteration as e:
                    stack.pop()
                    res = e.value
            return res

        messages = []

        async def mock_send(m):
            messages.append(m)

        async def mock_app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})

        mw = RequestBodyLimitMiddleware(mock_app, max_bytes=100)

        # 1. Non-http scope
        step_all(mw({"type": "websocket"}, None, mock_send))

        # 2. Normal body size
        step_all(mw({"type": "http", "headers": [(b"content-length", b"50")]}, None, mock_send))

        # 3. Oversize body (> 100 bytes) -> 413
        oversize_msgs = []

        async def mock_send_oversize(m):
            oversize_msgs.append(m)

        step_all(
            mw(
                {"type": "http", "headers": [(b"content-length", b"500000")]},
                None,
                mock_send_oversize,
            )
        )
        self.assertEqual(oversize_msgs[0]["status"], 413)

    def test_lifespan_context_manager(self):
        from main import app, lifespan

        def step_all(coro):
            stack = [coro]
            res = None
            while stack:
                top = stack[-1]
                try:
                    sub = top.send(res)
                    if hasattr(sub, "send"):
                        stack.append(sub)
                        res = None
                    else:
                        res = sub
                except StopIteration as e:
                    stack.pop()
                    res = e.value
            return res

        cm = lifespan(app)
        step_all(cm.__aenter__())
        step_all(cm.__aexit__(None, None, None))

    def test_chat_stream_endpoint_async(self):
        from routers import chat

        def step_all(coro):
            stack = [coro]
            res = None
            while stack:
                top = stack[-1]
                try:
                    sub = top.send(res)
                    if hasattr(sub, "send"):
                        stack.append(sub)
                        res = None
                    else:
                        res = sub
                except StopIteration as e:
                    stack.pop()
                    res = e.value
            return res

        req = chat.ChatRequest(message="What is the air quality?", profile=self.valid_profile)
        resp = step_all(chat.chat_stream_endpoint(req, self.req))
        self.assertEqual(resp.media_type, "text/event-stream")

    def test_safety_negated_wheezing_with_punctuation(self):
        from llm.safety import detect_mild_respiratory_distress

        # Punctuation prefix and negated acute wheezing (covers line 105 and 167-168)
        self.assertTrue(
            detect_mild_respiratory_distress("Yesterday was fine. But I am not wheezing today.")
        )

    def test_retrieval_index_path_resolution_fallback(self):
        from pathlib import Path

        from retrieval.index import BM25Index

        # Passing relative path triggers candidates search (lines 77-85)
        idx = BM25Index(corpus_path=Path("non_existent_relative_dir/chunks.json"))
        self.assertTrue(len(idx.chunks) > 0)

    def test_plan_short_forecast_padding(self):
        from unittest.mock import patch

        from schemas.contracts import HourlyAirPoint

        short_points = [
            HourlyAirPoint(
                hour=0,
                time_iso="2026-11-22T00:00:00Z",
                pm2_5=150.0,
                cpcb_aqi=320,
                aqi_band_code="very_poor",
                aqi_band_name="Very Poor",
                aqi_color_hex="#FF0000",
                health_statement_en="Alert",
                health_statement_hi="चेतावनी",
                health_statement_mr="इशारा",
            )
        ]
        dummy_air = air.get_air_sync()
        dummy_air.hourly_forecast = short_points

        with patch("routers.plan.get_air_quality_sync", return_value=dummy_air):
            res = plan.generate_day_plan_sync(PlanRequest(profile=self.valid_profile))
            self.assertEqual(len(res.schedules), 3)


if __name__ == "__main__":
    unittest.main()
