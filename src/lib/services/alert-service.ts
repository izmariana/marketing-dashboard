import { getPrisma } from "@/lib/db/prisma";
import { evaluateRecommendations } from "@/lib/services/recommendation-engine";

/**
 * Revisa las métricas más recientes de cada marca contra las reglas de negocio
 * (CTR bajo, CPC alto, frecuencia alta, CPL alto, presupuesto por agotarse) y
 * crea una Alert nueva solo si no existe una equivalente sin leer en las
 * últimas 24 horas — evita duplicar la misma alerta en cada sincronización.
 */
export async function generateAlertsForBrand(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const last7Days = await prisma.metricSnapshot.findMany({
    where: { brandId, grain: "DAILY" },
    orderBy: { date: "desc" },
    take: 7,
  });

  if (last7Days.length === 0) return 0;

  const avg = (key: "ctr" | "cpc" | "cpl" | "frequency") =>
    last7Days.reduce((acc: number, s: (typeof last7Days)[number]) => acc + Number(s[key]), 0) / last7Days.length;

  const recs = evaluateRecommendations({
    date: "",
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    ctr: avg("ctr"),
    cpc: avg("cpc"),
    cpm: 0,
    leads: 0,
    cpl: avg("cpl"),
    conversions: 0,
    conversionRate: 0,
    roas: null,
    frequency: avg("frequency"),
  });

  const typeMap: Record<string, string> = {
    "ctr-low": "CTR_DROP",
    "cpc-high": "CPL_INCREASE",
    "frequency-high": "HIGH_FREQUENCY",
    "cpl-high": "CPL_INCREASE",
  };

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let created = 0;

  for (const rec of recs) {
    const alertType = typeMap[rec.id];
    if (!alertType || rec.severity === "opportunity") continue; // oportunidades se muestran en Recomendaciones IA, no como alerta

    const existing = await prisma.alert.findFirst({
      where: { brandId, type: alertType as never, createdAt: { gte: since24h } },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        brandId,
        type: alertType as never,
        severity: (rec.severity === "critical" ? "CRITICAL" : rec.severity === "warning" ? "WARNING" : "INFO") as never,
        message: rec.detail,
      },
    });
    created++;
  }

  return created;
}

export async function generateAlertsForAllBrands(): Promise<number> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany();
  let total = 0;
  for (const brand of brands) {
    total += await generateAlertsForBrand(brand.id);
  }
  return total;
}
