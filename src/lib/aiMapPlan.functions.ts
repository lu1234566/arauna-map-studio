import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AI_MAP_PLAN_FORMAT, type AiMapPlan } from "./aiMapPlan";

const pointSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  structure: z.string().optional(),
  port: z.string().optional(),
});

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

const responseSchema = {
  type: "OBJECT",
  properties: {
    format: { type: "STRING", enum: [AI_MAP_PLAN_FORMAT] },
    name: { type: "STRING" },
    category: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    structures: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          pattern: { type: "STRING" },
          x: { type: "INTEGER" },
          y: { type: "INTEGER" },
        },
        required: ["id", "pattern", "x", "y"],
      },
    },
    routes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          smartPath: { type: "STRING" },
          mode: { type: "STRING", enum: ["add", "erase"] },
          points: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                x: { type: "INTEGER" },
                y: { type: "INTEGER" },
                structure: { type: "STRING" },
                port: { type: "STRING" },
              },
            },
          },
        },
        required: ["smartPath", "points"],
      },
    },
    warps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          source: {
            type: "OBJECT",
            properties: {
              x: { type: "INTEGER" },
              y: { type: "INTEGER" },
              structure: { type: "STRING" },
              port: { type: "STRING" },
            },
          },
          destMap: { type: "STRING" },
          destWarpId: { type: "STRING" },
        },
        required: ["source", "destMap", "destWarpId"],
      },
    },
    connections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          direction: { type: "STRING", enum: ["north", "east", "south", "west"] },
          map: { type: "STRING" },
          offset: { type: "INTEGER" },
        },
        required: ["direction", "map", "offset"],
      },
    },
    notes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["format", "name", "width", "height", "structures", "routes", "warps", "connections", "notes"],
};

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function plannerInstructions(data: z.infer<typeof requestSchema>) {
  const patterns = data.patterns.map((pattern) => {
    const ports = pattern.ports.map((port) => `${port.id}:${port.name}@(${port.x},${port.y})/${port.kind}${port.direction ? `/${port.direction}` : ""}`).join(", ");
    return `- ${pattern.name} [id=${pattern.id}, category=${pattern.category}, size=${pattern.width}x${pattern.height}, tags=${pattern.tags.join("|") || "-"}, ports=${ports || "nenhum"}]`;
  }).join("\n") || "- nenhum";
  const smartPaths = data.smartPaths.map((preset) => `- ${preset.name} [id=${preset.id}]`).join("\n") || "- nenhum";
  return `Você é a camada de planejamento espacial do Arauna Map Studio para Pokémon Emerald. Converta o comando do usuário em um plano JSON estrito.\n\nREGRAS OBRIGATÓRIAS:\n1. O mapa mede ${data.width}x${data.height} metatiles. Preserve essas dimensões salvo se o usuário der dimensões explícitas.\n2. Use SOMENTE Patterns e Smart Paths da lista. Nunca invente nomes, IDs ou tiles.\n3. Estruturas usam x/y do canto superior esquerdo. Respeite coordenadas e posições cardeais dadas pelo usuário literalmente.\n4. Para entradas/portas, use referência semântica {structure, port} somente quando o Pattern listar esse port. Sem port cadastrado, use coordenada absoluta {x,y} fornecida pelo usuário. Não adivinhe onde está uma porta.\n5. Rotas precisam ser ortogonais. Se precisar contornar uma construção, adicione pontos intermediários.\n6. Warps só podem usar destMap/destWarpId que o usuário informou. Se o usuário não informou destino, NÃO crie warp; registre em notes que falta o destino.\n7. Conexões north/east/south/west só podem ser criadas quando o usuário informou explicitamente o mapa de destino.\n8. Não sobreponha estruturas. Mantenha todas dentro dos limites.\n9. Se uma instrução for impossível com o vocabulário disponível, não substitua por outra coisa: omita e explique em notes.\n10. IDs de structures devem ser curtos, únicos e estáveis; label pode manter o nome humano.\n11. Responda exclusivamente no schema solicitado.\n\nPATTERNS DISPONÍVEIS:\n${patterns}\n\nSMART PATHS DISPONÍVEIS:\n${smartPaths}\n\nCOMANDO DO USUÁRIO:\n${data.prompt}`;
}

export const planMapWithGemini = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false as const,
        configured: false as const,
        message: "GEMINI_API_KEY não está configurada no ambiente do servidor. O interpretador local continua disponível.",
      };
    }
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: plannerInstructions(data) }] }],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false as const,
        configured: true as const,
        message: `Gemini ${response.status}: ${raw.slice(0, 1000)}`,
      };
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ok: false as const, configured: true as const, message: "Resposta HTTP do Gemini não era JSON válido." };
    }
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = first?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts as Array<Record<string, unknown>> : [];
    const text = parts.map((part) => typeof part.text === "string" ? part.text : "").join("\n").trim();
    if (!text) return { ok: false as const, configured: true as const, message: "Gemini não retornou um plano textual." };
    try {
      const plan = JSON.parse(stripFence(text)) as AiMapPlan;
      return { ok: true as const, configured: true as const, model, plan };
    } catch (error) {
      return {
        ok: false as const,
        configured: true as const,
        message: `Gemini retornou JSON inválido: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
