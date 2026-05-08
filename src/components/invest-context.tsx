"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { InvestParams } from "@/lib/estimates";
import { DEFAULT_INVEST_PARAMS } from "@/lib/estimates";

const STORAGE_KEY = "immo33_invest_params";

interface InvestContextValue {
  params: InvestParams;
  setParams: (p: InvestParams) => void;
}

const InvestContext = createContext<InvestContextValue>({
  params: DEFAULT_INVEST_PARAMS,
  setParams: () => {},
});

export function useInvestParams() {
  return useContext(InvestContext);
}

function load(): InvestParams {
  if (typeof window === "undefined") return DEFAULT_INVEST_PARAMS;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_INVEST_PARAMS;
    const { apport, taux, duree } = JSON.parse(s) as { apport: string; taux: string; duree: string };
    return {
      apport: parseFloat(apport) || DEFAULT_INVEST_PARAMS.apport,
      taux: parseFloat(taux) || DEFAULT_INVEST_PARAMS.taux,
      duree: parseInt(duree, 10) || DEFAULT_INVEST_PARAMS.duree,
    };
  } catch { return DEFAULT_INVEST_PARAMS; }
}

export function InvestProvider({ children, initial }: { children: ReactNode; initial?: Partial<InvestParams> }) {
  const [params, setParamsState] = useState<InvestParams>({ ...DEFAULT_INVEST_PARAMS, ...initial });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = load();
    setParamsState((prev) => ({ ...prev, ...stored, ...initial }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParams = useCallback((p: InvestParams) => {
    setParamsState(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        apport: String(p.apport),
        taux: String(p.taux),
        duree: String(p.duree),
      }));
    } catch {}
  }, []);

  return <InvestContext.Provider value={{ params, setParams }}>{children}</InvestContext.Provider>;
}
