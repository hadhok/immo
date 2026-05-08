export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ListingFilters } from "@/components/listing-filters";
import { ListingTableRow } from "@/components/listing-table-row";
import type { PropertyType } from "@/types/listing";
import {
  estimateCashFlow,
  estimateGrossYield,
  marketPricePerSqm,
} from "@/lib/estimates";
import { MapPin, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchParams {
  page?: string;
  city?: string;
  zipcode?: string;
  source?: string;
  propertyType?: PropertyType;
  priceMin?: string;
  priceMax?: string;
  surfaceMin?: string;
  surfaceMax?: string;
  rooms?: string;
  sinceHours?: string;
  sortBy?: string;
  sortOrder?: string;
  construction?: "ancien" | "neuf";
  statut?: "libre" | "loue";
  yieldMin?: string;
  apport?: string;
  taux?: string;
  duree?: string;
}

function parseInvestParams(sp: SearchParams) {
  return {
    apport: parseFloat(sp.apport || "20"),
    taux:   parseFloat(sp.taux   || "3.5"),
    duree:  parseInt(sp.duree   || "20", 10),
  };
}

// ─── Listing quality filters ─────────────────────────────────────────────────

// Exclut les annonces dont le prix/m² est < 30% du marché (erreurs de données)
function isOutlier(l: { surface: number | null; price: number; zipcode: string; propertyType: string }): boolean {
  if (!l.surface || l.surface < 5) return false;
  const mktPpm2  = marketPricePerSqm(l.zipcode, l.propertyType);
  const listPpm2 = l.price / l.surface;
  return listPpm2 < mktPpm2 * 0.30;
}

// Mots-clés signalant une annonce non-résidentielle ou non-investissable
// Cherche dans le titre ET la description
const JUNK_PATTERNS: string[] = [
  "viager",
  "fonds de commerce",
  "fond de commerce",
  "bail commercial",
  "droit au bail",
  "pas de porte",
  "murs commerciaux",
];

// Mots-clés détectant un local commercial déguisé en appartement
const COMMERCIAL_IN_RESI_PATTERNS: string[] = [
  "restaurant",
  "pizzeria",
  "brasserie",
  "boulangerie",
  "salon de coiffure",
  "tabac presse",
  "bar-restaurant",
  "snack",
  "fast food",
];

function isJunk(l: { title: string; description: string | null; propertyType: string }): boolean {
  const text = `${l.title} ${l.description ?? ""}`.toLowerCase();

  // Patterns universels (viager, commerce, etc.)
  if (JUNK_PATTERNS.some((p) => text.includes(p))) return true;

  // Locaux commerciaux mal classés en résidentiel
  if (l.propertyType === "APPARTEMENT" || l.propertyType === "MAISON") {
    if (COMMERCIAL_IN_RESI_PATTERNS.some((p) => text.includes(p))) return true;
  }

  return false;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getListings(sp: SearchParams) {
  const page  = parseInt(sp.page || "1", 10);
  const limit = 50;
  const skip  = (page - 1) * limit;

  const where: Prisma.ListingWhereInput = {
    isActive: true,
    NOT: [
      // Viager filtré au niveau DB (titre ET description)
      { title:       { contains: "viager", mode: "insensitive" } },
      { description: { contains: "viager", mode: "insensitive" } },
      // Fonds de commerce filtré au niveau DB
      { title:       { contains: "fonds de commerce", mode: "insensitive" } },
      { description: { contains: "fonds de commerce", mode: "insensitive" } },
      { title:       { contains: "bail commercial", mode: "insensitive" } },
      { description: { contains: "bail commercial", mode: "insensitive" } },
      // Types non-résidentiels
      { propertyType: "TERRAIN" },
    ],
  };

  if (sp.city)         where.city         = { contains: sp.city, mode: "insensitive" };
  if (sp.zipcode)      where.zipcode      = { startsWith: sp.zipcode };
  if (sp.source)       where.source       = sp.source;
  if (sp.propertyType) where.propertyType = sp.propertyType;

  if (sp.priceMin || sp.priceMax) {
    where.price = {};
    if (sp.priceMin) where.price.gte = parseInt(sp.priceMin, 10);
    if (sp.priceMax) where.price.lte = parseInt(sp.priceMax, 10);
  }
  if (sp.surfaceMin || sp.surfaceMax) {
    where.surface = {};
    if (sp.surfaceMin) where.surface.gte = parseFloat(sp.surfaceMin);
    if (sp.surfaceMax) where.surface.lte = parseFloat(sp.surfaceMax);
  }
  if (sp.rooms) where.rooms = { gte: parseInt(sp.rooms, 10) };
  if (sp.construction === "neuf") where.bienNeuf = true;
  if (sp.statut === "loue")       where.venduLoue = true;
  if (sp.statut === "libre")      where.venduLoue = false;
  if (sp.sinceHours) {
    const since = new Date();
    since.setHours(since.getHours() - parseInt(sp.sinceHours, 10));
    where.scrapedAt = { gte: since };
  }

  const investParams = parseInvestParams(sp);
  const sortOrder    = sp.sortOrder === "asc" ? "asc" : "desc";
  const sortBy       = sp.sortBy ?? "scrapedAt";

  // ── In-memory sorts / yieldMin filter ─────────────────────────────────────
  const needsInMemory = ["cashflow", "yield", "pricePerSqm"].includes(sortBy) || !!sp.yieldMin;

  if (needsInMemory) {
    const all = await prisma.listing.findMany({ where, orderBy: { scrapedAt: "desc" } });

    type Row = { listing: typeof all[0]; cf: number; y: number; ppm2: number };
    const rows: Row[] = all
      .filter((l) => !isOutlier(l) && !isJunk(l))
      .map((l) => ({
        listing: l,
        cf:   estimateCashFlow(l, investParams) ?? -999999,
        y:    estimateGrossYield(l) ?? -999,
        ppm2: l.surface ? Math.round(l.price / l.surface) : 999999,
      }));

    const filtered = sp.yieldMin
      ? rows.filter((r) => r.y >= parseFloat(sp.yieldMin!))
      : rows;

    filtered.sort((a, b) => {
      const [va, vb] =
        sortBy === "cashflow"  ? [a.cf,   b.cf]   :
        sortBy === "yield"     ? [a.y,    b.y]    :
        /* pricePerSqm */        [a.ppm2, b.ppm2];
      return sortOrder === "asc" ? va - vb : vb - va;
    });

    const total    = filtered.length;
    const listings = filtered.slice(skip, skip + limit).map((r) => r.listing);
    return { listings, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ── DB sorts ───────────────────────────────────────────────────────────────
  const validDbSorts = ["scrapedAt", "price", "surface", "publicationDate", "rooms", "city"];
  const dbSort       = validDbSorts.includes(sortBy) ? sortBy : "scrapedAt";

  // Fetch extra to absorb outlier filtering
  const fetchLimit = Math.round(limit * 1.3);
  const [rawAll, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: { [dbSort]: sortOrder }, skip, take: fetchLimit }),
    prisma.listing.count({ where }),
  ]);

  const listings = rawAll.filter((l) => !isOutlier(l) && !isJunk(l)).slice(0, limit);
  return { listings, total, page, totalPages: Math.ceil(total / limit) };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`;
  if (n >= 1_000)     return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}
function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function ColHeader({ sp, col, label, className = "text-right" }: {
  sp: SearchParams; col: string; label: string; className?: string;
}) {
  const cur      = sp.sortBy ?? "scrapedAt";
  const ord      = sp.sortOrder ?? "desc";
  const isActive = cur === col;
  const params   = new URLSearchParams(sp as Record<string, string>);
  params.set("sortBy", col);
  params.set("sortOrder", isActive && ord === "desc" ? "asc" : "desc");
  params.set("page", "1");

  const Icon = isActive ? (ord === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <th className={`py-3 px-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
      <a
        href={`/?${params.toString()}`}
        className={`inline-flex items-center gap-1 transition-colors
          ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-700"}`}
      >
        {label}
        <Icon className="size-3 opacity-70" />
      </a>
    </th>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function yieldBadge(y: number | null): { bg: string; text: string } | null {
  if (y === null) return null;
  if (y >= 6)  return { bg: "#dcfce7", text: "#15803d" };
  if (y >= 4)  return { bg: "#fef9c3", text: "#a16207" };
  return            { bg: "#fee2e2", text: "#dc2626" };
}

function ppm2Style(vsMkt: number | null): { color: string; label: string } {
  if (vsMkt === null) return { color: "#64748b", label: "" };
  if (vsMkt >= 15)    return { color: "#ef4444", label: `+${vsMkt}%` };
  if (vsMkt >= 5)     return { color: "#f97316", label: `+${vsMkt}%` };
  if (vsMkt <= -10)   return { color: "#16a34a", label: `${vsMkt}%` };
  if (vsMkt <= -5)    return { color: "#65a30d", label: `${vsMkt}%` };
  return                     { color: "#0f172a", label: vsMkt !== 0 ? `${vsMkt > 0 ? "+" : ""}${vsMkt}%` : "" };
}

function daysStyle(d: number): { color: string; dot: string } {
  if (d > 365) return { color: "#ef4444", dot: "#ef4444" };
  if (d > 90)  return { color: "#f97316", dot: "#f97316" };
  if (d > 30)  return { color: "#f59e0b", dot: "#f59e0b" };
  return              { color: "#22c55e", dot: "#22c55e" };
}

const SOURCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pap:      { bg: "#f0fdf4", text: "#15803d", label: "PAP" },
  bienici:  { bg: "#eff6ff", text: "#1d4ed8", label: "Bien'ici" },
  castorus: { bg: "#fff7ed", text: "#c2410c", label: "Castorus" },
};

const DPE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#00b050", text: "#fff" }, B: { bg: "#92d050", text: "#000" },
  C: { bg: "#d4e600", text: "#000" }, D: { bg: "#ffc000", text: "#000" },
  E: { bg: "#ff9900", text: "#fff" }, F: { bg: "#ff4500", text: "#fff" },
  G: { bg: "#c00000", text: "#fff" },
};

