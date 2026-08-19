import { useSyncExternalStore } from "react";
import {
  cloneMap,
  createEmptyMap,
  exportMapBin,
  floodFill,
  idx,
  METATILE_MASK,
  parseMapBin,
  type MapData,
  type ValidationReport,
  validateMap,
} from "./emeraldMap";

export type Tool = "pencil" | "picker" | "fill" | "select";
export type ViewMode = "visual" | "collision" | "elevation" | "warps" | "npcs" | "triggers";

export interface ProtectedCell {
  x: number;
  y: number;
  reason: string;
}

export interface DemoEvent {
  x: number;
  y: number;
  kind: "warp" | "npc" | "trigger";
  label: string;
  detail: string;
}

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditorState {
  mapName: string;
  map: MapData;
  tool: Tool;
  viewMode: ViewMode;
  selectedMetatile: number;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showCoords: boolean;
  protectProgression: boolean;
  protectedCells: ProtectedCell[];
  events: DemoEvent[];
  selection: Selection | null;
  selectedCell: number | null;
  hoverCell: number | null;
  undoDepth: number;
  redoDepth: number;
  dirty: boolean;
  lastMessage: string;
  validation: ValidationReport | null;
  sourceFile: string | null;
}

const PROTECTED: ProtectedCell[] = [
  { x: 5, y: 8, reason: "Entrada da casa do jogador (demo)" },
  { x: 14, y: 8, reason: "Entrada da casa do rival (demo)" },
  { x: 7, y: 16, reason: "Saída sul para Rota 101 (demo)" },
  { x: 10, y: 1, reason: "Laboratório — porta (demo)" },
  { x: 11, y: 1, reason: "Laboratório — porta (demo)" },
];

const EVENTS: DemoEvent[] = [
  { x: 5, y: 8, kind: "warp", label: "W0", detail: "→ VilaAmanhecer_CasaJogador_1F (demo)" },
  { x: 14, y: 8, kind: "warp", label: "W1", detail: "→ VilaAmanhecer_CasaRival_1F (demo)" },
  { x: 10, y: 1, kind: "warp", label: "W2", detail: "→ VilaAmanhecer_Laboratorio (demo)" },
  { x: 7, y: 16, kind: "warp", label: "W3", detail: "→ Rota101 (demo)" },
  { x: 8, y: 11, kind: "npc", label: "N0", detail: "OBJ_EVENT_GFX_BOY_1 — andar aleatório (demo)" },
  { x: 12, y: 5, kind: "npc", label: "N1", detail: "OBJ_EVENT_GFX_WOMAN_1 — parada (demo)" },
  { x: 3, y: 13, kind: "npc", label: "N2", detail: "OBJ_EVENT_GFX_MAN_1 — olhar sul (demo)" },
  { x: 7, y: 15, kind: "trigger", label: "T0", detail: "VAR_ARAUNA_INTRO = 1 (demo)" },
  { x: 10, y: 9, kind: "trigger", label: "T1", detail: "Script de cena de abertura (demo)" },
];

const STORAGE_MAP = "arauna.map.v1";
const STORAGE_PREFS = "arauna.prefs.v1";
const MAX_HISTORY = 100;

function defaultMap(): MapData {
  // Padrão simples só para dar contexto visual ao mapa novo.
  const map = createEmptyMap(20, 20, 0x000);
  return map;
}

function initialState(): EditorState {
  return {
    mapName: "VilaAmanhecer (LittlerootTown)",
    map: defaultMap(),
    tool: "pencil",
    viewMode: "visual",
    selectedMetatile: 0x000,
    zoom: 2,
    pan: { x: 0, y: 0 },
    showGrid: true,
    showCoords: true,
    protectProgression: true,
    protectedCells: PROTECTED,
    events: EVENTS,
    selection: null,
    selectedCell: null,
    hoverCell: null,
    undoDepth: 0,
    redoDepth: 0,
    dirty: false,
    lastMessage: "Pronto.",
    validation: null,
    sourceFile: null,
  };
}

type Listener = () => void;

