import { describe, expect, it } from "vitest";
import { AI_MAP_PLAN_FORMAT } from "./aiMapPlan";
import { parseAiProviderPlan } from "./aiProviderPlan";

const prompt = `
SAÍDA DA CIDADE
Crie uma conexão pela borda NORTE da cidade.
Destino:
MAP_ROUTE101
Offset:
0
Não crie conexões nas bordas sul, leste ou oeste.
`;

describe("AI provider connection destination repair", () => {
  it("repairs a blank north connection map from an explicit prompt destination", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Vila Teste Arauna",
      tags: [],
      width: 20,
      height: 20,
      structures: [
        { id: "casa-jogador", label: "Casa do jogador", pattern: "emerald-littleroot-house-west", x: 2, y: 4 },
        { id: "casa-rival", label: "Casa do rival", pattern: "emerald-littleroot-house-east", x: 13, y: 4 },
        { id: "laboratorio", label: "Laboratório da Professora", pattern: "emerald-littleroot-birch-lab", x: 3, y: 12 },
      ],
      routes: [],
      warps: [
        {
          source: { structure: "casa-jogador", port: "entrada" },
          destMap: "MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F",
          destWarpId: "1",
        },
        {
          source: { structure: "casa-rival", port: "entrada" },
          destMap: "MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F",
          destWarpId: "1",
        },
        {
          source: { structure: "laboratorio", port: "entrada" },
          destMap: "MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB",
          destWarpId: "0",
        },
      ],
      connections: [{ direction: "north", map: "", offset: 0 }],
      notes: ["Os caminhos ficaram pendentes por falta de Smart Path apropriado disponível na biblioteca."],
    }), { prompt });

    expect(plan.connections).toEqual([
      { direction: "north", map: "MAP_ROUTE101", offset: 0 },
    ]);
  });

  it("does not guess when the prompt names two different north destinations", () => {
    const ambiguousPrompt = `${prompt}\nOutra conexão norte para MAP_ROUTE102.`;
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Ambígua",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: [{ direction: "north", map: "", offset: 0 }],
      notes: [],
    }), { prompt: ambiguousPrompt });

    expect(plan.connections[0]?.map).toBe("");
  });

  it("accepts a provider destination alias without consulting the prompt", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Alias",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: [{ direction: "north", destMap: "MAP_ROUTE101", offset: 0 }],
      notes: [],
    }));

    expect(plan.connections[0]?.map).toBe("MAP_ROUTE101");
  });
});
