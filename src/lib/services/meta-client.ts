/**
 * Cliente de Meta Marketing API + Meta Graph API.
 *
 * Este archivo hace las llamadas HTTP reales contra Graph API. No requiere
 * ningún SDK adicional: Meta expone todo por REST sobre HTTPS.
 *
 * Para activarlo con datos reales:
 *  1. Completa META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID e
 *     META_IG_BUSINESS_ID en la página de Configuración (se guardan
 *     encriptados en AppSettings/MetaCredential) o en .env para desarrollo.
 *  2. Cambia USE_MOCK_DATA=false en .env
 *
 * Ver README.md → "Cómo obtener tus tokens de Meta" para el paso a paso.
 */

const GRAPH_API_VERSION = "v20.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaCredentials {
  accessToken: string;
  adAccountId: string; // formato: act_1234567890
  facebookPageId?: string;
  instagramBusinessId?: string;
}

class MetaApiError extends Error {
  constructor(message: string, public status?: number, public raw?: unknown) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function metaFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { method: "GET" });
  const json = await res.json();

  if (!res.ok || json.error) {
    throw new MetaApiError(
      json.error?.message ?? `Meta API error (${res.status})`,
      res.status,
      json.error
    );
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Marketing API — Insights de campañas / conjuntos / anuncios
// ---------------------------------------------------------------------------

export const META_INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "spend",
  "reach",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "cost_per_action_type",
  "frequency",
].join(",");

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  spend: string;
  reach: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  frequency: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  campaign_id?: string;
  campaign_name?: string;
}

interface PagedResponse<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/**
 * Trae insights diarios de todas las campañas de una cuenta publicitaria
 * en el rango de fechas dado. `level` puede ser campaign | adset | ad.
 */
export async function fetchCampaignInsights(
  creds: MetaCredentials,
  opts: { since: string; until: string; level?: "campaign" | "adset" | "ad" }
): Promise<MetaInsightRow[]> {
  const { since, until, level = "campaign" } = opts;

  const result = await metaFetch<PagedResponse<MetaInsightRow>>(
    `/${creds.adAccountId}/insights`,
    {
      access_token: creds.accessToken,
      level,
      fields: META_INSIGHT_FIELDS,
      time_range: JSON.stringify({ since, until }),
      time_increment: "1", // desagregado por día → grain DAILY nativo
      limit: "500",
    }
  );

  return result.data;
}

export async function fetchCampaigns(creds: MetaCredentials) {
  return metaFetch<PagedResponse<{
    id: string;
    name: string;
    objective: string;
    status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    start_time?: string;
    stop_time?: string;
  }>>(`/${creds.adAccountId}/campaigns`, {
    access_token: creds.accessToken,
    fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "500",
  });
}

// ---------------------------------------------------------------------------
// Graph API — Publicaciones de Facebook Page / Instagram Business
// ---------------------------------------------------------------------------

export interface FacebookPostRaw {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data: { media_type: string; media?: { image?: { src: string } } }[] };
  insights?: {
    data: { name: string; values: { value: number }[] }[];
  };
}

export async function fetchFacebookPosts(creds: MetaCredentials, limit = 50) {
  if (!creds.facebookPageId) throw new MetaApiError("Falta Facebook Page ID en Configuración");

  return metaFetch<PagedResponse<FacebookPostRaw>>(`/${creds.facebookPageId}/posts`, {
    access_token: creds.accessToken,
    fields:
      "id,message,created_time,permalink_url,full_picture,attachments{media_type,media},insights.metric(post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total)",
    limit: String(limit),
  });
}

export interface InstagramMediaRaw {
  id: string;
  caption?: string;
  media_type: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export async function fetchInstagramMedia(creds: MetaCredentials, limit = 50) {
  if (!creds.instagramBusinessId)
    throw new MetaApiError("Falta Instagram Business ID en Configuración");

  return metaFetch<PagedResponse<InstagramMediaRaw>>(`/${creds.instagramBusinessId}/media`, {
    access_token: creds.accessToken,
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
}

export async function fetchInstagramMediaInsights(
  creds: MetaCredentials,
  mediaId: string,
  mediaProductType: string
) {
  // Las métricas disponibles varían según tipo de media (feed/reel/story)
  const metricMap: Record<string, string> = {
    FEED: "reach,saved,shares,total_interactions",
    REELS: "reach,saved,shares,plays,total_interactions",
    STORY: "reach,replies,exits,taps_forward",
  };
  const metrics = metricMap[mediaProductType] ?? "reach,saved,shares";

  return metaFetch<{ data: { name: string; values: { value: number }[] }[] }>(
    `/${mediaId}/insights`,
    { access_token: creds.accessToken, metric: metrics }
  );
}

export { MetaApiError };
