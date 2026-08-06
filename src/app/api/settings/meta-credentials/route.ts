import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/services/encryption";
import { auth } from "@/lib/auth/auth";
import { BRANDS } from "@/types/domain";

const bodySchema = z.object({
  brandSlug: z.enum(["informes_comerciales", "inversiones_cinco", "segal_deudores"]),
  // El token es opcional en la actualización: si no se manda, se conserva
  // el que ya estaba guardado (así no hay que re-pegarlo solo para
  // corregir un ID). Es obligatorio la primera vez (se valida más abajo).
  metaAccessToken: z.string().min(20).optional(),
  adAccountId: z.string().regex(/^act_\d+$/),
  facebookPageId: z.string().min(1),
  instagramBusinessId: z.string().min(1),
});

/**
 * POST /api/settings/meta-credentials
 * Guarda (o actualiza) las credenciales de Meta de una marca. El token de
 * acceso se encripta con AES-256-GCM antes de persistirse — nunca se guarda
 * en texto plano.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { error: "No hay una base de datos conectada (USE_MOCK_DATA está activo). Configura DATABASE_URL para guardar credenciales reales." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { brandSlug, metaAccessToken, adAccountId, facebookPageId, instagramBusinessId } = parsed.data;

  const prisma = await getPrisma();

  // Asegura que la marca exista (por si el seed no se ha corrido todavía)
  const brandMeta = BRANDS.find((b) => b.slug === brandSlug)!;
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug as never },
    create: { slug: brandSlug as never, name: brandMeta.name, themeColor: brandMeta.themeColor },
    update: {},
  });

  const existing = await prisma.metaCredential.findUnique({ where: { brandId: brand.id } });

  if (!existing && !metaAccessToken) {
    return NextResponse.json(
      { error: "Falta el Meta Access Token — es obligatorio la primera vez que conectas esta marca." },
      { status: 400 }
    );
  }

  const encryptedToken = metaAccessToken ? encryptSecret(metaAccessToken) : existing!.accessTokenEnc;

  await prisma.metaCredential.upsert({
    where: { brandId: brand.id },
    create: {
      brandId: brand.id,
      accessTokenEnc: encryptedToken,
      adAccountId,
      facebookPageId,
      instagramBusinessId,
      syncStatus: "idle",
    },
    update: {
      accessTokenEnc: encryptedToken,
      adAccountId,
      facebookPageId,
      instagramBusinessId,
      syncStatus: "idle",
      syncError: null,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/settings/meta-credentials
 * Devuelve, por marca, si ya hay credenciales guardadas y los valores no
 * sensibles (Ad Account ID, Facebook Page ID, Instagram Business ID) para
 * que Configuración pueda precargar el formulario. El token de acceso
 * NUNCA se devuelve — solo `hasAccessToken` para saber si ya existe uno.
 */
export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ statuses: [], source: "mock" });
  }

  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ include: { metaCredential: true } });

  type BrandWithCredential = (typeof brands)[number];
  const statuses = brands.map((b: BrandWithCredential) => ({
    brandSlug: b.slug,
    connected: Boolean(b.metaCredential),
    hasAccessToken: Boolean(b.metaCredential?.accessTokenEnc),
    adAccountId: b.metaCredential?.adAccountId ?? null,
    facebookPageId: b.metaCredential?.facebookPageId ?? null,
    instagramBusinessId: b.metaCredential?.instagramBusinessId ?? null,
    lastSyncedAt: b.metaCredential?.lastSyncedAt ?? null,
    syncStatus: b.metaCredential?.syncStatus ?? null,
  }));

  return NextResponse.json({ statuses, source: "database" });
}
