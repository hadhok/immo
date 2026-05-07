import { NextResponse } from "next/server";

export async function GET() {
  const info: Record<string, unknown> = {
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL?.slice(0, 30) + "...",
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.listing.count();
    info.dbConnected = true;
    info.listingCount = count;
  } catch (e: unknown) {
    info.dbConnected = false;
    info.error = e instanceof Error ? e.message : String(e);
    info.stack = e instanceof Error ? e.stack?.slice(0, 500) : undefined;
  }

  return NextResponse.json(info);
}
