import { NextRequest, NextResponse } from "next/server";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateCampaigns, generateAlerts } from "@/lib/mock/generator";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  const brand = BRANDS.find((b) => b.slug === slug);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  const currentEnd = new Date();
  const previousEnd = new Date();
  previousEnd.setDate(previousEnd.getDate() - days);

  const series = generateDailyMetrics(brand.slug as BrandSlug, days, currentEnd);
  const previousSeries = generateDailyMetrics(brand.slug as BrandSlug, days, previousEnd);

  const current = aggregateMetrics(series);
  const previous = aggregateMetrics(previousSeries);
  const campaigns = generateCampaigns(brand.slug as BrandSlug, days);
  const alerts = generateAlerts(brand.slug as BrandSlug);

  return NextResponse.json({ brand, current, previous, series, campaigns, alerts });
}
