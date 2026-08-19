import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Binary,
  Braces,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Layers3,
  Maximize2,
  ShieldCheck,
} from "lucide-react";

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
          <p className="text-[10px] text-muted-foreground">
            Referência curta usada pelo Arauna Map Studio
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-5 md:grid-cols-2">
        <InfoCard icon={HardDrive} title="Dimensões reais">
          <p>
            As dimensões vêm de <b>data/layouts/layouts.json</b>. O Studio não fica
            limitado a 20×20.
          </p>
          <p className="mt-2 text-muted-foreground">
            Ao redimensionar, o Studio altera em conjunto a dimensão declarada e o
            tamanho real do map.bin.
          </p>
        </InfoCard>

        <InfoCard icon={Binary} title="map.bin">
          <p>
            Cada célula ocupa <b>2 bytes</b>, lidos e escritos como{" "}
            <b>uint16 little-endian</b>.
          </p>
          <p className="mt-2 font-mono text-xs text-primary">
            tamanho = width × height × 2
          </p>
          <p className="mt-1 text-muted-foreground">
            Metatile, colisão e elevação são editáveis e usam um histórico único de
            undo/redo.
          </p>
        </InfoCard>

        <InfoCard icon={Layers3} title="Separação dos bits">
          <div className="space-y-1 font-mono text-xs">
            <p>metatileId = raw &amp; 0x03FF</p>
            <p>collision = (raw &amp; 0x0C00) &gt;&gt; 10</p>
            <p>elevation = (raw &amp; 0xF000) &gt;&gt; 12</p>
            <p>raw = physicalBits | metatileId</p>
          </div>
          <p className="mt-3 text-muted-foreground">
            Cada camada física altera somente a própria máscara e preserva os demais
            bits.
          </p>
        </InfoCard>

        <InfoCard icon={Braces} title="map.json editável">
          <p>
            <b>data/maps/.../map.json</b> guarda o mapa lógico: warps, object
            events/NPCs, coord events, BG events e conexões.
          </p>
          <p className="mt-2 text-muted-foreground">
            Warps, NPCs, triggers e BG events podem ser selecionados, arrastados,
            criados, removidos e editados no inspetor. Campos desconhecidos são
            preservados.
          </p>
        </InfoCard>

        <InfoCard icon={ShieldCheck} title="Proteção de progressão">
          <p>
            O editor deriva automaticamente células protegidas de <b>warps, coord events
            e BG events</b>.
          </p>
          <p className="mt-2 text-muted-foreground">
            A proteção bloqueia pintura nessas células. Um resize estrutural também é
            bloqueado se empurrar qualquer evento para fora dos novos limites.
          </p>
        </InfoCard>

        <InfoCard icon={Maximize2} title="Resize estrutural">
          <p>
            A tela <b>Estrutura</b> redimensiona o map.bin usando uma das nove âncoras e
            permite escolher o raw usado nas novas células.
          </p>
          <p className="mt-2 text-muted-foreground">
            Quando a origem do conteúdo muda, as coordenadas de eventos e os offsets de
            conexão do mapa atual acompanham o deslocamento. Conexões recíprocas dos
            mapas vizinhos também são ajustadas; se a simetria não puder ser comprovada,
            a operação é bloqueada em vez de adivinhar.
          </p>
        </InfoCard>

        <InfoCard icon={Grid2X2} title="border.bin">
          <p>
            No projeto Emerald atual, o border do layout é <b>2×2</b>, ou 4 células raw
            no mesmo formato uint16 do map.bin.
          </p>
          <p className="mt-2 text-muted-foreground">
            A tela Estrutura permite editar as quatro células mostrando metatile,
            colisão e elevação decodificados, sem mudar a dimensão do border.
          </p>
        </InfoCard>

        <InfoCard icon={FolderOpen} title="Workspace Arauna">
          <p>
            No Chrome/Chromebook, o caminho recomendado é <b>Abrir pasta R/W</b> e
            selecionar a raiz do repositório ou diretamente <b>data/</b>.
          </p>
          <p className="mt-2 text-muted-foreground">
            O workspace permanece em memória durante a sessão da aba e permite alternar
            entre mapas sem escolher a pasta novamente.
          </p>
        </InfoCard>

        <InfoCard icon={HardDrive} title="Gravação na origem">
          <p>
            <b>Salvar pasta</b> grava os arquivos editados diretamente nos caminhos
            originais do clone local.
          </p>
          <p className="mt-2 text-muted-foreground">
            Alterações estruturais pré-validam os arquivos envolvidos e usam rollback
            dos arquivos já escritos se uma gravação posterior falhar. O modo somente
            leitura continua disponível com downloads.
          </p>
        </InfoCard>

        <InfoCard icon={Layers3} title="Atlas gráfico real">
          <p>
            O Tileset Lab e o Workspace reconstruem os metatiles reais a partir de{" "}
            <b>tiles.png</b>, <b>metatiles.bin</b>, atributos e paletas.
          </p>
          <p className="mt-2 text-muted-foreground">
            O primary ocupa a faixa base; o secondary é resolvido por layout. O atlas
            DEMO existe apenas como fallback.
          </p>
        </InfoCard>

        <section className="rounded-md border border-success/40 bg-success/5 p-4 md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-success">
            Fluxo recomendado
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            Abra <b>Workspace</b> em R/W → escolha um mapa → edite
            Visual/Colisão/Elevação, Eventos ou Config. mapa → use <b>Estrutura</b> quando
            precisar redimensionar/border → valide → <b>Salvar pasta</b>. BIN/JSON
            continuam disponíveis como cópias de fallback.
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
