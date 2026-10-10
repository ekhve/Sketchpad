# Core modules

What each module of the core asset base is for, what it promises, and its interface. One section per module; the layout, rules and decisions behind them are in [DESIGN.md](DESIGN.md), the requirements in [REQUIREMENTS.md](REQUIREMENTS.md), and how it is all verified in [VERIFICATION.md](VERIFICATION.md).

The line under each heading is checked against the code by `tools/core-check.mjs` (gates C2 and C3): the layer is the longest chain of imports below the module, *Depends on* is what it imports, *Used by* is every module and app that imports it, and the interface table lists exactly what it exports. A change that makes this document wrong fails the build, so the document can be trusted.

**Conventions.** A *pitch class* is 0–11, a *note* a MIDI number (60 is middle C). A *naming system* is `"letters"`, `"solfege"` or a spelling from `core/notes`. A *chord* is `{ rootPc, sym, full, notes, base, … }` with `notes` ascending MIDI numbers. Time is in seconds; a bar is sixteen steps. Every function is pure: the same arguments give the same answer, and an argument is never changed (CD-002).

## core/notes

**Layer** 0 · **Depends on** nothing · **Used by** core/bass, core/chords, core/chordsets, core/explain, core/figures, core/fingering, core/harmony, core/keyboard, core/melody, core/scales, core/sheet, core/symbols, core/voicing, j6, sketchpad, sketchpad/lessons, sketchpad/model

**Purpose.** Names for the twelve pitch classes and the arithmetic that goes with them: wrapping any note into one octave, which keys are white, and how a key spells its notes. Everything else in the asset base builds on it.

**Behaviour.** A pitch class is a whole number 0–11, a note a MIDI number. `pc` wraps any number into 0–11 (negative included). The two name tables give sharps (`NAMES`) or Do-Re-Mi (`SOLFEGE`); `FLAT_NAMES` the flat spellings. A *naming system* is `"letters"`, `"solfege"`, or a *spelling* object from `spelling()` which names the twelve notes the way one key writes them (E♭ in C minor, D♯ in B major). `noteName` and every function that takes a `system` accept any of the three. The spelling rule is the key's own letters: ♭3 ♭6 ♭7 and ♯4 in a major key, ♮6 ♮7 in a minor one. One limit is recorded: F♯ major and D♯ minor use six letters, because a seventh would need E♯ (CD-007).

**Requirements.** CR-NOTES-01 … CR-NOTES-08 (8) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/notes.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `FLAT_NAMES` | data | — | Flat names by pitch class. |
| `NAMES` | data | — | Sharp names, C … B, by pitch class. |
| `SOLFEGE` | data | — | Do-Re-Mi names by pitch class. |
| `WHITE_PCS` | data | — | The pitch classes of the white keys. |
| `baseOf` | function | `(system)` | Whether a naming system writes letters or Do-Re-Mi. |
| `isWhite` | function | `(m)` | True for the seven white keys, in any octave. |
| `keyNames` | function | `(tonic, mode = "major")` | All twelve notes spelled the way one key writes them. |
| `leansFlat` | function | `(tonic, mode)` | Whether a key is written with flats. |
| `noteName` | function | `(m, system)` | A note's name in a naming system. |
| `pc` | function | `(m)` | Wrap any note into 0–11. |
| `spelling` | function | `(system, tonic, mode = "major")` | A naming system for one key: the base system plus the key's own spellings. |

## core/piano-samples

**Layer** 0 · **Depends on** nothing · **Used by** core/instruments

**Purpose.** The built-in grand piano recordings, embedded as data so an app works with no network.

**Behaviour.** Thirteen mono recordings, every six semitones from C1 to C7, each a data URI of about 11 kB. Salamander Grand Piano by Alexander Holm, CC-BY 3.0, shortened and re-encoded; `core/instruments` carries the credit.

**Requirements.** CR-PIANOSAMPLES-01 … CR-PIANOSAMPLES-02 (2) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/instruments.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `PIANO_SAMPLES` | data | — | Recording name to data URI. |

## core/instrument-samples

**Layer** 0 · **Depends on** nothing · **Used by** core/instruments

**Purpose.** The recordings of the string section and the vibraphone, embedded as data so an app works with no network.

