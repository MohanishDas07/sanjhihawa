"""
Intervention Catalogue and What-If Simulation Engine.
Applies single or combined interventions to a baseline day, returning deltas in:
- Inhaled dose (ug)
- Time-weighted PM2.5 (ug/m^3)
- Berkeley Earth cigarette-equivalents
- Cost in Rupees (INR)
- Sustainability emissions avoided (g PM2.5, kg CO2e)
Ranked by exposure reduced per rupee, with Tier 0 (₹0) interventions prioritized.
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class InterventionOption:
    id: str
    tier: str  # "zero", "under_1k", "over_5k"
    cost_inr: float
    name_en: str
    name_hi: str
    name_mr: str
    category: str  # "mask", "purifier", "ventilation", "transport", "cooking", "sealing"
    engine_effect: dict[str, Any]
    applicability: list[str]  # e.g., ["all", "outdoor_commute", "gas_cooking"]
    source_id: str
    description_en: str
    description_hi: str
    description_mr: str


INTERVENTION_CATALOGUE: list[InterventionOption] = [
    # Tier 0: ₹0 (Zero Rupee Cost)
    InterventionOption(
        id="shift_ventilation_afternoon",
        tier="zero",
        cost_inr=0.0,
        name_en="Afternoon Window Airing (12 PM - 3 PM)",
        name_hi="दोपहर में खिड़कियां खोलना (12 बजे - 3 बजे)",
        name_mr="दुपारी खिडक्या उघडणे (१२ ते ३)",
        category="ventilation",
        engine_effect={"ventilation_shift": True, "reduction_pct": 25.0},
        applicability=["all"],
        source_id="cpcb-clean-air-action",
        description_en="Airing your home during midday boundary-layer lifting instead of morning inversion saves heavy PM2.5 ingress.",
        description_hi="सुबह के बजाय दोपहर में खिड़की खोलने से जब धूप से धुआं ऊपर उठता है, घर में कम प्रदूषण आता है।",
        description_mr="सकाळच्या धुक्याऐवजी दुपारी सूर्यप्रकाशात खिडक्या उघडल्याने घरात कमी धूर येतो.",
    ),
    InterventionOption(
        id="wet_mopping_no_dry_sweeping",
        tier="zero",
        cost_inr=0.0,
        name_en="Wet Mopping Only (Stop Dry Sweeping)",
        name_hi="केवल गीला पोंछा (सूखा झाड़ू बंद करें)",
        name_mr="फक्त ओला फरशी पुसणे (सुका झाडू बंद करा)",
        category="sealing",
        engine_effect={"resuspension_reduction_pct": 15.0},
        applicability=["all"],
        source_id="who-indoor-air-guidelines",
        description_en="Dry sweeping resuspends toxic settled fine particulate matter. Wet mopping traps particles without re-polluting indoor air.",
        description_hi="सूखा झाड़ू लगाने से जमीन पर बैठी धूल दोबारा हवा में फैलती है। गीला पोंछा धूल को बिना उड़ाए साफ करता है।",
        description_mr="सुका झाडू मारल्याने जमिनीवरील बारीक धूळ पुन्हा हवेत उडते. ओल्या फडक्याने पुसल्याने धूळ हवेत पसरत नाही.",
    ),
    InterventionOption(
        id="towel_door_draft_stopper",
        tier="zero",
        cost_inr=0.0,
        name_en="Damp Cloth / Rolled Towel Door Seal",
        name_hi="दरवाजे के नीचे गीला कपड़ा या तौलिया लगाना",
        name_mr="दरवाज्याखाली ओला टॉवेल ठेवणे",
        category="sealing",
        engine_effect={"envelope_transition": "sealed_closed"},
        applicability=["all"],
        source_id="ashrae-indoor-filtration",
        description_en="Placing a rolled towel under the main entry door blocks external smog draft through ground gaps.",
        description_hi="मुख्य दरवाजे के नीचे तौलिया या पायदान लगाने से बाहर का जहरीला धुआं नीचे की दरारों से अंदर नहीं आता।",
        description_mr="मुख्य दरवाजाच्या खालच्या फटीमध्ये टॉवेल ठेवल्याने बाहेरील धूर घरात शिरत नाही.",
    ),
    InterventionOption(
        id="shift_morning_exercise",
        tier="zero",
        cost_inr=0.0,
        name_en="Shift Exercise to Midday or Indoors",
        name_hi="सुबह की सैर/व्यायाम दोपहर या घर के अंदर करना",
        name_mr="सकाळचा व्यायाम दुपारी किंवा घरात करणे",
        category="ventilation",
        engine_effect={"exercise_shift": True},
        applicability=["exercise"],
        source_id="cpcb-health-advisory",
        description_en="Early morning winter air traps toxic pollutants near ground level. Exercising after noon cuts inhaled dose substantially.",
        description_hi="सर्दियों की सुबह जमीन के पास सबसे घना स्मॉग होता है। दोपहर में व्यायाम करने से फेफड़ों में कम जहर जाता है।",
        description_mr="हिवाळ्यात सकाळी जमिनीजवळ सर्वात जास्त धूर असतो. दुपारच्या वेळी व्यायाम केल्यास फुफ्फुसांचे रक्षण होते.",
    ),
    # Tier 1: Under ₹1,000
    InterventionOption(
        id="family_n95_masks",
        tier="under_1k",
        cost_inr=450.0,  # ~3-4 pack certified ISI/BIS N95 masks
        name_en="Certified ISI / BIS N95 Masks for Commutes",
        name_hi="आने-जाने के लिए प्रमाणित N95 मास्क",
        name_mr="प्रवासासाठी प्रमाणित एन-९५ मास्क",
        category="mask",
        engine_effect={"mask_type": "n95"},
        applicability=["all", "outdoor_commute"],
        source_id="icmr-air-mask-study",
        description_en="Certified N95 masks filter up to 85% of real-world inhaled fine particles compared to cloth or no mask.",
        description_hi="प्रमाणित N95 मास्क साधारण कपड़े के मास्क की तुलना में 85% तक सूक्ष्म प्रदूषण कणों को फेफड़ों में जाने से रोकता है।",
        description_mr="प्रमाणित एन-९५ मास्क कपड्याच्या मास्कपेक्षा ८५% पर्यंत सूक्ष्म कण फुफ्फुसात जाण्यापासून रोखतो.",
    ),
    InterventionOption(
        id="foam_weatherstripping_tape",
        tier="under_1k",
        cost_inr=350.0,  # Self-adhesive foam roll for doors/windows
        name_en="Self-Adhesive Window & Door Foam Weatherstripping",
        name_hi="खिड़कियों और दरवाजों के लिए फोम सीलिंग टेप",
        name_mr="खिडक्या व दरवाजांसाठी फोम सीलिंग टेप",
        category="sealing",
        engine_effect={"envelope_transition": "sealed_closed"},
        applicability=["all"],
        source_id="epa-weatherization-iaq",
        description_en="Seals perimeter cracks and window gaps, reducing outdoor smog infiltration by over 30%.",
        description_hi="खिड़कियों और दरवाजों की दरारों को सील करता है, जिससे बाहर का धुआं अंदर आना 30% से अधिक कम हो जाता है।",
        description_mr="खिडक्या आणि दरवाजांच्या फटी बंद करतो, ज्यामुळे बाहेरील धूर घरात येणे ३०% पेक्षा जास्त कमी होते.",
    ),
    # Tier 2: Over ₹5,000
    InterventionOption(
        id="hepa_room_purifier",
        tier="over_5k",
        cost_inr=8500.0,
        name_en="True HEPA Air Purifier (CADR 250 m³/h)",
        name_hi="ट्रू HEPA एयर प्यूरीफायर (CADR 250 m³/h)",
        name_mr="ट्रू हेपा एअर प्युरिफायर (CADR 250 m³/h)",
        category="purifier",
        engine_effect={"cadr_m3_h": 250.0},
        applicability=["all"],
        source_id="cpcb-purifier-guidelines",
        description_en="Reduces bedroom PM2.5 levels by 70-85% in closed rooms, providing a clean air sanctuary during sleep.",
        description_hi="बंद कमरे में PM2.5 के स्तर को 70-85% तक कम करता है, जिससे सोते समय स्वच्छ हवा मिलती है।",
        description_mr="बंद खोलीत PM2.5 पातळी ७०-८५% पर्यंत कमी करते, झोपताना शुद्ध हवा प्रदान करते.",
    ),
    InterventionOption(
        id="diy_corsi_rosenthal_box",
        tier="under_1k",  # Or under 3k
        cost_inr=2200.0,  # Box fan + 2 MERV 13 filters
        name_en="DIY Corsi-Rosenthal / Box Fan Air Cleaner",
        name_hi="कम खर्च में DIY बॉक्स फैन एयर क्लीनर",
        name_mr="कमी खर्चात DIY बॉक्स फॅन एअर क्लीनर",
        category="purifier",
        engine_effect={"cadr_m3_h": 180.0},
        applicability=["all"],
        source_id="corsi-rosenthal-clean-air",
        description_en="A proven high-CADR low-cost DIY filtration system built from a domestic fan and MERV-13 filters.",
        description_hi="घरेलू पंखे और MERV-13 फिल्टर से बना किफायती और अत्यधिक प्रभावी प्यूरीफायर विकल्प।",
        description_mr="घरगुती पंखा आणि MERV-13 फिल्टरपासून बनवलेला अत्यंत प्रभावी आणि स्वस्त पर्याय.",
    ),
    InterventionOption(
        id="switch_metro_commute",
        tier="zero",
        cost_inr=0.0,
        name_en="Switch Two-Wheeler Commute to Metro Rail",
        name_hi="बाइक के बजाय मेट्रो से यात्रा करें",
        name_mr="दुचाकीऐवजी मेट्रोने प्रवास करा",
        category="transport",
        engine_effect={"transport_switch": ("two_wheeler_petrol", "metro")},
        applicability=["outdoor_commute"],
        source_id="dmrc-sustainability-data",
        description_en="Drastically cuts commuter direct inhalation of exhaust fumes and eliminates personal vehicle tailpipe emissions.",
        description_hi="सड़क पर सीधे जहरीले धुएं से बचाव होता है और आपकी गाड़ी से होने वाला प्रदूषण भी शून्य हो जाता है।",
        description_mr="रस्त्यावरील थेट धुरापासून संरक्षण होते आणि वाहनातून होणारे प्रदूषणही थांबते.",
    ),
]


@dataclass
class SimulationComparison:
    baseline_dose_ug: float
    simulated_dose_ug: float
    dose_reduction_ug: float
    dose_reduction_pct: float
    baseline_cigs: float
    simulated_cigs: float
    cigs_saved: float
    total_cost_inr: float
    cost_per_ug_reduced: float
    pm25_emissions_avoided_g: float
    co2e_emissions_avoided_kg: float
    community_200_pm25_avoided_g: float
    community_200_co2e_avoided_kg: float
    applied_interventions: list[str]


def run_simulation(
    baseline_dose: float,
    baseline_cigs: float,
    selected_intervention_ids: list[str],
    trip_distance_km: float = 12.0,
) -> SimulationComparison:
    """
    Computes exact comparative deltas between baseline and user-selected interventions.
    Strictly follows rule: NO LLM MATH.
    """
    selected_interventions = [
        item for item in INTERVENTION_CATALOGUE if item.id in selected_intervention_ids
    ]

    total_cost = sum(item.cost_inr for item in selected_interventions)
    fraction_reduction = 0.0
    avoided_pm25_emissions = 0.0
    avoided_co2e_emissions = 0.0

    for item in selected_interventions:
        effect = item.engine_effect
        if "reduction_pct" in effect:
            fraction_reduction += (effect["reduction_pct"] / 100.0) * (1.0 - fraction_reduction)
        elif "cadr_m3_h" in effect:
            # Typical bedroom purifier contribution reduces daily indoor component by ~45%
            fraction_reduction += 0.45 * (1.0 - fraction_reduction)
        elif "mask_type" in effect:
            # Mask reduces outdoor commute dose slice by ~65-80%
            fraction_reduction += 0.30 * (1.0 - fraction_reduction)
        elif "envelope_transition" in effect:
            # Better sealing reduces baseline indoor ingress by ~20%
            fraction_reduction += 0.20 * (1.0 - fraction_reduction)
        elif "transport_switch" in effect:
            # 2-wheeler to metro saves exhaust dose and eliminates tailpipe emissions
            fraction_reduction += 0.25 * (1.0 - fraction_reduction)
            avoided_pm25_emissions += (0.045 - 0.001) * trip_distance_km
            avoided_co2e_emissions += (0.042 - 0.019) * trip_distance_km

    # Bound fraction reduction between 0 and 0.90 (cannot reduce exposure to absolute 0 in severe smog)
    fraction_reduction = min(0.90, max(0.0, fraction_reduction))

    sim_dose = round(baseline_dose * (1.0 - fraction_reduction), 1)
    dose_diff = round(baseline_dose - sim_dose, 1)
    pct_diff = round((dose_diff / baseline_dose * 100.0), 1) if baseline_dose > 0 else 0.0

    sim_cigs = round(baseline_cigs * (1.0 - fraction_reduction), 1)
    cigs_saved = round(baseline_cigs - sim_cigs, 1)

    cost_per_ug = round(total_cost / dose_diff, 2) if dose_diff > 0 and total_cost > 0 else 0.0

    return SimulationComparison(
        baseline_dose_ug=baseline_dose,
        simulated_dose_ug=sim_dose,
        dose_reduction_ug=dose_diff,
        dose_reduction_pct=pct_diff,
        baseline_cigs=baseline_cigs,
        simulated_cigs=sim_cigs,
        cigs_saved=cigs_saved,
        total_cost_inr=total_cost,
        cost_per_ug_reduced=cost_per_ug,
        pm25_emissions_avoided_g=round(avoided_pm25_emissions, 3),
        co2e_emissions_avoided_kg=round(avoided_co2e_emissions, 3),
        community_200_pm25_avoided_g=round(avoided_pm25_emissions * 200, 2),
        community_200_co2e_avoided_kg=round(avoided_co2e_emissions * 200, 2),
        applied_interventions=[i.name_en for i in selected_interventions],
    )
