import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateDailyMetrics, generateGaDailyMetrics, generateFollowerSnapshots } from "@/lib/mock/generator";
import { AVERAGE_METRIC_KEYS, type SeriesPoint } from "@/lib/utils/metric-aggregation";

type Source = "meta" | "ga" | "followers";

function daysBetween(since: Date, until: Date): number {
  return Math.max(1, Math.round((until.getTime() - since.getTime()) / 86400000) + 1);
}

function averageAcrossBrands(seriesList: SeriesPoint[][], isAverage: boolean): SeriesPoint[] {
  if (seriesList.length === 0) return [];
  const byDate = new Map<string, number[]>();
  for (const series of seriesList) {
    for (const p of series) {
      const arr = byDate.get(p.date) ?? [];
      arr.push(p.value);
      byDate.set(p.date, arr);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, values]) => ({
      date,
      value: isAverage ? values.reduce((a, v) => a + v, 0) / values.length : values.reduce((a, v) => a + v, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * GET /api/metrics/history?source=meta|ga|followers&metric=<key>&brand=<slug|all>&network=<INSTAGRAM|FACEBOOK|TIKTOK>&since=&until=
 *
 * Devuelve la serie diaria completa de una métrica para el rango solicitado.
 * El agrupamiento por semana/mes/año se hace en el cliente (bucketSeries),
 * así este endpoint siempre entrega el detalle diario más fino disponible.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = (sp.get("source") ?? "meta") as Source;
  const metric = sp.get("metric") ?? "spend";
  const brandParam = sp.get("brand") ?? "all";
  const network = sp.get("network") ?? "INSTAGRAM";
  const sinceParam = sp.get("since");
  const untilParam = sp.get("until");

  const until = untilParam ? new Date(untilParam) : new Date();
  const since = sinceParam ? new Date(sinceParam) : (() => {
    const d = new Date(until);
    d.setDate(d.getDate() - 29);
    return d;
  })();

  const days = daysBetween(since, until);
  const isAverage = AVERAGE_METRIC_KEYS.has(metric);
  const brandsToUse = brandParam === "all" ? BRANDS : BRANDS.filter((b) => b.slug === brandParam);

  if (!isDatabaseConfigured) {
    let seriesPerBrand: SeriesPoint[][];

    if (source === "ga") {
      seriesPerBrand = brandsToUse.map((b) =>
        generateGaDailyMetrics(b.slug as BrandSlug, days, until).map((p) => ({ date: p.date, value: Number((p as unknown as Record<string, number>)[metric] ?? 0) }))
      );
    } else if (source === "followers") {
      seriesPerBrand = brandsToUse.map((b) =>
        generateFollowerSnapshots(b.slug as BrandSlug, network as "INSTAGRAM" | "FACEBOOK" | "TIKTOK", days, until).map((p) => ({
          date: p.date,
          value: metric === "newFollowers" ? p.newFollowers : p.followers,
        }))
      );
    } else {
      seriesPerBrand = brandsToUse.map((b) =>
        generateDailyMetrics(b.slug as BrandSlug, days, until).map((p) => ({ date: p.date, value: Number((p as unknown as Record<string, number>)[metric] ?? 0) }))
      );
    }

    const series = averageAcrossBrands(seriesPerBrand, isAverage);
    return NextResponse.json({ series, source: "mock" });
  }

  const prisma = await getPrisma();
  const brandIds = brandsToUse.map((b) => b.id);
  const dbBrands = await prisma.brand.findMany({ where: { slug: { in: brandsToUse.map((b) => b.slug) as never } } });
  type DbBrand = (typeof dbBrands)[number];
  const idsBySlug = new Map(dbBrands.map((b: DbBrand) => [b.slug, b.id]));
  const resolvedIds = brandsToUse.map((b) => idsBySlug.get(b.slug)).filter(Boolean) as string[];

  if (resolvedIds.length === 0) {
    return NextResponse.json({ series: [], source: "database" });
  }

  let rows: { date: Date; value: number }[] = [];

  if (source === "ga") {
    const data = await prisma.gaMetricSnapshot.findMany({
      where: { brandId: { in: resolvedIds }, grain: "DAILY", date: { gte: since, lte: until } },
    });
    type GaRow = (typeof data)[number];
    rows = data.map((r: GaRow) => ({ date: r.date, value: Number((r as unknown as Record<string, unknown>)[metric] ?? 0) }));
  } else if (source === "followers") {
    const data = await prisma.followerSnapshot.findMany({
      where: { brandId: { in: resolvedIds }, network: network as never, date: { gte: since, lte: until } },
    });
    type FollowerRow = (typeof data)[number];
    rows = data.map((r: FollowerRow) => ({ date: r.date, value: metric === "newFollowers" ? r.newFollowers : r.followers }));
  } else {
    const data = await prisma.metricSnapshot.findMany({
      where: { brandId: { in: resolvedIds }, grain: "DAILY", date: { gte: since, lte: until } },
    });
    type MetaRow = (typeof data)[number];
    rows = data.map((r: MetaRow) => ({ date: r.date, value: Number((r as unknown as Record<string, unknown>)[metric] ?? 0) }));
  }

  void brandIds;
  const grouped = new Map<string, number[]>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const arr = grouped.get(key) ?? [];
    arr.push(r.value);
    grouped.set(key, arr);
  }
  const series: SeriesPoint[] = Array.from(grouped.entries())
    .map(([date, values]) => ({ date, value: isAverage ? values.reduce((a, v) => a + v, 0) / values.length : values.reduce((a, v) => a + v, 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ series, source: "database" });
}
