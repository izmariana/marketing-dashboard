import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateCampaigns } from "@/lib/mock/generator";

/**
 * GET /api/calendar
 * Devuelve todas las campañas con sus fechas de inicio/fin, presupuesto y
 * estado, listas para pintar en la vista de calendario.
 */
export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand");

  if (!isDatabaseConfigured) {
    const brandsToUse = brandFilter ? BRANDS.filter((b) => b.slug === brandFilter) : BRANDS;
    const campaigns = brandsToUse.flatMap((b) => generateCampaigns(b.slug as BrandSlug, 30));
    const events = campaigns.map((c) => ({
      id: c.id,
      brandSlug: c.brandSlug,
      name: c.name,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate ?? new Date(new Date(c.startDate).getTime() + 30 * 86400000).toISOString().slice(0, 10),
      budget: c.dailyBudget,
    }));
    return NextResponse.json({ events, source: "mock" });
  }

  const prisma = await getPrisma();
  const campaigns = await prisma.campaign.findMany({
    where: { brand: brandFilter ? { slug: brandFilter as never } : undefined },
    include: { brand: true },
  });

  type CampaignRow = Awaited<ReturnType<typeof prisma.campaign.findMany>>[number];
  const events = campaigns.map((c: CampaignRow) => ({
    name: c.name,
    status: c.status,
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: (c.endDate ?? new Date(c.startDate.getTime() + 30 * 86400000)).toISOString().slice(0, 10),
    budget: c.dailyBudget ? Number(c.dailyBudget) : null,
  }));

  return NextResponse.json({ events, source: "database" });
}
