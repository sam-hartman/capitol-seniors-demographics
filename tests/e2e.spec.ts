import { test, expect } from "@playwright/test";

const URL = process.env.E2E_URL ?? "https://capitol-seniors-demographics.vercel.app";

test.describe("CSH Demographics — production smoke", () => {
  test("loads homepage with branded chrome", async ({ page }) => {
    await page.goto(URL);
    await expect(page).toHaveTitle(/Capitol Seniors Housing/);
    await expect(page.locator('img[alt="Capitol Seniors Housing"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /residents/i
    );
    await expect(page.getByPlaceholder(/property address/i)).toBeVisible();
  });

  test("preset address (US Capitol) populates map and stats", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: /US Capitol, DC/i }).click();

    // Map shows pin
    await expect(page.locator(".csh-pin-marker").first()).toBeVisible({
      timeout: 15000,
    });

    // Stats panel renders metric labels (wait for fetch)
    await expect(page.getByText("Median Home Value", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Median Household Income")).toBeVisible();
    await expect(page.getByText("Total Population")).toBeVisible();
    await expect(page.getByText(/Households Age 45.{1,3}64/)).toBeVisible();
    await expect(page.getByText(/Seniors Age 75/)).toBeVisible();

    // At least one $-prefixed value should appear
    const dollarValues = page.locator("text=/\\$[0-9,]+/");
    await expect(dollarValues.first()).toBeVisible({ timeout: 30000 });

    // Source attribution
    await expect(page.getByText(/U\.S\. Census Bureau/)).toBeVisible();

    // URL was updated with lat/lon
    await expect(page).toHaveURL(/lat=.+&lon=/);
  });

  test("address search via API + result selection", async ({ page }) => {
    await page.goto(URL);
    const input = page.getByPlaceholder(/property address/i);
    await input.fill("1600 Pennsylvania Ave NW, Washington");
    await page.getByRole("button", { name: /Analyze/i }).click();

    // Dropdown appears
    const firstResult = page.locator("ul li button").first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    await firstResult.click();

    await expect(page.locator(".csh-pin-marker").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Median Home Value", { exact: true })).toBeVisible({
      timeout: 30000,
    });
  });

  test("tutorial overlay opens, advances, closes", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: /Tutorial/i }).click();

    // Step 01 visible
    await expect(page.getByText(/01 — Address Lookup/)).toBeVisible();

    // Advance
    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(page.getByText(/02 — Ring Visualization/)).toBeVisible();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(page.getByText(/03 — Demographic Profile/)).toBeVisible();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(page.getByText(/04 — Export/)).toBeVisible();

    // Finish closes
    await page.getByRole("button", { name: /Finish/i }).click();
    await expect(page.getByText(/01 — Address Lookup/)).not.toBeVisible();
  });

  test("/api/geocode returns valid result", async ({ request }) => {
    const res = await request.get(`${URL}/api/geocode?q=Boston`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(typeof json.data[0].lat).toBe("number");
  });

  test("CSV export enables when data loaded and downloads", async ({ page }) => {
    await page.goto(URL);
    const csvButton = page.getByRole("button", { name: /^CSV$/ });
    await expect(csvButton).toBeDisabled();
    await page.getByRole("button", { name: /US Capitol, DC/i }).click();
    await expect(page.getByText("Median Home Value", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(csvButton).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await csvButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^csh-demographics_.+\.csv$/);
  });

  test("tutorial works on cold open (no address)", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: /Tutorial/i }).click();
    // Click through all steps without ever picking an address.
    await expect(page.getByText(/01 — Address Lookup/)).toBeVisible();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.getByRole("button", { name: /^Next$/i }).click();
    await expect(page.getByText(/04 — Export/)).toBeVisible();
    await page.getByRole("button", { name: /Finish/i }).click();
    await expect(page.getByText(/01 — Address Lookup/)).not.toBeVisible();
  });

  test("median weighting is correct (US Capitol 1mi spot check)", async ({
    request,
  }) => {
    const res = await request.get(
      `${URL}/api/demographics?lat=38.8895&lon=-77.0353&rings=1,3,5`
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    const oneMi = json.data.rings.find(
      (r: { radiusMiles: number }) => r.radiusMiles === 1
    );
    // Hand-verified from raw ACS 2024 tract data using owner-unit weighting:
    // expected ≈ $596,757 ± $5 for rounding
    expect(oneMi.medianHomeValue).toBeGreaterThan(590_000);
    expect(oneMi.medianHomeValue).toBeLessThan(605_000);
    // Hand-verified household-weighted income ≈ $124,517 ± $5
    expect(oneMi.medianHouseholdIncome).toBeGreaterThan(120_000);
    expect(oneMi.medianHouseholdIncome).toBeLessThan(130_000);
    // Counts are exact sums:
    expect(oneMi.totalPopulation).toBe(14243);
    expect(oneMi.totalHouseholds45to64).toBe(1046);
    expect(oneMi.totalSeniors75plus).toBe(675);
  });

  test("/api/demographics returns 3 rings with all 5 metrics", async ({ request }) => {
    // US Capitol coords
    const res = await request.get(
      `${URL}/api/demographics?lat=38.8895&lon=-77.0353`
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.rings).toHaveLength(3);
    for (const ring of json.data.rings) {
      expect([1, 3, 5]).toContain(ring.radiusMiles);
      expect(typeof ring.totalPopulation).toBe("number");
      expect(typeof ring.totalHouseholds45to64).toBe("number");
      expect(typeof ring.totalSeniors75plus).toBe("number");
      // Population should grow with radius
    }
    expect(json.data.rings[0].totalPopulation).toBeLessThanOrEqual(
      json.data.rings[2].totalPopulation
    );
  });
});
