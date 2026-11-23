"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SkylineSVG } from "@/components/skyline/SkylineSVG";
import { DiurnalTimeline } from "@/components/landing/DiurnalTimeline";
import { ScientificProvenanceSection } from "@/components/landing/ScientificProvenanceSection";
import { SpatialBenchmarkGrid } from "@/components/landing/SpatialBenchmarkGrid";
import { DocumentaryGallery } from "@/components/landing/DocumentaryGallery";
import { MathematicalRigorSection } from "@/components/landing/MathematicalRigorSection";
import { CitySearchCombobox } from "@/components/location/CitySearchCombobox";
import { AerosolMetricsGrid } from "@/components/landing/AerosolMetricsGrid";
import { ScientificAuditBanner } from "@/components/landing/ScientificAuditBanner";
import { fetchAirQuality, getLastCachedAir, CachedAirData } from "@/lib/api";
import { fetchLiveAtmosphericModel } from "@/lib/atmosphericEngine";
import { AirQualityResponse, GeocodeItem } from "@/types/api";
import { useTranslation, translateCity, translateAqiBand } from "@/lib/i18n";

// Curated Major Indian Metro Corridors
const REGIONAL_METROS = [
  { name: "Delhi", lat: 28.6139, lon: 77.2090, label: "Delhi NCR" },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639, label: "Kolkata" },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777, label: "Mumbai" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, label: "Bengaluru" },
  { name: "Lucknow", lat: 26.8467, lon: 80.9462, label: "Lucknow" },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867, label: "Hyderabad" },
];

