// Boot, chrome, and wiring. The shell owns three fixed pieces: the translucent
// app bar, the floating glass tab bar, and the order dock that rises above it.

import { el, clear, haptic, money, plural, debounce } from "./util.js";
import { icon } from "./icons.js";
import { BUSINESS } from "./config.js";
import { loadMarks } from "./ui.js";
import { spring } from "./motion.js";
import * as store from "./store.js";
import * as router from "./router.js";
import { homeView } from "./views/home.js";
import { menuView } from "./views/menu.js";
import { checkinView } from "./views/checkin.js";
import { accountView } from "./views/account.js";
import { bagView } from "./views/bag.js";
import { orderView } from "./views/order.js";
import * as presence from "./presence.js";

const TABS = [
  { path: "/",        icon: "home",    label: "Home",     title: BUSINESS.name },
  { path: "/menu",    icon: "menu",    label: "Menu",     title: "Menu" },
  { path: "/checkin", icon: "checkin", label: "Check-in", title: "Check in" },
  { path: "/account", icon: "account", label: "Account",  title: "Account" },
];

// Routes that are pushed on top of a tab rather than being one.
const STACK_TITLES = { "/bag": "Your order", "/order": "Order" };

const shell = document.getElementById("shell");
const view = document.getElementById("view");

/* --------------------------------------------------------------- app bar */

const barTitle = el("h1.appbar__title");
const barLeft = el("div", { style: { width: "40px", flex: "none" } });

const bagBtn = el("button.gbtn", {
  type: "button", "aria-label": "Your order",
  onclick: () => { haptic(6); router.go("/bag"); },
}, icon("bag"));

const appbar = el("header.appbar", barLeft, barTitle, bagBtn);

function paintBagBadge() {
  const n = store.bagCount();
  const existing = bagBtn.querySelector(".gbtn__badge");
  if (!n) { existing?.remove(); bagBtn.setAttribute("aria-label", "Your order, empty"); return; }
  bagBtn.setAttribute("aria-label", `Your order, ${plural(n, "item", "items")}`);
  if (existing) { existing.textContent = String(n); return; }
  bagBtn.append(el("span.gbtn__badge", String(n)));
}

/* -------------------------------------------------------------- tab bar */

const pill = el("div.tabbar__pill", { "aria-hidden": "true" });
const tabNodes = TABS.map((t) =>
  el("button.tab", {
    type: "button", role: "tab", "aria-selected": "false",
    "aria-label": t.label,
    onclick: () => {
      haptic(7);
      // Tapping the tab you are already on returns you to the top of it.
      if (router.currentPath() === t.path) window.scrollTo({ top: 0, behavior: "smooth" });
      else router.go(t.path);
    },
  },
    icon(t.icon, "tab__icon"),
    el("span.tab__label", t.label),
  ));

const tabbar = el("nav.tabbar", { role: "tablist", "aria-label": "Sections" },
  pill, ...tabNodes);

let pillAnim = null;
let pillReady = false;

function movePill(index, { animate = true } = {}) {
  const node = tabNodes[index];
  if (!node || !node.offsetWidth) return;
  const left = node.offsetLeft;
  const width = node.offsetWidth;
  pill.style.width = `${width}px`;

  if (!animate || !pillReady) {
    pillAnim?.stop();
    pill.style.transform = `translateX(${left}px)`;
    pillReady = true;
    return;
  }
  const currentX = pillAnim ? pillAnim.value()
    : (parseFloat(pill.style.transform.replace(/[^\d.-]/g, "")) || 0);
  pillAnim?.stop();
  // A tab change carries no gesture momentum, so it settles without overshoot.
  pillAnim = spring({
    from: currentX, to: left, damping: 1, response: 0.34,
    onFrame: (x) => { pill.style.transform = `translateX(${x}px)`; },
  });
}

/** The check-in tab wears a dot when there are people in the room. */
function paintRoomDot() {
  const tab = tabNodes[2];
  const has = tab.querySelector(".tab__dot");
  const busy = presence.countSync() > 0;
  if (busy && !has) tab.append(el("i.tab__dot", { "aria-hidden": "true" }));
  if (!busy && has) has.remove();
}

/* ----------------------------------------------------------- order dock */

const dockCount = el("span.dock__count.num");
const dockText = el("span.grow");
const dock = el("button.dock", {
  type: "button",
  onclick: () => { haptic(8); router.go("/bag"); },
}, dockCount, dockText, el("span.dock__go", "View", icon("chev")));

