// The checks every table built on the Separation Table's page (bench.css and its shell) must pass: DTG Table and DTF
// Table call these from their own tests/page.cjs, at a phone and a desktop size. Needs Playwright with Chromium.
// The same file is kept with the Separation Table's source; this is a copy (MIT, American Dream Network).
// The server gives a folder as the site does, and two host pages that frame a tool the way an ADN page does:
//   /tools/host?src=/dtg-table/index.html        the tool's full page (the page header has the title and the gear)
//   /tools/host/wall?src=/dtg-table/index.html   the wall (the tool keeps its own title row)
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".json": "application/json" };
const SIZES = [["phone 390", { width: 390, height: 844 }], ["desktop 1280", { width: 1280, height: 800 }]];

/** Serve public/ on a free port of this machine. Resolves to { base, close }. */
function servePublic(pub) {
  const host = src => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>host</title><body style="margin:0"><div data-tool-header style="position:sticky;top:0;height:54px;background:#eee;z-index:2">Program header</div><iframe src="${src.replace(/[^\w./-]/g, "")}" style="display:block;width:100%;height:1400px;border:0"></iframe></body>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x"), u = decodeURIComponent(url.pathname);
    if (u === "/tools/host" || u === "/tools/host/wall") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(host(url.searchParams.get("src") || "")); }
    const f = path.join(pub, u.endsWith("/") ? u + "index.html" : u);
    if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

/** No sideways scroll. */
async function noSidewaysScroll(page, label, ok) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, `${label}: no sideways scroll (${over} px)`);
}

/** Every control can be reached: in each of the four steps (with Advanced open), every control that shows can be
    scrolled to a place where nothing lies over it (not the pinned workspace, not the Back / Next bar). */
async function controlsReachable(page, label, ok) {
  let total = 0; const covered = [];
  for (let n = 1; n <= 4; n++) {
    if ((await page.getAttribute(`#step${n}Btn`, "aria-expanded")) !== "true") await page.click(`#step${n}Btn`);
    const tog = page.locator("#advTog"); if (await tog.count() && (await tog.getAttribute("aria-expanded")) !== "true") await tog.click();
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => {
      const bad = []; let seen = 0;
      for (const el of document.querySelectorAll("button, select, a[href], input:not(.vh), summary, label[tabindex]")) {
        if (el.disabled || el.closest("dialog, [hidden]") || el.tagName !== "SUMMARY" && el.closest("details:not([open])")) continue;
        let b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === "hidden") continue;
        // a link that wraps is tested on its first line; the zoom slider takes no pointer: its row reads it (bench.css)
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }); b = el.getClientRects()[0]; seen++;
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit || !(el.contains(hit) || hit.contains(el) && hit.matches("label, .stepper, .pc, .selw, .zoomrow") || el.id && hit.closest(`label[for="${el.id}"]`))) bad.push(`${el.id || el.className || el.tagName} (under ${hit ? hit.id || hit.className || hit.tagName : "nothing"})`);
      }
      window.scrollTo(0, 0); return { bad, seen };
    });
    total += r.seen; covered.push(...r.bad.map(b => `step ${n}: ${b}`));
  }
  ok(!covered.length && total > 20, `${label}: every control is reachable (${total} checked in the four steps)${covered.length ? ": " + covered.join(" | ") : ""}`);
}

/** Phones, at scroll 0: the Back / Next bar lies under the first screen's controls: the workspace's own (the sample
    link, Fit and zoom), the view row and the open step's header. Nothing of them is behind the bar. */
async function navClearAtTop(page, label, ok) {
  const r = await page.evaluate(() => {
    window.scrollTo(0, 0); const nav = document.getElementById("mNav"), top = nav.getBoundingClientRect().top, fixed = getComputedStyle(nav).position === "fixed", low = [];
    for (const el of document.querySelectorAll("#dropSample, #view button, #zoomSteps button, #zoomSlider, .sstep.open .sthead")) { const b = el.getBoundingClientRect(); if (b.height && b.bottom > top + 0.5) low.push(el.id || el.textContent.trim().slice(0, 20)); }
    return { low, fixed, top };
  });
  ok(r.fixed && !r.low.length, `${label}: at scroll 0 the Back / Next bar (top ${Math.round(r.top)} px) covers no first-screen control${r.low.length ? ": " + r.low.join(", ") : ""}`);
}

