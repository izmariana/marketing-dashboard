import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { getAllMockPosts } from "@/lib/mock/generator";
import type { Post } from "@/types/domain";

const SORT_MAP: Record<string, keyof Post> = {
  alcance: "reach",
  engagement: "engagement",
  ctr: "ctr",
  leads: "leads",
  cpl: "cpl", // se invierte (menor primero) al ordenar
  comentarios: "comments",
  compartidos: "shares",
  guardados: "saves",
  score: "performanceScore",
};

/**
 * GET /api/posts?brand=&network=&campaign=&month=&year=&type=&funding=&sort=score&order=desc
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("brand");
  const network = sp.get("network");
  const campaign = sp.get("campaign");
  const month = sp.get("month"); // 1-12
  const year = sp.get("year");
  const type = sp.get("type");
  const funding = sp.get("funding");
  const sortKey = sp.get("sort") ?? "score";
  const order = sp.get("order") ?? "desc";

  let posts: Post[];

  if (!isDatabaseConfigured) {
    posts = getAllMockPosts();
  } else {
    const prisma = await getPrisma();
    const dbPosts = await prisma.post.findMany({
      where: {
        brand: brand ? { slug: brand as never } : undefined,
        network: network ? (network as never) : undefined,
        fundingType: funding ? (funding as never) : undefined,
        type: type ? (type as never) : undefined,
      },
      include: { brand: true, campaign: true },
      orderBy: { publishedAt: "desc" },
      take: 300,
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
      mediaUrl: p.mediaUrl ?? null,
      videoDurationSec: p.videoDurationSec ?? null,
      avgWatchPct: p.avgWatchPct ? Number(p.avgWatchPct) : null,
      retentionP25: p.retentionP25 ? Number(p.retentionP25) : null,
      retentionP50: p.retentionP50 ? Number(p.retentionP50) : null,
      retentionP75: p.retentionP75 ? Number(p.retentionP75) : null,
      retentionP95: p.retentionP95 ? Number(p.retentionP95) : null,
    })) as unknown as Post[];
  }

  // Filtros que aplican igual en mock y en DB (más simples de hacer en memoria)
  if (brand) posts = posts.filter((p) => p.brandSlug === brand);
  if (network) posts = posts.filter((p) => p.network === network);
  if (funding) posts = posts.filter((p) => p.fundingType === funding);
  if (type) posts = posts.filter((p) => p.type === type);
  if (campaign) posts = posts.filter((p) => p.campaignName === campaign);
  if (month) posts = posts.filter((p) => new Date(p.publishedAt).getMonth() + 1 === Number(month));
  if (year) posts = posts.filter((p) => new Date(p.publishedAt).getFullYear() === Number(year));

  const key = SORT_MAP[sortKey] ?? "performanceScore";
  const invert = sortKey === "cpl"; // menor CPL es mejor
  posts.sort((a, b) => {
    const diff = Number(a[key]) - Number(b[key]);
    const directional = invert ? diff : -diff; // por defecto descendente
    return order === "asc" ? -directional : directional;
  });

  return NextResponse.json({ posts, source: isDatabaseConfigured ? "database" : "mock" });
}
