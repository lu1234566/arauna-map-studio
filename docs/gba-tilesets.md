# Biblioteca real de tilesets GBA

O Arauna Map Studio não usa mais um atlas procedural para simular o visual de Pokémon. A camada visual normal é composta a partir dos arquivos de tileset dos projetos de decompilação Gen III mantidos em `pret`.

## Fontes

| Família no editor | Fonte técnica | Uso em Arauna |
| --- | --- | --- |
| Emerald | `pret/pokeemerald` | **Nativo / editável** |
| Ruby / Sapphire | `pret/pokeruby` | Referência visual |
| FireRed / LeafGreen | `pret/pokefirered` | Referência visual |

O editor lê, para cada par primary + secondary usado por um layout real:

- `tiles.png` — tiles indexados 8×8;
- `metatiles.bin` — 8 entradas de tile por metatile 16×16 (duas camadas);
- `metatile_attributes.bin` — behavior e layer type;
- `palettes/*.pal` — paletas JASC de 16 cores;
- `data/layouts/layouts.json` — associação real de layouts com seus dois tilesets.

Não são usados sprite sheets aleatórios, tiles recriados por IA ou formas Canvas como substitutos da arte do jogo.

## Carregamento

A lista de pares é derivada diretamente de `data/layouts/layouts.json` de cada família. Ao escolher um pack, o navegador baixa somente os arquivos necessários daquele primary e secondary e monta o atlas 16×16 localmente.

Isso evita manter centenas de cópias de PNGs no repositório do editor e preserva uma cadeia de origem verificável. O navegador pode reutilizar seu cache HTTP em acessos posteriores.

O pack padrão é:

`Pokémon Emerald · gTileset_General + gTileset_Petalburg`

Esse é o par esperado para o snapshot de Littleroot/Vila Amanhecer usado como mapa inicial do Arauna Map Studio.

## Diferenças de formato que o editor respeita

### Emerald

- limite/offset de tiles primary: 512;
- limite/offset de metatiles primary: 512;
- 6 paletas primary;
- 13 paletas totais;
- atributos lidos em palavras de 16 bits.

### Ruby / Sapphire

- limite/offset de tiles primary: 512;
- limite/offset de metatiles primary: 512;
- 6 paletas primary;
- 12 paletas totais;
- atributos lidos em palavras de 16 bits.

### FireRed / LeafGreen

- limite/offset de tiles primary: 640;
- limite/offset de metatiles primary: 640;
- 7 paletas primary;
- 13 paletas totais;
- atributos lidos em palavras de 32 bits; behavior usa os 9 bits baixos e layer type os bits 29–30.

Por isso as três famílias **não são achatadas em um único espaço de IDs**.

## Compatibilidade com Juramento de Arauna

Juramento de Arauna é pokeemerald-native. Somente packs Emerald podem ser usados como fonte direta de metatile IDs para pintura do `map.bin`.

Ruby/Sapphire e FireRed/LeafGreen aparecem para pesquisa visual e comparação, mas a paleta de metatiles e o canvas bloqueiam pintura visual quando uma dessas famílias está ativa. Uma futura conversão de assets deve criar/inserir um tileset Emerald explícito em vez de fingir que IDs externos são equivalentes.

## Falhas de rede ou assets ausentes

O comportamento é fail-closed:

- durante o carregamento aparece um estado de loading;
- se um metatile não existe no atlas ativo, o canvas mostra somente um marcador neutro de asset ausente;
- o editor nunca desenha grama, árvore, água, telhado ou cerca procedurais para fazer um asset ausente parecer válido.

## Gerador offline opcional

`scripts/sync_gba_tilesets.py` oferece uma rota alternativa para vendorizar atlases estáticos. Ele clona os três repos, resolve os pares usados por layouts e gera PNGs/manifesto determinísticos. O runtime normal não depende desse script nem de GitHub Actions.
