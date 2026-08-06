import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug, type Post } from "@/types/domain";
import {
  generatePosts,
  generateTikTokPosts,
  generateFollowerSnapshots,
  aggregateFollowerGrowth,
} from "@/lib/mock/generator";
import { compareOrganicPlatforms } from "@/lib/services/organic-comparison";

/**
 * GET /api/organic-comparison?brand=&days=30
 *
 * Compara el rendimiento orgánico entre Meta (Facebook + Instagram),
 * TikTok y LinkedIn para una marca. LinkedIn se devuelve siempre con
 * connected:false — todavía no hay integración real con su API, así que
 * se muestra como "Próximamente" en vez de inventar cifras.
 */
export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === brandFilter);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const slug = brand.slug as BrandSlug;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const metaPosts = generatePosts(slug).filter((p) => new Date(p.publishedAt) >= since);
    const tiktokPosts = generateTikTokPosts(slug).filter((p) => new Date(p.publishedAt) >= since);

    const fbFollowers = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "FACEBOOK", days));
    const igFollowers = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "INSTAGRAM", days));
    const tiktokFollowers = aggregateFollowerGrowth(generateFollowerSnapshots(slug, "TIKTOK", days));

    const metaFollowersCombined = {
      current: fbFollowers.current + igFollowers.current,
      newInPeriod: fbFollowers.newInPeriod + igFollowers.newInPeriod,
    };

    const rows = compareOrganicPlatforms(metaPosts, tiktokPosts, metaFollowersCombined, {
      current: tiktokFollowers.current,
      newInPeriod: tiktokFollowers.newInPeriod,
    });

    return NextResponse.json({ brand, rows, source: "mock" });
  }

  const prisma = await getPrisma();
  const dbBrand = await prisma.brand.findUnique({ where: { slug: brand.slug as never }, include: { linkedinCredential: true } });
  if (!dbBrand) return NextResponse.json({ error: "La marca todavía no existe en la base de datos." }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [metaPostRows, tiktokPostRows, linkedinPostRows, fbSnapRows, igSnapRows, tiktokSnapRows, linkedinSnapRows] = await Promise.all([
    prisma.post.findMany({ where: { brandId: dbBrand.id, network: { in: ["FACEBOOK", "INSTAGRAM"] as never }, publishedAt: { gte: since } } }),
    prisma.post.findMany({ where: { brandId: dbBrand.id, network: "TIKTOK" as never, publishedAt: { gte: since } } }),
    dbBrand.linkedinCredential
      ? prisma.post.findMany({ where: { brandId: dbBrand.id, network: "LINKEDIN" as never, publishedAt: { gte: since } } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.post.findMany>>),
    prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "FACEBOOK" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "INSTAGRAM" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "TIKTOK" as never, date: { gte: since } }, orderBy: { date: "asc" } }),
    dbBrand.linkedinCredential
      ? prisma.followerSnapshot.findMany({ where: { brandId: dbBrand.id, network: "LINKEDIN" as never, date: { gte: since } }, orderBy: { date: "asc" } })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.followerSnapshot.findMany>>),
  ]);

  type PostRow = (typeof metaPostRows)[number];
  type SnapRow = (typeof fbSnapRows)[number];

  const toPost = (r: PostRow): Post => ({
    id: r.id,
    brandSlug: dbBrand.slug as BrandSlug,
    campaignName: null,
    network: r.network,
    type: r.type,
    fundingType: r.fundingType,
    publishedAt: r.publishedAt.toISOString(),
    thumbnailUrl: r.thumbnailUrl ?? "",
    copy: r.copy ?? "",
    reach: r.reach,
    impressions: r.impressions,
    plays: r.plays ?? 0,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves ?? 0,
    engagement: r.engagement,
    clicks: r.clicks ?? 0,
    ctr: Number(r.ctr ?? 0),
    spend: 0,
    leads: 0,
    cpl: 0,
    performanceScore: r.performanceScore ?? 0,
  });

  const toFollowerAgg = (rows: SnapRow[]) =>
    aggregateFollowerGrowth(rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), followers: r.followers, newFollowers: r.newFollowers })));

  const fbFollowers = toFollowerAgg(fbSnapRows);
  const igFollowers = toFollowerAgg(igSnapRows);
  const tiktokFollowers = toFollowerAgg(tiktokSnapRows);
  const linkedinFollowers = toFollowerAgg(linkedinSnapRows);

  const metaFollowersCombined = {
    current: fbFollowers.current + igFollowers.current,
    newInPeriod: fbFollowers.newInPeriod + igFollowers.newInPeriod,
  };

  const rows = compareOrganicPlatforms(
    metaPostRows.map(toPost),
    tiktokPostRows.map(toPost),
    metaFollowersCombined,
    { current: tiktokFollowers.current, newInPeriod: tiktokFollowers.newInPeriod },
    dbBrand.linkedinCredential ? { posts: linkedinPostRows.map(toPost), followers: linkedinFollowers } : null
  );

  return NextResponse.json({ brand, rows, source: "database" });
}
