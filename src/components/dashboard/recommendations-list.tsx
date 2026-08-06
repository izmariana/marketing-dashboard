import { AlertTriangle, AlertOctagon, TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/services/recommendation-engine";

const SEVERITY_CONFIG = {
  critical: { icon: AlertOctagon, className: "border-danger/30 bg-danger/5 text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning/5 text-warning" },
  opportunity: { icon: TrendingUp, className: "border-success/30 bg-success/5 text-success" },
  info: { icon: Info, className: "border-border bg-surface text-muted" },
};

export function RecommendationsList({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success">
        Todas las métricas están dentro de rangos saludables. No hay acciones automáticas pendientes.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {recommendations.map((rec) => {
        const config = SEVERITY_CONFIG[rec.severity];
        const Icon = config.icon;
        return (
          <div key={rec.id} className={cn("rounded-lg border p-3.5 flex gap-3", config.className)}>
            <Icon className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{rec.title}</p>
              <p className="text-xs text-foreground/80 mt-0.5">{rec.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
