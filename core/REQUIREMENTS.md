# Core requirements

Numbered, verifiable statements about the core asset base, each traced to where it came from and to the test that verifies it. They sit one level under the product's [`REQUIREMENTS.md`](../REQUIREMENTS.md): a product requirement says what the product must do; these say what a reusable module must do, whoever uses it.

**Columns.** *Source* is the decision (`D-`, product; `CD-`, core), use case (`UC-`) or product requirement (`R-`) the statement comes from, and must exist (gate C4). *Mode* is **A** automated test, **I** inspection, **M** manual; every asset requirement is **A**, because a module with no screen has nothing to look at. *Verified by* is the test file; the test's title begins with the requirement's id, and `tools/core-check.mjs` fails the build if a requirement has no test or a test no requirement (gate C1).

To see the requirements of one module with the number of tests behind each: `node tools/core-check.mjs --report`.

## core/notes

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-NOTES-01 | Pc maps any whole number to a pitch class, 0 to 11, in the same place in the octave. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-02 | isWhite is true for exactly the seven white keys, in every octave. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-03 | The name tables have twelve entries, in pitch-class order, and agree with each other. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-04 | noteName gives sharps in letters or Do-Re-Mi when no key is applied, and wraps any pitch. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-05 | baseOf says whether a naming system writes letters or Do-Re-Mi. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-06 | leansFlat is true for the flat-side majors, and a minor key follows its relative major. | D-006, D-019, D-074 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-07 | keyNames spells all twelve notes the way the key writes them, in all 24 keys. | D-074, CD-007 | A | `core/tests/notes.test.mjs` |
| CR-NOTES-08 | keyNames gives each note of the key, and its common alterations, their scale degree's letter. | D-074 | A | `core/tests/notes.test.mjs` |

## core/scales

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-SCALES-01 | The catalogue holds ten scales, each with ascending intervals from 0 inside one octave. | D-049, UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-02 | scaleById finds a scale by its id and returns nothing for an unknown one. | D-049, UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-03 | scalePcs is the scale's intervals from the tonic, as pitch classes, for every tonic. | D-049, UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-04 | fitScales ranks scales by the share of a progression's notes they hold, best first, at most five. | UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-05 | keysContaining returns every major or natural-minor key that holds all the notes, and no other. | D-049, UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-06 | scalesContaining returns scales, in any key, that hold all the notes, the tightest fit first. | D-047 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-07 | customScaleFrom makes a scale of your own from five to eight different notes, and nothing otherwise. | D-049, UC-21 | A | `core/tests/scales.test.mjs` |
| CR-SCALES-08 | A scale of your own answers the same questions as a built-in one. | D-049 | A | `core/tests/scales.test.mjs` |

## core/chords

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-CHORDS-01 | chordLabel writes a chord's name in the naming system asked for. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-02 | QUALITIES is keyed by interval signature, and every entry has a symbol and a name. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-03 | The dictionary lists each chord type once, with its intervals, a name and a plain description. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-04 | Every interval a chord uses has a degree name, the flat 9, sharp 9 and sharp 11 included. | D-035, CD-007 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-05 | SIGNATURES names every signature either table can name, the quality table first. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-06 | identifyChord names every dictionary chord in root position, on any root, and ranks that reading first. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-07 | identifyChord names an inversion with its bass, and every other reading of the same notes. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-08 | Two notes are named as an interval measured upward from the lowest. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-09 | Notes with no standard name get no name, rather than an invented one. | D-047, CD-005 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-10 | identifyChord writes names in the naming system it is given, and leaves its input alone. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-11 | Inversions lifts the lowest note an octave at a time, up to four, keeping the chord's notes. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-12 | customChordFrom turns a selection into a chord of your own, named if it can be. | D-047 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-13 | In missing mode, notes that are part of a chord are named by it, the root in the bass outweighing two missing tones, then the simpler chord. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-14 | Missing mode agrees with the reference rule on every chord, every root, with any one tone left out and notes spread over octaves. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |
| CR-CHORDS-15 | Every reading has the same shape in both modes, so a caller handles one answer. | D-035, D-047, D-074, UC-42 | A | `core/tests/chords.test.mjs` |

