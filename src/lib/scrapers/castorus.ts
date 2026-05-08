import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

const BASE_URL = "https://www.castorus.com";

// Communes within ~20km of Bordeaux city center (44.8378, -0.5792)
const CITY_SLUGS = [
  // Bordeaux intra-muros
  "bordeaux-33000",
  "bordeaux-33100",
  "bordeaux-33200",
  "bordeaux-33300",
  "bordeaux-33800",
  // Rive gauche / sud
  "talence-33400",
  "begles-33130",
  "villenave-d-ornon-33140",
  "gradignan-33170",
  "pessac-33600",
  "cestas-33610",
  "canejan-33610",
  "leognan-33850",
  "la-brede-33650",
  // Rive droite / est
  "floirac-33270",
  "bouliac-33270",
  "cenon-33150",
  "lormont-33310",
  "bassens-33530",
  "carbon-blanc-33560",
  "ambares-et-lagrave-33440",
  "artigues-pres-bordeaux-33370",
  "carignan-de-bordeaux-33360",
  "st-loubes-33450",
  // Nord / nord-ouest
  "le-bouscat-33110",
  "bruges-33520",
  "blanquefort-33290",
  "eysines-33320",
  "le-taillan-medoc-33320",
  "le-haillan-33185",
  "st-medard-en-jalles-33160",
  "martignas-sur-jalle-33127",
  "st-jean-d-illac-33127",
  // Ouest
  "merignac-33700",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&ecirc;/g, "ê")
    .replace(/&agrave;/g, "à")
    .replace(/&ugrave;/g, "ù")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ccedil;/g, "ç")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

function parsePropertyType(title: string): PropertyType {
  const lower = title.toLowerCase();
  if (lower.includes("immeuble")) return "IMMEUBLE";
  if (lower.includes("terrain") || lower.includes("parcelle")) return "TERRAIN";
  if (lower.includes("local") || lower.includes("commerce") || lower.includes("boutique"))
    return "LOCAL_COMMERCIAL";
  if (lower.includes("maison") || lower.includes("villa") || lower.includes("chalet") || lower.includes("pavillon"))
    return "MAISON";
  if (lower.includes("appartement") || lower.includes("studio") || lower.includes("duplex") || lower.includes("loft"))
    return "APPARTEMENT";
  return "APPARTEMENT";
}

interface RowData {
  sort_prix: string;
  sort_titre: string;
  sort_ville: string;
  sort_piece: string;
  sort_superficie: string;
  sort_datem: string;
  sort_evolution: string;
  sort_prix_m2: string;
}

function parseRows(html: string, citySlug: string): ListingData[] {
  const results: ListingData[] = [];

  // Match each opening <tr ...> tag for clickable rows
  const rowOpenPattern = /<tr class="hover:bg-blue-50[^"]*sr-row-clickable"([\s\S]*?)>/g;
  let match;

  while ((match = rowOpenPattern.exec(html)) !== null) {
    const attrs = match[1];

    const hrefMatch = attrs.match(/data-href="([^"]+)"/);
    const jsMatch = attrs.match(/data-js="([^"]+)"/);
    if (!hrefMatch || !jsMatch) continue;

    const href = hrefMatch[1];
    const rawJs = jsMatch[1];

    try {
      const js: RowData = JSON.parse(decodeHtmlEntities(rawJs));

      const price = parseInt(js.sort_prix, 10);
      if (!price || price < 50000) continue; // skip rentals / invalid

      // Skip viager listings
      const titleLow = js.sort_titre.toLowerCase();
      if (titleLow.includes("viager")) continue;

      // Extract zipcode from href: /annonce/bordeaux-33200/ref123 → 33200
      const zipMatch = href.match(/\/annonce\/[^/]+-(\d{5})\/ref/);
      const zipcode = zipMatch?.[1] ?? citySlug.match(/(\d{5})$/)?.[1] ?? "33000";

      if (!zipcode.startsWith("33")) continue;

      const title = decodeHtmlEntities(js.sort_titre).trim();
      const propertyType = parsePropertyType(title);

      // City: "Bordeaux (Rue de Rivière)" → take part before "("
      const cityRaw = decodeHtmlEntities(js.sort_ville);
      const city = (cityRaw.split("(")[0] ?? cityRaw).trim();

      const surface = parseFloat(js.sort_superficie) || undefined;
      const rooms = parseInt(js.sort_piece, 10) || undefined;

      // Skip listings with suspiciously low price/m² (likely data errors), but keep terrains
      if (surface && surface > 15 && propertyType !== "TERRAIN") {
        const ppm2 = price / surface;
        if (ppm2 < 500) continue; // below 500€/m² is almost certainly a mistake
      }

      const sourceUrl = `${BASE_URL}${href}`;

      // publicationDate from Unix timestamp
      const tsSeconds = parseInt(js.sort_datem, 10);
      const publicationDate = tsSeconds > 0 ? new Date(tsSeconds * 1000) : undefined;

      results.push({
        source: "castorus",
        sourceUrl,
        title,
        price,
        surface,
        rooms,
        propertyType,
        city,
        zipcode,
        publicationDate,
      });
    } catch {
      continue;
    }
  }

  return results;
}

export class CastorusScraper extends BaseScraper {
  source = "castorus";

  async fetchListings(): Promise<ListingData[]> {
    const allListings: ListingData[] = [];
    const seen = new Set<string>();

    for (const slug of CITY_SLUGS) {
      try {
        const url = `${BASE_URL}/recherche/${slug}?t=a`;
        const resp = await fetch(url, { headers: HEADERS });

        if (!resp.ok) {
          if (resp.status === 429 || resp.status === 403) {
            throw new Error(`blocked: HTTP ${resp.status}`);
          }
          continue;
        }

        const html = await resp.text();
        const listings = parseRows(html, slug);

        for (const listing of listings) {
          if (!seen.has(listing.sourceUrl)) {
            seen.add(listing.sourceUrl);
            allListings.push(listing);
          }
        }

        await sleep(800 + Math.random() * 400);
      } catch (err) {
        if (String(err).includes("blocked")) throw err;
        // Non-fatal: skip this city and continue
      }
    }

    return allListings;
  }
}
