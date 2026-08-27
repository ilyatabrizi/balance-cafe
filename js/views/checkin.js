// Check-in. One toggle: press it when you walk in, and the room can see you are
// here. No points, no tiers, no history the café keeps — the list empties itself.

import { el, haptic, ago, inFor, elapsed, dayLabel, clockOf } from "../util.js";
import { icon } from "../icons.js";
import { CHECKIN, BUSINESS } from "../config.js";
import { mark, toast, switchToggle, sectionHead, openingStatus } from "../ui.js";
import { get, checkIn, checkOut, updateCheckin, setProfile, subscribe } from "../store.js";
import * as presence from "../presence.js";

export function checkinView() {
  const root = el("div");
  const state = get();

  /* ------------------------------------------------------------ header */
  root.append(
    el("header.pad", { style: { paddingTop: "6px", paddingBottom: "20px" } },
      el("div.row.row--between", { style: { alignItems: "flex-start" } },
        el("div.grow",
          el("h1.display", "Check in"),
          el("p.body", { style: { marginTop: "8px" } },
            "Let the bar know you have arrived, and see who else is in.")),
      ),
    ),
  );

  /* ------------------------------------------------------------ toggle */
  const toggle = el("button.ci-toggle", {
    type: "button", "aria-pressed": String(!!state.checkin),
    "aria-label": "Check in at Balance",
  });
  const fill = el("div.ci-toggle__fill");
  const body = el("div.ci-toggle__body");
  toggle.append(fill, body);

  const status = openingStatus();

  function paintToggle() {
    const ci = get().checkin;
    toggle.dataset.on = ci ? "1" : "0";
    toggle.setAttribute("aria-pressed", String(!!ci));
    body.replaceChildren(
      mark("ci-toggle__mark"),
      el("span.ci-toggle__text", ci ? "You’re here" : "I’m here"),
      el("span.ci-toggle__since.num",
        ci ? `Checked in ${ago(ci.ts)}` : `Tap when you arrive at ${BUSINESS.name}`),
    );
  }

  toggle.addEventListener("click", () => {
    const ci = get().checkin;
    if (ci) {
      checkOut();
      haptic(12);
      toast("Checked out. See you soon.", "check");
    } else {
      const created = checkIn({
        tag: get().profile.lastTag || null,
        anonymous: !!get().profile.anonymous,
      });
      haptic([10, 30, 14]);
      presence.publish("in", {
        id: created.id,
        name: get().profile.name || "Guest",
        anonymous: created.anonymous,
        tag: created.tag,
        ts: created.ts,
      });
      toast(`You’re checked in at ${BUSINESS.name}`, "check");
    }
    refreshAll();
  });

  root.append(el("div.pad", toggle));

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

    const buttons = CHECKIN.tags.map((t) => {
      const b = el("button.chip", {
        type: "button", "aria-pressed": String(ci.tag === t),
        onclick: () => {
          const next = get().checkin?.tag === t ? null : t;
          updateCheckin({ tag: next });
          setProfile({ lastTag: next });
          haptic(6);
          paintTags();
          refreshList();
        },
      }, t);
      return b;
    });

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
        onclick: () => { toggle.click(); },
      }, "Check out"),
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
  const visits = get().visits.slice(0, 6);
  if (visits.length) {
    root.append(el("section.section.pad",
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

  /* ---------------------------------------------------------- the rules */
  root.append(el("section.section.pad",
    el("p.note",
      `Checking in only shows your first name to other people using this app, and only while you are here. `
      + `It clears itself after ${CHECKIN.expireHours} hours, or the moment you check out. `
      + `Nothing is scored, nothing is saved by the café.`)));

  /* ------------------------------------------------------- live ticking */
  function refreshAll() { paintToggle(); paintTags(); refreshList(); }
  refreshAll();

  // Elapsed times must stay honest without the page being reloaded.
  const tick = setInterval(() => {
    paintToggle();
    presence.list().then(paintList);
  }, 30000);

  const unsub = subscribe((what) => {
    if (what === "checkin" || what === "external") refreshAll();
  });

  root.addEventListener("view:teardown", () => { clearInterval(tick); unsub(); });
  return root;
}
