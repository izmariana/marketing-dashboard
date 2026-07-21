import { NextRequest, NextResponse } from "next/server";
import { BRANDS } from "@/types/domain";
import { getBrandReportData } from "@/lib/services/report-data";

export async function GET(req: NextRequest) {
  const brandFilter = req.nextUrl.searchParams.get("brand") ?? BRANDS[0].slug;
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  try {
    const data = await getBrandReportData(brandFilter, days);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });
  }
}
