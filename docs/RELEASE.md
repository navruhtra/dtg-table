# Publishing a release

The version lives in `src/version.js`. Everything else follows it,
and `node scripts/release.mjs check` fails when it does not.

Changes are made in the tool's source first; this repository receives
releases.

1. Write the CHANGELOG entry in shop words, one line per change, at
   the top of CHANGELOG.md, linking `releases/<version>.md`.
2. Set the new version in `src/version.js` and `package.json`, and in
   the README's version line. Write `releases/<version>.md`
   (`# DTG Table <version>`, then what changed, how to use it,
   checksums and known limits; see releases/0.1.0.md).
3. If a pin in `scripts/vendor-pins.mjs` changed (a library, or the
   Separation Table engine's commit): `npm run setup`, then
   `node scripts/notices.mjs` rewrites THIRD-PARTY-NOTICES.md and
   src/vendor.sha256. Commit both. For a new engine commit, also run
   `node scripts/release.mjs check --engine <separation-table>/src`
   against the engine the tool was built with.
4. `npm test`, `npm run typecheck`, `npm run benchmark` and
   `npm run e2e` pass. CI runs them on every pull request.
5. Merge. CI must be green on the merged commit.
6. Tag the merged commit: `node scripts/release.mjs tag`. It reruns
   the check and makes the annotated tag `v<version>` with the notes
   as its message, then prints the push command. Push the tag alone.
7. Make a GitHub release from the tag as a draft. Check its notes and
   checksums, then publish it.

A published tag is never moved, deleted or replaced. The script
refuses a tag that exists here or on origin; a fix is a new version.
