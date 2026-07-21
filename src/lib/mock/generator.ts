import type {
  BrandSlug,
  MetricPoint,
  Campaign,
  Post,
  Alert,
} from "@/types/domain";
import { BRANDS } from "@/types/domain";

// PRNG determinista (seed por string) para que los datos sean estables entre
// renders/requests sin necesitar base de datos aún.
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const BRAND_PROFILES: Record<BrandSlug, { baseSpend: number; baseCtr: number; baseCpl: number }> = {
  informes_comerciales: { baseSpend: 380000, baseCtr: 2.1, baseCpl: 1400 },
  inversiones_cinco: { baseSpend: 620000, baseCtr: 1.6, baseCpl: 2600 },
  segal_deudores: { baseSpend: 290000, baseCtr: 2.8, baseCpl: 950 },
};

export function generateDailyMetrics(
  brandSlug: BrandSlug,
  days: number,
  endDate: Date = new Date(),
  seedSuffix = "metrics"
): MetricPoint[] {
  const rnd = seededRandom(`${brandSlug}-${seedSuffix}`);
  const profile = BRAND_PROFILES[brandSlug];
  const points: MetricPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);

    const noise = 0.75 + rnd() * 0.5;
    const weekday = date.getDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.8 : 1;

    const spend = Math.round(profile.baseSpend * noise * weekendDip / 30);
    const targetCpm = 3500 + rnd() * 3000; // CPM realista para Chile: $3.500 - $6.500 CLP
    const impressions = Math.max(100, Math.round((spend / targetCpm) * 1000));
    const ctr = Math.max(0.4, profile.baseCtr * (0.8 + rnd() * 0.5));
    const clicks = Math.round(impressions * (ctr / 100));
    const reach = Math.round(impressions / (1.2 + rnd() * 0.6));
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = (spend / impressions) * 1000;
    const leadRate = 0.03 + rnd() * 0.05;
    const leads = Math.max(0, Math.round(clicks * leadRate));
    const cpl = leads > 0 ? spend / leads : profile.baseCpl;
    const conversions = Math.round(leads * (0.15 + rnd() * 0.2));
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const frequency = 1.4 + rnd() * 2.2;

    points.push({
      date: date.toISOString().slice(0, 10),
      spend,
      reach,
      impressions,
      clicks,
      ctr: Number(ctr.toFixed(2)),
      cpc: Number(cpc.toFixed(0)),
      cpm: Number(cpm.toFixed(0)),
      leads,
      cpl: Number(cpl.toFixed(0)),
      conversions,
      conversionRate: Number(conversionRate.toFixed(2)),
      roas: profile.baseSpend > 400000 ? Number((1.8 + rnd() * 1.6).toFixed(2)) : null,
      frequency: Number(frequency.toFixed(2)),
    });
  }

  return points;
}

export function aggregateMetrics(points: MetricPoint[]): MetricPoint {
  if (points.length === 0) {
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

  const sum = (key: keyof MetricPoint) =>
    points.reduce((acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);

  const spend = sum("spend");
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const leads = sum("leads");
  const conversions = sum("conversions");
  const reach = sum("reach");

  const roasValues = points.map((p) => p.roas).filter((r): r is number => r !== null);

  return {
    date: `${points[0].date} → ${points[points.length - 1].date}`,
    spend,
    reach,
    impressions,
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    cpc: clicks > 0 ? Number((spend / clicks).toFixed(0)) : 0,
    cpm: impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(0)) : 0,
    leads,
    cpl: leads > 0 ? Number((spend / leads).toFixed(0)) : 0,
    conversions,
    conversionRate: clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0,
    roas: roasValues.length ? Number((roasValues.reduce((a, b) => a + b, 0) / roasValues.length).toFixed(2)) : null,
    frequency: Number((points.reduce((a, p) => a + p.frequency, 0) / points.length).toFixed(2)),
  };
}

const CAMPAIGN_NAMES: Record<BrandSlug, string[]> = {
  informes_comerciales: ["Leads Pyme Q3", "Retargeting Web", "Awareness Marca", "Promo Informes Express"],
  inversiones_cinco: ["Captación Inversionistas", "Webinar Rentabilidad", "Retargeting Simulador", "Leads Alto Patrimonio"],
  segal_deudores: ["Recuperación Cartera", "Educación Financiera", "Convenios de Pago", "Retargeting Deudores"],
};

const OBJECTIVES = ["LEADS", "TRAFFIC", "ENGAGEMENT", "CONVERSIONS"] as const;
const STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "PAUSED"] as const;

export function generateCampaigns(brandSlug: BrandSlug, days: number): Campaign[] {
  const rnd = seededRandom(`${brandSlug}-campaigns`);
  const names = CAMPAIGN_NAMES[brandSlug];

  return names.map((name, idx) => {
    const dailyPoints = generateDailyMetrics(brandSlug, days, new Date(), `campaign-${idx}`);
    const metrics = aggregateMetrics(dailyPoints);
    const start = new Date();
    start.setDate(start.getDate() - Math.round(20 + rnd() * 60));

    return {
      id: `${brandSlug}-camp-${idx}`,
      metaCampaignId: `120210${Math.floor(rnd() * 1e10)}`,
      brandSlug,
      name,
      objective: OBJECTIVES[idx % OBJECTIVES.length],
      status: STATUSES[idx % STATUSES.length],
      dailyBudget: Math.round((metrics.spend / days) * (0.9 + rnd() * 0.3)),
      spentToDate: metrics.spend,
      startDate: start.toISOString().slice(0, 10),
      endDate: null,
      metrics,
    };
  });
}

