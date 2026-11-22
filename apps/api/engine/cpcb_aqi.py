"""
CPCB National Air Quality Index (NAQI) Linear Sub-Index Calculator.
Verified against CPCB official NAQI Guidelines.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class AQIBand:
    name: str
    code: str
    color_hex: str
    i_lo: int
    i_hi: int
    c_lo: float
    c_hi: float
    health_statement_en: str
    health_statement_hi: str
    health_statement_mr: str


# PM2.5 Breakpoints (ug/m^3 24h average)
PM25_BREAKPOINTS: list[AQIBand] = [
    AQIBand(
        name="Good",
        code="good",
        color_hex="#16733D",
        i_lo=0,
        i_hi=50,
        c_lo=0.0,
        c_hi=30.0,
        health_statement_en="Minimal impact. Safe for all outdoor activities.",
        health_statement_hi="न्यूनतम प्रभाव। सभी बाहरी गतिविधियों के लिए सुरक्षित।",
        health_statement_mr="किमान परिणाम. सर्व बाह्य क्रियाकलापांसाठी सुरक्षित.",
    ),
    AQIBand(
        name="Satisfactory",
        code="satisfactory",
        color_hex="#7FB539",
        i_lo=51,
        i_hi=100,
        c_lo=30.1,
        c_hi=60.0,
        health_statement_en="Minor breathing discomfort to sensitive people.",
        health_statement_hi="संवेदनशील लोगों को सांस लेने में हल्की परेशानी हो सकती है।",
        health_statement_mr="संवेदनशील व्यक्तींना श्वास घेण्यास सौम्य त्रास होऊ शकतो.",
    ),
    AQIBand(
        name="Moderate",
        code="moderate",
        color_hex="#F2C200",
        i_lo=101,
        i_hi=200,
        c_lo=60.1,
        c_hi=90.0,
        health_statement_en="Breathing discomfort to people with lungs, asthma, and heart diseases.",
        health_statement_hi="फेफड़े, अस्थमा और हृदय रोग से पीड़ित लोगों को सांस लेने में परेशानी।",
        health_statement_mr="फुफ्फुस, दमा आणि हृदयविकार असलेल्या लोकांना श्वास घेण्यास त्रास.",
    ),
    AQIBand(
        name="Poor",
        code="poor",
        color_hex="#F28C28",
        i_lo=201,
        i_hi=300,
        c_lo=90.1,
        c_hi=120.0,
        health_statement_en="Breathing discomfort to most people on prolonged exposure.",
        health_statement_hi="लंबे समय तक रहने पर अधिकांश लोगों को सांस लेने में परेशानी।",
        health_statement_mr="दीर्घकाळ संपर्कात राहिल्याने बहुतांश लोकांना श्वास घेण्यास त्रास.",
    ),
    AQIBand(
        name="Very Poor",
        code="very_poor",
        color_hex="#D7263D",
        i_lo=301,
        i_hi=400,
        c_lo=120.1,
        c_hi=250.0,
        health_statement_en="Respiratory illness on prolonged exposure. Pronounced effect on sensitive groups.",
        health_statement_hi="लंबे समय तक रहने पर सांस की बीमारी हो सकती है। बच्चों और बुजुर्गों पर गंभीर प्रभाव।",
        health_statement_mr="दीर्घकाळ संपर्कात राहिल्याने श्वसनाचे विकार उद्भवू शकतात. संवेदनशील गटांवर तीव्र परिणाम.",
    ),
    AQIBand(
        name="Severe",
        code="severe",
        color_hex="#7A0F2E",
        i_lo=401,
        i_hi=500,
        c_lo=250.1,
        c_hi=500.0,
        health_statement_en="Affects healthy people and seriously impacts those with existing diseases.",
        health_statement_hi="स्वस्थ लोगों को भी प्रभावित करता है और पहले से बीमार लोगों पर गंभीर असर डालता है।",
        health_statement_mr="निरोगी व्यक्तींवरही परिणाम होतो आणि आधीच आजारी असलेल्यांवर गंभीर परिणाम होतो.",
    ),
]

# PM10 Breakpoints (ug/m^3 24h average)
PM10_BREAKPOINTS: list[AQIBand] = [
    AQIBand("Good", "good", "#1E8E4E", 0, 50, 0.0, 50.0, "", "", ""),
    AQIBand(
        "Satisfactory", "satisfactory", "#7FB539", 51, 100, 50.1, 100.0, "", "", ""
    ),
    AQIBand("Moderate", "moderate", "#F2C200", 101, 200, 100.1, 250.0, "", "", ""),
    AQIBand("Poor", "poor", "#F28C28", 201, 300, 250.1, 350.0, "", "", ""),
    AQIBand("Very Poor", "very_poor", "#D7263D", 301, 400, 350.1, 430.0, "", "", ""),
    AQIBand("Severe", "severe", "#7A0F2E", 401, 500, 430.1, 500.0, "", "", ""),
]


def calculate_sub_index(
    concentration: float, breakpoints: list[AQIBand]
) -> tuple[int, AQIBand]:
    """
    Computes CPCB linear sub-index for a single pollutant concentration.
    Formula:
        I = ((I_hi - I_lo) / (C_hi - C_lo)) * (C - C_lo) + I_lo
    Handles edge cases below 0 or beyond severe range linearly with upper clamping if desired.
    """
    if concentration < 0:
        return 0, breakpoints[0]

    for band in breakpoints:
        if concentration <= band.c_hi:
            ratio = (band.i_hi - band.i_lo) / (band.c_hi - band.c_lo)
            sub_index = round(ratio * (concentration - band.c_lo) + band.i_lo)
            sub_index = max(band.i_lo, min(band.i_hi, sub_index))
            return int(sub_index), band

    # Beyond upper breakpoint (Severe+ / > 500 ug/m^3)
    # The official CPCB National Air Quality Index tops out at 500.
    last = breakpoints[-1]
    return 500, last


def get_overall_cpcb_aqi(
    pm25: float | None, pm10: float | None = None
) -> tuple[int, AQIBand, str]:
    """
    Returns the composite AQI and responsible primary pollutant according to CPCB rules.
    Sub-index is max of available pollutant sub-indices.
    """
    pm25_idx, pm25_band = (
        calculate_sub_index(pm25 or 0.0, PM25_BREAKPOINTS)
        if pm25 is not None
        else (0, PM25_BREAKPOINTS[0])
    )
    pm10_idx, pm10_band = (
        calculate_sub_index(pm10 or 0.0, PM10_BREAKPOINTS)
        if pm10 is not None
        else (0, PM10_BREAKPOINTS[0])
    )

    if pm25_idx >= pm10_idx:
        return pm25_idx, pm25_band, "PM2.5"
    else:
        return pm10_idx, pm10_band, "PM10"
