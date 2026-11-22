import { test, expect } from "@playwright/test";

test.describe("Landing Page & Atmospheric Intelligence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads landing page with telemetry and CPCB standard", async ({ page }) => {
    // Assert title or corridor button exists
    await expect(page.locator("text=CPCB NAQI STANDARD").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Delhi NCR Corridor").first()).toBeVisible();
  });

  test("allows switching city corridor and updates telemetry", async ({ page }) => {
    // Click Kolkata corridor button
    const kolkataBtn = page.getByRole("button", { name: "Kolkata" }).first();
    await expect(kolkataBtn).toBeVisible({ timeout: 10000 });
    await kolkataBtn.click();

    // Check heading updates to Kolkata
    await expect(page.getByRole("heading", { name: /Kolkata/i }).first()).toBeVisible();
  });

  test("switches language to Hindi and translates interface text", async ({ page }) => {
    const hindiBtn = page.getByRole("button", { name: "हिन्दी" });
    await expect(hindiBtn).toBeVisible({ timeout: 10000 });
    await hindiBtn.click();

    // Expect Hindi translation strings
    await expect(page.locator("text=राष्ट्रीय गलियारे:").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=सांझी हवा").first()).toBeVisible();
  });

  test("switches language to Marathi and translates interface text", async ({ page }) => {
    const marathiBtn = page.getByRole("button", { name: "मराठी" });
    await expect(marathiBtn).toBeVisible({ timeout: 10000 });
    await marathiBtn.click();

    // Expect Marathi translation strings
    await expect(page.locator("text=सांझी हवा").first()).toBeVisible();
    await expect(page.locator("text=राष्ट्रीय मार्ग:").first()).toBeVisible({ timeout: 10000 });
  });

  test("toggles Elder Mode (A+) and updates body classes", async ({ page }) => {
    const elderBtn = page.locator("#elder-mode-toggle");
    await expect(elderBtn).toBeVisible({ timeout: 10000 });
    await elderBtn.click();

    // Verify aria-pressed and class
    await expect(elderBtn).toHaveAttribute("aria-pressed", "true");
    const hasClass = await page.evaluate(() => document.body.classList.contains("elder-mode"));
    expect(hasClass).toBe(true);
  });
});
