/**
 * App shell — owns the DOM (nav, seed input, regenerate, save-as-PNG,
 * build-id badge, update toast, status line) and mounts either the chip view
 * (route '/') or the board view (route '/board') into the shared canvas.
 *
 * Mobile-first layout: canvas fills the viewport, controls sit at the bottom
 * within thumb reach, the top nav switches views without a page reload.
 *
 * Shared-seed contract:
 *   - '/?seed=foo' and '/board?seed=foo' produce deterministic output for
 *     the same value of foo. The seed lives in the URL, so it survives nav
 *     between views.
 */

import { registerSW } from 'virtual:pwa-register';
import { BUILD_ID } from './build-id.generated.js';
import { makeRouter, type Route } from './ui/router.js';
import { mountChipView, type ChipViewHandle } from './views/chip.js';
import { mountBoardView, type BoardViewHandle } from './views/board.js';
import { clampCount, type LayoutCounts } from './board/layout.js';

type CountKey = 'ram' | 'pcie' | 'electro' | 'inductor';

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
  navChip: HTMLButtonElement;
  navBoard: HTMLButtonElement;
  labelsToggle: HTMLButtonElement;
  boardCounters: Map<CountKey, { dec: HTMLButtonElement; inc: HTMLButtonElement; value: HTMLElement }>;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function generateRandomSeed(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0]!.toString(36)}${a[1]!.toString(36)}`;
}

function setStatus(els: AppEls, msg: string): void {
  els.status.textContent = msg;
}

function readSeedFromUrl(): string | null {
  const u = new URL(window.location.href);
  return u.searchParams.get('seed');
}

function readLabelsFromUrl(): boolean {
  const u = new URL(window.location.href);
  return u.searchParams.get('labels') === '1';
}

function syncUrl(updates: { seed?: string; labels?: boolean }): void {
  const url = new URL(window.location.href);
  if (updates.seed !== undefined) url.searchParams.set('seed', updates.seed);
  if (updates.labels !== undefined) {
    if (updates.labels) url.searchParams.set('labels', '1');
    else url.searchParams.delete('labels');
  }
  history.replaceState(null, '', url.toString());
}

function wirePinchZoom(canvas: HTMLCanvasElement, wrap: HTMLElement): void {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const apply = (): void => {
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  wrap.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const newScale = Math.max(0.5, Math.min(8, scale * (1 + delta)));
      scale = newScale;
      apply();
    },
    { passive: false },
  );

  wrap.addEventListener('dblclick', () => {
    scale = 1;
    tx = 0;
    ty = 0;
    apply();
  });

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

function resetCanvasTransform(canvas: HTMLCanvasElement): void {
  canvas.style.transform = '';
}

function init(): void {
  // Collect counter triples (label/dec/value/inc) for each ± strip
  const boardCounters = new Map<CountKey, { dec: HTMLButtonElement; inc: HTMLButtonElement; value: HTMLElement }>();
  for (const node of Array.from(document.querySelectorAll<HTMLElement>('#board-controls .counter'))) {
    const key = node.dataset.key as CountKey | undefined;
    if (!key) continue;
    const dec = node.querySelector<HTMLButtonElement>('button.dec');
    const inc = node.querySelector<HTMLButtonElement>('button.inc');
    const value = node.querySelector<HTMLElement>('[data-display]');
    if (dec && inc && value) boardCounters.set(key, { dec, inc, value });
  }

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
    navChip: $('nav-chip') as HTMLButtonElement,
    navBoard: $('nav-board') as HTMLButtonElement,
    labelsToggle: $('labels-toggle') as HTMLButtonElement,
    boardCounters,
  };

  els.buildBadge.textContent = BUILD_ID;
  els.buildBadge.title = `Build ${BUILD_ID}`;

  wirePinchZoom(els.canvas, els.canvasWrap);

  const router = makeRouter();

  // Board options state — labels persisted in URL, counts ephemeral (memory).
  // Counts start unset; the seeded layout chooses defaults until the user
  // overrides via ±. Overrides persist across seed changes within the session.
  let showLabels = readLabelsFromUrl();
  const countOverrides: Partial<LayoutCounts> = {};

  // View handles — mounted lazily; only the active view's regenerate is called.
  let chipView: ChipViewHandle | null = null;
  let boardView: BoardViewHandle | null = null;

  function getChip(): ChipViewHandle {
    if (!chipView) chipView = mountChipView(els.canvas, (msg) => setStatus(els, msg));
    return chipView;
  }
  function getBoard(): BoardViewHandle {
    if (!boardView) boardView = mountBoardView(els.canvas, (msg) => setStatus(els, msg));
    return boardView;
  }

  function refreshCounterDisplays(): void {
    if (!boardView) return;
    const placed = boardView.lastPlacedCounts();
    for (const [key, ctrl] of els.boardCounters) {
      const n = (key === 'electro') ? placed.electro : placed[key];
      ctrl.value.textContent = String(n);
    }
  }

  function activeRegenerate(seed: string): void {
    syncUrl({ seed });
    if (router.current() === '/board') {
      getBoard().regenerate(seed, {
        counts: countOverrides,
        showDescriptions: showLabels,
      });
      // Counter displays reflect what was actually placed (≤ requested).
      requestAnimationFrame(refreshCounterDisplays);
    } else {
      getChip().regenerate(seed);
    }
  }

  function applyRoute(route: Route): void {
    // Body class drives canvas aspect-ratio + chrome variations.
    document.body.classList.toggle('view-board', route === '/board');
    document.body.classList.toggle('view-chip', route === '/');
    els.navChip.classList.toggle('primary', route === '/');
    els.navBoard.classList.toggle('primary', route === '/board');
    els.regenBtn.classList.toggle('primary', true);
    resetCanvasTransform(els.canvas);
    activeRegenerate(els.seedInput.value.trim() || generateRandomSeed());
  }

  // Nav button wiring — use history.pushState (router.navigate), never a full reload.
  els.navChip.addEventListener('click', () => router.navigate('/'));
  els.navBoard.addEventListener('click', () => router.navigate('/board'));
  router.onChange((r) => applyRoute(r));

  // Labels toggle
  els.labelsToggle.setAttribute('aria-pressed', showLabels ? 'true' : 'false');
  els.labelsToggle.addEventListener('click', () => {
    showLabels = !showLabels;
    els.labelsToggle.setAttribute('aria-pressed', showLabels ? 'true' : 'false');
    syncUrl({ labels: showLabels });
    if (router.current() === '/board') {
      const seed = els.seedInput.value.trim() || generateRandomSeed();
      getBoard().regenerate(seed, { counts: countOverrides, showDescriptions: showLabels });
      requestAnimationFrame(refreshCounterDisplays);
    }
  });

  // ± counter wiring
  for (const [key, ctrl] of els.boardCounters) {
    const bump = (delta: number): void => {
      // Start from the currently-placed count (so the first click is intuitive).
      const cur = countOverrides[key] ?? (boardView?.lastPlacedCounts()[key] ?? 0);
      const next = clampCount(key, cur + delta);
      if (next === countOverrides[key]) return;
      countOverrides[key] = next;
      const seed = els.seedInput.value.trim() || generateRandomSeed();
      activeRegenerate(seed);
    };
    ctrl.dec.addEventListener('click', () => bump(-1));
    ctrl.inc.addEventListener('click', () => bump(+1));
  }

  // Initial seed: URL > random
  const urlSeed = readSeedFromUrl();
  const initialSeed = urlSeed ?? generateRandomSeed();
  els.seedInput.value = initialSeed;
  applyRoute(router.current());

  els.regenBtn.addEventListener('click', () => {
    const seed = els.seedInput.value.trim() || generateRandomSeed();
    els.seedInput.value = seed;
    activeRegenerate(seed);
  });

  els.randomSeedBtn.addEventListener('click', () => {
    const seed = generateRandomSeed();
    els.seedInput.value = seed;
    activeRegenerate(seed);
  });

  els.seedInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') els.regenBtn.click();
  });

  els.saveBtn.addEventListener('click', () => {
    const seed = els.seedInput.value.trim() || 'noseed';
    if (router.current() === '/board') getBoard().saveCanvas(seed);
    else getChip().saveCanvas(seed);
  });

  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateToast(els, () => updateSW(true));
    },
    onOfflineReady() {
      setStatus(els, 'offline-ready · ' + (els.status.textContent ?? ''));
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
