import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Binary, HardDrive, Layers3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/formato")({
  component: FormatPage,
});

function FormatPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-12 items-center gap-3 border-b border-border bg-toolbar px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
        >
          <ArrowLeft className="size-3.5" /> Voltar ao editor
        </Link>
        <div>
          <h1 className="text-sm font-semibold">Formato de mapa — Emerald decomp</h1>
          <p className="text-[10px] text-muted-foreground">Referência curta usada pelo MVP do Arauna Map Studio</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-5 md:grid-cols-2">
        <InfoCard icon={HardDrive} title="Dimensão inicial">
          <p>O primeiro alvo é a Vila Amanhecer/LittlerootTown com <b>20 × 20 metatiles</b>.</p>
          <p className="mt-2 font-mono text-xs text-primary">20 × 20 = 400 células</p>
        </InfoCard>

        <InfoCard icon={Binary} title="map.bin">
          <p>Cada célula ocupa <b>2 bytes</b>, lidos e escritos como <b>uint16 little-endian</b>.</p>
          <p className="mt-2 font-mono text-xs text-primary">400 × 2 = 800 bytes</p>
        </InfoCard>

        <InfoCard icon={Layers3} title="Separação dos bits">
          <div className="space-y-1 font-mono text-xs">
            <p>metatileId = raw &amp; 0x03FF</p>
            <p>physicalBits = raw &amp; 0xFC00</p>
            <p>raw = physicalBits | metatileId</p>
          </div>
          <p className="mt-3 text-muted-foreground">No modo Visual o editor altera apenas o ID do metatile e mantém os bits físicos da célula intactos.</p>
        </InfoCard>

        <InfoCard icon={ShieldCheck} title="Proteção de progressão">
          <p>O MVP pode bloquear coordenadas sensíveis para impedir alterações acidentais durante a pintura visual.</p>
          <p className="mt-2 text-muted-foreground">Na fase seguinte essas posições serão carregadas do mapa real e validadas contra warps, triggers, NPCs e conexões.</p>
        </InfoCard>

        <section className="rounded-md border border-warning/40 bg-warning/5 p-4 md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-warning">Atlas atual</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            Os gráficos disponíveis neste MVP são placeholders originais. Eles existem apenas para provar o fluxo de edição. O próximo marco do projeto é gerar um atlas a partir dos tilesets/metatiles reais do repositório Pokémon Juramento de Arauna e associar cada preview ao ID que o GBA realmente usa.
          </p>
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Binary;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded bg-primary/15 text-primary">
          <Icon className="size-4" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
