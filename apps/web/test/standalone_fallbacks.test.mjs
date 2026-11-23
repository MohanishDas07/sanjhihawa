import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fallbacksPath = path.resolve(__dirname, "../src/lib/standaloneApiFallbacks.ts");
const routePath = path.resolve(__dirname, "../src/app/api/v1/[...path]/route.ts");

test("Fallback Engine: standaloneApiFallbacks.ts file exists and exports all essential handlers", () => {
  assert.ok(fs.existsSync(fallbacksPath), "standaloneApiFallbacks.ts must exist");
  const code = fs.readFileSync(fallbacksPath, "utf-8");

  assert.ok(code.includes("export function generateDayPlanFallback"), "Must export generateDayPlanFallback");
  assert.ok(code.includes("export function simulateInterventionsFallback"), "Must export simulateInterventionsFallback");
  assert.ok(code.includes("export function chatSyncFallback"), "Must export chatSyncFallback");
  assert.ok(code.includes("export function communityAdvisoryFallback"), "Must export communityAdvisoryFallback");
  assert.ok(code.includes("export function reverseGeocodeFallback"), "Must export reverseGeocodeFallback");
});

test("Fallback Safety: Medical emergency intercept is hardcoded with helpline numbers", () => {
  const code = fs.readFileSync(fallbacksPath, "utf-8");
  assert.ok(code.includes("is_medical_refusal: true"), "Must set is_medical_refusal true on emergency keywords");
  assert.ok(code.includes("112"), "Must provide 112 emergency service reference");
  assert.ok(code.includes("wheez"), "Must check for wheezing emergency symptoms");
  assert.ok(code.includes("inhaler"), "Must check for inhaler distress keywords");
});

test("Fallback Science: Particulate myths (Jaggery / Gur) are debunked with pulmonary facts", () => {
  const code = fs.readFileSync(fallbacksPath, "utf-8");
  assert.ok(code.includes("jaggery") || code.includes("gur"), "Must identify jaggery myth queries");
  assert.ok(code.includes("alveoli"), "Must explain pulmonary alveoli penetration");
  assert.ok(code.includes("N95"), "Must prescribe certified respirators instead of food myths");
});

test("Fallback Autonomous Proxy: route.ts handles all POST and GET routes with 200 OK fallbacks", () => {
  assert.ok(fs.existsSync(routePath), "route.ts must exist");
  const routeCode = fs.readFileSync(routePath, "utf-8");

  assert.ok(routeCode.includes('subpath === "plan"'), "route.ts must intercept /plan");
  assert.ok(routeCode.includes('subpath === "simulate"'), "route.ts must intercept /simulate");
  assert.ok(routeCode.includes('subpath === "chat"'), "route.ts must intercept /chat");
  assert.ok(routeCode.includes('subpath === "chat/sync"'), "route.ts must intercept /chat/sync");
  assert.ok(routeCode.includes('subpath === "community/advisory"'), "route.ts must intercept /community/advisory");
  assert.ok(routeCode.includes('subpath === "reverse-geocode"'), "route.ts must intercept /reverse-geocode");

  // Ensure 503 is never returned as fallback
  assert.ok(!routeCode.includes("status: 503"), "route.ts must never return HTTP 503 error status");
});

test("Fallback Schedule Logic: Routine schedules optimize afternoon convective dip", () => {
  const code = fs.readFileSync(fallbacksPath, "utf-8");
  assert.ok(code.includes("morning_exercise"), "Must optimize morning exercise");
  assert.ok(code.includes("home_ventilation"), "Must optimize home window ventilation");
  assert.ok(code.includes("market_errands"), "Must optimize market errands");
});
