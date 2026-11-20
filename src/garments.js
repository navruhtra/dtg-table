// @ts-check
// DTG Table: garment presets. Colours are ADN's estimates of common blank colours (sRGB), not measurements of any
// maker's fabric: "default, verify". A measured garment (L*a*b* from a spectrophotometer) replaces the estimate.
import { rgb2lab, hex2rgb } from "./vendor/separation-table/engine.js";
import { garmentClass } from "./white.js";

/** @typedef {{ id: string, name: string, hex: string, lab: number[], measured: boolean }} Garment */

const EST = [
  ["white", "White", "#f4f4f2"], ["natural", "Natural", "#e9e2cf"], ["ash", "Ash", "#d6d6d3"],
  ["sport-grey", "Sport grey (heather)", "#9b9b9b"], ["charcoal", "Charcoal", "#4a4a4c"], ["black", "Black", "#1a1a1c"],
  ["navy", "Navy", "#1f2a44"], ["royal", "Royal blue", "#1f4fa3"], ["light-blue", "Light blue", "#a9c8e8"],
  ["red", "Red", "#b3202a"], ["maroon", "Maroon", "#5a1f2b"], ["orange", "Orange", "#e8642a"],
  ["gold", "Gold", "#f0b323"], ["yellow", "Yellow", "#f2df4a"], ["forest", "Forest green", "#24402f"],
  ["kelly", "Kelly green", "#1f8a4c"], ["purple", "Purple", "#4b2e83"], ["pink", "Light pink", "#f2c4cf"],
];

/** @type {readonly Garment[]} */
export const GARMENTS = Object.freeze(EST.map(([id, name, hex]) => ({ id, name, hex, lab: rgb2lab(...hex2rgb(hex)), measured: false })));

/** A garment from a hex colour or a measured L*a*b*. */
export function garment({ id = "custom", name = "Custom garment", hex = null, lab = null } = /** @type {any} */ ({})) {
  if (lab) return { id, name, hex: hex ?? "", lab: [...lab], measured: true };
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? "")) throw new Error("A garment needs a colour: #rrggbb or a measured L*a*b*.");
  return { id, name, hex, lab: rgb2lab(...hex2rgb(hex)), measured: false };
}

/** Which garments a machine can print: with white ink, every colour; without it, only white and light garments. */
export function garmentsFor(machine, list = GARMENTS) {
  const hasWhite = (machine?.inks ?? []).includes("W");
  return list.filter(g => hasWhite || garmentClass(g.lab) !== "dark");
}
