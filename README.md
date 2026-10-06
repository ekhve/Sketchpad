# Sketchpad

A phone-first piano sketchpad for a producer learning piano: pick a key, play
chords and scales, build a loop, practise short lessons on the piano, with
suggested fingering and a printable sheet. One React file (`sketchpad.jsx`),
built into one self-contained HTML page, installable to the home screen.

| Where | What |
|---|---|
| `sketchpad.jsx` | The app. The pure theory layer sits between `THEORY:START` and `THEORY:END` |
| `sketchpad.feature` | Every behaviour as a Gherkin scenario, tagged `@auto` or `@manual` |
| `DESIGN.md`, `REQUIREMENTS.md`, `USE_CASES.md` | Why, what and for whom; decisions are `D-nnn` |
| `FEATURES.md`, `PLAYTEST.md`, `DONE.md` | Status, the manual test script, the definition of done |
| `tests/`, `tools/` | Tests, mutation testing, the DoD gates, the build |
| `site/`, `proto/` | App icons; prototypes agreed before building |
| `j6/` | The **J-6 Explorer**, a second app for the Roland J-6: `j6.mjs` (engine, search), `sets.mjs` (the 100 chord sets, imported by `tools/j6-import.mjs`), `labels.mjs` (reads the manual's chord labels), `app.jsx` (the page). It shares Sketchpad's theory, piano and sound (`D-086`, `D-087`) |

# Running the tests

```bash
node tools/extract-theory.mjs sketchpad.jsx tests/theory.mjs   # build
node --test tests/*.test.mjs                                   # run
node tools/mutate.mjs                                          # check the tests themselves
```

**Build step.** The first command lifts the block between `/* THEORY:START */`
and `/* THEORY:END */` out of `sketchpad.jsx` and writes it as a module. The
tests run against the code that actually ships — there is no second copy of the
theory to drift. `tests/theory.mjs` is generated: don't edit it, don't commit it.

**Why tooling lives in `tools/`, not `tests/`.** `node --test tests/` treats
every file in the directory as a test file, which would execute the mutator.
Keep helpers out of the runner's path and pass the glob explicitly.

## What's covered

| Suite | Checks | What it protects |
|---|---|---|
| `theory.test.mjs` | 402 | Scales, chords, analysis, figures, key roles, naming, lessons, typed chord names |
| `j6.test.mjs` | 27 | J-6 Explorer: all 100 sets and the manual's spellings, data validation and its pinned errors, spelling, numerals, key, transpose, search |
| `site.test.mjs` | 8 | The installable site: manifest, iOS tags, offline cache, updates, and the J-6 app beside it (`D-076`, `D-087`) |
| `traceability.test.mjs` | 6 | That the feature file and the tests still describe the same product |

Scenarios tagged `@manual` in `sketchpad.feature` cover sound, timing and
legibility. Those cannot be asserted here and are checked by hand on a phone.

## Mutation testing

Passing tests prove nothing until you've seen them fail. `tools/mutate.mjs`
breaks the theory on purpose — one change at a time — and reports whether the
suite noticed. **191 mutants, all killed.** Two of those mutants only die because
of tests written specifically after an earlier run found them surviving.

Add a mutant whenever you add a feature. A mutant that reports `SKIP` has gone
stale against refactored code and needs rewriting, not deleting.

Current state: 443 automated checks, all passing.

## Before calling anything done

```bash
node tools/check-done.mjs
```

Runs the ten automated gates from `DONE.md` — suite, mutation score, stale
mutants, requirement traceability, theory purity, colour tokens, change-log
freshness, decision citation — and prints a verdict. The manual and judgement
gates in `DONE.md` still need a person.

# Putting it on your phones (`D-076`)

The app is one HTML file. To install it on an iPhone or iPad it has to live on
a website, because iOS will not run a downloaded HTML file.

**Build it** (Node 22):

```bash
npm install
npm run build     # build/sketchpad-app.html, the whole app in one file
npm run site      # dist/, the installable site: index.html, sw.js, manifest, icons; J-6 Explorer in dist/j6/
```

**Publish it with GitHub Pages.** `.github/workflows/pages.yml` runs the tests,
builds the site and publishes it on every push to `main`. Once, in the
repository on github.com: Settings → Pages → Source: **GitHub Actions**. The
site is then at `https://<user>.github.io/<repo>/`, and the J-6 Explorer at
`https://<user>.github.io/<repo>/j6/`.

On a free GitHub plan, Pages needs the repository to be **public**.

**Install:** open the site in **Safari** → Share → **Add to Home Screen**.
Open it once with a network; after that it works in flight mode. Anyone with the
link can do the same; no account is needed.

**Update:** push to `main`. Each phone picks up the new version the next time
the app is opened with a network, and uses it from the open after that.