## core/voicing

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-VOICING-01 | Voice places intervals above a root in the octave given, middle C's octave by default. | D-042, D-060, D-065, UC-35 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-02 | stackAscending puts each tone above the one before, so a 9th stays above the 7th. | D-042, D-060, D-065, UC-35 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-03 | dictionaryFor lists every dictionary chord on a root, with its notes in the octave given. | D-042, D-060, D-065, UC-35 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-04 | voicingsFor offers close first, then only the arrangements the chord is big enough for. | D-042, D-059 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-05 | Every arrangement is the chord itself, in the way it claims — only rootless and shell may leave notes out. | D-042, D-060, D-065, UC-35 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-06 | The arrangements come from the chord's own octave and close position, never from the one it is wearing. | D-065, CD-004 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-07 | voiceLeading says which notes stay, which move and how far, and how smooth the change is. | UC-39 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-08 | Arpeggio plays the notes one at a time, upward, downward, or up and back without repeating the ends. | UC-43 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-09 | smoothestVoicing picks the arrangement of the next chord that sits nearest the last one, and says why. | UC-44 | A | `core/tests/voicing.test.mjs` |
| CR-VOICING-10 | No function changes its inputs, and each gives the same answer for the same input. | CD-002 | A | `core/tests/voicing.test.mjs` |

## core/symbols

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-SYMBOLS-01 | Every chord in the dictionary can be typed as its own symbol, on every root, in letters and in Do-Re-Mi. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-02 | The spellings charts use are read as the dictionary chord they mean. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-03 | The root may be written in either case, with a sharp or flat in either of its two forms. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-04 | A slash names the bass, and a slash that is not a bass stays part of the symbol. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-05 | Text that is not a chord is refused with a reason that says why, never guessed. | D-077, CD-005 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-06 | A refusal offers the nearest chord type but never applies it. | D-077, CD-005 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-07 | A line from a chart is split on spaces, commas and bar lines, ignoring dashes, and keeps each chord's verdict. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-08 | typedLabel writes a typed chord as the app writes it, with its slash bass only when it differs from the root. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-09 | A symbol typed, labelled and typed again is the same chord. | D-077 | A | `core/tests/symbols.test.mjs` |
| CR-SYMBOLS-10 | The typing chips offer the characters a phone keyboard makes awkward. | D-077 | A | `core/tests/symbols.test.mjs` |

## core/styles

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-STYLES-01 | Every style names chord colours the dictionary can voice, and says in a sentence what it is going for. | D-048, UC-46 | A | `core/tests/styles.test.mjs` |
| CR-STYLES-02 | Every style a scale is tagged with has chord colours, so the two catalogues agree. | D-048, UC-46 | A | `core/tests/styles.test.mjs` |
| CR-STYLES-03 | scalesForStyle splits the scales of a mode into those tagged for the style and the rest, nothing lost or repeated. | D-048, UC-46 | A | `core/tests/styles.test.mjs` |
| CR-STYLES-04 | An unknown style suits nothing and offers no colours, without failing. | D-048, UC-46 | A | `core/tests/styles.test.mjs` |

