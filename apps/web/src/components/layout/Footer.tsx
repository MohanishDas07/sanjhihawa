"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export const Footer: React.FC = () => {
  const { t } = useTranslation();

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
                {t("footer.tagline")}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-ink/80">
              {t("footer.desc")}
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-2xs font-mono font-medium">
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                {t("footer.badge_naqi")}
              </span>
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                {t("footer.badge_cams")}
              </span>
              <span className="px-2.5 py-1 bg-paper border border-rule text-ink font-semibold">
                {t("footer.badge_browser")}
              </span>
            </div>
          </div>

          {/* Col 2 (2 cols): System Modules */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              {t("footer.modules_title")}
            </h3>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>
                <Link href="/" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.todays_air")}
                </Link>
              </li>
              <li>
                <Link href="/your-day" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.your_day")}
                </Link>
              </li>
              <li>
                <Link href="/simulate" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.simulate")}
                </Link>
              </li>
              <li>
                <Link href="/lab" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.lab")}
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.chat")}
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.community")}
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.household")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3 (2 cols): Science & Standards */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              {t("footer.standards_title")}
            </h3>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>
                <Link href="/how-saans-works" className="hover:text-ink hover:underline transition-colors">
                  {t("nav.how_it_works")}
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
                  Copernicus CAMS <span className="text-xs">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://open-meteo.com/en/docs/air-quality-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink hover:underline transition-colors inline-flex items-center gap-1"
                >
                  Open-Meteo <span className="text-xs">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4 (3 cols): Privacy & Public Health */}
          <div className="lg:col-span-3 space-y-3 text-xs leading-relaxed text-ink/75">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
              {t("footer.standards_title")}
            </h3>
            <div className="space-y-2.5">
              <p>
                {t("footer.privacy_note")}
              </p>
              <p>
                {t("footer.health_notice")}
              </p>
              <p className="text-2xs text-ink/60 leading-normal">
                {t("footer.heuristic_note")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Strip */}
        <div className="border-t hairline border-rule pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-sans text-ink/65">
          <div>
            {t("footer.copyright")}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>{t("footer.wcag")}</span>
            <span>•</span>
            <Link href="/how-saans-works" className="hover:text-ink hover:underline underline-offset-2">
              {t("nav.how_it_works")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
        </div>
      </div>
    </footer>
  );
};
