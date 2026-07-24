import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import {
  fetchCampaignInsights,
  fetchCampaigns as fetchMetaCampaigns,
  type MetaCredentials,
  type MetaInsightRow,
} from "@/lib/services/meta-client";

/**
 * Orquesta la sincronización de una marca:
 *  1. Lee sus credenciales (desencriptadas en memoria, nunca persistidas en claro).
 *  2. Trae campañas + insights diarios de los últimos N días desde Meta Marketing API.
 *  3. Guarda/actualiza el catálogo de Campaign.
 *  4. Inserta un MetricSnapshot por día (grain DAILY) — nunca sobrescribe:
 *     si ya existe un snapshot para esa fecha/campaña, se omite (skipDuplicates),
 *     preservando el histórico exactamente como llegó la primera vez.
 *
 * Se ejecuta automáticamente cada N horas (ver /api/sync + Vercel Cron) o al
 * presionar "Actualizar ahora" en cualquier página del dashboard.
 */

function findActionValue(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  if (!actions) return 0;
  const found = actions.find((a) => a.action_type === type);
  return found ? Number(found.value) : 0;
}

function mapObjective(metaObjective: string): string {
  const map: Record<string, string> = {
    OUTCOME_LEADS: "LEADS",
    LEAD_GENERATION: "LEADS",
    OUTCOME_TRAFFIC: "TRAFFIC",
    LINK_CLICKS: "TRAFFIC",
    OUTCOME_ENGAGEMENT: "ENGAGEMENT",
    POST_ENGAGEMENT: "ENGAGEMENT",
    OUTCOME_SALES: "SALES",
    CONVERSIONS: "CONVERSIONS",
    OUTCOME_AWARENESS: "AWARENESS",
    BRAND_AWARENESS: "AWARENESS",
    OUTCOME_APP_PROMOTION: "APP_PROMOTION",
  };
  return map[metaObjective] ?? "TRAFFIC";
}

export interface SyncResult {
  brandSlug: string;
  campaignsSynced: number;
  snapshotsInserted: number;
  error?: string;
}

export async function syncBrand(brandId: string, days = 30): Promise<SyncResult> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { metaCredential: true },
  });

  if (!brand || !brand.metaCredential) {
    return { brandSlug: brand?.slug ?? brandId, campaignsSynced: 0, snapshotsInserted: 0, error: "Sin credenciales configuradas" };
  }

  const creds: MetaCredentials = {
    accessToken: decryptSecret(brand.metaCredential.accessTokenEnc),
    adAccountId: brand.metaCredential.adAccountId,
    facebookPageId: brand.metaCredential.facebookPageId ?? undefined,
    instagramBusinessId: brand.metaCredential.instagramBusinessId ?? undefined,
  };

  await prisma.metaCredential.update({
    where: { id: brand.metaCredential.id },
    data: { syncStatus: "syncing", syncError: null },
  });

  try {
    // 1. Catálogo de campañas
    const campaignsResp = await fetchMetaCampaigns(creds);
    let campaignsSynced = 0;

    for (const c of campaignsResp.data) {
      await prisma.campaign.upsert({
        where: { metaCampaignId: c.id },
        create: {
          metaCampaignId: c.id,
          brandId: brand.id,
          name: c.name,
          objective: mapObjective(c.objective) as never,
          status: c.status as never,
          dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
          startDate: c.start_time ? new Date(c.start_time) : new Date(),
          endDate: c.stop_time ? new Date(c.stop_time) : null,
        },
        update: {
          name: c.name,
          status: c.status as never,
          dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          endDate: c.stop_time ? new Date(c.stop_time) : null,
        },
      });
      campaignsSynced++;
    }

    // 2. Insights diarios (histórico inmutable)
    const until = new Date().toISOString().slice(0, 10);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString().slice(0, 10);

    const insights: MetaInsightRow[] = await fetchCampaignInsights(creds, { since, until, level: "campaign" });

    const dbCampaigns = await prisma.campaign.findMany({ where: { brandId: brand.id } });
    type DbCampaign = (typeof dbCampaigns)[number];
    const campaignIdByMetaId = new Map(dbCampaigns.map((c: DbCampaign) => [c.metaCampaignId, c.id]));

    const snapshotRows = insights.map((row) => {
      const spend = Number(row.spend ?? 0);
      const impressions = Number(row.impressions ?? 0);
      const clicks = Number(row.clicks ?? 0);
      const leads = findActionValue(row.actions, "lead");
      const conversions = findActionValue(row.actions, "offsite_conversion.fb_pixel_purchase") || leads;
      const cpl = findActionValue(row.cost_per_action_type, "lead") || (leads > 0 ? spend / leads : 0);

      return {
        brandId: brand.id,
        campaignId: row.campaign_id ? campaignIdByMetaId.get(row.campaign_id) ?? null : null,
        grain: "DAILY" as const,
        date: new Date(row.date_start),
        spend,
        reach: Number(row.reach ?? 0),
        impressions,
        clicks,
        ctr: Number(row.ctr ?? 0),
        cpc: Number(row.cpc ?? 0),
        cpm: Number(row.cpm ?? 0),
        leads,
        cpl,
        conversions,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
        roas: null,
        frequency: Number(row.frequency ?? 0),
      };
    });

    // skipDuplicates: si ya existe un snapshot (brandId+campaignId+grain+date),
    // NO se sobrescribe — se preserva el histórico tal como se capturó la 1ª vez.
    const inserted = await prisma.metricSnapshot.createMany({
      data: snapshotRows,
      skipDuplicates: true,
    });

    await prisma.metaCredential.update({
      where: { id: brand.metaCredential.id },
      data: { syncStatus: "idle", lastSyncedAt: new Date() },
    });

    return { brandSlug: brand.slug, campaignsSynced, snapshotsInserted: inserted.count };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido durante la sincronización";
    await prisma.metaCredential.update({
      where: { id: brand.metaCredential.id },
      data: { syncStatus: "error", syncError: message },
    });
    return { brandSlug: brand.slug, campaignsSynced: 0, snapshotsInserted: 0, error: message };
  }
}

export async function syncAllBrands(days = 30): Promise<SyncResult[]> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ where: { metaCredential: { isNot: null } } });
  type BrandRow = (typeof brands)[number];
  return Promise.all(brands.map((brand: BrandRow) => syncBrand(brand.id, days)));
}
