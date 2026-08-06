import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import type { Post } from "@/types/domain";

/**
 * GET /api/linkedin/ranking?month=&year=
 * Igual que /api/tiktok/ranking y /api/dashboard's ranking de Meta, pero
 * para LinkedIn. Sin base de datos conectada no hay datos de ejemplo para
 * esta red — se devuelve una lista vacía en vez de inventar publicaciones.
 */
export async function GET(req: NextRequest) {
  const now = new Date();
  const month = Number(req.nextUrl.searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(req.nextUrl.searchParams.get("year") ?? now.getFullYear());

  if (!isDatabaseConfigured) {
    return NextResponse.json({ posts: [], month, year, source: "no-data" });
  }

  const prisma = await getPrisma();
  const dbPosts = await prisma.post.findMany({
    where: { network: "LINKEDIN" },
    include: { brand: true },
    orderBy: { performanceScore: "desc" },
    take: 500,
  });

  type DbPost = (typeof dbPosts)[number];
  const posts: Post[] = dbPosts.map((p: DbPost) => ({
    id: p.id,
    brandSlug: p.brand.slug,
    campaignName: null,
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
  })) as unknown as Post[];

  const filtered = posts.filter((p) => {
    const d = new Date(p.publishedAt);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const top10 = [...filtered].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 10);

  return NextResponse.json({ posts: top10, month, year, source: "database" });
}
