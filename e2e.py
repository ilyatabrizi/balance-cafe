#!/usr/bin/env python3
"""End-to-end checks for the Balance PWA.

    python3 serve.py &                                  # or run it in another shell
    python3 e2e.py                                      # local preview
    python3 e2e.py https://ilyatabrizi.github.io/balance-cafe/   # the deployed build

Drives a real mobile browser through every screen and every action a customer
would take, and fails loudly on anything broken. Uses the system Chrome through
Playwright, so there is nothing to download.

Screenshots land in scripts/shots/.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8091/").rstrip("/") + "/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SHOTS = pathlib.Path(__file__).resolve().parent / "scripts" / "shots"

PASS: list[str] = []
FAIL: list[str] = []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name if cond else f"{name}  →  {detail}")


def settle(page, ms=380):
    page.wait_for_timeout(ms)


def goto(page, hash_path, ms=520):
    page.evaluate("h => { location.hash = h; }", hash_path)
    settle(page, ms)


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / f"{name}.png"))


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("pip3 install playwright")

    try:
        urllib.request.urlopen(BASE, timeout=4)
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f"cannot reach {BASE} — run `python3 serve.py` first ({e})")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                  is_mobile=True, has_touch=True,
                                  device_scale_factor=2,
                                  locale="en-GB")
        errors, bad_requests = [], []
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("requestfailed",
                lambda r: bad_requests.append(f"{r.method} {r.url} — {r.failure}"))
        page.on("response",
                lambda r: bad_requests.append(f"{r.status} {r.url}") if r.status >= 400 else None)

        # ---------------------------------------------------------- boot
        page.goto(BASE, wait_until="networkidle")
        settle(page, 900)

        check("boot overlay clears", page.evaluate(
            "document.documentElement.classList.contains('booted')"))
        # The opening sequence runs ~1.9s and then takes itself out of the tree.
        try:
            page.wait_for_selector("#boot", state="detached", timeout=6000)
            gone = True
        except Exception:
            gone = False
        check("boot screen is removed from the tree", gone)
        check("shell mounted", page.locator("#shell").count() == 1)
        check("tab bar present", page.locator(".tabbar .tab").count() == 4)
        check("app bar present", page.locator(".appbar").count() == 1)

        labels = page.eval_on_selector_all(".tab__label", "ns => ns.map(n => n.textContent)")
        check("four named tabs", labels == ["Home", "Menu", "Check-in", "Account"], str(labels))

        # --------------------------------------------------- opening sequence
        boot = ctx.new_page()
        boot.goto(BASE, wait_until="commit")
        boot.wait_for_timeout(90)
        check("wordmark is inlined for the first frame",
              boot.locator("#boot .boot__logo svg .bl").count() == 7)
        check("only the mark is lit at the start", boot.evaluate(
            "[...document.querySelectorAll('#boot .bl')]"
            ".filter(n => n.classList.contains('on')).length <= 1"))
        check("the mark is being written", boot.evaluate(
            "!!document.querySelector('#boot svg g[clip-path] path[pathLength]')"))
        check("the L starts centred and enlarged", boot.evaluate(
            "const t = document.querySelector('.boot__logo').style.transform;"
            "/scale\\((\\d+(\\.\\d+)?)\\)/.test(t) && "
            "parseFloat(t.match(/scale\\(([\\d.]+)\\)/)[1]) > 2"))
        boot.wait_for_timeout(700)
        check("the word assembles around it", boot.evaluate(
            "[...document.querySelectorAll('#boot .bl')]"
            ".filter(n => n.classList.contains('on')).length === 7"))
        boot.wait_for_timeout(2200)
        check("opening sequence finishes and clears",
              boot.evaluate("!document.getElementById('boot')"))
        check("opening sequence leaves no errors", not [e for e in errors if "boot" in e.lower()],
              " | ".join(errors[:2]))
        boot.close()

        # ---------------------------------------------------------- home
        check("hero renders", page.locator(".hero__img").count() == 1)
        check("wordmark is vector", page.evaluate(
            "!!document.querySelector('.hero__mark svg path')"))
        check("wordmark fits the screen", page.evaluate(
            "const r=document.querySelector('.hero__mark').getBoundingClientRect();"
            "r.width>120 && r.right <= innerWidth"))
        check("tagline present", "life is all about you"
              in page.locator(".hero__tag").inner_text().lower())
        check("open/closed pill", page.locator(".status").count() >= 1)
        check("room card present", page.locator("#view .card").first.is_visible())
        check("feature rail has cards", page.locator(".fcard").count() >= 3)
        # Equal days collapse into one row, so a 7-day week reads as 2 lines.
        check("hours listed", page.locator(".dl").count() >= 2)
        check("instagram linked", page.locator("a[href*='instagram.com/balancecafe']").count() >= 1)
        check("maps linked", page.locator("a[href*='google.com/maps']").count() >= 1)

        # Walk the page first so the lazy images below the fold actually start.
        page.evaluate("scrollTo(0, document.body.scrollHeight)")
        settle(page, 1200)
        page.evaluate("scrollTo(0, 0)")
        settle(page, 500)
        loaded = page.eval_on_selector_all(
            "#view img", "ns => ns.filter(n => n.complete && n.naturalWidth > 0).length")
        total = page.locator("#view img").count()
        check("home photos decode", loaded == total, f"{loaded}/{total}")
        shot(page, "01-home")

        # scrolled state: the small title appears, the bar solidifies
        page.evaluate("scrollTo(0, 700)")
        settle(page)
        check("app bar solidifies on scroll",
              page.get_attribute(".appbar", "data-scrolled") == "1")
        check("compact title appears", page.evaluate(
            "getComputedStyle(document.querySelector('.appbar__title')).opacity === '1'"))
        shot(page, "02-home-scrolled")
        page.evaluate("scrollTo(0, 0)")
        settle(page)

        # ---------------------------------------------------------- menu
        page.locator(".tab", has_text="Menu").click()
        settle(page, 600)
        check("menu route", page.evaluate("location.hash") == "#/menu")
        check("menu tab selected",
              page.get_attribute(".tab:nth-child(3)", "aria-selected") == "true")
        check("pill moved to menu", page.evaluate(
            "const p=document.querySelector('.tabbar__pill');"
            "const t=document.querySelectorAll('.tab')[1];"
            "Math.abs(parseFloat(p.style.transform.replace(/[^\\d.-]/g,'')) - t.offsetLeft) < 2"))
        rows = page.locator(".mrow").count()
        check("every item rendered", rows >= 28, f"{rows} rows")
        check("category chips", page.locator(".chip").count() == 6)
        check("prices formatted", bool(re.search(
            r"\d{1,3},\d{3}\sT", page.locator(".mrow__price").first.inner_text())))

        # the rail must park under the app bar, never behind it
        page.evaluate("scrollTo(0, 1400)")
        settle(page)
        gap = page.evaluate(
            "const bar=document.querySelector('.appbar').getBoundingClientRect();"
            "const rail=document.querySelector('.menurail').getBoundingClientRect();"
            "rail.top - bar.bottom")
        check("category rail clears the app bar", -1 <= gap <= 14, f"gap {gap}px")

        page.evaluate("scrollTo(0, 2100)")
        settle(page, 500)
        active = page.eval_on_selector_all(
            ".chip", "ns => ns.filter(n => n.getAttribute('aria-pressed')==='true')"
                     ".map(n => n.dataset.cat)")
        check("rail follows the scroll", active and active[0] != "espresso", str(active))
        shot(page, "03-menu")

        # ------------------------------------------------- item order sheet
        page.evaluate("scrollTo(0, 0)")
        settle(page)
        page.locator(".mrow", has_text="Latte").first.click()
        settle(page, 700)
        check("sheet opens", page.locator(".sheet").count() == 1)
        check("sheet is on screen", page.evaluate(
            "const s=document.querySelector('.sheet').getBoundingClientRect();"
            "s.top < innerHeight - 100"))
        check("option groups render", page.locator(".sheet .opts").count() >= 2)
        check("quantity stepper", page.locator(".sheet .stepper").count() == 1)
        check("note field", page.locator(".sheet textarea").count() == 1)

        base_price = page.locator(".sheet__foot .num").inner_text()
        page.locator(".sheet .opt", has_text="Oat").first.click()
        settle(page, 200)
        oat_price = page.locator(".sheet__foot .num").inner_text()
        check("milk surcharge updates the total", base_price != oat_price,
              f"{base_price} -> {oat_price}")

        page.locator(".sheet .stepper button").last.click()
        settle(page, 200)
        two_price = page.locator(".sheet__foot .num").inner_text()
        check("quantity multiplies the total", two_price != oat_price,
              f"{oat_price} -> {two_price}")
        shot(page, "04-item-sheet")

        page.locator(".sheet__foot .btn").click()
        settle(page, 700)
        check("sheet closes after adding", page.locator(".sheet").count() == 0)
        check("bag badge shows 2", page.locator(".gbtn__badge").inner_text() == "2")
        check("order dock rises", page.get_attribute(".dock", "data-open") == "1")
        check("dock shows the total", "T" in page.locator(".dock").inner_text())
        shot(page, "05-dock")

        # sheet dismissal by tapping the scrim
        page.locator(".mrow", has_text="Cortado").first.click()
        settle(page, 700)
        page.locator(".scrim").click(position={"x": 195, "y": 60})
        settle(page, 700)
        check("scrim tap dismisses the sheet", page.locator(".sheet").count() == 0)
        check("dismissing does not add to the bag",
              page.locator(".gbtn__badge").inner_text() == "2")
        check("page scroll is restored after a sheet",
              page.evaluate("document.body.style.position === ''"))

        # --------------------------------------------------------- check-in
        page.locator(".tab", has_text="Check-in").click()
        settle(page, 700)
        check("check-in route", page.evaluate("location.hash") == "#/checkin")
        check("toggle present", page.locator(".ci-toggle").count() == 1)
        check("toggle starts off", page.get_attribute(".ci-toggle", "data-on") == "0")
        check("mark used as the toggle glyph",
              page.evaluate("!!document.querySelector('.ci-mark svg path')"))
        check("ink flood layer present", page.locator(".ci-ink").count() == 1)
        check("countdown ring present", page.locator(".ci-ring__fill").count() == 1)
        check("ring is empty while checked out",
              page.evaluate("getComputedStyle(document.querySelector('.ci-ring')).opacity") == "0")
        before = page.locator(".person").count()
        shot(page, "06-checkin-off")

        page.locator(".ci-toggle").click()
        # The flourish runs ~1.3s end to end: ink, then the written mark, then
        # the ring. Let it finish before asserting the settled state.
        settle(page, 1600)
        check("toggle turns on", page.get_attribute(".ci-toggle", "data-on") == "1")
        check("you appear in the room", page.locator(".person .avatar--me").count() == 1)
        check("room count grows", page.locator(".person").count() == before + 1,
              f"{before} -> {page.locator('.person').count()}")
        check("tag picker appears", page.locator(".chip").count() >= 4)
        check("anonymity switch appears", page.locator(".switch").count() == 1)
        check("check-out button appears",
              page.locator(".btn", has_text="Check out").count() == 1)
        check("check-in persisted", page.evaluate(
            "!!JSON.parse(localStorage.getItem('balance.v1.state')).checkin"))

        # the flourish: ink lands, the mark ends up written, the ring fills
        check("ink floods the card", page.evaluate(
            "parseFloat(getComputedStyle(document.querySelector('.ci-ink'))"
            ".transform.split(',')[0].replace('matrix(','')) > 0.98"))
        check("mark hands back to its filled path", page.evaluate(
            "const m=document.querySelector('.ci-mark path');"
            "!!m && m.style.opacity !== '0' && !document.querySelector('.ci-mark g[clip-path]')"))
        check("countdown ring shows the hour", page.evaluate(
            "getComputedStyle(document.querySelector('.ci-ring')).opacity === '1'"))
        ring_off = page.evaluate(
            "parseFloat(document.querySelector('.ci-ring__fill')"
            ".getAttribute('stroke-dashoffset'))")
        check("ring starts effectively full", ring_off < 6, f"offset {ring_off}")
        check("minutes remaining shown", bool(re.search(
            r"\b(59|60) min left", page.locator(".ci-sub").inner_text())),
            page.locator(".ci-sub").inner_text())
        shot(page, "07-checkin-on")

        page.locator(".chip", has_text="Working").first.click()
        settle(page, 400)
        check("tag applies to you",
              "working" in page.locator(".person").first.inner_text().lower())

        page.locator(".switch").click()
        settle(page, 500)
        check("anonymous hides your name",
              "someone" in page.locator(".person").first.inner_text().lower())
        page.locator(".switch").click()
        settle(page, 400)

        page.locator(".btn", has_text="Check out now").click()
        settle(page, 900)
        check("check-out clears you", page.get_attribute(".ci-toggle", "data-on") == "0")
        check("visit recorded", page.evaluate(
            "JSON.parse(localStorage.getItem('balance.v1.state')).visits.length >= 1"))
        check("ink recedes on check-out", page.evaluate(
            "parseFloat(getComputedStyle(document.querySelector('.ci-ink'))"
            ".transform.split(',')[0].replace('matrix(','')) < 0.05"))

        # --- the hour runs out on its own -------------------------------
        page.locator(".ci-toggle").click()
        settle(page, 1200)
        page.evaluate("""() => {
          const k = 'balance.v1.state';
          const s = JSON.parse(localStorage.getItem(k));
          s.checkin.ts = Date.now() - 61 * 60000;   // an hour and a minute ago
          localStorage.setItem(k, JSON.stringify(s));
        }""")
        page.reload(wait_until="networkidle")
        settle(page, 1500)
        after = page.evaluate("JSON.parse(localStorage.getItem('balance.v1.state'))")
        check("an expired check-in clears itself", after["checkin"] is None)
        check("expiry is logged as an automatic visit",
              any(v.get("auto") for v in after["visits"]))
        check("expiry lasts exactly the configured hour",
              any(abs((v["out"] - v["in"]) - 3600000) < 2000
                  for v in after["visits"] if v.get("auto")),
              str([v["out"] - v["in"] for v in after["visits"] if v.get("auto")]))
        goto(page, "/checkin")
        check("toggle reads as off after expiry",
              page.get_attribute(".ci-toggle", "data-on") == "0")
        check("an hour is the stated rule",
              "after an hour" in page.locator("#view").inner_text())

        # -------------------------------------------------------------- bag
        page.locator(".gbtn[aria-label*='order']").click()
        settle(page, 700)
        check("bag route", page.evaluate("location.hash") == "#/bag")
        check("back button on a pushed screen",
              page.locator(".appbar .gbtn[aria-label='Back']").count() == 1)
        check("dock hides on the bag itself",
              page.get_attribute(".dock", "data-open") == "0")
        check("line items listed", page.locator("#view .mrow").count() >= 1)
        check("chosen option shown on the line",
              "Oat" in page.locator("#view .mrow").first.inner_text())
        check("totals block", page.locator(".dl--total").count() == 1)
        check("send button starts disabled",
              page.locator(".btn", has_text="Send to the bar").is_disabled())

        # quantity edits flow through to the total
        total_before = page.locator(".dl--total dd").inner_text()
        page.locator("#view .stepper button").last.click()
        settle(page, 400)
        check("editing quantity updates the total",
              page.locator(".dl--total dd").inner_text() != total_before)

        # validation
        page.fill("#view input[type=text]", "Ilya")
        page.fill("#view input[type=tel]", "12345")
        settle(page, 300)
        check("bad phone keeps send disabled",
              page.locator(".btn", has_text="Send to the bar").is_disabled())
        page.fill("#view input[type=tel]", "09141234567")
        settle(page, 300)
        check("valid details enable send",
              page.locator(".btn", has_text="Send to the bar").is_enabled())

        page.locator(".pillbar button", has_text="Pick up").click()
        settle(page, 400)
        check("pickup shows time slots",
              page.locator(".opt", has_text=re.compile(r"^\d\d:\d\d$")).count() >= 4)
        page.locator(".pillbar button", has_text="At a table").click()
        settle(page, 400)
        check("dine-in shows tables", page.locator(".opt", has_text="Bar 1").count() == 1)
        page.locator(".opt", has_text="Bar 1").click()
        settle(page, 300)
        shot(page, "08-bag")

        page.locator(".btn", has_text="Send to the bar").click()
        settle(page, 800)

        # ------------------------------------------------------------ order
        check("lands on the order screen", page.evaluate("location.hash").startswith("#/order/"))
        code = page.locator(".receipt__code").inner_text()
        check("order code issued", bool(re.match(r"^BL-\d{4}$", code)), code)
        check("bag emptied after sending", page.locator(".gbtn__badge").count() == 0)
        check("dock hidden after sending", page.get_attribute(".dock", "data-open") == "0")
        check("table echoed back", "Bar 1" in page.locator("#view").inner_text())
        check("order stored", page.evaluate(
            "JSON.parse(localStorage.getItem('balance.v1.state')).orders.length === 1"))
        shot(page, "09-order")

        page.locator(".btn", has_text="Show at the cashier").click()
        settle(page, 700)
        check("cashier sheet shows the code", code in page.locator(".sheet").inner_text())
        page.keyboard.press("Escape")
        settle(page, 950)
        check("escape closes the sheet", page.locator(".sheet").count() == 0)

        page.locator(".btn", has_text="Order this again").click()
        settle(page, 700)
        check("re-order refills the bag", page.locator("#view .mrow").count() >= 1)
        check("re-order lands on the bag", page.evaluate("location.hash") == "#/bag")

        # ---------------------------------------------------------- account
        page.locator(".tab", has_text="Account").click()
        settle(page, 700)
        check("account route", page.evaluate("location.hash") == "#/account")
        check("name carried over from checkout", "Ilya" in page.locator("#view").inner_text())
        check("order history listed", page.locator(".lrow", has_text="BL-").count() >= 1)
        check("visit history listed", page.locator(".person").count() >= 1)
        check("milk preference offered", page.locator(".opt", has_text="Oat").count() >= 1)
        # The brief was explicit: no CRM, no points. Look for the mechanics of a
        # scheme, not the words — the privacy note legitimately says "no points".
        account_text = page.locator("#view").inner_text()
        check("no loyalty mechanics offered", not re.search(
            r"(earn|collect|redeem|spend|balance of)\s+\w*\s*(points?|stars?|stamps?|rewards?)"
            r"|\d+\s*(points?|stars?|stamps?)\b|\b(gold|silver|bronze)\s+(tier|member)",
            account_text, re.I), account_text[:120])
        shot(page, "10-account")

        page.locator(".opt", has_text="Almond").first.click()
        settle(page, 400)
        check("milk preference saved", page.evaluate(
            "JSON.parse(localStorage.getItem('balance.v1.state')).profile.defaultMilk === 'Almond'"))

        page.locator(".gbtn[aria-label*='Edit']").click()
        settle(page, 700)
        check("profile sheet opens", page.locator(".sheet").count() == 1)
        page.fill(".sheet input[type=text]", "Ilya Tabrizi")
        page.locator(".sheet__foot .btn").click()
        settle(page, 700)
        check("profile edit saves", "Ilya Tabrizi" in page.locator("#view").inner_text())

        # the saved milk should now pre-select in the order sheet
        goto(page, "/menu")
        page.locator(".mrow", has_text="Cappuccino").first.click()
        settle(page, 700)
        check("usual milk pre-selected", page.evaluate(
            "!!document.querySelector('.sheet .opt[aria-pressed=\"true\"]') && "
            "[...document.querySelectorAll('.sheet .opt[aria-pressed=\"true\"]')]"
            ".some(n => n.textContent.includes('Almond'))"))
        page.keyboard.press("Escape")
        settle(page, 950)

        # --------------------------------------------------------- routing
        goto(page, "/order/BL-0000")
        check("unknown order fails gracefully", page.locator(".empty").count() == 1)
        goto(page, "/nonsense")
        check("unknown route falls back home", page.locator(".hero").count() == 1)

        # back navigation out of a pushed screen
        goto(page, "/menu")
        page.locator(".gbtn[aria-label*='order']").click()
        settle(page, 600)
        page.locator(".appbar .gbtn[aria-label='Back']").click()
        settle(page, 600)
        check("back returns to the previous tab", page.evaluate("location.hash") == "#/menu")

        # -------------------------------------------------------- pwa bits
        man = json.loads(urllib.request.urlopen(BASE + "manifest.webmanifest").read())
        check("manifest name", man["name"].startswith("Balance"))
        check("manifest short name", man["short_name"] == "Balance")
        check("standalone display", man["display"] == "standalone")
        check("maskable icon present",
              any("maskable" in i.get("purpose", "") for i in man["icons"]))
        check("512 icon present", any(i["sizes"] == "512x512" for i in man["icons"]))
        check("shortcuts declared", len(man.get("shortcuts", [])) >= 2)
        for i in man["icons"]:
            url = BASE + i["src"]
            try:
                r = urllib.request.urlopen(url)
                check(f"icon {i['sizes']}{'/' + i['purpose'] if i.get('purpose') else ''} served",
                      r.status == 200)
            except Exception as e:
                check(f"icon {i['src']} served", False, str(e))

        check("apple touch icon", page.locator("link[rel='apple-touch-icon']").count() == 1)
        check("apple web app title", page.evaluate(
            "document.querySelector('meta[name=\"apple-mobile-web-app-title\"]').content")
            == "Balance")
        check("theme colour set", page.locator("meta[name='theme-color']").count() == 1)
        check("viewport-fit=cover", "viewport-fit=cover" in page.evaluate(
            "document.querySelector('meta[name=viewport]').content"))

        page.goto(BASE, wait_until="networkidle")
        settle(page, 1400)
        check("service worker registers", page.evaluate(
            "navigator.serviceWorker.getRegistrations().then(r => r.length > 0)"))

        # ------------------------------------------------- language & a11y
        body = page.locator("body").inner_text()
        check("no Persian text on the site", not re.search(r"[\u0600-\u06FF]", body))
        check("document language is English", page.evaluate("document.documentElement.lang") == "en")
        check("direction is ltr", page.evaluate("document.documentElement.dir || 'ltr'") == "ltr")

        unlabelled = page.eval_on_selector_all(
            "button", "ns => ns.filter(n => !n.textContent.trim() && "
                      "!n.getAttribute('aria-label')).length")
        check("every icon-only button is labelled", unlabelled == 0, f"{unlabelled} bare")

        alts = page.eval_on_selector_all("img", "ns => ns.filter(n => !n.alt).length")
        check("every image has alt text", alts == 0, f"{alts} missing")

        small = page.eval_on_selector_all(
            ".tabbar .tab, .btn, .gbtn",
            "ns => ns.filter(n => { const r = n.getBoundingClientRect();"
            "return r.width > 0 && (r.width < 40 || r.height < 40); }).length")
        check("tap targets are at least 40px", small == 0, f"{small} too small")

        check("tab bar is a tablist", page.get_attribute(".tabbar", "role") == "tablist")
        check("one tab selected at a time", page.eval_on_selector_all(
            ".tab", "ns => ns.filter(n => n.getAttribute('aria-selected')==='true').length") == 1)

        # ------------------------------------------------------ resilience
        page.evaluate("localStorage.setItem('balance.v1.state', '{oops')")
        page.goto(BASE, wait_until="networkidle")
        settle(page, 900)
        check("corrupt saved state does not break boot",
              page.locator(".tabbar").count() == 1 and page.locator(".hero").count() == 1)

        # ------------------------------------------------------ wide screen
        page.set_viewport_size({"width": 1280, "height": 900})
        settle(page, 600)
        check("shell stays a phone-width column on desktop", page.evaluate(
            "document.getElementById('shell').getBoundingClientRect().width <= 470"))
        check("tab bar never outgrows the shell", page.evaluate(
            "document.querySelector('.tabbar').getBoundingClientRect().width <= "
            "document.getElementById('shell').getBoundingClientRect().width"))
        shot(page, "11-desktop")
        page.set_viewport_size({"width": 390, "height": 844})

        # ------------------------------------------------------ small phone
        page.set_viewport_size({"width": 320, "height": 568})
        settle(page, 600)
        overflow = page.evaluate("document.documentElement.scrollWidth - innerWidth")
        check("no sideways scroll on a 320px screen", overflow <= 1, f"{overflow}px over")
        shot(page, "12-small")

        check("no console errors", not errors, " | ".join(errors[:4]))
        real_bad = [b for b in bad_requests if "favicon" not in b]
        check("no failed requests", not real_bad, " | ".join(real_bad[:4]))

        browser.close()

    print()
    for f in FAIL:
        print(f"  FAIL  {f}")
    if FAIL:
        print()
    print(f"  {len(PASS)} passed, {len(FAIL)} failed   ({BASE})")
    print(f"  screenshots → {SHOTS}")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
