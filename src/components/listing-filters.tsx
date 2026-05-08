"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X, TrendingUp, Settings2, Zap, Clock, Lock, DoorOpen, Sparkles } from "lucide-react";
import { useInvestParams } from "@/components/invest-context";

const PROPERTY_TYPES = [
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "MAISON",      label: "Maison" },
  { value: "IMMEUBLE",    label: "Immeuble" },
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
];
const SURFACE_OPTIONS = [20, 30, 40, 50, 60, 80, 100, 150, 200];
const ROOMS_OPTIONS   = [1, 2, 3, 4, 5, 6];
const PRICE_OPTIONS   = [
  { v: "50000",   l: "50 k€" },  { v: "75000",   l: "75 k€" },
  { v: "100000",  l: "100 k€" }, { v: "150000",  l: "150 k€" },
  { v: "200000",  l: "200 k€" }, { v: "250000",  l: "250 k€" },
  { v: "300000",  l: "300 k€" }, { v: "400000",  l: "400 k€" },
  { v: "500000",  l: "500 k€" }, { v: "750000",  l: "750 k€" },
  { v: "1000000", l: "1 M€" },   { v: "1500000", l: "1,5 M€" },
];
const SOURCES = [
  { v: "",         l: "Toutes sources" },
  { v: "pap",      l: "PAP" },
  { v: "bienici",  l: "Bien'ici" },
  { v: "castorus", l: "Castorus" },
];
const STORAGE_KEY = "immo33_invest_params";

function loadInvestLocal() {
  if (typeof window === "undefined") return { apport: "20", taux: "3.5", duree: "20" };
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s) as { apport: string; taux: string; duree: string };
  } catch { /* noop */ }
  return { apport: "20", taux: "3.5", duree: "20" };
}

const sel = "h-8 border border-slate-200 bg-white rounded-lg text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 cursor-pointer px-2 text-slate-700 transition-colors hover:border-slate-300";

