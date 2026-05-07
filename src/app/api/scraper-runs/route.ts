import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");

  const runs = await prisma.scraperRun.findMany({
    where: source ? { source } : undefined,
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return Response.json({ data: runs });
}
