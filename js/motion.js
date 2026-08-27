// A spring, described the way Apple describes one: damping ratio and response,
// not mass/stiffness/damping. Everything a finger can touch animates through
// here so it can be grabbed, re-aimed and reversed at any frame.

import { prefersReducedMotion } from "./util.js";

/**
 * @param {object}   o
 * @param {number}   o.from      starting value (always the *presentation* value)
 * @param {number}   o.to        target
 * @param {number}   o.velocity  units per second, handed over from the gesture
 * @param {number}   o.damping   1 = critically damped, <1 overshoots
 * @param {number}   o.response  seconds to approach the target; not a duration
 * @param {Function} o.onFrame
 * @param {Function} [o.onRest]
 * @returns {{stop:Function, retarget:Function, value:Function}}
 */
export function spring({ from, to, velocity = 0, damping = 1, response = 0.4,
                         onFrame, onRest }) {
  let x = from, v = velocity, target = to, raf = 0, last = 0, dead = false;

  if (prefersReducedMotion()) {
    onFrame(target);
    onRest?.(target);
    return { stop() {}, retarget(t) { target = t; onFrame(t); }, value: () => target };
  }

  const w = (2 * Math.PI) / response;   // natural frequency
  const k = w * w;                      // stiffness
  const c = 2 * damping * w;            // damping coefficient

  const step = (now) => {
    if (dead) return;
    if (!last) last = now;
    // Clamp so a backgrounded tab doesn't resume with one enormous step.
    let dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    // Sub-step for stability at high stiffness.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -k * (x - target) - c * v;
      v += a * h;
      x += v * h;
    }

    onFrame(x);

    if (Math.abs(x - target) < 0.15 && Math.abs(v) < 0.6) {
      x = target;
      onFrame(x);
      dead = true;
      onRest?.(x);
      return;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  return {
    stop() { dead = true; cancelAnimationFrame(raf); },
    /** Re-aim mid-flight. Velocity carries through, so there is no brick wall. */
    retarget(t) { target = t; },
    value: () => x,
    velocity: () => v,
  };
}

/**
 * Where a flick would come to rest — the exponential-decay projection iOS uses,
 * not the textbook v²/2a. Feed the result to the snap-point chooser.
 */
export function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/** Progressive resistance past a boundary, so an edge feels soft, not frozen. */
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!dimension) return overshoot;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Keeps the last few pointer samples so release velocity is real, not guessed. */
export function velocityTracker() {
  const samples = [];
  return {
    add(value, time = performance.now()) {
      samples.push({ value, time });
      while (samples.length > 6) samples.shift();
    },
    /** px per second across the most recent ~90ms of movement. */
    get() {
      if (samples.length < 2) return 0;
      const last = samples[samples.length - 1];
      let first = samples[0];
      for (let i = samples.length - 1; i >= 0; i--) {
        if (last.time - samples[i].time > 90) break;
        first = samples[i];
      }
      const dt = (last.time - first.time) / 1000;
      if (dt <= 0.001) return 0;
      return (last.value - first.value) / dt;
    },
    reset() { samples.length = 0; },
  };
}
