import { useEffect, useMemo, useRef } from "react";
import type { AiExactGridPlan } from "@/lib/aiExactGrid";
import {
  atlasSourceRect,
  realAtlasStore,
  type SavedRealAtlas,
} from "@/lib/realAtlasStore";

const MAX_W = 210;
const MAX_H = 150;

function previewScale(width: number, height: number) {
  if (!width || !height) return 1;
  return Math.max(1, Math.min(6, Math.floor(Math.min(MAX_W / width, MAX_H / height))));
}

export function ExactGridPreview({
  grid,
  atlas,
}: {
  grid: AiExactGridPlan;
  atlas: SavedRealAtlas | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = useMemo(() => previewScale(grid.width, grid.height), [grid.width, grid.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, grid.width * scale);
    canvas.height = Math.max(1, grid.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#171c18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!atlas) return;
    const source = realAtlasStore.getCanvas(atlas);
    if (!source) return;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = grid.cells[y * grid.width + x];
        if (!cell) continue;
        const record = realAtlasStore.recordFor(cell.metatile, atlas);
        const dx = x * scale;
        const dy = y * scale;
        if (!record) {
          ctx.fillStyle = "#4a514b";
          ctx.fillRect(dx, dy, scale, scale);
          continue;
        }
        const rect = atlasSourceRect(atlas, record);
        ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, dx, dy, scale, scale);
      }
    }
  }, [atlas, grid.cells, grid.height, grid.width, scale]);

  return (
    <div className="rounded border border-primary/30 bg-canvas/75 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-semibold text-primary">Exact Grid · preview final</div>
          <div className="font-mono text-[8px] text-muted-foreground">
            {grid.resolvedCount}/{grid.totalCount} células · checksum {grid.checksum}
          </div>
        </div>
        <div className="text-right font-mono text-[8px] text-muted-foreground">
          <div>{grid.changedCount} alteradas</div>
          <div>{grid.layeredMetatileCount} layered</div>
        </div>
      </div>
      <div className="flex justify-center overflow-hidden rounded border border-border/70 bg-black/30 p-1.5">
        <canvas
          ref={canvasRef}
          className="pixelated block"
          style={{
            width: grid.width * scale,
            height: grid.height * scale,
            maxWidth: MAX_W,
            maxHeight: MAX_H,
          }}
          title="Preview da matriz exata que será aplicada ao map.bin"
        />
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1 font-mono text-[7px] text-muted-foreground">
        <span>solo {grid.ownerCounts.ground}</span>
        <span>rua {grid.ownerCounts.road}</span>
        <span>estrutura {grid.ownerCounts.structure}</span>
        <span>detalhe {grid.ownerCounts.detail}</span>
        <span>preserva {grid.ownerCounts.preserve}</span>
      </div>
      {grid.structureMask && (
        <div className="mt-1.5 rounded border border-border/60 bg-black/20 px-1.5 py-1 font-mono text-[7px] leading-3 text-muted-foreground">
          <div>
            máscara: {grid.structureMask.opaqueCount} opacas · {grid.structureMask.transparentCount} contexto transparente
          </div>
          <div>
            retorno: {grid.structureMask.restoredGroundCount} solo · {grid.structureMask.restoredRoadCount} vias · {grid.structureMask.restoredPreserveCount} preservadas
          </div>
          <div>física ground/road normalizada: {grid.structureMask.normalizedPhysicalCount}</div>
        </div>
      )}
    </div>
  );
}
