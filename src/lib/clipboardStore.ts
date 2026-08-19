import { useSyncExternalStore } from "react";
import { editorStore, type Selection, type ViewMode } from "./editorStore";
import { getCollision, getElevation, idx, rawValue } from "./emeraldMap";
import {
  captureRegion,
  flipClipboardHorizontal,
  flipClipboardVertical,
  kindLabel,
  rotateClipboardClockwise,
  type ClipboardKind,
  type RegionClipboard,
} from "./mapClipboard";

export interface ClipboardState {
  clipboard: RegionClipboard | null;
  stampMode: boolean;
  lastMessage: string;
}

type Listener = () => void;

function editableKind(viewMode: ViewMode): ClipboardKind | null {
  if (viewMode === "visual" || viewMode === "collision" || viewMode === "elevation") return viewMode;
  return null;
}

function effectiveSelection(): Selection | null {
  const state = editorStore.getState();
  if (state.selection) return state.selection;
  if (state.selectedCell == null) return null;
  return {
    x: state.selectedCell % state.map.width,
    y: Math.floor(state.selectedCell / state.map.width),
    w: 1,
    h: 1,
  };
}

class ClipboardStore {
  private state: ClipboardState = {
    clipboard: null,
    stampMode: false,
    lastMessage: "Clipboard vazio.",
  };

  private listeners = new Set<Listener>();

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<ClipboardState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private capture(kind: ClipboardKind): RegionClipboard | null {
    const state = editorStore.getState();
    const selection = effectiveSelection();
    if (!selection) {
      const message = "Crie uma seleção ou escolha uma célula antes de copiar.";
      this.set({ lastMessage: message });
      editorStore.setMessage(message);
      return null;
    }
    try {
      return captureRegion(state.map, selection, kind);
    } catch (error) {
      const message = `Falha ao copiar: ${error instanceof Error ? error.message : String(error)}`;
      this.set({ lastMessage: message });
      editorStore.setMessage(message);
      return null;
    }
  }

  copySelection = (forceKind?: ClipboardKind) => {
    const state = editorStore.getState();
    const kind = forceKind ?? editableKind(state.viewMode);
    if (!kind) {
      const message = "Copiar região funciona nas camadas Visual, Colisão ou Elevação.";
      this.set({ lastMessage: message });
      editorStore.setMessage(message);
      return false;
    }
    const clipboard = this.capture(kind);
    if (!clipboard) return false;
    const message = `${clipboard.width}×${clipboard.height} copiado — ${kindLabel(kind)}.`;
    this.set({ clipboard, stampMode: false, lastMessage: message });
    editorStore.setMessage(message);
    return true;
  };

  copyRawSelection = () => this.copySelection("raw");

  private cellWouldChange(clipboard: RegionClipboard, sourceIndex: number, targetIndex: number) {
    const map = editorStore.getState().map;
    const value = clipboard.values[sourceIndex] ?? 0;
    if (clipboard.kind === "visual") return (map.metatiles[targetIndex] ?? 0) !== value;
    if (clipboard.kind === "collision") return getCollision(map.physical[targetIndex] ?? 0) !== value;
    if (clipboard.kind === "elevation") return getElevation(map.physical[targetIndex] ?? 0) !== value;
    return rawValue(map, targetIndex) !== value;
  }

