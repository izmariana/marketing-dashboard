import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import {
  generatePosts,
  generateTikTokPosts,
  generateFollowerSnapshots,
  generateGaDailyMetrics,
  aggregateFollowerGrowth,
  aggregateGaMetrics,
} from "@/lib/mock/generator";

export interface BrandComparisonRow {
  brandSlug: string;
  brandName: string;
  themeColor: string;
  metaFollowers: number;
  tiktokFollowers: number;
  linkedinFollowers: number;
  organicEngagement: number; // Meta + TikTok + LinkedIn, posts del período
  organicPosts: number;
  gaSessions: number;
  gaUsers: number;
  gaConversions: number;
}

/**
 * GET /api/brand-comparison?days=30
 * Compara las 3 marcas entre sí — no una plataforma a la vez (eso ya lo
 * hace /api/dashboard para Meta Ads), sino de forma transversal: seguidores
 * por red, engagement orgánico total y tráfico/conversiones de GA4.
 * LinkedIn se suma solo si la marca tiene credenciales conectadas.
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  if (!isDatabaseConfigured) {
    const rows: BrandComparisonRow[] = BRANDS.map((b) => {
      const slug = b.slug as BrandSlug;
      const metaPosts = generatePosts(slug);
      const tiktokPosts = generateTikTokPosts(slug);
      const fb = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "FACEBOOK", days));
      const ig = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "INSTAGRAM", days));
      const tiktok = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "TIKTOK", days));
      const ga = aggregateGaMetrics(generateGaDailyMetrics(slug, days));

      return {
        brandSlug: b.slug,
        brandName: b.name,
        themeColor: b.themeColor,
        metaFollowers: fb.current + ig.current,
        tiktokFollowers: tiktok.current,
        linkedinFollowers: 0, // sin datos de ejemplo para LinkedIn
        organicEngagement: [...metaPosts, ...tiktokPosts].reduce((a, p) => a + p.engagement, 0),
        organicPosts: metaPosts.length + tiktokPosts.length,
        gaSessions: ga.sessions,
        gaUsers: ga.users,
        gaConversions: ga.conversions,
      };
    });
    return NextResponse.json({ rows, days, source: "mock" });
  }

  const prisma = await getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const dbBrands = await prisma.brand.findMany({ include: { linkedinCredential: true } });

  const rows: BrandComparisonRow[] = await Promise.all(
    dbBrands.map(async (dbBrand: (typeof dbBrands)[number]) => {
      const meta = BRANDS.find((b) => b.slug === dbBrand.slug);

      const [fbSnaps, igSnaps, tiktokSnaps, linkedinSnaps, metaPosts, tiktokPosts, linkedinPosts, gaRows] = await Promise.all([
        prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "FACEBOOK" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
        prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "INSTAGRAM" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
        prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "TIKTOK" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
        dbBrand.linkedinCredential
          ? prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "LINKEDIN" as never, date: { gte: since } }, orderBy: { date: "asc" } })
          : Promise.resolve([] as Awaited<ReturnType<typeof prisma.followerSnapshot.findMany>>),
        prisma.post.findMany({ where: { brandId: dbBrand.id, network: { in: ["FACEBOOK", "INSTAGRAM"] as never }, publishedAt: { gte: since } } }),
        prisma.post.findMany({ where: { brandId: dbBrand.id, network: "TIKTOK" as never, publishedAt: { gte: since } } }),
        prisma.post.findMany({ where: { brandId: dbBrand.id, network: "LINKEDIN" as never, publishedAt: { gte: since } } }),
        prisma.gaMetricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: since } } }),
      ]);

      const toAgg = (rows: typeof fbSnaps) =>
        aggregateFollowerGrowth(rows.map((r: (typeof fbSnaps)[number]) => ({ date: r.date.toISOString().slice(0, 10), followers: r.followers, newFollowers: r.newFollowers })));

      const fb = toAgg(fbSnaps);
      const ig = toAgg(igSnaps);
      const tiktok = toAgg(tiktokSnaps);
      const linkedin = toAgg(linkedinSnaps);

      type PostRow = (typeof metaPosts)[number];
      const totalEngagement = [...metaPosts, ...tiktokPosts, ...linkedinPosts].reduce((a: number, p: PostRow) => a + p.engagement, 0);
      const totalPosts = metaPosts.length + tiktokPosts.length + linkedinPosts.length;

      type GaRow = (typeof gaRows)[number];
      const gaSessions = gaRows.reduce((a: number, r: GaRow) => a + r.sessions, 0);
      const gaUsers = gaRows.reduce((a: number, r: GaRow) => a + r.users, 0);
      const gaConversions = gaRows.reduce((a: number, r: GaRow) => a + r.conversions, 0);

      return {
        brandSlug: dbBrand.slug,
        brandName: meta?.name ?? dbBrand.name,
        themeColor: meta?.themeColor ?? dbBrand.themeColor ?? "#888888",
        metaFollowers: fb.current + ig.current,
        tiktokFollowers: tiktok.current,
        linkedinFollowers: linkedin.current,
        organicEngagement: totalEngagement,
        organicPosts: totalPosts,
        gaSessions,
        gaUsers,
        gaConversions,
      };
    })
  );

  return NextResponse.json({ rows, days, source: "database" });
}
