import { PapScraper, SeLogerScraper, LeBonCoinScraper } from "@/lib/scrapers";
import type { BaseScraper } from "@/lib/scrapers";
import type { Source } from "@/types/listing";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max (Vercel Pro) — ajuster selon l'hébergement

const SCRAPERS: Record<Source, () => BaseScraper> = {
  pap: () => new PapScraper(),
  seloger: () => new SeLogerScraper(),
  leboncoin: () => new LeBonCoinScraper(),
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sources = (body.sources as Source[]) || (Object.keys(SCRAPERS) as Source[]);

  const validSources = sources.filter((s) => s in SCRAPERS);
  if (validSources.length === 0) {
    return Response.json({ error: "Aucune source valide" }, { status: 400 });
  }

  // Lancement en parallèle
  const results = await Promise.allSettled(
    validSources.map((source) => SCRAPERS[source]().run())
  );

  const summary = results.map((r, i) => ({
    source: validSources[i],
    ...(r.status === "fulfilled"
      ? r.value
      : { status: "ERROR", errorMsg: String(r.reason), added: 0, updated: 0, total: 0 }),
  }));

  return Response.json({ results: summary });
}
