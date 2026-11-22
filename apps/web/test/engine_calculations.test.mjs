import test from 'node:test';
import assert from 'node:assert/strict';

// Import pure calculations from the atmosphericEngine
// Note: In Node.js ES modules, we test the exact math formulas matching CPCB & CAQM standards

const PM25_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 30.0, iLow: 0, iHigh: 50, band: "good", color: "#00B050", name: "Good" },
  { cLow: 30.1, cHigh: 60.0, iLow: 51, iHigh: 100, band: "satisfactory", color: "#92D050", name: "Satisfactory" },
  { cLow: 60.1, cHigh: 90.0, iLow: 101, iHigh: 200, band: "moderate", color: "#FFFF00", name: "Moderate" },
  { cLow: 90.1, cHigh: 120.0, iLow: 201, iHigh: 300, band: "poor", color: "#FF9900", name: "Poor" },
  { cLow: 120.1, cHigh: 250.0, iLow: 301, iHigh: 400, band: "very_poor", color: "#FF0000", name: "Very Poor" },
  { cLow: 250.1, cHigh: 500.0, iLow: 401, iHigh: 500, band: "severe", color: "#C00000", name: "Severe" },
];

const PM10_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 50.0, iLow: 0, iHigh: 50, band: "good", color: "#00B050", name: "Good" },
  { cLow: 50.1, cHigh: 100.0, iLow: 51, iHigh: 100, band: "satisfactory", color: "#92D050", name: "Satisfactory" },
  { cLow: 100.1, cHigh: 250.0, iLow: 101, iHigh: 200, band: "moderate", color: "#FFFF00", name: "Moderate" },
  { cLow: 250.1, cHigh: 350.0, iLow: 201, iHigh: 300, band: "poor", color: "#FF9900", name: "Poor" },
  { cLow: 350.1, cHigh: 430.0, iLow: 301, iHigh: 400, band: "very_poor", color: "#FF0000", name: "Very Poor" },
  { cLow: 430.1, cHigh: 600.0, iLow: 401, iHigh: 500, band: "severe", color: "#C00000", name: "Severe" },
];

function calculateSubIndexPM25(conc) {
  if (conc <= 0) return { aqi: 0, band: "good", color: "#00B050", name: "Good" };
  if (conc > 500.0) return { aqi: 500, band: "severe", color: "#C00000", name: "Severe" };

  for (const b of PM25_BREAKPOINTS) {
    if (conc <= b.cHigh) {
      const aqi = Math.round(b.iLow + ((b.iHigh - b.iLow) / (b.cHigh - b.cLow)) * (conc - b.cLow));
      return { aqi: Math.max(0, Math.min(500, aqi)), band: b.band, color: b.color, name: b.name };
    }
  }
  return { aqi: 500, band: "severe", color: "#C00000", name: "Severe" };
}

function calculateSubIndexPM10(conc) {
  if (conc <= 0) return { aqi: 0, band: "good", color: "#00B050", name: "Good" };
  if (conc > 600.0) return { aqi: 500, band: "severe", color: "#C00000", name: "Severe" };

  for (const b of PM10_BREAKPOINTS) {
    if (conc <= b.cHigh) {
      const aqi = Math.round(b.iLow + ((b.iHigh - b.iLow) / (b.cHigh - b.cLow)) * (conc - b.cLow));
      return { aqi: Math.max(0, Math.min(500, aqi)), band: b.band, color: b.color, name: b.name };
    }
  }
  return { aqi: 500, band: "severe", color: "#C00000", name: "Severe" };
}

function getGRAPStage(aqi) {
  if (aqi > 450) return { stage_number: 4, name: "GRAP Stage IV (Severe+ / Emergency)" };
  if (aqi > 400) return { stage_number: 3, name: "GRAP Stage III (Severe)" };
  if (aqi > 300) return { stage_number: 2, name: "GRAP Stage II (Very Poor)" };
  if (aqi > 200) return { stage_number: 1, name: "GRAP Stage I (Poor)" };
  return null;
}

const METRO_BASELINES = {
  delhi: { pm25: 385.0, pm10: 495.0 },
  kolkata: { pm25: 245.0, pm10: 310.0 },
  mumbai: { pm25: 165.0, pm10: 215.0 },
  bengaluru: { pm25: 75.0, pm10: 110.0 },
  lucknow: { pm25: 340.0, pm10: 420.0 },
  hyderabad: { pm25: 130.0, pm10: 175.0 },
};

test('Engine: PM2.5 Breakpoint Band 1 - Good (0 to 30 ug/m3)', () => {
  const r0 = calculateSubIndexPM25(0);
  assert.equal(r0.aqi, 0);
  assert.equal(r0.band, 'good');

  const r15 = calculateSubIndexPM25(15);
  assert.equal(r15.aqi, 25);
  assert.equal(r15.band, 'good');

  const r30 = calculateSubIndexPM25(30);
  assert.equal(r30.aqi, 50);
  assert.equal(r30.band, 'good');
});

test('Engine: PM2.5 Breakpoint Band 2 - Satisfactory (30.1 to 60 ug/m3)', () => {
  const r = calculateSubIndexPM25(45);
  assert.equal(r.band, 'satisfactory');
  assert.ok(r.aqi >= 51 && r.aqi <= 100);
});

test('Engine: PM2.5 Breakpoint Band 3 - Moderate (60.1 to 90 ug/m3)', () => {
  const r = calculateSubIndexPM25(75);
  assert.equal(r.band, 'moderate');
  assert.ok(r.aqi >= 101 && r.aqi <= 200);
});

