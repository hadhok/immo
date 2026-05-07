"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { calculate, type CalculatorInput } from "@/lib/calculator";
import { estimateRent } from "@/lib/estimates";
import { ChevronDown, ChevronUp, Save } from "lucide-react";

type FieldSource = "estimate" | "listing" | "user";

interface Props {
  prixAffiche: number;
  surface?: number;
  zipcode?: string;
  propertyType?: string;
  chargesMensuelles?: number | null;
  taxeFonciere?: number | null;
  loyerEstime?: number; // legacy, ignoré si zipcode+surface présents
}

// ─── Financing defaults (localStorage) ─────────────────────────────────────

const LS_KEY = "immo-fin-defaults";
const HARD_DEFAULTS = { apportRatio: 0.20, tauxInteret: 3.5, dureeAns: 20, assuranceEmprunteur: 0.10 };

function loadFinDefaults() {
  if (typeof window === "undefined") return HARD_DEFAULTS;
  try { return { ...HARD_DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") }; }
  catch { return HARD_DEFAULTS; }
}

function saveFinDefaults(d: typeof HARD_DEFAULTS) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch { /* noop */ }
}

// ─── Source badge ────────────────────────────────────────────────────────────

function SourceBadge({ src }: { src: FieldSource }) {
  if (src === "listing") return (
    <span className="inline-block text-[9px] font-semibold tracking-wide px-1 py-px rounded bg-sky-100 text-sky-700 leading-none">ANNONCE</span>
  );
  if (src === "estimate") return (
    <span className="inline-block text-[9px] font-semibold tracking-wide px-1 py-px rounded bg-amber-100 text-amber-700 leading-none">ESTIMÉ</span>
  );
  return null;
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({
  label, value, onChange, suffix = "€", min = 0, step = 1, source, className,
}: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; step?: number;
  source?: FieldSource; className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        {label}
        {source && <SourceBadge src={source} />}
      </Label>
      <div className="relative">
        <Input
          type="number" value={value} min={min} step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn(
            "h-8 text-sm pr-8",
            source === "listing" && "border-sky-300 bg-sky-50/40",
            source === "estimate" && "border-amber-300 bg-amber-50/40",
          )}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight, positive }: {
  label: string; value: string; highlight?: boolean; positive?: boolean;
}) {
  return (
    <div className={cn("flex justify-between items-center py-1.5", highlight && "font-semibold")}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-mono",
        positive === true && "text-green-600 font-semibold",
        positive === false && "text-red-500 font-semibold"
      )}>{value}</span>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Calculator({ prixAffiche, surface, zipcode = "33000", propertyType = "APPARTEMENT", chargesMensuelles, taxeFonciere }: Props) {

  // Computed initial values
  const estimatedLoyer = useMemo(
    () => estimateRent({ price: prixAffiche, surface, zipcode, propertyType }) ?? (surface ? Math.round(surface * 12) : 800),
    [prixAffiche, surface, zipcode, propertyType]
  );
  const estimatedTaxe = surface ? Math.round(surface * 6) : 0;
  const estimatedCopro = propertyType === "APPARTEMENT" ? Math.min(2400, (surface ?? 50) * 28) : 0;
  const estimatedEntretien = Math.max(400, Math.round(prixAffiche * 0.002));

  const finDef = useMemo(loadFinDefaults, []);

  // Acquisition
  const [acq, setAcq] = useState({
    prixAffiche,
    fraisAgence: 0,
    travaux: 0,
    mobilier: 0,
    fraisNotaireMode: "auto" as "auto" | "manuel",
    fraisNotaireManuel: 0,
    bienNeuf: false,
  });

  // Financing
  const [fin, setFin] = useState({
    mode: "credit" as "comptant" | "credit",
    apport: Math.round(prixAffiche * finDef.apportRatio),
    tauxInteret: finDef.tauxInteret,
    dureeAns: finDef.dureeAns,
    assuranceEmprunteur: finDef.assuranceEmprunteur,
  });
  const [finSaved, setFinSaved] = useState(false);

  // Revenue sources
  const [revSrc, setRevSrc] = useState<Record<string, FieldSource>>({ loyerMensuelHC: "estimate" });
  const [rev, setRev] = useState({ loyerMensuelHC: estimatedLoyer, chargesRecuperables: 0, vacanceLocative: 5 });

  const setRevField = useCallback(<K extends keyof typeof rev>(k: K, v: number) => {
    setRevSrc((s) => ({ ...s, [k]: "user" }));
    setRev((r) => ({ ...r, [k]: v }));
  }, []);

  // Charges sources — listing values take priority over estimates
  const initChg = useMemo(() => ({
    taxeFonciere: taxeFonciere ?? estimatedTaxe,
    chargesCopro: chargesMensuelles != null ? chargesMensuelles * 12 : estimatedCopro,
    assurancePNO: 200,
    fraisGestion: 0,
    entretien: estimatedEntretien,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [chgSrc, setChgSrc] = useState<Record<string, FieldSource>>({
    taxeFonciere: taxeFonciere != null ? "listing" : "estimate",
    chargesCopro: chargesMensuelles != null ? "listing" : "estimate",
    assurancePNO: "estimate",
    entretien: "estimate",
    fraisGestion: "user",
  });
  const [chg, setChg] = useState(initChg);

  const setChgField = useCallback(<K extends keyof typeof chg>(k: K, v: number) => {
    setChgSrc((s) => ({ ...s, [k]: "user" }));
    setChg((c) => ({ ...c, [k]: v }));
  }, []);

  const [showAmort, setShowAmort] = useState(false);

  const input: CalculatorInput = { acquisition: acq, financement: fin, revenus: rev, charges: chg };
  const result = useMemo(() => calculate(input), [acq, fin, rev, chg]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveFinDefaults = () => {
    saveFinDefaults({
      apportRatio: fin.apport / prixAffiche,
      tauxInteret: fin.tauxInteret,
      dureeAns: fin.dureeAns,
      assuranceEmprunteur: fin.assuranceEmprunteur,
    });
    setFinSaved(true);
    setTimeout(() => setFinSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="acquisition">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="acquisition" className="text-xs">Acquisition</TabsTrigger>
          <TabsTrigger value="financement" className="text-xs">Financement</TabsTrigger>
          <TabsTrigger value="revenus" className="text-xs">Revenus</TabsTrigger>
          <TabsTrigger value="charges" className="text-xs">Charges</TabsTrigger>
        </TabsList>

        {/* ── Acquisition ── */}
        <TabsContent value="acquisition" className="space-y-3 pt-3">
          <NumberInput label="Prix affiché" value={acq.prixAffiche} source="listing"
            onChange={(v) => setAcq({ ...acq, prixAffiche: v })} />
          <NumberInput label="Frais d'agence (si non inclus)" value={acq.fraisAgence}
            onChange={(v) => setAcq({ ...acq, fraisAgence: v })} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Frais de notaire</Label>
            <div className="flex gap-2">
              {[["auto-ancien", "Auto ancien", false], ["auto-neuf", "Auto neuf", true]].map(([id, label, neuf]) => (
                <button key={String(id)}
                  onClick={() => setAcq({ ...acq, fraisNotaireMode: "auto", bienNeuf: Boolean(neuf) })}
                  className={cn("text-xs px-2 py-1 rounded border", acq.fraisNotaireMode === "auto" && acq.bienNeuf === Boolean(neuf) && "bg-primary text-primary-foreground border-primary")}
                >{String(label)}</button>
              ))}
              <button
                onClick={() => setAcq({ ...acq, fraisNotaireMode: "manuel" })}
                className={cn("text-xs px-2 py-1 rounded border", acq.fraisNotaireMode === "manuel" && "bg-primary text-primary-foreground border-primary")}
              >Manuel</button>
            </div>
            {acq.fraisNotaireMode === "auto"
              ? <p className="text-xs text-muted-foreground">Estimé : {fmt(result.fraisNotaire)}</p>
              : <NumberInput label="" value={acq.fraisNotaireManuel} onChange={(v) => setAcq({ ...acq, fraisNotaireManuel: v })} />}
          </div>
          <NumberInput label="Travaux" value={acq.travaux} onChange={(v) => setAcq({ ...acq, travaux: v })} />
          <NumberInput label="Mobilier / équipements" value={acq.mobilier} onChange={(v) => setAcq({ ...acq, mobilier: v })} />
        </TabsContent>

        {/* ── Financement ── */}
        <TabsContent value="financement" className="space-y-3 pt-3">
          <div className="flex gap-2">
            {(["credit", "comptant"] as const).map((m) => (
              <button key={m} onClick={() => setFin({ ...fin, mode: m })}
                className={cn("text-xs px-3 py-1.5 rounded border flex-1", fin.mode === m && "bg-primary text-primary-foreground border-primary")}
              >{m === "credit" ? "Crédit" : "Comptant"}</button>
            ))}
          </div>

          {fin.mode === "credit" && (<>
            <NumberInput label="Apport" value={fin.apport} onChange={(v) => setFin({ ...fin, apport: v })} />
            <NumberInput label="Taux d'intérêt" value={fin.tauxInteret} onChange={(v) => setFin({ ...fin, tauxInteret: v })} suffix="%" step={0.05} />
            <NumberInput label="Durée" value={fin.dureeAns} onChange={(v) => setFin({ ...fin, dureeAns: v })} suffix="ans" step={1} />
            <NumberInput label="Assurance emprunteur" value={fin.assuranceEmprunteur} onChange={(v) => setFin({ ...fin, assuranceEmprunteur: v })} suffix="%" step={0.01} />

            <button onClick={handleSaveFinDefaults}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1 w-full justify-center">
              <Save className="size-3" />
              {finSaved ? "✓ Défauts sauvegardés" : "Mémoriser comme paramètres par défaut"}
            </button>
          </>)}
        </TabsContent>

        {/* ── Revenus ── */}
        <TabsContent value="revenus" className="space-y-3 pt-3">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <span className="inline-block bg-amber-100 text-amber-700 text-[9px] font-semibold px-1 rounded mr-1">ESTIMÉ</span>
            calculé depuis la surface × loyer moyen du secteur (Gironde).
            Modifiez si vous connaissez le loyer réel.
          </div>
          <NumberInput label="Loyer mensuel HC" value={rev.loyerMensuelHC} source={revSrc.loyerMensuelHC}
            onChange={(v) => setRevField("loyerMensuelHC", v)} />
          <NumberInput label="Charges récupérables" value={rev.chargesRecuperables}
            onChange={(v) => setRevField("chargesRecuperables", v)} />
          <NumberInput label="Vacance locative" value={rev.vacanceLocative}
            onChange={(v) => setRevField("vacanceLocative", v)} suffix="%" step={0.5} />
        </TabsContent>

        {/* ── Charges ── */}
        <TabsContent value="charges" className="space-y-3 pt-3">
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span><span className="bg-sky-100 text-sky-700 font-semibold px-1 rounded">ANNONCE</span> = valeur extraite de l'annonce</span>
            <span><span className="bg-amber-100 text-amber-700 font-semibold px-1 rounded">ESTIMÉ</span> = calculé</span>
          </div>
          <NumberInput label="Taxe foncière" value={chg.taxeFonciere} source={chgSrc.taxeFonciere}
            onChange={(v) => setChgField("taxeFonciere", v)} suffix="€/an" />
          <NumberInput label="Charges copro (non récup.)" value={chg.chargesCopro} source={chgSrc.chargesCopro}
            onChange={(v) => setChgField("chargesCopro", v)} suffix="€/an" />
          <NumberInput label="Assurance PNO" value={chg.assurancePNO} source={chgSrc.assurancePNO}
            onChange={(v) => setChgField("assurancePNO", v)} suffix="€/an" />
          <NumberInput label="Frais de gestion" value={chg.fraisGestion} source={chgSrc.fraisGestion}
            onChange={(v) => setChgField("fraisGestion", v)} suffix="%" step={0.5} />
          <NumberInput label="Entretien / provisions" value={chg.entretien} source={chgSrc.entretien}
            onChange={(v) => setChgField("entretien", v)} suffix="€/an" />
        </TabsContent>
      </Tabs>

      <Separator />

      {/* ── Résultats ── */}
      <div className="space-y-1">
        <h3 className="font-semibold text-sm mb-3">Résultats</h3>

        <ResultRow label="Prix net vendeur" value={fmt(result.prixNetVendeur)} />
        <ResultRow label="Frais de notaire" value={fmt(result.fraisNotaire)} />
        <ResultRow label="Coût total acquisition" value={fmt(result.coutTotalAcquisition)} highlight />

        {fin.mode === "credit" && (<>
          <Separator className="my-2" />
          <ResultRow label="Montant emprunté" value={fmt(result.montantEmprunte)} />
          <ResultRow label="Mensualité crédit" value={fmt(result.mensualiteCredit)} />
          <ResultRow label="Mensualité assurance" value={fmt(result.mensualiteAssurance)} />
          <ResultRow label="Mensualité totale" value={fmt(result.mensualiteTotale)} highlight />
        </>)}

        <Separator className="my-2" />
        <ResultRow label="Loyer annuel brut" value={fmt(result.loyerAnnuelBrut)} />
        <ResultRow label="Loyer annuel effectif" value={fmt(result.loyerAnnuelEffectif)} />
        <ResultRow label="Charges annuelles" value={fmt(result.totalChargesAnnuelles)} />

        <Separator className="my-2" />
        <div className="grid grid-cols-2 gap-2 py-2">
          {[
            { label: "Rentabilité brute", v: result.rentabiliteBrute, good: 5 },
            { label: "Rentabilité nette", v: result.rentabiliteNette, good: 4 },
          ].map(({ label, v, good }) => (
            <div key={label} className="text-center p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-xl font-bold", v >= good ? "text-green-600" : "text-orange-500")}>{v.toFixed(2)}%</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 py-1">
          {[
            { label: "Cash-flow brut/mois", v: result.cashFlowMensuelBrut },
            { label: "Cash-flow net/mois", v: result.cashFlowMensuelNet },
          ].map(({ label, v }) => (
            <div key={label} className="text-center p-2 rounded-lg border">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-lg font-bold", v >= 0 ? "text-green-600" : "text-red-500")}>
                {v >= 0 ? "+" : ""}{fmt(v)}
              </p>
            </div>
          ))}
        </div>

        <ResultRow label="Loyer min (point mort)" value={fmt(result.pointMortLocatif)} />

        {fin.mode === "credit" && result.amortissement.length > 0 && (<>
          <Separator className="my-2" />
          <button onClick={() => setShowAmort(!showAmort)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showAmort ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Tableau d'amortissement ({result.amortissement.length} mois)
          </button>
          {showAmort && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded border text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-1.5 text-left">Mois</th>
                    <th className="p-1.5 text-right">Capital</th>
                    <th className="p-1.5 text-right">Intérêts</th>
                    <th className="p-1.5 text-right">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {result.amortissement.map((row) => (
                    <tr key={row.mois} className="border-t">
                      <td className="p-1.5">{row.mois}</td>
                      <td className="p-1.5 text-right">{fmt(row.capital)}</td>
                      <td className="p-1.5 text-right text-muted-foreground">{fmt(row.interets)}</td>
                      <td className="p-1.5 text-right">{fmt(row.capitalRestant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
