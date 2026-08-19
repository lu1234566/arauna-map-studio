import { useEffect, useSyncExternalStore } from "react";
import { clipboardStore } from "./clipboardStore";
import { editorStore } from "./editorStore";
import { getCollision, getElevation, idx, rawValue } from "./emeraldMap";
import {
  clipboardFromPattern,
  parseMapPatternJson,
  patternFromClipboard,
  serializeMapPatterns,
  validateMapPattern,
  type MapPattern,
  type PatternScope,
} from "./patternLibrary";
import { realAtlasStore } from "./realAtlasStore";
import { smartPathStore } from "./smartPathStore";

const STORAGE_KEY = "arauna.patternLibrary.v1";

type Listener = () => void;

export interface PatternLibraryState {
  patterns: MapPattern[];
  activePatternId: string | null;
  enabled: boolean;
  panelOpen: boolean;
  hydrated: boolean;
  lastMessage: string;
}

function currentAtlasScope(): PatternScope | undefined {
  const atlas = realAtlasStore.ensureHydrated();
  if (!atlas) return undefined;
  return { primary: atlas.primary, secondary: atlas.secondary };
}

function clonePattern(pattern: MapPattern): MapPattern {
  return {
    ...pattern,
    values: [...pattern.values],
    tags: [...pattern.tags],
    ...(pattern.scope ? { scope: { ...pattern.scope } } : {}),
  };
}

