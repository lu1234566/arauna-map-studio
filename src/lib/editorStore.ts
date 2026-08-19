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
import {
  metadataOutOfBounds,
  parsePokeemeraldMapJson,
  type MapEventSource,
  type PokeemeraldMapMetadata,
} from "./pokeemeraldMapJson";

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
  source?: MapEventSource;
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
  mapMetadata: PokeemeraldMapMetadata | null;
  selection: Selection | null;
  selectedCell: number | null;
  hoverCell: number | null;
  undoDepth: number;
  redoDepth: number;
  dirty: boolean;
  lastMessage: string;
  validation: ValidationReport | null;
  sourceFile: string | null;
  mapJsonSource: string | null;
}

const STORAGE_MAP = "arauna.map.v2";
const STORAGE_PREFS = "arauna.prefs.v1";
const MAX_HISTORY = 100;

function defaultMap(): MapData {
  return createEmptyMap(20, 20, 0x000);
}

function initialState(): EditorState {
  return {
    mapName: "Novo mapa 20×20",
    map: defaultMap(),
    tool: "pencil",
    viewMode: "visual",
    selectedMetatile: 0x000,
    zoom: 2,
    pan: { x: 0, y: 0 },
    showGrid: true,
    showCoords: true,
    protectProgression: true,
    protectedCells: [],
    events: [],
    mapMetadata: null,
    selection: null,
    selectedCell: null,
    hoverCell: null,
    undoDepth: 0,
    redoDepth: 0,
    dirty: false,
    lastMessage: "Pronto. Importe map.bin e map.json para trabalhar com um mapa real do pokeemerald.",
    validation: null,
    sourceFile: null,
    mapJsonSource: null,
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
    this.listeners.forEach((listener) => listener());
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
          mapJsonSource: s.mapJsonSource,
          mapMetadata: s.mapMetadata,
          events: s.events,
          protectedCells: s.protectedCells,
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
        const prefs = JSON.parse(rawPrefs) as Partial<EditorState>;
        this.state = {
          ...this.state,
          tool: prefs.tool ?? this.state.tool,
          viewMode: prefs.viewMode ?? this.state.viewMode,
          selectedMetatile: prefs.selectedMetatile ?? this.state.selectedMetatile,
          zoom: prefs.zoom ?? this.state.zoom,
          showGrid: prefs.showGrid ?? this.state.showGrid,
          showCoords: prefs.showCoords ?? this.state.showCoords,
          protectProgression: prefs.protectProgression ?? this.state.protectProgression,
        };
      }

      const rawMap = localStorage.getItem(STORAGE_MAP) ?? localStorage.getItem("arauna.map.v1");
      if (rawMap) {
        const saved = JSON.parse(rawMap) as Record<string, unknown>;
        const width = Number(saved.width);
        const height = Number(saved.height);
        const metatiles = saved.metatiles;
        if (Array.isArray(metatiles) && metatiles.length === width * height) {
          const physical = Array.isArray(saved.physical) ? saved.physical : [];
          const restoredMap: MapData = {
            width,
            height,
            metatiles: Uint16Array.from(metatiles.map(Number)),
            physical: Uint16Array.from(physical.map(Number)),
          };
          if (restoredMap.physical.length !== restoredMap.metatiles.length) {
            restoredMap.physical = new Uint16Array(restoredMap.metatiles.length);
          }

          this.state = {
            ...this.state,
            mapName: typeof saved.mapName === "string" ? saved.mapName : this.state.mapName,
            sourceFile: typeof saved.sourceFile === "string" ? saved.sourceFile : null,
            mapJsonSource: typeof saved.mapJsonSource === "string" ? saved.mapJsonSource : null,
            mapMetadata:
              saved.mapMetadata && typeof saved.mapMetadata === "object"
                ? (saved.mapMetadata as PokeemeraldMapMetadata)
                : null,
            events: Array.isArray(saved.events) ? (saved.events as DemoEvent[]) : this.state.events,
            protectedCells: Array.isArray(saved.protectedCells)
              ? (saved.protectedCells as ProtectedCell[])
              : this.state.protectedCells,
            map: restoredMap,
            lastMessage: "Projeto restaurado do armazenamento local.",
          };
        }
      }
      this.listeners.forEach((listener) => listener());
    } catch {
      /* armazenamento inválido: mantém estado inicial */
    }
  }

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

  isProtected = (x: number, y: number) =>
    this.state.protectProgression && this.state.protectedCells.some((cell) => cell.x === x && cell.y === y);

  paint = (x: number, y: number, continuous = false) => {
    const s = this.state;
    if (s.viewMode !== "visual") return;
    const { width, height } = s.map;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (this.isProtected(x, y)) {
      this.set(
        { lastMessage: `Célula (${x},${y}) protegida — desligue "Proteger progressão" para editar.` },
        false,
      );
      return;
    }
    const i = idx(x, y, width);
    const id = s.selectedMetatile & METATILE_MASK;
    if (s.map.metatiles[i] === id) return;
    if (!continuous) this.pushHistory();
    const map = cloneMap(s.map);
    map.metatiles[i] = id;
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
    let changed = 0;
    for (let y = sel.y; y < sel.y + sel.h; y++) {
      for (let x = sel.x; x < sel.x + sel.w; x++) {
        if (this.isProtected(x, y)) continue;
        const i = idx(x, y, map.width);
        if (map.metatiles[i] !== (s.selectedMetatile & METATILE_MASK)) {
          map.metatiles[i] = s.selectedMetatile & METATILE_MASK;
          changed++;
        }
      }
    }
    if (!changed) return;
    this.pushHistory();
    this.syncHistoryDepths({
      map,
      dirty: true,
      lastMessage: `Seleção preenchida: ${changed} célula(s).`,
    });
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
      mapName: "Novo mapa 20×20",
      map: defaultMap(),
      sourceFile: null,
      mapJsonSource: null,
      mapMetadata: null,
      events: [],
      protectedCells: [],
      dirty: false,
      selection: null,
      selectedCell: null,
      validation: null,
      lastMessage: "Novo mapa 20×20 criado.",
    });
  };

  importBuffer = (buffer: ArrayBuffer, fileName: string) =>
    this.importBufferSized(buffer, fileName, 20, 20);

  importBufferSized = (buffer: ArrayBuffer, fileName: string, width: number, height: number) => {
    try {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error(`Dimensão inválida: ${width}×${height}.`);
      }
      const map = parseMapBin(buffer, width, height);
      this.pushHistory();
      this.syncHistoryDepths({
        map,
        sourceFile: fileName,
        dirty: false,
        validation: null,
        selection: null,
        selectedCell: null,
        lastMessage: `Importado ${fileName} — ${buffer.byteLength} bytes, ${width}×${height} (${width * height} células).`,
      });
      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.set({ lastMessage: `Falha na importação: ${message}` });
      return { ok: false as const, message };
    }
  };

  importMapJson = (source: string, fileName: string) => {
    try {
      const metadata = parsePokeemeraldMapJson(source);
      const totalEvents = metadata.events.length;
      this.set({
        mapName: `${metadata.name} (${metadata.id})`,
        mapMetadata: metadata,
        mapJsonSource: fileName,
        events: metadata.events,
        protectedCells: metadata.protectedCells,
        selectedCell: null,
        validation: null,
        lastMessage:
          `Importado ${fileName} — ${metadata.counts.warps} warp(s), ` +
          `${metadata.counts.objects} NPC(s), ${metadata.counts.coordEvents} trigger(s), ` +
          `${metadata.counts.bgEvents} BG event(s); ${totalEvents} evento(s) visíveis.`,
      });
      return { ok: true as const, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.set({ lastMessage: `Falha ao importar map.json: ${message}` });
      return { ok: false as const, message };
    }
  };

  exportBytes = () => exportMapBin(this.state.map);

  runValidation = () => {
    const base = validateMap(this.state.map);
    const issues = [...base.issues];
    const metadata = this.state.mapMetadata;

    if (!metadata) {
      issues.push({
        level: "warn" as const,
        message: "map.json ainda não foi importado; warps, triggers e eventos não entraram nesta validação.",
      });
    } else {
      const outside = metadataOutOfBounds(metadata, this.state.map.width, this.state.map.height);
      if (outside.length) {
        issues.push({
          level: "error" as const,
          message: `${outside.length} evento(s) do map.json estão fora dos limites ${this.state.map.width}×${this.state.map.height}.`,
        });
      } else {
        issues.push({
          level: "info" as const,
          message: `Todos os ${metadata.events.length} evento(s) do map.json estão dentro dos limites.`,
        });
      }
      issues.push({
        level: "info" as const,
        message: `Layout declarado: ${metadata.layout}. Conexões: ${metadata.connections.length}. Células protegidas derivadas: ${metadata.protectedCells.length}.`,
      });
    }

    const validation: ValidationReport = {
      ...base,
      issues,
      pass: issues.every((issue) => issue.level !== "error"),
    };
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
