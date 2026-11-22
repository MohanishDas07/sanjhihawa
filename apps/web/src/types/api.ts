/**
 * TypeScript Data Contracts for SAANS Web Application.
 * Synchronized strictly with FastAPI OpenAPI schema (apps/api/schemas/contracts.py).
 * DO NOT EDIT MANUALLY - Keep in lockstep with backend contracts.
 */

export interface HealthResponse {
  status: "healthy" | "degraded" | "offline";
  version: string;
  service: string;
  offline_fallback_available: boolean;
  cache_backend: string;
}

export interface GeocodeItem {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string | null;
}

export interface GeocodeResponse {
  query: string;
  results: GeocodeItem[];
}

export interface ReverseGeocodeResponse {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string | null;
  distance_km: number;
  display_name: string;
}

export interface HourlyAirPoint {
  hour: number;
  time_iso: string;
  pm2_5: number;
  pm10?: number | null;
  cpcb_aqi: number;
  aqi_band_code: "good" | "satisfactory" | "moderate" | "poor" | "very_poor" | "severe";
  aqi_band_name: string;
  aqi_color_hex: string;
  health_statement_en: string;
  health_statement_hi: string;
  health_statement_mr: string;
  grap_stage?: number | null;
  is_filled?: boolean;
}

export interface GRAPStageInfo {
  stage_number: number;
  name: string;
  aqi_threshold: string;
  mandatory_actions: string[];
  citizen_advisory: string[];
}

export interface AirQualityResponse {
  status?: "ok" | "no_data";
  city: string;
  state?: string | null;
  country: string;
  latitude: number;
  longitude: number;
  current_pm2_5?: number | null;
  current_pm10?: number | null;
  current_cpcb_aqi?: number | null;
  current_aqi_band?: "good" | "satisfactory" | "moderate" | "poor" | "very_poor" | "severe" | null;
  current_aqi_color?: string | null;
  dominant_pollutant?: string | null;
  one_sentence_verdict_en: string;
  one_sentence_verdict_hi: string;
  one_sentence_verdict_mr: string;
  data_as_of: string;
  data_source: string;
  is_modelled?: boolean;
  is_sample_or_fallback: boolean;
  fallback_banner_text?: string | null;
  active_grap_stage?: GRAPStageInfo | null;
  hourly_forecast: HourlyAirPoint[];
}

export interface FamilyMember {
  id: string;
  label: string;
  age_band: "infant" | "child" | "adult" | "senior";
  is_breathing_sensitive: boolean;
  is_outdoor_worker?: boolean;
}

export interface HouseholdProfile {
  city_name: string;
  latitude: number;
  longitude: number;
  members: FamilyMember[];
  commute_mode: "walking" | "cycling" | "two_wheeler_petrol" | "two_wheeler_ev" | "car_petrol" | "bus_cng" | "metro" | "none";
  commute_distance_km: number;
  cooking_fuel: "lpg" | "induction" | "biomass";
  home_type: "standard_closed" | "sealed_closed" | "leaky_closed" | "windows_open";
  has_purifier: boolean;
  purifier_cadr: number;
  budget_band: "zero" | "under_1k" | "over_5k";
}

export interface ActivityScheduleItem {
  activity_id: string;
  name_en: string;
  name_hi: string;
  name_mr: string;
  baseline_time: string;
  optimized_time: string;
  duration_hours: number;
  baseline_pm25: number;
  optimized_pm25: number;
  reduction_ug_m3: number;
  reduction_pct: number;
  rationale_en: string;
  rationale_hi: string;
  rationale_mr: string;
}

export interface MemberBudgetSummary {
  member_id: string;
  label: string;
  age_band: string;
  is_sensitive: boolean;
  total_inhaled_dose_ug: number;
  time_weighted_avg_pm25: number;
  who_budget_ratio: number;
  india_naaqs_ratio: number;
  cigarette_equivalents: number;
  heuristic_disclaimer: string;
}

export interface RankedIntervention {
  id: string;
  tier: "zero" | "under_1k" | "over_5k";
  tier_label: string;
  cost_inr: number;
  name_en: string;
  name_hi: string;
  name_mr: string;
  description_en: string;
  description_hi: string;
  description_mr: string;
  category: string;
  dose_saved_pct: number;
  cost_efficiency_score: number;
}

export interface PlanRequest {
  profile: HouseholdProfile;
  custom_forecast?: number[] | null;
}

export interface PlanResponse {
  city: string;
  data_as_of: string;
  data_source: string;
  is_sample_or_fallback: boolean;
  current_aqi: number;
  current_band: string;
  active_grap_stage?: number | null;
  schedules: ActivityScheduleItem[];
  member_budgets: MemberBudgetSummary[];
  recommendations: RankedIntervention[];
  outdoor_worker_advice_en?: string | null;
  outdoor_worker_advice_hi?: string | null;
  outdoor_worker_advice_mr?: string | null;
}

export interface SimulateRequest {
  profile: HouseholdProfile;
  selected_intervention_ids: string[];
  community_household_count: number;
}

export interface SimulateResponse {
  baseline_dose_ug: number;
  simulated_dose_ug: number;
  dose_reduction_ug: number;
  dose_reduction_pct: number;
  baseline_cigs: number;
  simulated_cigs: number;
  cigs_saved: number;
  cigarette_heuristic_disclaimer: string;
  total_cost_inr: number;
  cost_per_ug_reduced_inr: number;
  pm25_emissions_avoided_g: number;
  co2e_emissions_avoided_kg: number;
  community_multiplier: number;
  community_pm25_avoided_g: number;
  community_co2e_avoided_kg: number;
  applied_interventions: string[];
}

export interface CommunityAdvisoryRequest {
  organization_name: string;
  organization_type: "rwa" | "school" | "office" | "community";
  city: string;
  latitude: number;
  longitude: number;
  language: "en" | "hi" | "mr";
}

export interface CommunityAdvisoryResponse {
  organization_name: string;
  date_formatted: string;
  city: string;
  aqi: number;
  aqi_band: string;
  aqi_color_hex: string;
  headline: string;
  bulletin_points: string[];
  school_advisory?: string | null;
  rwa_actions: string[];
  verification_source: string;
  generated_at_iso: string;
}


export interface ChatCitation {
  id: string;
  title: string;
  publisher: string;
}

export interface ChatRequest {
  message: string;
  profile?: HouseholdProfile | null;
  language?: "en" | "hi" | "mr";
  simplify_for_child?: boolean;
}

export interface ChatSyncResponse {
  reply: string;
  is_medical_refusal: boolean;
  citations: ChatCitation[];
  language: string;
}
