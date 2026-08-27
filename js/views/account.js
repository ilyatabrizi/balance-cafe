// Account. Your details, your orders, your visits — held on this device only.
// Deliberately no points, no tiers, no stamps: the client asked for a café app,
// not a loyalty scheme.

import { el, money, initials, dayLabel, clockOf, elapsed, haptic, validPhone, normalisePhone, plural } from "../util.js";
import { icon } from "../icons.js";
import { BUSINESS } from "../config.js";
import { mark, sheet, toast, switchToggle, sectionHead, mapsUrl, hoursTable } from "../ui.js";
import { get, setProfile, resetAll, subscribe } from "../store.js";
import { go } from "../router.js";
import { canInstall, promptInstall, isStandalone } from "../install.js";

const MILKS = ["Whole", "Oat", "Almond", "Lactose-free"];

function editProfile(after) {
  const p = get().profile;
  const name = el("input.input", { type: "text", value: p.name, placeholder: "Your name", autocomplete: "given-name" });
  const phone = el("input.input", { type: "tel", value: p.phone, placeholder: "09xx xxx xxxx", inputmode: "numeric", autocomplete: "tel" });
  const err = el("p.field__err");

  const save = el("button.btn.btn--primary.btn--full", {
    type: "button",
    onclick: () => {
      if (phone.value && !validPhone(phone.value)) {
        phone.setAttribute("aria-invalid", "true");
        err.textContent = "An 11-digit mobile number, starting 09.";
        haptic([14, 40, 14]);
        return;
      }
      setProfile({ name: name.value.trim(), phone: normalisePhone(phone.value) });
      toast("Saved", "check");
      handle.close();
      after?.();
    },
  }, "Save");

  const handle = sheet({
    title: "Your details",
    footer: save,
    build: () => el("div", { style: { padding: "6px 22px 22px" } },
      el("h2.display", "Your details"),
      el("p.body", { style: { marginTop: "8px" } },
        "Used to fill in your orders. It stays on this phone."),
      el("label.field", { style: { marginTop: "24px" } }, el("span.field__label", "Name"), name),
      el("label.field", { style: { marginTop: "16px" } }, el("span.field__label", "Phone"), phone, err),
    ),
  });
}

/** Destructive and irreversible, so it gets a real confirmation — the one place
 *  in the app that earns one. */
function confirmReset() {
  const handle = sheet({
    title: "Clear this device",
    footer: el("div", { style: { display: "flex", gap: "10px" } },
      el("button.btn.btn--ghost", {
        type: "button", style: { flex: "1" },
        onclick: () => handle.close(),
      }, "Keep it"),
      el("button.btn.btn--primary", {
        type: "button", style: { flex: "1" },
        onclick: () => {
          resetAll();
          handle.close();
          toast("Cleared", "check");
          go("/");
        },
      }, "Clear everything")),
    build: () => el("div", { style: { padding: "6px 22px 22px" } },
      el("h2.display", "Clear this device"),
      el("p.body", { style: { marginTop: "10px" } },
        "Removes your details, your bag, your order history and your visits from this "
        + "phone. It cannot be undone."),
      el("p.note", { style: { marginTop: "18px" } },
        "Orders you have already sent to the bar are not affected.")),
  });
}

