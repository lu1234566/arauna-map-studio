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
- testes unitários com Vitest para parser, estrutura, workspace, eventos e clipboard.

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
- `src/components/studio/MapCanvas.tsx` — canvas principal;
- `src/components/studio/StampOverlay.tsx` — carimbo multi-metatile;
- `src/routes/workspace.tsx` — seletor de mapas;
- `src/routes/structure.tsx` — edição estrutural;
- `src/routes/map-settings.tsx` — propriedades e conexões.

## Origem

O primeiro protótipo do projeto foi criado no Lovable e depois passou a ser desenvolvido diretamente pelo GitHub para não depender de créditos do ambiente. O código e o fluxo atual são específicos para o Juramento de Arauna.
