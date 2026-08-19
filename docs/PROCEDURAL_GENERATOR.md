# Procedural Blueprint Generator

O gerador procedural adiciona uma camada automática acima do contrato `arauna-map-blueprint-v1` já usado pelo painel **Blueprint IA**.

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

## Regra principal

O gerador não converte screenshots em mapa, não inventa metatile IDs e não cria colisões por inferência. Se um recurso necessário não existe ou pertence a outro tileset, a geração é bloqueada.

## Fluxo

1. Abra o Workspace com o tileset real.
2. Monte e aprove estruturas no Editor.
3. Salve casas, praças, vegetação, lagos, portões etc. na **Biblioteca de Padrões**.
4. Configure um **Smart Path** para estradas/conexões.
5. Abra **Gerador procedural** pelo botão inferior do canvas.
6. Escolha dimensões, seed, peça central, marcos, fillers, estrada, saídas, margem e espaçamento.
7. Clique em **Gerar** para testar a seed atual, ou use **Melhor de N** para comparar várias seeds automaticamente.
8. Confira a prévia e, quando houver uma galeria, clique em qualquer candidato para alternar entre as versões.
9. Opcionalmente copie o **Blueprint JSON** — ele é compatível com o painel Blueprint IA.
10. Use **Salvar como Template** e aplique no Editor com `T`.

## Determinismo

A mesma combinação de seed, dimensões e vocabulário produz o mesmo arranjo de estruturas e as mesmas rotas. Isso permite comparar seeds e registrar layouts aprovados.

## Melhor de N seeds

O Generator pode avaliar 4, 8, 12, 16 ou 24 seeds de uma vez. A seed digitada é sempre o primeiro candidato; as demais recebem sufixos determinísticos (`-02`, `-03`, ...). Assim, repetir a comparação gera exatamente a mesma galeria enquanto as regras não mudarem.

Cada candidato recebe uma nota de 0 a 100:

```text
30  cobertura dos marcos obrigatórios
20  cobertura dos fillers solicitados
20  cobertura das saídas solicitadas
20  conexões dos marcos com o hub
10  execução limpa, sem avisos
```

Avisos reduzem a parcela de execução limpa. Layouts inválidos recebem zero. A galeria é ordenada por nota, depois por menor quantidade de avisos e, por fim, pela ordem determinística da seed.

O melhor candidato é aberto automaticamente, mas todas as variantes continuam visíveis e podem ser selecionadas manualmente. A pontuação é um auxílio de produtividade, não substitui a revisão visual do mapa.

## Posicionamento

A peça central é centralizada primeiro. Marcos são distribuídos ao redor do centro. Fillers ocupam espaços restantes.

Antes de aceitar uma posição, o gerador verifica limites, margem, dimensões reais do Pattern, espaçamento mínimo e interseção com estruturas já posicionadas. Quando o espaço acaba, ele avisa e omite o restante em vez de sobrepor estruturas silenciosamente.

## Rotas

Cada estrutura recebe um ponto de conexão padrão abaixo de seu centro. Marcos são ligados ao hub central e as saídas selecionadas são ligadas ao mesmo hub.

As rotas usam busca em grade por metatiles, tratando retângulos ocupados por Patterns como obstáculos. O caminho encontrado é comprimido em waypoints ortogonais e convertido para uma Route do blueprint existente.

Há uma segunda barreira de segurança antes da compilação: se uma rota atravessar qualquer célula interna de um Pattern salvo, ela é removida do Blueprint final. Assim, mesmo um fallback do roteador nunca recebe permissão para pintar uma estrada sobre uma casa, laboratório ou outra estrutura.

## Tilesets

Patterns e Smart Paths com `scope` incompatível com o atlas atual bloqueiam a geração. Quando há atlas real ativo e o template compilado ainda não possui um scope global, o gerador vincula o resultado ao atlas atual como proteção adicional.

## Prévia

Com atlas real carregado, o Generator aplica o Template em um mapa temporário vazio e renderiza os metatiles reais do atlas. Sem atlas, apresenta uma prévia esquemática das posições e rotas.

## Relação com IA

O painel **Blueprint IA** e o gerador procedural convergem no mesmo formato intermediário:

```text
Humano ajustando seed/regras ─┐
                              ├─→ MapBlueprint → MapTemplate
IA respondendo ao contrato ───┘
```

Isso evita dois formatos incompatíveis e prepara comandos como “faça uma vila rural com praça central, laboratório ao sul e duas saídas” sem dar à IA liberdade para inventar dados de GBA.
