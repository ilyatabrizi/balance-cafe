// Shared interface pieces: the bottom sheet, toasts, opening hours, and the
// brand marks. The sheet is the only genuinely hard one — it has to track a
// finger exactly, resist at the top, and be catchable mid-flight.

import { el, clear, haptic, hm, pad2, prefersReducedMotion } from "./util.js";
import { icon } from "./icons.js";
import { BUSINESS } from "./config.js";
import { spring, project, rubberband, velocityTracker } from "./motion.js";

/* ------------------------------------------------------------ brand marks */

let LOGO_SVG = "";
let MARK_SVG = "";

export async function loadMarks() {
  const grab = async (url) => {
    try {
      const r = await fetch(url);
      return r.ok ? (await r.text()).trim() : "";
    } catch { return ""; }
  };
  [LOGO_SVG, MARK_SVG] = await Promise.all([
    grab("assets/brand/logo.svg"), grab("assets/brand/mark.svg"),
  ]);
}

export function logo(cls = "") {
  const n = el("span", { class: cls, html: LOGO_SVG, "aria-label": "Balance", role: "img" });
  return n;
}
export function mark(cls = "") {
  return el("span", { class: cls, html: MARK_SVG, "aria-hidden": "true" });
}

/* ----------------------------------------------------------------- toasts */

let toastLayer = null;

export function toast(message, iconName = "check") {
  if (!toastLayer) {
    toastLayer = el("div.toasts", { role: "status", "aria-live": "polite" });
    document.body.append(toastLayer);
  }
  const node = el("div.toast", iconName ? icon(iconName) : null, el("span", message));
  toastLayer.append(node);
  setTimeout(() => {
    node.dataset.out = "1";
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 600);
  }, 2400);
  return node;
}

/* ------------------------------------------------------------------ sheet */

let openSheet = null;

/**
 * A draggable bottom sheet.
 *  - tracks the finger 1:1, respecting where it was grabbed
 *  - rubber-bands upward past its resting height
 *  - on release, projects the flick's momentum and either snaps home or
 *    dismisses, handing the release velocity to the spring so there is no seam
 *  - can be grabbed again while it is still animating, in either direction
 */
