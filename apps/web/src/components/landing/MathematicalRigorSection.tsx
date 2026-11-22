"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function MathematicalRigorSection() {
  const { t } = useTranslation();

  return (
    <section className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-4 gap-2">
        <div>
          <span className="font-sans text-xs uppercase tracking-widest text-ink-muted font-bold block mb-1">
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
          <span className="font-sans text-xs uppercase text-ink-muted font-bold tracking-wider block">
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
          <span className="font-sans text-xs uppercase text-ink-muted font-bold tracking-wider block">
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
          <span className="font-sans text-xs uppercase text-ink-muted font-bold tracking-wider block">
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
  );
}
