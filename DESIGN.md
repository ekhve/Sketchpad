# Sketchpad — Design

**What it is:** a phone-first web app for a producer who is learning piano and theory while making beats.
**The loop it serves:** pick a key → see chords worth playing → hear them → sketch a progression → understand why it works.
**Companions:** `USE_CASES.md` (what the user does) · `REQUIREMENTS.md` (what must be true) · `sketchpad.feature` (how it is checked) · `DONE.md` (when a change is finished).

---

## 1. Product

A sketchpad that explains itself. Not a DAW, ~~not a course,~~ not a performance instrument. It now has short lessons, but they are played, not read, and the reason for each step still arrives after the sound (`D-073`).

**Three ways in** (`D-072`). *Explore* — play with one chord and every dial on it. *Learn* — short lessons practised on the piano. *Create* — the sketchbook: build a loop and take it away on paper. A mode changes what is in front of you and in what order; it never owns a feature.

**Primary user.** Produces music, beginner on piano. Knows "my beat is in C# minor" but not what a submediant is. Wants theory as an explanation of something already heard.

**Success test.** On a phone, in under a minute: choose a key, tap chords, hear them, put four in a loop, press play, and read one sentence saying why they belong together.

**Not in scope.** Accounts, cloud sync, MIDI in or out, notation, real-time playability.

---

## 2. Architecture

Four layers, dependencies pointing down only.

```
ui/       React components — render state, emit intents
state/    one store: key, selection, progression, transport
audio/    Tone.js wrapper — performs a plan, owns its voices
theory/   pure functions — no React, no audio, no DOM, no randomness
data/     scales, chord sets, patterns, dictionary
```

**The rule that matters:** `theory/` is pure. It ships inside `sketchpad.jsx` between `THEORY:START` and `THEORY:END` markers and is extracted into a module for testing, so there is exactly one copy and it is the one that runs.

**Why it matters:** every bug class that could not be tested got fixed by moving the *decision* out of the audio layer and into a pure function — scheduling, voice budget, tab fallback. The pattern is in §5.

### Core types

```ts
type Midi = number;          // 21..108, C4 = 60
type PitchClass = number;    // 0..11, C = 0

KeyContext  { tonicPc, mode: "major"|"minor", scaleId }
ScaleDef    { id, name, iv[], mode, mood, tags[] }
Chord       { id, rootPc, sym, full, notes: Midi[], degreeIndex, roman }
Pattern     { id, name, kind: "bass"|"melody", styles[], steps: {p,d,r}[] }
ChordSet    { id, name, mode, slots: [offset, quality][], progression: number[] }
BarEvent    { voice: "chord"|"bass"|"riff", notes: Midi[], at, dur, vel }
```

### Two visual channels on the piano

| Channel | Carries | Matched on |
|---|---|---|
| **Fill** (clay) | harmony: sounding, selected chord, notes in the loop | the actual note |
| **Marker** (teal dot) | palette: home note, scale notes | the pitch class |

A chord is a voicing; a scale is a palette. That difference in kind is why the two channels match differently.

---

## 3. Settled decisions

Recorded once, not worth re-arguing.

| ID | Decision | Why |
|---|---|---|
| D-001 | Web app (PWA), not native | One codebase for phone and desktop; no app store |
| D-002 | Phone-first, ~380px portrait; responsive up | Stated use is a phone in one hand |
| D-003 | React + Vite + Tone.js; theory as data | Types and data catch note-math errors |
| D-004 | No backend, no accounts | Zero cost, zero privacy surface |
| D-005 | Static host on a subdomain, not inside WordPress | Avoids theme and plugin conflicts |
| D-006 | Notes are MIDI numbers internally; names are a display layer | Spelling changes touch one module |
| D-007 | A chord is a label plus an explicit voicing | Voicing is most of why a chord sounds good |
| D-008 | In-Key mode and Set mode feed one chord grid | Beginner and genre paths don't compete |
| D-009 | One instrument behind an interface | Adding a sound is data, not surgery |
| D-010 | One bar per chord, 4–8 slots | Simplest thing that supports the core loop |
| D-011 | Explanation is reactive and never modal | Theory follows the sound, never precedes it |
| D-012 | Beginner / Producer modes; beginner default | One content model, two rendering levels |
| D-013 | No MIDI export in v1 | Data model already fits it when wanted |
| D-014 | Chord-set content is ours; the J-6 is a structural reference only | Their tables are their content |
| D-015 | Session state survives reload; no saved projects | Losing a sketch to a reload is the hated failure |
| D-018 | Bone palette; colours named by role, never by colour | A light ground leaves room for more roles |
| D-019 | Note naming is pluggable; letters and fixed-do ship | A third system is an array, not logic |
| D-020 | Tests are extracted from the shipped theory block | One copy of the theory, and it is the live one |
| D-021 | Behaviour is specified in Gherkin before it is asserted | The shared artefact between intent and test |
| D-022 | Rhythm is sixteenth-note steps; no swing, no tuplets | Coarse enough to reason about, fine enough for the genres |
| D-026 | Scenario/test traceability is enforced, not trusted | It rotted within one session when it was not |
| D-027 | Tests are validated by mutation, not by passing | Two assertions here passed while testing nothing |
| D-030 | Notes are short by default; mute is a standing state | Silence stops what sounds now; mute is a mode |
| D-032 | The build step runs before the tests | A stale module once produced 70 green false passes |

---

## 4. Decisions worth reading

The ones that carry a lesson rather than a preference.

### D-016 — Two visual channels

Chord and scale were competing for one channel — the key's fill — so one always hid the other. Split them: **fill** carries harmony, a **dot** carries the scale. A key can now say both things at once, and the informative combinations read without instruction: accent with a dot is a safe chord tone; accent without one is the interesting note from outside the scale.

### D-017 — Voices must always be releasable

Loop chords were held for a full bar with no explicit release, so they accumulated and rang forever. Three rules, all mandatory: a scheduled note is always shorter than the gap before the next; stopping the transport also releases held voices; and a **Silence** control exists at all times that kills sound without destroying the user's work. Every audio path added since has had to satisfy all three.

### D-023 — Figures are authored rhythm plus generated pitch

Authored patterns are musical but don't transpose; generated rules transpose but sound generic. So split them. A **pattern** carries rhythm and intent — "root here, chord tone on the and-of-2, approach the next chord at the end" — and never names a pitch. **Rules** resolve each intent against the current chord, the next chord and the scale. One pattern works in every key and still sounds like its genre. Adding a style means writing steps, not code.

The generator being pure is what caught the "Rising line" pattern shipping with undirected motion — it did not rise, and its description was a lie. Hence the `stepUp` / `stepDown` roles, and a test that a named shape holds.

### D-024 — Randomness is seeded, never ambient

Variation comes from a seed held in state; "suggest again" increments it. No `Math.random` in the theory layer. Every figure is reproducible from `(pattern, chord, next chord, scale, seed)`, so it can be asserted, reported in a bug, and later saved.

### D-025 — Harmony is judged against the key, melody against the palette

`explainChord` compared chord tones to whichever scale was selected. But minor pentatonic and blues are *subsets* of the key offered as melodic palettes, so selecting one made the ordinary ♭VI chord report as "outside the scale" — a confident, fluent, false explanation.

Two questions, answered separately: *is this chord in the key?* is harmonic and always judged against the parent scale. *Are all its notes in my palette?* is melodic and mentioned gently. The word "scale" was doing two jobs and hiding a bug.

**Why it survived two sessions:** every test used natural minor, where the parent scale and the palette are the same object. The suite never varied the thing that mattered.

### D-028 — Done is defined, and measured

Two failures reached the product with no gate noticing, and neither was a coding error. `DONE.md` defines gates across requirements, documentation, tests, code, manual verification and judgement; `tools/check-done.mjs` measures the eleven a machine can judge.

Two clauses earn their place. **DoD-16:** anything that varies — key, scale, seed, naming — must be varied in at least one test. **The refactor rule:** if the mutation score moves, it was not a refactor. The judgement gates stay explicitly human; no script will answer "does it sound good, or merely correct?"

### D-029 — Sharp keys are grey, not black

Near-black sharps forced a second dark variant of every colour and still read weakly. A warm mid-grey means both key types are light and one colour language covers the whole keyboard. The dot rule changed from *which key type* to *how saturated is the fill*. Less like a real piano; the keyboard here is a diagram of harmony, not a photograph.

### D-031 — A bar is planned before it is played

Reported as: sound keeps running on, then everything goes silent. Four defects. Durations were built by string arithmetic and handed to a text parser. Nothing bounded a note against its neighbour. Polyphony was capped below the worst case, and exceeding it throws *inside the transport callback* with no `try/catch`, ending playback for the session. And mobile browsers suspend the audio context without resuming.

`planBar` is now a pure function returning events with times and durations **in seconds**, where no voice holds two notes at once and every note is clamped to end — with an audible gap — before its successor. The audio layer only performs the plan.

**The lesson:** two earlier fixes treated symptoms because the defect lived in a layer nothing could test. Making the schedule a pure value is what let the tests reach it.

### D-033 — A chord is lit as a voicing, not as a set of pitch classes

Chords are stored as explicit voicings and then lit by pitch class, so every octave of every chord tone lit at once. The fill channel now matches the actual note; the marker stays pitch-class based. Three lit keys instead of nine, and the user can read a voicing off the keyboard at the right octave.

### D-034 — A struck voice, and a mix

"Notes are very long" persisted after two rounds of shortening durations, because the length was never coming from the durations. The envelope held at 8% for as long as the note lasted, and a 1.4s reverb tail sat under everything. **Sustain 0** and a short room fixed what duration changes could not. Velocity moved into `planBar` — chords quieter than bass and riff — so the mix is a property of the plan and is checked like anything else.

### D-035 — The theory layer covers chords as objects of study

Added: a **chord dictionary** of fifteen qualities on any root with formula and description; **inversions**; **bass options** ranked root → fifth → third → seventh → passing; **bass transitions** (direct, scale walk, fifth approach, chromatic); and **chord sets** of eight slots plus a progression, authored in C and transposed.

Ninths forced a real fix: `voice()` was fed pitch-class-reduced intervals, so a ninth became a second beside the root. `stackAscending` stacks upward instead.

**A test taught me something here.** I asserted every chord set starts on the tonic. The ii–V–I set correctly does not. The assumption was mine, not the data's.

### D-036 — Five tabs, one persistent context

The single column had reached the point where the piano was pushed off screen by the thing it illustrated. Key and piano stay pinned; five tabs below, each answering one question. Every tab reads the same selected chord and scale, so moving between them changes the question, not the state.

### D-037 — The audio chain is the simplest thing that can sound, and it reports on itself

After the restructure the app went silent, and I could not reproduce it — the build environment has no audio device. I formed a theory from reading library source and it was wrong.

So: strip the chain to one synth straight to the speaker, and make the app *say* what it is doing — context state, current voice, the actual error if construction failed, and a **test sound** button that plays one note through the same path as everything else. If that note sounds and the app does not, the fault is not the chain.

