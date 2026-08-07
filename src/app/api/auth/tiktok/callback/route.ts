import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/services/encryption";
import { BRANDS } from "@/types/domain";

interface TikTokTokenResponse {
  access_token?: string;
  open_id?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * GET /api/auth/tiktok/callback
 *
 * TikTok redirige acá después de que el usuario autoriza la app, con un
 * `code` de un solo uso. Este endpoint lo cambia por el Access Token real
 * (llamada server-to-server, con el client_secret — nunca expuesto al
 * navegador) y lo guarda directo en la marca que viajaba en `state`.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  const configUrl = new URL("/configuracion", req.url);

  if (errorParam) {
    configUrl.searchParams.set("tiktok_error", `TikTok rechazó la autorización: ${errorParam}`);
    return NextResponse.redirect(configUrl);
  }
  if (!code || !state) {
    configUrl.searchParams.set("tiktok_error", "Faltó el código o el state en la respuesta de TikTok.");
    return NextResponse.redirect(configUrl);
  }

  const [csrfToken, brandSlug] = state.split(".");
  const cookieCsrf = req.cookies.get("tiktok_oauth_csrf")?.value;
  if (!cookieCsrf || cookieCsrf !== csrfToken) {
    configUrl.searchParams.set("tiktok_error", "El state no coincide (posible CSRF) — intenta conectar de nuevo.");
    return NextResponse.redirect(configUrl);
  }

  const brandMeta = BRANDS.find((b) => b.slug === brandSlug);
  if (!brandMeta) {
    configUrl.searchParams.set("tiktok_error", `Marca '${brandSlug}' no reconocida.`);
    return NextResponse.redirect(configUrl);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    configUrl.searchParams.set("tiktok_error", "Faltan TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET en las variables de entorno.");
    return NextResponse.redirect(configUrl);
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/tiktok/callback`;

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData: TikTokTokenResponse = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token || !tokenData.open_id) {
      configUrl.searchParams.set(
        "tiktok_error",
        `TikTok no entregó un token válido: ${tokenData.error_description ?? tokenData.error ?? "respuesta inesperada"}`
      );
      return NextResponse.redirect(configUrl);
    }

    if (!isDatabaseConfigured) {
      configUrl.searchParams.set("tiktok_error", "No hay base de datos conectada — no se pudo guardar el token.");
      return NextResponse.redirect(configUrl);
    }

    const prisma = await getPrisma();
    const brand = await prisma.brand.upsert({
      where: { slug: brandSlug as never },
      create: { slug: brandSlug as never, name: brandMeta.name, themeColor: brandMeta.themeColor },
      update: {},
    });

    await prisma.tiktokCredential.upsert({
      where: { brandId: brand.id },
      create: {
        brandId: brand.id,
        accessTokenEnc: encryptSecret(tokenData.access_token),
        openId: tokenData.open_id,
        syncStatus: "idle",
      },
      update: {
        accessTokenEnc: encryptSecret(tokenData.access_token),
        openId: tokenData.open_id,
        syncStatus: "idle",
        syncError: null,
      },
    });

    configUrl.searchParams.set("tiktok_success", brandMeta.name);
    const res = NextResponse.redirect(configUrl);
    res.cookies.delete("tiktok_oauth_csrf");
    return res;
  } catch (err) {
    configUrl.searchParams.set("tiktok_error", err instanceof Error ? err.message : "Error desconocido conectando con TikTok.");
    return NextResponse.redirect(configUrl);
  }
}