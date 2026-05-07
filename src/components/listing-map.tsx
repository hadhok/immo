"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/generated/prisma/client";
import { estimateCashFlow, estimatePricePerSqm } from "@/lib/estimates";

interface Props {
  listings: Listing[];
}

function formatPriceShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M €`;
  if (n >= 1000) return `${Math.round(n / 1000)}k €`;
  return `${n} €`;
}

function formatPriceFull(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function cfColor(cf: number | null): string {
  if (cf === null) return "#e8401c";
  if (cf > 0) return "#16a34a";
  if (cf > -300) return "#ea580c";
  return "#dc2626";
}

const DPE_BG: Record<string, string> = {
  A: "#00b050", B: "#92d050", C: "#cccc00",
  D: "#ffc000", E: "#ff9900", F: "#ff4500", G: "#c00000",
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

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        scrollWheelZoom: true,
      }).setView([44.837789, -0.57918], 10);

      mapInstanceRef.current = map;

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      let markerLayer: L.LayerGroup;
      try {
        await import("leaflet.markercluster");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasCluster = typeof (L as any).markerClusterGroup === "function";
        if (hasCluster) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          markerLayer = (L as any).markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: (cluster: { getChildCount: () => number }) => {
              const n = cluster.getChildCount();
              const size = n < 10 ? 36 : n < 100 ? 42 : 48;
              return L.divIcon({
                className: "",
                html: `<div style="width:${size}px;height:${size}px;background:#e8401c;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(232,64,28,.45);border:2.5px solid #fff">${n}</div>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
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
        const dotColor = cfColor(cf);
        const scrapedMs = new Date(listing.scrapedAt as unknown as string).getTime();
        const isNew = now - scrapedMs < 86_400_000;

        // Simple dot marker + price pill on hover (show price pill by default)
        const priceLabel = formatPriceShort(listing.price);
        const markerHtml = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="background:${dotColor};color:#fff;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.28);border:2px solid #fff;line-height:1.4">${priceLabel}</div>
            <div style="width:6px;height:6px;background:${dotColor};border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>
          </div>`;

        const icon = L.divIcon({
          className: "",
          html: markerHtml,
          iconSize: [70, 32],
          iconAnchor: [35, 32],
        });

        const dpeHtml = listing.dpe
          ? `<span style="background:${DPE_BG[listing.dpe] ?? "#999"};color:${["A","B","C"].includes(listing.dpe) ? "#000" : "#fff"};padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">DPE ${listing.dpe}</span>`
          : "";

        const cfHtml = cf !== null
          ? `<div style="font-weight:700;font-size:13px;color:${dotColor};margin-top:4px">${cf >= 0 ? "+" : ""}${cf.toLocaleString("fr-FR")} €/m <span style="font-weight:400;font-size:11px;color:#6b7280">(estimé)</span></div>`
          : "";

        const badgesHtml = [
          isNew ? `<span style="background:#2563eb;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">NOUVEAU</span>` : "",
          listing.bienNeuf ? `<span style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">NEUF</span>` : "",
          listing.venduLoue ? `<span style="background:#d97706;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">LOUÉ</span>` : "",
        ].filter(Boolean).join(" ");

        const marker = L.marker([listing.lat, listing.lng], { icon });
        marker.bindPopup(
          `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:240px;line-height:1.5">
            ${badgesHtml ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">${badgesHtml}</div>` : ""}
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;line-height:1.3;color:#111">${listing.title}</div>
            <div style="font-size:18px;font-weight:900;color:#111">${formatPriceFull(listing.price)}</div>
            ${priceSqm ? `<div style="font-size:12px;color:#6b7280;margin-top:1px">${priceSqm.toLocaleString("fr-FR")} €/m²</div>` : ""}
            ${listing.surface ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${listing.surface} m²${listing.rooms ? ` · ${listing.rooms} pièces` : ""}</div>` : ""}
            ${dpeHtml ? `<div style="margin-top:6px">${dpeHtml}</div>` : ""}
            ${cfHtml}
            <a href="/annonce/${listing.id}" style="display:block;margin-top:12px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:8px;text-decoration:none;text-align:center">Voir l'annonce →</a>
          </div>`,
          { maxWidth: 260, minWidth: 240 }
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
