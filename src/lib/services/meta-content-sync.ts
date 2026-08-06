import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import {
  fetchFacebookPosts,
  fetchInstagramMedia,
  fetchInstagramMediaInsights,
  fetchFollowerCounts,
  getPageAccessToken,
  type MetaCredentials,
  type FacebookPostRaw,
  type InstagramMediaRaw,
} from "@/lib/services/meta-client";

export interface MetaContentSyncResult {
  brandSlug: string;
  postsSynced: number;
  followerSnapshotsSynced: number;
  error?: string;
}

function fbPostType(post: FacebookPostRaw): "IMAGE" | "VIDEO" | "CAROUSEL" {
  const attachments = post.attachments?.data ?? [];
  if (attachments.length > 1) return "CAROUSEL";
  const mediaType = attachments[0]?.media_type;
  if (mediaType === "video_inline" || mediaType === "video_autoplay" || mediaType === "video") return "VIDEO";
  return "IMAGE";
}

function igPostType(media: InstagramMediaRaw): "REEL" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE" {
  if (media.media_product_type === "REELS") return "REEL";
  if (media.media_product_type === "STORY") return "STORY";
  if (media.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (media.media_type === "VIDEO") return "VIDEO";
  return "IMAGE";
}

function computeScore(engagement: number, ctr: number, reach: number, maxEngagement: number, maxCtr: number, maxReach: number): number {
  const e = maxEngagement > 0 ? engagement / maxEngagement : 0;
  const c = maxCtr > 0 ? ctr / maxCtr : 0;
  const r = maxReach > 0 ? reach / maxReach : 0;
  return Math.round((e * 0.5 + c * 0.25 + r * 0.25) * 100);
}

/**
 * Sincroniza publicaciones reales de Facebook + Instagram y el conteo
 * actual de seguidores de una marca. A diferencia de las campañas pagadas,
 * Meta no entrega un histórico diario de seguidores — por eso cada
 * sincronización agrega un snapshot nuevo (nunca sobrescribe uno pasado),
 * y así se construye el histórico propio con el tiempo.
 */
