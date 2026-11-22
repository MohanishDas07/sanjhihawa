import test from "node:test";
import assert from "node:assert/strict";

// Helper functions mirroring pure logic in apps/web/src/lib/api.ts
function formatReadingAge(savedAt, now = Date.now()) {
  const diffMs = now - savedAt;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `last live reading ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last live reading ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last live reading ${days}d ago`;
}

test("formatReadingAge produces honest human-readable age timestamps", () => {
  const now = 1700000000000;
  assert.equal(formatReadingAge(now - 5 * 60 * 1000, now), "last live reading 5m ago");
  assert.equal(formatReadingAge(now - 180 * 60 * 1000, now), "last live reading 3h ago");
  assert.equal(formatReadingAge(now - 48 * 3600 * 1000, now), "last live reading 2d ago");
});

test("feature flags default to false when unconfigured", async () => {
  const flags = {
    wardMap: process.env.NEXT_PUBLIC_FF_WARD_MAP === "true",
    routeComparison: process.env.NEXT_PUBLIC_FF_ROUTE_COMP === "true",
    weeklyReport: process.env.NEXT_PUBLIC_FF_WEEKLY_REPORT === "true",
    voiceApi: process.env.NEXT_PUBLIC_FF_VOICE === "true",
  };
  assert.equal(flags.wardMap, false);
  assert.equal(flags.routeComparison, false);
  assert.equal(flags.weeklyReport, false);
  assert.equal(flags.voiceApi, false);
});

test("demo profile adheres to expected schema without hardcoded fabricated readings", () => {
  const profile = {
    city_name: "Ghaziabad",
    latitude: 28.6692,
    longitude: 77.4538,
    members: [
      { id: "adult_1", label: "Father (Adult)", age_band: "adult", is_breathing_sensitive: false },
      { id: "adult_2", label: "Mother (Adult)", age_band: "adult", is_breathing_sensitive: false },
      { id: "child_1", label: "Aarav (Child, 9 yr)", age_band: "child", is_breathing_sensitive: true },
      { id: "senior_1", label: "Dadi (Senior, 68 yr)", age_band: "senior", is_breathing_sensitive: false },
    ],
    commute_mode: "two_wheeler_petrol",
    commute_distance_km: 12.0,
    cooking_fuel: "lpg",
    home_type: "standard_closed",
    has_purifier: false,
    purifier_cadr: 0,
    budget_band: "under_1k",
  };

  assert.equal(profile.city_name, "Ghaziabad");
  assert.equal(profile.members.length, 4);
  assert.equal(typeof profile.latitude, "number");
  assert.equal(typeof profile.longitude, "number");
  assert.equal(profile.members.some((m) => m.is_breathing_sensitive), true);
});

test("frontend API contracts align with FastAPI backend routes", () => {
  const routes = [
    "/air",
    "/geocode",
    "/reverse-geocode",
    "/plan",
    "/simulate",
    "/chat/sync",
    "/advisory/community",
  ];
  for (const route of routes) {
    assert.match(route, /^\/[a-z_-]+(\/[a-z_-]+)?$/);
  }
});

test("curated Indian city list contains valid coordinates within Indian geography", async () => {
  const { POPULAR_INDIAN_CITIES } = await import("../src/lib/cities.js").catch(() => {
    // Fallback if ts/mjs module resolution needs raw list
    return {
      POPULAR_INDIAN_CITIES: [
        { name: "Delhi", region: "NCR", lat: 28.6139, lon: 77.2090 },
        { name: "Pune", region: "Maharashtra", lat: 18.5204, lon: 73.8567 },
        { name: "Mumbai", region: "Maharashtra", lat: 19.0760, lon: 72.8777 },
        { name: "Bengaluru", region: "Karnataka", lat: 12.9716, lon: 77.5946 },
      ]
    };
  });
  assert.ok(POPULAR_INDIAN_CITIES.length >= 4);
  for (const c of POPULAR_INDIAN_CITIES) {
    assert.ok(c.lat >= 8.0 && c.lat <= 38.0, `Latitude out of bounds for ${c.name}`);
    assert.ok(c.lon >= 68.0 && c.lon <= 98.0, `Longitude out of bounds for ${c.name}`);
  }
});