const SAMPLE_COPIES = [
  "3 señales de que tu pyme necesita un informe comercial antes de dar crédito 📊",
  "¿Sabías que el 40% de las pymes chilenas no verifica antecedentes antes de vender a crédito?",
  "Invertir con respaldo: conoce cómo funciona nuestro fondo de renta fija 💰",
  "Historias reales: así ayudamos a recuperar tu cartera vencida sin juicios",
  "Convenios de pago flexibles, pensados para tu bolsillo 🤝",
  "5 datos que todo inversionista debe revisar antes de firmar",
  "Automatiza la verificación de tus clientes en segundos ⚡",
  "Educación financiera: qué es el DICOM y cómo afecta tus decisiones",
];

const TYPES = ["REEL", "CAROUSEL", "IMAGE", "STORY", "VIDEO"] as const;
const NETWORKS = ["FACEBOOK", "INSTAGRAM"] as const;
const FUNDING = ["ORGANIC", "PAID"] as const;

export function generatePosts(brandSlug: BrandSlug, count = 24): Post[] {
  const rnd = seededRandom(`${brandSlug}-posts`);
  const campaigns = CAMPAIGN_NAMES[brandSlug];

  const raw = Array.from({ length: count }).map((_, idx) => {
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - Math.floor(rnd() * 60));

    const reach = Math.round(1200 + rnd() * 38000);
    const impressions = Math.round(reach * (1.2 + rnd() * 0.8));
    const likes = Math.round(reach * (0.02 + rnd() * 0.08));
    const comments = Math.round(likes * (0.05 + rnd() * 0.15));
    const shares = Math.round(likes * (0.03 + rnd() * 0.1));
    const saves = Math.round(likes * (0.04 + rnd() * 0.12));
    const engagement = likes + comments + shares + saves;
    const clicks = Math.round(reach * (0.005 + rnd() * 0.03));
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const fundingType = FUNDING[rnd() > 0.55 ? 1 : 0];
    const spend = fundingType === "PAID" ? Math.round(15000 + rnd() * 180000) : 0;
    const leads = fundingType === "PAID" ? Math.round(clicks * (0.04 + rnd() * 0.08)) : 0;
    const cpl = leads > 0 ? spend / leads : 0;

    return {
      id: `${brandSlug}-post-${idx}`,
      brandSlug,
      campaignName: fundingType === "PAID" ? campaigns[idx % campaigns.length] : null,
      network: NETWORKS[idx % NETWORKS.length],
      type: TYPES[idx % TYPES.length],
      fundingType,
      publishedAt: publishedAt.toISOString(),
      thumbnailUrl: `https://picsum.photos/seed/${brandSlug}-${idx}/400/500`,
      copy: SAMPLE_COPIES[idx % SAMPLE_COPIES.length],
      reach,
      impressions,
      plays: TYPES[idx % TYPES.length] === "REEL" || TYPES[idx % TYPES.length] === "VIDEO" ? Math.round(reach * (0.6 + rnd() * 0.8)) : 0,
      likes,
      comments,
      shares,
      saves,
      engagement,
      clicks,
      ctr: Number(ctr.toFixed(2)),
      spend,
      leads,
      cpl: Number(cpl.toFixed(0)),
      performanceScore: 0, // se calcula abajo tras conocer los máximos del set
    };
  });

  const maxEngagement = Math.max(...raw.map((p) => p.engagement));
  const maxCtr = Math.max(...raw.map((p) => p.ctr));
  const maxLeads = Math.max(...raw.map((p) => p.leads), 1);
  const maxReach = Math.max(...raw.map((p) => p.reach));
  const maxShares = Math.max(...raw.map((p) => p.shares));
  const maxSaves = Math.max(...raw.map((p) => p.saves));

  return raw.map((p) => {
    const score =
      (p.engagement / maxEngagement) * 25 +
      (p.ctr / maxCtr) * 20 +
      (p.leads / maxLeads) * 20 +
      (p.reach / maxReach) * 15 +
      (p.shares / maxShares) * 10 +
      (p.saves / maxSaves) * 10;
    return { ...p, performanceScore: Math.round(score) };
  });
}

export function generateAlerts(brandSlug: BrandSlug): Alert[] {
  const rnd = seededRandom(`${brandSlug}-alerts`);
  const pool: Omit<Alert, "id" | "brandSlug" | "createdAt" | "isRead">[] = [
    { type: "CTR_DROP", severity: "WARNING", message: "El CTR promedio cayó 18% respecto a la semana anterior." },
    { type: "CPL_INCREASE", severity: "CRITICAL", message: "El CPL subió a $2.340, superando el umbral de $2.000." },
    { type: "HIGH_FREQUENCY", severity: "WARNING", message: "La campaña 'Retargeting Web' tiene frecuencia 3.4 — riesgo de fatiga." },
    { type: "BUDGET_DEPLETING", severity: "INFO", message: "El presupuesto mensual está al 82% de consumo con 6 días restantes." },
    { type: "CAMPAIGN_STOPPED_DELIVERY", severity: "CRITICAL", message: "'Promo Informes Express' dejó de entregar hace 14 horas." },
  ];

  return pool
    .filter(() => rnd() > 0.35)
    .map((a, i) => ({
      ...a,
      id: `${brandSlug}-alert-${i}`,
      brandSlug,
      createdAt: new Date(Date.now() - rnd() * 1000 * 60 * 60 * 48).toISOString(),
      isRead: rnd() > 0.6,
    }));
}

export function getAllMockPosts(): Post[] {
  return BRANDS.flatMap((b) => generatePosts(b.slug));
}

export function getAllBrandsSummary(days: number) {
  return BRANDS.map((brand) => {
    const points = generateDailyMetrics(brand.slug, days);
    return { brand, metrics: aggregateMetrics(points), series: points };
  });
}
