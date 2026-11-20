// Browser test of the page: serves src/ itself, loads the page at a phone and a desktop size, and checks the
// Separation Table layout (tests/table-layout.cjs) and every function of
// the page: sample, art, printer, platen, garment, white, views, numbers, files, saved machines, measured ramps.
// Needs Playwright with Chromium.
//   node tests/page.cjs [screenshot-dir]
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const T = require("./table-layout.cjs");
const pub = path.join(__dirname, "../src"), shots = process.argv[2];
const art = path.join(__dirname, "../test-images/12-knockout-red.png"), art2 = path.join(__dirname, "../test-images/11-skin-grain-black.png");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

(async () => {
  const site = await T.servePublic(pub), browser = await chromium.launch();
  try {
    for (const [label, viewport] of T.SIZES) {
      const phone = viewport.width <= 960;
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true, colorScheme: "light" }), page = await ctx.newPage(), errors = [];
      page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      const ready = () => page.waitForFunction(() => window.dtgReady === true, null, { timeout: 15000 });
      const step = async n => { if ((await page.getAttribute(`#step${n}Btn`, "aria-expanded")) !== "true") await page.click(`#step${n}Btn`); await page.waitForTimeout(350); };
      const shop = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await page.click(phone ? "#mShop" : "#shopOpen"); };
      const closeShop = () => page.click('#shopPanel [data-close="shopPanel"]');
      await page.goto(site.base + "/index.html"); await ready();

      // the first screen: the drop box with its two help lines and the sample link, the views, the mark
      const dropText = await page.locator("#drop").innerText();
      ok(/Drop your art here/.test(dropText) && /or click to select a PNG, JPG or WebP file/.test(dropText) && /It is not uploaded/.test(dropText) && await page.locator("#dropSample").isVisible(), `${label}: drop box with its help lines and "Try the sample design"`);
      ok(/model only/i.test(await page.locator("#drChk").innerText()) && await page.locator("#drChk").isVisible(), `${label}: the Model only mark shows before any art`);
      await page.click("#dRate"); ok(/does not drive the printer and does not replace the RIP\. Model only until measured ramps are imported\./i.test((await page.locator("#rData .rwhy").innerText()).replace(/\s+/g, " ")), `${label}: the Model only sentence`); await page.click("#dRate");
      await T.noSidewaysScroll(page, label + ", no art", ok);
      if (phone) await T.navClearAtTop(page, label + ", no art", ok);
      ok((await page.getAttribute("#mNext", "disabled")) !== null, `${label}: Next waits for art`);
      if (shots) await page.screenshot({ path: path.join(shots, `dtg-${viewport.width}-empty.png`) });

      // the sample opens step 2, as the Separation Table does
      await page.click("#dropSample"); await page.waitForSelector("#fileCard", { state: "attached" });
      ok((await page.getAttribute("#step2Btn", "aria-expanded")) === "true" && (await page.locator("#step1Badge").innerText()) === "✓" && /Sample design/.test(await page.locator("#step1Sum").innerText()), `${label}: the sample loads, step 1 is checked with its summary, step 2 opens`);
      ok(!(await page.locator("#zoomBox").isHidden()) && /12\.0 × 12\.0 in/.test(await page.locator("#sizeBadge").textContent()), `${label}: Fit and zoom row and the print size show with art`);

      // printer, platen, garment; knockout art on a red shirt
      ok((await page.locator("#printer option").count()) >= 5, `${label}: printer list (presets + custom)`);
      await page.selectOption("#printer", "p:epson-f2270");
      ok((await page.locator("#platen option").count()) >= 2 && /Sources: /.test(await page.locator("#printerSrc").innerText()) && (await page.locator("#printerSrc a").count()) >= 1, `${label}: platen list and the preset's source links`);
      await page.click('#garments button[data-g="red"]');
      ok((await page.locator("#teeName").textContent()) === "Red", `${label}: garment chosen (Red)`);
      await page.setInputFiles("#file", art); await page.waitForFunction(() => /12-knockout-red/.test(document.getElementById("artName").textContent));
      await page.click("#dRate");
      const stats = (await page.locator("#stats").innerText()).replace(/\s+/g, " ");
      const ko = +(stats.match(/Knocked out (\d+) %/i) || [])[1];
      ok(ko >= 50 && ko <= 70, `${label}: red square on a red shirt knocked out (${ko} % of the art; ${stats.slice(0, 110)})`);
      ok(/model only/i.test(stats) && /in²/.test(stats) && /ppi/.test(stats), `${label}: numbers shown, proof labelled model only`);
      await page.click("#dRate");
      await T.viewsShow(page, label, ok, ["art", "colour", "white", "highlight", "knockout", "proof"]);
      await page.click("#z100"); ok(await page.locator("#view0.zoomed").count() === 1 && /100%/.test(await page.locator("#zoomPct").innerText()), `${label}: 100% zooms the picture`);
      await page.click("#zStep"); ok(await page.locator("#view0.zoomed").count() === 0, `${label}: Fit fits it again`);
      { const row = await page.locator(".zoomrow").boundingBox(); await page.mouse.click(row.x + row.width * 0.92, row.y + row.height / 2);
        const pct = parseInt(await page.locator("#zoomPct").innerText(), 10); ok(pct > 100 && await page.locator("#view0.zoomed").count() === 1, `${label}: the zoom slider zooms (${pct}%)`); await page.click("#zStep"); }
      if (shots) await page.screenshot({ path: path.join(shots, `dtg-${viewport.width}-red.png`) });

      // placement guides, in the Proof view: on by default, the art 3 in below the collar, a warning past the platen
      const guided = () => page.evaluate(() => /^Platen: /.test(document.getElementById("view0").getAttribute("aria-label")));
      const cvW = () => page.evaluate(() => document.getElementById("view0").getBoundingClientRect().width);
      ok(await page.isChecked("#guides") && await guided() && await page.isVisible("#placeBox"), `${label}: placement guides shown by default (the platen in the workspace, the operator's lines in step 2)`);
      ok(/3\.00 in below the collar/.test(await page.locator("#placeLines").innerText()) && /Guides are for the operator only/.test(await page.locator("#placeBox").innerText()), `${label}: operator lines give the collar distance`);
      const platenW = await cvW(); ok(platenW > 150 && /platen/i.test(await page.locator("#inspWhere").innerText()), `${label}: platen drawn in the workspace (${Math.round(platenW)} px wide at Fit)`);
      if (shots) await page.screenshot({ path: path.join(shots, `dtg-${viewport.width}-guides.png`) });
      await page.fill("#widthIn", "15"); await page.dispatchEvent("#widthIn", "input");
      ok(await page.isVisible("#placeWarn") && /past the Medium platen/.test(await page.locator("#placeWarn").innerText()), `${label}: art wider than the platen warns (${(await page.locator("#placeWarn").innerText()).slice(0, 80)})`);
      await page.fill("#widthIn", "12"); await page.dispatchEvent("#widthIn", "input");
      ok(!(await page.isVisible("#placeWarn")), `${label}: warning clears when the art fits`);
      await page.fill("#collarIn", "5"); await page.dispatchEvent("#collarIn", "input"); await page.fill("#shiftIn", "-1"); await page.dispatchEvent("#shiftIn", "input");
      ok(/5\.00 in below the collar/.test(await page.locator("#placeLines").innerText()) && /1\.00 in left of the centre line/.test(await page.locator("#placeLines").innerText()), `${label}: collar distance and shift from centre move the art`);
      await page.fill("#collarIn", "3"); await page.dispatchEvent("#collarIn", "input"); await page.fill("#shiftIn", "0"); await page.dispatchEvent("#shiftIn", "input");
      await page.uncheck("#guides"); ok(!(await page.isVisible("#placeBox")) && !(await guided()), `${label}: Show guides off hides them (the bare proof shows)`);
      await page.check("#guides"); ok(await page.isVisible("#placeBox") && await guided(), `${label}: Show guides back on`);
      await page.click('#view button[data-v="white"]'); ok(!(await guided()) && await page.locator("#sizeBadge").isVisible(), `${label}: the other views carry no guides, and show the print size mark`); await page.click('#view button[data-v="proof"]');

      // print width: the fit line follows
      await page.fill("#widthIn", "10"); await page.dispatchEvent("#widthIn", "input");
      ok(/10\.00×/.test(await page.locator("#fitNote").innerText()), `${label}: print width sets the fit (${(await page.locator("#fitNote").innerText()).slice(0, 60)})`);
      await page.fill("#widthIn", "12"); await page.dispatchEvent("#widthIn", "input");

      // step 3: least white without a ramp warns; with a RIP that makes white it warns too; Advanced has the white controls
      if (phone) { await page.click("#mNext"); ok((await page.getAttribute("#step3Btn", "aria-expanded")) === "true", `${label}: Next opens step 3`); await page.click("#mBack"); ok((await page.getAttribute("#step2Btn", "aria-expanded")) === "true", `${label}: Back opens step 2`); }
      await step(3); await page.selectOption("#rule", "reach");
      ok(/model only/i.test(await page.locator("#ruleWarn").innerText()) && /makes its own white/i.test(await page.locator("#ruleWarn").innerText()), `${label}: least-white warnings shown`);
      await page.selectOption("#rule", "full");
      if (phone && (await page.getAttribute("#advTog", "aria-expanded")) !== "true") await page.click("#advTog");
      for (const id of ["strength", "choke", "hl", "ko", "koTol"]) ok(await page.locator("#" + id).isVisible(), `${label}: white control ${id} in Advanced`);
      await page.uncheck("#ko"); await page.click("#dRate"); ok(/Knocked out 0 %/i.test((await page.locator("#stats").innerText()).replace(/\s+/g, " ")) && (await page.locator('[data-pm="ko"]').getAttribute("class")) === "pm hand", `${label}: knockout off takes effect and is marked You set`); await page.click("#dRate");
      await page.click("#whiteDef"); ok(await page.isChecked("#ko"), `${label}: Default puts the white settings back`);

      // black shirt, skin art; step 4 makes the files and they download
      await step(2); await page.click('#garments button[data-g="black"]'); await page.setInputFiles("#file", art2); await page.waitForFunction(() => /11-skin/.test(document.getElementById("artName").textContent));
      await step(4); await page.check("#fTIF"); await page.click("#export"); await page.waitForFunction(() => /Done/.test(document.getElementById("expStatus").textContent), null, { timeout: 60000 });
      const names = await page.locator("#links a").evaluateAll(as => as.map(a => a.download));
      ok(names.length === 7 && names.filter(n => /-(white|highlight)-reference\./.test(n)).length === 4, `${label}: colour, white and highlight as PNG and TIFF listed, white files named reference when the RIP makes white (${names.join(", ")})`);
      for (const [f, ext, magic] of [["colour-png", ".png", [0x89, 0x50]], ["white-tiff", ".tif", [0x49, 0x49]]]) {
        const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`#links a[data-f="${f}"]`)]);
        const buf = fs.readFileSync(await dl.path());
        ok(dl.suggestedFilename().endsWith(ext) && buf[0] === magic[0] && buf[1] === magic[1], `${label}: ${dl.suggestedFilename()} downloads (${buf.length} bytes)`);
      }
      // the operator's placement sheet is its own file; the colour file stays the art's size (no guides in it)
      { const [ps] = await Promise.all([page.waitForEvent("download"), page.click('#links a[data-f="placement-png"]')]); const sheet = fs.readFileSync(await ps.path());
        ok(ps.suggestedFilename().endsWith("-placement.png") && sheet[0] === 0x89 && sheet.readUInt32BE(16) >= 1400, `${label}: ${ps.suggestedFilename()} downloads (${sheet.readUInt32BE(16)}×${sheet.readUInt32BE(20)} px)`);
        if (shots) fs.writeFileSync(path.join(shots, "dtg-placement-sheet.png"), sheet);
        const [cd] = await Promise.all([page.waitForEvent("download"), page.click('#links a[data-f="colour-png"]')]); const cb = fs.readFileSync(await cd.path());
        ok(cb.readUInt32BE(16) === 600 && cb.readUInt32BE(20) === 600, `${label}: colour file is exactly the art (600×600), no guides`);
        await page.uncheck("#fPlace"); await page.click("#export"); await page.waitForFunction(() => /Done/.test(document.getElementById("expStatus").textContent), null, { timeout: 60000 });
        ok((await page.locator('#links a[data-f="placement-png"]').count()) === 0 && (await page.locator("#links a").count()) === 6, `${label}: without the placement sheet box, no sheet is made`); }
      await page.check("#fPlace"); await page.click("#export"); await page.waitForFunction(() => /Done/.test(document.getElementById("expStatus").textContent), null, { timeout: 60000 });
      ok((await page.locator("#step4Badge").innerText()) === "4" && /Done/.test(await page.locator("#expStatus").innerText()), `${label}: files made`);
      await step(2); await page.selectOption("#supply", "file"); await step(4); await page.uncheck("#fTIF"); await page.click(phone ? "#mNext" : "#export"); await page.waitForFunction(() => /Done/.test(document.getElementById("expStatus").textContent), null, { timeout: 60000 });
      ok(!/reference/.test(await page.locator('#links a[data-f="white-png"]').getAttribute("download")), `${label}: with a separate white file the white file is not named reference${phone ? " (made from the Next bar)" : ""}`);

      // custom printer and saved machines (Shop setup)
      await step(2); await page.selectOption("#printer", "custom"); await page.fill("#cW", "15"); await page.dispatchEvent("#cW", "change");
      await shop(); await page.click("#saveMachine");
      ok((await page.locator('#printer option[value^="s:"]').count()) === 1 && /1 saved/i.test(await page.locator("#machPill").innerText()) && /Saved in this browser/.test(await page.locator("#savedNote").innerText()), `${label}: custom printer saved and listed`);
      await page.reload(); await ready();
      ok((await page.locator('#printer option[value^="s:"]').count()) === 1, `${label}: saved machine survives a reload`);
      await shop(); await page.click("#machList button[data-use]");
      ok((await page.inputValue("#printer")).startsWith("s:") && (await page.getAttribute("#step2Btn", "aria-expanded")) === "true", `${label}: Use picks the saved machine and opens step 2`);
      // measured ramps (Shop setup)
      await shop();
      const csv = ["ink,tint,L,a,b", "_shirt,0,16,0,0", ...[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(t => `W,${t},${(16 + 77 * Math.pow(t / 100, 0.6)).toFixed(2)},0,1`)].join("\n");
      await page.setInputFiles("#ramps", { name: "ramps.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await page.waitForFunction(() => document.getElementById("rampReport").textContent.length > 0);
      ok(/White standard: drawdown L\* 93\.0/.test(await page.locator("#rampReport").innerText()), `${label}: ramp CSV read (${(await page.locator("#rampReport").innerText()).slice(0, 80)})`);
      ok(/measured white/i.test(await page.locator("#rampPill").innerText()) && /measured white/i.test(await page.locator("#drChk").innerText()), `${label}: with a white ramp the mark reads Measured white`);
      await page.click("#machList button[data-forget]"); ok((await page.locator('#printer option[value^="s:"]').count()) === 0, `${label}: Forget removes the saved machine`);
      await closeShop();

      // the layout, with art in the workspace
      await step(1); await page.click("#trySample"); await page.waitForTimeout(300);
      await T.themeSwitches(page, label, ok);
      await T.controlsReachable(page, label, ok);
      await step(2); await page.evaluate(() => window.scrollTo(0, 0));
      if (phone) await T.navClearAtTop(page, label + ", with art", ok);
      await T.noSidewaysScroll(page, label + ", with art", ok);
      if (shots) await page.screenshot({ path: path.join(shots, `dtg-${viewport.width}-art.png`) });
      ok(!errors.length, `${label}: no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
      await ctx.close();
      await T.framedChecks(browser, site.base, "/index.html", viewport, label, ok);
    }
  } catch (e) { fails++; console.log("FAIL", e.message); }
  await browser.close(); site.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0);
})();
