import { test } from "node:test";
import assert from "node:assert/strict";

// CPCB 2014 AQI Standard Color and Category Specifications
const CPCB_BANDS = [
  { min: 0, max: 50, code: "good", labelEn: "Good", labelHi: "अच्छा", color: "#00B050" },
  { min: 51, max: 100, code: "satisfactory", labelEn: "Satisfactory", labelHi: "संतोषजनक", color: "#92D050" },
  { min: 101, max: 200, code: "moderate", labelEn: "Moderate", labelHi: "मध्यम", color: "#FFFF00" },
  { min: 201, max: 300, code: "poor", labelEn: "Poor", labelHi: "खराब", color: "#FF9900" },
  { min: 301, max: 400, code: "very_poor", labelEn: "Very Poor", labelHi: "बहुत खराब", color: "#FF0000" },
  { min: 401, max: 500, code: "severe", labelEn: "Severe", labelHi: "गंभीर", color: "#C00000" },
];

function getCPCBColorAndBand(aqi) {
  const clamped = Math.max(0, Math.min(500, Math.round(aqi)));
  for (const b of CPCB_BANDS) {
    if (clamped >= b.min && clamped <= b.max) {
      return b;
    }
  }
  return CPCB_BANDS[CPCB_BANDS.length - 1];
}

function calculateCigaretteEquivalence(pm25_concentration) {
  if (pm25_concentration <= 0) return 0;
  return Number((pm25_concentration / 22.0).toFixed(1));
}

function formatINRCurrency(amount) {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

function calculateRequiredCADR(roomVolumeM3, ach = 4.0, mixingFactor = 0.85) {
  if (roomVolumeM3 <= 0) return 0;
  return Math.round((roomVolumeM3 * ach) / mixingFactor);
}

test("CPCB AQI: 0 maps to Good with emerald green #00B050", () => {
  const b = getCPCBColorAndBand(0);
  assert.equal(b.code, "good");
  assert.equal(b.color, "#00B050");
});

test("CPCB AQI: 75 maps to Satisfactory with lime green #92D050", () => {
  const b = getCPCBColorAndBand(75);
  assert.equal(b.code, "satisfactory");
  assert.equal(b.color, "#92D050");
});

test("CPCB AQI: 150 maps to Moderate with yellow #FFFF00", () => {
  const b = getCPCBColorAndBand(150);
  assert.equal(b.code, "moderate");
  assert.equal(b.color, "#FFFF00");
});

test("CPCB AQI: 250 maps to Poor with orange #FF9900", () => {
  const b = getCPCBColorAndBand(250);
  assert.equal(b.code, "poor");
  assert.equal(b.color, "#FF9900");
});

test("CPCB AQI: 350 maps to Very Poor with red #FF0000", () => {
  const b = getCPCBColorAndBand(350);
  assert.equal(b.code, "very_poor");
  assert.equal(b.color, "#FF0000");
});

test("CPCB AQI: 492 maps to Severe with dark crimson #C00000", () => {
  const b = getCPCBColorAndBand(492);
  assert.equal(b.code, "severe");
  assert.equal(b.color, "#C00000");
});

test("CPCB AQI: extreme 750 clamps to 500 max Severe", () => {
  const b = getCPCBColorAndBand(750);
  assert.equal(b.code, "severe");
  assert.equal(b.max, 500);
});

test("CPCB AQI: negative -20 clamps to 0 Good", () => {
  const b = getCPCBColorAndBand(-20);
  assert.equal(b.code, "good");
});

test("Berkeley Earth: 22 ug/m3 equals exactly 1.0 cigarette/day", () => {
  const cigs = calculateCigaretteEquivalence(22.0);
  assert.equal(cigs, 1.0);
});

test("Berkeley Earth: 220 ug/m3 equals exactly 10.0 cigarettes/day", () => {
  const cigs = calculateCigaretteEquivalence(220.0);
  assert.equal(cigs, 10.0);
});

test("Berkeley Earth: 0 or negative PM2.5 returns 0 cigarettes", () => {
  assert.equal(calculateCigaretteEquivalence(0), 0);
  assert.equal(calculateCigaretteEquivalence(-15), 0);
});

test("CADR: standard bedroom (35 m3) requires ~165 m3/h at 4.0 ACH", () => {
  const cadr = calculateRequiredCADR(35.0, 4.0, 0.85);
  // (35 * 4) / 0.85 = 164.7 -> 165
  assert.equal(cadr, 165);
});

test("CADR: large living hall (100 m3) requires ~471 m3/h", () => {
  const cadr = calculateRequiredCADR(100.0, 4.0, 0.85);
  assert.equal(cadr, 471);
});

test("INR Currency: formats numbers with Indian grouping commas", () => {
  assert.equal(formatINRCurrency(3500), "₹3,500");
  assert.equal(formatINRCurrency(125000), "₹1,25,000");
  assert.equal(formatINRCurrency(0), "₹0");
});
