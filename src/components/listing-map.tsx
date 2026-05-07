"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/generated/prisma/client";
import { estimateCashFlow, estimatePricePerSqm } from "@/lib/estimates";

interface Props {
  listings: Listing[];
}

function formatPriceShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M €`;
  return `${Math.round(n / 1000)}k €`;
}

function formatPriceFull(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function cfColor(cf: number | null): string {
  if (cf === null) return "#6b7280";
  if (cf > 0) return "#16a34a";
  if (cf > -300) return "#f97316";
  return "#dc2626";
}

const DPE_BG: Record<string, string> = {
  A: "#00b050", B: "#92d050", C: "#cccc00",
  D: "#ffc000", E: "#ff9900", F: "#ff0000", G: "#7030a0",
};

export function ListingMap({ listings }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    (async () => {
      const L = await import("leaflet");

      if (!mapRef.current || mapInstanceRef.current) return;

      // @ts-expect-error leaflet icon workaround
      delete L.Icon.Default.prototype._getIconUrl;

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([44.837789, -0.57918], 10);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Charger markercluster APRÈS leaflet (il a besoin de L dans le scope)
      let markerLayer: L.LayerGroup;
      try {
        await import("leaflet.markercluster");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasCluster = typeof (L as any).markerClusterGroup === "function";
        if (hasCluster) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          markerLayer = (L as any).markerClusterGroup({
            maxClusterRadius: 60,
            showCoverageOnHover: false,
            iconCreateFunction: (cluster: { getChildCount: () => number }) => {
              const n = cluster.getChildCount();
              return L.divIcon({
                className: "",
                html: `<div style="background:#1d4ed8;color:#fff;padding:5px 12px;border-radius:16px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff">${n} biens</div>`,
                iconSize: [80, 30],
                iconAnchor: [40, 30],
              });
            },
          });
        } else {
          markerLayer = L.layerGroup();
        }
      } catch {
        markerLayer = L.layerGroup();
      }

      const now = Date.now();

      listings.forEach((listing) => {
        if (!listing.lat || !listing.lng) return;

        const cf = estimateCashFlow(listing);
        const priceSqm = estimatePricePerSqm(listing);
        const color = cfColor(cf);
        const label = formatPriceShort(listing.price);
        const scrapedMs = new Date(listing.scrapedAt as unknown as string).getTime();
        const isNew = now - scrapedMs < 86_400_000;

        const pillH = isNew ? 46 : 28;
        const markerHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            ${isNew ? `<div style="background:#1d4ed8;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;letter-spacing:.5px">NOUVEAU</div>` : ""}
            <div style="background:${color};color:#fff;padding:4px 9px;border-radius:14px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff">${label}</div>
          </div>`;

        const icon = L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [72, pillH],
          iconAnchor: [36, pillH],
        });

        const dpeHtml = listing.dpe
          ? `<span style="background:${DPE_BG[listing.dpe] ?? "#999"};color:${["A","B","C"].includes(listing.dpe) ? "#000" : "#fff"};padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700">DPE ${listing.dpe}</span>`
          : "";

        const cfHtml =
          cf !== null
            ? `<div style="color:${color};font-weight:700;font-size:13px;margin-top:4px">${cf >= 0 ? "+" : ""}${cf.toLocaleString("fr-FR")} €/mois <span style="font-size:11px;font-weight:400;color:#6b7280">(estimé)</span></div>`
            : "";

        const marker = L.marker([listing.lat, listing.lng], { icon });
        marker.bindPopup(
          `<div style="font-family:system-ui,sans-serif;min-width:220px;max-width:260px;line-height:1.5">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;line-height:1.3">${listing.title}</div>
            <div style="font-size:17px;font-weight:800">${formatPriceFull(listing.price)}</div>
            ${priceSqm ? `<div style="font-size:12px;color:#6b7280">${priceSqm.toLocaleString("fr-FR")} €/m²</div>` : ""}
            ${listing.surface ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${listing.surface} m²${listing.rooms ? ` · ${listing.rooms} pièces` : ""}</div>` : ""}
            <div style="margin-top:6px">${dpeHtml}</div>
            ${cfHtml}
            <a href="/annonce/${listing.id}" style="display:inline-block;margin-top:10px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;text-decoration:none">Voir l'annonce →</a>
          </div>`,
          { maxWidth: 280, minWidth: 220 }
        );

        markerLayer.addLayer(marker);
      });

      map.addLayer(markerLayer);
    })();

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
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}
