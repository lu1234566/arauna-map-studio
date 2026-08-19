# Blueprint Generator

O Blueprint Generator é a camada procedural do Arauna Map Studio. Ele foi criado para trazer a praticidade de um gerador de mapas sem quebrar o contrato técnico do Pokémon Emerald/GBA.

## Princípio

O gerador **não cria pixels, metatile IDs ou colisões por adivinhação**.

Ele usa somente dois vocabulários já verificados pelo usuário:

1. **Biblioteca de Padrões** — casas, praças, lagos, grupos de árvores, pontes, portões e outras estruturas salvas do mapa real;
2. **Smart Paths** — estradas, rios, cercas e outras famílias conectáveis com os 16 masks NESW configurados explicitamente.

O resultado do gerador é um `MapTemplate` declarativo. Esse template pode ser salvo e aplicado no Editor com o mesmo sistema de proteção, scope de tileset e Undo usado pelas ferramentas manuais.

## Fluxo

1. No Editor, abra o Workspace e carregue o mapa/tileset real.
2. Monte e aprove estruturas usando metatiles reais.
3. Salve essas estruturas na **Biblioteca de Padrões**.
4. Configure um **Smart Path** para a estrada ou conexão desejada.
5. Abra **Blueprint Generator** pelo botão no canvas do Editor.
6. Escolha:
   - largura/altura;
   - seed;
   - peça central;
   - marcos obrigatórios;
   - peças de preenchimento;
   - quantidade de fillers;
   - Smart Path de estrada;
   - saídas norte/leste/sul/oeste;
   - margem e espaçamento mínimo.
7. Clique em **Gerar blueprint**.
8. Confira a prévia.
9. Use **Salvar como Template**.
10. Volte ao Editor, pressione `T` e clique onde a composição deve começar.

## Determinismo

A mesma combinação de:

```text
seed + dimensões + padrões + regras
```

produz o mesmo arranjo de estruturas e rotas.

Isso permite repetir uma geração aprovada, comparar seeds e futuramente registrar presets de geração por área de Arauna.

## Posicionamento

A peça central, quando selecionada, é centralizada primeiro. Marcos são distribuídos ao redor do centro e fillers ocupam espaços restantes.

Antes de aceitar uma posição, o gerador valida:

- limites do template;
- margem externa;
- largura/altura real do Pattern;
- espaçamento mínimo;
- interseção com estruturas já posicionadas.

Se não existir espaço seguro, o elemento é omitido com aviso em vez de sobrepor estruturas silenciosamente.

## Rotas

Cada Pattern recebe um ponto de conexão padrão na parte inferior central de seu retângulo. Marcos são ligados ao hub central e as saídas selecionadas são ligadas ao mesmo hub.

As rotas usam busca em grade sobre metatiles. Retângulos ocupados por Patterns são tratados como obstáculos; outras estradas podem se cruzar e se conectar normalmente.

A rota final é comprimida em waypoints ortogonais e enviada ao Smart Path. Portanto o caminho continua sendo constituído exclusivamente pelos metatiles do preset aprovado.

## Scope de tileset

Patterns e Smart Paths vinculados a um par `primary + secondary` incompatível bloqueiam a geração.

Quando um atlas real está ativo, o template gerado também recebe esse scope. Isso impede que uma composição criada para um secondary seja aplicada silenciosamente em outro mapa onde os mesmos IDs representam gráficos diferentes.

## Prévia

Com atlas real ativo, o Generator monta o template sobre um mapa temporário vazio e renderiza os metatiles reais do atlas.

Sem atlas real, ele mostra uma prévia esquemática das estruturas e conexões. A prévia esquemática é apenas visualização de layout; o template continua dependendo das peças verificadas.

## Contrato para uma futura camada de IA

A camada procedural separa intenção de implementação:

```text
"vila rural com praça central, laboratório ao sul e duas saídas"
                         ↓
BlueprintSpec
                         ↓
Pattern IDs verificados + Smart Path verificado
                         ↓
MapTemplate
                         ↓
map.bin / map.json pelo editor existente
```

Uma futura IA poderá escolher parâmetros e papéis sem precisar manipular pixels nem inventar IDs do Emerald.

A regra de segurança continua a mesma: **se uma peça necessária não existe na biblioteca verificada, a geração deve falhar ou avisar — nunca inventar um metatile.**
