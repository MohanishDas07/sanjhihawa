/**
 * Browser Geolocation & Live Spatial Resolution Service.
 * Allows users to detect their exact device GPS coordinates,
 * reverse-geocodes to the closest canonical Indian city/region,
 * and synchronizes coordinates with the household breath budget profile.
 */

import { reverseGeocode } from "@/lib/api";
import { getStoredProfile, saveStoredProfile } from "@/lib/storage";

export interface LiveLocationData {
  latitude: number;
  longitude: number;
  cityName: string;
  displayName: string;
  admin1?: string | null;
  accuracyMeters?: number;
  distanceKm?: number;
  timestamp: number;
}

export interface LiveLocationResult {
  success: boolean;
  data?: LiveLocationData;
  error?: string;
}

const STORAGE_KEY = "saans_live_location";

/**
 * Retrieve previously saved live GPS location from this session.
 */
export function getStoredLiveLocation(): LiveLocationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LiveLocationData;
  } catch {
    return null;
  }
}

/**
 * Request real-time device GPS coordinates via HTML5 Geolocation API,
 * reverse geocode to nearest Indian city/station, and update the household profile.
 */
export async function requestLiveLocation(): Promise<LiveLocationResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      success: false,
      error: "Geolocation is not supported by your browser.",
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLon = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 0);

        // Round coordinates to 4 decimal places (~11m resolution)
        const lat = Number(rawLat.toFixed(4));
        const lon = Number(rawLon.toFixed(4));

        let cityName = `Loc (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`;
        let displayName = cityName;
        let admin1: string | null = null;
        let distanceKm: number | undefined = undefined;

        try {
          const rev = await reverseGeocode(lat, lon);
          if (rev && rev.name) {
            cityName = rev.name;
            displayName = rev.display_name || rev.name;
            admin1 = rev.admin1 || null;
            distanceKm = rev.distance_km;
          }
        } catch (err) {
          console.warn("Reverse geocode failed, using raw coordinates", err);
        }

        const liveData: LiveLocationData = {
          latitude: lat,
          longitude: lon,
          cityName,
          displayName,
          admin1,
          accuracyMeters: accuracy,
          distanceKm,
          timestamp: Date.now(),
        };

        // Cache live location in localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(liveData));
        } catch {
          // Ignore quota issues
        }

        // Sync with user's stored HouseholdProfile
        try {
          const currentProfile = getStoredProfile();
          const updatedProfile = {
            ...currentProfile,
            city_name: cityName,
            latitude: lat,
            longitude: lon,
          };
          saveStoredProfile(updatedProfile);
        } catch (err) {
          console.warn("Failed to synchronize profile with live location", err);
        }

        // Emit custom browser event for reactive UI components
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("saans:location-updated", { detail: liveData })
          );
        }

        resolve({
          success: true,
          data: liveData,
        });
      },
      (err) => {
        let msg = "Could not detect your live location.";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "Location permission denied in your browser. Please allow location access or search your city manually.";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "GPS/Location position is currently unavailable on your device. Please search your city manually.";
            break;
          case err.TIMEOUT:
            msg = "Location request timed out. Please check device GPS and retry.";
            break;
        }
        resolve({
          success: false,
          error: msg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
