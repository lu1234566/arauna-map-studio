import { describe, expect, it } from "vitest";
import { AI_MAP_PLAN_FORMAT } from "./aiMapPlan";
import { parseAiProviderPlan } from "./aiProviderPlan";

const starterPatterns = [
  {
    id: "emerald-littleroot-house-west",
    name: "Casa Emerald — entrada direita",
    tags: ["casa", "casa rural", "residência", "casa do jogador", "player house"],
  },
  {
    id: "emerald-littleroot-house-east",
    name: "Casa Emerald — entrada esquerda",
    tags: ["casa", "casa rural", "residência", "casa do rival", "rival house"],
  },
  {
    id: "emerald-littleroot-birch-lab",
    name: "Laboratório Emerald",
    tags: ["laboratório", "laboratorio", "lab", "professora", "professor", "pesquisa"],
  },
];

const explicitPrompt = `Use exatamente o Pattern "Casa Emerald — entrada direita" para a Casa do jogador.
Use exatamente o Pattern "Casa Emerald — entrada esquerda" para a Casa do rival.
Use exatamente o Pattern "Laboratório Emerald" para o Laboratório da Professora.`;

const warpPrompt = `
CASA DO JOGADOR
Use exatamente o Pattern "Casa Emerald — entrada direita".
ID lógico da estrutura: casa-jogador
Nome visível: Casa do jogador
A entrada principal deve usar a porta semântica: "entrada".
Crie nesta entrada um warp para:
destMap: MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F
destWarpId: 1

CASA DO RIVAL
Use exatamente o Pattern "Casa Emerald — entrada esquerda".
ID lógico da estrutura: casa-rival
Nome visível: Casa do rival
Use a porta semântica: "entrada".
Crie nesta entrada um warp para:
destMap: MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F
destWarpId: 1

LABORATÓRIO
Use exatamente o Pattern "Laboratório Emerald".
ID lógico da estrutura: laboratorio
Nome visível: Laboratório da Professora
Use a porta semântica: "entrada".
Crie nesta entrada um warp para:
destMap: MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB
destWarpId: 0
`;

describe("AI provider plan normalization", () => {
  it("turns a singleton connection object into a one-item array", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Cidade teste",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: { direction: "north", map: "MAP_ROUTE101", offset: 0 },
      notes: [],
    }));

    expect(plan.connections).toEqual([{ direction: "north", map: "MAP_ROUTE101", offset: 0 }]);
  });

  it("normalizes empty objects and missing collections to empty arrays", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Cidade vazia",
      width: 20,
      height: 20,
      structures: {},
      routes: {},
      warps: {},
      connections: {},
      notes: "Sem caminhos disponíveis.",
    }));

    expect(plan.structures).toEqual([]);
    expect(plan.routes).toEqual([]);
    expect(plan.warps).toEqual([]);
    expect(plan.connections).toEqual([]);
    expect(plan.notes).toEqual(["Sem caminhos disponíveis."]);
  });

  it("repairs blank format/dimensions and uniquely resolves the starter Patterns", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: "",
      name: "",
      width: null,
      height: null,
      structures: [
        { id: "casa-jogador", label: "Casa do jogador", pattern: "", x: 2, y: 4 },
        { id: "casa-rival", label: "Casa do rival", pattern: "", x: 13, y: 4 },
        { id: "laboratorio", label: "Laboratório da Professora", pattern: "", x: 3, y: 12 },
      ],
      routes: [],
      warps: [],
      connections: { direction: "north", map: "MAP_ROUTE101", offset: 0 },
      notes: [],
    }), {
      width: 20,
      height: 20,
      prompt: explicitPrompt,
      patterns: starterPatterns,
    });

    expect(plan.format).toBe(AI_MAP_PLAN_FORMAT);
    expect(plan.name).toBe("Mapa gerado por IA");
    expect(plan.width).toBe(20);
    expect(plan.height).toBe(20);
    expect(plan.structures.map((structure) => structure.pattern)).toEqual([
      "emerald-littleroot-house-west",
      "emerald-littleroot-house-east",
      "emerald-littleroot-birch-lab",
    ]);
    expect(plan.connections).toHaveLength(1);
  });

  it("repairs empty warp sources from explicit structure and semantic-port associations in the prompt", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Vila Teste Arauna",
      width: 20,
      height: 20,
      structures: [
        { id: "casa-jogador", label: "Casa do jogador", pattern: "emerald-littleroot-house-west", x: 2, y: 4 },
        { id: "casa-rival", label: "Casa do rival", pattern: "emerald-littleroot-house-east", x: 13, y: 4 },
        { id: "laboratorio", label: "Laboratório da Professora", pattern: "emerald-littleroot-birch-lab", x: 3, y: 12 },
      ],
      routes: [],
      warps: [
        { source: {}, destMap: "MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F", destWarpId: "1" },
        { source: {}, destMap: "MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F", destWarpId: "1" },
        { source: {}, destMap: "MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB", destWarpId: "0" },
      ],
      connections: [{ direction: "north", map: "MAP_ROUTE101", offset: 0 }],
      notes: [],
    }), {
      width: 20,
      height: 20,
      prompt: warpPrompt,
      patterns: starterPatterns,
    });

    expect(plan.warps.map((warp) => warp.source)).toEqual([
      { structure: "casa-jogador", port: "entrada" },
      { structure: "casa-rival", port: "entrada" },
      { structure: "laboratorio", port: "entrada" },
    ]);
  });

  it("keeps an empty warp source blocked when the prompt does not name a port", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Sem porta",
      width: 20,
      height: 20,
      structures: [
        { id: "lab", label: "Laboratório", pattern: "emerald-littleroot-birch-lab", x: 3, y: 12 },
      ],
      routes: [],
      warps: [
        { source: {}, destMap: "MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB", destWarpId: "0" },
      ],
      connections: [],
      notes: [],
    }), {
      prompt: "Laboratório. Crie um warp para MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB.",
      patterns: starterPatterns,
    });

    expect(plan.warps[0]?.source).toEqual({});
  });

  it("accepts common Pattern field aliases from providers", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Aliases",
      width: 20,
      height: 20,
      structures: [
        { id: "lab", label: "Laboratório", pattern_name: "Laboratório Emerald", x: 3, y: 12 },
      ],
      routes: [],
      warps: [],
      connections: [],
      notes: [],
    }), { patterns: starterPatterns });

    expect(plan.structures[0]?.pattern).toBe("Laboratório Emerald");
  });

  it("does not guess a Pattern when the best match is ambiguous", () => {
    const plan = parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Ambíguo",
      width: 20,
      height: 20,
      structures: [
        { id: "casa", label: "Casa", pattern: "", x: 1, y: 1 },
      ],
      routes: [],
      warps: [],
      connections: [],
      notes: [],
    }), { patterns: starterPatterns });

    expect(plan.structures[0]?.pattern).toBe("");
  });

  it("rejects primitive collection values instead of crashing later", () => {
    expect(() => parseAiProviderPlan(JSON.stringify({
      format: AI_MAP_PLAN_FORMAT,
      name: "Inválido",
      width: 20,
      height: 20,
      structures: [],
      routes: [],
      warps: [],
      connections: "north",
      notes: [],
    }))).toThrow(/connections/);
  });
});
