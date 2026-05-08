export interface AcquisitionParams {
  prixAffiche: number;
  fraisAgence: number; // € (0 si inclus dans le prix)
  travaux: number;
  mobilier: number;
  fraisNotaireMode: "auto" | "manuel";
  fraisNotaireManuel: number; // € si mode manuel
  bienNeuf: boolean;
}

export interface FinancementParams {
  mode: "comptant" | "credit";
  apport: number; // €
  tauxInteret: number; // % annuel ex: 3.5
  dureeAns: number; // ex: 20
  assuranceEmprunteur: number; // % annuel du capital ex: 0.1
}

export interface RevenuParams {
  loyerMensuelHC: number;
  chargesRecuperables: number; // €/mois
  vacanceLocative: number; // % annuel ex: 5
}

export interface ChargesParams {
  taxeFonciere: number; // €/an
  chargesCopro: number; // €/an (non récup.)
  assurancePNO: number; // €/an
  fraisGestion: number; // % du loyer annuel
  entretien: number; // €/an
}

export interface CalculatorInput {
  acquisition: AcquisitionParams;
  financement: FinancementParams;
  revenus: RevenuParams;
  charges: ChargesParams;
}

export interface AmortissementRow {
  mois: number;
  capitalRestant: number;
  interets: number;
  capital: number;
  mensualite: number;
}

export interface CalculatorResult {
  // Acquisition
  prixNetVendeur: number;
  fraisNotaire: number;
  coutTotalAcquisition: number;

  // Financement
  montantEmprunte: number;
  mensualiteCredit: number;
  mensualiteAssurance: number;
  mensualiteTotale: number;

  // Revenus
  loyerAnnuelBrut: number;
  loyerAnnuelEffectif: number;

  // Charges
  totalChargesAnnuelles: number;

  // Rentabilité
  rentabiliteBrute: number; // %
  rentabiliteNette: number; // %

  // Cash-flow
  cashFlowMensuelBrut: number; // loyer HC - mensualite crédit
  cashFlowMensuelNet: number; // loyer effectif - mensualite - charges/12
  pointMortLocatif: number; // loyer min pour CF = 0

  // Tableau d'amortissement
  amortissement: AmortissementRow[];
}

function calcFraisNotaireAncien(prixNetVendeur: number): number {
  // DMTO Gironde : 5.8066% + CSI 0.10% = 5.9066%
  const droitsMutation = prixNetVendeur * 0.059066;

  // Émoluments notaire (barème dégressif)
  let emoluments = 0;
  if (prixNetVendeur <= 6500) {
    emoluments = prixNetVendeur * 0.03945;
  } else if (prixNetVendeur <= 17000) {
    emoluments = 6500 * 0.03945 + (prixNetVendeur - 6500) * 0.01627;
  } else if (prixNetVendeur <= 60000) {
    emoluments = 6500 * 0.03945 + 10500 * 0.01627 + (prixNetVendeur - 17000) * 0.01085;
  } else {
    emoluments =
      6500 * 0.03945 + 10500 * 0.01627 + 43000 * 0.01085 + (prixNetVendeur - 60000) * 0.00814;
  }
  emoluments = emoluments * 1.2; // TVA 20%

  const debours = 1350;

  return Math.round(droitsMutation + emoluments + debours);
}

function calcFraisNotaireNeuf(prixNetVendeur: number): number {
  // Neuf : droits réduits (TVA incluse dans le prix) + CSI 0.10%
  const droitsMutation = prixNetVendeur * 0.00815; // 0.715% DMTO réduit + 0.10% CSI
  let emoluments = 0;
  if (prixNetVendeur <= 6500) {
    emoluments = prixNetVendeur * 0.03945;
  } else if (prixNetVendeur <= 17000) {
    emoluments = 6500 * 0.03945 + (prixNetVendeur - 6500) * 0.01627;
  } else if (prixNetVendeur <= 60000) {
    emoluments = 6500 * 0.03945 + 10500 * 0.01627 + (prixNetVendeur - 17000) * 0.01085;
  } else {
    emoluments =
      6500 * 0.03945 + 10500 * 0.01627 + 43000 * 0.01085 + (prixNetVendeur - 60000) * 0.00814;
  }
  emoluments = emoluments * 1.2;
  const debours = 1350;
  return Math.round(droitsMutation + emoluments + debours);
}

function calcMensualiteCredit(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0 || tauxAnnuel <= 0) return 0;
  const t = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  return Math.round((capital * t) / (1 - Math.pow(1 + t, -n)));
}

function buildAmortissement(
  capital: number,
  tauxAnnuel: number,
  dureeAns: number,
  mensualite: number
): AmortissementRow[] {
  const rows: AmortissementRow[] = [];
  let restant = capital;
  const t = tauxAnnuel / 100 / 12;

  for (let mois = 1; mois <= dureeAns * 12 && restant > 0; mois++) {
    const interets = Math.round(restant * t * 100) / 100;
    const capitalRow = Math.min(mensualite - interets, restant);
    restant = Math.max(0, restant - capitalRow);
    rows.push({ mois, capitalRestant: Math.round(restant), interets, capital: Math.round(capitalRow), mensualite });
  }
  return rows;
}

