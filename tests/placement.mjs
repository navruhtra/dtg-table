// DTG Table: placement on the platen. Run: node tests/placement.mjs
const { placeArt, placementLines, PLACEMENT_DEFAULTS } = await import("../src/placement.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const medium = { name: "Medium", widthIn: 14, heightIn: 16 };

const p = placeArt({ platen: medium, artWidthIn: 10, artHeightIn: 12 });
ok(PLACEMENT_DEFAULTS.collarIn === 3 && p.collarIn === 3, "default: 3 in below the collar");
ok(p.art.x === 2 && p.art.y === 3 && p.centreX === 7, "10 in wide art centred on a 14 in platen sits 2 in from the left, 3 in down");
ok(p.fits && !p.warnings.length, "10 × 12 in at 3 in down fits a 14 × 16 platen (bottom at 15 in)");

const tall = placeArt({ platen: medium, artWidthIn: 10, artHeightIn: 14 });
ok(!tall.fits && Math.abs(tall.overflow.bottom - 1) < 1e-9 && /1\.00 in past the Medium platen's bottom edge/.test(tall.warnings[0]), `too tall: ${tall.warnings[0]}`);
const wide = placeArt({ platen: medium, artWidthIn: 15, artHeightIn: 5 });
ok(wide.overflow.left === 0.5 && wide.overflow.right === 0.5 && wide.warnings.length === 2, "too wide: 0.5 in over on each side");
const shifted = placeArt({ platen: medium, artWidthIn: 4, artHeightIn: 4, shiftIn: 5.5 });
ok(Math.abs(shifted.overflow.right - 0.5) < 1e-9 && shifted.overflow.left === 0, "a left-chest style shift past the edge warns on the right only");
const up = placeArt({ platen: medium, artWidthIn: 4, artHeightIn: 4, collarIn: -1 });
ok(up.overflow.top === 1, "art above the collar line warns at the top");

const lines = placementLines(shifted);
ok(lines.some(l => /5\.50 in right of the centre line/.test(l)) && lines.some(l => /3\.00 in below the collar/.test(l)), "operator lines give the shift and the collar distance");
ok(placementLines(p).some(l => /on the platen's centre line/.test(l)) && placementLines(p).some(l => /left edge: 2\.00 in\. From its top edge: 3\.00 in/.test(l)), "operator lines give the distances from the platen edges");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