function nextUniqueId(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let id = "";
  do {
    id = `pattern-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

class PatternLibraryStore {
  private state: PatternLibraryState = {
    patterns: [],
    activePatternId: null,
    enabled: false,
    panelOpen: false,
    hydrated: false,
    lastMessage: "Biblioteca de padrões pronta.",
  };

  private listeners = new Set<Listener>();

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<PatternLibraryState>, persist = true) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
    if (persist) this.persist();
  }

  private persist() {
    if (typeof window === "undefined" || !this.state.hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          patterns: this.state.patterns,
          activePatternId: this.state.activePatternId,
        }),
      );
    } catch {
      /* biblioteca continua em memória em modo privado/quota cheia */
    }
  }

  hydrate = () => {
    if (this.state.hydrated || typeof window === "undefined") return;
    let patterns: MapPattern[] = [];
    let activePatternId: string | null = null;
    try {
      const source = localStorage.getItem(STORAGE_KEY);
      if (source) {
        const parsed = JSON.parse(source) as Record<string, unknown>;
        const rawPatterns = Array.isArray(parsed.patterns) ? parsed.patterns : [];
        patterns = rawPatterns.flatMap((value) => {
          try {
            const candidate = parseMapPatternJson(JSON.stringify(value))[0];
            return candidate ? [candidate] : [];
          } catch {
            return [];
          }
        });
        const candidate = typeof parsed.activePatternId === "string" ? parsed.activePatternId : null;
        activePatternId = candidate && patterns.some((pattern) => pattern.id === candidate)
          ? candidate
          : patterns[0]?.id ?? null;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.set({ patterns, activePatternId, hydrated: true }, false);
  };

  activePattern = (): MapPattern | null => {
    this.hydrate();
    return this.state.patterns.find((pattern) => pattern.id === this.state.activePatternId) ?? null;
  };

  saveClipboardAsPattern = (name?: string, category = "Geral") => {
    this.hydrate();
    const clipboard = clipboardStore.getState().clipboard;
    if (!clipboard) {
      const message = "Copie uma região antes de salvá-la na Biblioteca de Padrões.";
      editorStore.setMessage(message);
      this.set({ panelOpen: true, lastMessage: message }, false);
      return null;
    }
    const scope = clipboard.kind === "visual" || clipboard.kind === "raw"
      ? currentAtlasScope()
      : undefined;
    const pattern = patternFromClipboard(
      clipboard,
      name?.trim() || `Padrão ${this.state.patterns.length + 1}`,
      category,
      scope,
    );
    const message = `Padrão “${pattern.name}” salvo (${pattern.width}×${pattern.height}, ${pattern.kind}).`;
    this.set({
      patterns: [...this.state.patterns, pattern],
      activePatternId: pattern.id,
      panelOpen: true,
      lastMessage: message,
    });
    editorStore.setMessage(message);
    return pattern.id;
  };

  selectPattern = (id: string) => {
    if (!this.state.patterns.some((pattern) => pattern.id === id)) return;
    this.set({ activePatternId: id, enabled: false });
  };

  private updateActive(mutator: (pattern: MapPattern) => MapPattern) {
    const active = this.activePattern();
    if (!active) return;
    const next = mutator(clonePattern(active));
    next.updatedAt = new Date().toISOString();
    const validation = validateMapPattern(next);
    if (!validation.valid) {
      editorStore.setMessage(`Padrão inválido: ${validation.errors[0]}`);
      return;
    }
    this.set({
      patterns: this.state.patterns.map((pattern) => pattern.id === next.id ? next : pattern),
      enabled: false,
    });
  }

  renameActive = (name: string) => this.updateActive((pattern) => ({ ...pattern, name }));
  setCategory = (category: string) => this.updateActive((pattern) => ({ ...pattern, category }));
  setTags = (tags: string[]) => this.updateActive((pattern) => ({ ...pattern, tags }));

  duplicateActive = () => {
    const active = this.activePattern();
    if (!active) return null;
    const now = new Date().toISOString();
    const duplicate: MapPattern = {
      ...clonePattern(active),
      id: `pattern-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${active.name} — cópia`,
      createdAt: now,
      updatedAt: now,
    };
    this.set({
      patterns: [...this.state.patterns, duplicate],
      activePatternId: duplicate.id,
      enabled: false,
      panelOpen: true,
    });
    return duplicate.id;
  };

  deleteActive = () => {
    const active = this.activePattern();
    if (!active) return;
    const patterns = this.state.patterns.filter((pattern) => pattern.id !== active.id);
    const message = `Padrão “${active.name}” removido.`;
    this.set({
      patterns,
      activePatternId: patterns[0]?.id ?? null,
      enabled: false,
      lastMessage: message,
    });
    editorStore.setMessage(message);
  };

  bindScopeToCurrentAtlas = () => {
    const atlas = currentAtlasScope();
    if (!atlas) {
      editorStore.setMessage("Carregue um atlas real antes de vincular este padrão.");
      return false;
    }
    this.updateActive((pattern) => ({ ...pattern, scope: atlas }));
    editorStore.setMessage(`Padrão vinculado a ${atlas.primary} + ${atlas.secondary}.`);
    return true;
  };

  scopeStatus = (pattern = this.activePattern()) => {
    if (!pattern?.scope) return { matches: true, message: "Padrão sem vínculo de tileset." };
    const atlas = currentAtlasScope();
    if (!atlas) return { matches: false, message: "Atlas real não carregado." };
    const matches = pattern.scope.primary === atlas.primary && pattern.scope.secondary === atlas.secondary;
    return {
      matches,
      message: matches
        ? `${atlas.primary} + ${atlas.secondary}`
        : `Padrão: ${pattern.scope.primary} + ${pattern.scope.secondary}; atlas: ${atlas.primary} + ${atlas.secondary}`,
    };
  };

  setPanelOpen = (panelOpen: boolean) => this.set({ panelOpen }, false);

  setEnabled = (enabled: boolean) => {
    this.hydrate();
    if (enabled) {
      const pattern = this.activePattern();
      if (!pattern) {
        editorStore.setMessage("Salve ou importe um padrão antes de ativar a Biblioteca." );
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      const validation = validateMapPattern(pattern);
      if (!validation.valid) {
        editorStore.setMessage(`Padrão inválido: ${validation.errors[0]}`);
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      const scope = this.scopeStatus(pattern);
      if (pattern.scope && !scope.matches) {
        editorStore.setMessage(`Padrão não ativado: ${scope.message}`);
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      if (smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
      if (clipboardStore.getState().stampMode) clipboardStore.toggleStampMode(false);
      if (pattern.kind === "visual" || pattern.kind === "raw") editorStore.setViewMode("visual");
      else editorStore.setViewMode(pattern.kind);
    }
    const pattern = this.activePattern();
    const message = enabled
      ? `Padrão “${pattern?.name ?? ""}” ativo — clique/arraste para carimbar.`
      : "Biblioteca de padrões: carimbo desativado.";
    this.set({ enabled, lastMessage: message }, false);
    editorStore.setMessage(message);
    return enabled;
  };

  toggleEnabled = () => this.setEnabled(!this.state.enabled);

  private wouldChange(pattern: MapPattern, sourceIndex: number, targetIndex: number) {
    const map = editorStore.getState().map;
    const value = pattern.values[sourceIndex] ?? 0;
    if (pattern.kind === "visual") return (map.metatiles[targetIndex] ?? 0) !== value;
    if (pattern.kind === "collision") return getCollision(map.physical[targetIndex] ?? 0) !== value;
    if (pattern.kind === "elevation") return getElevation(map.physical[targetIndex] ?? 0) !== value;
    return rawValue(map, targetIndex) !== value;
  }

  private applyLayer(pattern: MapPattern, targetX: number, targetY: number) {
    const before = editorStore.getState();
    const layer = pattern.kind as "visual" | "collision" | "elevation";
    editorStore.setViewMode(layer);
    let touched = 0;
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const tx = targetX + x;
        const ty = targetY + y;
        const state = editorStore.getState();
        if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
        if (editorStore.isProtected(tx, ty)) continue;
        const value = pattern.values[idx(x, y, pattern.width)] ?? 0;
        if (layer === "visual") editorStore.setMetatile(value);
        else if (layer === "collision") editorStore.setCollision(value);
        else editorStore.setElevation(value);
        editorStore.paint(tx, ty, true);
        touched++;
      }
    }
    editorStore.setViewMode(before.viewMode);
    editorStore.setMetatile(before.selectedMetatile);
    editorStore.setCollision(before.selectedCollision);
    editorStore.setElevation(before.selectedElevation);
    return touched;
  }

  private applyRaw(pattern: MapPattern, targetX: number, targetY: number) {
    const before = editorStore.getState();
    let touched = 0;
    for (const layer of ["visual", "collision", "elevation"] as const) {
      editorStore.setViewMode(layer);
      for (let y = 0; y < pattern.height; y++) {
        for (let x = 0; x < pattern.width; x++) {
          const tx = targetX + x;
          const ty = targetY + y;
          const state = editorStore.getState();
          if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
          if (editorStore.isProtected(tx, ty)) continue;
          const raw = pattern.values[idx(x, y, pattern.width)] ?? 0;
          if (layer === "visual") editorStore.setMetatile(raw & 0x03ff);
          else if (layer === "collision") editorStore.setCollision((raw >> 10) & 3);
          else editorStore.setElevation((raw >> 12) & 15);
          editorStore.paint(tx, ty, true);
          if (layer === "visual") touched++;
        }
      }
    }
    editorStore.setViewMode(before.viewMode);
    editorStore.setMetatile(before.selectedMetatile);
    editorStore.setCollision(before.selectedCollision);
    editorStore.setElevation(before.selectedElevation);
    return touched;
  }

  applyAt = (targetX: number, targetY: number, continuous = false) => {
    if (!this.state.enabled) return 0;
    const pattern = this.activePattern();
    if (!pattern) return 0;
    const scope = this.scopeStatus(pattern);
    if (pattern.scope && !scope.matches) {
      this.setEnabled(false);
      return 0;
    }
    const map = editorStore.getState().map;
    let candidates = 0;
    let changed = 0;
    let protectedCount = 0;
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        const tx = targetX + x;
        const ty = targetY + y;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (editorStore.isProtected(tx, ty)) {
          protectedCount++;
          continue;
        }
        candidates++;
        if (this.wouldChange(pattern, idx(x, y, pattern.width), idx(tx, ty, map.width))) changed++;
      }
    }
    if (!candidates || !changed) return 0;
    if (!continuous) editorStore.beginStroke();
    const touched = pattern.kind === "raw"
      ? this.applyRaw(pattern, targetX, targetY)
      : this.applyLayer(pattern, targetX, targetY);
    if (targetX >= 0 && targetY >= 0 && targetX < map.width && targetY < map.height) {
      editorStore.selectCell(idx(targetX, targetY, map.width));
    }
    const message = `Padrão “${pattern.name}” aplicado em (${targetX},${targetY})${protectedCount ? `; ${protectedCount} protegida(s)` : ""}.`;
    this.set({ lastMessage: message }, false);
    editorStore.setMessage(message);
    return touched;
  };

  exportActiveJson = () => {
    const pattern = this.activePattern();
    return pattern ? serializeMapPatterns([pattern]) : null;
  };

  exportAllJson = () => this.state.patterns.length ? serializeMapPatterns(this.state.patterns) : null;

  importJson = (source: string) => {
    this.hydrate();
    try {
      const incoming = parseMapPatternJson(source);
      const used = new Set(this.state.patterns.map((pattern) => pattern.id));
      const patterns = incoming.map((pattern) => ({
        ...pattern,
        id: nextUniqueId(pattern.id, used),
        updatedAt: new Date().toISOString(),
      }));
      const message = `${patterns.length} padrão(ões) importado(s).`;
      this.set({
        patterns: [...this.state.patterns, ...patterns],
        activePatternId: patterns[0]?.id ?? this.state.activePatternId,
        enabled: false,
        panelOpen: true,
        lastMessage: message,
      });
      editorStore.setMessage(message);
      return { ok: true as const, count: patterns.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      editorStore.setMessage(`Falha ao importar padrões: ${message}`);
      return { ok: false as const, message };
    }
  };

  copyActiveToClipboard = () => {
    const pattern = this.activePattern();
    if (!pattern) return null;
    const clipboard = clipboardFromPattern(pattern);
    // RegionClipboard é retornado para consumidores que queiram integrar com o
    // clipboard; o carimbo persistente do Pattern Library não depende disso.
    return clipboard;
  };
}

export const patternLibraryStore = new PatternLibraryStore();

export function usePatternLibrary(): PatternLibraryState {
  const state = useSyncExternalStore(
    patternLibraryStore.subscribe,
    patternLibraryStore.getState,
    patternLibraryStore.getState,
  );
  useEffect(() => patternLibraryStore.hydrate(), []);
  return state;
}
