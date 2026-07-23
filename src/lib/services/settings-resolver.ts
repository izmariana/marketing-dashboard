import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/services/encryption";

/**
 * Devuelve la OpenAI API Key a usar: primero busca en la base de datos
 * (guardada desde Configuración), y si no existe, cae de vuelta a la
 * variable de entorno OPENAI_API_KEY. Así el botón "Guardar" de
 * Configuración funciona de verdad, sin romper el modo de desarrollo local.
 */
export async function resolveOpenAiApiKey(): Promise<string | undefined> {
  if (isDatabaseConfigured) {
    try {
      const prisma = await getPrisma();
      const settings = await prisma.appSettings.findFirst();
      if (settings?.openaiApiKeyEnc) {
        return decryptSecret(settings.openaiApiKeyEnc);
      }
    } catch {
      // si falla la lectura, cae al .env como respaldo
    }
  }
  return process.env.OPENAI_API_KEY;
}
