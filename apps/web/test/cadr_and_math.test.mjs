import test from "node:test";
import assert from "node:assert/strict";

// CADR & Mass-Balance pure physics helpers
function calculateRoomVolume(lengthFt, widthFt, heightFt) {
  const cubicFeet = lengthFt * widthFt * heightFt;
  const cubicMeters = cubicFeet * 0.0283168;
  return { cubicFeet, cubicMeters };
}

function calculateRequiredCADR(volumeM3, targetACH = 4.0) {
  // CADR in m3/h = Volume * targetACH
  // CADR in CFM = (Volume_m3 * targetACH) / 1.699
  const cadrM3h = volumeM3 * targetACH;
  const cadrCFM = cadrM3h / 1.699;
  return { cadrM3h, cadrCFM };
}

function calculateCigaretteEquivalence(pm25DailyDoseUg) {
  // Berkeley Earth 2015 rule-of-thumb heuristic:
  // 1 cigarette ≈ 22 µg/m3 for 24 hours inhaled ≈ 22 ug * 15 m3 air ≈ 330 ug mass inhaled
  // Or at 22 ug/m3 ambient: 1 cigarette/day
  return pm25DailyDoseUg / 22.0;
}

test("CADR: volume conversion from feet to meters is physically accurate", () => {
  // 12 ft x 10 ft x 10 ft room = 1200 cu ft
  const { cubicFeet, cubicMeters } = calculateRoomVolume(12, 10, 10);
  assert.equal(cubicFeet, 1200);
  assert.ok(Math.abs(cubicMeters - 33.98) < 0.1);
});

test("CADR: required CADR delivers at least 4.0 Air Changes per Hour (ACH)", () => {
  const { cubicMeters } = calculateRoomVolume(15, 12, 10); // ~50.97 m3
  const { cadrM3h, cadrCFM } = calculateRequiredCADR(cubicMeters, 4.0);

  assert.ok(cadrM3h > 200, "CADR m3/h should be > 200 for 1800 cu ft room");
  assert.ok(cadrCFM > 115, "CADR CFM should be > 115");
  // Verification: CADR m3/h / volume = ACH
  const effectiveACH = cadrM3h / cubicMeters;
  assert.equal(Math.round(effectiveACH), 4);
});

test("Exposure: Berkeley Earth heuristic cigarette equivalence scales linearly", () => {
  assert.equal(calculateCigaretteEquivalence(0), 0);
  assert.equal(calculateCigaretteEquivalence(44), 2);
  assert.equal(calculateCigaretteEquivalence(110), 5);
});
