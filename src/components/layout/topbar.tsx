"use client";

import { useState } from "react";
import { Moon, Sun, Bell, RefreshCw, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";

export function Topbar({ title, alertCount = 0 }: { title: string; alertCount?: number }) {
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "No se pudo sincronizar." });
      } else if (data.synced === false) {
        setResult({ ok: false, message: data.reason ?? "Sincronización no disponible en modo simulado." });
      } else {
        type SyncOutcome = { brandSlug: string; error?: string };
        const metaErrors = ((data.meta ?? []) as SyncOutcome[]).filter((r) => r.error);
        const gaErrors = ((data.googleAnalytics ?? []) as SyncOutcome[]).filter((r) => r.error);
        const allErrors = [...metaErrors, ...gaErrors];

        if (allErrors.length > 0) {
          const first = allErrors[0];
          setResult({
            ok: false,
            message: `${first.brandSlug}: ${first.error}${allErrors.length > 1 ? ` (+${allErrors.length - 1} más)` : ""}`,
          });
        } else {
          setResult({ ok: true, message: "Datos actualizados" });
        }
        // Refresca todos los datos ya cargados en pantalla con lo recién sincronizado
        queryClient.invalidateQueries();
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? `Error de conexión: ${err.message}` : "No se pudo conectar con el servidor." });
    } finally {
      setSyncing(false);
      setTimeout(() => setResult(null), 8000);
    }
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur z-10">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>

      <div className="flex items-center gap-2">
        {result && (
          <span className={cn("flex items-center gap-1.5 text-xs font-medium", result.ok ? "text-success" : "text-danger")}>
            {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {result.message}
          </span>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-surface transition-colors disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Actualizando..." : "Actualizar ahora"}
        </button>

        <button className="relative rounded-md p-2 hover:bg-surface transition-colors" aria-label="Alertas">
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger text-[10px] leading-4 text-white text-center">
              {alertCount}
            </span>
          )}
        </button>

        <button
          onClick={toggle}
          className="rounded-md p-2 hover:bg-surface transition-colors"
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border">
          <div className="h-7 w-7 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-medium">
            {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md p-1.5 hover:bg-surface transition-colors text-muted"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
