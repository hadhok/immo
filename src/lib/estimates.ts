export interface ListingEstimateInput {
  price: number;
  surface?: number | null;
  zipcode: string;
  propertyType: string;
}

// Loyer moyen par m² selon le secteur (Gironde, source: observatoires loyers 2024)
function rentPerSqmEstimate(zipcode: string, propertyType: string): number {
  const z = zipcode.substring(0, 5);
  const isHouse = propertyType === "MAISON";

  // Bordeaux intra-muros
  if (["33000", "33100", "33200", "33300"].includes(z)) return isHouse ? 12.0 : 14.5;
  // Proche périphérie (Mérignac, Pessac, Talence, Bègles, Villenave, Floirac)
  if (["33600", "33700", "33130", "33140", "33170", "33270", "33310", "33400"].includes(z)) return isHouse ? 10.5 : 12.5;
  // Arcachon / bassin
  if (["33120", "33260", "33680", "33470"].includes(z)) return isHouse ? 11.0 : 13.0;
  // Libourne, Blaye, Langon…
  return isHouse ? 8.5 : 10.0;
}

function calcMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || tauxAnnuel <= 0) return 0;
  const t = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  return (capital * t) / (1 - Math.pow(1 + t, -n));
}

// Hypothèses par défaut : 20% apport, 20 ans, 3.5%, assurance 0.1%/an
const DEFAULT_APPORT_RATIO = 0.20;
const DEFAULT_TAUX = 3.5;
const DEFAULT_DUREE = 20;
const DEFAULT_ASSURANCE = 0.001; // 0.1% annuel du capital

export function estimateRent(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5) return null;
  return Math.round(input.surface * rentPerSqmEstimate(input.zipcode, input.propertyType));
}

export function estimateCashFlow(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5) return null;

  const rentBrut = input.surface * rentPerSqmEstimate(input.zipcode, input.propertyType);
  const rentEffectif = rentBrut * 0.95; // 5% vacance

  // Charges annuelles estimées
  const taxeFonciere = input.surface * 6; // ~6€/m²/an en Gironde
  const copro = input.propertyType === "APPARTEMENT" ? Math.min(2400, input.surface * 28) : 0;
  const assurancePNO = 200;
  const fraisGestion = rentEffectif * 12 * 0.08; // 8% du loyer annuel effectif
  const entretien = Math.max(400, input.price * 0.002);
  const chargesMensuelle = (taxeFonciere + copro + assurancePNO + fraisGestion + entretien) / 12;

  // Crédit
  const fraisNotaire = input.price * 0.08;
  const montantEmprunte = input.price + fraisNotaire - input.price * DEFAULT_APPORT_RATIO;
  const mensualiteCredit = calcMensualite(montantEmprunte, DEFAULT_TAUX, DEFAULT_DUREE);
  const mensualiteAssurance = (montantEmprunte * DEFAULT_ASSURANCE) / 12;
  const mensualiteTotale = mensualiteCredit + mensualiteAssurance;

  return Math.round(rentEffectif - mensualiteTotale - chargesMensuelle);
}

export function estimatePricePerSqm(input: ListingEstimateInput): number | null {
  if (!input.surface || input.surface < 5) return null;
  return Math.round(input.price / input.surface);
}
