// The README screenshots, light and dark, from the live tool (or any address that serves it), at 1280 x 900 and
// deviceScaleFactor 2. The sample designs are loaded first so the picture shows the tool at work.
//   node scripts/shots.cjs [address] [out-dir]     default: the live tool, docs/
// Needs Playwright with Chromium (NODE_PATH=.cache/pw/node_modules after npm run setup:e2e).
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const pkg = require("../package.json");
const url = process.argv[2] || pkg.homepage, out = path.resolve(process.argv[3] || path.join(__dirname, "../docs"));
(async () => {
  fs.mkdirSync(out, { recursive: true }); const b = await chromium.launch();
  for (const scheme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme }), pg = await ctx.newPage();
    await pg.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    // the tool runs in a frame on the ADN page, and on its own when served from src/
    const tool = pg.frames().find(f => /\/(dtf|dtg)-table\/index\.html/.test(f.url())) || pg.mainFrame();
    await tool.waitForSelector("#dropSample", { state: "visible", timeout: 60000 });
    await tool.click("#dropSample"); await pg.waitForTimeout(4000);
    await tool.evaluate(() => window.scrollTo(0, 0)); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(500);
    const f = path.join(out, `screenshot-${scheme}.png`); await pg.screenshot({ path: f }); console.log(f);
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
