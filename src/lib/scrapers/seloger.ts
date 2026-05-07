import * as cheerio from "cheerio";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright-extra") as typeof import("playwright");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require("puppeteer-extra-plugin-stealth") as () => unknown;
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";
import type { AnyNode as CheerioEl } from "domhandler";

type CheerioRoot = ReturnType<typeof cheerio.load>;

const BASE_URL = "https://www.seloger.com";
// France page works; Gironde-specific pages return 410 — we filter by dept 33 on our side
const SEARCH_URL = `${BASE_URL}/recherche/achat/appartement,maison/france/ad02fr1`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  appartement: "APPARTEMENT",
  maison: "MAISON",
  immeuble: "IMMEUBLE",
  terrain: "TERRAIN",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SeLogerScraper extends BaseScraper {
  source = "seloger";

  async fetchListings(): Promise<ListingData[]> {
    (chromium as unknown as { use: (plugin: unknown) => void }).use((StealthPlugin as () => unknown)());
    const browser = await chromium.launch({ headless: true });
    const listings: ListingData[] = [];

    try {
      const ctx = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "fr-FR",
        viewport: { width: 1440, height: 900 },
      });

      const page = await ctx.newPage();

      const apiData: ListingData[] = [];
      page.on("response", async (response) => {
        const url = response.url();
        if (url.includes("listing") && response.headers()["content-type"]?.includes("json")) {
          try {
            const json = await response.json();
            const parsed = this.parseApiResponse(json);
            apiData.push(...parsed);
          } catch {}
        }
      });

      const maxPages = 3;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const url =
          pageNum === 1 ? SEARCH_URL : `${SEARCH_URL}?page=${pageNum}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

        try {
          await page.click(
            '[data-testid="didomi-notice-agree-button"], button:has-text("Accepter")',
            { timeout: 3000 }
          );
          await sleep(1000);
        } catch {}

        await page
          .waitForSelector('[data-testid="cardmfe-container--test-id"], article', {
            timeout: 10000,
          })
          .catch(() => {});

        // Prefer API data if intercepted
        if (apiData.length > 0) {
          listings.push(...apiData.splice(0));
          await sleep(2000);
          continue;
        }

        // Fallback: parse HTML, filter to Gironde (33)
        const html = await page.content();
        const pageListings = this.parseHtml(html);
        if (pageListings.length === 0) break;
        listings.push(...pageListings);

        await sleep(2000 + Math.random() * 1000);
      }

      await ctx.close();
    } finally {
      await browser.close();
    }

    return listings;
  }

  private parseApiResponse(json: unknown): ListingData[] {
    const listings: ListingData[] = [];
    const items =
      (json as Record<string, unknown>)?.cards ??
      (json as Record<string, unknown>)?.listCards ??
      [];
    if (!Array.isArray(items)) return listings;

    for (const item of items) {
      try {
        const price = parseInt(String(item.pricing?.price ?? item.price ?? 0), 10);
        if (!price) continue;

        const address = item.address ?? {};
        const zipcode = String(address.postCode ?? "33000");
        if (!zipcode.startsWith("33")) continue;

        listings.push({
          source: "seloger",
          sourceUrl: `${BASE_URL}${item.classifiedURL ?? item.url ?? ""}`,
          title: String(item.title ?? item.publicationTitle ?? ""),
          price,
          surface: parseFloat(String(item.surface ?? 0)) || undefined,
          rooms: parseInt(String(item.roomsCount ?? item.rooms ?? 0), 10) || undefined,
          city: String(address.city ?? "Bordeaux"),
          zipcode,
          description: String(item.description ?? ""),
          photos: Array.isArray(item.photos)
            ? item.photos.map((p: { url?: string }) => p.url ?? String(p)).filter(Boolean)
            : [],
          dpe: String(item.energyClassification ?? "") || undefined,
        });
      } catch {}
    }
    return listings;
  }

  private parseHtml(html: string): ListingData[] {
    const listings: ListingData[] = [];
    const $ = cheerio.load(html);

    $('[data-testid="cardmfe-container--test-id"]').each((_: number, el: CheerioEl) => {
      const listing = this.parseCard($, el);
      if (listing) listings.push(listing);
    });

    return listings;
  }

  private parseCard($: CheerioRoot, el: CheerioEl): ListingData | null {
    try {
      const $el = $(el);
      const href =
        $el.find('a[data-testid="card-mfe-covering-link-testid"]').attr("href") ||
        $el.find("a").first().attr("href") ||
        "";
      const sourceUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      // Price: aria-label="XXXXXX €"
      const priceAttr = $el.find('[data-testid="cardmfe-price-testid"]').attr("aria-label") ?? "";
      const priceText = priceAttr.replace(/[^\d]/g, "");
      const price = parseInt(priceText, 10);
      if (!price) return null;

      const text = $el.text();
      const surfaceText = text.match(/(\d+(?:[,.]\d+)?)\s*m²/)?.[1]?.replace(",", ".");
      const surface = surfaceText ? parseFloat(surfaceText) : undefined;

      const roomsText = text.match(/(\d+)\s*pièce/)?.[1];
      const rooms = roomsText ? parseInt(roomsText, 10) : undefined;

      const locationText = $el.find('[data-testid="cardmfe-description-box-address"]').text().trim();
      const zipcodeMatch = (locationText || text).match(/\b(33\d{3})\b/);
      const zipcode = zipcodeMatch?.[1] || "33000";
      if (!zipcode.startsWith("33")) return null;

      const city = locationText.replace(/\(?\d{5}\)?/, "").trim() || "Bordeaux";

      const typeText = text.toLowerCase();
      let propertyType: PropertyType = "APPARTEMENT";
      for (const [key, val] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (typeText.includes(key)) {
          propertyType = val;
          break;
        }
      }

      const title = String($el.find('[data-testid="cardmfe-description-box-text-test-id"]').text().trim() || `${propertyType} à ${city}`);

      const photos: string[] = [];
      $el.find("img").each((_: number, img: CheerioEl) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && src.startsWith("http")) photos.push(src);
      });

      return { source: "seloger", sourceUrl, title, price, surface, rooms, propertyType, city, zipcode, photos };
    } catch {
      return null;
    }
  }
}
