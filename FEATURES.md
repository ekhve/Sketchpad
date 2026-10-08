# Sketchpad — Feature Status

**Updated:** 2026-10-07 · **Version:** working build, packaged as an installable site

Tracked against the original development order. Status is one of:

- **Done** — built, specified in `sketchpad.feature`, and covered by tests or a manual scenario
- **Partial** — usable, but something named in the original spec is missing
- **Open** — not built
- **Declined** — deliberately not planned, with a reason

---

## MVP — 10 of 10 done

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Song key selector | **Done** | 12 roots × major/minor, verified in all 24 keys |
| 2 | Interactive piano | **Done** | Four scrollable octaves; press and hold to sustain |
| 3 | Piano audio | **Done** | Built-in recorded grand piano plus four synths, echo, four reverb spaces, chord roll |
| 4 | Chord palette | **Done** | Triads, 7ths, 9ths |
| 5 | Chord playback | **Done** | Plays in the chosen voicing |
| 6 | Scale palette | **Done** | Ten scales |
| 7 | Scale visualisation | **Done** | Marker channel, separate from harmony |
| 8 | Scale playback | **Done** | Up, down, shuffled |
| 9 | Scale mood / style descriptions | **Done** | Mood plus style tags |
| 10 | Simple progression builder | **Done** | Up to 8 slots |
| 10b | Type chord names | **Done** | "Am7 F#m7 Dm7 G7sus4" in any common chart spelling, checked before it joins the loop, with the keys it fits (`D-077`) |

## Version 1.5 — 6 done, 1 partial

| # | Feature | Status | Notes |
|---|---|---|---|
| 11 | Progression playback | **Done** | Own scheduler; loop, tempo 60–140 |
| 12 | Chord voicings | **Done** | Close, open, spread, rootless, shell |
| 13 | 7th and extended chords | **Done** | Palette to 9ths; dictionary to 13ths with signature voicings. Only the in-key palette stops at 9ths |
| — | Arpeggio playback | **Done** | Up, down and round-trip on any chord or chosen set |
| 14 | Genre / style presets | **Done** | Styles drive riffs and basslines, and lead the Scales tab with suited scales and chord colours |
| 15 | Chord-set palettes | **Done** | Fourteen sets, eight chords plus a ready-made progression each |
| 16 | Bass root suggestions | **Done** | Ranked root → fifth → third → seventh → passing |
| 17 | Bass transition suggestions | **Done** | Direct, scale walk, fifth approach, chromatic |

## Version 2 — 8 of 8 done

| # | Feature | Status | Notes |
|---|---|---|---|
| 18 | Chord / scale compatibility | **Done** | Names the foreign note and offers the scale it belongs to, one tap |
| 19 | Find scales from progression | **Done** | Ranked, naming what each misses |
| 20 | Harmonisation lessons | **Done** | Step through building any chord from the scale, lit on the piano |
| 21 | Chord-construction lessons | **Done** | 15 qualities with formulas, playable on any root |
| 22 | Bass theory | **Done** | The paragraph, plus ranked options under the current chord |
| 23 | Voice leading | **Done** | Held notes and moving notes named for every pair in the loop |
| 24 | Inversions | **Done** | Playable, with what each changes |
| 25 | Advanced progression suggestions | **Done** | "What could come next", ranked by how harmony behaves |

## From the Chord! comparison

Their priority list, and where we stand on it.

| Their # | Feature | Status | Notes |
|---|---|---|---|
| 7 | Reverse chord finder | **Done** | Own Find tab. Every reading ranked, inversions named with a slash bass |
| 8 | Harmonise scale → chords | **Done** | And now from the *selected* scale, which was a bug |
| 10 | Arpeggio playback | **Done** | Together, up, down |
| 11 | Voicings and inversions | **Done** | Five arrangements plus four inversions |
| 12 | Progression → find scales | **Done** | Ranked, naming what each misses |
| — | Smoothest next voicing | **Done** | Chosen by measured movement, not described |
| 13 | Favorites, history, collections | **Open** | Agreed valuable. Needs persistence, which needs deployment first |
| 16 | Custom chords and scales | **Done** | Save a selection as a chord or scale; a seven-note scale harmonises into its own chords. Session-only until deployment |
| — | Separate chord detail screen | **Declined** | We have all its content already; a separate screen fights the pinned-piano layout |
| — | Star ratings on scale fit | **Declined** | "Misses A#" says more than three stars out of five |
| — | Find possible keys as its own tool | **Merged** | Part of the Find tab rather than a third button answering the second question |
| — | Songbook, lyrics, tunings, PDF export | **Declined** | Guitar-shaped; not our product |

