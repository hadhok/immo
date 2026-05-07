import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";
import type { AnyNode as CheerioEl } from "domhandler";

type CheerioRoot = ReturnType<typeof cheerio.load>;

const BASE_URL = "https://www.pap.fr";
// Gironde geo ID = 397 on PAP
const SEARCH_URL = `${BASE_URL}/annonce/vente-immobilier-gironde-33-g397`;

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  appartement: "APPARTEMENT",
  maison: "MAISON",
  immeuble: "IMMEUBLE",
  terrain: "TERRAIN",
  "local commercial": "LOCAL_COMMERCIAL",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PapScraper extends BaseScraper {
  source = "pap";

  async fetchListings(): Promise<ListingData[]> {
    const browser = await chromium.launch({ headless: true });
    const listings: ListingData[] = [];

    try {
      const ctx = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "fr-FR",
        viewport: { width: 1280, height: 800 },
      });

      const page = await ctx.newPage();
      let pageNum = 1;
      const maxPages = 5;

      while (pageNum <= maxPages) {
        // PAP pagination: page 1 = base URL, page N = base URL + "-N"
        const url = pageNum === 1 ? SEARCH_URL : `${SEARCH_URL}-${pageNum}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

        try {
          await page.click('button:has-text("Accepter")', { timeout: 3000 });
          await sleep(1000);
        } catch {}

        // Wait for listings to render
        await page.waitForSelector("a.item-title", { timeout: 15000 }).catch(() => {});

        const html = await page.content();
        const $ = cheerio.load(html);
        const cards = $("a.item-title[href*='/annonces/']");

        if (cards.length === 0) break;

        cards.each((_: number, el: CheerioEl) => {
          const listing = this.parseCard($, el);
          if (listing) listings.push(listing);
        });

        pageNum++;
        await sleep(2000 + Math.random() * 1000);
      }

      await ctx.close();
    } finally {
      await browser.close();
    }

    return listings;
  }

  private parseCard($: CheerioRoot, el: CheerioEl): ListingData | null {
    try {
      const $el = $(el);
      const href = $el.attr("href") || "";
      if (!href) return null;

      const sourceUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      // Price: <span class="item-price">
      const priceText = $el.find("span.item-price").text().replace(/[^\d]/g, "");
      const price = parseInt(priceText, 10);
      if (!price || isNaN(price)) return null;

      // Title/city: <span class="h1"> contains the listing title (not just city)
      const titleRaw = $el.find("span.h1").text().trim();

      // Type from href pattern: /annonces/appartement-... or /annonces/maison-...
      const typeMatch = href.match(/\/annonces\/([a-z-]+)-/);
      const typeKey = typeMatch?.[1]?.toLowerCase() ?? "";
      let propertyType: PropertyType = "APPARTEMENT";
      for (const [key, val] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (typeKey.includes(key)) { propertyType = val; break; }
      }

      // Extract city from href slug: /annonces/[type]-[city]-[optionalZip]-r[id]
      // e.g. /annonces/appartement-bordeaux-33000-r123 → city=bordeaux, zip=33000
      const hrefSlug = href.replace(/^.*\/annonces\/[a-z]+-/, "").replace(/-r\d+$/, "");
      const zipFromHref = hrefSlug.match(/-(33\d{3})-?/)?.[1] ?? hrefSlug.match(/^(33\d{3})/)?.[1];
      const citySlug = hrefSlug.replace(/(33\d{3}|-r\d+).*/g, "").replace(/-$/, "");
      const cityFromSlug = citySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("-")
        .substring(0, 50);

      // Zipcode from title or href
      const zipFromTitle = titleRaw.match(/\(?(33\d{3})\)?/)?.[1];
      const zipcode = zipFromTitle ?? zipFromHref ?? "33000";

      // Clean city from title: strip description after "-" and zipcode
      const cityFromTitle = titleRaw.replace(/\s*\(33\d{3}\)/, "").split(/\s*-\s*/)[0].trim();
      const city = (cityFromTitle || cityFromSlug || "Bordeaux").substring(0, 80);
      const title = titleRaw || `${propertyType === "MAISON" ? "Maison" : "Appartement"} à ${city}`;

      // Tags: <ul class="item-tags"><li>2 pièces</li><li>48 m²</li>...</ul>
      const tags = $el.find("ul.item-tags li").map((_: number, li: CheerioEl) => $(li).text().trim()).get();
      const text = tags.join(" ");

      const surfaceText = text.match(/(\d+(?:[,.]\d+)?)\s*m²/)?.[1]?.replace(",", ".");
      const surface = surfaceText ? parseFloat(surfaceText) : undefined;

      const roomsText = text.match(/(\d+)\s*pièce/)?.[1];
      const rooms = roomsText ? parseInt(roomsText, 10) : undefined;

      // Photos: look in parent container
      const photos: string[] = [];
      $el.closest("[class]").find("img").each((_: number, img: CheerioEl) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && !src.includes("placeholder") && src.startsWith("http")) photos.push(src);
      });

      const titleLower = title.toLowerCase();
      const bienNeuf = titleLower.includes("neuf") || titleLower.includes("vefa") || titleLower.includes("programme neuf");
      const venduLoue =
        titleLower.includes("vendu loué") || titleLower.includes("vendu loue") ||
        titleLower.includes("vendu occupé") || titleLower.includes("bail en cours") ||
        titleLower.includes("locataire en place");

      return { source: "pap", sourceUrl, title, price, surface, rooms, propertyType, city, zipcode, photos, bienNeuf, venduLoue };
    } catch {
      return null;
    }
  }
}
