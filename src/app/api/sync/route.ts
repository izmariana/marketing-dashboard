import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isDatabaseConfigured } from "@/lib/db/prisma";
import { syncAllBrands, syncBrand } from "@/lib/services/sync-service";
import { syncAllGaBrands, syncGaBrand } from "@/lib/services/ga-sync-service";
import { generateAlertsForAllBrands } from "@/lib/services/alert-service";

/**
 * POST /api/sync            → sincroniza Meta y Google Analytics de todas las marcas
 * POST /api/sync?brandId=xx → sincroniza solo una marca
 *
 * También se invoca automáticamente por Vercel Cron cada 6 horas
 * (ver vercel.json) mediante GET con el header de autorización de cron.
 */
async function runSync(brandId?: string) {
  if (!isDatabaseConfigured) {
    return { synced: false, reason: "USE_MOCK_DATA está activo o falta DATABASE_URL. Nada que sincronizar todavía." };
  }

  const metaResults = brandId ? [await syncBrand(brandId)] : await syncAllBrands();
  const gaResults = brandId ? [await syncGaBrand(brandId)] : await syncAllGaBrands();
  const alertsCreated = await generateAlertsForAllBrands();

  return { synced: true, meta: metaResults, googleAnalytics: gaResults, alertsCreated };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const brandId = req.nextUrl.searchParams.get("brandId") ?? undefined;
  const result = await runSync(brandId);
  return NextResponse.json(result);
}

// Vercel Cron llama por GET con el header "Authorization: Bearer <CRON_SECRET>"
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await runSync();
  return NextResponse.json(result);
}
