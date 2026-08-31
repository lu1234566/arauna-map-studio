# PixelLab AI no Arauna Map Studio

A integração usa a PixelLab como **gerador de concept visual**. Ela não converte pixels em metatiles e nunca escreve automaticamente em `map.bin`, `map.json`, colisão, elevação, eventos ou histórico de Undo.

## Arquitetura atual

O plano atual do Lovable não disponibiliza Secrets para este projeto, então a integração não depende mais de `PIXELLAB_API_TOKEN` no backend Lovable.

Fluxo real:

```text
Arauna Map Studio (Lovable)
  └─ chave PixelLab somente em sessionStorage da aba
       ↓ HTTPS / X-PixelLab-Token
arauna-pixellab-proxy.vercel.app
       ↓ Authorization: Bearer ...
api.pixellab.ai/v2
```

- O usuário cola a chave no painel PixelLab do Studio.
- A chave fica somente em `sessionStorage` e é descartada ao fechar a aba.
- A chave não é salva no GitHub, no `localStorage` nem em Lovable Secrets.
- O proxy Vercel encaminha a requisição e não persiste a chave.
- O URL não sensível do proxy pode ser salvo em `localStorage`.

Proxy de produção: `https://arauna-pixellab-proxy.vercel.app`.

## Endpoints PixelLab usados

- `GET https://api.pixellab.ai/v2/balance` — teste de credencial e leitura dos dados de saldo/assinatura retornados pela API.
- `POST https://api.pixellab.ai/v2/create-image-pixflux-background` — inicia Pixflux assíncrono e lê `background_job_id`.
- `GET https://api.pixellab.ai/v2/background-jobs/{background_job_id}` — polling aproximadamente a cada 5 s; a imagem concluída vem de `last_response.image.base64`.

Erros 401, 402, 422, 429 e 5xx são reduzidos a mensagens úteis. O relay não devolve o Bearer token.

## Tier 1 e referências

O Studio impõe teto de **320×320 px**. Cada célula de referência é renderizada em **16×16 px**, então o máximo é **20×20 metatiles**. Mapas maiores devem usar a seleção retangular existente; nada é distorcido silenciosamente.

O PixelLab possui três fontes de referência no Studio:

1. **Somente texto** — não envia Init Image e gera um concept livre.
2. **Mapa atual/seleção** — renderiza os metatiles reais sem UI, grid, eventos ou overlays. Regiões vazias/quase uniformes são bloqueadas. Opcionalmente envia uma paleta determinística de até 24 cores como `color_image`.
3. **Blueprint visual** — envia uma planta estrutural colorida e limpa, independente do mapa real.

## Blueprint visual

O Blueprint visual tem store próprio em memória e **não participa do Undo do mapa**. Mudar a dimensão do mapa reinicializa o blueprint de forma segura.

Zonas:

- Caminho — marrom
- Construção — vermelho
- Água — azul
- Vegetação/bloqueado — verde
- Livre — cinza claro
- Entrada/Saída obrigatória — amarelo
- Apagar/não atribuído — cinza escuro

O overlay acompanha exatamente pan/zoom do mapa e aceita pincel 1×1, 2×2 ou 3×3. Shift, Alt ou botão direito continuam servindo para pan enquanto o modo de pintura está ativo.

Antes de enviar à PixelLab, a imagem do blueprint é mostrada no painel. O prompt ganha automaticamente instruções para priorizar topologia das estradas, conectividade, entradas/saídas obrigatórias, zonas de construção, água e vegetação.

### Fidelidade ao layout

Presets de `init_image_strength`:

- Livre — 250
- Inspirado — 400
- Preservar layout — 550
- Preservar fortemente — 700
- Avançado — 1 a 999

Esses valores aumentam a influência do Init Image, mas não prometem reprodução pixel a pixel do modelo generativo.

## Organização do editor

Os recursos auxiliares agora vivem em uma rail/drawer de **Assistentes**, com apenas um aberto por vez:

- PixelLab
- Smart Paths
- Padrões
- Templates
- Blueprint JSON (o compilador JSON → Template GBA, diferente do Blueprint visual)
- Clipboard
- Gerador procedural
- Biblioteca Gen3
- ferramentas de cidade

Somente overlays que precisam de alinhamento geométrico permanecem sobre o canvas. As laterais de Metatiles e Propriedades podem ser recolhidas para liberar área útil.

## Arquivos principais

- `src/lib/pixellab.ts` — limites Tier 1, payload e sanitização.
- `src/lib/pixellabProxyClient.ts` — cliente browser para o relay Vercel e sessionStorage da chave.
- `src/lib/pixellabMapRender.ts` — bounds, renderer de mapa, diversidade e paleta.
- `src/lib/pixellabOverlayStore.ts` — estado efêmero do concept overlay.
- `src/lib/pixellabBlueprintStore.ts` — estado, zonas e renderer do Blueprint visual.
- `src/components/studio/PixelLabDock.tsx` — configuração, geração, polling, preview e fidelidade.
- `src/components/studio/PixelLabBlueprintControls.tsx` — ferramentas de pintura do blueprint.
- `src/components/studio/PixelLabBlueprintOverlay.tsx` — pintura alinhada à grade.
- `src/components/studio/PixelLabOverlay.tsx` — overlay do concept gerado.
- `src/components/studio/StudioAssistantDrawer.tsx` — rail/drawer dos assistentes.
- `src/lib/pixellab.test.ts` — regressões de API, Tier 1, mapa/paleta e Blueprint.

## Regra de ouro

PixelLab e Blueprint são **camadas de planejamento visual**. Nenhuma ação de geração ou pintura nessas camadas escreve bytes no mapa jogável. A conversão futura de concepts para tiles/metatiles GBA deve continuar sendo uma etapa explícita, revisável e separada.
