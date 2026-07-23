import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/services/encryption";
import { auth } from "@/lib/auth/auth";

const bodySchema = z.object({ openaiApiKey: z.string().min(20) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { error: "No hay una base de datos conectada. Mientras tanto, puedes definir OPENAI_API_KEY como variable de entorno en Vercel." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "API Key inválida" }, { status: 400 });
  }

  const prisma = await getPrisma();
  const encrypted = encryptSecret(parsed.data.openaiApiKey);

  const existing = await prisma.appSettings.findFirst();
  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: { openaiApiKeyEnc: encrypted } });
  } else {
    await prisma.appSettings.create({ data: { openaiApiKeyEnc: encrypted } });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ connected: Boolean(process.env.OPENAI_API_KEY), source: "env" });
  }

  const prisma = await getPrisma();
  const settings = await prisma.appSettings.findFirst();
  const connected = Boolean(settings?.openaiApiKeyEnc) || Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({ connected, source: "database" });
}
