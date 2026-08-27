// Writing the tilted L, rather than fading it in.
//
// The traced letterform is a filled outline, so it cannot be stroked on with
// stroke-dashoffset directly. Instead: clip to the real letter, and sweep a
// deliberately over-thick line along the centreline the tracer measured. What
// you see is the true letterform, revealed exactly as a pen would lay it down —
// and at 100% it is pixel-identical to the filled path.

const NS = "http://www.w3.org/2000/svg";

let uid = 0;

/**
 * @param {SVGSVGElement} svg    the host, carrying data-mark-pen / -weight
 * @param {SVGPathElement} shape the letter to reveal
 * @param {object} [opts]
 * @param {number} [opts.cover]  multiple of the stroke weight; >1 covers the
 *                               letterform's full width including its corners
 * @returns {{node:SVGGElement, set:(p:number)=>void, remove:()=>void}|null}
 */
export function penFor(svg, shape, { cover = 2.9 } = {}) {
  const pen = svg.dataset.markPen;
  const weight = parseFloat(svg.dataset.markWeight);
  if (!pen || !weight) return null;

  const id = `pen${++uid}`;
  const defs = document.createElementNS(NS, "defs");
  const clip = document.createElementNS(NS, "clipPath");
  clip.id = id;
  const outline = shape.cloneNode(false);
  outline.removeAttribute("class");
  outline.removeAttribute("style");
  clip.append(outline);
  defs.append(clip);

  const group = document.createElementNS(NS, "g");
  group.setAttribute("clip-path", `url(#${id})`);

  const line = document.createElementNS(NS, "path");
  line.setAttribute("d", "M" + pen.split(" ").join("L"));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", String(weight * cover));
  line.setAttribute("stroke-linecap", "butt");
  line.setAttribute("stroke-linejoin", "miter");
  // pathLength normalises the dash maths to 0–1 whatever the real length is.
  line.setAttribute("pathLength", "1");
  line.setAttribute("stroke-dasharray", "1 1");
  line.setAttribute("stroke-dashoffset", "1");
  group.append(line);

  svg.prepend(defs);
  svg.append(group);

  return {
    node: group,
    /** 0 = nothing written, 1 = the whole letter. */
    set(p) { line.setAttribute("stroke-dashoffset", String(1 - Math.max(0, Math.min(1, p)))); },
    /** Hand the letter back to its own filled path and drop the scaffolding. */
    remove() { defs.remove(); group.remove(); },
  };
}
