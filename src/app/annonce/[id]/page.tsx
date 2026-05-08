import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Calculator } from "@/components/calculator";
import { CreditTable } from "@/components/annonce/credit-table";
import { InvestCard } from "@/components/annonce/invest-card";
import {
  ArrowLeft, ExternalLink, MapPin, Home, Layers, Calendar,
  Building2, TreePine, Store, Warehouse,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}
function fmtPrice(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k€`;
  return `${fmt(n)} €`;
}

const SOURCE_LABELS: Record<string, string> = {
  pap: "PAP", bienici: "Bien'ici", castorus: "Castorus",
};
const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appartement", MAISON: "Maison", IMMEUBLE: "Immeuble",
  TERRAIN: "Terrain", LOCAL_COMMERCIAL: "Local commercial", AUTRE: "Autre",
};
const TYPE_ICONS: Record<string, React.ElementType> = {
  APPARTEMENT: Building2, MAISON: Home, IMMEUBLE: Warehouse,
  TERRAIN: TreePine, LOCAL_COMMERCIAL: Store, AUTRE: Home,
};
const DPE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#00b050", text: "#fff" }, B: { bg: "#92d050", text: "#000" },
  C: { bg: "#d4e600", text: "#000" }, D: { bg: "#ffc000", text: "#000" },
  E: { bg: "#ff9900", text: "#fff" }, F: { bg: "#ff4500", text: "#fff" },
  G: { bg: "#c00000", text: "#fff" },
};

// ─── Notaire fees ─────────────────────────────────────────────────────────────

function calcEmoluments(net: number) {
  let em = 0, r = net;
  if (r > 60000) { em += (r - 60000) * 0.00814; r = 60000; }
  if (r > 17000) { em += (r - 17000) * 0.01085; r = 17000; }
  if (r > 6500)  { em += (r - 6500)  * 0.01627; r = 6500;  }
  em += r * 0.03945;
  return Math.round(em * 1.2);
}

function calcNotaire(prixAffiche: number, hasAgence: boolean, bienNeuf: boolean) {
  const honorairesAgence = hasAgence ? Math.round(prixAffiche * 0.05) : 0;
  const netVendeur = prixAffiche - honorairesAgence;
  const emoluments = calcEmoluments(netVendeur);
  // DMTO Gironde : 5.8066% + CSI 0.10% = 5.9066% ; neuf : 0.715% + CSI = 0.815%
  const droits = bienNeuf ? Math.round(netVendeur * 0.00815) : Math.round(netVendeur * 0.059066);
  const formalites = 1350;
  const totalNotaire = emoluments + droits + formalites;
  return { honorairesAgence, netVendeur, emoluments, droits, formalites, totalNotaire, coutTotal: prixAffiche + totalNotaire };
}

// ─── Market data (excluding 30%-below-average outliers) ───────────────────────

async function getMarketData(zipcode: string, propertyType: string, excludeId: string) {
  const rows = await prisma.listing.findMany({
    where: {
      isActive: true, zipcode, propertyType: propertyType as never,
      surface: { gt: 15 }, id: { not: excludeId },
      NOT: [{ title: { contains: "viager", mode: "insensitive" } }],
    },
    select: { price: true, surface: true },
    take: 300,
  });
  if (rows.length < 3) return null;
  const ppm2s = rows.map((r) => r.price / r.surface!);
  const prelim = ppm2s.reduce((a, b) => a + b, 0) / ppm2s.length;
  const valid = ppm2s.filter((p) => p >= prelim * 0.7);
  if (valid.length < 3) return null;
  return {
    avgPricePerSqm: Math.round(valid.reduce((a, b) => a + b, 0) / valid.length),
    count: valid.length,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) notFound();

  const [rentRef, market] = await Promise.all([
    listing.surface
      ? prisma.rentReference.findUnique({
          where: { zipcode_propertyType: { zipcode: listing.zipcode, propertyType: listing.propertyType } },
        })
      : null,
    getMarketData(listing.zipcode, listing.propertyType, listing.id),
  ]);

  const pricePerSqm = listing.surface ? Math.round(listing.price / listing.surface) : null;
  const loyerEstime = rentRef && listing.surface ? Math.round(listing.surface * rentRef.avgRentPerSqm) : undefined;
  const hasAgence = listing.source !== "pap";
  const notaire = calcNotaire(listing.price, hasAgence, listing.bienNeuf ?? false);

  const vsMarche =
    pricePerSqm && market
      ? Math.round(((pricePerSqm - market.avgPricePerSqm) / market.avgPricePerSqm) * 100)
      : null;

  const dateRef = listing.publicationDate ?? listing.scrapedAt;
  const daysOnMarket = Math.max(0, Math.floor((Date.now() - new Date(dateRef).getTime()) / 86_400_000));

  const TypeIcon = TYPE_ICONS[listing.propertyType] ?? Home;
  const sourceLabel = SOURCE_LABELS[listing.source] ?? listing.source;

  // Top bar market color
  const marcheBarColor =
    vsMarche === null ? "#94a3b8"
    : vsMarche >= 10  ? "#f87171"   // red — above market
    : vsMarche <= -10 ? "#4ade80"   // green — below market
    : "#fbbf24";                    // orange — around market

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky top bar ──────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-[#1e2d45] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-4 overflow-x-auto scrollbar-hide text-sm">

          <Link href="/" className="shrink-0 text-white/40 hover:text-white transition-colors mr-1">
            <ArrowLeft className="size-4" />
          </Link>

          <span className="font-black text-base shrink-0">{fmtPrice(listing.price)}</span>

          {(listing.rooms || listing.surface) && (
            <span className="text-white/50 shrink-0">
              {listing.rooms ? `T${listing.rooms}` : ""}
              {listing.surface ? ` · ${listing.surface} m²` : ""}
            </span>
          )}

          <span className="flex items-center gap-1 text-white/50 shrink-0">
            <MapPin className="size-3 text-white/30" />
            {listing.city} {listing.zipcode}
          </span>

          {vsMarche !== null && (
            <span className="font-bold shrink-0 px-2 py-0.5 rounded text-xs" style={{ background: marcheBarColor + "30", color: marcheBarColor }}>
              {vsMarche > 0 ? "+" : ""}{vsMarche}% vs marché
            </span>
          )}

          <span className="text-white/40 shrink-0">{daysOnMarket}j sur le marché</span>

          {pricePerSqm && (
            <span className="text-white/40 shrink-0">{fmt(pricePerSqm)} €/m²</span>
          )}

          <a
            href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-white/40 hover:text-white transition-colors shrink-0 text-xs"
          >
            <ExternalLink className="size-3.5" />
            {sourceLabel}
          </a>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left column: photos + info + finance ────────────────────── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Photos */}
            {listing.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative col-span-2 h-64 rounded-xl overflow-hidden">
                  <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" unoptimized />
                </div>
                {listing.photos.slice(1, 5).map((photo, i) => (
                  <div key={i} className="relative h-32 rounded-xl overflow-hidden">
                    <Image src={photo} alt={`Photo ${i + 2}`} fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-52 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
                <TypeIcon className="size-12 opacity-30" />
                <span className="text-xs font-semibold uppercase tracking-wider opacity-50">
                  {TYPE_LABELS[listing.propertyType]}
                </span>
              </div>
            )}

            {/* Property info card */}
            <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
              {/* Title */}
              <h1 className="font-bold text-base leading-snug">{listing.title}</h1>

              {/* Badges row */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {TYPE_LABELS[listing.propertyType]}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {sourceLabel}
                </span>
                {listing.bienNeuf && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Neuf</span>
                )}
                {listing.venduLoue && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Loué</span>
                )}
                {listing.dpe && DPE_COLORS[listing.dpe] && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: DPE_COLORS[listing.dpe].bg, color: DPE_COLORS[listing.dpe].text }}
                  >
                    DPE {listing.dpe}{listing.ges ? ` · GES ${listing.ges}` : ""}
                  </span>
                )}
              </div>

              {/* Specs */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {listing.surface && (
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-slate-400" />
                    {listing.surface} m²
                  </span>
                )}
                {listing.rooms && (
                  <span className="flex items-center gap-1.5">
                    <Home className="size-3.5 text-slate-400" />
                    {listing.rooms} pièce{listing.rooms > 1 ? "s" : ""}
                    {listing.bedrooms ? ` · ${listing.bedrooms} ch.` : ""}
                  </span>
                )}
                {listing.floor !== null && (
                  <span>Ét. {listing.floor}{listing.totalFloors ? `/${listing.totalFloors}` : ""}</span>
                )}
              </div>

              {/* Location + date */}
              <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {listing.address ? `${listing.address}, ` : ""}{listing.city} ({listing.zipcode})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {listing.publicationDate?.toLocaleDateString("fr-FR") ?? listing.scrapedAt.toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Charges if available */}
              {(listing.chargesMensuelles || listing.taxeFonciere) && (
                <div className="flex gap-2 pt-1 border-t">
                  {listing.chargesMensuelles && (
                    <div className="flex-1 bg-slate-50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Charges copro</p>
                      <p className="text-sm font-semibold">{fmt(listing.chargesMensuelles)} €/mois</p>
                    </div>
                  )}
                  {listing.taxeFonciere && (
                    <div className="flex-1 bg-slate-50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Taxe foncière</p>
                      <p className="text-sm font-semibold">{fmt(listing.taxeFonciere)} €/an</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-[12]">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Finance details */}
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Coût d&apos;acquisition</h3>

              <div className="border-l-[3px] border-orange-400 pl-3 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix affiché (FAI)</span>
                  <span className="font-medium">{fmt(listing.price)} €</span>
                </div>
                {hasAgence && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Honoraires agence (~5%)</span>
                    <span className="text-muted-foreground">-{fmt(notaire.honorairesAgence)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t">
                  <span>Prix net vendeur</span>
                  <span className="text-orange-600">{fmt(notaire.netVendeur)} €</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frais de notaire</span>
                  <span className="font-medium">+{fmt(notaire.totalNotaire)} €</span>
                </div>
                <div className="pl-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Émoluments</span><span>{fmt(notaire.emoluments)} €</span></div>
                  <div className="flex justify-between"><span>Droits & taxes</span><span>{fmt(notaire.droits)} €</span></div>
                  <div className="flex justify-between"><span>Formalités</span><span>{fmt(notaire.formalites)} €</span></div>
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t">
                <span className="text-sm font-bold">Coût total acquisition</span>
                <span className="text-xl font-black text-orange-600">{fmt(notaire.coutTotal)} €</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                * Frais de notaire sur prix net vendeur. Honoraires agence estimés à 5%.
              </p>
            </div>
          </div>

          {/* ── Right column: invest card (sticky) + credit table ────────── */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-28 lg:self-start">

            {/* Investment card — first thing visible */}
            <InvestCard
              price={listing.price}
              surface={listing.surface}
              zipcode={listing.zipcode}
              propertyType={listing.propertyType}
              pricePerSqm={pricePerSqm}
              vsMarche={vsMarche}
              marketAvgPricePerSqm={market?.avgPricePerSqm ?? null}
              marketCount={market?.count ?? null}
              loyerEstime={loyerEstime}
              realRentPerSqm={rentRef?.avgRentPerSqm ?? null}
            />

            {/* Credit simulation */}
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <CreditTable capital={notaire.coutTotal} />
            </div>

            {/* Full calculator (collapsible via details) */}
            <details className="bg-white rounded-xl border shadow-sm overflow-hidden group">
              <summary className="p-4 cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors select-none list-none flex items-center justify-between">
                Simulation locative détaillée
                <span className="text-slate-400 group-open:rotate-180 transition-transform inline-block">▾</span>
              </summary>
              <div className="px-4 pb-4 border-t pt-3">
                {loyerEstime && (
                  <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700">
                    Loyer de référence : <b>{fmt(loyerEstime)} €/mois</b>
                    {rentRef && <span className="opacity-70 ml-1">({rentRef.avgRentPerSqm} €/m²)</span>}
                  </div>
                )}
                <Calculator
                  prixAffiche={listing.price}
                  surface={listing.surface ?? undefined}
                  zipcode={listing.zipcode}
                  propertyType={listing.propertyType}
                  chargesMensuelles={listing.chargesMensuelles}
                  taxeFonciere={listing.taxeFonciere}
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
