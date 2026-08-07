import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import crypto from "crypto";

/**
 * GET /api/auth/tiktok/authorize?brandSlug=segal_deudores
 *
 * TikTok no tiene un "Explorador" como Meta para generar un token de
 * prueba — hay que hacer el baile de OAuth completo. Este endpoint
 * arranca ese baile: redirige al usuario a TikTok para que autorice la
 * app, pasando `brandSlug` escondido en el parámetro `state` para saber,
 * cuando TikTok nos devuelva el control en /callback, a qué marca
 * corresponde ese token.
 *
 * Requiere las variables de entorno TIKTOK_CLIENT_KEY (público, del app
 * de TikTok) — el secret solo se usa en /callback, nunca aquí.
 *
 * El redirect_uri que arma este endpoint (origin + /api/auth/tiktok/callback)
 * tiene que estar registrado EXACTO (carácter por carácter) como "Redirect URI"
 * en developers.tiktok.com → tu app → Login Kit.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const brandSlug = req.nextUrl.searchParams.get("brandSlug");
  if (!brandSlug) {
    return NextResponse.json({ error: "Falta el parámetro 'brandSlug'" }, { status: 400 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.json(
      { error: "Falta configurar TIKTOK_CLIENT_KEY en las variables de entorno de Vercel." },
      { status: 500 }
    );
  }

  // El "state" protege contra ataques CSRF y de paso viaja el brandSlug
  // hasta el callback, ya que TikTok nos lo devuelve tal cual se lo mandamos.
  const csrfToken = crypto.randomBytes(16).toString("hex");
  const state = `${csrfToken}.${brandSlug}`;

  const redirectUri = `${req.nextUrl.origin}/api/auth/tiktok/callback`;

  const authorizeUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authorizeUrl.searchParams.set("client_key", clientKey);
  authorizeUrl.searchParams.set("scope", "user.info.basic,user.info.stats,video.list");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("tiktok_oauth_csrf", csrfToken, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}