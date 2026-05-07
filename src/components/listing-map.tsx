"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/generated/prisma/client";

interface Props {
  listings: Listing[];
  rentPerSqmMap?: Record<string, number>;
}

// Couleur du pin selon rentabilité
function pinColor(rentability: number | null): string {
  if (rentability === null) return "#6b7280";
  if (rentability >= 7) return "#16a34a";
  if (rentability >= 5) return "#f97316";
  return "#dc2626";
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ListingMap({ listings, rentPerSqmMap = {} }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Import dynamique Leaflet (SSR incompatible)
    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix icônes Leaflet avec webpack
      // @ts-expect-error leaflet icon workaround
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!).setView([44.837789, -0.57918], 10);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      listings.forEach((listing) => {
        if (!listing.lat || !listing.lng) return;

        const rentability = listing.surface && rentPerSqmMap[listing.zipcode]
          ? (listing.surface * rentPerSqmMap[listing.zipcode] * 12 / listing.price) * 100
          : null;

        const color = pinColor(rentability);

        const icon = L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const rentLabel = rentability !== null ? `<br/><b>${rentability.toFixed(1)}% brut</b>` : "";

        L.marker([listing.lat, listing.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:13px;min-width:180px">
              <b>${listing.title}</b><br/>
              ${formatPrice(listing.price)}${listing.surface ? ` · ${listing.surface} m²` : ""}${rentLabel}<br/>
              <a href="/annonce/${listing.id}" style="color:#2563eb">Voir l'annonce →</a>
            </div>`
          );
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </>
  );
}
