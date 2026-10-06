# Sketchpad — Use Cases

**How this fits together.** These describe *intent*. `sketchpad.feature` turns intent into Given/When/Then scenarios, tagged `@auto` where a machine can check them and `@manual` where only a person with a phone can. `tests/theory.test.mjs` asserts the `@auto` ones. `REQUIREMENTS.md` holds the numbered statements and the traceability. When a use case changes, its scenarios change in the same pass.

**Actors.** *Producer* — makes beats, beginner on piano, phone in one hand. *Producer (advanced)* — the same person later, wanting sevenths, extensions and roman numerals; served by Producer mode (`D-012`). *Content author* — us, adding scales, patterns and chord sets as data (`D-014`).

---

## UC-00 — The main scenario

**This is the use case the product exists for.** Every other one is a component of it. A change that makes UC-00 worse is wrong, however good it looks alone.

In the user's own framing:

> I select a key. I get chord options and the scales that relate to it. I press a chord — say C minor — and I see it on the piano and hear it. It stays selected, so I can play it on my synth. Then I press another and add it to the progression. I collect them into a set. Then I want to see which scales fit what I've built, so the piano lights the notes I can play over it. It can also suggest a riff or a bassline in a style. And then I can get the theory — why these things work together.

| Step | The user does | The system does | Covered by |
|---|---|---|---|
| 1 | Selects a key | Rebuilds chords, scales and piano lighting | UC-01 |
| 2 | Sees chords and scales | Presents both without making them compete | UC-05, UC-08 |
| 3 | Presses a chord | Lights its voicing, sounds it, **keeps it selected** | UC-06 |
| 4 | Plays it on their own instrument, reading it off the piano | Nothing — the selection must survive the pause | UC-06 |
| 5 | Adds chords to a progression | New chord lights; earlier ones stay visible in the loop | UC-11 |
| 6 | Loops it | Plays in time, piano following | UC-12 |
| 7 | Asks which scales fit | Ranks scales against the notes actually used | UC-21 |
| 8 | Selects a scale | Piano lights the playable palette over the loop | UC-09 |
| 9 | Asks for a riff or bassline in a style | Suggests a figure that fits the loop | UC-29 |
| 10 | Reads why it works | Explains in plain language | UC-14 |

**Constraints this imposes.** A selected chord stays lit indefinitely, because in step 4 the user is looking away at their own keyboard. Chord and scale lighting must be legible *at the same time* (`D-016`). Adding a chord must never interrupt sound. "Which scales fit" is one tap.

**Status:** every step runs end to end.

---

## Three main scenarios, one per mode (`D-072`)

`UC-00` above is one of three. The app serves three intents — explore, learn, create — and each has its own main scenario. They share every feature; they differ in what comes first and what the piano is for.

| Mode | Main scenario | The piano is | Status |
|---|---|---|---|
| Create | `UC-00` — build a loop, understand it, take it away | a readout to copy from | Built end to end; saving still missing (`UC-33`) |
| Learn | `UC-61` — pick a lesson, play it, be told what was right | a teacher's hand | First slice built: `UC-58`, `UC-59` |
| Explore | `UC-60` — one chord, every dial on it | an instrument | Not built as a place; the dials exist but are scattered |

**The rule across all three:** anything you hear goes to the sketchbook in one tap.

### UC-63 — See which finger plays each key

| Step | The player | The app |
|---|---|---|
| 1 | Turns on **Fingers: right**, **left** or **both** (on by itself in Learn) | Each lit key shows a finger number, 1 = thumb to 5 = little finger; solid discs for the right hand, outlined purple ones for the left |
| 2 | Taps a chord, an inversion or a voicing | The numbers follow the notes; an inversion changes them |
| 3 | Picks a chord too wide for their hand | Both hands appear on their own, with brackets over the keys each one takes, and it says "split between hands" |
| 3b | Chooses **both** to play along with a loop | Left hand on the bass note, right hand on the chord |
| 4 | Opens a scale lesson in Learn | The scale is numbered, and the step says where the thumb tucks under |
| 5 | Plays it | The notes are judged as before; the fingers are not, because the app can't see them |
| 6 | Prints the sheet with **Show suggested fingering** ticked | Each bar's diagram carries the numbers: right hand on the chord, left hand on the bass |

### UC-61 — Learn: practise music on the piano

In the user's framing:

