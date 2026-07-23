import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateGaEvents } from "@/lib/mock/generator";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const events = generateGaEvents(brand.slug as BrandSlug);
    return NextResponse.json({ events, source: "mock" });
  }

  const prisma = await getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await prisma.gaEvent.findMany({ where: { brandId: brand.id, date: { gte: since } } });

  type Row = (typeof rows)[number];
  const grouped = new Map<string, { eventName: string; eventCount: number; totalUsers: number; isConversion: boolean }>();
  for (const r of rows as Row[]) {
    const g = grouped.get(r.eventName) ?? { eventName: r.eventName, eventCount: 0, totalUsers: 0, isConversion: r.isConversion };
    g.eventCount += r.eventCount;
    g.totalUsers += r.totalUsers;
    grouped.set(r.eventName, g);
  }

  const events = Array.from(grouped.values()).sort((a, b) => b.eventCount - a.eventCount);

  return NextResponse.json({ events, source: "database" });
}
