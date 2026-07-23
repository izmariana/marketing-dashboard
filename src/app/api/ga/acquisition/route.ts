import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateGaTrafficSources } from "@/lib/mock/generator";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const sources = generateGaTrafficSources(brand.slug as BrandSlug);
    return NextResponse.json({ sources, source: "mock" });
  }

  const prisma = await getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await prisma.gaTrafficSource.findMany({ where: { brandId: brand.id, date: { gte: since } } });

  type Row = (typeof rows)[number];
  const grouped = new Map<string, { channel: string; source: string; users: number; sessions: number; engagementRate: number; conversions: number; avgEngagementSec: number; count: number }>();
  for (const r of rows as Row[]) {
    const key = `${r.channel}::${r.source}`;
    const g = grouped.get(key) ?? { channel: r.channel, source: r.source ?? "(direct)", users: 0, sessions: 0, engagementRate: 0, conversions: 0, avgEngagementSec: 0, count: 0 };
    g.users += r.users;
    g.sessions += r.sessions;
    g.conversions += r.conversions;
    g.engagementRate += Number(r.engagementRate);
    g.avgEngagementSec += Number(r.avgEngagementSec);
    g.count += 1;
    grouped.set(key, g);
  }

  const sources = Array.from(grouped.values()).map((g) => ({
    channel: g.channel,
    source: g.source,
    users: g.users,
    sessions: g.sessions,
    conversions: g.conversions,
    engagementRate: g.count ? Number((g.engagementRate / g.count).toFixed(2)) : 0,
    avgEngagementSec: g.count ? Number((g.avgEngagementSec / g.count).toFixed(0)) : 0,
  }));

  return NextResponse.json({ sources, source: "database" });
}
