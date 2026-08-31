import { useSyncExternalStore } from "react";
import type { PixelLabRegion } from "./pixellabMapRender";

export interface PixelLabOverlayState { visible: boolean; opacity: number; imageDataUrl: string | null; bounds: PixelLabRegion | null }
type Listener = () => void;
let state: PixelLabOverlayState = { visible: false, opacity: 0.55, imageDataUrl: null, bounds: null };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener());

export const pixelLabOverlayStore = {
  subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot() { return state; },
  getServerSnapshot(): PixelLabOverlayState { return { visible: false, opacity: 0.55, imageDataUrl: null, bounds: null }; },
  show(imageDataUrl: string, bounds: PixelLabRegion) { state = { ...state, visible: true, imageDataUrl, bounds }; emit(); },
  hide() { state = { ...state, visible: false }; emit(); },
  setOpacity(opacity: number) { state = { ...state, opacity: Math.max(0.05, Math.min(1, opacity)) }; emit(); },
  clear() { state = { visible: false, opacity: state.opacity, imageDataUrl: null, bounds: null }; emit(); },
};

export function usePixelLabOverlay() {
  return useSyncExternalStore(pixelLabOverlayStore.subscribe, pixelLabOverlayStore.getSnapshot, pixelLabOverlayStore.getServerSnapshot);
}