function paintDock() {
  const n = store.bagCount();
  const onBag = router.currentPath() === "/bag";
  const show = n > 0 && !onBag;
  dock.dataset.open = show ? "1" : "0";
  shell.dataset.dock = show ? "1" : "0";
  dock.setAttribute("aria-hidden", show ? "false" : "true");
  dock.tabIndex = show ? 0 : -1;
  if (!n) return;
  dockCount.textContent = String(n);
  dockText.replaceChildren(
    el("span", { style: { display: "block", fontSize: "14px", fontWeight: "500" } },
      plural(n, "item", "items")),
    el("span.num", { style: { display: "block", fontSize: "12px", opacity: ".62", marginTop: "1px" } },
      `${money(store.bagTotal())} ${BUSINESS.currency}`),
  );
}

/* ------------------------------------------------------------- chrome sync */

function syncChrome(loc) {
  const path = loc.path;
  const index = TABS.findIndex((t) => t.path === path);

  tabNodes.forEach((n, i) => n.setAttribute("aria-selected", String(i === index)));
  if (index >= 0) movePill(index);

  const stackKey = Object.keys(STACK_TITLES).find((k) => path.startsWith(k));
  const title = index >= 0 ? TABS[index].title : (stackKey ? STACK_TITLES[stackKey] : BUSINESS.name);
  barTitle.textContent = title;
  document.title = index === 0 ? `${BUSINESS.name} — ${BUSINESS.district}, ${BUSINESS.city}`
    : `${title} · ${BUSINESS.name}`;

  // A pushed screen gets a back button where the tabs get nothing.
  clear(barLeft);
  if (index < 0) {
    barLeft.append(el("button.gbtn", {
      type: "button", "aria-label": "Back",
      onclick: () => { haptic(6); router.back("/"); },
    }, icon("back")));
  }

  // Home leads with its own hero, so the bar stays out of the way until scroll.
  const hero = index === 0 ? "1" : "0";
  appbar.dataset.hero = hero;
  shell.dataset.hero = hero;
  paintDock();
  paintRoomDot();
}

const onScroll = () => {
  appbar.dataset.scrolled = window.scrollY > 12 ? "1" : "0";
};

/* ------------------------------------------------------------------- boot */

async function boot() {
  await loadMarks();

  shell.prepend(appbar);
  shell.append(tabbar, dock);

  router.mount(view);
  router.route("/", homeView);
  router.route("/menu", menuView);
  router.route("/checkin", checkinView);
  router.route("/account", accountView);
  router.route("/bag", bagView);
  router.route("/order/:code", orderView);
  router.onNavigate(syncChrome);

  store.subscribe((what) => {
    if (what === "bag" || what === "orders" || what === "external" || what === "reset") {
      paintBagBadge();
      paintDock();
    }
    if (what === "checkin" || what === "external") paintRoomDot();
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", debounce(() => {
    const i = TABS.findIndex((t) => t.path === router.currentPath());
    if (i >= 0) movePill(i, { animate: false });
  }, 120));

  // A check-in left running overnight retires itself rather than lying.
  store.expireStaleCheckin();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    store.expireStaleCheckin();
    presence.list({ force: true }).then(paintRoomDot);
    // requestAnimationFrame is frozen while hidden, so a tab change made just
    // before backgrounding can leave the pill stranded between two tabs.
    const i = TABS.findIndex((t) => t.path === router.currentPath());
    if (i >= 0) movePill(i, { animate: false });
  });

  paintBagBadge();
  onScroll();
  router.start();

  // Fonts settle after first paint; re-measure so the pill is never half a
  // pixel off the tab it is meant to be under.
  const settle = () => {
    const i = TABS.findIndex((t) => t.path === router.currentPath());
    if (i >= 0) movePill(i, { animate: false });
  };
  requestAnimationFrame(settle);
  document.fonts?.ready.then(settle);

  presence.list().then(paintRoomDot);
  document.documentElement.classList.add("booted");
}

/* ------------------------------------------------------- service worker */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline is a bonus, not a requirement */ });
  });
}

boot().catch((e) => {
  console.error(e);
  document.documentElement.classList.add("booted");
  view.append(el("div.empty",
    el("p.body", "Something went wrong loading the app. Please reload.")));
});
