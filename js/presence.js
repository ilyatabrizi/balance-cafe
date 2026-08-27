// Who is in the room right now.
//
// Two sources, one interface:
//
//   • REMOTE  — set CHECKIN.endpoint in config.js and presence becomes shared
//               across everyone's phone. Contract in README → Check-in.
//   • LOCAL   — no endpoint: this device's own check-in is real and persistent,
//               and a deterministic roster of regulars fills the room so the
//               feature can actually be judged on one phone.
//
// The roster is derived from the clock, not from Math.random, so it holds still
// across reloads, ticks forward the way a real room does, and never contradicts
// itself between the home screen and the check-in list.

import { CHECKIN, BUSINESS } from "./config.js";
import { el, hash, initials } from "./util.js";
import { icon } from "./icons.js";
import { get } from "./store.js";
import { openingStatus } from "./ui.js";

const REGULARS = [
  "Sara M.", "Amir T.", "Nazanin", "Mehdi K.", "Elnaz", "Reza P.", "Parisa",
  "Kian", "Shirin B.", "Arash", "Mahsa", "Sepehr", "Bahar", "Nima R.",
  "Yasaman", "Pouya", "Golnaz", "Farid", "Tara", "Hooman", "Negin",
  "Kaveh", "Roya", "Sina M.", "Melika", "Babak", "Anahita", "Omid",
  "Setareh", "Kamran", "Dorsa", "Payam", "Niloofar", "Ehsan",
  "Saba", "Arman", "Mitra", "Behnam", "Shadi", "Kourosh",
];

// Arrivals are not uniform across the day. These weights put people in the room
// when a café in Roshdieh actually has people in it.
const RHYTHM = [
  [480, 570, 1.3],    // 08:00–09:30  the openers
  [570, 750, 2.2],    // 09:30–12:30  morning peak
  [750, 990, 1.2],    // 12:30–16:30  the flat afternoon
  [990, 1140, 1.8],   // 16:30–19:00  after work
  [1140, 1290, 2.0],  // 19:00–21:30  evening peak
  [1290, 1380, 0.7],  // 21:30–23:00  last hour
];
const TOTAL_WEIGHT = RHYTHM.reduce((n, r) => n + r[2], 0);

/** hash -> [0,1) */
const unit = (seed) => (hash(seed) % 100000) / 100000;

function arrivalMinute(u) {
  let acc = 0;
  for (const [from, to, w] of RHYTHM) {
    const share = w / TOTAL_WEIGHT;
    if (u < acc + share) {
      return Math.round(from + ((u - acc) / share) * (to - from));
    }
    acc += share;
  }
  return 1200;
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Everyone whose visit spans `now`, with real arrival timestamps. */
function demoRoster(now = new Date()) {
  const status = openingStatus(now);
  if (!status.open) return [];

  const key = dayKey(now);
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const nowMin = (now - midnight) / 60000;
  const out = [];

  for (const name of REGULARS) {
    const seed = `${name}@${key}`;
    const arrive = arrivalMinute(unit(seed));
    const stay = 45 + (hash(seed + "|stay") % 105);       // 45–150 minutes
    if (nowMin < arrive || nowMin > arrive + stay) continue;

    const tagIdx = hash(seed + "|tag") % CHECKIN.tags.length;
    const anon = hash(seed + "|anon") % 11 === 0;          // roughly one in eleven
    out.push({
      id: `r_${hash(seed)}`,
      name: anon ? "Someone" : name,
      anonymous: anon,
      ts: midnight.getTime() + arrive * 60000,
      tag: hash(seed + "|hastag") % 3 === 0 ? null : CHECKIN.tags[tagIdx],
      me: false,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ remote */

async function remoteList() {
  const r = await fetch(CHECKIN.endpoint, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`presence ${r.status}`);
  const data = await r.json();
  return (Array.isArray(data) ? data : data.checkins || []).map((c) => ({
    id: String(c.id),
    name: c.anonymous ? "Someone" : (c.name || "Guest"),
    anonymous: !!c.anonymous,
    ts: new Date(c.checked_in_at || c.ts).getTime(),
    tag: c.tag || null,
    me: false,
  }));
}

export async function publish(action, payload) {
  if (!CHECKIN.endpoint) return;
  try {
    if (action === "in") {
      await fetch(CHECKIN.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${CHECKIN.endpoint}/${encodeURIComponent(payload.id)}`, { method: "DELETE" });
    }
  } catch (e) {
    // Presence is best-effort: a failed sync must never block the toggle.
    console.warn("presence sync failed", e);
  }
}

/* ------------------------------------------------------------------ public */

let cache = { at: 0, rows: [] };

/** Me first, then most recent arrival first. */
function withMe(rows) {
  const ci = get().checkin;
  if (!ci) return rows;
  const profile = get().profile;
  const me = {
    id: ci.id,
    name: ci.anonymous ? "Someone" : (profile.name || "You"),
    anonymous: ci.anonymous,
    ts: ci.ts, tag: ci.tag, me: true,
  };
  return [me, ...rows.filter((r) => r.id !== ci.id)];
}

/**
 * @returns {Promise<Array<{id,name,anonymous,ts,tag,me}>>}
 */
export async function list({ force = false } = {}) {
  const fresh = Date.now() - cache.at < 20000;
  if (!force && fresh) return withMe(cache.rows);

  let rows = [];
  if (CHECKIN.endpoint) {
    try { rows = await remoteList(); }
    catch { rows = cache.rows; }
  } else if (CHECKIN.demoPresence) {
    rows = demoRoster();
  }
  rows.sort((a, b) => b.ts - a.ts);
  cache = { at: Date.now(), rows };
  return withMe(rows);
}

/** Synchronous count for chrome that must render immediately. */
export function countSync() {
  const rows = cache.at ? cache.rows : (CHECKIN.demoPresence && !CHECKIN.endpoint ? demoRoster() : []);
  if (!cache.at) cache = { at: Date.now(), rows };
  return withMe(rows).length;
}

export function avatarLetters(person) {
  if (person.anonymous) return "·";
  // Before they have given a name, "You" would initialise to "YO". A glyph
  // reads better than a wrong monogram.
  if (person.me && !get().profile.name) return null;
  return initials(person.name);
}

/** The avatar circle for one person, letters or glyph as appropriate. */
export function personAvatar(person, extra = "") {
  const letters = avatarLetters(person);
  const cls = `div.avatar${person.me ? ".avatar--me" : ""}${extra ? "." + extra : ""}`;
  return el(cls, letters || icon("account"));
}

export const isShared = () => !!CHECKIN.endpoint;
export const venueName = BUSINESS.name;
