import { PapScraper } from "@/lib/scrapers/pap";
import { BieniciScraper } from "@/lib/scrapers/bienici";

async function run() {
  console.log("=== Lancement PAP ===");
  const papResult = await new PapScraper().run();
  console.log("PAP:", papResult);

  console.log("\n=== Lancement BienIci ===");
  const biResult = await new BieniciScraper().run();
  console.log("BienIci:", biResult);
}

run().catch(console.error);
