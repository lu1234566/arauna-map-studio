import { editorStore } from "./editorStore";
import { mapBinDimensionCandidates, parseMapBinDimensionInput } from "./mapBinImport";

let installed = false;

function fail(message: string) {
  editorStore.setMessage(`Falha na importação: ${message}`);
  if (typeof window !== "undefined") window.alert(`Não foi possível importar o map.bin.\n\n${message}`);
  return { ok: false as const, message };
}

export function installFlexibleBinImport() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  editorStore.importBuffer = (buffer: ArrayBuffer, fileName: string) => {
    if (!buffer.byteLength || buffer.byteLength % 2 !== 0) {
      return fail(`O arquivo possui ${buffer.byteLength} bytes; map.bin precisa ter quantidade par de bytes (uint16).`);
    }

    const cells = buffer.byteLength / 2;
    const current = editorStore.getState().map;
    let width: number;
    let height: number;

    if (cells === current.width * current.height) {
      width = current.width;
      height = current.height;
    } else if (cells === 400) {
      width = 20;
      height = 20;
    } else {
      const candidates = mapBinDimensionCandidates(buffer);
      const suggested = candidates[0];
      if (!suggested) {
        return fail(`${buffer.byteLength} bytes = ${cells} células, mas não foi encontrada uma dimensão plausível.`);
      }

      const options = candidates
        .slice(0, 8)
        .map((candidate) => `${candidate.width}×${candidate.height}`)
        .join(", ");
      const answer = window.prompt(
        `${fileName}\n${buffer.byteLength} bytes = ${cells} células.\n\n` +
          `O map.bin não armazena largura/altura. Confirme a dimensão do mapa.\n` +
          `Sugestões: ${options}\n\nDigite LARGURA×ALTURA:`,
        `${suggested.width}×${suggested.height}`,
      );
      if (answer == null) {
        const message = `Importação de ${fileName} cancelada; nenhuma alteração foi feita.`;
        editorStore.setMessage(message);
        return { ok: false as const, message };
      }
      const dimensions = parseMapBinDimensionInput(answer, cells);
      if (!dimensions) {
        return fail(
          `Dimensão “${answer}” inválida para ${cells} células. ` +
            `Use largura×altura e garanta que largura × altura = ${cells}.`,
        );
      }
      width = dimensions.width;
      height = dimensions.height;
    }

    const result = editorStore.importBufferSized(buffer, fileName, width, height);
    if (result.ok) {
      editorStore.setMessage(
        `Importado ${fileName} — ${buffer.byteLength} bytes, ${width}×${height} (${cells} células). ` +
          `Dimensão ${cells === 400 ? "20×20 reconhecida" : "confirmada/inferida"}. Aguardando map.json deste mapa.`,
      );
    } else {
      window.alert(`Não foi possível importar o map.bin.\n\n${result.message}`);
    }
    return result;
  };
}

installFlexibleBinImport();