> I'd like some assistance learning chords and scales, and practising. Different mini lessons, where I then practise the lesson on the piano.

| Step | The user does | The system does | Covered by |
|---|---|---|---|
| 1 | Opens Learn | Lists short lessons in teaching order, in the current key | UC-58 |
| 2 | Picks one | Shows one line of intro and the first thing to play | UC-58 |
| 3 | Plays it on the piano | Answers every note: right; wrong, with why in keys you can count (skipped a step, a scale note the chord skips, one key off); or wrong direction | UC-58 |
| 4 | Gets stuck | "Hint" first says how to find the next note, then "Show the note" lights it; "Show me" plays and lights the whole answer | UC-58 |
| 5 | Finishes a step | Says why it matters, only now that it has been heard, plus a take-away rule for any key and, for a triad, its white/black shape | UC-58 |
| 6 | Finishes the lesson | Counts the slips; offers the same lesson one step round the circle of fifths | UC-58 |
| 7 | Likes the progression it ended on | Puts it in the loop in one tap | UC-59 |

**Constraints.** A slip never resets the attempt. The piano shows only the lesson while one is open. Every lesson works in all twelve keys.

**Status:** steps 1–7 built (`D-073`). Not yet: lessons that remember progress across sessions (needs `UC-33`), lessons about rhythm, and lessons written for minor keys as their home.

---

## J-6 Explorer — a second app (`D-079`–`D-085`)

A separate page for the Roland J-6 chord synthesizer, in the same repository and sharing Sketchpad's theory. It answers two questions the hardware can't: *what am I playing?* and *how do I play this on the J-6?*

### UC-64 — J-6 Explore: what am I playing?

| Step | The player | The app |
|---|---|---|
| 1 | Picks the chord set they have on the J-6 | A virtual J-6 shows what every key plays, printed on the pad |
| 2 | Taps the keys in the order they played them on the hardware | Each pad is numbered in order; the latest one is brightest |
| 3 | Reads the latest chord | Name in musician spelling, the manual's label, notes and degrees, the J-6's actual voicing, and its numeral |
| 4 | Looks at the piano | The real voicing, lit in its real octave |
| 5 | Looks at the key | The likely key, how many chords fit it, and the runner-up |
| 6 | Plays the progression back | Undo, Clear and Play, through the piano or a pad sound |

**Status:** built (`D-087`), at `j6/` on the site, with a KEY control and the J-6's 4 transcribed sets. Not yet: the other 96 sets (`D-082`), and reading the hardware over MIDI.

### UC-65 — J-6 Find: how do I play this on the J-6?

| Step | The player | The app |
|---|---|---|
| 1 | Types a progression, e.g. Dm7 G7 Cmaj7 Am7 | Each chord is read and confirmed, or refused with a reason |
| 2 | Chooses exact or musical matching, and whether KEY may transpose | The sets are ranked, never including one whose data fails validation (`D-082`) |
| 3 | Reads the best match | Set, KEY value, score, and the keys to press, numbered in order; keys that play the same chord are dashed |
| 4 | Follows the steps on the hardware | Select the set, set KEY, play the keys |
| 5 | Compares other sets | Each with its score and the reason it ranks lower |

**Status:** built (`D-087`), at `j6/` on the site. It ranks over the 3 transcribed sets that pass validation; set 59 is left out and the page says why.

---

## Built

Each has scenarios in `sketchpad.feature`.

