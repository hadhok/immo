import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ListingFilters } from "@/components/listing-filters";
import { ListingCard } from "@/components/listing-card";
import { ListingMap } from "@/components/listing-map";
import { Skeleton } from "@/components/ui/skeleton";
import type { PropertyType } from "@/types/listing";

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
}

async function getListings(sp: SearchParams) {
  const page = parseInt(sp.page || "1", 10);
  const limit = 24;
  const skip = (page - 1) * limit;

  const where: Parameters<typeof prisma.listing.findMany>[0]["where"] = { isActive: true };

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

  if (sp.sinceHours) {
    const since = new Date();
    since.setHours(since.getHours() - parseInt(sp.sinceHours, 10));
    where.scrapedAt = { gte: since };
  }

  const validSorts = ["scrapedAt", "price", "surface", "publicationDate"];
  const sortBy = validSorts.includes(sp.sortBy || "") ? sp.sortBy! : "scrapedAt";
  const sortOrder = sp.sortOrder === "asc" ? "asc" : "desc";

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: limit }),
    prisma.listing.count({ where }),
  ]);

  return { listings, total, page, totalPages: Math.ceil(total / limit) };
}

async function getRentReferences() {
  const refs = await prisma.rentReference.findMany();
  return Object.fromEntries(refs.map((r) => [`${r.zipcode}:${r.propertyType}`, r.avgRentPerSqm]));
}

// Récupère les annonces avec coordonnées pour la carte (limite à 500)
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
  const [{ listings, total, page, totalPages }, rentRefs, mapListings] = await Promise.all([
    getListings(sp),
    getRentReferences(),
    getMapListings(),
  ]);

  // Map zipcode -> loyer m² moyen (tous types confondus, on prend APPARTEMENT par défaut)
  const rentPerSqmMap = Object.fromEntries(
    Object.entries(rentRefs)
      .filter(([k]) => k.endsWith(":APPARTEMENT"))
      .map(([k, v]) => [k.split(":")[0], v])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <Suspense>
        <ListingFilters />
      </Suspense>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span><b>{total}</b> annonce{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}</span>
        <span>Page {page} / {totalPages || 1}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste */}
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">Aucune annonce trouvée</p>
              <p className="text-sm mt-1">Lancez une mise à jour depuis la page Sources</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  rentPerSqm={rentPerSqmMap[listing.zipcode]}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Suspense>
              <PaginationBar page={page} totalPages={totalPages} sp={sp} />
            </Suspense>
          )}
        </div>

        {/* Carte */}
        <div className="h-[600px] lg:sticky lg:top-20">
          <Suspense fallback={<Skeleton className="w-full h-full rounded-lg" />}>
            <ListingMap listings={mapListings} rentPerSqmMap={rentPerSqmMap} />
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
    <div className="flex items-center justify-center gap-2 pt-4">
      {page > 1 && (
        <a href={buildUrl(page - 1)} className="px-3 py-1.5 border rounded text-sm hover:bg-muted">
          ← Précédent
        </a>
      )}
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <a href={buildUrl(page + 1)} className="px-3 py-1.5 border rounded text-sm hover:bg-muted">
          Suivant →
        </a>
      )}
    </div>
  );
}
