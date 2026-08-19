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
          <p className="text-[10px] text-muted-foreground">Referência curta usada pelo Arauna Map Studio</p>
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
          <p className="mt-3 text-muted-foreground">No modo Visual o editor altera apenas o ID do metatile e mantém colisão/elevação da célula intactas.</p>
        </InfoCard>

        <InfoCard icon={Layers3} title="map.json">
          <p><b>data/maps/.../map.json</b> complementa o layout binário com o mapa lógico do pokeemerald.</p>
          <p className="mt-2 text-muted-foreground">O Studio já lê ID, layout, música, conexões, warps, object events/NPCs, coord events e BG events.</p>
        </InfoCard>

        <InfoCard icon={ShieldCheck} title="Proteção de progressão">
          <p>Ao importar map.json, o editor deriva automaticamente células protegidas de <b>warps, coord events e BG events</b>.</p>
          <p className="mt-2 text-muted-foreground">NPCs aparecem no overlay e no inspetor, mas não bloqueiam a pintura do terreno por padrão.</p>
        </InfoCard>

        <InfoCard icon={HardDrive} title="Teste sem downloads">
          <p>O botão <b>Vila real</b> carrega um snapshot de LittlerootTown retirado do repositório Juramento de Arauna.</p>
          <p className="mt-2 text-muted-foreground">Isso permite testar de imediato o map.bin real e todos os eventos reais. O snapshot não substitui a importação dos arquivos mais novos quando o mapa mudar.</p>
        </InfoCard>

        <section className="rounded-md border border-warning/40 bg-warning/5 p-4 md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-warning">Limitação atual: atlas gráfico</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            O Studio já entende o binário e o map.json reais, mas os previews de metatiles ainda são placeholders. IDs que não existem no atlas DEMO aparecem como blocos neutros. O próximo marco é renderizar os tilesets/metatiles reais <b>gTileset_General + gTileset_Petalburg</b> para que o canvas corresponda visualmente ao GBA.
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
