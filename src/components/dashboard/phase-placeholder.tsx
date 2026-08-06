import { Topbar } from "@/components/layout/topbar";
import { Construction } from "lucide-react";

export function PhasePlaceholder({
  title,
  description,
  phase,
  items,
}: {
  title: string;
  description: string;
  phase: string;
  items: string[];
}) {
  return (
    <div>
      <Topbar title={title} />
      <div className="p-6 max-w-2xl">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4">
            <Construction className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold mb-1">{title}</h2>
          <p className="text-sm text-muted mb-5">{description}</p>
          <div className="text-left rounded-lg bg-surface-2 border border-border p-4">
            <p className="text-xs font-medium text-accent mb-2">Se entrega en {phase}</p>
            <ul className="text-sm text-foreground/90 space-y-1.5 list-disc list-inside">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
