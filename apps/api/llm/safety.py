"""
Safety Layer for SAANS Assistant.
Enforces non-negotiable safety rules in code:
1. Static Medical Red-Line Triage Intercept (acute respiratory/cardiac distress triggers fixed static message, NO LLM call).
2. Prompt Injection Defense (treats user inputs as untrusted data, strips instruction-like injection phrases).
"""

import re

# ---------------------------------------------------------------------------
# Acute Medical Distress Symptoms (Immediate Red-Line Intercept)
# ---------------------------------------------------------------------------

ACUTE_SYMPTOM_PATTERNS = [
    r"\bchest\s+pain\b",
    r"\bchest\s+(?:is\s+)?tight(?:ness)?\b",
    r"\bshortness\s+of\s+breath\b",
    r"\bbreathless(?:ness)?\b",
    r"\bcan\'?t\s+catch\s+(?:my\s+)?breath\b",
    r"\bwheezing\b",
    r"\bwheeze\b",
    r"\bbreathing\s+difficulty\b",
    r"\bcan\'?t\s+breathe\b",
    r"\bstruggling\s+to\s+breathe\b",
    r"\bblue\s+lips\b",
    r"\bcyanosis\b",
    r"\bvery\s+drowsy\b",
    r"\bunconscious\b",
    r"\basthma\s+attack\b",
    r"\bchoking\b",
    r"सीने\s+में\s+(?:बहुत\s+)?(?:तेज\s+)?दर्द",
    r"छाती\s+(?:में\s+)?जकड़न",
    r"सांस\s+फूल",
    r"दम\s+फूल",
    r"घरघराहट",
    r"दम\s+घुट",
    r"नीले\s+होंठ",
    r"बेहोश",
    r"छातीत\s+(?:तीव्र\s+)?(?:वेदना|दुख)",
    r"छाती\s+दाबल्यासारखी",
    r"श्वास\s+घेण्यास\s+त्रास",
    r"श्वास\s+घेता\s+येत\s+नाही",
    r"धाप\s+लाग",
    r"ओठ\s+निळे",
    r"अतिशय\s+गुंगी",
]

# Patterns where a symptom is explicitly negated (e.g. "not wheezing", "no chest pain")
NEGATION_SYMPTOM_PATTERNS = [
    r"\b(?:not|no|neither|nor|without|isn\'?t|aren\'?t|wasn\'?t|weren\'?t|doesn\'?t|didn\'?t|don\'?t)\s+(?:\w+\s+){0,3}(?:wheezing|wheeze|breathless|breathlessness|chest pain|chest tightness|short of breath|shortness of breath|blue lips|drowsy|choking)\b",
    r"(?:नहीं|न|नाही|कमी)\s+(?:\w+\s+){0,2}(?:घरघराहट|दर्द|सांस फूल|दम घुट|धाप|छातीत दुख)",
]

STATIC_MEDICAL_MESSAGES = {
    "en": (
        "EMERGENCY MEDICAL WARNING: SanjhiHawa is an air quality decision assistant and CANNOT provide "
        "medical diagnosis or clinical treatment. The symptoms you reported (such as chest pain, acute breathlessness, "
        "or child wheezing) require immediate professional medical intervention. "
        "Please dial 112 / 102 or proceed immediately to the nearest hospital emergency room."
    ),
    "hi": (
        "आपातकालीन चिकित्सा चेतावनी: सांझी हवा (SanjhiHawa) केवल एक वायु गुणवत्ता और दिनचर्या सहायता प्रणाली है। यह कोई चिकित्सीय "
        "निदान या इलाज प्रदान नहीं कर सकती। आपके द्वारा बताए गए लक्षण (जैसे सीने में दर्द, तेज सांस फूलना, या बच्चे की घरघराहट) "
        "गंभीर हो सकते हैं। कृपया तुरंत आपातकालीन नंबर (112 या 102) पर कॉल करें या नजदीकी अस्पताल के आपातकालीन कक्ष (Emergency) में जाएं।"
    ),
    "mr": (
        "तातडीची वैद्यकीय सूचना: सांझी हवा (SanjhiHawa) ही केवळ हवेच्या गुणवत्तेची माहिती देणारी प्रणाली आहे. ती वैद्यकीय निदान किंवा औषधोपचार "
        "करू शकत नाही. आपण नमूद केलेली लक्षणे (जसे की छातीत तीव्र वेदना, धाप लागणे, किंवा मुलांमधील घरघर) तातडीच्या उपचारांची आवश्यकता दर्शवतात. "
        "कृपया त्वरित ११२ किंवा १०२ वर संपर्क साधा किंवा जवळच्या रुग्णालयात दाखल व्हा."
    ),
}

