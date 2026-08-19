# Arauna Map Studio

Editor web especializado para os mapas do decomp **Pokémon Juramento de Arauna**, baseado em `pokeemerald`.

O objetivo é oferecer no Chrome/Chromebook o fluxo de edição que normalmente dependeria do Porymap, trabalhando com os arquivos reais do repositório e preservando as regras do Emerald.

## Estado atual

O Studio já suporta:

- abertura de um Workspace a partir da raiz do repositório ou da pasta `data/`;
- modo somente leitura e modo R/W via File System Access API no Chrome/Chromebook;
- descoberta de mapas e layouts por `data/maps/**/map.json` e `data/layouts/layouts.json`;
- dimensões reais por layout, sem limite fixo de 20×20;
- leitura e escrita de `map.bin` como `uint16` little-endian;
- metatile `0x03FF`, colisão `0x0C00` e elevação `0xF000` editáveis separadamente;
- reconstrução dos metatiles reais de `gTileset_General` + secondary do mapa;
- editor visual com lápis, conta-gotas, bucket fill, seleção, zoom, pan, grid e undo/redo;
- edição de warps, NPCs/object events, coord events e BG events em `map.json`;
- edição das propriedades gerais do mapa e das conexões;
- proteção automática de células críticas de progressão;
- gravação direta de `map.bin` e `map.json` no Workspace R/W;
- redimensionamento estrutural de layouts com 9 âncoras;
- deslocamento de eventos ao redimensionar;
- atualização dos offsets de conexões e das conexões recíprocas em mapas vizinhos;
- atualização de `data/layouts/layouts.json`;
- edição de `border.bin` Emerald 2×2;
- rollback best-effort em gravações estruturais com múltiplos arquivos;
- seleção de regiões com clipboard interno, copiar/recortar/colar e carimbo multi-metatile;
- clipboard por camada ou RAW completo, com rotação e espelhamento;
- **Smart Paths** com 16 máscaras NESW, presets persistentes e pintura por clique/arraste;
- **Biblioteca de Padrões** para salvar casas, praças, lagos, pontes, grupos de árvores e outras regiões aprovadas;
- **Templates de mapa** que combinam padrões reutilizáveis + Smart Paths em composições maiores;
- importação/exportação JSON para Smart Paths, padrões e templates;
- escopo opcional `primary + secondary` para impedir uso acidental em tilesets incompatíveis;
- testes unitários com Vitest para parser, estrutura, workspace, eventos, clipboard, Smart Paths, padrões e templates.

## Fluxo recomendado no Chromebook

1. Abra o Arauna Map Studio no Chrome.
2. Entre em **Workspace**.
3. Use **Abrir pasta R/W** e selecione a raiz local de `pokemon-juramento-de-arauna` ou diretamente `data/`.
4. Escolha um mapa.
5. Edite Visual, Colisão, Elevação ou eventos.
6. Use **Validar**.
7. Use **Salvar pasta** para gravar `map.bin` e/ou `map.json` diretamente.
8. Para mudar dimensões ou `border.bin`, abra **Estrutura**.

O editor não grava na ROM. O alvo é sempre o projeto decomp.

## Clipboard e carimbo multi-metatile

Com a ferramenta de seleção (`M`), marque uma região do mapa. O clipboard interno pode guardar somente a camada ativa ou todos os bits da célula.

Atalhos:

- `Ctrl/Cmd + C`: copiar a camada ativa;
- `Ctrl/Cmd + X`: recortar a camada ativa;
- `Ctrl/Cmd + V`: colar usando a célula/seleção atual como canto superior esquerdo;
- `Ctrl/Cmd + Shift + C`: copiar RAW completo (metatile + colisão + elevação);
- `Ctrl/Cmd + Shift + X`: recortar RAW completo;
- `V`: ativar/desativar o carimbo multi-metatile;
- `Esc`: sair do carimbo ou limpar a seleção;
- `B`: lápis;
- `I`: conta-gotas;
- `G`: bucket fill;
- `M`: seleção;
- `Ctrl/Cmd + Z`: desfazer;
- `Ctrl/Cmd + Shift + Z` ou `Ctrl/Cmd + Y`: refazer;
- `+` / `-`: zoom.

