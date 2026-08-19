import { useEffect, useSyncExternalStore } from "react";
import { clipboardStore } from "./clipboardStore";
import { editorStore } from "./editorStore";
import { getCollision, getElevation, idx } from "./emeraldMap";
import {
  createMapTemplate,
  parseMapTemplateJson,
  planMapTemplate,
  serializeMapTemplates,
  templateDependencies,
  validateMapTemplate,
  type MapTemplate,
  type TemplateElement,
  type TemplatePoint,
} from "./mapTemplate";
import { patternLibraryStore } from "./patternLibraryStore";
import { realAtlasStore } from "./realAtlasStore";
import { smartPathStore } from "./smartPathStore";

const STORAGE_KEY = "arauna.mapTemplates.v1";

type Listener = () => void;

export interface MapTemplateState {
  templates: MapTemplate[];
  activeTemplateId: string | null;
  enabled: boolean;
  panelOpen: boolean;
  hydrated: boolean;
  lastMessage: string;
}

function currentScope() {
  const atlas = realAtlasStore.ensureHydrated();
  return atlas ? { primary: atlas.primary, secondary: atlas.secondary } : undefined;
}

function cloneTemplate(template: MapTemplate): MapTemplate {
  return {
    ...template,
    tags: [...template.tags],
    ...(template.scope ? { scope: { ...template.scope } } : {}),
    elements: template.elements.map((element) => element.type === "pattern"
      ? { ...element }
      : { ...element, points: element.points.map((point) => ({ ...point })) }),
  };
}

