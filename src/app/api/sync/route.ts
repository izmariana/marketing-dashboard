import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { isDatabaseConfigured } from "@/lib/db/prisma";
import { syncAllBrands, syncBrand } from "@/lib/services/sync-service";
import { syncAllGaBrands, syncGaBrand } from "@/lib/services/ga-sync-service";
import { syncAllMetaContent, syncMetaContent } from "@/lib/services/meta-content-sync";
import { syncAllTikTokContent, syncTikTokContent } from "@/lib/services/tiktok-content-sync";
import { syncAllLinkedInContent, syncLinkedInContent } from "@/lib/services/linkedin-content-sync";
import { generateAlertsForAllBrands } from "@/lib/services/alert-service";

// Traer datos de Meta + Google Analytics de varias marcas puede tardar más
// que el límite por defecto de una función serverless — se amplía el tiempo
// máximo permitido para esta ruta específica.
export const maxDuration = 60;

/**
 * POST /api/sync            → sincroniza Meta Ads, contenido orgánico de Meta, TikTok, LinkedIn y Google Analytics de todas las marcas
 * POST /api/sync?brandId=xx → sincroniza solo una marca
 *
 * También se invoca automáticamente por Vercel Cron cada 6 horas
 * (ver vercel.json) mediante GET con el header de autorización de cron.
 */
async function runSync(brandId?: string) {
  if (!isDatabaseConfigured) {
    return { synced: false, reason: "USE_MOCK_DATA está activo o falta DATABASE_URL. Nada que sincronizar todavía." };
  }

  // Todas las plataformas se sincronizan en paralelo (no una después de
  // otra) para reducir el tiempo total y evitar que la función se corte.
  // TikTok y LinkedIn simplemente no traen resultados para marcas sin
  // credenciales configuradas — no hace falta chequear eso aquí.
  const [metaResults, metaContentResults, tiktokResults, linkedinResults, gaResults] = await Promise.all([
    brandId ? [await syncBrand(brandId)] : syncAllBrands(),
    brandId ? [await syncMetaContent(brandId)] : syncAllMetaContent(),
    brandId ? [await syncTikTokContent(brandId)] : syncAllTikTokContent(),
    brandId ? [await syncLinkedInContent(brandId)] : syncAllLinkedInContent(),
    brandId ? [await syncGaBrand(brandId)] : syncAllGaBrands(),
  ]);
  const alertsCreated = await generateAlertsForAllBrands();

  return {
    synced: true,
    meta: metaResults,
    metaContent: metaContentResults,
    tiktok: tiktokResults,
    linkedin: linkedinResults,
    googleAnalytics: gaResults,
    alertsCreated,
  };
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
