import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Calculator } from "@/components/calculator";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, MapPin, Home, Layers, Calendar, Thermometer } from "lucide-react";

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const SOURCE_LABELS: Record<string, string> = {
  pap: "PAP",
  seloger: "SeLoger",
  leboncoin: "LeBonCoin",
};

const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appartement",
  MAISON: "Maison",
  IMMEUBLE: "Immeuble",
  TERRAIN: "Terrain",
  LOCAL_COMMERCIAL: "Local commercial",
  AUTRE: "Autre",
};

const DPE_COLORS: Record<string, string> = {
  A: "bg-green-600",
  B: "bg-green-400",
  C: "bg-lime-400",
  D: "bg-yellow-400",
  E: "bg-orange-400",
  F: "bg-orange-600",
  G: "bg-red-600",
};

export default async function AnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) notFound();

  const rentRef = listing.surface
    ? await prisma.rentReference.findUnique({
        where: {
          zipcode_propertyType: {
            zipcode: listing.zipcode,
            propertyType: listing.propertyType,
          },
        },
      })
    : null;

  const loyerEstime = rentRef && listing.surface
    ? Math.round(listing.surface * rentRef.avgRentPerSqm)
    : undefined;

  const pricePerSqm = listing.surface ? Math.round(listing.price / listing.surface) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" />
        Retour aux annonces
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-4">
          {/* Galerie photos */}
          {listing.photos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative h-72 sm:h-80 rounded-lg overflow-hidden sm:col-span-2">
                <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" unoptimized />
              </div>
              {listing.photos.slice(1, 5).map((photo, i) => (
                <div key={i} className="relative h-40 rounded-lg overflow-hidden">
                  <Image src={photo} alt={`Photo ${i + 2}`} fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
              <Home className="size-16 opacity-30" />
            </div>
          )}

          {/* En-tête */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{SOURCE_LABELS[listing.source] || listing.source}</Badge>
              <Badge variant="outline">{TYPE_LABELS[listing.propertyType]}</Badge>
              {listing.dpe && (
                <Badge className={`${DPE_COLORS[listing.dpe] || "bg-gray-400"} text-white`}>
                  <Thermometer className="size-3 mr-1" />
                  DPE {listing.dpe}
                  {listing.ges && ` / GES ${listing.ges}`}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <p className="text-3xl font-bold">{formatPrice(listing.price)}</p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {listing.surface && (
                <span className="flex items-center gap-1">
                  <Layers className="size-4" />
                  {listing.surface} m²
                  {pricePerSqm && <span className="text-xs">({formatPrice(pricePerSqm)}/m²)</span>}
                </span>
              )}
              {listing.rooms && (
                <span className="flex items-center gap-1">
                  <Home className="size-4" />
                  {listing.rooms} pièce{listing.rooms > 1 ? "s" : ""}
                  {listing.bedrooms && ` dont ${listing.bedrooms} chambre${listing.bedrooms > 1 ? "s" : ""}`}
                </span>
              )}
              {listing.floor !== null && (
                <span>Étage {listing.floor}{listing.totalFloors ? `/${listing.totalFloors}` : ""}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {listing.address && `${listing.address}, `}{listing.city} ({listing.zipcode})
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                {listing.publicationDate
                  ? `Publié le ${listing.publicationDate.toLocaleDateString("fr-FR")}`
                  : `Ajouté le ${listing.scrapedAt.toLocaleDateString("fr-FR")}`}
              </div>
            </div>

            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              Voir l'annonce originale sur {SOURCE_LABELS[listing.source]}
            </a>
          </div>

          {/* Description */}
          {listing.description && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {listing.description}
                </p>
              </div>
            </>
          )}

          {/* Infos annexes */}
          {(listing.chargesMensuelles || listing.taxeFonciere) && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-2">Informations complémentaires</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {listing.chargesMensuelles && (
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Charges copro</p>
                      <p className="font-medium">{formatPrice(listing.chargesMensuelles)}/mois</p>
                    </div>
                  )}
                  {listing.taxeFonciere && (
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">Taxe foncière</p>
                      <p className="font-medium">{formatPrice(listing.taxeFonciere)}/an</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Calculateur */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="bg-card border rounded-lg p-4">
            <h2 className="font-semibold mb-4">Calculateur de rentabilité</h2>
            {loyerEstime && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                Loyer estimé : <b>{formatPrice(loyerEstime)}/mois</b>
                {rentRef && <span className="text-blue-500 ml-1">(réf. marché : {rentRef.avgRentPerSqm}€/m²)</span>}
              </div>
            )}
            <Calculator
              prixAffiche={listing.price}
              surface={listing.surface ?? undefined}
              loyerEstime={loyerEstime}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
