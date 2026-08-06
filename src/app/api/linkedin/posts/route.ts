import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import type { Post } from "@/types/domain";

const SORT_MAP: Record<string, keyof Post> = {
  alcance: "reach",
  engagement: "engagement",
  comentarios: "comments",
  compartidos: "shares",
  score: "performanceScore",
};

/**
 * GET /api/linkedin/posts?brand=&sort=&order=
 * A diferencia de Meta/TikTok, no hay datos de ejemplo (mock) para
 * LinkedIn — sin base de datos conectada devuelve una lista vacía en vez
 * de inventar publicaciones.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("brand");
  const sortKey = sp.get("sort") ?? "score";
  const order = sp.get("order") ?? "desc";

  if (!isDatabaseConfigured) {
    return NextResponse.json({ posts: [], source: "no-data" });
  }

  const prisma = await getPrisma();
  const dbPosts = await prisma.post.findMany({
    where: { network: "LINKEDIN", brand: brand ? { slug: brand as never } : undefined },
    include: { brand: true, campaign: true },
    orderBy: { publishedAt: "desc" },
    take: 200,
  });

  type DbPost = (typeof dbPosts)[number];
  let posts: Post[] = dbPosts.map((p: DbPost) => ({
    id: p.id,
    brandSlug: p.brand.slug,
    campaignName: p.campaign?.name ?? null,
    network: p.network,
    type: p.type,
    fundingType: p.fundingType,
    publishedAt: p.publishedAt.toISOString(),
    thumbnailUrl: p.thumbnailUrl ?? p.mediaUrl ?? "",
    copy: p.copy ?? "",
    reach: p.reach,
    impressions: p.impressions,
    plays: p.plays,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    engagement: p.engagement,
    clicks: p.clicks,
    ctr: p.ctr ? Number(p.ctr) : 0,
    spend: p.spend ? Number(p.spend) : 0,
    leads: p.leads,
    cpl: p.cpl ? Number(p.cpl) : 0,
    performanceScore: p.performanceScore ?? 0,
    mediaUrl: p.mediaUrl ?? null,
    videoDurationSec: p.videoDurationSec ?? null,
    avgWatchPct: p.avgWatchPct ? Number(p.avgWatchPct) : null,
    retentionP25: p.retentionP25 ? Number(p.retentionP25) : null,
    retentionP50: p.retentionP50 ? Number(p.retentionP50) : null,
    retentionP75: p.retentionP75 ? Number(p.retentionP75) : null,
    retentionP95: p.retentionP95 ? Number(p.retentionP95) : null,
  })) as unknown as Post[];

  const key = SORT_MAP[sortKey] ?? "performanceScore";
  posts = [...posts].sort((a, b) => {
    const diff = Number(a[key]) - Number(b[key]);
    return order === "asc" ? diff : -diff;
  });

  return NextResponse.json({ posts, source: "database" });
}
