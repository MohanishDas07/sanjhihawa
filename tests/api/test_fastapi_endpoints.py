"""
FastAPI Architecture, Middleware, and Router Contract Test Suite.
Validates pure ASGI middleware configurations, rate limiters,
geocode sync helpers, and router data contracts.
"""

import os
import sys
import unittest

os.environ["SAANS_OFFLINE"] = "1"

_api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/api"))
if _api_dir not in sys.path:
    sys.path.insert(0, _api_dir)

from main import RequestBodyLimitMiddleware, SecurityHeadersMiddleware  # noqa: E402
from routers import air, chat, geocode, health, plan, simulate  # noqa: E402
from routers.chat import ChatRequest, ChatSyncResponse, CitationItem  # noqa: E402
from schemas.contracts import (  # noqa: E402
    FamilyMember,
    HouseholdProfile,
)
from starlette.requests import Request  # noqa: E402


class TestFastAPIRouterArchitecture(unittest.TestCase):
    def setUp(self):
        self.req = Request({
            "type": "http",
            "method": "GET",
            "headers": [(b"x-forwarded-for", b"127.0.0.1")],
            "client": ("127.0.0.1", 54321),
            "query_string": b"",
        })

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

    def test_air_rate_limiter_integrated(self):
        for _ in range(5):
            air.air_rate_limiter.enforce(self.req)
        self.assertTrue(air.air_rate_limiter.check(self.req))

    def test_chat_rate_limiter_integrated(self):
        for _ in range(5):
            chat.chat_rate_limiter.enforce(self.req)
        self.assertTrue(chat.chat_rate_limiter.check(self.req))

    def test_chat_request_validation(self):
        profile = HouseholdProfile(
            city_name="Ghaziabad",
            latitude=28.6692,
            longitude=77.4538,
            members=[FamilyMember(id="m1", label="Adult", age_band="adult", is_breathing_sensitive=False)],
        )
        req = ChatRequest(
            message="What is the air quality today?",
            profile=profile,
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


if __name__ == "__main__":
    unittest.main()
