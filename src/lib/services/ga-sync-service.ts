import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { fetchDailySummary, fetchTrafficAcquisition, fetchLandingPages, fetchEvents, type GaCredentials } from "@/lib/services/ga-client";

export interface GaSyncResult {
  brandSlug: string;
  snapshotsInserted: number;
  error?: string;
}

/**
 * Sincroniza una marca: trae el resumen diario, adquisición de tráfico,
 * landing pages y eventos de los últimos N días desde GA4, y los guarda
 * como snapshots históricos — igual que con Meta, nunca se sobrescribe un
 * día ya guardado (skipDuplicates).
 */
export async function syncGaBrand(brandId: string, days = 30): Promise<GaSyncResult> {
  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, include: { gaCredential: true } });

  if (!brand || !brand.gaCredential) {
    return { brandSlug: brand?.slug ?? brandId, snapshotsInserted: 0, error: "Sin credenciales de GA4 configuradas" };
  }

  const creds: GaCredentials = {
    propertyId: brand.gaCredential.propertyId,
    serviceAccountJson: decryptSecret(brand.gaCredential.serviceAccountJsonEnc),
  };

  await prisma.gaCredential.update({ where: { id: brand.gaCredential.id }, data: { syncStatus: "syncing", syncError: null } });

  try {
    const until = new Date().toISOString().slice(0, 10);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString().slice(0, 10);

    const parseGaDate = (d: string) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);

    const [dailyRows, trafficRows, landingRows, eventRows] = await Promise.all([
      fetchDailySummary(creds, since, until),
      fetchTrafficAcquisition(creds, since, until),
      fetchLandingPages(creds, since, until),
      fetchEvents(creds, since, until),
    ]);

    const snapshotData = dailyRows.map((r) => ({
      brandId: brand.id,
      grain: "DAILY" as const,
      date: parseGaDate(r.date),
      users: r.users,
      newUsers: r.newUsers,
      sessions: r.sessions,
      engagedSessions: r.engagedSessions,
      engagementRate: r.engagementRate,
      avgEngagementSec: r.avgEngagementSec,
      pageViews: r.pageViews,
      eventCount: r.eventCount,
      conversions: r.conversions,
      conversionRate: r.sessions > 0 ? (r.conversions / r.sessions) * 100 : 0,
    }));

    const inserted = await prisma.gaMetricSnapshot.createMany({ data: snapshotData, skipDuplicates: true });

    if (trafficRows.length) {
      await prisma.gaTrafficSource.createMany({
        data: trafficRows.map((r) => ({
          brandId: brand.id,
          date: parseGaDate(r.date),
          channel: r.channel,
          source: r.source,
          users: r.users,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
          avgEngagementSec: r.avgEngagementSec,
        })),
      });
    }

    if (landingRows.length) {
      await prisma.gaLandingPage.createMany({
        data: landingRows.map((r) => ({
          brandId: brand.id,
          date: parseGaDate(r.date),
          path: r.path,
          title: r.title,
          users: r.users,
          sessions: r.sessions,
          engagementRate: r.engagementRate,
          conversions: r.conversions,
          avgEngagementSec: r.avgEngagementSec,
          exitRate: r.exitRate,
        })),
      });
    }

    if (eventRows.length) {
      await prisma.gaEvent.createMany({
        data: eventRows.map((r) => ({
          brandId: brand.id,
          date: parseGaDate(r.date),
          eventName: r.eventName,
          eventCount: r.eventCount,
          totalUsers: r.totalUsers,
          isConversion: r.isConversion,
        })),
      });
    }

    await prisma.gaCredential.update({ where: { id: brand.gaCredential.id }, data: { syncStatus: "idle", lastSyncedAt: new Date() } });

    return { brandSlug: brand.slug, snapshotsInserted: inserted.count };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido durante la sincronización de GA4";
    await prisma.gaCredential.update({ where: { id: brand.gaCredential.id }, data: { syncStatus: "error", syncError: message } });
    return { brandSlug: brand.slug, snapshotsInserted: 0, error: message };
  }
}

export async function syncAllGaBrands(days = 30): Promise<GaSyncResult[]> {
  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ where: { gaCredential: { isNot: null } } });
  const results: GaSyncResult[] = [];
  for (const brand of brands) {
    results.push(await syncGaBrand(brand.id, days));
  }
  return results;
}
