/**
 * Board view — paints the motherboard scene to the shared canvas.
 *
 * Mirrors the chip view's contract so app.ts can swap between them with a
 * one-line mount call.
 */

import { buildBoardScene } from '../board/scene.js';
import { renderBoard } from '../board/render.js';
import type { LayoutCounts } from '../board/layout.js';

export interface BoardRegenerateOptions {
  /** Per-category count overrides (any subset). */
  counts?: Partial<LayoutCounts>;
  /** Overlay CPU/DIMM/BIOS-style descriptive labels. */
  showDescriptions?: boolean;
}

export interface BoardViewHandle {
  regenerate(seed: string, opts?: BoardRegenerateOptions): void;
  saveCanvas(seed: string): void;
  lastStatus(): string;
  /** Actually-placed component counts from the most recent regenerate. */
  lastPlacedCounts(): LayoutCounts;
}

export function mountBoardView(canvas: HTMLCanvasElement, setStatus: (msg: string) => void): BoardViewHandle {
  const PX = (() => {
    // The board is wider than tall, so we use a slightly larger pixel width
    // than the chip view to keep BGA balls readable.
    const w = Math.min(window.innerWidth, 1400);
    if (w < 500) return 800;
    if (w < 900) return 1100;
    return 1400;
  })();

  let lastStatus = '';
  let lastPlaced: LayoutCounts = { ram: 0, pcie: 0, electro: 0, ceramic: 0, inductor: 0 };

  function regenerate(seed: string, opts: BoardRegenerateOptions = {}): void {
    setStatus('generating board…');
    requestAnimationFrame(() => {
      const t0 = performance.now();
      const { scene, placedCounts } = buildBoardScene({ seed, counts: opts.counts });
      lastPlaced = placedCounts;
      const t1 = performance.now();
      renderBoard(canvas, scene, { pixelWidth: PX, showDescriptions: opts.showDescriptions });
      const t2 = performance.now();
      lastStatus =
        `board · seed ${seed} · ${scene.components.length} parts · ` +
        `${scene.traces.length} traces · gen ${(t1 - t0).toFixed(0)} ms · ` +
        `render ${(t2 - t1).toFixed(0)} ms`;
      setStatus(lastStatus);
    });
  }

  function saveCanvas(seed: string): void {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `board-${seed}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return {
    regenerate,
    saveCanvas,
    lastStatus: () => lastStatus,
    lastPlacedCounts: () => lastPlaced,
  };
}
