import { AlertTriangle, CheckCircle2, Info, ShieldCheck, X, XCircle } from "lucide-react";
import type { ValidationReport } from "@/lib/emeraldMap";
import type {
  GameImplementabilityReport,
  ImplementabilityCategory,
} from "@/lib/gameImplementability";

const CATEGORY_LABELS: Record<ImplementabilityCategory, string> = {
  grid: "Grid / BIN",
  tilesets: "Atlas / tilesets",
  mapJson: "map.json",
  warps: "Warps",
  npcs: "NPCs",
  triggers: "Triggers / BG",
  connections: "Conexões",
  accessibility: "Acessibilidade",
  weather: "Clima",
  roundtrip: "Round-trip",
};

export function ValidationPanel({
  report,
  gameAudit,
  onClose,
}: {
  report: ValidationReport;
  gameAudit?: GameImplementabilityReport | null;
  onClose: () => void;
}) {
  const deepReady = Boolean(gameAudit?.implementable);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-background/70 p-4">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="panel-title">Relatório de validação · mapa + jogo</span>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-border">
          <div className="flex items-center gap-2 border-r border-border px-3 py-3">
            {report.pass ? (
              <CheckCircle2 className="size-5 text-success" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Validação rápida</div>
              <div className={report.pass ? "font-bold text-success" : "font-bold text-destructive"}>
                {report.pass ? "PASS" : "FAIL"}
              </div>
            </div>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {report.cellCount} células · {report.byteLength} bytes
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-3">
            {deepReady ? (
              <ShieldCheck className="size-5 text-success" />
            ) : gameAudit?.pass ? (
              <AlertTriangle className="size-5 text-warning" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Implementável no jogo</div>
              <div className={deepReady ? "font-bold text-success" : gameAudit?.pass ? "font-bold text-warning" : "font-bold text-destructive"}>
                {deepReady ? "SIM · VERIFICADO" : gameAudit?.pass ? "PARCIAL" : "NÃO"}
              </div>
            </div>
            {gameAudit && (
              <span className="ml-auto text-right font-mono text-[10px] text-muted-foreground">
                {gameAudit.counts.errors}E · {gameAudit.counts.warnings}A<br />
                confiança {gameAudit.confidence}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {gameAudit && (
            <>
              <div className="mb-2 grid grid-cols-2 gap-1 sm:grid-cols-5">
                {(Object.keys(CATEGORY_LABELS) as ImplementabilityCategory[]).map((category) => {
                  const counts = gameAudit.categories[category];
                  const blocked = counts.errors > 0;
                  const warning = !blocked && counts.warnings > 0;
                  return (
                    <div
                      key={category}
                      className="rounded border border-border bg-surface/40 px-2 py-1.5"
                      title={`${counts.errors} erro(s), ${counts.warnings} aviso(s), ${counts.info} info`}
                    >
                      <div className="truncate text-[9px] font-semibold text-muted-foreground">{CATEGORY_LABELS[category]}</div>
                      <div className={blocked ? "text-[10px] font-bold text-destructive" : warning ? "text-[10px] font-bold text-warning" : "text-[10px] font-bold text-success"}>
                        {blocked ? `${counts.errors} erro` : warning ? `${counts.warnings} aviso` : "OK"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Auditoria profunda
              </div>
              <ul className="mb-3">
                {gameAudit.issues.map((found, n) => (
                  <li key={`${found.code}-${n}`} className="flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-surface">
                    {found.severity === "error" ? (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    ) : found.severity === "warning" ? (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    ) : (
                      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 text-[11px] leading-relaxed">
                      <span className="mr-1.5 font-mono text-[9px] text-muted-foreground">{found.code}</span>
                      {found.message}
                      {found.x !== undefined && found.y !== undefined && (
                        <span className="ml-1 font-mono text-[9px] text-muted-foreground">({found.x},{found.y})</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Checagem básica
          </div>
          <ul>
            {report.issues.map((found, n) => (
              <li key={n} className="flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-surface">
                {found.level === "error" ? (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                ) : found.level === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                ) : (
                  <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-[11px] leading-relaxed">{found.message}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          “Implementável no jogo” só fica verde com zero erro duro, atlas real verificado, bundle round-trip e dependências essenciais confirmadas. Avisos nunca são corrigidos automaticamente.
        </div>
      </div>
    </div>
  );
}
