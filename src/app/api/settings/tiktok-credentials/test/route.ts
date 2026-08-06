import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";
import { testTikTokConnection } from "@/lib/services/tiktok-client";
import { auth } from "@/lib/auth/auth";

/**
 * GET /api/settings/tiktok-credentials/test?brand=segal_deudores
 * Prueba en vivo las credenciales YA guardadas de TikTok para una marca.
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
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug as never }, include: { tiktokCredential: true } });

  if (!brand || !brand.tiktokCredential) {
    return NextResponse.json({ error: "Esta marca no tiene credenciales de TikTok guardadas todavía." }, { status: 404 });
  }

  const creds = {
    accessToken: decryptSecret(brand.tiktokCredential.accessTokenEnc),
    openId: brand.tiktokCredential.openId,
  };

  const result = await testTikTokConnection(creds);
  return NextResponse.json(result);
}
