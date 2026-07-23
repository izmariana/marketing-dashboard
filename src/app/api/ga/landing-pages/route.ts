import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateGaLandingPages } from "@/lib/mock/generator";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const pages = generateGaLandingPages(brand.slug as BrandSlug);
    return NextResponse.json({ pages, source: "mock" });
  }

  const prisma = await getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const rows = await prisma.gaLandingPage.findMany({ where: { brandId: brand.id, date: { gte: since } } });

  type Row = (typeof rows)[number];
  const grouped = new Map<string, { path: string; title: string; users: number; sessions: number; engagementRate: number; conversions: number; avgEngagementSec: number; exitRate: number; count: number }>();
  for (const r of rows as Row[]) {
    const g = grouped.get(r.path) ?? { path: r.path, title: r.title ?? "", users: 0, sessions: 0, engagementRate: 0, conversions: 0, avgEngagementSec: 0, exitRate: 0, count: 0 };
    g.users += r.users;
    g.sessions += r.sessions;
    g.conversions += r.conversions;
    g.engagementRate += Number(r.engagementRate);
    g.avgEngagementSec += Number(r.avgEngagementSec);
    g.exitRate += Number(r.exitRate);
    g.count += 1;
    grouped.set(r.path, g);
  }

  const pages = Array.from(grouped.values())
    .map((g) => ({
      path: g.path,
      title: g.title,
      users: g.users,
      sessions: g.sessions,
      conversions: g.conversions,
      engagementRate: g.count ? Number((g.engagementRate / g.count).toFixed(2)) : 0,
      avgEngagementSec: g.count ? Number((g.avgEngagementSec / g.count).toFixed(0)) : 0,
      exitRate: g.count ? Number((g.exitRate / g.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return NextResponse.json({ pages, source: "database" });
}
