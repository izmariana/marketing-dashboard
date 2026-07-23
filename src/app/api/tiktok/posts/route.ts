import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { getAllTikTokMockPosts } from "@/lib/mock/generator";
import type { Post } from "@/types/domain";

const SORT_MAP: Record<string, keyof Post> = {
  alcance: "reach",
  engagement: "engagement",
  ctr: "ctr",
  comentarios: "comments",
  compartidos: "shares",
  guardados: "saves",
  reproducciones: "plays",
  score: "performanceScore",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("brand");
  const sortKey = sp.get("sort") ?? "score";
  const order = sp.get("order") ?? "desc";

  let posts: Post[];

  if (!isDatabaseConfigured) {
    posts = getAllTikTokMockPosts();
  } else {
    const prisma = await getPrisma();
    const dbPosts = await prisma.post.findMany({
      where: { network: "TIKTOK", brand: brand ? { slug: brand as never } : undefined },
      include: { brand: true, campaign: true },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });
    type DbPost = (typeof dbPosts)[number];
    posts = dbPosts.map((p: DbPost) => ({
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
    })) as unknown as Post[];
  }

  if (brand) posts = posts.filter((p) => p.brandSlug === brand);

  const key = SORT_MAP[sortKey] ?? "performanceScore";
  posts.sort((a, b) => {
    const diff = Number(a[key]) - Number(b[key]);
    return order === "asc" ? diff : -diff;
  });

  return NextResponse.json({ posts, source: isDatabaseConfigured ? "database" : "mock" });
}
