# Definition of Done

**Status:** v1.0
**Date:** 2026-09-05
**Applies to:** every change that reaches `sketchpad.jsx`, `j6/`, `core/`, `sketchpad/`, the documents, or the test suite.

A change is **done** when all three of the following are true. Not one. Not two.

1. Every gate below either passes or has a recorded, dated exception.
2. `node tools/check-done.mjs` reports every automated gate passing (19 as of 2026-10-07).
3. A person has run the manual gates that the change touches.

Anything less is in progress, however well it works on a phone.

---

## Why this exists

Two failures reached the product while it appeared to work, and neither was a coding mistake. Chord analysis was judged against the wrong scale for two sessions, producing confident and false explanations (`D-025`). The link between scenarios and tests rotted within one session, with nothing checking it (`D-026`). Both were process gaps. These gates close them.

## The gates

### A. Requirements

| Gate | Requirement | How it's judged |
|---|---|---|
| **DoD-1** | Every new or changed behaviour has a numbered requirement in `REQUIREMENTS.md`. | By hand, at review |
| **DoD-2** | Every requirement traces to a decision (`D-nnn`) or a use case (`UC-nn`). | `check-done` G5 |
| **DoD-3** | Every automated or manual requirement names a scenario that exists in `sketchpad.feature`. | `check-done` G4 |
| **DoD-4** | Requirements the change makes obsolete are struck through, not deleted. | By hand, at review |

A requirement that cannot be stated as true-or-false is not a requirement; it is an intention, and belongs in `DESIGN.md` instead.

### B. Documentation

| Gate | Requirement | How it's judged |
|---|---|---|
| **DoD-5** | A behaviour that changed because of something learned in use is recorded as a numbered decision with the context that caused it. | By hand, at review |
| **DoD-6** | The affected use case in `USE_CASES.md` reflects what the product now does, including its status. | By hand, at review |
| **DoD-7** | `DESIGN.md` has a change-log entry dated today. | `check-done` G9 |
| **DoD-7b** | Every use case referenced by a scenario or requirement is described in `USE_CASES.md`, and nothing in its "next" list is already built. | `check-done` G11 |
| **DoD-8** | Every decision in `DESIGN.md` is cited by at least one downstream document. An uncited decision is either dead or undocumented in practice. | `check-done` G10 |
| **DoD-9** | A reversed decision is struck through and replaced, never deleted. The reasoning behind a wrong turn is kept. | By hand, at review |

### C. Tests

| Gate | Requirement | How it's judged |
|---|---|---|
| **DoD-10** | Every automatable scenario has a test of the same name. | `traceability.test.mjs` |
| **DoD-11** | Every test has a scenario. A test with no scenario is behaviour nobody agreed to. | `traceability.test.mjs` |
| **DoD-12** | The whole suite, the apps' and the assets', passes against the modules the apps import. Nothing is generated for the tests, so nothing can lag its source (`D-032`, replaced by `D-096`). | `check-done` G0, G1 |
| **DoD-13** | A new feature ships with a new mutant in `tools/mutate.mjs`. | By hand, at review |
| **DoD-14** | No mutant survives, and none is stale. | `check-done` G2, G3 |
| **DoD-15** | A bug fix ships with a test that fails against the old code. | By hand, at review |
| **DoD-16** | Anything that varies — key, scale, seed, naming system — is varied in at least one test. Testing one value of a variable is how `D-025` hid for two sessions. | By hand, at review |

### D. Code

| Gate | Requirement | How it's judged |
|---|---|---|
| **DoD-17** | The asset modules stay pure: no React, Tone, DOM, dates, or ambient randomness. | `check-done` G7, and C3 per module |
| **DoD-18** | The asset modules load standalone, and nothing an asset exports is defined a second time in an app (`D-096`). | `check-done` G6 and G0 |
| **DoD-18c** | A change to a core module updates, in the same pass, its requirement in `core/REQUIREMENTS.md` (with a source), its test (named by the requirement), and its section in `core/MODULES.md`. Core never imports a product; the layers in the header and the document are the imports. | `check-done` C1–C4 |
| **DoD-18b** | No hook depends on a value defined later in the file. The app renders nothing at all when this is wrong, and no behavioural test here can see it (`D-063`). | `check-done` G12 |
| **DoD-19** | No colour literals in components; every colour comes from a role-named token. | `check-done` G8 |
| **DoD-20** | A new visual role is added to the token set before it is used. | By hand, at review |

