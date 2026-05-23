/**
 * App shell — wires the DOM (seed input, regenerate, save-as-PNG, build-id
 * badge, "refresh to update" toast) to the generator + renderer.
 *
 * Mobile-first layout: the canvas fills the viewport, controls are anchored
 * at the bottom of the screen reachable by thumb. Pinch-zoom is on the
 * canvas only (touch-action: none on the canvas element).
 */

import { buildScene } from './gen/scene.js';
import { renderScene } from './render/canvas.js';
import { registerSW } from 'virtual:pwa-register';
import { BUILD_ID } from './build-id.generated.js';

const RENDER_PX = (() => {
  // On narrow / low-DPI screens render at a slightly lower resolution to
  // stay under our 3s mid-range mobile budget; on desktop we go to 1024.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.min(window.innerWidth, window.innerHeight);
  if (w < 400) return Math.round(720 * dpr / 1.5);
  return 1024;
})();

const DIE_RESOLUTION = 256;

interface AppEls {
  canvas: HTMLCanvasElement;
  canvasWrap: HTMLElement;
  seedInput: HTMLInputElement;
  regenBtn: HTMLButtonElement;
  randomSeedBtn: HTMLButtonElement;
  saveBtn: HTMLButtonElement;
  buildBadge: HTMLElement;
  toast: HTMLElement;
  toastBtn: HTMLButtonElement;
  status: HTMLElement;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function generateRandomSeed(): string {
  // Use ISO seconds + crypto random — only place we accept non-deterministic
  // input, and it's only to *pick* a seed, not to drive the generator.
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0]!.toString(36)}${a[1]!.toString(36)}`;
}

function setStatus(els: AppEls, msg: string): void {
  els.status.textContent = msg;
}

function regenerate(els: AppEls, seed: string): void {
  setStatus(els, 'generating…');
  // Yield to the browser so the status update paints before the heavy work.
  requestAnimationFrame(() => {
    const t0 = performance.now();
    const { scene, interference } = buildScene({
      seed,
      dieW: DIE_RESOLUTION,
      dieH: DIE_RESOLUTION,
    });
    const t1 = performance.now();
    renderScene(els.canvas, scene, interference, { pixelSize: RENDER_PX });
    const t2 = performance.now();
    setStatus(
      els,
      `seed ${seed} · gen ${(t1 - t0).toFixed(0)} ms · render ${(t2 - t1).toFixed(0)} ms`
    );
    // Keep the address bar's seed in sync — share-by-URL works for free.
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url.toString());
  });
}

function readSeedFromUrl(): string | null {
  const u = new URL(window.location.href);
  return u.searchParams.get('seed');
}

function wirePinchZoom(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  // Minimal pan/zoom on the canvas. We translate via CSS transforms so the
  // bitmap doesn't have to be re-rasterized. Two-finger pan/pinch on touch,
  // wheel zoom on mouse.
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const apply = (): void => {
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  // Wheel zoom (desktop)
  wrap.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const newScale = Math.max(0.5, Math.min(8, scale * (1 + delta)));
      scale = newScale;
      apply();
    },
    { passive: false }
  );

  // Double-tap / double-click resets
  wrap.addEventListener('dblclick', () => {
    scale = 1;
    tx = 0;
    ty = 0;
    apply();
  });

  // Touch pinch + pan
  const pointers = new Map<number, { x: number; y: number }>();
  let lastDist = 0;
  let lastMid = { x: 0, y: 0 };

  wrap.addEventListener('pointerdown', (e: PointerEvent) => {
    wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      lastMid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
    }
  });
  wrap.addEventListener('pointermove', (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      tx += e.clientX - prev.x;
      ty += e.clientY - prev.y;
      apply();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      if (lastDist > 0) {
        const ratio = dist / lastDist;
        const ns = Math.max(0.5, Math.min(8, scale * ratio));
        scale = ns;
      }
      tx += mid.x - lastMid.x;
      ty += mid.y - lastMid.y;
      lastDist = dist;
      lastMid = mid;
      apply();
    }
  });
  const releasePointer = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = 0;
  };
  wrap.addEventListener('pointerup', releasePointer);
  wrap.addEventListener('pointercancel', releasePointer);
}

function showUpdateToast(els: AppEls, onAccept: () => void): void {
  els.toast.classList.add('visible');
  els.toastBtn.onclick = (): void => {
    els.toast.classList.remove('visible');
    onAccept();
  };
}

function init(): void {
  const els: AppEls = {
    canvas: $('chip-canvas') as HTMLCanvasElement,
    canvasWrap: $('canvas-wrap'),
    seedInput: $('seed-input') as HTMLInputElement,
    regenBtn: $('regen-btn') as HTMLButtonElement,
    randomSeedBtn: $('random-seed-btn') as HTMLButtonElement,
    saveBtn: $('save-btn') as HTMLButtonElement,
    buildBadge: $('build-badge'),
    toast: $('update-toast'),
    toastBtn: $('update-accept') as HTMLButtonElement,
    status: $('status-line'),
  };

  // Build-id badge — corner-anchored, visible at a glance which build is live.
  els.buildBadge.textContent = BUILD_ID;
  els.buildBadge.title = `Build ${BUILD_ID}`;

  // Determine initial seed: URL param > random.
  const urlSeed = readSeedFromUrl();
  const initialSeed = urlSeed ?? generateRandomSeed();
  els.seedInput.value = initialSeed;
  regenerate(els, initialSeed);

  els.regenBtn.addEventListener('click', () => {
    const seed = els.seedInput.value.trim() || generateRandomSeed();
    els.seedInput.value = seed;
    regenerate(els, seed);
  });

  els.randomSeedBtn.addEventListener('click', () => {
    const seed = generateRandomSeed();
    els.seedInput.value = seed;
    regenerate(els, seed);
  });

  els.seedInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') els.regenBtn.click();
  });

  els.saveBtn.addEventListener('click', () => {
    els.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chip-${els.seedInput.value}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  wirePinchZoom(els.canvas, els.canvasWrap);

  // PWA: registerSW from vite-plugin-pwa gives us the prompt/autoUpdate hook.
  // Even though we configured autoUpdate, we still show a toast on new SW so
  // the user knows the reload happened — never silent.
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateToast(els, () => updateSW(true));
    },
    onOfflineReady() {
      setStatus(els, 'offline-ready · ' + els.status.textContent);
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