const TYPE_ABBR: Record<string, string> = {
  APPARTEMENT: "Apt.", MAISON: "Maison", IMMEUBLE: "Immeuble",
  LOCAL_COMMERCIAL: "Local", AUTRE: "Autre",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp          = await searchParams;
  const investParams = parseInvestParams(sp);
  const { listings, total, page, totalPages } = await getListings(sp);

  type RowMeta = {
    pricePerSqm: number | null;
    grossYield:  number | null;
    daysOnMarket: number;
    vsMkt:        number | null;
  };

  const rows = listings.map((l) => {
    const pricePerSqm  = l.surface ? Math.round(l.price / l.surface) : null;
    const grossYield   = estimateGrossYield(l);
    const dateRef      = l.publicationDate ?? l.scrapedAt;
    const daysOnMarket = Math.max(0, Math.floor((Date.now() - new Date(dateRef).getTime()) / 86_400_000));
    const mkt          = l.surface ? marketPricePerSqm(l.zipcode, l.propertyType) : null;
    const vsMkt        = pricePerSqm && mkt ? Math.round(((pricePerSqm - mkt) / mkt) * 100) : null;
    return { listing: l, meta: { pricePerSqm, grossYield, daysOnMarket, vsMkt } satisfies RowMeta };
  });

  const buildUrl = (p: number) => {
    const params = new URLSearchParams(sp as Record<string, string>);
    params.set("page", String(p));
    return `/?${params.toString()}`;
  };

  const activeFilterCount = [
    sp.city, sp.zipcode, sp.source, sp.propertyType, sp.priceMin, sp.priceMax,
    sp.surfaceMin, sp.surfaceMax, sp.rooms, sp.yieldMin, sp.sinceHours,
    sp.construction, sp.statut,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col bg-slate-50" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 shrink-0">
        <Suspense>
          <ListingFilters />
        </Suspense>
      </div>

      {/* ── Results header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-2 shrink-0 flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-900">{total.toLocaleString("fr-FR")}</span>
          <span className="text-sm text-slate-500">annonce{total > 1 ? "s" : ""}</span>
          {(sp.city || sp.zipcode) && (
            <span className="text-sm text-slate-400">· {sp.city || sp.zipcode}</span>
          )}
          {activeFilterCount > 0 && (
            <span className="ml-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
              {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {totalPages > 1 && (
          <span className="text-xs text-slate-400 ml-auto">
            Page <b className="text-slate-600">{page}</b> / {totalPages}
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <MapPin className="size-7 text-slate-400" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-700">Aucune annonce trouvée</p>
              <p className="text-sm text-slate-400 mt-1">Modifiez vos filtres ou lancez un scraping</p>
            </div>
            <Link href="/" className="text-sm text-blue-600 hover:underline font-medium">
              Réinitialiser les filtres
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
              <tr className="border-b-2 border-slate-200">
                <ColHeader sp={sp} col="price"           label="Prix"     className="text-right pl-5" />
                <th className="py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-right">
                  <span className="text-slate-400">Rdt</span>
                </th>
                <ColHeader sp={sp} col="scrapedAt"       label="Annonce"  className="text-left" />
                <ColHeader sp={sp} col="rooms"           label="Pcs · M²" className="text-center hidden sm:table-cell" />
                <ColHeader sp={sp} col="publicationDate" label="Ancienneté" className="text-right hidden lg:table-cell" />
                <ColHeader sp={sp} col="pricePerSqm"     label="€/m²"     className="text-right hidden md:table-cell" />
                <ColHeader sp={sp} col="scrapedAt"       label="Vu le"    className="text-right hidden xl:table-cell" />
                <th className="py-3 px-3 w-9 text-[10px] font-bold uppercase tracking-wider text-center text-slate-400">DPE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ listing: l, meta: m }, i) => {
                const badge      = yieldBadge(m.grossYield);
                const ppm2Style_ = ppm2Style(m.vsMkt);
                const days_      = daysStyle(m.daysOnMarket);
                const src        = SOURCE_STYLE[l.source] ?? { bg: "#f1f5f9", text: "#475569", label: l.source };
                const dpe        = l.dpe && DPE_COLORS[l.dpe] ? DPE_COLORS[l.dpe] : null;

                return (
                  <ListingTableRow key={l.id} id={l.id} even={i % 2 === 0}>

                    {/* Prix */}
                    <td className="py-3 px-3 pl-5 text-right whitespace-nowrap">
                      <span className="font-black text-slate-900 text-[15px] tabular-nums">
                        {fmtPrice(l.price)}
                      </span>
                    </td>

                    {/* Rendement badge */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {badge ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-black tabular-nums"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {m.grossYield!.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-200 text-xs">—</span>
                      )}
                    </td>

                    {/* Annonce (title + city) */}
                    <td className="py-3 px-3 max-w-xs">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-blue-700 hover:text-blue-900 truncate leading-snug">
                              {l.title}
                            </span>
                            {l.bienNeuf && (
                              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">Neuf</span>
                            )}
                            {l.venduLoue && (
                              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">Loué</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: src.bg, color: src.text }}
                            >
                              {src.label}
                            </span>
                            <span className="text-xs text-slate-400 truncate">
                              {l.city}
                              {l.zipcode && <span className="ml-1 text-slate-300">({l.zipcode})</span>}
                            </span>
                            {l.lat && l.lng && <MapPin className="size-3 text-orange-400 shrink-0" />}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Pcs · M² */}
                    <td className="py-3 px-3 text-center hidden sm:table-cell">
                      <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap">
                        {l.rooms ? <>{l.rooms} <span className="text-slate-300">·</span> </> : ""}
                        {l.surface ? <>{l.surface} m²</> : <span className="text-slate-300">—</span>}
                      </span>
                    </td>

                    {/* Ancienneté */}
                    <td className="py-3 px-3 text-right hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: days_.dot }}
                        />
                        <span className="text-xs font-medium tabular-nums" style={{ color: days_.color }}>
                          {m.daysOnMarket === 0 ? "Auj." : `${m.daysOnMarket} j.`}
                        </span>
                      </div>
                    </td>

                    {/* €/m² + vs marché */}
                    <td className="py-3 px-3 text-right hidden md:table-cell">
                      {m.pricePerSqm ? (
                        <div className="flex flex-col items-end">
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color: ppm2Style_.color }}
                          >
                            {fmt(m.pricePerSqm)} €
                          </span>
                          {ppm2Style_.label && (
                            <span className="text-[10px] font-semibold tabular-nums" style={{ color: ppm2Style_.color }}>
                              {ppm2Style_.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>

                    {/* Vu le */}
                    <td className="py-3 px-3 text-right hidden xl:table-cell">
                      <span className="text-xs text-slate-400 tabular-nums">
                        {l.scrapedAt.toLocaleDateString("fr-FR")}
                      </span>
                    </td>

                    {/* DPE */}
                    <td className="py-3 px-2 text-center">
                      {dpe ? (
                        <span
                          className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded-md"
                          style={{ background: dpe.bg, color: dpe.text }}
                        >
                          {l.dpe}
                        </span>
                      ) : (
                        <span className="text-slate-100 text-xs">·</span>
                      )}
                    </td>

                  </ListingTableRow>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-8 border-t border-slate-200 bg-white">
            {page > 2 && (
              <a href={buildUrl(1)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
                ← 1
              </a>
            )}
            {page > 1 && (
              <a href={buildUrl(page - 1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                ← Précédent
              </a>
            )}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <a key={p} href={buildUrl(p)}
                    className={`size-9 flex items-center justify-center rounded-xl text-sm font-medium transition-all
                      ${p === page
                        ? "bg-blue-600 text-white font-bold shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"}`}>
                    {p}
                  </a>
                );
              })}
            </div>
            {page < totalPages && (
              <a href={buildUrl(page + 1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                Suivant →
              </a>
            )}
            {page < totalPages - 1 && (
              <a href={buildUrl(totalPages)}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
                {totalPages} →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
