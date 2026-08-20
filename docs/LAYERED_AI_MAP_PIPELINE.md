# Arauna Map Studio — geração por camadas

O modo por camadas é ativado quando o prompt descreve `CAMADA` e contém pelo menos uma zona com ranges `x=..` e `y=..`. Para mapas reais, inclua também um verbo de remodelagem/reconstrução enquanto a UI de detecção é migrada para o novo parser.

## Ordem determinística

1. **Ground / zonas base** — cria uma occupancy map interna; células começam como `UNSET` e o mapa real funciona apenas como backing store seguro.
2. **Structures** — Patterns de prédios e regiões `warp-anchor` / `fixed-origin` recebem prioridade sobre o solo.
3. **Road** — corredores definidos por range recebem prioridade sobre ground; Smart Paths desenhados pelo Template continuam com prioridade sobre o material de fundo.
4. **Detail** — trechos contextuais só sobrevivem quando combinam com a zona (`green` em verde, `urban` em urbano, `coast/port` em portuário).
5. **Overlay / finish** — reimpõe o material exato da zona onde nenhum elemento de maior prioridade existe. Layering legítimo dentro de estruturas/detalhes é preservado.

Prioridade: `reserved > structure > road > detail > ground > unset`.

## Materiais reconhecidos

- `concreto`, `pavimento`, `urbano`, `calçada`, `asfalto`, `residencial` → piso urbano real derivado do tileset/mapa.
- `grama`, `verde`, `vegetação`, `jardim`, `parque` → piso verde real.
- `bege`, `areia`, `portuário`, `porto`, `cais`, `promenade`, `doca` → piso portuário real.
- `base`, `neutro`, `comum` → piso-base real.
- `água`, `costa`, `litoral`, `preservar`, `manter` → preserva o material atual.
- `metatile 0x123` ou `tile 291` → ID explícito, aceito somente se existir no atlas ativo, tiver behavior NORMAL e Layer Type 0.

## Regras de ranges

Ranges são inclusivos:

```text
zona central: x=8..23, y=0..59 -> concreto urbano
```

Zonas ground de materiais diferentes não podem se sobrepor. Uma zona `preservar/água/costa` pode ser sobreposta por uma zona material posterior. Corredores de rua podem atravessar zonas ground, pois pertencem a uma camada superior.

Se o prompt disser `preencher 100% do mapa`, o preflight bloqueia a aplicação quando restarem células editáveis `UNSET`.

## Prompt de teste — Porto do Sal 40×60

Este exemplo evita sobreposição entre zonas de solo e deixa a faixa costeira sob preservação. Estruturas reais continuam presas aos seus anchors/fixed-origin.

```text
RECONSTRUA PORTO DO SAL EM CAMADAS SOBRE O SLATEPORTCITY REAL 40x60.

CAMADA 1 — ZONAS BASE
- faixa verde oeste: x=0..7, y=0..59 -> grama urbana
- eixo urbano central: x=8..23, y=0..59 -> concreto urbano
- nordeste urbano: x=24..30, y=0..17 -> concreto urbano
- zona portuária: x=24..30, y=18..45 -> piso portuário bege
- sudeste urbano: x=24..30, y=46..59 -> concreto urbano
- costa leste protegida: x=31..39, y=0..59 -> preservar água/costa

CAMADA 2 — ESTRUTURAS FIXAS
- mantenha Centro Pokémon, Poké Mart, Museu Oceanográfico, Estaleiro, Tenda de Batalha, Clube de Fãs, Avaliador de Nomes, Harbor/Terminal, residências e Mercado do Sal em seus warp-anchor/fixed-origin reais.
- não invente prédios para preencher espaço.

CAMADA 3 — RUAS
- avenida norte-sul principal em x=18..20, y=0..50 -> concreto urbano
- rua comercial central em x=6..30, y=26..28 -> concreto urbano
- eixo porto-centro em x=17..28, y=34..36 -> piso portuário bege
- use os Smart Paths reais para ligar as portas aos corredores acima sem criar diagonais.

CAMADA 4 — PRAÇAS E APROXIMAÇÕES
- mantenha acesso livre e pavimentado diante das portas reais.
- não cubra warps, triggers ou áreas necessárias de NPCs.

CAMADA 5 — DETALHES / FINISH
- vegetação e trechos verdes somente dentro da zona verde.
- detalhes urbanos somente dentro das zonas urbanas ou corredores de rua.
- detalhes de cais/costa somente dentro da zona portuária.
- preserve overlays legítimos que façam parte de prédios ou detalhes válidos.
- remova qualquer fragmento contextual que caia fora da zona correspondente.
- não misture materiais fora de sua zona.

REGRAS
- não mover nem inventar warps/conexões.
- não sobrepor estruturas.
- não transformar água/costa protegida em solo.
- structures/roads/details/overlays têm prioridade sobre o solo, mas details nunca podem substituir structures ou roads.
- células não definidas por uma camada permanecem UNSET internamente e não são escritas no BIN.
- use apenas Patterns e Smart Paths reais do tileset ativo.
```

## Por que UNSET não vira preto no jogo

`UNSET` é um estado lógico interno. Enquanto a composição por camadas ainda não atribuiu material a uma célula, o compilador mantém o valor real do mapa como backing store. Portanto nunca exportamos um "buraco preto" ou um metatile inventado. Se cobertura total for exigida, o preflight obriga o prompt a atribuir todas as células editáveis antes da aplicação.
