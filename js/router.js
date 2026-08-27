// Hash routing. Static hosting means no server rewrites, and a hash keeps deep
// links working from the home screen without a 404 shim doing the work.

const routes = [];
let current = null;
let onChange = null;

export function route(pattern, handler) { routes.push({ pattern, handler }); }
export function onNavigate(fn) { onChange = fn; }

export function parse(hashRaw = location.hash) {
  const raw = (hashRaw || "").replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return {
    path: path.startsWith("/") ? path : `/${path}`,
    params: Object.fromEntries(new URLSearchParams(query)),
  };
}

function match(path) {
  for (const r of routes) {
    if (r.pattern === path) return { handler: r.handler, args: {} };
    // ":name" segments, e.g. /order/:code
    if (r.pattern.includes(":")) {
      const p = r.pattern.split("/");
      const a = path.split("/");
      if (p.length !== a.length) continue;
      const args = {};
      let ok = true;
      for (let i = 0; i < p.length; i++) {
        if (p[i].startsWith(":")) args[p[i].slice(1)] = decodeURIComponent(a[i]);
        else if (p[i] !== a[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, args };
    }
  }
  return null;
}

// Each route keeps its scroll offset, the way a native stack does.
const offsets = new Map();

export function go(to, { replace = false } = {}) {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (location.hash === target) { render(); return; }
  if (current) offsets.set(current.path, window.scrollY);
  if (replace) history.replaceState(null, "", target);
  else location.hash = target;
}

export function back(fallback = "/") {
  if (history.length > 1) history.back();
  else go(fallback, { replace: true });
}

let view = null;
export function mount(node) { view = node; }

export function render() {
  const loc = parse();
  const found = match(loc.path) || match("/");
  if (!found) return;
  const prev = current;
  current = { ...loc, args: found.args };

  const node = found.handler({ ...loc.params, ...found.args });
  if (!node) return;

  // Let the outgoing view drop its intervals and window listeners first.
  for (const old of view.children) {
    old.dispatchEvent(new CustomEvent("view:teardown"));
  }
  view.replaceChildren(node);
  node.classList.add("viewin");

  // Restore where they were, but only when coming back to a route — a fresh
  // push should always land at the top.
  const saved = offsets.get(loc.path);
  const returning = prev && prev.path !== loc.path && saved !== undefined;
  requestAnimationFrame(() => window.scrollTo(0, returning ? saved : 0));

  onChange?.(current);
}

export const currentPath = () => (current ? current.path : parse().path);

export function start() {
  window.addEventListener("hashchange", render);
  render();
}
