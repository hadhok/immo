import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// INSEE → zipcode mapping for Bordeaux metro area communes
// Source: ANIL Carte des Loyers 2025 + Code officiel géographique
const INSEE_TO_ZIPCODE: Record<string, string> = {
  // Bordeaux intra-muros → 33000 (centre, on stocke une seule entrée pour Bordeaux)
  "33063": "33000",
  // Première couronne sud
  "33522": "33400", // Talence
  "33039": "33130", // Bègles
  "33550": "33140", // Villenave-d'Ornon
  "33192": "33170", // Gradignan
  "33318": "33600", // Pessac
  "33122": "33610", // Cestas
  "33238": "33850", // Léognan
  "33213": "33650", // La Brède
  // Rive droite / est
  "33167": "33270", // Floirac
  "33065": "33270", // Bouliac (même zipcode que Floirac)
  "33119": "33150", // Cenon
  "33249": "33310", // Lormont
  "33032": "33530", // Bassens
  "33096": "33560", // Carbon-Blanc
  "33003": "33440", // Ambarès-et-Lagrave
  "33013": "33370", // Artigues-près-Bordeaux
  "33099": "33360", // Carignan-de-Bordeaux
  "33433": "33450", // Saint-Loubès
  // Nord / nord-ouest
  "33069": "33110", // Le Bouscat
  "33075": "33520", // Bruges
  "33056": "33290", // Blanquefort
  "33162": "33320", // Eysines
  "33200": "33185", // Le Haillan
  "33449": "33160", // Saint-Médard-en-Jalles
  "33273": "33127", // Martignas-sur-Jalle
  // Ouest
  "33281": "33700", // Mérignac
};

// Weighted average when multiple INSEE map to same zipcode (used for Floirac+Bouliac → 33270)
async function fetchCSV(url: string): Promise<Map<string, number>> {
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  const header = lines[0].split(";").map((h) => h.replace(/"/g, "").trim());
  const inseeIdx = header.indexOf("INSEE_C");
  const loyerIdx = header.indexOf("loypredm2");
  const obsIdx   = header.indexOf("nbobs_com");

  const map = new Map<string, number>();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(";");
    const insee = cols[inseeIdx]?.replace(/"/g, "").trim();
    const obs   = parseInt(cols[obsIdx]?.replace(/"/g, "").trim() ?? "0", 10);
    const loyer = parseFloat(cols[loyerIdx]?.replace(/"/g, "").replace(",", ".").trim() ?? "0");
    if (insee && obs > 0 && loyer > 0) map.set(insee, loyer);
  }
  return map;
}

export async function POST() {
  try {
    const APT_CSV = "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145010/pred-app-mef-dhup.csv";
    const MAI_CSV = "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145039/pred-mai-mef-dhup.csv";

    const [aptMap, maiMap] = await Promise.all([fetchCSV(APT_CSV), fetchCSV(MAI_CSV)]);

    // Aggregate by zipcode (weighted average when multiple INSEE → same zipcode)
    const byZip: Record<string, { apt: number[]; mai: number[]; city: string }> = {};

    const CITY_NAMES: Record<string, string> = {
      "33000": "Bordeaux", "33400": "Talence", "33130": "Bègles",
      "33140": "Villenave-d'Ornon", "33170": "Gradignan", "33600": "Pessac",
      "33610": "Cestas", "33850": "Léognan", "33650": "La Brède",
      "33270": "Floirac", "33150": "Cenon", "33310": "Lormont",
      "33530": "Bassens", "33560": "Carbon-Blanc", "33440": "Ambarès-et-Lagrave",
      "33370": "Artigues-près-Bordeaux", "33360": "Carignan-de-Bordeaux",
      "33450": "Saint-Loubès", "33110": "Le Bouscat", "33520": "Bruges",
      "33290": "Blanquefort", "33320": "Eysines", "33185": "Le Haillan",
      "33160": "Saint-Médard-en-Jalles", "33127": "Martignas-sur-Jalle",
      "33700": "Mérignac",
    };

    for (const [insee, zip] of Object.entries(INSEE_TO_ZIPCODE)) {
      if (!byZip[zip]) byZip[zip] = { apt: [], mai: [], city: CITY_NAMES[zip] ?? zip };
      const apt = aptMap.get(insee);
      const mai = maiMap.get(insee);
      if (apt) byZip[zip].apt.push(apt);
      if (mai) byZip[zip].mai.push(mai);
    }

    const upserts: Promise<unknown>[] = [];

    for (const [zip, data] of Object.entries(byZip)) {
      const aptAvg = data.apt.length > 0
        ? Math.round((data.apt.reduce((a, b) => a + b, 0) / data.apt.length) * 10) / 10
        : 0;
      const maiAvg = data.mai.length > 0
        ? Math.round((data.mai.reduce((a, b) => a + b, 0) / data.mai.length) * 10) / 10
        : 0;

      if (aptAvg > 0) {
        upserts.push(
          prisma.rentReference.upsert({
            where: { zipcode_propertyType: { zipcode: zip, propertyType: "APPARTEMENT" } },
            update: { avgRentPerSqm: aptAvg, city: data.city },
            create: { zipcode: zip, propertyType: "APPARTEMENT", avgRentPerSqm: aptAvg, city: data.city },
          })
        );
      }
      if (maiAvg > 0) {
        upserts.push(
          prisma.rentReference.upsert({
            where: { zipcode_propertyType: { zipcode: zip, propertyType: "MAISON" } },
            update: { avgRentPerSqm: maiAvg, city: data.city },
            create: { zipcode: zip, propertyType: "MAISON", avgRentPerSqm: maiAvg, city: data.city },
          })
        );
      }
    }

    await Promise.all(upserts);

    const total = await prisma.rentReference.count();
    return NextResponse.json({ ok: true, seeded: upserts.length, total });
  } catch (err) {
    console.error("[seed-rents]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const rows = await prisma.rentReference.findMany({ orderBy: { zipcode: "asc" } });
  return NextResponse.json(rows);
}
