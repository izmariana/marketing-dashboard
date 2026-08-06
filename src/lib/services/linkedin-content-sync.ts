import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import {
  fetchLinkedInFollowerCount,
  fetchLinkedInPosts,
  fetchLinkedInPostStats,
  type LinkedInCredentials,
} from "@/lib/services/linkedin-client";

export interface LinkedInContentSyncResult {
  brandSlug: string;
  postsSynced: number;
  followerSnapshotsSynced: number;
  error?: string;
}

function computeScore(engagement: number, impressions: number, maxEngagement: number, maxImpressions: number): number {
  const e = maxEngagement > 0 ? engagement / maxEngagement : 0;
  const i = maxImpressions > 0 ? impressions / maxImpressions : 0;
  return Math.round((e * 0.7 + i * 0.3) * 100);
}

/**
 * Sincroniza publicaciones reales de LinkedIn + el conteo actual de
 * seguidores de la organización. Mismo patrón que syncMetaContent /
 * syncTikTokContent.
 *
 * Ojo: cada publicación requiere una llamada aparte a
 * organizationalEntityShareStatistics — con muchas publicaciones esto
 * puede acercarse a los límites de rate limit de LinkedIn. Si la marca
 * publica mucho, conviene bajar el `count` de fetchLinkedInPosts.
 */
export async function syncLinkedInContent(brandId: string): Promise<LinkedInContentSyncResult> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, include: { linkedinCredential: true } });

  if (!brand || !brand.linkedinCredential) {
    return { brandSlug: brand?.slug ?? brandId, postsSynced: 0, followerSnapshotsSynced: 0, error: "Sin credenciales de LinkedIn configuradas" };
  }

  const creds: LinkedInCredentials = {
    accessToken: decryptSecret(brand.linkedinCredential.accessTokenEnc),
    organizationUrn: brand.linkedinCredential.organizationUrn,
  };

  try {
    const posts = await fetchLinkedInPosts(creds, 20);

    const withStats = await Promise.all(
      posts.map(async (p) => {
        const stats = await fetchLinkedInPostStats(creds, p.id).catch(() => ({
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          impressionCount: 0,
        }));
        const engagement = stats.likeCount + stats.commentCount + stats.shareCount;
        return { post: p, stats, engagement };
      })
    );

    const maxEngagement = Math.max(1, ...withStats.map((w) => w.engagement));
    const maxImpressions = Math.max(1, ...withStats.map((w) => w.stats.impressionCount));

    let postsSynced = 0;
    for (const w of withStats) {
      await prisma.post.upsert({
        where: { metaPostId: `linkedin-${w.post.id}` },
        create: {
          metaPostId: `linkedin-${w.post.id}`,
          brandId: brand.id,
          network: "LINKEDIN",
          type: "IMAGE",
          fundingType: "ORGANIC",
          publishedAt: new Date(w.post.createdAt),
          thumbnailUrl: w.post.content?.article?.thumbnail ?? null,
          copy: w.post.commentary ?? null,
          reach: w.stats.impressionCount,
          impressions: w.stats.impressionCount,
          likes: w.stats.likeCount,
          comments: w.stats.commentCount,
          shares: w.stats.shareCount,
          engagement: w.engagement,
          clicks: 0,
          ctr: 0,
          performanceScore: computeScore(w.engagement, w.stats.impressionCount, maxEngagement, maxImpressions),
        },
        update: {
          reach: w.stats.impressionCount,
          impressions: w.stats.impressionCount,
          likes: w.stats.likeCount,
          comments: w.stats.commentCount,
          shares: w.stats.shareCount,
          engagement: w.engagement,
          performanceScore: computeScore(w.engagement, w.stats.impressionCount, maxEngagement, maxImpressions),
        },
      });
      postsSynced++;
    }

    let followerSnapshotsSynced = 0;
    const followerCount = await fetchLinkedInFollowerCount(creds);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.followerSnapshot.upsert({
      where: { brandId_network_date: { brandId: brand.id, network: "LINKEDIN", date: today } },
      create: { brandId: brand.id, network: "LINKEDIN", date: today, followers: followerCount, newFollowers: 0 },
      update: { followers: followerCount },
    });
    followerSnapshotsSynced++;

    await prisma.linkedinCredential.update({
      where: { brandId: brand.id },
      data: { lastSyncedAt: new Date(), syncStatus: "idle", syncError: null },
    });

    return { brandSlug: brand.slug, postsSynced, followerSnapshotsSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido sincronizando contenido de LinkedIn";
    await prisma.linkedinCredential.update({ where: { brandId: brand.id }, data: { syncStatus: "error", syncError: message } }).catch(() => {});
    return { brandSlug: brand.slug, postsSynced: 0, followerSnapshotsSynced: 0, error: message };
  }
}

export async function syncAllLinkedInContent(): Promise<LinkedInContentSyncResult[]> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ where: { linkedinCredential: { isNot: null } } });
  type BrandRow = (typeof brands)[number];
  return Promise.all(brands.map((brand: BrandRow) => syncLinkedInContent(brand.id)));
}
