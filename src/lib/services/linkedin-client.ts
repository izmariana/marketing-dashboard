/**
 * Cliente de la API de LinkedIn (LinkedIn Marketing/Community Management
 * API v2, api.linkedin.com/rest).
 *
 * IMPORTANTE — LinkedIn es la integración más restringida de las tres:
 * para leer publicaciones y estadísticas de una Página de empresa,
 * LinkedIn exige que tu app esté aprobada en el "LinkedIn Marketing
 * Developer Platform" (o el producto "Community Management API"), algo
 * que se solicita y aprueba caso a caso — no es autoservicio como Meta o
 * TikTok. Sin esa aprobación, estos endpoints devuelven 403 aunque el
 * token sea válido.
 *
 * Los endpoints y campos de abajo siguen la documentación pública de
 * LinkedIn (learn.microsoft.com/linkedin/marketing/community-management/
 * organizations), pero no se han probado contra una cuenta real —
 * trátalo como punto de partida, no como algo ya verificado.
 *
 * Requiere: un Access Token con scope `r_organization_social` (leer
 * publicaciones) y `rw_organization_admin` o `r_organization_followers`
 * (leer seguidores) de la organización.
 */

const LINKEDIN_BASE_URL = "https://api.linkedin.com/rest";
const LINKEDIN_API_VERSION = "202401"; // LinkedIn versiona por mes (YYYYMM) — ajustar si LinkedIn deprecó esta versión

class LinkedInApiError extends Error {
  constructor(message: string, public status?: number, public raw?: unknown) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

export interface LinkedInCredentials {
  accessToken: string;
  organizationUrn: string; // formato: urn:li:organization:12345678
}

async function linkedinGet<T>(path: string, accessToken: string, searchParams?: Record<string, string>): Promise<T> {
  const url = new URL(`${LINKEDIN_BASE_URL}${path}`);
  Object.entries(searchParams ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new LinkedInApiError(
      body?.message ?? `LinkedIn API error (${res.status}). Revisa que la app tenga aprobado el acceso a Community Management API.`,
      res.status,
      body
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Seguidores totales de la organización.
 * GET /organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity={urn}
 */
export async function fetchLinkedInFollowerCount(creds: LinkedInCredentials): Promise<number> {
  const result = await linkedinGet<{
    elements: Array<{ followerCounts: { organicFollowerCount: number; paidFollowerCount: number } }>;
  }>("/organizationalEntityFollowerStatistics", creds.accessToken, {
    q: "organizationalEntity",
    organizationalEntity: creds.organizationUrn,
  });
  const totals = result.elements?.[0]?.followerCounts;
  return (totals?.organicFollowerCount ?? 0) + (totals?.paidFollowerCount ?? 0);
}

export interface LinkedInPostRaw {
  id: string;
  createdAt: number; // epoch ms
  commentary?: string;
  content?: { article?: { thumbnail?: string } };
}

/**
 * Publicaciones de la organización.
 * GET /posts?author={urn}&q=author
 */
export async function fetchLinkedInPosts(creds: LinkedInCredentials, count = 20): Promise<LinkedInPostRaw[]> {
  const result = await linkedinGet<{ elements: LinkedInPostRaw[] }>("/posts", creds.accessToken, {
    author: creds.organizationUrn,
    q: "author",
    count: String(count),
    sortBy: "LAST_MODIFIED",
  });
  return result.elements ?? [];
}

export interface LinkedInPostStats {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  impressionCount: number;
}

/**
 * Métricas de una publicación puntual.
 * GET /organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity={urn}&shares[0]={postId}
 */
export async function fetchLinkedInPostStats(creds: LinkedInCredentials, postUrn: string): Promise<LinkedInPostStats> {
  const result = await linkedinGet<{
    elements: Array<{ totalShareStatistics: { likeCount: number; commentCount: number; shareCount: number; impressionCount: number } }>;
  }>("/organizationalEntityShareStatistics", creds.accessToken, {
    q: "organizationalEntity",
    organizationalEntity: creds.organizationUrn,
    "shares[0]": postUrn,
  });
  const stats = result.elements?.[0]?.totalShareStatistics;
  return {
    likeCount: stats?.likeCount ?? 0,
    commentCount: stats?.commentCount ?? 0,
    shareCount: stats?.shareCount ?? 0,
    impressionCount: stats?.impressionCount ?? 0,
  };
}

/**
 * Prueba de conexión — solo trae el conteo de seguidores, para confirmar
 * que el token y los permisos de la organización están bien sin traer
 * todo el contenido.
 */
export async function testLinkedInConnection(creds: LinkedInCredentials): Promise<{
  ok: boolean;
  error?: string;
  followerCount?: number;
}> {
  try {
    const followerCount = await fetchLinkedInFollowerCount(creds);
    return { ok: true, followerCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export { LinkedInApiError };
