import { PapScraper, BieniciScraper, CastorusScraper } from "@/lib/scrapers";
import type { BaseScraper } from "@/lib/scrapers";
import type { Source } from "@/types/listing";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max (Vercel Pro) — ajuster selon l'hébergement

const SCRAPERS: Record<string, () => BaseScraper> = {
  pap: () => new PapScraper(),
  bienici: () => new BieniciScraper(),
  castorus: () => new CastorusScraper(),
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sources = (body.sources as Source[]) || (Object.keys(SCRAPERS) as Source[]);

  const validSources = sources.filter((s) => s in SCRAPERS);
  if (validSources.length === 0) {
    return Response.json({ error: "Aucune source valide" }, { status: 400 });
  }

  // Lancement séquentiel pour éviter trop de navigateurs en parallèle
  const summary: Array<{ source: string; status: string; added: number; updated: number; total: number; errorMsg?: string }> = [];
  for (const source of validSources) {
    try {
      const result = await SCRAPERS[source]().run();
      summary.push({ source, added: result.added, updated: result.updated, total: result.total, status: result.status, errorMsg: result.errorMsg });
    } catch (err) {
      summary.push({ source, status: "ERROR", errorMsg: String(err), added: 0, updated: 0, total: 0 });
    }
  }

  return Response.json({ results: summary });
}
