"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n";

interface AerosolMetricsGridProps {
  pm25: number | null | undefined;
  pm10: number | null | undefined;
  aerosolRatio: number | null;
  koschmiederKm: number | null;
}

export function AerosolMetricsGrid({
  pm25,
  pm10,
  aerosolRatio,
  koschmiederKm,
}: AerosolMetricsGridProps) {
  const { t } = useTranslation();

  return (
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
            ? `${Math.round((pm10 / 100) * 100)}% of India 24h standard`
            : "Coarse dust fraction unavailable"}
        </div>
      </div>

      {/* Metric 3: Soot/Dust Ratio */}
      <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
          <span>Soot/Dust Ratio</span>
          <span className="font-mono text-2xs text-ink-muted">PM2.5/PM10</span>
        </div>
        <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
          {aerosolRatio != null ? `${aerosolRatio}%` : "--"}
        </div>
        <div className="text-xs font-sans text-ink/80 leading-snug">
          {aerosolRatio != null && aerosolRatio >= 65
            ? "Combustion soot & vehicle exhaust dominant"
            : "Fugitive road crustal dust dominant"}
        </div>
      </div>

      {/* Metric 4: Visual Range */}
      <div className="p-4 bg-paper border border-rule space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-sans font-bold uppercase tracking-wider text-ink-muted">
          <span>Visual Range (Lv)</span>
          <span className="font-mono text-2xs text-ink-muted">Koschmieder</span>
        </div>
        <div className="font-mono text-2xl md:text-3xl font-extrabold text-ink">
          {koschmiederKm != null ? `~${koschmiederKm.toFixed(1)} km` : "--"}
        </div>
        <div className="text-xs font-sans text-ink/80 leading-snug">
          Atmospheric contrast attenuation limit
        </div>
      </div>
    </div>
  );
}
