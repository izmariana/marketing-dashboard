import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { testMetaConnection } from "@/lib/services/meta-client";
import { auth } from "@/lib/auth/auth";

/**
 * GET /api/settings/meta-credentials/test?brand=segal_deudores
 * Prueba en vivo las credenciales YA guardadas de una marca, sin
 * necesidad de volver a pegarlas — útil para diagnosticar por qué una
 * sincronización trae 0 campañas.
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
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug as never }, include: { metaCredential: true } });

  if (!brand || !brand.metaCredential) {
    return NextResponse.json({ error: "Esta marca no tiene credenciales de Meta guardadas todavía." }, { status: 404 });
  }

  const creds = {
    accessToken: decryptSecret(brand.metaCredential.accessTokenEnc),
    adAccountId: brand.metaCredential.adAccountId,
    facebookPageId: brand.metaCredential.facebookPageId ?? undefined,
    instagramBusinessId: brand.metaCredential.instagramBusinessId ?? undefined,
  };

  const result = await testMetaConnection(creds);

  return NextResponse.json({
    ...result,
    adAccountIdUsed: brand.metaCredential.adAccountId,
    facebookPageIdUsed: brand.metaCredential.facebookPageId,
    instagramBusinessIdUsed: brand.metaCredential.instagramBusinessId,
  });
}
