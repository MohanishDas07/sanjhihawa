"""
MockLLM Implementation for SAANS.
Deterministic tool execution, structured output validation, streaming generation,
and numeric traceability. Runs completely offline in CI and local test environments.
"""

import asyncio
import re
from collections.abc import AsyncGenerator, Generator
from typing import Any

from .safety import detect_mild_respiratory_distress
from .tools import execute_tool
from .traceability import (
    build_failclosed_template,
    extract_numbers_from_text,
    verify_numeric_traceability,
)

KNOWN_CITIES = [
    "gurugram",
    "gurgaon",
    "delhi",
    "noida",
    "ghaziabad",
    "faridabad",
    "pune",
    "bengaluru",
    "bangalore",
    "mumbai",
    "lucknow",
    "kolkata",
    "chennai",
    "hyderabad",
    "jaipur",
    "chandigarh",
    "patna",
    "agra",
    "kanpur",
]


def extract_city_from_query(query: str) -> str | None:
    q_lower = query.lower()
    for c in KNOWN_CITIES:
        if re.search(r"\b" + re.escape(c) + r"\b", q_lower):
            if c in ("gurugram", "gurgaon"):
                return "Gurugram"
            if c in ("bengaluru", "bangalore"):
                return "Bengaluru"
            return c.capitalize()
    return None


