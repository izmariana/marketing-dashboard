import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug, type Brand, type MetricPoint } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateCampaigns, generatePosts } from "@/lib/mock/generator";
import {
  evaluateRecommendations,
  compareToBenchmark,
  BENCHMARKS_CHILE,
  type Recommendation,
  type BenchmarkStatus,
} from "@/lib/services/recommendation-engine";
import { generateExecutiveSummary, type ExecutiveSummaryOutput } from "@/lib/services/openai-client";

function mockExecutiveSummary(brandName: string, current: MetricPoint, previous: MetricPoint): ExecutiveSummaryOutput {
  const spendChange = previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend) * 100 : 0;
  const leadsChange = previous.leads > 0 ? ((current.leads - previous.leads) / previous.leads) * 100 : 0;
  const ctrDirection = current.ctr >= previous.ctr ? "se mantuvo estable o mejoró" : "retrocedió";

  return {
    resumenEjecutivo: `Durante el período analizado, ${brandName} invirtió un ${spendChange >= 0 ? "aumento" : "descenso"} de ${Math.abs(spendChange).toFixed(0)}% respecto al período anterior, generando ${current.leads.toLocaleString("es-CL")} leads (${leadsChange >= 0 ? "+" : ""}${leadsChange.toFixed(0)}%). El CTR ${ctrDirection}, ubicándose en ${current.ctr.toFixed(2)}%.`,
    hallazgos: [
      `El CPL actual es de $${current.cpl.toFixed(0)}, ${current.cpl <= previous.cpl ? "una mejora" : "un retroceso"} frente a $${previous.cpl.toFixed(0)} del período anterior.`,
      `La frecuencia promedio de exposición es ${current.frequency.toFixed(1)}, ${current.frequency > 3 ? "por sobre el umbral recomendado de 3" : "dentro de un rango saludable"}.`,
      `La tasa de conversión sobre clics es ${current.conversionRate.toFixed(1)}%.`,
    ],
    problemasDetectados:
      current.ctr < 1.5 || current.frequency > 3 || current.cpl > 2000
        ? ([
            current.ctr < 1.5 ? "CTR por debajo del umbral saludable (1.5%), señal de fatiga de creatividades." : null,
            current.frequency > 3 ? "Frecuencia de anuncios elevada, riesgo de saturar a la audiencia." : null,
            current.cpl > 2000 ? "CPL por sobre el umbral de $2.000, revisar formulario y landing." : null,
          ].filter(Boolean) as string[])
        : ["No se detectaron problemas críticos en el período analizado."],
    oportunidades:
      current.ctr > 2.5 && current.cpl < 1000
        ? ["El CTR alto combinado con CPL bajo indica un anuncio ganador — es un buen momento para escalar presupuesto."]
        : ["Probar nuevos formatos creativos (Reels, carruseles) para diversificar el mix de contenido pagado."],
    accionesPrioritarias: [
      "Revisar el desempeño de las campañas con frecuencia sobre 3 y renovar sus creatividades.",
      "Auditar el formulario de leads si el CPL sigue sobre el benchmark de la industria.",
      "Reasignar presupuesto desde las campañas de menor rendimiento hacia las de mejor CTR/CPL.",
    ],
    proximosPasos: [
      "Ejecutar las acciones prioritarias en los próximos 7 días.",
      "Revisar el impacto en el próximo corte de métricas.",
      "Presentar avances en la próxima reunión de gerencia.",
    ],
  };
}

export interface BenchmarkEntry {
  value: number;
  status: BenchmarkStatus;
  reference: Record<string, number>;
}

export interface BrandReportData {
  brand: Brand;
  periodLabel: string;
  current: MetricPoint;
  previous: MetricPoint;
  recommendations: Recommendation[];
  benchmarks: Record<"ctr" | "cpc" | "cpm" | "cpl" | "engagementRate", BenchmarkEntry>;
  executiveSummary: ExecutiveSummaryOutput;
  generatedWithAI: boolean;
  topCampaigns: { name: string; spend: number; leads: number; cpl: number }[];
  topPosts: { copy: string; engagement: number; performanceScore: number }[];
}

/**
 * Reúne todo lo necesario para Recomendaciones IA y para Reportes:
 * métricas actuales/anteriores, top campañas, top publicaciones, reglas de
 * negocio disparadas, comparación con Benchmark Chile y el resumen ejecutivo
 * (OpenAI real si hay API Key, simulado si no). Una sola fuente de verdad
 * para ambas páginas.
 */
