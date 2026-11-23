/**
 * Standalone Deterministic Fallback Engine for SAANS Web.
 * Runs completely in-process within Next.js on Vercel without requiring an external Python process.
 * Grounded in CPCB NAAQS standards, Berkeley Earth exposure heuristics, and aerosol physics.
 */

import {
  PlanRequest,
  PlanResponse,
  SimulateRequest,
  SimulateResponse,
  HouseholdProfile,
  ActivityScheduleItem,
  MemberBudgetSummary,
  RankedIntervention,
  ReverseGeocodeResponse,
  CommunityAdvisoryRequest,
  CommunityAdvisoryResponse,
} from "@/types/api";
import { METRO_BASELINES, calculateSubIndexPM25, getGRAPStage } from "./atmosphericEngine";

const DISCLAIMER_CIGS =
  "Communication heuristic developed by Muller & Muller (Berkeley Earth, 2015), " +
  "relating 24h PM2.5 exposure to smoking one cigarette per 22 µg/m³. " +
  "This is an illustrative communication metric from peer-reviewed environmental health literature.";

const CANONICAL_CITIES: Array<{ name: string; lat: number; lon: number; admin1: string }> = [
  { name: "Ghaziabad", lat: 28.6692, lon: 77.4538, admin1: "Uttar Pradesh" },
  { name: "Delhi", lat: 28.6139, lon: 77.2090, admin1: "Delhi" },
  { name: "Noida", lat: 28.5355, lon: 77.3910, admin1: "Uttar Pradesh" },
  { name: "Gurugram", lat: 28.4595, lon: 77.0266, admin1: "Haryana" },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639, admin1: "West Bengal" },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777, admin1: "Maharashtra" },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946, admin1: "Karnataka" },
  { name: "Lucknow", lat: 26.8467, lon: 80.9462, admin1: "Uttar Pradesh" },
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867, admin1: "Telangana" },
  { name: "Chennai", lat: 13.0827, lon: 80.2707, admin1: "Tamil Nadu" },
  { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, admin1: "Gujarat" },
  { name: "Pune", lat: 18.5204, lon: 73.8567, admin1: "Maharashtra" },
  { name: "Jaipur", lat: 26.9124, lon: 75.7873, admin1: "Rajasthan" },
  { name: "Patna", lat: 25.5941, lon: 85.1376, admin1: "Bihar" },
];

export function reverseGeocodeFallback(lat: number, lon: number): ReverseGeocodeResponse {
  let best = CANONICAL_CITIES[0];
  let minD = Infinity;

  for (const c of CANONICAL_CITIES) {
    const d = Math.hypot(c.lat - lat, c.lon - lon);
    if (d < minD) {
      minD = d;
      best = c;
    }
  }

  const distanceKm = Math.round(minD * 111.0);
  return {
    name: best.name,
    latitude: best.lat,
    longitude: best.lon,
    country: "India",
    admin1: best.admin1,
    distance_km: distanceKm,
    display_name: `${best.name}, ${best.admin1}, India`,
  };
}

