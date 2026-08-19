# Fontes de tiles Gen III

O Arauna Map Studio não usa mais o antigo atlas visual de formas geométricas como substituto de arte de mapa.

## Fonte principal do editor

Para mapas do **Pokémon Juramento de Arauna**, a fonte autoritativa continua sendo o próprio Workspace local do projeto `pokemon-juramento-de-arauna`:

```text
data/tilesets/primary/*/
  tiles.png
  metatiles.bin
  metatile_attributes.bin
  palettes/*.pal

data/tilesets/secondary/*/
  tiles.png
  metatiles.bin
  metatile_attributes.bin
  palettes/*.pal
```

Ao abrir um mapa pelo Workspace, o Studio monta exatamente o par `primary_tileset + secondary_tileset` indicado por `data/layouts/layouts.json`.

## Preview sem Workspace

Quando a aplicação é aberta sem nenhum atlas real salvo, o navegador busca o par original **General + Petalburg** diretamente do decomp público `pret/pokeemerald` e reconstrói os metatiles em runtime. Se a rede falhar, o Studio mostra células não resolvidas; ele não volta a inventar árvores/casas/caminhos com formas procedurais.

## Biblioteca Gen III

A rota `/gen3-library` descobre pares realmente usados nos layouts e renderiza os artefatos originais de:

- `pret/pokeemerald` — Pokémon Emerald;
- `pret/pokeruby` — Pokémon Ruby / Sapphire;
- `pret/pokefirered` — Pokémon FireRed / LeafGreen.

A biblioteca usa os limites corretos de cada família:

| Família | Primary tiles/metatiles | Secondary | Paletas primary | Paletas secondary | Attributes |
|---|---:|---:|---:|---:|---:|
| Emerald | 512 | 512 | 6 | 7 | 2 bytes |
| Ruby/Sapphire | 512 | 512 | 6 | 6 | 2 bytes |
| FireRed/LeafGreen | 640 | 384 | 7 | 6 | 4 bytes |

O navegador baixa os arquivos das fontes no momento em que o usuário abre um par. O repositório do Studio não contém um pacote copiado de PNGs dos jogos.

## Usar os tiles no editor

Pares de **Pokémon Emerald** carregados na Biblioteca Gen III podem ser instalados diretamente como atlas visual ativo do Arauna Map Studio. Assim, o editor deixa de ficar limitado ao par General + Petalburg e pode trabalhar com os demais pares reais de Emerald encontrados nos layouts.

Pares de **Ruby/Sapphire** e **FireRed/LeafGreen** permanecem deliberadamente em modo de referência. Eles não são instalados como IDs do mapa de Arauna porque os espaços de metatiles, paletas e atributos não são equivalentes ao pokeemerald.

## Regra de compatibilidade

Arauna é um projeto baseado em Emerald. Portanto, um metatile encontrado na Biblioteca de FireRed/LeafGreen ou Ruby/Sapphire é uma **referência visual/técnica**, não um ID que possa ser colado cegamente em `map.bin`.

Antes de usar arte externa em um mapa compilável, ela deve existir em um tileset real do repositório Arauna (ou ser portada para ele). Isso evita o erro clássico de o mesmo número de metatile significar gráficos diferentes em dois tilesets.

## Próxima camada opcional

`hypercutter` é uma alternativa para uma futura importação local de ROM: ele expõe biblioteca/CLI/WebAssembly e consegue extrair tilesets, metatiles e paletas de Emerald, FireRed, LeafGreen, Ruby e Sapphire. Isso permitiria selecionar uma ROM legalmente obtida no próprio navegador e montar a biblioteca sem hospedar conteúdo derivado dentro do Arauna Map Studio.
