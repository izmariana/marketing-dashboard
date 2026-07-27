import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateGaDailyMetrics, aggregateGaMetrics } from "@/lib/mock/generator";
import { comparePlatforms } from "@/lib/services/compare-platforms";
import type { MetricPoint } from "@/types/domain";
import type { GaMetricPoint } from "@/lib/mock/generator";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  let meta: MetricPoint;
  let ga: GaMetricPoint;

  if (!isDatabaseConfigured) {
    meta = aggregateMetrics(generateDailyMetrics(brand.slug as BrandSlug, days));
    ga = aggregateGaMetrics(generateGaDailyMetrics(brand.slug as BrandSlug, days));
  } else {
    const prisma = await getPrisma();
    const dbBrand = await prisma.brand.findUnique({ where: { slug: brand.slug as never } });
    if (!dbBrand) return NextResponse.json({ error: "La marca todavía no existe en la base de datos." }, { status: 404 });

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [metaSnaps, gaSnaps] = await Promise.all([
      prisma.metricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: since } } }),
      prisma.gaMetricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: since } } }),
    ]);

    type MetaSnap = (typeof metaSnaps)[number];
    type GaSnap = (typeof gaSnaps)[number];

    const metaPoints: MetricPoint[] = metaSnaps.map((r: MetaSnap) => ({
      date: r.date.toISOString().slice(0, 10),
      spend: Number(r.spend),
      reach: r.reach,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: Number(r.ctr),
      cpc: Number(r.cpc),
      cpm: Number(r.cpm),
      leads: r.leads,
      cpl: Number(r.cpl ?? 0),
      conversions: r.conversions,
      conversionRate: Number(r.conversionRate ?? 0),
      roas: r.roas ? Number(r.roas) : null,
      frequency: Number(r.frequency),
    }));

    const gaPoints: GaMetricPoint[] = gaSnaps.map((r: GaSnap) => ({
      date: r.date.toISOString().slice(0, 10),
      users: r.users,
      newUsers: r.newUsers,
      sessions: r.sessions,
      engagedSessions: r.engagedSessions,
      engagementRate: Number(r.engagementRate),
      avgEngagementSec: Number(r.avgEngagementSec),
      pageViews: r.pageViews,
      eventCount: r.eventCount,
      conversions: r.conversions,
      conversionRate: Number(r.conversionRate),
    }));

    meta = aggregateMetrics(metaPoints);
    ga = aggregateGaMetrics(gaPoints);
  }

  const comparison = comparePlatforms(meta, ga);
  return NextResponse.json({ brand, meta, ga, ...comparison, source: isDatabaseConfigured ? "database" : "mock" });
}