### E. Manual verification

Run the `@manual` scenarios that the change touches, on a real phone. Always run these three regardless of what changed, because they are the ones that silently degrade:

| Gate | Scenario | Why always |
|---|---|---|
| **DoD-21** | Legibility on a phone | Every visual change risks the two-channel system |
| **DoD-22** | Silencing a stuck note | Every audio change risks stuck voices (`D-017`) |
| **DoD-23** | Reading a chord off the screen to play it on my own instrument | This is `UC-00`. If it breaks, nothing else matters |

Before a play test, work through `PLAYTEST.md` instead: the same scenarios, ordered so anything badly wrong appears in the first five minutes.

### F. Judgement

The gates a machine cannot reach. Ask them out loud before calling something done.

| Gate | Question |
|---|---|
| **DoD-24** | Does this make `UC-00` better, or only more featureful? |
| **DoD-25** | Would a beginner understand the explanation without asking what a word means? |
| **DoD-26** | Does it sound good, or merely correct? Correct notes in a bad rhythm are a failure. |
| **DoD-27** | What did I *not* test that I could have? Write it down even if you don't fix it. |
| **DoD-28** | If a complaint has come back a second time, is the fix reaching the cause or the symptom? Stuck sound was patched twice (`D-017`, `D-030`) before the real defect was found in a layer no test could reach (`D-031`). A repeat complaint means the layer is wrong, not the value. |

---

## Metrics and thresholds

Measured by `node tools/check-done.mjs`. A threshold is a floor, not a target to sit on.

| Metric | Threshold | Current | Gate |
|---|---|---|---|
| Assets defined once, apps import them | always | 171 exports in 22 modules, none redefined | G0 |
| Asset requirements with a test, and tests with a requirement | 100% | 202/202 | C1 |
| Module interfaces documented, nothing documented missing | 100% | 158 exports | C2 |
| Architecture: acyclic, layered, pure, core independent | holds | 22 modules, 5 layers | C3 |
| Core requirements traced to a source that exists; core decisions used | 100% | 14 decisions | C4 |
| Automated checks passing | 100% | 661/661 | G1 |
| Use cases described where referenced | 100% | all, enforced | G11 |
| Mutation score | ≥ 90% | 223/223 (100%) | G2 |
| Stale mutants | 0 | 0 | G3 |
| Requirements with a real scenario | 100% | 405/405 | G4 |
| Requirements traced to a decision or use case | 100% | 405/405 | G5 |
| Every requirement row readable by the gates | 100% | enforced | G14 |
| Manual share of scenarios | < 40% | about 20% | traceability |
| Impure references in the theory layer | 0 | 0 | G7 |
| Stray colour literals | 0 | 0, allow-list empty | G8 |
| Decisions never cited downstream | 0 | 0 (70 headed, 92 in all) | G10 |
| Decisions cited but never written | 0 | 0, enforced by G13 |
| Hooks naming later definitions | 0 | 0 (16 callbacks) | G12 |

**On the mutation threshold.** 90% not 100%, because a survivor sometimes means the code is *equivalent* rather than the test weak. But every survivor is examined: write the test, or delete the mutant and say why.

**On the manual share.** It creeps up, because writing a manual scenario is easier than automating one. Near 40%, ask which of them are actually automatable — usually several.

---

## Scaling the gates to the change

Not every change needs every gate. What it never gets is a pass on the *whole* category.

