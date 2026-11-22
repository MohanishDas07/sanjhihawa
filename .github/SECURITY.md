# Security Policy & Enterprise Threat Model

## 1. Overview
SanjhiHawa (Saans) is an institutional atmospheric intelligence and clean air decision engine. Security, privacy, and architectural resilience are built into the foundational design.

---

## 2. Privacy by Design: Local-First Zero Server Persistence
- **Zero Personal Health Storage:** User profiles, breathing sensitivity flags, household demographics, and commute routes are never persisted on the server, never written to a remote database, and never tracked.
- **Client-Side Persistence:** Household parameters are stored exclusively in the user's browser `localStorage` under `saans_household`.
- **Ephemeral Computation:** API calculations (inhaled dose microgram metrics, purifier CADR balance, what-if simulations) operate via transient, stateless in-memory requests that leave zero trace upon response return.

---

## 3. Defense-in-Depth Ingress Protection
1. **Sliding-Window Rate Limiting:**
   - Enforced by `SlidingWindowRateLimiter` on `/api/v1/chat` and `/api/v1/chat/sync` (max 60 requests per minute per IP).
   - Extracts genuine client IP via `X-Forwarded-For` and `X-Real-IP` behind reverse proxies.
   - Automatic background eviction of idle IP records to prevent memory leak attacks.
2. **Strict CORS Whitelist:**
   - Permitted origins are strictly restricted via `ALLOWED_ORIGINS` environment variables (defaulting to authorized local and production frontends).
3. **Payload Clamping Middleware:**
   - Pure ASGI `RequestBodyLimitMiddleware` rejects incoming payloads exceeding 64 KB with HTTP 413, mitigating payload flooding and buffer attacks.
4. **Enterprise HTTP Security Headers:**
   - `Content-Security-Policy`: Restricts scripts to self, fonts to Google Fonts / self, frame-ancestors to none.
   - `Strict-Transport-Security` (HSTS): `max-age=63072000; includeSubDomains; preload`.
   - `X-Content-Type-Options: nosniff`.
   - `X-Frame-Options: DENY`.
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.

---

## 4. Responsible Disclosure
If you discover a potential security vulnerability, please submit an issue or contact the maintainers directly. Vulnerabilities will be triaged within 24 hours.