**Behaviour.** Seven mono recordings of a string section (cello and viola, sustained, from G2 to B5) and six of a vibraphone (soft mallets, from F3 to E6), each a data URI of about 7 to 25 kB. Both are CC0 (VSCO 2 Community Edition, Versilian Community Sample Library), shortened, levelled and re-encoded by `tools/make-instrument-samples.mjs`; the credits are kept here and shown by the app though CC0 asks for none (D-109).

**Requirements.** CR-INSTRUMENTSAMPLES-01 … CR-INSTRUMENTSAMPLES-03 (3) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/instruments.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `STRINGS_SAMPLES` | data | — | Recording name to data URI, the string section. |
| `VIBES_SAMPLES` | data | — | Recording name to data URI, the vibraphone. |
| `SAMPLE_CREDITS` | data | — | The line of credit for each recorded instrument, by instrument id. |

## core/playback

**Layer** 0 · **Depends on** nothing · **Used by** core/arpeggio, core/transport, sketchpad

**Purpose.** The arithmetic of playing sound, with no audio library: the look-ahead scheduler, bar length from tempo, the voice budget and its reaping, and rolling a chord.

**Behaviour.** A scheduler is a question about time, and time is arithmetic: `barsToSchedule` returns every bar starting inside the look-ahead window, once, in order, never in the past, and never more than 32 at a call (CD-002). The voice budget (24) is arithmetic too: how long a voice lives, which are finished, how many can start, which to reuse.

**Requirements.** CR-PLAYBACK-01 … CR-PLAYBACK-09 (9) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/playback.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `MAX_VOICES` | data | — | The voice budget: 24. |
| `ROLL_STYLES` | data | — | Together, Roll and Slow roll. |
| `allocatable` | function | `(liveCount, requested, max = MAX_VOICES)` | How many of the requested notes the budget has room for. |
| `barSecondsAt` | function | `(bpm, beats = 4)` | A bar's length in seconds from the tempo. |
| `barsToSchedule` | function | `({ nextBarAt, barIndex }, now, lookahead, barSeconds)` | The bars inside the look-ahead window, and the cursor after them. |
| `pickVoiceIndex` | function | `(busyUntil, now)` | Which pooled voice the next note should use. |
| `reapVoices` | function | `(voices, now)` | Split voices into still sounding and finished. |
| `rollOffsets` | function | `(count, spread, maxTotal = 0.5)` | When each note of a rolled chord starts. |
| `rollStyleById` | function | `(id)` | A roll style by id, the first as fallback. |
| `voiceLifetime` | function | `(seconds, release = 0.4, margin = 0.25)` | How long until a voice can be thrown away. |

## core/chords

**Layer** 1 · **Depends on** core/notes · **Used by** core/chordsets, core/explain, core/harmony, core/sheet, core/symbols, core/voicing, j6, sketchpad, sketchpad/lessons

**Purpose.** What a chord is: the quality tables, the dictionary of chord types with their intervals, naming a chord for display, and naming a set of notes (any notes, in any order) as chords.

