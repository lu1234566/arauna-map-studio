import { getCollision, getElevation, type MapData } from "./emeraldMap";
import { gameReadyStructureConflicts } from "./aiMapGameReady";
import { refineAiMapDistricts } from "./aiMapDistrictRefinement";
import { polishAiMapFragments } from "./aiMapFragmentPolish";
import { planAiMapIdentityBase } from "./aiMapIdentity";
import { finishLayeredPromptMap, planLayeredPromptBase } from "./aiLayeredPrompt";
import type { AiMapCompileResult, AiMapPlan } from "./aiMapPlan";
import {
  isAiRemodelPrompt,
  planAiMapReconstruction,
  type AiMapReconstructionPlan,
} from "./aiMapReconstruction";
import type { AiReservedCell } from "./aiMapReservedCells";
import { editorStore } from "./editorStore";
import type { MapBlueprint } from "./mapBlueprint";
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
 * Durante remodelagem ampla clássica limitamos cada família a dois patches.
 * O pipeline por camadas não usa esse limite: o finish layer decide deterministicamente
 * quais detalhes podem sobreviver dentro de cada zona.
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

function effectiveBlueprintForTemplate(blueprint: MapBlueprint | null, template: MapTemplate) {
  if (!blueprint) return null;
  const counts = new Map<string, number>();
  for (const element of template.elements) {
    if (element.type !== "pattern") continue;
    const key = `${element.patternId}@${element.x},${element.y}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const patterns = blueprint.patterns.filter((placement) => {
    const key = `${placement.pattern}@${placement.x},${placement.y}`;
    const remaining = counts.get(key) ?? 0;
    if (!remaining) return false;
    counts.set(key, remaining - 1);
    return true;
  });
  return { ...blueprint, patterns };
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

  const reconstructionEnabled = Boolean(editor.mapJsonDocument && isAiRemodelPrompt(prompt));
  const reconstruction = reconstructionEnabled
    ? planAiMapReconstruction(editor.map, atlas, patterns, reservedCells, smartPaths)
    : null;
  const reconstructedMap = reconstruction?.map ?? editor.map;
  const identity = reconstructionEnabled && reconstruction
    ? planAiMapIdentityBase(reconstructedMap, atlas, patterns, reservedCells, reconstruction)
    : null;

  const layered = reconstructionEnabled && reconstruction
    ? planLayeredPromptBase(
        editor.map,
        prompt,
        atlas,
        patterns,
        reservedCells,
        reconstruction,
        identity?.portMetatile ?? null,
        compiled.blueprint,
      )
    : null;
  if (layered?.active && layered.errors.length) {
    return {
      ok: false,
      message: `Aplicação bloqueada pelo compilador de camadas: ${layered.errors.slice(0, 3).join(" ")}`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
      reconstruction,
    };
  }

  const sourceMap = layered?.active ? layered.map : identity?.map ?? reconstructedMap;
  const effective = reconstructionEnabled && !layered?.active
    ? limitContextPatches(compiled.template, patterns)
    : { template: compiled.template, removed: 0 };

  if (editor.mapJsonDocument) {
    const effectiveBlueprint = effectiveBlueprintForTemplate(compiled.blueprint, effective.template);
    const conflicts = gameReadyStructureConflicts(effectiveBlueprint, patterns, reservedCells);
    if (conflicts.length) {
      return {
        ok: false,
        message: `Aplicação bloqueada pela segurança de mapa real: ${conflicts.slice(0, 3).join(" ")}`,
        changes: 0,
        topologyApplied: 0,
        topologyPending: 0,
        reconstruction,
      };
    }
  }

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

  const districts = !layered?.active && reconstructionEnabled && reconstruction
    ? refineAiMapDistricts(
        templatePlan.map,
        atlas,
        patterns,
        reservedCells,
        smartPaths,
        reconstruction,
        identity?.portMetatile ?? null,
      )
    : null;
  const districtMap = districts?.map ?? templatePlan.map;
  const layeredFinish = layered?.active
    ? finishLayeredPromptMap(districtMap, layered, atlas, smartPaths)
    : null;
  const finishedMap = layeredFinish?.map ?? districtMap;

  const surfaces = [
    reconstruction?.baseMetatile,
    reconstruction?.urbanMetatile,
    reconstruction?.greenMetatile,
    identity?.portMetatile,
  ];
  const polish = reconstructionEnabled && !layered?.active
    ? polishAiMapFragments(finishedMap, atlas, patterns, reservedCells, surfaces)
    : null;
  const finalMap = polish?.map ?? finishedMap;
  const touched = layered?.active
    ? [
        ...layered.touched,
        ...templatePlan.touched,
        ...(layeredFinish?.touched ?? []),
      ]
    : [
        ...(reconstruction?.touched ?? []),
        ...(identity?.touched ?? []),
        ...templatePlan.touched,
        ...(districts?.touched ?? []),
        ...(polish?.touched ?? []),
      ];
  const changes = applyTargetMap(finalMap, touched);

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

  const layeredText = layered?.active
    ? ` Zone-first: ${layered.parsed.zones.filter((zone) => zone.kind === "ground").length} zona(s) de solo e ${layered.parsed.zones.filter((zone) => zone.kind === "road").length} corredor(es) controlaram ${layered.assignedCount}/${layered.eligibleCount} célula(s) editáveis; ${layered.unsetCount} permaneceram UNSET/preservadas.`
    : "";
  const finishText = layeredFinish?.active
    ? ` Finish layer: ${layeredFinish.enforcedCount} célula(s) foram reimpostas ao material exato da zona, ${layeredFinish.pathPreservedCount} célula(s) de via e ${layeredFinish.detailPreservedCount} célula(s) de detalhe permitido foram preservadas.`
    : "";
  const detailText = layered?.active && (layered.detailPreservedCount || layered.detailRejectedCount)
    ? ` Detalhes: ${layered.detailPreservedCount} placement(s) contextual(is) respeitaram sua zona e ${layered.detailRejectedCount} foram rejeitados por material/posição.`
    : "";
  const reconstructionText = reconstructionEnabled && !layered?.active
    ? reconstruction?.changedCount
      ? ` Reconstrução contextual: ${reconstruction.changedCount} célula(s) normalizadas antes da composição (${reconstruction.urbanChangedCount} urbanas, ${reconstruction.greenChangedCount} verdes, ${reconstruction.baseChangedCount} de base comum).`
      : ` Reconstrução de base ativada, sem células seguras para normalizar.${reconstruction?.warnings.length ? ` ${reconstruction.warnings[0]}` : ""}`
    : "";
  const identityText = !layered?.active && identity?.active && (identity.portChangedCount || identity.greenExpandedCount)
    ? ` Identidade portuária: ${identity.portChangedCount} acento(s) de porto e ${identity.greenExpandedCount} expansão(ões) verdes.`
    : "";
  const districtText = !layered?.active && districts?.active && (districts.greenAddedCount || districts.urbanShoulderCount || districts.portPromenadeCount)
    ? ` Quadras pós-vias: ${districts.urbanShoulderCount} célula(s) de calçadas/aproximações urbanas, ${districts.greenAddedCount} célula(s) verdes e ${districts.portPromenadeCount} célula(s) de promenade, preservando ${districts.pathCorridorCount} célula(s) de circulação.`
    : "";
  const polishText = polish && (polish.clearedCount || polish.islandClearedCount || polish.layeredPreservedCount)
    ? ` Vizinhança GBA: ${polish.clearedCount} fragmento(s) contextual(is), ${polish.islandClearedCount} célula(s) de ilhas colidíveis isoladas removidas e ${polish.layeredPreservedCount} overlay(s) layered com suporte real preservado(s).`
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
    message: `Mapa aplicado: ${changes} alteração(ões) de tile/camada.${layeredText}${finishText}${detailText}${reconstructionText}${identityText}${districtText}${polishText}${contextText}${topologyText}`,
    changes,
    topologyApplied,
    topologyPending,
    reconstruction,
  };
}
