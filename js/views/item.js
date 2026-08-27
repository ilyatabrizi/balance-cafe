// The order sheet for one menu item: options, quantity, a note for the bar.

import { el, money, haptic, photo } from "../util.js";
import { sheet, toast, stepper } from "../ui.js";
import { priceWith, defaultOpts, TAG_LABEL } from "../data.js";
import { addToBag, get } from "../store.js";
import { BUSINESS } from "../config.js";

export function openItem(item) {
  const opts = defaultOpts(item, get().profile);
  let qty = 1;
  let note = "";

  const priceLabel = el("span.num");
  const addBtn = el("button.btn.btn--primary.btn--full", {
    onclick: () => {
      addToBag({ item, opts, qty, note: note.trim(), unitPrice: priceWith(item, opts) });
      haptic([9, 24, 9]);
      toast(`${qty} × ${item.name} added`, "bag");
      handle.close();
    },
  }, el("span", "Add to bag"), el("span", { style: { opacity: ".55" } }, "·"), priceLabel);

  const refresh = () => {
    priceLabel.textContent = `${money(priceWith(item, opts) * qty)} ${BUSINESS.currency}`;
  };
  refresh();

  const handle = sheet({
    title: item.name,
    footer: addBtn,
    build: () => {
      const wrap = el("div", { style: { padding: "4px 22px 22px" } });

      if (item.photo) {
        wrap.append(el("div.tile", {
          style: { aspectRatio: "4 / 3", marginBottom: "20px" },
        }, photo(`assets/photos/${item.photo}.jpg`, item.name)));
      }

      wrap.append(
        el("h2.display", { style: { marginBottom: "8px" } }, item.name),
        el("p.body", item.desc || ""),
      );

      if (item.tags?.length) {
        wrap.append(el("div.row", { style: { marginTop: "14px", gap: "8px", flexWrap: "wrap" } },
          item.tags.map((t) =>
            el("span.person__tag", TAG_LABEL[t] || t))));
      }

      /* -------- option groups -------- */
      for (const group of item.options || []) {
        const chosen = () => opts[group.id];
        const buttons = group.choices.map((c) => {
          const b = el("button.opt", {
            type: "button",
            "aria-pressed": String(chosen() === c.id),
            onclick: () => {
              opts[group.id] = c.id;
              haptic(6);
              for (const other of buttons) {
                other.setAttribute("aria-pressed", String(other.dataset.value === chosen()));
              }
              refresh();
            },
          }, el("span", c.id),
             c.add ? el("span.opt__plus", `${c.add > 0 ? "+" : "−"}${money(Math.abs(c.add))}`) : null);
          b.dataset.value = c.id;
          return b;
        });

        wrap.append(
          el("div", { style: { marginTop: "26px" } },
            el("span.field__label", group.label),
            el("div.opts", buttons)),
        );
      }

      /* -------- note -------- */
      const noteInput = el("textarea.input", {
        rows: 2, maxlength: 140,
        placeholder: "Less ice, no sugar, to the table…",
        oninput: (e) => { note = e.target.value; },
      });
      wrap.append(el("div", { style: { marginTop: "26px" } },
        el("span.field__label", "Note for the bar"), noteInput));

      /* -------- quantity -------- */
      wrap.append(el("div.row.row--between", { style: { marginTop: "26px" } },
        el("span.field__label", { style: { marginBottom: 0 } }, "Quantity"),
        stepper(qty, (n) => { qty = n; refresh(); }, { min: 1, max: 10 }),
      ));

      return wrap;
    },
  });

  return handle;
}
