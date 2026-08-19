import { editorStore } from "./editorStore";
import { saveEditorToWritableWorkspace } from "./fileSystemWorkspace";
import type { WorkspaceSession } from "./workspaceSession";

export type ConfirmTransition = (message: string) => boolean;

export interface WorkspaceTransitionResult {
  proceed: boolean;
  saved: boolean;
  reason?: string;
}

export async function prepareWorkspaceTransition(
  session: WorkspaceSession | null,
  confirmTransition: ConfirmTransition = (message) => window.confirm(message),
): Promise<WorkspaceTransitionResult> {
  const state = editorStore.getState();
  if (!state.dirty && !state.mapJsonDirty) return { proceed: true, saved: false };

  if (session?.writeAccess) {
    const confirmed = confirmTransition(
      "Há alterações não salvas no mapa atual. OK salva map.bin/map.json na pasta original antes de continuar. Cancelar mantém o mapa atual aberto.",
    );
    if (!confirmed) return { proceed: false, saved: false, reason: "cancelled" };
    try {
      const result = await saveEditorToWritableWorkspace(session.workspace, session.writeAccess);
      editorStore.setMessage(
        result.saved.length
          ? `Alterações salvas antes da troca: ${result.saved.join(" + ")}.`
          : "Nenhuma alteração precisava ser gravada antes da troca.",
      );
      return { proceed: true, saved: result.saved.length > 0 };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      editorStore.setMessage(`Troca cancelada: falha ao salvar alterações atuais — ${reason}`);
      return { proceed: false, saved: false, reason };
    }
  }

  const confirmed = confirmTransition(
    "Há alterações não exportadas no mapa atual. Este Workspace é somente leitura. Continuar vai descartar essas alterações. Deseja continuar?",
  );
  return confirmed
    ? { proceed: true, saved: false }
    : { proceed: false, saved: false, reason: "cancelled" };
}
