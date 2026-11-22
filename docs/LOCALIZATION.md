# SAANS Localization & Multilingual Architecture (EN, HI, MR)

This document specifies the localization architecture, translation coverage, human review status, and font stack for the SAANS assistant.

---

## 1. Supported Languages & Target Demographics

| Language | Code | Script | Target Demographic | Font Family |
| :--- | :--- | :--- | :--- | :--- |
| **English** | `en` | Latin | Pan-Indian urban workforce, students, bilingual households | IBM Plex Sans, IBM Plex Mono |
| **Hindi (हिन्दी)** | `hi` | Devanagari | Primary spoken language across Delhi-NCR, UP, Bihar, Haryana | Noto Sans Devanagari, IBM Plex Mono |
| **Marathi (मराठी)** | `mr` | Devanagari | Maharashtra urban regions (Mumbai-MMR, Pune smog basins) | Noto Sans Devanagari, IBM Plex Mono |

---

## 2. Localization Strategy & Key Principles

1. **Numbers are Locale-Invariant**: All numerical outputs (CPCB AQI, PM2.5 in $\mu\text{g/m}^3$, CADR in $\text{m}^3/\text{h}$, Breath Budget percentages, Rupee amounts ₹) are computed identically by the pure-Python exposure engine and passed via standardized JSON keys with tabular figures.
2. **Medical Triage Strings are Pre-Composed**: Acute medical triage warnings are not machine-translated on the fly. They are hard-coded static strings vetted against standard Indian emergency protocols (112 and 102 dispatch numbers).
3. **No Machine-Translation Halos**: All strings are stored in structured JSON dictionaries (`apps/web/src/messages/en.json`, `hi.json`, `mr.json`) under the `useTranslation()` React hook.

---

## 3. String Inventory & Verification Status

| Domain | English | Hindi (हिन्दी) Status | Marathi (मराठी) Status | Verification Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Emergency Triage** | Complete | Verified (Static) | Verified (Static) | MoHFW / 112 emergency protocols |
| **Air Quality Verdicts** | Complete | Verified (Dynamic) | Verified (Dynamic) | One-sentence summary on `/` |
| **Community Advisory Card** | Complete | Full Translation Verified | Full Translation Verified | Printable RWA/School Bulletin `/community` |
| **Science Myth Summaries** | Complete | Full Translation Verified | Full Translation Verified | Core myths (Plants, Jaggery, Masks) |
| **Routine Schedule Names** | Complete | Localized Subtitles | Localized Subtitles | Activities in `/your-day` & `/plan` |
| **Interactive Form Fields** | Complete | Form Prompts Localized | Form Prompts Localized | `/onboarding` persona inputs |
| **Scientific Formulas (`how-saans-works`)** | Complete | English-led (Universal Math) | English-led (Universal Math) | Parameter provenance & equations |
| **Deep Lab Tooltips (`lab`)** | Complete | English-led | English-led | Secondary aerosol & ozone notes |

---

## 4. Devanagari Typography & WCAG Rendering

- **Devanagari Font Stack**: Clean system and Google font fallbacks:
  `font-family: 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
- **Line Height Compensation**: Devanagari conjuncts and vertical matras (e.g. `ि`, `ी`, `ु`, `ू`, `्र`) require a minimum line height of `1.5` to avoid clipping ascenders and descenders. In Elder Mode (`A+`), this increases to `1.7`.
- **Numerals**: Data values use Western Arabic numerals with tabular lining figures (`font-variant-numeric: tabular-nums`) across all languages for maximum readability on digital monitors and printouts.
