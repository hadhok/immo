"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, TrendingUp, Home, Building2, TreePine, Store, Warehouse } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";
import {
  estimateCashFlow,
  estimateGrossYield,
  estimatePricePerSqm,
  estimateMonthlyCredit,
} from "@/lib/estimates";
import { useInvestParams } from "@/components/invest-context";

interface Props {
  listing: Listing;
}

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("fr-FR", opts).format(n);
}
function fmtPrice(n: number) {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, { maximumFractionDigits: 2 })} M€`;
  if (n >= 1_000) return `${fmt(Math.round(n / 1_000))} k€`;
  return `${fmt(n)} €`;
}

const SOURCE_LABELS: Record<string, string> = {
  pap: "PAP",
  bienici: "Bien'ici",
  seloger: "SeLoger",
  leboncoin: "LBC",
  castorus: "Castorus",
};

const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appartement",
  MAISON: "Maison",
  IMMEUBLE: "Immeuble",
  TERRAIN: "Terrain",
  LOCAL_COMMERCIAL: "Local comm.",
  AUTRE: "Autre",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  APPARTEMENT: Building2,
  MAISON: Home,
  IMMEUBLE: Warehouse,
  TERRAIN: TreePine,
  LOCAL_COMMERCIAL: Store,
  AUTRE: Home,
};

// Placeholder gradient per property type
const TYPE_GRAD: Record<string, string> = {
  APPARTEMENT: "from-blue-50 to-indigo-100",
  MAISON: "from-emerald-50 to-teal-100",
  IMMEUBLE: "from-violet-50 to-purple-100",
  TERRAIN: "from-lime-50 to-green-100",
  LOCAL_COMMERCIAL: "from-orange-50 to-amber-100",
  AUTRE: "from-slate-50 to-gray-100",
};

const DPE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#00b050", text: "#fff" },
  B: { bg: "#92d050", text: "#000" },
  C: { bg: "#d4e600", text: "#000" },
  D: { bg: "#ffc000", text: "#000" },
  E: { bg: "#ff9900", text: "#fff" },
  F: { bg: "#ff4500", text: "#fff" },
  G: { bg: "#c00000", text: "#fff" },
};

function YieldBadge({ yield: y }: { yield: number }) {
  const color =
    y >= 6 ? { bg: "#dcfce7", text: "#15803d", border: "#86efac" }
    : y >= 4.5 ? { bg: "#fef9c3", text: "#a16207", border: "#fde047" }
    : { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" };
  return (
    <div
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold border shrink-0"
      style={{ background: color.bg, color: color.text, borderColor: color.border }}
    >
      <TrendingUp className="size-3.5" />
      {y.toFixed(1)}%
    </div>
  );
}

function CashFlowBadge({ cf }: { cf: number }) {
  const pos = cf > 0;
  const neutral = cf > -300 && cf <= 0;
  const color = pos
    ? { bg: "#f0fdf4", text: "#16a34a" }
    : neutral
    ? { bg: "#fff7ed", text: "#ea580c" }
    : { bg: "#fef2f2", text: "#dc2626" };
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: color.bg, color: color.text }}
    >
      {cf >= 0 ? "+" : ""}
      {fmt(cf)} €/m
    </span>
  );
}

export function ListingCard({ listing }: Props) {
  const { params: investParams } = useInvestParams();
  const cashFlow = estimateCashFlow(listing, investParams);
  const grossYield = estimateGrossYield(listing);
  const pricePerSqm = estimatePricePerSqm(listing);
  const monthlyCredit = estimateMonthlyCredit(listing.price, listing.propertyType, investParams);

  const photo = listing.photos?.[0];
  const TypeIcon = TYPE_ICONS[listing.propertyType] ?? Home;
  const typeGrad = TYPE_GRAD[listing.propertyType] ?? TYPE_GRAD.AUTRE;

  const scrapedMs = new Date(listing.scrapedAt).getTime();
  const hoursAgo = (Date.now() - scrapedMs) / 3_600_000;
  const isNew = hoursAgo < 24;
  const daysAgo = Math.floor(hoursAgo / 24);
  const dateLabel = isNew ? "Aujourd'hui" : daysAgo === 1 ? "Hier" : `${daysAgo}j`;

  // Yield-based left border color
  const yieldBorder =
    grossYield === null ? "#e2e8f0"
    : grossYield >= 6 ? "#22c55e"
    : grossYield >= 4.5 ? "#f59e0b"
    : "#f87171";

  return (
    <Link href={`/annonce/${listing.id}`} className="block group">
      <article
        className="bg-white rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-px"
        style={{
          boxShadow: "0 1px 3px rgba(0,0,0,.08)",
          borderLeft: `3px solid ${yieldBorder}`,
        }}
      >
        <div className="flex h-[148px]">

          {/* Photo / Placeholder */}
          <div className={`relative w-[175px] shrink-0 bg-gradient-to-br ${typeGrad}`}>
            {photo ? (
              <Image
                src={photo}
                alt={listing.title}
                fill
                loading="eager"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                <TypeIcon className="size-8" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {TYPE_LABELS[listing.propertyType]}
                </span>
              </div>
            )}

            {/* Badges overlay */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5 gap-1">
              {isNew && (
                <span className="bg-[#e8401c] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
                  Nouveau
                </span>
              )}
              <div className="flex flex-col gap-0.5 ml-auto">
                {listing.bienNeuf && (
                  <span className="bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">NEUF</span>
                )}
                {listing.venduLoue && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">LOUÉ</span>
                )}
              </div>
            </div>

            {/* DPE bottom-left */}
            {listing.dpe && DPE_COLORS[listing.dpe] && (
              <div
                className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm"
                style={{ background: DPE_COLORS[listing.dpe].bg, color: DPE_COLORS[listing.dpe].text }}
              >
                DPE {listing.dpe}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 min-w-0 px-3.5 py-2.5">

            {/* Row 1: price + yield */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[18px] font-black text-foreground leading-none tracking-tight">
                    {fmtPrice(listing.price)}
                  </span>
                  {pricePerSqm && (
                    <span className="text-[11px] text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded">
                      {fmt(pricePerSqm)} €/m²
                    </span>
                  )}
                </div>
              </div>
              {grossYield !== null && <YieldBadge yield={grossYield} />}
            </div>

            {/* Row 2: type + specs */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-semibold text-foreground/80">
                {TYPE_LABELS[listing.propertyType] ?? listing.propertyType}
              </span>
              {(listing.rooms || listing.surface) && (
                <span className="text-xs text-muted-foreground">
                  {[
                    listing.rooms && `${listing.rooms}p`,
                    listing.bedrooms && `${listing.bedrooms}ch`,
                    listing.surface && `${listing.surface} m²`,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            {/* Row 3: mensualité + cashflow */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground">
                ~{fmtPrice(monthlyCredit)}/mois
              </span>
              {cashFlow !== null && <CashFlowBadge cf={cashFlow} />}
            </div>

            {/* Row 4: location + meta — pushed to bottom */}
            <div className="mt-auto flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate min-w-0">
                <MapPin className="size-3 shrink-0 text-primary/60" />
                <span className="truncate">
                  {listing.city}
                  {listing.zipcode ? ` ${listing.zipcode}` : ""}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground/70 shrink-0 font-medium">
                {dateLabel} · {SOURCE_LABELS[listing.source] ?? listing.source}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
