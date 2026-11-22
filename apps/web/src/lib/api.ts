/**
 * Typed API Client for SAANS.
 * Communicates with FastAPI backend under /api/v1.
 * Strict Zero Fake Data Policy (Audit 2 R1):
 * - Never invents readings, coordinates, or canned replies when the server is unreachable.
 * - Throws actionable errors and supports truthful cached-reading recovery from localStorage.
 */

import {
  AirQualityResponse,
  GeocodeResponse,
  ReverseGeocodeResponse,
  PlanRequest,
  PlanResponse,
  SimulateRequest,
  SimulateResponse,
  CommunityAdvisoryRequest,
  CommunityAdvisoryResponse,
} from "@/types/api";

/**
 * Resolves the API base URL:
 * - On Vercel server-side runtime: uses the service binding URL in API_SERVICE_URL (or API_URL) + "/api/v1"
 * - In local development: defaults to "http://localhost:8000/api/v1"
 * - In production browser: uses relative "/api/v1" which Vercel rewrites to the FastAPI service under the same domain
 * - Can be overridden anytime via NEXT_PUBLIC_API_URL
 */
export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window === "undefined") {
    const internalUrl = process.env.API_SERVICE_URL || process.env.API_URL;
    if (internalUrl) {
      return `${internalUrl.replace(/\/$/, "")}/api/v1`;
    }
    return "http://localhost:8000/api/v1";
  }
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:8000/api/v1";
  }
  return "/api/v1";
}

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          detail = errJson.detail;
        }
      } catch {
        // use default statusText
      }
      throw new Error(`API error ${res.status}: ${detail}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`Fetch failed for ${url}:`, err);
    throw err;
  }
}

export interface CachedAirData {
  data: AirQualityResponse;
  savedAt: number;
}

/**
 * Retrieve the last known real reading from localStorage with timestamp.
 * Returns null if no cached reading is available.
 */
export function getLastCachedAir(city?: string): CachedAirData | null {
  if (typeof window === "undefined") return null;
  try {
    const key = city ? `saans_last_air_${city.trim().toLowerCase()}` : "saans_last_air";
    const raw = localStorage.getItem(key) || (!city ? null : localStorage.getItem("saans_last_air"));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && typeof parsed.savedAt === "number") {
      return parsed as CachedAirData;
    }
  } catch {
    // ignore json parse error
  }
  return null;
}

/**
 * Format reading age for transparent display (e.g., "last live reading 3 h ago").
 */
export function formatReadingAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `last live reading ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last live reading ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last live reading ${days}d ago`;
}

/**
 * Fetch air quality for given coordinates and city name.
 * On success, caches valid live data into localStorage for offline resilience.
 * On failure, throws cleanly instead of fabricating data.
 */
export async function fetchAirQuality(
  lat: number,
  lon: number,
  city: string = "Ghaziabad",
  fallback: boolean = false
): Promise<AirQualityResponse> {
  const data = await fetchJSON<AirQualityResponse>(
    `/air?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}&fallback=${fallback}`
  );

  // If valid reading arrived, cache it for offline resilience
  if (typeof window !== "undefined" && data && data.status !== "no_data" && !data.is_sample_or_fallback) {
    try {
      const cacheObj: CachedAirData = { data, savedAt: Date.now() };
      localStorage.setItem("saans_last_air", JSON.stringify(cacheObj));
      if (city) {
        localStorage.setItem(`saans_last_air_${city.trim().toLowerCase()}`, JSON.stringify(cacheObj));
      }
    } catch {
      // ignore storage quota errors
    }
  }

  return data;
}

/**
 * Query Open-Meteo geocoding via API.
 * Never fabricates cities. Returns empty result if unreachable or unmatched.
 */
export async function searchCities(q: string): Promise<GeocodeResponse> {
  if (!q || !q.trim()) {
    return { query: q, results: [] };
  }
  try {
    return await fetchJSON<GeocodeResponse>(`/geocode?q=${encodeURIComponent(q.trim())}`);
  } catch (err) {
    console.warn("Geocoding failed; returning empty list without substitution", err);
    return { query: q, results: [] };
  }
}

/**
 * Reverse geocode GPS coordinates to nearest indexed canonical Indian city.
 * Provides instant fallback without remote vendor lock-in.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResponse> {
  return await fetchJSON<ReverseGeocodeResponse>(`/reverse-geocode?lat=${lat}&lon=${lon}`);
}

/**
 * Calculate personalized daily schedule and member breath budgets.
 * Throws on API error without inventing schedules.
 */
export async function generateDayPlan(req: PlanRequest): Promise<PlanResponse> {
  return await fetchJSON<PlanResponse>("/plan", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Simulate exposure and cost interventions.
 * Throws on API error without inventing baseline doses.
 */
export async function simulateInterventions(req: SimulateRequest): Promise<SimulateResponse> {
  return await fetchJSON<SimulateResponse>("/simulate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export interface ChatCitation {
  id: string;
  title: string;
  publisher: string;
}

export interface ChatSyncResponse {
  reply: string;
  is_medical_refusal: boolean;
  citations: ChatCitation[];
  language: string;
}

/**
 * Synchronous chat query to the assistant.
 * Strictly communicates with backend; never synthesizes client-side mock answers.
 */
export async function sendChatSync(
  message: string,
  profile?: any,
  language: "en" | "hi" | "mr" = "en",
  simplifyForChild: boolean = false
): Promise<ChatSyncResponse> {
  return await fetchJSON<ChatSyncResponse>("/chat/sync", {
    method: "POST",
    body: JSON.stringify({
      message,
      profile,
      language,
      simplify_for_child: simplifyForChild,
    }),
  });
}

export async function fetchCommunityAdvisory(
  req: CommunityAdvisoryRequest
): Promise<CommunityAdvisoryResponse> {
  return await fetchJSON<CommunityAdvisoryResponse>("/community/advisory", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
