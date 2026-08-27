// Small shared helpers. No framework, no dependencies.

/** Hyperscript. `el("div.card", {onclick}, child, child)` */
export function el(spec, props, ...kids) {
  const [tag, ...classes] = String(spec).split(".");
  const n = document.createElement(tag || "div");
  if (classes.length) n.className = classes.join(" ");
  if (props && (props.nodeType || Array.isArray(props) || typeof props === "string")) {
    kids.unshift(props);
  } else if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className += (n.className ? " " : "") + v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === "dataset") Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? "" : v);
    }
  }
  add(n, kids);
  return n;
}

function add(parent, kids) {
  for (const k of kids.flat(4)) {
    if (k === null || k === undefined || k === false || k === "") continue;
    parent.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) { while (node.firstChild) node.firstChild.remove(); return node; }

/** 78000 -> "78,000" */
export const money = (n) => Math.round(n).toLocaleString("en-US");

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "08:00" -> minutes since midnight */
export function hm(s) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export const pad2 = (n) => String(n).padStart(2, "0");

export function clockOf(date) { return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }

/** A span of time on its own: "under a minute", "12 min", "1h 20m". */
export function elapsed(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** How long ago something happened: "just now", "12 min ago". */
export function ago(ts, now = Date.now()) {
  if (now - ts < 60000) return "just now";
  return `${elapsed(now - ts)} ago`;
}

/** How long someone has been in the room, phrased like a person would. */
export function inFor(ts, now = Date.now()) {
  if (now - ts < 120000) return "Just arrived";
  return `In for ${elapsed(now - ts)}`;
}

export function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(today.getTime() - 864e5);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic 32-bit hash — stable ids and stable "random" without a seed. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** A short, human-readable order code: BL-4820 */
export function orderCode(seed = Date.now()) {
  return `BL-${String(hash(String(seed)) % 9000 + 1000)}`;
}

/** Iran mobile numbers, the way people actually type them. */
export function normalisePhone(v) {
  const digits = String(v || "").replace(/[^\d+]/g, "").replace(/^\+98/, "0").replace(/^98/, "0");
  return digits;
}
export function validPhone(v) {
  return /^09\d{9}$/.test(normalisePhone(v));
}

/** Taptic-ish feedback. Silently absent on iOS Safari, which is fine — the
 *  animation carries the same beat, and §13 says they must land together. */
export function haptic(pattern = 8) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

export function debounce(fn, ms = 120) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Fade a photo in once it has actually decoded — no half-painted images.
 *  `eager` is for anything inside a horizontal rail: the lazy heuristic only
 *  looks down the page, so a card scrolled off to the side never loads. */
export function photo(src, alt, cls = "", { eager = false } = {}) {
  const img = el("img.fade", {
    src, alt, class: cls, decoding: "async",
    loading: eager ? "eager" : "lazy",
    fetchpriority: eager ? "high" : "auto",
  });
  const show = () => img.classList.add("in");
  if (img.complete) requestAnimationFrame(show);
  else img.addEventListener("load", show, { once: true });
  img.addEventListener("error", () => img.classList.add("in"), { once: true });
  return img;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
