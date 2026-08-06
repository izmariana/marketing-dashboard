/**
 * true si hay una base de datos real configurada. Mientras sea false, todas
 * las rutas API sirven datos generados (mock) con la misma forma que los
 * reales, sin siquiera intentar cargar Prisma.
 */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL) && process.env.USE_MOCK_DATA !== "true";

// Import dinámico y perezoso: el paquete @prisma/client solo se carga la
// primera vez que getPrisma() se invoca de verdad (es decir, cuando
// isDatabaseConfigured es true). Así el modo simulado nunca falla por no
// tener el cliente de Prisma generado (`npx prisma generate`).
type PrismaClientType = import("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };
let cached: PrismaClientType | undefined = globalForPrisma.prisma;

export async function getPrisma(): Promise<PrismaClientType> {
  if (!isDatabaseConfigured) {
    throw new Error(
      "getPrisma() fue llamado sin una base de datos configurada. Revisa DATABASE_URL y USE_MOCK_DATA en tu .env."
    );
  }
  if (!cached) {
    const { PrismaClient } = await import("@prisma/client");
    cached = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = cached;
  }
  return cached;
}
