import React from "react";
import Link from "next/link";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-surface border-t hairline border-rule mt-20 text-sm font-sans text-ink/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          {/* Col 1 (5 cols): Platform Identity & Mission */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-1">
              <span className="font-sans text-2xl font-extrabold text-ink block tracking-tight">
                सांझी हवा <span className="text-ink/40 font-normal">/</span> SanjhiHawa
              </span>
              <p className="text-xs uppercase tracking-wider font-bold text-emerald-800">
                National Atmospheric Intelligence & Exposure Decision Platform
              </p>
            </div>

            <p className="text-sm leading-relaxed text-ink/80">
              SanjhiHawa delivers verified atmospheric telemetry, boundary layer thermal inversion forecasting, and aerosol exposure mitigation planning for Indian metropolitan corridors. All physical modeling, inhaled dosage metrics, and indoor filtration balances are computed directly from deterministic environmental health physics.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-2xs font-mono font-medium">
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                CPCB NAQI 2014 Framework
              </span>
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                ECMWF CAMS Reanalysis
              </span>
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                Local-First Browser Architecture
              </span>
            </div>
          </div>

          {/* Col 2 (2 cols): System Modules */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              Platform Modules
            </h3>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>
                <Link href="/" className="hover:text-ink hover:underline transition-colors">
                  Air Quality & Skyline
                </Link>
              </li>
              <li>
                <Link href="/your-day" className="hover:text-ink hover:underline transition-colors">
                  Breath Budget Planner
                </Link>
              </li>
              <li>
                <Link href="/simulate" className="hover:text-ink hover:underline transition-colors">
                  What-If Shield Simulator
                </Link>
              </li>
              <li>
                <Link href="/lab" className="hover:text-ink hover:underline transition-colors">
                  Home Clean Air Lab
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-ink hover:underline transition-colors">
                  Clean Air Assistant
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-ink hover:underline transition-colors">
                  Community Advisory Cards
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="hover:text-ink hover:underline transition-colors">
                  Household Profile Setup
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3 (2 cols): Science & Standards */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              Science & Standards
            </h3>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>
                <Link href="/how-saans-works" className="hover:text-ink hover:underline transition-colors">
                  Physics & Formulations
                </Link>
              </li>
              <li>
                <a
                  href="https://cpcb.nic.in/National-Air-Quality-Index/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline transition-colors inline-flex items-center gap-1"
                >
                  CPCB NAQI Index <span className="text-xs">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://atmosphere.copernicus.eu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline transition-colors inline-flex items-center gap-1"
                >
                  Copernicus CAMS Grid <span className="text-xs">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://open-meteo.com/en/docs/air-quality-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline transition-colors inline-flex items-center gap-1"
                >
                  Open-Meteo Telemetry <span className="text-xs">↗</span>
                </a>
              </li>
              <li>
                <span className="text-ink/60">CADR & HEPA Sizing</span>
              </li>
              <li>
                <span className="text-ink/60">Koschmieder Extinction</span>
              </li>
            </ul>
          </div>

          {/* Col 4 (3 cols): Privacy & Public Health */}
          <div className="lg:col-span-3 space-y-3 text-xs leading-relaxed text-ink/75">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              Privacy & Public Health
            </h3>
            <div className="space-y-2.5">
              <p>
                <strong className="text-ink font-semibold">Local-First Privacy:</strong>{" "}
                No accounts or server-side telemetry. Household parameters and sensitive profiles exist exclusively in your browser’s local storage.
              </p>
              <p>
                <strong className="text-ink font-semibold">Public Health Notice:</strong>{" "}
                SanjhiHawa provides atmospheric modeling and clean air exposure mitigation tools for daily household planning.
              </p>
              <p className="text-2xs text-ink/60 leading-normal">
                Particulate-to-cigarette dosage comparison is an epidemiological communication heuristic (Berkeley Earth, 2015) based on equivalent mortality risk from fine particulate mass inhalation.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Strip */}
        <div className="border-t hairline border-rule pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-sans text-ink/65">
          <div>
            © 2026 SanjhiHawa. Open atmospheric intelligence platform for public health.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>Central Pollution Control Board Standards</span>
            <span>•</span>
            <span>WCAG 2.2 AA Conformance</span>
            <span>•</span>
            <Link href="/how-saans-works" className="hover:text-ink hover:underline underline-offset-2">
              Transparency & Methodology
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