Copiar uma camada preserva as outras propriedades físicas no destino. O modo RAW substitui metatile, colisão e elevação em conjunto. Células protegidas continuam bloqueadas enquanto **Proteger progressão** estiver ligado.

## Smart Paths

Smart Paths é o autotile explícito do Studio. Em vez de tentar adivinhar quais metatiles do Emerald representam uma curva, uma ponta ou uma bifurcação, cada preset define conscientemente os 16 estados possíveis dos quatro vizinhos ortogonais:

```text
N = 1
E = 2
S = 4
W = 8
mask = N | E | S | W
```

Assim, `0` é uma peça isolada, `5` é N+S, `10` é E+W e `15` é um cruzamento completo.

Fluxo:

1. selecione na paleta um metatile que pertença ao caminho;
2. abra **Smart Paths → Configurar → Novo preset**;
3. atribua um metatile a cada um dos 16 masks usando `← atual` enquanto navega pela paleta;
4. escolha um `eraseMetatile` que **não** pertença à família do caminho;
5. ative Smart Paths e desenhe com clique/arraste;
6. o Studio recalcula somente a célula pintada e seus quatro vizinhos.

O modo de apagar só age sobre metatiles pertencentes ao preset, evitando substituir acidentalmente casas, água ou outros elementos por `eraseMetatile`. Colisão e elevação permanecem intactas. Células protegidas de progressão continuam protegidas.

Atalhos:

- `P`: ligar/desligar Smart Paths;
- `E`: alternar **Adicionar / Apagar** quando Smart Paths está ativo;
- `Esc`: sair de Smart Paths;
- `Shift`, `Alt`, botão do meio ou botão direito: mover o canvas durante o modo Smart Path.

## Biblioteca de Padrões

A Biblioteca transforma uma região já aprovada do mapa em uma peça reutilizável. Isso é útil para guardar, por exemplo:

- casas rurais;
- laboratórios;
- praças e fogueiras;
- portões;
- pontes;
- trechos de lago;
- grupos de árvores;
- canteiros e detalhes urbanos.

Um padrão pode guardar apenas **Visual**, apenas **Colisão**, apenas **Elevação** ou **RAW completo**. Padrões Visual preservam colisão/elevação do destino; padrões RAW carregam as três camadas juntas.

Fluxo:

1. selecione uma região (`M`);
2. copie a camada ou RAW (`Ctrl+C` / `Ctrl+Shift+C`);
3. abra **Padrões → Biblioteca**;
4. use **Salvar clipboard**;
5. dê nome, categoria e tags;
6. ative o padrão e carimbe em outras posições.

Atalho: `L` liga/desliga o padrão ativo.

## Templates de mapa

Templates são a camada de composição acima da Biblioteca de Padrões. Eles **não** armazenam screenshots nem convertem uma imagem em mapa. Em vez disso, referenciam peças GBA já verificadas e caminhos Smart Path.

Um template pode dizer, por exemplo:

```text
Vila Rural Arauna 30×24
  Casa_Rural_01        @ 4,4
  Laboratorio_Anahi    @ 18,15
  Praca_Fogueira       @ 10,8
  Grupo_Arvores_03     @ 2,13
  Estrada_Terra        6,20 → 6,10 → 13,10 → 13,5
```

Esse formato é propositalmente declarativo. Ele é a base para uma etapa futura em que um gerador pode transformar uma instrução como “crie uma vila rural com praça central e laboratório ao sul” em uma lista de peças verificadas, em vez de inventar pixels ou IDs de metatile.

Fluxo:

