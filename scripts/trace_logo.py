#!/usr/bin/env python3
"""Trace the BALANCE wordmark PNG into clean SVG paths.

The master is a flat black-on-white raster. The site sets it at everything from
a 14px header lockup to a full-bleed hero, and the app icon needs the tilted L
on its own — a raster can't do any of that without going soft. This thresholds
the luminance, walks each letter's outline, simplifies it, and writes vector.

    python3 scripts/trace_logo.py

Writes assets/brand/logo.svg (full wordmark) and assets/brand/mark.svg (the
tilted L — the one letter that carries the whole identity).
Pure stdlib + Pillow. No potrace.
"""

import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "brand" / "logo-source.png"
OUT = ROOT / "assets" / "brand"

WORK_W = 1600      # trace width; the art is thin strokes, so resolution matters
LUMA_CUT = 140     # below this = ink
EPSILON = 1.1      # Douglas-Peucker tolerance, in working pixels
MIN_AREA = 60      # drop scanner speckle


def load_mask(path, width):
    """Threshold on luminance, not alpha — the master is opaque black on white."""
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        # The master carries its shape in the alpha channel; convert("L") alone
        # would flatten every transparent pixel to black and swallow the letters.
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, "white")
        flat.paste(im, mask=im.split()[3])
        im = flat.convert("L")
    else:
        im = im.convert("L")
    # Crop to ink before scaling so the trim is tight and the scale is honest.
    bw = im.point(lambda v: 255 if v < LUMA_CUT else 0)
    box = bw.getbbox()
    if box:
        im = im.crop(box)
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    px = im.load()
    return [[1 if px[x, y] < LUMA_CUT else 0 for x in range(width)]
            for y in range(h)], width, h


def components(mask, w, h):
    """Label 4-connected ink blobs iteratively — one per letter."""
    seen = [[False] * w for _ in range(h)]
    blobs = []
    for sy in range(h):
        for sx in range(w):
            if mask[sy][sx] == 0 or seen[sy][sx]:
                continue
            stack = [(sx, sy)]
            seen[sy][sx] = True
            cells = []
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and mask[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(cells) >= MIN_AREA:
                blobs.append(cells)
    return blobs


def trace_outline(cells):
    """Every closed ring bounding one blob — outer edge plus counters (B, A, C, E).

    Collect the unit "crack" segments between an ink pixel and empty space,
    directed so the interior stays on one side, then chain them head-to-tail.
    Chaining directed edges is exact; a Moore walk has to guess at diagonal
    pinches, and these letters are full of thin diagonals.
    """
    cellset = set(cells)
    edges = {}
    for x, y in cells:
        if (x, y - 1) not in cellset:                 # top,    heading +x
            edges.setdefault((x, y), []).append((x + 1, y))
        if (x + 1, y) not in cellset:                 # right,  heading +y
            edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
        if (x, y + 1) not in cellset:                 # bottom, heading -x
            edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
        if (x - 1, y) not in cellset:                 # left,   heading -y
            edges.setdefault((x, y + 1), []).append((x, y))

    rings = []
    while edges:
        start = next(iter(edges))
        ring = [start]
        node = start
        while True:
            outs = edges.get(node)
            if not outs:
                break
            nxt = outs.pop()
            if not outs:
                del edges[node]
            if nxt == start:
                break
            ring.append(nxt)
            node = nxt
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def _rdp_open(pts, eps):
    if len(pts) < 3:
        return pts
    x1, y1 = pts[0]
    x2, y2 = pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5
    worst, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if norm < 1e-9:
            dist = ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        else:
            dist = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if dist > worst:
            worst, idx = dist, i
    if worst > eps:
        return _rdp_open(pts[:idx + 1], eps)[:-1] + _rdp_open(pts[idx:], eps)
    return [pts[0], pts[-1]]


def rdp(ring, eps):
    """Douglas-Peucker on a closed ring.

    Run straight on a ring and its first and last point coincide, so every
    perpendicular distance is measured against a zero-length line and the shape
    collapses to a point. Split at the two farthest-apart anchors first.
    """
    if len(ring) < 4:
        return ring
    sys.setrecursionlimit(40000)
    far = max(range(len(ring)),
              key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    first = _rdp_open(ring[:far + 1], eps)
    second = _rdp_open(ring[far:] + [ring[0]], eps)
    return first[:-1] + second[:-1]


def to_path(rings, scale, ox, oy, precision=2):
    out = []
    for ring in rings:
        if len(ring) < 3:
            continue
        pts = [((x - ox) * scale, (y - oy) * scale) for x, y in ring]
        d = f"M{pts[0][0]:.{precision}f} {pts[0][1]:.{precision}f}"
        for x, y in pts[1:]:
            d += f"L{x:.{precision}f} {y:.{precision}f}"
        out.append(d + "Z")
    return "".join(out)


def svg(paths_d, vw, vh, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw:.0f} {vh:.0f}" '
        f'fill="currentColor" role="img" aria-label="{title}">'
        f'<path fill-rule="evenodd" d="{paths_d}"/></svg>\n'
    )


def bounds(blobs):
    xs = [x for b in blobs for x, _ in b]
    ys = [y for b in blobs for _, y in b]
    return min(xs), min(ys), max(xs), max(ys)


def main():
    mask, w, h = load_mask(SRC, WORK_W)
    blobs = components(mask, w, h)
    # Left to right — B A L A N C E.
    blobs.sort(key=lambda b: min(x for x, _ in b))
    print(f"  {len(blobs)} letters traced from {w}x{h}")
    if len(blobs) != 7:
        print(f"  ! expected 7 letters, got {len(blobs)} — check LUMA_CUT/MIN_AREA")

    # --- full wordmark ---------------------------------------------------
    ox, oy, mx, my = bounds(blobs)
    lw, lh = mx - ox + 1, my - oy + 1
    scale = 1000 / lw
    rings = [rdp(r, EPSILON) for b in blobs for r in trace_outline(b)]
    (OUT / "logo.svg").write_text(
        svg(to_path(rings, scale, ox, oy), 1000, lh * scale, "BALANCE"),
        encoding="utf-8")

    # --- the mark: the tilted L, third letter in ---------------------------
    mark = [blobs[2]]
    mox, moy, mmx, mmy = bounds(mark)
    mw, mh = mmx - mox + 1, mmy - moy + 1
    ms = 1000 / mw
    mrings = [rdp(r, EPSILON) for b in mark for r in trace_outline(b)]
    (OUT / "mark.svg").write_text(
        svg(to_path(mrings, ms, mox, moy), 1000, mh * ms, "Balance"),
        encoding="utf-8")

    for f in ("logo.svg", "mark.svg"):
        p = OUT / f
        print(f"  {f}: {p.stat().st_size / 1024:.1f} KB")
    print(f"  wordmark aspect {lw / lh:.2f}:1   mark aspect {mw / mh:.2f}:1")


if __name__ == "__main__":
    main()
