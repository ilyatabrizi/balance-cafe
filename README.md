# Balance — Roshdieh, Tabriz

An installable, offline-capable PWA for Balance café: menu, ordering from your
table, and a live check-in board. English throughout, black and white, no CRM
and no loyalty scheme anywhere in it.

**Live:** https://ilyatabrizi.github.io/balance-cafe/
**Local:** `python3 serve.py` → http://localhost:8091

---

## What it does

| Screen | What a customer can do |
| --- | --- |
| **Home** | See the room, whether it is open, how many people are in, this week's drinks, hours, directions, Instagram |
| **Menu** | Six sections, 31 items, sticky section rail. Tap anything to open its order sheet — size, milk, strength, a note for the bar, quantity |
| **Check-in** | One toggle. Press it on arrival and you appear in the room; everyone else using the app sees who is in and what they are here for. It lasts an hour, counted down by the ring around the mark, then retires itself — checking out by hand still works at any moment |
| **Account** | Name and phone, order history, visit history, usual milk, anonymous check-in, install prompt, clear-this-device |
| **Bag** *(top-right, not a tab)* | Edit the order, dine-in with a table or pick-up with a time slot, then send it to the bar |
| **Order** | The order code to say at the cashier, blown up full screen on request, plus re-order |

Payment happens at the cashier. The app never takes card details, and stores
nothing on a server.

## Design

- **Monochrome interface, colour photography.** Every pixel of chrome is black,
  white or grey. The food is the only colour in the product, and interiors are
  converted to high-contrast black and white so they read as atmosphere rather
  than merchandise. That treatment is baked into the exported files by
  `scripts/build_assets.py`, not applied by CSS filters.
- **The wordmark is traced vector**, walked out of the client's PNG by
  `scripts/trace_logo.py` as seven separate letter paths. The tilted L is pulled
  out on its own as `mark.svg` and reused as the app icon, the check-in glyph,
  and the empty-state mark.
- **The mark writes itself.** The tracer also measures the centreline a pen
  would travel along that letter and its stroke weight. `js/markdraw.js` clips a
  deliberately over-thick line to the real letterform and sweeps it — so the
  letter is drawn, not faded, and at 100% it is pixel-identical to the filled
  path. The opening screen and the check-in toggle share that one stroke.
- **The opening sequence:** the L writes itself alone and large, then settles
  into its place in the word while the other six letters arrive from behind it
  and travel outward. The wordmark is inlined into `index.html` at build time so
  the first frame costs no round trip.
- **Type:** Satoshi for the interface, Fraunces (variable, optical sizing) for
  display and dish names — an echo of the serif on their Instagram cards. The
  wide-tracked uppercase label is the logo's own voice used as a system element.
- **Motion** is spring-based (`js/motion.js`), described as damping ratio and
  response rather than duration, so every gesture is interruptible and carries
  the finger's velocity into the animation. The sheet tracks 1:1, rubber-bands
  at the top, and projects a flick's momentum before deciding to dismiss.
- Respects `prefers-reduced-motion`, `prefers-reduced-transparency` and
  `prefers-contrast`.

## Layout

```
index.html              shell + meta + boot screen
manifest.webmanifest    name, icons, shortcuts
sw.js                   offline: network-first HTML, cache-first media
css/app.css             the entire design system
js/
  app.js                boot, app bar, glass tab bar, order dock
  router.js             hash routing, per-route scroll memory
  store.js              observable state, persisted to localStorage
  data.js               THE MENU — edit this one file
  config.js             hours, address, tables, check-in settings
  presence.js           who is in the room
  motion.js             springs, momentum projection, rubber-band
  ui.js                 sheet, toasts, opening hours, primitives
  util.js  icons.js  install.js
  views/                home · menu · item · checkin · bag · order · account
assets/
  brand/                logo.svg, mark.svg, og.jpg, logo-source.png
  photos/               processed client photography (webp + jpg, 1x + 2x)
  icons/                the full PWA icon set
  fonts/                Satoshi + Fraunces, self-hosted
scripts/
  trace_logo.py         PNG wordmark → SVG
  build_assets.py       photos, icons, share card
  src-*.jpg             the client's original files
  shots/                e2e screenshots
e2e.py                  151 checks against a real browser
serve.py                local preview
```

## Editing the menu

Everything lives in `js/data.js`. An item is:

```js
{ id: "flat-white", cat: "espresso", name: "Flat White", price: 105000,
  desc: "Double ristretto under thin microfoam.",
  photo: "sky-smoothie",        // optional, basename in assets/photos
  tags: ["V", "GF"],            // V vegan · VG vegetarian · GF gluten free
  featured: true,               // shows on the home rail
  options: [MILK, SHOT, CUP] }
```

Prices are Toman, written in full. Categories are `CATEGORIES` at the top of the
same file. Hours, address, tables and pick-up lead time are in `js/config.js`.

Adding a photo: drop the file in `scripts/` as `src-<name>.jpg`, add a line to
`PLATES` in `scripts/build_assets.py` with its crop box and treatment, run
`python3 scripts/build_assets.py`, then reference `<name>` as the item's `photo`.

## Check-in

The toggle, the room list, tags, anonymity, auto-expiry and your own visit
history are all real and working. What is device-scoped is *whose* check-ins you
can see:

- **Now (no backend).** Your own check-in is real and persists. The room is
  filled by a deterministic roster of regulars derived from the clock — it
  varies through the day, holds still across reloads, and is empty when the café
  is closed. This is what makes the feature demonstrable on one phone.
  `CHECKIN.demoPresence` in `js/config.js` turns it off.
- **Shared presence.** Set `CHECKIN.endpoint` to a REST endpoint and the app
  switches over with no other change. `demoPresence` should go to `false` at the
  same time. The contract:

  ```
  GET    <endpoint>          → [{ id, name, anonymous, tag, checked_in_at }]
  POST   <endpoint>          ← { id, name, anonymous, tag, ts }
  DELETE <endpoint>/<id>
  ```

  Anything that speaks that shape works — a PHP file on LimooHost, Supabase, a
  Worker. Rows should expire server-side after three hours to match the client.
  **No key goes in this repo**; use an endpoint that does not need one, or put
  the key behind your own server.

## Tests

```bash
python3 serve.py &
python3 e2e.py                                            # local
python3 e2e.py https://ilyatabrizi.github.io/balance-cafe/   # deployed
```

151 checks: the opening sequence, every route, the order sheet's pricing maths, bag validation,
the whole checkout, check-in on/off/tag/anonymous/visit and the one-hour
auto-expiry, PWA manifest and every icon, service-worker registration, no-Persian-text, alt text, tap-target sizes,
corrupt-localStorage recovery, 320px and desktop layouts, console errors.
Screenshots land in `scripts/shots/`.

## Deploying

`main` is served by GitHub Pages from the repository root.

```bash
git add -A && git commit -m "…" && git push
```

Bump `VERSION` in `sw.js` whenever assets change, or returning visitors keep the
old cache for one extra load.

## Open items

- Real menu and prices from the client — the current card is a placeholder with
  the right shape.
- Phone number for the café (`BUSINESS.phone` in `js/config.js`).
- Exact address and map pin; the pin currently points at Roshdieh generally.
- Shared check-in endpoint, if they want the room to be genuinely live across
  phones rather than per-device.
