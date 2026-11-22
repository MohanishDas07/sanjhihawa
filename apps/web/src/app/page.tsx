"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { SkylineSVG } from "@/components/skyline/SkylineSVG";
import { fetchAirQuality, searchCities, getLastCachedAir, formatReadingAge, CachedAirData } from "@/lib/api";
import { AirQualityResponse, GeocodeItem, HourlyAirPoint } from "@/types/api";

const REGIONAL_METROS = [
  { name: "Delhi", label: "Delhi NCR", lat: 28.6139, lon: 77.2090, region: "Indo-Gangetic Plain", inversionType: "Severe Surface Inversion" },
  { name: "Kolkata", label: "Kolkata", lat: 22.5726, lon: 88.3639, region: "Lower Gangetic Basin", inversionType: "River Moisture & Smog Trap" },
  { name: "Mumbai", label: "Mumbai", lat: 19.0760, lon: 72.8777, region: "Western Coast", inversionType: "Marine Boundary Layer" },
  { name: "Bengaluru", label: "Bengaluru", lat: 12.9716, lon: 77.5946, region: "Deccan Plateau", inversionType: "Elevation-Assisted Dispersion" },
  { name: "Lucknow", label: "Lucknow", lat: 26.8467, lon: 80.9462, region: "Central Gangetic", inversionType: "Radiative Ground Cooling" },
  { name: "Hyderabad", label: "Hyderabad", lat: 17.3850, lon: 78.4867, region: "Telangana Plateau", inversionType: "Moderate Winter Boundary" },
];