## core/harmony

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-HARMONY-01 | Harmonize builds a chord on each of a seven-note scale's notes, from the scale's own notes, in every key. | UC-05, D-060 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-02 | A scale with other than seven notes has no diatonic chords. | UC-05 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-03 | romanFor writes a chord's place in the key: case for quality, ♭ or ♯ for a shifted degree, ° and + for the odd ones. | D-077 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-04 | harmonizeCustom harmonises a scale of your own, and only if it has seven notes. | D-048 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-05 | suggestScaleFor names the scale a chord with notes outside the key comes from, and nothing for a chord already in it. | UC-37 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-06 | harmonizeSteps builds a chord one skipped note at a time and ends by naming it. | UC-38 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-07 | suggestNextChords offers somewhere to start from nothing, and four ranked chords otherwise, never repeating the last. | UC-40 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-08 | typedChord turns a typed name into a chord the app can play, number and explain, in the key. | D-077 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-09 | A typed slash bass is the nearest note of that name below the chord, and the chord keeps all its notes. | D-077 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-10 | Tension runs from the plain chords of the key to chromatic colour, and each step adds to the one before. | UC-52 | A | `core/tests/harmony.test.mjs` |
| CR-HARMONY-11 | The chord builders leave their inputs alone and answer the same each time. | D-044, D-077, UC-40 | A | `core/tests/harmony.test.mjs` |

## core/explain

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-EXPLAIN-01 | A chord in the key is explained by its role there and what it shares with home, in at most two sentences. | D-011, D-051, CD-006 | A | `core/tests/explain.test.mjs` |
| CR-EXPLAIN-02 | A chord with notes outside the key is called out, and the outside notes are named. | D-011, D-051, UC-14 | A | `core/tests/explain.test.mjs` |
| CR-EXPLAIN-03 | A note in the key but not in the scale chosen for melodies is named as that, and the chord is still called in key. | D-025 | A | `core/tests/explain.test.mjs` |
| CR-EXPLAIN-04 | A progression is explained as a loop, including the move from the last chord back to the first. | UC-14 | A | `core/tests/explain.test.mjs` |
| CR-EXPLAIN-05 | Every pair of chords gets one of four plain readings: two shared, one shared, close roots, or a real move. | D-011, D-051, UC-14 | A | `core/tests/explain.test.mjs` |
| CR-EXPLAIN-06 | describeChange says what changed between two note sets, as one sentence when one note moved. | D-011, D-051, UC-14 | A | `core/tests/explain.test.mjs` |

## core/melody

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-MELODY-01 | A pitch is stable over a chord if the chord holds it, movement if only the scale does, tension if neither. | D-056, UC-50 | A | `core/tests/melody.test.mjs` |
| CR-MELODY-02 | Each role carries a label and a reason. | D-056, UC-50 | A | `core/tests/melody.test.mjs` |
| CR-MELODY-03 | melodyGuide sorts the twelve notes of an octave into the three roles, each once, in ascending order. | D-056, UC-50 | A | `core/tests/melody.test.mjs` |
| CR-MELODY-04 | With no chord, nothing is stable: every note is movement or tension. | D-056, UC-50 | A | `core/tests/melody.test.mjs` |
| CR-MELODY-05 | changedNotes says which pitch classes came in, went out and stayed, each in ascending order, ignoring octave and repeats. | D-056, UC-50 | A | `core/tests/melody.test.mjs` |

## core/chordsets

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-CHORDSETS-01 | The catalogue holds fourteen sets, each with a name, a mode, a note, eight slots and a reason for its progression. | D-014 | A | `core/tests/chordsets.test.mjs` |
| CR-CHORDSETS-02 | Every slot is an offset from the tonic and a chord type the dictionary can voice. | D-014 | A | `core/tests/chordsets.test.mjs` |
| CR-CHORDSETS-03 | buildSet builds a set in any key: each slot a chord on tonic plus offset, the progression made of those same chords. | D-014 | A | `core/tests/chordsets.test.mjs` |
| CR-CHORDSETS-04 | A set keeps its own definition when built, and building never changes the catalogue. | D-014 | A | `core/tests/chordsets.test.mjs` |
| CR-CHORDSETS-05 | setsFor lists the sets of one mode, in catalogue order. | D-014 | A | `core/tests/chordsets.test.mjs` |

