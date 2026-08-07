import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { fetchTikTokUserInfo, fetchTikTokVideos, type TikTokCredentials, type TikTokVideoRaw } from "@/lib/services/tiktok-client";

export interface TikTokContentSyncResult {
  brandSlug: string;
  postsSynced: number;
  followerSnapshotsSynced: number;
  error?: string;
}

function computeScore(engagement: number, reach: number, maxEngagement: number, maxReach: number): number {
  const e = maxEngagement > 0 ? engagement / maxEngagement : 0;
  const r = maxReach > 0 ? reach / maxReach : 0;
  return Math.round((e * 0.7 + r * 0.3) * 100);
}

/**
 * Sincroniza videos reales de TikTok + el conteo actual de seguidores.
 * Mismo patrón que syncMetaContent: nunca sobrescribe el histórico de
 * seguidores, solo agrega un snapshot nuevo por día.
 */
export async function syncTikTokContent(brandId: string): Promise<TikTokContentSyncResult> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, include: { tiktokCredential: true } });

  if (!brand || !brand.tiktokCredential) {
    return { brandSlug: brand?.slug ?? brandId, postsSynced: 0, followerSnapshotsSynced: 0, error: "Sin credenciales de TikTok configuradas" };
  }

  const creds: TikTokCredentials = {
    accessToken: decryptSecret(brand.tiktokCredential.accessTokenEnc),
    openId: brand.tiktokCredential.openId,
  };

  try {
    const videos: TikTokVideoRaw[] = await fetchTikTokVideos(creds, 30);

    const shaped = videos.map((v) => ({
      video: v,
      engagement: v.like_count + v.comment_count + v.share_count,
    }));
    const maxEngagement = Math.max(1, ...shaped.map((s) => s.engagement));
    const maxReach = Math.max(1, ...shaped.map((s) => s.video.view_count));

    let postsSynced = 0;
    for (const s of shaped) {
      const ctr = 0; // TikTok no expone clics en contenido orgánico
      await prisma.post.upsert({
        where: { metaPostId: `tiktok-${s.video.id}` },
        create: {
          metaPostId: `tiktok-${s.video.id}`,
          brandId: brand.id,
          network: "TIKTOK",
          type: "VIDEO",
          fundingType: "ORGANIC",
          publishedAt: new Date(s.video.create_time * 1000),
          mediaUrl: s.video.cover_image_url ?? null,
          thumbnailUrl: s.video.cover_image_url ?? null,
          copy: s.video.title ?? null,
          permalink: s.video.embed_link ?? null,
          reach: s.video.view_count,
          impressions: s.video.view_count,
          likes: s.video.like_count,
          comments: s.video.comment_count,
          shares: s.video.share_count,
          engagement: s.engagement,
          clicks: 0,
          ctr,
          performanceScore: computeScore(s.engagement, s.video.view_count, maxEngagement, maxReach),
        },
        update: {
          reach: s.video.view_count,
          impressions: s.video.view_count,
          likes: s.video.like_count,
          comments: s.video.comment_count,
          shares: s.video.share_count,
          engagement: s.engagement,
          performanceScore: computeScore(s.engagement, s.video.view_count, maxEngagement, maxReach),
        },
      });
      postsSynced++;
    }

    let followerSnapshotsSynced = 0;
    const userInfo = await fetchTikTokUserInfo(creds);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.followerSnapshot.upsert({
      where: { brandId_network_date: { brandId: brand.id, network: "TIKTOK", date: today } },
      create: { brandId: brand.id, network: "TIKTOK", date: today, followers: userInfo.follower_count, newFollowers: 0 },
      update: { followers: userInfo.follower_count },
    });
    followerSnapshotsSynced++;

    await prisma.tiktokCredential.update({
      where: { brandId: brand.id },
      data: { lastSyncedAt: new Date(), syncStatus: "idle", syncError: null },
    });

    return { brandSlug: brand.slug, postsSynced, followerSnapshotsSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido sincronizando contenido de TikTok";
    console.error(`[syncTikTokContent] ${brand.slug}:`, err);
    await prisma.tiktokCredential.update({ where: { brandId: brand.id }, data: { syncStatus: "error", syncError: message } }).catch(() => {});
    return { brandSlug: brand.slug, postsSynced: 0, followerSnapshotsSynced: 0, error: message };
  }
}

export async function syncAllTikTokContent(): Promise<TikTokContentSyncResult[]> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ where: { tiktokCredential: { isNot: null } } });
  type BrandRow = (typeof brands)[number];
  return Promise.all(brands.map((brand: BrandRow) => syncTikTokContent(brand.id)));
}
