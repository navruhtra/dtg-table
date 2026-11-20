// Download the pinned libraries and the Separation Table engine into src/vendor/ (git-ignored), then check every file
// against src/vendor.sha256. The pins are in vendor-pins.mjs.
//   node scripts/fetch-vendor.mjs
import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES, ENGINE, npmSpec, rawUrl } from "./vendor-pins.mjs";
import { verifyVendor } from "./notices.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."), src = join(root, "src"), cache = join(root, ".cache"), vendor = join(src, "vendor");
rmSync(vendor, { recursive: true, force: true });
for (const d of [cache, vendor]) mkdirSync(d, { recursive: true });
/** The full path of a vendor file, with its folder made. */
const at = to => { const f = join(vendor, to); mkdirSync(dirname(f), { recursive: true }); return f; };

// npm packages
execSync(`npm install --no-save --no-package-lock --silent --prefix "${cache}" ${PACKAGES.map(npmSpec).join(" ")}`, { stdio: "inherit" });
const nm = join(cache, "node_modules");
for (const p of PACKAGES) for (const [from, to] of Object.entries(p.files || {})) copyFileSync(join(nm, p.pkg, from), at(to));
// quickhull3d: one ESM file, built the way the Separation Table builds it; the metafile records which packages went in
const qh = PACKAGES.find(p => p.bundle);
writeFileSync(join(cache, "qh-entry.js"), "export {default as quickhull} from 'quickhull3d';\n");
execSync(`"${join(nm, ".bin/esbuild")}" "${join(cache, "qh-entry.js")}" --bundle --format=esm --minify --log-level=warning --metafile="${join(cache, "quickhull.meta.json")}" --outfile="${at(qh.bundle)}"`, { stdio: "inherit", cwd: cache });

// the Separation Table engine at its pinned commit
for (const [from, to] of Object.entries(ENGINE.files)) {
  const r = await fetch(rawUrl(ENGINE, from));
  if (!r.ok) throw new Error(`${ENGINE.repo}@${ENGINE.commit.slice(0, 7)} ${from}: HTTP ${r.status}`);
  writeFileSync(at(to), Buffer.from(await r.arrayBuffer()));
}

const bad = verifyVendor();
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log(`Vendor files are ready and match vendor.sha256 (Separation Table engine at ${ENGINE.commit.slice(0, 7)}).`);
