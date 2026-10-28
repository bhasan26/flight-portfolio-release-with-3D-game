// Only known sections and content IDs may be opened from a shared URL.
export function createPortfolioRouter(window, { sections, projects, stories, onRoute }) {
  const allowed = new Map([
    ['section', new Set(sections)],
    ['project', new Set(projects)],
    ['story', new Set(stories)]
  ]);
  let lastHash;

  function parse(hash) {
    let value;
    try {
      value = decodeURIComponent(hash.replace(/^#/, ''));
    } catch {
      return null;
    }
    const parts = value.split('/');
    const route = parts.length === 1
      ? { type: 'section', id: parts[0] }
      : parts.length === 2 ? { type: parts[0], id: parts[1] } : null;
    return route && allowed.get(route.type)?.has(route.id) ? route : null;
  }

  function hashFor(route) {
    if (!allowed.get(route.type)?.has(route.id)) return null;
    return route.type === 'section'
      ? `#${encodeURIComponent(route.id)}`
      : `#${route.type}/${encodeURIComponent(route.id)}`;
  }

  function apply() {
    const hash = window.location.hash;
    if (hash === lastHash) return;
    lastHash = hash;
    const route = parse(hash);
    // Going Back to the original unfragmented page returns to the landing view.
    if (route || !hash) onRoute(route || { type: 'section', id: 'departure' });
  }

  window.addEventListener('popstate', apply);
  window.addEventListener('hashchange', apply);

  return {
    start() {
      // Keep the browser's scroll restoration for an ordinary page load.
      lastHash = window.location.hash;
      const route = parse(lastHash);
      if (route) onRoute(route);
    },
    navigate(route, { replace = false, applyRoute = true } = {}) {
      const hash = hashFor(route);
      if (!hash) return false;
      if (window.location.hash !== hash) {
        window.history[replace ? 'replaceState' : 'pushState'](null, '', hash);
      }
      lastHash = hash;
      if (applyRoute) onRoute(route);
      return true;
    },
    urlFor(route) {
      const hash = hashFor(route);
      if (!hash) return null;
      const url = new URL(window.location.href);
      url.hash = hash;
      return url.href;
    }
  };
}
