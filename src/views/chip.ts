/**
 * Chip view — extracted unchanged from the original src/app.ts.
 *
 * Owns:
 *   - building a chip Scene from a seed
 *   - rendering it to the shared canvas
 *   - exposing a save-as-PNG hook to the shell
 *
 * Shared shell bits (seed input, nav, build badge, update toast) live in
 * app.ts; this view is just the canvas-painting half.
 */

import { buildScene } from '../gen/scene.js';
import { renderScene } from '../render/canvas.js';

export interface ChipViewHandle {
  regenerate(seed: string): void;
  saveCanvas(seed: string): void;
  /** Last-rendered timing summary for the status line. */
  lastStatus(): string;
}

export function mountChipView(canvas: HTMLCanvasElement, setStatus: (msg: string) => void): ChipViewHandle {
  const RENDER_PX = (() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(window.innerWidth, window.innerHeight);
    if (w < 400) return Math.round(720 * dpr / 1.5);
    return 1024;
  })();
  const DIE_RESOLUTION = 256;

  let lastStatus = '';

  function regenerate(seed: string): void {
    setStatus('generating chip…');
    requestAnimationFrame(() => {
      const t0 = performance.now();
      const { scene, interference } = buildScene({
        seed,
        dieW: DIE_RESOLUTION,
        dieH: DIE_RESOLUTION,
      });
      const t1 = performance.now();
      renderScene(canvas, scene, interference, { pixelSize: RENDER_PX });
      const t2 = performance.now();
      lastStatus = `chip · seed ${seed} · gen ${(t1 - t0).toFixed(0)} ms · render ${(t2 - t1).toFixed(0)} ms`;
      setStatus(lastStatus);
    });
  }

  function saveCanvas(seed: string): void {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chip-${seed}.png`;
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
  };
}