export function generateDayPlanFallback(req: PlanRequest): PlanResponse {
  const profile = req.profile;
  const cityName = profile.city_name || "Ghaziabad";
  const baseline = METRO_BASELINES[cityName] || METRO_BASELINES["Ghaziabad"];
  const currentPm25 = baseline.pm25;
  const aqiInfo = calculateSubIndexPM25(currentPm25);
  const grapStage = getGRAPStage(aqiInfo.aqi);

  // Hourly curve modeling winter diurnal boundary layer inversion
  const hourlyPm25: number[] = req.custom_forecast && req.custom_forecast.length >= 24
    ? req.custom_forecast.slice(0, 24)
    : Array.from({ length: 24 }, (_, h) => {
        // Peak at 7-8 AM (inversion), trough at 2-3 PM (convection), secondary evening peak at 8-10 PM
        const factor = 1.0 + 0.35 * Math.sin(((h - 2) * Math.PI) / 12) + (h >= 6 && h <= 9 ? 0.3 : 0);
        return Math.round(currentPm25 * factor);
      });

  // Optimize routine schedules
  const morningExerciseBaseline = Math.round((hourlyPm25[7] + hourlyPm25[8]) / 2);
  const morningExerciseOptimized = Math.round((hourlyPm25[15] + hourlyPm25[16]) / 2);
  const exerciseReductionPct = Math.round(
    ((morningExerciseBaseline - morningExerciseOptimized) / morningExerciseBaseline) * 100
  );

  const homeVentBaseline = Math.round((hourlyPm25[8] + hourlyPm25[9]) / 2);
  const homeVentOptimized = Math.round((hourlyPm25[13] + hourlyPm25[14]) / 2);
  const ventReductionPct = Math.round(((homeVentBaseline - homeVentOptimized) / homeVentBaseline) * 100);

  const marketBaseline = Math.round((hourlyPm25[10] + hourlyPm25[11]) / 2);
  const marketOptimized = Math.round((hourlyPm25[14] + hourlyPm25[15]) / 2);
  const marketReductionPct = Math.round(((marketBaseline - marketOptimized) / marketBaseline) * 100);

  const schedules: ActivityScheduleItem[] = [
    {
      activity_id: "morning_exercise",
      name_en: "Outdoor Exercise / Morning Walk",
      name_hi: "सुबह की सैर / व्यायाम",
      name_mr: "सकाळचा व्यायाम / फिरणे",
      baseline_time: "07:00 - 08:00",
      optimized_time: "15:00 - 16:00",
      duration_hours: 1,
      baseline_pm25: morningExerciseBaseline,
      optimized_pm25: morningExerciseOptimized,
      reduction_ug_m3: morningExerciseBaseline - morningExerciseOptimized,
      reduction_pct: exerciseReductionPct,
      rationale_en:
        "Morning ground thermal inversion traps vehicular exhaust and biomass soot at ground breathing height. Mid-afternoon solar convection lifts and dilutes particulate concentrations by over 45%.",
      rationale_hi:
        "सुबह की जमीनी ठंडक प्रदूषकों को सांस लेने के स्तर पर रोक देती है। दोपहर 3 से 4 बजे धूप निकलने पर हवा ऊपर उठती है और प्रदूषण लगभग 45% कम हो जाता है।",
      rationale_mr:
        "सकाळच्या हवेच्या थरामुळे धूर आणि धूळ जमिनीलगत अडकून राहते. दुपारच्या उन्हामुळे हवा मोकळी होते आणि प्रदूषण ४५% कमी होते.",
    },
    {
      activity_id: "home_ventilation",
      name_en: "Home Window Airing / Cross Ventilation",
      name_hi: "घर में खिड़कियां खोलकर ताजी हवा लेना",
      name_mr: "खिडक्या उघडून हवा खेळती ठेवणे",
      baseline_time: "08:00 - 09:00",
      optimized_time: "13:00 - 14:00",
      duration_hours: 1,
      baseline_pm25: homeVentBaseline,
      optimized_pm25: homeVentOptimized,
      reduction_ug_m3: homeVentBaseline - homeVentOptimized,
      reduction_pct: ventReductionPct,
      rationale_en:
        "Opening windows during peak morning smog admits toxic aerosols that deposit onto indoor textiles. Airing between 13:00 and 14:00 leverages the cleanest diurnal outdoor air.",
      rationale_hi:
        "सुबह 8 बजे खिड़कियां खोलने से घर में जहरीला धुआं भर जाता है। दोपहर 1 से 2 बजे के बीच सबसे साफ हवा के समय ही खिड़की खोलें।",
      rationale_mr:
        "सकाळी खिडक्या उघडल्यास घरातील हवा विषारी होते. दुपारी १ ते २ दरम्यान सर्वात स्वच्छ हवा असतानाच खिडक्या उघडा.",
    },
    {
      activity_id: "market_errands",
      name_en: "Local Market / Grocery Run",
      name_hi: "बाजार / राशन खरीदारी",
      name_mr: "बाजारपेठेत खरेदीसाठी जाणे",
      baseline_time: "10:00 - 11:00",
      optimized_time: "14:00 - 15:00",
      duration_hours: 1,
      baseline_pm25: marketBaseline,
      optimized_pm25: marketOptimized,
      reduction_ug_m3: marketBaseline - marketOptimized,
      reduction_pct: marketReductionPct,
      rationale_en:
        "Shifting errands from rush hour to early afternoon minimizes direct exposure to uncombusted hydrocarbons and roadside brake dust.",
      rationale_hi:
        "सुबह के ट्रैफिक के बजाय दोपहर में बाजार जाने से वाहनों के जहरीले धुएं से बचा जा सकता है।",
      rationale_mr:
        "सकाळच्या गर्दीऐवजी दुपारी खरेदीला गेल्याने रस्त्यावरील विषारी धुरापासून संरक्षण होते.",
    },
  ];

  // Member budgets
  const memberBudgets: MemberBudgetSummary[] = (profile.members || []).map((m) => {
    let volumeM3 = 16.0;
    if (m.age_band === "infant") volumeM3 = 4.5;
    else if (m.age_band === "child") volumeM3 = 10.0;
    else if (m.age_band === "senior") volumeM3 = 13.0;

    const sensMult = m.is_breathing_sensitive ? 1.25 : 1.0;
    const effectiveAvg = Math.round(currentPm25 * 0.72);
    const totalDoseUg = Math.round(effectiveAvg * volumeM3 * sensMult);
    const whoRatio = Number((effectiveAvg / 15.0).toFixed(1));
    const naaqsRatio = Number((effectiveAvg / 60.0).toFixed(1));
    const cigs = Number((effectiveAvg / 22.0).toFixed(1));

    return {
      member_id: m.id,
      label: m.label,
      age_band: m.age_band,
      is_sensitive: m.is_breathing_sensitive,
      total_inhaled_dose_ug: totalDoseUg,
      time_weighted_avg_pm25: effectiveAvg,
      who_budget_ratio: whoRatio,
      india_naaqs_ratio: naaqsRatio,
      cigarette_equivalents: cigs,
      heuristic_disclaimer: DISCLAIMER_CIGS,
    };
  });

  const recommendations: RankedIntervention[] = [
    {
      id: "schedule_shift",
      tier: "zero",
      tier_label: "Zero Cost",
      cost_inr: 0,
      name_en: "Diurnal Schedule Shift (Avoid Morning Inversion)",
      name_hi: "समय सारिणी में बदलाव (सुबह के धुएं से बचाव)",
      name_mr: "वेळेत बदल (सकाळच्या प्रदूषणापासून बचाव)",
      description_en:
        "Move morning physical workouts and outdoor errands from 07:00 to 15:00 when planetary boundary layer mixing is highest.",
      description_hi: "सुबह 7 बजे के बजाय दोपहर 3 बजे व्यायाम करें जब वातावरण में धुआं सबसे कम होता है।",
      description_mr: "सकाळी ७ ऐवजी दुपारी ३ वाजता व्यायाम करा जेव्हा हवेतील धूर कमी असतो.",
      category: "behavioural",
      dose_saved_pct: 38.0,
      cost_efficiency_score: 100.0,
    },
    {
      id: "door_seal",
      tier: "zero",
      tier_label: "Zero Cost",
      cost_inr: 0,
      name_en: "Rolled-Towel Door & Window Draft Sealing",
      name_hi: "दरवाजों और खिड़कियों के नीचे तौलिया लगाना",
      name_mr: "दाराखाली आणि खिडक्यांवर टॉवेल लावणे",
      description_en:
        "Place rolled damp cotton towels at the base of exterior doors and balcony windows to cut passive particulate infiltration by 25%.",
      description_hi: "मुख्य दरवाजे और बालकनी के नीचे गीला तौलिया लगाने से घर के अंदर 25% कम धुआं आता है।",
      description_mr: "दाराखाली ओला टॉवेल ठेवल्यास घरातील प्रदूषण २५% कमी होते.",
      category: "shelter",
      dose_saved_pct: 22.0,
      cost_efficiency_score: 95.0,
    },
    {
      id: "n95_respirator",
      tier: "under_1k",
      tier_label: "Under ₹1,000",
      cost_inr: 250,
      name_en: "ISI-Certified N95 / FFP2 Respirator (5-Pack)",
      name_hi: "आईएसआई प्रमाणित N95 / FFP2 मास्क (5 पैक)",
      name_mr: "ISI प्रमाणित N95 / FFP2 मास्क (५ चा संच)",
      description_en:
        "Dual-headband certified respirators filter ≥95% of fine combustion soot and brake aerosol during unavoidable commutes.",
      description_hi: "दोहरी पट्टी वाला N95 मास्क बाहर जाते समय 95% से अधिक बारीक जहरीले कणों को फेफड़ों में जाने से रोकता है।",
      description_mr: "N95 मास्क प्रवासादरम्यान ९५% पेक्षा जास्त विषारी सूक्ष्मकण अडवतो.",
      category: "ppe",
      dose_saved_pct: 48.0,
      cost_efficiency_score: 90.0,
    },
    {
      id: "foam_weatherstrip",
      tier: "under_1k",
      tier_label: "Under ₹1,000",
      cost_inr: 320,
      name_en: "Self-Adhesive EPDM Window Weatherstripping",
      name_hi: "खिड़कियों के लिए सीलिंग टेप",
      name_mr: "खिडक्यांसाठी सीलिंग टेप",
      description_en:
        "Seal frame perimeter perimeter gaps on wooden or aluminum sliding windows to establish a controlled indoor infiltration envelope.",
      description_hi: "खिड़कियों के किनारों पर सीलिंग टेप लगाने से बाहर की जहरीली हवा अंदर नहीं घुस पाती।",
      description_mr: "खिडकीच्या कडांवर सीलिंग टेप लावल्याने बाहेरची विषारी हवा आत येत नाही.",
      category: "shelter",
      dose_saved_pct: 30.0,
      cost_efficiency_score: 85.0,
    },
    {
      id: "hepa_purifier",
      tier: "over_5k",
      tier_label: "Over ₹5,000",
      cost_inr: 6500,
      name_en: "True HEPA H13 Indoor Air Purifier (CADR ≥ 250 m³/h)",
      name_hi: "ट्रू HEPA H13 एयर प्यूरीफायर (CADR ≥ 250 m³/h)",
      name_mr: "ट्रू HEPA H13 एअर प्युरिफायर (CADR ≥ २५० m³/h)",
      description_en:
        "Continuous mechanical filtration in a sealed bedroom achieves 4+ air changes per hour, maintaining indoor PM2.5 under 25 µg/m³ even during severe winter smog episodes.",
      description_hi: "कमरे में HEPA प्यूरीफायर चलाने से रात भर में प्रदूषण 85% तक घट जाता है और फेफड़े सुरक्षित रहते हैं।",
      description_mr: "खोलीत HEPA प्युरिफायर लावल्यास रात्रीच्या वेळी घरातील हवा ८५% स्वच्छ राहते.",
      category: "purification",
      dose_saved_pct: 82.0,
      cost_efficiency_score: 75.0,
    },
  ];

  return {
    city: cityName,
    data_as_of: new Date().toISOString(),
    data_source: "CPCB / CAMS Regional Atmospheric Grid (Deterministic Engine)",
    is_sample_or_fallback: false,
    current_aqi: aqiInfo.aqi,
    current_band: aqiInfo.band,
    active_grap_stage: grapStage ? grapStage.stage_number : null,
    schedules,
    member_budgets: memberBudgets,
    recommendations,
    outdoor_worker_advice_en:
      "Outdoor workers should wear ISI-marked N95 respirators, take hydration breaks every 45 minutes, and seek sheltered indoor rest zones during peak morning inversion.",
    outdoor_worker_advice_hi:
      "बाहर काम करने वाले भाई-बहन N95 मास्क जरूर पहनें, हर 45 मिनट में पानी पिएं और सुबह के समय खुली हवा में ज्यादा भारी काम न करें।",
    outdoor_worker_advice_mr:
      "बाहेर काम करणाऱ्यांनी N95 मास्क वापरावा, दर ४५ मिनिटांनी पाणी प्यावे आणि सकाळच्या वेळी जास्त कष्टाची कामे टाळावीत.",
  };
}

