"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function SpatialBenchmarkGrid() {
  const { t, lang } = useTranslation();

  return (
    <section className="space-y-5 font-sans" aria-label="Exposure Reduction Engines">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-3 gap-2">
        <div>
          <span className="font-sans text-xs uppercase tracking-widest text-ink-muted font-bold block mb-1">
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
            <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
              <span>{t("landing.tool1_eyebrow")}</span>
              <span className="group-hover:translate-x-1.5 transition-transform text-ink-muted">→</span>
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
            <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
              <span>{t("landing.tool2_eyebrow")}</span>
              <span className="group-hover:translate-x-1.5 transition-transform text-ink-muted">→</span>
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
            <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
              <span>{t("landing.tool3_eyebrow")}</span>
              <span className="group-hover:translate-x-1.5 transition-transform text-ink-muted">→</span>
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
            <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
              <span>{t("landing.tool4_eyebrow")}</span>
              <span className="group-hover:translate-x-1.5 transition-transform text-ink-muted">→</span>
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
  );
}
