"use client";

import React, { useState, useEffect } from "react";
import { CommunityAdvisoryResponse } from "@/types/api";
import { POPULAR_INDIAN_CITIES } from "@/lib/cities";
import { fetchCommunityAdvisory } from "@/lib/api";
import { useTranslation, translateCity } from "@/lib/i18n";

export default function CommunityPage() {
  const { t, lang } = useTranslation();
  const [orgName, setOrgName] = useState<string>("Vasundhara Enclave RWA");
  const [orgType, setOrgType] = useState<"rwa" | "school" | "community">("rwa");
  const [city, setCity] = useState<string>("Ghaziabad");
  const [lat, setLat] = useState<number>(28.6692);
  const [lon, setLon] = useState<number>(77.4538);
  const [advisory, setAdvisory] = useState<CommunityAdvisoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAdvisory = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchCommunityAdvisory({
        organization_name: orgName,
        organization_type: orgType,
        city: city,
        latitude: lat,
        longitude: lon,
        language: lang,
      });
      setAdvisory(data);
    } catch (err: any) {
      setAdvisory(null);
      setErrorMessage(
        err?.message || `No live air quality readings available for ${city}. An advisory bulletin cannot be generated without verified data.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisory();
  }, [orgType, city, lang]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn font-sans">
      {/* Header */}
      <div className="border-b hairline border-rule pb-4 no-print flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
            Citizen & Institutional Defense • {translateCity(city, lang)}
          </span>
          <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-ink mt-1 tracking-tight">
            {t("community.title")}
          </h1>
          <p className="text-sm md:text-base text-ink-muted mt-1 max-w-xl leading-relaxed">
            {t("community.subtitle")}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-ink text-paper font-mono text-xs uppercase font-bold hover:opacity-90 flex items-center space-x-2"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
          </svg>
          <span>{t("community.btn_print")}</span>
        </button>
      </div>

      {/* Control Panel (Hidden during Print) */}
      <div className="no-print p-5 bg-surface border border-rule grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div>
          <label className="block text-ink-muted mb-1 font-bold">{t("community.org_label")}</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full p-2 border border-rule bg-paper text-ink font-sans text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-ink-muted mb-1 font-bold">Type:</label>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as any)}
            className="w-full p-2 border border-rule bg-paper text-ink"
          >
            <option value="rwa">RWA / Apartment Complex</option>
            <option value="school">School / College</option>
            <option value="community">Community Center</option>
          </select>
        </div>

        <div>
          <label className="block text-ink-muted mb-1 font-bold">City / Location:</label>
          <select
            value={city}
            onChange={(e) => {
              const selected = POPULAR_INDIAN_CITIES.find((c) => c.name === e.target.value);
              if (selected) {
                setCity(selected.name);
                setLat(selected.lat);
                setLon(selected.lon);
              } else {
                setCity(e.target.value);
              }
            }}
            className="w-full p-2 border border-rule bg-paper text-ink"
          >
            {POPULAR_INDIAN_CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.region})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-ink-muted mb-1 font-bold">Language:</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            className="w-full p-2 border border-rule bg-paper text-ink font-sans"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
          </select>
        </div>
      </div>

      {/* Error or No Station Data Notice */}
      {errorMessage && (
        <div className="p-6 bg-red-50 border-l-4 border-red-700 text-red-950 font-sans space-y-2">
          <p className="font-mono text-xs uppercase font-bold text-red-900 tracking-wider">
            Advisory Notice: No Live Station Data Available
          </p>
          <p className="text-sm text-red-800">{errorMessage}</p>
          <p className="text-xs text-red-700">
            SanjhiHawa enforces a strict zero-fake-data policy. Public health bulletins are never synthesized from dummy templates; they require verified atmospheric monitoring data.
          </p>
        </div>
      )}

      {/* The Printable Advisory Card */}
      {advisory && (
        <article
          className="printable-card p-8 bg-surface border-2 border-ink space-y-6 shadow-md"
          aria-label="Community Air Advisory Notice"
        >
          {/* Card Masthead */}
          <div className="border-b-2 border-ink pb-4 flex justify-between items-start">
            <div>
              <span className="font-mono text-2xs uppercase tracking-widest text-ink font-bold block">
                COMMUNITY HEALTH BULLETIN • PUBLIC NOTICE
              </span>
              <h2 className="font-sans text-2xl md:text-3xl font-extrabold text-ink mt-1 tracking-tight">
                {advisory.organization_name}
              </h2>
              <div className="font-mono text-xs text-ink-muted mt-1">
                Issued for {advisory.city} • {advisory.date_formatted}
              </div>
            </div>

            <div className="text-right">
              <span className="font-mono text-2xs uppercase tracking-wider text-ink-muted block">
                NAQI Level
              </span>
              <span
                className="font-mono text-4xl font-extrabold block"
                style={{ color: advisory.aqi_color_hex }}
              >
                {advisory.aqi}
              </span>
              <span
                className="inline-block px-2 py-0.5 text-xs font-bold uppercase text-white"
                style={{ backgroundColor: advisory.aqi_color_hex }}
              >
                {advisory.aqi_band.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Headline Alert */}
          <div
            className="p-4 font-sans text-lg font-bold border-l-4"
            style={{
              backgroundColor: "#FFF5F5",
              borderColor: advisory.aqi_color_hex,
              color: "#5C091A",
            }}
          >
            {advisory.headline}
          </div>

          {/* Action Bulletins */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-ink border-b hairline border-rule pb-1">
              Mandatory Protection Directives
            </h3>
            <ul className="space-y-2 text-sm text-ink leading-relaxed">
              {advisory.bulletin_points.map((pt, idx) => (
                <li key={idx} className="flex items-start space-x-2.5">
                  <span className="font-bold text-ink">▸</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* School Notice if applicable */}
          {advisory.school_advisory && (
            <div className="p-3 bg-paper border border-ink/40 text-xs text-ink font-sans">
              <strong>School Administration Notice:</strong> {advisory.school_advisory}
            </div>
          )}

          {/* Collective Community Actions */}
          <div className="space-y-2 border-t hairline border-rule pt-4">
            <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-ink">
              RWA & Estate Maintenance Operations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {advisory.rwa_actions.map((act, idx) => (
                <div key={idx} className="p-3 bg-paper border border-rule">
                  <span className="font-bold text-ink block mb-1">0{idx + 1}. Directive</span>
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card Footer Authentication */}
          <div className="border-t-2 border-ink pt-3 flex flex-col sm:flex-row justify-between text-2xs font-mono text-ink-muted">
            <div>Verified against CPCB Breakpoint Engine & CAQM Notification</div>
            <div>Generated by SanjhiHawa • Clean Air Decision System</div>
          </div>
        </article>
      )}
    </div>
  );
}
