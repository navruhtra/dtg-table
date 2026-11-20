// @ts-check
// DTG Table: where the art sits on the platen. Pure geometry in inches, no DOM.
// The garment is loaded with its collar at the platen's top edge (the usual way to load an adult front), so the
// art's top is measured down from that edge. Defaults are common shop practice, "default, verify" for each shop:
// 3 in below the collar for an adult front print, centred left to right.

export const PLACEMENT_DEFAULTS = Object.freeze({ collarIn: 3, shiftIn: 0 });

/**
 * @param {{ platen: { name: string, widthIn: number, heightIn: number, marginIn?: number }, artWidthIn: number,
 *   artHeightIn: number, collarIn?: number, shiftIn?: number }} a
 *   shiftIn: art centre to the right of the platen's centre line (negative = left).
 * @returns {{ platen: { name: string, w: number, h: number }, art: { x: number, y: number, w: number, h: number },
 *   centreX: number, collarIn: number, shiftIn: number, overflow: { left: number, right: number, top: number, bottom: number },
 *   fits: boolean, warnings: string[] }}
 *   Coordinates in inches from the platen's top-left corner of its printable area.
 */
export function placeArt({ platen, artWidthIn, artHeightIn, collarIn = PLACEMENT_DEFAULTS.collarIn, shiftIn = PLACEMENT_DEFAULTS.shiftIn }) {
  const w = platen.widthIn, h = platen.heightIn, centreX = w / 2;
  const x = centreX + shiftIn - artWidthIn / 2, y = collarIn;
  const r = v => Math.round(v * 1000) / 1000;
  const overflow = { left: r(Math.max(0, -x)), right: r(Math.max(0, x + artWidthIn - w)), top: r(Math.max(0, -y)), bottom: r(Math.max(0, y + artHeightIn - h)) };
  const warnings = [];
  const side = { left: "left edge", right: "right edge", top: "top edge", bottom: "bottom edge" };
  for (const k of /** @type {const} */ (["left", "right", "top", "bottom"])) if (overflow[k] > 0.001) warnings.push(`The art runs ${overflow[k].toFixed(2)} in past the ${platen.name} platen's ${side[k]}.`);
  return { platen: { name: platen.name, w, h }, art: { x, y, w: artWidthIn, h: artHeightIn }, centreX, collarIn, shiftIn, overflow, fits: !warnings.length, warnings };
}

/** Plain lines for the operator: what to set up on the press, in inches. */
export function placementLines(p) {
  const f = v => (Math.round(v * 100) / 100).toFixed(2);
  return [
    `Platen: ${p.platen.name}, ${f(p.platen.w)} × ${f(p.platen.h)} in printable.`,
    `Art: ${f(p.art.w)} × ${f(p.art.h)} in.`,
    `Top of the art: ${f(p.collarIn)} in below the collar (platen top edge).`,
    p.shiftIn ? `Centre: ${f(Math.abs(p.shiftIn))} in ${p.shiftIn > 0 ? "right" : "left"} of the centre line.` : "Centre: on the platen's centre line.",
    `From the platen's left edge: ${f(p.art.x)} in. From its top edge: ${f(p.art.y)} in.`,
    ...p.warnings,
  ];
}
