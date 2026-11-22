"use client";

import React, { useState, useEffect } from "react";
import { simulateInterventions } from "@/lib/api";
import { getStoredProfile } from "@/lib/storage";
import { SimulateResponse, HouseholdProfile } from "@/types/api";
import { useTranslation, translateCity } from "@/lib/i18n";

const SIMULATOR_OPTIONS = [
  {
    id: "shift_ventilation_afternoon",
    tier: "₹0 Free Habit",
    name: "Shift Window Airing to Midday (12 PM - 3 PM)",
    category: "Ventilation",
    desc: "Avoids morning thermal inversion. Cleanest outdoor window.",
  },
  {
    id: "wet_mopping_no_dry_sweeping",
    tier: "₹0 Free Habit",
    name: "Wet Mopping Only (Stop Dry Sweeping)",
    category: "Indoor Surface",
    desc: "Prevents toxic settled fine particulate resuspension into room air.",
  },
  {
    id: "towel_door_draft_stopper",
    tier: "₹0 Free Habit",
    name: "Door Bottom Damp Towel / Draft Stopper",
    category: "Sealing",
    desc: "Blocks street-level smoke ingress under doors and floor gaps.",
  },
  {
    id: "family_n95_masks",
    tier: "< ₹1,000",
    name: "Certified ISI/BIS N95 Masks for Daily Commutes",
    category: "Personal Protection",
    desc: "Fit-adjusted 85% effective fine particulate reduction on roads.",
  },
  {
    id: "foam_weatherstripping_tape",
    tier: "< ₹1,000",
    name: "Self-Adhesive Foam Weatherstripping Tape for Windows",
    category: "Sealing",
    desc: "Cuts building envelope infiltration draft by over 30%.",
  },
  {
    id: "hepa_room_purifier",
    tier: "> ₹5,000",
    name: "True HEPA Air Purifier in Bedroom (CADR 250 m³/h)",
    category: "Filtration",
    desc: "Reduces bedroom particulate levels by 70-85% during 8 hours of sleep.",
  },
  {
    id: "switch_metro_commute",
    tier: "Transport Switch",
    name: "Switch Solo Two-Wheeler Commute to Metro Rail",
    category: "Sustainability & Transport",
    desc: "Eliminates personal tailpipe exhaust and roadside inhalation.",
  },
];

