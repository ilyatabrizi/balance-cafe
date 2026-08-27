#!/usr/bin/env python3
"""Build every binary asset the Balance PWA ships.

    python3 scripts/build_assets.py

Runs the logo tracer, renders the app-icon set from the traced mark, and turns
the seven client photographs into web-sized derivatives.

Art direction, applied here rather than in CSS so the bytes on the wire are
already right:
  * Food and drink stay in colour. They are the product; the photography is the
    only colour in the entire interface, and that is the point.
  * Interiors are converted to high-contrast monochrome. They are atmosphere,
    not merchandise, so they sit inside the black-and-white system.

Every source has the client's own typography burned into it. The crop boxes
below cut that out so the app can set its own type on top.

Pure stdlib + Pillow + headless Chrome. No ImageMagick, no cwebp.
"""

import pathlib
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageEnhance, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts"
PHOTOS = ROOT / "assets" / "photos"
ICONS = ROOT / "assets" / "icons"
BRAND = ROOT / "assets" / "brand"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

INK = "#000000"

# name -> (source stem, crop as fractions l/t/r/b, treatment, output aspect w/h)
PLATES = {
    "sky-smoothie":      ("src-sky-smoothie",      (0.10, 0.140, 0.90, 0.800), "colour", 4 / 5),
    "melon-strawberry":  ("src-melon-strawberry",  (0.10, 0.140, 0.90, 0.800), "colour", 4 / 5),
    "mango-berry":       ("src-mango-berry",       (0.10, 0.140, 0.90, 0.800), "colour", 4 / 5),
    "tomato-omelet":     ("src-tomato-omelet",     (0.00, 0.000, 1.00, 0.755), "colour", 4 / 5),
    "omelet-plated":     ("src-omelet-frame",      (0.21, 0.360, 0.79, 0.735), "colour", 1 / 1),
    "interior-bar":      ("src-interior-bar",      (0.00, 0.000, 1.00, 1.000), "mono",   16 / 9),
    "interior-lounge":   ("src-interior-lounge",   (0.00, 0.000, 1.00, 1.000), "mono",   4 / 5),
}

# Two widths each: the card size and a 2x for retina / hero use.
WIDTHS = {
    "sky-smoothie": (640, 1280), "melon-strawberry": (640, 1280),
    "mango-berry": (640, 1280), "tomato-omelet": (640, 1280),
    "omelet-plated": (640, 1280), "interior-bar": (960, 1920),
    "interior-lounge": (720, 1440),
}

ICON_SIZES = [48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]


def run_tracer():
    print("logo")
    subprocess.run([sys.executable, str(SRC / "trace_logo.py")], check=True)


# ---------------------------------------------------------------- photographs

def crop_to_aspect(im, aspect):
    """Centre-crop to an exact aspect ratio without ever upscaling."""
    w, h = im.size
    if w / h > aspect:
        nw = round(h * aspect)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = round(w / aspect)
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def to_mono(im):
    """High-contrast black and white — editorial, not a desaturation.

    Autocontrast first so the mid-greys spread across the full range, then a
    small S-curve via contrast/brightness. Straight .convert("L") on these
    interiors comes out flat and muddy.
    """
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=(0.5, 0.5))
    g = ImageEnhance.Contrast(g).enhance(1.16)
    g = ImageEnhance.Brightness(g).enhance(1.02)
    return g.convert("RGB")


def to_colour(im):
    """Colour, pulled back a touch so it sits inside a monochrome interface."""
    im = ImageEnhance.Color(im).enhance(0.94)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    return im


def build_photos():
    print("photos")
    PHOTOS.mkdir(parents=True, exist_ok=True)
    for name, (stem, box, treatment, aspect) in PLATES.items():
        path = SRC / f"{stem}.jpg"
        if not path.exists():
            print(f"  ! missing {path.name} — skipped")
            continue
        im = Image.open(path).convert("RGB")
        w, h = im.size
        im = im.crop((round(box[0] * w), round(box[1] * h),
                      round(box[2] * w), round(box[3] * h)))
        im = crop_to_aspect(im, aspect)
        im = to_mono(im) if treatment == "mono" else to_colour(im)

        for i, target_w in enumerate(WIDTHS[name]):
            suffix = "" if i == 0 else "@2x"
            tw = min(target_w, im.width)
            th = round(im.height * tw / im.width)
            out = im.resize((tw, th), Image.LANCZOS)
            out.save(PHOTOS / f"{name}{suffix}.webp", "WEBP", quality=82, method=6)
            out.save(PHOTOS / f"{name}{suffix}.jpg", "JPEG", quality=84,
                     optimize=True, progressive=True)
        base = PHOTOS / f"{name}.webp"
        print(f"  {name:18s} {treatment:6s} {im.width}x{im.height}"
              f"  {base.stat().st_size / 1024:5.1f} KB")


