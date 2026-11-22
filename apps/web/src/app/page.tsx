"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { SkylineSVG } from "@/components/skyline/SkylineSVG";
import { fetchAirQuality, searchCities, getLastCachedAir, formatReadingAge, CachedAirData } from "@/lib/api";
import { AirQualityResponse, GeocodeItem, HourlyAirPoint } from "@/types/api";
import { useTranslation, translateCity, translateAqiBand } from "@/lib/i18n";
import { DiurnalTimeline } from "@/components/landing/DiurnalTimeline";
import { ScientificProvenanceSection } from "@/components/landing/ScientificProvenanceSection";
import { SpatialBenchmarkGrid } from "@/components/landing/SpatialBenchmarkGrid";
import { DocumentaryGallery } from "@/components/landing/DocumentaryGallery";
import { MathematicalRigorSection } from "@/components/landing/MathematicalRigorSection";

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
  const { t, lang } = useTranslation();
  const [showResolutionDetail, setShowResolutionDetail] = useState<boolean>(false);

  // Geocoding Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

                  {/* Real Geocoding City Search */}
                  <div ref={searchContainerRef} className="relative">
                    <div className="flex items-center">
                      <label htmlFor="city-search-input" className="sr-only">
                        {t("landing.search_placeholder")}
                      </label>
                      <input
                        id="city-search-input"
                        type="text"
                        placeholder={t("landing.search_placeholder")}
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
                <span className="text-xs font-sans uppercase text-ink-muted mr-1 font-bold tracking-wider">
                  {t("landing.national_corridors")}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
              {/* Metric 1: Fine Particulates PM2.5 */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
                  <span>{t("landing.pm25_title")}</span>
                  <span className="font-semibold text-2xs text-ink-muted">{t("landing.pm25_limit")}</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {pm25 != null ? `${pm25} µg/m³` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {pm25 != null
                    ? `${Math.round((pm25 / 60) * 100)}% ${t("landing.pm25_sub")}`
                    : "No particulate reading"}
                </div>
              </div>

              {/* Metric 2: Coarse Particulates PM10 */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
                  <span>{t("landing.pm10_title")}</span>
                  <span className="font-semibold text-2xs text-ink-muted">{t("landing.pm10_limit")}</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {pm10 != null ? `${pm10} µg/m³` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {pm10 != null
                    ? `${Math.round((pm10 / 100) * 100)}% ${t("landing.pm10_sub")}`
                    : "Mechanical dust unmeasured"}
                </div>
              </div>

              {/* Metric 3: Aerosol Soot vs Dust Ratio */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
                  <span>{t("landing.ratio_title")}</span>
                  <span className="font-semibold text-2xs text-ink-muted">PM2.5/PM10</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {aerosolRatio != null ? `${aerosolRatio}%` : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {aerosolRatio != null && aerosolRatio > 65
                    ? t("landing.ratio_sub")
                    : aerosolRatio != null && aerosolRatio > 40
                    ? (lang === "hi" ? "वाहनों का धुआं और धूल मिश्रित" : lang === "mr" ? "वाहनांचा धूर आणि धूळ मिश्रित" : "Mixed traffic soot and mechanical road dust")
                    : aerosolRatio != null
                    ? (lang === "hi" ? "रेगिस्तानी व शुष्क हवा प्रभावी" : lang === "mr" ? "कोरडी हवा व धूळ प्रभावी" : "Crustal windblown dust dominant")
                    : "Calculating aerosol balance"}
                </div>
              </div>

              {/* Metric 4: Optical Visual Range */}
              <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
                  <span>{t("landing.visual_title")}</span>
                  <span className="font-semibold text-2xs text-ink-muted">Koschmieder</span>
                </div>
                <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
                  {koschmiederKm != null
                    ? koschmiederKm < 1.0
                      ? `~${Math.max(150, Math.round(koschmiederKm * 1000))} m`
                      : `~${koschmiederKm.toFixed(1)} km`
                    : "--"}
                </div>
                <div className="text-xs font-sans text-ink/80 leading-snug">
                  {t("landing.visual_sub")}
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
                  {t("landing.audit_title")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowResolutionDetail(!showResolutionDetail)}
                aria-expanded={showResolutionDetail}
                aria-controls="spatial-scale-explanation"
                className="text-xs font-sans font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 text-left sm:text-right inline-flex items-center gap-1"
              >
                <span>{showResolutionDetail ? t("landing.audit_collapse") : t("landing.audit_expand")}</span>
              </button>
            </div>

            {showResolutionDetail && (
              <div id="spatial-scale-explanation" className="pt-2 border-t hairline border-rule/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-ink/80 animate-fadeIn">
                <div className="p-3.5 bg-surface border border-rule space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-ink uppercase tracking-wider text-2xs text-amber-900">
                    <span>1. Commercial Roadside Sensors (e.g. aqi.in)</span>
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 font-mono text-3xs font-semibold">Hyper-Local Point (~3m)</span>
                  </div>
                  <p>
                    {lang === "hi"
                      ? "सड़क पर 2 मीटर ऊंचाई पर वाहनों का तुरंत निकला धुआं मापते हैं। बिना हीटर वाले सस्ते लेजर सेंसर सुबह की नमी और कोहरे की बूंदों को भारी PM2.5 कण मान लेते हैं, जिससे रीडिंग 40%–80% तक कृत्रिम रूप से बढ़ जाती है।"
                      : lang === "mr"
                      ? "रस्त्यावर वाहनांचा प्रत्यक्ष धूर मोजतात. स्वस्त सेन्सर्स सकाळच्या धुक्यातील पाण्याचे थेंब PM2.5 समजून रीडिंग 40%–80% वाढवून दाखवतात."
                      : "Measures localized exhaust plumes, idling buses, and road dust 2 meters above traffic asphalt. Optical laser sensors without heated inlets are vulnerable to hygroscopic swelling, where high humidity causes microscopic water droplets to be miscounted as heavy PM2.5 particles, inflating readings by 40%–80%."}
                  </p>
                </div>

                <div className="p-3.5 bg-surface border border-rule space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-ink uppercase tracking-wider text-2xs text-emerald-900">
                    <span>2. Copernicus CAMS Chemical Transport Grid (SanjhiHawa)</span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-mono text-3xs font-semibold">Regional Troposphere (~11 km)</span>
                  </div>
                  <p>
                    {lang === "hi"
                      ? "उपग्रह डेटा (Sentinel-5P/MODIS) और मौसम मॉडल के साथ ~120 वर्ग किमी के पूरे वायु क्षेत्र का आकलन करता है। दोपहर में धूप से होने वाले प्राकृतिक वेंटिलेशन को दर्शाता है। दोनों ही CPCB फॉर्मूला उपयोग करते हैं।"
                      : lang === "mr"
                      ? "उपग्रह डेटा आणि हवामान प्रारूपाद्वारे संपूर्ण 120 चौ. किमी क्षेत्राचे मोजमाप करते. दोन्ही प्रणाली अधिकृत CPCB नियम वापरतात."
                      : "Integrates satellite aerosol optical depth (Sentinel-5P / MODIS) with 3D numerical weather forecasting across a ~120 km² airshed. Captures true regional solar convection that dilutes background smog at midday. Both platforms apply the exact same Indian CPCB formula—the variance is in the physical spatial scale sampled."}
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
