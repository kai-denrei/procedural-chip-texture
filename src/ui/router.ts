/**
 * Tiny pathname-based router.
 *
 * Two routes only: '/' and '/board'. Anything else falls back to '/'.
 * Uses history.pushState so nav links never trigger a full page reload —
 * we tear down whatever the previous view installed and remount.
 *
 * The shared bits (seed input, build badge, update toast, nav buttons) live
 * in the shell (app.ts) and are not torn down. Each view only owns the
 * canvas painting + seed-driven regeneration.
 */

export type Route = '/' | '/board';

export interface RouteHandler {
  mount(seed: string): void;
  unmount(): void;
  regenerate(seed: string): void;
  saveCanvas(seed: string): void;
}

export interface Router {
  current(): Route;
  navigate(to: Route, seed?: string): void;
  /** Subscribe to route changes. */
  onChange(cb: (route: Route) => void): () => void;
}

/**
 * Strip Vite's configured base from a pathname before route matching, and
 * re-prefix it when navigating. On a GitHub Pages project deploy the app
 * lives at /<repo>/ — pathname will be '/<repo>/board', so we strip '/<repo>'
 * and route on '/board' just like local dev.
 *
 * `import.meta.env.BASE_URL` is the resolved base value: '/' for root,
 * './' for relative builds (treated like root), '/<repo>/' for sub-path.
 */
function rawBase(): string {
  const b = import.meta.env.BASE_URL;
  if (!b || b === '/' || b === './') return '/';
  // Vite guarantees a trailing slash; strip the trailing slash for prefix work.
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

function stripBase(pathname: string): string {
  const base = rawBase();
  if (base === '/') return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(base + '/')) return pathname.slice(base.length);
  return pathname;
}

function withBase(path: Route): string {
  const base = rawBase();
  if (base === '/') return path;
  return base + path;
}

function normalize(pathname: string): Route {
  const p = stripBase(pathname);
  if (p === '/board' || p === '/board/') return '/board';
  return '/';
}

export function makeRouter(): Router {
  const listeners = new Set<(r: Route) => void>();

  const notify = (): void => {
    const r = normalize(window.location.pathname);
    for (const l of listeners) l(r);
  };

  window.addEventListener('popstate', notify);

  return {
    current: () => normalize(window.location.pathname),
    navigate(to, seed) {
      const url = new URL(window.location.href);
      url.pathname = withBase(to);
      if (seed) url.searchParams.set('seed', seed);
      // Use pushState — no page reload.
      history.pushState(null, '', url.toString());
      notify();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
