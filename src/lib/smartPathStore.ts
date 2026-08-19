import { useEffect, useSyncExternalStore } from "react";
import { clipboardStore } from "./clipboardStore";
import { editorStore } from "./editorStore";
import { METATILE_MASK, idx } from "./emeraldMap";
import { realAtlasStore } from "./realAtlasStore";
import {
  SMART_PATH_FORMAT,
  createSmartPathPreset,
  planSmartPath,
  validateSmartPathPreset,
  type SmartPathMode,
  type SmartPathPreset,
  type SmartPathScope,
} from "./smartPath";

const STORAGE_KEY = "arauna.smartPaths.v1";

type Listener = () => void;

export interface SmartPathState {
  presets: SmartPathPreset[];
  activePresetId: string | null;
  enabled: boolean;
  mode: SmartPathMode;
  panelOpen: boolean;
  hydrated: boolean;
  lastMessage: string;
}

function clonePreset(preset: SmartPathPreset): SmartPathPreset {
  return {
    ...preset,
    variants: [...preset.variants],
    ...(preset.scope ? { scope: { ...preset.scope } } : {}),
  };
}

function currentAtlasScope(): SmartPathScope | undefined {
  const atlas = realAtlasStore.ensureHydrated();
  if (!atlas) return undefined;
  return { primary: atlas.primary, secondary: atlas.secondary };
}

function parsePreset(value: unknown): SmartPathPreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const variants = Array.isArray(raw.variants) ? raw.variants.map(Number) : [];
  const scopeRaw = raw.scope;
  const scope = scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)
    ? {
        primary: String((scopeRaw as Record<string, unknown>).primary ?? ""),
        secondary: String((scopeRaw as Record<string, unknown>).secondary ?? ""),
      }
    : undefined;
  const preset: SmartPathPreset = {
    format: SMART_PATH_FORMAT,
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    variants,
    eraseMetatile: Number(raw.eraseMetatile),
    ...(scope?.primary && scope.secondary ? { scope } : {}),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
  return validateSmartPathPreset(preset).valid ? preset : null;
}

