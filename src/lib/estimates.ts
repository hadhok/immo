/**
 * Estimations immobilières pour la Gironde (33).
 * Données loyers : ANIL "Carte des Loyers" 2025 (data.gouv.fr) — loyers d'annonce par commune.
 * Données prix   : DVF / baromètre Notaires de France T4 2024.
 */

export interface ListingEstimateInput {
  price: number;
  surface?: number | null;
  zipcode: string;
  propertyType: string;
  /** Override rent per sqm with a real value (e.g. from RentReference DB) */
  rentPerSqmOverride?: number | null;
}

export interface InvestParams {
  apport: number;   // % apport sur le prix (ex: 20)
  taux: number;     // taux annuel crédit % (ex: 3.5)
  duree: number;    // durée en années (ex: 20)
}

export const DEFAULT_INVEST_PARAMS: InvestParams = {
  apport: 20,
  taux: 3.5,
  duree: 20,
};

// ─── Données de référence par code postal ────────────────────────────────────
// Loyers : ANIL / Carte des Loyers 2025 (données communes — pred-app et pred-mai)
// Prix   : DVF / baromètre Notaires de France / SeLoger Baromètre T4 2024

interface ZoneData {
  rentApt: number;    // Loyer médian appartement (€/m²/mois, charges excl.)
  rentMaison: number; // Loyer médian maison (€/m²/mois)
  prixApt: number;    // Prix médian appartement (€/m²)
  prixMaison: number; // Prix médian maison (€/m²)
}

const ZONE: Record<string, ZoneData> = {
  // ─── Bordeaux intra-muros (INSEE 33063 — loyer global 15.99 apt / 15.51 maison) ───
  // Valeurs affectées par quartier en proportion de l'écart de prix
  "33000": { rentApt: 16.5, rentMaison: 15.8, prixApt: 4900, prixMaison: 5200 }, // Centre / Chartrons
  "33100": { rentApt: 15.5, rentMaison: 14.8, prixApt: 4600, prixMaison: 4900 }, // Bordeaux Nord / Bacalan
  "33200": { rentApt: 15.0, rentMaison: 14.5, prixApt: 4100, prixMaison: 4400 }, // Bordeaux Sud / Belcier
  "33300": { rentApt: 15.7, rentMaison: 15.2, prixApt: 4700, prixMaison: 5000 }, // Bordeaux Est / Bastide
  "33800": { rentApt: 14.8, rentMaison: 14.3, prixApt: 3800, prixMaison: 4100 }, // Bordeaux Caudéran

  // ─── Rive gauche / sud ────────────────────────────────────────────────────
  "33400": { rentApt: 15.6, rentMaison: 15.0, prixApt: 4100, prixMaison: 4300 }, // Talence        (ANIL: apt 15.56 / mai 14.99)
  "33130": { rentApt: 14.5, rentMaison: 14.5, prixApt: 3200, prixMaison: 3500 }, // Bègles         (ANIL: apt 14.52 / mai 14.52)
  "33140": { rentApt: 14.1, rentMaison: 13.3, prixApt: 3000, prixMaison: 3300 }, // Villenave-d'Ornon (ANIL: apt 14.08 / mai 13.35)
  "33170": { rentApt: 15.0, rentMaison: 14.9, prixApt: 3200, prixMaison: 3600 }, // Gradignan      (ANIL: apt 14.98 / mai 14.86)
  "33600": { rentApt: 15.3, rentMaison: 14.3, prixApt: 3500, prixMaison: 3800 }, // Pessac         (ANIL: apt 15.27 / mai 14.31)
  "33610": { rentApt: 14.9, rentMaison: 13.9, prixApt: 3000, prixMaison: 3300 }, // Cestas / Canéjan (ANIL: apt 14.94 / mai 13.88)
  "33850": { rentApt: 14.7, rentMaison: 12.3, prixApt: 3100, prixMaison: 3600 }, // Léognan        (ANIL: apt 14.72 / mai 12.27)
  "33650": { rentApt: 12.0, rentMaison: 12.1, prixApt: 2800, prixMaison: 3200 }, // La Brède       (ANIL: mai 12.11, apt estimé)

  // ─── Rive droite / est ────────────────────────────────────────────────────
  "33270": { rentApt: 14.2, rentMaison: 13.0, prixApt: 3100, prixMaison: 3500 }, // Floirac / Bouliac (ANIL: apt 14.21 / mai 12.98)
  "33150": { rentApt: 14.2, rentMaison: 11.9, prixApt: 2700, prixMaison: 3000 }, // Cenon          (ANIL: apt 14.17 / mai 11.92)
  "33310": { rentApt: 14.0, rentMaison: 12.7, prixApt: 2500, prixMaison: 2800 }, // Lormont        (ANIL: apt 14.03 / mai 12.70)
  "33530": { rentApt: 13.9, rentMaison: 12.0, prixApt: 2500, prixMaison: 2800 }, // Bassens        (ANIL: apt 13.85 / mai 11.98)
  "33560": { rentApt: 14.0, rentMaison: 12.7, prixApt: 2800, prixMaison: 3100 }, // Carbon-Blanc   (ANIL: apt 14.04 / mai 12.69)
  "33440": { rentApt: 13.6, rentMaison: 11.9, prixApt: 2500, prixMaison: 2800 }, // Ambarès-et-Lagrave (ANIL: apt 13.65 / mai 11.89)
  "33370": { rentApt: 12.7, rentMaison: 11.7, prixApt: 2900, prixMaison: 3300 }, // Artigues-près-Bordeaux (ANIL: apt 12.68 / mai 11.65)
  "33360": { rentApt: 14.4, rentMaison: 14.7, prixApt: 2600, prixMaison: 3000 }, // Carignan-de-Bordeaux (ANIL: apt 14.41 / mai 14.73)
  "33450": { rentApt: 13.5, rentMaison: 11.1, prixApt: 2300, prixMaison: 2700 }, // Saint-Loubès   (ANIL: apt 13.49 / mai 11.11)

  // ─── Nord / nord-ouest ────────────────────────────────────────────────────
  "33110": { rentApt: 15.4, rentMaison: 15.8, prixApt: 4100, prixMaison: 4600 }, // Le Bouscat     (ANIL: apt 15.44 / mai 15.75)
  "33520": { rentApt: 14.8, rentMaison: 13.9, prixApt: 3300, prixMaison: 3700 }, // Bruges         (ANIL: apt 14.83 / mai 13.94)
  "33290": { rentApt: 14.4, rentMaison: 12.6, prixApt: 2900, prixMaison: 3300 }, // Blanquefort    (ANIL: apt 14.37 / mai 12.61)
  "33320": { rentApt: 14.3, rentMaison: 13.8, prixApt: 3100, prixMaison: 3500 }, // Eysines / Le Taillan (ANIL: apt 14.28 / mai 13.78)
  "33185": { rentApt: 14.0, rentMaison: 13.6, prixApt: 3000, prixMaison: 3400 }, // Le Haillan     (ANIL: apt 13.96 / mai 13.59)
  "33160": { rentApt: 14.9, rentMaison: 14.6, prixApt: 2900, prixMaison: 3200 }, // Saint-Médard-en-Jalles (ANIL: apt 14.93 / mai 14.56)
  "33127": { rentApt: 13.9, rentMaison: 13.8, prixApt: 2600, prixMaison: 2900 }, // Martignas / Saint-Jean (ANIL: apt 13.94 / mai 13.84)

  // ─── Ouest ────────────────────────────────────────────────────────────────
  "33700": { rentApt: 14.8, rentMaison: 14.4, prixApt: 3600, prixMaison: 3900 }, // Mérignac       (ANIL: apt 14.80 / mai 14.38)
};