| ID | Use case | Notes |
|---|---|---|
| UC-01 | Select the key of the track | 12 roots × major/minor, verified in all 24 |
| UC-02 | Play a single note and see where it sits | Explanation names its relationship to the key |
| UC-03 | Start audio on a mobile device | First gesture starts it; a banner offers to resume if the browser pauses it |
| UC-04 | Shift the visible octave range | Two octaves on a phone |
| UC-05 | See the chords available in the key | Seven diatonic chords, correct in every key |
| UC-06 | Play a chord and see its voicing | Lights the actual notes, not every octave (`D-033`) |
| UC-07 | Switch between triads, sevenths and ninths | Ninths stacked, not folded (`D-035`) |
| UC-08 | Compare scales by feel | Ten scales with mood and style tags |
| UC-09 | Select a scale and see it | Names the single note that changed, where there is one |
| UC-10 | Hear a scale played | Up, down, or shuffled |
| UC-11 | Build a progression | Up to 8 slots; adding also selects (`D-039`) |
| UC-12 | Play the loop with the piano following | One bar per chord, tempo 60–140 |
| UC-14 | Understand what just happened | Never empty; two sentences in beginner mode |
| UC-16 | Choose a genre chord set | Six sets, eight chords plus a ready-made progression |
| UC-19 | See bass options under a chord | Ranked root → fifth → third → seventh → passing |
| UC-20 | Get from one chord to the next in the bass | Direct, scale walk, fifth approach, chromatic |
| UC-21 | Find the scales that fit a progression | Ranked, naming what each one misses |
| UC-22 | See where the chords come from | Harmonisation explained on the user's own scale |
| UC-23 | Look up any chord quality on any root | 15-entry dictionary with formulas |
| UC-24 | Hear inversions | Same notes, different weight |
| UC-28 | Silence everything | Stops sound without destroying work (`D-017`) |
| UC-29 | Suggest a riff or bassline in a style | Ten patterns across six styles, seeded (`D-023`) |
| UC-30 | Choose how notes are named | Letters or fixed-do, spelled the way the key writes them: E♭ in C minor, F# in G (`D-019`, `D-074`) |
| UC-32 | A voice worth listening to | Four instruments and a switchable echo (`D-040`, `D-041`) |
| UC-35 | Choose a voicing | Close, open, spread, rootless, shell (`D-042`) |
| UC-37 | Learn where a borrowed chord comes from | Names the scale it belongs to, one tap (`D-044`) |
| UC-38 | Watch a chord being built from the scale | Step by step, lit on the piano (`D-044`) |
| UC-39 | See what holds and what moves between chords | Voice leading, measured (`D-044`) |
| UC-40 | Ask what could come next | Ranked by how harmony behaves (`D-044`) |
| UC-41 | Play the piano directly | Four scrollable octaves; hold to sustain; eight fingers at once; slide across keys (`D-045`, `D-052`, `D-053`) |
| UC-42 | Find out what I just played | Reverse search in its own tab, every reading ranked (`D-047`) |
| UC-43 | Hear a chord as an arpeggio | Together, up, down (`D-047`) |
| UC-44 | Get the smoothest way to play the next chord | Chosen by measured movement (`D-047`) |
| UC-45 | Save chords and scales of my own | Voicing kept as played; seven notes harmonise (`D-048`) |
| UC-46 | Browse by intention rather than by scale name | Style leads the Scales tab (`D-048`) |
| UC-49 | Learn how to use the app | A "How to use" tab, one section per part (`D-050`) |
| UC-50 | Know which notes to play over the current chord | Lands well / moves through / pulls (`D-056`) |
| UC-51 | See what changed when something changes | Only the moved notes are ringed and named (`D-056`) |
| UC-52 | Ask for more adventurous harmony without knowing the terms | One slider, safe to adventurous (`D-056`) |
| UC-53 | Take the sketch to an instrument on paper | Printable sheet with chord diagrams, scale and bass (`D-057`) |
| UC-54 | Meet the app without being overwhelmed | Three levels; Start is a key, chords and a loop (`D-058`) |
| UC-55 | Reach the lush extended chords | Elevenths and thirteenths with the spacing they are played with (`D-059`) |
| UC-56 | Have it sound like a real instrument | Sampled grand piano, retuned synths, four reverb spaces (`D-061`, `D-062`) |
| UC-57 | Hear the individual notes of a big chord | Together, roll, or slow roll (`D-068`) |
| UC-58 | Practise a mini lesson on the piano | Ten lessons on notes, scales and chords; every note judged; show me, a two-step hint, feedback in counted keys, take-away rules and shapes, next key round the circle (`D-073`, `D-075`) |
| UC-59 | Take a lesson's progression into the loop | One tap at the end of a lesson that ends on a progression (`D-072`, `D-073`) |
| UC-63 | See which finger plays each key | Suggested fingers on lit keys for either hand or both, scale fingerings with the thumb crossing, on the printed sheet too (`D-078`) |
| UC-62 | Type in the chords of a song from a chart | Chord names typed in any common spelling, checked before they join the loop, with the keys they fit (`D-077`) |

---

## Next, in order

Reasoning, not just a list. Three of the original six are now built and have moved into the table above.

### 1. UC-31 — Use it in a real session

**Deploy to a static host and install it to the home screen.** — *Packaged (`D-076`): `tools/package-site.mjs` makes the site, and the README says how to put it on GitHub Pages from an iPad. What remains is the session itself.*