function uniqueTemplateId(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let id = "";
  do {
    id = `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

class MapTemplateStore {
  private state: MapTemplateState = {
    templates: [],
    activeTemplateId: null,
    enabled: false,
    panelOpen: false,
    hydrated: false,
    lastMessage: "Templates prontos.",
  };

  private listeners = new Set<Listener>();

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<MapTemplateState>, persist = true) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
    if (persist) this.persist();
  }

  private persist() {
    if (typeof window === "undefined" || !this.state.hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        templates: this.state.templates,
        activeTemplateId: this.state.activeTemplateId,
      }));
    } catch {
      /* templates continuam em memória quando localStorage não estiver disponível */
    }
  }

  hydrate = () => {
    if (this.state.hydrated || typeof window === "undefined") return;
    let templates: MapTemplate[] = [];
    let activeTemplateId: string | null = null;
    try {
      const source = localStorage.getItem(STORAGE_KEY);
      if (source) {
        const parsed = JSON.parse(source) as Record<string, unknown>;
        const rawTemplates = Array.isArray(parsed.templates) ? parsed.templates : [];
        templates = rawTemplates.flatMap((value) => {
          try {
            const template = parseMapTemplateJson(JSON.stringify(value))[0];
            return template ? [template] : [];
          } catch {
            return [];
          }
        });
        const candidate = typeof parsed.activeTemplateId === "string" ? parsed.activeTemplateId : null;
        activeTemplateId = candidate && templates.some((template) => template.id === candidate)
          ? candidate
          : templates[0]?.id ?? null;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.set({ templates, activeTemplateId, hydrated: true }, false);
  };

  activeTemplate = (): MapTemplate | null => {
    this.hydrate();
    return this.state.templates.find((template) => template.id === this.state.activeTemplateId) ?? null;
  };

  createTemplate = (name?: string, width?: number, height?: number) => {
    this.hydrate();
    const map = editorStore.getState().map;
    const template = createMapTemplate(
      name?.trim() || `Template ${this.state.templates.length + 1}`,
      width ?? Math.min(map.width, 30),
      height ?? Math.min(map.height, 30),
      currentScope(),
    );
    const message = `Template “${template.name}” criado (${template.width}×${template.height}).`;
    this.set({
      templates: [...this.state.templates, template],
      activeTemplateId: template.id,
      enabled: false,
      panelOpen: true,
      lastMessage: message,
    });
    editorStore.setMessage(message);
    return template.id;
  };

  selectTemplate = (id: string) => {
    if (!this.state.templates.some((template) => template.id === id)) return;
    this.set({ activeTemplateId: id, enabled: false });
  };

  private updateActive(mutator: (template: MapTemplate) => MapTemplate) {
    const active = this.activeTemplate();
    if (!active) return false;
    const next = mutator(cloneTemplate(active));
    next.updatedAt = new Date().toISOString();
    const validation = validateMapTemplate(next);
    if (!validation.valid) {
      editorStore.setMessage(`Template inválido: ${validation.errors[0]}`);
      return false;
    }
    this.set({
      templates: this.state.templates.map((template) => template.id === next.id ? next : template),
      enabled: false,
    });
    return true;
  }

  renameActive = (name: string) => this.updateActive((template) => ({ ...template, name }));
  setCategory = (category: string) => this.updateActive((template) => ({ ...template, category }));
  setTags = (tags: string[]) => this.updateActive((template) => ({ ...template, tags }));
  setSize = (width: number, height: number) => this.updateActive((template) => ({
    ...template,
    width: Math.max(1, Math.min(512, Math.floor(width || 1))),
    height: Math.max(1, Math.min(512, Math.floor(height || 1))),
  }));

  addPatternPlacement = (patternId: string, x: number, y: number) => {
    const pattern = patternLibraryStore.getState().patterns.find((item) => item.id === patternId);
    if (!pattern) {
      editorStore.setMessage(`Padrão ${patternId} não encontrado.`);
      return false;
    }
    const ok = this.updateActive((template) => ({
      ...template,
      elements: [...template.elements, {
        type: "pattern",
        patternId,
        x: Math.floor(x),
        y: Math.floor(y),
      }],
    }));
    if (ok) editorStore.setMessage(`Padrão “${pattern.name}” adicionado ao template em (${Math.floor(x)},${Math.floor(y)}).`);
    return ok;
  };

  addActivePattern = (x: number, y: number) => {
    const pattern = patternLibraryStore.activePattern();
    if (!pattern) {
      editorStore.setMessage("Selecione um padrão na Biblioteca antes de adicioná-lo ao template.");
      return false;
    }
    return this.addPatternPlacement(pattern.id, x, y);
  };

  addSmartPathPlacement = (presetId: string, points: TemplatePoint[]) => {
    const preset = smartPathStore.getState().presets.find((item) => item.id === presetId);
    if (!preset) {
      editorStore.setMessage(`Smart Path ${presetId} não encontrado.`);
      return false;
    }
    const cleanPoints = points.map((point) => ({ x: Math.floor(point.x), y: Math.floor(point.y) }));
    const ok = this.updateActive((template) => ({
      ...template,
      elements: [...template.elements, {
        type: "smartPath",
        presetId,
        points: cleanPoints,
        mode: "add",
      }],
    }));
    if (ok) editorStore.setMessage(`Smart Path “${preset.name}” adicionado ao template com ${cleanPoints.length} ponto(s).`);
    return ok;
  };

  addActiveSmartPath = (points: TemplatePoint[]) => {
    const preset = smartPathStore.activePreset();
    if (!preset) {
      editorStore.setMessage("Selecione um preset Smart Path antes de adicioná-lo ao template.");
      return false;
    }
    return this.addSmartPathPlacement(preset.id, points);
  };

  removeElement = (index: number) => this.updateActive((template) => ({
    ...template,
    elements: template.elements.filter((_, itemIndex) => itemIndex !== index),
  }));

  updateElement = (index: number, element: TemplateElement) => this.updateActive((template) => ({
    ...template,
    elements: template.elements.map((current, itemIndex) => itemIndex === index ? element : current),
  }));

  duplicateActive = () => {
    const active = this.activeTemplate();
    if (!active) return null;
    const now = new Date().toISOString();
    const duplicate = cloneTemplate(active);
    duplicate.id = `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    duplicate.name = `${active.name} — cópia`;
    duplicate.createdAt = now;
    duplicate.updatedAt = now;
    this.set({
      templates: [...this.state.templates, duplicate],
      activeTemplateId: duplicate.id,
      enabled: false,
      panelOpen: true,
    });
    return duplicate.id;
  };

  deleteActive = () => {
    const active = this.activeTemplate();
    if (!active) return;
    const templates = this.state.templates.filter((template) => template.id !== active.id);
    const message = `Template “${active.name}” removido.`;
    this.set({
      templates,
      activeTemplateId: templates[0]?.id ?? null,
      enabled: false,
      lastMessage: message,
    });
    editorStore.setMessage(message);
  };

  bindScopeToCurrentAtlas = () => {
    const scope = currentScope();
    if (!scope) {
      editorStore.setMessage("Carregue um atlas real antes de vincular o template.");
      return false;
    }
    const ok = this.updateActive((template) => ({ ...template, scope }));
    if (ok) editorStore.setMessage(`Template vinculado a ${scope.primary} + ${scope.secondary}.`);
    return ok;
  };

  dependencyStatus = (template = this.activeTemplate()) => {
    if (!template) return null;
    return templateDependencies(
      template,
      patternLibraryStore.getState().patterns,
      smartPathStore.getState().presets,
      currentScope(),
    );
  };

  setPanelOpen = (panelOpen: boolean) => this.set({ panelOpen }, false);

  setEnabled = (enabled: boolean) => {
    this.hydrate();
    if (enabled) {
      const template = this.activeTemplate();
      if (!template) {
        editorStore.setMessage("Crie ou importe um template antes de ativar Templates.");
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      const status = this.dependencyStatus(template);
      if (!status?.valid) {
        editorStore.setMessage(`Template não ativado: ${status?.errors[0] ?? "dependências inválidas."}`);
        this.set({ panelOpen: true, enabled: false }, false);
        return false;
      }
      if (patternLibraryStore.getState().enabled) patternLibraryStore.setEnabled(false);
      if (smartPathStore.getState().enabled) smartPathStore.setEnabled(false);
      if (clipboardStore.getState().stampMode) clipboardStore.toggleStampMode(false);
      editorStore.setTool("pencil");
      editorStore.setViewMode("visual");
    }
    const template = this.activeTemplate();
    const message = enabled
      ? `Template “${template?.name ?? ""}” ativo — clique no mapa para posicionar a origem.`
      : "Templates desativados.";
    this.set({ enabled, lastMessage: message }, false);
    editorStore.setMessage(message);
    return enabled;
  };

  toggleEnabled = () => this.setEnabled(!this.state.enabled);

  applyAt = (originX: number, originY: number) => {
    if (!this.state.enabled) return 0;
    const template = this.activeTemplate();
    if (!template) return 0;
    const before = editorStore.getState();
    const plan = planMapTemplate(
      before.map,
      template,
      originX,
      originY,
      patternLibraryStore.getState().patterns,
      smartPathStore.getState().presets,
      currentScope(),
      (x, y) => !editorStore.isProtected(x, y),
    );
    if (!plan.valid) {
      const message = `Template falhou: ${plan.errors[0] ?? "planejamento inválido."}`;
      this.set({ enabled: false, panelOpen: true, lastMessage: message }, false);
      editorStore.setMessage(message);
      return 0;
    }
    if (!plan.touched.length) {
      editorStore.setMessage(`Template “${template.name}” não alterou células nesta posição.`);
      return 0;
    }

    editorStore.beginStroke();
    const oldView = before.viewMode;
    const oldMetatile = before.selectedMetatile;
    const oldCollision = before.selectedCollision;
    const oldElevation = before.selectedElevation;
    let changes = 0;

    for (const cellIndex of plan.touched) {
      const x = cellIndex % before.map.width;
      const y = Math.floor(cellIndex / before.map.width);
      const current = editorStore.getState().map;
      const desiredMetatile = plan.map.metatiles[cellIndex] ?? 0;
      const currentMetatile = current.metatiles[cellIndex] ?? 0;
      if (currentMetatile !== desiredMetatile) {
        editorStore.setViewMode("visual");
        editorStore.setMetatile(desiredMetatile);
        editorStore.paint(x, y, true);
        changes++;
      }

      const desiredCollision = getCollision(plan.map.physical[cellIndex] ?? 0);
      const currentCollision = getCollision(editorStore.getState().map.physical[cellIndex] ?? 0);
      if (currentCollision !== desiredCollision) {
        editorStore.setViewMode("collision");
        editorStore.setCollision(desiredCollision);
        editorStore.paint(x, y, true);
        changes++;
      }

      const desiredElevation = getElevation(plan.map.physical[cellIndex] ?? 0);
      const currentElevation = getElevation(editorStore.getState().map.physical[cellIndex] ?? 0);
      if (currentElevation !== desiredElevation) {
        editorStore.setViewMode("elevation");
        editorStore.setElevation(desiredElevation);
        editorStore.paint(x, y, true);
        changes++;
      }
    }

    editorStore.setViewMode(oldView);
    editorStore.setMetatile(oldMetatile);
    editorStore.setCollision(oldCollision);
    editorStore.setElevation(oldElevation);
    if (originX >= 0 && originY >= 0 && originX < before.map.width && originY < before.map.height) {
      editorStore.selectCell(idx(originX, originY, before.map.width));
    }
    const suffix = plan.warnings.length ? ` ${plan.warnings.join(" ")}` : "";
    const message = `Template “${template.name}” aplicado em (${originX},${originY}); ${plan.touched.length} célula(s), ${changes} alteração(ões).${suffix}`;
    this.set({ lastMessage: message }, false);
    editorStore.setMessage(message);
    return changes;
  };

  exportActiveJson = () => {
    const template = this.activeTemplate();
    return template ? serializeMapTemplates([template]) : null;
  };

  exportAllJson = () => this.state.templates.length ? serializeMapTemplates(this.state.templates) : null;

  importJson = (source: string) => {
    this.hydrate();
    try {
      const incoming = parseMapTemplateJson(source);
      const used = new Set(this.state.templates.map((template) => template.id));
      const imported = incoming.map((template) => ({
        ...cloneTemplate(template),
        id: uniqueTemplateId(template.id, used),
        updatedAt: new Date().toISOString(),
      }));
      const templates = [...this.state.templates, ...imported];
      this.set({
        templates,
        activeTemplateId: imported[0]?.id ?? this.state.activeTemplateId,
        enabled: false,
        panelOpen: true,
        lastMessage: `${imported.length} template(s) importado(s).`,
      });
      editorStore.setMessage(`${imported.length} template(s) importado(s).`);
      return { ok: true as const, count: imported.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      editorStore.setMessage(`Falha ao importar template: ${message}`);
      return { ok: false as const, message };
    }
  };
}

export const mapTemplateStore = new MapTemplateStore();

export function useMapTemplates(): MapTemplateState {
  const state = useSyncExternalStore(
    mapTemplateStore.subscribe,
    mapTemplateStore.getState,
    mapTemplateStore.getState,
  );
  useEffect(() => mapTemplateStore.hydrate(), []);
  return state;
}
