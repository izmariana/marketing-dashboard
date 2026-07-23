import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/services/encryption";
import { testConnection } from "@/lib/services/ga-client";
import { auth } from "@/lib/auth/auth";
import { BRANDS } from "@/types/domain";

const bodySchema = z.object({
  brandSlug: z.enum(["informes_comerciales", "inversiones_cinco", "segal_deudores"]),
  propertyId: z.string().min(1, "Ingresa el Property ID de GA4"),
  serviceAccountJson: z.string().min(50, "Pega el JSON completo de la Service Account"),
});

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

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { brandSlug, propertyId, serviceAccountJson } = parsed.data;

  // Validar que el JSON pegado sea realmente un JSON de Service Account
  try {
    const asObject = JSON.parse(serviceAccountJson);
    if (!asObject.client_email || !asObject.private_key) {
      return NextResponse.json({ error: "El JSON no parece ser una Service Account válida (falta client_email o private_key)." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "El texto pegado no es un JSON válido. Cópialo tal cual lo descargaste de Google Cloud." }, { status: 400 });
  }

  // Prueba la conexión real antes de guardar, para dar feedback inmediato
  const test = await testConnection({ propertyId, serviceAccountJson });
  if (!test.ok) {
    return NextResponse.json({ error: `No se pudo conectar con Google Analytics: ${test.error}` }, { status: 400 });
  }

  const prisma = await getPrisma();
  const brandMeta = BRANDS.find((b) => b.slug === brandSlug)!;
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug as never },
    create: { slug: brandSlug as never, name: brandMeta.name, themeColor: brandMeta.themeColor },
    update: {},
  });

  const encrypted = encryptSecret(serviceAccountJson);

  await prisma.gaCredential.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, propertyId, serviceAccountJsonEnc: encrypted, syncStatus: "idle" },
    update: { propertyId, serviceAccountJsonEnc: encrypted, syncStatus: "idle", syncError: null },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ statuses: [], source: "mock" });
  }

  const prisma = await getPrisma();
  const brands = await prisma.brand.findMany({ include: { gaCredential: true } });

  type BrandRow = (typeof brands)[number];
  const statuses = brands.map((b: BrandRow) => ({
    brandSlug: b.slug,
    connected: Boolean(b.gaCredential),
    lastSyncedAt: b.gaCredential?.lastSyncedAt ?? null,
    syncStatus: b.gaCredential?.syncStatus ?? null,
  }));

  return NextResponse.json({ statuses, source: "database" });
}
