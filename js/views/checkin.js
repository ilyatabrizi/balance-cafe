// Check-in. One press: the card floods with ink from wherever your finger
// landed, and the mark writes itself in white — the same stroke the loading
// screen draws, because checking in and their logo mean the same thing.
//
// A check-in lasts an hour and the ring around the mark shows it running down.
// Checking out by hand still works at any moment.

import { el, haptic, ago, inFor, elapsed, dayLabel, clockOf, prefersReducedMotion } from "../util.js";
import { icon } from "../icons.js";
import { CHECKIN, BUSINESS } from "../config.js";
import { mark, toast, switchToggle, sectionHead, openingStatus } from "../ui.js";
import { spring } from "../motion.js";
import { penFor } from "../markdraw.js";
import {
  get, checkIn, checkOut, updateCheckin, setProfile, subscribe,
  checkinRemaining,
} from "../store.js";
import * as presence from "../presence.js";

const EXPIRE_MS = CHECKIN.expireMinutes * 60000;
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const DRAW_MS = 520;
const COVERED = 0.62;   // flood progress at which the glyph is certainly inked

function minutesLeftLabel(ms) {
  if (ms <= 0) return "Time is up";
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return "Less than a minute left";
  return `${mins} min left`;
}

export function checkinView() {
  const root = el("div");

  root.append(
    el("header.pad", { style: { paddingTop: "6px", paddingBottom: "20px" } },
      el("h1.display", "Check in"),
      el("p.body", { style: { marginTop: "8px" } },
        "Let the bar know you have arrived, and see who else is in.")),
  );

  /* ---------------------------------------------------------- the toggle */

  const ink = el("span.ci-ink", { "aria-hidden": "true" });
  const wave = el("span.ci-wave", { "aria-hidden": "true" });
  const markBox = mark("ci-mark");
  const label = el("span.ci-text");
  const sub = el("span.ci-sub.num");

  const ring = el("span", { "aria-hidden": "true" });
  ring.innerHTML =
    `<svg class="ci-ring" viewBox="0 0 118 118" fill="none" stroke-width="2.5"
          stroke-linecap="round">
       <circle class="ci-ring__track" cx="59" cy="59" r="${RING_R}"/>
       <circle class="ci-ring__fill" cx="59" cy="59" r="${RING_R}"
               stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="0"/>
     </svg>`;
  const ringPath = ring.querySelector(".ci-ring__fill");

  const body = el("span.ci-body", { dataset: { settling: "0" } },
    el("span.ci-glyph", wave, ring.firstElementChild, markBox),
    label, sub);

  const toggle = el("button.ci-toggle", {
    type: "button",
    "aria-pressed": String(!!get().checkin),
    "aria-label": `Check in at ${BUSINESS.name}`,
  }, ink, body);

  // The mark's own svg, so the pen can be clipped to the real letterform.
  const markSvg = markBox.querySelector("svg");
  const markPath = markSvg?.querySelector("path");
  let pen = null;
  let inkAnim = null;

  /** Size and place the flood disc so it reaches every corner from (x, y). */
  function seedInk(x, y) {
    const r = toggle.getBoundingClientRect();
    const px = x ?? r.width / 2;
    const py = y ?? r.height / 2;
    const radius = Math.hypot(Math.max(px, r.width - px), Math.max(py, r.height - py));
    ink.style.width = ink.style.height = `${radius * 2}px`;
    ink.style.left = `${px - radius}px`;
    ink.style.top = `${py - radius}px`;
    return radius;
  }

  function setInk(scale) {
    ink.style.transform = `scale(${scale})`;
  }

  function setRing(ms) {
    const frac = Math.max(0, Math.min(1, ms / EXPIRE_MS));
    ringPath.setAttribute("stroke-dashoffset", (RING_C * (1 - frac)).toFixed(2));
  }

  /** State without motion — first render, and any change made elsewhere. */
  function paintToggle() {
    const ci = get().checkin;
    inkAnim?.stop(); inkAnim = null;
    pen?.remove(); pen = null;
    if (markPath) markPath.style.opacity = "";
    toggle.dataset.on = ci ? "1" : "0";
    toggle.setAttribute("aria-pressed", String(!!ci));
    body.dataset.settling = "0";
    seedInk();
    setInk(ci ? 1 : 0);
    label.textContent = ci ? "You’re here" : "I’m here";
    sub.textContent = ci
      ? minutesLeftLabel(checkinRemaining())
      : `Tap when you arrive at ${BUSINESS.name}`;
    setRing(ci ? checkinRemaining() : EXPIRE_MS);
  }

  /* --------------------------------------------------------- the flourish */

  function floodOn(x, y) {
    seedInk(x, y);
    toggle.dataset.on = "1";
    toggle.setAttribute("aria-pressed", "true");
    body.dataset.settling = "1";
    label.textContent = "You’re here";
    sub.textContent = minutesLeftLabel(checkinRemaining());

    if (prefersReducedMotion()) {
      setInk(1);
      body.dataset.settling = "0";
      setRing(checkinRemaining());
      return;
    }

    // The mark steps out of the way; the pen puts it back in white.
    if (markPath) markPath.style.opacity = "0";
    pen?.remove();
    pen = markSvg ? penFor(markSvg, markPath) : null;
    pen?.set(0);

    let drawing = false;
    inkAnim?.stop();
    inkAnim = spring({
      from: 0, to: 1, damping: 0.92, response: 0.5,
      onFrame: (v) => {
        setInk(v);
        // Only start writing once the ink has certainly covered the glyph.
        if (!drawing && v >= COVERED) {
          drawing = true;
          writeMark(1, () => {
            haptic([10, 26, 14]);
            wave.classList.remove("go");
            void wave.offsetWidth;          // restart the animation
            wave.classList.add("go");
            body.dataset.settling = "0";
            setRing(checkinRemaining());
          });
        }
      },
    });
  }

  function floodOff() {
    toggle.dataset.on = "0";
    toggle.setAttribute("aria-pressed", "false");
    body.dataset.settling = "1";

    const restore = () => {
      label.textContent = "I’m here";
      sub.textContent = `Tap when you arrive at ${BUSINESS.name}`;
      body.dataset.settling = "0";
      pen?.remove(); pen = null;
      if (markPath) markPath.style.opacity = "";
      setRing(EXPIRE_MS);
    };

    if (prefersReducedMotion()) { setInk(0); restore(); return; }

    // Unwrite, then let the ink fall back to where it came from.
    if (pen) writeMark(0, () => { /* handled by the ink settling */ });
    inkAnim?.stop();
    inkAnim = spring({
      from: inkAnim ? inkAnim.value() : 1, to: 0, damping: 1, response: 0.42,
      onFrame: setInk,
      onRest: restore,
    });
  }

  /** Run the pen from its current end to `to` (1 written, 0 blank). */
  function writeMark(to, done) {
    if (!pen) { done?.(); return; }
    const from = to === 1 ? 0 : 1;
    const started = performance.now();
    const ms = to === 1 ? DRAW_MS : 260;
    const step = (now) => {
      const t = Math.min(1, (now - started) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      pen?.set(from + (to - from) * e);
      if (t < 1) { requestAnimationFrame(step); return; }
      if (to === 1 && markPath) {
        // Hand the letter back to its own filled path — identical pixels.
        markPath.style.opacity = "";
        pen?.remove(); pen = null;
      }
      done?.();
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------- pressing */

  let pressPoint = null;
  toggle.addEventListener("pointerdown", (e) => {
    const r = toggle.getBoundingClientRect();
    pressPoint = { x: e.clientX - r.left, y: e.clientY - r.top };
  });

  toggle.addEventListener("click", () => {
    const ci = get().checkin;
    if (ci) {
      checkOut();
      haptic(12);
      floodOff();
      toast("Checked out. See you soon.", "check");
    } else {
      const created = checkIn({
        tag: get().profile.lastTag || null,
        anonymous: !!get().profile.anonymous,
      });
      haptic(11);
      floodOn(pressPoint?.x, pressPoint?.y);
      presence.publish("in", {
        id: created.id,
        name: get().profile.name || "Guest",
        anonymous: created.anonymous,
        tag: created.tag,
        ts: created.ts,
      });
      toast(`You’re checked in for the next hour`, "check");
    }
    pressPoint = null;
    paintTags();
    refreshList();
  });

  root.append(el("div.pad", toggle));

  const status = openingStatus();
  if (!status.open) {
    root.append(el("div.pad", { style: { marginTop: "14px" } },
      el("p.note", `Balance is closed right now — it opens at ${status.opensAt}. `
        + "You can still check in, but the room will be quiet.")));
  }

  /* ------------------------------------------- what are you here for */

  const tagBox = el("div.pad", { style: { marginTop: "26px" } });

  function paintTags() {
    const ci = get().checkin;
    tagBox.replaceChildren();
    if (!ci) return;

    const buttons = CHECKIN.tags.map((t) => el("button.chip", {
      type: "button", "aria-pressed": String(ci.tag === t),
      onclick: () => {
        const next = get().checkin?.tag === t ? null : t;
        updateCheckin({ tag: next });
        setProfile({ lastTag: next });
        haptic(6);
        paintTags();
        refreshList();
      },
    }, t));

    tagBox.append(
      el("span.field__label", "Here for"),
      el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, buttons),
      el("div.row.row--between", { style: { marginTop: "22px" } },
        el("div.grow",
          el("div.headline", "Stay anonymous"),
          el("div.caption", { style: { marginTop: "2px" } }, "You show up as “Someone”")),
        switchToggle(ci.anonymous, (v) => {
          updateCheckin({ anonymous: v });
          refreshList();
        }, "Stay anonymous")),
      el("button.btn.btn--ghost.btn--full", {
        type: "button", style: { marginTop: "22px" },
        onclick: () => toggle.click(),
      }, "Check out now"),
    );
  }

  root.append(tagBox);

  /* -------------------------------------------------------- the room */

  const listHead = el("div.pad", { style: { marginTop: "36px" } });
  const listBox = el("div.pad");
  root.append(listHead, listBox);

  function paintList(people) {
    listHead.replaceChildren(sectionHead("In the room now",
      el("span.caption.num", people.length ? String(people.length) : "")));

    if (!people.length) {
      listBox.replaceChildren(el("div.card.card--pad",
        el("p.body", { style: { textAlign: "center" } },
          openingStatus().open
            ? "Quiet in here. Nobody has checked in yet."
            : "Closed for now — check back when the doors open.")));
      return;
    }

    listBox.replaceChildren(el("div.card.card--pad",
      people.map((p) => el("div.person",
        presence.personAvatar(p),
        el("div.grow",
          el("div.person__name", p.me ? `${p.name} · you` : p.name),
          el("div.person__meta.num", p.ts ? inFor(p.ts) : "Just arrived")),
        p.tag ? el("span.person__tag", p.tag) : null,
      ))));
  }

  function refreshList() {
    presence.list({ force: true }).then(paintList);
  }
  paintList([]);
  refreshList();

  /* --------------------------------------------------- your own visits */

  const visitBox = el("div");
  function paintVisits() {
    const visits = get().visits.slice(0, 6);
    visitBox.replaceChildren();
    if (!visits.length) return;
    visitBox.append(el("section.section.pad",
      sectionHead("Your visits"),
      el("div.card.card--pad",
        visits.map((v) => el("div.person",
          el("div.avatar", { "aria-hidden": "true" }, icon("clock")),
          el("div.grow",
            el("div.person__name", dayLabel(v.in)),
            el("div.person__meta.num",
              `${clockOf(new Date(v.in))} – ${clockOf(new Date(v.out))} · ${elapsed(v.out - v.in)}`)),
          v.auto ? el("span.person__tag", "auto") : null,
        )))));
  }
  paintVisits();
  root.append(visitBox);

  root.append(el("section.section.pad",
    el("p.note",
      "Checking in only shows your first name to other people using this app, and only "
      + `while you are here. It runs out on its own after an hour, or the moment you `
      + "check out. Nothing is scored, nothing is saved by the café.")));

  /* --------------------------------------------------------- ticking */

  paintToggle();
  paintTags();

  const tick = setInterval(() => {
    const ci = get().checkin;
    if (ci && checkinRemaining() <= 0) {
      // The hour is up. Retire it with the same motion as a manual check-out,
      // so it never simply blinks away while someone is looking at it.
      floodOff();
      checkOutExpired();
      return;
    }
    if (ci) {
      sub.textContent = minutesLeftLabel(checkinRemaining());
      setRing(checkinRemaining());
    }
    presence.list().then(paintList);
  }, 20000);

  function checkOutExpired() {
    checkOut();
    paintTags();
    paintVisits();
    refreshList();
    toast("Your hour is up — checked out automatically.", "clock");
  }

  const unsub = subscribe((what) => {
    if (what !== "checkin" && what !== "external") return;
    // A change made somewhere else (another tab, the auto-expiry on resume)
    // has no gesture behind it, so it lands without the flourish.
    if (what === "external") paintToggle();
    paintTags();
    paintVisits();
    refreshList();
  });

  root.addEventListener("view:teardown", () => {
    clearInterval(tick);
    inkAnim?.stop();
    unsub();
  });
  return root;
}
