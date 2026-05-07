import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/api/listings/[id]">) {
  const { id } = await ctx.params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return Response.json({ error: "Not found" }, { status: 404 });

  // Récupère le loyer de référence pour calculer la rentabilité estimée
  const rentRef = await prisma.rentReference.findUnique({
    where: {
      zipcode_propertyType: {
        zipcode: listing.zipcode,
        propertyType: listing.propertyType,
      },
    },
  });

  return Response.json({ data: listing, rentReference: rentRef });
}
