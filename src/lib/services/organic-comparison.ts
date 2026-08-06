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
 * TikTok y LinkedIn. Si `linkedinData` es null, LinkedIn se devuelve con
 * connected:false (todavía no hay credenciales guardadas para esa marca) —
 * en vez de inventar cifras se muestra como "Próximamente".
 */
export function compareOrganicPlatforms(
  metaPosts: Post[],
  tiktokPosts: Post[],
  metaFollowers: FollowerAgg,
  tiktokFollowers: FollowerAgg,
  linkedinData: { posts: Post[]; followers: FollowerAgg } | null = null
): OrganicPlatformStat[] {
  const meta = statsFromPosts(metaPosts);
  const tiktok = statsFromPosts(tiktokPosts);
  const linkedin = linkedinData ? statsFromPosts(linkedinData.posts) : null;

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
    linkedin
      ? {
          network: "LINKEDIN",
          label: "LinkedIn",
          connected: true,
          followers: linkedinData!.followers.current,
          followerGrowth: linkedinData!.followers.newInPeriod,
          posts: linkedin.count,
          totalEngagement: linkedin.totalEngagement,
          avgEngagementPerPost: linkedin.count > 0 ? Math.round(linkedin.totalEngagement / linkedin.count) : 0,
          avgReach: linkedin.avgReach,
        }
      : {
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
