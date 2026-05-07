export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ListingFilters } from "@/components/listing-filters";
import { ListingCard } from "@/components/listing-card";
import { ListingMap } from "@/components/listing-map";
import { Skeleton } from "@/components/ui/skeleton";
import type { PropertyType } from "@/types/listing";
import { estimateCashFlow } from "@/lib/estimates";

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
}

async function getListings(sp: SearchParams) {
  const page = parseInt(sp.page || "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ListingWhereInput = { isActive: true };

  if (sp.city) where.city = { contains: sp.city, mode: "insensitive" };
  if (sp.zipcode) where.zipcode = { startsWith: sp.zipcode };
  if (sp.source) where.source = sp.source;
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
  else if (sp.construction === "ancien") where.bienNeuf = false;

  if (sp.statut === "loue") where.venduLoue = true;
  else if (sp.statut === "libre") where.venduLoue = false;

  if (sp.sinceHours) {
    const since = new Date();
    since.setHours(since.getHours() - parseInt(sp.sinceHours, 10));
    where.scrapedAt = { gte: since };
  }

  const sortOrder = sp.sortOrder === "asc" ? "asc" : "desc";

  if (sp.sortBy === "cashflow") {
    const all = await prisma.listing.findMany({ where, orderBy: { scrapedAt: "desc" } });
    const withCF = all.map((l) => ({ listing: l, cf: estimateCashFlow(l) ?? -999999 }));
    withCF.sort((a, b) => sortOrder === "asc" ? a.cf - b.cf : b.cf - a.cf);
    const total = withCF.length;
    const listings = withCF.slice(skip, skip + limit).map((x) => x.listing);
    return { listings, total, page, totalPages: Math.ceil(total / limit) };
  }

  const validSorts = ["scrapedAt", "price", "surface", "publicationDate"];
  const sortBy = validSorts.includes(sp.sortBy || "") ? sp.sortBy! : "scrapedAt";

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: limit }),
    prisma.listing.count({ where }),
  ]);

  return { listings, total, page, totalPages: Math.ceil(total / limit) };
}

async function getMapListings() {
  return prisma.listing.findMany({
    where: { isActive: true, lat: { not: null }, lng: { not: null } },
    take: 500,
    orderBy: { scrapedAt: "desc" },
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [{ listings, total, page, totalPages }, mapListings] = await Promise.all([
    getListings(sp),
    getMapListings(),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* Filter bar */}
      <div className="bg-white border-b border-border/60 px-5 py-3 shrink-0" style={{ boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
        <Suspense>
          <ListingFilters />
        </Suspense>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            <b className="text-foreground font-semibold">{total.toLocaleString("fr-FR")}</b>
            {" "}annonce{total > 1 ? "s" : ""}
            {mapListings.length > 0 && <span className="ml-1 text-muted-foreground/70">· {mapListings.length} sur la carte</span>}
          </span>
          {totalPages > 1 && <span>Page {page} / {totalPages}</span>}
        </div>
      </div>

      {/* Split: list | map */}
      <div className="flex flex-1 overflow-hidden">

        {/* Scrollable list */}
        <div className="w-full lg:w-[44%] overflow-y-auto scrollbar-hide">
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-20">
              <p className="text-lg font-semibold text-foreground">Aucune annonce trouvée</p>
              <p className="text-sm">Modifiez vos filtres ou lancez une mise à jour depuis Sources</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Suspense>
              <PaginationBar page={page} totalPages={totalPages} sp={sp} />
            </Suspense>
          )}
        </div>

        {/* Map */}
        <div className="hidden lg:block flex-1">
          <Suspense fallback={<Skeleton className="w-full h-full" />}>
            <ListingMap listings={mapListings} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  sp,
}: {
  page: number;
  totalPages: number;
  sp: SearchParams;
}) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams(sp as Record<string, string>);
    params.set("page", String(p));
    return `/?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-3 py-6 border-t border-border/60">
      {page > 1 && (
        <a href={buildUrl(page - 1)} className="px-5 py-2 border border-border rounded-full text-sm font-medium hover:border-primary hover:text-primary transition-colors">
          ← Précédent
        </a>
      )}
      <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
      {page < totalPages && (
        <a href={buildUrl(page + 1)} className="px-5 py-2 border border-border rounded-full text-sm font-medium hover:border-primary hover:text-primary transition-colors">
          Suivant →
        </a>
      )}
    </div>
  );
}
