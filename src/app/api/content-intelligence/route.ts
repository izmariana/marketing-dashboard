import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generatePosts } from "@/lib/mock/generator";
import { analyzeContentIntelligence } from "@/lib/services/content-intelligence";
import type { Post } from "@/types/domain";

/**
 * GET /api/content-intelligence?brand=&days=30
 * Analiza todas las publicaciones de Meta (Instagram + Facebook) del
 * período seleccionado y devuelve patrones + recomendaciones accionables.
 */
export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - days);

  let posts: Post[];

  if (!isDatabaseConfigured) {
    posts = generatePosts(brand.slug as BrandSlug, 40).filter((p) => new Date(p.publishedAt) >= since);
  } else {
    const prisma = await getPrisma();
    const dbPosts = await prisma.post.findMany({
      where: { brand: { slug: brand.slug as never }, network: { in: ["INSTAGRAM", "FACEBOOK"] }, publishedAt: { gte: since } },
      include: { brand: true },
    });
    type DbPost = (typeof dbPosts)[number];
    posts = dbPosts.map((p: DbPost) => ({
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
  }

  const result = analyzeContentIntelligence(posts);
  return NextResponse.json({ ...result, source: isDatabaseConfigured ? "database" : "mock" });
}
