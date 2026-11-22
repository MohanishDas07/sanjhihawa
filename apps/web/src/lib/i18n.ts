"use client";

import { useState, useEffect } from "react";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import mr from "@/messages/mr.json";

export type Language = "en" | "hi" | "mr";

type TranslationSchema = typeof en;
export type Leaves<T> = T extends object
  ? { [K in keyof T]: `${Exclude<K, symbol>}${Leaves<T[K]> extends never ? "" : `.${Leaves<T[K]>}`}` }[keyof T]
  : never;

export type TranslationKey = Leaves<TranslationSchema> | (string & {});

const translations: Record<Language, TranslationSchema> = {
  en,
  hi,
  mr,
};

export function getTranslation(lang: Language, path: TranslationKey): string {
  const dict = translations[lang] || translations.en;
  const parts = path.split(".");
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      // Fallback to English
      let fallback: unknown = translations.en;
      for (const fPart of parts) {
        if (fallback && typeof fallback === "object" && fPart in fallback) {
          fallback = (fallback as Record<string, unknown>)[fPart];
        } else {
          return path;
        }
      }
      return typeof fallback === "string" ? fallback : path;
    }
  }

  return typeof current === "string" ? current : path;
}

export function useTranslation() {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = (localStorage.getItem("saans_lang") as Language) || "en";
    setLangState(saved);

    const onLangChange = () => {
      const current = (localStorage.getItem("saans_lang") as Language) || "en";
      setLangState(current);
    };

    window.addEventListener("saans_lang_changed", onLangChange);
    window.addEventListener("storage", onLangChange);
    return () => {
      window.removeEventListener("saans_lang_changed", onLangChange);
      window.removeEventListener("storage", onLangChange);
    };
  }, []);

  const setLanguage = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("saans_lang", newLang);
    document.documentElement.lang = newLang;
    window.dispatchEvent(new Event("saans_lang_changed"));
  };

  const t = (path: TranslationKey) => getTranslation(lang, path);

  return { t, lang, setLanguage };
}

export const CITY_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    "Delhi": "Delhi",
    "Delhi NCR": "Delhi NCR",
    "Kolkata": "Kolkata",
    "Mumbai": "Mumbai",
    "Bengaluru": "Bengaluru",
    "Lucknow": "Lucknow",
    "Hyderabad": "Hyderabad",
    "Pune": "Pune",
    "Ghaziabad": "Ghaziabad",
    "Noida": "Noida",
    "Gurugram": "Gurugram",
    "Patna": "Patna",
    "Kanpur": "Kanpur",
    "Varanasi": "Varanasi",
    "Ahmedabad": "Ahmedabad",
    "Chennai": "Chennai",
    "Jaipur": "Jaipur"
  },
  hi: {
    "Delhi": "दिल्ली",
    "Delhi NCR": "दिल्ली NCR",
    "Kolkata": "कोलकाता",
    "Mumbai": "मुंबई",
    "Bengaluru": "बेंगलुरु",
    "Lucknow": "लखनऊ",
    "Hyderabad": "हैदराबाद",
    "Pune": "पुणे",
    "Ghaziabad": "गाजियाबाद",
    "Noida": "नोएडा",
    "Gurugram": "गुरुग्राम",
    "Patna": "पटना",
    "Kanpur": "कानपुर",
    "Varanasi": "वाराणसी",
    "Ahmedabad": "अहमदाबाद",
    "Chennai": "चेन्नई",
    "Jaipur": "जयपुर"
  },
  mr: {
    "Delhi": "दिल्ली",
    "Delhi NCR": "दिल्ली NCR",
    "Kolkata": "कोलकाता",
    "Mumbai": "मुंबई",
    "Bengaluru": "बेंगलुरु",
    "Lucknow": "लखनऊ",
    "Hyderabad": "हैदराबाद",
    "Pune": "पुणे",
    "Ghaziabad": "गाझियाबाद",
    "Noida": "नोएडा",
    "Gurugram": "गुरुग्राम",
    "Patna": "पाटणा",
    "Kanpur": "कानपूर",
    "Varanasi": "वाराणसी",
    "Ahmedabad": "अहमदाबाद",
    "Chennai": "चेन्नई",
    "Jaipur": "जयपूर"
  }
};

export const AQI_BAND_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    "good": "Good",
    "satisfactory": "Satisfactory",
    "moderate": "Moderate",
    "poor": "Poor",
    "very_poor": "Very Poor",
    "severe": "Severe"
  },
  hi: {
    "good": "अच्छा",
    "satisfactory": "संतोषजनक",
    "moderate": "मध्यम",
    "poor": "खराब",
    "very_poor": "बहुत खराब",
    "severe": "गंभीर"
  },
  mr: {
    "good": "उत्तम",
    "satisfactory": "समाधानकारक",
    "moderate": "मध्यम",
    "poor": "वाईट",
    "very_poor": "अत्यंत वाईट",
    "severe": "गंभीर"
  }
};

export function translateCity(cityName: string, lang: Language): string {
  return CITY_TRANSLATIONS[lang]?.[cityName] || CITY_TRANSLATIONS.en[cityName] || cityName;
}

export function translateAqiBand(band: string, lang: Language): string {
  const normalized = band.toLowerCase().replace(/ /g, "_");
  return AQI_BAND_TRANSLATIONS[lang]?.[normalized] || AQI_BAND_TRANSLATIONS.en[normalized] || band;
}