The audio layer is the one part of this project that cannot be unit tested. It gets the next best thing: it reports its own state to the person who can observe it.

### D-038 — The app owns its voices

Silence after about thirty notes — and thirty is not a round number by accident, the polyphony limit was 32. Voices were allocated and never returned. A voice rejoins the library's pool only when a silence callback fires, and with `sustain: 0` two stops are scheduled for the same oscillator; somewhere in there the callback stops arriving.

So stop borrowing the pool. One synth per note, destroyed when the note is finished. What remains is a **budget**, and a budget is arithmetic: `voiceLifetime`, `reapVoices` and `allocatable`, with eight scenarios and three mutants including a simulated eight-bar loop that fails if voices accumulate. Under pressure the app now drops a note rather than going silent forever, which is the right way round. The live voice count is on screen, and a **reset audio** control exists so nobody has to reload.

### D-039 — Two silent failures: a moved API and a missing fallback

Tone 15 moved the transport behind an accessor. `Tone.Transport` still resolves to an object, so nothing threw — but `scheduleRepeat` was `undefined` and the loop scheduled nothing, silently. The most dangerous shape of API change.

Separately, the Bass tab required an explicitly *selected* chord, so a loop built with the "add" button left it empty — telling someone who had picked four chords to pick a chord. `activeChordFor` falls through: selection, then the playing bar, then the loop's first chord, then home.

**What connects them:** both failed quietly. A checked API returning `undefined` and an empty state giving no reason are the same bug in different clothes. Where the app cannot do something, it now says what it could not do.

---

> **Note.** `D-040` to `D-059` were written at the time but never reached this file: every insert used an anchor that did not match, and the duplicate guard saw the change-log mention and skipped in silence. They were reconstructed on 2026-09-13, and gate **G13** now fails when a decision is cited without being written. Some detail from the originals is lost; what follows is what each decided and why.

### D-040 — Instruments are data, not code

Four presets, each a row of data: voice kind, envelope, volume, release, and whether echo suits it. The `release` field feeds the voice budget (`D-038`), so a long tail is accounted for rather than leaked, and a test asserts the declared release matches the envelope's.

### D-041 — One echo, one switch

A `FeedbackDelay` sits permanently in the chain with its wet level at zero when off, because adding and removing nodes while notes are in flight loses them. Settings are fixed per instrument; there are no knobs. Bounds are tested: it can neither drown the dry signal nor run away.

### D-042 — Voicings, the J-6 lesson applied

Voicings were first-class in the data model from the start and every chord still appeared in one arrangement. `voicingsFor` returns close, open (drop-2), spread, rootless and shell. The chosen arrangement is what sounds *and* what the piano lights, because the arrangement is the chord rather than a decoration of it.

### D-043 — Our own loop scheduler

The library transport failed silently twice and could not be reproduced here. A `setInterval` tick asks `barsToSchedule` which bars fall inside a lookahead window. Third time this project took a decision back from a library in order to test it.

### D-044 — Theory that answers back

Four teaching functions, each named after the question the user is asking: `suggestScaleFor` (a foreign chord belongs to a scale you have not chosen), `harmonizeSteps` (building a chord out of the scale, lit on the piano), `voiceLeading` (what holds, what moves, measured), `suggestNextChords` (ranked by how harmony behaves). The dictionary also began playing in close position, because through a rootless arrangement a major and a minor triad sound far more alike than they are.

### D-045 — The piano is an instrument, not just a diagram

Holding a key sustains; pressed notes live in a separate map from timed voices so a finger cannot be reaped out from under itself. Four octaves in a scrollable strip.

### D-046 — The palette follows the scale you chose, and labels hold still

Choosing Dorian changed the notes and the mood text and left the chord palette showing natural-minor chords. Any seven-note scale is now harmonised directly. Separately, note labels moved when a marker dot appeared; both are absolutely positioned now, because a label that shifts because of data is unreadable at a glance.

### D-047 — The piano is an input device, not only a display

`identifyChord` returns **every** reading, ranked, rather than picking one: `E G# B C#` genuinely is both `E6` and `C#m7/E`. It lives in its own tab, because selecting and playing are opposite behaviours on the same control and a mode toggle is a thing to mis-set. Arpeggios and `smoothestVoicing` came in alongside.

### D-048 — Your own material, and intention as a way in

A selection saved from Find becomes an object that behaves like anything built in, with the voicing kept **as played**. `harmonizeIntervals` was split out so a seven-note scale someone invented harmonises into its own chords. The Scales tab leads with an intention — producers think "something soulful", not "Dorian".

### D-049 — A reading pass before the first play test

Three bugs found by re-reading rather than running: a saved scale never lit the piano, tapping a voicing played the previous one, and a held key never stopped if you changed tab. All three lived in the component, which is the layer with no tests.

### D-050 — The guide is content, not decoration

A "How to use" tab whose sections are **data**, with a test asserting every tab has one. A new tab therefore cannot ship undocumented.

### D-051 — The two-sentence cap was a rule nobody checked

`D-011` capped beginner explanations at two sentences. Measured: 1,728 of 2,520 broke it. Fixed by rewriting the copy — role descriptions became phrases rather than sentences — and now asserted. A constraint that lives only in prose is an intention.

### D-052 — Several fingers at once

`setSounding` replaced the set on every press, so a second finger unlit the first. Bookkeeping moved into `heldAfterDown` / `heldAfterUp`, with a ninth finger refused rather than stealing a voice. The keys also had to take `touch-action: none`, or a second finger reads as a pan.

### D-053 — A finger that rolls across the keys

A touch is implicitly captured by the element it started on, so a key can never learn a finger arrived. `slideTo` works out what should sound given where the fingers are — pressing the new note, releasing the old, and not releasing one another finger still holds.

### D-054 — The browser was taking the finger away

`touch-action` is intersected down the ancestor chain, so the scroll strip could not live inside a keyboard marked `none`. The strip became a sibling. This fixed a real problem and the glissando still did nothing, which was the signal that the approach was wrong.

### D-055 — Geometry instead of the DOM, and listeners on the window

Both earlier attempts depended on `elementFromPoint`, pointer capture and event retargeting all behaving — three assumptions in a layer with no tests. `keyAtPosition` makes the question arithmetic, and events come from the window.

### D-056 — Three ideas from the comparison worth having

The **melody guide** (lands well / moves through / pulls, over the current chord), **what changed** (only the moved notes ringed and named), and **how adventurous** (one slider from the plain triads of the key to borrowed and chromatic colour, each marked with a reason).

### D-057 — A sheet you can take away from the device

The opposite of MIDI export. HTML rather than PDF, because the print dialogue gives paper, PDF and copy-paste from one implementation. Diagrams rather than chord names, since nothing on paper can be tapped and a name tells the player nothing they did not know.

### D-058 — Levels, because the first impression was a menu

The old Beginner/Producer toggle changed how things were described and never what was shown. Three levels — Start, Produce, Study — that **only ever add**, with a test that `UC-00` is completable at the simplest one.

### D-059 — Extended chords, and the spacing that makes them

A minor eleventh stacked in thirds is mud; in fourths it is the sound people mean. Eleven new qualities, each carrying a **signature voicing** beside its formula. A test of mine was wrong about music: the classic `m11` shape drops the 9th on purpose, so the rule is to keep the root and the extension the chord is *named* for.

---

### D-060 — Defaults, and chords that follow the keyboard

It opened in C# minor because that is the key in the original brief; for anyone else that is an odd first impression. It opens in **C major** now, with **major offered before minor**.

**Shifting the octave moved the picture and left the sound behind.** Chords were pinned to C3 whatever the keyboard showed — invisible by reading, because the lighting and the audio were each individually correct. `voice` now takes a base octave and every chord source threads it through.

### D-061 — Rooms, not just an echo

One basic delay was the whole effects chain, which is most of why everything sounded dry and small. The chain is now **voice → delay → reverb → out**, both always present and at zero when off, since swapping nodes while notes are in flight loses them. Four spaces — Dry, Room, Hall, Cave — each a named setting rather than a knob.

### D-062 — Recorded sound, because synthesis was the problem

Reported: it sounds like a toy, and the Rhodes sounds like a marimba.

**The Rhodes diagnosis was specific and useful.** A Rhodes is a struck tine: the bell lives in the *attack*, and what follows is close to a sine with a long tail. My preset kept the bell ringing for the whole note, which is the recipe for a marimba. The modulation envelope now dies in 120ms while the carrier decays over three seconds.

A sampled grand piano was added alongside. A test needed revising rather than satisfying: "only the pad sustains, everything else is zero" was right when every voice was a plain triangle, but a real Rhodes has a *tail*. A pad sustains above 0.4; anything struck stays at or below 0.1.

### D-063 — A crash that showed nothing at all

`Cannot access 'samplerFor' before initialization`, and the app never appeared. A dependency array is evaluated where it is written, so naming a `const` declared further down throws during the first render and nothing mounts.

**Gate G12** now scans every `useCallback` dependency array for a name defined later in the file. What did not catch it: 305 passing tests, twelve green gates and a clean build — all of which look at the theory layer or the documents. The shell needs *static* checks, since it cannot have behavioural ones here.

### D-064 — The piano that could never finish loading

Three faults, compounding. The record of "we are loading this" was written **after** the sampler was constructed, so when files are already cached `onload` fired during construction, wrote into an entry that did not exist, threw, was swallowed, and left nothing recorded — rebuilding the sampler on every note, for ever.

Not-loaded also meant **silent**, which is indistinguishable from broken. And nothing ever gave up. Now: record first, play through a named **stand-in** synth until the recordings arrive, and give up out loud after twelve seconds.

**An instrument that cannot sound is not an instrument.** Every sampled preset must name a stand-in, it must be a synth rather than another download, and it must decay at a similar rate.

### D-065 — Voicings were being derived from the last voicing

Reported: the big extended chords all sound similar. A plain logic error — choosing an arrangement **rewrote the chord's notes**, so the next list was computed from the previous choice. After two or three picks they had all converged.

Arrangements now derive from the chord's canonical close position, and a chord carries the octave it was built in rather than having it guessed from its current shape.

Underneath that, a musical fault: Open was a drop-2, which opens a four-note chord but leaves a six-note thirteenth just as crowded. Five notes and up now drop two.

### D-066 — A pool of voices instead of a new one per note

Reported: after a while the audio scrambles and slows down, and reset does not help. Every note built a fresh synth, wired it through delay and reverb, and disposed of it a second later — hundreds of nodes a minute.

A fixed pool per instrument is built once and reused. **Reset** now genuinely rebuilds it, since releasing notes is no use when the graph itself is the problem.

**A mutant that took two attempts to kill:** removing the free-voice check still passed, because the voice finishing soonest is also free whenever any voice is. The difference is *which* free voice, and allocation that depends on history cannot be reasoned about.

### D-067 — Recorded sound is offered, not assumed

The sample host is blocked in this environment, so the piano never arrives. Making it the default meant opening the app to silence. The grand is still there and still loads where it can, but **the instrument the app opens with must never depend on a download.**

