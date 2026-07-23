import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";

const DEFAULT_BRANDING = {
  platformName: "Marketing Segal",
  companyName: "Segal",
  logoDataUrl: null as string | null,
  faviconDataUrl: null as string | null,
  primaryColor: "#6E56CF",
  secondaryColor: "#3FBF8F",
};

const bodySchema = z.object({
  platformName: z.string().min(1).max(60),
  companyName: z.string().min(1).max(60),
  logoDataUrl: z.string().nullable().optional(),
  faviconDataUrl: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hex, ej: #6E56CF"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hex, ej: #3FBF8F"),
});

/**
 * GET /api/settings/branding — pública (sin sesión), la usa el login y el
 * menú lateral para mostrar el nombre/logo/colores antes de autenticarse.
 */
export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ ...DEFAULT_BRANDING, source: "default" });
  }

  const prisma = await getPrisma();
  const settings = await prisma.appSettings.findFirst();
  if (!settings) {
    return NextResponse.json({ ...DEFAULT_BRANDING, source: "default" });
  }

  return NextResponse.json({
    platformName: settings.platformName,
    companyName: settings.companyName,
    logoDataUrl: settings.logoDataUrl,
    faviconDataUrl: settings.faviconDataUrl,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    source: "database",
  });
}

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

  // Límite razonable para las imágenes embebidas (evita filas gigantes en DB)
  const MAX_IMAGE_CHARS = 900_000; // ~650KB en base64
  if (parsed.data.logoDataUrl && parsed.data.logoDataUrl.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "El logo es muy pesado. Usa una imagen más liviana (idealmente bajo 500KB)." }, { status: 400 });
  }
  if (parsed.data.faviconDataUrl && parsed.data.faviconDataUrl.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "El favicon es muy pesado. Usa una imagen más liviana." }, { status: 400 });
  }

  const prisma = await getPrisma();
  const existing = await prisma.appSettings.findFirst();

  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: parsed.data });
  } else {
    await prisma.appSettings.create({ data: parsed.data });
  }

  return NextResponse.json({ ok: true });
}
