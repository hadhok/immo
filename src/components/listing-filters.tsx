"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, X, Search, ChevronDown } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "MAISON", label: "Maison" },
  { value: "IMMEUBLE", label: "Immeuble" },
  { value: "TERRAIN", label: "Terrain" },
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
];

const BUDGET_MAX_OPTIONS = [
  { value: "100000", label: "100 000 €" },
  { value: "150000", label: "150 000 €" },
  { value: "200000", label: "200 000 €" },
  { value: "250000", label: "250 000 €" },
  { value: "300000", label: "300 000 €" },
  { value: "400000", label: "400 000 €" },
  { value: "500000", label: "500 000 €" },
  { value: "750000", label: "750 000 €" },
  { value: "1000000", label: "1 000 000 €" },
];

const SURFACE_MIN_OPTIONS = [
  { value: "20", label: "20 m²" },
  { value: "30", label: "30 m²" },
  { value: "40", label: "40 m²" },
  { value: "50", label: "50 m²" },
  { value: "60", label: "60 m²" },
  { value: "80", label: "80 m²" },
  { value: "100", label: "100 m²" },
  { value: "150", label: "150 m²" },
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
  { value: "cashflow:desc", label: "Meilleur cash flow" },
  { value: "cashflow:asc", label: "Pire cash flow" },
  { value: "price:asc", label: "Prix croissant" },
  { value: "price:desc", label: "Prix décroissant" },
  { value: "surface:desc", label: "Surface décroissante" },
];

const SECONDARY_KEYS = ["source", "construction", "statut", "sinceHours"];

const pillClass = "h-9 rounded-full border border-border bg-white hover:border-primary/40 hover:bg-accent/30 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 px-4 whitespace-nowrap data-placeholder:text-muted-foreground [&_svg:last-child]:text-muted-foreground";

export function ListingFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [showSecondary, setShowSecondary] = useState(false);

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.set("page", "1");
      router.push(`/?${params.toString()}`);
    },
    [router, sp]
  );

  const reset = () => router.push("/");
  const hasFilters = Array.from(sp.keys()).some((k) => k !== "page" && k !== "sortBy" && k !== "sortOrder");
  const activeSecondary = SECONDARY_KEYS.filter((k) => sp.has(k)).length;
  const sortValue = `${sp.get("sortBy") || "scrapedAt"}:${sp.get("sortOrder") || "desc"}`;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? "Plus récentes";

  return (
    <div className="space-y-2">
      {/* Primary row */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Ville, code postal…"
            defaultValue={sp.get("city") || ""}
            className="h-9 w-full rounded-full border border-border bg-white pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground"
            onChange={(e) => update("city", e.target.value || null)}
          />
        </div>

        {/* Type */}
        <Select value={sp.get("propertyType") || ""} onValueChange={(v) => update("propertyType", v || null)}>
          <SelectTrigger className={pillClass}>
            <SelectValue placeholder="Type de bien" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="">Tous types</SelectItem>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Budget max */}
        <Select value={sp.get("priceMax") || ""} onValueChange={(v) => update("priceMax", v || null)}>
          <SelectTrigger className={pillClass}>
            <SelectValue placeholder="Budget max" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="">Tous budgets</SelectItem>
            {BUDGET_MAX_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Surface min */}
        <Select value={sp.get("surfaceMin") || ""} onValueChange={(v) => update("surfaceMin", v || null)}>
          <SelectTrigger className={pillClass}>
            <SelectValue placeholder="Surface min" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="">Toutes surfaces</SelectItem>
            {SURFACE_MIN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Secondary filters toggle */}
        <button
          onClick={() => setShowSecondary((v) => !v)}
          className={`h-9 rounded-full border text-sm font-medium px-4 flex items-center gap-2 transition-colors ${
            showSecondary || activeSecondary > 0
              ? "border-primary bg-accent/40 text-primary"
              : "border-border bg-white hover:border-primary/40 hover:bg-accent/30 text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
          Filtres
          {activeSecondary > 0 && (
            <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{activeSecondary}</span>
          )}
          <ChevronDown className={`size-3.5 transition-transform ${showSecondary ? "rotate-180" : ""}`} />
        </button>

        {/* Sort — pushed right */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {hasFilters && (
            <button
              onClick={reset}
              className="h-9 rounded-full border border-border bg-white text-sm text-muted-foreground px-3 flex items-center gap-1.5 hover:text-destructive hover:border-destructive/40 transition-colors"
            >
              <X className="size-3.5" />
              Réinitialiser
            </button>
          )}
          <Select
            value={sortValue}
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
            <SelectTrigger className={`${pillClass} min-w-[170px]`}>
              <span className="flex-1 text-left">{sortLabel}</span>
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Secondary row */}
      {showSecondary && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60">

          <Select value={sp.get("source") || ""} onValueChange={(v) => update("source", v || null)}>
            <SelectTrigger className={pillClass}>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="">Toutes sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sp.get("construction") || ""} onValueChange={(v) => update("construction", v || null)}>
            <SelectTrigger className={pillClass}>
              <SelectValue placeholder="Construction" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="">Ancien + Neuf</SelectItem>
              {CONSTRUCTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sp.get("statut") || ""} onValueChange={(v) => update("statut", v || null)}>
            <SelectTrigger className={pillClass}>
              <SelectValue placeholder="Occupation" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="">Tous</SelectItem>
              {STATUT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sp.get("sinceHours") || ""} onValueChange={(v) => update("sinceHours", v || null)}>
            <SelectTrigger className={pillClass}>
              <SelectValue placeholder="Nouveautés" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="">Toutes</SelectItem>
              {SINCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
