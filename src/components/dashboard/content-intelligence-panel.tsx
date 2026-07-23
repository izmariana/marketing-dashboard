import { Panel } from "@/components/dashboard/panel";
import type { ContentIntelligenceResponse } from "@/hooks/use-platform-intelligence";
import { Lightbulb, Info } from "lucide-react";

export function ContentIntelligencePanel({ data }: { data: ContentIntelligenceResponse }) {
  if (data.postsAnalyzed === 0) {
    return (
      <Panel title="Inteligencia de Contenidos" description="Patrones automáticos sobre tus publicaciones">
        <p className="text-sm text-muted">{data.recommendations[0]}</p>
      </Panel>
    );
  }

  return (
    <Panel title="Inteligencia de Contenidos" description={`Patrones detectados sobre ${data.postsAnalyzed} publicaciones`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-[11px] text-muted mb-1">Mejor formato</p>
          <p className="text-sm font-semibold">{data.bestFormat?.type ?? "—"}</p>
          <p className="text-[11px] text-muted">{data.bestFormat?.avgScore ?? 0} pts promedio</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-[11px] text-muted mb-1">Mejor día</p>
          <p className="text-sm font-semibold">{data.bestDay?.day ?? "—"}</p>
          <p className="text-[11px] text-muted">{data.bestDay?.avgScore ?? 0} pts promedio</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-[11px] text-muted mb-1">Mejor franja horaria</p>
          <p className="text-sm font-semibold">{data.bestHour?.hourRange ?? "—"}</p>
          <p className="text-[11px] text-muted">{data.bestHour?.avgScore ?? 0} pts promedio</p>
        </div>
      </div>

      {data.topThemes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted mb-1.5">Temas frecuentes en tus publicaciones top</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topThemes.map((t, i) => (
              <span key={i} className="text-[11px] bg-accent-soft text-accent rounded-full px-2 py-0.5">
                {t.word} · {t.avgScoreWhenPresent} pts
              </span>
            ))}
          </div>
        </div>
      )}

      {data.bestCta && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted mb-1.5">Mejor llamado a la acción detectado</p>
          <p className="text-sm">
            <span className="font-medium text-accent">&ldquo;{data.bestCta.phrase}&rdquo;</span> — {data.bestCta.avgScore} pts promedio, {data.bestCta.avgCtr}% CTR
          </p>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Recomendaciones accionables</p>
        <ul className="space-y-1.5">
          {data.recommendations.map((r, i) => (
            <li key={i} className="text-sm text-foreground/90 flex gap-2">
              <span className="text-muted mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border pt-3 space-y-1">
        {data.limitations.map((l, i) => (
          <p key={i} className="text-[11px] text-muted flex items-start gap-1.5">
            <Info className="h-3 w-3 shrink-0 mt-0.5" /> {l}
          </p>
        ))}
      </div>
    </Panel>
  );
}
