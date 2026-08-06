import { getPrisma } from "@/lib/db/prisma";
import { evaluateRecommendations } from "@/lib/services/recommendation-engine";

const DEDUPE_WINDOW_HOURS = 24;

async function alreadyAlerted(brandId: string, type: string): Promise<boolean> {
  const prisma = await getPrisma();
  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
  const existing = await prisma.alert.findFirst({ where: { brandId, type: type as never, createdAt: { gte: since } } });
  return Boolean(existing);
}

async function createAlert(brandId: string, type: string, severity: "INFO" | "WARNING" | "CRITICAL", message: string, recommendation: string): Promise<boolean> {
  if (await alreadyAlerted(brandId, type)) return false;
  const prisma = await getPrisma();
  await prisma.alert.create({
    data: { brandId, type: type as never, severity: severity as never, message, recommendation },
  });
  return true;
}

/**
 * Reglas basadas en métricas de campañas (CTR bajo, CPC/CPL alto, frecuencia
 * alta) — reutiliza el motor de recomendaciones ya existente.
 */
async function checkCampaignMetricRules(brandId: string): Promise<number> {
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

  let created = 0;
  for (const rec of recs) {
    const alertType = typeMap[rec.id];
    if (!alertType || rec.severity === "opportunity") continue; // oportunidades se muestran en Recomendaciones IA, no como alerta
    const severity = rec.severity === "critical" ? "CRITICAL" : rec.severity === "warning" ? "WARNING" : "INFO";
    if (await createAlert(brandId, alertType, severity, rec.detail, rec.title)) created++;
  }
  return created;
}

/** Disminución del CTR período sobre período (no solo umbral absoluto). */
async function checkCtrTrend(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const recent = await prisma.metricSnapshot.findMany({ where: { brandId, grain: "DAILY" }, orderBy: { date: "desc" }, take: 7 });
  const prior = await prisma.metricSnapshot.findMany({ where: { brandId, grain: "DAILY" }, orderBy: { date: "desc" }, skip: 7, take: 7 });
  if (recent.length < 3 || prior.length < 3) return 0;

  const avgCtr = (rows: typeof recent) => rows.reduce((a: number, r: (typeof recent)[number]) => a + Number(r.ctr), 0) / rows.length;
  const recentCtr = avgCtr(recent);
  const priorCtr = avgCtr(prior);
  if (priorCtr === 0) return 0;

  const dropPct = ((priorCtr - recentCtr) / priorCtr) * 100;
  if (dropPct > 15) {
    const created = await createAlert(
      brandId,
      "CTR_DROP",
      dropPct > 30 ? "CRITICAL" : "WARNING",
      `El CTR cayó ${dropPct.toFixed(0)}% en los últimos 7 días respecto a los 7 anteriores (${recentCtr.toFixed(2)}% vs ${priorCtr.toFixed(2)}%).`,
      "Renueva las creatividades de las campañas activas — la caída sostenida suele indicar fatiga de anuncio."
    );
    return created ? 1 : 0;
  }
  return 0;
}

/** Disminución del Engagement Rate de las publicaciones. */
async function checkEngagementDrop(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const since14 = new Date();
  since14.setDate(since14.getDate() - 14);
  const posts = await prisma.post.findMany({ where: { brandId, publishedAt: { gte: since14 } } });
  if (posts.length < 4) return 0;

  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  type PostRow = (typeof posts)[number];
  const recent = posts.filter((p: PostRow) => p.publishedAt >= since7);
  const prior = posts.filter((p: PostRow) => p.publishedAt < since7);
  if (recent.length === 0 || prior.length === 0) return 0;

  const avgEngRate = (rows: typeof posts) => rows.reduce((a: number, p: PostRow) => a + (p.reach > 0 ? p.engagement / p.reach : 0), 0) / rows.length;
  const recentRate = avgEngRate(recent);
  const priorRate = avgEngRate(prior);
  if (priorRate === 0) return 0;

  const dropPct = ((priorRate - recentRate) / priorRate) * 100;
  if (dropPct > 15) {
    const created = await createAlert(
      brandId,
      "ENGAGEMENT_DROP",
      dropPct > 30 ? "WARNING" : "INFO",
      `El engagement rate de tus publicaciones cayó ${dropPct.toFixed(0)}% en los últimos 7 días.`,
      "Prueba nuevos formatos (Reels, encuestas) y revisa si el horario de publicación sigue siendo el óptimo."
    );
    return created ? 1 : 0;
  }
  return 0;
}

/** Caída de seguidores (crecimiento neto negativo en los últimos días). */
async function checkFollowerDrop(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 5);

  const networks = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"] as const;
  let created = 0;
  for (const network of networks) {
    const rows = await prisma.followerSnapshot.findMany({ where: { brandId, network: network as never, date: { gte: since } }, orderBy: { date: "asc" } });
    if (rows.length < 2) continue;
    const netChange = rows.reduce((a: number, r: (typeof rows)[number]) => a + r.newFollowers, 0);
    if (netChange < 0) {
      const ok = await createAlert(
        brandId,
        "FOLLOWER_DROP",
        "WARNING",
        `Se detectó una caída neta de seguidores en ${network} durante los últimos 5 días.`,
        "Revisa si hubo contenido controversial reciente, o si aumentó el dejar de seguir por inactividad — considera una campaña de reactivación."
      );
      if (ok) created++;
    }
  }
  return created;
}

