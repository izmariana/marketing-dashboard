import { NextRequest, NextResponse } from "next/server";
import { getBrandReportData } from "@/lib/services/report-data";
import { generateCsvReport, generateXlsxReport, generatePdfReport } from "@/lib/services/report-service";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { auth } from "@/lib/auth/auth";
import { getPeriodRange, type ReportPeriod } from "@/lib/utils/report-periods";

/**
 * GET /api/reports/export?brand=&format=csv|xlsx|pdf&period=daily|weekly|monthly|quarterly|yearly
 * GET /api/reports/export?brand=&format=csv|xlsx|pdf&days=30   (compatibilidad hacia atrás)
 *
 * Genera y descarga el reporte en el formato solicitado, alineado al
 * período de calendario solicitado (no solo "últimos N días"). Si hay base
 * de datos conectada, además registra el reporte en la tabla Report.
 */
export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  const periodParam = req.nextUrl.searchParams.get("period") as ReportPeriod | null;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  if (!brand) return NextResponse.json({ error: "Falta el parámetro 'brand'" }, { status: 400 });

  const range = periodParam ? getPeriodRange(periodParam) : null;

  let data;
  try {
    data = range
      ? await getBrandReportData(brand, { since: range.since, until: range.until }, range.label)
      : await getBrandReportData(brand, days);
  } catch {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }

  const rangeLabel = range ? periodParam : `${days}d`;
  const fileNameBase = `reporte-${data.brand.slug}-${rangeLabel}-${new Date().toISOString().slice(0, 10)}`;

  if (isDatabaseConfigured) {
    try {
      const session = await auth();
      const prisma = await getPrisma();
      const userId = (session?.user as { id?: string } | undefined)?.id;
      if (userId) {
        const periodEnd = range?.until ?? new Date();
        const periodStart = range?.since ?? (() => {
          const d = new Date();
          d.setDate(d.getDate() - days);
          return d;
        })();
        await prisma.report.create({
          data: {
            createdById: userId,
            type: "EXECUTIVE_MONTHLY",
            format: format.toUpperCase() as never,
            periodStart,
            periodEnd,
            summary: data.executiveSummary.resumenEjecutivo,
          },
        });
      }
    } catch {
      // No bloquea la descarga si el registro del historial falla.
    }
  }

  if (format === "csv") {
    const csv = generateCsvReport(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileNameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await generateXlsxReport(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileNameBase}.xlsx"`,
      },
    });
  }

  const pdfBuffer = await generatePdfReport(data);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileNameBase}.pdf"`,
    },
  });
}
