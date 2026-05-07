import { chromium } from "playwright";
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

// Gironde department zone ID on BienIci (OSM ID: -7405)
const ZONE_ID = "-7405";
const BASE_URL = "https://www.bienici.com";
const API_URL = `${BASE_URL}/realEstateAds.json`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  house: "MAISON",
  flat: "APPARTEMENT",
  loft: "APPARTEMENT",
  townhouse: "MAISON",
  building: "IMMEUBLE",
  terrain: "TERRAIN",
  "local-commercial": "LOCAL_COMMERCIAL",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BieniciScraper extends BaseScraper {
  source = "bienici";

  async fetchListings(): Promise<ListingData[]> {
    const browser = await chromium.launch({ headless: true });
    const listings: ListingData[] = [];

    try {
      const ctx = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "fr-FR",
      });

      const page = await ctx.newPage();
      const pageSize = 24;
      const maxPages = 5;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const filters = {
          size: pageSize,
          from: (pageNum - 1) * pageSize,
          filterType: "buy",
          propertyType: ["house", "flat", "loft", "townhouse"],
          page: pageNum,
          sortBy: "publicationDate",
          sortOrder: "desc",
          onTheMarket: [true],
          zoneIdsByTypes: { zoneIds: [ZONE_ID] },
        };

        const url = `${API_URL}?filters=${encodeURIComponent(JSON.stringify(filters))}&extensionType=extendedIfNoResult`;
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        if (!resp?.ok()) break;

        const body = await resp.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(body);
        } catch {
          break;
        }

        const ads = (json.realEstateAds as Record<string, unknown>[]) ?? [];
        if (ads.length === 0) break;

        for (const ad of ads) {
          const listing = this.parseAd(ad);
          if (listing) listings.push(listing);
        }

        await sleep(1000);
      }

      await ctx.close();
    } finally {
      await browser.close();
    }

    return listings;
  }

  private parseAd(ad: Record<string, unknown>): ListingData | null {
    try {
      const priceArr = ad.price as number[] | number | undefined;
      const price = Array.isArray(priceArr) ? priceArr[0] : priceArr;
      if (!price) return null;

      const zipcode = String(ad.postalCode ?? "33000");
      if (!zipcode.startsWith("33")) return null;

      const city = String(ad.city ?? "Bordeaux");
      const surface = (ad.surfaceArea as number) || undefined;
      const rooms = (ad.roomsQuantity as number) || undefined;

      const typeKey = String(ad.propertyType ?? "").toLowerCase();
      const propertyType: PropertyType = PROPERTY_TYPE_MAP[typeKey] ?? "APPARTEMENT";

      const adId = String(ad.id ?? "");
      const sourceUrl = `${BASE_URL}/annonce/achat/${adId}`;

      const HTML_ENTITIES: Record<string, string> = {
        agrave: "à", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
        iacute: "í", ocirc: "ô", ugrave: "ù", ucirc: "û", ccedil: "ç",
        nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"',
      };
      const decodeHtml = (s: string) =>
        s.replace(/&([a-zA-Z]+|#\d+);/g, (m, e: string) => HTML_ENTITIES[e.toLowerCase()] ?? m);
      const title = decodeHtml(String(ad.title ?? `${propertyType === "MAISON" ? "Maison" : "Appartement"} à ${city}`));
      const description = decodeHtml(String(ad.description ?? "").replace(/<[^>]+>/g, " ").trim());

      const photos = ((ad.photos as Array<{ url?: string; url_photo?: string }>) ?? [])
        .map((p) => p.url ?? p.url_photo ?? "")
        .filter(Boolean);

      const dpe = String(ad.energyClassification ?? "") || undefined;

      const blurInfo = ad.blurInfo as Record<string, unknown> | undefined;
      const position = blurInfo?.position as Record<string, number> | undefined;
      const lat = position?.lat || undefined;
      const lngRaw = position?.lon !== undefined ? position.lon : position?.lng;
      const lng = lngRaw || undefined;

      const bienNeuf = Boolean(ad.newProperty);
      const descLower = (description + " " + title).toLowerCase();
      const venduLoue =
        descLower.includes("vendu loué") ||
        descLower.includes("vendu loue") ||
        descLower.includes("vendu occupé") ||
        descLower.includes("vendu occupe") ||
        descLower.includes("bail en cours") ||
        descLower.includes("locataire en place");

      return {
        source: "bienici",
        sourceUrl,
        title,
        price,
        surface,
        rooms,
        propertyType,
        city,
        zipcode,
        lat,
        lng,
        description,
        photos,
        dpe: dpe !== "NS" ? dpe : undefined,
        bienNeuf,
        venduLoue,
        publicationDate: ad.publicationDate ? new Date(ad.publicationDate as string) : undefined,
      };
    } catch {
      return null;
    }
  }
}
