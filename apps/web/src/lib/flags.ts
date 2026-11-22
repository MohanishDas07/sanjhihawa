/**
 * Central Feature Flag Management for SAANS.
 * Unreleased experimental features default to false unless explicitly enabled.
 */

export const FEATURE_FLAGS = {
  wardMap: process.env.NEXT_PUBLIC_FF_WARD_MAP === "true",
  routeComparison: process.env.NEXT_PUBLIC_FF_ROUTE_COMP === "true",
  weeklyReport: process.env.NEXT_PUBLIC_FF_WEEKLY_REPORT === "true",
  voiceApi: process.env.NEXT_PUBLIC_FF_VOICE === "true",
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag] ?? false;
}