## core/figures

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-FIGURES-01 | Rng is a seeded generator: the same seed gives the same sequence, always in [0, 1), and different seeds differ. | D-022, CD-002 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-02 | Every pattern has an id, a kind, styles from the known six, a note, and steps that fit in a bar without overlapping. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-03 | patternsFor lists the patterns of a kind that suit a style, and every style has at least one bass and one melody. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-04 | Place gives the nearest note with a pitch class to a reference, never an octave away from the nearest. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-05 | renderFigure turns a pattern into notes, one per step it can resolve, at the pattern's positions and lengths. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-06 | The rules put each role where it says: root on the root, octave above it, fifth and third from the chord, approach a semitone from the next chord's root. | D-023, CD-003 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-07 | A figure is reproducible: the same seed gives the same notes, a different seed may differ, and nothing is read from outside. | D-022, CD-003 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-08 | Step moves go to a neighbouring note of the scale, in the direction the pattern declares. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-09 | renderProgressionFigure renders one figure per chord, each leaning into the next, the last into the first. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-10 | explainFigure says what the pattern is, which notes land on the strong beats, and whether it leans into the next chord. | D-022, D-023, D-031 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-11 | planBar plans a bar as events with a start and length in seconds: one chord event under the figures, the bass and riff notes on their own steps. | D-031, D-034, CD-003 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-12 | No note on one voice is longer than the gap before the next, so notes cannot pile up. | D-031, R-118, CD-007 | A | `core/tests/figures.test.mjs` |
| CR-FIGURES-13 | planIsClean rejects overlapping notes, empty notes, and notes that start outside the bar. | R-118 | A | `core/tests/figures.test.mjs` |

## core/bass

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-BASS-01 | The bass options always start with the root, then fifth, third and seventh where the chord has them, then scale notes as passing. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |
| CR-BASS-02 | No pitch class is offered twice, and the passing notes are exactly the scale notes the chord did not use. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |
| CR-BASS-03 | The fifth is a perfect fifth if the chord has one, else a flat or sharp one; the third is minor or major; the seventh is minor or major. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |
| CR-BASS-04 | The explanation paragraph is available for the app to show, and says what the scale and the chord each decide. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |
| CR-BASS-05 | bassTransitions offers a direct move, a scale walk where there is a gap, a fifth approach and a chromatic slide, all ending on the next chord's root. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |
| CR-BASS-06 | The transitions are the figures the bass would play: direct is two notes, fifth approach drops to the next chord's fifth, chromatic comes from a semitone below. | UC-20, D-023 | A | `core/tests/bass.test.mjs` |

## core/transport

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-TRANSPORT-01 | Tempo runs from 60 to 160 BPM in steps of 5, starting at 90, and any value is brought into range. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-02 | A beat lasts sixty over the tempo seconds. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-03 | Each chord lasts half a bar, one bar or two, and each starts on its own beat. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-04 | With Loop on the progression repeats for ever, and with it off it plays once and ends. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-05 | The click counts in one bar, then marks every beat with the first of each bar stronger. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-06 | A chord sounds for its length less a breath before the next. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-07 | loopIndex says which chord a unit lands on, round and round, and nothing for an empty loop. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-08 | A play-through starts a little ahead of now, and the units due are the scheduler's, each once across calls. | D-043 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-09 | A driver ticks at once and then on its timer, handing each unit to the app once and in order. | D-043, D-098, CD-013 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-10 | Each unit carries the time it starts, which is a unit length after the one before. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-11 | A tempo change takes effect on the next unit, because the length is asked for on every tick. | D-090, CD-013 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-12 | Stopping cancels the timer and no more units arrive; a stopped driver can start again from the clock. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-13 | Starting a driver that is running changes nothing. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-14 | An app can end the play-through from its unit callback: the driver stops, and the rest of that tick is dropped. | D-090, D-043, D-098 | A | `core/tests/transport.test.mjs` |
| CR-TRANSPORT-15 | The driver reaches the world only through the clock and timer it is given. | CD-002, CD-013 | A | `core/tests/transport.test.mjs` |

