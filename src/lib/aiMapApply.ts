import { getCollision, getElevation, type MapData } from "./emeraldMap";
import { gameReadyStructureConflicts } from "./aiMapGameReady";
import type { AiMapCompileResult, AiMapPlan } from "./aiMapPlan";
import {
  isAiRemodelPrompt,
  planAiMapReconstruction,
  type AiMapReconstructionPlan,
} from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import { editorStore } from "./editorStore";
import { planMapTemplate, serializeMapTemplates, type MapTemplate } from "./mapTemplate";
import { mapTemplateStore } from "./mapTemplateStore";
import type { MapPattern } from "./patternLibrary";
import type { SavedRealAtlas } from "./realAtlasStore";
import type { SmartPathPreset } from "./smartPath";

const CONNECTION_DIRECTION = {
  north: "up",
  east: "right",
  south: "down",
  west: "left",
} as const;

const CONTEXT_PATCH_LIMIT = 2;

type ContextPatchKind = "urban" | "green" | "coast";

export interface ApplyAiMapResult {
  ok: boolean;
  message: string;
  changes: number;
  topologyApplied: number;
  topologyPending: number;
  reconstruction: AiMapReconstructionPlan | null;
}

function connectionIndex(direction: string) {
  const document = editorStore.getState().mapJsonDocument;
  const source = document?.["connections"];
  const connections = Array.isArray(source) ? source : [];
  return connections.findIndex((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return String((value as Record<string, unknown>)["direction"] ?? "") === direction;
  });
}

function contextPatchKind(pattern: MapPattern): ContextPatchKind | null {
  const id = pattern.id.toLowerCase();
  const tags = (pattern.tags ?? []).map((tag) => tag.toLowerCase());
  if (!tags.includes("extraído do mapa") && !tags.includes("extraido do mapa")) return null;
  if (id.includes("-urban-") || tags.some((tag) => tag === "rua" || tag === "cidade" || tag === "urbanismo")) return "urban";
  if (id.includes("-green-") || tags.some((tag) => tag === "vegetação" || tag === "vegetacao" || tag === "verde")) return "green";
  if (id.includes("-coast-") || tags.some((tag) => tag === "costa" || tag === "litoral")) return "coast";
  return null;
}

/**
 * Recortes RAW de contexto são úteis como acento, não como textura de preenchimento.
 * Durante remodelagem ampla limitamos cada família a dois patches; prédios com
 * warp-anchor/fixed-origin e demais Patterns semânticos não entram no limite.
 */
function limitContextPatches(template: MapTemplate, patterns: MapPattern[]) {
  const byId = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  const used: Record<ContextPatchKind, number> = { urban: 0, green: 0, coast: 0 };
  let removed = 0;
  const elements = template.elements.filter((element) => {
    if (element.type !== "pattern") return true;
    const pattern = byId.get(element.patternId);
    if (!pattern) return true;
    const kind = contextPatchKind(pattern);
    if (!kind) return true;
    if (used[kind] >= CONTEXT_PATCH_LIMIT) {
      removed++;
      return false;
    }
    used[kind]++;
    return true;
  });
  return {
    template: removed ? { ...template, elements } : template,
    removed,
  };
}

function applyTargetMap(targetMap: MapData, touched: number[]) {
  const before = editorStore.getState();
  if (targetMap.width !== before.map.width || targetMap.height !== before.map.height) return 0;

  const indices = Array.from(new Set(touched)).filter((cellIndex) => {
    if (cellIndex < 0 || cellIndex >= before.map.metatiles.length) return false;
    return (
      before.map.metatiles[cellIndex] !== targetMap.metatiles[cellIndex]
      || before.map.physical[cellIndex] !== targetMap.physical[cellIndex]
    );
  });
  if (!indices.length) return 0;

  editorStore.beginStroke();
  const oldView = before.viewMode;
  const oldMetatile = before.selectedMetatile;
  const oldCollision = before.selectedCollision;
  const oldElevation = before.selectedElevation;
  let changes = 0;

  for (const cellIndex of indices) {
    const x = cellIndex % before.map.width;
    const y = Math.floor(cellIndex / before.map.width);
    const desiredMetatile = targetMap.metatiles[cellIndex] ?? 0;
    const currentMetatile = editorStore.getState().map.metatiles[cellIndex] ?? 0;
    if (currentMetatile !== desiredMetatile) {
      editorStore.setViewMode("visual");
      editorStore.setMetatile(desiredMetatile);
      editorStore.paint(x, y, true);
      changes++;
    }

    const desiredCollision = getCollision(targetMap.physical[cellIndex] ?? 0);
    const currentCollision = getCollision(editorStore.getState().map.physical[cellIndex] ?? 0);
    if (currentCollision !== desiredCollision) {
      editorStore.setViewMode("collision");
      editorStore.setCollision(desiredCollision);
      editorStore.paint(x, y, true);
      changes++;
    }

    const desiredElevation = getElevation(targetMap.physical[cellIndex] ?? 0);
    const currentElevation = getElevation(editorStore.getState().map.physical[cellIndex] ?? 0);
    if (currentElevation !== desiredElevation) {
      editorStore.setViewMode("elevation");
      editorStore.setElevation(desiredElevation);
      editorStore.paint(x, y, true);
      changes++;
    }
  }

  editorStore.setViewMode(oldView);
  editorStore.setMetatile(oldMetatile);
  editorStore.setCollision(oldCollision);
  editorStore.setElevation(oldElevation);
  return changes;
}

