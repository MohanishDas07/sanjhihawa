import { test, expect } from "@playwright/test";

test.describe("Ask SanjhiHawa Consultation Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
  });

  test("renders consultation chat interface and safety disclosures", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Ask SanjhiHawa/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Namaste. I am SanjhiHawa")).toBeVisible();
  });

  test("allows typing and sending a question", async ({ page }) => {
    const input = page.locator("#chat-input");
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.fill("What is the current safe window to exercise in Delhi?");
    
    // Submit form
    await page.keyboard.press("Enter");

    // Chat should show user's message
    await expect(page.locator("text=What is the current safe window to exercise in Delhi?")).toBeVisible();
  });
});
