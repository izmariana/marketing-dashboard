import { NextRequest, NextResponse } from "next/server";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateDailyMetrics, aggregateMetrics, generateCampaigns, generateAlerts } from "@/lib/mock/generator";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { fetchPeriodReach, type MetaCredentials } from "@/lib/services/meta-client";
import type { MetricPoint, Alert, Campaign } from "@/types/domain";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const sinceParam = req.nextUrl.searchParams.get("since");
  const untilParam = req.nextUrl.searchParams.get("until");

  const brand = BRANDS.find((b) => b.slug === slug);
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  if (!isDatabaseConfigured) {
    const currentEnd = new Date();
    const previousEnd = new Date();
    previousEnd.setDate(previousEnd.getDate() - days);

    const series = generateDailyMetrics(brand.slug as BrandSlug, days, currentEnd);
    const previousSeries = generateDailyMetrics(brand.slug as BrandSlug, days, previousEnd);

    const current = aggregateMetrics(series);
    const previous = aggregateMetrics(previousSeries);
    const campaigns = generateCampaigns(brand.slug as BrandSlug, days);
    const alerts = generateAlerts(brand.slug as BrandSlug);

    return NextResponse.json({ brand, current, previous, series, campaigns, alerts, source: "mock" });
  }

  try {
    const prisma = await getPrisma();
    const dbBrand = await prisma.brand.findUnique({ where: { slug: brand.slug as never }, include: { metaCredential: true } });
    if (!dbBrand) {
      return NextResponse.json({ error: "La marca todavía no existe en la base de datos. Corre 'npx prisma db seed'." }, { status: 404 });
    }

    let currentEnd: Date;
    let currentSince: Date;

    // Rango personalizado (since/until exactos) — para comparar contra
    // reportes de Business Manager que usan un período específico, en vez
    // de "últimos N días" relativo a hoy.
    if (sinceParam && untilParam) {
      currentSince = new Date(`${sinceParam}T00:00:00`);
      currentEnd = new Date(`${untilParam}T23:59:59`);
      if (isNaN(currentSince.getTime()) || isNaN(currentEnd.getTime()) || currentSince > currentEnd) {
        return NextResponse.json({ error: "El rango de fechas 'since'/'until' no es válido." }, { status: 400 });
      }
    } else {
      currentEnd = new Date();
      currentSince = new Date(currentEnd);
      currentSince.setDate(currentSince.getDate() - (days - 1));
    }

    const periodDays = Math.round((currentEnd.getTime() - currentSince.getTime()) / 86400000) + 1;
    const previousEnd = new Date(currentSince);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousSince = new Date(previousEnd);
    previousSince.setDate(previousSince.getDate() - (periodDays - 1));

    const [currentSnaps, previousSnaps, campaignRows, alertRows] = await Promise.all([
      prisma.metricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: currentSince, lte: currentEnd } }, orderBy: { date: "asc" } }),
      prisma.metricSnapshot.findMany({ where: { brandId: dbBrand.id, grain: "DAILY", date: { gte: previousSince, lte: previousEnd } } }),
      prisma.campaign.findMany({
        where: { brandId: dbBrand.id },
        include: { metricSnapshots: { where: { grain: "DAILY", date: { gte: currentSince, lte: currentEnd } } } },
        orderBy: { startDate: "desc" },
        take: 30,
      }),
      prisma.alert.findMany({ where: { brandId: dbBrand.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    type SnapRow = (typeof currentSnaps)[number];
    const toPoint = (r: SnapRow): MetricPoint => ({
      date: r.date.toISOString().slice(0, 10),
      spend: Number(r.spend),
      reach: r.reach,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: Number(r.ctr),
      cpc: Number(r.cpc),
      cpm: Number(r.cpm),
      leads: r.leads,
      cpl: Number(r.cpl ?? 0),
      conversions: r.conversions,
      conversionRate: Number(r.conversionRate ?? 0),
      roas: r.roas ? Number(r.roas) : null,
      frequency: Number(r.frequency),
      engagement: r.engagement,
      engagementRate: r.reach > 0 ? Number(((r.engagement / r.reach) * 100).toFixed(2)) : 0,
    });

    const series = currentSnaps.map(toPoint);
    const current = aggregateMetrics(series);
    const previous = aggregateMetrics(previousSnaps.map(toPoint));

    // El alcance sumado día por día siempre queda inflado (la misma
    // persona alcanzada varios días se cuenta varias veces) — se
    // reemplaza por el valor real deduplicado que entrega Meta para todo
    // el período, que es el mismo que muestra Business Manager. Si esta
    // llamada falla por cualquier motivo, se deja el valor sumado como
    // respaldo en vez de romper toda la respuesta.
    if (dbBrand.metaCredential) {
      try {
        const creds: MetaCredentials = {
          accessToken: decryptSecret(dbBrand.metaCredential.accessTokenEnc),
          adAccountId: dbBrand.metaCredential.adAccountId,
        };
        const [currentReach, previousReach] = await Promise.all([
          fetchPeriodReach(creds, currentSince.toISOString().slice(0, 10), currentEnd.toISOString().slice(0, 10)),
          fetchPeriodReach(creds, previousSince.toISOString().slice(0, 10), previousEnd.toISOString().slice(0, 10)),
        ]);
        current.reach = currentReach;
        current.frequency = currentReach > 0 ? Number((current.impressions / currentReach).toFixed(2)) : 0;
        current.engagementRate = currentReach > 0 ? Number(((current.engagement / currentReach) * 100).toFixed(2)) : 0;
        previous.reach = previousReach;
        previous.frequency = previousReach > 0 ? Number((previous.impressions / previousReach).toFixed(2)) : 0;
        previous.engagementRate = previousReach > 0 ? Number(((previous.engagement / previousReach) * 100).toFixed(2)) : 0;
      } catch (err) {
        console.error(`No se pudo obtener el alcance real deduplicado para ${slug}:`, err);
      }
    }

    type CampaignRow = (typeof campaignRows)[number];
    const campaigns: Campaign[] = campaignRows.map((c: CampaignRow) => {
      const snaps = c.metricSnapshots;
      const sum = (key: "spend" | "reach" | "impressions" | "clicks" | "leads" | "conversions" | "engagement") =>
        snaps.reduce((acc: number, s: (typeof snaps)[number]) => acc + Number(s[key]), 0);
      const spend = sum("spend");
      const impressions = sum("impressions");
      const clicks = sum("clicks");
      const leads = sum("leads");
      const campaignReach = sum("reach");
      const engagement = sum("engagement");

      return {
        id: c.id,
        metaCampaignId: c.metaCampaignId,
        brandSlug: brand.slug,
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
          reach: campaignReach,
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
          engagement,
          engagementRate: campaignReach > 0 ? (engagement / campaignReach) * 100 : 0,
        },
      };
    });

    type AlertRow = (typeof alertRows)[number];
    const alerts: Alert[] = alertRows.map((a: AlertRow) => ({
      id: a.id,
      brandSlug: brand.slug,
      type: a.type,
      severity: a.severity,
      message: a.message,
      recommendation: a.recommendation,
      createdAt: a.createdAt.toISOString(),
      isRead: a.isRead,
    }));

    return NextResponse.json({ brand, current, previous, series, campaigns, alerts, source: "database" });
  } catch (err) {
    console.error(`Error cargando datos reales de ${slug}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? `Error de base de datos: ${err.message}` : "Error desconocido al cargar la marca." },
      { status: 500 }
    );
  }
}
