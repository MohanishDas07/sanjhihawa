"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function HowSaansWorksPage() {
  const { t, lang } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fadeIn font-sans">
      {/* Header */}
      <div className="border-b hairline border-rule pb-4">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
          {lang === "hi" ? "वैज्ञानिक एवं वास्तुकला खुलापन" : lang === "mr" ? "वैज्ञानिक व वास्तुशास्त्रीय पारदर्शकता" : "Scientific & Architectural Openness"}
        </span>
        <h1 className="font-sans text-3xl md:text-5xl font-extrabold text-ink mt-1 tracking-tight">
          {t("how_it_works.title")}
        </h1>
        <p className="text-base md:text-lg text-ink-muted mt-2 max-w-2xl leading-relaxed">
          {t("how_it_works.subtitle")}
        </p>
      </div>

      {/* Principle 0: The LLM Never Does The Math */}
      <section className="p-6 md:p-8 bg-surface border-2 border-ink space-y-3">
        <span className="font-mono text-xs uppercase font-bold tracking-wider text-ink block">
          {lang === "hi" ? "प्रमुख नियम #1" : lang === "mr" ? "प्रमुख नियम #1" : "Cardinal Rule #1"}
        </span>
        <h2 className="font-sans text-2xl md:text-3xl font-bold text-ink tracking-tight">
          {t("how_it_works.rule1_title")}
        </h2>
        <p className="text-sm md:text-base text-ink/80 leading-relaxed">
          {t("how_it_works.rule1_desc")}
        </p>
      </section>

      {/* Section 1: Physical & Epidemiological Formulas */}
      <section className="space-y-6">
        <h2 className="font-sans text-2xl font-bold text-ink border-b hairline border-rule pb-2 tracking-tight">
          Mathematical & Physical Formulations
        </h2>

        {/* Formula 1: Mass Balance */}
        <div className="p-5 bg-paper border border-rule space-y-3">
          <span className="font-mono text-xs font-bold uppercase text-ink">
            01 / Indoor Single-Compartment Steady-State Mass Balance
          </span>
          <div className="p-4 bg-surface border border-rule font-mono text-sm overflow-x-auto">
            C_in = C_out × [ (a × P) / (a + k) ]
          </div>
          <div className="text-xs text-ink-muted space-y-1 leading-relaxed">
            <p><strong>C_in:</strong> Indoor PM2.5 concentration (µg/m³).</p>
            <p><strong>C_out:</strong> Outdoor ambient PM2.5 concentration (µg/m³).</p>
            <p><strong>a:</strong> Air exchange rate per hour (0.4/h for weatherstripped rooms, 0.8/h for standard apartments, 4.0/h for open windows).</p>
            <p><strong>P:</strong> Envelope penetration factor (0.55 to 0.98 dimensionless).</p>
            <p><strong>k:</strong> Total removal rate = k_natural (0.25/h surface deposition) + (CADR × η_mixing / V_room).</p>
            <p className="text-2xs italic pt-1">
              Source: Chen & Zhao (2011), Atmospheric Environment; Nazaroff (2004), Indoor Air.
            </p>
          </div>
        </div>

        {/* Formula 2: Inhaled Dose */}
        <div className="p-5 bg-paper border border-rule space-y-3">
          <span className="font-mono text-xs font-bold uppercase text-ink">
            02 / Inhaled PM2.5 Particulate Dose
          </span>
          <div className="p-4 bg-surface border border-rule font-mono text-sm overflow-x-auto">
            Dose (µg) = C_effective × Inhalation_Rate(age, activity) × Duration (hours)
            <br />
            where C_effective = C_ambient × (1 - η_mask)
          </div>
          <div className="text-xs text-ink-muted space-y-1 leading-relaxed">
            <p><strong>Inhalation Rates:</strong> Adults inhale ~0.30 m³/h at sleep, ~0.45 m³/h sedentary, up to 1.25 m³/h in moderate outdoor transit.</p>
            <p><strong>Fit-Adjusted Mask Efficiency (η_mask):</strong> Certified ISI N95 is set conservatively to 85% (accounting for realistic perimeter inward leakage vs 95% lab filter ratings); cloth mask is 20%; no mask is 0%.</p>
            <p className="text-2xs italic pt-1">
              Source: US EPA Exposure Factors Handbook (2011 Edition, Chapter 6) & ICMR Norms.
            </p>
          </div>
        </div>

        {/* Formula 3: CPCB AQI Linear Sub-Index */}
        <div className="p-5 bg-paper border border-rule space-y-3">
          <span className="font-mono text-xs font-bold uppercase text-ink">
            03 / Central Pollution Control Board (CPCB) NAQI Calculation
          </span>
          <div className="p-4 bg-surface border border-rule font-mono text-sm overflow-x-auto">
            I = [ (I_hi - I_lo) / (C_hi - C_lo) ] × (C - C_lo) + I_lo
          </div>
          <div className="text-xs text-ink-muted leading-relaxed">
            Linear sub-index interpolation applied strictly against official CPCB 24-hour breakpoints (0-30 Good, 31-60 Satisfactory, 61-90 Moderate, 91-120 Poor, 121-250 Very Poor, 250+ Severe).
          </div>
        </div>

        {/* Formula 4: Berkeley Earth Heuristic */}
        <div className="p-5 bg-paper border border-rule space-y-3">
          <span className="font-mono text-xs font-bold uppercase text-ink">
            04 / Berkeley Earth Cigarette-Equivalent Rule of Thumb
          </span>
          <div className="p-4 bg-surface border border-rule font-mono text-sm overflow-x-auto">
            Cigarettes / day = 24h Average PM2.5 (µg/m³) ÷ 22 µg/m³
          </div>
          <div className="text-xs text-ink-muted space-y-1 leading-relaxed">
            <p>
              Developed by Muller & Muller (Berkeley Earth, 2015), equating the estimated lifetime mortality risk of breathing 22 µg/m³ of PM2.5 for 24 hours to smoking one cigarette per day.
            </p>
            <p className="font-semibold text-ink-muted bg-surface p-2 border border-rule">
              Notice: This is an illustrative communication heuristic based on peer-reviewed environmental health literature.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Privacy Model */}
      <section className="space-y-4">
        <h2 className="font-sans text-2xl font-bold text-ink border-b hairline border-rule pb-2 tracking-tight">
          Privacy by Design & Zero Server Persistence
        </h2>
        <div className="p-5 bg-surface border border-rule space-y-3 text-sm text-ink-muted leading-relaxed">
          <p>
            SanjhiHawa does not require user accounts, passwords, email addresses, or phone numbers.
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-ink">
            <li>Your household members, family ages, and breathing vulnerability flags are stored exclusively in your browser's <code>localStorage</code>.</li>
            <li>Profile data is transmitted as transient payload in POST requests to calculate your personalized day plan.</li>
            <li>The API server does not write personal profiles to SQLite, logs, or external cloud storage.</li>
            <li>You can wipe all stored data at any time via the "Delete My Data" button in Onboarding.</li>
          </ul>
        </div>
      </section>

      {/* Section 3: Data Sources & Standards */}
      <section className="space-y-4">
        <h2 className="font-sans text-2xl font-bold text-ink border-b hairline border-rule pb-2 tracking-tight">
          Real Atmospheric Telemetry & Scientific Standards
        </h2>
        <div className="overflow-x-auto border border-rule">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-surface font-mono border-b hairline border-rule">
              <tr>
                <th className="p-3">Standard / Domain</th>
                <th className="p-3">Governing Body / Source</th>
                <th className="p-3">Implementation in SanjhiHawa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule bg-paper">
              <tr>
                <td className="p-3 font-semibold">CPCB National Air Quality Index (NAQI)</td>
                <td className="p-3">Central Pollution Control Board, MoEFCC (Govt of India)</td>
                <td className="p-3">Official 6-band linear piecewise sub-index interpolation for PM2.5 & PM10.</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Atmospheric Model Telemetry</td>
                <td className="p-3">Copernicus Atmosphere Monitoring Service (CAMS) / Open-Meteo</td>
                <td className="p-3">Hourly aerosol optical depth & ground-level PM2.5/PM10 forecast grids across India.</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Graded Response Action Plan (GRAP)</td>
                <td className="p-3">Commission for Air Quality Management (CAQM) in NCR</td>
                <td className="p-3">Statutory Stage I (201-300), Stage II (301-400), Stage III (401-450), Stage IV (&gt;450) mandates.</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Physiological Inhalation Dosimetry</td>
                <td className="p-3">US EPA Exposure Factors Handbook (Chapter 6) & ICMR Norms</td>
                <td className="p-3">Age-stratified minute volume calculations across sedentary, transit, and sleep activities.</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Indoor Aerosol Mass Balance</td>
                <td className="p-3">Chen & Zhao (2011), Nazaroff (2004), Indoor Air</td>
                <td className="p-3">Physical infiltration, envelope penetration, and Clean Air Delivery Rate (CADR) decay.</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Respiratory Particulate Filtration</td>
                <td className="p-3">Bureau of Indian Standards (IS 9473) / NIOSH</td>
                <td className="p-3">Fit-adjusted penetration modeling for certified ISI N95 vs unsealed cloth masks.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Back to Home CTA */}
      <div className="pt-4 text-center">
        <Link
          href="/"
          className="px-6 py-3 bg-ink text-paper font-sans font-semibold text-sm hover:opacity-90 inline-block"
        >
          ← Return to Today's Air
        </Link>
      </div>
    </div>
  );
}