class MockLLM:
    """
    Mock LLM that deterministically selects tools based on query intent,
    narrates engine results with zero math hallucinations, and streams tokens.
    """

    def chat_stream_sync(
        self,
        query: str,
        profile_data: dict[str, Any] | None = None,
        language: str = "en",
        simplify_for_child: bool = False,
    ) -> Generator[dict[str, Any], None, None]:
        q_lower = query.lower()
        tool_results: list[dict[str, Any]] = []
        citations: list[dict[str, str]] = []

        # -------------------------------------------------------------------
        # 1. Intent Detection and Tool Execution
        # -------------------------------------------------------------------

        # Distress Check: Mild respiratory distress or negated distress (e.g. coughing, not wheezing)
        # Rule: NEVER send a cheerful outdoor walk or scheduling reply after a distress word!
        if detect_mild_respiratory_distress(query):
            res = execute_tool(
                "lookup_guidance",
                {"query": "pediatric respiratory smog irritation coughing", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"धुएं और प्रदूषण के दौरान खांसी श्वसन तंत्र की प्राकृतिक रक्षा प्रतिक्रिया है [{chunk['source_id']}]। "
                    f"बच्चे को घर के अंदर एक बंद, साफ और फिल्टर किए गए कमरे में रखें। गुनगुना पानी पिलाएं और किसी भी प्रकार की शारीरिक दौड़-भाग से बचाएं। "
                    f"सावधानी: यदि सांस फूलने लगे, सीने में जकड़न हो, होंठ नीले पड़ने लगें या अत्यधिक सुस्ती आए, तो तुरंत आपातकालीन चिकित्सा सहायता (112 या 102) लें।"
                )
            elif language == "mr":
                narrative = (
                    f"प्रदूषणामुळे येणारा खोकला ही श्वसनमार्गाची नैसर्गिक प्रतिक्रिया आहे [{chunk['source_id']}]. "
                    f"मुलाला घरात बंद आणि स्वच्छ हवेच्या खोलीत ठेवा. कोमट पाणी प्यायला द्या आणि धावपळ टाळा. "
                    f"महत्त्वाची सूचना: धाप लागणे, घरघर, छातीत दुखणे अशी लक्षणे दिसल्यास त्वरित ११२ किंवा १०२ वर संपर्क साधा."
                )
            else:
                narrative = (
                    f"For coughing or airway irritation during smog episodes: Inhaled fine particulates cause direct bronchial surface irritation [{chunk['source_id']}]. "
                    f"Keep the child indoors in a sealed room with active mechanical HEPA filtration or damp-mopped surfaces, offer warm fluids for airway hydration, and suspend physical exertion. "
                    f"Safety Watch: If acute red-line symptoms emerge—such as audible wheezing, rapid breathlessness, chest tightness, or blue-tinged lips—seek immediate emergency medical care (dial 112 / 102)."
                )

        # Vulnerable family members (asthmatic / elderly) morning walk query
        elif bool(
            re.search(
                r"\b(asthma|asthmatic|father|dad|mother|mom|parent|elderly|senior|dada|dadi)\b",
                q_lower,
            )
        ) and bool(
            re.search(
                r"\b(walk|walking|morning|6\s*am|7\s*am|exercise|jog|jogging)\b",
                q_lower,
            )
        ):
            res_air = execute_tool(
                "get_air",
                {
                    "city": extract_city_from_query(query)
                    or (profile_data.get("city_name") if profile_data else "Ghaziabad")
                },
            )
            res_guide = execute_tool(
                "lookup_guidance",
                {
                    "query": "elderly cardiac asthmatic winter inversion walk n95",
                    "top_k": 3,
                },
            )
            tool_results.extend([res_air, res_guide])
            citations.append(
                {
                    "id": "elderly-and-cardiac-risk",
                    "title": "Senior Citizens: Cardiovascular and Cerebrovascular Smog Risks",
                    "publisher": "Cardiological Society of India (CSI)",
                }
            )
            citations.append(
                {
                    "id": "winter-thermal-inversion",
                    "title": "Meteorological Inversion and Diurnal Smog Cycles in Indo-Gangetic Plains",
                    "publisher": "India Meteorological Department (IMD) & SAFAR",
                }
            )

            narrative = (
                "No, it is NOT safe to take an asthmatic or elderly family member for an outdoor walk at 6:00 AM during winter smog [elderly-and-cardiac-risk, winter-thermal-inversion]. "
                "Early morning coincides with surface temperature inversion, trapping peak PM2.5 concentrations at breathing level. Cold polluted air triggers severe bronchospasm in asthmatics and blood pressure spikes in seniors. "
                "Keep them indoors in a filtered room during the morning. If they wish to exercise, shift walking indoors or wait until the 12 PM - 4 PM afternoon window when solar heating dilutes ground-level smog, and ensure they wear an ISI-certified N95 mask."
            )

        # Trade-off comparison: Purifier vs Commute / cutting commute
        elif (
            bool(re.search(r"\b(purifier|hepa|cadr)\b", q_lower))
            and bool(re.search(r"\b(commute|transit|metro|cut)\b", q_lower))
            and bool(re.search(r"\b(or|vs|versus|compare|just)\b", q_lower))
        ):
            sim_res = execute_tool(
                "simulate",
                {
                    "selected_intervention_ids": [
                        "hepa_room_purifier",
                        "family_n95_masks",
                        "shift_ventilation_afternoon",
                    ],
                    "community_count": 1,
                },
            )
            hepa_guide = execute_tool(
                "lookup_guidance",
                {"query": "hepa filter technology cadr 70-85", "top_k": 1},
            )
            mask_guide = execute_tool(
                "lookup_guidance",
                {"query": "mask n95 standards commute", "top_k": 1},
            )
            tool_results.extend([sim_res, hepa_guide, mask_guide])
            citations.append(
                {
                    "id": "hepa-filter-technology",
                    "title": "True HEPA Filtration Technology",
                    "publisher": "US EPA Indoor Air Quality Division",
                }
            )
            citations.append(
                {
                    "id": "transport-emission-comparison",
                    "title": "Transport Mode Tailpipe Emissions",
                    "publisher": "ARAI & CPCB",
                }
            )

            narrative = (
                f"Comparing home air purifiers against cutting commute exposure: "
                f"In-room True HEPA purifiers cut closed-room particulate levels by 70-85% during sleep [hepa-filter-technology]. "
                f"Simulating a True HEPA purifier combined with certified N95 masks and afternoon window ventilation reduces daily inhaled dose by {sim_res['dose_reduction_pct']}% "
                f"(saving {sim_res['dose_reduction_ug']} µg of PM2.5 daily, equivalent to saving {sim_res['cigs_saved']} cigarettes/day) at a cost of ₹{sim_res['total_cost_inr']}. "
                f"Cutting or shifting outdoor commutes avoids toxic peak morning road plumes [transport-emission-comparison], while a purifier protects you during long indoor hours."
            )

        # Myth intent: Jaggery (Strict word boundary to prevent matching 'Gurugram' or 'figure'!)
        elif bool(re.search(r"\b(jaggery|gur|gud)\b", q_lower)) or any(
            w in q_lower for w in ["गुड़", "गूळ"]
        ):
            res = execute_tool(
                "lookup_guidance", {"query": "myth jaggery gur lung detox", "top_k": 1}
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"गुड़ खाने से फेफड़ों में जमा PM2.5 साफ नहीं होता [{chunk['source_id']}]। "
                    f"गुड़ भोजन नली और पेट में जाता है, जबकि प्रदूषण कण सांस नली और फेफड़ों के सबसे भीतरी हिस्सों में पहुंचते हैं। "
                    f"गुड़ पर निर्भर रहकर N95 मास्क न पहनना स्वास्थ्य के लिए खतरनाक है।"
                )
            else:
                narrative = (
                    f"Consuming jaggery (gur) does NOT detoxify or clear lungs from inhaled PM2.5 [{chunk['source_id']}]. "
                    f"Ingested jaggery enters the digestive tract, whereas fine particulate matter is inhaled deep into the pulmonary alveoli and bloodstream. "
                    f"There is no biological mechanism for food in the stomach to extract trapped particulates from lung tissue."
                )

        # Myth intent: Plants (Corrected 10-1000 plants/m2 figure for VOCs, zero CADR for PM2.5)
        elif bool(
            re.search(r"\b(plant|plants|snake\s+plant|areca|money\s+plant)\b", q_lower)
        ) or any(w in q_lower for w in ["पौधे", "पौधों", "झाडे", "झाड", "प्लांट", "स्नेक"]):
            res = execute_tool(
                "lookup_guidance",
                {"query": "myth indoor plants filter smog", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"वैज्ञानिक शोध के अनुसार, इनडोर पौधे (जैसे स्नेक प्लांट या मनी प्लांट) हवा से "
                    f"सूक्ष्म प्रदूषण कणों (PM2.5) को नहीं छान सकते [{chunk['source_id']}]। "
                    f"पौधे केवल कुछ गैसों (VOCs) को धीरे-धीरे सोखते हैं। कमरे में वेंटिलेशन की बराबरी करने के लिए "
                    f"प्रति वर्ग मीटर 10 से 1,000 पौधों की आवश्यकता होगी, और PM2.5 के लिए इनका CADR शून्य है। केवल HEPA प्यूरीफायर ही स्मॉग साफ कर सकता है।"
                )
            elif language == "mr":
                narrative = (
                    f"वैज्ञानिक अभ्यासानुसार, घरातील झाडे सूक्ष्म प्रदूषण कण (PM2.5) गाळू शकत नाहीत [{chunk['source_id']}]. "
                    f"झाडे फक्त काही वायू (VOCs) हळूहळू शोषून घेतात. हवेच्या शुद्धीकरणासाठी दर चौरस मीटरला १० ते १,००० झाडांची गरज पडेल, "
                    f"आणि PM2.5 कणांवर झाडांचा कोणताही परिणाम होत नाही. केवळ मेकॅनिकल हेपा प्युरिफायरच सूक्ष्म कण रोखू शकतो."
                )
            else:
                if simplify_for_child:
                    narrative = (
                        f"Plants are awesome for looking green and making fresh oxygen during the day, "
                        f"but they cannot catch the microscopic dirty smog specks [{chunk['source_id']}]. "
                        f"To clean a single bedroom, you would need hundreds of plants! "
                        f"Only a real mechanical air purifier with a HEPA filter can trap fine PM2.5 particles."
                    )
                else:
                    narrative = (
                        f"Scientific consensus confirms that indoor house plants cannot filter fine particulate smog (PM2.5) [{chunk['source_id']}]. "
                        f"While plants absorb trace volatile organic compounds in closed lab chambers, peer-reviewed research (Cummings & Waring, 2020) demonstrated that matching typical building ventilation requires 10 to 1,000 plants per square meter. "
                        f"Potted plants have practically zero Clean Air Delivery Rate (CADR) for fine particles. Do not rely on plants as a smog defense."
                    )

        # Myth intent: Steam
        elif bool(re.search(r"\b(steam|inhalation)\b", q_lower)) or any(
            w in q_lower for w in ["भाप", "वाफ"]
        ):
            res = execute_tool(
                "lookup_guidance", {"query": "myth steam inhalation", "top_k": 1}
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"Steam inhalation can soothe upper nasal passages, but it CANNOT dissolve or dislodge fine PM2.5 particles "
                f"lodged deep inside lung alveoli [{chunk['source_id']}]. Excessive boiling steam can scald delicate airways."
            )

        # Myth intent: Diffusers
        elif bool(
            re.search(
                r"\b(diffuser|diffusers|aroma|essential\s+oil|humidifier)\b", q_lower
            )
        ):
            res = execute_tool(
                "lookup_guidance",
                {"query": "myth diffusers essential oils air cleaning", "top_k": 1},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"Aroma diffusers and essential oil humidifiers do NOT clean smog [{chunk['source_id']}]. "
                f"In fact, vaporizing oils releases volatile organic compounds (VOCs) that react with ambient ozone to form secondary organic aerosols and ultrafine particles, worsening indoor air quality."
            )

        # DIY Corsi-Rosenthal Box
        elif bool(
            re.search(
                r"\b(corsi|rosenthal|box\s+fan|diy\s+purifier|diy\s+filter)\b", q_lower
            )
        ):
            res = execute_tool(
                "lookup_guidance",
                {"query": "corsi rosenthal box diy air purifier", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"A DIY Corsi-Rosenthal Box combines a 20-inch box fan with four or five MERV 13 furnace filters [{chunk['source_id']}]. "
                f"It provides a high Clean Air Delivery Rate (CADR > 400 m³/h) at roughly one-third the cost of commercial HEPA purifiers. "
                f"Seal all edges with duct tape and replace MERV 13 filters every 5 to 6 months of heavy winter smog use."
            )

        # Masks
        elif bool(re.search(r"\b(mask|masks|n95|cloth\s+mask|ffp2)\b", q_lower)) or any(
            w in q_lower for w in ["मास्क"]
        ):
            res = execute_tool(
                "lookup_guidance", {"query": "mask n95 standards leakage", "top_k": 2}
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"साधारण कपड़े का मास्क या रुमाल PM2.5 के विरुद्ध अप्रभावी है, क्योंकि इसके छिद्र 100 से 500 माइक्रोन चौड़े होते हैं [{chunk['source_id']}]। "
                    f"केवल प्रमाणित ISI/BIS N95 मास्क ही 85% तक सूक्ष्म कणों को रोकता है। सफर के दौरान हमेशा N95 मास्क पहनें।"
                )
            else:
                narrative = (
                    f"Cloth masks and handkerchiefs filter less than 20% of PM2.5 because woven fabric pores are over 100 microns wide, "
                    f"whereas fine particles are smaller than 2.5 microns [{chunk['source_id']}]. "
                    f"Certified ISI/BIS N95 respirators provide an effective 85% fit-adjusted reduction. Rotate masks every 4 hours during outdoor transit."
                )

        # Purifier sizing alone
        elif bool(re.search(r"\b(purifier|cadr|sizing|room\s+volume|hepa)\b", q_lower)):
            res = execute_tool(
                "lookup_guidance",
                {"query": "cadr purifier sizing room volume", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"To size an air purifier properly, calculate your Room Volume in m³ (Length × Width × Height) and multiply by 4 to 5 Air Changes per Hour (ACH) [{chunk['source_id']}]. "
                f"For a standard 12x10x10 ft bedroom (~34 m³), you require a True HEPA purifier with a smoke CADR of at least 150 to 200 m³/h. "
                f"Always verify True HEPA (H13 grade) and strictly avoid ionizers or ozone generators."
            )

        # Simulation intent (Strict word boundary, NO bare 'cut'!)
        elif bool(
            re.search(
                r"\b(simulate|simulation|what\s+if|savings?|commute\s+shift)\b",
                q_lower,
            )
        ):
            res = execute_tool(
                "simulate",
                {
                    "selected_intervention_ids": [
                        "shift_ventilation_afternoon",
                        "family_n95_masks",
                    ],
                    "community_count": 200,
                },
            )
            tool_results.append(res)

            narrative = (
                f"Based on deterministic exposure modeling, combining afternoon window airing with certified N95 masks for commutes "
                f"reduces your daily inhaled particulate dose by {res['dose_reduction_pct']}% (saving {res['dose_reduction_ug']} µg of PM2.5/day). "
                f"This saves approximately {res['cigs_saved']} cigarette-equivalents per day at an initial cost of ₹{res['total_cost_inr']}. "
                f"Across 200 community households, this avoids {res['community_pm25_avoided_g']} grams of direct PM2.5 daily."
            )

        # Windows & Natural Ventilation
        elif bool(
            re.search(
                r"\b(window|windows|ventilat|fresh\s+air|balcony|night\s+air|airing)\b",
                q_lower,
            )
        ) or any(w in q_lower for w in ["खिड़की", "खिड़कियां", "खिडक्या", "वेंटिलेशन"]):
            res = execute_tool(
                "lookup_guidance",
                {"query": "windows ventilation morning inversion", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"सर्दियों में रात और सुबह के समय सतह का तापमान गिरने से भारी प्रदूषण जमीन के पास जमा रहता है [{chunk['source_id']}]। "
                    f"खिड़कियां रात 8 बजे से सुबह 11 बजे तक पूरी तरह बंद रखें। कमरे में ताजी हवा के लिए केवल दोपहर 12 बजे से 3 बजे के बीच 20-30 मिनट खिड़की खोलें, जब धूप से प्रदूषण ऊपर उठता है।"
                )
            else:
                narrative = (
                    f"Keep windows strictly shut between 8 PM and 11 AM during winter smog [{chunk['source_id']}]. "
                    f"Nighttime radiative cooling traps toxic vehicular exhaust and smoke within 150 meters of the ground. "
                    f"Aero-ventilate rooms for 20 to 30 minutes only between 12:00 PM and 3:00 PM, when solar convection dilutes surface particulates."
                )

        # Children & Pediatric Vulnerability
        elif bool(
            re.search(
                r"\b(child|children|kid|kids|baby|infant|pediatric|school|playground)\b",
                q_lower,
            )
        ) or any(w in q_lower for w in ["बच्चा", "बच्चे", "शिशु", "मुल"]):
            res = execute_tool(
                "lookup_guidance",
                {"query": "children pediatric vulnerability", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"बच्चों के फेफड़े अभी विकसित हो रहे होते हैं और वे प्रति किलोग्राम वजन वयस्कों से अधिक हवा सांस में लेते हैं [{chunk['source_id']}]। "
                    f"AQI खराब होने पर बच्चों की सुबह की बाहरी प्रार्थना और खेलकूद रद्द रखें। बाहर निकलते समय प्रमाणित बाल-अनुकूल N95 मास्क पहनाएं और घर में प्यूरीफायर चालू रखें।"
                )
            else:
                narrative = (
                    f"Children breathe significantly more air per kilogram of body weight than adults and have narrower airways [{chunk['source_id']}]. "
                    f"When AQI is Poor or Severe, cancel early morning outdoor sports and school assemblies. "
                    f"Ensure children wear snug, well-fitted pediatric N95 respirators during transit and keep bedroom indoor air filtered below 15 µg/m³."
                )

        # Elderly & Senior Citizens
        elif bool(
            re.search(
                r"\b(elder|elderly|senior|seniors|grandparent|grandparents|dada|dadi|nana|nani|aged)\b",
                q_lower,
            )
        ) or any(w in q_lower for w in ["बुजुर्ग", "वरिष्ठ", "दादा", "दादी"]):
            res = execute_tool(
                "lookup_guidance",
                {"query": "seniors elderly cardiovascular risk", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            if language == "hi":
                narrative = (
                    f"वरिष्ठ नागरिकों में सूक्ष्म प्रदूषण (PM2.5) रक्त वाहिकाओं में सूजन और रक्तचाप बढ़ा सकता है [{chunk['source_id']}]। "
                    f"बुजुर्गों को सुबह की ठंड और धुंध में बाहर टहलने से बचना चाहिए। योग या हल्का व्यायाम दोपहर 12 से 4 बजे के बीच या घर के अंदर फिल्टर किए गए कमरे में करें।"
                )
            else:
                narrative = (
                    f"Fine particulates (PM2.5) trigger acute vascular constriction, elevated arterial blood pressure, and cardiac stress in seniors [{chunk['source_id']}]. "
                    f"Elderly individuals should strictly avoid early morning walks before 9:00 AM during winter inversions. "
                    f"Maintain continuous True HEPA indoor filtration and consult your cardiologist if mild chest tightness or fatigue develops."
                )

        # Exercise, Running, Cycling, Sports
        elif bool(
            re.search(
                r"\b(exercise|workout|running|run|jog|jogging|cycling|cycle|gym|sports)\b",
                q_lower,
            )
        ) or any(w in q_lower for w in ["व्यायाम", "कसरत", "दौड़"]):
            res = execute_tool(
                "lookup_guidance",
                {"query": "outdoor running exercise cardio smog", "top_k": 2},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"During aerobic exercise, your minute ventilation volume increases from 6-8 L/min up to 40-60 L/min, driving soot deep into terminal alveoli [{chunk['source_id']}]. "
                f"Never perform vigorous cardio outdoors when AQI exceeds 150. "
                f"Shift outdoor runs or cycling to the 12:00 PM to 4:00 PM convective window, or exercise indoors in a HEPA-filtered room."
            )

        # General Greetings / Identity
        elif bool(
            re.search(
                r"^(hi|hello|hey|namaste|who\s+are\s+you|help)\b",
                q_lower,
            )
        ):
            res = execute_tool(
                "lookup_guidance",
                {"query": "cpcb air quality standards", "top_k": 1},
            )
            tool_results.append(res)
            chunk = res["results"][0]
            citations.append(
                {
                    "id": chunk["source_id"],
                    "title": chunk["title"],
                    "publisher": chunk["publisher"],
                }
            )

            narrative = (
                f"Namaste! I am SanjhiHawa Assistant, an open atmospheric intelligence platform for Indian households [{chunk['source_id']}]. "
                f"I compute personalized exposure reductions, True HEPA CADR purifier sizing, mask recommendations, and schedule optimizations. "
                f"You can ask me about air quality in any city (e.g. Pune, Mumbai, Delhi), room purifier capacity, or myth-busters on plants and jaggery."
            )

        else:
            # Default: Current air status & routine optimization
            # Respect city mentioned in query if any, else profile, else Ghaziabad
            target_city = extract_city_from_query(query)
            if not target_city:
                target_city = (
                    profile_data.get("city_name", "Ghaziabad")
                    if profile_data
                    else "Ghaziabad"
                )

            air_res = execute_tool("get_air", {"city": target_city})
            plan_res = execute_tool("get_day_plan", {"profile_data": profile_data})
            tool_results.extend([air_res, plan_res])
            citations.append(
                {
                    "id": "cpcb-naqi-bands",
                    "title": "CPCB NAQI Standards",
                    "publisher": "CPCB",
                }
            )

            city_name = air_res["city"]
            aqi = air_res["current_cpcb_aqi"]
            shift = plan_res["scheduled_shift"]

            if language == "hi":
                narrative = (
                    f"{city_name} में वर्तमान वायु गुणवत्ता {air_res['aqi_band'].title()} श्रेणी (AQI {aqi}) में है [cpcb-naqi-bands]। "
                    f"हमारी गणना के अनुसार, सुबह 7 बजे की सैर को दोपहर 2 बजे (14:00) स्थानांतरित करने से प्रदूषण का जोखिम {shift['reduction_pct']}% घटता है। "
                    f"खिड़कियां केवल दोपहर 12 से 3 बजे के बीच खोलें और बाहर निकलते समय N95 मास्क पहनें।"
                )
            elif language == "mr":
                narrative = (
                    f"{city_name} मध्ये सध्याची हवेची गुणवत्ता {air_res['aqi_band'].title()} श्रेणीत (AQI {aqi}) आहे [cpcb-naqi-bands]. "
                    f"सकाळचा व्यायाम दुपारी हलवल्यास प्रदूषणाचा संपर्क {shift['reduction_pct']}% कमी होतो. "
                    f"दुपारी १२ ते ३ दरम्यानच खिडक्या उघडा."
                )
            else:
                if simplify_for_child:
                    narrative = (
                        f"Right now in {city_name}, the air outside is in the {air_res['aqi_band'].title()} zone with an AQI of {aqi} [cpcb-naqi-bands]. "
                        f"Imagine the cold morning air as a heavy blanket holding tiny dust monsters close to the ground. "
                        f"If you play or walk at 2:00 PM instead of early morning, you breathe {shift['reduction_pct']}% less dirty air! "
                        f"Remember to wear your snug N95 superhero mask whenever you go out."
                    )
                else:
                    narrative = (
                        f"Current air quality in {city_name} is {air_res['aqi_band'].title()} with a CPCB AQI of {aqi} [cpcb-naqi-bands]. "
                        f"To minimize lung exposure, our scheduler recommends shifting flexible outdoor activities from {shift['baseline_time']} to {shift['optimized_time']}, "
                        f"reducing inhaled particulate concentration by {shift['reduction_pct']}%. "
                        f"Keep windows closed during morning thermal inversion and air rooms briefly between 12 PM and 3 PM."
                    )

        # -------------------------------------------------------------------
        # 2. Enforce Numeric Traceability Guard in Code (Fail-Closed)
        # -------------------------------------------------------------------
        user_nums = extract_numbers_from_text(query)
        is_traceable, _untraceable = verify_numeric_traceability(
            narrative, tool_results, user_context_numbers=user_nums
        )
        if not is_traceable:
            # FAIL-CLOSED: Discard untraceable text and fall back to engine-grounded template!
            narrative = build_failclosed_template(tool_results, language=language)

        # -------------------------------------------------------------------
        # 3. Stream Events and Tokens (SSE Simulation)
        # -------------------------------------------------------------------
        # Yield tool calls event
        yield {
            "event": "tool_executed",
            "data": {
                "tools_used": [
                    res.get("city") or res.get("query") or "engine"
                    for res in tool_results
                ],
            },
        }

        # Stream text words
        words = narrative.split(" ")
        for i, word in enumerate(words):
            chunk_text = word if i == len(words) - 1 else word + " "
            yield {
                "event": "token",
                "data": {"token": chunk_text},
            }

        # Yield citations event
        yield {
            "event": "citations",
            "data": {"citations": citations},
        }

        yield {
            "event": "done",
            "data": {"status": "completed"},
        }

    async def chat_stream(
        self,
        query: str,
        profile_data: dict[str, Any] | None = None,
        language: str = "en",
        simplify_for_child: bool = False,
    ) -> AsyncGenerator[dict[str, Any], None]:
        for event in self.chat_stream_sync(
            query=query,
            profile_data=profile_data,
            language=language,
            simplify_for_child=simplify_for_child,
        ):
            yield event
            if event.get("event") == "token":
                await asyncio.sleep(0.005)
