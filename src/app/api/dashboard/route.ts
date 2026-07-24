import { NextRequest, NextResponse } from "next/server";
import { BRANDS } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateAlerts } from "@/lib/mock/generator";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import type { MetricPoint, Alert } from "@/types/domain";

/**
 * GET /api/dashboard?days=30
 *
 * Con base de datos conectada, trae el histórico real de cada marca desde
 * MetricSnapshot y las alertas reales desde Alert. En modo simulado, sirve
 * datos de ejemplo con la misma forma.
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brandsData = await Promise.all(
    BRANDS.map(async (brand) => {
      if (!isDatabaseConfigured) {
        const currentEnd = new Date();
        const previousEnd = new Date();
        previousEnd.setDate(previousEnd.getDate() - days);

        const currentSeries = generateDailyMetrics(brand.slug, days, currentEnd);
        const previousSeries = generateDailyMetrics(brand.slug, days, previousEnd);

        const current = aggregateMetrics(currentSeries);
        const previous = aggregateMetrics(previousSeries);
        const alerts = generateAlerts(brand.slug);

        return { brand, current, previous, series: currentSeries, alerts };
      }

      try {
        const prisma = await getPrisma();
        const dbBrand = await prisma.brand.findUnique({ where: { slug: brand.slug as never } });
        if (!dbBrand) {
          return { brand, current: emptyMetricPoint(), previous: emptyMetricPoint(), series: [], alerts: [] as Alert[] };
        }

        const currentEnd = new Date();
        const currentSince = new Date(currentEnd);
        currentSince.setDate(currentSince.getDate() - (days - 1));
        const previousEnd = new Date(currentSince);
        previousEnd.setDate(previousEnd.getDate() - 1);
        const previousSince = new Date(previousEnd);
        previousSince.setDate(previousSince.getDate() - (days - 1));

        const [currentSnaps, previousSnaps, alertRows] = await Promise.all([
          prisma.metricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: currentSince, lte: currentEnd } }, orderBy: { date: "asc" } }),
          prisma.metricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: previousSince, lte: previousEnd } } }),
          prisma.alert.findMany({ where: { brandId: dbBrand.id }, orderBy: { createdAt: "desc" }, take: 20 }),
        ]);

        type SnapRow = (typeof currentSnaps)[number];
        const toPoint = (r: SnapRow): MetricPoint => ({
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
        });

        const series = currentSnaps.map(toPoint);
        const current = aggregateMetrics(series);
        const previous = aggregateMetrics(previousSnaps.map(toPoint));

        type AlertRow = (typeof alertRows)[number];
        const alerts: Alert[] = alertRows.map((a: AlertRow) => ({
          id: a.id,
          brandSlug: brand.slug,
          type: a.type,
          severity: a.severity,
          message: a.message,
          recommendation: a.recommendation,
          createdAt: a.createdAt.toISOString(),
          isRead: a.isRead,
        }));

        return { brand, current, previous, series, alerts };
      } catch (err) {
        console.error(`Error cargando datos reales de ${brand.slug}:`, err);
        return { brand, current: emptyMetricPoint(), previous: emptyMetricPoint(), series: [], alerts: [] as Alert[] };
      }
    })
  );

  const totalAlerts = brandsData.reduce((acc, b) => acc + b.alerts.filter((a) => !a.isRead).length, 0);

  const funnel = brandsData.reduce(
    (acc, b) => {
      acc.impressions += b.current.impressions;
      acc.reach += b.current.reach;
      acc.clicks += b.current.clicks;
      acc.leads += b.current.leads;
      acc.customers += b.current.conversions;
      return acc;
    },
    { impressions: 0, reach: 0, clicks: 0, leads: 0, customers: 0 }
  );

  return NextResponse.json({ brandsData, totalAlerts, funnel, days, source: isDatabaseConfigured ? "database" : "mock" });
}

function emptyMetricPoint(): MetricPoint {
  return {
    date: "",
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    leads: 0,
    cpl: 0,
    conversions: 0,
    conversionRate: 0,
    roas: null,
    frequency: 0,
  };
}