**Behaviour.** `QUALITIES` and the `DICTIONARY` are the two sources of names; `SIGNATURES` merges them, so a set of notes is named the same wherever it is asked. `identifyChord` returns every reading of the notes, best first, in one shape. It has two levels of tolerance (CD-014): *exact* (the default), where the notes are a chord, a root-position reading outranks an inversion and two notes are named as an interval; and `{ missing: true }`, where the notes are part of a chord and tones may be absent, as when a hardware chord key leaves out the fifth but keeps the root at the bottom: the root in the bass then outweighs two missing tones, and the simpler chord (the dictionary's order) wins. It never invents a name: notes with no reading give an empty list. `customChordFrom` makes a chord of your own from a selection, named if it can be.

**Requirements.** CR-CHORDS-01 … CR-CHORDS-15 (15) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/chords.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `DEGREE_NAMES` | data | — | A name for each interval used in a formula (1, ♭3, 5 …). |
| `DICTIONARY` | data | — | Every chord type: symbol, name, intervals, a plain description, sometimes a signature voicing. |
| `QUALITIES` | data | — | Chord names keyed by interval signature (the first, simpler table). |
| `SIGNATURES` | function | `(()` | Every interval signature either table can name. |
| `chordLabel` | function | `(rootPc, sym, system)` | A chord's display name: root and quality in a naming system. |
| `customChordFrom` | function | `(midis, name)` | A chord of your own from a selection of notes. |
| `identifyChord` | function | `(midis, system = "letters", { missing = false } = {})` | Name a set of notes: every reading, best first; exact, or with tones allowed to be missing. |
| `inversions` | function | `(chord)` | A chord's inversions, each with the reason it sounds as it does. |

## core/figures

**Layer** 1 · **Depends on** core/notes · **Used by** core/arpeggio, core/bass, core/sheet, sketchpad

**Purpose.** Rhythm as authored intent with pitch chosen by rule: bass lines and riffs from patterns, planned bar by bar into events — notes with a start, a length and a velocity. The seam between *what to play* and *any instrument or MIDI file*.

**Behaviour.** A *pattern* says rhythm and role ("root on 1, chord tone on the and-of-2, approach the next chord") and nothing about pitch; the *rules* resolve each role to a note from the chord, the next chord and the scale (CD-003). Generation is seeded: same seed, same figure, no randomness anywhere. `planBar` turns a bar into events in seconds, with no two notes on one voice overlapping; `planIsClean` checks that. Known limit: the 50 ms floor on a note's length can overlap the next note at a bar of half a second (480 BPM), beyond any tempo the apps offer (CD-007).

**Requirements.** CR-FIGURES-01 … CR-FIGURES-13 (13) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/figures.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `PATTERNS` | data | — | The authored rhythms, bass and melody. |
| `STEPS_PER_BAR` | data | — | Sixteen steps (sixteenth notes) to a bar. |
| `STYLES` | data | — | The six styles patterns are tagged with. |
| `VELOCITY` | data | — | The mix: chords sit under the melody. |
| `VOICES` | data | — | The three voices: chord, bass, riff. |
| `explainFigure` | function | `(pattern, figure, system = "letters")` | A figure in plain language. |
| `patternsFor` | function | `(kind, style)` | The patterns of a kind that suit a style. |
| `place` | function | `(pitchClass, near)` | The note with a pitch class nearest to a reference. |
| `planBar` | function | `({ chordNotes = [], bassFigure = [], riffFigure = [], sixteenth, barSeconds, gap = 0.05 })` | A bar as events in seconds, never overlapping on a voice. |
| `planIsClean` | function | `(events, barSeconds)` | Whether a plan has no overlap and nothing outside the bar. |
| `renderFigure` | function | `(pattern, chord, nextChord, scaleSet, seed, center)` | One pattern over one chord: notes with position, length and role. |
| `renderProgressionFigure` | function | `(pattern, progression, scaleSet, seed, center)` | A figure for every chord, each leaning into the next. |
| `rng` | function | `(seed)` | A seeded random generator: same seed, same sequence. |

## core/instruments

**Layer** 1 · **Depends on** core/instrument-samples, core/piano-samples · **Used by** sketchpad, sketchpad/model

**Purpose.** Instrument presets as data, delay and reverb settings, and the built-in piano's range and sample coverage, so an audio layer builds from data and holds no opinions.

**Behaviour.** Seven presets, three of them recordings (the grand piano, strings and a vibraphone) with a synth to stand in until they are decoded; each says how to build it (`kind`, `options`, and an optional `chain` of its own effects: a filter, a chorus, a tremolo), how long it rings (`release`, which feeds the voice budget) and whether it wants echo. Echo has three levels: off, light (a quick, quiet repeat gone almost at once, the default) and long (D-107). The keyboard's range is checked against the recordings' coverage: no note is farther than three semitones from one (CD-007 records why this check exists).

**Requirements.** CR-INSTRUMENTS-01 … CR-INSTRUMENTS-10 (11) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/instruments.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `ECHO_LEVELS` | data | — | Off, Light (the default) and Long. |
| `HIGHEST_START_MIDI` | data | — | The highest note the keyboard can start from. |
| `INSTRUMENTS` | data | — | The five presets. |
| `KEYBOARD_OCTAVES` | data | — | Four octaves on screen. |
| `PIANO_RANGE` | data | — | The lowest and highest notes the piano plays. |
| `SPACES` | data | — | Dry, Room, Hall, Cave. |
| `base64Payload` | function | `(uri)` | The data part of an embedded data URI. |
| `delaySettings` | function | `(instrumentId, level)` | Echo settings for an instrument at a level: off, light or long. |
| `instrumentById` | function | `(id)` | A preset by id, the first as fallback. |
| `payloadBytes` | function | `(uri)` | The size of an embedded payload, without decoding it. |
| `payloadToBytes` | function | `(uri)` | An embedded payload as the bytes it holds, ready for the audio decoder. |
| `reverbSettings` | function | `(spaceId)` | Reverb settings for a space. |
| `sampleAnchors` | function | `(samples = PIANO_SAMPLES)` | The notes the recordings are at, ascending. |
| `sampleMidi` | function | `(name)` | A recording's note name as a MIDI number. |
| `stretchAt` | function | `(midi, anchors = sampleAnchors())` | How far a note is from its nearest recording. |
| `worstStretch` | function | `(anchors = sampleAnchors(), lo = PIANO_RANGE.lowest, hi = PIANO_RANGE.highest)` | The farthest any playable note is from a recording. |

## core/keyboard

**Layer** 1 · **Depends on** core/notes · **Used by** sketchpad

**Purpose.** The logic of a piano keyboard on a touch screen: the role a key plays, fingers held, a finger sliding across keys, and the key under a point.

**Behaviour.** All bookkeeping, so all testable without a screen. A key's role is the first that applies: sounding, bass, chord root, chord tone, in the loop, plain; matched on the actual note, not the pitch class. `slideTo` tracks which note each finger is over, so a key held by two fingers keeps sounding until both leave. `keyAtPosition` answers *which key is under this point* from the layout alone.

**Requirements.** CR-KEYBOARD-01 … CR-KEYBOARD-10 (10) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/keyboard.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `MAX_HELD` | data | — | Eight notes at once. |
| `heldAfterDown` | function | `(held, midi, max = MAX_HELD)` | The held set after a key goes down. |
| `heldAfterUp` | function | `(held, midi)` | The held set after a key goes up. |
| `keyAtPosition` | function | `(x, y, width, height, startMidi, octaves = 4)` | The key under a point, from geometry alone. |
| `keyMarker` | function | `(midi, { tonic, scaleSet = [] })` | Whether a key is home or in the scale. |
| `keyRole` | function | `(midi, { chordNotes = [], chordRootMidi = -1, loopNotes = [], sounding = [], bass = [] })` | A key's role: sounding, bass, chordRoot, chordTone, inLoop or plain. |
| `notesUnderFingers` | function | `(active)` | The notes under all fingers, once each. |
| `slideTo` | function | `(active, pointerId, midi)` | What a finger moving to a key presses and releases. |

## core/melody

**Layer** 1 · **Depends on** core/notes · **Used by** core/explain, sketchpad

**Purpose.** Which notes of a scale land well, move through, or pull against a chord, and which notes changed between two chords. For anything that plays a tune over harmony.

**Behaviour.** A pitch is *stable* if the chord holds it, *movement* if only the scale does, *tension* if neither. `melodyGuide` sorts the twelve pitch classes into the three roles for one chord and one scale. With no chord nothing is stable.

**Requirements.** CR-MELODY-01 … CR-MELODY-05 (5) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/melody.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `MELODY_ROLES` | data | — | Each role's label and reason. |
| `changedNotes` | function | `(before, after)` | Which pitch classes came in, went out and stayed between two note sets. |
| `melodyGuide` | function | `(chord, scaleSet)` | The twelve notes of an octave sorted into the three roles. |
| `melodyRole` | function | `(pitch, chordPcs, scaleSet)` | A pitch's role over a chord: stable, movement or tension. |

## core/scales

**Layer** 1 · **Depends on** core/notes · **Used by** core/explain, core/fingering, core/harmony, core/sheet, core/styles, j6, sketchpad, sketchpad/lessons

**Purpose.** The scale catalogue, and the questions asked of it: the notes of a scale in any key, which scales fit a set of notes, which keys contain them, and scales of your own.

**Behaviour.** Ten built-in scales, each an interval list from the tonic, with a mood and style tags. A scale of your own (five to eight different notes) has the same shape and answers the same questions, so an app never branches on where a scale came from. `activeScalePcs` is that rule in one call.

**Requirements.** CR-SCALES-01 … CR-SCALES-08 (8) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/scales.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `SCALES` | data | — | The ten built-in scales. |
| `activeScalePcs` | function | `(customScale, tonic, scaleId)` | The notes to show: the scale of your own if there is one, else the built-in. |
| `customScaleFrom` | function | `(midis, name, tonicPc = null)` | A scale of your own from five to eight notes. |
| `customScalePcs` | function | `(def)` | A scale of your own's pitch classes. |
| `fitScales` | function | `(progression, tonic)` | The five scales that hold most of a progression's notes, with what each misses. |
| `keysContaining` | function | `(midis)` | Every major or natural-minor key that holds all the given notes. |
| `scaleById` | function | `(id)` | A scale by id, or nothing. |
| `scalePcs` | function | `(tonic, id)` | A scale's pitch classes from a tonic. |
| `scalesContaining` | function | `(midis, limit = 6)` | Scales, in any key, that hold all the notes, tightest fit first. |

## core/transport

**Layer** 1 · **Depends on** core/playback · **Used by** j6, sketchpad

**Purpose.** Playing a progression over time, for any app that loops: tempo, bars per chord, loop, a click with a count-in, and the driver that keeps asking the look-ahead scheduler what is due. Not a sequencer.

**Behaviour.** `beatAt` says what each beat of a play-through holds: which chord starts, whether the click sounds and how strongly, or that a single pass is over; with the click on, one bar is counted in first. `createDriver` is the loop both apps used to write by hand: it ticks at once and then on a timer, hands each due unit (a bar or a beat) to the app once and in order, reads the unit length on every tick so a tempo change takes effect on the next unit, and stops when the app returns `"end"`. The clock and the timer are *arguments* (`now`, `every`, `cancel`), so the module touches nothing itself (CD-002) and a test steps time by hand (CD-013). The driver is stateful; its contract is checked with a fake clock rather than by the same-input rule.

**Requirements.** CR-TRANSPORT-01 … CR-TRANSPORT-15 (15) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/transport.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `LENGTHS` | data | — | Half a bar, one bar, two bars per chord. |
| `OPTIONS` | data | — | The default options: 90 BPM, one bar, loop on, click off. |
| `TEMPO` | data | — | 60–160 BPM in steps of 5, starting at 90. |
| `advance` | function | `(cursor, now, lookahead, unitSeconds)` | The units due inside the look-ahead window, and the cursor after them. |
| `beatAt` | function | `(n, count, { bars, loop, click })` | What beat n of a play-through holds. |
| `beatSeconds` | function | `(bpm)` | A beat's length in seconds. |
| `chordSeconds` | function | `({ bpm, bars })` | How long a chord sounds: its length less a breath. |
| `createDriver` | function | `({ now, every, cancel })` | A look-ahead loop over an injected clock and timer. |
| `loopIndex` | function | `(unit, length)` | Which chord a unit lands on, round and round. |
| `setTempo` | function | `(bpm)` | Bring a tempo into range and to a whole number. |
| `startCursor` | function | `(now, lead = 0.15)` | Where a play-through starts: a little ahead of now. |

## core/bass

**Layer** 2 · **Depends on** core/figures, core/notes · **Used by** sketchpad

**Purpose.** Bass under a chord: the ranked options (root, fifth, third, seventh, passing) and the transitions from one chord's bass to the next. Usable under any instrument.

**Behaviour.** The options always start with the root, then the fifth, third and seventh the chord has, then the scale's other notes as passing notes; no pitch class is offered twice. A transition ends on the next chord's root: direct, a walk through the scale where there is a gap, an approach from the next chord's fifth, or a slide from a semitone below.

**Requirements.** CR-BASS-01 … CR-BASS-06 (6) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/bass.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `BASS_PARAGRAPH` | data | — | The explanation of scale, chord and bass for the app to show. |
| `bassOptions` | function | `(chord, scaleSet)` | What the bass can play under a chord, each with its role and why. |
| `bassTransitions` | function | `(from, to, scaleSet)` | Ways of getting from one chord's bass to the next. |

## core/explain

**Layer** 2 · **Depends on** core/chords, core/melody, core/notes, core/scales · **Used by** sketchpad

**Purpose.** Plain-language explanations: why a chord works in a key, how a progression moves, and what changed between two chords.

**Behaviour.** Two different questions are kept apart: *is this chord in the key* (judged against the parent scale) and *are its notes in the palette the user picked* (a softer question). An explanation is at most two sentences (CD-006). A progression is explained as a loop, including the move from the last chord back to the first.

**Requirements.** CR-EXPLAIN-01 … CR-EXPLAIN-06 (6) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/explain.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `describeChange` | function | `(before, after, system = "letters")` | What came in, went out and stayed between two sets of notes, in one sentence. |
| `explainChord` | function | `(chord, ctx, system = "letters")` | A chord in a key: its role, what it shares with home, and any note outside the key or the palette. |
| `explainProgression` | function | `(prog, ctx, system = "letters")` | A progression's shape and what moves between each pair, as a loop. |

## core/fingering

**Layer** 2 · **Depends on** core/notes, core/scales · **Used by** core/sheet, sketchpad

**Purpose.** Suggested finger numbers: chords by rule, scales from a checked table, hand reach and crossings. Suggested, never checked.

**Behaviour.** 1 is the thumb, 5 the little finger, in either hand. Chords are fingered by rule (the middle finger of a triad is 3, or 2 when the top gap is a fourth or more). Scales are looked up from a table checked against published sources. A chord one hand cannot reach is split, the left taking as few notes as it can, or called too wide. A run the table cannot answer gets no fingering rather than a guess.

**Requirements.** CR-FINGERING-01 … CR-FINGERING-14 (14) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/fingering.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `DEFAULT_REACH` | data | — | An octave: 12 keys. |
| `FINGER_COPY` | data | — | The words used around a fingering. |
| `FINGER_HANDS` | data | — | off, right, left, both. |
| `HAND_REACH` | data | — | Seventh, octave, ninth, tenth. |
| `SCALE_FINGERING` | data | — | One-octave fingerings for every major and minor scale, both hands. |
| `effectiveFingerHand` | function | `(choice, tab)` | Which hand's fingers show: the choice, else right in Learn, else none. |
| `fingerChord` | function | `(chordNotes, { hand = "right", reach = DEFAULT_REACH, rootPc = null, bassPc = null } = {})` | Which hand plays which note of a chord, with which finger. |
| `fingerCrossings` | function | `(fingers, hand, direction = "up")` | Where the hand must tuck under or cross over. |
| `fitsHand` | function | `(notes, reach)` | Whether notes lie within one hand's reach. |
| `handFingers` | function | `(notes, hand)` | Fingers for up to five notes in one hand. |
| `litLessonFingers` | function | `(fingering, step, attempt, shown, hint)` | The fingers to show for a lesson's lit keys. |
| `scaleFingering` | function | `(midis, mode, hand)` | A one-octave run fingered from the table, up or down. |
| `stepFingering` | function | `(step, mode, hand = "R", reach = DEFAULT_REACH, system = "letters")` | The fingering a lesson step suggests, as keys and one line of words. |

## core/styles

**Layer** 2 · **Depends on** core/scales · **Used by** sketchpad

**Purpose.** Style as a way in: which scales and chord colours suit an intention such as hip-hop, soul or funk.

**Behaviour.** A style is a name with a note and a list of chord colours. `scalesForStyle` splits the scales of a mode into those tagged for the style and the rest, so nothing is hidden, only ordered. An unknown style suits nothing and fails nothing.

**Requirements.** CR-STYLES-01 … CR-STYLES-04 (4) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/styles.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `STYLE_COLOURS` | data | — | Six styles: the chord colours that suit each, and a sentence on what it is going for. |
| `scalesForStyle` | function | `(style, mode)` | The scales of a mode, those tagged for the style first. |

## core/symbols

**Layer** 2 · **Depends on** core/chords, core/notes · **Used by** j6, sketchpad

**Purpose.** Reading chord names as people write them in charts: root, quality, slash bass, in letters or Do-Re-Mi, with the spellings charts use mapped onto the dictionary.

**Behaviour.** A name is read only if the dictionary can voice it, so a typed chord sounds exactly like the same chord picked from a list. Anything else is refused with a reason that says why; the nearest chord type is *offered*, never applied (CD-005). A line is split on spaces, commas and bar lines. Known limit: `C#5` reads as C♯ with an unknown `5`, so the alias `#5` is unreachable (CD-007).

**Requirements.** CR-SYMBOLS-01 … CR-SYMBOLS-10 (10) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/symbols.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `CHORD_ALIASES` | data | — | Chart spellings mapped onto dictionary names. |
| `TYPING_CHIPS` | data | — | Buttons that type the awkward characters on a phone keyboard. |
| `nearestSuffix` | function | `(suffix)` | The dictionary chord type nearest to an unknown one. |
| `parseChordName` | function | `(text, system = "letters")` | Read one chord name: a chord, or a refusal with its reason. |
| `parseChordNames` | function | `(line, system = "letters")` | Read a line of chords. |
| `typedLabel` | function | `(c, system)` | A typed chord's name as the app writes it, with its slash bass. |

## core/voicing

**Layer** 2 · **Depends on** core/chords, core/notes · **Used by** core/arpeggio, core/chordsets, core/harmony, sketchpad, sketchpad/lessons

**Purpose.** Putting a chord's intervals into actual notes: the octave they sit in, the ways one chord can be arranged, arpeggios, and choosing the arrangement that moves least from the last chord.

**Behaviour.** A *voicing* is an arrangement of a chord's notes: close, signature, open, spread, rootless, shell. They are derived from the chord's own octave and close position, never from the arrangement it is wearing (CD-004), so choosing one does not change the next list. `voiceLeading` says which notes stay, which move and how far between two chords; `smoothestVoicing` ranks every arrangement of the next chord by how little it moves from the last.

**Requirements.** CR-VOICING-01 … CR-VOICING-10 (10) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/voicing.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `DEFAULT_BASE` | data | — | The default octave: C3, MIDI 48. |
| `arpeggio` | function | `(notes, direction = "up")` | The notes one at a time: up, down or up and back. |
| `dictionaryFor` | function | `(rootPc, base = DEFAULT_BASE)` | Every dictionary chord on a root, voiced in an octave. |
| `smoothestVoicing` | function | `(from, to, system = "letters")` | The arrangement of the next chord that moves least from the last, with the alternatives. |
| `stackAscending` | function | `(tones, rootPc)` | Stack tones upward so a 9th stays above the 7th. |
| `voice` | function | `(rootPc, intervals, base = DEFAULT_BASE)` | Intervals placed above a root in an octave. |
| `voiceLeading` | function | `(from, to, system = "letters")` | Which notes stay, which move, how far, how smooth. |
| `voicingsFor` | function | `(chord)` | The arrangements of a chord: close, signature, open, spread, rootless, shell. |

## core/arpeggio

**Layer** 3 · **Depends on** core/figures, core/playback, core/voicing · **Used by** sketchpad, sketchpad/model

**Purpose.** How a set of notes is played in time: all at once, rolled, or one at a time up, down, up and back, or at random. One setting for chords and for scales, so a pattern is chosen once and means the same everywhere (and, later, in a sequencer).

**Behaviour.** Seven ways to play: the three ways to strike a chord from `core/playback` (together, roll, slow roll) and four runs (up, down, up & down, random). `playPlan` turns notes and a way into `[{ midi, at }]`, seconds from the first note: a chord struck low to high with its roll offsets, or run through at a step of 0.12 s for a chord and 0.26 s for a scale. A scale can only run, so a chord style given to a scale runs up, and a random run of a scale ends on its top note. Random is seeded: the same seed gives the same order (CD-002). Up, down and up-and-down are `core/voicing`'s `arpeggio`; nothing is written twice.

**Requirements.** CR-ARPEGGIO-01 … CR-ARPEGGIO-08 (8) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/arpeggio.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `PLAY_PATTERNS` | data | — | The seven ways to play notes, with a name, a note and a kind (chord or run). |
| `RUN_STEP` | data | — | Seconds between the notes of a run: 0.12 for a chord, 0.26 for a scale. |
| `isRun` | function | `(id)` | Whether a way runs through the notes one at a time. |
| `patternById` | function | `(id)` | A way to play by id, the first as fallback. |
| `playPlan` | function | `(notes, id, { seed = 1, kind = "chord" } = {})` | When each note starts, for a chord or a scale, in a way. |
| `runOrder` | function | `(notes, id, { seed = 1, endOn = false } = {})` | The notes in the order a run plays them. |

## core/chordsets

**Layer** 3 · **Depends on** core/chords, core/notes, core/voicing · **Used by** sketchpad

**Purpose.** Genre chord sets: eight chords and a ready-made four-chord progression per set, authored once and built in any key.

**Behaviour.** A set is authored in C as `[offset, quality]` slots and a progression of slot numbers. `buildSet` builds it on any tonic and in any octave; the progression is made of the same chord objects as the slots, not copies. Sets are listed by mode.

**Requirements.** CR-CHORDSETS-01 … CR-CHORDSETS-05 (5) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/chordsets.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `CHORD_SETS` | data | — | Fourteen sets: eight slots and a four-chord progression each. |
| `buildSet` | function | `(setDef, tonicPc, base = DEFAULT_BASE)` | A set built on a tonic: its chords and its progression. |
| `setsFor` | function | `(mode)` | The sets of one mode. |

## core/harmony

**Layer** 3 · **Depends on** core/chords, core/notes, core/scales, core/voicing · **Used by** j6, sketchpad, sketchpad/lessons

**Purpose.** Chords in a key: the diatonic chords of a scale, their roman numerals, harmonising a custom scale, suggesting a scale or the next chord, borrowed chords and tension levels, and typed chords placed in a key.

**Behaviour.** `harmonize` builds a chord on each note of a seven-note scale from the scale's own notes, stacked in thirds, ascending (CD-004 for the octave). Numerals are measured against the major scale, so a minor key shows its flats (♭III, ♭VI, ♭VII) and the case follows the chord's quality. Chords outside the key are not mistakes: `suggestScaleFor` names the scale they come from. `suggestNextChords` ranks by how the harmony behaves (a fourth up, shared notes, going home). `chordsAtTension` adds borrowed chords from level 2.

**Requirements.** CR-HARMONY-01 … CR-HARMONY-11 (11) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/harmony.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `BORROWED` | data | — | Chords beyond the key, per mode, and why each is worth trying. |
| `TENSION_LEVELS` | data | — | Four levels from Safe to Adventurous. |
| `chordsAtTension` | function | `(tonic, mode, level, base = DEFAULT_BASE)` | The chords on offer at a tension level. |
| `harmonize` | function | `(tonic, scaleId, size, base = DEFAULT_BASE)` | The diatonic chords of a named scale: triads, sevenths or ninths. |
| `harmonizeCustom` | function | `(def, size = 3, base = DEFAULT_BASE)` | The diatonic chords of a scale of your own. |
| `harmonizeIntervals` | function | `(tonic, iv, size, idPrefix = "custom", base = DEFAULT_BASE)` | The diatonic chords of any seven-note interval set. |
| `harmonizeSteps` | function | `(tonic, scaleId, degreeIndex, size = 3, system = "letters")` | Building one chord out of a scale, a step at a time. |
| `romanFor` | function | `(tonic, rootPc, degreeIndex, sym)` | A chord's roman numeral in a key. |
| `suggestNextChords` | function | `(prog, tonic, mode, size = 3)` | Four ranked chords that could come next, each with a reason. |
| `suggestScaleFor` | function | `(chord, ctx)` | The scale a chord with outside notes comes from. |
| `typedChord` | function | `(parsed, tonic, mode, base = DEFAULT_BASE)` | A parsed chord name as a chord the app can play, number and explain in a key. |

## core/sheet

**Layer** 3 · **Depends on** core/chords, core/figures, core/fingering, core/notes, core/scales · **Used by** j6, sketchpad

**Purpose.** A progression laid out as a sheet to take to an instrument: chord diagrams, the scale, the bass and optional fingering, and the same as plain text.

**Behaviour.** What goes on the sheet is a pure function of the progression, so the layout is checked without rendering it. Key positions are in units of the keyboard's width, so the caller picks the size. Diagram ranges snap to whole octaves so every diagram lines up.

**Requirements.** CR-SHEET-01 … CR-SHEET-10 (10) in [REQUIREMENTS.md](REQUIREMENTS.md); verified by `core/tests/sheet.test.mjs`.

### Interface

| Name | Kind | Signature | What it is |
|---|---|---|---|
| `diagramKeys` | function | `(startMidi, octaves, lit = [])` | A small keyboard's keys in units of its width, with the lit ones marked. |
| `diagramRange` | function | `(allNotes, minOctaves = 2)` | The window of keyboard worth drawing, in whole octaves. |
| `sheetAsText` | function | `(sheet)` | The same sheet as plain text. |
| `sheetData` | function | `({ tonic, mode, scaleId, customScale, progression = [], bpm = 88, bassFigure = null, system = "letters", fingering = false, reach = DEFAULT_REACH })` | The sheet: title, scale, chords, bass and fingers, bar by bar. |