export function ListingFilters() {
  const router = useRouter();
  const sp     = useSearchParams();
  const { setParams: setInvestParams } = useInvestParams();

  const [location,    setLocation]    = useState(sp.get("city") || sp.get("zipcode") || "");
  const [source,      setSource]      = useState(sp.get("source") || "");
  const [propertyType,setPropertyType]= useState(sp.get("propertyType") || "");
  const [surfaceMin,  setSurfaceMin]  = useState(sp.get("surfaceMin") || "");
  const [surfaceMax,  setSurfaceMax]  = useState(sp.get("surfaceMax") || "");
  const [roomsMin,    setRoomsMin]    = useState(sp.get("rooms") || "");
  const [priceMin,    setPriceMin]    = useState(sp.get("priceMin") || "");
  const [priceMax,    setPriceMax]    = useState(sp.get("priceMax") || "");

  const [bonRendement, setBonRendement] = useState(sp.has("yieldMin"));
  const [nouveautes,   setNouveautes]   = useState(sp.has("sinceHours"));
  const [neuf,         setNeuf]         = useState(sp.get("construction") === "neuf");
  const [loue,         setLoue]         = useState(sp.get("statut") === "loue");
  const [libre,        setLibre]        = useState(sp.get("statut") === "libre");

  const [showInvest,  setShowInvest]  = useState(false);
  const [investLocal, setInvestLocal] = useState(() => loadInvestLocal());

  // Core search function — accepts overrides for instant-apply toggles
  const searchWith = useCallback((overrides: Partial<{
    bonRendement: boolean; nouveautes: boolean; neuf: boolean; loue: boolean; libre: boolean;
  }> = {}) => {
    const params = new URLSearchParams();
    if (sp.get("sortBy"))    params.set("sortBy",    sp.get("sortBy")!);
    if (sp.get("sortOrder")) params.set("sortOrder", sp.get("sortOrder")!);

    const loc = location.trim();
    if (loc) {
      if (/^\d{4,5}$/.test(loc)) params.set("zipcode", loc);
      else params.set("city", loc);
    }
    if (source)       params.set("source",       source);
    if (propertyType) params.set("propertyType", propertyType);
    if (surfaceMin)   params.set("surfaceMin",   surfaceMin);
    if (surfaceMax)   params.set("surfaceMax",   surfaceMax);
    if (roomsMin)     params.set("rooms",        roomsMin);
    if (priceMin)     params.set("priceMin",     priceMin);
    if (priceMax)     params.set("priceMax",     priceMax);

    const eff = {
      bonRendement: "bonRendement" in overrides ? overrides.bonRendement! : bonRendement,
      nouveautes:   "nouveautes"   in overrides ? overrides.nouveautes!   : nouveautes,
      neuf:         "neuf"         in overrides ? overrides.neuf!         : neuf,
      loue:         "loue"         in overrides ? overrides.loue!         : loue,
      libre:        "libre"        in overrides ? overrides.libre!        : libre,
    };

    if (eff.bonRendement) params.set("yieldMin",     "5.5");
    if (eff.nouveautes)   params.set("sinceHours",   "48");
    if (eff.neuf)         params.set("construction", "neuf");
    if (eff.loue)         params.set("statut",       "loue");
    else if (eff.libre)   params.set("statut",       "libre");

    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }, [location, source, propertyType, surfaceMin, surfaceMax, roomsMin, priceMin, priceMax,
      bonRendement, nouveautes, neuf, loue, libre, sp, router]);

  const search = useCallback(() => searchWith(), [searchWith]);

  const reset = () => {
    setLocation(""); setSource(""); setPropertyType("");
    setSurfaceMin(""); setSurfaceMax(""); setRoomsMin("");
    setPriceMin(""); setPriceMax("");
    setLoue(false); setLibre(false); setNeuf(false);
    setBonRendement(false); setNouveautes(false);
    router.push("/");
  };

  const applyInvest = () => {
    const parsed = {
      apport: parseFloat(investLocal.apport) || 20,
      taux:   parseFloat(investLocal.taux)   || 3.5,
      duree:  parseInt(investLocal.duree, 10) || 20,
    };
    setInvestParams(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(investLocal));
    setShowInvest(false);
  };

  const hasFilters = !!(location || source || propertyType || surfaceMin || surfaceMax ||
    roomsMin || priceMin || priceMax || loue || libre || neuf || bonRendement || nouveautes);

  // ── Quick filter pill ──────────────────────────────────────────────────
  const Pill = ({
    icon: Icon, label, active, onClick,
  }: { icon?: React.ElementType; label: string; active: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none
        ${active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
        }`}
    >
      {Icon && <Icon className="size-3" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-2.5">

      {/* ── Main filter bar ───────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-0 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">

        {/* OÙ ? */}
        <div className="px-4 py-2.5 border-r border-slate-200 min-w-[220px] flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1.5">Où ?</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Ville ou code postal"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="w-full pl-7 pr-6 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-700"
              />
              {location && (
                <button
                  onClick={() => setLocation("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={sel + " shrink-0"}>
              {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>

        {/* QUOI ? */}
        <div className="px-4 py-2.5 border-r border-slate-200 flex-1 flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1.5">Quoi ?</p>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={sel}>
              <option value="">Type de bien</option>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Surface</span>
              <select value={surfaceMin} onChange={(e) => setSurfaceMin(e.target.value)} className={sel}>
                <option value="">min</option>
                {SURFACE_OPTIONS.map((v) => <option key={v} value={String(v)}>{v}</option>)}
              </select>
              <select value={surfaceMax} onChange={(e) => setSurfaceMax(e.target.value)} className={sel}>
                <option value="">max</option>
                {SURFACE_OPTIONS.map((v) => <option key={v} value={String(v)}>{v}</option>)}
              </select>
              <span className="text-slate-400">m²</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Pièces</span>
              <select value={roomsMin} onChange={(e) => setRoomsMin(e.target.value)} className={sel}>
                <option value="">min</option>
                {ROOMS_OPTIONS.map((v) => <option key={v} value={String(v)}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* COMBIEN ? */}
        <div className="px-4 py-2.5 border-r border-slate-200 flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1.5">Combien ?</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Prix</span>
            <select value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className={sel}>
              <option value="">min</option>
              {PRICE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className={sel}>
              <option value="">max</option>
              {PRICE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-stretch">
          {hasFilters && (
            <button
              onClick={reset}
              title="Réinitialiser tous les filtres"
              className="px-3 border-r border-slate-200 text-slate-350 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            onClick={() => setShowInvest((v) => !v)}
            title="Paramètres de financement"
            className={`px-3.5 border-r border-slate-200 flex items-center gap-1.5 text-xs font-semibold transition-colors
              ${showInvest ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50"}`}
          >
            <TrendingUp className="size-3.5" />
            <span className="hidden sm:inline">Invest.</span>
          </button>
          <button
            onClick={search}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 font-bold text-sm transition-colors flex items-center gap-2"
          >
            <Search className="size-3.5" />
            <span>Rechercher</span>
          </button>
        </div>
      </div>

      {/* ── Quick filter pills ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filtres</span>
        <div className="w-px h-3 bg-slate-200 shrink-0" />
        <Pill icon={Zap}      label="Bon rendement ≥5,5%" active={bonRendement}
          onClick={() => { const n = !bonRendement; setBonRendement(n); searchWith({ bonRendement: n }); }} />
        <Pill icon={Clock}    label="Nouveautés 48h"       active={nouveautes}
          onClick={() => { const n = !nouveautes;   setNouveautes(n);   searchWith({ nouveautes: n }); }} />
        <Pill icon={Lock}     label="Actuellement loué"    active={loue}
          onClick={() => { const nl=!loue; setLoue(nl); if(nl) setLibre(false); searchWith({ loue: nl, libre: nl ? false : libre }); }} />
        <Pill icon={DoorOpen} label="Libre"                active={libre}
          onClick={() => { const nl=!libre; setLibre(nl); if(nl) setLoue(false); searchWith({ libre: nl, loue: nl ? false : loue }); }} />
        <Pill icon={Sparkles} label="Neuf"                 active={neuf}
          onClick={() => { const n = !neuf; setNeuf(n); searchWith({ neuf: n }); }} />
      </div>

      {/* ── Invest params panel ───────────────────────────────────────────── */}
      {showInvest && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <Settings2 className="size-4" />
              Paramètres crédit
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Apport</span>
              <select
                value={investLocal.apport}
                onChange={(e) => setInvestLocal((p) => ({ ...p, apport: e.target.value }))}
                className="h-8 rounded-lg border border-emerald-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500"
              >
                {[5,10,15,20,25,30,40,50].map((v) => <option key={v} value={String(v)}>{v}%</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Taux</span>
              <input
                type="number" min={0.5} max={10} step={0.05}
                value={investLocal.taux}
                onChange={(e) => setInvestLocal((p) => ({ ...p, taux: e.target.value }))}
                className="h-8 w-16 rounded-lg border border-emerald-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500 text-center"
              />
              <span className="text-slate-400 -ml-1">%</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Durée</span>
              <select
                value={investLocal.duree}
                onChange={(e) => setInvestLocal((p) => ({ ...p, duree: e.target.value }))}
                className="h-8 rounded-lg border border-emerald-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500"
              >
                {[10,15,20,25,30].map((v) => <option key={v} value={String(v)}>{v} ans</option>)}
              </select>
            </div>
            <button
              onClick={applyInvest}
              className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 transition-colors ml-auto"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