export default function SimulatePage() {
  const { t, lang } = useTranslation();
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "shift_ventilation_afternoon",
    "family_n95_masks",
  ]);
  const [communityCount, setCommunityCount] = useState<number>(200);
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const p = getStoredProfile();
    setProfile(p);
  }, []);

  const runSim = async (currentProfile: HouseholdProfile, ids: string[], count: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await simulateInterventions({
        profile: currentProfile,
        selected_intervention_ids: ids,
        community_household_count: count,
      });
      setSimResult(res);
    } catch (err: any) {
      console.error("Simulation failed", err);
      setErrorMessage("Could not recalculate simulation. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      runSim(profile, selectedIds, communityCount);
    }
  }, [profile, selectedIds, communityCount]);

  const toggleIntervention = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAllZero = () => {
    setSelectedIds(["shift_ventilation_afternoon", "wet_mopping_no_dry_sweeping", "towel_door_draft_stopper"]);
  };

  const selectFullShield = () => {
    setSelectedIds([
      "shift_ventilation_afternoon",
      "wet_mopping_no_dry_sweeping",
      "towel_door_draft_stopper",
      "family_n95_masks",
      "foam_weatherstripping_tape",
      "hepa_room_purifier",
      "switch_metro_commute",
    ]);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b hairline border-rule pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
            Dual-Lens Impact Modeling • {translateCity(profile?.city_name || "Delhi", lang)}
          </span>
          <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-ink mt-1 tracking-tight">
            {t("simulate.title")}
          </h1>
          <p className="text-sm md:text-base text-ink-muted mt-1 max-w-2xl leading-relaxed">
            {t("simulate.subtitle")}
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex space-x-2 font-mono text-xs">
          <button
            onClick={selectAllZero}
            className="px-3 py-1.5 border border-rule bg-surface hover:bg-paper text-ink"
          >
            {t("simulate.btn_preset_free")}
          </button>
          <button
            onClick={selectFullShield}
            className="px-3 py-1.5 bg-ink text-paper hover:opacity-90 font-bold"
          >
            {t("simulate.btn_preset_full")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Toggles (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center border-b hairline border-rule pb-2">
            <span className="font-mono text-xs uppercase tracking-wider font-bold text-ink">
              {t("simulate.select_title")}
            </span>
            <span className="font-mono text-xs text-ink-muted">
              {selectedIds.length} {t("simulate.active_count")} {SIMULATOR_OPTIONS.length} {lang === "hi" ? "सक्रिय" : lang === "mr" ? "सक्रिय" : "active"}
            </span>
          </div>

          <div className="space-y-2.5">
            {SIMULATOR_OPTIONS.map((opt) => {
              const active = selectedIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleIntervention(opt.id)}
                  className={`p-4 border cursor-pointer transition-all ${
                    active
                      ? "bg-surface border-ink shadow-sm"
                      : "bg-paper border-rule hover:border-ink/60 opacity-80"
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {}} // handled by parent div
                      className="mt-1 h-4 w-4 rounded border-rule text-ink focus:ring-ink"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-base font-bold text-ink">
                          {opt.name}
                        </span>
                        <span className="font-mono text-2xs px-2 py-0.5 bg-paper border border-rule text-ink-muted">
                          {opt.tier}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Community Scale Slider */}
          <div className="p-4 bg-surface border border-rule space-y-2 mt-4">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-ink">{t("simulate.community_slider")}</span>
              <span className="px-2 py-0.5 bg-paper border border-rule font-bold text-ink">
                {communityCount} {lang === "hi" ? "परिवार" : lang === "mr" ? "कुटुंबे" : "households"}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="1000"
              step="10"
              value={communityCount}
              onChange={(e) => setCommunityCount(parseInt(e.target.value) || 1)}
              className="w-full accent-ink cursor-pointer"
            />
            <div className="flex justify-between text-2xs font-mono text-ink-muted">
              <span>Single Household (1)</span>
              <span>RWA / Apartment Complex (200)</span>
              <span>Ward / Neighborhood (1,000)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dual-Lens Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Lens A: What You Breathe */}
          <div className="p-6 bg-surface border-2 border-ink space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b hairline border-rule pb-2">
              <span className="font-mono text-xs uppercase font-bold text-ink">
                Lens A: What You Breathe
              </span>
              <span className="font-mono text-2xs text-ink-muted">Personal Exposure</span>
            </div>

            {loading ? (
              <div className="font-mono text-xs text-ink-muted py-6 text-center">Recalculating dose deltas...</div>
            ) : errorMessage ? (
              <div className="font-mono text-xs text-amber-800 py-6 text-center bg-paper border border-rule p-3">
                {errorMessage}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dose Delta */}
                <div>
                  <span className="font-mono text-2xs uppercase text-ink-muted block">Inhaled Dose Avoided</span>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="font-mono text-4xl font-extrabold text-green-800">
                      -{simResult?.dose_reduction_pct}%
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      ({simResult?.dose_reduction_ug} µg saved/day)
                    </span>
                  </div>
                </div>

                {/* Cigarettes Saved */}
                <div className="p-3 bg-paper border border-rule space-y-1">
                  <span className="font-mono text-2xs uppercase text-ink-muted block">
                    Cigarette-Equivalents Avoided (Heuristic)
                  </span>
                  <div className="flex items-baseline space-x-2">
                    <span className="font-mono text-2xl font-bold text-ink">
                      -{simResult?.cigs_saved}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      cigs/day (From {simResult?.baseline_cigs} down to {simResult?.simulated_cigs})
                    </span>
                  </div>
                  <p className="text-2xs text-ink-muted leading-tight pt-1">
                    Illustrative exposure heuristic (Berkeley Earth: 22 µg/m³ ≈ 1 cig).
                  </p>
                </div>

                {/* Financial Investment */}
                <div className="flex justify-between items-center text-xs font-mono pt-2 border-t hairline border-rule">
                  <span className="text-ink-muted">Total One-Time Cost:</span>
                  <strong className="text-ink text-sm">
                    {simResult?.total_cost_inr === 0 ? "₹0 (Free Habits)" : `₹${simResult?.total_cost_inr.toLocaleString("en-IN")}`}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Lens B: What You Stop Emitting (Sustainability Layer) */}
          <div className="p-6 bg-paper border border-rule space-y-4">
            <div className="flex items-center justify-between border-b hairline border-rule pb-2">
              <span className="font-mono text-xs uppercase font-bold text-ink">
                Lens B: What You Stop Emitting
              </span>
              <span className="font-mono text-2xs text-ink-muted">Sustainability Impact</span>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="p-3 bg-surface border border-rule space-y-1">
                <span className="text-2xs uppercase text-ink-muted block">Direct PM2.5 Prevented</span>
                <div className="text-lg font-bold text-ink">
                  {simResult?.pm25_emissions_avoided_g} g <span className="text-xs font-normal text-ink-muted">/ day (Personal)</span>
                </div>
                <div className="text-xs font-bold text-green-900">
                  {simResult?.community_pm25_avoided_g} grams / day <span className="text-2xs font-normal">({communityCount} households)</span>
                </div>
              </div>

              <div className="p-3 bg-surface border border-rule space-y-1">
                <span className="text-2xs uppercase text-ink-muted block">CO2e Emissions Prevented</span>
                <div className="text-lg font-bold text-ink">
                  {simResult?.co2e_emissions_avoided_kg} kg <span className="text-xs font-normal text-ink-muted">/ day (Personal)</span>
                </div>
                <div className="text-xs font-bold text-green-900">
                  {simResult?.community_co2e_avoided_kg} kg CO2e / day <span className="text-2xs font-normal">({communityCount} households)</span>
                </div>
              </div>
            </div>

            <p className="text-2xs text-ink-muted leading-relaxed">
              Calculated using ARAI/CPCB transport factors (0.045 g PM2.5/km for two-wheelers vs 0.001 for metro) and CEA grid baseline emission standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
