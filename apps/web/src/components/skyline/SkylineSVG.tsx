"use client";

import React from "react";
import Image from "next/image";

interface SkylineSVGProps {
  pm25?: number | null;
  sourceLabel?: string;
  cityName?: string;
  lang?: "en" | "hi" | "mr";
}

const CITY_SMOG_ASSETS: Record<string, { image: string; landmark: string; basin: string }> = {
  delhi: {
    image: "/images/smog_delhi.jpg",
    landmark: "Delhi NCR • Rajpath & Kartavya Path Inversion",
    basin: "Indo-Gangetic Plain",
  },
  ghaziabad: {
    image: "/images/smog_delhi.jpg",
    landmark: "Ghaziabad Corridor • Industrial & Biomass Inversion",
    basin: "NCR Western UP Belt",
  },
  kolkata: {
    image: "/images/smog_kolkata.jpg",
    landmark: "Kolkata Riverfront • Hooghly River & Howrah Basin",
    basin: "Lower Gangetic Basin",
  },
  mumbai: {
    image: "/images/smog_mumbai.jpg",
    landmark: "Mumbai Coastal • Bandra-Worli Marine Inversion Layer",
    basin: "Western Coastal Corridor",
  },
  lucknow: {
    image: "/images/smog_lucknow.jpg",
    landmark: "Lucknow Corridor • Gomti Basin Nocturnal Radiative Inversion",
    basin: "Central Gangetic Plain",
  },
  bengaluru: {
    image: "/images/smog_bengaluru.jpg",
    landmark: "Bengaluru Tech Corridor • Deccan Plateau Morning Haze",
    basin: "Southern Deccan Plateau",
  },
  bangalore: {
    image: "/images/smog_bengaluru.jpg",
    landmark: "Bengaluru Tech Corridor • Deccan Plateau Morning Haze",
    basin: "Southern Deccan Plateau",
  },
  hyderabad: {
    image: "/images/smog_hyderabad.jpg",
    landmark: "Hyderabad Corridor • Hussain Sagar & HITEC City Inversion",
    basin: "Telangana Plateau",
  },
};

function resolveCityAsset(cityName?: string) {
  if (!cityName) return { image: "/images/realistic_smog_skyline.jpg", landmark: "Metropolitan Corridor • Winter Smog Record", basin: "Urban Basin" };
  const lower = cityName.toLowerCase().trim();
  for (const [key, val] of Object.entries(CITY_SMOG_ASSETS)) {
    if (lower.includes(key)) return val;
  }
  return {
    image: "/images/realistic_smog_skyline.jpg",
    landmark: `${cityName} • Winter Atmospheric Inversion`,
    basin: "Atmospheric Boundary Layer",
  };
}

/**
 * Signature SAANS City Skyline Element (Realistic Atmospheric Smog View).
 * 
 * Features:
 * - High-resolution realistic photograph of Indian city skyline dynamically matched to selected city.
 * - Distant and midground buildings are obscured silhouettes dissolving into thick particulate haze.
 * - Dynamic physical atmospheric smog density overlay adjusts opacity and diffusion with actual PM2.5 readings.
 * - Accessible visual range and PM2.5 measurement badge in bottom-right corner.
 */
