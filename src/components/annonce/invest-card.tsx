"use client";

import { useInvestParams } from "@/components/invest-context";
import {
  estimateChargesBreakdown,
  estimateCashFlow,
  estimateGrossYield,
  estimateMonthlyCredit,
  estimateNetYield,
} from "@/lib/estimates";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface Props {
  price: number;
  surface: number | null;
  zipcode: string;
  propertyType: string;
  pricePerSqm: number | null;
  vsMarche: number | null;
  marketAvgPricePerSqm: number | null;
  marketCount: number | null;
  loyerEstime: number | undefined;
  realRentPerSqm?: number | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function fmtDec(n: number, d = 2) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

// ── Score gauge ───────────────────────────────────────────────────────────────

function computeScore(grossYield: number, cashFlow: number | null, vsMarche: number | null): number {
  let score = Math.min(65, Math.round(grossYield * 9)); // up to 65 pts from yield

  if (cashFlow !== null) {
    if (cashFlow > 300) score += 20;
    else if (cashFlow > 100) score += 15;
    else if (cashFlow > 0) score += 10;
    else if (cashFlow > -200) score += 5;
    else if (cashFlow > -400) score += 2;
  }

  if (vsMarche !== null) {
    if (vsMarche < -15) score += 15;
    else if (vsMarche < -5) score += 8;
    else if (vsMarche < 5) score += 3;
    else if (vsMarche > 15) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function ScoreGauge({ score }: { score: number }) {
  const r = 46;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270°
  const totalArc = circumference * arcFraction;
  const filled = (score / 100) * totalArc;

  const color =
    score >= 75 ? "#16a34a" :
    score >= 55 ? "#d97706" :
    "#dc2626";

  const trackColor = "#e2e8f0";

  const label =
    score >= 80 ? "Excellent" :
    score >= 65 ? "Très bien" :
    score >= 50 ? "Correct" :
    score >= 35 ? "Moyen" :
    "Faible";

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth="10"
          strokeDasharray={`${totalArc} ${circumference - totalArc}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <text
          x={cx} y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="30"
          fontWeight="900"
          fill="#0f172a"
        >
          {score}
        </text>
      </svg>
      <p className="font-bold text-base -mt-1" style={{ color }}>{label}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Score investissement</p>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueColor }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div className="flex-1 bg-slate-50 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-2xl font-black leading-tight" style={{ color: valueColor ?? "#0f172a" }}>{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

// ── Charge row ────────────────────────────────────────────────────────────────

function ChargeRow({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${highlight ? "font-bold text-slate-800" : "text-slate-600"}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{fmt(amount)} €/an</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestCard({ price, surface, zipcode, propertyType, pricePerSqm, vsMarche, marketAvgPricePerSqm, marketCount, loyerEstime, realRentPerSqm }: Props) {
  const { params } = useInvestParams();

  const input = { price, surface, zipcode, propertyType, rentPerSqmOverride: realRentPerSqm };
  const grossYield = estimateGrossYield(input);
  const netYield   = estimateNetYield(input);
  const cashFlow   = estimateCashFlow(input, params);
  const monthlyCredit = estimateMonthlyCredit(price, propertyType, params);
  const breakdown  = estimateChargesBreakdown(input);

  const score = grossYield !== null ? computeScore(grossYield, cashFlow, vsMarche) : null;

  const cfColor =
    cashFlow === null ? "#64748b" :
    cashFlow >= 0 ? "#16a34a" :
    cashFlow >= -300 ? "#d97706" :
    "#dc2626";

  const marcheColor =
    vsMarche === null ? null :
    vsMarche >= 10 ? "#dc2626" :
    vsMarche <= -10 ? "#16a34a" :
    "#d97706";

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white divide-y divide-slate-100">

      {/* ── Analyse Investissement ─────────────────────────────────────── */}
      <div className="p-6">
        <p className="text-sm font-semibold text-slate-800 mb-5">Analyse Investissement</p>

        <div className="flex items-center gap-4">
          {/* Score gauge */}
          {score !== null ? (
            <ScoreGauge score={score} />
          ) : (
            <div className="w-[120px] h-[120px] flex items-center justify-center text-xs text-slate-400 text-center">
              Surface<br />inconnue
            </div>
          )}

          {/* Metric cards */}
          <div className="flex gap-3 flex-1 min-w-0">
            <MetricCard
              label="Rendement Brut"
              value={grossYield !== null ? `${fmtDec(grossYield, 2)}%` : "—"}
              sub={breakdown ? `${fmt(breakdown.loyerBrutAnnuel)} €/an` : "surface inconnue"}
            />
            <MetricCard
              label="Rendement Net"
              value={netYield !== null ? `${fmtDec(netYield, 2)}%` : "—"}
              sub="après charges"
            />
            <MetricCard
              label="Cashflow"
              value={cashFlow !== null ? `${cashFlow >= 0 ? "+" : ""}${fmt(cashFlow)} €` : "—"}
              sub="par mois"
              valueColor={cashFlow !== null ? cfColor : undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Détail des charges ─────────────────────────────────────────── */}
      {breakdown && (
        <div className="p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Détail des charges estimées
          </p>

          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <ChargeRow label="Taxe foncière" amount={breakdown.taxeFonciere} />
              <ChargeRow label="Assurance PNO" amount={breakdown.assurancePNO} />
              {breakdown.copro > 0 && (
                <ChargeRow label="Charges copro. NR" amount={breakdown.copro} />
              )}
              <ChargeRow label="Entretien / provisions" amount={breakdown.entretien} />
            </div>
            <div>
              <ChargeRow label="Gestion locative (6%)" amount={breakdown.gestionLocative} />
              <ChargeRow label="GLI (3%)" amount={breakdown.gli} />
              <ChargeRow label="Vacance locative (5%)" amount={breakdown.vacanceLocative} />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
            <span className="text-sm font-bold text-slate-800">Total charges</span>
            <span className="text-sm font-black text-slate-800">{fmt(breakdown.totalCharges)} €/an</span>
          </div>
        </div>
      )}

      {/* ── Mensualité + loyer ────────────────────────────────────────── */}
      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-sm text-slate-500">Mensualité crédit estimée</span>
          <span className="text-sm font-semibold text-slate-700">~{fmt(monthlyCredit)} €/mois</span>
        </div>
        {loyerEstime && (
          <div className="flex items-center justify-between px-6 py-3">
            <span className="text-sm text-slate-500">Loyer estimé</span>
            <span className="text-sm font-semibold text-slate-700">{fmt(loyerEstime)} €/mois</span>
          </div>
        )}
      </div>

      {/* ── Prix vs marché ────────────────────────────────────────────── */}
      {vsMarche !== null && (
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Prix vs marché local
          </p>
          <div className="flex items-center gap-2">
            {vsMarche >= 10 ? (
              <TrendingUp className="size-4" style={{ color: marcheColor ?? undefined }} />
            ) : vsMarche <= -10 ? (
              <TrendingDown className="size-4" style={{ color: marcheColor ?? undefined }} />
            ) : (
              <Minus className="size-4" style={{ color: marcheColor ?? undefined }} />
            )}
            <span className="text-xl font-black" style={{ color: marcheColor ?? undefined }}>
              {vsMarche > 0 ? "+" : ""}{vsMarche}%
            </span>
            <span className="text-sm text-slate-500">
              {vsMarche >= 10 ? "au-dessus du marché" : vsMarche <= -10 ? "sous le marché" : "dans la moyenne"}
            </span>
          </div>
          {vsMarche >= 10 && (
            <div className="flex items-start gap-1.5 mt-2">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
              <p className="text-[11px] text-red-600">Prix élevé — négociation recommandée</p>
            </div>
          )}
          {marketAvgPricePerSqm && pricePerSqm && (
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>Ce bien : <b className="text-slate-600">{fmt(pricePerSqm)} €/m²</b></span>
              <span>
                Moy. secteur : <b className="text-slate-600">{fmt(marketAvgPricePerSqm)} €/m²</b>
                {marketCount && <span className="opacity-60"> ({marketCount} ann.)</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-slate-50">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          * Rendement brut = loyer annuel / prix FAI. Cashflow calculé sur crédit {params.duree} ans, apport {params.apport}%, taux {params.taux}% interpolé.
          Loyer et charges estimés depuis annonces location du secteur.
        </p>
      </div>
    </div>
  );
}
