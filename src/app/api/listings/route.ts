import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PropertyType } from "@/types/listing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const page = parseInt(sp.get("page") || "1", 10);
  const limit = Math.min(parseInt(sp.get("limit") || "20", 10), 100);
  const skip = (page - 1) * limit;

  const where: Prisma.ListingWhereInput = {
    isActive: true,
  };

  const city = sp.get("city");
  if (city) where.city = { contains: city, mode: "insensitive" };

  const zipcode = sp.get("zipcode");
  if (zipcode) where.zipcode = { startsWith: zipcode };

  const source = sp.get("source");
  if (source) where.source = source;

  const propertyType = sp.get("propertyType") as PropertyType | null;
  if (propertyType) where.propertyType = propertyType;

  const priceMin = sp.get("priceMin");
  const priceMax = sp.get("priceMax");
  if (priceMin || priceMax) {
    where.price = {};
    if (priceMin) where.price.gte = parseInt(priceMin, 10);
    if (priceMax) where.price.lte = parseInt(priceMax, 10);
  }

  const surfaceMin = sp.get("surfaceMin");
  const surfaceMax = sp.get("surfaceMax");
  if (surfaceMin || surfaceMax) {
    where.surface = {};
    if (surfaceMin) where.surface.gte = parseFloat(surfaceMin);
    if (surfaceMax) where.surface.lte = parseFloat(surfaceMax);
  }

  const rooms = sp.get("rooms");
  if (rooms) where.rooms = { gte: parseInt(rooms, 10) };

  const sinceHours = sp.get("sinceHours");
  if (sinceHours) {
    const since = new Date();
    since.setHours(since.getHours() - parseInt(sinceHours, 10));
    where.scrapedAt = { gte: since };
  }

  const sortBy = sp.get("sortBy") || "scrapedAt";
  const sortOrder = (sp.get("sortOrder") || "desc") as "asc" | "desc";
  const validSorts = ["scrapedAt", "price", "surface", "publicationDate"];
  const orderBy = validSorts.includes(sortBy) ? { [sortBy]: sortOrder } : { scrapedAt: "desc" as const };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, skip, take: limit }),
    prisma.listing.count({ where }),
  ]);

  return Response.json({
    data: listings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
