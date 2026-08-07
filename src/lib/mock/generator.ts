import type {
  BrandSlug,
  MetricPoint,
  Campaign,
  Post,
  Alert,
  SocialNetwork,
  PostType,
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
  const profile = BRAND_PROFILES[brandSlug];
  const points: MetricPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    // Semilla anclada a la fecha calendario real (no a la posición en el
    // ciclo) — así dos ventanas de igual largo pero fechas distintas nunca
    // producen los mismos valores, aunque coincidan en día de la semana.
    const rnd = seededRandom(`${brandSlug}-${seedSuffix}-${date.toISOString().slice(0, 10)}`);

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
    const engagement = Math.round(reach * (0.01 + rnd() * 0.03));
    const engagementRate = reach > 0 ? (engagement / reach) * 100 : 0;

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
      engagement,
      engagementRate: Number(engagementRate.toFixed(2)),
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
      engagement: 0,
      engagementRate: 0,
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
  const engagement = sum("engagement");

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
    engagement,
    engagementRate: reach > 0 ? Number(((engagement / reach) * 100).toFixed(2)) : 0,
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

export function generatePosts(
  brandSlug: BrandSlug,
  count = 24,
  options?: { networks?: readonly SocialNetwork[]; typeWeights?: readonly PostType[]; idPrefix?: string; seedSuffix?: string }
): Post[] {
  const networksToUse = options?.networks ?? NETWORKS;
  const typesToUse = options?.typeWeights ?? TYPES;
  const idPrefix = options?.idPrefix ?? "post";
  const rnd = seededRandom(`${brandSlug}-${options?.seedSuffix ?? "posts"}`);
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
    const postType = typesToUse[idx % typesToUse.length];

    return {
      id: `${brandSlug}-${idPrefix}-${idx}`,
      brandSlug,
      campaignName: fundingType === "PAID" ? campaigns[idx % campaigns.length] : null,
      network: networksToUse[idx % networksToUse.length],
      type: postType,
      fundingType,
      publishedAt: publishedAt.toISOString(),
      thumbnailUrl: `https://picsum.photos/seed/${brandSlug}-${idPrefix}-${idx}/400/500`,
      copy: SAMPLE_COPIES[idx % SAMPLE_COPIES.length],
      reach,
      impressions,
      plays: postType === "REEL" || postType === "VIDEO" ? Math.round(reach * (0.6 + rnd() * 0.8)) : 0,
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

export function generateTikTokPosts(brandSlug: BrandSlug, count = 16): Post[] {
  return generatePosts(brandSlug, count, {
    networks: ["TIKTOK"],
    typeWeights: ["VIDEO", "VIDEO", "REEL"],
    idPrefix: "tiktok",
    seedSuffix: "tiktok-posts",
  }).map((p) => ({ ...p, fundingType: "ORGANIC", spend: 0, leads: 0, cpl: 0, campaignName: null }));
}

export function generateAlerts(brandSlug: BrandSlug): Alert[] {
  const rnd = seededRandom(`${brandSlug}-alerts`);
  const pool: Omit<Alert, "id" | "brandSlug" | "createdAt" | "isRead">[] = [
    {
      type: "CTR_DROP",
      severity: "WARNING",
      message: "El CTR promedio cayó 18% respecto a la semana anterior.",
      recommendation: "Renueva las creatividades de las campañas activas y prueba un nuevo ángulo de copy.",
    },
    {
      type: "CPL_INCREASE",
      severity: "CRITICAL",
      message: "El CPL subió a $2.340, superando el umbral de $2.000.",
      recommendation: "Revisa la longitud del formulario y la velocidad de carga de la landing page.",
    },
    {
      type: "HIGH_FREQUENCY",
      severity: "WARNING",
      message: "La campaña 'Retargeting Web' tiene frecuencia 3.4 — riesgo de fatiga.",
      recommendation: "Renueva los anuncios o amplía la audiencia para reducir la frecuencia de exposición.",
    },
    {
      type: "BUDGET_DEPLETING",
      severity: "INFO",
      message: "El presupuesto mensual está al 82% de consumo con 6 días restantes.",
      recommendation: "Ajusta el presupuesto diario o prepárate para que la campaña deje de entregar antes de fin de mes.",
    },
    {
      type: "CAMPAIGN_STOPPED_DELIVERY",
      severity: "CRITICAL",
      message: "'Promo Informes Express' dejó de entregar hace 14 horas.",
      recommendation: "Revisa el estado de la cuenta publicitaria y el saldo de la tarjeta asociada.",
    },
    {
      type: "ENGAGEMENT_DROP",
      severity: "WARNING",
      message: "El engagement rate de tus publicaciones cayó 22% en los últimos 7 días.",
      recommendation: "Prueba nuevos formatos (Reels, encuestas) y revisa si el horario de publicación sigue siendo el óptimo.",
    },
    {
      type: "FOLLOWER_DROP",
      severity: "WARNING",
      message: "Se detectó una caída de seguidores en Instagram durante los últimos 3 días.",
      recommendation: "Revisa si hubo contenido controversial reciente o un aumento repentino de dejar de seguir por inactividad.",
    },
    {
      type: "POST_UNDERPERFORMING",
      severity: "INFO",
      message: "3 publicaciones recientes tienen un Performance Score muy por debajo del promedio de la marca.",
      recommendation: "Evita repetir el formato y horario de esas publicaciones — revisa el detalle en Contenidos.",
    },
    {
      type: "LANDING_PAGE_ABANDONMENT",
      severity: "WARNING",
      message: "La landing page '/simulador' tiene una tasa de salida de 78%, muy por sobre el resto del sitio.",
      recommendation: "Revisa la velocidad de carga y la claridad de la oferta en esa página específica.",
    },
    {
      type: "CAMPAIGN_NO_RESULTS",
      severity: "CRITICAL",
      message: "La campaña 'Awareness Marca' lleva 5 días con inversión activa y cero conversiones.",
      recommendation: "Pausa la campaña y revisa la segmentación o el objetivo configurado antes de seguir invirtiendo.",
    },
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

// ---------------------------------------------------------------------------
// Google Analytics 4 — datos simulados
// ---------------------------------------------------------------------------

export interface GaMetricPoint {
  date: string;
  users: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementSec: number;
  pageViews: number;
  eventCount: number;
  conversions: number;
  conversionRate: number;
}

const GA_BRAND_PROFILES: Record<BrandSlug, { baseSessions: number; baseConvRate: number }> = {
  informes_comerciales: { baseSessions: 850, baseConvRate: 3.2 },
  inversiones_cinco: { baseSessions: 1200, baseConvRate: 2.1 },
  segal_deudores: { baseSessions: 640, baseConvRate: 4.5 },
};

export function generateGaDailyMetrics(brandSlug: BrandSlug, days: number, endDate: Date = new Date()): GaMetricPoint[] {
  const profile = GA_BRAND_PROFILES[brandSlug];
  const points: GaMetricPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const rnd = seededRandom(`${brandSlug}-ga-metrics-${date.toISOString().slice(0, 10)}`);
    const weekday = date.getDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.65 : 1;
    const noise = 0.8 + rnd() * 0.4;

    const sessions = Math.round(profile.baseSessions * noise * weekendDip);
    const users = Math.round(sessions * (0.75 + rnd() * 0.15));
    const newUsers = Math.round(users * (0.4 + rnd() * 0.25));
    const engagementRate = 45 + rnd() * 25;
    const engagedSessions = Math.round(sessions * (engagementRate / 100));
    const avgEngagementSec = 35 + rnd() * 90;
    const pageViews = Math.round(sessions * (1.8 + rnd() * 1.6));
    const eventCount = Math.round(pageViews * (2.2 + rnd() * 1.2));
    const conversionRate = Math.max(0.5, profile.baseConvRate * (0.7 + rnd() * 0.6));
    const conversions = Math.round(sessions * (conversionRate / 100));

    points.push({
      date: date.toISOString().slice(0, 10),
      users,
      newUsers,
      sessions,
      engagedSessions,
      engagementRate: Number(engagementRate.toFixed(2)),
      avgEngagementSec: Number(avgEngagementSec.toFixed(0)),
      pageViews,
      eventCount,
      conversions,
      conversionRate: Number(conversionRate.toFixed(2)),
    });
  }

  return points;
}

export function aggregateGaMetrics(points: GaMetricPoint[]): GaMetricPoint {
  if (points.length === 0) {
    return {
      date: "",
      users: 0,
      newUsers: 0,
      sessions: 0,
      engagedSessions: 0,
      engagementRate: 0,
      avgEngagementSec: 0,
      pageViews: 0,
      eventCount: 0,
      conversions: 0,
      conversionRate: 0,
    };
  }
  const sum = (key: keyof GaMetricPoint) => points.reduce((acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
  const sessions = sum("sessions");
  const conversions = sum("conversions");

  return {
    date: `${points[0].date} → ${points[points.length - 1].date}`,
    users: sum("users"),
    newUsers: sum("newUsers"),
    sessions,
    engagedSessions: sum("engagedSessions"),
    engagementRate: Number((points.reduce((a, p) => a + p.engagementRate, 0) / points.length).toFixed(2)),
    avgEngagementSec: Number((points.reduce((a, p) => a + p.avgEngagementSec, 0) / points.length).toFixed(0)),
    pageViews: sum("pageViews"),
    eventCount: sum("eventCount"),
    conversions,
    conversionRate: sessions > 0 ? Number(((conversions / sessions) * 100).toFixed(2)) : 0,
  };
}

const CHANNELS = ["Organic Search", "Paid Social", "Organic Social", "Direct", "Paid Search", "Referral", "Email"];
const SOURCES_BY_CHANNEL: Record<string, string[]> = {
  "Organic Search": ["google", "bing"],
  "Paid Social": ["facebook", "instagram"],
  "Organic Social": ["instagram", "facebook", "tiktok"],
  Direct: ["(direct)"],
  "Paid Search": ["google"],
  Referral: ["referidos.cl"],
  Email: ["newsletter"],
};

export interface GaTrafficSourceRow {
  channel: string;
  source: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
}

export function generateGaTrafficSources(brandSlug: BrandSlug): GaTrafficSourceRow[] {
  const rnd = seededRandom(`${brandSlug}-ga-traffic`);
  const weights: Record<string, number> = {
    "Organic Search": 0.28,
    "Paid Social": 0.24,
    "Organic Social": 0.14,
    Direct: 0.15,
    "Paid Search": 0.1,
    Referral: 0.05,
    Email: 0.04,
  };

  const totalSessions = 12000 + Math.round(rnd() * 8000);

  return CHANNELS.flatMap((channel) => {
    const sources = SOURCES_BY_CHANNEL[channel];
    const channelSessions = Math.round(totalSessions * weights[channel]);
    return sources.map((source) => {
      const sessions = Math.round(channelSessions / sources.length * (0.7 + rnd() * 0.6));
      const users = Math.round(sessions * (0.75 + rnd() * 0.15));
      return {
        channel,
        source,
        users,
        sessions,
        engagementRate: Number((40 + rnd() * 30).toFixed(2)),
        conversions: Math.round(sessions * (0.02 + rnd() * 0.04)),
        avgEngagementSec: Number((30 + rnd() * 100).toFixed(0)),
      };
    });
  });
}

const LANDING_PAGES = [
  { path: "/", title: "Inicio" },
  { path: "/informes-comerciales", title: "Informes Comerciales — Landing" },
  { path: "/simulador", title: "Simulador de Rentabilidad" },
  { path: "/convenio-de-pago", title: "Convenio de Pago" },
  { path: "/blog/dicom-que-es", title: "Blog: ¿Qué es el DICOM?" },
  { path: "/contacto", title: "Contacto" },
];

export interface GaLandingPageRowMock {
  path: string;
  title: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
  exitRate: number;
}

export function generateGaLandingPages(brandSlug: BrandSlug): GaLandingPageRowMock[] {
  const rnd = seededRandom(`${brandSlug}-ga-landing`);
  return LANDING_PAGES.map((lp) => {
    const sessions = Math.round(500 + rnd() * 4000);
    return {
      ...lp,
      users: Math.round(sessions * (0.8 + rnd() * 0.15)),
      sessions,
      engagementRate: Number((35 + rnd() * 35).toFixed(2)),
      conversions: Math.round(sessions * (0.01 + rnd() * 0.06)),
      avgEngagementSec: Number((20 + rnd() * 120).toFixed(0)),
      exitRate: Number((20 + rnd() * 50).toFixed(2)),
    };
  }).sort((a, b) => b.sessions - a.sessions);
}

const EVENT_NAMES: { name: string; isConversion: boolean }[] = [
  { name: "page_view", isConversion: false },
  { name: "session_start", isConversion: false },
  { name: "scroll", isConversion: false },
  { name: "click", isConversion: false },
  { name: "generate_lead", isConversion: true },
  { name: "form_submit", isConversion: true },
  { name: "outbound_click", isConversion: false },
  { name: "file_download", isConversion: false },
  { name: "whatsapp_click", isConversion: true },
];

export interface GaEventRowMock {
  eventName: string;
  eventCount: number;
  totalUsers: number;
  isConversion: boolean;
}

export function generateGaEvents(brandSlug: BrandSlug): GaEventRowMock[] {
  const rnd = seededRandom(`${brandSlug}-ga-events`);
  return EVENT_NAMES.map((e) => {
    const eventCount = e.isConversion ? Math.round(50 + rnd() * 400) : Math.round(1000 + rnd() * 15000);
    return {
      eventName: e.name,
      eventCount,
      totalUsers: Math.round(eventCount * (0.5 + rnd() * 0.3)),
      isConversion: e.isConversion,
    };
  }).sort((a, b) => b.eventCount - a.eventCount);
}

// ---------------------------------------------------------------------------
// Seguidores — histórico por red social
// ---------------------------------------------------------------------------

export interface FollowerPoint {
  date: string;
  followers: number;
  newFollowers: number;
}

const FOLLOWER_BASE: Record<BrandSlug, Record<string, number>> = {
  informes_comerciales: { INSTAGRAM: 14200, FACEBOOK: 22800, TIKTOK: 3100 },
  inversiones_cinco: { INSTAGRAM: 9800, FACEBOOK: 31500, TIKTOK: 1200 },
  segal_deudores: { INSTAGRAM: 21400, FACEBOOK: 18900, TIKTOK: 18400 },
};

export function generateFollowerSnapshots(brandSlug: BrandSlug, network: "INSTAGRAM" | "FACEBOOK" | "TIKTOK", days: number, endDate: Date = new Date()): FollowerPoint[] {
  const base = FOLLOWER_BASE[brandSlug][network];
  const dailyGrowthRate = network === "TIKTOK" ? 0.006 : 0.0015;

  const points: FollowerPoint[] = [];
  let current = Math.round(base / (1 + dailyGrowthRate * days));

  for (let i = days; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const rnd = seededRandom(`${brandSlug}-followers-${network}-${date.toISOString().slice(0, 10)}`);
    const newFollowers = Math.max(0, Math.round(current * dailyGrowthRate * (0.3 + rnd() * 1.4)));
    current += newFollowers;
    points.push({ date: date.toISOString().slice(0, 10), followers: current, newFollowers });
  }

  return points.slice(1); // se descarta el punto semilla usado solo para calcular el inicio
}

export function aggregateFollowerGrowth(points: FollowerPoint[]): { current: number; newInPeriod: number; growthRate: number } {
  if (points.length === 0) return { current: 0, newInPeriod: 0, growthRate: 0 };
  const current = points[points.length - 1].followers;
  const startValue = points[0].followers - points[0].newFollowers;
  const newInPeriod = points.reduce((a, p) => a + p.newFollowers, 0);
  const growthRate = startValue > 0 ? Number((((current - startValue) / startValue) * 100).toFixed(2)) : 0;
  return { current, newInPeriod, growthRate };
}

export function findMockPostById(id: string): Post | undefined {
  return getAllMockPosts().find((p) => p.id === id) ?? getAllTikTokMockPosts().find((p) => p.id === id);
}

export function getAllTikTokMockPosts(): Post[] {
  return BRANDS.flatMap((b) => generateTikTokPosts(b.slug));
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
