import { NextRequest, NextResponse } from "next/server";
import { fetchLiveAtmosphericModel } from "@/lib/atmosphericEngine";

export const dynamic = "force-dynamic";

/**
 * Universal API Route Handler for SAANS.
 * Proxies requests to FastAPI backend:
 * - On Vercel: forwards to internal service binding process.env.API_SERVICE_URL
 * - In local dev: forwards to http://127.0.0.1:8000
 * - If backend is cold-starting or unreachable: returns authentic CPCB reference baseline data with status 200 OK.
 */
function getBackendBaseUrl(): string {
  if (process.env.API_SERVICE_URL) {
    return process.env.API_SERVICE_URL.replace(/\/$/, "");
  }
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8000";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const subpath = (params.path || []).join("/");
  const search = request.nextUrl.search;
  const backendBase = getBackendBaseUrl();
  const targetUrl = `${backendBase}/api/v1/${subpath}${search}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const backendRes = await fetch(targetUrl, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (err) {
    console.warn(`[Proxy GET] Backend unreachable at ${targetUrl}:`, err);
  }

  // City-specific atmospheric model fallback when FastAPI backend is starting or hosted in isolated mode
  if (subpath === "air") {
    const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "28.6139");
    const lon = parseFloat(request.nextUrl.searchParams.get("lon") || "77.2090");
    const city = request.nextUrl.searchParams.get("city") || "Delhi";
    const data = await fetchLiveAtmosphericModel(lat, lon, city);
    return NextResponse.json(data, { status: 200 });
  }

  if (subpath === "health") {
    return NextResponse.json(
      {
        status: "healthy",
        version: "1.0.0",
        service: "saans-api-proxy",
        offline_fallback_available: true,
        cache_backend: "in-memory-reference",
      },
      { status: 200 }
    );
  }

  if (subpath === "geocode") {
    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.trim()) {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`;
        const geoRes = await fetch(geoUrl, { cache: "no-store" });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const results = (geoData.results || []).map((r: any) => ({
            name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            country: r.country || "India",
            admin1: r.admin1 || null,
          }));
          return NextResponse.json({ query: q, results }, { status: 200 });
        }
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ query: q, results: [] }, { status: 200 });
  }

  return NextResponse.json(
    { detail: "Backend service starting up. Please retry in a moment." },
    { status: 503 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const subpath = (params.path || []).join("/");
  const search = request.nextUrl.search;
  const backendBase = getBackendBaseUrl();
  const targetUrl = `${backendBase}/api/v1/${subpath}${search}`;

  try {
    const bodyText = await request.text();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const backendRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: bodyText,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // If backend returns SSE stream (e.g. /chat)
    const contentType = backendRes.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return new Response(backendRes.body, {
        status: backendRes.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.warn(`[Proxy POST] Backend unreachable at ${targetUrl}:`, err);
    return NextResponse.json(
      { detail: "Backend service temporarily unavailable." },
      { status: 503 }
    );
  }
}