### D-068 — Rolling a chord, so you can hear the notes in it

Six notes struck together are one sound, and a wide thirteenth becomes a wash. Spreading the same notes over a fraction of a second makes each audible while the chord still arrives as a chord.

Three settings: Together, Roll (45ms a note), Slow roll (110ms). Not an arpeggio — the notes overlap and sustain together, only their attacks are staggered. The spread is capped at half the note's length, so **the roll never outlasts the note it belongs to**.

---

---

### D-069 — The recordings travel with the app

Fetching samples from another site failed wherever that site is not on the page's allow-list, which is silence for a first-time user (`D-067`). The fix is not a better host: it is not to need one.

Seven notes — C2, F#2, C3, F#3, C4, F#4, C5 — are embedded directly in the file as data URIs. Mono, 22 kHz, 2.6 seconds with a short fade, about 11 kB each: **100 kB of base64 in total**, against an app that was already 183 kB. Nothing is downloaded, it works offline, and the grand piano can be the default again.

**Why seven and not four or fifteen.** Every note is within three semitones of a real recording, so nothing is stretched far enough to sound obviously wrong. A test asserts that spacing rather than the count, because the count is not the thing that matters.

**Credit.** These are the Salamander Grand Piano recordings by Alexander Holm, under CC-BY 3.0 — someone else's work, shipped inside the product, under a licence that requires attribution. The credit is shown in the app beside the instrument, is in the guide, and is asserted by a test so it cannot be quietly dropped. **I could not reach the licence file from this environment to re-read it; that should be verified against the source before publishing anywhere public.**

The stand-in is kept even though nothing is downloaded now, because decoding can fail where downloading cannot.

---

### D-071 — The samples did not cover the keyboard, and the test said they did

`R-230` claimed every note was within a few semitones of a real recording. It was false, and the scenario named as verifying it did not check it.

Seven recordings spanned C2 to C5 — 36 semitones. The keyboard is four octaves wide and its scroll went up to midi 84, so the playable range was midi 24 to 132. Everything above C5 was the C5 recording sped up: an octave at C6, two at C7, four times playback rate, a 2.7-second note collapsed to 0.67. Thin and plinky, not a piano. Basslines made it worse at the other end, sitting at the chord root minus 24, below the lowest recording.

The test measured the gaps *between* samples and asserted they were at most six semitones. That is a true statement about the list, and it says nothing about the keyboard. This is `D-025` again in a new place: a property checked in isolation from the thing that varies. The sample list was the only input; the range it had to cover was never part of the test.

Two changes. The set is now thirteen recordings, every six semitones from C1 to C7, taken from the same Salamander library at a single velocity layer so the loudness does not step between them. And the coverage question moved into pure functions — `stretchAt`, `worstStretch`, `PIANO_RANGE` — which walk the real range note by note. The octave clamp is derived from the same constants rather than typed in, so widening the sample span widens the keyboard and there is nothing separate to remember.

The duplicate check had the same shape of flaw. It compared the first 64 characters of each payload, which is the mp3 header — it carries the duration and nothing about the sound. The old samples had different durations, so it passed; encoding thirteen notes to the same length made it fail, correctly, for a set with no duplicates in it. It now compares the audio.

**Cost.** The file grows from about 280 kB to about 377 kB. Loaded once, then offline forever, so this is the right trade.

**Not fixed here.** The keyboard window is 48 semitones and the span is 72, so the scroll range is now midi 24 to 48. The default position is 48, which means the octave-up arrow starts at its limit; it is disabled rather than silently inert. Whether the default should move down is a separate question.

**Still open.** Basslines at root minus 24 land at C1 to B1, where almost all the energy is in one narrow band around 80–160 Hz with no upper harmonics to give the ear pitch. That reads as mud on a phone, and it is a placement decision rather than a sample defect. A fix belongs in `bassOptions`, not in the recordings.

### D-070 — Embedding was not enough: it still went through fetch

The recordings were inside the app (`D-069`) and the status line still said the piano had not arrived. Embedding removed the *remote* request; it did not remove the request.

Handing the audio library a `data:` URI still makes it call `fetch`, and a page whose policy restricts where requests may go blocks a data URI as readily as a website. The bytes were sitting in memory and the app was asking permission to go and get them.

**The fix is to decode them ourselves.** `atob` to bytes, `decodeAudioData` to audio buffers, and the sampler is constructed from buffers rather than URLs. No request of any kind.

**What is testable here and what is not.** Decoding needs an audio device, which this environment does not have, so the checks cover the part that is arithmetic: every sample separates cleanly into a payload, holds a plausible number of bytes, is valid base64, **begins with an MPEG frame**, and is distinct from the others. That last one matters most — a truncated or wrongly encoded embed decodes to nothing and looks exactly like a network failure, which is precisely the confusion this bug caused.

**The pattern, for the fourth time.** Three earlier fixes failed because they depended on something in the shell that could not be observed from here: pointer capture, the library transport, a voice pool. This is the same shape. The reliable move has been to stop asking an outside system for something and do it in code that can be checked.

### D-072 — Three modes by intent: Explore, Learn, Create

**Context.** Mapping the main scenario onto the tabs showed one pass of `UC-00` visiting seven tabs, returning to Chords and Scales twice each. The tabs are named after theory — chords, scales, bass — while what the user actually does is one of three things, in his own words: *explore* ("just play with chords, open, close, 7th, all variants"), *learn* ("learn music, with theory on it, while playing"), and *create* ("just a sketchbook with extra output, a paper version as we have").

**Decision.** Organise the app by intent, not by subject.

| Mode | The piano is | Starts from | When you stop touching it |
|---|---|---|---|
| Explore | an instrument | one chord | it waits |
| Learn | a teacher's hand, showing and checking | a lesson | it tells you what's next |
| Create | a readout you copy from | your sketch | the loop keeps playing |

**The rule that stops three modes becoming three apps:** a mode never owns a feature. Anything you hear in any mode goes to the sketchbook in one tap. A mode changes what is foregrounded, the order things come in, and what happens when you pause.

**What it replaces.** `UC-00` stays as the Create scenario. Start / Produce / Study (`D-058`) gate by *difficulty*, which is the wrong axis: it put anything educational at Study, behind the create toolkit, when learning has the fewest prerequisites of all. The levels go when the modes are built; until then Learn is reachable from Start (`D-073`). Difficulty moves into lesson order in Learn and into folded-away dials in Explore.

