import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb, ArrowRight, Flag } from "lucide-react";
import type { ExecutiveSummaryOutput } from "@/lib/services/openai-client";

function Section({ icon: Icon, title, items, tone }: { icon: typeof CheckCircle2; title: string; items: string[]; tone: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted uppercase tracking-wide flex items-center gap-1.5 mb-2">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground/90 flex gap-2">
            <span className="text-muted mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutiveSummaryPanel({ summary, generatedWithAI }: { summary: ExecutiveSummaryOutput; generatedWithAI: boolean }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-accent-soft border border-accent/30 p-4">
        <h4 className="text-xs font-medium text-accent uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5" /> Resumen ejecutivo
        </h4>
        <p className="text-sm text-foreground/90 leading-relaxed">{summary.resumenEjecutivo}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section icon={CheckCircle2} title="Hallazgos" items={summary.hallazgos} tone="text-accent" />
        <Section icon={AlertTriangle} title="Problemas detectados" items={summary.problemasDetectados} tone="text-warning" />
        <Section icon={Lightbulb} title="Oportunidades" items={summary.oportunidades} tone="text-success" />
        <Section icon={Flag} title="Acciones prioritarias" items={summary.accionesPrioritarias} tone="text-danger" />
      </div>

      <Section icon={ArrowRight} title="Próximos pasos" items={summary.proximosPasos} tone="text-muted" />

      {!generatedWithAI && (
        <p className="text-[11px] text-muted italic border-t border-border pt-3">
          Este resumen fue generado en modo simulado. Agrega tu OpenAI API Key en Configuración para que el Marketing Advisor analice tus datos reales con IA.
        </p>
      )}
    </div>
  );
}
