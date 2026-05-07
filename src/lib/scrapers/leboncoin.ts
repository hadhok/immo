import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

const BASE_URL = "https://www.leboncoin.fr";
// API non officielle LBC - plus stable que le scraping HTML
const API_URL = "https://api.leboncoin.fr/finder/classified/search";

const PROPERTY_TYPE_MAP: Record<number, PropertyType> = {
  1: "MAISON",
  2: "APPARTEMENT",
  3: "TERRAIN",
  4: "IMMEUBLE",
  5: "LOCAL_COMMERCIAL",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LeBonCoinScraper extends BaseScraper {
  source = "leboncoin";

  async fetchListings(): Promise<ListingData[]> {
    const listings: ListingData[] = [];
    let offset = 0;
    const limit = 35;
    const maxResults = 175; // 5 pages

    while (offset < maxResults) {
      const body = {
        filters: {
          category: { id: "9" }, // Ventes immobilières
          enums: {
            ad_type: ["offer"],
          },
          location: {
            departments: ["33"], // Gironde
          },
        },
        limit,
        offset,
        sort_by: "time",
        sort_order: "desc",
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.leboncoin.fr",
          Referer: "https://www.leboncoin.fr/",
          "api-key": "ba0c2dad52b3565fd92a15f704b35d75", // clé publique visible dans les requêtes navigateur
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403 || res.status === 429) {
        throw new Error(`blocked: HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const ads = data?.ads || [];
      if (ads.length === 0) break;

      for (const ad of ads) {
        const listing = this.parseAd(ad);
        if (listing) listings.push(listing);
      }

      offset += limit;
      await sleep(2000 + Math.random() * 1000);
    }

    return listings;
  }

  private parseAd(ad: Record<string, unknown>): ListingData | null {
    try {
      const price = (ad.price as number[])?.[0];
      if (!price) return null;

      const url = ad.url as string;
      if (!url) return null;

      const attrs = ad.attributes as Array<{ key: string; value: string; value_label?: string }> || [];
      const getAttr = (key: string) => attrs.find((a) => a.key === key);

      const surface = parseFloat(getAttr("square")?.value || "0") || undefined;
      const rooms = parseInt(getAttr("rooms")?.value || "0", 10) || undefined;
      const propertyTypeId = parseInt(getAttr("real_estate_type")?.value || "0", 10);
      const propertyType: PropertyType = PROPERTY_TYPE_MAP[propertyTypeId] || "APPARTEMENT";
      const dpe = getAttr("energy_rate")?.value_label;
      const ges = getAttr("ges")?.value_label;

      const location = ad.location as Record<string, unknown> | undefined;
      const city = String(location?.city || "Bordeaux");
      const zipcode = String(location?.zipcode || "33000");

      if (!zipcode.startsWith("33")) return null;

      const lat = location?.lat as number | undefined;
      const lng = location?.lng as number | undefined;

      const images = ad.images as Record<string, unknown> | undefined;
      const photos = (images?.urls_large as string[]) || (images?.urls as string[]) || [];

      return {
        source: "leboncoin",
        sourceUrl: url.startsWith("http") ? url : `${BASE_URL}${url}`,
        title: String(ad.subject || ""),
        price,
        surface,
        rooms,
        propertyType,
        city,
        zipcode,
        lat,
        lng,
        description: String(ad.body || ""),
        photos,
        dpe: dpe || undefined,
        ges: ges || undefined,
        publicationDate: ad.first_publication_date ? new Date(ad.first_publication_date as string) : undefined,
      };
    } catch {
      return null;
    }
  }
}