class EditorStore {
  private state: EditorState = initialState();
  private listeners = new Set<Listener>();
  private undoStack: MapData[] = [];
  private redoStack: MapData[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<EditorState>, persist = true) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
    if (persist) this.schedulePersist();
  }

  private schedulePersist() {
    if (typeof window === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 400);
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const s = this.state;
      localStorage.setItem(
        STORAGE_MAP,
        JSON.stringify({
          mapName: s.mapName,
          width: s.map.width,
          height: s.map.height,
          metatiles: Array.from(s.map.metatiles),
          physical: Array.from(s.map.physical),
          sourceFile: s.sourceFile,
        }),
      );
      localStorage.setItem(
        STORAGE_PREFS,
        JSON.stringify({
          tool: s.tool,
          viewMode: s.viewMode,
          selectedMetatile: s.selectedMetatile,
          zoom: s.zoom,
          showGrid: s.showGrid,
          showCoords: s.showCoords,
          protectProgression: s.protectProgression,
        }),
      );
    } catch {
      /* quota / modo privado: ignorar */
    }
  }

  hydrate() {
    if (typeof window === "undefined") return;
    try {
      const rawPrefs = localStorage.getItem(STORAGE_PREFS);
      if (rawPrefs) {
        const p = JSON.parse(rawPrefs);
        this.state = {
          ...this.state,
          tool: p.tool ?? this.state.tool,
          viewMode: p.viewMode ?? this.state.viewMode,
          selectedMetatile: p.selectedMetatile ?? this.state.selectedMetatile,
          zoom: p.zoom ?? this.state.zoom,
          showGrid: p.showGrid ?? this.state.showGrid,
          showCoords: p.showCoords ?? this.state.showCoords,
          protectProgression: p.protectProgression ?? this.state.protectProgression,
        };
      }
      const rawMap = localStorage.getItem(STORAGE_MAP);
      if (rawMap) {
        const m = JSON.parse(rawMap);
        if (Array.isArray(m.metatiles) && m.metatiles.length === m.width * m.height) {
          this.state = {
            ...this.state,
            mapName: m.mapName ?? this.state.mapName,
            sourceFile: m.sourceFile ?? null,
            map: {
              width: m.width,
              height: m.height,
              metatiles: Uint16Array.from(m.metatiles),
              physical: Uint16Array.from(m.physical ?? []),
            },
            lastMessage: "Projeto restaurado do armazenamento local.",
          };
          if (this.state.map.physical.length !== this.state.map.metatiles.length) {
            this.state.map.physical = new Uint16Array(this.state.map.metatiles.length);
          }
        }
      }
      this.listeners.forEach((l) => l());
    } catch {
      /* ignore */
    }
  }

  // ---- histórico ----
  private pushHistory() {
    this.undoStack.push(cloneMap(this.state.map));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  private syncHistoryDepths(patch: Partial<EditorState> = {}) {
    this.set({
      ...patch,
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
    });
  }

  undo = () => {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneMap(this.state.map));
    this.syncHistoryDepths({ map: prev, dirty: true, lastMessage: "Desfeito." });
  };

  redo = () => {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneMap(this.state.map));
    this.syncHistoryDepths({ map: next, dirty: true, lastMessage: "Refeito." });
  };

  // ---- helpers ----
  isProtected = (x: number, y: number) =>
    this.state.protectProgression && this.state.protectedCells.some((c) => c.x === x && c.y === y);

  // ---- edição ----
  /** Pinta uma célula. `continuous` agrupa o traço num único passo de undo. */
  paint = (x: number, y: number, continuous = false) => {
    const s = this.state;
    if (s.viewMode !== "visual") return;
    const { width, height } = s.map;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (this.isProtected(x, y)) {
      this.set({ lastMessage: `Célula (${x},${y}) protegida — desligue "Proteger progressão" para editar.` }, false);
      return;
    }
    const i = idx(x, y, width);
    const id = s.selectedMetatile & METATILE_MASK;
    if (s.map.metatiles[i] === id) return;
    if (!continuous) this.pushHistory();
    const map = cloneMap(s.map);
    map.metatiles[i] = id; // preserva physical bits intocados
    this.syncHistoryDepths({ map, dirty: true, selectedCell: i });
  };

  beginStroke = () => this.pushHistory();

  pick = (x: number, y: number) => {
    const s = this.state;
    const i = idx(x, y, s.map.width);
    const id = s.map.metatiles[i] ?? 0;
    this.set({ selectedMetatile: id, selectedCell: i, lastMessage: `Metatile ${id} selecionado.` });
  };

  fill = (x: number, y: number) => {
    const s = this.state;
    if (s.viewMode !== "visual") return;
    if (this.isProtected(x, y)) {
      this.set({ lastMessage: `Célula (${x},${y}) protegida.` }, false);
      return;
    }
    const map = cloneMap(s.map);
    const changed = floodFill(map, x, y, s.selectedMetatile, (cx, cy) => this.isProtected(cx, cy));
    if (!changed.length) {
      this.set({ lastMessage: "Nada para preencher." }, false);
      return;
    }
    this.pushHistory();
    this.syncHistoryDepths({ map, dirty: true, lastMessage: `Bucket fill: ${changed.length} célula(s).` });
  };

  fillSelection = () => {
    const s = this.state;
    const sel = s.selection;
    if (!sel || s.viewMode !== "visual") return;
    const map = cloneMap(s.map);
    let n = 0;
    for (let y = sel.y; y < sel.y + sel.h; y++)
      for (let x = sel.x; x < sel.x + sel.w; x++) {
        if (this.isProtected(x, y)) continue;
        const i = idx(x, y, map.width);
        if (map.metatiles[i] !== (s.selectedMetatile & METATILE_MASK)) {
          map.metatiles[i] = s.selectedMetatile & METATILE_MASK;
          n++;
        }
      }
    if (!n) return;
    this.pushHistory();
    this.syncHistoryDepths({ map, dirty: true, lastMessage: `Seleção preenchida: ${n} célula(s).` });
  };

  setSelection = (selection: Selection | null) => this.set({ selection }, false);
  setHover = (hoverCell: number | null) => this.set({ hoverCell }, false);
  selectCell = (i: number | null) => this.set({ selectedCell: i }, false);

  setTool = (tool: Tool) => this.set({ tool });
  setViewMode = (viewMode: ViewMode) => this.set({ viewMode });
  setMetatile = (selectedMetatile: number) => this.set({ selectedMetatile });
  setZoom = (zoom: number) => this.set({ zoom: Math.min(8, Math.max(0.5, zoom)) });
  setPan = (pan: { x: number; y: number }) => this.set({ pan }, false);
  toggleGrid = () => this.set({ showGrid: !this.state.showGrid });
  toggleCoords = () => this.set({ showCoords: !this.state.showCoords });
  toggleProtect = () =>
    this.set({
      protectProgression: !this.state.protectProgression,
      lastMessage: this.state.protectProgression
        ? "Proteção de progressão DESLIGADA."
        : "Proteção de progressão LIGADA.",
    });

  newMap = () => {
    this.pushHistory();
    this.syncHistoryDepths({
      map: defaultMap(),
      sourceFile: null,
      dirty: false,
      selection: null,
      selectedCell: null,
      validation: null,
      lastMessage: "Novo mapa 20×20 criado.",
    });
  };

  importBuffer = (buffer: ArrayBuffer, fileName: string) => {
    try {
      const map = parseMapBin(buffer, 20, 20);
      this.pushHistory();
      this.syncHistoryDepths({
        map,
        sourceFile: fileName,
        dirty: false,
        validation: null,
        selection: null,
        lastMessage: `Importado ${fileName} — ${buffer.byteLength} bytes, 400 células.`,
      });
      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.set({ lastMessage: `Falha na importação: ${message}` });
      return { ok: false as const, message };
    }
  };

  exportBytes = () => exportMapBin(this.state.map);

  runValidation = () => {
    const validation = validateMap(this.state.map);
    this.set({
      validation,
      lastMessage: validation.pass ? "Validação: PASS." : "Validação: FAIL.",
    });
    return validation;
  };

  clearValidation = () => this.set({ validation: null }, false);
  setMessage = (lastMessage: string) => this.set({ lastMessage }, false);
}

export const editorStore = new EditorStore();

export function useEditor(): EditorState {
  return useSyncExternalStore(editorStore.subscribe, editorStore.getState, editorStore.getState);
}