export default function LandingPage() {
  const [city, setCity] = useState<string>("Delhi");
  const [lat, setLat] = useState<number>(28.6139);
  const [lon, setLon] = useState<number>(77.2090);
  const [airData, setAirData] = useState<AirQualityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setCachedInfo] = useState<CachedAirData | null>(null);
  const [lang, setLang] = useState<"en" | "hi" | "mr">("en");
  const [selectedHourlyPoint, setSelectedHourlyPoint] = useState<HourlyAirPoint | null>(null);
  const [showResolutionDetail, setShowResolutionDetail] = useState<boolean>(false);

  // Geocoding Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = (localStorage.getItem("saans_lang") as "en" | "hi" | "mr") || "en";
    setLang(savedLang);

    const onLang = () => {
      setLang((localStorage.getItem("saans_lang") as "en" | "hi" | "mr") || "en");
    };
    window.addEventListener("saans_lang_changed", onLang);
    return () => window.removeEventListener("saans_lang_changed", onLang);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchCities(searchQuery);
        setSearchResults(res.results || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadAir = async (cName: string, cLat: number, cLon: number, forceDemoFallback: boolean = false) => {
    setLoading(true);
    setErrorMessage(null);
    setCachedInfo(null);
    setSelectedHourlyPoint(null);
    try {
      const data = await fetchAirQuality(cLat, cLon, cName, forceDemoFallback);
      setAirData(data);
    } catch {
      // Check for last cached reading from localStorage
      const cached = getLastCachedAir(cName);
      if (cached) {
        setCachedInfo(cached);
        setAirData(cached.data);
        setErrorMessage(`Could not reach the air service. Showing ${formatReadingAge(cached.savedAt)}.`);
      } else {
        setAirData(null);
        setErrorMessage("Could not reach the air service. Please check your connection and retry.");
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
    setSearchQuery("");
    setShowDropdown(false);
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

    // Filter afternoon convective window (12:00 to 16:00)
    const afternoonHours = list.filter((p) => p.hour >= 12 && p.hour <= 16);
    const bestAfternoon = afternoonHours.length
      ? [...afternoonHours].sort((a, b) => a.cpcb_aqi - b.cpcb_aqi)[0]
      : lowest;

    // Filter morning inversion window (06:00 to 09:00)
    const morningHours = list.filter((p) => p.hour >= 6 && p.hour <= 9);
    const worstMorning = morningHours.length
      ? [...morningHours].sort((a, b) => b.cpcb_aqi - a.cpcb_aqi)[0]
      : peak;

    const maxAqi = Math.max(...list.map((p) => p.cpcb_aqi), 100);

    return {
      lowest,
      peak,
      bestAfternoon,
      worstMorning,
      maxAqi,
      list,
    };
  }, [airData]);

  // Current Hour in IST
  const currentIstHour = useMemo(() => {
    const now = new Date();
    // UTC + 5:30
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    return (utcHours + 5 + Math.floor((utcMinutes + 30) / 60)) % 24;
  }, []);

  // Scientific calculation metrics
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
      {/* Service Connection Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="bg-red-50 border-l-4 border-red-600 text-red-900 p-4 font-sans text-xs md:text-sm shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <div>
            <p className="font-bold tracking-tight font-mono uppercase text-red-950">
              Connection Notice
            </p>
            <p className="mt-0.5 text-xs text-red-800">{errorMessage}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadAir(city, lat, lon)}
              className="px-3.5 py-1.5 bg-red-800 text-white font-mono text-xs hover:bg-red-900 transition-colors"
            >
              Retry Live Connection
            </button>
          </div>
        </div>
      )}

      {/* Hero Skyline Section */}
      <section className="bg-surface border hairline border-rule shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden" aria-label="Today's Air Overview">
        {/* Physical SVG Skyline */}
        <SkylineSVG
          pm25={airData?.status === "no_data" ? null : airData?.current_pm2_5}
          sourceLabel={airData?.data_source}
          cityName={city}
        />

        {/* Hero Air Data Panel */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Institutional Telemetry Header Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b hairline border-rule pb-6">
            <div className="space-y-3 flex-1">
              {/* Provenance & Standard Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans uppercase text-ink/70 font-semibold tracking-wider">
                <span className="px-2 py-0.5 bg-paper border border-rule font-bold text-ink">
                  CPCB NAQI Standard
                </span>
                <span>•</span>
                <span>CAMS Global NRT Model Grid (0.1° ≈ 11 km)</span>
                <span>•</span>
                <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Verified Deterministic Engine
                </span>
              </div>

              {/* City Title + Regional Corridor Pills + Search */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-ink">
                    {city}
                  </h1>

                  {/* Real Geocoding City Search */}
                  <div ref={searchContainerRef} className="relative">
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="Search Indian city..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                          if (searchResults.length > 0) setShowDropdown(true);
                        }}
                        className="font-mono text-xs md:text-sm px-3 py-2 border border-rule bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink w-48 md:w-56"
                      />
                      {isSearching && (
                        <span className="absolute right-2.5 font-mono text-xs text-ink-muted animate-pulse">
                          ...
                        </span>
                      )}
                    </div>

                    {/* Geocode Results Dropdown */}
                    {showDropdown && (
                      <div className="absolute left-0 top-full mt-1 w-72 bg-paper border border-rule shadow-md z-30 max-h-56 overflow-y-auto">
                        {searchResults.length > 0 ? (
                          searchResults.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectCity(item)}
                              className="w-full text-left px-3.5 py-2.5 text-xs md:text-sm font-sans hover:bg-surface border-b hairline border-rule last:border-0 flex flex-col"
                            >
                              <span className="font-semibold text-ink">{item.name}</span>
                              <span className="text-2xs font-mono text-ink-muted">
                                {item.admin1 ? `${item.admin1}, ` : ""}
                                {item.country} ({item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°)
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3.5 text-xs md:text-sm font-sans text-ink-muted">
                            No matching place found in India.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Select Regional Metros */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-sans uppercase text-ink/70 mr-1 font-bold tracking-wider">
                  National Corridors:
                </span>
                {REGIONAL_METROS.map((m) => (
                  <button
                    key={m.name}
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
                    {m.label}
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
                      CPCB AQI INDEX
                    </span>
                    <span className="block font-mono text-2xs text-ink-muted">
                      (estimated from hourly PM2.5)
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
                      {airData?.current_aqi_band ? airData.current_aqi_band.replace("_", " ") : "Moderate"}
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
                    <span>0 Good</span>
                    <span>100 Mod</span>
                    <span>250 Poor</span>
                    <span>400+ Sev</span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
              {/* Metric 1: Fine Particulates PM2.5 */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>Fine Aerosol (PM2.5)</span>
                  <span className="font-semibold text-2xs text-ink/60">Limit: 60</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {pm25 != null ? `${pm25} µg/m³` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {pm25 != null
                    ? `${Math.round((pm25 / 60) * 100)}% of India 24h limit • WHO cap: 15 µg/m³`
                    : "No particulate reading"}
                </div>
              </div>

              {/* Metric 2: Coarse Particulates PM10 */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>Coarse Dust (PM10)</span>
                  <span className="font-semibold text-2xs text-ink/60">Limit: 100</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {pm10 != null ? `${pm10} µg/m³` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {pm10 != null
                    ? `${Math.round((pm10 / 100) * 100)}% of India 24h standard`
                    : "Mechanical dust unmeasured"}
                </div>
              </div>

              {/* Metric 3: Aerosol Soot vs Dust Ratio */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>Soot/Dust Ratio</span>
                  <span className="font-semibold text-2xs text-ink/60">PM2.5/PM10</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {aerosolRatio != null ? `${aerosolRatio}%` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {aerosolRatio != null && aerosolRatio > 65
                    ? "Combustion soot & vehicle exhaust dominant"
                    : aerosolRatio != null && aerosolRatio > 40
                    ? "Mixed traffic soot and mechanical road dust"
                    : aerosolRatio != null
                    ? "Crustal windblown dust dominant"
                    : "Calculating aerosol balance"}
                </div>
              </div>

              {/* Metric 4: Optical Visual Range */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>Visual Range (Lv)</span>
                  <span className="font-semibold text-2xs text-ink/60">Koschmieder</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {koschmiederKm != null
                    ? koschmiederKm < 1.0
                      ? `~${Math.max(150, Math.round(koschmiederKm * 1000))} m`
                      : `~${koschmiederKm.toFixed(1)} km`
                    : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  Atmospheric contrast attenuation limit
                </div>
              </div>
            </div>
          )}

          {/* Scientific Transparency & Spatial Resolution Notice */}
          <div className="p-3.5 bg-paper border border-rule/90 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                <span className="font-bold text-ink uppercase tracking-wider text-xs">
                  Scientific Audit: Why Roadside Ground Monitors Differ from Regional Atmospheric Grids
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowResolutionDetail(!showResolutionDetail)}
                className="text-xs font-sans font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 text-left sm:text-right inline-flex items-center gap-1"
              >
                <span>{showResolutionDetail ? "Collapse Scientific Briefing ▲" : "Compare Spatial Scales (3m vs 11 km) ▾"}</span>
              </button>
            </div>

            {showResolutionDetail && (
              <div className="pt-2 border-t hairline border-rule/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-ink/80 animate-fadeIn">
                <div className="p-3.5 bg-surface border border-rule space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-ink uppercase tracking-wider text-2xs text-amber-900">
                    <span>1. Commercial Roadside Sensors (e.g. aqi.in)</span>
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 font-mono text-3xs font-semibold">Hyper-Local Point (~3m)</span>
                  </div>
                  <p>
                    Measures localized exhaust plumes, idling buses, and road dust 2 meters above traffic asphalt. Optical laser sensors without heated inlets are vulnerable to <strong>hygroscopic swelling</strong>, where high humidity causes microscopic water droplets to be miscounted as heavy PM2.5 particles, inflating readings by 40%–80%.
                  </p>
                </div>

                <div className="p-3.5 bg-surface border border-rule space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-ink uppercase tracking-wider text-2xs text-emerald-900">
                    <span>2. Copernicus CAMS Chemical Transport Grid (SanjhiHawa)</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-mono text-3xs font-semibold">Regional Troposphere (~11 km)</span>
                  </div>
                  <p>
                    Integrates satellite aerosol optical depth (Sentinel-5P / MODIS) with 3D numerical weather forecasting across a ~120 km² airshed. Captures true regional solar convection that dilutes background smog at midday. Both platforms apply the exact same Indian CPCB formula—the variance is in the physical spatial scale sampled.
                  </p>
                </div>
              </div>
            )}
          </div>

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
              Personalized protection calculates hourly inhaled doses, indoor filtration, and rupee efficiency.
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto text-center px-6 py-3.5 bg-ink text-paper font-sans font-semibold text-sm md:text-base hover:opacity-90 transition-opacity border border-ink shadow-sm"
              >
                Set Up Your Household's Breath Budget →
              </Link>
              <Link
                href="/your-day"
                className="w-full sm:w-auto text-center px-5 py-3.5 bg-surface hover:bg-paper font-sans font-semibold text-sm md:text-base border border-rule text-ink transition-colors"
              >
                View Your Day Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 24-Hour Diurnal Inversion & Exposure Forecast Timeline */}
      {diurnalStats && diurnalStats.list.length > 0 && (
        <section
          className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 shadow-sm"
          aria-label="24-Hour Atmospheric Inversion & Exposure Timeline"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b hairline border-rule pb-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-sans font-bold uppercase tracking-widest text-ink/60">
                <span>Boundary Layer Dynamics</span>
                <span>•</span>
                <span>Diurnal Temperature Inversion Cycle</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink mt-1 tracking-tight">
                24-Hour Diurnal Exposure Forecast for {city}
              </h2>
              <p className="text-sm md:text-base text-ink/80 mt-1 max-w-2xl leading-relaxed font-normal">
                Nighttime radiative surface cooling traps fine aerosols below 150m. Solar convection dilutes ground soot between noon and early evening.
              </p>
            </div>

            {/* Inversion Highlights */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
              <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-950 font-medium rounded-xs">
                <span className="font-bold text-emerald-800">● Safest Window: </span>
                <span className="font-semibold">
                  {diurnalStats.bestAfternoon
                    ? `${diurnalStats.bestAfternoon.hour.toString().padStart(2, "0")}:00 IST (AQI ${diurnalStats.bestAfternoon.cpcb_aqi})`
                    : "12:00 – 16:00"}
                </span>
              </div>
              <div className="px-3.5 py-1.5 bg-red-50 border border-red-300 text-red-950 font-medium rounded-xs">
                <span className="font-bold text-red-800">▲ Inversion Peak: </span>
                <span className="font-semibold">
                  {diurnalStats.worstMorning
                    ? `${diurnalStats.worstMorning.hour.toString().padStart(2, "0")}:00 IST (AQI ${diurnalStats.worstMorning.cpcb_aqi})`
                    : "06:00 – 09:00"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive 24-Hour Column Chart */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-40 pt-4 px-1 bg-paper/60 border border-rule">
              {diurnalStats.list.map((pt) => {
                const isCurrentHour = pt.hour === currentIstHour;
                const isSelected = selectedHourlyPoint?.hour === pt.hour;
                const heightPercent = Math.min(100, Math.max(14, (pt.cpcb_aqi / (diurnalStats.maxAqi || 500)) * 100));

                return (
                  <button
                    key={pt.hour}
                    type="button"
                    onClick={() => setSelectedHourlyPoint(pt)}
                    onMouseEnter={() => setSelectedHourlyPoint(pt)}
                    className={`relative w-full flex flex-col justify-end items-center group transition-all duration-150 focus:outline-none`}
                    style={{ height: "100%" }}
                    title={`${pt.hour}:00 IST - AQI ${pt.cpcb_aqi} (${pt.aqi_band_name})`}
                  >
                    {/* Hourly Bar */}
                    <div
                      className={`w-full rounded-t-xs transition-all duration-200 ${
                        isSelected ? "ring-2 ring-ink ring-offset-1" : "group-hover:opacity-85"
                      }`}
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: pt.aqi_color_hex || "#F28C28",
                      }}
                    />

                    {/* Current Hour Indicator Badge */}
                    {isCurrentHour && (
                      <span className="absolute -top-6 text-[10px] font-mono font-bold text-ink uppercase bg-paper px-1 border border-ink">
                        NOW
                      </span>
                    )}

                    {/* Hour Axis Label */}
                    <span className="text-[10px] font-mono text-ink-muted mt-1 block group-hover:font-bold group-hover:text-ink">
                      {pt.hour.toString().padStart(2, "0")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Time Legend Bar */}
            <div className="flex items-center justify-between text-2xs font-mono text-ink-muted px-1">
              <span>00:00 Midnight (Deep Inversion)</span>
              <span>06:00 AM (Sunrise Peak Trap)</span>
              <span>12:00 PM (Solar Convection)</span>
              <span>18:00 PM (Evening Re-trapping)</span>
              <span>23:00 PM</span>
            </div>
          </div>

          {/* Selected Hour Telemetry Inspector Callout */}
          <div className="p-4 sm:p-5 bg-paper border border-rule flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans text-sm">
            {selectedHourlyPoint ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans font-bold text-ink text-base md:text-lg tracking-tight">
                    {selectedHourlyPoint.hour.toString().padStart(2, "0")}:00 IST Projection
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs font-sans uppercase font-bold text-white rounded-xs"
                    style={{ backgroundColor: selectedHourlyPoint.aqi_color_hex }}
                  >
                    {selectedHourlyPoint.aqi_band_name}
                  </span>
                  {selectedHourlyPoint.hour === currentIstHour && (
                    <span className="px-2 py-0.5 text-xs font-sans uppercase bg-ink text-paper font-semibold rounded-xs">
                      Current Window
                    </span>
                  )}
                </div>
                <p className="text-ink/80 text-sm leading-relaxed max-w-2xl font-normal">
                  {lang === "hi"
                    ? selectedHourlyPoint.health_statement_hi
                    : lang === "mr"
                    ? selectedHourlyPoint.health_statement_mr
                    : selectedHourlyPoint.health_statement_en}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-sans font-bold text-ink text-base md:text-lg tracking-tight">
                  Hover or tap any hour bar to inspect micro-atmospheric metrics
                </p>
                <p className="text-ink/80 text-sm leading-relaxed max-w-2xl font-normal">
                  Displays exact CPCB AQI forecast, PM2.5 concentrations, and boundary layer behavior per hour.
                </p>
              </div>
            )}

            <div className="flex items-center space-x-6 self-end sm:self-auto font-sans">
              <div className="text-right sm:text-left">
                <span className="text-xs font-semibold uppercase text-ink/65 tracking-wider block">Forecast AQI</span>
                <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
                  {selectedHourlyPoint ? selectedHourlyPoint.cpcb_aqi : airData?.current_cpcb_aqi ?? "--"}
                </strong>
              </div>
              <div className="border-l hairline border-rule pl-5 text-right sm:text-left">
                <span className="text-xs font-semibold uppercase text-ink/65 tracking-wider block">PM2.5 Conc.</span>
                <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
                  {selectedHourlyPoint ? `${selectedHourlyPoint.pm2_5} µg/m³` : `${airData?.current_pm2_5 ?? "--"} µg/m³`}
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comprehensive Atmospheric Data Integrity & Scientific Provenance Section */}
      <section className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 shadow-sm font-sans" aria-label="Scientific Data Integrity and Provenance">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b hairline border-rule pb-5 gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-2xs uppercase font-bold text-emerald-800 tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Scientific Data Integrity • Spatial Resolution Benchmark</span>
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Why Roadside Ground Monitors Differ from Regional Atmospheric Grids
            </h2>
            <p className="text-sm md:text-base text-ink-muted font-sans leading-relaxed">
              When comparing air quality platforms across Indian cities (e.g. Pune, Kolkata, or Delhi), users frequently observe apparent divergence between commercial websites and numerical atmospheric models. Here is the peer-reviewed scientific proof of how sampling volume, sensor physics, and meteorological convection operate.
            </p>
          </div>
          <div className="px-3.5 py-2 bg-paper border border-rule text-ink font-mono text-xs font-semibold self-start md:self-auto shrink-0 shadow-2xs">
            CPCB NAQI Standard Formula: <span className="text-emerald-800 font-bold">Identical</span>
          </div>
        </div>

        {/* 4-Pillar Comparative Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: Spatial Sampling Volume */}
          <div className="p-5 bg-paper border border-rule flex flex-col justify-between space-y-3 shadow-2xs transition-all duration-150 hover:border-ink/60">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-2xs uppercase font-semibold tracking-wider text-ink/60 border-b border-rule/50 pb-2">
                <span>01 // Spatial Footprint</span>
                <span className="text-3xs px-1.5 py-0.5 bg-surface border border-rule/60 text-ink-muted">Airshed</span>
              </div>
              <h3 className="font-sans text-base md:text-lg font-bold text-ink tracking-tight leading-snug">
                Street Canyon vs. 11 km Airshed
              </h3>
              <p className="text-xs md:text-sm text-ink-muted leading-relaxed font-sans font-normal">
                Roadside sensors capture vehicle tailpipes and brake friction 2 meters above asphalt. SanjhiHawa’s ECMWF CAMS model calculates the integrated ~120 km² regional boundary layer, encompassing parks, residential neighborhoods, and open terrain.
              </p>
            </div>
          </div>

          {/* Pillar 2: Sensor Physics & Humidity Bias */}
          <div className="p-5 bg-paper border border-rule flex flex-col justify-between space-y-3 shadow-2xs transition-all duration-150 hover:border-ink/60">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-2xs uppercase font-semibold tracking-wider text-ink/60 border-b border-rule/50 pb-2">
                <span>02 // Physical Detection</span>
                <span className="text-3xs px-1.5 py-0.5 bg-surface border border-rule/60 text-ink-muted">Sensors</span>
              </div>
              <h3 className="font-sans text-base md:text-lg font-bold text-ink tracking-tight leading-snug">
                Laser Scattering vs. Multi-Satellite
              </h3>
              <p className="text-xs md:text-sm text-ink-muted leading-relaxed font-sans font-normal">
                Low-cost optical counters mistake condensed water droplets during high relative humidity or morning inversions for heavy PM2.5 (hygroscopic swelling). CAMS assimilates Sentinel-5P, MODIS, and calibrated reference BAM stations under strict chemical equations.
              </p>
            </div>
          </div>

          {/* Pillar 3: Mathematical Determinism */}
          <div className="p-5 bg-paper border border-rule flex flex-col justify-between space-y-3 shadow-2xs transition-all duration-150 hover:border-ink/60">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-2xs uppercase font-semibold tracking-wider text-ink/60 border-b border-rule/50 pb-2">
                <span>03 // Mathematical Proof</span>
                <span className="text-3xs px-1.5 py-0.5 bg-surface border border-rule/60 text-ink-muted">Formula</span>
              </div>
              <h3 className="font-sans text-base md:text-lg font-bold text-ink tracking-tight leading-snug">
                Zero Formula Divergence
              </h3>
              <p className="text-xs md:text-sm text-ink-muted leading-relaxed font-sans font-normal">
                For a roadside reading of 98 µg/m³, CPCB piecewise interpolation produces AQI 223. For a regional reading of 29 µg/m³, it produces AQI 49. The mathematical engine is 100% identical; only the physical volume being measured differs.
              </p>
            </div>
          </div>

          {/* Pillar 4: Public Science vs Hardware Sales */}
          <div className="p-5 bg-paper border border-rule flex flex-col justify-between space-y-3 shadow-2xs transition-all duration-150 hover:border-ink/60">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between font-mono text-2xs uppercase font-semibold tracking-wider text-ink/60 border-b border-rule/50 pb-2">
                <span>04 // Scientific Objectivity</span>
                <span className="text-3xs px-1.5 py-0.5 bg-surface border border-rule/60 text-ink-muted">Governance</span>
              </div>
              <h3 className="font-sans text-base md:text-lg font-bold text-ink tracking-tight leading-snug">
                Public Health vs. Commercial Purifiers
              </h3>
              <p className="text-xs md:text-sm text-ink-muted leading-relaxed font-sans font-normal">
                Commercial platforms are frequently operated by air purifier manufacturers who benefit from displaying localized maximum readings. CAMS is managed by the European Union Earth Observation Programme with zero commercial hardware interest.
              </p>
            </div>
          </div>
        </div>

        {/* Institutional Summary Callout */}
        <div className="p-4 bg-paper/70 border border-rule flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans text-xs">
          <div className="space-y-1">
            <strong className="text-ink font-bold block text-sm">
              How SanjhiHawa Applies This in Practice
            </strong>
            <p className="text-ink-muted leading-relaxed">
              Use regional atmospheric models for household exposure budgeting, daily routine timing, and residential purifier sizing. Use roadside ground monitors when walking directly alongside arterial highways or active construction corridors.
            </p>
          </div>
          <Link
            href="/how-saans-works"
            className="px-4 py-2 bg-ink text-paper font-sans text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity whitespace-nowrap self-stretch md:self-auto text-center"
          >
            Review Scientific Formulations →
          </Link>
        </div>
      </section>

      {/* Field Instruments & Clean Air Toolset */}
      <section className="space-y-4 font-sans" aria-label="Field Instruments and Clean Air Toolset">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-3 gap-2">
          <div>
            <span className="font-sans text-xs uppercase tracking-widest text-ink/60 font-bold block mb-1">
              Field Instruments & Clean Air Toolset
            </span>
            <p className="text-sm md:text-base text-ink/80 font-normal">
              Scientifically grounded modules for household defense, policy simulation, and verified calculations.
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-sans text-xs font-bold uppercase tracking-wider">
              Deterministic Engine Ready
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Routine Optimizer */}
          <Link
            href="/your-day"
            className="group p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
                <span>Routine Optimizer</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                Breath Budget & Schedule
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                Shift walks and school runs away from peak thermal inversion to slash inhaled particulate mass.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-emerald-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                <span>Inversion-Aware Planning</span>
              </span>
            </div>
          </Link>

          {/* Card 2: Dual-Lens Math */}
          <Link
            href="/simulate"
            className="group p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
                <span>Dual-Lens Math</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                What-If Shield Simulator
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                Toggle N95 masks, HEPA purifiers, and transit switches to see personal & 200-home emissions saved.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-blue-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />
                <span>Personal & Collective Scale</span>
              </span>
            </div>
          </Link>

          {/* Card 3: Purifier & Physics */}
          <Link
            href="/lab"
            className="group p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
                <span>Purifier & Physics</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                Home Air Quality Lab
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                Calculate room CADR airflow requirements, room-by-room smog defense, and peer-reviewed myth-busters.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-purple-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-700" />
                <span>CADR Sizing & Myth Science</span>
              </span>
            </div>
          </Link>

          {/* Card 4: Grounded GenAI */}
          <Link
            href="/chat"
            className="group p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
                <span>Grounded GenAI</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                Ask SanjhiHawa Assistant
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                Conversational clean air intelligence with boundary-layer modeling and verified peer-reviewed citations.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-amber-950 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
                <span>Zero Math Hallucination</span>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Real-World Documentary Evidence: Winter Smog Cities */}
      <section className="space-y-5 font-sans" aria-label="Field Documentary Records">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-3 gap-2">
          <div>
            <span className="font-sans text-xs uppercase tracking-widest text-ink/60 font-bold block mb-1">
              Field Documentary Records • Winter Inversion Episodes
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
              Photographic evidence of atmospheric boundary-layer trapping across primary Indian metropolitan basins.
            </h2>
          </div>
          <span className="font-sans text-xs text-ink/75 font-semibold self-start sm:self-auto bg-paper px-3 py-1.5 border border-rule rounded-xs">
            Click any corridor to load live telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Delhi NCR */}
          <button
            type="button"
            onClick={() => {
              setCity("Delhi");
              setLat(28.6139);
              setLon(77.2090);
              loadAir("Delhi", 28.6139, 77.2090, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_delhi.jpg"
                  alt="Delhi NCR winter smog with India Gate fading into dense particulate haze"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Delhi NCR • Field Record
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Indo-Gangetic Basin
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Delhi NCR Corridor
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Rajpath & Kartavya Path Inversion
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  Post-harvest biomass residue meets calm winds and a collapsed 120m thermal boundary layer, trapping toxic aerosols at street level.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Delhi</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>

          {/* Kolkata */}
          <button
            type="button"
            onClick={() => {
              setCity("Kolkata");
              setLat(22.5726);
              setLon(88.3639);
              loadAir("Kolkata", 22.5726, 88.3639, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_kolkata.jpg"
                  alt="Kolkata winter smog over Hooghly River and Howrah bridge"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Kolkata • Riverfront Inversion
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Lower Gangetic Plain
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Kolkata / Riverfront
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Hooghly Basin & Howrah Span
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  High river moisture condenses with industrial sulfur and domestic solid-fuel emissions, creating persistent morning particulate smog.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Kolkata</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>

          {/* Mumbai */}
          <button
            type="button"
            onClick={() => {
              setCity("Mumbai");
              setLat(19.0760);
              setLon(72.8777);
              loadAir("Mumbai", 19.0760, 72.8777, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_mumbai.jpg"
                  alt="Mumbai winter marine temperature inversion haze over Sea Link skyline"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Mumbai • Coastal Marine Layer
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Western Coast
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Mumbai Coastal Line
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Bandra-Worli Marine Inversion
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  Winter land-sea breeze transition traps heavy construction dust and coastal transport soot beneath a low marine temperature inversion.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Mumbai</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>

          {/* Bengaluru */}
          <button
            type="button"
            onClick={() => {
              setCity("Bengaluru");
              setLat(12.9716);
              setLon(77.5946);
              loadAir("Bengaluru", 12.9716, 77.5946, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_bengaluru.jpg"
                  alt="Bengaluru Vidhana Soudha veiled in winter morning particulate smog and atmospheric haze"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Bengaluru • Plateau Inversion
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Deccan Plateau (~920m)
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Bengaluru Tech Corridor
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Vidhana Soudha & Outer Ring Road
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  Morning radiational cooling over the 920m plateau confines diesel vehicular particulate into low valleys before midday solar convection clears the layer.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Bengaluru</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>

          {/* Lucknow */}
          <button
            type="button"
            onClick={() => {
              setCity("Lucknow");
              setLat(26.8467);
              setLon(80.9462);
              loadAir("Lucknow", 26.8467, 80.9462, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_lucknow.jpg"
                  alt="Lucknow highway corridor shrouded in dense winter thermal inversion smog"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Lucknow • Indo-Gangetic Basin
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Central Gangetic Plain
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Lucknow / Indo-Gangetic
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Transport Corridor & Gomti Basin
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  Intense nighttime radiative ground cooling creates an impermeable lid, holding diesel exhaust and regional biomass smoke near the surface.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Lucknow</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>

          {/* Hyderabad */}
          <button
            type="button"
            onClick={() => {
              setCity("Hyderabad");
              setLat(17.3850);
              setLon(78.4867);
              loadAir("Hyderabad", 17.3850, 78.4867, false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <img
                  src="/images/smog_hyderabad.jpg"
                  alt="Hyderabad Charminar rising into dense winter atmospheric inversion smog"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                  loading="lazy"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  Hyderabad • Deccan Basin
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  Telangana Plateau
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  Hyderabad Corridor
                </h3>
                <span className="font-sans text-xs text-ink/65 block uppercase tracking-wider mt-1 font-semibold">
                  Charminar & Hussain Sagar Basin
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  Seasonal winter inversions trap urban vehicular exhaust and commercial activity over the Musi basin, creating persistent haze until late afternoon.
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>Inspect Live Air for Hyderabad</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>
        </div>
      </section>

      {/* Scientific Standards, Formula Provenance & Architectural Integrity */}
      <section className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-4 gap-2">
          <div>
            <span className="font-sans text-xs uppercase tracking-widest text-ink/60 font-bold block mb-1">
              Architectural & Mathematical Rigor
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
              How SanjhiHawa Computes Without Hallucination
            </h2>
          </div>
          <Link
            href="/how-saans-works"
            className="px-3.5 py-1.5 bg-paper hover:bg-surface border border-rule text-xs font-sans font-bold text-ink transition-colors self-start sm:self-auto rounded-xs"
          >
            Read Scientific Whitepaper →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: CPCB NAQI Interpolation */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 01 • CPCB NAQI Sub-Index
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">Piecewise Linear Interpolation</h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              I = I_lo + [(I_hi - I_lo) / (B_hi - B_lo)] × (C - B_lo)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              Official Indian Central Pollution Control Board (2014) standard. Never approximated; computed to 6 decimal places in pure Python.
            </p>
          </div>

          {/* Card 2: Koschmieder Relationship */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 02 • Atmospheric Optics
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">Koschmieder Extinction Law</h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              L_v = 3.912 / [α × PM2.5 + b_clean] (km)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              Correlates aerosol mass concentration with visual range degradation. Accounts for Rayleigh air scattering and particulate light extinction.
            </p>
          </div>

          {/* Card 3: Privacy & Zero Accounts */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 03 • Privacy by Design
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">Client-Isolated Storage</h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              localStorage.getItem(&quot;saans_household&quot;)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              Your family profiles, exposure preferences, and daily routines are never written to a database. Calculations occur on ephemeral, stateless requests.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
