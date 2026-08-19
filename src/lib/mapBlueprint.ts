import { createMapTemplate, type MapTemplate, type TemplateElement, type TemplatePoint } from "./mapTemplate";
import type { MapPattern, PatternScope } from "./patternLibrary";
import type { SmartPathPreset } from "./smartPath";

export const MAP_BLUEPRINT_FORMAT = "arauna-map-blueprint-v1" as const;

export interface BlueprintPatternPlacement {
  pattern: string;
  x: number;
  y: number;
}

export interface BlueprintRoute {
  smartPath: string;
  points: TemplatePoint[];
  mode?: "add" | "erase";
}

export interface MapBlueprint {
  format: typeof MAP_BLUEPRINT_FORMAT;
  name: string;
  category?: string;
  tags?: string[];
  width: number;
  height: number;
  patterns: BlueprintPatternPlacement[];
  routes: BlueprintRoute[];
}

export interface BlueprintCompileResult {
  valid: boolean;
  template: MapTemplate | null;
  errors: string[];
  warnings: string[];
  resolvedPatterns: Array<{ reference: string; id: string; name: string }>;
  resolvedSmartPaths: Array<{ reference: string; id: string; name: string }>;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function resolveByIdOrName<T extends { id: string; name: string }>(reference: string, items: T[]) {
  const exactId = items.find((item) => item.id === reference);
  if (exactId) return { item: exactId, ambiguous: false };
  const key = normalize(reference);
  const matches = items.filter((item) => normalize(item.name) === key);
  if (matches.length === 1) return { item: matches[0]!, ambiguous: false };
  return { item: null, ambiguous: matches.length > 1 };
}

function commonScope(scopes: Array<PatternScope | undefined>): PatternScope | undefined {
  const concrete = scopes.filter((scope): scope is PatternScope => Boolean(scope));
  if (!concrete.length) return undefined;
  const first = concrete[0]!;
  return concrete.every((scope) => scope.primary === first.primary && scope.secondary === first.secondary)
    ? { ...first }
    : undefined;
}

export function parseMapBlueprintJson(source: string): MapBlueprint {
  const raw = JSON.parse(source) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Blueprint precisa ser um objeto JSON.");
  const patternsRaw = Array.isArray(raw.patterns) ? raw.patterns : [];
  const routesRaw = Array.isArray(raw.routes) ? raw.routes : [];
  return {
    format: String(raw.format ?? "") as typeof MAP_BLUEPRINT_FORMAT,
    name: String(raw.name ?? ""),
    category: raw.category == null ? undefined : String(raw.category),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    width: Number(raw.width),
    height: Number(raw.height),
    patterns: patternsRaw.map((value) => {
      const item = value as Record<string, unknown>;
      return { pattern: String(item.pattern ?? ""), x: Number(item.x), y: Number(item.y) };
    }),
    routes: routesRaw.map((value) => {
      const item = value as Record<string, unknown>;
      const pointsRaw = Array.isArray(item.points) ? item.points : [];
      return {
        smartPath: String(item.smartPath ?? ""),
        mode: item.mode === "erase" ? "erase" : "add",
        points: pointsRaw.map((value) => {
          const point = value as Record<string, unknown>;
          return { x: Number(point.x), y: Number(point.y) };
        }),
      };
    }),
  };
}

export function compileMapBlueprint(
  blueprint: MapBlueprint,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
): BlueprintCompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolvedPatterns: BlueprintCompileResult["resolvedPatterns"] = [];
  const resolvedSmartPaths: BlueprintCompileResult["resolvedSmartPaths"] = [];

  if (blueprint.format !== MAP_BLUEPRINT_FORMAT) errors.push(`Formato inválido: esperado ${MAP_BLUEPRINT_FORMAT}.`);
  if (!blueprint.name.trim()) errors.push("Blueprint sem nome.");
  if (!Number.isInteger(blueprint.width) || blueprint.width < 1 || blueprint.width > 512) errors.push("width precisa ser inteiro entre 1 e 512.");
  if (!Number.isInteger(blueprint.height) || blueprint.height < 1 || blueprint.height > 512) errors.push("height precisa ser inteiro entre 1 e 512.");

  const elements: TemplateElement[] = [];
  const scopes: Array<PatternScope | undefined> = [];

  blueprint.patterns.forEach((placement, index) => {
    if (!placement.pattern.trim()) {
      errors.push(`Pattern ${index + 1}: referência vazia.`);
      return;
    }
    if (!Number.isInteger(placement.x) || !Number.isInteger(placement.y)) {
      errors.push(`Pattern ${index + 1}: coordenadas precisam ser inteiras.`);
      return;
    }
    const resolved = resolveByIdOrName(placement.pattern, patterns);
    if (!resolved.item) {
      errors.push(resolved.ambiguous
        ? `Pattern ${index + 1}: nome ambíguo “${placement.pattern}”; use o id.`
        : `Pattern ${index + 1}: “${placement.pattern}” não existe na Biblioteca.`);
      return;
    }
    const pattern = resolved.item;
    if (placement.x < 0 || placement.y < 0 || placement.x + pattern.width > blueprint.width || placement.y + pattern.height > blueprint.height) {
      warnings.push(`Pattern “${pattern.name}” ultrapassa os limites declarados ${blueprint.width}×${blueprint.height}.`);
    }
    elements.push({ type: "pattern", patternId: pattern.id, x: placement.x, y: placement.y });
    scopes.push(pattern.scope);
    resolvedPatterns.push({ reference: placement.pattern, id: pattern.id, name: pattern.name });
  });

