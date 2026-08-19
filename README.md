# Arauna Map Studio

Crie um novo app web chamado “Arauna Map Studio”, uma ferramenta online específica para editar mapas do projeto decomp Pokémon Emerald “Pokémon Juramento de Arauna”. O objetivo é substituir a necessidade de instalar Porymap no Chromebook do usuário.

FASE 1 / MVP: construa um editor visual funcional, não apenas um mockup.

Contexto técnico real do jogo:
- Base: pokeemerald decomp.
- Primeiro mapa de teste: LittlerootTown / Vila Amanhecer.
- Dimensão inicial: 20x20 metatiles.
- map.bin usa 400 valores uint16 little-endian = 800 bytes.
- Cada célula usa bits de metatile + colisão/elevação; máscara de metatile 0x03FF e máscara física 0xFC00.
- O editor deve conseguir importar um map.bin local, editar somente a parte de metatile quando estiver no modo visual e exportar novamente um map.bin válido preservando os bits físicos.
- Não invente integração com ROM; o alvo é o repositório decomp.

Requisitos do MVP:
1. Interface desktop-first otimizada para Chrome/Chromebook, responsiva o suficiente para telas 1366x768.
2. Layout de editor profissional: barra superior, painel de metatiles à esquerda, canvas central, propriedades à direita, status bar inferior.
3. Canvas de mapa 20x20 com zoom, pan, grid opcional e coordenadas visíveis.
4. Ferramentas: lápis, picker/conta-gotas, bucket fill, seleção retangular simples, undo e redo.
5. Um “Atlas de demonstração” temporário com metatiles placeholder visualmente inspirados em GBA/Emerald, claramente marcados como DEMO. Não use assets Pokémon oficiais copiados de terceiros. O atlas real será conectado depois a arquivos gerados do nosso repo.
6. Cada metatile demo precisa ter id numérico e categoria: Natureza, Caminhos, Construções, Água, Decoração.
7. Modos de visualização na UI: Visual, Colisão, Elevação, Warps, NPCs, Triggers. Nesta primeira versão, apenas Visual precisa editar; os outros podem mostrar overlays/dados demo, mas a arquitetura deve estar preparada para edição posterior.
8. Importação de map.bin pelo navegador com File API/ArrayBuffer/DataView.
9. Parser TypeScript robusto para uint16 little-endian. Para um arquivo 20x20, validar exatamente 800 bytes. Ao importar, preencher o grid usando value & 0x03FF e guardar value & 0xFC00 separadamente.
10. Ao pintar em modo Visual, atualizar somente o metatile ID e preservar collision/elevation bits daquela célula.
11. Exportar map.bin reconstruindo (physicalBits | metatileId), uint16 little-endian.
12. Botão “Novo mapa 20x20” para testar sem arquivo.
13. Botão “Validar” que verifica: 400 células, IDs <= 0x03FF, valores uint16 válidos e tamanho final 800 bytes; mostrar relatório em modal/painel.
14. Mostrar no inspetor da célula selecionada: X, Y, metatile ID, valor bruto hex, bits físicos hex.
15. Proteção futura: adicione um modelo de dados para protectedCells e mostre no mapa cadeados em coordenadas demo como (5,8), (14,8), (7,16), (10,1), (11,1). No MVP, impedir alteração VISUAL dessas células apenas quando um toggle “Proteger progressão” estiver ligado.
16. Persistência local automática no localStorage para o projeto demo e preferências de UI.
17. Atalhos úteis: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, B lápis, I picker, G fill, +/- zoom.
18. Não usar backend, banco, autenticação ou IA ainda. Tudo deve funcionar client-side.
19. Adicione uma tela/aba “Sobre o formato” explicando de forma curta: 20x20, 800 bytes, uint16 little-endian, metatile mask 0x03FF, physical mask 0xFC00.
20. Adicione testes unitários para parser/exportador e flood fill se o setup suportar Vitest facilmente.

Direção visual:
- Ferramenta séria de level design, não landing page.
- Tema escuro neutro inspirado em ferramentas de desenvolvimento, com acentos verdes naturais discretos.
- Canvas e tiles pixel-perfect (image-rendering: pixelated).
- Não faça hero banner, cards de marketing ou conteúdo promocional.
- Priorize densidade de informação, clareza e uso real.

Arquitetura sugerida:
- React + TypeScript + Vite.
- Componentes separados para TopToolbar, TilePalette, MapCanvas, Inspector, StatusBar, ValidationPanel.
- Módulo lib/emeraldMap.ts para parse/export/bit masks.
- Estado central simples (Zustand se fizer sentido).
- Evite dependências pesadas; Canvas 2D pode ser usado para o mapa.

Aceitação da primeira entrega:
- Eu consigo abrir o preview, criar mapa 20x20, selecionar um metatile demo e pintar várias células.
- Undo/redo funciona.
- Importar um arquivo binário de 800 bytes funciona.
- Exportar gera 800 bytes.
- Pintar preserva physical bits.
- Proteger progressão bloqueia as células demo marcadas.
- Validação mostra PASS/FAIL com motivos.

Implemente diretamente. Quando terminar, liste brevemente o que está funcional e qualquer limitação real do MVP.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://arauna-map-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/377c10fd-30f6-45b1-9ad2-881b6bc41a72).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
