import { NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";

export async function GET() {
  if (!isDatabaseConfigured) {
    // En modo simulado no hay persistencia real; se muestra una lista vacía
    // con una nota, ya que el historial solo tiene sentido con base de datos.
    return NextResponse.json({ reports: [], source: "mock" });
  }

  const prisma = await getPrisma();
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json({ reports, source: "database" });
}