Everything else is theoretical until this happens. The app has never been used where it is meant to be used: on a phone, next to a synth, while a beat is playing. That session will produce better direction than any amount of planning here, and it answers three open questions at once — whether the Bone palette works at night, whether the keys are big enough to hit, and whether the two-channel colour system reads at arm's length.

It also closes the one requirement that is currently unverifiable: offline operation. And it unblocks everything below, because all of it is persistence.

*Small, and blocking the rest.*

### 2. UC-33 — Keep a sketch

**Save named loops, chords and scales, and recall them.**

Saved material currently lives for the session only, which the app says plainly rather than implying more. A loop found on Tuesday should still be there on Friday. The data model already supports it — a progression is a list of chords with explicit notes, saved objects have ids derived from their notes, and figures are reproducible from a seed (`D-024`) — so this is storage and a list screen, not new theory.

*Blocked on deployment: saving to a device nobody opens is pointless.*

### 3. UC-47 — Favorites, history and collections

**"West coast ideas", "Dark minor", "Progressions to try".**

Borrowed from the Chord! comparison, and the argument there is right: this is what separates a working musician's tool from a calculator. A collection should hold anything — scales, chords, voicings, progressions, bass ideas — which the data model already allows, since all of them are objects with ids.

*Follows immediately from `UC-33`; same storage, different screen.*

### 4. UC-36 — Export MIDI

**Drop the loop into a DAW.**

Deferred in v1 (`D-013`) on the grounds that it wasn't the point. After real use it may turn out to be exactly the point. The data — explicit notes, one bar each, a known tempo — is already the shape a MIDI file needs.

*Reconsider its priority after step 1.*

### 5. UC-48 — Style transformations

**"More soulful", "darker", "simpler" applied to a progression.**

The last item from the original roadmap with no work behind it. It needs a chord-substitution engine: rules for adding extensions, borrowing chords, and swapping one function for another. Everything it would need is now present — the dictionary, voicings, voice leading and the style colour map — so it is assembly rather than invention.

*The most interesting remaining feature, and the least urgent.*

### 6. UC-60 — Explore: one chord, every dial

**"Just play with chords, open, close, 7th, all variants."**

The second mode (`D-072`). Everything it needs already exists — quality, triad to ninth, voicing, inversion, roll, arpeggio, the adventurousness slider — but it is scattered across three tabs and two levels, so hearing one chord five ways means crossing a level boundary. Explore gathers those dials around a single chord and puts nothing else in the way.

*Assembly, not invention. Next after Learn.*

### 7. UC-62 — Keep a sketch on paper

**A short code printed on the sheet that restores the sketch exactly when pasted back.**

The Create mode's missing half, available before deployment. The data is already the right shape — key, chords with explicit notes, tempo, the riff's seed (`D-024`) — and paper survives a wiped phone, which browser storage does not.

*Saving without a server, and a bridge to `UC-33`.*

## Not planned, and why

| Idea | Why not |
|---|---|
| MIDI keyboard input | No Web MIDI on iOS Safari, which is the target device |
| Recording or audio export | This is a sketchpad; the DAW is downstream of it |
| Accounts and sharing | No backend is a feature (`D-004`) |
| Notation | The piano *is* the notation here |
| Ear training | Naming what you hear without seeing it. Theory follows the sound (`D-011`) |
| ~~Quizzes~~ | ~~This is not a course~~ — reversed: practice lessons are built, as playing rather than answering (`D-073`, `UC-58`) |
| Swing | Real, but to be judged by ear rather than specified (`D-022`) |
| A separate chord detail screen | Its content already exists, and a separate screen fights the pinned-piano layout |
| Star ratings for scale fit | "Misses A#" says more than three stars out of five |

---

## Cross-cutting constraints

Numbered in `REQUIREMENTS.md`; listed here because they apply to everything above.

- Usable one-handed on a ~380px portrait screen.
- Visual feedback never waits on audio.
- The piano is visible in every primary view, and a selected chord stays lit until another is selected.
- Chord and scale states are legible at once, including on the sharps.
- Up to eight simultaneous notes render and sound.
- Every note name routes through the naming layer; every colour through a role-named token.
- No note sounds longer than expected; Silence is always available; the voice budget cannot leak.
- Analysis is judged against the key, never against the melodic palette.
- Every automatable scenario has a test, every test has a scenario, and every behaviour has a mutant.