export function accountView() {
  const root = el("div");

  const head = el("div.pad", { style: { paddingTop: "6px", paddingBottom: "8px" } });
  const paintHead = () => {
    const p = get().profile;
    head.replaceChildren(
      el("h1.display", "Account"),
      el("div.row", { style: { marginTop: "22px", gap: "14px" } },
        el("div.avatar", { style: { width: "56px", height: "56px", fontSize: "17px" } },
          p.name ? initials(p.name) : icon("account")),
        el("div.grow",
          el("div.title", p.name || "Add your name"),
          el("div.caption.num", { style: { marginTop: "2px" } },
            p.phone || "So the bar knows who to call")),
        el("button.gbtn", { type: "button", "aria-label": "Edit your details",
          onclick: () => { haptic(6); editProfile(paintHead); } }, icon("edit"))),
    );
  };
  paintHead();
  root.append(head);

  /* ------------------------------------------------------------- install */
  if (!isStandalone()) {
    const installBox = el("div.pad", { style: { marginTop: "22px" } });
    const paintInstall = () => {
      installBox.replaceChildren(el("div.card.card--pad",
        el("div.row", { style: { gap: "14px" } },
          el("span.lrow__icon", icon("download")),
          el("div.grow",
            el("div.headline", "Add Balance to your home screen"),
            el("div.caption", { style: { marginTop: "3px" } },
              canInstall()
                ? "Opens full screen, works without a signal."
                : "In Safari: Share → Add to Home Screen.")),
        ),
        canInstall()
          ? el("button.btn.btn--primary.btn--full", {
              type: "button", style: { marginTop: "16px" },
              onclick: async () => {
                const outcome = await promptInstall();
                if (outcome === "accepted") toast("Installing…", "check");
                paintInstall();
              },
            }, "Install")
          : null,
      ));
    };
    paintInstall();
    window.addEventListener("bal:installable", paintInstall);
    root.addEventListener("view:teardown",
      () => window.removeEventListener("bal:installable", paintInstall));
    root.append(installBox);
  }

  /* -------------------------------------------------------------- orders */
  const orders = get().orders;
  root.append(el("section.section.pad",
    sectionHead("Your orders", orders.length ? el("span.caption.num", String(orders.length)) : null),
    orders.length
      ? el("div.card.card--pad", orders.slice(0, 8).map((o) =>
          el("button.lrow.press", {
            type: "button", style: { width: "100%" },
            onclick: () => go(`/order/${o.code}`),
          },
            el("span.lrow__icon", icon("receipt")),
            el("span.grow",
              el("span.headline", { style: { display: "block" } },
                `${o.code} · ${plural(o.lines.reduce((n, l) => n + l.qty, 0), "item", "items")}`),
              el("span.caption", { style: { display: "block", marginTop: "2px" } },
                `${dayLabel(o.ts)} at ${clockOf(new Date(o.ts))} · ${money(o.total)} ${BUSINESS.currency}`)),
            el("span.lrow__chev", icon("chev")))))
      : el("div.card.card--pad",
          el("p.body", { style: { textAlign: "center" } }, "No orders yet.")),
  ));

  /* -------------------------------------------------------------- visits */
  const visits = get().visits;
  if (visits.length) {
    root.append(el("section.section.pad",
      sectionHead("Your visits", el("span.caption.num", String(visits.length))),
      el("div.card.card--pad", visits.slice(0, 6).map((v) =>
        el("div.person",
          el("div.avatar", { "aria-hidden": "true" }, icon("clock")),
          el("div.grow",
            el("div.person__name", dayLabel(v.in)),
            el("div.person__meta.num",
              `${clockOf(new Date(v.in))} – ${clockOf(new Date(v.out))} · ${elapsed(v.out - v.in)}`)))))));
  }

  /* --------------------------------------------------------- preferences */
  const prefBox = el("div.card.card--pad");
  const paintPrefs = () => {
    const p = get().profile;
    prefBox.replaceChildren(
      el("div", { style: { paddingBottom: "14px" } },
        el("span.field__label", "Your usual milk"),
        el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          MILKS.map((m) => el("button.opt", {
            type: "button", "aria-pressed": String(p.defaultMilk === m),
            onclick: () => { setProfile({ defaultMilk: m }); haptic(6); paintPrefs(); },
          }, m))),
        el("p.caption", { style: { marginTop: "10px" } },
          "Pre-selected whenever you order something with milk.")),
      el("div.row.row--between", { style: { borderTop: "1px solid var(--line-2)", paddingTop: "16px" } },
        el("div.grow",
          el("div.headline", "Check in anonymously"),
          el("div.caption", { style: { marginTop: "2px" } }, "Show as “Someone” in the room")),
        switchToggle(p.anonymous, (v) => setProfile({ anonymous: v }), "Check in anonymously")),
    );
  };
  paintPrefs();
  root.append(el("section.section.pad", sectionHead("Preferences"), prefBox));

  /* -------------------------------------------------------------- balance */
  const rows = hoursTable();
  root.append(el("section.section.pad",
    sectionHead("Balance"),
    el("div.card.card--pad",
      el("a.lrow", { href: mapsUrl(), target: "_blank", rel: "noopener" },
        el("span.lrow__icon", icon("pin")),
        el("span.grow", el("span.headline", { style: { display: "block" } }, "Directions"),
          el("span.caption", { style: { display: "block", marginTop: "2px" } },
            `${BUSINESS.district}, ${BUSINESS.city}`)),
        el("span.lrow__chev", icon("chev"))),
      el("a.lrow", { href: BUSINESS.instagramUrl, target: "_blank", rel: "noopener" },
        el("span.lrow__icon", icon("instagram")),
        el("span.grow", el("span.headline", { style: { display: "block" } }, "Instagram"),
          el("span.caption", { style: { display: "block", marginTop: "2px" } }, `@${BUSINESS.instagram}`)),
        el("span.lrow__chev", icon("chev"))),
      el("div.lrow", { style: { alignItems: "flex-start" } },
        el("span.lrow__icon", icon("clock")),
        el("div.grow",
          el("div.headline", { style: { marginBottom: "8px" } }, "Hours"),
          rows.map((r) => el("div.dl", el("dt", r.label), el("dd.num", r.text))))),
    ),
  ));

  /* ---------------------------------------------------------------- data */
  root.append(el("section.section.pad",
    el("p.note",
      "Everything in this app — your name, your orders, your check-ins — is stored on this "
      + "phone and nowhere else. There are no points, no tiers, and no profile the café keeps."),
    el("button.btn.btn--sm", {
      type: "button", style: { marginTop: "14px", width: "100%", color: "var(--grey-2)" },
      onclick: confirmReset,
    }, "Clear this device"),
  ));

  root.append(el("footer.pad", { style: { paddingBlock: "40px", textAlign: "center" } },
    mark("empty__mark"),
    el("p.label", { style: { marginTop: "4px" } }, BUSINESS.name),
    el("p.caption", { style: { marginTop: "8px" } }, `${BUSINESS.district}, ${BUSINESS.city}`)));

  const unsub = subscribe((what) => { if (what === "profile") paintHead(); });
  root.addEventListener("view:teardown", unsub);
  return root;
}
