import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AI_MAP_PLAN_FORMAT, type AiMapPlan } from "./aiMapPlan";
import { parseAiProviderPlan } from "./aiProviderPlan";

const requestSchema = z.object({
  prompt: z.string().min(1).max(20000),
  width: z.number().int().min(1).max(512),
  height: z.number().int().min(1).max(512),
  patterns: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    width: z.number().int(),
    height: z.number().int(),
    ports: z.array(z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["door", "entrance", "exit", "connection"]),
      x: z.number().int(),
      y: z.number().int(),
      direction: z.enum(["north", "east", "south", "west"]).optional(),
    })),
  })).max(300),
  smartPaths: z.array(z.object({ id: z.string(), name: z.string() })).max(100),
  reservedCells: z.array(z.object({
    x: z.number().int(),
    y: z.number().int(),
    kind: z.enum(["warp", "npc", "trigger"]),
    label: z.string(),
  })).max(1200).optional().default([]),
});

type PlannerRequest = z.infer<typeof requestSchema>;

const responseSchema = {
  type: "OBJECT",
  properties: {
    format: { type: "STRING", enum: [AI_MAP_PLAN_FORMAT] },
    name: { type: "STRING" },
    category: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    structures: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, label: { type: "STRING" }, pattern: { type: "STRING" }, x: { type: "INTEGER" }, y: { type: "INTEGER" } }, required: ["id", "pattern", "x", "y"] } },
    routes: { type: "ARRAY", items: { type: "OBJECT", properties: { smartPath: { type: "STRING" }, mode: { type: "STRING", enum: ["add", "erase"] }, points: { type: "ARRAY", items: { type: "OBJECT", properties: { x: { type: "INTEGER" }, y: { type: "INTEGER" }, structure: { type: "STRING" }, port: { type: "STRING" } } } } }, required: ["smartPath", "points"] } },
    warps: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, source: { type: "OBJECT", properties: { x: { type: "INTEGER" }, y: { type: "INTEGER" }, structure: { type: "STRING" }, port: { type: "STRING" } } }, destMap: { type: "STRING" }, destWarpId: { type: "STRING" } }, required: ["source", "destMap", "destWarpId"] } },
    connections: { type: "ARRAY", items: { type: "OBJECT", properties: { direction: { type: "STRING", enum: ["north", "east", "south", "west"] }, map: { type: "STRING" }, offset: { type: "INTEGER" } }, required: ["direction", "map", "offset"] } },
    notes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["format", "name", "width", "height", "structures", "routes", "warps", "connections", "notes"],
};

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function providerDefaults(data: PlannerRequest) {
  return {
    width: data.width,
    height: data.height,
    prompt: data.prompt,
    patterns: data.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      tags: pattern.tags,
    })),
  };
}

function unmentionedDestinations(plan: AiMapPlan, prompt: string) {
  const source = prompt.toLocaleUpperCase("pt-BR");
  const warps = Array.isArray(plan.warps) ? plan.warps : [];
  const connections = Array.isArray(plan.connections) ? plan.connections : [];
  const destinations = [
    ...warps.map((warp) => warp.destMap),
    ...connections.map((connection) => connection.map),
  ];
  return Array.from(new Set(destinations
    .map((destination) => destination.trim())
    .filter(Boolean)
    .filter((destination) => !source.includes(destination.toLocaleUpperCase("pt-BR")))));
}

