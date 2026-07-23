import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateGaDailyMetrics, aggregateGaMetrics, type GaMetricPoint } from "@/lib/mock/generator";

/**
 * GET /api/ga/summary?brand=&days=30
 * Devuelve KPIs actuales, período anterior, y la serie diaria para graficar.
 * Mientras no haya credenciales reales de GA4 conectadas, sirve datos de
 * ejemplo con la misma forma que la API real (misma estrategia que Meta).
 */
export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  let current: GaMetricPoint;
  let previous: GaMetricPoint;
  let series: GaMetricPoint[];

  if (!isDatabaseConfigured) {
    const currentEnd = new Date();
    const previousEnd = new Date();
    previousEnd.setDate(previousEnd.getDate() - days);

    series = generateGaDailyMetrics(brand.slug as BrandSlug, days, currentEnd);
    current = aggregateGaMetrics(series);
    previous = aggregateGaMetrics(generateGaDailyMetrics(brand.slug as BrandSlug, days, previousEnd));
  } else {
    const prisma = await getPrisma();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const prevSince = new Date();
    prevSince.setDate(prevSince.getDate() - days * 2);

    const [currentSnaps, previousSnaps] = await Promise.all([
      prisma.gaMetricSnapshot.findMany({ where: { brandId: brand.id, grain: "DAILY", date: { gte: since } }, orderBy: { date: "asc" } }),
      prisma.gaMetricSnapshot.findMany({ where: { brandId: brand.id, grain: "DAILY", date: { gte: prevSince, lt: since } } }),
    ]);

    type SnapRow = (typeof currentSnaps)[number];
    const toPoint = (r: SnapRow): GaMetricPoint => ({
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
    });

    series = currentSnaps.map(toPoint);
    current = aggregateGaMetrics(series);
    previous = aggregateGaMetrics(previousSnaps.map(toPoint));
  }

  return NextResponse.json({ brand, current, previous, series, source: isDatabaseConfigured ? "database" : "mock" });
}
