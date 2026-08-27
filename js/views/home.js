// Home. The first screen answers three questions in order: what is this, is it
// open, and is anyone there.

import { el, money, photo, plural, haptic, ago } from "../util.js";
import { icon } from "../icons.js";
import { BUSINESS } from "../config.js";
import { featured, byId } from "../data.js";
import { logo, mark, statusPill, hoursTable, mapsUrl, sectionHead } from "../ui.js";
import { go } from "../router.js";
import { openItem } from "./item.js";
import * as presence from "../presence.js";
import { get } from "../store.js";

function featureCard(item) {
  return el("button.fcard.press", {
    type: "button", onclick: () => { haptic(6); openItem(item); },
  },
    el("div.fcard__img", item.photo
      ? photo(`assets/photos/${item.photo}.jpg`, item.name, "", { eager: true })
      : el("div.ph", { style: { width: "100%", height: "100%" } })),
    el("div.fcard__name", item.name),
    el("div.fcard__price.num", `${money(item.price)} ${BUSINESS.currency}`),
  );
}

export function homeView() {
  const root = el("div");

  /* ------------------------------------------------------------ hero */
  root.append(
    el("section.hero",
      photo("assets/photos/interior-bar@2x.jpg", "Inside Balance", "hero__img", { eager: true }),
      el("div.hero__body",
        logo("hero__mark"),
        el("p.hero__tag", BUSINESS.tagline),
        el("div", { style: { marginTop: "18px" } }, statusPill())),
    ),
  );

  /* ------------------------------------------------- who is in the room */
  const roomRow = el("button.card.press", {
    type: "button",
    style: { display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", width: "100%", textAlign: "left" },
    onclick: () => { haptic(6); go("/checkin"); },
  });

  const renderRoom = (people) => {
    roomRow.replaceChildren();
    const mine = get().checkin;
    if (!people.length) {
      roomRow.append(
        el("div.avatar", { "aria-hidden": "true" }, icon("people")),
        el("div.grow",
          el("div.headline", "Nobody has checked in yet"),
          el("div.caption", { style: { marginTop: "2px" } }, "Be the first when you arrive")),
        el("span.lrow__chev", icon("chev")));
      return;
    }
    const shown = people.slice(0, 4);
    roomRow.append(
      el("div.stackavatars", shown.map((p) => presence.personAvatar(p, "avatar--sm"))),
      el("div.grow",
        el("div.headline", mine
          ? `You and ${plural(people.length - 1, "other", "others")} are here`
          : `${plural(people.length, "person is", "people are")} here now`),
        el("div.caption", { style: { marginTop: "2px" } },
          mine ? `Checked in ${ago(mine.ts)}` : "Tap to check in when you arrive")),
      el("span.lrow__chev", icon("chev")),
    );
  };
  renderRoom([]);
  presence.list().then(renderRoom);

  root.append(el("div.pad", { style: { marginTop: "20px" } }, roomRow));

  /* ------------------------------------------------------- featured */
  const feats = featured();
  root.append(
    el("section.section",
      el("div.pad", sectionHead("Made this week",
        el("button.caption", {
          type: "button", style: { fontWeight: "500", color: "var(--ink)" },
          onclick: () => go("/menu"),
        }, "Full menu"))),
      el("div.rail", feats.map(featureCard)),
    ),
  );

  /* ------------------------------------------------------- breakfast */
  const omelet = byId("tomato-omelet");
  root.append(
    el("section.section.pad",
      el("button.tile.press", {
        type: "button", style: { width: "100%", display: "block", aspectRatio: "1 / 1" },
        onclick: () => { haptic(6); go("/menu?cat=breakfast"); },
        "aria-label": "See the breakfast menu",
      }, photo("assets/photos/omelet-plated.jpg", "Tomato omelet at Balance")),
      el("div", { style: { marginTop: "18px" } },
        el("h2.display", "Breakfast, until one"),
        el("p.body", { style: { marginTop: "10px" } },
          "Eggs, bread from the morning bake, herbs off the shelf by the window. "
          + "The omelet is the one people come back for."),
        el("button.btn.btn--ghost", {
          type: "button", style: { marginTop: "18px" },
          onclick: () => go("/menu?cat=breakfast"),
        }, "See breakfast", icon("chev"))),
    ),
  );

  /* ---------------------------------------------------------- room */
  root.append(
    el("section.section.pad",
      el("div.tile", { style: { aspectRatio: "4 / 5" } },
        photo("assets/photos/interior-lounge.jpg", "The lounge at Balance")),
      el("div", { style: { marginTop: "18px" } },
        el("h2.display", "A room that lets you stay"),
        el("p.body", { style: { marginTop: "10px" } },
          "Long bar, deep chairs, and enough sockets. Work through the morning, "
          + "meet somebody at four, or read until the lights go down.")),
    ),
  );

  /* --------------------------------------------------------- find us */
  const rows = hoursTable();
  root.append(
    el("section.section.pad",
      sectionHead("Find us"),
      el("div.card.card--pad",
        el("a.lrow", { href: mapsUrl(), target: "_blank", rel: "noopener" },
          el("span.lrow__icon", icon("pin")),
          el("span.grow",
            el("span.headline", { style: { display: "block" } }, `${BUSINESS.district}, ${BUSINESS.city}`),
            el("span.caption", { style: { display: "block", marginTop: "2px" } }, "Open in Maps")),
          el("span.lrow__chev", icon("chev"))),
        el("a.lrow", { href: BUSINESS.instagramUrl, target: "_blank", rel: "noopener" },
          el("span.lrow__icon", icon("instagram")),
          el("span.grow",
            el("span.headline", { style: { display: "block" } }, `@${BUSINESS.instagram}`),
            el("span.caption", { style: { display: "block", marginTop: "2px" } }, "Instagram")),
          el("span.lrow__chev", icon("chev"))),
        el("div.lrow", { style: { alignItems: "flex-start" } },
          el("span.lrow__icon", icon("clock")),
          el("div.grow",
            el("div.headline", { style: { marginBottom: "8px" } }, "Hours"),
            rows.map((r) => el("div.dl",
              el("dt", r.label), el("dd.num", r.text))))),
      ),
    ),
  );

  /* --------------------------------------------------------- footer */
  root.append(
    el("footer.pad", { style: { paddingBlock: "44px", textAlign: "center" } },
      mark("empty__mark"),
      el("p.label", { style: { marginTop: "4px" } }, BUSINESS.name),
      el("p.caption", { style: { marginTop: "10px" } }, BUSINESS.tagline),
    ),
  );

  return root;
}
