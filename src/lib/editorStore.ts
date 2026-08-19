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
  clampCollision,
  clampElevation,
  floodFillPhysical,
  getPhysicalLayerValue,
  setPhysicalLayerValue,
  type PhysicalLayer,
} from "./physicalMap";
import {
  addEvent as addEditableEvent,
  cloneMapJson,
  eventRecord,
  moveEvent as moveEditableEvent,
  parseEditableMapJson,
  removeEvent as removeEditableEvent,
  stringifyMapJson,
  updateEventField as updateEditableEventField,
  type EditableEventSource,
  type EditableMapJson,
} from "./eventMapJson";
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
  id: string;
  sourceIndex: number;
  x: number;
  y: number;
  kind: "warp" | "npc" | "trigger";
  label: string;
  detail: string;
  source: MapEventSource;
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
  selectedCollision: number;
  selectedElevation: number;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  showCoords: boolean;
  protectProgression: boolean;
  protectedCells: ProtectedCell[];
  events: DemoEvent[];
  mapMetadata: PokeemeraldMapMetadata | null;
  mapJsonDocument: EditableMapJson | null;
  mapJsonDirty: boolean;
  selectedEventId: string | null;
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

interface EditorSnapshot {
  map: MapData;
  mapJsonDocument: EditableMapJson | null;
  selectedEventId: string | null;
  dirty: boolean;
  mapJsonDirty: boolean;
}

const STORAGE_MAP = "arauna.map.v3";
const STORAGE_PREFS = "arauna.prefs.v1";
const MAX_HISTORY = 100;

function defaultMap(): MapData {
  return createEmptyMap(20, 20, 0x000);
}

function editablePhysicalLayer(viewMode: ViewMode): PhysicalLayer | null {
  if (viewMode === "collision" || viewMode === "elevation") return viewMode;
  return null;
}

function deriveMapJson(document: EditableMapJson) {
  const metadata = parsePokeemeraldMapJson(stringifyMapJson(document));
  return {
    metadata,
    events: metadata.events as DemoEvent[],
    protectedCells: metadata.protectedCells as ProtectedCell[],
  };
}

function initialState(): EditorState {
  return {
    mapName: "Novo mapa 20×20",
    map: defaultMap(),
    tool: "pencil",
    viewMode: "visual",
    selectedMetatile: 0x000,
    selectedCollision: 0,
    selectedElevation: 3,
    zoom: 2,
    pan: { x: 0, y: 0 },
    showGrid: true,
    showCoords: true,
    protectProgression: true,
    protectedCells: [],
    events: [],
    mapMetadata: null,
    mapJsonDocument: null,
    mapJsonDirty: false,
    selectedEventId: null,
    selection: null,
    selectedCell: null,
    hoverCell: null,
    undoDepth: 0,
    redoDepth: 0,
    dirty: false,
    lastMessage: "Pronto. Abra o Workspace Arauna para trabalhar com um mapa real do pokeemerald.",
    validation: null,
    sourceFile: null,
    mapJsonSource: null,
  };
}

type Listener = () => void;

