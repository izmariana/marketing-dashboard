import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateCampaigns } from "@/lib/mock/generator";

/**
 * GET /api/campaigns?brand=&status=&objective=&days=30
 *
 * Mientras no haya base de datos configurada, sirve campañas generadas
 * (misma forma que las reales). En cuanto haya credenciales sincronizadas,
 * consulta Campaign + MetricSnapshot vía Prisma automáticamente.
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const brandFilter = req.nextUrl.searchParams.get("brand");
  const statusFilter = req.nextUrl.searchParams.get("status");
  const objectiveFilter = req.nextUrl.searchParams.get("objective");

  if (!isDatabaseConfigured) {
    const brandsToUse = brandFilter ? BRANDS.filter((b) => b.slug === brandFilter) : BRANDS;
    let campaigns = brandsToUse.flatMap((b) => generateCampaigns(b.slug as BrandSlug, days));

    if (statusFilter) campaigns = campaigns.filter((c) => c.status === statusFilter);
    if (objectiveFilter) campaigns = campaigns.filter((c) => c.objective === objectiveFilter);

    return NextResponse.json({ campaigns, source: "mock" });
  }

  try {
    const prisma = await getPrisma();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const campaigns = await prisma.campaign.findMany({
      where: {
        brand: brandFilter ? { slug: brandFilter as never } : undefined,
        status: statusFilter ? (statusFilter as never) : undefined,
        objective: objectiveFilter ? (objectiveFilter as never) : undefined,
      },
      include: {
        brand: true,
        metricSnapshots: { where: { grain: "DAILY", date: { gte: since } } },
      },
      orderBy: { startDate: "desc" },
    });

    type CampaignWithSnapshots = (typeof campaigns)[number];

    const shaped = campaigns.map((c: CampaignWithSnapshots) => {
      const snaps = c.metricSnapshots;
      const sum = (key: "spend" | "reach" | "impressions" | "clicks" | "leads" | "conversions") =>
        snaps.reduce((acc: number, s: (typeof snaps)[number]) => acc + Number(s[key]), 0);

      const spend = sum("spend");
      const impressions = sum("impressions");
      const clicks = sum("clicks");
      const leads = sum("leads");

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        brandSlug: c.brand.slug,
        name: c.name,
        objective: c.objective,
        status: c.status,
        dailyBudget: c.dailyBudget ? Number(c.dailyBudget) : null,
        spentToDate: spend,
        startDate: c.startDate.toISOString().slice(0, 10),
        endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
        metrics: {
          date: "",
          spend,
          reach: sum("reach"),
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          leads,
          cpl: leads > 0 ? spend / leads : 0,
          conversions: sum("conversions"),
          conversionRate: 0,
          roas: null,
          frequency: snaps.length ? snaps.reduce((a: number, s: (typeof snaps)[number]) => a + Number(s.frequency), 0) / snaps.length : 0,
        },
      };
    });

    return NextResponse.json({ campaigns: shaped, source: "database" });
  } catch (err) {
    console.error("Error cargando campañas:", err);
    return NextResponse.json(
      { error: err instanceof Error ? `Error de base de datos: ${err.message}` : "Error desconocido al cargar campañas." },
      { status: 500 }
    );
  }
}