  blueprint.routes.forEach((route, index) => {
    if (!route.smartPath.trim()) {
      errors.push(`Route ${index + 1}: referência Smart Path vazia.`);
      return;
    }
    if (!Array.isArray(route.points) || route.points.length < 1) {
      errors.push(`Route ${index + 1}: precisa de pelo menos um ponto.`);
      return;
    }
    if (route.points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))) {
      errors.push(`Route ${index + 1}: coordenadas precisam ser inteiras.`);
      return;
    }
    for (let pointIndex = 1; pointIndex < route.points.length; pointIndex++) {
      const a = route.points[pointIndex - 1]!;
      const b = route.points[pointIndex]!;
      if (a.x !== b.x && a.y !== b.y) errors.push(`Route ${index + 1}: segmento ${pointIndex}→${pointIndex + 1} precisa ser ortogonal.`);
    }
    const resolved = resolveByIdOrName(route.smartPath, smartPaths);
    if (!resolved.item) {
      errors.push(resolved.ambiguous
        ? `Route ${index + 1}: nome ambíguo “${route.smartPath}”; use o id.`
        : `Route ${index + 1}: Smart Path “${route.smartPath}” não existe.`);
      return;
    }
    const preset = resolved.item;
    elements.push({ type: "smartPath", presetId: preset.id, points: route.points.map((point) => ({ ...point })), mode: route.mode ?? "add" });
    scopes.push(preset.scope);
    resolvedSmartPaths.push({ reference: route.smartPath, id: preset.id, name: preset.name });
  });

  if (errors.length) return { valid: false, template: null, errors, warnings, resolvedPatterns, resolvedSmartPaths };
  const template = createMapTemplate(blueprint.name, blueprint.width, blueprint.height, commonScope(scopes));
  template.category = blueprint.category?.trim() || "Blueprint";
  template.tags = [...(blueprint.tags ?? [])];
  template.elements = elements;
  template.updatedAt = new Date().toISOString();
  if (scopes.some(Boolean) && !template.scope) warnings.push("Dependências usam escopos de tileset diferentes; o template foi criado sem escopo global e continuará validando cada dependência individualmente.");
  return { valid: true, template, errors, warnings, resolvedPatterns, resolvedSmartPaths };
}

export function blueprintExample(patternName = "Casa Rural", smartPathName = "Estrada de Terra"): string {
  const example: MapBlueprint = {
    format: MAP_BLUEPRINT_FORMAT,
    name: "Vila rural — exemplo",
    category: "Vila",
    tags: ["rural", "exemplo"],
    width: 30,
    height: 24,
    patterns: [
      { pattern: patternName, x: 4, y: 5 },
      { pattern: patternName, x: 20, y: 5 },
    ],
    routes: [
      { smartPath: smartPathName, points: [{ x: 2, y: 14 }, { x: 26, y: 14 }, { x: 26, y: 20 }] },
    ],
  };
  return `${JSON.stringify(example, null, 2)}\n`;
}

export function blueprintAiContract(patterns: MapPattern[], smartPaths: SmartPathPreset[]): string {
  const patternList = patterns.map((pattern) => `- ${pattern.name} [id=${pattern.id}, ${pattern.width}x${pattern.height}]`).join("\n") || "- (nenhum padrão cadastrado)";
  const pathList = smartPaths.map((preset) => `- ${preset.name} [id=${preset.id}]`).join("\n") || "- (nenhum Smart Path cadastrado)";
  return `Você é um planejador de mapas GBA para Pokémon Juramento de Arauna. Responda APENAS com JSON válido no formato ${MAP_BLUEPRINT_FORMAT}. Não invente nomes ou IDs. Use somente os padrões e Smart Paths listados abaixo. Coordenadas são em metatiles, origem (0,0) no canto superior esquerdo. Rotas devem usar segmentos ortogonais.\n\nPadrões disponíveis:\n${patternList}\n\nSmart Paths disponíveis:\n${pathList}\n\nSchema mínimo:\n{\n  "format": "${MAP_BLUEPRINT_FORMAT}",\n  "name": "...",\n  "category": "...",\n  "tags": [],\n  "width": 30,\n  "height": 24,\n  "patterns": [{"pattern":"nome-ou-id","x":0,"y":0}],\n  "routes": [{"smartPath":"nome-ou-id","mode":"add","points":[{"x":0,"y":0},{"x":0,"y":5}]}]\n}`;
}
