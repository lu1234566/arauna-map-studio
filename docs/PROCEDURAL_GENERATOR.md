# Procedural Blueprint Generator

O gerador procedural adiciona uma camada automática acima do contrato `arauna-map-blueprint-v1` já usado pelo painel **Blueprint IA**.

A cadeia completa é:

```text
Seed + regras de composição
        ↓
ProceduralBlueprintSpec
        ↓
Patterns verificados + Smart Paths verificados
        ↓
MapBlueprint (arauna-map-blueprint-v1)
        ↓
compileMapBlueprint
        ↓
MapTemplate
        ↓
Editor → map.bin / map.json
```

## O que ele não faz

O gerador não transforma screenshots em mapa, não inventa metatile IDs, não cria colisões por inferência e não desenha estruturas que não existam na Biblioteca.

Se um recurso necessário não existe ou pertence a outro tileset, a geração falha fechada.

## Como usar

1. Abra o Workspace com o tileset real.
2. Monte e aprove estruturas no Editor.
3. Salve casas, praças, vegetação, lagos, portões etc. na **Biblioteca de Padrões**.
4. Configure ao menos um **Smart Path** para estradas/conexões.
5. Abra **Gerador procedural** pelo botão inferior do canvas.
6. Escolha:
   - largura e altura;
   - seed;
   - peça central;
   - marcos obrigatórios;
   - peças de preenchimento;
   - quantidade de fillers;
   - Smart Path de estrada;
   - saídas norte/leste/sul/oeste;
   - margem externa;
   - espaçamento mínimo entre estruturas.
7. Clique em **Gerar**.
8. Confira a prévia.
9. Opcionalmente copie o **Blueprint JSON** para inspecionar/reutilizar no painel Blueprint IA.
10. Use **Salvar como Template** e aplique no Editor com `T`.

## Determinismo por seed

A mesma combinação de seed, dimensões e vocabulário produz o mesmo arranjo de estruturas e as mesmas rotas.

Isso permite comparar seeds e registrar layouts aprovados sem perder reprodutibilidade.

## Posicionamento

A peça central é centralizada primeiro. Marcos são distribuídos ao redor do centro. Fillers ocupam posições restantes.

Antes de aceitar uma posição, o gerador verifica:

- limites do mapa;
- margem;
- dimensões reais do Pattern;
- espaçamento mínimo;
- interseção com estruturas já posicionadas.

Quando o espaço acaba, o gerador avisa e omite o restante em vez de sobrepor estruturas silenciosamente.

## Rotas

Cada estrutura recebe um ponto de conexão padrão abaixo de seu centro. Marcos são ligados ao hub central e as saídas selecionadas são ligadas ao mesmo hub.

As rotas usam busca em grade por metatiles, tratando os retângulos ocupados pelos Patterns como obstáculos. O caminho encontrado é comprimido em segmentos ortogonais e convertido para uma Route do blueprint existente.

O compilador normal de blueprint então resolve o Smart Path por ID e cria o `MapTemplate` final.

## Tilesets

Patterns e Smart Paths com `scope` incompatível com o atlas atual bloqueiam a geração. Quando há atlas real ativo e o template compilado ainda não possui um scope global, o gerador vincula o resultado ao atlas atual como proteção adicional.

## Prévia

Com atlas real carregado, o Generator aplica o Template em um mapa temporário vazio e renderiza os metatiles reais do atlas.

Sem atlas real, apresenta uma prévia esquemática das posições e rotas. Essa visualização não altera o contrato de dados: o resultado continua referenciando apenas recursos cadastrados.

## Relação com IA

O painel **Blueprint IA** e o gerador procedural convergem no mesmo formato intermediário.

Assim, dois fluxos diferentes terminam no mesmo compilador seguro:

```text
Humano ajustando seed/regras ─┐
                              ├─→ MapBlueprint → MapTemplate
IA respondendo ao contrato ───┘
```

Isso evita manter dois formatos incompatíveis e cria a base para comandos naturais como “faça uma vila rural com praça central, laboratório ao sul e duas saídas”, sem dar à IA liberdade para inventar dados de GBA.