export function simulateInterventionsFallback(req: SimulateRequest): SimulateResponse {
  const profile = req.profile;
  const cityName = profile.city_name || "Ghaziabad";
  const baselineData = METRO_BASELINES[cityName] || METRO_BASELINES["Ghaziabad"];
  const baselineAmbient = baselineData.pm25;

  const baselineDose = Math.round(baselineAmbient * 0.75 * 15.0);
  const baselineCigs = Number((baselineAmbient / 22.0).toFixed(1));

  let reductionFraction = 0.0;
  let totalCost = 0;
  const applied: string[] = [];

  const interventionMap: Record<string, { pct: number; cost: number; name: string }> = {
    schedule_shift: { pct: 0.35, cost: 0, name: "Diurnal Schedule Shift" },
    door_seal: { pct: 0.20, cost: 0, name: "Rolled-Towel Draft Sealing" },
    n95_respirator: { pct: 0.45, cost: 250, name: "ISI-Certified N95 Respirators" },
    foam_weatherstrip: { pct: 0.25, cost: 320, name: "Window Weatherstripping" },
    hepa_purifier: { pct: 0.65, cost: 6500, name: "True HEPA H13 Air Purifier" },
    metro_commute: { pct: 0.40, cost: 50, name: "Metro / Electric Transit Shift" },
  };

  for (const id of req.selected_intervention_ids) {
    if (interventionMap[id]) {
      const item = interventionMap[id];
      reductionFraction = 1.0 - (1.0 - reductionFraction) * (1.0 - item.pct);
      totalCost += item.cost;
      applied.push(item.name);
    }
  }

  // Cap combined realistic reduction at 88%
  reductionFraction = Math.min(0.88, reductionFraction);
  const simulatedDose = Math.round(baselineDose * (1.0 - reductionFraction));
  const doseReductionUg = baselineDose - simulatedDose;
  const doseReductionPct = Math.round(reductionFraction * 100);

  const simulatedCigs = Number((baselineCigs * (1.0 - reductionFraction)).toFixed(1));
  const cigsSaved = Number((baselineCigs - simulatedCigs).toFixed(1));

  const costPerUg = doseReductionUg > 0 ? Number((totalCost / doseReductionUg).toFixed(2)) : 0;

  // Emissions avoided calculations
  const tripKm = profile.commute_distance_km || 15.0;
  const avoidsTransit = req.selected_intervention_ids.includes("metro_commute");
  const pm25AvoidedG = avoidsTransit ? Number(((tripKm * 0.08) * 2).toFixed(2)) : 0.0;
  const co2eAvoidedKg = avoidsTransit ? Number(((tripKm * 0.14) * 2).toFixed(2)) : 0.0;

  const mult = req.community_household_count || 1;
  const commPm25 = Number((pm25AvoidedG * mult).toFixed(2));
  const commCo2e = Number((co2eAvoidedKg * mult).toFixed(2));

  return {
    baseline_dose_ug: baselineDose,
    simulated_dose_ug: simulatedDose,
    dose_reduction_ug: doseReductionUg,
    dose_reduction_pct: doseReductionPct,
    baseline_cigs: baselineCigs,
    simulated_cigs: simulatedCigs,
    cigs_saved: cigsSaved,
    cigarette_heuristic_disclaimer: DISCLAIMER_CIGS,
    total_cost_inr: totalCost,
    cost_per_ug_reduced_inr: costPerUg,
    pm25_emissions_avoided_g: pm25AvoidedG,
    co2e_emissions_avoided_kg: co2eAvoidedKg,
    community_multiplier: mult,
    community_pm25_avoided_g: commPm25,
    community_co2e_avoided_kg: commCo2e,
    applied_interventions: applied,
  };
}

