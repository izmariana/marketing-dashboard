"use client";

import { useState } from "react";
import { Moon, Sun, Bell, RefreshCw, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";

export function Topbar({ title, alertCount = 0 }: { title: string; alertCount?: number }) {
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);

  function handleSync() {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800); // Fase 2: dispara job real de sync Meta API
  }

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur z-10">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          className="flex items-center gap-1.5 text-xs font-medium rounded-md border border-border px-2.5 py-1.5 hover:bg-surface transition-colors"
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
