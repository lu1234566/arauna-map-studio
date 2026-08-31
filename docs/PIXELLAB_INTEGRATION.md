# Integração PixelLab AI (Concept visual)

O PixelLab gera **referências visuais (concepts)** de mapas. A imagem gerada
**nunca** é convertida automaticamente em metatiles e **nunca** escreve em
`map.bin`/`map.json`. Ela serve apenas como overlay/preview para o usuário
decidir como usar. O compilador GBA/metatiles atual permanece intocado.

## Arquitetura

| Camada | Arquivo | Papel |
| --- | --- | --- |
| Helpers puros (client-safe) | `src/lib/pixellab.ts` | Limites Tier 1, presets regionais, `buildPixfluxPayload`, sanitização de respostas (`sanitizeJobResponse`, `friendlyHttpError`) — sem token. |
| Server functions | `src/lib/pixellab.functions.ts` | `getPixelLabStatus`, `startPixelLabMapGeneration`, `getPixelLabJob` (TanStack `createServerFn`). Único lugar que lê `process.env.PIXELLAB_API_TOKEN`. |
| UI (dock) | `src/components/studio/PixelLabDock.tsx` | Painel “PixelLab AI” no editor principal: prompt, presets, Init Image do mapa atual, polling ~5 s, overlay com opacidade. |

## Secret obrigatório

- Nome: **`PIXELLAB_API_TOKEN`**
- Onde: Secrets seguros do projeto Lovable (Project Settings → Secrets).
- O token existe **somente no servidor** (`process.env`, lido dentro dos
  handlers). Nunca vai ao browser, localStorage, código ou Git. Erros são
  sanitizados e jamais incluem headers de autenticação.

## Endpoints usados

- `GET /balance` — teste de credencial/conexão (status sanitizado).
- `POST /create-image-pixflux-background` — inicia job assíncrono Pixflux.
- `GET /background-jobs/{job_id}` — status; quando `completed`, a imagem vem
  de `last_response.image.base64` e é devolvida como data URL PNG.

Base: `https://api.pixellab.ai/v2`, com `Authorization: Bearer <token>` e
timeout de 30 s por chamada.

## Limite Tier 1

A UI e o servidor limitam `image_size` a **320×320 px** (mín. 32). Para Init
Image, cada metatile é renderizado em 16×16 px ⇒ região máxima de
**20×20 metatiles**. Mapas maiores exigem seleção retangular; nada é
distorcido nem redimensionado silenciosamente.

## Defaults técnicos (mapa GBA)

`view="high top-down"`, `isometric=false`, `no_background=false`,
`outline="selective outline"`, `shading="basic shading"`,
`detail="medium detail"`, `text_guidance_scale=8`,
`init_image_strength=300` (1–999).

## Regra de ouro

> A imagem PixelLab é **referência**. Nenhum pixel vira metatile
> automaticamente; nenhum byte de `map.bin`/`map.json` muda ao gerar.
