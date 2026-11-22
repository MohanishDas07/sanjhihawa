"use client";

import React, { useState, useEffect } from "react";
import {
  requestLiveLocation,
  getStoredLiveLocation,
  LiveLocationData,
} from "@/lib/geolocation";

interface LiveLocationButtonProps {
  onLocationDetected?: (data: LiveLocationData) => void;
  className?: string;
  variant?: "button" | "card" | "badge";
  compact?: boolean;
}

export const LiveLocationButton: React.FC<LiveLocationButtonProps> = ({
  onLocationDetected,
  className = "",
  variant = "button",
  compact = false,
}) => {
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [liveData, setLiveData] = useState<LiveLocationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = getStoredLiveLocation();
    if (saved) {
      setLiveData(saved);
    }

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<LiveLocationData>;
      if (customEvent.detail) {
        setLiveData(customEvent.detail);
      }
    };

    window.addEventListener("saans:location-updated", handleUpdate);
    return () => window.removeEventListener("saans:location-updated", handleUpdate);
  }, []);

  const handleDetect = async () => {
    setIsLocating(true);
    setErrorMessage(null);
    try {
      const res = await requestLiveLocation();
      if (res.success && res.data) {
        setLiveData(res.data);
        if (onLocationDetected) {
          onLocationDetected(res.data);
        }
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch {
      setErrorMessage("Device location service is temporarily unreachable.");
    } finally {
      setIsLocating(false);
    }
  };

  if (variant === "card") {
    return (
      <div className={`p-4 bg-surface border hairline border-rule space-y-3 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs uppercase tracking-wider font-bold text-ink flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Live GPS Location
              </span>
              {liveData && (
                <span className="text-2xs font-mono bg-paper border border-rule px-1.5 py-0.5 text-ink">
                  {liveData.latitude.toFixed(2)}° N, {liveData.longitude.toFixed(2)}° E
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              Directly detect your device GPS to calculate personalized breath budgets and hourly exposure curves without manual search.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDetect}
            disabled={isLocating}
            className="self-start sm:self-auto px-4 py-2 bg-ink text-paper text-xs font-mono uppercase tracking-wide hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            {isLocating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                <span>Acquiring GPS...</span>
              </>
            ) : liveData ? (
              <>
                <span>📍 Refresh Location</span>
              </>
            ) : (
              <>
                <span>📍 Use My Location</span>
              </>
            )}
          </button>
        </div>

        {liveData && (
          <div className="font-mono text-2xs text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 flex items-center justify-between">
            <span>
              ✓ Resolved to nearest urban station: <strong>{liveData.displayName}</strong>
              {liveData.distanceKm !== undefined && liveData.distanceKm > 0 && (
                <span className="text-emerald-700 ml-1.5">
                  ({liveData.distanceKm} km away)
                </span>
              )}
            </span>
            <span className="text-emerald-700">Accuracy ~{liveData.accuracyMeters}m</span>
          </div>
        )}

        {errorMessage && (
          <div className="font-mono text-2xs text-amber-900 bg-amber-50 border border-amber-300 p-2 flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-800 underline hover:text-amber-950 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative inline-flex flex-col items-start ${className}`}>
      <button
        type="button"
        onClick={handleDetect}
        disabled={isLocating}
        aria-label="Detect live device GPS location"
        className={`font-mono text-2xs transition-all flex items-center gap-1.5 ${
          compact ? "px-2 py-0.5" : "px-2.5 py-1"
        } ${
          liveData
            ? "bg-emerald-50 border border-emerald-600 text-emerald-950 font-semibold"
            : "bg-surface border border-rule hover:bg-paper text-ink"
        } disabled:opacity-50`}
        title={liveData ? `Live GPS: ${liveData.displayName}` : "Detect GPS coordinates and calculate live air details"}
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isLocating
              ? "bg-amber-500 animate-ping"
              : liveData
              ? "bg-emerald-600 animate-pulse"
              : "bg-ink-muted"
          }`}
        />
        {isLocating ? (
          "Acquiring GPS..."
        ) : liveData ? (
          <>
            <span>📍 {liveData.cityName}</span>
            <span className="text-3xs text-emerald-800 opacity-80 font-normal">
              ({liveData.latitude.toFixed(1)}°, {liveData.longitude.toFixed(1)}°)
            </span>
          </>
        ) : (
          "📍 Live Location"
        )}
      </button>

      {errorMessage && (
        <div className="absolute top-full left-0 z-30 mt-1 w-64 bg-amber-50 border border-amber-300 p-2 text-2xs font-mono text-amber-900 shadow-md">
          <div className="flex items-start justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-800 hover:text-amber-950 ml-1 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