function plannerInstructions(data: PlannerRequest) {
  const patterns = data.patterns.map((pattern) => {
    const ports = pattern.ports.map((port) => `${port.id}:${port.name}@(${port.x},${port.y})/${port.kind}${port.direction ? `/${port.direction}` : ""}`).join(", ");
    return `- ${pattern.name} [id=${pattern.id}, category=${pattern.category}, size=${pattern.width}x${pattern.height}, tags=${pattern.tags.join("|") || "-"}, ports=${ports || "nenhum"}]`;
  }).join("\n") || "- nenhum";
  const smartPaths = data.smartPaths.map((preset) => `- ${preset.name} [id=${preset.id}]`).join("\n") || "- nenhum";
  const reserved = data.reservedCells.length
    ? data.reservedCells.map((cell) => `- (${cell.x},${cell.y}) ${cell.kind}: ${cell.label}`).join("\n")
    : "- nenhuma célula reservada informada";
  const hasSmartPaths = data.smartPaths.length > 0;
  return `Você é a camada de planejamento espacial do Arauna Map Studio para Pokémon Emerald. Converta o comando do usuário em um plano JSON estrito. O vocabulário abaixo vem de metatiles/padrões GBA reais; preserve essa fidelidade e prefira sempre a correspondência semântica mais específica.\n\nREGRAS OBRIGATÓRIAS:\n1. O mapa mede ${data.width}x${data.height} metatiles. Preserve essas dimensões salvo se o usuário der dimensões explícitas.\n2. Use SOMENTE Patterns e Smart Paths da lista. Nunca invente nomes, IDs ou tiles. Patterns com nomes como Centro Pokémon, Museu, Estaleiro, Mercado, residência, trecho costeiro/urbano/verde foram extraídos do mapa real e devem ter prioridade quando correspondem ao pedido.\n3. REGRA DE JOGABILIDADE: quando um Pattern tiver a tag warp-anchor:X,Y e um port chamado entrada em (px,py), ele representa um prédio ligado a um warp JÁ EXISTENTE. Por padrão coloque a estrutura em x=X-px e y=Y-py, para que sua porta permaneça exatamente no warp original. Só desloque essa estrutura se o comando do usuário pedir explicitamente a mudança e também fornecer o destino/warp necessário. A tag warp-anchor NÃO autoriza criar um item em warps; ela apenas fixa a fachada ao evento existente.\n4. Quando um Pattern tiver a tag fixed-origin:X,Y, ele representa um conjunto urbano ligado a NPCs/eventos existentes (por exemplo o mercado aberto). Coloque-o EXATAMENTE em x=X, y=Y. Não tente deslocá-lo. O compilador também força essa origem.\n5. ${hasSmartPaths ? "Cada item de routes DEVE usar smartPath com o id ou nome EXATO de um Smart Path disponível; nunca deixe smartPath vazio. Use Costa/água somente para água/litoral e os caminhos urbanos somente para vias caminháveis." : "Não há Smart Paths disponíveis: routes DEVE ser exatamente []; nunca crie uma rota com smartPath vazio. Registre em notes que caminhos automáticos não estão disponíveis."}\n6. CÉLULAS RESERVADAS vêm de warps, triggers e áreas de movimento de NPCs do map.json real. Não coloque uma construção cobrindo nenhuma célula reservada, EXCETO quando o Pattern é uma região real em sua origem fixa/original ou a própria célula warp-anchor pertencente ao Pattern ancorado. Rotas caminháveis podem passar por células NPC; não devem apagar/deslocar warps ou triggers.\n7. Estruturas usam x/y do canto superior esquerdo. Respeite coordenadas e posições cardeais dadas pelo usuário literalmente, exceto quando isso conflitar com warp-anchor/fixed-origin: nesse caso preserve o evento real e explique o conflito em notes.\n8. Para entradas/portas, use referência semântica {structure, port} somente quando o Pattern listar esse port. Sem port cadastrado, use coordenada absoluta {x,y} fornecida pelo usuário. Não adivinhe onde está uma porta.\n9. Rotas precisam ser ortogonais. Se precisar contornar uma construção, adicione pontos intermediários.\n10. Warps só podem usar destMap/destWarpId que o usuário informou NO COMANDO. Tags warp-destination do catálogo não são permissão para criar/alterar warps. Se o usuário não informou destino, NÃO crie warp; registre em notes que o warp existente foi preservado.\n11. Conexões north/east/south/west só podem ser criadas quando o usuário informou explicitamente o mapa de destino.\n12. Não sobreponha estruturas. Mantenha todas dentro dos limites. Não cubra portas/anchors com outras estruturas ou rotas.\n13. Se uma instrução for impossível com o vocabulário disponível, não substitua por outra coisa: omita e explique em notes.\n14. IDs de structures devem ser curtos, únicos e estáveis; label pode manter o nome humano.\n15. structures, routes, warps, connections e notes DEVEM SEMPRE ser arrays JSON, mesmo quando houver zero ou apenas um item.\n16. Cada structure DEVE preencher pattern com o id ou nome EXATO de um Pattern disponível; nunca deixe pattern vazio.\n17. format DEVE ser exatamente ${AI_MAP_PLAN_FORMAT}; width e height DEVEM ser números inteiros.\n18. Responda exclusivamente com um objeto JSON no schema arauna-ai-map-plan-v1, sem Markdown.\n\nPATTERNS DISPONÍVEIS:\n${patterns}\n\nSMART PATHS DISPONÍVEIS:\n${smartPaths}\n\nCÉLULAS RESERVADAS / EVENTOS REAIS:\n${reserved}\n\nCOMANDO DO USUÁRIO:\n${data.prompt}`;
}

function validateReturnedPlan(plan: AiMapPlan, prompt: string) {
  const invented = unmentionedDestinations(plan, prompt);
  if (invented.length) throw new Error(`A IA tentou usar destino(s) que não aparecem no seu comando: ${invented.join(", ")}. O plano foi bloqueado.`);
  return plan;
}

async function callLovableGateway(data: PlannerRequest, apiKey: string) {
  const model = process.env.LOVABLE_AI_MODEL?.trim() || "google/gemini-3.7-flash";
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.15, messages: [{ role: "user", content: plannerInstructions(data) }] }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Lovable AI ${response.status}: ${raw.slice(0, 1000)}`);
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content : "";
  if (!text.trim()) throw new Error("Lovable AI não retornou um plano textual.");
  const plan = parseAiProviderPlan(stripFence(text), providerDefaults(data));
  return { model, plan: validateReturnedPlan(plan, data.prompt) };
}

async function callGeminiDirect(data: PlannerRequest, apiKey: string) {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: plannerInstructions(data) }] }], generationConfig: { temperature: 0.15, responseMimeType: "application/json", responseSchema } }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${raw.slice(0, 1000)}`);
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts as Array<Record<string, unknown>> : [];
  const text = parts.map((part) => typeof part.text === "string" ? part.text : "").join("\n").trim();
  if (!text) throw new Error("Gemini não retornou um plano textual.");
  const plan = parseAiProviderPlan(stripFence(text), providerDefaults(data));
  return { model, plan: validateReturnedPlan(plan, data.prompt) };
}

export const planMapWithGemini = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    if (lovableKey) {
      try {
        const result = await callLovableGateway(data, lovableKey);
        return { ok: true as const, configured: true as const, provider: "lovable" as const, ...result };
      } catch (error) {
        if (!geminiKey) return { ok: false as const, configured: true as const, message: `Lovable AI falhou: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    if (geminiKey) {
      try {
        const result = await callGeminiDirect(data, geminiKey);
        return { ok: true as const, configured: true as const, provider: "gemini" as const, ...result };
      } catch (error) {
        return { ok: false as const, configured: true as const, message: `Gemini falhou: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    return { ok: false as const, configured: false as const, message: "O AI Gateway ainda não foi provisionado neste projeto e não há GEMINI_API_KEY. O modo Interpretar local continua funcional para comandos precisos." };
  });