**Order of work.** Learn first, because it was asked for and because it proves the one-tap rule (a lesson's progression goes to the loop). Explore next: it needs no new theory, only the scattered dials gathered around one chord. Create last, because its missing half is saving, which is the sketch code on paper and then `UC-33`.

### D-073 — Lessons you practise on the piano, judged note by note

**Context.** The user wanted help learning chords and scales and practising them: "mini lessons, where then I practise the lesson in the piano." The app already held a dozen lessons' worth of material (harmonisation, voice leading, borrowed chords, inversions) with no order and no thread, and "quizzes" had been ruled out as "not a course" (`D-011`).

**Decision.** A Learn tab of ten short lessons — the home note, the major and minor scales, the minor pentatonic, the first chord, major to minor, the three main chords, the four-chord loop, inversions and sevenths — each two to four steps, each step asking for something to be *played*. The app listens to the piano and answers every note.

Four choices carry the weight:

1. **Lessons are data and are built for any key.** `buildLesson(id, root)` produces the steps from the same `harmonize` and `scalePcs` the rest of the app uses, so every lesson works in all twelve keys and a lesson's chords are exactly the Chords tab's chords. When one is finished, "again in G" moves the key one step round the circle of fifths — the key that differs by one note, and the natural next place to practise.
2. **Judging is a pure function.** `practiceNote(target, attempt, midi)` is the part a learner has to trust, so it lives in the theory layer and is tested like the rest. A chord can be played in any order, in any octave, one note at a time or together; a scale must go in order and in the direction asked; an inversion also needs the named note at the bottom. The strongest test feeds every step's own demonstration back into the checker, in every lesson and every key: the answer the app shows must be one the app accepts.
3. **A slip costs nothing and still teaches.** A wrong note is never added and never resets the attempt; it is named, along with the note that was wanted, so the mistake itself teaches a name. Slips are counted and shown at the end, so a sloppy run is visible without being punished.
4. **The reason comes after the sound.** A step's prompt says what to play; its *why* only appears once it has been played. That keeps `D-011` — theory follows the sound — inside a lesson, so this reverses "not a course" without reversing the principle behind it.

**While a lesson is open, the piano only shows the lesson.** Scale dots would give a scale step away before it was played, and the loop's colours would compete, so both are hidden; the home dot stays. "Show me" lights and plays the answer; "Hint" lights only the next note needed; the notes already right are marked.

**What had to change.** `R-190` capped Start at four tabs. Learn is the one a beginner needs most, and the levels are going (`D-072`), so the cap is five until they do. The guide's first line no longer says "it is not a course."

**Verified in the shell for the first time.** Chromium is available in this environment, so the Learn tab was driven headless: 21 checks clicking the real keyboard and reading what the app said back. The component shell has never had behavioural checks before; this one is not yet part of the gate run.

**Known and not fixed.** ~~Notes are spelled with sharps everywhere (`D-006`), so "C minor" reads C D D# F G G# A# rather than C D E♭ F G A♭ B♭.~~ Fixed the same day (`D-074`). A finger sliding chromatically up the keys will complete a scale step, because wrong notes cost nothing; the slip count shows it.

### D-074 — Notes spelled the way the key writes them, and a chord that vanished

**Context.** The first lessons taught note names, and every black key was a sharp, so the C minor scale was taught as C D D# F G G# A#. That is wrong in a way that matters: a learner who reads "D#" in C minor has been taught a name no score will ever show them. A search while fixing it found two more faults of the same family. Four explanations — Build it, voice leading, Find, and the smoothest-voicing note — read straight from the sharp letter names and ignored the naming layer entirely, so they never spoke Do-Re-Mi either. And the chord table listed the formula `0,2,5,7` twice: once wrongly as sus2 and once as sus4(9). In an object literal the second silently wins, so sus2 was not in the table at all, and C D G was only named through a lower-ranked fallback.

**Decision.** A naming system can now be a *spelling for one key*, built by `spelling(system, tonic, mode)`. Plain `"letters"` and `"solfege"` still work and still spell with sharps, so nothing that relied on them moved. The rule for a key, in order:

1. The key leans flat or sharp by its side of the circle: F, B♭, E♭, A♭, D♭ and C lean flat, the rest sharp; a minor key follows the major it shares its notes with.
2. Every note of the key takes its scale degree's letter, and so do the common alterations — ♭3 ♭6 ♭7 ♯4 in major, the raised 6th and 7th, major 3rd and ♭2 in minor. That is what makes the borrowed chords right: in G major, which leans sharp, G minor's third is still B♭; in A minor the leading note is G#, not A♭.
3. A white key is never written with an accidental. Where the letter rule would need E#, B#, F♭ or C♭, the plain name is used instead. Only two keys in the picker hit this in their own scale — F# major and D# minor, which show F for E# — plus the minor third of D♭ and A♭ in the major-to-minor lesson, which reads E and B.

This is `D-019` doing what it promised: a new spelling is arrays and a table, not logic scattered through the app. The key buttons use it too — the black key between D and E reads E♭ in major and D# in minor. Each lesson carries its own spelling, so a C minor lesson says E♭ even while the app is set to C major, and its feedback says the same.

**The sus2 fix is one character wide and the test is the lesson.** The table now lists sus2 as `0,2,7`. The regression test does not check the behaviour, which the fallback happened to mask. It reads the table's source and fails on any formula listed twice, because a duplicate key is not an error in JavaScript and nothing else would ever notice.

**What the mutants found.** Fixing sus2 revived a survivor elsewhere: the preference for reading a chord in root position had only ever been tested by accident, through sus2's lower rank. Readings are listed starting from the lowest note, so root position wins every tie anyway, and only its score shows the preference is deliberate — the test now asserts the score. A second survivor showed the lesson-spelling test only used C, where C major's spelling already writes C minor's flats; it now checks C# minor too.

**What it does not do.** Every note has one spelling per key, so a chromatic passing note outside the key's usual alterations takes the key's direction even where a musician would spell it the other way. That is the honest limit of "one name per key", short of spelling every note from the chord it sits in.

### D-075 — Feedback that teaches a way of finding the note

**Context.** The lessons judged every note, but a wrong note was answered with the right one: "The note you want is D." That tells you the answer once and teaches nothing for the next key. The learner asked for "feedback on how to think": the habits a teacher passes on — count the keys, take every other note, look for the black-key landmark — so that the next mistake can be fixed without help.

**Decision.** Four pure functions, all in the theory layer and all spelled through the lesson's own key (`D-074`):

1. **`diagnoseSlip`** reads *which kind* of mistake it was, and answers in keys you can count. For a scale: you skipped a note (named, with the step to it), you missed by one key ("from E it's a half step up, which lands on F, not F#"), or you never started on the home note. For a chord: a scale note the chord skips ("C, skip D, E, skip F, G"), a wrong interval ("E♭ is 3 keys above C; the major third is 4 keys up, at E"), or, as a fallback, the chord's counts from the root.
2. **`hintMethod`** is the first rung of a two-step hint. The first press says *how* to find the next note without naming it; the second lights it. A right note resets the ladder. A test checks every step of every lesson in every key, so the method never gives the note away.
3. **A take-away rule on every step**, shown when the step is done: one or two sentences that work in any key ("Every major chord is 4 + 3"). Rules that state a count are *claims about the notes*, so a test checks every count against the chord in all twelve keys. A rule that lies is worse than no rule.
4. **`chordShape`**: a finished major or minor triad names its white/black pattern and the other chords of the same quality that share it. C, F and G are one shape; D, E and A another; B major is its own. This is how pianists actually remember triads.

`keyLandmark` gives each of the twelve notes its own place among the black keys ("the first of the three black keys"). It is used wherever the answer is a single note.

**What it does not do.** It diagnoses one note at a time. It does not notice a pattern across attempts ("you always play the third too high") and it does not adapt the lesson. Both need memory across sessions, which nothing in the app has yet.

### D-076 — Installed from a link, working offline, updating itself

**Context.** The app existed as one HTML file and a private page on claude.ai. Neither works for the actual use: two people, each with an iPhone and an iPad, opening it from the home screen next to an instrument. iOS will not run a downloaded HTML file — Files shows a preview that runs no script — and a private page needs a Claude sign-in and a network. `UC-31` had been first in the Next table since the start, blocking persistence and everything after it.

**Decision.** Package the same single file as a small static website that installs as an app. `tools/package-site.mjs` takes the built page and three icons and adds:

1. **A manifest and the iOS tags**, so Add to Home Screen gives a Sketchpad icon that opens full screen, without Safari's bars.
2. **A service worker** that caches every file the site ships, cache first. That is what makes it open with no network.
3. **A version that is a fingerprint of the files.** Any change to any shipped file makes a new `sw.js`. The browser checks `sw.js` when the app opens, fetches the new files past the HTTP cache, switches over, and deletes the old cache and no other. The page already open is never reloaded under the player; the new version is what opens next time. An unchanged upload keeps its version, so nothing is downloaded again.

The app is not changed for this, except for one line (below). The artifact page stays a single file, with no service worker.

**Hosting is the user's, and static.** Any static host works. The instructions use GitHub Pages because it can be set up from an iPad in Safari, is free, and its link can be sent to anyone. There is still no server, account or telemetry of Sketchpad's own (`R-003`). The site is public to anyone who has the link.

**Sound with the silent switch on.** Safari mutes web audio when the iPhone's switch is on silent, which for an instrument reads as broken. Safari 16.4+ lets a page declare itself a playback app, as GarageBand is, and the audio start now does so where the property exists. It is untestable off a device, so it is a manual scenario.

**How it is tested.** The generated service worker is run for real in a sandbox with a fake cache and network. Install it, cut the network, open the app; upload a new version, open again, check which page loads; check other caches survive. The mutator now also breaks the packager (ten mutants), so "works offline" cannot quietly stop being true. A headless Chromium run serves the site, installs the worker, goes offline and reloads the real app. What neither can check is Safari itself, so installing on the devices is a manual scenario.

**What it does not do.** It does not save anything: that is `UC-33`, which this unblocks. *Updated 2026-10-05:* updates no longer need uploading by hand. `npm run site` builds the site from the repository, and a GitHub Actions workflow tests and publishes it on every push to `main`.

### D-077 — Typing chord names, and a numeral that was the wrong case

**Context.** Entering a song meant tapping every note of every chord in Find: about twenty taps for four chords, each with a chance of a wrong note. Charts already write songs as names, "Am7 F#m7 Dm7 G7sus4". The learner tried this with *Seven Days in Sunny June* and asked for names or buttons instead.

**Decision.** A text box in the Progression tab reads chord names and shows what it understood before anything joins the loop.

1. **The vocabulary is the dictionary.** A name is read only if the dictionary can voice it, and a typed chord gets exactly the dictionary's notes. There is one source of truth, so a typed Fmaj7 sounds like a picked one.
2. **Chart spellings are aliases, not rules.** CM7, CΔ7, C7M, C-7, Cø, C°7, C+, D7(4/9)… map onto dictionary names through one table. A capital M is major and a small m is minor, so the box never capitalises or autocorrects.
3. **Refuse, never guess.** An unknown name is shown in red with a reason and, when one is close, a suggestion ("Did you mean Cmaj7?"). While any name is refused, nothing can be added. A guessed chord in a loop you trust is worse than a question.
4. **Slash chords** put the bass just under the chord. A line tolerates the separators charts use: spaces, commas, bar lines and dashes.
5. **Buttons for the awkward keys.** # ♭ m 7 maj7 m7 sus4 dim / and space, because they sit two keyboards deep on a phone.
6. **It answers the question that prompted it.** The typed chords show the keys that hold them, as Find does. When none does, as for this song's verse, it says so and suggests one section at a time.

Two chord types the song needed were missing: **7sus4 and 9sus4**. They are now in the dictionary and the chord table, so G C D F over G reads as G7sus4 in Find too.

**A bug the tests found.** Numerals were lowercased for any chord name starting with *m*, which includes *maj7*. With seventh chords on, C major's I and IV showed as i and iv. The existing tests only checked triads. Minor now means m not followed by aj.

**What it does not do.** It does not split a song into sections with their own keys, and it does not read text that isn't chord names (lyrics, bar numbers). Both were discussed and deliberately left for later.

### D-078 — Finger numbers: chords by rule, scales by table, never checked

**Context.** The app showed which keys to press, but not how. Fingering is what a teacher corrects first. A learner who plays C major 1-2-3-4-5-1-2-3 runs out of fingers, and one who plays every chord with the same fingers gets stuck on inversions. The learner asked for help with finger positions. A prototype (`proto/fingering-prototype.svg`) and a draft spec were agreed before any code: right and left hands, both, chords that need two hands, and the printed sheet.

**Decision.**

1. **Chords by rule.** Fingers rise with pitch in the right hand and fall in the left. Three notes: the middle finger is 3 unless the gap between it and the little finger's note is a fourth or more, then 2. That one rule gives every triad's standard fingering in every inversion: 1-3-5, 1-2-5, 1-3-5 and 5-3-1, 5-3-1, 5-2-1, as Pianote and Piano Guide Lessons teach. Four notes are 1-2-3-5 and 5-3-2-1; five use all fingers.
2. **Scales by table.** They don't follow one rule: F major, B major and the black-key scales each have their own fingering. `SCALE_FINGERING` holds the 12 major and 12 natural minor scales, one octave, both hands. Each entry was checked against two published sources, with a third where they disagreed (B♭ major right hand, G# minor). A test enforces what every standard fingering obeys: no thumb on a black key. A run with no table answer, like the pentatonic lesson, gets no suggestion rather than a guess.
3. **Hand reach is a setting, an octave by default.** The choices are a 7th, an octave, a 9th and a 10th. Hand-span research (Boyle, Boyle & Booker, via PASK) finds nearly 30% of adult women can't play an octave with even minimal comfort, and about 87% can't reach a tenth. A chord wider than the reach, or with more than five notes, is split: the left hand takes as few of the lowest notes as it can. If even that won't fit, the chord gets no numbers and the words "too wide to play as written".
4. **Two hands look different twice over.** The right hand is a solid dark disc; the left is a light disc with a purple ring, purple being the bass colour. Fill against outline carries the meaning without colour, so it still works on a black-and-white printout.
5. **Both hands** puts the bass in the left hand and the chord in the right. The bass is a slash chord's bass, or the root an octave below; the keyboard moves down to show it if it has to. A chord that needs two hands shows both, with a bracket over each hand's keys, whatever was chosen.
6. **Where it appears.**
   - *Learn:* on by itself, right hand. The lesson card says the fingering in words, including where the thumb tucks under. The piano numbers only the keys the lesson has already lit, so it never gives a note away.
   - *Elsewhere:* off until chosen, and a choice holds across tabs.
   - *Sheet:* *Show suggested fingering* prints right-hand numbers on each chord and a left-hand 5 on a single bass note. A bass riff's fingering is out of scope.
7. **Suggested, never checked.** The app knows which key went down, not which finger pressed it. Every fingering text starts "Suggested fingering", and a test checks that no feedback ever mentions fingers.

**What building it found.** The sheet's memo didn't list the new setting as a dependency, so ticking the box changed nothing. The headless run caught it, not the unit tests. Those test the sheet's data, not whether the screen redraws.

**What it does not do.** It doesn't check fingers, finger riffs or melodies, or cover two-octave scales, harmonic and melodic minor, or the modes. "Which hand plays what" across a whole loop, with the bass moving and the chord holding, is the natural next step.

### D-079 — J-6: show musician spelling, keep the manual's label underneath (formerly D-J01)

**Context.** The J-6 Explorer is a second page in this repository for the Roland J-6, a chord synthesizer whose 100 chord sets each put a 4-voice chord on each of its 12 keys. The owner's manual prints those chords as `A#M7`, `D#M7`, and once as `F#FM7`, a typo in set 19. Nobody writes B♭maj7 that way, but the user has to match the screen to the printed chart.

**Decision.** The app shows `B♭maj7`, and "manual says A#M7" appears under it. The prototype spelled every black key as a flat, so F♯m7 came out as G♭m7. Sketchpad's key-aware spelling replaces that (`D-086`).

### D-080 — J-6: match on the notes the device plays, not on chord names (formerly D-J02)

**Context.** The J-6 has 4 voices. Its "G7" in set 29 is G B F G, with no 5th.

**Decision.** A voicing counts as its chord if ~~the root sounds and~~ every note belongs to the chord. Missing tones are allowed. The piano lights the real voicing in its real octave, not an idealised chord.

*Amended 2026-10-06, when all 100 sets were imported (`D-088`):* the root may be missing too, when the voicing has three or more notes and every one of them is the chord's. Set 88 (Jazz) plays seven of its twelve chords that way, and set 86 one, as rootless voicings, the way jazz pianists leave the root to the bass. Requiring the root had flagged eight correct chords as errors. A voicing with a missing root *and* a stray note is still flagged, so set 59's "C6" still is.

### D-081 — J-6: transposition is part of the search (formerly D-J03)

**Context.** None of the sampled sets contains Dm7 G7 Cmaj7 Am7 at KEY 0, but set 47 at KEY −3 contains it exactly. A search that ignores KEY misses the best answer.

**Decision.** Search tries every KEY value by default, and the result always says which KEY to set. Ties go to the smaller transposition. **Assumption:** KEY runs from −6 to +5 and transposes up for positive values. Both stay visible in the UI until checked on the device (a manual scenario). *Updated 2026-10-07 from the manual (`D-094`):* KEY is SHIFT + [A (KEY)] and "transposes the keyboard", which is what the app models. The manual gives no range, so the range and direction are still for the device to answer. The menu's trAn (−12 to +12) is a separate transposition of the sound generator and is not modelled.

### D-082 — J-6: the manual's data is validated before use (formerly D-J04)

**Context.** Set 59 (EDM) fails validation on all 12 keys. Its printed voicings are near-copies of set 60's: "C6" is printed as F♯ B E D♯, which has no C. Set 19 has a typo in a label, and set 43 lists F3 twice in one chord.

**Decision.** Every set runs through `validateSet` before search, and ~~a set that fails is never recommended~~ a key that fails is never suggested. Errors in the manual are recorded, not silently corrected. This is also the strongest argument for capturing the voicings from the device over MIDI rather than trusting the PDF.

*Amended 2026-10-06, when all 100 sets were imported (`D-088`):* checking every key found 56 failures in 34 sets, but in all of them except set 59 it is one, two or three keys out of twelve. Leaving out every set with a failure would have thrown away a third of the J-6 for the sake of a few typos. So the unit of distrust is the key: a failing key is never suggested, and only a set where most keys fail (more than 6 of 12, which is only set 59) is left out altogether. Explore still shows a failing key, marked **!**, with the reason, and the piano shows the notes as printed.

**Known errors in the manual's chord list.** All 100 sets, checked key by key. Recorded here rather than corrected in the data, and pinned by a test (*The manual's errors are listed, and the list is pinned*), so a change to the reader or the data that moves this list fails the build. The voicing is as printed, high to low.