1. crie os padrões reutilizáveis e presets Smart Path necessários;
2. abra **Templates → Compor**;
3. crie um template com largura/altura;
4. adicione o padrão atualmente selecionado com coordenadas relativas;
5. adicione Smart Paths informando waypoints ortogonais no formato `x,y; x,y; x,y`;
6. confira o relatório de dependências;
7. ative Templates e clique no mapa para posicionar a origem da composição.

O template é aplicado como **uma única operação de Undo**. Células protegidas permanecem intactas. Elementos fora dos limites do mapa são ignorados e reportados. Dependências ausentes ou tilesets incompatíveis bloqueiam a aplicação.

Atalho: `T` liga/desliga o template ativo.

## Modos especiais de pintura

Somente um destes modos fica ativo por vez:

```text
V  Carimbo temporário do clipboard
P  Smart Paths
L  Biblioteca de Padrões
T  Templates
```

Ativar um modo entrega o controle dos outros. `Esc` sai do modo ativo.

## Formato Emerald usado

Cada célula de `map.bin` é um `uint16` little-endian:

```text
bits 0–9   0x03FF  metatile ID
bits 10–11 0x0C00  collision
bits 12–15 0xF000  elevation
```

O tamanho esperado do arquivo é:

```text
width × height × 2 bytes
```

O `border.bin` usado pelos layouts atuais do projeto é tratado como uma grade 2×2 com o mesmo formato de célula.

## Desenvolvimento

```sh
npm install
npm run dev
```

Validações locais disponíveis:

```sh
npm test
npm run build
npm run lint
```

Não é necessário GitHub Actions ou Codespaces para desenvolver o Studio.

## Estrutura principal

- `src/lib/emeraldMap.ts` — parser/exportador e máscaras de bits;
- `src/lib/editorStore.ts` — estado e histórico do editor;
- `src/lib/repoWorkspace.ts` — leitura do Workspace Arauna;
- `src/lib/fileSystemWorkspace.ts` — acesso R/W à pasta local;
- `src/lib/layoutStructure.ts` — resize e `border.bin`;
- `src/lib/structuralWorkspace.ts` — alterações estruturais multi-arquivo;
- `src/lib/mapClipboard.ts` — captura e transformações de regiões;
- `src/lib/clipboardStore.ts` — copiar/recortar/colar e carimbo;
- `src/lib/smartPath.ts` — masks NESW, validação e planejamento do autotile;
- `src/lib/smartPathStore.ts` — presets persistentes e aplicação no editor;
- `src/lib/patternLibrary.ts` — formato e serialização de padrões reutilizáveis;
- `src/lib/patternLibraryStore.ts` — persistência e aplicação dos padrões;
- `src/lib/mapTemplate.ts` — formato declarativo, dependências e planejamento de templates;
- `src/lib/mapTemplateStore.ts` — biblioteca persistente e aplicação agrupada de templates;
- `src/components/studio/MapCanvas.tsx` — canvas principal;
- `src/components/studio/StampOverlay.tsx` — carimbo multi-metatile;
- `src/components/studio/SmartPathOverlay.tsx` — pincel Smart Path;
- `src/components/studio/SmartPathDock.tsx` — editor dos 16 masks;
- `src/components/studio/PatternLibraryDock.tsx` — biblioteca de estruturas reutilizáveis;
- `src/components/studio/MapTemplateDock.tsx` — compositor de templates;
- `src/components/studio/MapTemplateOverlay.tsx` — posicionamento visual dos templates;
- `src/routes/workspace.tsx` — seletor de mapas;
- `src/routes/structure.tsx` — edição estrutural;
- `src/routes/map-settings.tsx` — propriedades e conexões.

## Origem

O primeiro protótipo do projeto foi criado no Lovable e depois passou a ser desenvolvido diretamente pelo GitHub para não depender de créditos do ambiente. O código e o fluxo atual são específicos para o Juramento de Arauna.
