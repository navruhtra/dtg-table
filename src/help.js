// @ts-check
// DTG Table: plain-language help: the "?" notes and the searchable Help panel. Same markup and classes as the
// Separation Table's help.js (bench.css styles both); the text is DTG's own, taken from the page's notes and the
// README. Written to ASD-STE100: short sentences, active voice, one instruction per sentence.

/** @typedef {{ t: string, what: string, why?: string, tip?: string, group: string }} Help */

/** @type {Record<string, Help>} */
export const HELP = {
  art: { group: "1. Artwork", t: "Artwork",
    what: "The art to print: a PNG, JPG or WebP file. PNG with transparency is best. The transparent areas print nothing, and the garment shows.",
    tip: "Your art stays on this computer. DTG Table does not upload it." },
  machine: { group: "2. Printer / garment", t: "Printer",
    what: "The printer preset sets the platens, the file resolution and how the printer's software takes white. Every preset cites its sources. Anything not sourced is marked \"default, verify\".",
    tip: "For a printer that is not in the list, choose Custom printer and enter what the machine can do. Shop setup saves a machine in this browser." },
  platen: { group: "2. Printer / garment", t: "Platen",
    what: "The platen sets the largest print. The page fits the art to it.",
    tip: "Read the line under the print width. It gives the print size, the pixels per inch and the largest size on this platen." },
  supply: { group: "2. Printer / garment", t: "White goes to the RIP as",
    what: "How your printer's software takes white. Either the RIP makes white from the colour file, or the RIP takes a separate white file.",
    why: "A RIP that makes its own white cannot print less white than it chooses. The white files are then a reference of what this page would print." },
  garment: { group: "2. Printer / garment", t: "Garment colour",
    what: "The colour of the garment. The colours are ADN's estimates of common blank colours, not measurements. Other takes any colour.",
    why: "White garments get no white layer. Light and dark garments get white where the colour needs it. A printer with no white ink prints white and light garments only." },
  width: { group: "2. Printer / garment", t: "Print width",
    what: "The width of the print on the garment, in inches. The height follows the art's proportions.",
    tip: "Under 150 pixels for each inch, the page warns." },
  collar: { group: "2. Printer / garment", t: "Below the collar",
    what: "How far the top of the art sits below the collar, in inches. The garment is loaded with its collar at the platen's top edge, so the distance is measured down from that edge.",
    tip: "3 in is a common setting for an adult front print. It is a default: verify it for your shop." },
  shift: { group: "2. Printer / garment", t: "Shift from centre",
    what: "How far the centre of the art sits to the right of the platen's centre line, in inches. A negative number moves it to the left." },
  guides: { group: "2. Printer / garment", t: "Show guides",
    what: "In the Proof view, the workspace draws the platen to scale: its outline, the centre line, the collar distance, and the art in its position and size. The page warns when the art runs past the printable area.",
    why: "Guides are for the operator only. They are never in the colour or white files." },
  rule: { group: "3. White", t: "White under colour",
    what: "Full white puts white under all the art. Least white gives each colour only the white it needs: the inks only take light away, so a colour needs white where it is lighter than the garment. Black on any shirt needs none. Yellow on black needs full white.",
    why: "Full white is the safe setting. It is also what a RIP that makes its own white does.",
    tip: "Import the measured white ramp before you use least white. Without it, least white is model only. In the benchmark a wrong white model costs about 2 ΔE00." },
  strength: { group: "3. White", t: "White density",
    what: "The strength of the white layer, in percent of full white." },
  choke: { group: "3. White", t: "Choke",
    what: "The width, in millimetres, that the white layer is pulled in from the edge of the colour. Highlight white takes the same choke." },
  highlight: { group: "3. White", t: "Highlight white",
    what: "A second white layer under near-white art, on garments that are not white. It sits on top of the white under the colour." },
  knockout: { group: "3. White", t: "Knock out the garment colour",
    what: "Where the art has the garment's colour, the shirt prints as itself: no ink and no white." },
  koTol: { group: "3. White", t: "Knockout tolerance",
    what: "How near the art colour must be to the garment colour to be knocked out, in ΔE00. The edge of the range is a smooth ramp." },
  files: { group: "4. Files", t: "Files",
    what: "A colour file and the white files, as PNG or TIFF. Files are made at the art's full resolution and carry their print resolution. In the white files, black is full white ink, the way a spot channel reads.",
    why: "Where the page sends less than full white, the colour file is lightened to match. That colour file only prints right with this page's white file.",
    tip: "If your RIP makes white from the colour file, load the colour file. The white files are then named reference." },
  sheet: { group: "4. Files", t: "Placement sheet",
    what: "A PNG for the operator: the platen with the guides and the art in position, and the distances to set up on the press, in inches.",
    why: "It is not a file for the RIP." },
  proof: { group: "Proof and numbers", t: "Proof ΔE00",
    what: "The proof is a forward model of the print on the garment. ΔE00 is the colour difference between the proof and the art: the mean, and the value 95 % of the pixels are under.",
    why: "It is a model, not a measurement. With no measured ramp, the proof uses the same model as the white rule." },
  numbers: { group: "Proof and numbers", t: "Numbers",
    what: "White and Highlight: the area of white ink, as square inches of full coverage. Knocked out: the share of the art that prints as the bare garment. File: the pixels per inch and the print size." },
  views: { group: "Proof and numbers", t: "Views",
    what: "Art: the art as you gave it. Proof: the model of the print on the garment. Colour: the colour layer on the garment. White: the white under the colour. Highlight: the highlight white. Knockout: the areas that print as the bare garment." },
  ramps: { group: "Shop setup", t: "Measured ramps",
    what: "A CSV of measured patches (ink,tint,L,a,b) from the DTG test targets. The white ramp sets the white model.",
    why: "Without a measured white ramp, every number on this page is model only." },
};

