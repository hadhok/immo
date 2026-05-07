import { prisma } from "@/lib/prisma";
import type { ListingData, ScraperResult } from "@/types/listing";

export abstract class BaseScraper {
  abstract source: string;
  protected runId: string | null = null;

  abstract fetchListings(): Promise<ListingData[]>;

  async run(): Promise<ScraperResult> {
    const run = await prisma.scraperRun.create({
      data: { source: this.source, status: "RUNNING" },
    });
    this.runId = run.id;

    try {
      const listings = await this.fetchListings();
      const { added, updated } = await this.upsertListings(listings);

      await prisma.scraperRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          listingsAdded: added,
          listingsUpdated: updated,
          listingsTotal: listings.length,
          status: "SUCCESS",
        },
      });

      return { source: this.source, added, updated, total: listings.length, status: "SUCCESS" };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const status = errorMsg.includes("block") || errorMsg.includes("403") ? "BLOCKED" : "ERROR";

      await prisma.scraperRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status, errorMsg },
      });

      return { source: this.source, added: 0, updated: 0, total: 0, status, errorMsg };
    }
  }

  private async upsertListings(listings: ListingData[]): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const listing of listings) {
      const existing = await prisma.listing.findUnique({
        where: { sourceUrl: listing.sourceUrl },
      });

      if (existing) {
        await prisma.listing.update({
          where: { sourceUrl: listing.sourceUrl },
          data: { ...listing, isActive: true },
        });
        updated++;
      } else {
        await prisma.listing.create({ data: listing });
        added++;
      }
    }

    return { added, updated };
  }
}
