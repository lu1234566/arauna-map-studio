import { useEffect, useSyncExternalStore } from "react";
import type { SavedRealAtlas } from "./realAtlasStore";

export interface MetatileShelf {
  favorites: number[];
  recent: number[];
}

interface ShelfState {
  shelves: Record<string, MetatileShelf>;
}

const STORAGE_KEY = "arauna.metatileShelf.v1";
const MAX_RECENT = 16;
const EMPTY_SHELF: MetatileShelf = { favorites: [], recent: [] };

type Listener = () => void;

export function metatileShelfKey(atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary">) {
  return `${atlas.game ?? "pokeemerald"}|${atlas.primary}|${atlas.secondary}`;
}

function normalizeIds(values: unknown, limit = 0x3ff) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= limit)));
}

class MetatileShelfStore {
  private state: ShelfState = { shelves: {} };
  private hydrated = false;
  private listeners = new Set<Listener>();

  getSnapshot = () => this.state;
  getServerSnapshot = () => ({ shelves: {} } as ShelfState);

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* modo privado/quota: mantém apenas a sessão */
    }
  }

  hydrate = () => {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ShelfState>;
      const shelves: Record<string, MetatileShelf> = {};
      if (parsed.shelves && typeof parsed.shelves === "object") {
        for (const [key, shelf] of Object.entries(parsed.shelves)) {
          const candidate = shelf as Partial<MetatileShelf>;
          shelves[key] = {
            favorites: normalizeIds(candidate.favorites),
            recent: normalizeIds(candidate.recent).slice(0, MAX_RECENT),
          };
        }
      }
      this.state = { shelves };
      this.emit();
    } catch {
      /* armazenamento inválido: começa vazio */
    }
  };

  shelfFor = (atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary"> | null): MetatileShelf => {
    this.hydrate();
    if (!atlas) return EMPTY_SHELF;
    return this.state.shelves[metatileShelfKey(atlas)] ?? EMPTY_SHELF;
  };

  private updateShelf(
    atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary">,
    updater: (shelf: MetatileShelf) => MetatileShelf,
  ) {
    this.hydrate();
    const key = metatileShelfKey(atlas);
    const current = this.state.shelves[key] ?? EMPTY_SHELF;
    const next = updater({ favorites: [...current.favorites], recent: [...current.recent] });
    this.state = { shelves: { ...this.state.shelves, [key]: next } };
    this.persist();
    this.emit();
    return next;
  }

  touch = (atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary">, id: number) => {
    if (!Number.isInteger(id) || id < 0 || id > 0x3ff) return;
    this.updateShelf(atlas, (shelf) => ({
      ...shelf,
      recent: [id, ...shelf.recent.filter((value) => value !== id)].slice(0, MAX_RECENT),
    }));
  };

  touchMany = (atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary">, ids: Iterable<number>) => {
    const valid = Array.from(ids).filter((id) => Number.isInteger(id) && id >= 0 && id <= 0x3ff);
    if (!valid.length) return;
    this.updateShelf(atlas, (shelf) => {
      const recent = [...shelf.recent];
      for (const id of valid) {
        const existing = recent.indexOf(id);
        if (existing >= 0) recent.splice(existing, 1);
        recent.unshift(id);
      }
      return { ...shelf, recent: recent.slice(0, MAX_RECENT) };
    });
  };

  toggleFavorite = (atlas: Pick<SavedRealAtlas, "game" | "primary" | "secondary">, id: number) => {
    if (!Number.isInteger(id) || id < 0 || id > 0x3ff) return false;
    let enabled = false;
    this.updateShelf(atlas, (shelf) => {
      const exists = shelf.favorites.includes(id);
      enabled = !exists;
      return {
        ...shelf,
        favorites: exists
          ? shelf.favorites.filter((value) => value !== id)
          : [...shelf.favorites, id],
      };
    });
    return enabled;
  };
}

export const metatileShelfStore = new MetatileShelfStore();

export function useMetatileShelf(atlas: SavedRealAtlas | null): MetatileShelf {
  const state = useSyncExternalStore(
    metatileShelfStore.subscribe,
    metatileShelfStore.getSnapshot,
    metatileShelfStore.getServerSnapshot,
  );
  useEffect(() => metatileShelfStore.hydrate(), []);
  if (!atlas) return EMPTY_SHELF;
  return state.shelves[metatileShelfKey(atlas)] ?? EMPTY_SHELF;
}