## Version 3 — 0 of 7

| # | Feature | Status | Notes |
|---|---|---|---|
| 26 | MIDI input | **Declined** | No Web MIDI on iOS Safari, the target device. Building it means desktop-only |
| 27 | MIDI export | **Open** | The data is already the right shape. Worth reconsidering after real use |
| 28 | Bassline sequencer | **Open** | Figures generate but cannot be edited note by note |
| 29 | Advanced chord-set library | **Partial** | Fourteen sets, two of them built from extended voicings. Still far short of the J-6 hundred; content, not code |
| 30 | Smart style transformations | **Open** | "More soulful", "darker". Needs a chord-substitution engine |
| 31 | Ear training | **Declined** | Naming what you hear without seeing it is still out; practising on the piano is now in — see Learn below (`D-073`) |
| 32 | AI-assisted suggestions | **Open** | The rule-based suggestions may make this unnecessary; judge after use |

---

## From the second comparison

| Their # | Feature | Status |
|---|---|---|
| 1 | Next-chord suggestions | **Done** |
| 2 | Chord-aware melody notes | **Done** — the melody guide |
| 3 | Reverse piano identification | **Done** |
| 4 | Chord colouring / "make it richer" | **Partial** — voicings and the dictionary do most of it |
| 5 | Automatic smooth voicings | **Done** |
| 6 | Mood-led exploration | **Done** — style leads the Scales tab |
| 7 | Chord to compatible scales | **Done** |
| 8 | Progression to compatible scales | **Done** |
| 9 | Bass-aware chord exploration | **Open** — choose a bass note first, see what fits above |
| 10 | Bass transition assistant | **Done** |
| 11 | Chord performance modes | **Done** — block, roll, slow roll and arpeggios |
| 12-13 | Scale lock, one-finger chords | **Open** |
| 14 | A/B progression variations | **Open** |
| 15 | Rhythm / comping layer | **Partial** — patterns exist, no comping styles |
| 16 | Circle of fifths view | **Declined** — the piano is the identity |
| 17 | Borrowed-chord explorer | **Done** — the adventurousness slider |
| 18 | Modulation assistant | **Open** |
| 19-20 | MIDI and audio import | **Open** / **Declined for now** |
| 21 | Instant transpose | **Partial** — changing key rebuilds, but does not move an existing loop |
| 22-23 | MIDI export, separate parts | **Open** — the largest remaining gap |
| 24 | Custom chord/scale library | **Done** |
| 25-26 | Ear training / learn from your own progression | **Declined** / **Done** |
| 27 | "What changed?" comparison | **Done** |
| 28 | Tension slider | **Done** |

## Taking it away from the device

| Feature | Status | Notes |
|---|---|---|
| Printable sheet | **Done** | Chord diagrams, scale and bass. Print, save as PDF, or copy as text |
| Explanations on the sheet | **Open** | Deliberately left off the prototype; decide after using the plain one |
| MIDI export | **Open** | The other direction: into a DAW rather than away from screens |

## Learn — practising on the piano (`D-072`, `D-073`)

| Feature | Status | Notes |
|---|---|---|
| Mini lessons | **Done** | Ten, in teaching order: home note, major and minor scales, pentatonic, first chord, major to minor, the three main chords, the four-chord loop, inversions, sevenths |
| Every note judged | **Done** | Chords in any order and octave; scales in order and direction; inversions by their bottom note. A slip is named with the right note and never resets |
| Show me, hint | **Done** | Show me plays and lights the answer; Hint first says how to find the next note, then lights it |
| Feedback that teaches how to think | **Done** | A wrong note is explained in keys you can count: a skipped step, a scale note the chord skips, one key off. Every step ends on a take-away rule that works in any key; triads name their white/black shape (`D-075`) |
| Any key, next key | **Done** | Lessons follow the key at the top; "again in G" steps round the circle of fifths |
| Lesson to loop | **Done** | A lesson that ends on a progression puts it in the loop in one tap |
| Progress kept | **Partial** | Ticked for the session only; saving arrives with the sketchbook |
| Flats in lessons | **Done** | Every key spells its notes the way it is written, lessons included (`D-074`) |
| Circle of fifths as a view | **Open** | Used for "next key"; not yet drawn |

