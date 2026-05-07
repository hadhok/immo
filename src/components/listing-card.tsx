import Link from "next/link";
import Image from "next/image";
import { MapPin, Home } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";
import { estimateCashFlow, estimatePricePerSqm, estimateMonthlyCredit } from "@/lib/estimates";

interface Props {
  listing: Listing;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const SOURCE_LABELS: Record<string, string> = {
  pap: "PAP",
  bienici: "Bien'ici",
  seloger: "SeLoger",
  leboncoin: "LBCoin",
};

const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appartement",
  MAISON: "Maison",
  IMMEUBLE: "Immeuble",
  TERRAIN: "Terrain",
  LOCAL_COMMERCIAL: "Local commercial",
  AUTRE: "Autre",
};

const DPE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#00b050", text: "#fff" },
  B: { bg: "#92d050", text: "#000" },
  C: { bg: "#d4e600", text: "#000" },
  D: { bg: "#ffc000", text: "#000" },
  E: { bg: "#ff9900", text: "#000" },
  F: { bg: "#ff4500", text: "#fff" },
  G: { bg: "#c00000", text: "#fff" },
};

export function ListingCard({ listing }: Props) {
  const cashFlow = estimateCashFlow(listing);
  const pricePerSqm = estimatePricePerSqm(listing);
  const monthlyCredit = estimateMonthlyCredit(listing.price);
  const photo = listing.photos[0];

  const scrapedMs = new Date(listing.scrapedAt).getTime();
  const hoursAgo = (Date.now() - scrapedMs) / 3_600_000;
  const isNew = hoursAgo < 24;
  const daysAgo = Math.floor(hoursAgo / 24);

  const cfPositive = cashFlow !== null && cashFlow > 0;
  const cfNeutral = cashFlow !== null && cashFlow > -300 && cashFlow <= 0;

  return (
    <Link href={`/annonce/${listing.id}`} className="block group">
      <article
        className="bg-white rounded-xl overflow-hidden transition-all duration-200 group-hover:card-shadow-hover"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)" }}
      >
        <div className="flex h-[152px]">

          {/* Photo */}
          <div className="relative w-[190px] shrink-0 bg-muted">
            {photo ? (
              <Image
                src={photo}
                alt={listing.title}
                fill
                loading="eager"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Home className="size-10 opacity-25" />
              </div>
            )}

            {/* "Nouveau" badge */}
            {isNew && (
              <div className="absolute top-2 left-2 bg-[#e8401c] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
                Nouveau
              </div>
            )}

            {/* DPE badge */}
            {listing.dpe && DPE_COLORS[listing.dpe] && (
              <div
                className="absolute bottom-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm"
                style={{ background: DPE_COLORS[listing.dpe].bg, color: DPE_COLORS[listing.dpe].text }}
              >
                DPE {listing.dpe}
              </div>
            )}

            {/* Neuf / Loué badge */}
            {(listing.bienNeuf || listing.venduLoue) && (
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {listing.bienNeuf && (
                  <span className="bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">NEUF</span>
                )}
                {listing.venduLoue && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">LOUÉ</span>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 min-w-0 px-4 py-3">

            {/* Top: price + cash flow */}
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[17px] font-extrabold text-foreground leading-none">{formatPrice(listing.price)}</span>
                  {pricePerSqm && (
                    <span className="text-xs text-muted-foreground font-medium">{pricePerSqm.toLocaleString("fr-FR")} €/m²</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ~{formatPrice(monthlyCredit)}/mois · 20% apport · 20 ans
                </p>
              </div>

              {/* Cash flow badge */}
              {cashFlow !== null && (
                <span
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap"
                  style={{
                    background: cfPositive ? "#dcfce7" : cfNeutral ? "#fff7ed" : "#fee2e2",
                    color: cfPositive ? "#16a34a" : cfNeutral ? "#ea580c" : "#dc2626",
                  }}
                >
                  {cashFlow >= 0 ? "+" : ""}{cashFlow.toLocaleString("fr-FR")} €/m
                </span>
              )}
            </div>

            {/* Type label */}
            <p className="text-sm font-semibold text-foreground mt-1 leading-tight">
              {TYPE_LABELS[listing.propertyType] || listing.propertyType}
              {listing.bienNeuf ? " neuf" : ""} à vendre
            </p>

            {/* Characteristics */}
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {[
                listing.rooms && `${listing.rooms} pièce${listing.rooms > 1 ? "s" : ""}`,
                listing.bedrooms && `${listing.bedrooms} ch.`,
                listing.surface && `${listing.surface} m²`,
              ].filter(Boolean).join(" · ")}
            </p>

            {/* Location + meta */}
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{listing.city}{listing.zipcode ? ` (${listing.zipcode})` : ""}</span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {isNew ? "Aujourd'hui" : daysAgo === 1 ? "Hier" : `${daysAgo}j`} · {SOURCE_LABELS[listing.source] || listing.source}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
