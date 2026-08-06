"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  Sparkles,
  FileBarChart,
  Settings,
  BarChart3,
  GitCompareArrows,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

interface NavLeaf {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}
interface NavGroup {
  label: string;
  icon: typeof LayoutDashboard;
  children: { href: string; label: string }[];
}
type NavItem = NavLeaf | NavGroup;

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Marcas",
    icon: Building2,
    children: [
      { href: "/marcas/informes-comerciales", label: "Informes Comerciales" },
      { href: "/marcas/inversiones-cinco", label: "Inversiones Cinco" },
      { href: "/marcas/segal-deudores", label: "Segal Deudores" },
    ],
  },
  { href: "/campanas", label: "Campañas", icon: Megaphone },
  { href: "/comparacion", label: "Comparación", icon: GitCompareArrows },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/recomendaciones", label: "Recomendaciones IA", icon: Sparkles },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: branding } = useBranding();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface h-screen sticky top-0 flex flex-col">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
        {branding?.logoDataUrl ? (
          <div className="h-7 w-7 rounded-md overflow-hidden shrink-0 relative bg-accent">
            <Image src={branding.logoDataUrl} alt="" fill unoptimized className="object-cover" />
          </div>
        ) : (
          <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center shrink-0">
            <BarChart3 className="h-4 w-4 text-accent-foreground" />
          </div>
        )}
        <span className="font-semibold text-sm tracking-tight truncate">{branding?.platformName ?? "Marketing Segal"}</span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          if ("children" in item) {
            return (
              <div key={item.label} className="mb-1">
                <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 ml-5 text-sm transition-colors",
                      pathname === child.href
                        ? "bg-accent-soft text-accent font-medium"
                        : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            );
          }

          const Icon = item.icon;
          const active = pathname === item.href;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted/60 cursor-not-allowed"
                title="Próximamente"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto text-[10px] bg-surface-2 border border-border rounded-full px-1.5 py-0.5">Pronto</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent-soft text-accent font-medium"
                  : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