## Three modes (`D-072`)

| Mode | Status | Notes |
|---|---|---|
| Learn | **Partial** | First slice above |
| Explore | **Open** | One chord with every dial around it; the dials exist but are scattered |
| Create | **Partial** | Everything but saving; a sketch code on the printed sheet is next |

## Meeting the app

| Feature | Status | Notes |
|---|---|---|
| Levels: Start / Produce / Study | **Done** | Start is four tabs; each level only adds |
| "How to use" tab | **Done** | Available at every level |

## Finger numbers (`D-078`)

| Feature | Status | Notes |
|---|---|---|
| Finger numbers on lit keys | **Done** | Right hand, left hand or both; 1 the thumb to 5 the little finger. Solid discs for the right hand, outlined purple for the left |
| Chord fingering | **Done** | By rule, matching the standard fingering for every triad and inversion; sevenths 1-2-3-5 |
| Chords that need two hands | **Done** | Split by hand reach (7th, octave, 9th, 10th), with a bracket over each hand's keys; "too wide to play as written" when even two hands can't |
| Both hands | **Done** | Left hand on the bass, right hand on the chord |
| Scale fingering | **Done** | 12 major and 12 natural minor scales, one octave, both hands, from a table checked against published sources; thumb crossings marked |
| In Learn | **Done** | On by itself; the lesson says the fingering in words, including where the thumb tucks under |
| On the printed sheet | **Done** | Optional, off by default |
| Checking which finger you used | **Declined** | The app can't see your hands; fingering is suggested, never checked |
| Riffs, melodies, two-octave scales, harmonic minor | **Open** | Not yet |

## Installing and sharing (`D-076`)

| Feature | Status | Notes |
|---|---|---|
| Home-screen app on iPhone and iPad | **Done** | Add to Home Screen from Safari; opens full screen with its own icon |
| Works offline | **Done** | Everything is cached once opened; checked in a simulated browser and headless Chromium, not yet on a device |
| Updates itself | **Done** | Upload a new version and it replaces the old one the next time it opens |
| Share by link | **Done** | Anyone with the link can install it; no account |
| Sound with the silent switch on | **Done** | iOS 16.4 and later |

## Learning the app

| Feature | Status | Notes |
|---|---|---|
| "How to use" tab | **Done** | Nine sections: where to start, reading the piano, sound controls, one per tab |
| Play-test script | **Done** | `PLAYTEST.md` — the manual scenarios ordered for a real session |

## Built, but never asked for

Not in the original plan. Each earned its place.

| Feature | Why it exists |
|---|---|
| Two visual channels on the piano | Chord and scale kept hiding each other |
| Explanations attached to every action | The core promise, made concrete |
| Do-Re-Mi naming | Requested during build; note names are now a pluggable layer |
| Seeded generation | Every riff is reproducible, so it can be tested and later saved |
| Audio self-reporting and a test note | The one layer that cannot be unit tested says what it is doing |
| Voice budget with a live counter | The app went silent after 30 notes; now it drops a note instead |
| Test and gate infrastructure | Two bugs reached the product with nothing checking |

---

## J-6 Explorer — a second app (`D-079`–`D-087`)

