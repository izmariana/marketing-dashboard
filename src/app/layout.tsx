import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

// Nota: en producción (Vercel) puedes reemplazar esto por next/font/google con
// Geist normalmente — aquí se usa el stack de fuentes del sistema definido en
// globals.css porque este entorno de generación no tiene salida a Google Fonts.

export const metadata: Metadata = {
  title: "Marketing Segal",
  description: "Monitoreo, análisis y optimización de Meta Ads, Google Analytics, TikTok e Instagram/Facebook para Informes Comerciales, Inversiones Cinco y Segal Deudores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