export async function syncMetaContent(brandId: string): Promise<MetaContentSyncResult> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, include: { metaCredential: true } });

  if (!brand || !brand.metaCredential) {
    return { brandSlug: brand?.slug ?? brandId, postsSynced: 0, followerSnapshotsSynced: 0, error: "Sin credenciales de Meta configuradas" };
  }

  const creds: MetaCredentials = {
    accessToken: decryptSecret(brand.metaCredential.accessTokenEnc),
    adAccountId: brand.metaCredential.adAccountId,
    facebookPageId: brand.metaCredential.facebookPageId ?? undefined,
    instagramBusinessId: brand.metaCredential.instagramBusinessId ?? undefined,
  };

  try {
    // El contenido orgánico (posts, Instagram, seguidores) necesita el
    // Token de Página, no el Token de Usuario — ver getPageAccessToken()
    // en meta-client.ts para el detalle de por qué. Meta Ads sigue usando
    // creds.accessToken (Token de Usuario) sin cambios.
    let contentCreds: MetaCredentials = creds;
    if (creds.facebookPageId) {
      const pageAccessToken = await getPageAccessToken(creds.accessToken, creds.facebookPageId);
      contentCreds = { ...creds, accessToken: pageAccessToken };
    }

    let postsSynced = 0;

    // --- Publicaciones de Facebook ---
    if (contentCreds.facebookPageId) {
      const fbPosts = await fetchFacebookPosts(contentCreds, 30);
      const shaped = fbPosts.data.map((p) => {
        const likes = p.likes?.summary?.total_count ?? 0;
        const comments = p.comments?.summary?.total_count ?? 0;
        const shares = p.shares?.count ?? 0;
        return { post: p, likes, comments, shares, engagement: likes + comments + shares };
      });
      const maxEngagement = Math.max(1, ...shaped.map((s) => s.engagement));

      for (const s of shaped) {
        await prisma.post.upsert({
          where: { metaPostId: s.post.id },
          create: {
            metaPostId: s.post.id,
            brandId: brand.id,
            network: "FACEBOOK",
            type: fbPostType(s.post),
            fundingType: "ORGANIC",
            publishedAt: new Date(s.post.created_time),
            mediaUrl: s.post.full_picture ?? null,
            thumbnailUrl: s.post.full_picture ?? null,
            copy: s.post.message ?? null,
            permalink: s.post.permalink_url ?? null,
            // Meta ya no permite pedir alcance/impresiones de forma
            // confiable sin el permiso avanzado de Insights — quedan en 0
            // por ahora (ver nota en meta-client.ts → fetchFacebookPosts).
            reach: 0,
            impressions: 0,
            likes: s.likes,
            comments: s.comments,
            shares: s.shares,
            engagement: s.engagement,
            clicks: 0,
            ctr: 0,
            performanceScore: computeScore(s.engagement, 0, 0, maxEngagement, 1, 1),
          },
          update: {
            likes: s.likes,
            comments: s.comments,
            shares: s.shares,
            engagement: s.engagement,
            performanceScore: computeScore(s.engagement, 0, 0, maxEngagement, 1, 1),
          },
        });
        postsSynced++;
      }
    }

    // --- Publicaciones de Instagram ---
    if (contentCreds.instagramBusinessId) {
      const igMedia = await fetchInstagramMedia(contentCreds, 30);
      const withInsights = await Promise.all(
        igMedia.data.map(async (m) => {
          const insights = await fetchInstagramMediaInsights(contentCreds, m.id, m.media_product_type ?? "FEED").catch(() => null);
          const getMetric = (name: string) => insights?.data.find((d) => d.name === name)?.values?.[0]?.value ?? 0;
          return {
            media: m,
            reach: getMetric("reach"),
            saves: getMetric("saved"),
            shares: getMetric("shares"),
            plays: getMetric("plays"),
          };
        })
      );

      const maxEngagement = Math.max(1, ...withInsights.map((s) => (s.media.like_count ?? 0) + (s.media.comments_count ?? 0) + s.saves + s.shares));
      const maxReach = Math.max(1, ...withInsights.map((s) => s.reach));

      for (const s of withInsights) {
        const engagement = (s.media.like_count ?? 0) + (s.media.comments_count ?? 0) + s.saves + s.shares;
        await prisma.post.upsert({
          where: { metaPostId: s.media.id },
          create: {
            metaPostId: s.media.id,
            brandId: brand.id,
            network: "INSTAGRAM",
            type: igPostType(s.media),
            fundingType: "ORGANIC",
            publishedAt: new Date(s.media.timestamp),
            mediaUrl: s.media.media_url ?? null,
            thumbnailUrl: s.media.thumbnail_url ?? s.media.media_url ?? null,
            copy: s.media.caption ?? null,
            permalink: s.media.permalink,
            reach: s.reach,
            impressions: s.reach,
            plays: s.plays,
            likes: s.media.like_count ?? 0,
            comments: s.media.comments_count ?? 0,
            shares: s.shares,
            saves: s.saves,
            engagement,
            performanceScore: computeScore(engagement, 0, s.reach, maxEngagement, 1, maxReach),
          },
          update: {
            reach: s.reach,
            impressions: s.reach,
            plays: s.plays,
            likes: s.media.like_count ?? 0,
            comments: s.media.comments_count ?? 0,
            shares: s.shares,
            saves: s.saves,
            engagement,
            performanceScore: computeScore(engagement, 0, s.reach, maxEngagement, 1, maxReach),
          },
        });
        postsSynced++;
      }
    }

    // --- Seguidores (snapshot del día de hoy, nunca se sobrescribe el histórico) ---
    let followerSnapshotsSynced = 0;
    const followers = await fetchFollowerCounts(contentCreds);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (followers.facebookFollowers !== null) {
      const created = await prisma.followerSnapshot.upsert({
        where: { brandId_network_date: { brandId: brand.id, network: "FACEBOOK", date: today } },
        create: { brandId: brand.id, network: "FACEBOOK", date: today, followers: followers.facebookFollowers, newFollowers: 0 },
        update: { followers: followers.facebookFollowers },
      });
      if (created) followerSnapshotsSynced++;
    }
    if (followers.instagramFollowers !== null) {
      const created = await prisma.followerSnapshot.upsert({
        where: { brandId_network_date: { brandId: brand.id, network: "INSTAGRAM", date: today } },
        create: { brandId: brand.id, network: "INSTAGRAM", date: today, followers: followers.instagramFollowers, newFollowers: 0 },
        update: { followers: followers.instagramFollowers },
      });
      if (created) followerSnapshotsSynced++;
    }

    return { brandSlug: brand.slug, postsSynced, followerSnapshotsSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido sincronizando contenido de Meta";
    return { brandSlug: brand.slug, postsSynced: 0, followerSnapshotsSynced: 0, error: message };
  }
}

export async function syncAllMetaContent(): Promise<MetaContentSyncResult[]> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ where: { metaCredential: { isNot: null } } });
  type BrandRow = (typeof brands)[number];
  return Promise.all(brands.map((brand: BrandRow) => syncMetaContent(brand.id)));
}