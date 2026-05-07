/**
 * npx tsx scripts/test-seloger.ts
 * Uses page.evaluate() to call SeLoger APIs directly with browser cookies.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright-extra") as typeof import("playwright");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require("puppeteer-extra-plugin-stealth") as () => unknown;
import fs from "fs";

(chromium as unknown as { use: (p: unknown) => void }).use((StealthPlugin as () => unknown)());

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const browser = await chromium.launch({
    headless: false, // non-headless to bypass bot detection
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1440,900"],
  });

  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    viewport: { width: 1440, height: 900 },
  });

  const page = await ctx.newPage();

  // Intercept responses
  const captured: Record<string, unknown> = {};
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("seloger.com")) return;
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const json = await res.json();
      if (url.includes("serp-bff/search/geo")) {
        captured["search_geo"] = json;
        console.log(`[search/geo] total=${(json as Record<string, unknown>).totalCount}`);
      }
      if (url.includes("classifiedList/")) {
        const key = `classifiedList_${Object.keys(captured).filter(k => k.startsWith("classifiedList")).length}`;
        captured[key] = json;
        const preview = JSON.stringify(json).slice(0, 150);
        console.log(`[classifiedList] ${preview}`);
      }
    } catch {}
  });

  // Navigate to classified-map which we know works
  console.log("Navigating to classified-map...");
  const res = await page.goto(
    "https://www.seloger.com/classified-map?distributionTypes=Buy&estateTypes=House%2CApartment%2CBuilding&locations=POCOFR1904",
    { waitUntil: "networkidle", timeout: 40000 }
  );
  console.log("Status:", res?.status(), "Title:", (await page.title()).slice(0, 80));

  await sleep(3000);

  // If we got listing data from interception, great. Otherwise try direct fetch.
  if (!captured["search_geo"]) {
    console.log("\nNo interception captured. Trying direct fetch from page context...");

    // Fetch search/geo from within the page (uses browser cookies)
    const geoResult = await page.evaluate(async () => {
      const params = new URLSearchParams({
        "locations[]": "POCOFR1904",
        "distributionTypes": "Buy",
        "estateTypes": "House,Apartment,Building",
        "page": "1",
        "resultsPerPage": "24",
      });
      try {
        const r = await fetch(`/serp-bff/search/geo?${params}`, {
          headers: { "Accept": "application/json", "Referer": window.location.href },
        });
        return { status: r.status, body: await r.text() };
      } catch (e) {
        return { status: 0, body: String(e) };
      }
    });
    console.log("Direct /search/geo status:", geoResult.status);
    console.log("Body preview:", geoResult.body.slice(0, 500));

    if (geoResult.status === 200) {
      try {
        captured["search_geo"] = JSON.parse(geoResult.body);
      } catch {}
    }
  }

  // Now get classifiedList if we have IDs
  const geoData = captured["search_geo"] as Record<string, unknown>;
  const classifiedIds = ((geoData?.classifieds ?? []) as Array<{id: string}>).map(c => c.id);

  if (classifiedIds.length > 0) {
    console.log(`\nGot ${classifiedIds.length} classified IDs. Fetching details for first batch...`);
    const batch = classifiedIds.slice(0, 20);

    const detailResult = await page.evaluate(async (ids: string[]) => {
      try {
        const r = await fetch(`/classifiedList/${ids.join(",")}`, {
          headers: { "Accept": "application/json", "Referer": window.location.href },
        });
        return { status: r.status, body: await r.text() };
      } catch (e) {
        return { status: 0, body: String(e) };
      }
    }, batch);

    console.log("classifiedList status:", detailResult.status);
    captured["classifiedList_first"] = (() => {
      try { return JSON.parse(detailResult.body); } catch { return detailResult.body.slice(0, 300); }
    })();

    // Show structure of first item
    const listData = captured["classifiedList_first"];
    const firstItem = Array.isArray(listData) ? listData[0] : (listData as Record<string, unknown[]>)?.classifieds?.[0];
    if (firstItem) {
      console.log("\n--- First classified item keys ---");
      console.log(JSON.stringify(firstItem, null, 2).slice(0, 4000));
    }
  }

  fs.writeFileSync("/tmp/seloger-captured.json", JSON.stringify(captured, null, 2));
  console.log("\nSaved to /tmp/seloger-captured.json");

  await sleep(2000);
  await browser.close();
}

run().catch(console.error);
