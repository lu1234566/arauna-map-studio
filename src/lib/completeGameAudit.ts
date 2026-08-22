import {
  buildCityBundle,
  type AraunaCityBundle,
  type FingerprintAtlas,
} from "./araunaCityBundle";
import { importedSharedEventsSnapshot } from "./bundleDependencyContext";
import {
  withScriptSpatialSnapshot,
  withSharedEventsSnapshot,
} from "./cityBundleDependencies";
import type { MapData } from "./emeraldMap";
import type { EditableMapJson } from "./eventMapJson";
import {
  auditGameImplementability,
  type GameImplementabilityReport,
  type ImplementabilityWorkspaceContext,
} from "./gameImplementability";
import { withActiveScriptSpatialAudit } from "./gameImplementabilityWithScripts";
import { getScriptSpatialContext } from "./scriptSpatialContext";
import {
  getWorkspaceAuditContext,
  sharedEventsContextKey,
} from "./workspaceAuditContext";

export interface CompleteGameAuditInput {
  map: MapData;
  mapJson: EditableMapJson | null;
  mapName?: string | null;
  atlas?: FingerprintAtlas | null;
}

export interface CompleteGameAuditResult {
  bundle: AraunaCityBundle | null;
  report: GameImplementabilityReport;
  workspaceContext: ImplementabilityWorkspaceContext | null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Só devolve o contexto global quando ele foi construído para a MESMA instância
 * de map.json atualmente auditada. Isso evita que um MAP_* reaberto/alterado
 * herde provas de atlas/warps coletadas antes da edição.
 */
function currentWorkspaceContext(
  document: EditableMapJson | null,
): ImplementabilityWorkspaceContext | null {
  if (!document) return null;
  const id = text(document.id);
  const context = getWorkspaceAuditContext();
  if (!id || !context || context.sourceMapId !== id) return null;
  if (context.maps[id]?.mapJson !== document) return null;
  return context;
}

/**
 * Monta o mesmo bundle completo usado por validação e exportação.
 *
 * - grid/mapJson/atlas vêm do estado atual;
 * - scripts.inc só entra se o contexto pertence à mesma instância de mapJson;
 * - shared events preferem a fonte atual do Workspace e usam o snapshot do
 *   bundle importado somente como fallback standalone;
 * - o relatório profundo recebe apenas contexto de Workspace não-stale;
 * - a camada espacial é aplicada por último sobre o mapa atual.
 */
export function auditCompleteGameState(
  input: CompleteGameAuditInput,
): CompleteGameAuditResult {
  const { map, mapJson, atlas } = input;
  const workspaceContext = currentWorkspaceContext(mapJson);
  let bundle: AraunaCityBundle | null = null;

  if (mapJson) {
    try {
      bundle = buildCityBundle({
        map,
        mapJson,
        mapName: input.mapName ?? null,
        atlas: atlas ?? null,
      });

      const scriptContext = getScriptSpatialContext();
      if (
        scriptContext &&
        scriptContext.sourceDocument === mapJson &&
        scriptContext.sourceMapId === text(mapJson.id) &&
        scriptContext.contracts &&
        !scriptContext.error &&
        scriptContext.source
      ) {
        bundle = {
          ...bundle,
          semantics: withScriptSpatialSnapshot(
            bundle.semantics,
            scriptContext.scriptMapName,
            scriptContext.sourcePath,
            scriptContext.source,
          ),
        };
      }

      const sharedName = text(mapJson.shared_events_map);
      if (sharedName) {
        const workspaceShared = workspaceContext?.maps[sharedEventsContextKey(sharedName)]?.mapJson ?? null;
        const importedShared = importedSharedEventsSnapshot(mapJson, sharedName)?.mapJson ?? null;
        const sharedDocument = workspaceShared ?? importedShared;
        if (sharedDocument) {
          bundle = {
            ...bundle,
            semantics: withSharedEventsSnapshot(
              bundle.semantics,
              sharedName,
              sharedDocument,
            ),
          };
        }
      }
    } catch {
      // O auditor principal explica campos/mapa inválidos; bundle=null garante
      // que round-trip jamais seja certificado por acidente.
      bundle = null;
    }
  }

  const base = auditGameImplementability({
    map,
    mapJson,
    atlas: atlas ?? null,
    bundle,
    declaredTilesets: bundle?.tilesets ?? null,
    workspaceContext,
  });

  return {
    bundle,
    report: withActiveScriptSpatialAudit(base, map, mapJson),
    workspaceContext,
  };
}
