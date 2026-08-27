// The opening sequence.
//
// The tilted L writes itself, alone and large. Then it settles back into its
// place in the word while the other six letters arrive around it — each one
// emerging from behind the L and travelling outward, so the mark reads as the
// seed the whole wordmark grows from.
//
// It starts on import, before the app has finished booting, and clears at
// whichever comes last: the end of the animation, or the app being ready.

import { spring } from "./motion.js";
import { penFor } from "./markdraw.js";
import { prefersReducedMotion } from "./util.js";

const DRAW_MS = 540;     // writing the L
const LETTER_MS = 420;   // one letter arriving
const STAGGER_MS = 58;   // per step of distance from the L
const HOLD_MS = 300;     // the assembled word, before it leaves
const MARK_PX = 62;      // how tall the L stands on its own

let appReady = false;
let animationDone = false;

function finish() {
  if (!appReady || !animationDone) return;
  document.documentElement.classList.add("booted");
  const boot = document.getElementById("boot");
  // Take it out of the tree once it has faded, so nothing can trap a tap.
  setTimeout(() => boot?.remove(), 700);
}

/** Called by the app once its first view is mounted. */
export function appIsReady() {
  appReady = true;
  finish();
}

function run() {
  const boot = document.getElementById("boot");
  const wrap = boot?.querySelector(".boot__logo");
  const svg = wrap?.querySelector("svg");
  const letters = svg ? [...svg.querySelectorAll(".bl")] : [];
  const markIndex = svg ? Number(svg.dataset.mark) : -1;

  // No inlined wordmark, or a browser that would rather not move: show the
  // finished lockup and get out of the way.
  if (!svg || letters.length < 2 || markIndex < 0 || prefersReducedMotion()) {
    letters.forEach((l) => l.classList.add("on"));
    wrap?.classList.add("lit");
    setTimeout(() => { animationDone = true; finish(); }, 420);
    return;
  }

  const mark = letters[markIndex];

  // --- place the L at the centre of the screen, at reading size -----------
  const box = wrap.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const unit = box.width / vb.width;              // user units → CSS px
  const mb = mark.getBBox();
  const cx = (mb.x + mb.width / 2) * unit;
  const cy = (mb.y + mb.height / 2) * unit;
  const k = MARK_PX / (mb.height * unit);

  wrap.style.transformOrigin = `${cx}px ${cy}px`;
  const place = (t) => {
    // t: 1 = the L alone and large, 0 = the wordmark at rest.
    const s = 1 + (k - 1) * t;
    wrap.style.transform =
      `translate(${(box.width / 2 - cx) * t}px, ${(box.height / 2 - cy) * t}px) scale(${s})`;
  };
  place(1);

  // --- the letters wait just behind the L --------------------------------
  letters.forEach((l, i) => {
    if (i === markIndex) return;
    const steps = Math.abs(i - markIndex);
    const toward = i < markIndex ? 1 : -1;        // start shifted in toward the L
    l.style.transform = `translate(${toward * 15 * steps}px, 0)`;
    l.style.transition =
      `opacity ${LETTER_MS}ms cubic-bezier(.22,1,.32,1) ${steps * STAGGER_MS}ms,` +
      `transform ${LETTER_MS}ms cubic-bezier(.22,1,.32,1) ${steps * STAGGER_MS}ms`;
  });

  // --- write the L --------------------------------------------------------
  const pen = penFor(svg, mark);
  if (!pen) mark.classList.add("on");

  requestAnimationFrame(() => {
    wrap.classList.add("lit");
    if (!pen) { assemble(); return; }

    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / DRAW_MS);
      // Ease in and out: a hand accelerates into a stroke and lands it.
      const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      pen.set(e);
      if (t < 1) { requestAnimationFrame(tick); return; }
      // Swap the drawn shape for the real filled path. They are the same
      // pixels, so the handover cannot be seen.
      mark.classList.add("on");
      pen.remove();
      setTimeout(assemble, 90);
    };
    requestAnimationFrame(tick);
  });

  // --- the word assembles around it ---------------------------------------
  function assemble() {
    letters.forEach((l, i) => {
      if (i === markIndex) return;
      l.classList.add("on");
      l.style.transform = "translate(0, 0)";
    });

    spring({
      from: 1, to: 0, damping: 1, response: 0.55,
      onFrame: place,
      onRest: () => {
        wrap.style.transform = "";
        setTimeout(() => { animationDone = true; finish(); }, HOLD_MS);
      },
    });
  }
}

// Layout has to be measurable before the L can be centred on it.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run, { once: true });
} else {
  run();
}

// A stalled boot must never leave someone staring at a white screen.
setTimeout(() => { animationDone = true; appReady = true; finish(); }, 6000);
