"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "MAISON", label: "Maison" },
  { value: "IMMEUBLE", label: "Immeuble" },
  { value: "TERRAIN", label: "Terrain" },
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
];

const SOURCES = [
  { value: "pap", label: "PAP" },
  { value: "bienici", label: "Bien'ici" },
  { value: "seloger", label: "SeLoger" },
  { value: "leboncoin", label: "LeBonCoin" },
];

const CONSTRUCTION_OPTIONS = [
  { value: "ancien", label: "Ancien" },
  { value: "neuf", label: "Neuf" },
];

const STATUT_OPTIONS = [
  { value: "libre", label: "Libre" },
  { value: "loue", label: "Vendu loué" },
];

const SINCE_OPTIONS = [
  { value: "24", label: "24h" },
  { value: "48", label: "48h" },
  { value: "168", label: "7 jours" },
];

const SORT_OPTIONS = [
  { value: "scrapedAt:desc", label: "Plus récentes" },
  { value: "cashflow:desc", label: "Cash flow (meilleur)" },
  { value: "cashflow:asc", label: "Cash flow (pire)" },
  { value: "price:asc", label: "Prix croissant" },
  { value: "price:desc", label: "Prix décroissant" },
  { value: "surface:desc", label: "Surface décroissante" },
];

export function ListingFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(sp.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1");
      router.push(`/?${params.toString()}`);
    },
    [router, sp]
  );

  const reset = () => router.push("/");

  const hasFilters = Array.from(sp.keys()).some((k) => k !== "page");

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Filtres</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1">
            <X className="size-3" /> Réinitialiser
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Ville / CP</Label>
          <Input
            placeholder="Bordeaux, 33000…"
            defaultValue={sp.get("city") || ""}
            className="h-8 text-sm"
            onChange={(e) => update("city", e.target.value || null)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={sp.get("propertyType") || ""} onValueChange={(v) => update("propertyType", v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous types</SelectItem>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Prix max (€)</Label>
          <Input
            type="number"
            placeholder="500 000"
            defaultValue={sp.get("priceMax") || ""}
            className="h-8 text-sm"
            onChange={(e) => update("priceMax", e.target.value || null)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Surface min (m²)</Label>
          <Input
            type="number"
            placeholder="40"
            defaultValue={sp.get("surfaceMin") || ""}
            className="h-8 text-sm"
            onChange={(e) => update("surfaceMin", e.target.value || null)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <Select value={sp.get("source") || ""} onValueChange={(v) => update("source", v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Construction</Label>
          <Select value={sp.get("construction") || ""} onValueChange={(v) => update("construction", v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Ancien + Neuf</SelectItem>
              {CONSTRUCTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Occupation</Label>
          <Select value={sp.get("statut") || ""} onValueChange={(v) => update("statut", v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {STATUT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Nouvelles annonces</Label>
          <Select value={sp.get("sinceHours") || ""} onValueChange={(v) => update("sinceHours", v || null)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {SINCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1 border-t">
        <Label className="text-xs text-muted-foreground">Trier par</Label>
        <Select
          value={`${sp.get("sortBy") || "scrapedAt"}:${sp.get("sortOrder") || "desc"}`}
          onValueChange={(v) => {
            if (!v) return;
            const [sortBy = "scrapedAt", sortOrder = "desc"] = v.split(":");
            const params = new URLSearchParams(sp.toString());
            params.set("sortBy", sortBy);
            params.set("sortOrder", sortOrder);
            params.set("page", "1");
            router.push(`/?${params.toString()}`);
          }}
        >
          <SelectTrigger className="h-8 text-sm w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