const DEFAULT_ZONE: ZoneData = {
  rentApt: 11.0, rentMaison: 10.0, prixApt: 2600, prixMaison: 2900,
};

function zone(zipcode: string): ZoneData {
  return ZONE[zipcode.substring(0, 5)] ?? DEFAULT_ZONE;
}

function isHouse(propertyType: string) {
  return propertyType === "MAISON";
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Loyer estimé par m² pour un bien donné */
export function rentPerSqmEstimate(zipcode: string, propertyType: string): number {
  const z = zone(zipcode);
  return isHouse(propertyType) ? z.rentMaison : z.rentApt;
}

/** Prix médian par m² pour un bien donné (référence marché achat) */
export function marketPricePerSqm(zipcode: string, propertyType: string): number {
  const z = zone(zipcode);
  return isHouse(propertyType) ? z.prixMaison : z.prixApt;
}

/** Mensualité d'un crédit (capital + intérêts, sans assurance) */
function calcMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || tauxAnnuel <= 0) return capital / (dureeAns * 12);
  const t = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  return (capital * t) / (1 - Math.pow(1 + t, -n));
}

function effectiveRentPerSqm(input: ListingEstimateInput): number {
  return input.rentPerSqmOverride ?? rentPerSqmEstimate(input.zipcode, input.propertyType);
}

/** Loyer mensuel brut estimé (HC) */
export function estimateRent(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5) return null;
  return Math.round(input.surface * effectiveRentPerSqm(input));
}

/** Rendement brut annuel en % */
export function estimateGrossYield(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5 || input.price <= 0) return null;
  const rentAnnuel = input.surface * effectiveRentPerSqm(input) * 12;
  return Math.round((rentAnnuel / input.price) * 1000) / 10; // 1 décimale
}