/** Publicaciones con Performance Score muy por debajo del promedio de la marca. */
async function checkUnderperformingPosts(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const posts = await prisma.post.findMany({ where: { brandId, publishedAt: { gte: since30 } } });
  if (posts.length < 5) return 0;

  type UnderperfPost = (typeof posts)[number];
  const avgScore = posts.reduce((a: number, p: UnderperfPost) => a + (p.performanceScore ?? 0), 0) / posts.length;
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const recentUnderperforming = posts.filter((p: UnderperfPost) => p.publishedAt >= since7 && (p.performanceScore ?? 0) < avgScore * 0.4);

  if (recentUnderperforming.length >= 2) {
    const created = await createAlert(
      brandId,
      "POST_UNDERPERFORMING",
      "INFO",
      `${recentUnderperforming.length} publicaciones recientes tienen un Performance Score muy por debajo del promedio de la marca (${avgScore.toFixed(0)} pts).`,
      "Evita repetir el formato y horario de esas publicaciones — revisa el detalle en Contenidos."
    );
    return created ? 1 : 0;
  }
  return 0;
}

/** Landing pages de Google Analytics con alta tasa de abandono. */
async function checkLandingPageAbandonment(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const rows = await prisma.gaLandingPage.findMany({ where: { brandId, date: { gte: since7 } } });
  if (rows.length === 0) return 0;

  const byPath = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byPath.get(r.path) ?? [];
    arr.push(Number(r.exitRate));
    byPath.set(r.path, arr);
  }

  let created = 0;
  for (const [path, rates] of byPath.entries()) {
    const avgExit = rates.reduce((a, v) => a + v, 0) / rates.length;
    if (avgExit > 70) {
      const ok = await createAlert(
        brandId,
        "LANDING_PAGE_ABANDONMENT",
        "WARNING",
        `La landing page '${path}' tiene una tasa de salida de ${avgExit.toFixed(0)}%, muy por sobre el resto del sitio.`,
        "Revisa la velocidad de carga y la claridad de la oferta en esa página específica."
      );
      if (ok) created++;
    }
  }
  return created;
}

/** Campañas con inversión activa pero cero resultados. */
async function checkCampaignsNoResults(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const since5 = new Date();
  since5.setDate(since5.getDate() - 5);

  const campaigns = await prisma.campaign.findMany({
    where: { brandId, status: "ACTIVE" },
    include: { metricSnapshots: { where: { date: { gte: since5 } } } },
  });

  let created = 0;
  for (const c of campaigns) {
    type SnapRow = (typeof c.metricSnapshots)[number];
    const spend = c.metricSnapshots.reduce((a: number, s: SnapRow) => a + Number(s.spend), 0);
    const conversions = c.metricSnapshots.reduce((a: number, s: SnapRow) => a + s.conversions, 0);
    const leads = c.metricSnapshots.reduce((a: number, s: SnapRow) => a + s.leads, 0);
    if (spend > 20000 && conversions === 0 && leads === 0 && c.metricSnapshots.length >= 3) {
      const ok = await createAlert(
        brandId,
        "CAMPAIGN_NO_RESULTS",
        "CRITICAL",
        `La campaña '${c.name}' lleva ${c.metricSnapshots.length} días con inversión activa y cero conversiones.`,
        "Pausa la campaña y revisa la segmentación o el objetivo configurado antes de seguir invirtiendo."
      );
      if (ok) created++;
    }
  }
  return created;
}

/** Errores de sincronización en cualquier plataforma conectada (Meta, TikTok, LinkedIn, GA4). */
async function checkSyncErrors(brandId: string): Promise<number> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { metaCredential: true, tiktokCredential: true, linkedinCredential: true, gaCredential: true },
  });
  if (!brand) return 0;

  const sources: Array<{ label: string; syncStatus?: string | null; syncError?: string | null }> = [
    { label: "Meta", syncStatus: brand.metaCredential?.syncStatus, syncError: brand.metaCredential?.syncError },
    { label: "TikTok", syncStatus: brand.tiktokCredential?.syncStatus, syncError: brand.tiktokCredential?.syncError },
    { label: "LinkedIn", syncStatus: brand.linkedinCredential?.syncStatus, syncError: brand.linkedinCredential?.syncError },
    { label: "Google Analytics", syncStatus: brand.gaCredential?.syncStatus, syncError: brand.gaCredential?.syncError },
  ];

  let created = 0;
  for (const source of sources) {
    if (source.syncStatus === "error" && source.syncError) {
      const ok = await createAlert(
        brandId,
        "SYNC_ERROR",
        "WARNING",
        `La sincronización de ${source.label} está fallando: ${source.syncError}`,
        `Revisa las credenciales de ${source.label} en Configuración y usa "Probar conexión guardada" para diagnosticar.`
      );
      if (ok) created++;
    }
  }
  return created;
}

/**
 * Corre todas las reglas de alertas para una marca. Cada alerta se crea solo
 * si no existe una equivalente sin leer en las últimas 24 horas.
 */
export async function generateAlertsForBrand(brandId: string): Promise<number> {
  const results = await Promise.all([
    checkCampaignMetricRules(brandId),
    checkCtrTrend(brandId),
    checkEngagementDrop(brandId),
    checkFollowerDrop(brandId),
    checkUnderperformingPosts(brandId),
    checkLandingPageAbandonment(brandId),
    checkCampaignsNoResults(brandId),
    checkSyncErrors(brandId),
  ]);
  return results.reduce((a, b) => a + b, 0);
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
