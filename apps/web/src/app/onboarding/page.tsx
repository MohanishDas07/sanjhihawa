"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  HouseholdProfile,
  FamilyMember,
  GeocodeItem,
} from "@/types/api";
import {
  getStoredProfile,
  saveStoredProfile,
  deleteStoredProfile,
  DEMO_GHAZIABAD_PROFILE,
} from "@/lib/storage";
import { searchCities } from "@/lib/api";
import { POPULAR_INDIAN_CITIES, CityOption } from "@/lib/cities";

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<HouseholdProfile>(DEMO_GHAZIABAD_PROFILE);
  const [step, setStep] = useState<number>(1);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Search state for ANY Indian city
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(getStoredProfile());
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for any Indian city
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchCities(searchQuery);
        setSearchResults(res.results || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCity = (item: GeocodeItem) => {
    setProfile({
      ...profile,
      city_name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleQuickSelectCity = (c: CityOption) => {
    setProfile({
      ...profile,
      city_name: c.name,
      latitude: c.lat,
      longitude: c.lon,
    });
  };

  const handleMemberChange = (index: number, field: keyof FamilyMember, val: any) => {
    const updated = [...profile.members];
    updated[index] = { ...updated[index], [field]: val };
    setProfile({ ...profile, members: updated });
  };

  const addMember = () => {
    const newMember: FamilyMember = {
      id: `member_${Date.now()}`,
      label: `Family Member ${profile.members.length + 1}`,
      age_band: "adult",
      is_breathing_sensitive: false,
    };
    setProfile({ ...profile, members: [...profile.members, newMember] });
  };

  const removeMember = (index: number) => {
    if (profile.members.length <= 1) return;
    const updated = profile.members.filter((_, i) => i !== index);
    setProfile({ ...profile, members: updated });
  };

  const handleSaveAndProceed = () => {
    saveStoredProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => {
      router.push("/your-day");
    }, 400);
  };

  const handleResetData = () => {
    if (confirm("Delete all stored household data from your browser? This cannot be undone.")) {
      deleteStoredProfile();
      setProfile(DEMO_GHAZIABAD_PROFILE);
      alert("Local data erased.");
    }
  };

  const handleLoadStandardTemplate = () => {
    setProfile(DEMO_GHAZIABAD_PROFILE);
    saveStoredProfile(DEMO_GHAZIABAD_PROFILE);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="border-b hairline border-rule pb-4 flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">Household Setup</span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink mt-1">
            Build Your Household's Profile
          </h1>
          <p className="text-sm md:text-base text-ink-muted mt-1 leading-relaxed">
            Stored strictly in your browser. Used to calculate personalized Breath Budgets and exposure deltas.
          </p>
        </div>

        <button
          onClick={handleLoadStandardTemplate}
          className="self-start sm:self-auto font-mono text-xs px-3 py-1.5 bg-paper border border-rule hover:bg-surface text-ink transition-colors"
          title="Fill with standard 4-member household template"
        >
          Standard Family Template
        </button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between border-b hairline border-rule pb-3 font-mono text-xs">
        <div className="flex space-x-4">
          <button
            onClick={() => setStep(1)}
            className={`pb-1 ${step === 1 ? "font-bold text-ink border-b-2 border-ink" : "text-ink-muted"}`}
          >
            01 / Location & Home
          </button>
          <button
            onClick={() => setStep(2)}
            className={`pb-1 ${step === 2 ? "font-bold text-ink border-b-2 border-ink" : "text-ink-muted"}`}
          >
            02 / Family Members
          </button>
          <button
            onClick={() => setStep(3)}
            className={`pb-1 ${step === 3 ? "font-bold text-ink border-b-2 border-ink" : "text-ink-muted"}`}
          >
            03 / Commute & Fuel
          </button>
          <button
            onClick={() => setStep(4)}
            className={`pb-1 ${step === 4 ? "font-bold text-ink border-b-2 border-ink" : "text-ink-muted"}`}
          >
            04 / Budget & Purifier
          </button>
        </div>
        <span className="text-ink-muted">Step {step} of 4</span>
      </div>

      {/* Step 1: Location & Home Type */}
      {step === 1 && (
        <section className="bg-surface border hairline border-rule p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="block text-sm font-semibold text-ink">
                City / Location
              </label>
              <span className="font-mono text-xs text-ink-muted">
                Selected: <strong className="text-ink">{profile.city_name}</strong> ({profile.latitude.toFixed(2)}° N, {profile.longitude.toFixed(2)}° E)
              </span>
            </div>

            {/* Live Search for ANY Indian city */}
            <div ref={searchContainerRef} className="relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  placeholder="🔍 Search any Indian city, district or town (e.g. Pune, Mumbai, Bengaluru, Jaipur, Patna)..."
                  className="w-full font-sans text-sm p-2.5 pl-3 pr-20 border border-rule bg-paper text-ink focus:outline-none focus:border-ink placeholder:text-ink-muted/60"
                  aria-label="Search any Indian city"
                />
                {isSearching && (
                  <span className="absolute right-3 top-2.5 text-xs text-ink-muted animate-pulse font-mono">
                    Searching...
                  </span>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-paper border border-ink shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <button
                      key={`${item.name}-${item.latitude}-${idx}`}
                      type="button"
                      onClick={() => handleSelectCity(item)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface border-b border-rule last:border-b-0 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-ink">{item.name}</span>
                        {item.admin1 && (
                          <span className="text-xs text-ink-muted ml-2">
                            {item.admin1}
                          </span>
                        )}
                      </div>
                      <span className="text-2xs font-mono text-ink-muted">
                        {item.latitude.toFixed(2)}°N, {item.longitude.toFixed(2)}°E
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && !isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-paper border border-rule p-3 text-xs text-ink-muted">
                  No Indian place found matching "{searchQuery}". Try searching a major district or city name.
                </div>
              )}
            </div>

            {/* Popular Urban Hubs Grid */}
            <div className="space-y-1.5">
              <span className="text-2xs font-mono uppercase tracking-wider text-ink-muted">
                Quick Select: Major Urban Hubs & Capitals
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {POPULAR_INDIAN_CITIES.map((c) => {
                  const isSelected = profile.city_name.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleQuickSelectCity(c)}
                      className={`p-2 border text-left transition-colors ${
                        isSelected
                          ? "border-ink bg-paper font-bold text-ink ring-1 ring-ink"
                          : "border-rule bg-surface text-ink-muted hover:border-ink hover:text-ink"
                      }`}
                    >
                      <span className="block font-sans text-xs truncate">{c.name}</span>
                      <span className="block text-3xs font-mono text-ink-muted truncate">{c.region}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="home-type-select" className="block text-sm font-semibold text-ink">
              Home Building Envelope & Sealing
            </label>
            <select
              id="home-type-select"
              value={profile.home_type}
              onChange={(e) => setProfile({ ...profile, home_type: e.target.value as any })}
              className="w-full font-mono text-sm p-2.5 border border-rule bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-ink"
            >
              <option value="standard_closed">Standard Apartment (Windows closed, average infiltration)</option>
              <option value="sealed_closed">Well-Sealed / Weatherstripped (Low air exchange, 0.4/h)</option>
              <option value="leaky_closed">Leaky / Older Construction (High perimeter draft infiltration, 1.5/h)</option>
              <option value="windows_open">Windows Regularly Kept Open (Unrestricted outside air exchange)</option>
            </select>
            <p className="text-2xs text-ink-muted">
              Used by single-compartment mass-balance equation: C_in = C_out × (a × P) / (a + k)
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-ink text-paper text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Next: Family Members →
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Household Members */}
      {step === 2 && (
        <section className="bg-surface border hairline border-rule p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-ink">Family Members & Vulnerability</h2>
              <p className="text-xs text-ink-muted">
                Inhalation rates vary significantly across age bands (US EPA Exposure Handbook).
              </p>
            </div>
            <button
              onClick={addMember}
              className="font-mono text-xs px-3 py-1.5 border border-rule bg-paper hover:bg-surface text-ink"
            >
              + Add Member
            </button>
          </div>

          <div className="space-y-3">
            {profile.members.map((member, idx) => (
              <div
                key={member.id}
                className="p-4 border border-rule bg-paper flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
              >
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={member.label}
                    onChange={(e) => handleMemberChange(idx, "label", e.target.value)}
                    className="font-semibold text-ink bg-transparent border-b border-rule focus:border-ink focus:outline-none w-full"
                    placeholder="Name / Label"
                  />
                  <div className="flex items-center space-x-3 text-xs text-ink-muted">
                    <label>
                      Age Band:
                      <select
                        value={member.age_band}
                        onChange={(e) => handleMemberChange(idx, "age_band", e.target.value)}
                        className="ml-1 font-mono text-xs p-1 bg-surface border border-rule"
                      >
                        <option value="infant">Infant (0-2 yr)</option>
                        <option value="child">Child (3-14 yr)</option>
                        <option value="adult">Adult (15-64 yr)</option>
                        <option value="senior">Senior (65+ yr)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={member.is_breathing_sensitive}
                      onChange={(e) => handleMemberChange(idx, "is_breathing_sensitive", e.target.checked)}
                      className="rounded border-rule text-ink focus:ring-ink"
                    />
                    <span className="font-medium text-red-900 bg-red-100 px-1.5 py-0.5 rounded">
                      Breathing Sensitive (Asthma/Bronchitis)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!member.is_outdoor_worker}
                      onChange={(e) => handleMemberChange(idx, "is_outdoor_worker", e.target.checked)}
                      className="rounded border-rule text-ink focus:ring-ink"
                    />
                    <span className="text-ink-muted">
                      Outdoor Worker
                    </span>
                  </label>

                  {profile.members.length > 1 && (
                    <button
                      onClick={() => removeMember(idx)}
                      className="text-red-700 hover:text-red-900 font-mono text-xs px-2 py-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t hairline border-rule">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-rule bg-surface text-ink text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-ink text-paper text-sm font-semibold hover:opacity-90"
            >
              Next: Commute & Fuel →
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Commute & Cooking Fuel */}
      {step === 3 && (
        <section className="bg-surface border hairline border-rule p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="commute-mode-select" className="block text-sm font-semibold text-ink">
              Primary Daily Commute Mode
            </label>
            <select
              id="commute-mode-select"
              value={profile.commute_mode}
              onChange={(e) => setProfile({ ...profile, commute_mode: e.target.value as any })}
              className="w-full font-mono text-sm p-2.5 border border-rule bg-paper text-ink focus:outline-none"
            >
              <option value="two_wheeler_petrol">Two-Wheeler / Motorcycle (Petrol, direct street exhaust exposure)</option>
              <option value="two_wheeler_ev">Electric Two-Wheeler (EV)</option>
              <option value="car_petrol">Private Hatchback Car (AC with cabin recirculation)</option>
              <option value="bus_cng">CNG Public Bus</option>
              <option value="metro">Metro Rail (Air-filtered underground/elevated)</option>
              <option value="walking">Walking / Cycling (High physical exertion on roadside)</option>
              <option value="none">Work from Home / No Daily Commute</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="commute-dist-input" className="block text-sm font-semibold text-ink">
              Roundtrip Commute Distance (km)
            </label>
            <input
              id="commute-dist-input"
              type="number"
              min="0"
              max="150"
              value={profile.commute_distance_km}
              onChange={(e) => setProfile({ ...profile, commute_distance_km: parseFloat(e.target.value) || 0 })}
              className="w-full font-mono text-sm p-2.5 border border-rule bg-paper text-ink focus:outline-none"
            />
            <p className="text-2xs text-ink-muted">
              Used to calculate personal exhaust exposure slice and tailpipe emissions avoided in What-If simulator.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="cooking-fuel-select" className="block text-sm font-semibold text-ink">
              Primary Household Cooking Fuel
            </label>
            <select
              id="cooking-fuel-select"
              value={profile.cooking_fuel}
              onChange={(e) => setProfile({ ...profile, cooking_fuel: e.target.value as any })}
              className="w-full font-mono text-sm p-2.5 border border-rule bg-paper text-ink focus:outline-none"
            >
              <option value="lpg">LPG Cylinder / Piped Natural Gas (PNG)</option>
              <option value="induction">Electric Induction Cooktop (Zero indoor combustion fumes)</option>
              <option value="biomass">Biomass / Chulha (High indoor PM2.5 generation)</option>
            </select>
          </div>

          <div className="flex justify-between pt-4 border-t hairline border-rule">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-rule bg-surface text-ink text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2.5 bg-ink text-paper text-sm font-semibold hover:opacity-90"
            >
              Next: Budget & Filtration →
            </button>
          </div>
        </section>
      )}

      {/* Step 4: Budget & Air Purifiers */}
      {step === 4 && (
        <section className="bg-surface border hairline border-rule p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-ink">
              Current Air Purifier Status
            </label>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="has_purifier"
                  checked={profile.has_purifier}
                  onChange={() => setProfile({ ...profile, has_purifier: true, purifier_cadr: profile.purifier_cadr || 250 })}
                  className="text-ink focus:ring-ink"
                />
                <span>Yes, have an air purifier</span>
              </label>
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="has_purifier"
                  checked={!profile.has_purifier}
                  onChange={() => setProfile({ ...profile, has_purifier: false, purifier_cadr: 0 })}
                  className="text-ink focus:ring-ink"
                />
                <span>No existing purifier</span>
              </label>
            </div>

            {profile.has_purifier && (
              <div className="mt-3 p-3 bg-paper border border-rule space-y-1">
                <label htmlFor="cadr-input" className="block text-xs font-mono text-ink">
                  Purifier Clean Air Delivery Rate (CADR in m³/h):
                </label>
                <input
                  id="cadr-input"
                  type="number"
                  min="50"
                  max="1000"
                  value={profile.purifier_cadr}
                  onChange={(e) => setProfile({ ...profile, purifier_cadr: parseFloat(e.target.value) || 0 })}
                  className="w-full font-mono text-sm p-2 border border-rule bg-surface"
                />
                <span className="text-2xs text-ink-muted block">
                  Typical bedroom purifier CADR is 200 - 300 m³/h.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-ink">
              Intervention Budget Band
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "zero", title: "₹0 Free Habits", desc: "Window timing, wet mopping, door bottom towels" },
                { id: "under_1k", title: "Under ₹1,000", desc: "N95 masks, foam tape sealing, DIY door drafts" },
                { id: "over_5k", title: "Over ₹5,000", desc: "True HEPA bedroom purifier, induction stove" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setProfile({ ...profile, budget_band: tier.id as any })}
                  className={`p-3 border text-left font-sans text-sm transition-colors ${
                    profile.budget_band === tier.id
                      ? "border-ink bg-paper font-bold text-ink"
                      : "border-rule bg-surface text-ink-muted hover:border-ink"
                  }`}
                >
                  <span className="block font-serif text-sm">{tier.title}</span>
                  <span className="block text-2xs text-ink-muted mt-1 leading-normal">{tier.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t hairline border-rule">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 border border-rule bg-surface text-ink text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={handleSaveAndProceed}
              className="px-8 py-3 bg-ink text-paper text-sm font-bold tracking-wide hover:opacity-90 shadow-sm"
            >
              Save Profile & View Your Day Plan →
            </button>
          </div>
        </section>
      )}

      {/* Privacy Guarantee & Erase Data */}
      <div className="border border-rule bg-paper p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-ink-muted">
        <div>
          <span className="font-bold text-ink uppercase">Privacy Guarantee:</span> This profile is stored strictly in your browser's localStorage. Zero accounts, zero server tracking.
        </div>
        <button
          onClick={handleResetData}
          className="text-red-700 hover:text-red-900 underline whitespace-nowrap"
        >
          Delete My Stored Data
        </button>
      </div>
    </div>
  );
}