/** Cash-flow mensuel net estimé */
export function estimateCashFlow(
  input: ListingEstimateInput,
  params: Partial<InvestParams> = {}
): number | null {
  if (!input.surface || input.surface < 5 || input.price <= 0) return null;

  const { apport, taux, duree } = { ...DEFAULT_INVEST_PARAMS, ...params };

  // Revenus
  const loyerBrut    = input.surface * effectiveRentPerSqm(input);
  const loyerEffectif = loyerBrut * 0.92; // 5% vacance + 3% impayés

  // Charges annuelles estimées
  const taxeFonciere  = Math.round(input.surface * 8);                              // ~8€/m²/an
  const copro         = input.propertyType === "APPARTEMENT"
    ? Math.min(2800, Math.round(input.surface * 30)) : 0;                           // ~30€/m²/an (appart. uniquement)
  const assurancePNO  = Math.max(150, Math.round(input.price * 0.0008));            // ~0.08% du prix
  const fraisGestion  = loyerEffectif * 12 * 0.06;                                  // 6% frais gestion locative
  const entretien     = Math.max(500, Math.round(input.price * 0.0015));            // ~0.15% du prix/an

  const chargesMensuelles = (taxeFonciere + copro + assurancePNO + fraisGestion + entretien) / 12;

  // Financement
  const fraisNotaire    = input.price * (input.propertyType === "MAISON" ? 0.075 : 0.08);
  const montantEmprunte = input.price + fraisNotaire - input.price * (apport / 100);
  const mensualiteCredit = calcMensualite(montantEmprunte, taux, duree);
  const mensualiteAssur  = (montantEmprunte * 0.0011) / 12; // 0.11%/an assurance emprunteur

  const mensualiteTotale = mensualiteCredit + mensualiteAssur;

  return Math.round(loyerEffectif - mensualiteTotale - chargesMensuelles);
}

/** Mensualité crédit totale (crédit + assurance emprunteur) */
export function estimateMonthlyCredit(
  price: number,
  propertyType = "APPARTEMENT",
  params: Partial<InvestParams> = {}
): number {
  const { apport, taux, duree } = { ...DEFAULT_INVEST_PARAMS, ...params };
  const fraisNotaire    = price * (propertyType === "MAISON" ? 0.075 : 0.08);
  const montantEmprunte = price + fraisNotaire - price * (apport / 100);
  const mensualite      = calcMensualite(montantEmprunte, taux, duree);
  const assurance       = (montantEmprunte * 0.0011) / 12;
  return Math.round(mensualite + assurance);
}

export interface ChargesBreakdown {
  loyerBrutAnnuel: number;
  loyerEffectifAnnuel: number;
  taxeFonciere: number;
  copro: number;
  assurancePNO: number;
  vacanceLocative: number;
  gli: number;
  gestionLocative: number;
  entretien: number;
  totalCharges: number;
  loyerNetCharges: number; // après charges, avant crédit
}

/** Détail des charges annuelles estimées */
export function estimateChargesBreakdown(input: ListingEstimateInput): ChargesBreakdown | null {
  if (!input.surface || input.surface < 5 || input.price <= 0) return null;

  const loyerBrut = input.surface * effectiveRentPerSqm(input);
  const loyerBrutAnnuel = loyerBrut * 12;

  const vacanceLocative = Math.round(loyerBrutAnnuel * 0.05); // 5% vacance
  const gli             = Math.round(loyerBrutAnnuel * 0.03); // 3% impayés/GLI
  const loyerEffectifAnnuel = loyerBrutAnnuel - vacanceLocative - gli;

  const taxeFonciere   = Math.round(input.surface * 8);
  const copro          = input.propertyType === "APPARTEMENT"
    ? Math.min(2800, Math.round(input.surface * 30)) : 0;
  const assurancePNO   = Math.max(150, Math.round(input.price * 0.0008));
  const gestionLocative = Math.round(loyerEffectifAnnuel * 0.06);
  const entretien      = Math.max(500, Math.round(input.price * 0.0015));

  const totalCharges = taxeFonciere + copro + assurancePNO + vacanceLocative + gli + gestionLocative + entretien;
  const loyerNetCharges = loyerEffectifAnnuel - taxeFonciere - copro - assurancePNO - gestionLocative - entretien;

  return { loyerBrutAnnuel, loyerEffectifAnnuel, taxeFonciere, copro, assurancePNO, vacanceLocative, gli, gestionLocative, entretien, totalCharges, loyerNetCharges };
}

/** Rendement net après charges (avant crédit) en % */
export function estimateNetYield(input: ListingEstimateInput): number | null {
  const b = estimateChargesBreakdown(input);
  if (!b) return null;
  return Math.round((b.loyerNetCharges / input.price) * 1000) / 10;
}

/** Prix par m² d'une annonce */
export function estimatePricePerSqm(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5) return null;
  return Math.round(input.price / input.surface);
}