# ---------------------------------------------------------------------- icons

def render_png(html, width, height, out):
    """Screenshot one HTML string with headless Chrome."""
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "icon.html"
        page.write_text(html, encoding="utf-8")
        shot = pathlib.Path(tmp) / "out.png"
        subprocess.run([
            CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
            "--force-device-scale-factor=1",
            f"--screenshot={shot}", f"--window-size={width},{height}",
            "--default-background-color=00000000",
            page.as_uri(),
        ], check=True, capture_output=True)
        shutil.copy(shot, out)


def icon_html(mark_svg, size, bg, fg, pad, radius=0):
    """A square icon: the tilted L, optically centred on a flat field."""
    return f"""<!doctype html><meta charset="utf-8">
<style>
  html,body{{margin:0;padding:0;width:{size}px;height:{size}px;}}
  .plate{{width:{size}px;height:{size}px;background:{bg};border-radius:{radius}px;
        display:flex;align-items:center;justify-content:center;}}
  .plate svg{{width:{round(size * pad)}px;height:auto;color:{fg};display:block;}}
</style>
<div class="plate">{mark_svg}</div>"""


def build_icons():
    print("icons")
    ICONS.mkdir(parents=True, exist_ok=True)
    mark = (BRAND / "mark.svg").read_text(encoding="utf-8")

    # Full-bleed: the platform applies its own mask, so no radius of our own.
    master = ICONS / "_master.png"
    render_png(icon_html(mark, 1024, INK, "#FFFFFF", 0.34), 1024, 1024, master)
    src = Image.open(master).convert("RGB")
    for s in ICON_SIZES:
        src.resize((s, s), Image.LANCZOS).save(ICONS / f"icon-{s}.png", optimize=True)
    src.resize((180, 180), Image.LANCZOS).save(ICONS / "apple-touch-icon.png", optimize=True)

    # Maskable: same art inside the 40% safe zone, so Android's circle mask
    # never clips the letter.
    mask_master = ICONS / "_master-maskable.png"
    render_png(icon_html(mark, 1024, INK, "#FFFFFF", 0.22), 1024, 1024, mask_master)
    msrc = Image.open(mask_master).convert("RGB")
    for s in (192, 512):
        msrc.resize((s, s), Image.LANCZOS).save(ICONS / f"maskable-{s}.png", optimize=True)

    # Monochrome / tinted variant for iOS dark + Android themed icons.
    mono_master = ICONS / "_master-mono.png"
    render_png(icon_html(mark, 1024, "#FFFFFF", INK, 0.34), 1024, 1024, mono_master)
    Image.open(mono_master).convert("RGB").resize((512, 512), Image.LANCZOS) \
        .save(ICONS / "icon-mono-512.png", optimize=True)

    for f in (master, mask_master, mono_master):
        f.unlink()
    print(f"  {len(ICON_SIZES) + 4} files")


def build_og():
    """Share card — wordmark on ink, 1200x630."""
    print("og")
    logo = (BRAND / "logo.svg").read_text(encoding="utf-8")
    html = f"""<!doctype html><meta charset="utf-8">
<style>
  html,body{{margin:0;width:1200px;height:630px;background:{INK};}}
  .w{{width:1200px;height:630px;display:flex;flex-direction:column;
     align-items:center;justify-content:center;gap:44px;}}
  .w svg{{width:620px;height:auto;color:#fff;}}
  p{{margin:0;font:400 20px/1 -apple-system,system-ui,sans-serif;color:#fff;
     opacity:.55;letter-spacing:.42em;text-transform:uppercase;text-indent:.42em;}}
</style>
<div class="w">{logo}<p>Tabriz &middot; Roshdieh</p></div>"""
    tmp = BRAND / "_og.png"
    render_png(html, 1200, 630, tmp)
    Image.open(tmp).convert("RGB").save(BRAND / "og.jpg", "JPEG", quality=88, optimize=True)
    tmp.unlink()
    print(f"  og.jpg {(BRAND / 'og.jpg').stat().st_size / 1024:.1f} KB")


def inline_logo():
    """Drop the traced wordmark straight into index.html.

    The opening animation is the first thing anyone sees, so it must not wait on
    a second request. 3KB in the document beats a round trip.
    """
    print("inline")
    logo = (BRAND / "logo.svg").read_text(encoding="utf-8").strip()
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")
    start, end = "<!--LOGO-->", "<!--/LOGO-->"
    a, b = html.index(start) + len(start), html.index(end)
    page.write_text(html[:a] + logo + html[b:], encoding="utf-8")
    print(f"  index.html  +{len(logo) / 1024:.1f} KB")


def main():
    run_tracer()
    inline_logo()
    build_photos()
    build_icons()
    build_og()
    print("\ndone")


if __name__ == "__main__":
    main()