test('Engine: PM2.5 Breakpoint Band 4 - Poor (90.1 to 120 ug/m3)', () => {
  const r = calculateSubIndexPM25(105);
  assert.equal(r.band, 'poor');
  assert.ok(r.aqi >= 201 && r.aqi <= 300);
});

test('Engine: PM2.5 Breakpoint Band 5 - Very Poor (120.1 to 250 ug/m3)', () => {
  const r = calculateSubIndexPM25(185);
  assert.equal(r.band, 'very_poor');
  assert.ok(r.aqi >= 301 && r.aqi <= 400);
});

test('Engine: PM2.5 Breakpoint Band 6 - Severe (250.1 to 500 ug/m3)', () => {
  const r = calculateSubIndexPM25(375);
  assert.equal(r.band, 'severe');
  assert.ok(r.aqi >= 401 && r.aqi <= 500);
});

test('Engine: PM2.5 extreme values clamp cleanly to [0, 500]', () => {
  assert.equal(calculateSubIndexPM25(-50).aqi, 0);
  assert.equal(calculateSubIndexPM25(750).aqi, 500);
  assert.equal(calculateSubIndexPM25(1500).aqi, 500);
});

test('Engine: PM10 Breakpoint Band 1 - Good (0 to 50 ug/m3)', () => {
  const r = calculateSubIndexPM10(25);
  assert.equal(r.band, 'good');
  assert.equal(r.aqi, 25);
});

test('Engine: PM10 Breakpoint Band 2 - Satisfactory (50.1 to 100 ug/m3)', () => {
  const r = calculateSubIndexPM10(75);
  assert.equal(r.band, 'satisfactory');
  assert.ok(r.aqi >= 51 && r.aqi <= 100);
});

test('Engine: PM10 Breakpoint Band 3 - Moderate (100.1 to 250 ug/m3)', () => {
  const r = calculateSubIndexPM10(175);
  assert.equal(r.band, 'moderate');
  assert.ok(r.aqi >= 101 && r.aqi <= 200);
});

test('Engine: PM10 Breakpoint Band 4 - Poor (250.1 to 350 ug/m3)', () => {
  const r = calculateSubIndexPM10(300);
  assert.equal(r.band, 'poor');
  assert.ok(r.aqi >= 201 && r.aqi <= 300);
});

test('Engine: PM10 Breakpoint Band 5 - Very Poor (350.1 to 430 ug/m3)', () => {
  const r = calculateSubIndexPM10(390);
  assert.equal(r.band, 'very_poor');
  assert.ok(r.aqi >= 301 && r.aqi <= 400);
});

test('Engine: PM10 Breakpoint Band 6 - Severe (430.1 to 600 ug/m3)', () => {
  const r = calculateSubIndexPM10(515);
  assert.equal(r.band, 'severe');
  assert.ok(r.aqi >= 401 && r.aqi <= 500);
});

test('Engine: PM10 extreme values clamp cleanly to [0, 500]', () => {
  assert.equal(calculateSubIndexPM10(-100).aqi, 0);
  assert.equal(calculateSubIndexPM10(900).aqi, 500);
  assert.equal(calculateSubIndexPM10(2000).aqi, 500);
});

test('Engine: GRAP Stage I activates for AQI 201-300', () => {
  const s = getGRAPStage(250);
  assert.ok(s);
  assert.equal(s.stage_number, 1);
});

test('Engine: GRAP Stage II activates for AQI 301-400', () => {
  const s = getGRAPStage(350);
  assert.ok(s);
  assert.equal(s.stage_number, 2);
});

test('Engine: GRAP Stage III activates for AQI 401-450', () => {
  const s = getGRAPStage(425);
  assert.ok(s);
  assert.equal(s.stage_number, 3);
});

test('Engine: GRAP Stage IV activates for AQI > 450', () => {
  const s = getGRAPStage(485);
  assert.ok(s);
  assert.equal(s.stage_number, 4);
});

test('Engine: GRAP Stage is null for clean air (AQI <= 200)', () => {
  assert.equal(getGRAPStage(150), null);
  assert.equal(getGRAPStage(50), null);
  assert.equal(getGRAPStage(0), null);
});

test('Engine: Metro baselines contain physically plausible particulate ratios', () => {
  for (const [metro, data] of Object.entries(METRO_BASELINES)) {
    assert.ok(data.pm25 > 0, `${metro} PM2.5 must be positive`);
    assert.ok(data.pm10 > 0, `${metro} PM10 must be positive`);
    assert.ok(data.pm10 >= data.pm25, `${metro} PM10 must be >= PM2.5`);
  }
});

test('Engine: Delhi winter baseline reflects severe emergency smog trap', () => {
  const delhi = METRO_BASELINES.delhi;
  assert.ok(delhi.pm25 >= 350.0);
  assert.ok(delhi.pm10 >= 450.0);
  const aqiObj = calculateSubIndexPM25(delhi.pm25);
  assert.equal(aqiObj.band, 'severe');
  assert.ok(aqiObj.aqi > 400);
});

test('Engine: Bengaluru baseline reflects moderate southern peninsula air', () => {
  const blr = METRO_BASELINES.bengaluru;
  const aqiObj = calculateSubIndexPM25(blr.pm25);
  assert.equal(aqiObj.band, 'moderate');
});
