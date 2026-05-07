export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ScraperControls } from "@/components/scraper-controls";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import type { ScraperStatus } from "@/types/listing";

const SOURCES = [
  { id: "pap", label: "PAP.fr", description: "Particulier à particulier" },
  { id: "bienici", label: "Bien'ici", description: "Agrégateur agences (API)" },
  { id: "seloger", label: "SeLoger", description: "Portail agences (anti-bot)" },
  { id: "leboncoin", label: "LeBonCoin", description: "Petites annonces (anti-bot)" },
];

function StatusBadge({ status }: { status: ScraperStatus }) {
  const config = {
    SUCCESS: { icon: CheckCircle, label: "OK", variant: "default" as const, color: "text-green-600" },
    ERROR: { icon: XCircle, label: "Erreur", variant: "destructive" as const, color: "text-red-500" },
    BLOCKED: { icon: AlertCircle, label: "Bloqué", variant: "outline" as const, color: "text-orange-500" },
    RUNNING: { icon: Loader2, label: "En cours", variant: "secondary" as const, color: "text-blue-500" },
  }[status];

  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`size-3 ${config.color} ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

async function getSourceStats() {
  const stats = await Promise.all(
    SOURCES.map(async ({ id }) => {
      const [lastRun, totalListings] = await Promise.all([
        prisma.scraperRun.findFirst({
          where: { source: id },
          orderBy: { startedAt: "desc" },
        }),
        prisma.listing.count({ where: { source: id, isActive: true } }),
      ]);
      return { source: id, lastRun, totalListings };
    })
  );
  return stats;
}

async function getRecentRuns() {
  return prisma.scraperRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });
}

export default async function AdminPage() {
  const [stats, recentRuns] = await Promise.all([getSourceStats(), getRecentRuns()]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sources de données</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez les scrapers et consultez l'historique des mises à jour
        </p>
      </div>

      {/* Contrôles */}
      <ScraperControls />

      {/* Tableau de bord par source */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map(({ source, lastRun, totalListings }) => {
          const sourceInfo = SOURCES.find((s) => s.id === source)!;
          const duration =
            lastRun?.finishedAt && lastRun?.startedAt
              ? Math.round((lastRun.finishedAt.getTime() - lastRun.startedAt.getTime()) / 1000)
              : null;

          return (
            <div key={source} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{sourceInfo.label}</h3>
                  <p className="text-xs text-muted-foreground">{sourceInfo.description}</p>
                </div>
                {lastRun && <StatusBadge status={lastRun.status as ScraperStatus} />}
              </div>

              <div className="text-2xl font-bold">{totalListings.toLocaleString("fr-FR")}</div>
              <p className="text-xs text-muted-foreground">annonces actives</p>

              {lastRun && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    Dernière MAJ :{" "}
                    {lastRun.startedAt.toLocaleDateString("fr-FR")}{" "}
                    {lastRun.startedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {lastRun.status === "SUCCESS" && (
                    <p>
                      +{lastRun.listingsAdded} ajoutées · {lastRun.listingsUpdated} mises à jour
                      {duration && ` · ${duration}s`}
                    </p>
                  )}
                  {lastRun.errorMsg && (
                    <p className="text-red-500 truncate">{lastRun.errorMsg}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Historique */}
      <div>
        <h2 className="font-semibold mb-3">Historique des 20 dernières exécutions</h2>
        <div className="bg-card border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Démarré</th>
                <th className="p-3 text-right">Durée</th>
                <th className="p-3 text-right">Ajoutées</th>
                <th className="p-3 text-right">MAJ</th>
                <th className="p-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucune exécution pour l'instant. Lancez une mise à jour ci-dessus.
                  </td>
                </tr>
              ) : (
                recentRuns.map((run) => {
                  const duration =
                    run.finishedAt && run.startedAt
                      ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
                      : null;
                  return (
                    <tr key={run.id} className="border-t">
                      <td className="p-3 font-medium capitalize">{run.source}</td>
                      <td className="p-3 text-muted-foreground">
                        {run.startedAt.toLocaleDateString("fr-FR")}{" "}
                        {run.startedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {duration !== null ? `${duration}s` : "—"}
                      </td>
                      <td className="p-3 text-right">{run.listingsAdded}</td>
                      <td className="p-3 text-right">{run.listingsUpdated}</td>
                      <td className="p-3 text-center">
                        <StatusBadge status={run.status as ScraperStatus} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
