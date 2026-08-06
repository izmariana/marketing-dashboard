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
  shares?: { count: number };
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
}

/**
 * Resuelve el Token de acceso de Página a partir de un Token de Usuario.
 *
 * Desde que Meta migró las Páginas a la "nueva experiencia para páginas",
 * los endpoints de contenido orgánico (`/{page-id}/posts`, `/{page-id}/insights`,
 * y por extensión los de la cuenta de Instagram Business conectada a esa
 * Página) YA NO aceptan un Token de Usuario — devuelven
 * `(#190) Invalid OAuth 2.0 Access Token` con
 * `error_subcode: 2069032` ("se necesita un token de acceso a la página").
 *
 * La solución es pedirle a Meta, con el Token de Usuario, la lista de
 * Páginas que administra (`/me/accounts`), que trae un `access_token`
 * específico por cada Página — ese es el que hay que usar para leer
 * posts/insights de esa Página y de su cuenta de Instagram vinculada.
 *
 * El Token de Usuario se sigue usando tal cual para Meta Ads
 * (`fetchCampaignInsights`, `fetchCampaigns`), que no tiene este problema.
 */
export async function getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
  const result = await metaFetch<PagedResponse<{ id: string; name: string; access_token: string }>>(
    `/me/accounts`,
    { access_token: userAccessToken, fields: "id,name,access_token", limit: "200" }
  );

  const page = result.data.find((p) => p.id === pageId);
  if (!page) {
    throw new MetaApiError(
      `No se encontró la Página ${pageId} entre las páginas que administra este Token de Usuario. ` +
        `Verifica que el usuario que generó el token tenga rol de administrador en esa Página de Facebook.`
    );
  }
  return page.access_token;
}

/**
 * IMPORTANTE: se usan campos básicos de Graph API (likes, comments, shares)
 * en vez de `insights.metric(...)`. Los nombres de métricas de Insights
 * cambian con cierta frecuencia entre versiones de la API de Meta y, si
 * un solo nombre queda inválido, Meta rechaza la solicitud COMPLETA con
 * "(#100) The value must be a valid insights metric" — tumbando toda la
 * sincronización de contenido, no solo esa métrica. Los campos básicos de
 * abajo son mucho más estables. Costo: no tenemos "alcance"/"impresiones"
 * reales por post (quedan en 0) — se puede recuperar más adelante
 * agregando insights.metric() de nuevo una vez confirmados los nombres
 * vigentes en el Graph API Explorer con datos reales.
 */
export async function fetchFacebookPosts(creds: MetaCredentials, limit = 50) {
  if (!creds.facebookPageId) throw new MetaApiError("Falta Facebook Page ID en Configuración");

  return metaFetch<PagedResponse<FacebookPostRaw>>(`/${creds.facebookPageId}/posts`, {
    access_token: creds.accessToken,
    fields:
      "id,message,created_time,permalink_url,full_picture,attachments{media_type,media,target{id}}," +
      "shares,likes.summary(true),comments.summary(true)",
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

/**
 * Trae el conteo actual de seguidores/fans de la página de Facebook y de
 * la cuenta de Instagram Business — Meta no expone un histórico propio de
 * seguidores día a día, así que este valor se guarda como un snapshot
 * nuevo cada vez que se sincroniza (nunca se sobrescribe el pasado).
 */
export async function fetchFollowerCounts(creds: MetaCredentials): Promise<{ facebookFollowers: number | null; instagramFollowers: number | null }> {
  const [fb, ig] = await Promise.all([
    creds.facebookPageId
      ? metaFetch<{ fan_count?: number }>(`/${creds.facebookPageId}`, { access_token: creds.accessToken, fields: "fan_count" }).catch(() => null)
      : Promise.resolve(null),
    creds.instagramBusinessId
      ? metaFetch<{ followers_count?: number }>(`/${creds.instagramBusinessId}`, { access_token: creds.accessToken, fields: "followers_count" }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    facebookFollowers: fb?.fan_count ?? null,
    instagramFollowers: ig?.followers_count ?? null,
  };
}

/**
 * Verifica las credenciales consultando datos básicos de la cuenta
 * publicitaria (nombre, estado, moneda) y cuenta cuántas campañas existen
 * en total, y también prueba por separado la Página de Facebook y la
 * cuenta de Instagram Business (si están configuradas) — usando el Token
 * de Página real (ver getPageAccessToken), que es lo que de verdad usa la
 * sincronización de contenido.
 */
export async function testMetaConnection(creds: MetaCredentials): Promise<{
  ok: boolean;
  error?: string;
  accountName?: string;
  accountStatus?: number;
  currency?: string;
  totalCampaigns?: number;
  page?: { ok: boolean; name?: string; error?: string };
  instagram?: { ok: boolean; username?: string; error?: string };
}> {
  try {
    const account = await metaFetch<{ name: string; account_status: number; currency: string }>(
      `/${creds.adAccountId}`,
      { access_token: creds.accessToken, fields: "name,account_status,currency" }
    );

    const campaignsResp = await fetchCampaigns(creds);

    let page: { ok: boolean; name?: string; error?: string } | undefined;
    let instagram: { ok: boolean; username?: string; error?: string } | undefined;
    let pageAccessToken: string | null = null;

    if (creds.facebookPageId) {
      try {
        pageAccessToken = await getPageAccessToken(creds.accessToken, creds.facebookPageId);
        const pageData = await metaFetch<{ name: string }>(`/${creds.facebookPageId}`, {
          access_token: pageAccessToken,
          fields: "name",
        });
        page = { ok: true, name: pageData.name };
      } catch (err) {
        page = { ok: false, error: err instanceof Error ? err.message : "Error desconocido probando la Página" };
      }
    }

    if (creds.instagramBusinessId) {
      try {
        const tokenForIg = pageAccessToken ?? creds.accessToken;
        const igData = await metaFetch<{ username?: string }>(`/${creds.instagramBusinessId}`, {
          access_token: tokenForIg,
          fields: "username",
        });
        instagram = { ok: true, username: igData.username };
      } catch (err) {
        instagram = { ok: false, error: err instanceof Error ? err.message : "Error desconocido probando Instagram" };
      }
    }

    return {
      ok: true,
      accountName: account.name,
      accountStatus: account.account_status,
      currency: account.currency,
      totalCampaigns: campaignsResp.data.length,
      page,
      instagram,
    };
  } catch (err) {
    return { ok: false, error: err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Error desconocido" };
  }
}

export { MetaApiError };