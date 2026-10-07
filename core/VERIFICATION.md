# Core verification

How the core asset base is shown to do what its requirements say, at each level, and what is not shown. The same discipline as the product's (`DONE.md`), applied to each module on its own.

## Levels

| Level | Question | How | Where |
|---|---|---|---|
| **Unit** | Does each module do what its requirement says? | One test per requirement, named by its id, importing the module and nothing above it; oracles computed independently (e.g. every chord × every root, every key × every mode) rather than copied from the code | `core/tests/<module>.test.mjs` |
| **Contract** | Does every exported function keep the promises all assets make? | A table of sample calls for every exported function; each is called with deep-frozen arguments (a write throws), twice (same answer), and the answer must be plain data | `core/tests/architecture.test.mjs` (`CR-ARCH-10`–`12`) |
| **Architecture** | Do the modules relate as the design says? | No cycles, layers match headers and documents, core imports no product, every module pure and used | `tools/core-check.mjs` (C3), `CR-ARCH-01`–`05` |
| **Interface** | Is every interface written down, and only what is real? | Exports compared with each document's interface table | C2, `CR-ARCH-06` |
| **Traceability** | Does every requirement have a test and a source, and every test a requirement? | Ids compared across the requirements file, the tests and the decisions | C1, C4, `CR-ARCH-07`–`08` |
| **The checks themselves** | Would the checks notice a breach? | Each architecture and traceability check is run on a copy of the repository with a fault planted, and must fail | `core/tests/architecture.test.mjs` |
| **Mutation** | Would the tests notice a change in the module? | `tools/mutate.mjs` changes a line of a module and expects some test to fail; every mutant must be killed | `tools/mutate.mjs`, gate G7 |
| **Product regression** | Do the apps still behave as before? | The product's own tests, a scripted headless run of both apps producing a screen transcript compared before and after a change, and size of the builds | `tests/`, `tools/smoke.mjs`, `tools/check-done.mjs` |

## What each requirement's test looks like

The tests are written from the requirement, not from the code. Three habits recur:

- **An oracle.** `identifyChord` is tested by building every dictionary chord on every root and asking for its name back; `keyNames` by checking every one of the 24 keys against the rule for its letters; `fingerChord` against the table of every scale.
- **A property over the whole domain.** `pc` over a thousand integers; `barsToSchedule` over a long run of ticks, asserting every bar appears once and in order; `place` over every note and every pitch class.
- **A boundary named.** The limits in `DESIGN.md` CD-007 are asserted *as limits*, so lifting one is a change to a requirement and not a surprise.

## What is not shown

- **Sound.** No test hears anything. The assets produce numbers; whether the piano sounds like a piano is for the ear, and is on the product's manual checklist (`PLAYTEST.md`).
- **That a suggestion is musically good.** `suggestNextChords` is shown to rank by the rules it states, not to be what a musician would choose.
- **Fingering is suggested, never checked** against a hand. The scale table was checked against published sources on 2026-10-01 (`core/fingering.mjs`).
- **Real devices.** The J-6 behaviour that depends on the hardware is the J-6 Explorer's (`j6/`), not an asset's.
- **Layout.** `diagramKeys` is shown to put keys where the arithmetic says; how a sheet looks printed is a manual check.

## Running it

```
node --test core/tests/*.test.mjs       unit, contract and architecture
node tools/core-check.mjs               C1–C4
node tools/mutate.mjs                   mutation, all modules
node tools/check-done.mjs               every gate, assets included
```

## Counts

Kept honest by the gates rather than by this paragraph: `node tools/core-check.mjs` prints the number of requirements, tests, exports and modules, and `node tools/mutate.mjs` the number of mutants killed.
