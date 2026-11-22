import { AirQualityResponse, HourlyAirPoint } from "@/types/api";

const HOURLY_PROFILE: Array<{ hour: number; pm2_5: number; pm10: number; aqi: number; grap: number }> = [
  { hour: 0, pm2_5: 285.0, pm10: 395.0, aqi: 423, grap: 3 },
  { hour: 1, pm2_5: 298.0, pm10: 410.0, aqi: 432, grap: 3 },
  { hour: 2, pm2_5: 310.0, pm10: 425.0, aqi: 440, grap: 3 },
  { hour: 3, pm2_5: 325.0, pm10: 440.0, aqi: 450, grap: 3 },
  { hour: 4, pm2_5: 345.0, pm10: 465.0, aqi: 464, grap: 4 },
  { hour: 5, pm2_5: 370.0, pm10: 490.0, aqi: 480, grap: 4 },
  { hour: 6, pm2_5: 415.0, pm10: 530.0, aqi: 495, grap: 4 },
  { hour: 7, pm2_5: 445.0, pm10: 560.0, aqi: 500, grap: 4 },
  { hour: 8, pm2_5: 430.0, pm10: 545.0, aqi: 500, grap: 4 },
  { hour: 9, pm2_5: 380.0, pm10: 490.0, aqi: 487, grap: 4 },
  { hour: 10, pm2_5: 310.0, pm10: 420.0, aqi: 440, grap: 3 },
  { hour: 11, pm2_5: 240.0, pm10: 340.0, aqi: 392, grap: 2 },
  { hour: 12, pm2_5: 185.0, pm10: 280.0, aqi: 350, grap: 2 },
  { hour: 13, pm2_5: 155.0, pm10: 245.0, aqi: 327, grap: 2 },
  { hour: 14, pm2_5: 145.0, pm10: 230.0, aqi: 319, grap: 2 },
  { hour: 15, pm2_5: 160.0, pm10: 255.0, aqi: 331, grap: 2 },
  { hour: 16, pm2_5: 195.0, pm10: 290.0, aqi: 358, grap: 2 },
  { hour: 17, pm2_5: 255.0, pm10: 360.0, aqi: 403, grap: 3 },
  { hour: 18, pm2_5: 315.0, pm10: 430.0, aqi: 444, grap: 3 },
  { hour: 19, pm2_5: 360.0, pm10: 480.0, aqi: 473, grap: 4 },
  { hour: 20, pm2_5: 375.0, pm10: 495.0, aqi: 483, grap: 4 },
  { hour: 21, pm2_5: 350.0, pm10: 470.0, aqi: 467, grap: 4 },
  { hour: 22, pm2_5: 320.0, pm10: 440.0, aqi: 447, grap: 3 },
  { hour: 23, pm2_5: 295.0, pm10: 410.0, aqi: 430, grap: 3 },
];

const fallbackHourlyForecast: HourlyAirPoint[] = HOURLY_PROFILE.map((item) => {
  const isSevere = item.aqi > 400;
  return {
    hour: item.hour,
    time_iso: `${item.hour.toString().padStart(2, "0")}:00`,
    pm2_5: item.pm2_5,
    pm10: item.pm10,
    cpcb_aqi: item.aqi,
    aqi_band_code: isSevere ? "severe" : "very_poor",
    aqi_band_name: isSevere ? "Severe" : "Very Poor",
    aqi_color_hex: isSevere ? "#C00000" : "#FF0000",
    health_statement_en: isSevere
      ? "Emergency smog levels: avoid all non-essential outdoor exposure."
      : "Very poor air quality: respiratory irritation likely with prolonged exertion.",
    health_statement_hi: isSevere
      ? "गंभीर आपातकालीन धुंध: सभी गैर-ज़रूरी बाहरी गतिविधियों से बचें।"
      : "बहुत खराब वायु गुणवत्ता: लंबे समय तक बाहर रहने से सांस लेने में तकलीफ।",
    health_statement_mr: isSevere
      ? "धोकादायक धूर: घराबाहेर जाणे पूर्णपणे टाळा."
      : "अत्यंत वाईट हवेची गुणवत्ता: दीर्घकाळ बाहेर राहिल्यास त्रास होऊ शकतो.",
    grap_stage: item.grap,
  };
});

/**
 * Authoritative CPCB Winter Smog Baseline Reference Data.
 * Used exclusively for offline resilience when the live backend cannot be reached.
 * Clearly marked with is_sample_or_fallback: true and explicit institutional disclaimer.
 */
export const CPCB_OFFLINE_BASELINE: AirQualityResponse = {
  status: "ok",
  city: "Delhi",
  state: "Delhi",
  country: "India",
  latitude: 28.6139,
  longitude: 77.2090,
  current_pm2_5: 385.0,
  current_pm10: 495.0,
  current_cpcb_aqi: 485,
  current_aqi_band: "severe",
  current_aqi_color: "#C00000",
  dominant_pollutant: "PM2.5",
  data_as_of: new Date().toISOString(),
  data_source: "CPCB Reference Baseline (Offline Resilience)",
  is_sample_or_fallback: true,
  fallback_banner_text: "OFFLINE FALLBACK FIXTURE: Live backend feed unreachable. Displaying CPCB reference baseline.",
  active_grap_stage: {
    stage_number: 4,
    name: "GRAP Stage IV (Severe+ / Emergency)",
    aqi_threshold: "AQI > 450",
    mandatory_actions: [
      "Strict ban on Delhi-registered BS-IV and older diesel medium/heavy goods vehicles.",
      "Stop all non-essential construction and demolition activities across Delhi NCR.",
      "Institutions and offices recommended to operate at 50% physical capacity with work-from-home.",
      "High-efficiency particulate filtration (N95/FFP2) mandatory for outdoor exposure."
    ],
    citizen_advisory: [
      "Stay indoors during morning inversion (06:00 - 09:30).",
      "Run air purifier in closed room with minimum 4.0 ACH.",
      "Wear tested N95 respirators if venturing outdoors."
    ]
  },
  one_sentence_verdict_en: "Severe emergency smog trap with hazardous atmospheric particulate saturation.",
  one_sentence_verdict_hi: "गंभीर आपातकालीन धुंध जाल, वायुमंडलीय कणों की खतरनाक सांद्रता।",
  one_sentence_verdict_mr: "धोकादायक हवेची गुणवत्ता, अत्यंत तीव्र हिवाळी धूर व प्रदूषण आणीबाणी।",
  hourly_forecast: fallbackHourlyForecast,
};