| Feature | Status | Notes |
|---|---|---|
| Explore: play along on the piano | **Done** | Three scales offered for the key; the piano holds still under the loop (`D-092`) |
| Explore: take the progression away as a sheet | **Done** | Sketchpad's sheet, suggested fingering, J-6 keys, print or copy (`D-091`) |
| The key a set plays in, on the panel and the pads | **Done** | Follows KEY; I, IV, V, vi marked; Find's steps from the manual (`D-094`) |
| A misprinted key named from its notes | **Done** | 54 of the 56 named (`D-093`) |
| Explore: play the progression at a tempo | **Done** | 60–160 BPM, ½/1/2 bars a chord, Loop, click with count-in; not a sequencer (`D-090`) |
| Explore: try chords, keep the ones you want | **Done** | A tap plays; + Add keeps; Rec keeps every tap; kept chords remember their set and KEY (`D-089`) |
| Explore: what the J-6 is playing | **Done** | Virtual J-6 with every pad's chord, played order, chord, numeral, notes, voicing, piano, likely key, progression (`UC-64`) |
| Find: how to play a progression on the J-6 | **Done** | Exact or musical matching, KEY transpose, keys to press, other sets with reasons (`UC-65`) |
| Data validated before use | **Done** | A set whose printed voicings contradict their labels is flagged and never recommended (`D-082`) |
| Key-aware spelling | **Done** | Sketchpad's theory: F#m7 in D major, B♭maj7 in F (`D-086`) |
| Installable at `j6/` | **Done** | Its own icon, name and offline cache (`D-087`) |
| All 100 chord sets | **Done** | Imported from the manual's page, 558 label spellings read, 56 failing keys listed and pinned (`D-088`, `D-082`) |
| KEY range, direction and high C checked on a J-6 | **Open** | Manual scenarios; assumptions shown on the page until then |

## Reusable assets (`D-096`)

| Feature | Status | Notes |
|---|---|---|
| The theory as modules in `core/`, one capability each | **Done** | 18 modules; 3 more in `sketchpad/` that are Sketchpad's alone; both apps import them |
| Requirements, design, interface and verification per module | **Done** | `core/README.md`, `DESIGN.md`, `REQUIREMENTS.md`, `MODULES.md`, `VERIFICATION.md`; one test per requirement |
| The checks that hold the architecture | **Done** | `tools/core-check.mjs`, gates C1–C4; each shown to catch a planted fault |
| A shared transport (progression and loop) for both apps | **Open** | The J-6's is the cleaner; `core/DESIGN.md` §6 |
| One function for naming notes as chords | **Open** | `identifyChord` and the J-6's `nameFromNotes` answer one question twice |
| Events to a MIDI file | **Open** | Events are already instrument-free (`CD-003`); a pure function away |
| Names for the flat 9, sharp 9 and sharp 11 | **Done** | A formula reads 1 – 3 – 5 – ♭7 – ♭9, not 13 (`CD-007` limit closed) |

## Tidying the screen (`D-105`)

| Feature | Status | Notes |
|---|---|---|
| Sound options folded into one section (sound, how a chord is played, reverb, echo) | **Done** | Shut at first; sound, silence, test sound and reset audio removed (`D-106`) |
| Engine text removed | **Done** | The status line and voice count are gone; the licence credit stays inside the options |
| Fingers and octave above the piano, legend under it | **Done** | `D-106` |
| Rolling a chord and playing a scale as one arpeggiator | **Open** | Together/roll/slow roll and up/down/mix are the same idea (`D-105`, noted) |
| The rest of the screen tidied | **Open** | Next: chosen with the owner |

## Known gaps and rough edges

| Gap | Impact | Plan |
|---|---|---|
| Not yet used in a real session | The site is packaged and works offline in a browser, but has not been installed on the phone yet (`D-076`) | Upload it and play |
| No persistence | A loop survives a reload but not a week | After deployment |
| No favorites or collections | Nothing accumulates between sessions | Needs persistence, so after deployment |
| Saved material is session-only | Nothing survives a reload | Real persistence with deployment |
| Figures cannot be edited | Take it or regenerate it | Needs a step editor |
| No swing | Most target genres swing | Judge by ear first |

---

## How to check this document

Anything marked **Done** should be findable in `sketchpad.feature` and, unless it is `@manual`, asserted in `tests/theory.test.mjs`. Run:

```bash
node tools/check-done.mjs
```

Current: 455 automated checks, 209/209 mutants killed, 15/15 gates.

If a feature is listed **Done** here but has no scenario, this document is wrong — trust the feature file.
