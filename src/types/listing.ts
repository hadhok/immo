export type PropertyType =
  | "APPARTEMENT"
  | "MAISON"
  | "IMMEUBLE"
  | "TERRAIN"
  | "LOCAL_COMMERCIAL"
  | "AUTRE";

export type ScraperStatus = "RUNNING" | "SUCCESS" | "ERROR" | "BLOCKED";

export interface ListingData {
  source: string;
  sourceUrl: string;
  title: string;
  price: number;
  surface?: number;
  rooms?: number;
  bedrooms?: number;
  floor?: number;
  totalFloors?: number;
  propertyType?: PropertyType;
  address?: string;
  city: string;
  zipcode: string;
  lat?: number;
  lng?: number;
  description?: string;
  photos?: string[];
  dpe?: string;
  ges?: string;
  chargesMensuelles?: number;
  taxeFonciere?: number;
  bienNeuf?: boolean;
  venduLoue?: boolean;
  publicationDate?: Date;
}

export interface ScraperResult {
  source: string;
  added: number;
  updated: number;
  total: number;
  status: ScraperStatus;
  errorMsg?: string;
}

export const SOURCES = ["pap", "bienici", "castorus"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  pap: "PAP",
  bienici: "Bien'ici",
  castorus: "Castorus",
};
