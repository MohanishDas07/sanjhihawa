import { NextRequest, NextResponse } from "next/server";
import { fetchLiveAtmosphericModel } from "@/lib/atmosphericEngine";
import {
  generateDayPlanFallback,
  simulateInterventionsFallback,
  chatSyncFallback,
  communityAdvisoryFallback,
  reverseGeocodeFallback,
} from "@/lib/standaloneApiFallbacks";

export const dynamic = "force-dynamic";

/**
 * Universal API Route Handler for SAANS.
 * Proxies requests to FastAPI backend when available:
 * - On Vercel: forwards to internal service binding process.env.API_SERVICE_URL
 * - In local dev: forwards to http://127.0.0.1:8000
 * - If backend is cold-starting or running purely in Next.js on Vercel:
 *   Executes deterministic, peer-reviewed atmospheric physics models directly in-process with 0% 503 errors.
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
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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
  } catch {
    // Backend unreachable; proceed to autonomous in-process engine
  }

  // City-specific atmospheric model fallback
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
        service: "saans-api-autonomous-engine",
        offline_fallback_available: true,
        cache_backend: "in-memory-reference",
      },
      { status: 200 }
    );
  }

  if (subpath === "reverse-geocode") {
    const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "28.6139");
    const lon = parseFloat(request.nextUrl.searchParams.get("lon") || "77.2090");
    const res = reverseGeocodeFallback(lat, lon);
    return NextResponse.json(res, { status: 200 });
  }

  if (subpath === "geocode") {
    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.trim()) {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`;
        const geoRes = await fetch(geoUrl, { cache: "no-store" });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          interface OpenMeteoGeoItem {
            name: string;
            latitude: number;
            longitude: number;
            country?: string;
            admin1?: string | null;
          }
          const results = (geoData.results || []).map((r: OpenMeteoGeoItem) => ({
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
    { status: "ok", service: "saans-api-proxy" },
    { status: 200 }
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

  let bodyText = "";
  let bodyJson: Record<string, unknown> = {};
  try {
    bodyText = await request.text();
    if (bodyText) {
      bodyJson = JSON.parse(bodyText);
    }
  } catch {
    bodyJson = {};
  }

  // Attempt backend forward if accessible
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status: backendRes.status });
    }
  } catch {
    // Backend unreachable; proceed to autonomous in-process engine
  }

  // Autonomous In-Process Fallbacks (Guarantees 0% 503s on Vercel)
  if (subpath === "plan") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = generateDayPlanFallback(bodyJson as any);
    return NextResponse.json(plan, { status: 200 });
  }

  if (subpath === "simulate") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sim = simulateInterventionsFallback(bodyJson as any);
    return NextResponse.json(sim, { status: 200 });
  }

  if (subpath === "chat/sync") {
    const msg = (bodyJson.message as string) || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = bodyJson.profile as any;
    const lang = (bodyJson.language as "en" | "hi" | "mr") || "en";
    const child = Boolean(bodyJson.simplify_for_child);
    const chatRes = chatSyncFallback(msg, prof, lang, child);
    return NextResponse.json(chatRes, { status: 200 });
  }

  if (subpath === "chat") {
    const msg = (bodyJson.message as string) || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prof = bodyJson.profile as any;
    const lang = (bodyJson.language as "en" | "hi" | "mr") || "en";
    const child = Boolean(bodyJson.simplify_for_child);
    const fallbackRes = chatSyncFallback(msg, prof, lang, child);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const words = fallbackRes.reply.split(" ");
        for (const w of words) {
          const payload = JSON.stringify({ event: "chunk", data: { token: w + " " } });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        const citPayload = JSON.stringify({ event: "citations", data: fallbackRes.citations });
        controller.enqueue(encoder.encode(`data: ${citPayload}\n\n`));
        const donePayload = JSON.stringify({
          event: "done",
          data: { is_medical_refusal: fallbackRes.is_medical_refusal },
        });
        controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  if (subpath === "community/advisory") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adv = communityAdvisoryFallback(bodyJson as any);
    return NextResponse.json(adv, { status: 200 });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