export function calculate(input: CalculatorInput): CalculatorResult {
  const { acquisition, financement, revenus, charges } = input;

  // --- Acquisition ---
  const prixNetVendeur = acquisition.prixAffiche - acquisition.fraisAgence;

  let fraisNotaire: number;
  if (acquisition.fraisNotaireMode === "manuel") {
    fraisNotaire = acquisition.fraisNotaireManuel;
  } else {
    fraisNotaire = acquisition.bienNeuf
      ? calcFraisNotaireNeuf(prixNetVendeur)
      : calcFraisNotaireAncien(prixNetVendeur);
  }

  const coutTotalAcquisition =
    prixNetVendeur + fraisNotaire + acquisition.travaux + acquisition.mobilier;

  // --- Financement ---
  let montantEmprunte = 0;
  let mensualiteCredit = 0;
  let mensualiteAssurance = 0;
  let amortissement: AmortissementRow[] = [];

  if (financement.mode === "credit") {
    montantEmprunte = Math.max(0, coutTotalAcquisition - financement.apport);
    mensualiteCredit = calcMensualiteCredit(
      montantEmprunte,
      financement.tauxInteret,
      financement.dureeAns
    );
    mensualiteAssurance = Math.round(
      (montantEmprunte * (financement.assuranceEmprunteur / 100)) / 12
    );
    amortissement = buildAmortissement(
      montantEmprunte,
      financement.tauxInteret,
      financement.dureeAns,
      mensualiteCredit
    );
  }
  const mensualiteTotale = mensualiteCredit + mensualiteAssurance;

  // --- Revenus ---
  const loyerAnnuelBrut = revenus.loyerMensuelHC * 12;
  const loyerAnnuelEffectif = loyerAnnuelBrut * (1 - revenus.vacanceLocative / 100);

  // --- Charges ---
  const fraisGestionAnnuels = (loyerAnnuelEffectif * charges.fraisGestion) / 100;
  const totalChargesAnnuelles =
    charges.taxeFonciere +
    charges.chargesCopro +
    charges.assurancePNO +
    fraisGestionAnnuels +
    charges.entretien;

  // --- Rentabilité ---
  const rentabiliteBrute =
    coutTotalAcquisition > 0 ? (loyerAnnuelBrut / coutTotalAcquisition) * 100 : 0;

  const rentabiliteNette =
    coutTotalAcquisition > 0
      ? ((loyerAnnuelEffectif - totalChargesAnnuelles) / coutTotalAcquisition) * 100
      : 0;

  // --- Cash-flow ---
  const cashFlowMensuelBrut = revenus.loyerMensuelHC - mensualiteTotale;
  const cashFlowMensuelNet =
    loyerAnnuelEffectif / 12 - mensualiteTotale - totalChargesAnnuelles / 12;

  // Point mort : loyer minimum pour cash-flow net = 0
  // loyerEffectif/12 = mensualiteTotale + charges/12
  // loyer * (1 - vacance/100) / 12 = mensualiteTotale + charges/12 (hors fraisGestion)
  const chargesSansGestion =
    (charges.taxeFonciere + charges.chargesCopro + charges.assurancePNO + charges.entretien) / 12;
  const vacanceFactor = 1 - revenus.vacanceLocative / 100;
  const gestionFactor = 1 - charges.fraisGestion / 100;
  const pointMortLocatif =
    vacanceFactor > 0 && gestionFactor > 0
      ? (mensualiteTotale + chargesSansGestion) / (vacanceFactor * gestionFactor)
      : 0;

  return {
    prixNetVendeur: Math.round(prixNetVendeur),
    fraisNotaire: Math.round(fraisNotaire),
    coutTotalAcquisition: Math.round(coutTotalAcquisition),
    montantEmprunte: Math.round(montantEmprunte),
    mensualiteCredit: Math.round(mensualiteCredit),
    mensualiteAssurance: Math.round(mensualiteAssurance),
    mensualiteTotale: Math.round(mensualiteTotale),
    loyerAnnuelBrut: Math.round(loyerAnnuelBrut),
    loyerAnnuelEffectif: Math.round(loyerAnnuelEffectif),
    totalChargesAnnuelles: Math.round(totalChargesAnnuelles),
    rentabiliteBrute: Math.round(rentabiliteBrute * 100) / 100,
    rentabiliteNette: Math.round(rentabiliteNette * 100) / 100,
    cashFlowMensuelBrut: Math.round(cashFlowMensuelBrut),
    cashFlowMensuelNet: Math.round(cashFlowMensuelNet),
    pointMortLocatif: Math.round(pointMortLocatif),
    amortissement,
  };
}
