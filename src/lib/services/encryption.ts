import crypto from "crypto";

/**
 * Encripta/desencripta credenciales sensibles (tokens de Meta, API keys)
 * antes de guardarlas en la base de datos. Nunca se persiste texto plano.
 *
 * Requiere CREDENTIALS_ENCRYPTION_KEY en .env (32 bytes en hex).
 * Generar con: openssl rand -hex 32
 */

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY debe estar definida en .env como 32 bytes en hexadecimal (64 caracteres). Genera una con: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Formato almacenado: iv:authTag:ciphertext, todo en base64
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Formato de credencial encriptada inválido");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