/** Common questions, at the top of the Help panel. */
export const FAQ = [
  ["Does DTG Table drive my printer?", "No. It makes print-ready files: a colour layer and white layers for your printer's own software. It does not replace the RIP."],
  ["Does my art leave this computer?", "No. Everything runs in this browser tab."],
  ["What does Model only mean?", "The numbers come from a model of the ink, not from a print. Import measured ramps in Shop setup to replace the white model."],
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const body = h => `<p>${esc(h.what)}</p>${h.why ? `<p><b>Why:</b> ${esc(h.why)}</p>` : ""}${h.tip ? `<p><b>Do this:</b> ${esc(h.tip)}</p>` : ""}`;

/** Wire a "?" button onto every element with data-help, and fill the Help panel. Returns attach(root) for content
    drawn later. The same behaviour as the Separation Table's initHelp. */
export function initHelp(doc = document) {
  const pop = doc.createElement("div"); pop.id = "tipPop"; pop.className = "tippop"; pop.setAttribute("role", "dialog"); pop.hidden = true; doc.body.appendChild(pop);
  /** @type {HTMLButtonElement | null} */ let cur = null;
  const close = (refocus = false) => { if (!cur) return; cur.setAttribute("aria-expanded", "false"); const c = cur; cur = null; pop.hidden = true; if (refocus) c.focus(); };
  const place = () => {
    if (!cur) return; const r = cur.getBoundingClientRect(), vw = doc.documentElement.clientWidth, vh = window.innerHeight, w = Math.min(330, vw - 32);
    pop.style.width = w + "px"; const h = pop.offsetHeight, left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, vw - 16 - w)), below = r.bottom + 9 + h <= vh - 9 || r.top - 9 - h < 9;
    pop.style.left = left + "px"; pop.style.top = (below ? r.bottom + 9 : r.top - 9 - h) + "px"; pop.dataset.side = below ? "below" : "above"; pop.style.setProperty("--ax", (r.left + r.width / 2 - left) + "px");
  };
  let n = 0;
  const attach = (root = doc) => { for (const el of /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll("[data-help]")))) {
    const key = el.dataset.help || "", h = HELP[key]; if (!h || el.querySelector(":scope > button.q")) continue;
    const b = doc.createElement("button"); b.type = "button"; b.className = "q"; b.textContent = "?"; b.id = `q-${key}-${n++}`;
    b.setAttribute("aria-label", `What is ${h.t}?`); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "tipPop"); el.appendChild(b);
    b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (cur === b) return close();
      close(); cur = b; b.setAttribute("aria-expanded", "true"); pop.innerHTML = `<b class="tt">${esc(h.t)}</b>${body(h)}`; pop.setAttribute("aria-label", h.t); pop.hidden = false; place(); });
  } };
  attach();
  doc.addEventListener("click", e => { if (cur && !pop.contains(/** @type {Node} */ (e.target))) close(); });
  doc.addEventListener("keydown", e => { if (e.key === "Escape" && cur) { e.stopPropagation(); close(true); } }, true);
  window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
  const list = doc.getElementById("helpList"), q = /** @type {HTMLInputElement | null} */ (doc.getElementById("helpQ"));
  if (!list || !q) return attach;
  const groups = {}; for (const [k, h] of Object.entries(HELP)) (groups[h.group] ||= []).push([k, h]);
  list.innerHTML = `<section class="hgroup"><h3>Common questions</h3>${FAQ.map(([qq, a]) => `<details class="hitem"><summary>${esc(qq)}</summary><p>${esc(a)}</p></details>`).join("")}</section>`
    + Object.entries(groups).map(([g, items]) => `<section class="hgroup"><h3>${esc(g)}</h3>${items.map(([k, h]) => `<details class="hitem" data-k="${k}"><summary>${esc(h.t)}</summary>${body(h)}</details>`).join("")}</section>`).join("");
  q.addEventListener("input", () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean); let shown = 0;
    for (const d of /** @type {HTMLDetailsElement[]} */ (Array.from(list.querySelectorAll(".hitem")))) { const hit = words.every(w => (d.textContent || "").toLowerCase().includes(w)); d.hidden = !hit; d.open = !!words.length && hit; if (hit) shown++; }
    for (const s of /** @type {HTMLElement[]} */ (Array.from(list.querySelectorAll(".hgroup")))) s.hidden = !Array.from(s.querySelectorAll(".hitem")).some(d => !(/** @type {HTMLElement} */ (d)).hidden);
    const none = doc.getElementById("helpNone"); if (none) none.hidden = shown > 0;
  });
  return attach;
}