export default function LandingPage() {
  const { t, lang } = useTranslation();
  const [city, setCity] = useState<string>("Ghaziabad");
  const [lat, setLat] = useState<number>(28.6692);
  const [lon, setLon] = useState<number>(77.4538);

  const [airData, setAirData] = useState<AirQualityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setCachedInfo] = useState<CachedAirData | null>(null);

  const loadAir = async (cName: string, cLat: number, cLon: number, forceDemoFallback: boolean = false) => {
    setLoading(true);
    setCachedInfo(null);
    try {
      const data = await fetchAirQuality(cLat, cLon, cName, forceDemoFallback);
      setAirData(data);
    } catch {
      const cached = getLastCachedAir(cName);
      if (cached) {
        setCachedInfo(cached);
        setAirData(cached.data);
      } else {
        const fallbackData = await fetchLiveAtmosphericModel(cLat, cLon, cName);
        setAirData(fallbackData);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAir(city, lat, lon);
  }, [city, lat, lon]);

  const handleSelectCity = (item: GeocodeItem) => {
    setCity(item.name);
    setLat(item.latitude);
    setLon(item.longitude);
  };

  const getVerdict = () => {
    if (!airData) return "";
    if (airData.status === "no_data") {
      return `No air quality readings available for ${city} right now. No monitoring station or high-resolution model coverage within 150 km.`;
    }
    if (lang === "hi") return airData.one_sentence_verdict_hi;
    if (lang === "mr") return airData.one_sentence_verdict_mr;
    return airData.one_sentence_verdict_en;
  };

  // Diurnal cycle analysis (Hourly forecast statistics)
  const diurnalStats = useMemo(() => {
    const list = airData?.hourly_forecast || [];
    if (!list || list.length === 0) return null;

    const sortedByAqi = [...list].sort((a, b) => a.cpcb_aqi - b.cpcb_aqi);
    const lowest = sortedByAqi[0];
    const peak = sortedByAqi[sortedByAqi.length - 1];

    const afternoonHours = list.filter((p) => p.hour >= 12 && p.hour <= 16);
    const bestAfternoon = afternoonHours.length
      ? [...afternoonHours].sort((a, b) => a.cpcb_aqi - b.cpcb_aqi)[0]
      : lowest;

    const morningHours = list.filter((p) => p.hour >= 6 && p.hour <= 9);
    const worstMorning = morningHours.length
      ? [...morningHours].sort((a, b) => b.cpcb_aqi - a.cpcb_aqi)[0]
      : peak;

    const maxAqi = Math.max(...list.map((p) => p.cpcb_aqi), 100);

    return { lowest, peak, bestAfternoon, worstMorning, maxAqi, list };
  }, [airData]);

  // Current Hour in IST (UTC + 5:30)
  const currentIstHour = useMemo(() => {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    return (utcHours + 5 + Math.floor((utcMinutes + 30) / 60)) % 24;
  }, []);

  const pm25 = airData?.current_pm2_5;
  const pm10 = airData?.current_pm10;

  // Aerosol fine-to-coarse ratio: PM2.5 / PM10
  const aerosolRatio = useMemo(() => {
    if (typeof pm25 === "number" && typeof pm10 === "number" && pm10 > 0) {
      return Math.round((pm25 / pm10) * 100);
    }
    return null;
  }, [pm25, pm10]);

  // Koschmieder optical visual range
  const koschmiederKm = useMemo(() => {
    if (typeof pm25 !== "number" || pm25 < 0) return null;
    const alpha = 0.004;
    const bClean = 0.015;
    const bExt = alpha * pm25 + bClean;
    return 3.912 / bExt;
  }, [pm25]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Skyline Section */}
      <section className="bg-surface border hairline border-rule shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden" aria-label="Today's Air Overview">
        {/* Physical SVG Skyline */}
        <SkylineSVG
          pm25={airData?.status === "no_data" ? null : airData?.current_pm2_5}
          sourceLabel={airData?.data_source}
          cityName={city}
          lang={lang}
        />

        {/* Hero Air Data Panel */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Institutional Telemetry Header Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b hairline border-rule pb-6">
            <div className="space-y-3 flex-1">
              {/* Provenance & Standard Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans uppercase text-ink-muted font-semibold tracking-wider">
                <span className="px-2 py-0.5 bg-paper border border-rule font-bold text-ink">
                  {t("landing.standard_tag")}
                </span>
                <span>•</span>
                <span>{t("landing.grid_tag")}</span>
                <span>•</span>
                <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {t("landing.engine_tag")}
                </span>
              </div>

              {/* City Title + Regional Corridor Pills + Search */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-ink">
                    {translateCity(city, lang)}
                  </h1>

                  {/* Modular Geocoding City Search Combobox */}
                  <CitySearchCombobox
                    currentCity={city}
                    onSelectCity={handleSelectCity}
                  />
                </div>
              </div>

              {/* Quick Select Regional Metros */}
              <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="National Corridors">
                <span className="text-xs font-sans uppercase text-ink-muted mr-1 font-bold tracking-wider">
                  {t("landing.national_corridors")}
                </span>
                {REGIONAL_METROS.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => {
                      setCity(m.name);
                      setLat(m.lat);
                      setLon(m.lon);
                      loadAir(m.name, m.lat, m.lon, false);
                    }}
                    className={`px-3 py-1 text-xs font-sans transition-all border ${
                      city.toLowerCase() === m.name.toLowerCase()
                        ? "bg-ink text-paper border-ink font-bold shadow-xs"
                        : "bg-paper/90 hover:bg-paper border-rule text-ink font-medium hover:border-ink"
                    }`}
                  >
                    {translateCity(m.label, lang)}
                  </button>
                ))}
              </div>

              {/* One Sentence Verdict */}
              <p className="text-base md:text-lg font-sans text-ink leading-relaxed max-w-3xl pt-1">
                {loading ? "Analyzing atmospheric boundary layer..." : getVerdict()}
              </p>
            </div>

            {/* Top AQI Big Metric Block */}
            {airData?.status === "no_data" ? (
              <div className="p-4 bg-paper border border-rule text-right space-y-1 min-w-[260px]">
                <span className="block font-mono text-xs uppercase text-ink-muted">
                  Station Status
                </span>
                <span className="font-mono text-2xl font-bold text-ink">NO DATA</span>
                <p className="text-xs text-ink-muted max-w-xs">
                  No monitor or model within 150 km. Search any Indian city or select a regional corridor.
                </p>
              </div>
            ) : (
              <div className="space-y-3 min-w-[280px]">
                <div className="flex items-baseline justify-between sm:justify-end space-x-4">
                  <div className="text-left sm:text-right">
                    <span className="block font-mono text-xs uppercase tracking-wider text-ink-muted font-semibold">
                      {t("landing.aqi_title")}
                    </span>
                    <span className="block font-mono text-2xs text-ink-muted">
                      {t("landing.aqi_est")}
                    </span>
                    <span
                      className="font-mono text-6xl md:text-7xl font-extrabold tracking-tight"
                      style={{ color: airData?.current_aqi_color || "#7A0F2E" }}
                    >
                      {loading ? "--" : airData?.current_cpcb_aqi ?? "--"}
                    </span>
                  </div>

                  <div className="border-l hairline border-rule pl-4 space-y-1.5 text-left">
                    <span
                      className={`inline-block px-3 py-1 text-xs md:text-sm uppercase tracking-wider ${
                        airData?.current_aqi_band === "moderate" || airData?.current_aqi_band === "satisfactory"
                          ? "text-ink font-extrabold"
                          : "text-white font-bold"
                      }`}
                      style={{ backgroundColor: airData?.current_aqi_color || "#7A0F2E" }}
                    >
                      {airData?.current_aqi_band ? translateAqiBand(airData.current_aqi_band, lang) : translateAqiBand("moderate", lang)}
                    </span>
                    <div className="font-mono text-xs md:text-sm text-ink-muted">
                      PM2.5:{" "}
                      <strong className="text-ink font-bold">
                        {airData?.current_pm2_5 != null ? `${airData.current_pm2_5} µg/m³` : "--"}
                      </strong>
                    </div>
                    {airData?.current_pm10 != null && (
                      <div className="font-mono text-xs md:text-sm text-ink-muted">
                        PM10: <strong className="text-ink font-bold">{airData.current_pm10} µg/m³</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* CPCB Continuous Spectrum Gauge Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-2xs font-mono text-ink-muted uppercase tracking-wider">
                    <span>{t("landing.gauge_good")}</span>
                    <span>{t("landing.gauge_mod")}</span>
                    <span>{t("landing.gauge_poor")}</span>
                    <span>{t("landing.gauge_sev")}</span>
                  </div>
                  <div className="relative h-2.5 w-full bg-rule/30 rounded-full overflow-hidden flex border border-rule/50">
                    <div className="h-full bg-[#1E8E4E]" style={{ width: "10%" }} title="Good (0-50)" />
                    <div className="h-full bg-[#7FB539]" style={{ width: "10%" }} title="Satisfactory (51-100)" />
                    <div className="h-full bg-[#F2C200]" style={{ width: "20%" }} title="Moderate (101-200)" />
                    <div className="h-full bg-[#F28C28]" style={{ width: "20%" }} title="Poor (201-300)" />
                    <div className="h-full bg-[#D7263D]" style={{ width: "20%" }} title="Very Poor (301-400)" />
                    <div className="h-full bg-[#7A0F2E]" style={{ width: "20%" }} title="Severe (401-500)" />
                  </div>
                  {/* Gauge Marker Pointer */}
                  {typeof airData?.current_cpcb_aqi === "number" && (
                    <div className="relative w-full h-2">
                      <div
                        className="absolute -top-1 -translate-x-1/2 flex flex-col items-center transition-all duration-700"
                        style={{ left: `${Math.min(98, Math.max(2, (airData.current_cpcb_aqi / 500) * 100))}%` }}
                      >
                        <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-ink" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Enterprise Atmospheric Telemetry & Exposure Metrics Strip */}
          {airData && airData.status !== "no_data" && (
            <AerosolMetricsGrid
              pm25={pm25}
              pm10={pm10}
              aerosolRatio={aerosolRatio}
              koschmiederKm={koschmiederKm}
            />
          )}

          {/* Scientific Transparency & Spatial Resolution Notice */}
          <ScientificAuditBanner />

          {/* Active GRAP Notification for NCR */}
          {airData?.active_grap_stage && (
            <div className="bg-red-50 border border-red-200 p-4 text-red-950 font-sans text-sm md:text-base">
              <div className="flex items-center justify-between border-b border-red-200 pb-2 mb-2 font-mono text-xs md:text-sm font-bold uppercase">
                <span>CAQM GRAP Active: {airData.active_grap_stage.name}</span>
                <span className="px-2 py-0.5 bg-red-800 text-white text-xs font-bold">MANDATORY</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm">
                {airData.active_grap_stage.citizen_advisory.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-red-700 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t hairline border-rule">
            <div className="text-sm font-sans text-ink-muted">
              {t("landing.cta_sub")}
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto text-center px-6 py-3.5 bg-ink text-paper font-sans font-semibold text-sm md:text-base hover:opacity-90 transition-opacity border border-ink shadow-sm"
              >
                {t("landing.btn_household_budget")}
              </Link>
              <Link
                href="/your-day"
                className="w-full sm:w-auto text-center px-5 py-3.5 bg-surface hover:bg-paper font-sans font-semibold text-sm md:text-base border border-rule text-ink transition-colors"
              >
                {t("landing.btn_view_day")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 24-Hour Diurnal Inversion & Exposure Forecast Timeline */}
      <DiurnalTimeline
        city={city}
        diurnalStats={diurnalStats}
        airData={airData}
        currentIstHour={currentIstHour}
      />

      {/* Comprehensive Atmospheric Data Integrity & Scientific Provenance Section */}
      <ScientificProvenanceSection />

      {/* Field Instruments & Clean Air Toolset */}
      <SpatialBenchmarkGrid />

      {/* Real-World Documentary Evidence: Winter Smog Cities */}
      <DocumentaryGallery
        onSelectCity={(selectedCity, selectedLat, selectedLon) => {
          setCity(selectedCity);
          setLat(selectedLat);
          setLon(selectedLon);
          loadAir(selectedCity, selectedLat, selectedLon, false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Scientific Standards, Formula Provenance & Architectural Integrity */}
      <MathematicalRigorSection />
    </div>
  );
}
