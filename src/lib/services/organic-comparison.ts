import type { Post } from "@/types/domain";

export interface OrganicPlatformStat {
  network: "META" | "TIKTOK" | "LINKEDIN";
  label: string;
  /** false para LinkedIn: todavía no hay integración con su API */
  connected: boolean;
  followers: number | null;
  followerGrowth: number | null;
  posts: number | null;
  totalEngagement: number | null;
  avgEngagementPerPost: number | null;
  avgReach: number | null;
}

interface FollowerAgg {
  current: number;
  newInPeriod: number;
}

function statsFromPosts(posts: Post[]): { count: number; totalEngagement: number; avgReach: number } {
  if (posts.length === 0) return { count: 0, totalEngagement: 0, avgReach: 0 };
  const totalEngagement = posts.reduce((a, p) => a + p.engagement, 0);
  const totalReach = posts.reduce((a, p) => a + p.reach, 0);
  return { count: posts.length, totalEngagement, avgReach: Math.round(totalReach / posts.length) };
}

/**
 * Arma la comparación orgánica entre Meta (Facebook + Instagram combinados),
 * TikTok y LinkedIn. LinkedIn siempre se devuelve con connected:false porque
 * todavía no hay integración con su API — se muestra igual en la tabla como
 * "Próximamente" en vez de ocultarse, para que quede claro qué falta.
 */
export function compareOrganicPlatforms(
  metaPosts: Post[],
  tiktokPosts: Post[],
  metaFollowers: FollowerAgg,
  tiktokFollowers: FollowerAgg
): OrganicPlatformStat[] {
  const meta = statsFromPosts(metaPosts);
  const tiktok = statsFromPosts(tiktokPosts);

  return [
    {
      network: "META",
      label: "Meta (Facebook + Instagram)",
      connected: true,
      followers: metaFollowers.current,
      followerGrowth: metaFollowers.newInPeriod,
      posts: meta.count,
      totalEngagement: meta.totalEngagement,
      avgEngagementPerPost: meta.count > 0 ? Math.round(meta.totalEngagement / meta.count) : 0,
      avgReach: meta.avgReach,
    },
    {
      network: "TIKTOK",
      label: "TikTok",
      connected: true,
      followers: tiktokFollowers.current,
      followerGrowth: tiktokFollowers.newInPeriod,
      posts: tiktok.count,
      totalEngagement: tiktok.totalEngagement,
      avgEngagementPerPost: tiktok.count > 0 ? Math.round(tiktok.totalEngagement / tiktok.count) : 0,
      avgReach: tiktok.avgReach,
    },
    {
      network: "LINKEDIN",
      label: "LinkedIn",
      connected: false,
      followers: null,
      followerGrowth: null,
      posts: null,
      totalEngagement: null,
      avgEngagementPerPost: null,
      avgReach: null,
    },
  ];
}
