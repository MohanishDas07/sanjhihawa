# Saans: Audit 2 (`saans_project_1.zip`) and skyline review

## What was checked, and what was not

Checked by running or reproducing: all test suites (`python tests/test_all.py` now runs: 23 tests pass), `ruff`, the API in offline mode (chat probes, city probes, geocode, CORS and headers), the AQI cap, how a real LLM would call the tools (`execute_tool` with model-style arguments), `npm audit`, and the production build. The skyline was rendered to images in light and dark, desktop and phone sizes, before and after.

Not checked: the live Open-Meteo call (the sandbox has no route to it, so run `verify_live_data.py` locally), the UI in a real browser, Lighthouse, axe, a live LLM key, the deployed site, and coverage (not re-measured on this version).

## Verdict

Good progress. The big structural items are fixed: there is now a real LLM client with tool calling, the one-command test runner works, CI exists, CORS is configurable, AQI is capped at 500, the keyword bugs are gone, and the triage handles "breathless" and "not wheezing". What still loses trust is **fake or wrong-place data** in four spots (frontend fallback, geocode, chat tools, no-data handling) and **claims that are still ahead of the code**. Fix the P0 list below first.

## Fixed since Audit 1 (keep these)

Real OpenAI-compatible LLM client with tools and a fail-closed traceability template. `test_all.py` works. `.github/workflows/ci.yml`. `ALLOWED_ORIGINS` read from the environment. `apps/web/public` assets and a working Dockerfile copy step. AQI above 500 is capped. "Gurugram" and "figure" no longer trigger the jaggery answer. Breathless child is escalated; "not wheezing" is not. Plants figure corrected to 10 to 1,000 per m2. "Current" reading now picks the local hour. Missing hours are no longer replaced by 150. Security headers added to API and Next config.

## P0: remaining errors that match "fake data" or break the plan

**R1. The frontend still ships fake data.** `apps/web/src/lib/api.ts` hard-codes a "Ghaziabad (Offline Mode)" reading (PM2.5 410, AQI 492), a three-city geocode list, and canned chat answers that say "AQI 492" and "66.7%". These appear whenever the API is unreachable, including on any deployment where `NEXT_PUBLIC_API_URL` was not set at build time. The landing page city picker is also three hard-coded cities.
Fix: delete all of it. On failure show "Could not reach the air service. Retry", plus the last real reading from `localStorage` with its age ("last live reading 3 h ago") if one exists. Replace the city `<select>` with a search box backed by real geocoding (R2).

**R2. Geocoding returns fake results.** `GET /api/v1/geocode?q=zzzzxq nonexistent place` returns Ghaziabad, Delhi and Lucknow. Fix: call Open-Meteo's geocoding API (verify its current parameters in their docs, including the country filter), return an empty list when nothing matches, and show "No place found".

**R3. Chat tools fetch the wrong city.** `tool_get_air(city="Pune")` defaults `lat/lon` to Ghaziabad, so with a real model the answer says "Pune" and uses Ghaziabad data (reproduced: city "Pune", source "Recorded Reference: Ghaziabad Station"). Fix: require coordinates, default to the user's profile location, or geocode the city name; reject unknown cities.

**R4. The `get_day_plan` tool crashes when a model calls it.** The schema sent to the model has a `city` argument, but `tool_get_day_plan` accepts `profile_data`, so `execute_tool` raises `TypeError` (reproduced). It is not in the `except` list in `client.py`, so the chat request fails. Also `execute_tool` passes model-supplied arguments straight to the function, so a model could set `force_fallback`. Fix: validate arguments with a Pydantic model per tool, whitelist fields, and return a structured tool error to the model instead of raising.

**R5. Tool outputs contain hard-coded numbers and advice.** `tool_simulate` uses a fixed baseline (2,400 ug, 10.9 cigarettes) for everyone. `tool_get_day_plan` returns fixed strings, including "-85% inhaled particulate" for N95 and "12 PM to 3 PM" for ventilation, regardless of the forecast. Fix: derive the baseline from the plan engine for the user's profile and hourly data; derive window advice from the forecast; read mask efficiency from the config constants with a source note.

**R6. The live LLM path blocks the server and ignores the profile.** `_stream_live_provider` uses a synchronous `httpx.Client` (up to 15 s, twice per request) inside an async endpoint, so one slow reply stalls everyone. It also accepts `profile_data` but never uses it, so answers are not tailored to the household, and the "stream" is the full answer split into words. Fix: `httpx.AsyncClient`, pass profile and coordinates to the tools, and stream properly or label it as non-streaming.

**R7. Scripted mode is mislabelled.** With no key, the UI says "Grounded Engine (Deterministic Mode)... verified engine fixtures with zero math hallucination" and the chat page says "The LLM never hallucinates numbers." The default mode is a keyword script with no language model. Fix: label it "Scripted demo assistant (no language model connected)" and only show the "grounded" wording when a model is live and the guard passed.

**R8. No-data cases still show another city's number as an "estimate".** `/air` for Pune coordinates returns "Nearest regional reference station is Delhi (1173 km away, estimated AQI 486)", and the plan and Breath Budget are then computed from it. Fix: return `status: "no_data"`; the UI shows "No reading for <place>" and disables the plan; recorded fixtures are only shown when the user presses an explicit "Use recorded demo day" button.

**R9. The live path still has invented defaults.** If there are no points, the response uses AQI 150, PM2.5 80 and PM10 120. Missing hours are forward-filled without telling the user. `data_as_of` is the fetch time, not the model run time. Fix: return no-data in that case, mark any filled hour, and say "fetched at" instead of "as of".

