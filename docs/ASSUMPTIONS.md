# SAANS Engine Assumptions and Parameter Provenance

Every numeric constant in the SAANS exposure engine is consolidated here and in `apps/api/engine/constants.py`. In the user interface and on the transparency page, these values are explicitly labeled as *"approximate, for illustration and decision support; not medical fact"*.

---

## 1. CPCB National Air Quality Index (NAQI) Breakpoints

- **Standard Source:** Central Pollution Control Board (CPCB), Ministry of Environment, Forest and Climate Change, Government of India: *National Air Quality Index (NAQI)* Technical Report, 2014-2015.
- **Verification Status:** Verified against official CPCB NAQI formula.
- **Formula:** 
  $$I = \frac{I_{high} - I_{low}}{C_{high} - C_{low}} \times (C - C_{low}) + I_{low}$$
- **Breakpoints:**
  | Category | AQI Range | $PM_{2.5}$ 24-hr ($\mu g/m^3$) | $PM_{10}$ 24-hr ($\mu g/m^3$) |
  | :--- | :--- | :--- | :--- |
  | Good | 0 - 50 | 0 - 30 | 0 - 50 |
  | Satisfactory | 51 - 100 | 31 - 60 | 51 - 100 |
  | Moderate | 101 - 200 | 61 - 90 | 101 - 250 |
  | Poor | 201 - 300 | 91 - 120 | 251 - 350 |
  | Very Poor | 301 - 400 | 121 - 250 | 351 - 430 |
  | Severe | 401 - 500 | 250+ (capped at 500 for linear calc) | 430+ (capped at 500) |

---

## 2. Inhalation Rates ($\text{m}^3/\text{hour}$) by Age Band and Activity

- **Source:** US EPA *Exposure Factors Handbook* (2011 Edition, Chapter 6: Inhalation Rates) and ICMR Indian physiological norms.
- **Values:**
  | Age Band | Sleep ($m^3/h$) | Sedentary ($m^3/h$) | Light ($m^3/h$) | Moderate / Active ($m^3/h$) |
  | :--- | :--- | :--- | :--- | :--- |
  | Infant (0-2 yr) | 0.15 | 0.22 | 0.35 | 0.50 |
  | Child (3-14 yr) | 0.25 | 0.35 | 0.55 | 0.90 |
  | Adult (15-64 yr) | 0.30 | 0.45 | 0.75 | 1.25 |
  | Senior (65+ yr) | 0.28 | 0.40 | 0.65 | 1.05 |
- **Note:** Marked breathing-sensitive profiles apply an advisory sensitivity multiplier of $1.0\times$ for dose calculation (dose is physical volume inhaled) with an elevated risk tier in recommendation thresholds.

---

## 3. Indoor Air Mass Balance Model

- **Model Equation (Single-Compartment Steady State):**
  $$C_{in} = C_{out} \times \frac{a \times P}{a + k}$$
  where:
  - $C_{in}$: Indoor concentration ($\mu g/m^3$)
  - $C_{out}$: Outdoor ambient concentration ($\mu g/m^3$)
  - $a$: Air exchange rate per hour ($h^{-1}$)
  - $P$: Penetration factor of building envelope (dimensionless, $0 \le P \le 1$)
  - $k$: Total removal rate ($h^{-1}$), defined as $k = k_{natural} + k_{purifier}$
  - $k_{purifier} = \frac{CADR \times \eta_{mix}}{V_{room}}$
    - $CADR$: Clean Air Delivery Rate for smoke/fine particles ($m^3/h$)
    - $V_{room}$: Room volume ($m^3 = \text{length} \times \text{width} \times \text{height}$)
    - $\eta_{mix}$: Room mixing factor, conservatively set to $0.85$

- **Building Envelope Parameters:**
  | Home Type / State | Air Exchange $a$ ($h^{-1}$) | Penetration $P$ | Natural Deposition $k_{nat}$ ($h^{-1}$) |
  | :--- | :--- | :--- | :--- |
  | Standard Apartment (Windows Closed) | 0.8 | 0.70 | 0.25 |
  | Well-Sealed / Weatherstripped | 0.4 | 0.55 | 0.25 |
  | Leaky / Unsealed House | 1.5 | 0.85 | 0.25 |
  | Open Windows (Ventilation Mode) | 4.0 | 0.98 | 0.25 |

- **Provenance:** Chen & Zhao (2011), *Atmospheric Environment*, "Relationship between indoor and outdoor particles in residences"; Nazaroff (2004), *Indoor Air*.

---

## 4. Mask Filtration Effective Efficiencies (Fit-Adjusted)

