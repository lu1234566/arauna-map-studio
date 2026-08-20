import { getCollision, getElevation, type MapData } from "./emeraldMap";
import type { AiExactGridPlan } from "./aiExactGrid";
import type { AiMapCompileResult } from "./aiMapPlan";
import { editorStore } from "./editorStore";
import { serializeMapTemplates } from "./mapTemplate";
import { mapTemplateStore } from "./mapTemplateStore";

const CONNECTION_DIRECTION = {
  north: "up",
  east: "right",
  south: "down",
  west: "left",
} as const;

export interface ApplyExactGridResult {
  ok: boolean;
  message: string;
  changes: number;
  topologyApplied: number;
  topologyPending: number;
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

function applyTargetMap(targetMap: MapData, touched: number[]) {
  const before = editorStore.getState();
  if (targetMap.width !== before.map.width || targetMap.height !== before.map.height) return 0;
  const indices = Array.from(new Set(touched)).filter((cellIndex) => (
    cellIndex >= 0
    && cellIndex < before.map.metatiles.length
    && (
      before.map.metatiles[cellIndex] !== targetMap.metatiles[cellIndex]
      || before.map.physical[cellIndex] !== targetMap.physical[cellIndex]
    )
  ));
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
    if ((editorStore.getState().map.metatiles[cellIndex] ?? 0) !== desiredMetatile) {
      editorStore.setViewMode("visual");
      editorStore.setMetatile(desiredMetatile);
      editorStore.paint(x, y, true);
      changes++;
    }

    const desiredCollision = getCollision(targetMap.physical[cellIndex] ?? 0);
    if (getCollision(editorStore.getState().map.physical[cellIndex] ?? 0) !== desiredCollision) {
      editorStore.setViewMode("collision");
      editorStore.setCollision(desiredCollision);
      editorStore.paint(x, y, true);
      changes++;
    }

    const desiredElevation = getElevation(targetMap.physical[cellIndex] ?? 0);
    if (getElevation(editorStore.getState().map.physical[cellIndex] ?? 0) !== desiredElevation) {
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

export function applyExactGridToEditor(
  grid: AiExactGridPlan,
  compiled: AiMapCompileResult,
): ApplyExactGridResult {
  const editor = editorStore.getState();
  if (!grid.active || !grid.valid) {
    return {
      ok: false,
      message: `Exact Grid inválido: ${grid.errors[0] ?? "a matriz ainda não foi validada."}`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
    };
  }
  if (grid.width !== editor.map.width || grid.height !== editor.map.height) {
    return {
      ok: false,
      message: `Exact Grid mede ${grid.width}×${grid.height}, mas o mapa aberto mede ${editor.map.width}×${editor.map.height}.`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
    };
  }
  if (grid.resolvedCount !== grid.totalCount) {
    return {
      ok: false,
      message: `Exact Grid incompleto: ${grid.resolvedCount}/${grid.totalCount} células resolvidas.`,
      changes: 0,
      topologyApplied: 0,
      topologyPending: 0,
    };
  }

  if (compiled.template) {
    const imported = mapTemplateStore.importJson(serializeMapTemplates([compiled.template]));
    if (!imported.ok) {
      return {
        ok: false,
        message: `Falha ao registrar Template do Exact Grid: ${imported.message}`,
        changes: 0,
        topologyApplied: 0,
        topologyPending: 0,
      };
    }
    mapTemplateStore.setEnabled(false);
    mapTemplateStore.setPanelOpen(false);
  }

  // A escrita usa exatamente o snapshot que foi mostrado no preview; nada é
  // recalculado durante o clique.
  const changes = applyTargetMap(grid.map, grid.touched);

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

  const topologyText = topologyPending
    ? ` ${topologyPending} warp/conexão ficaram pendentes porque não há map.json ativo.`
    : topologyApplied
      ? ` ${topologyApplied} warp/conexão foram mantidos/criados no map.json.`
      : "";

  return {
    ok: true,
    message:
      `Exact Grid aplicado: ${grid.resolvedCount}/${grid.totalCount} células validadas, `
      + `${grid.changedCount} célula(s) diferentes do mapa de origem, ${changes} alteração(ões) efetivas; `
      + `checksum ${grid.checksum}.${topologyText}`,
    changes,
    topologyApplied,
    topologyPending,
  };
}
