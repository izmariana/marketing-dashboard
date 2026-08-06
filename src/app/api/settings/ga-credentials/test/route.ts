import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { testConnection } from "@/lib/services/ga-client";
import { auth } from "@/lib/auth/auth";

/**
 * GET /api/settings/ga-credentials/test?brand=segal_deudores
 * Prueba en vivo las credenciales de GA4 YA guardadas de una marca, y
 * confirma si la relación gaCredential realmente existe en la base de
 * datos — útil para diagnosticar por qué una sincronización no trae nada.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json({ error: "No hay una base de datos conectada." }, { status: 400 });
  }

  const brandSlug = req.nextUrl.searchParams.get("brand");
  if (!brandSlug) return NextResponse.json({ error: "Falta el parámetro 'brand'" }, { status: 400 });

  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug as never }, include: { gaCredential: true } });

  if (!brand || !brand.gaCredential) {
    return NextResponse.json({ ok: false, error: "Esta marca no tiene credenciales de Google Analytics guardadas en la base de datos." }, { status: 404 });
  }

  const creds = {
    propertyId: brand.gaCredential.propertyId,
    serviceAccountJson: decryptSecret(brand.gaCredential.serviceAccountJsonEnc),
  };

  const result = await testConnection(creds);

  return NextResponse.json({ ...result, propertyIdUsed: brand.gaCredential.propertyId, lastSyncedAt: brand.gaCredential.lastSyncedAt, syncStatus: brand.gaCredential.syncStatus, syncError: brand.gaCredential.syncError });
}