function uniqueImportedId(base: string, reserved: Set<string>) {
  if (!reserved.has(base)) {
    reserved.add(base);
    return base;
  }
  let candidate = "";
  do {
    candidate = `smart-path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (reserved.has(candidate));
  reserved.add(candidate);
  return candidate;
}

class SmartPathStore {
  private state: SmartPathState = {
    presets: [],
    activePresetId: null,
    enabled: false,
    mode: "add",
    panelOpen: false,
    hydrated: false,
    lastMessage: "Smart Paths pronto.",
  };

  private listeners = new Set<Listener>();

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<SmartPathState>, persist = true) {
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
          presets: this.state.presets,
          activePresetId: this.state.activePresetId,
          mode: this.state.mode,
        }),
      );
    } catch {
      /* localStorage é conveniência; edição continua em memória */
    }
  }

  hydrate = () => {
    if (this.state.hydrated || typeof window === "undefined") return;
    let presets: SmartPathPreset[] = [];
    let activePresetId: string | null = null;
    let mode: SmartPathMode = "add";
    try {
      const source = localStorage.getItem(STORAGE_KEY);
      if (source) {
        const parsed = JSON.parse(source) as Record<string, unknown>;
        presets = Array.isArray(parsed.presets)
          ? parsed.presets.map(parsePreset).filter((preset): preset is SmartPathPreset => Boolean(preset))
          : [];
        const candidate = typeof parsed.activePresetId === "string" ? parsed.activePresetId : null;
        activePresetId = candidate && presets.some((preset) => preset.id === candidate)
          ? candidate
          : presets[0]?.id ?? null;
        mode = parsed.mode === "erase" ? "erase" : "add";
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.set({ presets, activePresetId, mode, hydrated: true }, false);
  };

  activePreset = (): SmartPathPreset | null => {
    this.hydrate();
    return this.state.presets.find((preset) => preset.id === this.state.activePresetId) ?? null;
  };

  createPreset = () => {
    this.hydrate();
    const selected = editorStore.getState().selectedMetatile & METATILE_MASK;
    const erase = selected === 0 ? 1 : 0;
    const preset = createSmartPathPreset(
      `Smart Path ${this.state.presets.length + 1}`,
      selected,
      erase,
      currentAtlasScope(),
    );
    const presets = [...this.state.presets, preset];
    const message = `Preset “${preset.name}” criado a partir do metatile ${selected}. Configure os 16 masks.`;
    this.set({
      presets,
      activePresetId: preset.id,
      panelOpen: true,
      lastMessage: message,
    });
    editorStore.setMessage(message);
    return preset.id;
  };

  duplicateActive = () => {
    const source = this.activePreset();
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: SmartPathPreset = {
      ...clonePreset(source),
      id: `smart-path-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${source.name} — cópia`,
      createdAt: now,
      updatedAt: now,
    };
    this.set({ presets: [...this.state.presets, copy], activePresetId: copy.id, panelOpen: true });
    return copy.id;
  };

  deleteActive = () => {
    const current = this.activePreset();
    if (!current) return;
    const presets = this.state.presets.filter((preset) => preset.id !== current.id);
    this.set({
      presets,
      activePresetId: presets[0]?.id ?? null,
      enabled: false,
      lastMessage: `Preset “${current.name}” removido.`,
    });
    editorStore.setMessage(`Smart Path “${current.name}” removido.`);
  };

  selectPreset = (id: string) => {
    if (!this.state.presets.some((preset) => preset.id === id)) return;
    this.set({ activePresetId: id, enabled: false });
  };

  private updateActive(mutator: (preset: SmartPathPreset) => SmartPathPreset) {
    const active = this.activePreset();
    if (!active) return;
    const next = mutator(clonePreset(active));
    next.updatedAt = new Date().toISOString();
    this.set({
      presets: this.state.presets.map((preset) => preset.id === next.id ? next : preset),
      enabled: this.state.enabled && validateSmartPathPreset(next).valid,
    });
  }

  renameActive = (name: string) => this.updateActive((preset) => ({ ...preset, name }));

  setVariant = (mask: number, metatile: number) => {
    if (!Number.isInteger(mask) || mask < 0 || mask > 15) return;
    const id = Math.min(METATILE_MASK, Math.max(0, Math.floor(Number(metatile) || 0)));
    this.updateActive((preset) => {
      const variants = [...preset.variants];
      variants[mask] = id;
      return { ...preset, variants };
    });
  };

  setVariantFromSelected = (mask: number) => {
    this.setVariant(mask, editorStore.getState().selectedMetatile);
  };

  fillVariantsFromSelected = () => {
    const selected = editorStore.getState().selectedMetatile & METATILE_MASK;
    this.updateActive((preset) => ({
      ...preset,
      variants: Array.from({ length: 16 }, () => selected),
    }));
    editorStore.setMessage(`Todos os 16 masks do Smart Path receberam o metatile ${selected}.`);
  };

  setEraseMetatile = (metatile: number) => {
    const id = Math.min(METATILE_MASK, Math.max(0, Math.floor(Number(metatile) || 0)));
    this.updateActive((preset) => ({ ...preset, eraseMetatile: id }));
  };

  setEraseFromSelected = () => this.setEraseMetatile(editorStore.getState().selectedMetatile);

  bindScopeToCurrentAtlas = () => {
    const scope = currentAtlasScope();
    if (!scope) {
      editorStore.setMessage("Carregue um atlas real pelo Workspace/Tilesets antes de vincular o Smart Path.");
      return false;
    }
    this.updateActive((preset) => ({ ...preset, scope }));
    const message = `Smart Path vinculado a ${scope.primary} + ${scope.secondary}.`;
    this.set({ lastMessage: message }, false);
    editorStore.setMessage(message);
    return true;
  };

  setMode = (mode: SmartPathMode) => this.set({ mode });
  toggleMode = () => this.set({ mode: this.state.mode === "add" ? "erase" : "add" });
  setPanelOpen = (panelOpen: boolean) => this.set({ panelOpen }, false);

  scopeStatus = () => {
    const preset = this.activePreset();
    if (!preset?.scope) return { matches: true, message: "Preset sem vínculo de tileset." };
    const scope = currentAtlasScope();
    if (!scope) return { matches: false, message: "Atlas real não carregado." };
    const matches = preset.scope.primary === scope.primary && preset.scope.secondary === scope.secondary;
    return {
      matches,
      message: matches
        ? `${scope.primary} + ${scope.secondary}`
        : `Preset: ${preset.scope.primary} + ${preset.scope.secondary}; atlas: ${scope.primary} + ${scope.secondary}`,
    };
  };

  setEnabled = (enabled: boolean) => {
    this.hydrate();
    if (enabled) {
      const preset = this.activePreset();
      if (!preset) {
        editorStore.setMessage("Crie ou importe um preset antes de ativar Smart Paths.");
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      const validation = validateSmartPathPreset(preset);
      if (!validation.valid) {
        editorStore.setMessage(`Preset Smart Path inválido: ${validation.errors[0]}`);
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      const scopeStatus = this.scopeStatus();
      if (preset.scope && !scopeStatus.matches) {
        editorStore.setMessage(`Smart Path não ativado: ${scopeStatus.message} Reabra o mapa correto ou use “Vincular atlas atual”.`);
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      editorStore.setTool("pencil");
      if (editorStore.getState().viewMode !== "visual") editorStore.setViewMode("visual");
      if (clipboardStore.getState().stampMode) clipboardStore.toggleStampMode(false);
    }
    const preset = this.activePreset();
    const message = enabled
      ? `Smart Path “${preset?.name ?? ""}” ativo — ${this.state.mode === "add" ? "adicionar" : "apagar"}.`
      : "Smart Paths desativado.";
    this.set({ enabled, lastMessage: message }, false);
    editorStore.setMessage(message);
    return enabled;
  };

  toggleEnabled = () => this.setEnabled(!this.state.enabled);

  applyAt = (x: number, y: number, continuous = false) => {
    if (!this.state.enabled) return 0;
    const preset = this.activePreset();
    if (!preset) return 0;
    const state = editorStore.getState();
    if (state.viewMode !== "visual") {
      this.setEnabled(false);
      return 0;
    }
    try {
      const plan = planSmartPath(
        state.map,
        preset,
        x,
        y,
        this.state.mode,
        (cx, cy) => !editorStore.isProtected(cx, cy),
      );
      if (!plan.updates.length) {
        if (!continuous) {
          const suffix = plan.skippedProtected.length ? " Célula protegida." : " Nada mudou.";
          editorStore.setMessage(`Smart Path em (${x},${y}).${suffix}`);
        }
        return 0;
      }
      if (!continuous) editorStore.beginStroke();
      const selected = editorStore.getState().selectedMetatile;
      for (const update of plan.updates) {
        editorStore.setMetatile(update.metatile);
        editorStore.paint(update.x, update.y, true);
      }
      editorStore.setMetatile(selected);
      editorStore.selectCell(idx(x, y, state.map.width));
      const protectedText = plan.skippedProtected.length
        ? `; ${plan.skippedProtected.length} protegida(s) não alterada(s)`
        : "";
      const message = `Smart Path ${this.state.mode === "add" ? "adicionado" : "apagado"} em (${x},${y}); ${plan.updates.length} bloco(s) recalculado(s)${protectedText}.`;
      this.set({ lastMessage: message }, false);
      editorStore.setMessage(message);
      return plan.updates.length;
    } catch (error) {
      const message = `Smart Path falhou: ${error instanceof Error ? error.message : String(error)}`;
      this.set({ lastMessage: message, enabled: false }, false);
      editorStore.setMessage(message);
      return 0;
    }
  };

  exportActiveJson = () => {
    const preset = this.activePreset();
    return preset ? `${JSON.stringify(preset, null, 2)}\n` : null;
  };

  importJson = (source: string) => {
    this.hydrate();
    try {
      const parsed = JSON.parse(source) as unknown;
      const rawPresets = Array.isArray(parsed) ? parsed : [parsed];
      const reserved = new Set(this.state.presets.map((preset) => preset.id));
      const imported = rawPresets.map((value) => {
        const preset = parsePreset(value);
        if (!preset) throw new Error("Preset inválido ou incompleto.");
        return {
          ...preset,
          id: uniqueImportedId(preset.id, reserved),
          updatedAt: new Date().toISOString(),
        } satisfies SmartPathPreset;
      });
      const presets = [...this.state.presets, ...imported];
      this.set({
        presets,
        activePresetId: imported[0]?.id ?? this.state.activePresetId,
        panelOpen: true,
        enabled: false,
        lastMessage: `${imported.length} preset(s) Smart Path importado(s).`,
      });
      editorStore.setMessage(`${imported.length} preset(s) Smart Path importado(s).`);
      return { ok: true as const, count: imported.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      editorStore.setMessage(`Falha ao importar Smart Path: ${message}`);
      return { ok: false as const, message };
    }
  };
}

export const smartPathStore = new SmartPathStore();

export function useSmartPath(): SmartPathState {
  const state = useSyncExternalStore(
    smartPathStore.subscribe,
    smartPathStore.getState,
    smartPathStore.getState,
  );
  useEffect(() => smartPathStore.hydrate(), []);
  return state;
}
