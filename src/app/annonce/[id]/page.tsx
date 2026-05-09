import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Calculator } from "@/components/calculator";
import { CreditTable } from "@/components/annonce/credit-table";
import { InvestCard } from "@/components/annonce/invest-card";
import { AnnonceHeader } from "@/components/annonce/annonce-nav";
import {
  MapPin, Home, Layers, Calendar,
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
  const droits = bienNeuf ? Math.round(netVendeur * 0.00815) : Math.round(netVendeur * 0.059066);
  const formalites = 1350;
  const totalNotaire = emoluments + droits + formalites;
  return { honorairesAgence, netVendeur, emoluments, droits, formalites, totalNotaire, coutTotal: prixAffiche + totalNotaire };
}

// ─── Market data ──────────────────────────────────────────────────────────────

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

  const subtitle = [
    listing.rooms ? `T${listing.rooms}` : null,
    listing.surface ? `${listing.surface} m²` : null,
    `${listing.city} ${listing.zipcode}`,
    pricePerSqm ? `${fmt(pricePerSqm)} €/m²` : null,
    daysOnMarket > 0 ? `${daysOnMarket}j` : "Auj.",
  ].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Unified sticky header (price bar + tabs) ────────────────────── */}
      <AnnonceHeader
        price={fmtPrice(listing.price)}
        subtitle={subtitle}
        vsMarche={vsMarche}
        sourceUrl={listing.sourceUrl}
        sourceLabel={sourceLabel}
      />

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ══ SYNTHÈSE ════════════════════════════════════════════════════ */}
        <section id="synthese" className="scroll-mt-[170px]">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Photos */}
            <div className="lg:col-span-3">
              {listing.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative col-span-2 h-72 rounded-xl overflow-hidden">
                    <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" unoptimized />
                  </div>
                  {listing.photos.slice(1, 5).map((photo, i) => (
                    <div key={i} className="relative h-36 rounded-xl overflow-hidden">
                      <Image src={photo} alt={`Photo ${i + 2}`} fill className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
                  <TypeIcon className="size-16 opacity-20" />
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-50">
                    {TYPE_LABELS[listing.propertyType]}
                  </span>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">

              {/* Price — hero */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{fmtPrice(listing.price)}</span>
                {vsMarche !== null && (
                  <span className="text-sm font-bold px-2 py-0.5 rounded-md"
                    style={{
                      background: (vsMarche >= 10 ? "#fef2f2" : vsMarche <= -10 ? "#f0fdf4" : "#fffbeb"),
                      color:      (vsMarche >= 10 ? "#dc2626" : vsMarche <= -10 ? "#16a34a" : "#d97706"),
                    }}>
                    {vsMarche > 0 ? "+" : ""}{vsMarche}% marché
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="font-semibold text-base leading-snug text-slate-600 -mt-2">{listing.title}</h1>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {TYPE_LABELS[listing.propertyType]}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                  {sourceLabel}
                </span>
                {listing.bienNeuf && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Neuf</span>
                )}
                {listing.venduLoue && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Loué</span>
                )}
                {listing.dpe && DPE_COLORS[listing.dpe] && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: DPE_COLORS[listing.dpe].bg, color: DPE_COLORS[listing.dpe].text }}>
                    DPE {listing.dpe}{listing.ges ? ` · GES ${listing.ges}` : ""}
                  </span>
                )}
              </div>

              {/* Key specs grid */}
              <div className="grid grid-cols-2 gap-2">
                {listing.surface && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Surface</p>
                    <p className="font-bold text-slate-800">{listing.surface} m²</p>
                  </div>
                )}
                {listing.rooms && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Pièces</p>
                    <p className="font-bold text-slate-800">
                      {listing.rooms} p.{listing.bedrooms ? ` · ${listing.bedrooms} ch.` : ""}
                    </p>
                  </div>
                )}
                {pricePerSqm && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Prix / m²</p>
                    <p className="font-bold text-slate-800">{fmt(pricePerSqm)} €</p>
                  </div>
                )}
                {listing.floor !== null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Étage</p>
                    <p className="font-bold text-slate-800">
                      {listing.floor}{listing.totalFloors ? `/${listing.totalFloors}` : ""}
                    </p>
                  </div>
                )}
                {listing.chargesMensuelles && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Charges copro</p>
                    <p className="font-bold text-slate-800">{fmt(listing.chargesMensuelles)} €/mois</p>
                  </div>
                )}
                {listing.taxeFonciere && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Taxe foncière</p>
                    <p className="font-bold text-slate-800">{fmt(listing.taxeFonciere)} €/an</p>
                  </div>
                )}
              </div>

              {/* Location + date */}
              <div className="mt-auto pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-400">
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" />
                  {listing.address ? `${listing.address}, ` : ""}{listing.city} ({listing.zipcode})
                </p>
                <p className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 shrink-0" />
                  {listing.publicationDate?.toLocaleDateString("fr-FR") ?? listing.scrapedAt.toLocaleDateString("fr-FR")}
                  {daysOnMarket > 0 && <span className="text-slate-300">· {daysOnMarket}j sur le marché</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Description</p>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed line-clamp-6">
                {listing.description}
              </p>
              <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-3 transition-colors">
                Lire l&apos;annonce complète →
              </a>
            </div>
          )}
        </section>

        {/* ══ INVEST. ═════════════════════════════════════════════════════ */}
        <section id="invest" className="scroll-mt-[170px]">
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
        </section>

        {/* ══ FINANCE ═════════════════════════════════════════════════════ */}
        <section id="finance" className="scroll-mt-[170px]">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Acquisition cost */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Coût d&apos;acquisition</p>

              <div className="space-y-2 pb-4 border-b border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Prix affiché (FAI)</span>
                  <span className="font-semibold">{fmt(listing.price)} €</span>
                </div>
                {hasAgence && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">dont honoraires agence (~5%)</span>
                    <span className="text-slate-400">−{fmt(notaire.honorairesAgence)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Prix net vendeur</span>
                  <span className="text-orange-600">{fmt(notaire.netVendeur)} €</span>
                </div>
              </div>

              <div className="space-y-2 py-4 border-b border-slate-100">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Frais de notaire</span>
                  <span>+{fmt(notaire.totalNotaire)} €</span>
                </div>
                <div className="pl-3 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between"><span>Émoluments</span><span>{fmt(notaire.emoluments)} €</span></div>
                  <div className="flex justify-between"><span>Droits & taxes (DMTO + CSI)</span><span>{fmt(notaire.droits)} €</span></div>
                  <div className="flex justify-between"><span>Formalités / débours</span><span>{fmt(notaire.formalites)} €</span></div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <span className="text-sm font-bold text-slate-800">Coût total acquisition</span>
                <span className="text-2xl font-black text-orange-600">{fmt(notaire.coutTotal)} €</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                * Honoraires agence estimés à 5% (source {sourceLabel}). DMTO Gironde 5.8066% + CSI 0.10%.
              </p>
            </div>

            {/* Credit simulation */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Simulation crédit</p>
              <CreditTable capital={notaire.coutTotal} />
            </div>
          </div>
        </section>

        {/* ══ SIMULATION ══════════════════════════════════════════════════ */}
        <section id="simulation" className="scroll-mt-[170px]">

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            {loyerEstime && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700 flex items-center justify-between">
                <span>Loyer de référence ANIL 2025</span>
                <span className="font-bold">
                  {fmt(loyerEstime)} €/mois
                  {rentRef && <span className="font-normal opacity-70 ml-1">({rentRef.avgRentPerSqm} €/m²)</span>}
                </span>
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
        </section>

      </div>
    </div>
  );
}
