import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateFollowerSnapshots, aggregateFollowerGrowth } from "@/lib/mock/generator";

type FollowerNetwork = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";

/**
 * GET /api/followers?brand=&network=INSTAGRAM|FACEBOOK|TIKTOK&days=30
 * Devuelve el histórico de seguidores y el crecimiento del período.
 */
export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const network = (req.nextUrl.searchParams.get("network") ?? "INSTAGRAM") as FollowerNetwork;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const series = generateFollowerSnapshots(brand.slug as BrandSlug, network, days);
    const growth = aggregateFollowerGrowth(series);
    return NextResponse.json({ series, ...growth, source: "mock" });
  }

  const prisma = await getPrisma();
  const dbBrand = await prisma.brand.findUnique({ where: { slug: brand.slug as never } });
  if (!dbBrand) return NextResponse.json({ error: "La marca todavía no existe en la base de datos." }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.followerSnapshot.findMany({
    where: { brandId: dbBrand.id, network: network as never, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  type Row = (typeof rows)[number];
  const series = rows.map((r: Row) => ({
    date: r.date.toISOString().slice(0, 10),
    followers: r.followers,
    newFollowers: r.newFollowers,
  }));
  const growth = aggregateFollowerGrowth(series);

  return NextResponse.json({ series, ...growth, source: "database" });
}
