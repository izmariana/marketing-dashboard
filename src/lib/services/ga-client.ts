import { BetaAnalyticsDataClient } from "@google-analytics/data";

/**
 * Cliente de la Google Analytics Data API (GA4). Requiere una Service
 * Account con acceso de lectura ("Viewer") al Property de GA4 en cuestión.
 *
 * Cómo obtener las credenciales (ver también Configuración → Google Analytics):
 *  1. Ve a console.cloud.google.com → crea o selecciona un proyecto.
 *  2. Habilita la "Google Analytics Data API".
 *  3. Ve a "IAM y administración" → "Cuentas de servicio" → "Crear cuenta de servicio".
 *  4. Genera una clave JSON para esa cuenta (botón "Add Key" → "JSON").
 *  5. En Google Analytics (analytics.google.com), ve a Administrador → Property
 *     → Gestión de acceso a la propiedad → agrega el email de la cuenta de
 *     servicio (termina en @...iam.gserviceaccount.com) con rol "Viewer".
 *  6. El Property ID lo encuentras en Administrador → Detalles de la propiedad
 *     (formato numérico, ej: 123456789 — no confundir con el Measurement ID G-XXXX).
 */

export interface GaCredentials {
  propertyId: string; // solo el número, ej: "123456789"
  serviceAccountJson: string; // el JSON completo de la service account, como string
}

function getClient(creds: GaCredentials): BetaAnalyticsDataClient {
  const credentials = JSON.parse(creds.serviceAccountJson);
  return new BetaAnalyticsDataClient({ credentials });
}

function propertyPath(propertyId: string): string {
  return propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
}

// ---------------------------------------------------------------------------
// Resumen diario de KPIs (para snapshots históricos)
// ---------------------------------------------------------------------------

export interface GaDailyRow {
  date: string; // YYYYMMDD
  users: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  avgEngagementSec: number;
  pageViews: number;
  eventCount: number;
  conversions: number;
}

export async function fetchDailySummary(creds: GaCredentials, since: string, until: string): Promise<GaDailyRow[]> {
  const client = getClient(creds);
  const [response] = await client.runReport({
    property: propertyPath(creds.propertyId),
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
      { name: "screenPageViews" },
      { name: "eventCount" },
      { name: "conversions" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  return (response.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    users: Number(row.metricValues?.[0]?.value ?? 0),
    newUsers: Number(row.metricValues?.[1]?.value ?? 0),
    sessions: Number(row.metricValues?.[2]?.value ?? 0),
    engagedSessions: Number(row.metricValues?.[3]?.value ?? 0),
    engagementRate: Number(row.metricValues?.[4]?.value ?? 0) * 100,
    avgEngagementSec: Number(row.metricValues?.[5]?.value ?? 0),
    pageViews: Number(row.metricValues?.[6]?.value ?? 0),
    eventCount: Number(row.metricValues?.[7]?.value ?? 0),
    conversions: Number(row.metricValues?.[8]?.value ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Adquisición de tráfico (canal + fuente)
// ---------------------------------------------------------------------------

export interface GaTrafficRow {
  date: string;
  channel: string;
  source: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
}

export async function fetchTrafficAcquisition(creds: GaCredentials, since: string, until: string): Promise<GaTrafficRow[]> {
  const client = getClient(creds);
  const [response] = await client.runReport({
    property: propertyPath(creds.propertyId),
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }, { name: "sessionSource" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "conversions" },
      { name: "averageSessionDuration" },
    ],
  });

  return (response.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    channel: row.dimensionValues?.[1]?.value ?? "Unassigned",
    source: row.dimensionValues?.[2]?.value ?? "(direct)",
    users: Number(row.metricValues?.[0]?.value ?? 0),
    sessions: Number(row.metricValues?.[1]?.value ?? 0),
    engagementRate: Number(row.metricValues?.[2]?.value ?? 0) * 100,
    conversions: Number(row.metricValues?.[3]?.value ?? 0),
    avgEngagementSec: Number(row.metricValues?.[4]?.value ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------

export interface GaLandingPageRow {
  date: string;
  path: string;
  title: string;
  users: number;
  sessions: number;
  engagementRate: number;
  conversions: number;
  avgEngagementSec: number;
  exitRate: number;
}

export async function fetchLandingPages(creds: GaCredentials, since: string, until: string): Promise<GaLandingPageRow[]> {
  const client = getClient(creds);
  const [response] = await client.runReport({
    property: propertyPath(creds.propertyId),
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "date" }, { name: "landingPagePlusQueryString" }, { name: "pageTitle" }],
    metrics: [
      { name: "totalUsers" },
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "conversions" },
      { name: "averageSessionDuration" },
      { name: "exitRate" },
    ],
    limit: 100,
  });

  return (response.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    path: row.dimensionValues?.[1]?.value ?? "/",
    title: row.dimensionValues?.[2]?.value ?? "",
    users: Number(row.metricValues?.[0]?.value ?? 0),
    sessions: Number(row.metricValues?.[1]?.value ?? 0),
    engagementRate: Number(row.metricValues?.[2]?.value ?? 0) * 100,
    conversions: Number(row.metricValues?.[3]?.value ?? 0),
    avgEngagementSec: Number(row.metricValues?.[4]?.value ?? 0),
    exitRate: Number(row.metricValues?.[5]?.value ?? 0) * 100,
  }));
}

// ---------------------------------------------------------------------------
// Eventos y conversiones
// ---------------------------------------------------------------------------

export interface GaEventRow {
  date: string;
  eventName: string;
  eventCount: number;
  totalUsers: number;
  isConversion: boolean;
}

export async function fetchEvents(creds: GaCredentials, since: string, until: string): Promise<GaEventRow[]> {
  const client = getClient(creds);
  const [response] = await client.runReport({
    property: propertyPath(creds.propertyId),
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "date" }, { name: "eventName" }, { name: "isConversionEvent" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    limit: 200,
  });

  return (response.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    eventName: row.dimensionValues?.[1]?.value ?? "",
    isConversion: row.dimensionValues?.[2]?.value === "true",
    eventCount: Number(row.metricValues?.[0]?.value ?? 0),
    totalUsers: Number(row.metricValues?.[1]?.value ?? 0),
  }));
}

/**
 * Verifica que las credenciales sean válidas haciendo una consulta mínima.
 * Se usa al guardar la conexión en Configuración, para dar feedback inmediato.
 */
export async function testConnection(creds: GaCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient(creds);
    await client.runReport({
      property: propertyPath(creds.propertyId),
      dateRanges: [{ startDate: "yesterday", endDate: "today" }],
      metrics: [{ name: "totalUsers" }],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
