// The bag, and the whole checkout in one screen. An order here is a request to
// the bar, not a payment: you pay at the cashier with the code the app gives you.

import { el, money, photo, haptic, orderCode, validPhone, normalisePhone } from "../util.js";
import { BUSINESS, ORDER } from "../config.js";
import { byId, describeOpts } from "../data.js";
import { emptyState, toast, stepper, sectionHead, timeSlots, openingStatus } from "../ui.js";
import { get, setLineQty, removeLine, clearBag, bagTotal, bagCount, placeOrder, setProfile } from "../store.js";
import { go } from "../router.js";

export function bagView() {
  const root = el("div");
  const state = get();

  root.append(el("header.pad", { style: { paddingTop: "6px", paddingBottom: "18px" } },
    el("h1.display", "Your order")));

  if (!state.bag.length) {
    root.append(emptyState(
      "Nothing in the bag yet.",
      el("button.btn.btn--primary", { type: "button", onclick: () => go("/menu") }, "Open the menu"),
    ));
    return root;
  }

  /* -------------------------------------------------------------- lines */
  const linesBox = el("div.card.card--pad");
  const totalsBox = el("div", { style: { marginTop: "22px" } });

  function paintLines() {
    const bag = get().bag;
    if (!bag.length) { go("/bag", { replace: true }); return; }

    linesBox.replaceChildren(...bag.map((line) => {
      const item = byId(line.itemId);
      const detail = describeOpts(item || { options: [] }, line.opts);
      return el("div.mrow", { style: { alignItems: "center" } },
        line.photo
          ? el("div.mrow__thumb", { style: { width: "54px", height: "54px" } },
              photo(`assets/photos/${line.photo}.jpg`, line.name))
          : null,
        el("div.grow",
          el("div.mrow__name", { style: { fontSize: "15.5px" } }, line.name),
          detail ? el("div.mrow__desc", detail) : null,
          line.note ? el("div.mrow__desc", { style: { fontStyle: "italic" } }, `“${line.note}”`) : null,
          el("div.mrow__price.num", { style: { marginTop: "8px" } },
            `${money(line.unitPrice * line.qty)} ${BUSINESS.currency}`)),
        el("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" } },
          stepper(line.qty, (n) => { setLineQty(line.id, n); paintLines(); paintTotals(); },
            { min: 0, max: ORDER.maxPerLine }),
          el("button.caption", {
            type: "button", style: { color: "var(--grey-2)" },
            onclick: () => { removeLine(line.id); haptic(8); paintLines(); paintTotals(); },
          }, "Remove")),
      );
    }));
  }

  function paintTotals() {
    const total = bagTotal();
    totalsBox.replaceChildren(
      el("dl",
        el("div.dl", el("dt", `Items (${bagCount()})`), el("dd.num", `${money(total)} ${BUSINESS.currency}`)),
        el("div.dl", el("dt", "Service"), el("dd", "Included")),
        el("div.dl.dl--total", el("dt", "Total"), el("dd.num", `${money(total)} ${BUSINESS.currency}`))),
    );
    if (placeBtn) placeBtn.querySelector(".js-total").textContent =
      `${money(total)} ${BUSINESS.currency}`;
  }

  root.append(el("div.pad", linesBox, totalsBox));

  /* --------------------------------------------------------- how & when */
  let type = "dine-in";
  let table = "";
  let slot = "asap";

  const whenBox = el("div", { style: { marginTop: "20px" } });
  const tableBox = el("div", { style: { marginTop: "20px" } });

  const typeBar = el("div.pillbar", { role: "group", "aria-label": "Order type" },
    ["dine-in", "pickup"].map((t) => el("button", {
      type: "button", "aria-pressed": String(t === type),
      onclick: (e) => {
        type = t;
        haptic(6);
        for (const b of typeBar.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
        paintWhen(); paintTable(); validate();
      },
    }, t === "dine-in" ? "At a table" : "Pick up"),
    ));

  function paintTable() {
    tableBox.replaceChildren();
    if (type !== "dine-in") return;
    tableBox.append(
      el("span.field__label", "Table"),
      el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        ORDER.tables.map((t) => el("button.opt", {
          type: "button", "aria-pressed": String(table === t),
          onclick: () => {
            table = table === t ? "" : t;
            haptic(6);
            paintTable(); validate();
          },
        }, t))),
      el("p.caption", { style: { marginTop: "10px" } },
        "Pick the table you are sitting at, or leave it blank and tell the bar."),
    );
  }

  function paintWhen() {
    whenBox.replaceChildren();
    if (type !== "pickup") return;
    const slots = timeSlots(ORDER.slotCount, ORDER.slotStepMinutes, ORDER.leadMinutes);
    whenBox.append(
      el("span.field__label", "Ready for"),
      el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        [["asap", `As soon as possible`], ...slots.map((s) => [s, s])].map(([v, label]) =>
          el("button.opt", {
            type: "button", "aria-pressed": String(slot === v),
            onclick: () => { slot = v; haptic(6); paintWhen(); },
          }, label))),
      el("p.caption", { style: { marginTop: "10px" } },
        `The bar needs about ${ORDER.leadMinutes} minutes from the moment you send it.`),
    );
  }

  /* ------------------------------------------------------------ details */
  const nameInput = el("input.input", {
    type: "text", value: state.profile.name || "", autocomplete: "given-name",
    placeholder: "The name the bar will call",
    oninput: () => { nameInput.removeAttribute("aria-invalid"); nameErr.textContent = ""; validate(); },
  });
  const nameErr = el("p.field__err");

  const phoneInput = el("input.input", {
    type: "tel", value: state.profile.phone || "", autocomplete: "tel",
    inputmode: "numeric", placeholder: "09xx xxx xxxx",
    oninput: () => { phoneInput.removeAttribute("aria-invalid"); phoneErr.textContent = ""; validate(); },
  });
  const phoneErr = el("p.field__err");

  const detailsBox = el("div", { style: { marginTop: "20px" } },
    el("label.field", el("span.field__label", "Name"), nameInput, nameErr),
    el("label.field", { style: { marginTop: "16px" } },
      el("span.field__label", "Phone"), phoneInput, phoneErr),
  );

  root.append(el("section.section.pad",
    sectionHead("How and when"),
    typeBar, whenBox, tableBox, detailsBox));

  /* -------------------------------------------------------------- send */
  const placeBtn = el("button.btn.btn--primary.btn--full", {
    type: "button",
    onclick: send,
  }, el("span", "Send to the bar"), el("span", { style: { opacity: ".55" } }, "·"),
     el("span.js-total.num"));

  function validate() {
    const ok = nameInput.value.trim().length >= 2 && validPhone(phoneInput.value);
    placeBtn.disabled = !ok;
    return ok;
  }

  function send() {
    let ok = true;
    if (nameInput.value.trim().length < 2) {
      nameInput.setAttribute("aria-invalid", "true");
      nameErr.textContent = "Please add a name so the bar can call your order.";
      ok = false;
    }
    if (!validPhone(phoneInput.value)) {
      phoneInput.setAttribute("aria-invalid", "true");
      phoneErr.textContent = "An 11-digit mobile number, starting 09.";
      ok = false;
    }
    if (!ok) { haptic([14, 40, 14]); return; }

    const status = openingStatus();
    const bag = get().bag;
    const order = {
      code: orderCode(Date.now() + bag.length),
      ts: Date.now(),
      type, table: type === "dine-in" ? table : "",
      slot: type === "pickup" ? slot : "",
      name: nameInput.value.trim(),
      phone: normalisePhone(phoneInput.value),
      lines: bag.map((l) => ({ ...l })),
      total: bagTotal(),
      status: status.open ? "sent" : "queued",
    };
    setProfile({ name: order.name, phone: order.phone });
    placeOrder(order);
    haptic([12, 30, 12, 30, 18]);
    go(`/order/${order.code}`);
  }

  root.append(el("div.pad", { style: { marginTop: "26px" } },
    placeBtn,
    el("p.note", { style: { marginTop: "14px" } },
      "This sends your order to the bar. You pay at the cashier with the code on the next screen — "
      + "no card details, nothing stored."),
    el("button.btn.btn--sm", {
      type: "button",
      style: { marginTop: "16px", color: "var(--grey-2)", width: "100%" },
      onclick: () => {
        clearBag();
        toast("Bag cleared", "trash");
        go("/menu");
      },
    }, "Empty the bag"),
  ));

  paintLines(); paintTotals(); paintWhen(); paintTable(); validate();
  return root;
}
