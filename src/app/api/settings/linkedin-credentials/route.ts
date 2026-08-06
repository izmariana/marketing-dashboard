import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/services/encryption";
import { auth } from "@/lib/auth/auth";
import { BRANDS } from "@/types/domain";

const bodySchema = z.object({
  brandSlug: z.enum(["informes_comerciales", "inversiones_cinco", "segal_deudores"]),
  accessToken: z.string().min(20).optional(),
  organizationUrn: z.string().regex(/^urn:li:organization:\d+$/, "Debe tener el formato urn:li:organization:XXXXXXXX"),
});

/**
 * POST /api/settings/linkedin-credentials
 * Guarda (o actualiza) las credenciales de LinkedIn de una marca.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { error: "No hay una base de datos conectada (USE_MOCK_DATA está activo)." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { brandSlug, accessToken, organizationUrn } = parsed.data;
  const prisma = await getPrisma();

  const brandMeta = BRANDS.find((b) => b.slug === brandSlug)!;
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug as never },
    create: { slug: brandSlug as never, name: brandMeta.name, themeColor: brandMeta.themeColor },
    update: {},
  });

  const existing = await prisma.linkedinCredential.findUnique({ where: { brandId: brand.id } });
  if (!existing && !accessToken) {
    return NextResponse.json(
      { error: "Falta el Access Token de LinkedIn — es obligatorio la primera vez que conectas esta marca." },
      { status: 400 }
    );
  }

  const encryptedToken = accessToken ? encryptSecret(accessToken) : existing!.accessTokenEnc;

  await prisma.linkedinCredential.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, accessTokenEnc: encryptedToken, organizationUrn, syncStatus: "idle" },
    update: { accessTokenEnc: encryptedToken, organizationUrn, syncStatus: "idle", syncError: null },
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/settings/linkedin-credentials
 * Devuelve, por marca, si ya hay credenciales guardadas y el URN de la
 * organización (el token nunca se expone).
 */
export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ statuses: [], source: "mock" });
  }

  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ include: { linkedinCredential: true } });

  type BrandWithCredential = (typeof brands)[number];
  const statuses = brands.map((b: BrandWithCredential) => ({
    brandSlug: b.slug,
    connected: Boolean(b.linkedinCredential),
    hasAccessToken: Boolean(b.linkedinCredential?.accessTokenEnc),
    organizationUrn: b.linkedinCredential?.organizationUrn ?? null,
    lastSyncedAt: b.linkedinCredential?.lastSyncedAt ?? null,
    syncStatus: b.linkedinCredential?.syncStatus ?? null,
  }));

  return NextResponse.json({ statuses, source: "database" });
}
