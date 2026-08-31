import { TILE_PX } from "@/lib/demoAtlas";
import { useEditor } from "@/lib/editorStore";
import { usePixelLabOverlay } from "@/lib/pixellabOverlayStore";

export function PixelLabOverlay() {
  const editor = useEditor();
  const overlay = usePixelLabOverlay();
  if (!overlay.visible || !overlay.imageDataUrl || !overlay.bounds) return null;
  const cellSize = TILE_PX * editor.zoom * 2;
  const { x, y, w, h } = overlay.bounds;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      <img
        src={overlay.imageDataUrl}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          left: editor.pan.x + x * cellSize,
          top: editor.pan.y + y * cellSize,
          width: w * cellSize,
          height: h * cellSize,
          opacity: overlay.opacity,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