export function sheet({ title, build, onClose, footer }) {
  if (openSheet) openSheet.close(true);

  const scrim = el("div.scrim", { onclick: () => close() });
  const scroll = el("div.sheet__scroll");
  const grip = el("div.sheet__grip", { "aria-hidden": "true" }, el("i"));
  const panel = el("div.sheet", {
    role: "dialog", "aria-modal": "true",
    "aria-label": title || "Details",
  }, grip, scroll);

  if (footer) panel.append(el("div.sheet__foot", footer));

  document.body.append(scrim, panel);
  clear(scroll).append(build({ close }));

  // Lock the page behind the sheet without losing its scroll position.
  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";

  const H = () => panel.getBoundingClientRect().height || 1;
  let y = H();                 // current translate; H = fully dismissed
  let anim = null;
  let closed = false;

  const paint = (v) => {
    y = v;
    panel.style.transform = `translateX(-50%) translateY(${v}px)`;
    const p = 1 - Math.min(1, Math.max(0, v / H()));
    scrim.style.opacity = String(p);
  };
  paint(H());

  // Materialise rather than fade — it should read as a surface arriving.
  requestAnimationFrame(() => {
    scrim.dataset.open = "1";
    anim = spring({
      from: H(), to: 0, damping: 0.86, response: 0.42,
      onFrame: paint,
    });
  });

  /* ---- gesture -------------------------------------------------------- */
  const track = velocityTracker();
  let armed = false;      // finger down somewhere a drag could begin
  let dragging = false;   // past the threshold, now actually moving the sheet
  let startY = 0, startTop = 0, pid = null;

  const THRESHOLD = 8;    // hysteresis, so a tap is never mistaken for a drag

  // A press on a control is a press on that control. Only the grip, or plain
  // content already scrolled to the top, may begin a drag.
  const canStart = (e) => {
    if (grip.contains(e.target)) return true;
    if (e.target.closest("button, a, input, textarea, select, label, [role='switch']")) {
      return false;
    }
    return scroll.contains(e.target) && scroll.scrollTop <= 0;
  };

  panel.addEventListener("pointerdown", (e) => {
    if (closed || e.button > 0 || !canStart(e)) return;
    // Grab it mid-flight: keep the on-screen value, drop the animation.
    anim?.stop(); anim = null;
    armed = true;
    dragging = false;
    pid = e.pointerId;
    startY = e.clientY;
    startTop = y;
    track.reset();
    track.add(e.clientY, e.timeStamp);
  });

  panel.addEventListener("pointermove", (e) => {
    if (!armed || e.pointerId !== pid) return;
    const dy = e.clientY - startY;

    if (!dragging) {
      if (Math.abs(dy) < THRESHOLD) return;
      // Only now is this a drag — capture, so tracking survives leaving the
      // panel, and taps that never moved are left alone to become clicks.
      dragging = true;
      try { panel.setPointerCapture(pid); } catch { /* pointer already gone */ }
    }

    const raw = startTop + dy;
    // Above its rest position there is nothing to reveal, so resist.
    const next = raw < 0 ? -rubberband(-raw, H()) : raw;
    e.preventDefault();
    track.add(e.clientY, e.timeStamp);
    paint(next);
  }, { passive: false });

  const release = (e) => {
    if (!armed || (e && e.pointerId !== pid)) return;
    armed = false;
    if (!dragging) return;               // it was a tap; nothing to settle
    dragging = false;
    try { panel.releasePointerCapture(pid); } catch { /* already released */ }
    const v = track.get();
    // Decide on the projected landing point, not on where the finger stopped.
    const landing = y + project(v, 0.9965);
    const dismiss = landing > H() * 0.42 || v > 780;
    if (dismiss) {
      close(false, v);
    } else {
      anim = spring({
        from: y, to: 0, velocity: v,
        damping: v < -400 ? 0.82 : 1, response: 0.36, onFrame: paint,
      });
    }
  };
  panel.addEventListener("pointerup", release);
  panel.addEventListener("pointercancel", release);

  /* ---- teardown ------------------------------------------------------- */
  function finish() {
    scrim.remove();
    panel.remove();
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
    if (openSheet && openSheet.panel === panel) openSheet = null;
    onClose?.();
  }

  function close(immediate = false, velocity = 0) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    anim?.stop();
    scrim.dataset.open = "0";
    if (immediate || prefersReducedMotion()) { finish(); return; }
    anim = spring({
      from: y, to: H() + 40, velocity, damping: 1, response: 0.3,
      onFrame: paint, onRest: finish,
    });
    // Belt and braces: never leave a sheet stuck if a frame is dropped.
    setTimeout(() => { if (panel.isConnected) finish(); }, 700);
  }

  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  openSheet = { panel, close };
  return { close, scroll, panel };
}

export const anySheetOpen = () => !!openSheet;

/* ------------------------------------------------------------ hours logic */

/** Handles a close time written as 24:00 (and past midnight generally). */
function windowFor(day) {
  const raw = BUSINESS.hours[day];
  if (!raw) return null;
  const open = hm(raw[0]);
  let close = hm(raw[1]);
  if (close <= open) close += 1440;      // e.g. 08:00 → 01:00
  return { open, close, raw };
}

/**
 * @returns {{open:boolean, closesAt?:string, opensAt?:string, minsLeft?:number}}
 */
export function openingStatus(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();

  const today = windowFor(day);
  if (today && mins >= today.open && mins < today.close) {
    return { open: true, closesAt: today.raw[1], minsLeft: today.close - mins };
  }
  // Still inside yesterday's window if it ran past midnight.
  const yest = windowFor((day + 6) % 7);
  if (yest && yest.close > 1440 && mins < yest.close - 1440) {
    return { open: true, closesAt: yest.raw[1], minsLeft: yest.close - 1440 - mins };
  }
  if (today && mins < today.open) {
    return { open: false, opensAt: today.raw[0], today: true };
  }
  const tomorrow = windowFor((day + 1) % 7);
  return { open: false, opensAt: tomorrow ? tomorrow.raw[0] : "08:00", today: false };
}