export function applyCompiledAiMap({
  prompt,
  plan,
  compiled,
  atlas,
  patterns,
  smartPaths,
  reservedCells,
}: {
  prompt: string;
  plan: AiMapPlan;
  compiled: AiMapCompileResult;
  atlas: SavedRealAtlas | null;
  patterns: MapPattern[];
  smartPaths: SmartPathPreset[];
  reservedCells: AiReservedCell[];
}): ApplyAiMapResult {
  const editor = editorStore.getState();
  if (!compiled.valid || !compiled.template) {
    return {
      ok: false,
      message: "O plano ainda não está compilável.",
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
      reconstruction: null,
    };
  }
  if (plan.width !== editor.map.width || plan.height !== editor.map.height) {
    return {
      ok: false,
      message: `O plano mede ${plan.width}×${plan.height}, mas o mapa aberto mede ${editor.map.width}×${editor.map.height}.`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
      reconstruction: null,
    };
  }

  if (editor.mapJsonDocument) {
    const conflicts = gameReadyStructureConflicts(compiled.blueprint, patterns, reservedCells);
    if (conflicts.length) {
      return {
        ok: false,
        message: `Aplicação bloqueada pela segurança de mapa real: ${conflicts.slice(0, 3).join(" ")}`,
        changes: 0,
        topologyApplied: 0,
        topologyPending: 0,
        reconstruction: null,
      };
    }
  }

  const reconstructionEnabled = Boolean(editor.mapJsonDocument && isAiRemodelPrompt(prompt));
  const reconstruction = reconstructionEnabled
    ? planAiMapReconstruction(editor.map, atlas, patterns, reservedCells)
    : null;
  const sourceMap = reconstruction?.map ?? editor.map;
  const effective = reconstructionEnabled
    ? limitContextPatches(compiled.template, patterns)
    : { template: compiled.template, removed: 0 };
  const currentScope = atlas ? { primary: atlas.primary, secondary: atlas.secondary } : undefined;
  const templatePlan = planMapTemplate(
    sourceMap,
    effective.template,
    0,
    0,
    patterns,
    smartPaths,
    currentScope,
    (x, y) => !editorStore.isProtected(x, y),
  );
  if (!templatePlan.valid) {
    return {
      ok: false,
      message: `Template final inválido: ${templatePlan.errors[0] ?? "falha de planejamento."}`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
      reconstruction,
    };
  }

  const imported = mapTemplateStore.importJson(serializeMapTemplates([effective.template]));
  if (!imported.ok) {
    return {
      ok: false,
      message: `Falha ao salvar Template: ${imported.message}`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
      reconstruction,
    };
  }
  mapTemplateStore.setEnabled(false);
  mapTemplateStore.setPanelOpen(false);

  const touched = [
    ...(reconstruction?.touched ?? []),
    ...templatePlan.touched,
  ];
  const changes = applyTargetMap(templatePlan.map, touched);

  let topologyApplied = 0;
  let topologyPending = 0;
  if (editorStore.getState().mapJsonDocument) {
    for (const warp of compiled.warps) {
      const existing = editorStore.getState().events.find(
        (event) => event.source === "warp" && event.x === warp.x && event.y === warp.y,
      );
      const id = existing?.id ?? editorStore.createEvent("warp", warp.x, warp.y);
      if (!id) continue;
      editorStore.updateEventField(id, "dest_map", warp.destMap);
      editorStore.updateEventField(id, "dest_warp_id", warp.destWarpId);
      topologyApplied++;
    }
    for (const connection of compiled.connections) {
      const direction = CONNECTION_DIRECTION[connection.direction];
      let index = connectionIndex(direction);
      if (index < 0) {
        const created = editorStore.createConnection(direction);
        if (created == null) continue;
        index = created;
      }
      editorStore.updateConnection(index, "map", connection.map);
      editorStore.updateConnection(index, "offset", connection.offset);
      topologyApplied++;
    }
  } else {
    topologyPending = compiled.warps.length + compiled.connections.length;
  }

  const reconstructionText = reconstructionEnabled
    ? reconstruction?.changedCount
      ? ` Reconstrução de base: ${reconstruction.changedCount} célula(s) normalizadas antes da composição.`
      : ` Reconstrução de base ativada, sem células seguras para normalizar.${reconstruction?.warnings.length ? ` ${reconstruction.warnings[0]}` : ""}`
    : "";
  const contextText = effective.removed
    ? ` ${effective.removed} patch(es) RAW de contexto excedentes foram omitidos para evitar efeito mosaico.`
    : "";
  const topologyText = topologyPending
    ? ` ${topologyPending} warp/conexão ficaram pendentes porque este mapa ainda não tem map.json aberto.`
    : topologyApplied
      ? ` ${topologyApplied} warp/conexão foram criados ou atualizados no map.json.`
      : "";

  return {
    ok: true,
    message: `Mapa aplicado: ${changes} alteração(ões) de tile/camada.${reconstructionText}${contextText}${topologyText}`,
    changes,
    topologyApplied,
    topologyPending,
    reconstruction,
  };
}