| Set | Key | Label | Printed | Problem |
|---|---|---|---|---|
| 59 (EDM) | all 12 | e.g. C♯ `C6` | F#3 B3 E3 D#3 | Voicings contradict their labels on every key; they look like set 60's. The whole set is left out of search |
| 1 (Pop) | C♯ | `C#M9/C` | F4 D#4 C4 C#3 | slash bass is not the lowest note |
| 2 (Pop) | G | `F/A` | F4 C4 A3 G2 | notes outside the chord: G; slash bass is not the lowest note |
| 3 (Jazz) | D♯ | `D7#9` | F#4 C#4 G3 D#3 | root not sounded; notes outside the chord: D# G C# |
| 4 (Jazz) | C♯ | `C#7#9` | D#4 B3 F3 C#3 | notes outside the chord: D# |
| 5 (Jazz) | C♯ | `C#M7` | D#4 C4 F3 C#3 | notes outside the chord: D# |
| 6 (Blues) | F | `Fm9` | G4 D#4 A3 F2 | notes outside the chord: A |
| 11 (Pop Min) | C♯ | `Gdim/C#` | G4 D#4 A#3 C#3 | notes outside the chord: D# |
| 18 (Utility) | E | `E` | B3 G3 E3 | notes outside the chord: G |
| 19 (Utility) | F♯ | `F#FM7` | F4 C#4 A#3 F#3 | the label can't be read |
| 27 (Pop/Synth) | B | `Em` | D7 B5 E5 | notes outside the chord: D |
| 32 (Pop) | A♯ | `F7/A` | F4 D#4 C3 A3 | slash bass is not the lowest note |
| 43 (Synthwave) | F | `A#/F` | F3 D4 A#3 F3 | a note is printed twice |
| 62 (EDM) | C♯ | `C#sus9` | D#4 A#3 F#3 C#3 | notes outside the chord: A# |
| 63 (EDM) | A♯ | `Bb6` | D5 G4 B3 F3 | root not sounded; notes outside the chord: B |
| 66 (Gospel/R&B) | C | `Cm7/b13` | F4 Bb3 Ab3 C3 | notes outside the chord: F |
| 68 (Lofi R&B) | A♯ | `Bbsus` | F4 D#4 D4 A#3 | notes outside the chord: D |
| 69 (Lofi R&B) | G | `G6` | E3 B2 A2 G2 | notes outside the chord: A |
| 72 (Neo Soul) | F♯ | `CM7#5` | E4 C4 G#3 G3 | notes outside the chord: G |
| 73 (Neo Soul) | F♯ | `Edim` | Db5 Bb4 G4 E4 | notes outside the chord: C# |
| 80 (Neo-Soul) | C♯ | `Db7sus` | F#4 D#4 B3 C#3 | notes outside the chord: D# |
| 80 (Neo-Soul) | G♯ | `Ab7sus` | F#4 C#4 A#3 G#3 | notes outside the chord: A# |
| 81 (Neo-Soul) | G | `Gm7b5` | C4 F3 Db3 G2 | notes outside the chord: C |
| 83 (Bossa Nova) | C♯ | `C#dim` | E5 A#4 G4 C#4 | notes outside the chord: A# |
| 83 (Bossa Nova) | D♯ | `D#dim` | B5 F#5 C5 D#4 | notes outside the chord: C B |
| 83 (Bossa Nova) | F♯ | `F#dim` | A5 D#5 C5 F#4 | notes outside the chord: D# |
| 84 (Bossa Nova) | C♯ | `C#Dim` | G5 E5 A#4 C#4 | notes outside the chord: A# |
| 84 (Bossa Nova) | D♯ | `D#Dim` | A5 F#5 C5 D#4 | notes outside the chord: C |
| 84 (Bossa Nova) | G♯ | `Abdim7` | E5 B4 F4 Ab3 | notes outside the chord: E |
| 85 (Jazz) | D | `Dm9` | E5 G4 F4 D3 | notes outside the chord: G |
| 85 (Jazz) | E | `Em9` | F#5 A4 G4 E3 | notes outside the chord: A |
| 85 (Jazz) | A | `Am9` | B5 D5 C5 A3 | notes outside the chord: D |
| 86 (Jazz) | C♯ | `Db9#11` | Bb4 F4 B3 Db3 | notes outside the chord: A# |
| 86 (Jazz) | B | `Bdim7` | G5 D5 Ab4 B3 | notes outside the chord: G |
| 87 (Jazz) | A | `Cadd9/G` | B4 E4 C4 G3 | notes outside the chord: B |
| 87 (Jazz) | B | `Asus7` | D5 B4 G4 A3 | notes outside the chord: B |
| 89 (Jazz) | D♯ | `D#dim#5` | B4 A4 F#4 D#4 | notes outside the chord: A |
| 90 (Jazz) | G♯ | `Eb7/F` | E4 B3 G#3 F3 | root not sounded; notes outside the chord: G# B E |
| 90 (Jazz) | A♯ | `A#11/F` | E4 D4 A#3 F3 | notes outside the chord: E |
| 91 (Jazz) | F♯ | `A#/D` | D4 A#3 G3 D#3 | notes outside the chord: D# G; slash bass is not the lowest note |
| 93 (Jazz) | F♯ | `A7/C` | A3 G3 E3 C#3 | slash bass is not the lowest note |
| 95 (Classical) | E | `C/G` | E5 E4 C4 G4 | slash bass is not the lowest note |
| 97 (Classical) | E | `F#/C#` | F#4 C#4 F#3 A#2 | slash bass is not the lowest note |
| 100 (Modern) | A | `AbMaj13` | E5 Bb4 G4 Ab3 | notes outside the chord: E |
| 100 (Modern) | A♯ | `AbDimM7` | G5 B4 F4 Ab3 | notes outside the chord: F |