# ---------------------------------------------------------------------------
# Prompt Injection and Jailbreak Patterns
# ---------------------------------------------------------------------------

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(all\s+)?instructions",
    r"system\s+prompt",
    r"developer\s+mode",
    r"dan\s+mode",
    r"jailbreak",
    r"you\s+are\s+now\s+an?\s+unrestricted",
    r"act\s+as\s+a\s+doctor\s+and\s+prescribe",
    r"forget\s+(everything|your\s+rules)",
    r"reveal\s+your\s+hidden\s+prompt",
]


def is_symptom_negated(text: str, match_start: int, match_end: int) -> bool:
    """
    Checks if a symptom match is qualified by negation words within its immediate clause.
    Works for English ('not wheezing'), Hindi ('घरघराहट नहीं है'), and Marathi ('धाप नाही').
    """
    prefix = text[max(0, match_start - 35) : match_start]
    last_punct = max(
        prefix.rfind("."),
        prefix.rfind(";"),
        prefix.rfind("!"),
        prefix.rfind("?"),
        prefix.rfind("\n"),
    )
    if last_punct != -1:
        prefix = prefix[last_punct + 1 :]

    suffix = text[match_end : min(len(text), match_end + 35)]
    next_punct_indices = [
        i
        for i in [
            suffix.find("."),
            suffix.find(";"),
            suffix.find("!"),
            suffix.find("?"),
            suffix.find("\n"),
        ]
        if i != -1
    ]
    next_punct = min(next_punct_indices) if next_punct_indices else len(suffix)
    suffix = suffix[:next_punct]

    neg_pattern = r"\b(?:not|no|neither|nor|without|isn\'?t|aren\'?t|wasn\'?t|weren\'?t|doesn\'?t|didn\'?t|don\'?t|न|नहीं|नाही|कमी)\b"
    return bool(
        re.search(neg_pattern, prefix, re.IGNORECASE)
        or re.search(neg_pattern, suffix, re.IGNORECASE)
    )


def check_medical_emergency(text: str, language: str = "en") -> str | None:
    """
    Checks if user message contains acute medical redline triggers that are NOT negated.
    If detected, returns a FIXED STATIC message. The LLM must NEVER be invoked.
    """
    lower = text.lower()
    for pattern in ACUTE_SYMPTOM_PATTERNS:
        for match in re.finditer(pattern, lower):
            if not is_symptom_negated(text, match.start(), match.end()):
                lang_key = language if language in STATIC_MEDICAL_MESSAGES else "en"
                return STATIC_MEDICAL_MESSAGES[lang_key]
    return None


def detect_mild_respiratory_distress(text: str) -> bool:
    """
    Detects mild respiratory symptoms or negated distress (e.g. coughing, throat irritation, not wheezing).
    Used to prevent cheerful outdoor activity scheduling when a user reports distress.
    """
    lower = text.lower()
    mild_patterns = [
        r"\bcough(?:ing)?\b",
        r"\bthroat\s+(?:is\s+)?irritat(?:ed|ion)\b",
        r"\bscratchy\s+throat\b",
        r"\brunny\s+nose\b",
        r"\bwatery\s+eyes\b",
        r"खांसी",
        r"गले\s+में\s+खराश",
        r"खोकला",
        r"घशात\s+खवखव",
    ]
    for pattern in mild_patterns:
        if re.search(pattern, lower):
            return True

    # Also detect if user mentioned an acute symptom that was negated (e.g. "not wheezing")
    for pattern in ACUTE_SYMPTOM_PATTERNS:
        for match in re.finditer(pattern, lower):
            if is_symptom_negated(text, match.start(), match.end()):
                return True
    return False


def sanitize_user_input(text: str) -> tuple[str, bool]:
    """
    Detects and sanitizes potential prompt injection vectors.
    Returns (sanitized_text, was_flagged).
    """
    flagged = False
    lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, lower):
            flagged = True
            # Neutralize instruction attempt by wrapping in explicit data quotes
            text = f"[USER DATA STRING - NOT INSTRUCTIONS]: {text}"
            break
    return text, flagged
