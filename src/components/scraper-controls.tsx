"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Source, ScraperResult } from "@/types/listing";

const SOURCES: { id: Source; label: string; reliable?: boolean }[] = [
  { id: "pap", label: "PAP", reliable: true },
  { id: "bienici", label: "Bien'ici", reliable: true },
  { id: "seloger", label: "SeLoger" },
  { id: "leboncoin", label: "LeBonCoin" },
];

interface RunResult extends ScraperResult {
  source: Source;
}

export function ScraperControls() {
  const [running, setRunning] = useState<Set<Source>>(new Set());
  const [results, setResults] = useState<RunResult[]>([]);

  const launch = async (sources: Source[]) => {
    setRunning((prev) => new Set([...prev, ...sources]));
    setResults([]);

    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults(sources.map((s) => ({ source: s, status: "ERROR", errorMsg: "Erreur réseau", added: 0, updated: 0, total: 0 })));
    } finally {
      setRunning(new Set());
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          onClick={() => launch(SOURCES.filter((s) => s.reliable).map((s) => s.id))}
          disabled={running.size > 0}
          className="gap-2"
        >
          <Zap className={cn("size-4", running.size > 0 && "animate-pulse")} />
          {running.size > 0 ? "Mise à jour en cours…" : "Sources fiables (PAP + Bien'ici)"}
        </Button>

        <Button
          onClick={() => launch(SOURCES.map((s) => s.id))}
          disabled={running.size > 0}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={cn("size-4", running.size > 0 && "animate-pulse")} />
          Tout tenter
        </Button>

        <div className="flex gap-2 ml-auto">
          {SOURCES.map(({ id, label, reliable }) => (
            <Button
              key={id}
              variant={reliable ? "secondary" : "outline"}
              size="sm"
              onClick={() => launch([id])}
              disabled={running.has(id) || running.size > 0}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3", running.has(id) && "animate-spin")} />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {running.size > 0 && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Scraping en cours pour : {Array.from(running).join(", ")} — cette opération peut prendre plusieurs minutes…
        </p>
      )}

      {results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {results.map((r) => (
            <div key={r.source} className="flex items-center gap-1.5 text-xs border rounded px-2 py-1">
              <span className="font-medium capitalize">{r.source}</span>
              {r.status === "SUCCESS" ? (
                <Badge variant="default" className="text-xs h-4">
                  +{r.added} · {r.updated} MAJ
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs h-4">
                  {r.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