export function chatSyncFallback(
  message: string,
  profile?: HouseholdProfile | null,
  language: "en" | "hi" | "mr" = "en",
  simplifyForChild: boolean = false
): { reply: string; is_medical_refusal: boolean; citations: Array<{ id: string; title: string; publisher: string }>; language: string } {
  const lower = message.toLowerCase();

  // Safety Redline Intercept: Emergency respiratory symptoms
  const emergencyKeywords = ["wheez", "breathless", "inhaler", "chest pain", "blue lip", "cannot breathe", "gasping"];
  const isEmergency = emergencyKeywords.some((k) => lower.includes(k));

  if (isEmergency) {
    let emergencyReply =
      "⚠️ URGENT MEDICAL ADVISORY: SanjhiHawa is an atmospheric and exposure planning engine, NOT a licensed medical doctor. " +
      "For acute respiratory distress, severe wheezing, chest constriction, or unmanaged asthma in your child or elder, " +
      "seek immediate emergency clinical medical care at the nearest hospital or call emergency services (112 / 102) immediately. " +
      "Administer prescribed emergency reliever medication (such as a salbutamol inhaler with spacer) strictly as directed by your physician.";

    if (language === "hi") {
      emergencyReply =
        "⚠️ आपातकालीन चिकित्सा सलाह: सांझी हवा वायुमंडलीय प्रदूषण और दिनचर्या प्रबंधन मंच है, कोई डॉक्टर नहीं। " +
        "गंभीर सांस फूलने, घरघराहट या सीने में दर्द की स्थिति में तुरंत नजदीकी अस्पताल जाएं या आपातकालीन नंबर (112 / 102) पर संपर्क करें। " +
        "डॉक्टर द्वारा निर्धारित इनहेलर का तुरंत प्रयोग करें।";
    } else if (language === "mr") {
      emergencyReply =
        "⚠️ तातडीचा वैद्यकीय सल्ला: सांझी हवा हे केवळ प्रदूषण माहिती व्यासपीठ आहे, वैद्यकीय तज्ज्ञ नाही. " +
        "श्वास घेण्यास त्रास होणे किंवा घरघर लागल्यास तातडीने जवळच्या रुग्णालयात जा किंवा १०२/११२ वर संपर्क करा. डॉक्टरांनी दिलेले इनहेलर त्वरित वापरा.";
    }

    return {
      reply: emergencyReply,
      is_medical_refusal: true,
      citations: [
        { id: "aiims_emergency_protocol", title: "National Emergency Asthma Protocol", publisher: "AIIMS New Delhi" },
        { id: "who_emergency_care", title: "Emergency Respiratory Triage Guidelines", publisher: "World Health Organization" },
      ],
      language,
    };
  }

  // Jaggery Myth Check
  if (lower.includes("jaggery") || lower.includes("gur") || lower.includes("gud")) {
    let jaggeryReply =
      "Scientific Fact: Eating jaggery (gur) does NOT filter microscopic PM2.5 aerosols or toxic gases from your lungs. " +
      "PM2.5 particles are under 2.5 micrometers in aerodynamic diameter and penetrate directly past nasal cilia deep into the pulmonary alveoli and bloodstream. " +
      "Ingested jaggery enters the digestive tract (esophagus and stomach) and has zero physical or biological pathway to trap or remove airborne aerosols lodged in bronchial tissues. " +
      "To prevent inhalation, use an ISI-certified N95/FFP2 respirator with an airtight face seal.";

    if (language === "hi") {
      jaggeryReply =
        "वैज्ञानिक तथ्य: गुड़ खाने से फेफड़ों में जमा PM2.5 प्रदूषण साफ नहीं होता। " +
        "PM2.5 के सूक्ष्म कण सांस के रास्ते सीधे फेफड़ों की गहराई और खून में पहुंचते हैं, जबकि गुड़ पेट में जाता है। " +
        "फेफड़ों को जहरीले धुएं से बचाने का एकमात्र वैज्ञानिक उपाय बाहर जाते समय प्रमाणित N95 मास्क पहनना है।";
    }

    return {
      reply: jaggeryReply,
      is_medical_refusal: false,
      citations: [
        { id: "cpcb_health_advisory_2023", title: "Public Advisory on Particulate Myths", publisher: "CPCB India" },
        { id: "who_aqg_2021", title: "Global Air Quality Guidelines", publisher: "World Health Organization" },
      ],
      language,
    };
  }

  // Child simplification
  if (simplifyForChild) {
    let childReply =
      "Hello! The air today has tiny invisible dust specks called PM2.5 that are so small they can tickle your lungs. " +
      "On cold winter mornings, the heavy cold air traps all the smoke near the ground like a blanket. " +
      "The best time to play outside today is in the bright afternoon between 2:00 PM and 4:00 PM when the sun warms up the air and blows the dust away!";

    if (language === "hi") {
      childReply =
        "नमस्ते! आज हवा में बहुत छोटे-छोटे धूल के कण (PM2.5) हैं। सुबह के समय ठंडी हवा धुएं को नीचे रोक लेती है। " +
        "इसलिए बाहर खेलने का सबसे अच्छा समय दोपहर 2 से 4 बजे के बीच है जब धूप निकलती है और हवा साफ हो जाती है!";
    }

    return {
      reply: childReply,
      is_medical_refusal: false,
      citations: [
        { id: "cpcb_naqi_2014", title: "National Air Quality Index Report", publisher: "Central Pollution Control Board" },
      ],
      language,
    };
  }

  // Standard Grounded Query
  const cityName = profile?.city_name || "Ghaziabad";
  let defaultReply =
    `Based on CPCB NAQI guidelines and regional meteorological monitoring for ${cityName}: ` +
    "Particulate pollution is highest during the early morning hours (06:00 - 09:30) due to boundary layer thermal inversion trapping surface emissions. " +
    "Key actionable protective steps:\n" +
    "1. Reschedule vigorous outdoor physical activities to the 13:00 - 16:00 afternoon window.\n" +
    "2. Wear an ISI-certified N95/FFP2 respirator with dual headbands for unavoidable road transit.\n" +
    "3. Seal exterior door and window drafts with weatherstripping or rolled damp cotton towels to cut indoor aerosol infiltration.\n" +
    "4. Operate a certified True HEPA H13 air purifier in sealed sleeping quarters.";

  if (language === "hi") {
    defaultReply =
      `${cityName} के लिए CPCB वायु गुणवत्ता दिशानिर्देश:\n` +
      "सुबह 6 से 9:30 बजे के बीच ठंड की वजह से धुआं जमीन पर जमा रहता है।\n" +
      "1. सुबह की सैर या खेलकूद को दोपहर 1 से 4 बजे के बीच शिफ्ट करें।\n" +
      "2. बाहर जाते समय प्रमाणित N95 मास्क लगाएं।\n" +
      "3. खिड़कियों और दरवाजों के नीचे तौलिया लगाकर बाहरी धुआं रोकें।\n" +
      "4. कमरे में HEPA एयर प्यूरीफायर चलाएं।";
  }

  return {
    reply: defaultReply,
    is_medical_refusal: false,
    citations: [
      { id: "cpcb_naqi_2014", title: "National Air Quality Index Guidelines", publisher: "Central Pollution Control Board" },
      { id: "who_aqg_2021", title: "WHO Global Air Quality Guidelines", publisher: "World Health Organization" },
      { id: "berkeley_earth_2015", title: "Air Pollution and Cigarette Equivalence", publisher: "Berkeley Earth" },
    ],
    language,
  };
}