**R10. The wording over-claims what the data is.** The landing page says "Field Station Reading" and "CPCB NAQI Standard", but the data is a modelled estimate (CAMS via Open-Meteo, global grid roughly 45 km, 3-hourly source data), not a ground station. Open-Meteo's terms also require attribution to CAMS and Open-Meteo. Fix: "Modelled estimate, not a ground station", AQI labelled "estimated from hourly PM2.5", attribution in the footer. You asked for "other sites" too: today only Open-Meteo is used. Adding one ground-station source (for example OpenAQ or CPCB through data.gov.in, both need keys; verify current terms) and showing "nearest station" next to the model value would be the strongest trust signal. If there is no time, say plainly that all readings are modelled.

## P1: fix before the freeze

- **R11. CI will fail and the badges are false.** `ruff` still reports 6 errors (UP017, auto-fixable with `--fix`), so the first push goes red, while the README badge says "0 errors". The "Audit: P0 Remediated" badge is not true (R1 to R10). Badges are static images; use the real GitHub Actions badge. CI also lacks `npm audit`, coverage and any frontend test.
- **R12. Next.js 14.2.18 is unchanged.** `package.json` was not touched, so `npm audit` still shows the critical and high issues. Upgrade to a patched release and rebuild.
- **R13. Rate limiting and CSP claims are partly true.** The limiter exists only inside the chat service (SECURITY.md says "chat and air endpoints"), is in-memory, never evicts idle IPs, and keys on the connecting address (everyone shares one bucket behind a proxy). The API's CSP allows `unsafe-inline` and `unsafe-eval` and protects only JSON; the Next app, where a CSP matters, has no CSP. Microphone stays allowed with no voice feature.
- **R14. Flags and milestones.** The README lists `NEXT_PUBLIC_FF_*` flags that no code reads, and "scheduled for Saturday". Either implement the flags or remove the table and say what is not built. Stale lines remain ("20 suites", "0 errors").
- **R15. Accessibility evidence.** `aria-live` appears once (chat), five `aria-label`s total, no axe or Lighthouse run. Some AQI badge colour pairs are below 4.5:1 (good green with white text 4.2; with ink 4.3; very-poor red with ink 3.6). Add axe to CI and a text alternative for the hourly view.
- **R16. Translations.** Page content in `your-day`, `how-saans-works` and others is still mostly English-only; LOCALIZATION.md says "Verified". Only claim what someone has reviewed.
- **R17. Corpus.** Still unverified: open each URL and set real retrieval dates. The emergency citation is hard-coded in `client.py` (id `medical-triage-redlines`, MoHFW/NHM) and has no corpus entry. Use a source you have opened.
- **R18. Tests.** Re-measure coverage including the HTTP layer and the live Open-Meteo path (mock `httpx`), and add one browser test of the demo path.

## Skyline: what was wrong, and what to use

Rendered before-and-after images are in `skyline/` (`skyline_before_desktop.png`, `skyline_after.png`, `skyline_after_dark.png`).

**Problems in the old one:**
1. It fades by lightening toward the page colour, so at Severe (your default demo state) the hero is a nearly blank cream box.
2. `preserveAspectRatio="none"` stretches it: on a phone the dome becomes a pointed arch and everything is squeezed.
3. Colours are hard-coded for light mode. In dark mode the foreground vanishes and the "smog" overlay becomes a bright slab.
4. Flat grey rectangles with no detail look generic.
5. With no data it shows a made-up state: `aqi || 450` and band `"severe"`. That is fake data in the hero.
6. "Visibility: 15%" is the overlay opacity, not a measurement.

**What the new one does** (`SkylineSVG.tsx`, props: `pm25`, `sourceLabel`):
- Haze is physical: each depth layer has a fixed scene distance and transmittance `T = exp(-d x b_ext)`, with `b_ext` proportional to PM2.5. Far buildings vanish first, then mid, and the sun fades. Each layer is an opaque flat colour mixed toward a warm smog tone, so there are no gradients and nothing goes see-through.
- Scene has local meaning: a domed monument with minarets, water tanks, an industrial stack with a plume, a crane, a metro viaduct with a train (the sustainable alternative), a power pole and a bare winter tree.
- No distortion (`slice`, anchored at the bottom) and the focal elements stay inside the phone crop.
- Light and dark themes through CSS variables; dark mode shows lit windows and a moon.
- With no reading it draws a neutral placeholder and says "No air reading yet", never a guessed air quality.
- The caption states the estimated visibility, the PM2.5 behind it, the source, and "Approximate, not a measurement". The mass-extinction constant (4 m2/g) is an assumption: mark it TODO-VERIFY in `docs/ASSUMPTIONS.md` and keep the "illustrative" wording.

**To integrate:** replace `components/skyline/SkylineSVG.tsx`, add the variables from `skyline.css` inside `@layer base` in `globals.css`, and apply the small change to `app/page.tsx` (`page.tsx.patch` and `globals.css.patch` are provided). In a copy of your project this type-checks and `next build` passes. `color-mix()` needs a current browser (Chrome 111+, Safari 16.2+, Firefox 113+); older ones show unmixed layer colours. The previews were rendered outside a browser, so confirm in your own browser.

## Real-data check you must run locally

`verify_live_data.py` (provided) calls Open-Meteo's air quality and geocoding APIs for four cities and prints what came back. Run it on your machine before the demo. If it fails, fix the data layer before anything else, because every page depends on it.

## Fix order

1. R1, R2, R8, R9, R3, R4 (anything that can show wrong-place or invented data). Then R10 wording.
2. Skyline swap (15 minutes). R7, R5, R6.
3. R11 (run `ruff --fix`), R12, R14, then R13, R15 to R18 as time allows.
4. Freeze on schedule; run the live check, clone fresh, follow only the README.
