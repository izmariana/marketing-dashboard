import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { BrandReportData } from "@/lib/services/report-data";

// Las fuentes estándar de PDF (Helvetica) no soportan emojis ni muchos
// símbolos Unicode — se limpian antes de escribir texto en el PDF para
// evitar glifos corruptos, sin afectar CSV/Excel (que sí los soportan).
function stripUnsupportedGlyphs(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const METRIC_ROWS: { key: keyof BrandReportData["current"]; label: string }[] = [
  { key: "spend", label: "Inversión (CLP)" },
  { key: "reach", label: "Alcance" },
  { key: "impressions", label: "Impresiones" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR (%)" },
  { key: "cpc", label: "CPC (CLP)" },
  { key: "cpm", label: "CPM (CLP)" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL (CLP)" },
  { key: "conversions", label: "Conversiones" },
  { key: "conversionRate", label: "Tasa de conversión (%)" },
  { key: "frequency", label: "Frecuencia" },
];

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generateCsvReport(data: BrandReportData): string {
  const lines: string[] = [];
  lines.push(`Reporte Ejecutivo — ${data.brand.name}`);
  lines.push(`Período: ${data.periodLabel}`);
  lines.push("");
  lines.push("Métrica,Actual,Período anterior");
  for (const row of METRIC_ROWS) {
    lines.push([row.label, csvEscape(Number(data.current[row.key])), csvEscape(Number(data.previous[row.key]))].join(","));
  }
  lines.push("");
  lines.push("Top Campañas,Inversión,Leads,CPL");
  for (const c of data.topCampaigns) {
    lines.push([csvEscape(c.name), c.spend, c.leads, c.cpl.toFixed(0)].join(","));
  }
  lines.push("");
  lines.push("Top Publicaciones,Engagement,Performance Score");
  for (const p of data.topPosts) {
    lines.push([csvEscape(p.copy), p.engagement, p.performanceScore].join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

export async function generateXlsxReport(data: BrandReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Marketing Intelligence Dashboard";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Métrica", key: "label", width: 28 },
    { header: "Actual", key: "current", width: 18 },
    { header: "Período anterior", key: "previous", width: 18 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  for (const row of METRIC_ROWS) {
    summarySheet.addRow({
      label: row.label,
      current: Number(data.current[row.key]),
      previous: Number(data.previous[row.key]),
    });
  }

  const campaignsSheet = workbook.addWorksheet("Top Campañas");
  campaignsSheet.columns = [
    { header: "Campaña", key: "name", width: 32 },
    { header: "Inversión", key: "spend", width: 16 },
    { header: "Leads", key: "leads", width: 12 },
    { header: "CPL", key: "cpl", width: 12 },
  ];
  campaignsSheet.getRow(1).font = { bold: true };
  data.topCampaigns.forEach((c) => campaignsSheet.addRow(c));

  const postsSheet = workbook.addWorksheet("Top Publicaciones");
  postsSheet.columns = [
    { header: "Publicación", key: "copy", width: 50 },
    { header: "Engagement", key: "engagement", width: 14 },
    { header: "Performance Score", key: "performanceScore", width: 18 },
  ];
  postsSheet.getRow(1).font = { bold: true };
  data.topPosts.forEach((p) => postsSheet.addRow(p));

  const recsSheet = workbook.addWorksheet("Recomendaciones");
  recsSheet.columns = [
    { header: "Prioridad", key: "severity", width: 14 },
    { header: "Recomendación", key: "title", width: 28 },
    { header: "Detalle", key: "detail", width: 70 },
  ];
  recsSheet.getRow(1).font = { bold: true };
  data.recommendations.forEach((r) => recsSheet.addRow({ severity: r.severity, title: r.title, detail: r.detail }));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---------------------------------------------------------------------------
// PDF — Reporte Ejecutivo IA
// ---------------------------------------------------------------------------

export async function generatePdfReport(data: BrandReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const accent = "#6E56CF";
    const muted = "#6b6b76";
    const dark = "#14141a";

    // Encabezado
    doc.fontSize(20).fillColor(dark).font("Helvetica-Bold").text("Reporte Ejecutivo", { continued: false });
    doc.fontSize(13).fillColor(accent).font("Helvetica-Bold").text(data.brand.name);
    doc.fontSize(9).fillColor(muted).font("Helvetica").text(`${data.periodLabel} · Generado el ${new Date().toLocaleDateString("es-CL")}`);
    doc.moveDown(1.2);

    // Resumen ejecutivo
    sectionTitle(doc, "Resumen ejecutivo", accent);
    doc.fontSize(10).fillColor(dark).font("Helvetica").text(data.executiveSummary.resumenEjecutivo, { align: "justify" });
    doc.moveDown(0.8);

    // KPIs
    sectionTitle(doc, "KPIs — actual vs. período anterior", accent);
    const startX = doc.x;
    let y = doc.y;
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Métrica", startX, y, { width: 200, continued: false });
    doc.text("Actual", startX + 200, y, { width: 100 });
    doc.text("Anterior", startX + 300, y, { width: 100 });
    y += 16;
    doc.font("Helvetica");
    for (const row of METRIC_ROWS) {
      doc.text(row.label, startX, y, { width: 200 });
      doc.text(String(Number(data.current[row.key]).toLocaleString("es-CL")), startX + 200, y, { width: 100 });
      doc.text(String(Number(data.previous[row.key]).toLocaleString("es-CL")), startX + 300, y, { width: 100 });
      y += 14;
    }
    doc.y = y + 8;

    // Top campañas
    sectionTitle(doc, "Top campañas", accent);
    data.topCampaigns.forEach((c) => {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(dark).text(c.name);
      doc.fontSize(9).font("Helvetica").fillColor(muted).text(`${c.leads.toLocaleString("es-CL")} leads · CPL $${c.cpl.toFixed(0)} · Inversión $${c.spend.toLocaleString("es-CL")}`);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);

    // Top publicaciones
    sectionTitle(doc, "Top publicaciones", accent);
    data.topPosts.forEach((p) => {
      doc.fontSize(9).font("Helvetica").fillColor(dark).text(`• ${stripUnsupportedGlyphs(p.copy)}`, { width: 480 });
      doc.fontSize(8).fillColor(muted).text(`   ${p.engagement.toLocaleString("es-CL")} engagement · ${p.performanceScore} pts`);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.5);

    // Problemas
    sectionTitle(doc, "Problemas detectados", "#c23b3b");
    data.executiveSummary.problemasDetectados.forEach((item) => bullet(doc, item, dark));
    doc.moveDown(0.5);

    // Recomendaciones / acciones prioritarias
    sectionTitle(doc, "Acciones prioritarias", accent);
    data.executiveSummary.accionesPrioritarias.forEach((item) => bullet(doc, item, dark));
    doc.moveDown(0.5);

    // Próximos pasos
    sectionTitle(doc, "Próximos pasos", accent);
    data.executiveSummary.proximosPasos.forEach((item) => bullet(doc, item, dark));

    if (!data.generatedWithAI) {
      doc.moveDown(1);
      doc.fontSize(8).fillColor(muted).font("Helvetica-Oblique").text("Resumen generado en modo simulado. Conecta tu OpenAI API Key en Configuración para análisis con IA real.");
    }

    doc.end();
  });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.fontSize(12).fillColor(color).font("Helvetica-Bold").text(title);
  doc.moveDown(0.3);
}

function bullet(doc: PDFKit.PDFDocument, text: string, color: string) {
  doc.fontSize(9).fillColor(color).font("Helvetica").text(`•  ${text}`, { width: 480 });
  doc.moveDown(0.15);
}
