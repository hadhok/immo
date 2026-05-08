// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright-extra") as typeof import("playwright");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require("puppeteer-extra-plugin-stealth") as () => unknown;
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

const BASE_URL = "https://www.leboncoin.fr";
// Department 33 = Gironde, category 9 = immobilier vente
const SEARCH_URL = `${BASE_URL}/recherche?category=9&departments=33&owner_type=all&ad_type=offer&sort=time&order=desc`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  Appartement: "APPARTEMENT",
  Maison: "MAISON",
  Terrain: "TERRAIN",
  Parking: "AUTRE",
  Immeuble: "IMMEUBLE",
  "Local commercial": "LOCAL_COMMERCIAL",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LbcAd = Record<string, unknown>;

function extractNextData(html: string): LbcAd[] {
  const idx = html.indexOf('__NEXT_DATA__" type="application/json">');
  if (idx < 0) return [];
  const start = html.indexOf(">", idx) + 1;
  const end = html.indexOf("</script>", start);
  try {
    const data = JSON.parse(html.substring(start, end)) as Record<string, unknown>;
    return findAds(data);
  } catch {
    return [];
  }
}

function findAds(obj: unknown, depth = 0): LbcAd[] {
  if (depth > 6) return [];
  if (typeof obj === "object" && obj !== null) {
    const o = obj as Record<string, unknown>;
    if ("ads" in o && Array.isArray(o.ads) && o.ads.length > 10) {
      return o.ads as LbcAd[];
    }
    for (const v of Object.values(o)) {
      const r = findAds(v, depth + 1);
      if (r.length) return r;
    }
  }
  return [];
}

export class LeBonCoinScraper extends BaseScraper {
  source = "leboncoin";

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
        extraHTTPHeaders: { "Accept-Language": "fr-FR,fr;q=0.9" },
      });

      const page = await ctx.newPage();
      const maxPages = 5;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const url = pageNum === 1 ? SEARCH_URL : `${SEARCH_URL}&page=${pageNum}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

        try {
          await page.click('[data-testid="Bouton-Accepter"], #didomi-notice-agree-button', { timeout: 3000 });
          await sleep(1000);
        } catch {}

        const html = await page.content();
        const ads = extractNextData(html);

        // Filter to Gironde only and parse
        const gironde = ads.filter((ad) => {
          const loc = ad.location as Record<string, unknown> | undefined;
          return String(loc?.department_id ?? "").startsWith("33") ||
                 String(loc?.zipcode ?? "").startsWith("33");
        });

        if (gironde.length === 0 && pageNum > 1) break;

        for (const ad of gironde) {
          const listing = this.parseAd(ad);
          if (listing) listings.push(listing);
        }

        await sleep(2500 + Math.random() * 1000);
      }

      await ctx.close();
    } finally {
      await browser.close();
    }

    return listings;
  }

  private parseAd(ad: LbcAd): ListingData | null {
    try {
      const price = (ad.price as number[])?.[0] ?? (ad.price as number);
      if (!price) return null;

      const location = (ad.location as Record<string, unknown>) ?? {};
      const zipcode = String(location.zipcode ?? "33000");
      if (!zipcode.startsWith("33")) return null;

      const attrs = (ad.attributes as Array<{ key: string; value: string; value_label?: string }>) ?? [];
      const getAttr = (key: string) => attrs.find((a) => a.key === key);

      const title = String(ad.subject ?? "");
      const desc = String(ad.body ?? "");
      if ((title + desc).toLowerCase().includes("viager")) return null;

      const surface = parseFloat(getAttr("square")?.value ?? "0") || undefined;
      const rooms = parseInt(getAttr("rooms")?.value ?? "0", 10) || undefined;
      const typeLabel = getAttr("real_estate_type")?.value_label ?? "";
      const propertyType: PropertyType = PROPERTY_TYPE_MAP[typeLabel] ?? "APPARTEMENT";
      const dpe = getAttr("energy_rate")?.value_label;

      const images = (ad.images as Record<string, unknown>) ?? {};
      const photos = ((images.urls_large ?? images.urls) as string[]) ?? [];

      if (surface && surface > 15 && propertyType !== "TERRAIN" && price / surface < 500) return null;

      return {
        source: "leboncoin",
        sourceUrl: String(ad.url ?? `${BASE_URL}/ad/${ad.list_id}`),
        title,
        price,
        surface,
        rooms,
        propertyType,
        city: String(location.city ?? "Bordeaux"),
        zipcode,
        lat: (location.lat as number) || undefined,
        lng: (location.lng as number) || undefined,
        description: desc,
        photos: photos.filter(Boolean),
        dpe: dpe || undefined,
        publicationDate: ad.first_publication_date
          ? new Date(ad.first_publication_date as string)
          : undefined,
      };
    } catch {
      return null;
    }
  }
}
