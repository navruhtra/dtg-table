// @ts-check
// DTG Table: measured ink ramps. The CSV format and the fitting are the Separation Table's (calib.js), imported:
//   ink,tint,L,a,b   one row per measured patch (tint 0–100)
//   _shirt,0,L,a,b   the bare garment the white ramp was printed on (usually black)
// DTG conventions on top of it:
//   W                the white density ramp on that garment: W,0 is the bare garment, W,100 full white.
//   W@<set>          another white ramp, e.g. W@light and W@heavy for pretreat variation. Each set is fitted alone.
//   any other ink    a colour ramp printed on full white (C, M, Y, K, R, G, B as the RGB file's ramps): tint 0 is
//                    the white base. Fitted together (one Yule–Nielsen n, a dot-gain curve per ramp).
import { parseWedgeCSV, fitCalibration } from "./vendor/separation-table/calib.js";
import { makeWhiteModel } from "./model.js";

const isWhite = name => /^w(@.+)?$/i.test(name), setOf = name => (name.split("@")[1] ?? "standard");

/** Read a ramp CSV. Returns { garment, white: { [set]: { model, fit } }, colour: fit | null, rows }. */
export function readRamps(text) {
  const rows = parseWedgeCSV(text), shirt = rows.find(r => /^_?shirt$/i.test(r.ink));
  const white = {};
  const sets = [...new Set(rows.filter(r => isWhite(r.ink)).map(r => setOf(r.ink)))];
  for (const set of sets) {
    const rs = rows.filter(r => isWhite(r.ink) && setOf(r.ink) === set && typeof r.tint === "number").map(r => ({ ...r, ink: "W" }));
    if (!rs.some(r => r.tint === 0) && shirt) rs.push(/** @type {any} */ ({ ink: "W", tint: 0, lab: shirt.lab }));
    const fit = fitCalibration(rs), k = fit.inks.W;
    white[set] = { fit, model: makeWhiteModel({ whiteLab: k.solid, n: fit.n, curve: k.curve, source: `measured ramp${set === "standard" ? "" : " " + set}` }), garment: k.substrate };
  }
  const colourRows = rows.filter(r => !isWhite(r.ink) && !/^_?shirt$/i.test(r.ink));
  const colour = colourRows.length ? fitCalibration(colourRows) : null;
  return { garment: shirt ? shirt.lab : (white.standard?.garment ?? null), white, colour, rows: rows.length };
}

/** Plain-language summary for the producer and the job sheet. */
export function rampReport(r) {
  const lines = [];
  for (const [set, w] of Object.entries(r.white)) {
    const c = w.model.curve;
    if (w.model.n <= 1 || w.model.n >= 3) lines.push(`White ${set}: the fit hit the edge of its range (n ${w.model.n}); check the readings, especially the 0 and 100 % patches.`);
    lines.push(`White ${set}: drawdown L* ${w.model.whiteLab[0].toFixed(1)}, Yule–Nielsen n ${w.model.n}, fit residual ${w.fit.residual} ΔE00, 50 % prints as ${(100 * c[5]).toFixed(0)} % effective area.`);
  }
  if (r.colour && (r.colour.n <= 1 || r.colour.n >= 3)) lines.push(`Colour: the fit hit the edge of its range (n ${r.colour.n}); check the readings.`);
  if (r.colour) lines.push(`Colour on white: n ${r.colour.n}, residual ${r.colour.residual} ΔE00, ramps ${Object.keys(r.colour.inks).join(", ")}.`);
  if (!lines.length) lines.push("No ramps found.");
  return lines;
}
