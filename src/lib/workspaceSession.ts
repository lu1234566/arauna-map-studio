import { useSyncExternalStore } from "react";
import type { AraunaWorkspace } from "./repoWorkspace";

export interface WorkspaceSession {
  workspace: AraunaWorkspace;
  label: string;
  openedAt: string;
  lastMapPath: string | null;
}

type Listener = () => void;

class WorkspaceSessionStore {
  private session: WorkspaceSession | null = null;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.session;
  getServerSnapshot = () => null;

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  open(workspace: AraunaWorkspace, label: string) {
    this.session = {
      workspace,
      label,
      openedAt: new Date().toISOString(),
      lastMapPath: null,
    };
    this.emit();
  }

  setLastMap(path: string) {
    if (!this.session) return;
    this.session = { ...this.session, lastMapPath: path };
    this.emit();
  }

  clear() {
    this.session = null;
    this.emit();
  }
}

export const workspaceSessionStore = new WorkspaceSessionStore();

export function useWorkspaceSession(): WorkspaceSession | null {
  return useSyncExternalStore(
    workspaceSessionStore.subscribe,
    workspaceSessionStore.getSnapshot,
    workspaceSessionStore.getServerSnapshot,
  );
}

export function inferWorkspaceLabel(files: FileList | File[]): string {
  const first = Array.from(files)[0] as (File & { webkitRelativePath?: string }) | undefined;
  const relative = first?.webkitRelativePath?.replace(/\\/g, "/") ?? "";
  const root = relative.split("/").filter(Boolean)[0];
  return root || "data/ local";
}
