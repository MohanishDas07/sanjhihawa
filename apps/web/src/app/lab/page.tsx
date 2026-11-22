"use client";

import React, { useState, useEffect } from "react";

export default function HomeAirLabPage() {
  const [lang, setLang] = useState<"en" | "hi" | "mr">("en");

  // Purifier Sizing Calculator States
  const [unit, setUnit] = useState<"ft" | "m">("ft");
  const [length, setLength] = useState<number>(12);
  const [width, setWidth] = useState<number>(10);
  const [height, setHeight] = useState<number>(10);
  const [targetAch, setTargetAch] = useState<number>(5); // 5 ACH recommended during severe winter smog

  // Active Room Tab
  const [activeRoom, setActiveRoom] = useState<"bedroom" | "kitchen" | "living" | "vulnerable">("bedroom");

  // Active Myth Tab
  const [expandedMyth, setExpandedMyth] = useState<string | null>("plants");

  useEffect(() => {
    const savedLang = (localStorage.getItem("saans_lang") as "en" | "hi" | "mr") || "en";
    setLang(savedLang);

    const onLangChange = () => {
      const current = (localStorage.getItem("saans_lang") as "en" | "hi" | "mr") || "en";
      setLang(current);
    };
    window.addEventListener("saans_lang_changed", onLangChange);
    return () => window.removeEventListener("saans_lang_changed", onLangChange);
  }, []);

  // Compute Volume in m³
  const volumeM3 =
    unit === "ft"
      ? length * width * height * 0.0283168
      : length * width * height;

  // Required CADR in m³/h (CADR = Volume * ACH / mixing_factor(0.85))
  const requiredCadrM3h = Math.round((volumeM3 * targetAch) / 0.85);
  const requiredCadrCfm = Math.round(requiredCadrM3h * 0.5886);
  const minutesPerExchange = Math.round(60 / targetAch);

  const myths = [
    {
      id: "plants",
      titleEn: "Do indoor snake plants or areca palms filter winter smog?",
      titleHi: "क्या स्नेक प्लांट या मनी प्लांट जहरीला स्मॉग छान सकते हैं?",
      verdictEn: "MYTH: Particulate CADR is practically zero.",
      verdictHi: "भ्रम: PM2.5 कणों पर पौधों का कोई असर नहीं होता।",
      explanationEn:
        "The popular NASA 1989 Clean Air Study measured volatile organic chemical (VOC) absorption in airtight, sealed 1m³ glass chambers over 24 hours. Subsequent peer-reviewed research (Cummings & Waring, 2020) confirmed that potted plants have near-zero Clean Air Delivery Rate (CADR) for fine particulate matter (PM2.5). Achieving the air exchange rate of typical indoor ventilation for VOCs would require 10 to 1,000 plants per square meter, while particle filtration remains negligible. Plants are pleasant decor, not smog defense.",
      explanationHi:
        "नासा का 1989 का अध्ययन केवल बंद शीशे के बक्से में रासायनिक गैसों (VOCs) पर था। 2020 के वैज्ञानिक अध्ययनों (कमिंस और वारिंग) ने साबित किया है कि पौधे हवा के महीन कणों (PM2.5) को नहीं छान सकते। गैसों के लिए भी सामान्य वेंटिलेशन की बराबरी करने के लिए प्रति वर्ग मीटर 10 से 1,000 पौधों की जरूरत होगी। केवल ट्रू HEPA प्यूरीफायर ही स्मॉग से बचा सकता है।",
      source: "Journal of Exposure Science & Environmental Epidemiology (2020)",
    },
    {
      id: "jaggery",
      titleEn: "Does eating jaggery (gur) clean inhaled smog from lungs?",
      titleHi: "क्या गुड़ खाने से फेफड़ों में जमा प्रदूषण साफ होता है?",
      verdictEn: "MYTH: Digestion has no path to pulmonary alveoli.",
      verdictHi: "भ्रम: गुड़ पेट में जाता है, फेफड़ों की सांस नली में नहीं।",
      explanationEn:
        "Swallowed food passes through the esophagus into the gastrointestinal stomach. Inhaled PM2.5 particles are drawn through the trachea into microscopic pulmonary alveoli, crossing into the bloodstream. There is zero biological or anatomical mechanism for ingested sugar or nutrients to physically retrieve insoluble combustion particles embedded in lung tissues. Believing jaggery protects against smog leads to dangerous complacency and avoiding N95 masks.",
      explanationHi:
        "खाया हुआ गुड़ भोजन नली से पेट में जाता है, जबकि सांस में लिया गया PM2.5 फेफड़ों के सबसे भीतरी कोष्ठों (Alveoli) और खून में पहुंचता है। पेट में जाने वाला कोई भी पदार्थ फेफड़ों में फंसे जहरीले धुएं के कणों को नहीं निकाल सकता। गुड़ पर भरोसा करके बिना मास्क बाहर निकलना फेफड़ों के लिए घातक है।",
      source: "Indian Chest Society & Pulmonology Clinical Practice Guidelines",
    },
    {
      id: "steam",
      titleEn: "Does boiling steam inhalation detoxify deep lung tissues?",
      titleHi: "क्या गर्म भाप लेने से फेफड़ों का PM2.5 घुल जाता है?",
      verdictEn: "MYTH: Steam condensates in the upper nasal tract only.",
      verdictHi: "भ्रम: भाप केवल नाक में रहती है, फेफड़ों में नहीं जाती।",
      explanationEn:
        "Inhaled water vapor cools and condenses immediately upon contact with the nasal mucosa and upper larynx; virtually no steam reaches the lower respiratory bronchioles or alveoli. Furthermore, PM2.5 particles are solid carbonaceous soot and mineral dust insoluble in water. Steam cannot dissolve them, and excessively hot steam scalding airway epithelium increases bronchial vulnerability to infection.",
      explanationHi:
        "गर्म भाप नाक और गले की ऊपरी सतह पर ही पानी बनकर ठंडी हो जाती है। यह फेफड़ों की गहराई तक नहीं पहुंचती। PM2.5 कोयले, कालिख और धूल के ठोस कण होते हैं जो पानी में नहीं घुलते। बहुत तेज भाप सांस नली की कोमल त्वचा को जला सकती है।",
      source: "WHO Clinical Management Guidelines for Respiratory Irritation",
    },
    {
      id: "cloth",
      titleEn: "Is a double cloth handkerchief as effective as an N95 mask?",
      titleHi: "क्या दोहरे कपड़े का रुमाल N95 मास्क जितना काम करता है?",
      verdictEn: "MYTH: Cloth weave pore size is 50-100x larger than PM2.5.",
      verdictHi: "भ्रम: कपड़े के धागों के बीच का छेद 100 माइक्रोन होता है।",
      explanationEn:
        "Woven cotton handkerchiefs have pore apertures between 100 and 500 microns. Fine particulate matter (PM2.5) is 2.5 microns or smaller. Unsealed cloth allows over 80% to 90% of toxic particles to bypass the fabric via edge leakage and loose weaves. Certified ISI/BIS N95 respirators use electrostatically charged meltblown non-woven polypropylene fibers that trap nanoparticles by mechanical impaction, interception, and electrostatic attraction.",
      explanationHi:
        "सूती कपड़े या रुमाल के धागों के बीच के छेद 100 से 500 माइक्रोन चौड़े होते हैं, जबकि PM2.5 कण 2.5 माइक्रोन से भी छोटे होते हैं। रुमाल बांधने से 80% से ज्यादा जहरीला धुआं सीधे फेफड़ों में चला जाता है। केवल ISI प्रमाणित N95 मास्क ही इलेक्ट्रोस्टैटिक फाइबर से 85-95% कणों को रोकता है।",
      source: "Bureau of Indian Standards (IS 9473) & NIOSH Particulate Respirator Tests",
    },
    {
      id: "diffusers",
      titleEn: "Do essential oil diffusers clean indoor air?",
      titleHi: "क्या अगरबत्ती, धूप या डिफ्यूज़र हवा को शुद्ध करते हैं?",
      verdictEn: "HARMFUL: Releases VOCs that create secondary aerosols.",
      verdictHi: "हानिकारक: ये तेल और धुआं मिलकर और अधिक जहरीले कण बनाते हैं।",
      explanationEn:
        "Aroma diffusers and scented oils vaporize volatile organic compounds (terpenes like pinene and limonene). When these indoor terpenes mix with ambient ozone, they react chemically to synthesize secondary organic aerosols (SOA) and ultrafine nanoparticles, significantly worsening indoor particulate concentration and irritating asthmatic airways.",
      explanationHi:
        "अगरबत्ती, कपूर या एसेंशियल ऑयल डिफ्यूज़र हवा में वाष्पशील रसायन (VOCs) छोड़ते हैं। ये रसायन ओजोन के साथ मिलकर कमरे के अंदर और अधिक सूक्ष्म जहरीले कण (SOA) बना देते हैं, जिससे दमा और एलर्जी का खतरा बढ़ जाता है।",
      source: "Environmental Science & Technology Journal (Secondary Aerosol Formation)",
    },
  ];

  return (
    <div className="w-full space-y-12 font-sans text-ink">
      {/* Page Title */}
      <div className="border-b hairline border-rule pb-4">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
          PRACTICAL INDOOR DEFENSE • NO-NONSENSE SCIENCE
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold mt-1 text-ink">
          {lang === "hi" ? "होम एयर लैब (Home Air Lab)" : "Home Air Lab"}
        </h1>
        <p className="text-sm md:text-base text-ink-muted mt-1 max-w-3xl leading-relaxed">
          Clean air is achieved through mechanical filtration and physical envelope management, not folklore.
          Calculate exact CADR purifier sizing, explore room-by-room interventions, inspect the DIY Corsi-Rosenthal Box, and debunk pervasive smog myths.
        </p>
      </div>

      {/* SECTION 1: Purifier Sizing Calculator */}
      <section className="bg-surface border hairline border-rule p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b hairline border-rule pb-4 mb-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-bold">
              DETERMINISTIC PURIFIER FORMULA
            </span>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mt-0.5 text-ink">
              CADR Sizing Calculator
            </h2>
          </div>
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
              <span className="text-xs font-mono text-ink-muted">Units:</span>
              <button
                onClick={() => setUnit("ft")}
                className={`px-3 py-1 text-xs font-mono border ${
                  unit === "ft" ? "bg-ink text-paper border-ink" : "bg-paper text-ink border-rule"
                }`}
              >
                Feet (ft)
              </button>
              <button
                onClick={() => setUnit("m")}
                className={`px-3 py-1 text-xs font-mono border ${
                  unit === "m" ? "bg-ink text-paper border-ink" : "bg-paper text-ink border-rule"
                }`}
              >
                Meters (m)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input Controls */}
            <div className="lg:col-span-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-ink-muted mb-1">
                    Length ({unit})
                  </label>
                  <input
                    type="number"
                    value={length}
                    min={4}
                    max={100}
                    onChange={(e) => setLength(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-paper border border-rule px-3 py-2 text-sm font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-ink-muted mb-1">
                    Width ({unit})
                  </label>
                  <input
                    type="number"
                    value={width}
                    min={4}
                    max={100}
                    onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-paper border border-rule px-3 py-2 text-sm font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-ink-muted mb-1">
                    Height ({unit})
                  </label>
                  <input
                    type="number"
                    value={height}
                    min={4}
                    max={30}
                    onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-paper border border-rule px-3 py-2 text-sm font-mono text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-ink-muted mb-1">
                  Target Air Changes per Hour (ACH)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTargetAch(4)}
                    className={`p-2.5 text-xs text-left border ${
                      targetAch === 4 ? "bg-paper border-ink font-semibold" : "bg-surface border-rule"
                    }`}
                  >
                    <div className="font-mono">4 ACH (Moderate)</div>
                    <div className="text-2xs text-ink-muted mt-0.5">Normal seasonal filtration</div>
                  </button>
                  <button
                    onClick={() => setTargetAch(5)}
                    className={`p-2.5 text-xs text-left border ${
                      targetAch === 5 ? "bg-paper border-ink font-semibold" : "bg-surface border-rule"
                    }`}
                  >
                    <div className="font-mono">5 ACH (Severe Smog)</div>
                    <div className="text-2xs text-ink-muted mt-0.5">Peak NCR winter / children & elders</div>
                  </button>
                </div>
              </div>

              <div className="text-2xs font-mono text-ink-muted bg-paper p-3 border border-rule">
                <strong>Formula:</strong> CADR = (Room Volume × ACH) ÷ Mixing Efficiency (0.85).
                Calculates the volume of filtered particle-free air delivered per hour.
              </div>
            </div>

            {/* Output Display */}
            <div className="lg:col-span-7 bg-paper border border-rule p-5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                  REQUIRED SPECIFICATION
                </span>
                <div className="flex items-baseline space-x-3 mt-2">
                  <span className="font-mono text-4xl font-bold text-ink">
                    {requiredCadrM3h}
                  </span>
                  <span className="font-mono text-sm text-ink-muted">m³/h Smoke CADR</span>
                  <span className="text-sm font-mono text-ink-muted">({requiredCadrCfm} CFM)</span>
                </div>
                <p className="text-xs text-ink-muted mt-2">
                  For your <strong>{Math.round(volumeM3 * 10) / 10} m³</strong> room, this purifier size will completely exchange all air every <strong>{minutesPerExchange} minutes</strong>, providing approximately <strong>80-85%</strong> reduction in indoor PM2.5 in a sealed room.
                </p>
              </div>

              <div className="border-t hairline border-rule pt-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-surface border border-rule">
                  <div className="font-mono font-semibold text-ink">Commercial Match:</div>
                  <div className="text-ink-muted mt-0.5">
                    {requiredCadrM3h <= 180
                      ? "Compact Room Purifier (₹4,500 - ₹6,500)"
                      : requiredCadrM3h <= 320
                      ? "Standard Bedroom Purifier (₹8,000 - ₹11,000)"
                      : "High-Capacity Unit or Dual Purifiers (₹14,000+)"}
                  </div>
                </div>

                <div className="p-2.5 bg-surface border border-rule">
                  <div className="font-mono font-semibold text-ink">Crucial Buying Rule:</div>
                  <div className="text-ink-muted mt-0.5">
                    Require <strong>True HEPA H13</strong>. Strictly decline models advertising ionizers, UV-C with ozone, or plasma cleaners.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Room-by-Room Practical Hacks */}
        <section className="space-y-4">
          <div className="border-b hairline border-rule pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              PHYSICAL ENVELOPE MANAGEMENT
            </span>
            <h2 className="font-serif text-2xl font-bold mt-0.5">
              Room-by-Room Smog Defenses
            </h2>
          </div>

          <div className="flex border-b border-rule">
            {(
              [
                { id: "bedroom", label: "Bedroom (Sleep Haven)" },
                { id: "kitchen", label: "Kitchen (Cooking Emissions)" },
                { id: "living", label: "Living & Balcony Doors" },
                { id: "vulnerable", label: "Child & Elder Quarters" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRoom(tab.id)}
                className={`px-4 py-2 text-xs font-mono transition-colors border-b-2 -mb-[2px] ${
                  activeRoom === tab.id
                    ? "border-ink font-bold text-ink bg-surface"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-surface border hairline border-rule p-6">
            {activeRoom === "bedroom" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">1. Purifier Placement</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Place the purifier at least 1 foot away from walls. Direct the clean air outflow toward breathing height near the head of the bed, not facing a wardrobe or curtain.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">2. Wet Mop Daily</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Never use dry brooms or vacuum cleaners without HEPA exhaust bags. Wet mopping with a damp microfiber cloth captures settled particulate matter without resuspending it into your breathing zone.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">3. Window Airing Window</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Keep windows completely latched during morning and evening thermal inversion (6 AM - 11 AM). If ventilation is needed to clear CO2, crack windows for only 15 minutes between 1:00 PM and 3:00 PM.
                  </p>
                </div>
              </div>
            )}

            {activeRoom === "kitchen" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">1. Isolate the Kitchen</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Keep the kitchen door closed during all cooking. Deep frying, tadka, and roasting create acute indoor PM2.5 spikes exceeding 800 µg/m³ that disperse throughout the entire home if uncontained.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">2. Range Hood & Exhaust</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Run the exhaust fan at maximum speed for 10 minutes prior to cooking and continue running it for 15 minutes after cooking finishes to evacuate aerosolized grease and fine combustion particles.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">3. Fuel Alternatives</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Switching from solid fuels or chulhas to LPG or induction eliminates over 95% of direct kitchen particulate emissions. Cover pots with lids to minimize aerosolized cooking vapor.
                  </p>
                </div>
              </div>
            )}

            {activeRoom === "living" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">1. Silicone Weatherstripping</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Sliding balcony doors and main entry doors leak up to 60% of outdoor smog through frame gaps. Applying ₹200 self-adhesive silicone seal strips cuts envelope infiltration (a) from 1.5 ACH down to 0.4 ACH.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">2. Zero Incense / Camphor</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Burning one incense stick (agarbatti) in a closed living room generates particulate emissions equivalent to 4 to 8 commercial cigarettes. Switch to LED candles or dry flower offerings during smog months.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">3. Shoe Infiltration Barrier</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Leave outdoor shoes immediately at the entry threshold. Road dust tracked inside contains heavy metals, brake dust, and PAHs that settle into carpets and get continuously resuspended by foot traffic.
                  </p>
                </div>
              </div>
            )}

            {activeRoom === "vulnerable" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">1. Highest ACH Target (5+)</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Children breathe 2x to 3x more air per kilogram of body weight than adults, and elderly lungs possess reduced mucosal clearance. Prioritize the highest CADR purifier in their quarters, running 24/7 on medium-high.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">2. Relative Humidity (40-60%)</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Cold winter air combined with indoor purifiers dries nasal mucous membranes. Maintain 45-55% relative humidity with clean water (no ultrasonic tap water mist) to support upper airway cilia defense.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="font-mono text-xs font-bold text-ink uppercase">3. Door Sweep Draught Excluder</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Fit a twin-draft door sweep under the room door to create a positive-pressure clean air sanctuary separated from the rest of the flat's hallways and cooking zones.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: DIY Corsi-Rosenthal Box Purifier Guide */}
        <section className="bg-surface border hairline border-rule p-6">
          <div className="border-b hairline border-rule pb-4 mb-6">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              OPEN-SOURCE CLEAN AIR HARDWARE
            </span>
            <h2 className="font-serif text-2xl font-bold mt-0.5">
              Build a DIY Corsi-Rosenthal Box (~₹3,500)
            </h2>
            <p className="text-xs text-ink-muted mt-1 max-w-3xl">
              Invented by environmental engineer Dr. Richard Corsi and Jim Rosenthal. Delivers clean air delivery rates (CADR &gt; 400 m³/h) matching ₹20,000 commercial purifiers at a fraction of the cost, with 5x longer filter life.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Parts Checklist */}
            <div className="space-y-3">
              <span className="font-mono text-xs uppercase tracking-wider text-ink font-semibold block">
                BILL OF MATERIALS (INDIAN NCR SOURCING)
              </span>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start justify-between p-2 bg-paper border border-rule">
                  <div>
                    <strong className="block text-ink">1× 20-Inch Box Fan (or Square Exhaust Fan)</strong>
                    <span className="text-ink-muted text-2xs">3-speed forward-curve axial fan (~50W power draw)</span>
                  </div>
                  <span className="font-mono font-bold text-ink">~₹1,800</span>
                </li>
                <li className="flex items-start justify-between p-2 bg-paper border border-rule">
                  <div>
                    <strong className="block text-ink">4× MERV 13 Furnace Filters (20" × 20" × 1")</strong>
                    <span className="text-ink-muted text-2xs">Filters 85% of PM2.5 with ultra-low static pressure drop</span>
                  </div>
                  <span className="font-mono font-bold text-ink">~₹1,400</span>
                </li>
                <li className="flex items-start justify-between p-2 bg-paper border border-rule">
                  <div>
                    <strong className="block text-ink">1× Heavy-Duty Duct Tape Roll & Cardboard Sheet</strong>
                    <span className="text-ink-muted text-2xs">For airtight edge sealing and the crucial circular fan shroud</span>
                  </div>
                  <span className="font-mono font-bold text-ink">~₹250</span>
                </li>
              </ul>

              <div className="p-3 bg-paper border-l-4 border-ink text-2xs font-mono text-ink-muted leading-relaxed">
                <strong>CRITICAL SHROUD PRINCIPLE:</strong> Box fans have square frames with circular spinning blades. Without a circular cardboard shroud taped to the fan face covering the four corners, turbulent air recirculates backward at blade tips. Adding a 14-inch circular cardboard aperture increases net airflow by up to 40%!
              </div>
            </div>

            {/* 5-Step Assembly Instructions */}
            <div className="space-y-3">
              <span className="font-mono text-xs uppercase tracking-wider text-ink font-semibold block">
                5-STEP ASSEMBLY INSTRUCTIONS
              </span>
              <ol className="space-y-2 text-xs">
                <li className="p-2.5 bg-paper border border-rule flex items-start space-x-2.5">
                  <span className="font-mono font-bold text-ink">01.</span>
                  <div>
                    <strong>Cut Cardboard Base:</strong> Cut a 20" × 20" square piece of corrugated cardboard to serve as the sturdy bottom floor of your cube.
                  </div>
                </li>
                <li className="p-2.5 bg-paper border border-rule flex items-start space-x-2.5">
                  <span className="font-mono font-bold text-ink">02.</span>
                  <div>
                    <strong>Assemble Filter Walls:</strong> Arrange the four MERV 13 filters as vertical walls. Ensure the airflow arrows on all four filter frames point <em>inward toward the center of the box</em>.
                  </div>
                </li>
                <li className="p-2.5 bg-paper border border-rule flex items-start space-x-2.5">
                  <span className="font-mono font-bold text-ink">03.</span>
                  <div>
                    <strong>Tape All Seams Airtight:</strong> Use duct tape along every vertical corner and bottom edge. Ensure zero air bypass; incoming air must pass through filter media.
                  </div>
                </li>
                <li className="p-2.5 bg-paper border border-rule flex items-start space-x-2.5">
                  <span className="font-mono font-bold text-ink">04.</span>
                  <div>
                    <strong>Mount Box Fan on Top:</strong> Place the 20-inch box fan atop the 4-filter cube with air blowing <em>upward and outward into the room</em>. Tape all four top edges securely.
                  </div>
                </li>
                <li className="p-2.5 bg-paper border border-rule flex items-start space-x-2.5">
                  <span className="font-mono font-bold text-ink">05.</span>
                  <div>
                    <strong>Attach Cardboard Shroud:</strong> Cut a 14-inch circular hole in a 20" × 20" cardboard sheet and tape it to the front face of the fan to block corner vortex backdraft. Plug in and run on Speed 1 or 2.
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* SECTION 4: Interactive Myth-Buster Section */}
        <section className="space-y-4">
          <div className="border-b hairline border-rule pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              EVIDENCE-BASED CORRECTIONS
            </span>
            <h2 className="font-serif text-2xl font-bold mt-0.5">
              Smog Myth-Buster
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Click any common winter smog belief to inspect its physical mechanism and peer-reviewed consensus.
            </p>
          </div>

          <div className="space-y-3">
            {myths.map((m) => {
              const isOpen = expandedMyth === m.id;
              return (
                <div key={m.id} className="bg-surface border hairline border-rule">
                  <button
                    onClick={() => setExpandedMyth(isOpen ? null : m.id)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-paper/50 transition-colors"
                  >
                    <div>
                      <span className="font-serif text-base font-semibold text-ink block">
                        {lang === "hi" ? m.titleHi : m.titleEn}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#7A0F2E] mt-0.5 block">
                        {lang === "hi" ? m.verdictHi : m.verdictEn}
                      </span>
                    </div>
                    <span className="font-mono text-sm text-ink-muted ml-4">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-0 border-t hairline border-rule/50 bg-paper/30 space-y-2 text-xs">
                      <p className="leading-relaxed text-ink-muted">
                        {lang === "hi" ? m.explanationHi : m.explanationEn}
                      </p>
                      <div className="font-mono text-2xs text-ink-muted pt-1">
                        <strong>Source & Scientific Citation:</strong> {m.source}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
    </div>
  );
}
