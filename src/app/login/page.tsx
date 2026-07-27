"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

export default function LoginPage() {
  const router = useRouter();
  const { data: branding } = useBranding();
  const [email, setEmail] = useState("admin@dashboard.cl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/marcas/informes-comerciales");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          {branding?.logoDataUrl ? (
            <div className="h-9 w-9 rounded-lg overflow-hidden relative bg-accent">
              <Image src={branding.logoDataUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-accent-foreground" />
            </div>
          )}
          <span className="font-semibold text-lg tracking-tight">{branding?.platformName ?? "Marketing Segal"}</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-medium mb-1">Iniciar sesión</h1>
          <p className="text-sm text-muted mb-6">
            Accede al dashboard de Informes Comerciales, Inversiones Cinco y Segal Deudores.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123 (demo)"
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent text-accent-foreground text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="text-xs text-muted text-center mt-4">
          Demo: admin@dashboard.cl / admin123
        </p>
      </div>
    </div>
  );
}
