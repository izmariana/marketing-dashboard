// Tipos de dominio compartidos entre servicios, mocks y UI.
// Mantener esta forma == forma real de Meta API para que el swap sea trivial.

export type BrandSlug = "informes_comerciales" | "inversiones_cinco" | "segal_deudores";

export interface Brand {
  id: string;
  slug: BrandSlug;
  name: string;
  themeColor: string;
}

export const BRANDS: Brand[] = [
  { id: "informes_comerciales", slug: "informes_comerciales", name: "Informes Comerciales", themeColor: "#5B8DEF" },
  { id: "inversiones_cinco", slug: "inversiones_cinco", name: "Inversiones Cinco", themeColor: "#3FBF8F" },
  { id: "segal_deudores", slug: "segal_deudores", name: "Segal Deudores", themeColor: "#E0A63C" },
];

export interface MetricPoint {
  date: string; // ISO date
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number; // %
  cpc: number; // $
  cpm: number; // $
  leads: number;
  cpl: number; // $
  conversions: number;
  conversionRate: number; // %
  roas: number | null;
  frequency: number;
  engagement: number;
  engagementRate: number; // % — interacciones / alcance
}

export type CampaignObjective =
  | "LEADS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "CONVERSIONS"
  | "AWARENESS"
  | "APP_PROMOTION"
  | "SALES";

export type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "DELETED";

export interface Campaign {
  id: string;
  metaCampaignId: string;
  brandSlug: BrandSlug;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  dailyBudget: number | null;
  spentToDate: number;
  startDate: string;
  endDate: string | null;
  metrics: MetricPoint; // acumulado del período seleccionado
}

export type SocialNetwork = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "LINKEDIN";
export type PostType = "REEL" | "CAROUSEL" | "IMAGE" | "STORY" | "VIDEO";
export type PostFundingType = "ORGANIC" | "PAID";

export interface Post {
  id: string;
  brandSlug: BrandSlug;
  campaignName: string | null;
  network: SocialNetwork;
  type: PostType;
  fundingType: PostFundingType;
  publishedAt: string;
  thumbnailUrl: string;
  copy: string;
  reach: number;
  impressions: number;
  plays: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  clicks: number;
  ctr: number;
  spend: number;
  leads: number;
  cpl: number;
  performanceScore: number;
  // Curva de retención de video — solo poblada para posts de video de
  // plataformas que la exponen (hoy: Facebook). null en el resto de casos.
  mediaUrl?: string | null;
  videoDurationSec?: number | null;
  avgWatchPct?: number | null;
  retentionP25?: number | null;
  retentionP50?: number | null;
  retentionP75?: number | null;
  retentionP95?: number | null;
}

export interface AiPostInsight {
  whyItWorked: string;
  whatToReplicate: string;
  whatToImprove: string;
  similarIdeas: string;
  nextContentIdea: string;
}

export type AlertType =
  | "CTR_DROP"
  | "CPL_INCREASE"
  | "CAMPAIGN_STOPPED_DELIVERY"
  | "HIGH_FREQUENCY"
  | "BUDGET_DEPLETING"
  | "ENGAGEMENT_DROP"
  | "FOLLOWER_DROP"
  | "POST_UNDERPERFORMING"
  | "LANDING_PAGE_ABANDONMENT"
  | "CAMPAIGN_NO_RESULTS"
  | "SYNC_ERROR";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Alert {
  id: string;
  brandSlug: BrandSlug;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
  createdAt: string;
  isRead: boolean;
}

export type PeriodGrain = "daily" | "weekly" | "monthly";
