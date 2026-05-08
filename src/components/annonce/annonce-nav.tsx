"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ExternalLink, MapPin, FileText, TrendingUp, Calculator, BarChart2 } from "lucide-react";

const TABS = [
  { id: "synthese",   label: "Synthèse",   Icon: FileText   },
  { id: "invest",     label: "Invest.",     Icon: TrendingUp },
  { id: "finance",    label: "Finance",     Icon: Calculator },
  { id: "simulation", label: "Simulation",  Icon: BarChart2  },
] as const;

interface Props {
  price: string;          // formatted, e.g. "172 000 €"
  subtitle: string;       // e.g. "T2 · 56 m² · Bordeaux 33800"
  vsMarche: number | null;
  sourceUrl: string;
  sourceLabel: string;
}

function marcheColor(v: number) {
  return v >= 10 ? "#f87171" : v <= -10 ? "#4ade80" : "#fbbf24";
}

export function AnnonceHeader({ price, subtitle, vsMarche, sourceUrl, sourceLabel }: Props) {
  const [active, setActive] = useState<string>("synthese");

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    TABS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const mc = vsMarche !== null ? marcheColor(vsMarche) : null;

  return (
    <div className="sticky top-14 z-30 shadow-lg">

      {/* ── Price bar ─────────────────────────────────────────────────── */}
      <div className="bg-[#1e2d45] text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">

          <Link href="/" className="shrink-0 text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </Link>

          {/* Price — large and prominent */}
          <span className="text-2xl font-black tracking-tight shrink-0">{price}</span>

          {/* Sub info */}
          <span className="text-white/50 text-sm shrink-0 hidden sm:inline">{subtitle}</span>

          {/* vs marché badge */}
          {vsMarche !== null && mc && (
            <span
              className="font-bold shrink-0 px-2.5 py-1 rounded-lg text-xs"
              style={{ background: mc + "25", color: mc, border: `1px solid ${mc}40` }}
            >
              {vsMarche > 0 ? "+" : ""}{vsMarche}% vs marché
            </span>
          )}

          {/* External link */}
          <a
            href={sourceUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-white/40 hover:text-white transition-colors shrink-0 text-xs"
          >
            <ExternalLink className="size-3.5" />
            {sourceLabel}
          </a>
        </div>
      </div>

      {/* ── Tab nav ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 py-1.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                active === id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