export const SkylineSVG: React.FC<SkylineSVGProps> = ({ pm25, sourceLabel, cityName, lang = "en" }) => {
  const hasReading = typeof pm25 === "number" && !isNaN(pm25) && pm25 >= 0;
  const cityAsset = resolveCityAsset(cityName);

  // Extinction coefficient and visual range (Koschmieder relationship)
  const alpha = 0.004; // 4 m2/g mass extinction assumption (TODO-VERIFY)
  const bClean = 0.015;
  const bExt = hasReading ? alpha * pm25 + bClean : 0.02;

  const visualRangeKm = 3.912 / bExt;
  const formattedVisibility =
    visualRangeKm < 1.0
      ? `~${Math.max(150, Math.round(visualRangeKm * 1000))} m`
      : `~${visualRangeKm.toFixed(1)} km`;

  // Dynamic realistic smog overlay parameters
  // High PM2.5 (e.g. 400+ µg/m³) thickens the particulate veil and blurs distant outlines
  const smogOverlayOpacity = hasReading
    ? Math.min(0.72, Math.max(0.12, (pm25 / 500) * 0.72))
    : 0.28;
  const smogBlurPx = hasReading ? Math.min(2.5, Math.max(0, (pm25 - 60) / 160)) : 0.6;

  return (
    <div
      role="region"
      aria-label="Atmospheric Skyline & Visibility Simulation"
      className="relative w-full h-72 sm:h-80 md:h-[380px] lg:h-[440px] overflow-hidden bg-[var(--skyline-bg)] border-b hairline border-rule select-none"
    >
      {/* Live Region for Screen Readers */}
      <div aria-live="polite" className="sr-only">
        {hasReading
          ? `Estimated atmospheric visibility: ${formattedVisibility} under ${pm25} micrograms per cubic meter PM2.5 in ${cityName || "city"}. Buildings heavily obscured by smog.`
          : "Atmospheric skyline: No air reading currently loaded."}
      </div>

      {/* Realistic Documentary Photograph */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Authentic High-Res Smog Skyline Photograph (Next.js Optimized) */}
        <Image
          src={cityAsset.image}
          alt={
            hasReading
              ? `Real photograph of ${cityAsset.landmark} heavily enveloped in winter smog at ${pm25} µg/m³ PM2.5, buildings obscured by haze.`
              : `Real photograph of ${cityAsset.landmark} shrouded in winter smog.`
          }
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          className="object-cover object-bottom transition-all duration-700"
          style={{
            filter: `contrast(${1 - smogOverlayOpacity * 0.3}) brightness(${
              1 - smogOverlayOpacity * 0.15
            }) blur(${smogBlurPx * 0.4}px)`,
          }}
        />

        {/* Dynamic Physical Atmospheric Smog Attenuation Overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            backgroundColor: "rgba(202, 192, 175, 0.95)",
            opacity: smogOverlayOpacity,
            mixBlendMode: "screen",
          }}
        />

        {/* Gritty Particulate Vignette & Horizon Smog Gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(184, 172, 152, 0.35) 0%, rgba(200, 190, 172, 0.2) 50%, rgba(30, 28, 26, 0.65) 100%)",
          }}
        />
      </div>

      {/* Top Left Documentary Record Tag */}
      <div className="absolute top-3 left-3 z-10 font-mono text-2xs md:text-xs px-3 py-1.5 bg-ink/85 text-paper backdrop-blur-xs border border-paper/20 shadow-sm flex items-center space-x-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-semibold uppercase tracking-wider">{cityAsset.landmark}</span>
        <span className="text-paper/70 hidden sm:inline">• {cityAsset.basin}</span>
      </div>

      {/* Visibility / Air Measurement Banner (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-10 font-mono text-xs md:text-sm px-3.5 py-2 bg-paper/95 backdrop-blur-sm border border-rule text-ink shadow-sm max-w-md">
        {hasReading ? (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            <span className="font-semibold">
              {lang === "hi" ? "दृश्यता" : lang === "mr" ? "दृश्यमानता" : "Visibility"} {formattedVisibility}
            </span>
            <span className="text-ink-muted">({pm25} µg/m³ PM2.5)</span>
            <span className="text-ink-muted hidden sm:inline">
              • {lang === "hi" ? "मॉडल अनुमानित" : lang === "mr" ? "मॉडेल अंदाज" : "Modelled Estimate"}
            </span>
          </div>
        ) : (
          <span className="text-ink-muted font-sans italic text-xs">
            {lang === "hi"
              ? "कोई रीडिंग उपलब्ध नहीं • भारतीय शहर खोजें या राष्ट्रीय गलियारा चुनें"
              : lang === "mr"
              ? "कोणतेही रीडिंग उपलब्ध नाही • शहर शोधा किंवा प्रादेशिक कॉरिडोअर निवडा"
              : "No air reading loaded • Search any Indian city or select a regional corridor"}
          </span>
        )}
      </div>
    </div>
  );
};