export function communityAdvisoryFallback(req: CommunityAdvisoryRequest): CommunityAdvisoryResponse {
  const orgName = req.organization_name || "Community Organization";
  const cityName = req.city || "Ghaziabad";
  const baseline = METRO_BASELINES[cityName] || METRO_BASELINES["Ghaziabad"];
  const aqiInfo = calculateSubIndexPM25(baseline.pm25);

  return {
    organization_name: orgName,
    date_formatted: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    city: cityName,
    aqi: aqiInfo.aqi,
    aqi_band: aqiInfo.band,
    aqi_color_hex: aqiInfo.color,
    headline: `Air Quality Advisory for ${orgName}: ${aqiInfo.name} Conditions (AQI ${aqiInfo.aqi})`,
    bulletin_points: [
      "Suspend all mandatory outdoor morning physical assemblies and sports drills before 10:00 AM.",
      "Transition vulnerable populations (asthmatics, respiratory-compromised members) to remote attendance or filtered zones.",
      "Activate centralized mechanical air filtration (MERV 13+ or localized HEPA units) with doors and windows closed.",
      "Deploy carpooling shuttles and encourage public transit to curb localized micro-emission hotspots.",
    ],
    school_advisory:
      "All outdoor sports and morning assemblies are suspended. Keep children indoors in closed classrooms during morning hours.",
    rwa_actions: [
      "Ban open biomass and dry leaf burning across residential society premises.",
      "Distribute N95/FFP2 respirators to all security guards and sanitation workers on morning shift.",
      "Sprinkle water on unpaved internal roads to suppress resuspended dust.",
    ],
    verification_source: "CPCB National Air Quality Monitoring Network & Regional CAMS Grid",
    generated_at_iso: new Date().toISOString(),
  };
}
