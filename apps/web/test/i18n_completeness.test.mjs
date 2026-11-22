import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, "..", "src", "messages");

function loadJson(filename) {
  const filePath = path.join(messagesDir, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getAllKeys(obj, prefix = "") {
  let keys = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      keys = keys.concat(getAllKeys(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

test("i18n: all supported locales exist and are valid JSON", () => {
  const locales = ["en.json", "hi.json", "mr.json"];
  for (const loc of locales) {
    const data = loadJson(loc);
    assert.ok(data && typeof data === "object", `${loc} must be a valid JSON object`);
  }
});

test("i18n: Hindi and Marathi have parity with all English translation keys", () => {
  const en = loadJson("en.json");
  const hi = loadJson("hi.json");
  const mr = loadJson("mr.json");

  const enKeys = new Set(getAllKeys(en));
  const hiKeys = new Set(getAllKeys(hi));
  const mrKeys = new Set(getAllKeys(mr));

  const missingInHi = [...enKeys].filter((k) => !hiKeys.has(k));
  const missingInMr = [...enKeys].filter((k) => !mrKeys.has(k));

  assert.equal(
    missingInHi.length,
    0,
    `Missing keys in hi.json: ${missingInHi.slice(0, 10).join(", ")}${missingInHi.length > 10 ? "..." : ""}`
  );
  assert.equal(
    missingInMr.length,
    0,
    `Missing keys in mr.json: ${missingInMr.slice(0, 10).join(", ")}${missingInMr.length > 10 ? "..." : ""}`
  );
});

test("i18n: no translation values are empty or null", () => {
  for (const loc of ["en.json", "hi.json", "mr.json"]) {
    const data = loadJson(loc);
    const keys = getAllKeys(data);
    for (const key of keys) {
      const parts = key.split(".");
      let val = data;
      for (const p of parts) val = val[p];
      assert.ok(
        typeof val === "string" && val.trim().length > 0,
        `Empty or invalid translation value at ${key} in ${loc}`
      );
    }
  }
});
