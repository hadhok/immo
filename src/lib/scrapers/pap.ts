import * as cheerio from "cheerio";
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

const BASE_URL = "https://www.pap.fr";
const SEARCH_URL = `${BASE_URL}/annonce/ventes-immobilier-gironde-g44683?nb-resultats=100`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  appartement: "APPARTEMENT",
  maison: "MAISON",
  immeuble: "IMMEUBLE",
  terrain: "TERRAIN",
  "local commercial": "LOCAL_COMMERCIAL",
};

import type { AnyNode as CheerioEl } from "domhandler";
type CheerioRoot = ReturnType<typeof cheerio.load>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PapScraper extends BaseScraper {
  source = "pap";

  async fetchListings(): Promise<ListingData[]> {
    const listings: ListingData[] = [];
    let page = 1;
    const maxPages = 5;

    while (page <= maxPages) {
      const url = page === 1 ? SEARCH_URL : `${SEARCH_URL}&page=${page}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);

      const html = await res.text();
      const $ = cheerio.load(html);
      const cards = $("a.CardLink");

      if (cards.length === 0) break;

      cards.each((_, el: CheerioEl) => {
        const listing = this.parseCard($, el);
        if (listing) listings.push(listing);
      });

      page++;
      await sleep(1500 + Math.random() * 1000);
    }

    return listings;
  }

  private parseCard($: CheerioRoot, el: CheerioEl): ListingData | null {
    try {
      const $el = $(el);
      const href = $el.attr("href") || "";
      if (!href) return null;

      const sourceUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      const title = $el.find(".item-title").text().trim() || $el.find("h2").text().trim();

      const priceText = $el.find(".price").text().replace(/[^\d]/g, "");
      const price = parseInt(priceText, 10);
      if (!price || isNaN(price)) return null;

      const surfaceText = $el.find(".item-description").text().match(/(\d+)\s*m²/)?.[1];
      const surface = surfaceText ? parseFloat(surfaceText) : undefined;

      const roomsText = $el.find(".item-description").text().match(/(\d+)\s*pièce/)?.[1];
      const rooms = roomsText ? parseInt(roomsText, 10) : undefined;

      const locationText = $el.find(".item-description, .location").text();
      const zipcodeMatch = locationText.match(/\b(33\d{3})\b/);
      const zipcode = zipcodeMatch?.[1] || "33000";
      const city = this.extractCity($el) || "Bordeaux";

      const typeText = title.toLowerCase();
      let propertyType: PropertyType = "APPARTEMENT";
      for (const [key, val] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (typeText.includes(key)) {
          propertyType = val;
          break;
        }
      }

      const photos: string[] = [];
      $el.find("img").each((_, img: CheerioEl) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && !src.includes("placeholder")) photos.push(src);
      });

      return { source: "pap", sourceUrl, title, price, surface, rooms, propertyType, city, zipcode, photos };
    } catch {
      return null;
    }
  }

  private extractCity($el: ReturnType<CheerioRoot>): string {
    const text = $el.find(".location, .item-description, .city").first().text() || $el.text();
    const match = text.match(/\b([A-ZÀ-Ü][a-zà-ü-]+(?:\s+[A-ZÀ-Ü][a-zà-ü-]+)*)\s+\(33/);
    return match?.[1] || "Bordeaux";
  }
}
