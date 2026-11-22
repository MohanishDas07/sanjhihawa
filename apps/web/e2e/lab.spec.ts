import { test, expect } from "@playwright/test";

test.describe("Home Air Lab (CADR & Defenses)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lab");
  });

  test("renders CADR calculator and defense tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /CADR Sizing Calculator/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Room-by-Room Smog Defenses/i })).toBeVisible();
  });

  test("calculates CADR when room dimensions change", async ({ page }) => {
    const lengthInput = page.locator("#cadr-length");
    const widthInput = page.locator("#cadr-width");
    const heightInput = page.locator("#cadr-height");

    await expect(lengthInput).toBeVisible({ timeout: 15000 });
    await lengthInput.fill("20");
    await widthInput.fill("15");
    await heightInput.fill("10");

    // Room volume = 3,000 cu ft
    await expect(page.locator("text=3,000 cu ft")).toBeVisible({ timeout: 10000 });
  });

  test("switches between room defense tabs", async ({ page }) => {
    const kitchenTab = page.getByRole("tab", { name: /Kitchen/i });
    await expect(kitchenTab).toBeVisible({ timeout: 15000 });
    await kitchenTab.click();

    await expect(page.locator("text=Isolate the Kitchen").first()).toBeVisible({ timeout: 10000 });
  });
});
