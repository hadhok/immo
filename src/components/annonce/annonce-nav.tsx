"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Calculator, TrendingUp, BarChart2 } from "lucide-react";

const TABS = [
  { id: "synthese",   label: "Synthèse",    Icon: FileText    },
  { id: "invest",     label: "Invest.",      Icon: TrendingUp  },
  { id: "finance",    label: "Finance",      Icon: Calculator  },
  { id: "simulation", label: "Simulation",   Icon: BarChart2   },
] as const;

export function AnnonceNav() {
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
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    TABS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-[100px] z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 py-2">
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