## core/playback

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-PLAYBACK-01 | A bar lasts four beats of 60 over the tempo, or as many beats as asked. | D-043, D-038, D-066 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-02 | barsToSchedule returns each bar that starts inside the look-ahead window, in order, none twice across calls. | D-043, CD-002 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-03 | A bar already late is scheduled for now, never in the past, and a stalled clock cannot loop for ever. | D-043 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-04 | A voice is released once it has finished sounding plus its tail and a margin. | D-043, D-038, D-066 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-05 | reapVoices splits live voices into those still sounding and those finished, keeping all of them. | D-043, D-038, D-066 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-06 | Allocatable never allows more notes than the budget has room for, and never a negative number. | D-038 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-07 | pickVoiceIndex takes the first free voice, and otherwise the one finishing soonest. | D-043, D-038, D-066 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-08 | Rolling has three styles, from all at once to a slow roll, found by id with the first as the fallback. | D-068, UC-57 | A | `core/tests/playback.test.mjs` |
| CR-PLAYBACK-09 | rollOffsets starts the notes low to high, one spread apart, and fits any chord inside half a second. | D-068, UC-57 | A | `core/tests/playback.test.mjs` |

## core/instruments

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-INSTRUMENTS-01 | sampleMidi reads a note name as a MIDI number, and anything else as not-a-number. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-02 | The anchors are the recordings' notes in ascending order, from the samples given or the built-in piano. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-03 | stretchAt is how far a note is from its nearest recording, and zero where it has its own. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-04 | The keyboard never asks the piano for a note farther than three semitones from a recording. | D-071, R-230, CD-007 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-05 | Every instrument preset has what the audio layer needs to build it, and a sampler has a fallback that is itself a synth. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-06 | instrumentById finds a preset, and falls back to the first for an id it does not know. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-07 | Delay is silent when off, and when on is wetter and slower on the pad than on anything else. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-08 | The spaces run from dry to cave, each longer and wetter than the last, and reverb falls back to dry. | D-040, D-041, D-069 | A | `core/tests/instruments.test.mjs` |
| CR-INSTRUMENTS-09 | An embedded audio payload is read back to its size without decoding it. | D-070 | A | `core/tests/instruments.test.mjs` |

## core/piano-samples

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-PIANOSAMPLES-01 | The built-in piano holds thirteen recordings, every six semitones from C1 to C7, each an embedded audio data URI. | D-069, D-071 | A | `core/tests/instruments.test.mjs` |
| CR-PIANOSAMPLES-02 | The recordings add up to a size a single-file app can carry. | D-069, D-071 | A | `core/tests/instruments.test.mjs` |

## core/keyboard

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-KEYBOARD-01 | A key's role is the first that applies: sounding, bass, chord root, chord tone, in the loop, else plain. | D-016, D-033, D-052 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-02 | A chord lights the notes it is voiced in, not every octave of them. | D-033 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-03 | A key is marked home on the tonic and scale on the other notes of the scale, in every octave, else nothing. | D-016, D-033, D-052 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-04 | Pressing a key adds it to the held set, sorted, once, up to eight at a time. | D-052 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-05 | Lifting a finger releases only its own key. | D-016, D-033, D-052 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-06 | Sliding a finger onto a new key sounds that key and releases the one it left. | D-053 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-07 | A key held by two fingers keeps sounding until both have left it. | D-053 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-08 | The notes under the fingers are each listed once, in ascending order. | D-016, D-033, D-052 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-09 | keyAtPosition finds the key under a point from the layout alone: white keys by width, black keys on the top part. | D-055 | A | `core/tests/keyboard.test.mjs` |
| CR-KEYBOARD-10 | Every key of the keyboard can be found at its own centre, black or white. | D-016, D-033, D-052 | A | `core/tests/keyboard.test.mjs` |