class EditorStore {
  private state: EditorState = initialState();
  private listeners = new Set<Listener>();
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
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
          mapJsonDocument: s.mapJsonDocument,
          mapJsonDirty: s.mapJsonDirty,
          selectedEventId: s.selectedEventId,
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
          selectedCollision: s.selectedCollision,
          selectedElevation: s.selectedElevation,
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
          selectedCollision: clampCollision(prefs.selectedCollision ?? this.state.selectedCollision),
          selectedElevation: clampElevation(prefs.selectedElevation ?? this.state.selectedElevation),
          zoom: prefs.zoom ?? this.state.zoom,
          showGrid: prefs.showGrid ?? this.state.showGrid,
          showCoords: prefs.showCoords ?? this.state.showCoords,
          protectProgression: prefs.protectProgression ?? this.state.protectProgression,
        };
      }

      const rawMap =
        localStorage.getItem(STORAGE_MAP) ??
        localStorage.getItem("arauna.map.v2") ??
        localStorage.getItem("arauna.map.v1");
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

          let mapJsonDocument: EditableMapJson | null = null;
          let mapMetadata: PokeemeraldMapMetadata | null = null;
          let events: DemoEvent[] = [];
          let protectedCells: ProtectedCell[] = [];
          if (saved.mapJsonDocument && typeof saved.mapJsonDocument === "object" && !Array.isArray(saved.mapJsonDocument)) {
            mapJsonDocument = cloneMapJson(saved.mapJsonDocument as EditableMapJson);
            const derived = deriveMapJson(mapJsonDocument);
            mapMetadata = derived.metadata;
            events = derived.events;
            protectedCells = derived.protectedCells;
          } else {
            mapMetadata = saved.mapMetadata && typeof saved.mapMetadata === "object"
              ? (saved.mapMetadata as PokeemeraldMapMetadata)
              : null;
            events = Array.isArray(saved.events) ? (saved.events as DemoEvent[]) : [];
            protectedCells = Array.isArray(saved.protectedCells)
              ? (saved.protectedCells as ProtectedCell[])
              : [];
          }

          this.state = {
            ...this.state,
            mapName: typeof saved.mapName === "string" ? saved.mapName : this.state.mapName,
            sourceFile: typeof saved.sourceFile === "string" ? saved.sourceFile : null,
            mapJsonSource: typeof saved.mapJsonSource === "string" ? saved.mapJsonSource : null,
            mapJsonDocument,
            mapJsonDirty: Boolean(saved.mapJsonDirty),
            selectedEventId: typeof saved.selectedEventId === "string" ? saved.selectedEventId : null,
            mapMetadata,
            events,
            protectedCells,
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

  private snapshot(): EditorSnapshot {
    return {
      map: cloneMap(this.state.map),
      mapJsonDocument: this.state.mapJsonDocument ? cloneMapJson(this.state.mapJsonDocument) : null,
      selectedEventId: this.state.selectedEventId,
      dirty: this.state.dirty,
      mapJsonDirty: this.state.mapJsonDirty,
    };
  }

  private pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  private restoreSnapshot(snapshot: EditorSnapshot, lastMessage: string) {
    let mapMetadata = this.state.mapMetadata;
    let events = this.state.events;
    let protectedCells = this.state.protectedCells;
    if (snapshot.mapJsonDocument) {
      const derived = deriveMapJson(snapshot.mapJsonDocument);
      mapMetadata = derived.metadata;
      events = derived.events;
      protectedCells = derived.protectedCells;
    } else {
      mapMetadata = null;
      events = [];
      protectedCells = [];
    }
    this.set({
      map: cloneMap(snapshot.map),
      mapJsonDocument: snapshot.mapJsonDocument ? cloneMapJson(snapshot.mapJsonDocument) : null,
      mapMetadata,
      events,
      protectedCells,
      selectedEventId: snapshot.selectedEventId,
      dirty: snapshot.dirty,
      mapJsonDirty: snapshot.mapJsonDirty,
      validation: null,
      lastMessage,
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
    });
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
    this.redoStack.push(this.snapshot());
    this.restoreSnapshot(prev, "Desfeito.");
  };

  redo = () => {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.restoreSnapshot(next, "Refeito.");
  };

  isProtected = (x: number, y: number) =>
    this.state.protectProgression && this.state.protectedCells.some((cell) => cell.x === x && cell.y === y);

  paint = (x: number, y: number, continuous = false) => {
    const s = this.state;
    const physicalLayer = editablePhysicalLayer(s.viewMode);
    if (s.viewMode !== "visual" && !physicalLayer) return;
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
    const map = cloneMap(s.map);
    if (s.viewMode === "visual") {
      const id = s.selectedMetatile & METATILE_MASK;
      if (s.map.metatiles[i] === id) return;
      map.metatiles[i] = id;
    } else if (physicalLayer) {
      const value = physicalLayer === "collision" ? s.selectedCollision : s.selectedElevation;
      const next = setPhysicalLayerValue(s.map.physical[i] ?? 0, physicalLayer, value);
      if (next === (s.map.physical[i] ?? 0)) return;
      map.physical[i] = next;
    }

    if (!continuous) this.pushHistory();
    this.syncHistoryDepths({ map, dirty: true, selectedCell: i });
  };

  beginStroke = () => this.pushHistory();

  pick = (x: number, y: number) => {
    const s = this.state;
    if (x < 0 || y < 0 || x >= s.map.width || y >= s.map.height) return;
    const i = idx(x, y, s.map.width);
    if (s.viewMode === "visual") {
      const id = s.map.metatiles[i] ?? 0;
      this.set({ selectedMetatile: id, selectedCell: i, lastMessage: `Metatile ${id} selecionado.` });
      return;
    }
    const physicalLayer = editablePhysicalLayer(s.viewMode);
    if (physicalLayer) {
      const value = getPhysicalLayerValue(s.map.physical[i] ?? 0, physicalLayer);
      this.set({
        ...(physicalLayer === "collision"
          ? { selectedCollision: value }
          : { selectedElevation: value }),
        selectedCell: i,
        lastMessage: `${physicalLayer === "collision" ? "Colisão" : "Elevação"} ${value} selecionada.`,
      });
      return;
    }
    this.set({ selectedCell: i }, false);
  };

  fill = (x: number, y: number) => {
    const s = this.state;
    const physicalLayer = editablePhysicalLayer(s.viewMode);
    if (s.viewMode !== "visual" && !physicalLayer) return;
    if (this.isProtected(x, y)) {
      this.set({ lastMessage: `Célula (${x},${y}) protegida.` }, false);
      return;
    }

    const map = cloneMap(s.map);
    const changed = s.viewMode === "visual"
      ? floodFill(map, x, y, s.selectedMetatile, (cx, cy) => this.isProtected(cx, cy))
      : floodFillPhysical(
          map,
          x,
          y,
          physicalLayer!,
          physicalLayer === "collision" ? s.selectedCollision : s.selectedElevation,
          (cx, cy) => this.isProtected(cx, cy),
        );

    if (!changed.length) {
      this.set({ lastMessage: "Nada para preencher." }, false);
      return;
    }
    this.pushHistory();
    const layerName = s.viewMode === "visual"
      ? "visual"
      : physicalLayer === "collision"
        ? "colisão"
        : "elevação";
    this.syncHistoryDepths({
      map,
      dirty: true,
      lastMessage: `Bucket fill ${layerName}: ${changed.length} célula(s).`,
    });
  };

  fillSelection = () => {
    const s = this.state;
    const sel = s.selection;
    const physicalLayer = editablePhysicalLayer(s.viewMode);
    if (!sel || (s.viewMode !== "visual" && !physicalLayer)) return;
    const map = cloneMap(s.map);
    let changed = 0;

    for (let y = sel.y; y < sel.y + sel.h; y++) {
      for (let x = sel.x; x < sel.x + sel.w; x++) {
        if (this.isProtected(x, y)) continue;
        const i = idx(x, y, map.width);
        if (s.viewMode === "visual") {
          const next = s.selectedMetatile & METATILE_MASK;
          if (map.metatiles[i] !== next) {
            map.metatiles[i] = next;
            changed++;
          }
        } else if (physicalLayer) {
          const value = physicalLayer === "collision" ? s.selectedCollision : s.selectedElevation;
          const next = setPhysicalLayerValue(map.physical[i] ?? 0, physicalLayer, value);
          if (map.physical[i] !== next) {
            map.physical[i] = next;
            changed++;
          }
        }
      }
    }

    if (!changed) return;
    this.pushHistory();
    const layerName = s.viewMode === "visual"
      ? "visual"
      : physicalLayer === "collision"
        ? "colisão"
        : "elevação";
    this.syncHistoryDepths({
      map,
      dirty: true,
      lastMessage: `Seleção preenchida em ${layerName}: ${changed} célula(s).`,
    });
  };

  private applyMapJsonDocument(
    document: EditableMapJson,
    patch: Partial<EditorState>,
  ) {
    const derived = deriveMapJson(document);
    this.syncHistoryDepths({
      mapJsonDocument: document,
      mapMetadata: derived.metadata,
      events: derived.events,
      protectedCells: derived.protectedCells,
      validation: null,
      ...patch,
    });
  }

  selectEvent = (selectedEventId: string | null) => {
    if (!selectedEventId) {
      this.set({ selectedEventId: null }, false);
      return;
    }
    const event = this.state.events.find((candidate) => candidate.id === selectedEventId);
    if (!event) return;
    this.set({
      selectedEventId,
      selectedCell: idx(event.x, event.y, this.state.map.width),
      lastMessage: `${event.label} selecionado — arraste para mover ou edite no inspetor.`,
    }, false);
  };

  moveEvent = (id: string, x: number, y: number, continuous = false) => {
    const s = this.state;
    if (!s.mapJsonDocument) return;
    if (x < 0 || y < 0 || x >= s.map.width || y >= s.map.height) return;
    const current = s.events.find((event) => event.id === id);
    if (!current || (current.x === x && current.y === y)) return;
    if (!continuous) this.pushHistory();
    try {
      const document = moveEditableEvent(s.mapJsonDocument, id, x, y);
      this.applyMapJsonDocument(document, {
        selectedEventId: id,
        selectedCell: idx(x, y, s.map.width),
        mapJsonDirty: true,
        lastMessage: `${current.label} movido para (${x},${y}).`,
      });
    } catch (error) {
      this.set({ lastMessage: `Falha ao mover evento: ${error instanceof Error ? error.message : String(error)}` }, false);
    }
  };

  updateEventField = (id: string, key: string, value: unknown) => {
    const s = this.state;
    if (!s.mapJsonDocument) return;
    try {
      if ((key === "x" || key === "y") && Number.isInteger(Number(value))) {
        const current = s.events.find((event) => event.id === id);
        if (current) {
          const x = key === "x" ? Number(value) : current.x;
          const y = key === "y" ? Number(value) : current.y;
          if (x < 0 || y < 0 || x >= s.map.width || y >= s.map.height) {
            throw new Error(`Coordenada (${x},${y}) fora do mapa ${s.map.width}×${s.map.height}.`);
          }
        }
      }
      this.pushHistory();
      const document = updateEditableEventField(s.mapJsonDocument, id, key, value);
      const derived = deriveMapJson(document);
      const selected = derived.events.find((event) => event.id === id);
      this.syncHistoryDepths({
        mapJsonDocument: document,
        mapMetadata: derived.metadata,
        events: derived.events,
        protectedCells: derived.protectedCells,
        selectedEventId: id,
        selectedCell: selected ? idx(selected.x, selected.y, s.map.width) : s.selectedCell,
        mapJsonDirty: true,
        validation: null,
        lastMessage: `Campo ${key} atualizado em ${id}.`,
      });
    } catch (error) {
      this.set({ lastMessage: `Falha ao editar evento: ${error instanceof Error ? error.message : String(error)}` }, false);
    }
  };

  createEvent = (source: EditableEventSource, x?: number, y?: number) => {
    const s = this.state;
    if (!s.mapJsonDocument) {
      this.set({ lastMessage: "Importe/abra um map.json antes de criar eventos." }, false);
      return null;
    }
    const fallbackIndex = s.selectedCell ?? 0;
    const targetX = x ?? (fallbackIndex % s.map.width);
    const targetY = y ?? Math.floor(fallbackIndex / s.map.width);
    if (targetX < 0 || targetY < 0 || targetX >= s.map.width || targetY >= s.map.height) return null;
    try {
      this.pushHistory();
      const result = addEditableEvent(s.mapJsonDocument, source, targetX, targetY);
      this.applyMapJsonDocument(result.document, {
        selectedEventId: result.id,
        selectedCell: idx(targetX, targetY, s.map.width),
        mapJsonDirty: true,
        lastMessage: `${source} criado em (${targetX},${targetY}). Revise os campos no inspetor antes de exportar.`,
      });
      return result.id;
    } catch (error) {
      this.set({ lastMessage: `Falha ao criar evento: ${error instanceof Error ? error.message : String(error)}` }, false);
      return null;
    }
  };

  removeEvent = (id = this.state.selectedEventId) => {
    const s = this.state;
    if (!id || !s.mapJsonDocument) return;
    const current = s.events.find((event) => event.id === id);
    try {
      this.pushHistory();
      const document = removeEditableEvent(s.mapJsonDocument, id);
      this.applyMapJsonDocument(document, {
        selectedEventId: null,
        mapJsonDirty: true,
        lastMessage: `${current?.label ?? id} removido do map.json.`,
      });
    } catch (error) {
      this.set({ lastMessage: `Falha ao remover evento: ${error instanceof Error ? error.message : String(error)}` }, false);
    }
  };

  setSelection = (selection: Selection | null) => this.set({ selection }, false);
  setHover = (hoverCell: number | null) => this.set({ hoverCell }, false);
  selectCell = (i: number | null) => this.set({ selectedCell: i }, false);

  setTool = (tool: Tool) => this.set({ tool });
  setViewMode = (viewMode: ViewMode) => this.set({ viewMode });
  setMetatile = (selectedMetatile: number) => this.set({ selectedMetatile });
  setCollision = (selectedCollision: number) => this.set({ selectedCollision: clampCollision(selectedCollision) });
  setElevation = (selectedElevation: number) => this.set({ selectedElevation: clampElevation(selectedElevation) });
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
      mapJsonDocument: null,
      mapJsonDirty: false,
      mapMetadata: null,
      events: [],
      protectedCells: [],
      selectedEventId: null,
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
      const document = parseEditableMapJson(source);
      const metadata = parsePokeemeraldMapJson(source);
      const totalEvents = metadata.events.length;
      this.pushHistory();
      this.syncHistoryDepths({
        mapName: `${metadata.name} (${metadata.id})`,
        mapMetadata: metadata,
        mapJsonDocument: document,
        mapJsonDirty: false,
        mapJsonSource: fileName,
        events: metadata.events as DemoEvent[],
        protectedCells: metadata.protectedCells as ProtectedCell[],
        selectedEventId: null,
        selectedCell: null,
        validation: null,
        lastMessage:
          `Importado ${fileName} — ${metadata.counts.warps} warp(s), ` +
          `${metadata.counts.objects} NPC(s), ${metadata.counts.coordEvents} trigger(s), ` +
          `${metadata.counts.bgEvents} BG event(s); ${totalEvents} evento(s) editáveis.`,
      });
      return { ok: true as const, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.set({ lastMessage: `Falha ao importar map.json: ${message}` });
      return { ok: false as const, message };
    }
  };

  exportBytes = () => exportMapBin(this.state.map);

  exportMapJsonSource = () => {
    if (!this.state.mapJsonDocument) return null;
    return stringifyMapJson(this.state.mapJsonDocument);
  };

  markBinExported = () => this.set({ dirty: false, lastMessage: "map.bin exportado." });
  markMapJsonExported = () => this.set({ mapJsonDirty: false, lastMessage: "map.json exportado." });

  selectedEventRecord = () => {
    const s = this.state;
    if (!s.selectedEventId || !s.mapJsonDocument) return null;
    return eventRecord(s.mapJsonDocument, s.selectedEventId);
  };

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
      if (this.state.mapJsonDirty) {
        issues.push({
          level: "info" as const,
          message: "map.json contém alterações ainda não exportadas.",
        });
      }
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
