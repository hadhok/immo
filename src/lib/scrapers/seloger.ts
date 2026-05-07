// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright-extra") as typeof import("playwright");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require("puppeteer-extra-plugin-stealth") as () => unknown;
import { BaseScraper } from "./base";
import type { ListingData, PropertyType } from "@/types/listing";

(chromium as unknown as { use: (p: unknown) => void }).use((StealthPlugin as () => unknown)());

const BASE_URL = "https://www.seloger.com";

// Location codes confirmed working for Gironde areas.
// POCOFR1904 = Bordeaux 33000.  Add more as needed.
const LOCATION_CODES = [
  "POCOFR1904", // Bordeaux 33000
];

// Fallback: bounding box covering all of Gironde (lon_min,lat_min,lon_max,lat_max)
const GIRONDE_BBOX = "-1.35,44.10,0.30,45.80";

const ESTATE_TYPE_MAP: Record<string, PropertyType> = {
  House: "MAISON",
  Apartment: "APPARTEMENT",
  Building: "IMMEUBLE",
  Land: "TERRAIN",
  CommercialPremise: "LOCAL_COMMERCIAL",
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Flexible parser for the /classifiedList/{ids} response
// SeLoger's response shape (observed):
// Array<ClassifiedItem>  OR  { classifieds: ClassifiedItem[] }
// ---------------------------------------------------------------------------
type Obj = Record<string, unknown>;

function str(v: unknown): string { return v != null ? String(v) : ""; }
function num(v: unknown): number { return parseFloat(str(v)) || 0; }

function parseClassified(item: Obj): ListingData | null {
  try {
    // Price
    const pricing = item.pricing as Obj | undefined;
    const price = num(pricing?.price ?? pricing?.rawPrice ?? item.price);
    if (!price) return null;

    // Address
    const address = (item.address ?? item.localisation) as Obj | undefined;
    const zipcode = str(
      address?.postalCode ?? address?.codePostal ?? address?.zipCode ?? "33000"
    );
    if (!zipcode.startsWith("33")) return null;

    const city = str(address?.city ?? address?.ville ?? "Bordeaux");

    // Coordinates
    const coords = (address?.coordinates ?? address?.coordonnees) as Obj | undefined;
    const lat = coords?.lat != null ? num(coords.lat) : undefined;
    const lng = coords?.lon != null ? num(coords.lon) : (coords?.lng != null ? num(coords.lng) : undefined);

    // Surface & rooms
    const surface = num(item.surface ?? (item.surfaceArea as Obj)?.value ?? 0) || undefined;
    const rooms = num(item.roomsCount ?? item.rooms ?? item.nbPieces ?? 0) || undefined;
    const bedrooms = num(item.bedroomsCount ?? item.bedrooms ?? item.nbChambres ?? 0) || undefined;
    const floor = item.floorNumber != null ? num(item.floorNumber) : null;
    const totalFloors = item.totalFloorCount != null ? num(item.totalFloorCount) : null;

    // Type
    const estateTypeRaw = str(item.estateType ?? item.typeProperty ?? "House");
    const propertyType: PropertyType =
      ESTATE_TYPE_MAP[estateTypeRaw] ??
      ESTATE_TYPE_MAP[estateTypeRaw.charAt(0).toUpperCase() + estateTypeRaw.slice(1)] ??
      "APPARTEMENT";

    // Photos
    const photosRaw = (item.photos ?? item.images ?? []) as unknown[];
    const photos = photosRaw
      .map((p) => {
        if (typeof p === "string") return p;
        const po = p as Obj;
        return str(po.url ?? po.src ?? po.bigUrl ?? po.thumbUrl ?? "");
      })
      .filter(Boolean);

    // DPE / GES
    const dpe = str(item.energyClassification ?? item.dpe ?? item.energyClass ?? "").toUpperCase() || undefined;
    const ges = str(item.gasClassification ?? item.ges ?? item.gasClass ?? "").toUpperCase() || undefined;

    // URL
    const relUrl = str(item.classifiedURL ?? item.url ?? item.annonce_url ?? "");
    const sourceUrl = relUrl.startsWith("http") ? relUrl : `${BASE_URL}${relUrl}`;
    if (!sourceUrl.includes("seloger.com")) return null;

    // Title
    const title = str(
      item.title ?? item.publicationTitle ?? item.titleLabel ??
      `${propertyType === "MAISON" ? "Maison" : "Appartement"} à ${city}`
    );

    // Publication date
    const pubRaw = str(item.publicationDate ?? item.firstPublicationDate ?? "");
    const publicationDate = pubRaw ? new Date(pubRaw) : undefined;

    // charges / taxe (sometimes returned)
    const charges = item.chargesMensuelles != null ? num(item.chargesMensuelles) : undefined;
    const taxe = item.taxeFonciere != null ? num(item.taxeFonciere) : undefined;

    // neuf / loué detection from tags or booleans
    const tags = (item.tags ?? item.labels ?? []) as string[];
    const tagsStr = tags.map(t => String(t).toLowerCase()).join(" ");
    const titleLow = title.toLowerCase();
    const descLow = str(item.description).toLowerCase();
    const bienNeuf = Boolean(
      item.isNewProperty ??
      item.newConstruction ??
      /neuf|vefa|programme neuf/.test(tagsStr + titleLow)
    );
    const venduLoue = Boolean(
      item.isRented ??
      /vendu lou[eé]|vendu occup[eé]|bail en cours|locataire en place/.test(tagsStr + titleLow + descLow)
    );

    return {
      source: "seloger",
      sourceUrl,
      title,
      price,
      surface,
      rooms,
      bedrooms,
      floor: floor ?? undefined,
      totalFloors: totalFloors ?? undefined,
      propertyType,
      city,
      zipcode,
      lat,
      lng,
      description: str(item.description ?? ""),
      photos,
      dpe: dpe && /^[A-G]$/.test(dpe) ? dpe : undefined,
      ges: ges && /^[A-G]$/.test(ges) ? ges : undefined,
      chargesMensuelles: charges,
      taxeFonciere: taxe,
      publicationDate,
      bienNeuf,
      venduLoue,
    };
  } catch {
    return null;
  }
}

function extractItems(json: unknown): Obj[] {
  if (Array.isArray(json)) return json as Obj[];
  const obj = json as Obj;
  // Try common wrapper keys
  for (const key of ["classifieds", "listings", "items", "cards", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as Obj[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Scraper
// ---------------------------------------------------------------------------
export class SeLogerScraper extends BaseScraper {
  source = "seloger";

  async fetchListings(): Promise<ListingData[]> {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
    });

    const listings: ListingData[] = [];

    try {
      const ctx = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: {
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
          "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
        },
      });

      const page = await ctx.newPage();

      // Warm up: visit homepage first to establish a real session + get cookies
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      await sleep(1500 + Math.random() * 1000);
      // Accept cookie banner if present
      try {
        await page.click("#didomi-notice-agree-button, button:has-text(\"Tout accepter\")", { timeout: 3000 });
        await sleep(800);
      } catch {}

      // Capture all classified detail responses (batch IDs endpoint)
      const classifiedDetails: Obj[] = [];
      let searchGeoTotal = 0;

      page.on("response", async (res) => {
        const url = res.url();
        if (!url.includes("seloger.com")) return;
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("json")) return;

        try {
          const json = await res.json();

          if (url.includes("serp-bff/search/geo")) {
            searchGeoTotal = num((json as Obj).totalCount);
          }

          if (url.includes("classifiedList/")) {
            const items = extractItems(json);
            classifiedDetails.push(...items);
          }
        } catch {}
      });

      const maxPages = 5;
      let gotData = false;

      for (const location of LOCATION_CODES) {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const url = new URL(`${BASE_URL}/classified-map`);
          url.searchParams.set("distributionTypes", "Buy");
          url.searchParams.set("estateTypes", "House,Apartment,Building,Land");
          url.searchParams.set("locations", location);
          if (pageNum > 1) url.searchParams.set("page", String(pageNum));

          const prevCount = classifiedDetails.length;

          try {
            const res = await page.goto(url.toString(), {
              waitUntil: "networkidle",
              timeout: 35000,
            });

            if (res?.status() === 403 || res?.status() === 429) {
              throw new Error(`blocked: HTTP ${res.status()}`);
            }

            await sleep(2000 + Math.random() * 1500);

            // Accept cookie banner if present
            try {
              await page.click("#didomi-notice-agree-button, button:has-text(\"Tout accepter\")", { timeout: 2000 });
              await sleep(800);
            } catch {}

            const newItems = classifiedDetails.length - prevCount;
            if (newItems === 0 && pageNum > 1) break; // No more data

            gotData = gotData || classifiedDetails.length > 0;
            if (searchGeoTotal > 0 && classifiedDetails.length >= Math.min(searchGeoTotal, maxPages * 24)) break;

          } catch (e) {
            if (String(e).includes("blocked")) throw e;
            break;
          }

          await sleep(3000 + Math.random() * 2000);
        }
      }

      // If map view didn't yield enough, try bbox fallback
      if (!gotData || classifiedDetails.length < 5) {
        const bboxUrl = new URL(`${BASE_URL}/classified-map`);
        bboxUrl.searchParams.set("distributionTypes", "Buy");
        bboxUrl.searchParams.set("estateTypes", "House,Apartment,Building,Land");
        bboxUrl.searchParams.set("bbox", GIRONDE_BBOX);

        const prevCount = classifiedDetails.length;
        try {
          const res = await page.goto(bboxUrl.toString(), { waitUntil: "networkidle", timeout: 35000 });
          if (res?.status() !== 403 && res?.status() !== 429) {
            await sleep(2500);
          }
        } catch {}

        gotData = gotData || classifiedDetails.length > prevCount;
      }

      if (!gotData) {
        throw new Error("blocked: no listings intercepted (DataDome captcha likely)");
      }

      // Deduplicate by sourceUrl and filter to Gironde (33)
      const seen = new Set<string>();
      for (const item of classifiedDetails) {
        const listing = parseClassified(item);
        if (!listing) continue;
        if (seen.has(listing.sourceUrl)) continue;
        seen.add(listing.sourceUrl);
        listings.push(listing);
      }

      await ctx.close();
    } finally {
      await browser.close();
    }

    return listings;
  }
}