- **Principle:** Lab filter penetration vs. real-world inward leakage (deliberately conservative to prevent false security).
  | Mask Type | Material Efficiency | Nominal Inward Leakage | Fit-Adjusted Effective Efficiency ($\eta_{eff}$) |
  | :--- | :--- | :--- | :--- |
  | N95 / FFP2 (fitted properly) | 95% | 10% | **85%** (0.85) |
  | N95 (loose / typical public fit) | 95% | 25% | **70%** (0.70) |
  | Surgical 3-ply | 70% | 40% | **40%** (0.40) |
  | Double Cloth / Cotton | 45% | 60% | **20%** (0.20) |
  | None | 0% | 100% | **0%** (0.00) |
- **Source:** CDC / NIOSH real-world leakage studies, Indian Council of Medical Research (ICMR) mask evaluations.

---

## 5. Breath Budget and Health Benchmarks

- **WHO 24-hour Guideline:** $15\,\mu g/m^3$ (WHO Global Air Quality Guidelines 2021).
  $$\text{Budget Fraction (WHO)} = \frac{\text{24h Time-Weighted Average Exposure } (\mu g/m^3)}{15\,\mu g/m^3}$$
- **India National Ambient Air Quality Standard (NAAQS):** $60\,\mu g/m^3$ (24-hour limit for $PM_{2.5}$).
  $$\text{Budget Fraction (India NAAQS)} = \frac{\text{24h Time-Weighted Average Exposure } (\mu g/m^3)}{60\,\mu g/m^3}$$
- **Berkeley Earth Cigarette-Equivalent Heuristic:**
  $$\text{Cigarette Equivalents} = \frac{\text{24h Time-Weighted Average } PM_{2.5} (\mu g/m^3)}{22\,\mu g/m^3}$$
  - **MANDATORY LABEL:** *Communication heuristic developed by Muller & Muller (Berkeley Earth, 2015), relating outdoor PM2.5 to the mortality risk of smoking one cigarette per day. This is an illustrative heuristic and NOT a clinical or medical diagnosis.*

---

## 6. Sustainability Layer: Emission Factors

- **Transport Emission Factors (per passenger-km):**
  | Mode | $PM_{2.5}$ Tailpipe + Brake ($g/p\text{-}km$) | $CO_2e$ ($kg/p\text{-}km$) | Source |
  | :--- | :--- | :--- | :--- |
  | Solo Petrol Two-Wheeler (125cc) | 0.045 | 0.042 | CPCB / ARAI emission factors 2020 |
  | Solo Petrol Hatchback Car | 0.035 | 0.145 | BEE / ARAI India automotive standards |
  | Electric Two-Wheeler | 0.003 (grid+brake) | 0.016 (CEA grid avg) | CEA CO2 Baseline Database 2023 |
  | CNG City Bus (occupancy ~35) | 0.005 | 0.038 | Delhi Transport Corporation / TERI 2022 |
  | Delhi Metro Rail | 0.001 | 0.019 | DMRC Carbon Footprint Report |
  | Walking / Cycling | 0.000 | 0.000 | Zero direct emission |

- **Cooking Fuels Emission Factors (per standard 4-person meal):**
  | Cooking Method | Indoor $PM_{2.5}$ emitted ($g/\text{meal}$) | $CO_2e$ ($kg/\text{meal}$) |
  | :--- | :--- | :--- |
  | Biomass / Chulha (unvented) | 12.50 | 2.80 |
  | Traditional LPG Stove | 0.08 | 0.42 |
  | Induction Cooktop (Electric) | 0.01 (cooking fumes only) | 0.31 (grid electricity) |

- **Verification Status:** [TODO-VERIFY] Exact regional grid emission factor variation for UP/NCR from latest CEA bulletin (using national baseline 0.72 kg CO2/kWh for now).

---

## 7. Atmospheric Extinction and Physical Skyline Transmittance

- **Model Equation (Koschmieder & Beer-Lambert Law):**
  $$b_{ext} = \alpha \times PM_{2.5} + b_{Rayleigh}$$
  $$T_i = \exp(-d_i \times b_{ext})$$
  $$V = \frac{3.912}{b_{ext}}$$
  where:
  - $\alpha$: Mass-extinction efficiency, assumed at $4.0\,\text{m}^2/\text{g} = 0.004\,\text{km}^{-1}/(\mu\text{g}/\text{m}^3)$.
  - $b_{Rayleigh}$: Clean air Rayleigh scattering baseline ($0.015\,\text{km}^{-1}$).
  - $d_i$: Scene depth of layer $i$ (foreground $0.35\,\text{km}$, metro viaduct $1.0\,\text{km}$, midground $2.0\,\text{km}$, monuments $5.0\,\text{km}$, sun $8.5\,\text{km}$).
  - $T_i$: Physical transmittance determining contrast and color-mix against atmospheric smog.
  - $V$: Estimated meteorological visual range ($\text{km}$).
- **Verification Status:** [TODO-VERIFY] Empirical mass extinction coefficient $\alpha$ for wintertime Indo-Gangetic Plains hygroscopic aerosols typically ranges from $3.5$ to $5.5\,\text{m}^2/\text{g}$ depending on relative humidity (Gautam et al., 2007). Labeled in UI as *"Approximate, not a measurement"*.
