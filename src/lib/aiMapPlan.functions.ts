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
  return `Você é a camada de planejamento espacial do Arauna Map Studio para Pokémon Emerald. Converta o comando do usuário em um plano JSON estrito.\n\nREGRAS OBRIGATÓRIAS:\n1. O mapa mede ${data.width}x${data.height} metatiles. Preserve essas dimensões salvo se o usuário der dimensões explícitas.\n2. Use SOMENTE Patterns e Smart Paths da lista. Nunca invente nomes, IDs ou tiles.\n3. Estruturas usam x/y do canto superior esquerdo. Respeite coordenadas e posições cardeais dadas pelo usuário literalmente.\n4. Para entradas/portas, use referência semântica {structure, port} somente quando o Pattern listar esse port. Sem port cadastrado, use coordenada absoluta {x,y} fornecida pelo usuário. Não adivinhe onde está uma porta.\n5. Rotas precisam ser ortogonais. Se precisar contornar uma construção, adicione pontos intermediários.\n6. Warps só podem usar destMap/destWarpId que o usuário informou. Se o usuário não informou destino, NÃO crie warp; registre em notes que falta o destino.\n7. Conexões north/east/south/west só podem ser criadas quando o usuário informou explicitamente o mapa de destino.\n8. Não sobreponha estruturas. Mantenha todas dentro dos limites.\n9. Se uma instrução for impossível com o vocabulário disponível, não substitua por outra coisa: omita e explique em notes.\n10. IDs de structures devem ser curtos, únicos e estáveis; label pode manter o nome humano.\n11. structures, routes, warps, connections e notes DEVEM SEMPRE ser arrays JSON, mesmo quando houver zero ou apenas um item.\n12. Responda exclusivamente com um objeto JSON no schema arauna-ai-map-plan-v1, sem Markdown.\n\nPATTERNS DISPONÍVEIS:\n${patterns}\n\nSMART PATHS DISPONÍVEIS:\n${smartPaths}\n\nCOMANDO DO USUÁRIO:\n${data.prompt}`;
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
  const plan = parseAiProviderPlan(stripFence(text));
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
  const plan = parseAiProviderPlan(stripFence(text));
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
