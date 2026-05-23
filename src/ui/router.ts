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

function normalize(pathname: string): Route {
  // Vite/preview may serve under a base, but our spec only uses '/' and '/board'.
  // Allow trailing slash too.
  if (pathname.endsWith('/board') || pathname.endsWith('/board/')) return '/board';
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
      url.pathname = to;
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
