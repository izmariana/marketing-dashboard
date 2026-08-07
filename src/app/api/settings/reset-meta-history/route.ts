import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { syncBrand } from "@/lib/services/sync-service";

/**
 * POST /api/settings/reset-meta-history?brandSlug=segal_deudores
 *
 * Los snapshots diarios de Meta Ads (MetricSnapshot) nunca se sobrescriben
 * una vez guardados (skipDuplicates: true en syncBrand) — a propósito,
 * para no perder histórico real. El problema: si un día se guardó con
 * datos incompletos (ej. durante pruebas, antes de terminar de configurar
 * algo), ese día queda mal para siempre y ningún "Actualizar ahora"
 * posterior lo corrige.
 *
 * Este endpoint borra el histórico de Meta Ads de una marca (solo
 * MetricSnapshot — NO toca Campaign, ni Post, ni credenciales) y dispara
 * una sincronización limpia inmediatamente después. Es un poco más lento
 * que un sync normal porque hace un borrado primero.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json({ error: "No hay una base de datos conectada." }, { status: 400 });
  }

  const brandSlug = req.nextUrl.searchParams.get("brandSlug");
  if (!brandSlug) return NextResponse.json({ error: "Falta el parámetro 'brandSlug'" }, { status: 400 });

  const prisma = await getPrisma();
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug as never } });
  if (!brand) return NextResponse.json({ error: `Marca '${brandSlug}' no encontrada.` }, { status: 404 });

  const deleted = await prisma.metricSnapshot.deleteMany({ where: { brandId: brand.id } });

  // Sincroniza de inmediato con los últimos 90 días para dejar un
  // histórico razonable, ya limpio, sin esperar a que el usuario
  // apriete "Actualizar ahora" por separado.
  const result = await syncBrand(brand.id, 90);

  return NextResponse.json({
    ok: true,
    deletedSnapshots: deleted.count,
    resync: result,
  });
}