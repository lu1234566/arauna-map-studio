import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ValidationReport } from "@/lib/emeraldMap";

export function ValidationPanel({
  report,
  onClose,
}: {
  report: ValidationReport;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-background/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-md border border-border bg-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="panel-title">Relatório de validação</span>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          {report.pass ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : (
            <XCircle className="size-5 text-destructive" />
          )}
          <span
            className={
              "text-base font-bold tracking-wide " +
              (report.pass ? "text-success" : "text-destructive")
            }
          >
            {report.pass ? "PASS" : "FAIL"}
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {report.cellCount} células · {report.byteLength} bytes
          </span>
        </div>

        <ul className="max-h-72 overflow-y-auto p-2">
          {report.issues.map((issue, n) => (
            <li key={n} className="flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-surface">
              {issue.level === "error" ? (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              ) : issue.level === "warn" ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="text-[11px] leading-relaxed">{issue.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
