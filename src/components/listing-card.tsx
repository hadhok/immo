import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MapPin, Home, Layers, Calendar } from "lucide-react";
import type { Listing } from "@/generated/prisma/client";

interface Props {
  listing: Listing;
  rentPerSqm?: number;
}

function rentabiliteColor(pct: number) {
  if (pct >= 7) return "text-green-600 bg-green-50";
  if (pct >= 5) return "text-orange-500 bg-orange-50";
  return "text-red-500 bg-red-50";
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function estimatedRentability(listing: Listing, rentPerSqm?: number): number | null {
  if (!listing.surface || !rentPerSqm) return null;
  const loyerAnnuel = listing.surface * rentPerSqm * 12;
  return (loyerAnnuel / listing.price) * 100;
}

const SOURCE_LABELS: Record<string, string> = {
  pap: "PAP",
  seloger: "SeLoger",
  leboncoin: "LeBonCoin",
};

const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appart.",
  MAISON: "Maison",
  IMMEUBLE: "Immeuble",
  TERRAIN: "Terrain",
  LOCAL_COMMERCIAL: "Local",
  AUTRE: "Autre",
};

export function ListingCard({ listing, rentPerSqm }: Props) {
  const rentability = estimatedRentability(listing, rentPerSqm);
  const photo = listing.photos[0];
  const daysAgo = Math.floor((Date.now() - listing.scrapedAt.getTime()) / 86400000);

  return (
    <Link href={`/annonce/${listing.id}`} className="block group">
      <article className="bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors hover:shadow-sm">
        <div className="relative h-44 bg-muted">
          {photo ? (
            <Image src={photo} alt={listing.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Home className="size-10 opacity-30" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            <Badge variant="secondary" className="text-xs font-medium">
              {SOURCE_LABELS[listing.source] || listing.source}
            </Badge>
            {listing.dpe && (
              <Badge variant="outline" className="text-xs bg-background/80">
                DPE {listing.dpe}
              </Badge>
            )}
          </div>
          {daysAgo === 0 && (
            <Badge className="absolute top-2 right-2 text-xs bg-primary">Nouveau</Badge>
          )}
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{listing.title}</h3>
            {rentability !== null && (
              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded shrink-0", rentabiliteColor(rentability))}>
                {rentability.toFixed(1)}%
              </span>
            )}
          </div>

          <p className="text-lg font-bold">{formatPrice(listing.price)}</p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {listing.surface && (
              <span className="flex items-center gap-1">
                <Layers className="size-3" />
                {listing.surface} m²
              </span>
            )}
            {listing.rooms && (
              <span>{listing.rooms} pièce{listing.rooms > 1 ? "s" : ""}</span>
            )}
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[listing.propertyType] || listing.propertyType}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {listing.city} ({listing.zipcode})
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {daysAgo === 0 ? "Aujourd'hui" : `${daysAgo}j`}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
