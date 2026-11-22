"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { SkylineSVG } from "@/components/skyline/SkylineSVG";
import { fetchAirQuality, searchCities, getLastCachedAir, formatReadingAge, CachedAirData } from "@/lib/api";
import { AirQualityResponse, GeocodeItem, HourlyAirPoint } from "@/types/api";
import { useTranslation, translateCity, translateAqiBand } from "@/lib/i18n";

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
  const [selectedHourlyPoint, setSelectedHourlyPoint] = useState<HourlyAirPoint | null>(null);
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
          lang={lang}
        />

        {/* Hero Air Data Panel */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Institutional Telemetry Header Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b hairline border-rule pb-6">
            <div className="space-y-3 flex-1">
              {/* Provenance & Standard Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans uppercase text-ink/70 font-semibold tracking-wider">
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
                      <input
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
                <span className="text-xs font-sans uppercase text-ink/70 mr-1 font-bold tracking-wider">
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
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>{t("landing.pm25_title")}</span>
                  <span className="font-semibold text-2xs text-ink/60">{t("landing.pm25_limit")}</span>
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
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>{t("landing.pm10_title")}</span>
                  <span className="font-semibold text-2xs text-ink/60">{t("landing.pm10_limit")}</span>
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
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>{t("landing.ratio_title")}</span>
                  <span className="font-semibold text-2xs text-ink/60">PM2.5/PM10</span>
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
                <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink/70">
                  <span>{t("landing.visual_title")}</span>
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
                className="text-xs font-sans font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 text-left sm:text-right inline-flex items-center gap-1"
              >
                <span>{showResolutionDetail ? t("landing.audit_collapse") : t("landing.audit_expand")}</span>
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
      {diurnalStats && diurnalStats.list.length > 0 && (
        <section
          className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 shadow-sm"
          aria-label="24-Hour Atmospheric Inversion & Exposure Timeline"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b hairline border-rule pb-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-sans font-bold uppercase tracking-widest text-ink/60">
                <span>{t("landing.inversion_eyebrow")}</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink mt-1 tracking-tight">
                {lang === "hi"
                  ? `${translateCity(city, lang)} ${t("landing.inversion_title")}`
                  : lang === "mr"
                  ? `${translateCity(city, lang)} ${t("landing.inversion_title")}`
                  : `${t("landing.inversion_title")} ${translateCity(city, lang)}`}
              </h2>
              <p className="text-sm md:text-base text-ink/80 mt-1 max-w-2xl leading-relaxed font-normal">
                {t("landing.inversion_desc")}
              </p>
            </div>

            {/* Inversion Highlights */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
              <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-950 font-medium rounded-xs">
                <span className="font-bold text-emerald-800">● {t("landing.lowest_window")}: </span>
                <span className="font-semibold">
                  {diurnalStats.bestAfternoon
                    ? `${diurnalStats.bestAfternoon.hour.toString().padStart(2, "0")}:00 IST (AQI ${diurnalStats.bestAfternoon.cpcb_aqi})`
                    : "12:00 – 16:00"}
                </span>
              </div>
              <div className="px-3.5 py-1.5 bg-red-50 border border-red-300 text-red-950 font-medium rounded-xs">
                <span className="font-bold text-red-800">▲ {t("landing.avoid_window")}: </span>
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
              <span>{lang === "hi" ? "00:00 मध्यरात्रि (गहरा इनवर्जन)" : lang === "mr" ? "00:00 मध्यरात्र (खोल इनव्हर्जन)" : "00:00 Midnight (Deep Inversion)"}</span>
              <span>{lang === "hi" ? "06:00 प्रातः (सूर्योदय पीक)" : lang === "mr" ? "06:00 सकाळ (सूर्यपर्व पीक)" : "06:00 AM (Sunrise Peak Trap)"}</span>
              <span>{lang === "hi" ? "12:00 दोपहर (धूप संवहन)" : lang === "mr" ? "12:00 दुपार (सूर्य संवहन)" : "12:00 PM (Solar Convection)"}</span>
              <span>{lang === "hi" ? "18:00 शाम (पुनः इनवर्जन)" : lang === "mr" ? "18:00 संध्याकाळ (पुन्हा इनव्हर्जन)" : "18:00 PM (Evening Re-trapping)"}</span>
              <span>23:00</span>
            </div>
          </div>

          {/* Selected Hour Telemetry Inspector Callout */}
          <div className="p-4 sm:p-5 bg-paper border border-rule flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans text-sm">
            {selectedHourlyPoint ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans font-bold text-ink text-base md:text-lg tracking-tight">
                    {selectedHourlyPoint.hour.toString().padStart(2, "0")}:00 IST {lang === "hi" ? "पूर्वानुमान" : lang === "mr" ? "अंदाज" : "Projection"}
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs font-sans uppercase font-bold text-white rounded-xs"
                    style={{ backgroundColor: selectedHourlyPoint.aqi_color_hex }}
                  >
                    {translateAqiBand(selectedHourlyPoint.aqi_band_name, lang)}
                  </span>
                  {selectedHourlyPoint.hour === currentIstHour && (
                    <span className="px-2 py-0.5 text-xs font-sans uppercase bg-ink text-paper font-semibold rounded-xs">
                      {lang === "hi" ? "वर्तमान समय" : lang === "mr" ? "चालू वेळ" : "Current Window"}
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
                  {lang === "hi" ? "प्रत्येक घंटे का वायुमंडलीय विवरण देखने के लिए किसी भी बार पर क्लिक करें" : lang === "mr" ? "प्रत्येक तासाचा तपशील पाहण्यासाठी पट्टीवर क्लिक करा" : "Hover or tap any hour bar to inspect micro-atmospheric metrics"}
                </p>
                <p className="text-ink/80 text-sm leading-relaxed max-w-2xl font-normal">
                  {lang === "hi" ? "प्रति घंटा सटीक CPCB AQI, PM2.5 सांद्रता और वायुमंडलीय व्यवहार।" : lang === "mr" ? "दर तासाचा अचूक CPCB AQI, PM2.5 पातळी आणि हवेची स्थिती." : "Displays exact CPCB AQI forecast, PM2.5 concentrations, and boundary layer behavior per hour."}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-6 self-end sm:self-auto font-sans">
              <div className="text-right sm:text-left">
                <span className="text-xs font-semibold uppercase text-ink/65 tracking-wider block">
                  {lang === "hi" ? "अनुमानित AQI" : lang === "mr" ? "अंदाजित AQI" : "Forecast AQI"}
                </span>
                <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
                  {selectedHourlyPoint ? selectedHourlyPoint.cpcb_aqi : airData?.current_cpcb_aqi ?? "--"}
                </strong>
              </div>
              <div className="border-l hairline border-rule pl-5 text-right sm:text-left">
                <span className="text-xs font-semibold uppercase text-ink/65 tracking-wider block">
                  {lang === "hi" ? "PM2.5 सांद्रता" : lang === "mr" ? "PM2.5 पातळी" : "PM2.5 Conc."}
                </span>
                <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
                  {selectedHourlyPoint ? `${selectedHourlyPoint.pm2_5} µg/m³` : `${airData?.current_pm2_5 ?? "--"} µg/m³`}
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comprehensive Atmospheric Data Integrity & Scientific Provenance Section */}
      <section className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 shadow-sm" aria-label="Scientific Data Integrity and Provenance">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b hairline border-rule pb-5 gap-3">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-sans uppercase font-bold text-emerald-800 tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>{t("landing.provenance_eyebrow")}</span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
              {t("landing.provenance_title")}
            </h2>
            <p className="text-sm md:text-base text-ink/80 font-sans leading-relaxed">
              {t("landing.provenance_desc")}
            </p>
          </div>
          <div className="px-3 py-1.5 bg-paper border border-rule text-ink font-mono text-xs font-bold self-start md:self-auto shrink-0">
            {t("landing.formula_identical")}
          </div>
        </div>

        {/* 4-Pillar Comparative Analysis Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: Spatial Sampling Volume */}
          <div className="p-5 bg-paper border border-rule space-y-2.5 shadow-2xs">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
              {t("landing.p1_idx")}
            </div>
            <h3 className="font-sans text-base md:text-lg font-bold text-ink">
              {t("landing.p1_title")}
            </h3>
            <p className="text-xs md:text-sm text-ink/80 leading-relaxed font-sans">
              {t("landing.p1_desc")}
            </p>
          </div>

          {/* Pillar 2: Sensor Physics & Humidity Bias */}
          <div className="p-5 bg-paper border border-rule space-y-2.5 shadow-2xs">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
              {t("landing.p2_idx")}
            </div>
            <h3 className="font-sans text-base md:text-lg font-bold text-ink">
              {t("landing.p2_title")}
            </h3>
            <p className="text-xs md:text-sm text-ink/80 leading-relaxed font-sans">
              {t("landing.p2_desc")}
            </p>
          </div>

          {/* Pillar 3: Mathematical Determinism */}
          <div className="p-5 bg-paper border border-rule space-y-2.5 shadow-2xs">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
              {t("landing.p3_idx")}
            </div>
            <h3 className="font-sans text-base md:text-lg font-bold text-ink">
              {t("landing.p3_title")}
            </h3>
            <p className="text-xs md:text-sm text-ink/80 leading-relaxed font-sans">
              {t("landing.p3_desc")}
            </p>
          </div>

          {/* Pillar 4: Public Science vs Hardware Sales */}
          <div className="p-5 bg-paper border border-rule space-y-2.5 shadow-2xs">
            <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink/60">
              {t("landing.p4_idx")}
            </div>
            <h3 className="font-sans text-base md:text-lg font-bold text-ink">
              {t("landing.p4_title")}
            </h3>
            <p className="text-xs md:text-sm text-ink/80 leading-relaxed font-sans">
              {t("landing.p4_desc")}
            </p>
          </div>
        </div>

        {/* Institutional Summary Callout */}
        <div className="p-4 bg-paper/60 border border-rule flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-sans text-ink/80">
          <div className="space-y-1">
            <strong className="text-ink font-bold block text-sm">
              {t("landing.applies_title")}
            </strong>
            <p className="leading-relaxed">
              {t("landing.applies_desc")}
            </p>
          </div>
          <Link
            href="/how-saans-works"
            className="px-4 py-2.5 bg-ink text-paper font-semibold hover:opacity-90 transition-opacity whitespace-nowrap self-stretch md:self-auto text-center"
          >
            {t("landing.btn_review_formulas")}
          </Link>
        </div>
      </section>

      {/* Field Instruments & Clean Air Toolset */}
      <section className="space-y-4 font-sans" aria-label="Field Instruments and Clean Air Toolset">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-3 gap-2">
          <div>
            <span className="font-sans text-xs uppercase tracking-widest text-ink/60 font-bold block mb-1">
              {t("landing.tools_eyebrow")}
            </span>
            <p className="text-sm md:text-base text-ink/80 font-normal">
              {t("landing.tools_desc")}
            </p>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-sans text-xs font-bold uppercase tracking-wider">
              {lang === "hi" ? "सटीक गणितीय इंजन सक्रिय" : lang === "mr" ? "अचूक गणितीय इंजिन सक्रिय" : "Deterministic Engine Ready"}
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
                <span>{t("landing.tool1_eyebrow")}</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                {t("landing.tool1_title")}
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                {t("landing.tool1_desc")}
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-emerald-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                <span>{t("landing.tool1_tag")}</span>
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
                <span>{t("landing.tool2_eyebrow")}</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                {t("landing.tool2_title")}
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                {t("landing.tool2_desc")}
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-blue-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />
                <span>{t("landing.tool2_tag")}</span>
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
                <span>{t("landing.tool3_eyebrow")}</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                {t("landing.tool3_title")}
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                {t("landing.tool3_desc")}
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-purple-900 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-700" />
                <span>{t("landing.tool3_tag")}</span>
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
                <span>{t("landing.tool4_eyebrow")}</span>
                <span className="group-hover:translate-x-1.5 transition-transform text-ink/70">→</span>
              </div>
              <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                {t("landing.tool4_title")}
              </h3>
              <p className="text-sm font-sans text-ink/80 leading-relaxed font-normal">
                {t("landing.tool4_desc")}
              </p>
            </div>
            <div className="pt-4 mt-3 border-t hairline border-rule">
              <span className="inline-flex items-center space-x-1.5 text-xs font-sans font-bold text-amber-950 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
                <span>{t("landing.tool4_tag")}</span>
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
              {t("landing.photos_eyebrow")}
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
              {t("landing.photos_title")}
            </h2>
          </div>
          <span className="font-sans text-xs text-ink/75 font-semibold self-start sm:self-auto bg-paper px-3 py-1.5 border border-rule rounded-xs">
            {t("landing.photos_hint")}
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
              {t("landing.rigor_eyebrow")}
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
              {t("landing.rigor_title")}
            </h2>
          </div>
          <Link
            href="/how-saans-works"
            className="px-3.5 py-1.5 bg-paper hover:bg-surface border border-rule text-xs font-sans font-bold text-ink transition-colors self-start sm:self-auto rounded-xs"
          >
            {t("landing.btn_whitepaper")}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: CPCB NAQI Interpolation */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 01 • CPCB NAQI Sub-Index
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">
              {t("landing.rigor1_title")}
            </h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              I = I_lo + [(I_hi - I_lo) / (B_hi - B_lo)] × (C - B_lo)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              {t("landing.rigor1_desc")}
            </p>
          </div>

          {/* Card 2: Koschmieder Relationship */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 02 • Atmospheric Optics
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">
              {t("landing.rigor2_title")}
            </h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              L_v = 3.912 / [α × PM2.5 + b_clean] (km)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              {t("landing.rigor2_desc")}
            </p>
          </div>

          {/* Card 3: Privacy & Zero Accounts */}
          <div className="p-5 bg-paper border border-rule space-y-3">
            <span className="font-sans text-xs uppercase text-ink/60 font-bold tracking-wider block">
              Equation 03 • Privacy by Design
            </span>
            <h3 className="font-sans text-lg md:text-xl font-bold text-ink tracking-tight">
              {t("landing.rigor3_title")}
            </h3>
            <p className="font-mono text-xs bg-surface p-2.5 border border-rule text-ink leading-relaxed font-semibold">
              localStorage.getItem(&quot;saans_household&quot;)
            </p>
            <p className="text-sm text-ink/80 leading-relaxed font-normal">
              {t("landing.rigor3_desc")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
