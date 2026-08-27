// One order, after it has been sent. The code is the whole point of the screen:
// it is what you say at the cashier, so it gets the largest type in the app.

import { el, money, dayLabel, clockOf, haptic, plural } from "../util.js";
import { BUSINESS } from "../config.js";
import { byId, describeOpts } from "../data.js";
import { mark, emptyState, toast, sheet, sectionHead } from "../ui.js";
import { findOrder, addToBag } from "../store.js";
import { go } from "../router.js";

function whenLine(order) {
  if (order.type === "pickup") {
    return order.slot === "asap" ? "Pick up as soon as possible" : `Pick up at ${order.slot}`;
  }
  return order.table ? `At table ${order.table}` : "At a table — tell the bar which";
}

/** Full-screen code, for holding up at the cashier. */
function showCode(order) {
  sheet({
    title: `Order ${order.code}`,
    build: () => el("div", { style: { padding: "10px 22px 40px", textAlign: "center" } },
      el("p.label", "Show this at the cashier"),
      el("p", {
        style: {
          fontFamily: "var(--serif)", fontSize: "clamp(56px,19vw,84px)", lineHeight: "1",
          fontWeight: "300", letterSpacing: ".02em", color: "var(--ink)",
          margin: "26px 0 18px", fontVariantNumeric: "tabular-nums",
        },
      }, order.code),
      el("p.body", `${order.name} · ${plural(order.lines.reduce((n, l) => n + l.qty, 0), "item", "items")}`),
      el("p.headline.num", { style: { marginTop: "6px" } },
        `${money(order.total)} ${BUSINESS.currency}`),
    ),
  });
}

export function orderView({ code }) {
  const order = findOrder(code);
  const root = el("div");

  root.append(el("header.pad", { style: { paddingTop: "6px", paddingBottom: "18px" } },
    el("h1.display", "Order sent")));

  if (!order) {
    root.append(emptyState("That order is not on this device.",
      el("button.btn.btn--primary", { type: "button", onclick: () => go("/menu") }, "Open the menu")));
    return root;
  }

  /* ------------------------------------------------------------ receipt */
  root.append(el("div.pad",
    el("div.receipt",
      mark("receipt__mark"),
      el("p.label", { style: { color: "rgba(255,255,255,.55)" } }, "Your code"),
      el("p.receipt__code", { style: { marginTop: "12px" } }, order.code),
      el("p.body", {
        style: { color: "rgba(255,255,255,.7)", marginTop: "14px" },
      }, `Sent ${dayLabel(order.ts)} at ${clockOf(new Date(order.ts))} · ${whenLine(order)}`),
      el("button.btn.btn--full", {
        type: "button",
        style: { marginTop: "20px", background: "#fff", color: "var(--ink)" },
        onclick: () => { haptic(8); showCode(order); },
      }, "Show at the cashier"),
    ),
  ));

  root.append(el("div.pad", { style: { marginTop: "16px" } },
    el("p.note", order.status === "queued"
      ? "Balance was closed when you sent this, so the bar will see it when they open."
      : "The bar has it. Pay at the cashier with the code above — nothing is charged in the app.")));

  /* -------------------------------------------------------------- lines */
  root.append(el("section.section.pad",
    sectionHead("What you ordered"),
    el("div.card.card--pad",
      order.lines.map((line) => {
        const item = byId(line.itemId);
        const detail = describeOpts(item || { options: [] }, line.opts);
        return el("div.mrow", { style: { alignItems: "flex-start" } },
          el("div.grow",
            el("div.mrow__name", { style: { fontSize: "15.5px" } }, `${line.qty} × ${line.name}`),
            detail ? el("div.mrow__desc", detail) : null,
            line.note ? el("div.mrow__desc", { style: { fontStyle: "italic" } }, `“${line.note}”`) : null),
          el("div.mrow__price.num", `${money(line.unitPrice * line.qty)} ${BUSINESS.currency}`),
        );
      }),
      el("div.dl.dl--total", { style: { marginTop: "10px" } },
        el("dt", "Total"), el("dd.num", `${money(order.total)} ${BUSINESS.currency}`)),
    ),
  ));

  /* ------------------------------------------------------------ actions */
  root.append(el("div.pad", { style: { marginTop: "8px" } },
    el("button.btn.btn--ghost.btn--full", {
      type: "button",
      onclick: () => {
        for (const line of order.lines) {
          const item = byId(line.itemId);
          if (!item) continue;
          addToBag({ item, opts: line.opts, qty: line.qty, note: line.note, unitPrice: line.unitPrice });
        }
        haptic(10);
        toast("Added to your bag again", "bag");
        go("/bag");
      },
    }, "Order this again"),
    el("button.btn.btn--sm", {
      type: "button", style: { marginTop: "14px", width: "100%", color: "var(--grey-2)" },
      onclick: () => go("/menu"),
    }, "Back to the menu"),
  ));

  return root;
}