| Change | Requirements | Docs | Tests | Metrics | Manual |
|---|---|---|---|---|---|
| **New feature** | New requirements | Decision + use case + change log | Scenarios, tests, a new mutant | Full run | Its own + the three standing |
| **Bug fix** | Amend the requirement it violated, or add the one that was missing | Change log; a decision if the cause was structural | A test that fails against the old code | Full run | The affected scenario |
| **Refactor** | None | Change log | No new tests; the suite must pass unchanged | Full run — a refactor that changes the mutation score changed behaviour; where it moves code, the scripted run of both apps is compared before and after (`tools/smoke.mjs`) | The three standing |
| **Change to a core asset** | Its row in `core/REQUIREMENTS.md`, with a source | `core/MODULES.md` section; a `CD-nnn` if the cause was structural; change log | A test named by the requirement; a mutant | Full run, including C1–C4 | The affected scenario in each product that uses it |
| **Copy or wording** | None | Change log | Update any assertion that quotes the text | G1 only | Read it on a phone |
| **Documents only** | As applicable | Change log | None | G4, G5, G9, G10 | None |

The refactor row matters most: **if the mutation score moves, it wasn't a refactor.**

---

## Exceptions

A gate may be skipped. It may not be skipped silently.

Record it in the table below with a date, the gate, the reason, and what would have to be true to close it. An exception with no closing condition is a decision, and belongs in `DESIGN.md` as one.

| Date | Gate | What was skipped | Why | Closes when |
|---|---|---|---|---|
| 2026-09-05 | DoD-3 | `R-004` (offline operation) names no scenario | Nothing is deployed yet, so there is nothing to test | Closed 2026-09-25: packaged (`D-076`); verified by a manual scenario on the devices, backed by automated checks of the service worker |
| 2026-09-05 | DoD-3 | ~~`R-097` explanation length verified by eye~~ **Closed 2026-09-06.** Measured, found broken in two thirds of cases, copy rewritten, now asserted (`D-051`) | — | Closed |
| 2026-09-05 | DoD-19 | ~~`R-120` rests on review~~ **Closed same day.** `check-done` G8 now enforces it with an empty allow-list | — | Closed |
| 2026-09-05 | DoD-19 | ~~`R-132` (no ambient randomness) rests on review~~ **Closed:** `check-done` G7 already rejects `Math.random` in the theory layer | — | Closed |
| 2026-09-05 | DoD-19 | `R-121` (a visual role is added to the token set before it is used) rests on review | Lintable, but the check would need to read the component layer | A static check reads the fill roles and confirms each has a treatment |
| 2026-09-23 | DoD-22 (the shell) | The Learn tab's shell behaviour was checked headless (21 checks in Chromium) but that run is not yet a gate, so a shell regression would not fail the build. *2026-10-07:* the J-6 page has been checked the same way at every change, and that run, not the suite, caught a crash on load (`D-093`) and 87 keys too wide for a phone (`D-089`). The case for making it a gate grows | It needs esbuild, React, Tone and Playwright, which the project does not install | The headless run is added to `tools/` and `check-done` as a gate |
| 2026-10-07 | DoD-3 (headless checks) | `tools/startup-check.mjs`, like `tools/smoke.mjs`, needs a browser the project does not install, so neither is a gate | The suite cannot hear or time a real device; both are run by hand when audio or screens change | The project installs a browser in CI, or the manual gates cover it on every change |
| 2026-09-05 | DoD-13 | No mutants for the mute toggle, key colours, note durations, instrument presets or the piano's scroll and hold | The mutator operates on the theory layer; those changes live in the audio and view layers, which it cannot reach | Either the mutator is extended to the view layer, or these stay covered by manual scenarios only |

---

## What "done" does not mean

- **Not "shipped".** Deployment is a separate step: `npm run site` builds it, and a push to `main` publishes it through GitHub Actions (README). Its checks are the site tests and Part −1 of `PLAYTEST.md`.
- **Not "finished".** `UC-29` is done and still has no swing, no editing, no saving. Done means *this change is complete and honest*.
- **Not "bug-free".** `D-025` passed every gate that existed at the time. Gates catch the failures you have already learned to look for — which is why `DoD-27` asks what you didn't test, and why the audit that found `D-025` is worth repeating every few features.
