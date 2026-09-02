import { openWorkspaceMap, type AraunaWorkspace, type OpenWorkspaceMapResult, type WorkspaceLayout, type WorkspaceMap } from "./repoWorkspace";

export interface RuntimeWorkspaceLayout {
  layout: WorkspaceLayout;
  isBase: boolean;
  source: "map.json" | "setmaplayoutindex";
}

export function parseRuntimeLayoutIds(source: string): string[] {
  const ids = new Set<string>();
  const regex = /\bsetmaplayoutindex\s+(LAYOUT_[A-Z0-9_]+)/gi;
  for (const match of source.matchAll(regex)) {
    const id = match[1]?.trim();
    if (id) ids.add(id.toUpperCase());
  }
  return [...ids];
}

function workspaceFile(workspace: AraunaWorkspace, path: string): File | undefined {
  return workspace.files.get(path) ?? workspace.filesLower.get(path.toLowerCase());
}

export async function runtimeLayoutsForMap(
  workspace: AraunaWorkspace,
  map: WorkspaceMap,
): Promise<RuntimeWorkspaceLayout[]> {
  const layouts: RuntimeWorkspaceLayout[] = [];
  const base = map.layout ?? workspace.layouts.get(map.layoutId);
  if (base) layouts.push({ layout: base, isBase: true, source: "map.json" });

  const scriptPath = `data/maps/${map.directory}/scripts.inc`;
  const script = workspaceFile(workspace, scriptPath);
  if (!script) return layouts;

  for (const id of parseRuntimeLayoutIds(await script.text())) {
    if (id === map.layoutId) continue;
    const layout = workspace.layouts.get(id);
    if (!layout) continue;
    if (layouts.some((candidate) => candidate.layout.id === layout.id)) continue;
    layouts.push({ layout, isBase: false, source: "setmaplayoutindex" });
  }

  return layouts;
}

export function activeWorkspaceLayout(
  workspace: AraunaWorkspace,
  sourceFile: string | null | undefined,
): WorkspaceLayout | null {
  if (!sourceFile) return null;
  const normalized = sourceFile.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  for (const layout of workspace.layouts.values()) {
    if (layout.blockdata_filepath.toLowerCase() === normalized) return layout;
  }
  return null;
}

export async function openWorkspaceRuntimeLayout(
  workspace: AraunaWorkspace,
  map: WorkspaceMap,
  layoutId: string,
): Promise<OpenWorkspaceMapResult> {
  const layout = workspace.layouts.get(layoutId);
  if (!layout) throw new Error(`Layout runtime não encontrado: ${layoutId}.`);

  return openWorkspaceMap(workspace, {
    ...map,
    layoutId: layout.id,
    layout,
  });
}
