# PixelLab AI no Arauna Map Studio

A integração usa a PixelLab como **gerador de concept visual**. Ela não converte pixels em metatiles e nunca escreve automaticamente em `map.bin`, `map.json`, colisão, elevação, eventos ou histórico de Undo.

## Segurança e chave

O token é lido apenas no servidor por `process.env.PIXELLAB_API_TOKEN` em `src/lib/pixellab.functions.ts`. Não existe campo de chave no navegador, localStorage ou código versionado.

No Lovable, configure em **Project Settings → Secrets → Add secret** com o nome exato:

`PIXELLAB_API_TOKEN`

## Endpoints oficiais usados

- `GET https://api.pixellab.ai/v2/balance` — testa a credencial e devolve créditos USD + gerações restantes da assinatura.
- `POST https://api.pixellab.ai/v2/create-image-pixflux-background` — inicia Pixflux assíncrono; o Studio lê `background_job_id`.
- `GET https://api.pixellab.ai/v2/background-jobs/{background_job_id}` — polling aproximadamente a cada 5 s. Ao concluir, a imagem vem de `last_response.image.base64`.

Erros 401, 402, 422, 429 e 5xx recebem mensagens sanitizadas. Headers e Bearer token nunca são retornados ao cliente.

## Tier 1, Init Image e paleta

O Studio impõe no cliente e no servidor o teto de **320×320 px**. A referência do mapa é renderizada em **16 px por metatile**, portanto o máximo alinhável é **20×20 metatiles**. Se o mapa for maior, faça uma seleção retangular de até 20×20; o Studio não redimensiona nem distorce silenciosamente.

O renderer usa o atlas real ativo e cria uma imagem limpa sem grid, coordenadas, eventos, seleção ou overlays. Se faltar um metatile no atlas, a geração é bloqueada em vez de usar placeholder. A opção de paleta extrai deterministicamente até 24 cores dos pixels reais e envia um `color_image`; nenhuma cor é inventada.

## Interface

`PixelLabDock` oferece prompt, presets Paraná/Mata Atlântica, Amazônia, Cerrado, Caatinga, Pantanal, Litoral/Mangue e Personalizado; tamanho, seed, guidance, outline, shading, detail e Init Image strength. O job é assíncrono, impede submissão dupla e pode ter apenas o **acompanhamento local** interrompido — isso não finge cancelar o job remoto.

Quando a geração usou Init Image, o resultado pode ser exibido como overlay alinhado aos mesmos bounds e acompanha pan/zoom do editor. Sem Init Image, a imagem fica somente como referência no dock, pois não existe alinhamento espacial confiável.

## Arquivos

- `src/lib/pixellab.ts` — limites Tier 1, presets, payload e sanitização.
- `src/lib/pixellab.functions.ts` — chamadas server-only à API.
- `src/lib/pixellabMapRender.ts` — bounds, renderer limpo e paleta.
- `src/lib/pixellabOverlayStore.ts` — estado efêmero do overlay.
- `src/components/studio/PixelLabDock.tsx` — UI e polling.
- `src/components/studio/PixelLabOverlay.tsx` — overlay visual sem escrita no mapa.
- `src/lib/pixellab.test.ts` — regressões de limites, jobs, base64, balance, bounds e paleta.

## Regra de ouro

A imagem PixelLab é **referência visual**. Nenhum pixel vira metatile automaticamente; nenhum byte do mapa muda ao gerar.
