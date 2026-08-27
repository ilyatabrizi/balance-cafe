// The menu. A typographic list first — photography only where the client has
// actually shot the dish, because a stock-filled grid would say less than a
// well-set list.

import { el, money, photo, haptic, debounce } from "../util.js";
import { icon } from "../icons.js";
import { CATEGORIES, inCategory, TAG_LABEL } from "../data.js";
import { BUSINESS } from "../config.js";
import { openItem } from "./item.js";

export function menuRow(item) {
  const row = el("button.mrow.press", {
    type: "button",
    "aria-label": `${item.name}, ${money(item.price)} ${BUSINESS.currency}`,
    onclick: () => { haptic(6); openItem(item); },
  });

  if (item.photo) {
    row.append(el("div.mrow__thumb", photo(`assets/photos/${item.photo}.jpg`, item.name)));
  }

  row.append(
    el("div.grow",
      el("div.mrow__name", item.name),
      item.desc ? el("div.mrow__desc", item.desc) : null,
      item.tags?.length
        ? el("div.tagline", { style: { marginTop: "6px" } },
            item.tags.map((t) => TAG_LABEL[t] || t).join(" · "))
        : null),
    el("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" } },
      el("div.mrow__price.num", `${money(item.price)} ${BUSINESS.currency}`),
      el("span.mrow__add", { "aria-hidden": "true" }, icon("plus"))),
  );
  return row;
}

/** App bar plus the sticky category rail — what a section has to clear. */
const RAIL_OFFSET = () => {
  const bar = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--bar-h")) || 62;
  return bar + 56;
};

export function menuView(params = {}) {
  const root = el("div");
  const active = CATEGORIES.some((c) => c.id === params.cat) ? params.cat : CATEGORIES[0].id;

  root.append(
    el("header.pad", { style: { paddingTop: "6px", paddingBottom: "18px" } },
      el("h1.display", "Menu"),
      el("p.body", { style: { marginTop: "8px" } },
        `Everything is made to order. Kitchen closes at ${BUSINESS.kitchenLastOrder}.`)),
  );

  /* --------- sticky category rail --------- */
  const chipRow = el("div.chips", { role: "tablist", "aria-label": "Menu sections" });
  const sections = new Map();

  const chips = CATEGORIES.map((c) => {
    const b = el("button.chip", {
      type: "button", role: "tab", "aria-pressed": String(c.id === active),
      onclick: () => {
        haptic(6);
        const target = sections.get(c.id);
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.scrollY - RAIL_OFFSET();
        window.scrollTo({ top, behavior: "smooth" });
      },
    }, c.name);
    b.dataset.cat = c.id;
    return b;
  });
  chipRow.append(...chips);

  const rail = el("div.menurail", chipRow);
  root.append(rail);

  /* --------- sections --------- */
  const body = el("div.pad", { style: { paddingTop: "8px" } });
  for (const cat of CATEGORIES) {
    const items = inCategory(cat.id);
    if (!items.length) continue;
    const sec = el("section", { style: { paddingTop: "30px" } },
      el("div", { style: { marginBottom: "6px" } },
        el("h2.label.label--ink", cat.name),
        cat.note ? el("p.caption", { style: { marginTop: "8px" } }, cat.note) : null),
      el("div", items.map(menuRow)),
    );
    sections.set(cat.id, sec);
    body.append(sec);
  }
  root.append(body);

  root.append(el("div.pad", { style: { paddingTop: "34px" } },
    el("p.note",
      "Prices are in Toman and include service. Ask the bar about today's single origin, "
      + "allergens, or anything you would like changed.")));

  /* --------- keep the rail in step with the scroll --------- */
  const sync = debounce(() => {
    let id = CATEGORIES[0].id;
    for (const [cat, node] of sections) {
      if (node.getBoundingClientRect().top - (RAIL_OFFSET() + 24) <= 0) id = cat;
    }
    for (const chip of chips) {
      const on = chip.dataset.cat === id;
      if ((chip.getAttribute("aria-pressed") === "true") !== on) {
        chip.setAttribute("aria-pressed", String(on));
        if (on) chip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }
    }
  }, 60);

  window.addEventListener("scroll", sync, { passive: true });
  root.addEventListener("view:teardown", () => window.removeEventListener("scroll", sync));

  // Land on the requested section when arriving from a link.
  if (params.cat && sections.has(params.cat)) {
    requestAnimationFrame(() => {
      const top = sections.get(params.cat).getBoundingClientRect().top + window.scrollY - RAIL_OFFSET();
      window.scrollTo({ top, behavior: "auto" });
    });
  }

  return root;
}
