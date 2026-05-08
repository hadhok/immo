"use client";

import { useInvestParams } from "@/components/invest-context";

const RATES: Record<number, number> = { 7: 3.15, 10: 3.2, 15: 3.3, 20: 3.45, 25: 3.55 };
const DURATIONS = [7, 10, 15, 20, 25];

function mensualite(capital: number, tauxAnnuel: number, dureeAns: number) {
  const r = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  return r === 0 ? Math.round(capital / n) : Math.round((capital * r * (1 + r) ** n) / ((1 + r) ** n - 1));
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

export function CreditTable({ capital }: { capital: number }) {
  const { params } = useInvestParams();
  const apportAmount = Math.round((capital * params.apport) / 100);
  const capitalEmprunte = capital - apportAmount;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <p className="font-semibold text-base">Simulation crédit</p>
        <p className="text-xs text-muted-foreground">
          {params.apport === 0 ? "Sans apport" : `Avec ${params.apport}% d'apport`}
        </p>
      </div>

      <div className="space-y-2 mb-5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Coût total acquisition</span>
          <span className="font-medium">{fmt(capital)} €</span>
        </div>
        {apportAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Apport ({params.apport}%)</span>
            <span className="font-medium text-emerald-600">-{fmt(apportAmount)} €</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2">
          <span className="font-bold">Capital à emprunter</span>
          <span className="font-black text-[#3b5bdb] text-base">{fmt(capitalEmprunte)} €</span>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              <th className="text-left p-2.5">Durée</th>
              <th className="text-right p-2.5">Mensualité</th>
              <th className="text-right p-2.5 hidden sm:table-cell">Rev. min.</th>
              <th className="text-right p-2.5 hidden md:table-cell">Coût total</th>
              <th className="text-right p-2.5 hidden lg:table-cell">Coût crédit</th>
              <th className="text-right p-2.5">Taux</th>
            </tr>
          </thead>
          <tbody>
            {DURATIONS.map((duree) => {
              const taux = RATES[duree];
              const m = mensualite(capitalEmprunte, taux, duree);
              const coutTotal = m * duree * 12;
              const coutCredit = coutTotal - capitalEmprunte;
              const revMin = Math.round(m * 3);
              const isRec = duree === params.duree;
              return (
                <tr
                  key={duree}
                  className={isRec ? "bg-amber-50 border-t border-amber-100" : "border-t hover:bg-slate-50/50 transition-colors"}
                >
                  <td className="p-2.5 font-medium">
                    {duree} ans
                    {isRec && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-amber-900 whitespace-nowrap">
                        Recommandé
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-right font-bold">{fmt(m)} €/mois</td>
                  <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">{fmt(revMin)} €/mois</td>
                  <td className="p-2.5 text-right text-muted-foreground hidden md:table-cell">{fmt(coutTotal)} €</td>
                  <td className="p-2.5 text-right text-muted-foreground hidden lg:table-cell">{fmt(coutCredit)} €</td>
                  <td className="p-2.5 text-right text-muted-foreground">{taux.toFixed(2).replace(".", ",")}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">* Simulation indicative hors assurance emprunteur.</p>
    </div>
  );
}
