"use client";

import React, { useState } from "react";
import { useTranslation } from "@/lib/i18n";

export function ScientificAuditBanner() {
  const { t, lang } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);

  return (
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
          onClick={() => setShowDetail(!showDetail)}
          aria-expanded={showDetail}
          aria-controls="spatial-scale-explanation"
          className="text-xs font-sans font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 text-left sm:text-right inline-flex items-center gap-1"
        >
          <span>{showDetail ? t("landing.audit_collapse") : t("landing.audit_expand")}</span>
        </button>
      </div>

      {showDetail && (
        <div
          id="spatial-scale-explanation"
          className="pt-2 border-t hairline border-rule/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-ink/80 animate-fadeIn"
        >
          <div className="p-3.5 bg-surface border border-rule space-y-1.5">
            <div className="flex items-center justify-between font-bold text-ink uppercase tracking-wider text-2xs text-amber-900">
              <span>1. Commercial Roadside Sensors (e.g. aqi.in)</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 font-mono text-3xs font-semibold">
                Hyper-Local Point (~3m)
              </span>
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
              <span>2. Regional Atmospheric Models (SanjhiHawa)</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-mono text-3xs font-semibold">
                Atmospheric Grid (0.1° ≈ 11 km)
              </span>
            </div>
            <p>
              {lang === "hi"
                ? "पूरे वायुमंडलीय परत (ब्लैंकेट) का औसत वायु प्रदूषण मापते हैं जिसमें आप रहते हैं और सांस लेते हैं। यह सड़क किनारे के अचानक उठे धुएं के बजाय वास्तविक क्षेत्रीय प्रदूषण को दर्शाता है।"
                : lang === "mr"
                ? "संपूर्ण परिसरातील हवेच्या थराचा प्रत्यक्ष अभ्यास करून सामान्य नागरिक ज्या हवेत श्वास घेतो त्याचे शास्त्रीय विश्लेषण करते."
                : "SanjhiHawa utilizes CAMS regional chemical transport grids (0.1° resolution) cross-verified against CPCB reference beta-attenuation monitors (BAMs). It represents the true airshed baseline inhaled across entire neighborhoods, removing transient traffic spikes."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