export function statusPill(now = new Date()) {
  const s = openingStatus(now);
  const node = el("span.status" + (s.open ? "" : ".status--closed"),
    el("i.status__dot" + (s.open ? ".status__dot--live" : "")),
    el("span", s.open
      ? (s.minsLeft <= 60 ? `Closing in ${s.minsLeft} min` : `Open until ${s.closesAt}`)
      : `Opens ${s.today ? "" : "tomorrow "}${s.opensAt}`),
  );
  return node;
}

/** Human list of hours for the info section, collapsing equal days. */
export function hoursTable() {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const rows = [];
  for (let d = 0; d < 7; d++) {
    const w = BUSINESS.hours[d];
    const text = w ? `${w[0]} – ${w[1] === "24:00" ? "00:00" : w[1]}` : "Closed";
    const prev = rows[rows.length - 1];
    if (prev && prev.text === text) prev.days.push(names[d]);
    else rows.push({ days: [names[d]], text });
  }
  return rows.map((r) => ({
    label: r.days.length === 1 ? r.days[0]
      : `${r.days[0].slice(0, 3)} – ${r.days[r.days.length - 1].slice(0, 3)}`,
    text: r.text,
  }));
}

/* ------------------------------------------------------------- primitives */

export function switchToggle(checked, onChange, label) {
  const node = el("button.switch", {
    role: "switch", "aria-checked": String(!!checked),
    "aria-label": label || "Toggle",
    onclick: () => {
      const next = node.getAttribute("aria-checked") !== "true";
      node.setAttribute("aria-checked", String(next));
      haptic(6);
      onChange(next);
    },
  }, el("i"));
  return node;
}

export function stepper(qty, onChange, { min = 0, max = 99 } = {}) {
  const out = el("div.stepper");
  const value = el("span.num", String(qty));
  const dec = el("button", {
    "aria-label": "One fewer", disabled: qty <= min,
    onclick: () => bump(-1),
  }, icon("minus"));
  const inc = el("button", {
    "aria-label": "One more", disabled: qty >= max,
    onclick: () => bump(1),
  }, icon("plus"));

  function bump(d) {
    qty = Math.max(min, Math.min(max, qty + d));
    value.textContent = String(qty);
    dec.disabled = qty <= min;
    inc.disabled = qty >= max;
    haptic(5);
    onChange(qty);
  }
  out.append(dec, value, inc);
  return out;
}

export function sectionHead(title, right) {
  return el("div.sect-head",
    el("h2.label.label--ink", title),
    right || null,
  );
}

export function emptyState(message, action) {
  return el("div.empty",
    mark("empty__mark"),
    el("p.body", message),
    action ? el("div", { style: { marginTop: "20px" } }, action) : null,
  );
}

/** Directions that work whether or not Google Maps is reachable. */
export function mapsUrl() {
  const { lat, lng } = BUSINESS.geo;
  const q = encodeURIComponent(`${BUSINESS.legal}, ${BUSINESS.district}, ${BUSINESS.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}&center=${lat},${lng}`;
}

export function timeSlots(count, stepMinutes, leadMinutes) {
  const out = [];
  const now = new Date();
  const start = new Date(now.getTime() + leadMinutes * 60000);
  // Round up to the next step so the list reads 10:15, 10:30, not 10:17.
  const r = start.getMinutes() % stepMinutes;
  if (r) start.setMinutes(start.getMinutes() + (stepMinutes - r));
  start.setSeconds(0, 0);
  for (let i = 0; i < count; i++) {
    const t = new Date(start.getTime() + i * stepMinutes * 60000);
    out.push(`${pad2(t.getHours())}:${pad2(t.getMinutes())}`);
  }
  return out;
}
