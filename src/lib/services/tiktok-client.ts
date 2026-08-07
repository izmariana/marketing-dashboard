/**
 * Cliente de la API de TikTok (TikTok for Developers, v2 — open.tiktokapis.com).
 *
 * IMPORTANTE — a diferencia de Meta, esto no se puede probar aquí sin
 * credenciales reales de una app aprobada por TikTok. La forma exacta de
 * la respuesta viene de la documentación pública de TikTok (developers.
 * tiktok.com/doc/tiktok-api-v2-video-list, .../user-info) — trátalo como
 * un punto de partida sólido, no como algo ya verificado en producción.
 * Si algún campo no llega tal cual, ajusta este archivo — el resto de la
 * app (Post, FollowerSnapshot) no necesita cambios.
 *
 * Requiere que la cuenta de TikTok Business haya autorizado tu app con los
 * scopes `user.info.stats` (seguidores) y `video.list` (videos + métricas).
 */

const TIKTOK_BASE_URL = "https://open.tiktokapis.com/v2";

export interface TikTokCredentials {
  accessToken: string;
  openId: string;
}

class TikTokApiError extends Error {
  constructor(message: string, public status?: number, public raw?: unknown) {
    super(message);
    this.name = "TikTokApiError";
  }
}

async function tiktokGet<T>(path: string, accessToken: string, searchParams?: Record<string, string>): Promise<T> {
  const url = new URL(`${TIKTOK_BASE_URL}${path}`);
  Object.entries(searchParams ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok || json.error?.code !== "ok") {
    throw new TikTokApiError(json.error?.message ?? `TikTok API error (${res.status})`, res.status, json.error);
  }
  return json as T;
}

async function tiktokPost<T>(path: string, accessToken: string, body: Record<string, unknown>, searchParams?: Record<string, string>): Promise<T> {
  const url = new URL(`${TIKTOK_BASE_URL}${path}`);
  Object.entries(searchParams ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error?.code !== "ok") {
    throw new TikTokApiError(json.error?.message ?? `TikTok API error (${res.status})`, res.status, json.error);
  }
  return json as T;
}

export interface TikTokUserInfo {
  open_id: string;
  display_name: string;
  follower_count: number;
  likes_count?: number;
  video_count?: number;
}

/** GET /v2/user/info/ — datos básicos y conteo de seguidores de la cuenta. */
export async function fetchTikTokUserInfo(creds: TikTokCredentials): Promise<TikTokUserInfo> {
  const result = await tiktokGet<{ data: { user: TikTokUserInfo } }>("/user/info/", creds.accessToken, {
    fields: "open_id,display_name,follower_count,likes_count,video_count",
  });
  return result.data.user;
}

export interface TikTokVideoRaw {
  id: string;
  create_time: number; // epoch seconds
  cover_image_url?: string;
  title?: string;
  embed_link?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

/** POST /v2/video/list/ — videos publicados con sus métricas. */
export async function fetchTikTokVideos(creds: TikTokCredentials, maxCount = 20): Promise<TikTokVideoRaw[]> {
  const result = await tiktokPost<{
    data: { videos?: TikTokVideoRaw[]; video_list?: TikTokVideoRaw[]; has_more: boolean; cursor: number };
  }>(
    "/video/list/",
    creds.accessToken,
    { max_count: maxCount },
    { fields: "id,create_time,cover_image_url,title,embed_link,view_count,like_count,comment_count,share_count" }
  );
  // Documentación de TikTok inconsistente entre versiones: a veces el campo
  // se llama "videos", a veces "video_list" — se aceptan ambos por si acaso.
  return result.data.videos ?? result.data.video_list ?? [];
}

/**
 * Prueba de conexión — trae info de usuario y hasta 1 video, para
 * confirmar que el Access Token y los scopes están correctos sin traer
 * todo el contenido.
 */
export async function testTikTokConnection(creds: TikTokCredentials): Promise<{
  ok: boolean;
  error?: string;
  displayName?: string;
  followerCount?: number;
  videoCount?: number;
}> {
  try {
    const user = await fetchTikTokUserInfo(creds);
    return { ok: true, displayName: user.display_name, followerCount: user.follower_count, videoCount: user.video_count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export { TikTokApiError };
