import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { BRANDS, type BrandSlug } from "@/types/domain";
import { generateAlerts } from "@/lib/mock/generator";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand");

  if (!isDatabaseConfigured) {
    const brandsToUse = brandFilter ? BRANDS.filter((b) => b.slug === brandFilter) : BRANDS;
    const alerts = brandsToUse.flatMap((b) => generateAlerts(b.slug as BrandSlug));
    return NextResponse.json({ alerts, source: "mock" });
  }

  const prisma = await getPrisma();
  const alerts = await prisma.alert.findMany({
    where: { brand: brandFilter ? { slug: brandFilter as never } : undefined },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ alerts, source: "database" });
}

export async function PATCH(req: NextRequest) {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ ok: true, note: "Modo mock: no persiste, pero la UI puede marcarla localmente." });
  }

  const prisma = await getPrisma();
  const { alertId } = await req.json();
  await prisma.alert.update({ where: { id: alertId }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
