import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Binary, FolderOpen, HardDrive, Layers3, ShieldCheck } from "lucide-react";

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
        <InfoCard icon={HardDrive} title="Dimensões reais">
          <p>As dimensões vêm de <b>data/layouts/layouts.json</b>. O Studio não fica mais limitado a 20×20.</p>
          <p className="mt-2 text-muted-foreground">LittlerootTown continua sendo o primeiro alvo: 20 × 20 = 400 células.</p>
        </InfoCard>

        <InfoCard icon={Binary} title="map.bin">
          <p>Cada célula ocupa <b>2 bytes</b>, lidos e escritos como <b>uint16 little-endian</b>.</p>
          <p className="mt-2 font-mono text-xs text-primary">tamanho = width × height × 2</p>
          <p className="mt-1 text-muted-foreground">Ex.: LittlerootTown 20×20 = 800 bytes; Route110 40×100 = 8000 bytes.</p>
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
          <p className="mt-2 text-muted-foreground">O Studio lê ID, layout, música, conexões, warps, object events/NPCs, coord events e BG events.</p>
        </InfoCard>

        <InfoCard icon={ShieldCheck} title="Proteção de progressão">
          <p>Ao importar map.json, o editor deriva automaticamente células protegidas de <b>warps, coord events e BG events</b>.</p>
          <p className="mt-2 text-muted-foreground">NPCs aparecem no overlay e no inspetor, mas não bloqueiam a pintura do terreno por padrão.</p>
        </InfoCard>

        <InfoCard icon={FolderOpen} title="Workspace Arauna">
          <p>O caminho recomendado é abrir a pasta <b>data/</b> uma única vez no Chrome/Chromebook.</p>
          <p className="mt-2 text-muted-foreground">O Studio indexa layouts, mapas e tilesets localmente e, ao escolher um mapa, carrega automaticamente map.bin, map.json, dimensão, primary e secondary tileset.</p>
        </InfoCard>

        <InfoCard icon={HardDrive} title="Snapshot da Vila">
          <p>O botão <b>Vila snapshot</b> continua disponível como teste rápido de LittlerootTown.</p>
          <p className="mt-2 text-muted-foreground">Ele não substitui o Workspace quando você quiser trabalhar com a versão mais nova dos arquivos locais.</p>
        </InfoCard>

        <InfoCard icon={Layers3} title="Atlas gráfico real">
          <p>O Tileset Lab e o Workspace reconstruem os metatiles reais a partir de <b>tiles.png</b>, <b>metatiles.bin</b>, atributos e paletas.</p>
          <p className="mt-2 text-muted-foreground">O primary ocupa a faixa base; o secondary é resolvido por layout e pode variar entre cidades, rotas e interiores. O atlas DEMO existe apenas como fallback quando nenhum atlas real foi carregado.</p>
        </InfoCard>

        <section className="rounded-md border border-success/40 bg-success/5 p-4 md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-success">Fluxo recomendado</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            Abra <b>Workspace</b> → escolha a pasta <b>data/</b> do repositório → pesquise o mapa → clique nele. O Studio resolve o layout e os tilesets, valida o tamanho do map.bin e volta ao editor com o mapa visual e os eventos carregados. As importações manuais continuam disponíveis como fallback avançado.
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