## core/fingering

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-FINGERING-01 | The scale table has a right and left hand fingering of eight notes, using fingers 1 to 5, for each of the 12 major and 12 minor scales. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-02 | Every scale fingering is playable: a thumb never repeats, and the hand crosses once at most each way, at the thumb. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-03 | Reach options run from a seventh to a tenth, an octave by default. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-04 | Fingers show for the right hand in Learn until a choice is made, and nowhere else. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-05 | handFingers gives each note a finger by rule: the thumb on the lowest in the right hand and the highest in the left, the little finger opposite. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-06 | In a triad the middle finger is 3, or 2 when the top gap is a fourth or more, which fingers every inversion of every triad. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-07 | fitsHand is true for one to five notes lying within the reach. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-08 | fingerChord gives one hand a chord it can reach: a finger for every note, no split, no brackets. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-09 | A chord one hand cannot reach is split, the left taking as few of the lowest notes as it can, or is called too wide. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-10 | With both hands, the left plays the bass at least an octave below the chord and the right plays the chord. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-11 | fingerCrossings finds each step against the hand's natural direction, naming a thumb tucking under or a finger crossing over. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-12 | scaleFingering fingers a one-octave run from the table, upward or downward, and says nothing for notes that are not that scale. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-13 | stepFingering turns a lesson step into keys and one line of words, or nothing rather than a guess. | D-078 | A | `core/tests/fingering.test.mjs` |
| CR-FINGERING-14 | litLessonFingers shows the fingers of the notes played so far, any hinted, and any shown, each key once. | D-078 | A | `core/tests/fingering.test.mjs` |

## core/sheet

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-SHEET-01 | diagramKeys lays out a small keyboard in units of its width: every white key one equal slice, every black key between its neighbours. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-02 | diagramKeys marks the notes asked for and no others. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-03 | diagramRange snaps to whole octaves from the lowest note's octave, holds every note, and never shrinks below the minimum. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-04 | The sheet's header names the key, the tempo, the scale and the number of bars. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-05 | The sheet carries the scale as notes in one octave from the tonic, ascending, with their names. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-06 | Each bar of the sheet gives the chord's name, notes, their names and its numeral, in order from bar one. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-07 | Each bar has a bass: the figure's notes if there is one, else the chord's lowest note two octaves down. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-08 | Fingering is added only when asked for: right-hand fingers on each chord, and a left little finger on a single bass note. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-09 | sheetAsText prints the same sheet as plain text: a header, the scale, and a line for every bar. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |
| CR-SHEET-10 | The sheet is a pure function of what it is given. | D-057, D-078, UC-53 | A | `core/tests/sheet.test.mjs` |

## The asset base as a whole

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| CR-ARCH-01 | The modules import each other without a cycle. | CD-008 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-02 | Every module's header and document give the layer and dependencies its imports make. | CD-008 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-03 | Core never imports a product, and every import is one of our modules. | CD-001 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-04 | Every module is pure: no React, audio library, DOM, clock, randomness or network. | CD-002 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-05 | Every module is used by something, and its document says by what. | CD-001 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-06 | Every export of every module is described in its document, and nothing described is missing. | CD-010 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-07 | Every requirement has a test, and every test names a requirement. | CD-010 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-08 | Every requirement traces to a source that exists, and every decision is used. | CD-010 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-09 | Every module's section names its purpose and its behaviour, and the index re-exports every module. | CD-011 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-10 | Every exported function is in the contract table, so a new function cannot arrive without its promises being checked. | CD-010 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-11 | Every exported function gives the same answer for the same input, and never changes its arguments. | CD-002, CD-010 | A | `core/tests/architecture.test.mjs` |
| CR-ARCH-12 | The answers are plain data, so an app on any platform, or a file, can carry them. | CD-002, CD-009 | A | `core/tests/architecture.test.mjs` |
