import { Award, Check, Package, Route, Sparkles } from "lucide-react";
import type { ProceduralSeedCandidate } from "@/lib/proceduralCandidates";
import { cn } from "@/lib/utils";

export function SeedCandidateGallery({
  candidates,
  activeSeed,
  onSelect,
}: {
  candidates: ProceduralSeedCandidate[];
  activeSeed: string;
  onSelect: (candidate: ProceduralSeedCandidate) => void;
}) {
  if (!candidates.length) return null;
  const bestScore = candidates[0]?.score.total ?? 0;

  return (
    <section className="rounded border border-border bg-panel/70 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <Award className="size-3.5 text-primary" /> Candidatos de seed
          </div>
          <p className="text-[9px] text-muted-foreground">
            Ordenados por cobertura de marcos, fillers, conexões, saídas e avisos. Melhor pontuação: {bestScore}/100.
          </p>
        </div>
        <span className="rounded border border-border bg-canvas px-2 py-1 font-mono text-[9px] text-muted-foreground">
          {candidates.length} variações
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
        {candidates.map((candidate, rank) => {
          const selected = candidate.seed === activeSeed;
          const valid = candidate.result.ok;
          return (
            <button
              key={`${candidate.seed}-${candidate.index}`}
              type="button"
              onClick={() => onSelect(candidate)}
              className={cn(
                "rounded border p-2 text-left transition-colors",
                selected
                  ? "border-primary/60 bg-primary/10"
                  : valid
                    ? "border-border bg-canvas hover:bg-surface"
                    : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span className={cn(
                    "grid size-4 shrink-0 place-items-center rounded text-[8px] font-bold",
                    rank === 0 ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground",
                  )}>
                    {rank + 1}
                  </span>
                  <span className="truncate font-mono text-[9px] font-semibold">{candidate.seed}</span>
                </div>
                <span className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                  candidate.score.total >= 90
                    ? "bg-success/15 text-success"
                    : candidate.score.total >= 75
                      ? "bg-primary/15 text-primary"
                      : candidate.score.total > 0
                        ? "bg-warning/15 text-warning"
                        : "bg-destructive/15 text-destructive",
                )}>
                  {candidate.score.total}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[8px] text-muted-foreground">
                <span>{candidate.quality}</span>
                <span>{candidate.result.warnings.length} aviso(s)</span>
              </div>

              <div className="mt-1.5 grid grid-cols-5 gap-0.5 text-center font-mono text-[7px] text-muted-foreground">
                <Metric icon={<Sparkles className="size-2.5" />} value={candidate.score.landmarks} title="Marcos /30" />
                <Metric icon={<Package className="size-2.5" />} value={candidate.score.fillers} title="Fillers /20" />
                <Metric icon={<Route className="size-2.5" />} value={candidate.score.landmarkConnections} title="Conexões /20" />
                <Metric icon={<Check className="size-2.5" />} value={candidate.score.exits} title="Saídas /20" />
                <Metric icon={<Award className="size-2.5" />} value={candidate.score.cleanRun} title="Limpeza /10" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ icon, value, title }: { icon: React.ReactNode; value: number; title: string }) {
  return (
    <span title={title} className="flex items-center justify-center gap-0.5 rounded bg-surface/70 px-0.5 py-1">
      {icon}{value}
    </span>
  );
}
