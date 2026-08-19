import { useMemo, useState } from "react";
import { blueprintAiContract, blueprintExample, compileMapBlueprint, parseMapBlueprintJson } from "@/lib/mapBlueprint";
import { serializeMapTemplates } from "@/lib/mapTemplate";
import { mapTemplateStore } from "@/lib/mapTemplateStore";
import { usePatternLibrary } from "@/lib/patternLibraryStore";
import { useSmartPath } from "@/lib/smartPathStore";
import { cn } from "@/lib/utils";

function copyText(source: string) {
  void navigator.clipboard?.writeText(source);
}

export function MapBlueprintDock() {
  const patterns = usePatternLibrary();
  const smartPaths = useSmartPath();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("Cole um blueprint JSON ou gere um exemplo.");
  const [ok, setOk] = useState<boolean | null>(null);

  const aiContract = useMemo(
    () => blueprintAiContract(patterns.patterns, smartPaths.presets),
    [patterns.patterns, smartPaths.presets],
  );

  const compile = () => {
    try {
      const blueprint = parseMapBlueprintJson(source);
      const result = compileMapBlueprint(blueprint, patterns.patterns, smartPaths.presets);
      if (!result.valid || !result.template) {
        setOk(false);
        setMessage(result.errors.join(" ") || "Blueprint inválido.");
        return;
      }
      const imported = mapTemplateStore.importJson(serializeMapTemplates([result.template]));
      if (!imported.ok) {
        setOk(false);
        setMessage(imported.message);
        return;
      }
      setOk(true);
      setMessage(
        `Compilado: ${result.resolvedPatterns.length} padrão(ões), ${result.resolvedSmartPaths.length} rota(s).${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`,
      );
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="absolute right-2 top-2 z-30 overflow-hidden rounded border border-border bg-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded border border-border bg-toolbar px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:bg-surface"
          title="Compilar um blueprint JSON em Template Arauna"
        >
          Blueprint IA
        </button>
        <span className="text-[9px] text-muted-foreground">JSON → Template GBA</span>
      </div>

      {open && (
        <div className="w-[460px] max-w-[calc(100vw-320px)] border-t border-border p-2.5">
          <div className="mb-2 rounded border border-primary/25 bg-primary/5 p-2 text-[9px] leading-relaxed text-muted-foreground">
            Esta camada não converte imagens em mapa e não inventa metatiles. Ela aceita um plano estrutural que referencia apenas <b className="text-foreground">Padrões</b> e <b className="text-foreground">Smart Paths</b> já cadastrados, e compila o resultado para um Template editável.
          </div>

          <textarea
            value={source}
            onChange={(event) => { setSource(event.target.value); setOk(null); }}
            spellCheck={false}
            placeholder='{"format":"arauna-map-blueprint-v1", ...}'
            className="h-56 w-full resize-y rounded border border-border bg-canvas p-2 font-mono text-[9px] leading-relaxed text-foreground outline-none focus:border-primary/60"
          />

          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setSource(blueprintExample(patterns.patterns[0]?.name ?? "Casa Rural", smartPaths.presets[0]?.name ?? "Estrada de Terra"));
                setOk(null);
                setMessage("Exemplo carregado. Ajuste os nomes para recursos existentes antes de compilar.");
              }}
              className="rounded border border-border bg-toolbar px-2 py-1 text-[9px] hover:bg-surface"
            >
              Exemplo
            </button>
            <button
              type="button"
              onClick={() => copyText(aiContract)}
              className="rounded border border-border bg-toolbar px-2 py-1 text-[9px] hover:bg-surface"
              title="Copia um contrato/prompt que lista exatamente os recursos disponíveis"
            >
              Copiar contrato para IA
            </button>
            <button
              type="button"
              disabled={!source.trim()}
              onClick={compile}
              className="ml-auto rounded border border-primary/50 bg-primary/15 px-2.5 py-1 text-[9px] font-semibold text-primary hover:bg-primary/25 disabled:pointer-events-none disabled:opacity-35"
            >
              Validar e compilar
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="rounded border border-border bg-canvas px-2 py-1.5 text-muted-foreground">
              Biblioteca: <b className="text-foreground">{patterns.patterns.length}</b> padrão(ões)
            </div>
            <div className="rounded border border-border bg-canvas px-2 py-1.5 text-muted-foreground">
              Smart Paths: <b className="text-foreground">{smartPaths.presets.length}</b> preset(s)
            </div>
          </div>

          <div className={cn(
            "mt-2 rounded border px-2 py-1.5 text-[9px] leading-relaxed",
            ok === true && "border-success/30 bg-success/10 text-success",
            ok === false && "border-destructive/40 bg-destructive/10 text-destructive",
            ok === null && "border-border bg-canvas text-muted-foreground",
          )}>
            {message}
          </div>

          <div className="mt-2 text-[8px] leading-relaxed text-muted-foreground">
            Fluxo: descreva o mapa para uma IA usando <b>Copiar contrato para IA</b> → cole o JSON retornado aqui → compile → o resultado aparece em <b>Templates</b> e pode ser posicionado no mapa real. Nenhum backend ou chave de API é necessário nesta etapa.
          </div>
        </div>
      )}
    </section>
  );
}
