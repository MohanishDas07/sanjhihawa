"use client";

import React, { useState } from "react";
import { HourlyAirPoint, AirQualityResponse } from "@/types/api";
import { useTranslation, translateCity, translateAqiBand } from "@/lib/i18n";

interface DiurnalStats {
  list: HourlyAirPoint[];
  bestAfternoon: HourlyAirPoint | null;
  worstMorning: HourlyAirPoint | null;
  peakInversionRatio?: number;
  maxAqi: number;
}

interface DiurnalTimelineProps {
  city: string;
  diurnalStats: DiurnalStats | null;
  airData: AirQualityResponse | null;
  currentIstHour: number;
}

export function DiurnalTimeline({
  city,
  diurnalStats,
  airData,
  currentIstHour,
}: DiurnalTimelineProps) {
  const { t, lang } = useTranslation();
  const [selectedHourlyPoint, setSelectedHourlyPoint] = useState<HourlyAirPoint | null>(null);

  if (!diurnalStats || diurnalStats.list.length === 0) {
    return null;
  }

  return (
    <section
      className="bg-surface border hairline border-rule p-6 md:p-8 space-y-6 shadow-sm"
      aria-label="24-Hour Atmospheric Inversion & Exposure Timeline"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b hairline border-rule pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-sans font-bold uppercase tracking-widest text-ink-muted">
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
                className="relative w-full flex flex-col justify-end items-center group transition-all duration-150 focus:outline-none"
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
            <span className="text-xs font-semibold uppercase text-ink-muted tracking-wider block">
              {lang === "hi" ? "अनुमानित AQI" : lang === "mr" ? "अंदाजित AQI" : "Forecast AQI"}
            </span>
            <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
              {selectedHourlyPoint ? selectedHourlyPoint.cpcb_aqi : airData?.current_cpcb_aqi ?? "--"}
            </strong>
          </div>
          <div className="border-l hairline border-rule pl-5 text-right sm:text-left">
            <span className="text-xs font-semibold uppercase text-ink-muted tracking-wider block">
              {lang === "hi" ? "PM2.5 सांद्रता" : lang === "mr" ? "PM2.5 पातळी" : "PM2.5 Conc."}
            </span>
            <strong className="font-mono text-ink text-xl md:text-2xl font-bold">
              {selectedHourlyPoint ? `${selectedHourlyPoint.pm2_5} µg/m³` : `${airData?.current_pm2_5 ?? "--"} µg/m³`}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
