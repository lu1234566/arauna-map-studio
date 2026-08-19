import type { MapPattern, PatternScope } from "./patternLibrary";
import type { SmartPathPreset } from "./smartPath";
import type {
  ProceduralBlueprintResult,
  ProceduralBlueprintSpec,
  ProceduralPatternPlacement,
} from "./proceduralBlueprint";
import { generateSafeProceduralBlueprint } from "./proceduralBlueprintSafety";

export interface CandidateScoreBreakdown {
  landmarks: number;
  fillers: number;
  exits: number;
  landmarkConnections: number;
  cleanRun: number;
  total: number;
}

export interface ProceduralSeedCandidate {
  seed: string;
  index: number;
  result: ProceduralBlueprintResult;
  score: CandidateScoreBreakdown;
  quality: "Excelente" | "Bom" | "Parcial" | "Inválido";
}

function ratio(actual: number, requested: number) {
  if (requested <= 0) return 1;
  return Math.max(0, Math.min(1, actual / requested));
}

function countPlacements(result: ProceduralBlueprintResult, role: ProceduralPatternPlacement["role"]) {
  return result.placements.filter((placement) => placement.role === role).length;
}

function countExits(spec: ProceduralBlueprintSpec) {
  return Object.values(spec.exits).filter(Boolean).length;
}

export function scoreProceduralCandidate(
  spec: ProceduralBlueprintSpec,
  result: ProceduralBlueprintResult,
): CandidateScoreBreakdown {
  if (!result.ok) {
    return { landmarks: 0, fillers: 0, exits: 0, landmarkConnections: 0, cleanRun: 0, total: 0 };
  }

  const requestedLandmarks = spec.landmarkPatternIds.length;
  const placedLandmarks = countPlacements(result, "landmark");
  const requestedFillers = spec.fillerPatternIds.length ? spec.fillerCount : 0;
  const placedFillers = countPlacements(result, "filler");
  const requestedExits = spec.roadPresetId ? countExits(spec) : 0;
  const connectedExits = result.roads.filter((road) => road.kind === "exit").length;
  const requestedLandmarkConnections = spec.roadPresetId ? placedLandmarks : 0;
  const landmarkConnections = result.roads.filter((road) => road.kind === "landmark").length;

  const landmarks = Math.round(ratio(placedLandmarks, requestedLandmarks) * 30);
  const fillers = Math.round(ratio(placedFillers, requestedFillers) * 20);
  const exits = Math.round(ratio(connectedExits, requestedExits) * 20);
  const landmarkConnections = Math.round(ratio(landmarkConnections, requestedLandmarkConnections) * 20);
  const cleanRun = Math.max(0, 10 - Math.min(10, result.warnings.length * 2));
  const total = landmarks + fillers + exits + landmarkConnections + cleanRun;

  return { landmarks, fillers, exits, landmarkConnections, cleanRun, total };
}

export function candidateQuality(score: number): ProceduralSeedCandidate["quality"] {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Bom";
  if (score > 0) return "Parcial";
  return "Inválido";
}

export function candidateSeed(baseSeed: string, index: number): string {
  if (index === 0) return baseSeed || "arauna";
  return `${baseSeed || "arauna"}-${String(index + 1).padStart(2, "0")}`;
}

/**
 * BFS routing allocates arrays proportional to map area for each candidate.
 * Keep the gallery responsive on unusually large layouts instead of allowing
 * an accidental 24 × 512 × 512 search burst on the browser main thread.
 */
export function candidateBudget(spec: Pick<ProceduralBlueprintSpec, "width" | "height">, requested: number) {
  const area = Math.max(1, Math.floor(spec.width)) * Math.max(1, Math.floor(spec.height));
  const maxForArea = area > 65536 ? 4 : area > 16384 ? 8 : area > 4096 ? 16 : 24;
  return Math.max(1, Math.min(maxForArea, 24, Math.floor(requested)));
}

/**
 * Generates and ranks a small deterministic gallery of seeds. The first entry
 * always evaluates the user's current seed; later entries use stable suffixes.
 */
export function generateProceduralCandidates(
  spec: ProceduralBlueprintSpec,
  patterns: MapPattern[],
  smartPaths: SmartPathPreset[],
  currentScope?: PatternScope,
  count = 8,
): ProceduralSeedCandidate[] {
  const safeCount = candidateBudget(spec, count);
  const candidates = Array.from({ length: safeCount }, (_, index) => {
    const seed = candidateSeed(spec.seed, index);
    const candidateSpec: ProceduralBlueprintSpec = { ...spec, seed, exits: { ...spec.exits } };
    const result = generateSafeProceduralBlueprint(candidateSpec, patterns, smartPaths, currentScope);
    const score = scoreProceduralCandidate(candidateSpec, result);
    return {
      seed,
      index,
      result,
      score,
      quality: candidateQuality(score.total),
    } satisfies ProceduralSeedCandidate;
  });

  return candidates.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (a.result.warnings.length !== b.result.warnings.length) return a.result.warnings.length - b.result.warnings.length;
    return a.index - b.index;
  });
}
