# Porto do Sal — teste de geração IA em mapa real

Este fluxo testa o gerador sobre o `SlateportCity` real do decomp, sem placeholders geométricos e sem trocar IDs internos de progressão.

## Fluxo recomendado

1. Abra **Workspace** em modo R/W e selecione `SlateportCity`.
2. Confirme no editor:
   - dimensão `40×60`;
   - `map.json ativo`;
   - atlas `gTileset_General + gTileset_Slateport`;
   - proteção de progressão ligada.
3. Abra **Construir com IA**.
4. Aguarde o bootstrap automático do vocabulário do mapa.
5. Cole o prompt de Porto do Sal e use **Gerar com IA**.
6. Revise o JSON/avisos e use **Aplicar cidade no mapa** somente quando o plano estiver compilável.
7. Execute **Validar** antes de salvar.
8. Use **Salvar pasta** para gravar `map.bin`/`map.json` no Workspace somente depois da revisão visual.

## O que o Studio deriva automaticamente

Ao abrir um mapa real com `map.json`, o Studio cria vocabulário compatível com o tileset ativo:

- fachadas RAW extraídas dos warps reais, incluindo Centro Pokémon, Mart, Estaleiro, Tenda de Batalha, Clube de Fãs, Museu, Casa do Avaliador, Harbor e residências quando presentes;
- duas escalas de fachada quando a região pode ser recortada com segurança;
- `warp-anchor:X,Y` para manter cada entrada sobre seu warp existente;
- Mercado aberto real, derivado do cluster de vendedores, preso à origem por `fixed-origin:X,Y`;
- trechos RAW costeiros, urbanos e verdes extraídos do próprio `map.bin`;
- Smart Path de acesso urbano amostrado dos pisos abaixo das portas reais;
- até três caminhos caminháveis adicionais derivados de metatiles frequentes;
- Smart Path de costa/água quando o mapa contém variedade topológica suficiente para inferir máscaras NESW reais.

A quantidade exata varia por mapa e por deduplicação. Em `SlateportCity`, o esperado é sair muito acima do antigo estado de `3 Patterns / 0 Smart Paths`, normalmente com dezenas de Patterns compatíveis e múltiplos Smart Paths.

## Segurança para mapa de campanha

- A IA recebe warps, triggers e áreas de movimento dos NPCs como células reservadas.
- Patterns derivados de warp são reposicionados deterministicamente pelo compilador para manter a porta no evento original, mesmo que o modelo devolva outra coordenada.
- Patterns de conjuntos ligados a NPCs, como o mercado, têm origem fixa.
- Antes de aplicar, um preflight local bloqueia construções que cobririam eventos reais fora de sua região original.
- Warps novos só são criados quando o prompt informa explicitamente `destMap` e `destWarpId`.
- Conexões novas só são aceitas quando o mapa de destino aparece explicitamente no prompt.
- O mapa original continua sendo a base; áreas não tocadas pelo plano permanecem intactas.

## Importação manual BIN + JSON

Para testes sem Workspace:

1. importe o `map.bin`;
2. informe a dimensão correta;
3. importe o `map.json` correspondente.

O Studio usa o `layout` do JSON para selecionar automaticamente o secondary canônico do Emerald. Para `LAYOUT_SLATEPORT_CITY`, o fallback passa para `gTileset_General + gTileset_Slateport`.

Esse fallback baixa os gráficos autênticos do `pret/pokeemerald`; ele serve para arquivos avulsos. Para assets customizados do Juramento de Arauna, **Workspace é sempre a fonte preferencial e exata**.
