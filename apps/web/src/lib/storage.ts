/**
 * Client-Side Household Profile Storage.
 * Privacy by Design: Profile data stays strictly in browser localStorage.
 * No user accounts, zero server-side persistence.
 */

import { HouseholdProfile } from "@/types/api";

const STORAGE_KEY = "saans_household_profile_v1";

export const DEMO_GHAZIABAD_PROFILE: HouseholdProfile = {
  city_name: "Ghaziabad",
  latitude: 28.6692,
  longitude: 77.4538,
  members: [
    { id: "adult_1", label: "Father (Adult)", age_band: "adult", is_breathing_sensitive: false },
    { id: "adult_2", label: "Mother (Adult)", age_band: "adult", is_breathing_sensitive: false },
    { id: "child_1", label: "Aarav (Child, 9 yr)", age_band: "child", is_breathing_sensitive: true },
    { id: "senior_1", label: "Dadi (Senior, 68 yr)", age_band: "senior", is_breathing_sensitive: false },
  ],
  commute_mode: "two_wheeler_petrol",
  commute_distance_km: 12.0,
  cooking_fuel: "lpg",
  home_type: "standard_closed",
  has_purifier: false,
  purifier_cadr: 0,
  budget_band: "under_1k",
};

function encodePayload(str: string): string {
  try {
    return "enc_" + btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
}

function decodePayload(raw: string): string {
  if (raw.startsWith("enc_")) {
    try {
      return decodeURIComponent(atob(raw.slice(4)));
    } catch {
      return raw.slice(4);
    }
  }
  return raw;
}

export function getStoredProfile(): HouseholdProfile {
  if (typeof window === "undefined") {
    return DEMO_GHAZIABAD_PROFILE;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO_GHAZIABAD_PROFILE;
    const decoded = decodePayload(raw);
    const parsed = JSON.parse(decoded) as HouseholdProfile;
    if (!parsed || typeof parsed !== "object" || typeof parsed.city_name !== "string") {
      return DEMO_GHAZIABAD_PROFILE;
    }
    return parsed;
  } catch {
    return DEMO_GHAZIABAD_PROFILE;
  }
}

export function saveStoredProfile(profile: HouseholdProfile): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(profile);
    localStorage.setItem(STORAGE_KEY, encodePayload(serialized));
  } catch (err) {
    console.error("Failed to save profile locally", err);
  }
}

export function deleteStoredProfile(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to delete profile", err);
  }
}
