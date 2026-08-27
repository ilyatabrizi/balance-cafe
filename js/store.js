// One observable object, persisted to localStorage, no dependencies.
// Views subscribe to the slices they care about and re-render on change.

import { STORAGE_PREFIX, CHECKIN } from "./config.js";
import { uid } from "./util.js";

const KEY = STORAGE_PREFIX + "state";

const BLANK = () => ({
  profile: { name: "", phone: "", anonymous: false, defaultMilk: "Whole" },
  bag: [],
  orders: [],
  checkin: null,          // { id, ts, tag, anonymous }
  visits: [],             // { in, out }
  prefs: { installDismissed: false },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return BLANK();
    const saved = JSON.parse(raw);
    // Merge over a blank so a shipped schema change never throws on old data.
    const base = BLANK();
    return {
      ...base, ...saved,
      profile: { ...base.profile, ...(saved.profile || {}) },
      prefs: { ...base.prefs, ...(saved.prefs || {}) },
      bag: Array.isArray(saved.bag) ? saved.bag : [],
      orders: Array.isArray(saved.orders) ? saved.orders : [],
      visits: Array.isArray(saved.visits) ? saved.visits : [],
    };
  } catch {
    return BLANK();
  }
}

const state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* private mode / quota — the session still works, it just won't survive */ }
}

function emit(what) {
  persist();
  for (const fn of [...listeners]) {
    try { fn(what, state); } catch (e) { console.error(e); }
  }
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function get() { return state; }

/* --------------------------------------------------------------- profile */

export function setProfile(patch) {
  Object.assign(state.profile, patch);
  emit("profile");
}

/* ------------------------------------------------------------------- bag */

/** Two lines merge only when the item AND every option match. */
function signature(itemId, opts) {
  return itemId + "|" + Object.entries(opts || {}).sort()
    .map(([k, v]) => `${k}:${v}`).join(",");
}

export function addToBag({ item, opts = {}, qty = 1, note = "", unitPrice }) {
  const sig = signature(item.id, opts);
  const found = state.bag.find((l) => l.sig === sig && (l.note || "") === note);
  if (found) found.qty = Math.min(99, found.qty + qty);
  else {
    state.bag.push({
      id: uid("line"), sig, itemId: item.id, name: item.name,
      photo: item.photo || null, opts, qty, note, unitPrice,
    });
  }
  emit("bag");
}

export function setLineQty(lineId, qty) {
  const i = state.bag.findIndex((l) => l.id === lineId);
  if (i < 0) return;
  if (qty <= 0) state.bag.splice(i, 1);
  else state.bag[i].qty = Math.min(99, qty);
  emit("bag");
}

export function removeLine(lineId) { setLineQty(lineId, 0); }
export function clearBag() { state.bag = []; emit("bag"); }

export const bagCount = () => state.bag.reduce((n, l) => n + l.qty, 0);
export const bagTotal = () => state.bag.reduce((n, l) => n + l.unitPrice * l.qty, 0);

/* ---------------------------------------------------------------- orders */

export function placeOrder(order) {
  state.orders.unshift(order);
  state.orders = state.orders.slice(0, 60);
  state.bag = [];
  emit("orders");
  return order;
}

export function findOrder(code) {
  return state.orders.find((o) => o.code === code) || null;
}

/* --------------------------------------------------------------- check-in */

export function checkIn({ tag, anonymous }) {
  state.checkin = { id: uid("ci"), ts: Date.now(), tag: tag || null, anonymous: !!anonymous };
  emit("checkin");
  return state.checkin;
}

export function updateCheckin(patch) {
  if (!state.checkin) return;
  Object.assign(state.checkin, patch);
  emit("checkin");
}

export function checkOut() {
  if (!state.checkin) return;
  state.visits.unshift({ in: state.checkin.ts, out: Date.now() });
  state.visits = state.visits.slice(0, 80);
  state.checkin = null;
  emit("checkin");
}

/** How long a check-in has left, in milliseconds. */
export function checkinRemaining(now = Date.now()) {
  const ci = state.checkin;
  if (!ci) return 0;
  return Math.max(0, ci.ts + CHECKIN.expireMinutes * 60000 - now);
}

/** A forgotten check-in retires itself after its hour rather than leaving
 *  someone showing as present all evening. Called on boot, on every visibility
 *  change, and by the check-in screen's own tick. */
export function expireStaleCheckin() {
  const ci = state.checkin;
  if (!ci) return false;
  if (checkinRemaining() > 0) return false;
  state.visits.unshift({
    in: ci.ts, out: ci.ts + CHECKIN.expireMinutes * 60000, auto: true,
  });
  state.checkin = null;
  emit("checkin");
  return true;
}

export const isCheckedIn = () => !!state.checkin;

export function setPref(patch) { Object.assign(state.prefs, patch); emit("prefs"); }

/** Wipe everything this device holds. Used by Account → Reset. */
export function resetAll() {
  Object.assign(state, BLANK());
  emit("reset");
}

// Keep two open tabs of the same app honest with each other.
window.addEventListener("storage", (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try {
    Object.assign(state, JSON.parse(e.newValue));
    for (const fn of [...listeners]) fn("external", state);
  } catch { /* ignore a partial write */ }
});
