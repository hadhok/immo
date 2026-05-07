import * as cheerio from "cheerio";
import type { AnyNode as CheerioEl } from "domhandler";
type CheerioRoot = ReturnType<typeof cheerio.load>;
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

const BASE_URL = "https://www.seloger.com";
// Gironde = département 33, typeTransaction=1 (vente), idtypebien=1,2 (appart+maison)
const SEARCH_URL = `${BASE_URL}/list.htm?projects=2&types=1,2&natures=1,4&places=[{+%22divisions%22:[2968]+}]&enterprise=0&qsVersion=1.0`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  Appartement: "APPARTEMENT",
  Maison: "MAISON",
  Immeuble: "IMMEUBLE",
  Terrain: "TERRAIN",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SeLogerScraper extends BaseScraper {
  source = "seloger";

  async fetchListings(): Promise<ListingData[]> {
    const listings: ListingData[] = [];
    let page = 1;
    const maxPages = 5;

    while (page <= maxPages) {
      const url = `${SEARCH_URL}&LISTING-LISTpg=${page}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Referer: "https://www.seloger.com/",
        },
      });

      if (res.status === 403 || res.status === 429) {
        throw new Error(`blocked: HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const pageListings = this.parseListingsFromHtml(html);
      if (pageListings.length === 0) break;

      listings.push(...pageListings);
      page++;
      await sleep(2000 + Math.random() * 1500);
    }

    return listings;
  }

  private parseListingsFromHtml(html: string): ListingData[] {
    const listings: ListingData[] = [];
    const $ = cheerio.load(html);

    // SeLoger embeds JSON-LD or window.__INITIAL_STATE__
    const scriptContent = $('script[type="application/ld+json"]').text();
    if (scriptContent) {
      try {
        const data = JSON.parse(scriptContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "RealEstateListing") {
            const listing = this.parseJsonLd(item);
            if (listing) listings.push(listing);
          }
        }
        if (listings.length > 0) return listings;
      } catch {
        // fallback to HTML parsing
      }
    }

    // HTML fallback
    $("[data-test='sl.explore.card'], article.c-pa-list").each((_, el) => {
      const listing = this.parseCard($, el);
      if (listing) listings.push(listing);
    });

    return listings;
  }

  private parseJsonLd(item: Record<string, unknown>): ListingData | null {
    try {
      const url = item.url as string;
      if (!url) return null;

      const address = item.address as Record<string, string> | undefined;
      const zipcode = address?.postalCode || "33000";
      if (!zipcode.startsWith("33")) return null;

      const price = parseInt(String(item.price || 0), 10);
      if (!price) return null;

      return {
        source: "seloger",
        sourceUrl: url.startsWith("http") ? url : `${BASE_URL}${url}`,
        title: String(item.name || ""),
        price,
        surface: item.floorSize ? parseFloat(String(item.floorSize)) : undefined,
        city: address?.addressLocality || "Bordeaux",
        zipcode,
        description: String(item.description || ""),
        photos: Array.isArray(item.image) ? item.image.map(String) : [],
      };
    } catch {
      return null;
    }
  }

  private parseCard($: CheerioRoot, el: CheerioEl): ListingData | null {
    try {
      const $el = $(el);
      const href = $el.find("a").first().attr("href") || "";
      const sourceUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      const title = $el.find("h2, [data-test='sl.explore.card-title']").first().text().trim();
      const priceText = $el.find("[data-test='sl.explore.card-price'], .price").text().replace(/[^\d]/g, "");
      const price = parseInt(priceText, 10);
      if (!price) return null;

      const surfaceText = $el.text().match(/(\d+(?:,\d+)?)\s*m²/)?.[1]?.replace(",", ".");
      const surface = surfaceText ? parseFloat(surfaceText) : undefined;

      const roomsText = $el.text().match(/(\d+)\s*pièce/)?.[1];
      const rooms = roomsText ? parseInt(roomsText, 10) : undefined;

      const locationText = $el.find("[data-test='sl.explore.card-city'], .city").text().trim();
      const zipcodeMatch = locationText.match(/\b(33\d{3})\b/);
      const zipcode = zipcodeMatch?.[1] || "33000";

      if (!zipcode.startsWith("33")) return null;

      const city = locationText.replace(/\(?\d{5}\)?/, "").trim() || "Bordeaux";

      const typeText = title.toLowerCase();
      let propertyType: PropertyType = "APPARTEMENT";
      for (const [key, val] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (typeText.includes(key.toLowerCase())) {
          propertyType = val;
          break;
        }
      }

      const photos: string[] = [];
      $el.find("img").each((_, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && !src.includes("placeholder") && src.startsWith("http")) photos.push(src);
      });

      return {
        source: "seloger",
        sourceUrl,
        title,
        price,
        surface,
        rooms,
        propertyType,
        city,
        zipcode,
        photos,
      };
    } catch {
      return null;
    }
  }
}
