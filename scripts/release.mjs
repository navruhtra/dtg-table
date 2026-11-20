// Release discipline. src/version.js is the one source of the version; this checks the rest agrees.
//   node scripts/release.mjs check [--tag <tag>] [--engine <dir>]
//        version.js = package.json = top CHANGELOG entry = releases/<v>.md = the README's version line; with --tag, the
//        tag names the same version. With --engine <dir> (a Separation Table src/ folder, such as a local checkout's),
//        every name this tool imports from the engine is also in that engine, with the same code as the pinned copy.
//   node scripts/release.mjs tag   check, then make the annotated tag v<version> locally. It refuses a tag that exists
//        here or on origin: a published tag is never moved or replaced.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VERSION } from "../src/version.js";
import { ENGINE } from "./vendor-pins.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."), argv = process.argv.slice(2);
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
const read = f => readFileSync(join(root, f), "utf8");
const pkg = JSON.parse(read("package.json")), TITLE = pkg.name === "dtg-table" ? "DTG Table" : "DTF Table";
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

/** @returns {string[]} one line per disagreement; empty when the release files agree */
export function releaseProblems({ version = VERSION, tag = null } = {}) {
  const bad = [], changelog = read("CHANGELOG.md"), readme = read("README.md");
  if (!/^\d+\.\d+\.\d+$/.test(version)) bad.push(`version.js: "${version}" is not major.minor.patch`);
  if (pkg.version !== version) bad.push(`package.json version ${pkg.version} is not version.js ${version}`);
  const top = changelog.match(/^## (\d+\.\d+\.\d+)\b.*$/m), entry = top ? changelog.slice(top.index).split(/\n## (?!#)/)[0] : "";
  if (!top || top[1] !== version) bad.push(`CHANGELOG.md top entry is ${top ? top[1] : "missing"}, not version.js ${version}`);
  else if (!entry.includes(`releases/${version}.md`)) bad.push(`CHANGELOG.md ${version} entry does not link releases/${version}.md`);
  const nf = join(root, "releases", `${version}.md`);
  if (!existsSync(nf)) bad.push(`releases/${version}.md is missing`);
  else if (!readFileSync(nf, "utf8").startsWith(`# ${TITLE} ${version}\n`)) bad.push(`releases/${version}.md must start with "# ${TITLE} ${version}"`);
  if (!readme.includes(`Version ${version} ·`)) bad.push(`README.md does not say "Version ${version} ·" under its header`);
  if (tag != null && tag !== `v${version}`) bad.push(`tag ${tag} is not v${version} (version.js)`);
  return bad;
}

/** Every name the tool imports from the engine is in the engine at dir, with the same code as the pinned copy. */
export async function engineProblems(dir) {
  const bad = [], pinned = join(root, "src/vendor/separation-table");
  if (!existsSync(pinned)) return ["src/vendor/separation-table is missing: run npm run setup"];
  const text = v => typeof v === "function" ? v.toString() : JSON.stringify(ArrayBuffer.isView(v) ? Array.from(/** @type {any} */ (v)) : v);
  for (const [file, names] of Object.entries(ENGINE.imports)) {
    const a = await import(pathToFileURL(join(pinned, file)).href), b = await import(pathToFileURL(resolve(dir, file)).href);
    for (const n of names) {
      if (!(n in a)) bad.push(`${file}: ${n} is not in the pinned engine (${ENGINE.commit.slice(0, 7)})`);
      else if (!(n in b)) bad.push(`${file}: ${n} is not in ${dir}`);
      else if (text(a[n]) !== text(b[n])) bad.push(`${file}: ${n} differs between the pinned engine and ${dir}`);
    }
  }
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = argv[0];
  if (cmd === "check") {
    const bad = releaseProblems({ tag: opt("--tag") ? opt("--tag").replace(/^refs\/tags\//, "") : null });
    if (opt("--engine")) bad.push(...await engineProblems(opt("--engine")));
    for (const l of bad) console.log("FAIL", l);
    console.log(bad.length ? `${bad.length} FAILED` : `release files agree on ${VERSION}${opt("--engine") ? "; the engine agrees with the pin" : ""}`);
    process.exit(bad.length ? 1 : 0);
  } else if (cmd === "tag") {
    const tag = `v${VERSION}`, bad = releaseProblems({ tag });
    if (git("status", "--porcelain")) bad.push("uncommitted changes: commit them first");
    if (git("tag", "--list", tag)) bad.push(`tag ${tag} already exists here: a release is never re-tagged; raise the version`);
    try { if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`)) bad.push(`tag ${tag} already exists on origin: a release is never re-tagged; raise the version`); } catch { bad.push("could not read origin's tags: check the network, then retry"); }
    if (bad.length) { for (const l of bad) console.log("FAIL", l); process.exit(1); }
    git("tag", "-a", tag, "-F", join(root, "releases", `${VERSION}.md`));
    console.log(`Tagged ${tag} at ${git("rev-parse", "--short", "HEAD")}. Review it, then push the tag alone:\n  git push origin refs/tags/${tag}`);
  } else { console.log("usage: node scripts/release.mjs check [--tag <tag>] [--engine <dir>] | tag"); process.exit(2); }
}
