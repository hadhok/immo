"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculate, type CalculatorInput } from "@/lib/calculator";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  prixAffiche: number;
  surface?: number;
  loyerEstime?: number;
}

function NumberInput({
  label,
  value,
  onChange,
  suffix = "€",
  min = 0,
  step = 1,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-sm pr-8"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={cn("flex justify-between items-center py-1.5", highlight && "font-semibold")}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-mono",
          positive === true && "text-green-600 font-semibold",
          positive === false && "text-red-500 font-semibold"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);
}

export function Calculator({ prixAffiche, surface, loyerEstime }: Props) {
  const defaultLoyer = loyerEstime || (surface ? Math.round(surface * 12) : 800);

  const [acq, setAcq] = useState({
    prixAffiche,
    fraisAgence: 0,
    travaux: 0,
    mobilier: 0,
    fraisNotaireMode: "auto" as "auto" | "manuel",
    fraisNotaireManuel: 0,
    bienNeuf: false,
  });

  const [fin, setFin] = useState({
    mode: "credit" as "comptant" | "credit",
    apport: Math.round(prixAffiche * 0.2),
    tauxInteret: 3.5,
    dureeAns: 20,
    assuranceEmprunteur: 0.1,
  });

  const [rev, setRev] = useState({
    loyerMensuelHC: defaultLoyer,
    chargesRecuperables: 0,
    vacanceLocative: 5,
  });

  const [chg, setChg] = useState({
    taxeFonciere: 0,
    chargesCopro: 0,
    assurancePNO: 150,
    fraisGestion: 0,
    entretien: 0,
  });

  const [showAmort, setShowAmort] = useState(false);

  const input: CalculatorInput = { acquisition: acq, financement: fin, revenus: rev, charges: chg };
  const result = useMemo(() => calculate(input), [acq, fin, rev, chg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Tabs defaultValue="acquisition">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="acquisition" className="text-xs">Acquisition</TabsTrigger>
          <TabsTrigger value="financement" className="text-xs">Financement</TabsTrigger>
          <TabsTrigger value="revenus" className="text-xs">Revenus</TabsTrigger>
          <TabsTrigger value="charges" className="text-xs">Charges</TabsTrigger>
        </TabsList>

        <TabsContent value="acquisition" className="space-y-3 pt-3">
          <NumberInput label="Prix affiché" value={acq.prixAffiche} onChange={(v) => setAcq({ ...acq, prixAffiche: v })} />
          <NumberInput label="Frais d'agence (si non inclus)" value={acq.fraisAgence} onChange={(v) => setAcq({ ...acq, fraisAgence: v })} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Frais de notaire</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setAcq({ ...acq, fraisNotaireMode: "auto", bienNeuf: false })}
                className={cn("text-xs px-2 py-1 rounded border", acq.fraisNotaireMode === "auto" && !acq.bienNeuf && "bg-primary text-primary-foreground border-primary")}
              >
                Auto ancien
              </button>
              <button
                onClick={() => setAcq({ ...acq, fraisNotaireMode: "auto", bienNeuf: true })}
                className={cn("text-xs px-2 py-1 rounded border", acq.fraisNotaireMode === "auto" && acq.bienNeuf && "bg-primary text-primary-foreground border-primary")}
              >
                Auto neuf
              </button>
              <button
                onClick={() => setAcq({ ...acq, fraisNotaireMode: "manuel" })}
                className={cn("text-xs px-2 py-1 rounded border", acq.fraisNotaireMode === "manuel" && "bg-primary text-primary-foreground border-primary")}
              >
                Manuel
              </button>
            </div>
            {acq.fraisNotaireMode === "auto" ? (
              <p className="text-xs text-muted-foreground">Estimé : {fmt(result.fraisNotaire)}</p>
            ) : (
              <NumberInput label="" value={acq.fraisNotaireManuel} onChange={(v) => setAcq({ ...acq, fraisNotaireManuel: v })} />
            )}
          </div>
          <NumberInput label="Travaux" value={acq.travaux} onChange={(v) => setAcq({ ...acq, travaux: v })} />
          <NumberInput label="Mobilier / équipements" value={acq.mobilier} onChange={(v) => setAcq({ ...acq, mobilier: v })} />
        </TabsContent>

        <TabsContent value="financement" className="space-y-3 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFin({ ...fin, mode: "credit" })}
              className={cn("text-xs px-3 py-1.5 rounded border flex-1", fin.mode === "credit" && "bg-primary text-primary-foreground border-primary")}
            >
              Crédit
            </button>
            <button
              onClick={() => setFin({ ...fin, mode: "comptant" })}
              className={cn("text-xs px-3 py-1.5 rounded border flex-1", fin.mode === "comptant" && "bg-primary text-primary-foreground border-primary")}
            >
              Comptant
            </button>
          </div>

          {fin.mode === "credit" && (
            <>
              <NumberInput label="Apport" value={fin.apport} onChange={(v) => setFin({ ...fin, apport: v })} />
              <NumberInput label="Taux d'intérêt" value={fin.tauxInteret} onChange={(v) => setFin({ ...fin, tauxInteret: v })} suffix="%" step={0.05} />
              <NumberInput label="Durée" value={fin.dureeAns} onChange={(v) => setFin({ ...fin, dureeAns: v })} suffix="ans" step={1} />
              <NumberInput label="Assurance emprunteur" value={fin.assuranceEmprunteur} onChange={(v) => setFin({ ...fin, assuranceEmprunteur: v })} suffix="%" step={0.01} />
            </>
          )}
        </TabsContent>

        <TabsContent value="revenus" className="space-y-3 pt-3">
          <NumberInput label="Loyer mensuel HC" value={rev.loyerMensuelHC} onChange={(v) => setRev({ ...rev, loyerMensuelHC: v })} />
          <NumberInput label="Charges récupérables" value={rev.chargesRecuperables} onChange={(v) => setRev({ ...rev, chargesRecuperables: v })} />
          <NumberInput label="Vacance locative" value={rev.vacanceLocative} onChange={(v) => setRev({ ...rev, vacanceLocative: v })} suffix="%" step={0.5} />
        </TabsContent>

        <TabsContent value="charges" className="space-y-3 pt-3">
          <NumberInput label="Taxe foncière" value={chg.taxeFonciere} onChange={(v) => setChg({ ...chg, taxeFonciere: v })} suffix="€/an" />
          <NumberInput label="Charges copro (non récup.)" value={chg.chargesCopro} onChange={(v) => setChg({ ...chg, chargesCopro: v })} suffix="€/an" />
          <NumberInput label="Assurance PNO" value={chg.assurancePNO} onChange={(v) => setChg({ ...chg, assurancePNO: v })} suffix="€/an" />
          <NumberInput label="Frais de gestion" value={chg.fraisGestion} onChange={(v) => setChg({ ...chg, fraisGestion: v })} suffix="%" step={0.5} />
          <NumberInput label="Entretien / provisions" value={chg.entretien} onChange={(v) => setChg({ ...chg, entretien: v })} suffix="€/an" />
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Résultats */}
      <div className="space-y-1">
        <h3 className="font-semibold text-sm mb-3">Résultats</h3>

        <ResultRow label="Prix net vendeur" value={fmt(result.prixNetVendeur)} />
        <ResultRow label="Frais de notaire" value={fmt(result.fraisNotaire)} />
        <ResultRow label="Coût total acquisition" value={fmt(result.coutTotalAcquisition)} highlight />

        {fin.mode === "credit" && (
          <>
            <Separator className="my-2" />
            <ResultRow label="Montant emprunté" value={fmt(result.montantEmprunte)} />
            <ResultRow label="Mensualité crédit" value={fmt(result.mensualiteCredit)} />
            <ResultRow label="Mensualité assurance" value={fmt(result.mensualiteAssurance)} />
            <ResultRow label="Mensualité totale" value={fmt(result.mensualiteTotale)} highlight />
          </>
        )}

        <Separator className="my-2" />
        <ResultRow label="Loyer annuel brut" value={fmt(result.loyerAnnuelBrut)} />
        <ResultRow label="Loyer annuel effectif" value={fmt(result.loyerAnnuelEffectif)} />
        <ResultRow label="Charges annuelles" value={fmt(result.totalChargesAnnuelles)} />

        <Separator className="my-2" />
        <div className="grid grid-cols-2 gap-2 py-2">
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Rentabilité brute</p>
            <p className={cn("text-xl font-bold", result.rentabiliteBrute >= 5 ? "text-green-600" : "text-orange-500")}>
              {result.rentabiliteBrute.toFixed(2)}%
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Rentabilité nette</p>
            <p className={cn("text-xl font-bold", result.rentabiliteNette >= 4 ? "text-green-600" : "text-orange-500")}>
              {result.rentabiliteNette.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 py-1">
          <div className="text-center p-2 rounded-lg border">
            <p className="text-xs text-muted-foreground">Cash-flow brut/mois</p>
            <p className={cn("text-lg font-bold", result.cashFlowMensuelBrut >= 0 ? "text-green-600" : "text-red-500")}>
              {result.cashFlowMensuelBrut >= 0 ? "+" : ""}{fmt(result.cashFlowMensuelBrut)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg border">
            <p className="text-xs text-muted-foreground">Cash-flow net/mois</p>
            <p className={cn("text-lg font-bold", result.cashFlowMensuelNet >= 0 ? "text-green-600" : "text-red-500")}>
              {result.cashFlowMensuelNet >= 0 ? "+" : ""}{fmt(result.cashFlowMensuelNet)}
            </p>
          </div>
        </div>

        <ResultRow label="Loyer min (point mort)" value={fmt(result.pointMortLocatif)} />

        {fin.mode === "credit" && result.amortissement.length > 0 && (
          <>
            <Separator className="my-2" />
            <button
              onClick={() => setShowAmort(!showAmort)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
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
          </>
        )}
      </div>
    </div>
  );
}