/** Each view shows: its button is pressed and the workspace picture is drawn; the views are not all one picture. */
async function viewsShow(page, label, ok, views) {
  const marks = new Set();
  for (const v of views) {
    await page.click(`#view button[data-v="${v}"]`); await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const cv = document.getElementById("view0"), b = cv.getBoundingClientRect(), sq = document.getElementById("square").getBoundingClientRect();
      const g = cv.getContext("2d"), d = cv.width > 1 ? g.getImageData(0, 0, cv.width, cv.height).data : [], step = Math.max(4, Math.floor(d.length / 4 / 4000) * 4); let h = 0; for (let i = 0; i < d.length; i += step) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
      return { w: cv.width, h: cv.height, mark: h, inside: b.width > 20 && b.height > 20 && b.left < sq.right && b.right > sq.left && b.top < sq.bottom && b.bottom > sq.top }; });
    marks.add(r.mark);
    ok((await page.getAttribute(`#view button[data-v="${v}"]`, "aria-pressed")) === "true" && r.w > 1 && r.h > 1 && r.inside, `${label}: ${v} view shows (${r.w} × ${r.h} px picture in the workspace)`);
  }
  ok(marks.size >= Math.min(3, views.length), `${label}: the views differ (${marks.size} different pictures in ${views.length} views)`);
}

/** The theme switch: Dark and Light change the page's colours, and the pick is kept. */
async function themeSwitches(page, label, ok) {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const shop = (await page.locator("#shopPanel #themeSeg").count()) > 0; if (shop) await page.evaluate(() => document.getElementById("shopOpen").click());
  await page.click('#themeSeg button[data-v="dark"]'); const dark = await bg(), scheme = await page.getAttribute("html", "data-scheme");
  await page.click('#themeSeg button[data-v="light"]'); const light = await bg();
  if (shop) await page.click('#shopPanel [data-close="shopPanel"]');
  ok(scheme === "dark" && dark !== light && (await page.getAttribute("html", "data-scheme")) === "light", `${label}: theme switch works (dark ${dark}, light ${light})`);
}

/** Framed as an ADN page frames it. Full page: the tool's own title row and Help button are hidden (the page's header
    has them), the theme switch is in Shop setup on a phone, and the page's buttons open Help and Shop setup. On the
    wall the tool keeps its title row. */
async function framedChecks(browser, base, src, size, label, ok) {
  for (const wall of [false, true]) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 }), page = await ctx.newPage(), errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`${base}/tools/host${wall ? "/wall" : ""}?src=${src}`); const f = page.frameLocator("iframe");
    await f.locator("#step1Btn").waitFor({ timeout: 15000 }); await page.waitForTimeout(400);
    const phone = size.width <= 960, where = wall ? "on the wall" : "in an ADN tool page";
    const cls = await f.locator("body").getAttribute("class");
    if (!wall) {
      ok(/\bframed\b/.test(cls) && /\binheader\b/.test(cls), `${label}: ${where} the tool knows it is framed (${cls})`);
      ok(!(await f.locator(".mhead").isVisible()) && !(await f.locator(".brand").isVisible()), `${label}: ${where} the tool's own title row is hidden`);
      ok(!(await f.locator("#helpOpen").isVisible()), `${label}: ${where} the tool's own Help button is hidden`);
      // the page's ? and gear press these (pillars/tools/FramedTool.tsx)
      await f.locator("#helpOpen").evaluate(b => b.click()); ok(await f.locator("#helpPanel").evaluate(d => d.open), `${label}: ${where} the page's ? opens the tool's Help`);
      await f.locator("#helpClose").click();
      await f.locator("#shopOpen").evaluate(b => b.click()); ok(await f.locator("#shopPanel").evaluate(d => d.open), `${label}: ${where} the page's gear opens Shop setup`);
      if (phone) ok(await f.locator("#shopPanel #themeSeg").isVisible(), `${label}: ${where} the theme switch is in Shop setup`);
      await f.locator('#shopPanel [data-close="shopPanel"]').click();
      if (phone) ok((await f.locator("#mNav").evaluate(n => getComputedStyle(n).position)) === "static", `${label}: ${where} the Back / Next bar ends the page (not fixed)`);
    } else if (phone) ok(/\bframed\b/.test(cls) && !/\binheader\b/.test(cls) && await f.locator(".mhead").isVisible(), `${label}: ${where} the tool keeps its own title row`);
    ok(!errors.length, `${label}: ${where} no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
    await ctx.close();
  }
}

module.exports = { SIZES, servePublic, noSidewaysScroll, controlsReachable, navClearAtTop, viewsShow, themeSwitches, framedChecks };