What they look like, in kind: a label a semitone off its notes (set 3's D♯ key "D7#9" plays D♯7♯9); a chord with one note more than its name (Fm9 with an A, 7sus with a 9th, maj7 with a 9th); "dim" printed for a diminished seventh (sets 73, 83, 84); a voicing printed out of order, so the slash bass isn't lowest (sets 32, 95); and typos (19 `F#FM7`, 63 `Bb6` with a B, 43 with F3 twice).

**On `D-014`.** Sketchpad's own chord sets stay its own content. The J-6 Explorer exists to explain one instrument the owner has, so it has to carry that instrument's chord table. It is reference data about the hardware, kept in `j6/` and never mixed into Sketchpad's sets.

### D-083 — J-6: the 8th lower pad is the high C (formerly D-J05)

**Context.** The J-6 has 8 lower and 5 upper pads, but the chord list has 12 columns.

**Decision (assumption).** The high C plays the same chord as C. It is drawn that way, and dashed when C is in the answer. To be checked on the device. *2026-10-07:* the owner's photo of the panel confirms that the 8th white key is a high C (its second function is WRITE), but not which chord it plays.

### D-084 — J-6: prototype screens are drawn by code from the engine (formerly D-J06)

**Decision.** `proto/j6/build-prototype.mjs` generates `explore.svg` and `find.svg` from `j6/j6.mjs`, and they are never edited by hand. A wrong chord on a screen is then a wrong engine result, which the tests can catch.

### D-085 — One feature file for both apps

**Context.** The J-6 prototype kept its 15 scenarios in its own `PROTOTYPE.md`, outside every gate here. The traceability test reads one feature file, and the gates (G4, G10, G11) read the same one.

**Decision.** The J-6 scenarios move into `sketchpad.feature` under `Feature: J-6 …` headings, and `traceability.test.mjs` reads `tests/j6.test.mjs` as well. Teaching the gates a second feature file would have meant changing four checks for no gain. The scenarios keep their names, so `proto/j6/PROTOTYPE.md` still reads as the record of what was agreed.

### D-086 — J-6 shares Sketchpad's theory: extracted for Node, bundled from the source for the page

**Context.** The J-6 prototype had its own small chord parser and nine chord qualities, and spelled every black key as a flat, so F♯m7 showed as G♭m7. Sketchpad's theory layer already spells all 24 keys correctly (`D-074`), reads chord names in every common chart spelling (`D-077`) and writes numerals with the right case (`D-077`). That theory lives inline in `sketchpad.jsx`, between `THEORY:START` and `THEORY:END`. The tests read it as `tests/theory.mjs`, extracted from that block on every run and never committed (`D-020`, `D-032`).

**Decision.** `j6/j6.mjs` imports Sketchpad's theory, and only J-6-specific code (the adapter, the validator, the set data, the search) stays in `j6/`.

1. **In Node** (the tests, the mutator, the prototype generator) it imports the extracted `tests/theory.mjs`. Every command that runs them extracts first, so the J-6 tests also run against the theory that ships.
2. **In the page build** the same import is pointed at `sketchpad.jsx` itself, which exports the theory and the pieces the J-6 page reuses (piano, sound, colour tokens). That way the page carries one copy of the theory and of the piano recordings, not two.
3. **Not chosen: moving the theory to its own module** that `sketchpad.jsx` imports. It would have been the tidier end state, but it would move 2,800 lines out of the app and change the extraction, every gate that reads the block (G6, G7), and the mutator's target, all in a step meant to add a page. It is worth doing on its own, as a refactor whose only test is that nothing else changes.

What J-6 gains: chord names in the key's own spelling (`nameInKey`), the whole chord dictionary and its aliases, and numerals for chords outside the key (♭VII7 rather than nothing). Without a key, black keys are still spelled as flats, as `D-079` says.

### D-087 — The J-6 Explorer is a second app on the same site

**Context.** The owner decided the J-6 Explorer lives in this repository as its own page, not inside `sketchpad.jsx`. It has to reach the same phones the same way Sketchpad does (`D-076`): from a link, installed to the home screen, working offline beside the hardware.

**Decision.**

1. **Built like Sketchpad.** `tools/build-app.mjs` builds both pages into single HTML files, `build/sketchpad-app.html` and `build/j6-app.html`. The J-6 page reuses Sketchpad's piano, its sound (the recorded grand piano and the warm pad) and its colour tokens, imported from `sketchpad.jsx` rather than copied (`D-086`).
2. **Published at `j6/`, as its own app.** `tools/package-site.mjs` packages each page with its own manifest, home-screen title and icon (`site/j6/`), and its own offline cache. The J-6 cache is named `j6-explorer-…`, Sketchpad's `sketchpad-…`, and each app's update only deletes its own old caches, so updating one never empties the other's offline copy. The J-6 service worker's scope is `j6/`, which takes precedence over Sketchpad's for that folder.
3. **Its own tokens extend Sketchpad's.** The J-6's black panel, LED and pads are new roles in a token block `J`, which spreads `T`. Below that block the colour gate applies as it does in `sketchpad.jsx` (G8 now reads both files).
4. **Linked one way for now.** The J-6 page links back to Sketchpad. Sketchpad has no link to the J-6 yet, because the handover's first rule was not to touch Sketchpad's UI. One line in its How to use tab would do it, once the owner agrees.
5. **The assumptions stay on screen.** Until they are checked on a J-6, the page says that the KEY range (−6 to +5), its direction, and the high C pad are assumptions (`D-081`, `D-083`), and where its chord data comes from.

**What it does not do.** ~~It carries 4 of the J-6's 100 sets. The rest wait on a transcription of the manual's chord list (`D-082`).~~ It carries all 100 sets since `D-088`. It does not talk to the J-6 over MIDI, so it can't know which set or KEY the hardware is on, or hear what was played.

### D-088 — J-6: all 100 sets, imported from the manual and read in its own spelling

**Context.** The prototype had 4 of the J-6's 100 sets, typed by hand. The handover asked for all of them, label and voicing exactly as printed, and said a label the reader can't read is a test failure, not a skip. The manual's page was blocked from this environment, so the owner saved it from Safari and uploaded it. It turned out to use 558 different labels, not the "roughly 80 spellings" expected, and to write them inconsistently: M7, maj7 and Maj7; "/9", "/11", "/#11" and "/b13" meaning an added note rather than a bass; sus9/13; (no3) and (no 3); "D# dim7" with a space; FmAdd9.

**Decision.**

1. **Imported, not typed.** `tools/j6-import.mjs` reads the saved page's one table and writes `j6/sets.mjs`: 100 sets, 1,200 keys, label and voicing as printed. Run against the same page, a second, independent parse gave identical results, and the four sets the prototype typed by hand match the import exactly. The saved page itself is not committed. It is Roland's page, and the data file records where it came from.
2. **A reader for the manual's vocabulary.** `j6/labels.mjs` turns a label into a root, a bass and the notes it allows. Sketchpad's chord-name reader (`D-077`) comes first, so a name both read means the same thing. The manual reader takes over only for what Sketchpad's refuses. Sketchpad's reader stays strict, because for typing, refusing is right. The manual's reader is the one place its spellings are allowed. A chord whose notes are in Sketchpad's dictionary takes the dictionary's name, so `CM7/9` shows as Cmaj9.
3. **Everything is read, except one typo.** 557 of 558 labels are read. The one that isn't, set 19's `F#FM7`, is a typo, and stays an error rather than a guess.
4. **Unlabelled keys are not errors.** Sets 14 to 16 are octave, fourth and fifth stacks with no chord names. They show as "—" with their notes, and search ignores them.
5. **The data drove two amendments,** both recorded where they apply: rootless voicings count (`D-080`), and the unit of distrust is the key, not the set (`D-082`).

**What it does not do.** It does not correct the manual. A key whose notes and name disagree could be named from its notes instead (Sketchpad can identify a chord from its notes, `UC-42`), but which one the J-6 actually plays is a question for the device, not the PDF.

### D-089 — J-6: a tap plays a chord; keeping it is a choice

**Context.** In Explore, every tap on a J-6 key both played the chord and added it to the progression. That suited one job, copying down a sequence just played on the hardware. It spoiled the other, trying pads to find the right chord, because every chord tried went into the progression and had to be cleared. The owner asked for two modes, one to play and one to add.

**Decision.**

1. **Tap plays.** A tap sounds the chord and shows it in Now, Piano and Key. Nothing is kept, and the tapped pad gets ~~no number,~~ only an outline as the last key tapped.
2. **"+ Add to progression"** on the Now card keeps the chord on screen.
3. **Rec** keeps every tap, in order, numbered on the pads, for copying down what was just played. *Amended the same day, from the first try:* turning Rec off made the numbers vanish from the pads, which read as the recording being thrown away. Rec now decides only whether a tap is kept. What has been kept stays in the progression and numbered on the pads, Rec on or off, until Clear (or × and Undo) removes it. It is off when the page opens (the owner's choice), because trying chords out is the commoner use and nothing should be kept by accident. When on, it is filled red with "● REC" in capitals; when off, an outline with "○ Rec". Fill, case and dot all change, so it reads without colour.
4. **A kept chord remembers its own set and KEY,** so a progression can mix sets and transpositions, and Rec doesn't need to switch off when the set changes. A chord from another set says so in the progression ("set 47 · KEY −3 · key A").
5. **Each kept chord can be played or taken out** (tap it, or ×). Undo and Clear stay.
6. **The key follows the progression** once it has chords, and only the chord on screen before that. Trying a chord no longer moves the key.
7. **Find adds a whole result** in one tap: "+ Add to progression" puts the best match's keys, in the order searched for, with their set and KEY.

The logic is a pure reducer in `j6/progression.mjs`, so it is tested without a browser. The page holds it in `useReducer` and does the sound.

**From the first try on a phone.** The × to remove a chord was cut off by the scrolling strip, and the pads cut long names off ("Cmaj7" showed as "Cmaj"). The strip now has room for each ×. A pad now sets the root on one line and the type below, in lines of at most 7 characters, broken only before a bracket, a slash, "add" or "sus" ("maj9(no3)/G" as maj9 / (no3) / /G). A test checks every key of every set, at every KEY and in every key's spelling. A headless measurement of every pad at 375 and 390 px finds none cut off.

**What building it found.** The set picker added with all 100 sets (`D-088`) pushed the panel wider than a phone, and long chord names (a 13th with "(no3)") did the same in Now. 87 of the 1,200 keys overflowed a 375 px screen. Both are fixed, and a headless sweep of every key at 375 px now finds none. That sweep is not yet a gate (see the headless exception in `DONE.md`).

### D-090 — J-6: the progression plays at a tempo, and that is all

**Context.** Play stepped through the progression at one chord a second, with no way to change it. To hear a progression as music, or play along on the J-6, it needs a tempo. The owner asked for tempo "and a couple of small options", and drew the line at a sequencer, for now. Tap tempo was offered and declined.

**Decision.** One row above the progression, four controls:

1. **Tempo**, 60–160 BPM in steps of 5, starting at 90.
2. **Each chord** lasts ½ bar, 1 bar or 2 bars, the same for every chord. Each sounds a little less than its length (92%), so chords breathe rather than smear.
3. **Loop**, on by default. Off, the progression plays once and stops by itself.
4. **Click**, off by default. On, it counts in one bar and then ticks every beat, the first of each bar stronger, so the J-6 can be played along with. The tick is a short triangle-wave blip, a second sound source beside the instrument (`D-009`); it is one note at a time and releases in 60 ms, so it cannot pile up (`D-017`).

Play becomes Play/Stop. While it plays, the chord sounding is highlighted in the progression, and its pad is outlined on the virtual J-6.

**Built on Sketchpad's scheduler.** The beats are found by `barsToSchedule` (`D-043`), the look-ahead scheduler Sketchpad's loop uses, with a beat as its unit. `j6/playback.mjs` says what each beat holds: a chord starting, a click, or the end. That is pure, so the count-in, the lengths, the loop and the accents are tested without audio. Options and the progression are read afresh on every beat, so a change while playing takes effect from the next beat.

**Not a sequencer.** No per-chord lengths, rests, steps, swing, rhythm patterns or saving. If a progression needs any of those, it is a job for Sketchpad's Create mode or a DAW.

### D-091 — J-6: the progression as a sheet, Sketchpad's, with the J-6 keys

**Context.** The progression could be seen and heard, but not taken away. The owner wanted to play progressions themselves, at a piano, and asked for Sketchpad's export with its toggle.

**Decision.** A **Sheet** card at the foot of Explore, hidden until shown, reuses Sketchpad's sheet (`D-057`): `sheetData` lays it out, `sheetAsText` writes it as text, the `Diagram` component draws the keys, and `PRINT_CSS` prints only the sheet. Its toggle is the same one, **suggested fingering** (`D-078`), off until ticked. The J-6 adds three things: each chord is drawn as the J-6's own voicing; the chord name keeps any slash bass; and every chord says where it is on the J-6 (set, KEY, key), on the sheet and at the end of the text. The sheet's scale is the one chosen to play along with (`D-092`), or the key's major scale. Nothing is new in the layout: if Sketchpad's sheet improves, so does this one.

### D-092 — J-6: two or three scales to play over the progression

**Context.** With the progression looping, the owner wanted to play notes over it on the piano, and asked to be offered "the scale we should play, like these two or three could work".

**Decision.** The Piano card offers three scales for the key the progression is in:

1. **The key's major scale.** Every note fits.
2. **Its major pentatonic.** Five notes and nothing to avoid, the easiest place to start.
3. **The relative minor's pentatonic.** The same five-note ease, darker and bluesier.

Both pentatonics lie inside the major scale, so all three sit under every chord in the key, and a test says so. A chord outside the key is named ("over B♭7 some of these notes will clash"), rather than the offer pretending to cover it. Choosing a scale puts its dots on the piano and its tonic as the home dot. The piano now spans the whole progression and holds still while it plays, lighting the chord sounding, so a melody can be played over the loop without the keys moving. Tapping a scale again turns it off.

**Not chosen: ranking every scale that fits.** Sketchpad's `fitScales` ranks ten scales, but over a diatonic progression its top answers are the same seven notes under different names (C major, D dorian, A minor…). That is more choice and no more information for someone who wants to play. Three fixed, different-sounding answers are the point.

### D-093 — J-6: a misprinted key is named from its notes

**Context.** A key marked **!** said that the manual's notes don't fit its chord name, but not what they are. The notes are what the J-6 plays if the manual is right about them, so they are worth naming.

**Decision.** `nameFromNotes` names a voicing the way the validator reads a label (`D-080`): a root that sounds, every note in the chord, missing tones allowed. A root in the bass outweighs two missing tones, because the J-6 often leaves out the fifth but keeps the root at the bottom. Then the simpler chord wins, in Sketchpad's dictionary order. It names 54 of the 56 misprinted keys: set 18's "E" makes Em, set 80's "Db7sus" makes D♭9sus4, set 3's "D7#9" makes E♭7♯9. The Now card says "The printed notes make Em." Sketchpad's own `identifyChord` was tried first. It names only exact chords, which found 23 of the 56, because the J-6's four voices so often leave a tone out.

**What building it found.** The page crashed on load, rendering nothing, because one new line used a value defined a few lines below it. This is the same class of bug as `D-063`, which gate G12 catches for Sketchpad's hooks. No unit test could see it; the headless run did. That run is still not a gate (`DONE.md`, exceptions).

### D-094 — J-6: the key a set plays in, on the panel and on the pads

**Context.** The owner couldn't see which key they were in, nor what the J-6's KEY did. The app had two "keys" with nothing tying them together: the J-6's KEY setting, a transposition, and the musical key on the Key card, worked out from the chords kept. Neither said what key the chord set itself was in.

**What the manual says** (*Using Chord Mode* and *Functions and Menus*, read 2026-10-07):
- **KEY** is SHIFT + the **[A (KEY)]** keyboard button. It "transposes the keyboard": turn [TEMPO/VALUE], then press [C (EXIT)]. The range isn't given.
- **trAn** in the menu, −12 to +12, is a different setting: it "transposes the sounds made by the sound generator".
- **Selecting a chord set** is SHIFT + [CHORD], then [TEMPO/VALUE], then [CHORD] to finish.
- **OCTAVE** is SHIFT + [C♯ (OCTAVE−)] or [D♯ (OCTAVE+)].

**Decision.**

1. **The panel names the key the set plays in** at the current KEY: "KEY +2 · fits G major / E minor · 8 of 12 pads". It is the major key most of the set's pads fit, with its relative minor beside it, because a set like 47 is built around C minor, which has the same notes as E♭ major. The count says how sure that is.
2. **The pads show the key.** The home chord is marked **I**, its closest relatives **IV** and **V**, and the relative minor's home **vi**, each only when all its notes are in the key. Turning KEY moves the key, and the marks stay on the same pads, because KEY moves every pad together.
3. **The control says what it is:** "KEY (transpose)", with the J-6's own button combination as its hint.
4. **Find's steps are the manual's,** replacing the prototype's guesses ("SHIFT + KEY, turn to −3"): SHIFT + [CHORD], turn [TEMPO/VALUE] to 47, press [CHORD]; SHIFT + [A (KEY)], turn [TEMPO/VALUE] to −3, press [C (EXIT)]; then the keys.

**From the panel itself** (the owner's photo of the J-6, 2026-10-07):
- **KEY isn't a separate button.** It is the second function printed under the A key, as the manual's "[A (KEY)]" says. The other white keys have second functions too: EXIT on C, ENTER on D, SHUFFLE on E, LAST on F, CLEAR on G, MENU on B and WRITE on the high C. The black keys are OCTAVE − and OCTAVE + and three blank.
- **The 8th white key is a high C,** which supports `D-083`. Whether it plays C's chord is still for the device to answer.
- **The display is four small digits.** The app's had been drawn far larger, taking a whole row. It is now the size of the J-6's own display, beside the set, and the key the set plays in has a line of its own.

**What building it found.** When two keys fitted a set equally well, the tie was broken by the lower note name. That answer doesn't move with KEY: set 12 at KEY −6 came out a fifth away from where the rest of its pads said it should be. The tie is now broken by distance from the first chord, which moves with KEY, and a test checks every set at every KEY. The prototype's assumption that set 54 was in C major was also wrong by count: more of its pads fit F major (8 against 7). The progression C C♯ G D♯ on it is still in C major, which the Key card says.

## 5. What this project has taught, so far

Five bug classes, and what actually fixed each.

| What went wrong | What it looked like | What fixed it |
|---|---|---|
| Analysis judged against the wrong scale | Confident, fluent, **false** explanations | Naming the two questions separately (`D-025`) |
| Scenario/test link rotted in one session | Everything green, nothing checked | Making drift fail the build (`D-026`) |
| Notes rang on and playback died | Three fixes that treated symptoms | Making the schedule a pure value (`D-031`) |
| Silence after ~30 notes | A leak inside a library I cannot test | Owning the voices; a budget is arithmetic (`D-038`) |
| Loop never started; a tab looked broken | No error, just nothing | Both failed *quietly*; now they say why (`D-039`) |
| Loop still never started | Untestable dependency, again | Taking the scheduler in-house (`D-043`) |
| Explanations twice as long as the rule allowed | Documents said one thing, product did another | Measuring it, then rewriting the copy (`D-051`) |
| Glissando did nothing despite passing tests, twice | Two wrong diagnoses in the untested shell | Removing the DOM assumptions entirely (`D-055`) |
| App showed nothing at all | A hook named a value defined below it | A static check on the shell (`D-063`) |
| The sampled piano was silent | A write-before-record race, and silence as a fallback | Record first, and always name a stand-in (`D-064`) |
| Every voicing of a big chord sounded alike | Each was derived from the previous choice | Derive from the chord, not from its current shape (`D-065`) |
| Audio scrambled and slowed over time | A synth built and destroyed per note | A pool, reused (`D-066`) |

**The pattern.** When a bug cannot be tested, the fix is not a cleverer patch — it is moving the decision out of the untestable layer into a pure function. Scheduling, voice budget and tab fallback all became testable that way.

**The corollary.** Testing one value of a thing that varies is how a bug hides. `D-025` survived because every test used the one scale where it is invisible; a fallback test passed because its loop began on the home chord. Both were caught by mutation, not by review.

---

## 6. Status

**Built and working:** key selection in all 24 keys · ten practice lessons judged on the piano (`D-073`) · piano with two visual channels · triads, sevenths and ninths · five voicings per chord · four instruments and a switchable echo · six chord sets with ready-made progressions · ten scales with playback up, down and shuffled · progression loop with tempo · seventeen bass and melody patterns across six styles, browsable or random · scale fitting · bass options and transitions · chord dictionary · inversions · explanations throughout · letters or Do-Re-Mi.

**Verified:** 330 automated checks, 81/81 mutants killed, 14/14 gates. 411 scenarios, about a quarter manual. `PLAYTEST.md` orders the manual ones for a real session. Feature-by-feature status against the original roadmap is in `FEATURES.md`.

**Known weak:** nothing is deployed, so offline operation is unverified · no persistence · no voice leading.

---

## 7. Next

In the order I would do them. Reasoning in `USE_CASES.md`.

| # | Work | Why now |
|---|---|---|
| 1 | ~~Deploy to a static host and install to the home screen~~ **packaged** (`D-076`); the first real session on the phone is still to come | Everything else is theoretical until it is on the phone in a session |
| 2 | ~~A better voice~~ **done** — four instruments and echo (`D-040`, `D-041`) | — |
| 3 | Save and recall sketches | The loop survives a reload but not a week |

| 4 | ~~Voice leading~~ **done** (`D-044`) | — |
| 5 | ~~Chord voicings~~ **done** (`D-042`) | — |
| 6 | MIDI export | Turns a sketch into a session |
| 7 | ~~Flats where a key needs them (E♭, not D#)~~ **done** (`D-074`) | — |
| 8 | Explore: one chord, every dial around it (`UC-60`) | The second of the three modes, and no new theory is needed (`D-072`) |
| 9 | A sketch code on the printed sheet, pasted back to restore it | Saving for Create before deployment (`D-072`) |

---

## 8. Open questions

1. Movable-do as a third naming option, alongside fixed-do? (`D-019`)
2. Swing. The grid is straight sixteenths and most target genres swing. (`D-022`)
3. Should figures follow the chord or the selected scale when they disagree? (`D-023`)
4. Does the Bone palette hold up at night, over a synth in a dark room? (`D-018`)
5. The app has no name.

---

## 9. Working rule

Documents change in the same pass as the code. A behaviour changed by something learned in use becomes a numbered decision *with the context that caused it*; a new capability gets a scenario before or alongside the code; a reversed decision is struck through, never deleted. `DONE.md` defines when a change is finished, and `node tools/check-done.mjs` measures the part of that a machine can judge.

## 10. Change log

| Date | Change |
|---|---|
| 2026-09-05 | Design and use cases written; Phases 1–5 built (key, piano, chords, scales, progression, explanations) |
| 2026-09-05 | `UC-00` promoted to primary use case; palette chosen (`D-018`); solfège added (`D-019`) |
| 2026-09-05 | Test approach established: Gherkin, extraction, traceability, mutation (`D-020`, `D-021`, `D-026`, `D-027`) |
| 2026-09-05 | Riffs and basslines (`D-022`–`D-024`); debt audit found `D-025` and 36 drifted scenario/test pairs |
| 2026-09-05 | `DONE.md` and `REQUIREMENTS.md` written; gates automated (`D-028`) |
| 2026-09-05 | Audio rebuilt around a planned bar (`D-031`); sharps greyed (`D-029`); voicing-accurate lighting (`D-033`) |
| 2026-09-05 | Five-tab restructure with chord sets, dictionary, inversions, bass tools (`D-035`, `D-036`) |
| 2026-09-06 | Audio chain simplified and made self-reporting (`D-037`); voice budget taken in-house (`D-038`); transport accessors and tab fallback (`D-039`) |
| 2026-09-06 | Documentation consolidated: 39 decisions split into settled and worth-reading; requirements renumbered |
| 2026-09-06 | Four instruments and a switchable echo (`D-040`, `D-041`); five voicings per chord (`D-042`); seven more bass and melody patterns, browsable. 135 checks, 33/33 mutants |
| 2026-09-06 | Custom chords and scales, style-led scale browsing, twelve chord sets, single octave control (`D-048`). 200 checks, 48/48 mutants |
| 2026-09-23 | Notes spelled the way the key writes them — flats on the flat side, alterations by scale degree, lessons in their own key (`D-074`); four explanations routed through the naming layer at last; sus2 restored to the chord table after a duplicate formula had silently replaced it, with a test that no formula is listed twice |
| 2026-09-23 | Three modes by intent — Explore, Learn, Create — replace the difficulty levels as the direction (`D-072`). Learn built first: ten lessons practised on the piano, judged note by note by a pure function, in any key, with next-key round the circle of fifths and one tap to send a lesson's progression to the loop (`D-073`). First headless run of the real shell: 21/21 |
| 2026-09-23 | Feedback that teaches how to think (`D-075`): wrong notes explained in counted keys and skips, a two-step hint that gives the method before the note, a take-away rule on every step checked against the notes in all twelve keys, and triad shapes by white and black keys |
| 2026-09-25 | Installable: the app packaged as a static site with a manifest, iOS home-screen tags and an offline service worker whose version is a fingerprint of the files, so a new upload replaces the old one on the next open (`D-076`, `UC-31`); sound with the iPhone on silent; the mutator now also breaks the packager |
| 2026-09-26 | Chord names typed in the Progression tab, read against the dictionary, refused with a reason when unknown, with the keys they fit (`D-077`, `UC-62`); 7sus4 and 9sus4 added; maj7 numerals no longer lowercase; the How to use guide explains the chord box |
| 2026-10-01 | Finger numbers (`D-078`, `UC-63`): suggested fingers on lit keys for the right hand, left hand or both, chords by rule and the 24 major and natural minor scales from a checked table, hand reach as a setting, two hands told apart by fill as well as colour, on by itself in Learn and optional on the printed sheet. Prototype and spec agreed first |
| 2026-10-05 | The build moved into the repository: `npm run build` and `npm run site` make the app and the installable site from the code alone, and a GitHub Actions workflow tests and publishes to Pages on every push (`D-076`) |
| 2026-10-06 | J-6 Explorer moved into the repository as a second app: its engine in `j6/`, its 12 tests in the suite, its prototype in `proto/j6/`, and its 15 scenarios in `sketchpad.feature` (`D-085`). The prototype's decisions are numbered `D-079`–`D-084`, and its two workflows are `UC-64` (Explore) and `UC-65` (Find). 426 checks |
| 2026-10-06 | J-6 shares Sketchpad's theory (`D-086`): its chord names, numerals and key detection now come from the theory layer, so chords are spelled the way their key writes them (F#m7 in D major, not G♭m7). Seven J-6 mutants added to the mutator |
| 2026-10-06 | The J-6 Explorer page (`D-087`, `UC-64`, `UC-65`): Explore and Find screens built from the agreed prototype, reusing Sketchpad's piano, sound and colour tokens, and published at `j6/` as a second installable app with its own icon and offline cache. G8 now also reads the J-6 page. 429 checks |
| 2026-10-06 | All 100 J-6 chord sets imported from the manual's page (`D-088`), with a reader for its 558 label spellings. Validation found 56 failing keys in 34 sets, now listed under `D-082` and pinned by a test; rootless voicings now count (`D-080`, amended); a failing key, not its whole set, is kept out of search (`D-082`, amended). Explore has a set picker and marks failing keys |
| 2026-10-06 | J-6 Explore: a tap plays, "+ Add" keeps, Rec keeps every tap and starts off; kept chords remember their set and KEY, can be played or removed; the key follows the progression; Find adds a result in one tap (`D-089`). Fixed: the set picker and long chord names made the page wider than a phone on 87 keys |
| 2026-10-06 | J-6: turning Rec off no longer hides what was recorded; the numbers stay on the pads until Clear (`D-089`, amended). The "!" message now says plainly that it marks a misprint in the manual |
| 2026-10-06 | J-6: the progression's × is no longer cut off, and pad names no longer are either: root above type, the type in lines of at most 7 characters, checked for every key, KEY and spelling (`D-089`) |
| 2026-10-06 | J-6 progression playback: tempo 60–160 BPM, ½, 1 or 2 bars a chord, Loop, and a click with a one-bar count-in; Play/Stop, with the sounding chord highlighted in the progression and on its pad. Scheduled by Sketchpad's look-ahead scheduler; what each beat holds is a pure function. Not a sequencer (`D-090`) |
| 2026-10-07 | J-6: the progression as Sketchpad's sheet, with suggested fingering and the J-6 keys for each chord (`D-091`); three scales offered to play over it, with the piano holding still under the loop (`D-092`); a misprinted key named from its notes (`D-093`). A crash on load from a value used before it was defined was caught by the headless run, not the tests |
| 2026-10-07 | J-6 manual read (KEY, chord sets, menus): the panel names the key a set plays in at the current KEY, with its relative minor; I, IV, V and vi are marked on the pads; KEY is labelled as a transposition; Find's steps are the manual's (`D-094`, `D-081` updated). Fixed: a tied key was broken from C rather than from the first chord, so it didn't move with KEY |
| 2026-10-07 | J-6 panel compacted after the owner's photo of the hardware: the set display is the size of the J-6's own four digits, and the set's key has a line of its own. The photo confirms KEY is the A key's second function and the 8th white key a high C (`D-094`, `D-083`) |
| 2026-09-15 | Sample coverage: thirteen recordings C1–C7 replace seven C2–C5; `R-230` was false and its test did not check it; coverage and the octave clamp moved into pure functions; duplicate check now compares audio, not headers; credit records the licence URI and that the samples were modified (`D-071`) |
| 2026-09-13 | Embedded recordings decoded in-app rather than fetched, because a data URI is still a request (`D-070`). 330 checks, 81/81 mutants |
| 2026-09-13 | Piano recordings embedded in the app: no network, works offline, default instrument again (`D-069`). 331 checks, 80/80 mutants |
| 2026-09-13 | Twenty-nine decisions (D-040 to D-068) were found missing from this file entirely: every insert had used an anchor that did not match. Reconstructed, and gate G13 added so a cited decision that was never written now fails the build |
| 2026-09-13 | Chord roll: notes laid down one at a time so a big voicing can be heard (`D-068`). 319 checks, 78/78 mutants |\n| 2026-09-13 | Voicings derived from the chord rather than the last choice (`D-065`); a reused voice pool instead of one synth per note (`D-066`); recorded sound no longer the default (`D-067`). 312 checks, 76/76 mutants |
| 2026-09-13 | Sampled piano fixed: it rebuilt itself on every note and never loaded; a stand-in now covers the wait (`D-064`) |
| 2026-09-13 | Fixed a temporal-dead-zone crash that stopped the app rendering at all; gate G12 added to catch the class statically (`D-063`) |
| 2026-09-12 | From first real use: C major default and major first, chords follow the octave (`D-060`), four reverb spaces (`D-061`), sampled grand piano and a Rhodes that is not a marimba (`D-062`). 299 checks, 72/72 mutants |
| 2026-09-12 | Eleven extended qualities with signature voicings, and two wide chord sets (`D-059`). 289 checks, 70/70 mutants |
| 2026-09-12 | Three levels replace the beginner/producer toggle after feedback that the first screen was overwhelming (`D-058`). 288 checks, 68/68 mutants |
| 2026-09-06 | Printable sheet with chord diagrams, scale and bass (`D-057`). 271 checks, 66/66 mutants |
| 2026-09-06 | Melody guide, what-changed rings and the adventurousness slider (`D-056`). 253 checks, 63/63 mutants |
| 2026-09-06 | Glissando, third attempt: key lookup became geometry and events moved to the window, removing every DOM assumption (`D-055`). 234 checks, 60/60 mutants |
| 2026-09-06 | Glissando fixed for real: the scroll container was cancelling the gesture; the strip moved out of the keyboard, which now refuses panning (`D-054`) |
| 2026-09-06 | Glissando: pointer handling moved to the keyboard so a finger can roll across keys (`D-053`). 231 checks, 58/58 mutants |
| 2026-09-06 | Multi-touch on the piano: held notes tracked as a set, capped at eight, keys own their touches and a strip above them scrolls (`D-052`). 222 checks, 56/56 mutants |
| 2026-09-06 | Explanation cap measured, found broken in two thirds of cases, and fixed by rewriting the copy (`D-051`); dead component removed and the figure explanation restored. 213 checks, 53/53 mutants |
| 2026-09-06 | "How to use" tab: nine sections as data, with a test that no tab can ship undocumented (`D-050`). 209 checks, 51/51 mutants |
| 2026-09-06 | Pre-play-test reading pass: saved scales did not light the piano, tapping a voicing played the previous one, held notes survived a tab change (`D-049`). `PLAYTEST.md` written. 203 checks, 50/50 mutants |
| 2026-09-06 | Definition-of-Done audit: `USE_CASES.md` was nine use cases behind and listed three built features as future work. Fixed, and gate G11 added so the drift fails the build. One mutant gap closed. 49/49 mutants, 12/12 gates |
| 2026-09-06 | Reverse search in a Find tab, arpeggios, smoothest-voicing selection (`D-047`); palette follows the chosen scale and note labels pinned (`D-046`). 182 checks, 45/45 mutants |
| 2026-09-06 | Loop scheduler taken in-house (`D-043`); compatibility suggestions, harmonisation walkthrough, voice leading and next-chord suggestions (`D-044`); piano scrolls and sustains (`D-045`); `FEATURES.md` added. 160 checks, 39/39 mutants |

## 11. Document set

| Document | Purpose |
|---|---|
| `DESIGN.md` | This file: intent, architecture, decisions, lessons, status |
| `USE_CASES.md` | What the user does, and what should happen |
| `REQUIREMENTS.md` | Numbered, verifiable statements traced to decisions and scenarios |
| `sketchpad.feature` | Gherkin scenarios, tagged `@auto` or `@manual` |
| `FEATURES.md` | Feature-by-feature status against the original roadmap |
| `PLAYTEST.md` | The manual scenarios, ordered for a real session |
| `DONE.md` | Definition of Done: gates, thresholds, exceptions |
| `tests/` | Automated checks and the traceability guard |
| `tools/` | Theory extraction, mutation testing, the gate runner |
