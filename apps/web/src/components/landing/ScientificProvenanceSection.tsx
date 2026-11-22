"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function ScientificProvenanceSection() {
  const { t } = useTranslation();

  return (
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
          <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
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
          <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
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
          <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
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
          <div className="text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
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
  );
}