  private applyLayer(
    clipboard: RegionClipboard,
    targetX: number,
    targetY: number,
    kind: Exclude<ClipboardKind, "raw">,
  ) {
    const before = editorStore.getState();
    editorStore.setViewMode(kind);
    let applied = 0;
    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const tx = targetX + x;
        const ty = targetY + y;
        const state = editorStore.getState();
        if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
        if (editorStore.isProtected(tx, ty)) continue;
        const sourceIndex = idx(x, y, clipboard.width);
        const value = clipboard.values[sourceIndex] ?? 0;
        if (kind === "visual") editorStore.setMetatile(value);
        else if (kind === "collision") editorStore.setCollision(value);
        else editorStore.setElevation(value);
        editorStore.paint(tx, ty, true);
        applied++;
      }
    }
    editorStore.setViewMode(before.viewMode);
    editorStore.setMetatile(before.selectedMetatile);
    editorStore.setCollision(before.selectedCollision);
    editorStore.setElevation(before.selectedElevation);
    return applied;
  }

  private applyRaw(clipboard: RegionClipboard, targetX: number, targetY: number) {
    const before = editorStore.getState();
    let applied = 0;
    const layers: Array<Exclude<ClipboardKind, "raw">> = ["visual", "collision", "elevation"];
    for (const layer of layers) {
      editorStore.setViewMode(layer);
      for (let y = 0; y < clipboard.height; y++) {
        for (let x = 0; x < clipboard.width; x++) {
          const tx = targetX + x;
          const ty = targetY + y;
          const state = editorStore.getState();
          if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) continue;
          if (editorStore.isProtected(tx, ty)) continue;
          const raw = clipboard.values[idx(x, y, clipboard.width)] ?? 0;
          if (layer === "visual") editorStore.setMetatile(raw & 0x03ff);
          else if (layer === "collision") editorStore.setCollision((raw >> 10) & 0x3);
          else editorStore.setElevation((raw >> 12) & 0xf);
          editorStore.paint(tx, ty, true);
          if (layer === "visual") applied++;
        }
      }
    }
    editorStore.setViewMode(before.viewMode);
    editorStore.setMetatile(before.selectedMetatile);
    editorStore.setCollision(before.selectedCollision);
    editorStore.setElevation(before.selectedElevation);
    return applied;
  }

  stampAt = (targetX: number, targetY: number, beginHistory = true) => {
    const clipboard = this.state.clipboard;
    if (!clipboard) {
      editorStore.setMessage("Clipboard vazio.");
      return 0;
    }
    const state = editorStore.getState();
    let candidates = 0;
    let changed = 0;
    let protectedCount = 0;
    let outOfBounds = 0;
    for (let y = 0; y < clipboard.height; y++) {
      for (let x = 0; x < clipboard.width; x++) {
        const tx = targetX + x;
        const ty = targetY + y;
        if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) {
          outOfBounds++;
          continue;
        }
        if (editorStore.isProtected(tx, ty)) {
          protectedCount++;
          continue;
        }
        candidates++;
        if (this.cellWouldChange(clipboard, idx(x, y, clipboard.width), idx(tx, ty, state.map.width))) changed++;
      }
    }
    if (!candidates || !changed) {
      const reason = !candidates
        ? "Carimbo sem células editáveis no destino."
        : "Carimbo não alteraria nenhuma célula.";
      editorStore.setMessage(reason);
      return 0;
    }
    if (beginHistory) editorStore.beginStroke();
    const applied = clipboard.kind === "raw"
      ? this.applyRaw(clipboard, targetX, targetY)
      : this.applyLayer(clipboard, targetX, targetY, clipboard.kind);
    const current = editorStore.getState();
    if (targetX >= 0 && targetY >= 0 && targetX < current.map.width && targetY < current.map.height) {
      editorStore.selectCell(idx(targetX, targetY, current.map.width));
    }
    const extras = [
      protectedCount ? `${protectedCount} protegida(s)` : "",
      outOfBounds ? `${outOfBounds} fora do mapa` : "",
    ].filter(Boolean);
    const message = `Carimbo ${clipboard.width}×${clipboard.height} aplicado em (${targetX},${targetY})${extras.length ? ` — ${extras.join(", ")}` : "."}`;
    this.set({ lastMessage: message });
    editorStore.setMessage(message);
    return applied;
  };

  pasteAtSelected = () => {
    const state = editorStore.getState();
    const target = effectiveSelection();
    if (!target) {
      editorStore.setMessage("Escolha uma célula de destino antes de colar.");
      return 0;
    }
    return this.stampAt(target.x, target.y, true);
  };

  cutSelection = (forceKind?: ClipboardKind) => {
    const state = editorStore.getState();
    const kind = forceKind ?? editableKind(state.viewMode);
    if (!kind) {
      editorStore.setMessage("Recortar região funciona nas camadas Visual, Colisão ou Elevação.");
      return false;
    }
    const selection = effectiveSelection();
    const clipboard = this.capture(kind);
    if (!selection || !clipboard) return false;
    const before = editorStore.getState();
    editorStore.beginStroke();
    let cleared = 0;
    const clearLayer = (layer: Exclude<ClipboardKind, "raw">) => {
      editorStore.setViewMode(layer);
      for (let y = selection.y; y < selection.y + selection.h; y++) {
        for (let x = selection.x; x < selection.x + selection.w; x++) {
          const current = editorStore.getState();
          if (x < 0 || y < 0 || x >= current.map.width || y >= current.map.height) continue;
          if (editorStore.isProtected(x, y)) continue;
          if (layer === "visual") editorStore.setMetatile(0);
          else if (layer === "collision") editorStore.setCollision(0);
          else editorStore.setElevation(0);
          editorStore.paint(x, y, true);
          cleared++;
        }
      }
    };
    if (kind === "raw") {
      clearLayer("visual");
      clearLayer("collision");
      clearLayer("elevation");
    } else {
      clearLayer(kind);
    }
    editorStore.setViewMode(before.viewMode);
    editorStore.setMetatile(before.selectedMetatile);
    editorStore.setCollision(before.selectedCollision);
    editorStore.setElevation(before.selectedElevation);
    const message = `${clipboard.width}×${clipboard.height} recortado — ${kindLabel(kind)}; ${cleared} operação(ões) de célula.`;
    this.set({ clipboard, stampMode: false, lastMessage: message });
    editorStore.setMessage(message);
    return true;
  };

  toggleStampMode = (force?: boolean) => {
    if (!this.state.clipboard) {
      editorStore.setMessage("Copie uma região antes de ativar o carimbo.");
      return false;
    }
    const next = force ?? !this.state.stampMode;
    const message = next
      ? `Carimbo ${this.state.clipboard.width}×${this.state.clipboard.height} ativo — clique/arraste no mapa; Esc sai.`
      : "Carimbo desativado.";
    this.set({ stampMode: next, lastMessage: message });
    editorStore.setMessage(message);
    return next;
  };

  rotate = () => {
    if (!this.state.clipboard) return;
    const clipboard = rotateClipboardClockwise(this.state.clipboard);
    const message = `Clipboard girado 90° → ${clipboard.width}×${clipboard.height}.`;
    this.set({ clipboard, lastMessage: message });
    editorStore.setMessage(message);
  };

  flipHorizontal = () => {
    if (!this.state.clipboard) return;
    const clipboard = flipClipboardHorizontal(this.state.clipboard);
    const message = `Clipboard espelhado horizontalmente (${clipboard.width}×${clipboard.height}).`;
    this.set({ clipboard, lastMessage: message });
    editorStore.setMessage(message);
  };

  flipVertical = () => {
    if (!this.state.clipboard) return;
    const clipboard = flipClipboardVertical(this.state.clipboard);
    const message = `Clipboard espelhado verticalmente (${clipboard.width}×${clipboard.height}).`;
    this.set({ clipboard, lastMessage: message });
    editorStore.setMessage(message);
  };

  clear = () => {
    this.set({ clipboard: null, stampMode: false, lastMessage: "Clipboard limpo." });
    editorStore.setMessage("Clipboard limpo.");
  };
}

export const clipboardStore = new ClipboardStore();

export function useClipboard(): ClipboardState {
  return useSyncExternalStore(clipboardStore.subscribe, clipboardStore.getState, clipboardStore.getState);
}
