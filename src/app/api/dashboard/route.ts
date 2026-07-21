import { NextRequest, NextResponse } from "next/server";
import { BRANDS } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateAlerts } from "@/lib/mock/generator";

/**
 * GET /api/dashboard?days=30
 *
 * Fase 1: sirve datos generados localmente con la misma forma que tendrán
 * los datos reales. Fase 2 (integración): reemplazar el cuerpo de esta
 * función por:
 *   1. Leer MetaCredential de cada Brand desde la DB
 *   2. Llamar fetchCampaignInsights() de meta-client.ts por marca
 *   3. Persistir como MetricSnapshot (grain DAILY) sin sobrescribir histórico
 *   4. Agregar y devolver la misma forma de respuesta que aquí
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const prevDays = days; // período anterior de igual longitud, inmediatamente anterior

  const brandsData = BRANDS.map((brand) => {
    const currentEnd = new Date();
    const previousEnd = new Date();
    previousEnd.setDate(previousEnd.getDate() - days);

    const currentSeries = generateDailyMetrics(brand.slug, days, currentEnd);
    const previousSeries = generateDailyMetrics(brand.slug, prevDays, previousEnd);

    const current = aggregateMetrics(currentSeries);
    const previous = aggregateMetrics(previousSeries);
    const alerts = generateAlerts(brand.slug);

    return { brand, current, previous, series: currentSeries, alerts };
  });

  const totalAlerts = brandsData.reduce((acc, b) => acc + b.alerts.filter((a) => !a.isRead).length, 0);

  // Embudo agregado de las 3 marcas
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

  return NextResponse.json({ brandsData, totalAlerts, funnel, days });
}