export async function getBrandReportData(brandSlug: string, days = 30): Promise<BrandReportData> {
  const brand = BRANDS.find((b) => b.slug === brandSlug);
  if (!brand) throw new Error(`Marca no encontrada: ${brandSlug}`);

  let current: MetricPoint;
  let previous: MetricPoint;
  let topCampaigns: { name: string; spend: number; leads: number; cpl: number }[];
  let topPosts: { copy: string; engagement: number; performanceScore: number }[];

  if (!isDatabaseConfigured) {
    const currentEnd = new Date();
    const previousEnd = new Date();
    previousEnd.setDate(previousEnd.getDate() - days);

    current = aggregateMetrics(generateDailyMetrics(brand.slug as BrandSlug, days, currentEnd));
    previous = aggregateMetrics(generateDailyMetrics(brand.slug as BrandSlug, days, previousEnd));

    const campaigns = generateCampaigns(brand.slug as BrandSlug, days);
    topCampaigns = [...campaigns]
      .sort((a, b) => b.metrics.leads - a.metrics.leads)
      .slice(0, 3)
      .map((c) => ({ name: c.name, spend: c.metrics.spend, leads: c.metrics.leads, cpl: c.metrics.cpl }));

    const posts = generatePosts(brand.slug as BrandSlug);
    topPosts = [...posts]
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 3)
      .map((p) => ({ copy: p.copy, engagement: p.engagement, performanceScore: p.performanceScore }));
  } else {
    const prisma = await getPrisma();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const prevSince = new Date();
    prevSince.setDate(prevSince.getDate() - days * 2);

    const [currentSnaps, previousSnaps, campaigns, posts] = await Promise.all([
      prisma.metricSnapshot.findMany({ where: { brand: { slug: brand.slug as never }, grain: "DAILY", date: { gte: since } } }),
      prisma.metricSnapshot.findMany({ where: { brand: { slug: brand.slug as never }, grain: "DAILY", date: { gte: prevSince, lt: since } } }),
      prisma.campaign.findMany({ where: { brand: { slug: brand.slug as never } }, include: { metricSnapshots: true }, take: 20 }),
      prisma.post.findMany({ where: { brand: { slug: brand.slug as never } }, orderBy: { performanceScore: "desc" }, take: 3 }),
    ]);

    type SnapshotRow = (typeof currentSnaps)[number];
    type CampaignRow = (typeof campaigns)[number];
    type PostRow = (typeof posts)[number];

    const toMetricPoints = (rows: typeof currentSnaps): MetricPoint[] =>
      rows.map((r: SnapshotRow) => ({
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

    current = aggregateMetrics(toMetricPoints(currentSnaps));
    previous = aggregateMetrics(toMetricPoints(previousSnaps));

    topCampaigns = campaigns
      .map((c: CampaignRow) => {
        const spend = c.metricSnapshots.reduce((a: number, s: (typeof c.metricSnapshots)[number]) => a + Number(s.spend), 0);
        const leads = c.metricSnapshots.reduce((a: number, s: (typeof c.metricSnapshots)[number]) => a + s.leads, 0);
        return { name: c.name, spend, leads, cpl: leads > 0 ? spend / leads : 0 };
      })
      .sort((a: { leads: number }, b: { leads: number }) => b.leads - a.leads)
      .slice(0, 3);

    topPosts = posts.map((p: PostRow) => ({ copy: p.copy ?? "", engagement: p.engagement, performanceScore: p.performanceScore ?? 0 }));
  }

  const recommendations: Recommendation[] = evaluateRecommendations(current);

  const engagementRate = 0; // se calcula a nivel de publicación en Contenidos
  const benchmarks: BrandReportData["benchmarks"] = {
    ctr: { value: current.ctr, status: compareToBenchmark("ctr", current.ctr), reference: BENCHMARKS_CHILE.ctr },
    cpc: { value: current.cpc, status: compareToBenchmark("cpc", current.cpc), reference: BENCHMARKS_CHILE.cpc },
    cpm: { value: current.cpm, status: compareToBenchmark("cpm", current.cpm), reference: BENCHMARKS_CHILE.cpm },
    cpl: { value: current.cpl, status: compareToBenchmark("cpl", current.cpl), reference: BENCHMARKS_CHILE.cpl },
    engagementRate: { value: engagementRate, status: compareToBenchmark("engagementRate", engagementRate), reference: BENCHMARKS_CHILE.engagementRate },
  };

  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const periodLabel = `Últimos ${days} días`;

  let executiveSummary: ExecutiveSummaryOutput;
  if (hasOpenAiKey) {
    try {
      executiveSummary = await generateExecutiveSummary({
        brandName: brand.name,
        periodLabel,
        currentMetrics: current as unknown as Record<string, number>,
        previousMetrics: previous as unknown as Record<string, number>,
        topCampaigns,
        topPosts,
      });
    } catch {
      executiveSummary = mockExecutiveSummary(brand.name, current, previous);
    }
  } else {
    executiveSummary = mockExecutiveSummary(brand.name, current, previous);
  }

  return {
    brand,
    periodLabel,
    current,
    previous,
    recommendations,
    benchmarks,
    executiveSummary,
    generatedWithAI: hasOpenAiKey,
    topCampaigns,
    topPosts,
  };
}
