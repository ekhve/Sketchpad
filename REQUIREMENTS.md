# Sketchpad — Requirements

**Status:** v0.3 — 135 requirements, numbered sequentially
**Date:** 2026-09-05
**Companions:** `DESIGN.md` (why), `USE_CASES.md` (what the user does), `sketchpad.feature` (how we check), `DONE.md` (when it's finished)

**Relationship to `sketchpad.feature`.** The scenarios are the behavioural specification — if you want to know what the product does, read them, not this. This file exists for the two things a scenario cannot carry: *traceability*, so every behaviour points back to the decision that caused it, and *non-behavioural constraints* like "the theory layer stays pure" or "no colour literals in components", which are true of the code rather than observable in the app. Where a requirement describes behaviour, it names the scenario that verifies it and adds nothing of its own.

**How to read this.** Each requirement is a single statement that is either true or false of the product. Every one names where it came from and how it is verified. The **Verified by** column holds the exact name of a scenario in `sketchpad.feature`; `tools/check-done.mjs` fails if a name here doesn't exist there, so this table cannot quietly become fiction.

**Verification modes**
- **A** — automated. The named scenario is tagged `@auto` and has a test.
- **M** — manual. The named scenario is tagged `@manual` and is checked by a person on a phone.
- **I** — inspection. Verified by reading the code or the documents, not by running anything.

---

## 1. Platform and delivery

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-001 | The product is a single web application that runs on a phone and a desktop browser. | D-001 | I | Runs from one codebase |
| R-002 | The interface is usable one-handed on a portrait viewport of about 380 px. | D-002, X-01 | M | Legibility on a phone |
| R-003 | No user data leaves the device. There is no server, account or telemetry. | D-004, X-09 | I | No network calls beyond the audio sample host |
| R-004 | The application functions after first load without a network connection. | D-001, X-08, D-076 | M | Installed on an iPhone and iPad, it opens offline |
| R-005 | The theory layer contains no React, audio, DOM, date or ambient-random dependency. | D-020, D-096 | A | *(`check-done` G7 and the purity check C3: the modules must load standalone)* |
| R-006 | The application is a static build deployed to a static host on its own subdomain, not embedded in WordPress. | D-005 | I | Deployment configuration |
| R-007 | The theory layer is typed, and musical data is expressed as data rather than code. | D-003 | I | Review at each change |
| R-008 | Every behaviour is specified as a Given/When/Then scenario before it is asserted. | D-021 | A | *(traceability.test.mjs)* |

## 2. Key and musical context

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-009 | The user can select any of twelve chromatic roots and either major or minor. | UC-01 | A | Scales across keys |
| R-010 | The selected key yields the correct set of scale notes in every one of the 24 keys. | UC-01 | A | Scales across keys |
| R-011 | The tonic is identifiable on the piano as the home note. | UC-01, D-016 | A | The root of the selected chord is distinguished |
| R-012 | Changing the key rebuilds the chord palette, the scale list and the piano markers. | UC-01 | M | Changing key rebuilds everything visible |
| R-013 | All internal note data is MIDI numbers; note names exist only at the display layer. | D-006 | A | Naming never changes the underlying notes |

## 3. Piano

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-014 | The piano is visible in every primary view. | X-03 | M | Reading a chord off the screen to play it on my own instrument |
| R-015 | The key selector and piano remain reachable from every tab without scrolling back. | D-036 | M | The key and the piano stay put |
| R-016 | Each tab answers one question, and all tabs share one selected chord and scale. | D-036 | M | Each tab answers one question |
| R-017 | Tapping a key lights it and sounds the note. | UC-02 | M | Pressing a chord |
| R-018 | Visual feedback never waits on audio. | X-02 | M | Pressing a chord |
| R-019 | Up to eight simultaneous notes render and sound correctly. | D-007, X-05 | A | Chord voicings stay in a playable register |
| R-020 | The visible octave range can be shifted, and role colouring follows. | UC-04 | M | Legibility on a phone |
| R-021 | Harmony is shown by key fill; the scale palette is shown by a separate marker. | D-016, X-11 | A | A chord tone inside the scale |
| R-022 | A chord lights exactly the notes of its voicing, in the register it sounds in. | D-033 | A | A chord lights only the octave it is voiced in |
| R-023 | Scale and home markers appear in every visible octave, because a palette is not a voicing. | D-033 | A | The scale marker still covers every octave |
| R-024 | The root of the selected chord is visually distinct from its other chord tones. | D-016 | A | The root of the selected chord is distinguished |
| R-025 | Notes used elsewhere in the loop are shown, distinct from the selected chord. | D-016 | A | A note only used elsewhere in the loop |
| R-026 | A sounding note takes visual priority over every other fill state. | D-016 | A | A sounding note overrides every other fill |
| R-027 | A sounding bassline note is distinguishable from a chord tone. | UC-29, D-016 | A | A sounding bass note reads as bass, not as a chord tone |
| R-028 | A note in neither the chord, the loop nor the scale carries no fill and no marker. | D-016 | A | A note outside chord, loop and scale has neither fill nor marker |
| R-029 | Chord and scale states are legible at the same time, including on sharp keys. | X-11 | M | Legibility on a phone |
| R-030 | Sharp keys carry the same colour language as natural keys while remaining distinguishable from them. | D-029 | M | Colour reads on the sharp keys |

## 4. Chords

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-031 | The palette shows the seven diatonic chords of the selected key. | UC-05 | A | Triads of a minor key |
| R-032 | Every one of the 24 keys produces seven chords of recognised quality. | UC-05 | A | Every key produces a complete, recognised palette |
| R-033 | The user can switch between triads and seventh chords. | UC-07 | A | Sevenths of a minor key |
| R-034 | Roman numerals are correct for degree and quality, and hidden in beginner mode. | UC-05, D-012 | A | Roman numerals match the degree and quality |
| R-035 | Selecting a chord lights its notes, sounds them, and keeps them lit. | UC-06, X-10 | M | Reading a chord off the screen to play it on my own instrument |
| R-036 | Chord voicings place the root between C3 and B3 and never exceed C5. | D-007 | A | Chord voicings stay in a playable register |
| R-037 | The notes of a voicing are ordered low to high. | D-007 | A | Chord notes ascend within a voicing |
| R-038 | Triads, sevenths and ninths are all available in every key. | D-035 | A | Every key produces recognised ninths |
| R-039 | Extensions are stacked upward, never folded into one octave. | D-035 | A | A ninth sits above the seventh rather than beside the root |
| R-040 | A chord dictionary offers fifteen qualities on any root, each with formula and description. | D-035 | A | Every quality in the dictionary is buildable on every root |
| R-041 | Inversions preserve the chord and change only which note is lowest. | D-035 | A | An inversion keeps the same notes and changes only the bass |
| R-042 | Chord sets provide eight chords plus a ready-made progression, in any key. | D-035, D-014 | A | Every set builds in every key |
| R-043 | A progression explains every move, including the wrap back to the start. | D-035 | A | Each move is described, including the wrap back to the start |
| R-044 | Bass options are ranked from safest to most colourful, and every scale note is offered. | D-035 | A | The root is offered first and named the strongest |
| R-045 | Bass transitions always start on the current root and land on the next. | D-035 | A | Every transition starts on this chord and lands on the next |

## 5. Scales

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-046 | The scale list offers at least six palettes per mode, each with a plain-language feel. | UC-08 | A | Every scale definition is well formed |
| R-047 | Every scale definition is well formed: starts on the tonic, ascends, no duplicates, within an octave. | UC-08 | A | Every scale definition is well formed |
| R-048 | Selecting a scale updates the piano markers to that scale's notes. | UC-09 | A | Scale contents |
| R-049 | When a scale differs from the previous one by a single note, the explanation names that note. | UC-09 | A | Dorian differs from natural minor by exactly one note |
| R-050 | That single-note relationship holds in all twelve tonics. | UC-09 | A | The one-note difference holds in every key |
| R-051 | A scale can be played back with the piano following note by note. | UC-10 | M | Hearing a scale |

## 6. Progression

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-052 | The user can add up to eight chords to a loop and remove any of them. | UC-11 | M | Adding chords |
| R-053 | The loop plays at a settable tempo, one bar per chord, and repeats without a gap. | UC-12, D-010 | M | Playing the loop |
| R-054 | During playback the piano shows the current chord and marks the current slot. | UC-12 | M | Playing the loop |
| R-055 | Adding a chord during playback does not interrupt sound. | X-12 | M | Adding a chord while the loop plays |
| R-056 | "Which scales fit?" is reachable in one tap from a built loop. | X-13 | M | Reaching the answer quickly |
| R-057 | Scale fitting ranks scales by how much of the loop they contain and names what they miss. | UC-21 | A | A diatonic loop fits its own scale |
| R-058 | A loop containing a borrowed chord reports the specific note that no scale covers. | UC-21 | A | A loop with a borrowed chord names what does not fit |
| R-059 | Asking which scales fit an empty loop returns nothing rather than failing. | UC-21 | A | An empty loop returns nothing rather than throwing |

## 7. Riffs and basslines

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-060 | The user can request a bassline and a riff for the loop in a named style. | UC-29 | M | Hearing the suggestion |
| R-061 | Every style offers at least one bassline and one riff, each named and described. | UC-29 | A | Every style offers both a bassline and a riff |
| R-062 | Every generated note is a chord tone, a scale note, or an approach note. | X-17 | A | Every note is a chord tone, a scale note, or a deliberate approach |
| R-063 | Only approach notes may fall outside the scale. | X-17 | A | Only approach notes are allowed outside the scale |
| R-064 | A bassline begins each bar on the root of that bar's chord. | UC-29 | A | A bassline starts on the root of its chord |
| R-065 | Bass roots stay within six semitones of the register centre and do not move within a bar. | UC-29 | A | Bass roots stay anchored to the register centre |
| R-066 | The final approach note of a loop sits a semitone from the first chord's root. | UC-29 | A | The last chord's approach aims at the first chord, so the loop closes |
| R-067 | A pattern that names a musical shape produces that shape at every seed and in every key. | X-18, D-023 | A | The rising line rises |
| R-068 | Directional steps still land on scale notes. | D-023 | A | Directional steps still land on scale notes |
| R-069 | Figures stay within eighteen semitones of their register centre. | UC-29 | A | Figures stay in a playable register |
| R-070 | Consecutive notes never leap more than a major ninth. | UC-29 | A | Consecutive notes do not leap absurdly |
| R-071 | Pattern steps start inside the bar, have positive duration, and do not overlap. | D-022 | A | Every note fits inside its bar |
| R-072 | The same seed always produces the same figure. | X-19, D-024 | A | The same seed always gives the same figure |
| R-073 | "Suggest again" is capable of producing a different figure. | UC-29 | A | Different seeds give different figures |
| R-074 | Each bar of a loop is seeded independently. | D-024 | A | Each bar of the loop is seeded independently |
| R-075 | One figure is generated per chord, and none is empty. | UC-29 | A | A figure is generated for every chord in the loop |
| R-076 | The riff can be muted while the bassline continues. | UC-29 | M | Muting the riff |
| R-077 | Editing the loop rewrites the figures against the new chords. | UC-29 | M | Editing the loop rewrites the figures |

## 8. Explanation

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-078 | The explanation panel always describes the most recent action and is never empty. | X-07, D-011 | M | Pressing a chord |
| R-079 | A diatonic chord's explanation names the notes it shares with the home chord. | UC-14 | A | A diatonic chord shares notes with home |
| R-080 | A chord outside the key is explained rather than discouraged. | UC-14 | A | A borrowed chord is explained, not rejected |
| R-081 | Chord analysis is judged against the key, never against the selected melodic palette. | X-20, D-025 | A | A diatonic chord is not called foreign just because a subset palette is selected |
| R-082 | A chord tone absent from the selected palette is mentioned without implying the chord is wrong. | D-025 | A | A chord tone missing from the chosen palette is mentioned, gently |
| R-083 | A borrowed chord is identified as such under any active palette. | D-025 | A | Borrowed chords are still judged against the key, whatever palette is active |
| R-084 | Figures are explained, naming the strong-beat notes and the approach. | UC-29 | A | Figures are explained in the chosen naming system |
| R-085 | Beginner explanations are at most two sentences and contain no unexplained jargon. | D-011, D-012 | I | Review at each change |

## 9. Note naming

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-086 | The user can switch between letter names and Do-Re-Mi. | UC-30 | A | Fixed-do naming |
| R-087 | Chord labels follow the selected naming system. | UC-30 | A | Chord labels follow the naming system |
| R-088 | Every user-visible note name routes through the naming layer. | X-15 | A | Figures are explained in the chosen naming system |
| R-089 | Switching naming changes nothing but names: same keys lit, playback uninterrupted. | UC-30 | M | Switching naming does not change anything else |
| R-090 | Note names use sharps in the letter system. | D-006, X-06 | A | The scale of a minor key |

## 10. Audio

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-091 | Sound starts on the first user gesture and does not ask twice. | UC-03 | M | Pressing a chord |
| R-092 | A scheduled note is always shorter than the interval before the next one. | D-017 | M | Notes release between bars |
| R-093 | Stopping playback, or changing tab, releases held voices, not merely the schedule. | D-017 | M | Silencing a stuck note |
| R-094 | ~~A Silence control is always available and stops sound without destroying selection or loop.~~ **Withdrawn 2026-10-08** at the owner's request (`D-106`). | X-14, UC-28, D-106 | I | *(withdrawn)* |
| R-095 | Sound never accumulates across repeated passes of a loop. | D-017 | M | Notes release between bars |
| R-096 | ~~Sound can be turned off and on from a labelled control, without altering selection or loop.~~ **Withdrawn 2026-10-08** at the owner's request (`D-106`). | D-030, D-106 | I | *(withdrawn)* |
| R-097 | A tapped note decays within about half a second; a tapped chord within about one second; a loop chord before the next bar. | D-030 | M | A tapped note does not ring on |
| R-098 | The voice has no sustain plateau: a note decays from the moment it is struck. | D-034 | M | The sound is piano-like and notes decay |
| R-099 | Reverb is short and quiet enough not to read as notes ringing on. | D-034 | M | The sound is piano-like and notes decay |
| R-100 | Chords are quieter than the bassline and riff. | D-034 | A | Chords sit underneath the melody in the mix |
| R-101 | Muting is enforced in the audio layer, so scheduled playback cannot leak sound. | D-030 | I | Review at each change |
| R-102 | No voice is ever asked to hold two notes at once, at any tempo. | D-031 | A | No voice is ever asked to hold two notes at once |
| R-103 | Every note is clamped to end, with an audible gap, before the next note on its voice. | D-031 | A | Every note is followed by a moment of silence |
| R-104 | Durations and start times are numbers of seconds, never string expressions. | D-031 | A | Durations are numbers of seconds, never strings |
| R-105 | A single failed note can never end playback; every audio call is guarded. | D-031 | M | Playback survives a long session |
| R-106 | A suspended audio context is detected and can be resumed from a visible control. | D-031 | M | Sound comes back after the phone is put down |
| R-107 | The audio state and the current voice are visible at all times, including the error message when startup fails. | D-037 | M | The app says why it is silent |
| R-108 | A test-note control plays one fixed note through the same path as everything else. | D-037 | M | A test note proves whether the chain works |
| R-109 | The startup signal path is a single synth to the speaker, with no optional nodes in the way. | D-037 | I | Review at each change |
| R-110 | The app allocates one voice per note and destroys it when the note is finished; no voice pool is shared with the audio library. | D-038 | I | Review at each change |
| R-111 | A voice always outlives its own release, and never by more than a second. | D-038 | A | A voice outlives its note, but not by much |
| R-112 | The voice budget can never be exceeded; a full budget drops notes rather than silencing the app. | D-038 | A | The budget is never exceeded, however many notes are asked for |
| R-113 | Voices do not accumulate across repeated passes of a loop. | D-038 | A | Voices from a finished loop do not accumulate across passes |
| R-114 | The number of live voices is visible while the app runs. | D-038 | M | A long session does not go quiet |
| R-115 | ~~Audio can be reset without reloading the page.~~ **Withdrawn 2026-10-08** at the owner's request (`D-106`). | D-038, D-106 | I | *(withdrawn)* |
| R-116 | Transport and draw scheduling are reached through the accessors, not the deprecated properties. | D-039 | I | Review at each change |
| R-117 | A loop that cannot start says why, rather than doing nothing. | D-039 | M | The progression loop actually plays |
| R-118 | Bass and Theory always describe a chord: the selection, the playing bar, the loop's first chord, or home. | D-039 | A | With a loop but nothing selected, the first chord is used |
| R-119 | Adding a chord to the loop also selects it. | D-039 | M | Adding a chord also selects it |
| R-120 | The instrument is never swapped while the transport is running. | D-031 | M | Playback survives a long session |
| R-121 | Playback cannot be started twice, stacking schedules. | D-031 | M | Playback survives a long session |
| R-122 | The generated theory module is rebuilt before the suite runs. | D-032 | A | *(check-done.mjs G0)* |

## 10b. Instruments, echo and voicings

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-123 | At least three instruments are available, each described and selectable. | D-040 | A | There is more than one sound to choose from |
| R-124 | Every preset declares a release that matches its envelope, so the voice budget stays correct. | D-040 | A | A preset's release matches its envelope |
| R-125 | Struck voices have a tail rather than a plateau; only a pad sustains. | D-040, D-034 | A | Struck voices decay; only a pad holds at a level |
| R-126 | Changing instrument does not interrupt notes already sounding. | D-040 | M | Changing instrument does not interrupt what is sounding |
| R-127 | Echo is a single switch with a fixed setting per instrument. | D-041 | A | Echo on stays inside safe bounds |
| R-128 | Echo off is fully silent, and echo on can neither drown the signal nor run away. | D-041 | A | Echo off is silent, not quiet |
| R-129 | Toggling echo changes a level only, never the signal path. | D-041 | M | Echo can be switched without losing notes |
| R-130 | Every chord offers at least three arrangements, each named and explained. | D-042, UC-35 | A | Every chord offers at least three arrangements |
| R-131 | Rearranging a chord does not change which notes it contains, except where dropping a note is the stated purpose. | D-042 | A | Open and spread keep every note of the chord |
| R-132 | The chosen voicing is what sounds and what the piano lights. | D-042 | M | The chosen voicing is what plays and what lights up |
| R-133 | Every style offers at least two basslines and two mini melodies, browsable rather than random-only. | UC-29 | A | Every style offers a choice, not a single answer |

## 10c. Scheduling, teaching and playing

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-134 | The loop is scheduled by the app, not by the library transport. | D-043 | A | The cursor advances so no bar is scheduled twice |
| R-135 | No bar is scheduled twice, out of order, or in the past. | D-043 | A | No bar is ever scheduled in the past |
| R-136 | Catching up after a stalled clock is bounded. | D-043 | A | A stalled clock catches up without scheduling forever |
| R-137 | The progression loop plays, repeats without a gap, and the piano follows. | D-043 | M | The progression loop plays |
| R-138 | A chord with notes outside the key names a scale that contains it, one tap away. | D-044, UC-37 | A | A chord outside the key is traced to a scale that contains it |
| R-139 | A suggested scale always contains every note of the chord it was suggested for. | D-044 | A | The suggested scale really does contain the whole chord |
| R-140 | A chord can be built out of the scale one note at a time, lit on the piano. | D-044, UC-38 | A | Every step adds exactly one note |
| R-141 | Voice leading names the held notes and pairs each departing note with its nearest arrival. | D-044, UC-39 | A | Every departing note is paired with its nearest arrival |
| R-142 | Smoothness is measured, so a smoother move always scores shorter. | D-044 | A | Voice leading is measured, not guessed |
| R-143 | Next-chord suggestions are ranked by harmonic behaviour and never repeat the current chord. | D-044, UC-40 | A | The chord just played is never suggested again |
| R-144 | Every suggestion explains why it would work. | D-044 | A | Every suggestion explains itself |
| R-145 | The chord dictionary always plays close position, so qualities are audibly distinct. | D-044 | M | Major and minor are audibly different in the dictionary |
| R-146 | Holding a piano key sustains the note until it is released. | D-045 | M | A held key sustains |
| R-147 | The keyboard spans four octaves and can be scrolled. | D-045 | M | The keyboard can be scrolled |

## 10d. Reverse search and arpeggios

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-148 | Notes chosen on the piano are identified as chords, with every valid reading ranked. | D-047, UC-42 | A | Both readings of an ambiguous set are offered, not just one |
| R-149 | An inversion is named with its bass, and root-position readings rank first. | D-047 | A | An inversion is named as one, with the bass after a slash |
| R-150 | Two notes are named as an interval measured upward from the lowest. | D-047 | A | An interval is measured upward from the lowest note played |
| R-151 | Notes with no standard name produce no name, rather than an invented one. | D-047 | A | Notes with no standard name return nothing rather than inventing one |
| R-152 | Every chord in the dictionary can be identified from its own notes. | D-047 | A | Every chord in the dictionary can be found again from its notes |
| R-153 | Keys and scales offered for a set of notes always contain all of them. | D-047 | A | The keys offered all contain every note |
| R-154 | Selecting notes happens in its own tab, so it is never confused with playing them. | D-047 | M | Choosing notes on the piano |
| R-155 | Any chord can be heard together, upward or downward. | UC-43 | A | Up plays low to high, down plays high to low |
| R-156 | The smoothest arrangement of the next chord is chosen by measured movement. | UC-44, D-047 | A | The chosen voicing moves less than the alternatives |
| R-157 | The chord palette is harmonised from the selected scale, not the parent scale. | D-046 | M | Choosing Dorian changes the chords, not just the notes |
| R-158 | Note labels sit at a fixed height regardless of what else a key shows. | D-046 | M | Note labels never move |

## 10e. Your own material and style browsing

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-159 | A selection can be saved as a chord, keeping the voicing exactly as played. | D-048, UC-45 | A | A saved chord keeps exactly the notes you chose |
| R-160 | Notes with no standard name can still be saved. | D-048 | A | A voicing with no standard name is still saveable |
| R-161 | The same selection always produces the same saved object. | D-048 | A | The same notes always produce the same saved chord |
| R-162 | A saved scale has five to eight notes, and a seven-note one harmonises into its own chords. | D-048, UC-45 | A | A seven-note scale of your own harmonises into chords |
| R-163 | Saved material can be played and added to the loop like anything built in. | D-048 | M | Saving and using your own chord |
| R-164 | Saved material lasts the session, and the app says so rather than implying more. | D-048 | M | Saving and using your own chord |
| R-165 | Every style names its scales and its chord colours, and hides nothing. | D-048, UC-46 | A | Scales suited to the style come first, and none are lost |
| R-166 | Every chord colour a style names exists in the dictionary. | D-048 | A | Every chord colour a style names is one the app can build |
| R-167 | At least ten chord sets exist, with both modes well served. | UC-16 | A | There are enough sets to browse rather than exhaust |
| R-168 | The octave is one control with an arrow either side of the number. | D-048 | M | One control, not three |

## 10f. Fixes found by reading

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-169 | The piano marks the active scale, whether it is built in or one of your own. | D-049 | A | A scale of your own lights its own notes too |
| R-170 | Tapping an arrangement plays that arrangement. | D-049 | M | Tapping a voicing plays that voicing |
| R-171 | Held notes are released when the tab changes. | D-049 | M | A held note stops when I leave the tab |

## 10g. The guide

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-172 | Every tab has a section in the guide. | D-050, UC-49 | A | Every tab is documented |
| R-173 | Every guide link points at a tab that exists. | D-050 | A | Every section points at a tab that exists |
| R-174 | Every section has a title, a lead and at least three points. | D-050 | A | Every section actually says something |
| R-175 | Reading the piano, the sound controls and where to start are explained even though none is a tab. | D-050 | A | The parts with no tab of their own are still covered |
| R-176 | The guide is offered before the user has done anything, and not nagged afterwards. | D-050 | M | Finding the guide without being told |

## 10h. Melody guide, change and tension

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-177 | Every note is classified over the current chord as landing, moving or pulling. | D-056, UC-50 | A | Every note of the octave gets exactly one answer |
| R-178 | The chord's own notes are always the ones that land. | D-056 | A | The chord's own notes are always the stable ones |
| R-179 | A change of scale or chord names and marks only the notes that moved. | D-056, UC-51 | A | A one-note difference is named as one |
| R-180 | An unchanged selection reports no change. | D-056 | A | No change says so rather than inventing a difference |
| R-181 | Raising the adventurousness slider only widens the choice. | D-056, UC-52 | A | Each step up adds chords and never removes any |
| R-182 | Borrowed chords are marked, contain notes outside the key, and each says why. | D-056 | A | Adventurous actually offers chords from outside the key |

## 10i. The sheet

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-183 | The sheet prints each bar's chord as a keyboard diagram showing its actual voicing. | D-057, UC-53 | A | Each chord carries its actual voicing, not just its name |
| R-184 | No note falls outside the diagram drawn for it. | D-057 | A | Every chord fits inside the drawn range |
| R-185 | Diagrams share a range so they line up with each other. | D-057 | A | The range snaps to whole octaves so the diagrams line up |
| R-186 | The scale and the bass line are on the sheet. | D-057 | A | The bass line is on the sheet, one entry per bar |
| R-187 | The sheet follows the chosen naming system and names a saved scale. | D-057 | A | It follows the chosen naming system |
| R-188 | Printing shows only the sheet. | D-057 | M | Printing the sheet |
| R-189 | The sheet can be copied as text, losing only the diagrams. | D-057 | A | The text version holds everything the picture does |

## 10j. Levels

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-190 | The app opens at its simplest level, with at most ~~four~~ five tabs; the fifth is Learn, until the levels give way to modes. | D-058, D-073, UC-54 | A | Start is genuinely small |
| R-191 | Everything the main scenario needs is available at the simplest level. | D-058 | A | The main scenario is completable at the simplest level |
| R-192 | Raising the level only adds; nothing already visible moves or disappears. | D-058 | A | Levels only ever add, so nothing a user found disappears |
| R-193 | Tabs keep a fixed order at every level. | D-058 | A | Tabs keep their order, so one never moves when another appears |
| R-194 | The guide is available at every level. | D-058 | A | The guide is available from the very beginning |
| R-195 | Changing level keeps the user's key, scale and loop. | D-058 | M | Moving up a level keeps my work |

## 10k. Extended chords

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-196 | The dictionary reaches elevenths and thirteenths, not only ninths. | D-059, UC-55 | A | The dictionary reaches elevenths and thirteenths |
| R-197 | Every extended quality offers the spacing it is usually played with. | D-059 | A | An extended chord offers the spacing it is usually played with |
| R-198 | A signature voicing keeps the root and the extension the chord is named for. | D-059 | A | A signature voicing holds the notes that name the chord |
| R-199 | Signature voicings are playable: ascending, on the keyboard, at most eight notes. | D-059 | A | Signature voicings stay inside a piano and ascend |
| R-200 | Extended chords can be identified from their notes like any other. | D-059 | A | Every extended chord can still be identified from its notes |

## 10l. Defaults, rooms and recorded sound

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-201 | The app opens in C major, with major offered before minor. | D-060 | M | Sensible defaults on opening |
| R-202 | Chords are built in the octave the keyboard is showing. | D-060 | A | A chord is built in the octave being shown |
| R-203 | Every chord source follows the octave, not just the palette. | D-060 | A | Every chord source follows the octave |
| R-204 | Four reverb spaces are available, each named and described. | D-061 | A | Every room says what it is for |
| R-205 | Dry is silent, and no room buries the notes. | D-061 | A | No room drowns the dry signal |
| R-206 | A recorded instrument is available and is the default. | D-062, UC-56 | M | The grand piano sounds like a piano |
| R-207 | A sampled instrument declares a release and covers the keyboard. | D-062 | A | A recorded instrument declares a release too |
| R-208 | A failed sample download leaves the synths working and says so. | D-062 | M | A slow download does not break anything |
| R-209 | Struck voices have a tail, not a plateau; only a pad sustains. | D-062 | A | Struck voices decay; only a pad holds at a level |

## 10m. The shell

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-210 | No hook depends on a value defined later in the file. | D-063 | A | *(check-done.mjs G12)* |

## 10n. Voicings and voices

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-211 | Arrangements are derived from the chord's close position, never from the arrangement currently shown. | D-065 | A | Close stays close, whatever was picked before |
| R-212 | No two arrangements of a chord contain the same notes. | D-065 | A | Every arrangement of a big chord is audibly different from the others |
| R-213 | A chord of five notes or more opens by dropping two, so it is genuinely wider. | D-065 | A | A big chord opens by dropping two notes, not one |
| R-214 | Voices are reused from a fixed pool; none is created or destroyed while playing. | D-066 | M | A long session stays responsive |
| R-215 | A free voice is always preferred to interrupting a sounding one. | D-066 | A | A free voice is used before a busy one is stolen |
| R-216 | Voice allocation is deterministic, not dependent on history. | D-066 | A | The first free voice is used, so allocation is predictable |
| R-217 | Reset rebuilds the audio graph rather than only releasing notes. | D-066 | M | Reset audio really resets |
| R-218 | The instrument the app opens with never depends on a download. | D-067 | M | The default instrument always works |

## 10o. Rolling a chord

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-219 | A chord can be played together, rolled, or rolled slowly. | D-068, UC-57 | A | Every roll style is named and described |
| R-220 | A rolled chord arrives lowest note first, evenly spaced. | D-068 | A | A roll lays the notes down in order, lowest first |
| R-221 | A roll never outlasts the note it belongs to. | D-068 | A | The roll never outlasts the note it belongs to |

## 10p. Playing the keyboard

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-222 | Several keys can be held at once; each lights and sounds, and lifting one leaves the rest. | D-052 | A | A second key joins the first rather than replacing it |
| R-223 | A ninth simultaneous key is refused rather than stealing one already sounding. | D-052, D-007 | A | Eight fingers is the limit, and a ninth is refused rather than stealing |
| R-224 | The keyboard refuses pan and zoom, so a sideways drag is a glissando and never a scroll. | D-052, D-054 | M | Scrolling without interrupting a note |
| R-225 | A finger dragged across the keys sounds each in turn and releases each as it leaves. | D-053 | A | A run up the keyboard sounds every key once, in order |
| R-226 | Sliding never cuts a note another finger still holds, and never retriggers one already sounding. | D-053 | A | A note another finger is still holding is not cut off |
| R-227 | The key under a finger is found by geometry, not by asking the document. | D-055 | A | Dragging across the keyboard visits keys in order |
| R-228 | Every key is reachable at its own centre, at any width or octave shift. | D-055 | A | Every black key is reachable at its own centre |

## 10q. The built-in piano

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-229 | The piano's recordings are embedded; nothing is fetched from another site. | D-069 | A | Nothing is fetched from another site |
| R-250 | Two samples are treated as the same recording only when their audio matches, not merely their header. | D-071 | A | Samples differ in their audio, not just their header |
| R-230 | Every note the keyboard can reach is within three semitones of a real recording. | D-069, D-071 | A | Every note the keyboard can reach is near a recording |
| R-251 | A sample set that does not span the keyboard fails the check that measures it. | D-071 | A | A set that does not span the range fails |
| R-252 | A sample name is read as the pitch it names, and an unreadable name is not a pitch. | D-071 | A | Sample names are read as the notes they claim to be |
| R-253 | The octave control cannot scroll the keyboard past the recorded range, and its limit is derived from the samples. | D-071 | A | The keyboard cannot be scrolled past the recordings |
| R-254 | At the highest octave the up arrow is visibly disabled rather than silently doing nothing. | D-071 | M | The octave control stops where the recordings stop |
| R-255 | The top of the keyboard sounds recorded rather than sped up. | D-071 | M | The top of the keyboard sounds like a piano |
| R-231 | The embedded set stays within a sensible share of the app's size. | D-069 | A | The whole set stays within a sensible budget |
| R-232 | Embedded recordings carry their credit, licence and a note that they were modified, in the app and in the guide. | D-069, D-071 | A | The recordings are credited |
| R-233 | The app sounds like a piano immediately, with no network. | D-069 | M | A real piano with no network |

## 10r. Decoding the built-in piano

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-234 | The embedded recordings are decoded in the app; no request of any kind is made for them. | D-070 | A | A data URI yields its payload |
| R-235 | Every embedded sample is valid, distinct audio of a plausible length. | D-070 | A | Every sample begins with an MPEG frame |
| R-236 | The piano becomes available without any network activity. | D-070 | M | The piano arrives without any request |

## 10s. Practising lessons on the piano

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-256 | Every lesson builds in all twelve keys, each step with a prompt, a reason, a target and a demonstration. | D-073, UC-58 | A | Every lesson builds in all twelve keys |
| R-257 | Every step's demonstration is accepted by the checker as a correct answer, in every lesson and key. | D-073 | A | A lesson's demonstration is itself a correct answer |
| R-258 | A chord step accepts its notes in any order and any octave, one at a time or together. | D-073, UC-58 | A | A chord can be played one note at a time, in any order, in any octave |
| R-259 | A wrong note is named, is not counted, and never removes a note already accepted. | D-073 | A | A wrong note in a chord is named and not counted |
| R-260 | A scale step accepts only the next note in order, and a wrong note is answered with the note wanted. | D-073, UC-58 | A | A scale must be played in order |
| R-261 | A scale step with a direction rejects a right note played the wrong way. | D-073 | A | A scale going up must go up, and one going down must go down |
| R-262 | An inversion step needs the named note at the bottom, and says so when all the notes are there but the bottom is wrong. | D-073 | A | An inversion needs the right note at the bottom |
| R-263 | Lesson text and practice feedback are at most two sentences per line, in both naming systems. | D-051, D-073 | A | Lesson text and feedback stay short enough to read |
| R-264 | Practice feedback names notes through the naming layer. | D-019, D-073 | A | Feedback speaks the chosen note names |
| R-265 | Lessons are built on the home note of the chosen key. | D-073, UC-61 | A | Lessons follow the key you chose |
| R-266 | "Next key" moves one step round the circle of fifths, and twelve steps visit every key once. | D-073 | A | The next key is one step round the circle of fifths |
| R-267 | A hint points at the note needed next: the next in a sequence, the first missing from a chord, or the bottom of an inversion. | D-073 | A | A hint lights the note you need next |
| R-268 | The four-chord lesson ends on I–V–vi–IV of the key, ready to become the loop. | D-072, UC-59 | A | The four-chord loop is I, V, vi and IV in every key |
| R-269 | Lessons come in teaching order, simplest first, each with at least two steps and a known topic. | D-073 | A | Lessons come in order, simplest first |
| R-270 | Lessons are reachable from the first screen. | D-072, D-073 | A | Practice is available from the very first screen |
| R-271 | A step's reason is only given once the step has been played. | D-011, D-073 | A | The reason for a step arrives only once it is played |
| R-272 | While a lesson is open the piano shows only the home dot, the answer when asked for, and the notes already right. | D-073 | M | The piano shows only the lesson |
| R-273 | "Show me" plays the step and lights its notes. | D-073 | M | Show me plays and lights the step |
| R-274 | A finished lesson that ends on a progression can put it in the loop in one tap. | D-072, UC-59 | M | A lesson's progression goes to the loop in one tap |
| R-275 | Changing key during a lesson restarts it in the new key. | D-073 | M | Changing key restarts the open lesson |
| R-276 | Practising a lesson on a phone feels like playing, not like being tested. | D-073, UC-61 | M | Practising a lesson on a phone |

## 10t. Spelling notes the way the key writes them

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-277 | Keys on the flat side of the circle, and the minor keys that share their notes, spell their notes with flats. | D-074 | A | Keys on the flat side spell their notes with flats |
| R-278 | Keys on the sharp side spell with sharps, including a minor key's raised seventh. | D-074 | A | Keys on the sharp side keep their sharps |
| R-279 | A key's common alterations take their scale degree's letter: ♭3 ♭6 ♭7 ♯4 in major; ♮6 ♮7 ♮3 ♭2 in minor. | D-074 | A | Borrowed and altered notes are spelled by their scale degree |
| R-280 | Every spelled name stands for the right pitch, and no white key is written with an accidental. | D-074 | A | Every spelling names the right pitch, and no white key takes an accidental |
| R-281 | Every key uses each letter once in its scale, except F# major and D# minor, which show F for E#. | D-074 | A | Each key uses every letter once in its scale |
| R-282 | Each key button is labelled as that key is written in the current mode. | D-074 | A | Every key is labelled the way it is written |
| R-283 | A lesson is spelled for its own key, and its feedback uses the same spelling. | D-073, D-074 | A | Lessons in flat keys use flats |
| R-284 | Every note name in an explanation goes through the naming layer, including Build it, voice leading, Find and smoothest voicing. | D-019, D-074 | A | Every note name in an explanation follows the naming system |
| R-285 | The plain naming systems, with no key applied, still spell black keys as sharps. | D-019 | A | The plain naming systems still spell with sharps |
| R-286 | C D G is named a suspended 2nd from the chord table. | D-074 | A | A suspended second is in the chord table |
| R-287 | No chord formula appears twice in the chord table. | D-074 | A | No chord formula is listed twice |
| R-288 | In a flat key the whole app reads in flats, and in a sharp key in sharps. | D-074 | M | The whole app reads in flats in a flat key |

## 10u. Feedback that teaches a way of thinking

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-289 | A wrong chord note is explained by counting keys from the root, naming the tone it should have been and where it is. | D-075 | A | A wrong interval is explained by counting keys from the root |
| R-290 | A scale note that the chord skips is explained by walking the scale with every other note taken. | D-075 | A | A scale note a chord skips is explained by the skip |
| R-291 | A skipped scale note is named, together with the step size from the last note played. | D-075 | A | A skipped scale note is named, with the step to it |
| R-292 | A near miss in a scale names the step size and the note it lands on. | D-075 | A | A near miss in a scale names the size of the step |
| R-293 | The first hint gives a method (count, step, landmark) without naming the note; the second lights it; a right note resets the ladder. | D-075 | A | The first hint gives the method, not the note |
| R-294 | Each of the twelve notes has its own keyboard landmark. | D-075 | A | A landmark finds any note on the keyboard |
| R-295 | Every lesson step, in every key and both naming systems, has a take-away rule and a hint of at most two sentences. | D-075 | A | Every step leaves a rule that works in any key |
| R-296 | Every key count stated in a rule is true of the chord in every key. | D-075 | A | Rules that count keys match the chord |
| R-297 | A finished major or minor triad names its white/black shape and the other chords of the same quality that share it. | D-075 | A | Chord shapes are named by their white and black keys |
| R-298 | On a phone the hint ladder reads Hint → Show the note, and resets after a right note. | D-075 | M | The hint ladder on the phone |
| R-299 | After play-testing, a learner can say the take-away rule back and correct a repeated mistake without a hint. | D-075 | M | Feedback teaches a way of finding the note, not just the answer |

## 10v. Installing and sharing

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-300 | The site's manifest names it Sketchpad, opens full screen at its own folder, and every icon it names ships at its stated size. | D-076 | A | The site installs as an app with its own name and icon |
| R-301 | The page carries the iOS home-screen tags and registers the service worker; a refused registration leaves the app working. | D-076 | A | The page asks to be kept offline and looks like an app on iOS |
| R-302 | Installing caches every file the site ships, fetched past the HTTP cache. | D-076 | A | Every file the site ships is kept for offline use |
| R-303 | Once opened, the app and its icons load with no network. | D-076 | A | It works offline once installed |
| R-304 | Any change to any shipped file gives the site a new version; an unchanged upload keeps its version; after the next open the new page is what loads. | D-076 | A | A new version of the app replaces the old one on the next open |
| R-305 | A new version deletes the old version's cache and no other cache. | D-076 | A | Old versions are cleared out, and nothing else is touched |
| R-306 | On iOS, sound plays with the silent switch on. | D-076 | M | Sound plays with the iPhone on silent |
| R-307 | Anyone with the link can install the app, without an account. | UC-31 | M | Someone else installs it from the link |
| R-343 | The app and the installable site build from the repository alone with one command, and a push to main tests and publishes them. | D-076 | M | The site builds and publishes from the repository |

## 10w. Typing chord names

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-308 | A typed chord name is read into its notes, with extensions stacked above the seventh. | D-077 | A | A chord name is read into its notes |
| R-309 | A typed chord has exactly the notes the dictionary gives the same chord. | D-077 | A | Typed chords sound like the same chord picked from a list |
| R-310 | The common chart spellings of each chord type are understood; M is major and m is minor. | D-077 | A | Common ways of writing a chord are understood |
| R-311 | Roots are read with # ♯ b ♭ in any letter case, and written in the current key's spelling. | D-077, D-074 | A | Flats and sharps in chord names |
| R-312 | A slash chord puts its bass note just under the chord and keeps every chord tone; 6/9 is not a slash chord. | D-077 | A | A slash chord puts its bass note at the bottom |
| R-313 | A line is read in order; spaces, commas, bar lines and stand-alone dashes separate chords. | D-077 | A | A line of chords is read in order, ignoring bar lines |
| R-314 | An unknown name is refused with a reason and, when one is close, a suggestion; the others in the line are still read; nothing joins the loop while any is refused. | D-077 | A | An unknown chord is refused with a reason and a suggestion |
| R-315 | In Do-Re-Mi, chord names are read with solfège roots. | D-077, D-019 | A | Typed chords can be read in Do-Re-Mi |
| R-316 | A typed chord is numbered in the current key, including chords from outside it. | D-077 | A | Typed chords get numerals in the key |
| R-317 | A numeral is lowercase only for minor and diminished chords; maj7 and its family are uppercase. | D-077 | A | A major seventh chord keeps a capital numeral |
| R-318 | The typed chords show the keys that hold all their notes, or say that none does. | D-077, UC-62 | A | The chords you type say which keys hold them |
| R-319 | 7sus4 and 9sus4 are in the dictionary and the chord table. | D-077 | A | Suspended sevenths are chords the app knows |
| R-320 | The typing buttons insert text the reader understands. | D-077 | A | The typing buttons insert text the reader understands |
| R-321 | On a phone, the chord box does not capitalise or autocorrect, previews each chord, and adds them to the loop in one tap. | UC-62 | M | Typing a song's chords on the phone |
| R-322 | The in-app guide explains typing chord names, with an example the box reads. | D-077, D-050 | A | The guide explains typing chord names |

## 10x. Finger numbers

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-323 | With fingers on, every lit key of a chord shows one finger number, 1–5, for the chosen hand. | D-078, UC-63 | A | A root-position triad is fingered 1-3-5 |
| R-324 | Triads follow the standard fingering: right hand 1-3-5 in root position, 1-2-5 in first inversion, 1-3-5 in second; left hand 5-3-1, 5-3-1, 5-2-1. In every key, major and minor. | D-078 | A | Inversions change the fingers the standard way |
| R-325 | Four-note chords within reach are 1-2-3-5 (right) and 5-3-2-1 (left); five-note chords use all five fingers. | D-078 | A | Seventh chords use four fingers |
| R-326 | For any chord in one hand, fingers rise with pitch in the right hand and fall in the left, and no finger is used twice. | D-078 | A | Fingers rise with pitch and never repeat |
| R-327 | A chord wider than the player's reach, or with more than five notes, is split between the hands: the left takes the lowest notes, the right the rest, each fingered by its own rule, and the app says "split between hands". | D-078 | A | A chord too wide for one hand is split between the hands |
| R-328 | A chord that cannot be split into two playable hands is shown without numbers, with "too wide to play as written". | D-078 | A | A chord no two hands can play is said to be too wide |
| R-329 | Major and natural minor scales, one octave up, in all 12 keys and both hands, use the fingering from a published standard table, checked against the source. | D-078 | A | Scales use the standard fingering in every key |
| R-330 | No scale fingering puts the thumb on a black key. | D-078 | A | The thumb never lands on a black key in a scale |
| R-331 | The key where the thumb tucks under (or a finger crosses over) is marked on the piano and named in words. | D-078, UC-63 | A | The thumb crossing is marked and named |
| R-332 | The scale lessons in Learn show the fingering and say where the thumb crosses; the chord lessons say which fingers to use. | UC-63, D-073 | A | Scale lessons say where the thumb crosses |
| R-333 | A switch next to the keyboard offers off, right, left and both. Learn shows the right hand by default; elsewhere it is off until chosen; the choice is remembered across tabs. | UC-63 | A | The finger switch has four settings and is remembered |
| R-334 | Wherever fingering appears, the app calls it "suggested fingering" and never claims to check the fingers used. | D-078 | A | Fingering is suggested, never checked |
| R-335 | The finger numbers can be read on white and black keys, in every fill colour, at arm's length on a phone. | D-078 | M | Finger numbers are legible on the phone |
| R-336 | The How to use guide explains finger numbers and the switch. | D-078, D-050 | A | The guide explains finger numbers |
| R-337 | Playing a lesson with the suggested fingering feels natural; nothing asks for a stretch a beginner can't make. | UC-63 | M | The suggested fingering feels natural to play |
| R-338 | In *both*, the left hand plays the bass note (the root, or the bass of a slash chord) with 5, and the right hand plays the chord by the chord rule. | D-078 | A | Both hands put the bass in the left hand |
| R-339 | A chord that needs two hands shows both hands, with a bracket over each hand's keys, whichever hand is chosen. | D-078 | A | A chord that needs two hands shows both |
| R-340 | The hand reach setting offers a 7th, an octave, a 9th and a 10th (11, 12, 14 and 16 keys), defaults to an octave, and decides when a chord is split. | D-078 | A | Hand reach decides when a chord is split |
| R-341 | With *Show suggested fingering* ticked (off by default), each bar on the sheet shows right-hand numbers on the chord and the left-hand finger on the bass. | D-078, D-057 | A | The sheet can show suggested fingering |
| R-342 | The two hands can be told apart without colour: solid discs for the right hand, outlined for the left, on screen and in a black-and-white printout. | D-078 | M | The two hands can be told apart without colour |

## 10y. J-6 Explorer

The second app in this repository (`D-079`–`D-085`, `UC-64`, `UC-65`).

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-344 | Every voicing in a validated J-6 set sounds its label's root and no note outside its label's chord. | D-080 | A | Every chord in sets 29, 47 and 54 is spelled by its J-6 voicing |
| R-345 | A 4-voice voicing missing a chord tone still counts as its chord; one with a stray note does not. | D-080 | A | A 4-voice voicing with a missing tone still counts as its chord |
| R-346 | A set that fails validation is flagged key by key, with a reason, and ~~is never recommended by search~~ a set where most keys fail is never recommended (R-371). | D-082 | A | A set whose published voicings contradict their labels is flagged and never recommended |
| R-347 | A J-6 key's chord is shown in musician spelling, with the manual's label and the device's voicing beside it. | D-079, UC-64 | A | Pressing D# on set 54 shows Fmaj7 with the J-6 voicing F3 A3 C4 E4 |
| R-348 | Chord symbols are read the way musicians type them (maj7, M7, -7, sharps and flats, slash chords), and unknown symbols are refused. | D-079 | A | Chord symbols are read the way musicians type them |
| R-349 | Keys played in Explore give the likely key, how many chords fit it, and each chord's numeral. | UC-64 | A | Keys C, C#, G, D# on set 54 read as Imaj7 iii7 vi7 IVmaj7 in C major |
| R-350 | Numerals are relative to the likely key, not to C. | UC-64 | A | Roman numerals follow the key, not the letter C |
| R-351 | The pad labels can be read at arm's length beside the hardware, and the latest key is told apart without colour. | UC-64 | M | The pad labels are readable at arm's length beside the hardware |
| R-352 | KEY transpose moves every chord root and every voicing note by the same number of semitones. | D-081 | A | KEY transpose moves every chord and its voicing by the same amount |
| R-353 | Search tries every KEY value, names the KEY to set, and breaks ties in favour of the smaller transposition. | D-081, UC-65 | A | Dm7 G7 Cmaj7 Am7 finds set 47 at KEY −3 with four exact matches |
| R-354 | Musical search scores an inversion and a chord with a missing or extra tone as near matches, below exact ones. | UC-65 | A | Musical search counts an inversion and a missing seventh as near matches |
| R-355 | A chord with a different third is never a musical match. | UC-65 | A | A chord with the wrong third is never a musical match |
| R-356 | Exact search accepts only the same root, quality and bass. | UC-65 | A | Exact search without transpose ranks set 54 first at 75% |
| R-357 | The KEY direction and range the engine assumes are the device's, checked on a J-6. | D-081 | M | The KEY direction and range match the hardware |
| R-358 | The 8th lower pad is drawn as playing the C chord, as the device does. | D-083 | M | The high C pad plays the C chord |
| R-361 | J-6 chord names are spelled the way their key writes them, through Sketchpad's spelling, and never mix sharps and flats within one key. | D-086, D-074 | A | J-6 chords are spelled the way their key writes them |
| R-362 | The J-6 engine has no theory of its own beyond its adapter, validator, data and search: spelling, qualities, chord names and numerals come from Sketchpad's theory layer. | D-086 | I | `j6/j6.mjs` imports |
| R-359 | The J-6 prototype screens are generated from the engine and never edited by hand. | D-084 | I | `proto/j6/build-prototype.mjs` |
| R-360 | The J-6 scenarios live in `sketchpad.feature`, and the traceability test covers the J-6 tests. | D-085 | A | *(traceability.test.mjs)* |

## 10y-2. J-6 chord data

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-368 | All 100 J-6 chord sets are in the app, with every key's label and voicing exactly as the manual prints them. | D-088 | A | All 100 chord sets are read from the manual, label and voicing as printed |
| R-369 | Every label in the manual is read, in the manual's own spellings, except a typo, which is reported rather than guessed. | D-088 | A | The manual's chord spellings are read the way it means them |
| R-370 | Every key of every set is validated, and the list of keys that fail is recorded in `DESIGN.md` and pinned by a test. | D-082, D-088 | A | The manual's errors are listed, and the list is pinned |
| R-371 | A key whose printed notes contradict its label is never suggested by search; the rest of its set still is; a set where most keys fail is left out. | D-082 | A | A key whose printed voicing contradicts its label is never suggested, and the rest of its set still is |
| R-372 | A voicing of three or more notes with no root, every note in the chord, counts as its chord. | D-080 | A | A rootless voicing counts as its chord |

## 10y-3. J-6: playing a chord, keeping it

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-373 | In Explore a tap plays and shows a chord without keeping it, and Rec is off when the page opens. | D-089 | A | Tapping a J-6 key plays it without adding it to the progression |
| R-374 | "+ Add to progression" keeps the chord on screen, and does nothing when no chord is on screen. | D-089 | A | Add keeps the chord on screen |
| R-375 | With Rec on, every tap joins the progression in order; with it off, none does. | D-089 | A | With Rec on, every key tapped joins the progression in order |
| R-381 | Turning Rec off keeps the progression and its numbers on the pads; only Clear, Undo or × remove chords. | D-089 | A | Turning Rec off keeps what was recorded, numbered on the pads, until it is cleared |
| R-382 | Every chord name fits on its pad: the root, then the type in lines of at most 7 characters, broken only before a bracket, slash, add or sus. | D-089, D-079 | A | Every chord name fits on its pad |
| R-383 | The progression plays at a tempo of 60–160 BPM in steps of 5, starting at 90. | D-090 | A | Tempo runs from 60 to 160 BPM, starting at 90, in steps of 5 |
| R-384 | Every chord lasts ½, 1 or 2 bars (1 to start), sounding a little less than its length. | D-090 | A | Each chord lasts half a bar, one bar or two bars |
| R-385 | With Loop on (to start) the progression repeats until stopped; with it off it plays once and stops. | D-090 | A | With Loop on the progression repeats, and with it off it plays once and stops |
| R-386 | With the click on (off to start), one bar is counted in, then every beat clicks, the first of each bar stronger. | D-090 | A | The click counts in one bar, then marks every beat with the first of each bar stronger |
| R-387 | While playing, the chord sounding is highlighted in the progression and on its pad; a tempo change takes effect from the next beat; Stop silences everything at once. | D-090 | M | Playing along with the J-6 at the app's tempo |
| R-388 | A misprinted key is named from the notes it prints, the way a label is checked: root sounding, missing tones allowed, a root in the bass preferred. | D-093 | A | A misprinted key is named from the notes it prints |
| R-389 | The key's major scale, its major pentatonic and the relative minor's pentatonic are offered to play over the progression; chords outside the key are named. | D-092 | A | Two or three scales are offered to play over the progression |
| R-390 | With a scale chosen, the piano shows it, holds still and lights the chord sounding, and can be played while the progression loops. | D-092 | M | Playing along on the piano while the progression plays |
| R-391 | The progression can be shown as Sketchpad's sheet, printed or copied as text, each chord in its J-6 voicing with its numeral and where it is on the J-6. | D-091, D-057 | A | The progression can be taken away as a sheet, with the J-6 keys for each chord |
| R-392 | The sheet shows suggested fingering only when ticked. | D-091, D-078 | A | The sheet shows suggested fingering only when ticked |
| R-393 | The sheet's scale is the one chosen to play along with, or the key's major scale. | D-091, D-092 | A | The sheet's scale is the one chosen to play along with |
| R-394 | Printed, only the sheet appears, legible in black and white, with the J-6 keys listed. | D-091 | M | A printed J-6 sheet can be played from at a piano |
| R-395 | The panel names the major key, and its relative minor, that a set's pads fit best at the current KEY, with how many pads fit; KEY moves it by exactly as many semitones. | D-094 | A | Each chord set shows the key it plays in, and KEY moves it |
| R-396 | The pads mark I, IV, V and vi of that key, only on chords whose notes are all in it. | D-094 | A | The home chord, its two closest relatives and the relative minor are marked on the pads |
| R-397 | Find's steps on the J-6 are the manual's: SHIFT + [CHORD] and [TEMPO/VALUE] for the set, SHIFT + [A (KEY)], [TEMPO/VALUE] and [C (EXIT)] for KEY. | D-094 | A | Find gives the steps on the J-6 in the manual's words |
| R-398 | Beside the J-6, the key on the panel and the marked pads follow KEY as the hardware does. | D-094 | M | The key can be read off the panel beside the J-6 |
| R-376 | Any kept chord can be taken out; undo takes off the last and clear empties the progression. | D-089 | A | A chord can be taken out of the progression, and undo and clear still work |
| R-377 | The key is judged from the progression once it has chords, and from the chord on screen before that. | D-089 | A | The key follows the progression once it has chords, and the last key tapped before that |
| R-378 | A kept chord keeps its own set and KEY, and plays from them. | D-089 | A | A progression can mix chord sets and KEY settings |
| R-379 | Find's best match can be added to the progression in one tap, in the order searched for. | D-089, UC-65 | A | A search result can be added to the progression in one tap |
| R-380 | Trying chords out never keeps one by accident, and Rec's state reads at a glance without colour. | D-089, UC-64 | M | Trying chords out never fills the progression by accident |

## 10z. J-6 Explorer on the site

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-363 | The J-6 Explorer is published at `j6/` with its own manifest, name, home-screen title and icons, kept to its own folder. | D-087 | A | The J-6 Explorer installs as its own app next to Sketchpad |
| R-364 | Each app's offline cache has its own name, and updating either app deletes only its own old caches. | D-087 | A | Updating one app never clears the other's offline copy |
| R-365 | The J-6 Explorer installs on an iPhone from its link, opens full screen, works offline, and links back to Sketchpad. | D-087, UC-64, UC-65 | M | The J-6 Explorer installs from its link and works beside the J-6 |
| R-366 | The J-6 page reuses Sketchpad's piano, sound and colour tokens rather than defining its own; its extra colour roles are tokens, and no literal colour appears below its token block. | D-087, D-018 | I | `j6/app.jsx`, and G8 in `check-done` |
| R-367 | Until checked on a J-6, the page states the KEY range and direction and the high C behaviour as assumptions, and says where its chord data comes from. | D-081, D-083, D-087 | I | `j6/app.jsx` footer |

## 10za. Reusable assets

The music logic is a set of modules the products share. Their own requirements are in [`core/REQUIREMENTS.md`](core/REQUIREMENTS.md); these are the product's requirements *of* that arrangement.

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-399 | The theory is a set of modules in `core/` and `sketchpad/`, one capability each, which the products and the tests import. Nothing is generated, and no product defines what a module exports. | D-096 | A | *(`check-done` G0 and G6)* |
| R-400 | Core imports nothing outside core. The modules' layers are their imports, acyclic, and each module's header and document state them. | D-096 | A | *(`core-check` C3, and `core/tests/architecture.test.mjs`)* |
| R-401 | Every core requirement has a test and a source that exists; every core test names a requirement; every core decision is used. | D-096 | A | *(`core-check` C1 and C4)* |
| R-402 | Every export of every module is described in the module's document, and nothing described is missing. | D-096 | A | *(`core-check` C2)* |
| R-403 | Every exported function gives the same answer for the same input, leaves its arguments alone, and returns plain data. | D-096 | A | *(`core/tests/architecture.test.mjs`)* |
| R-404 | Each architecture and traceability check is shown to fail when a fault is planted. | D-096 | A | *(`core/tests/architecture.test.mjs`)* |
| R-413 | Sketchpad's own modules have requirements and tests of their own, held to the same traceability as core's. | D-096 | A | *(`core-check` C1, `sketchpad/tests/`)* |
| R-405 | Moving the theory out of the app changed no behaviour: the same checks pass, scripted runs of both apps give identical screen transcripts, and the builds are the same size. | D-096 | I | `D-096`, recorded once; `tools/smoke.mjs` reruns it |

## 10zb. Sharps or the key's spelling

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-406 | Sketchpad writes every black key as a sharp by default, in the key buttons, chord names and explanations. | D-097, D-019 | A | Sharps are the default spelling |
| R-407 | The user can choose to have each key written the way it is on a score (E♭ in C minor); Do-Re-Mi follows the same choice. | D-097, D-074 | A | The key's own spelling can be chosen |
| R-408 | The choice changes the names only: the same twelve pitches, the same chords and scales. Lessons keep spelling for their own key. | D-097, D-073 | A | Accidentals change the names and nothing else |

## 10zc. One transport

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-409 | Both apps start, tick and stop their loop through one driver, which is given its clock and timer and touches nothing else. | D-098, D-043 | A | *(`core/tests/transport.test.mjs`, and `check-done` G0)* |
| R-410 | The J-6's playback behaviour is unchanged by the move: tempo, bars per chord, loop, click and count-in. | D-098, D-090 | A | Tempo runs from 60 to 160 BPM, starting at 90, in steps of 5 |

## 10zd. One chord-naming function

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-411 | One function names a set of notes as a chord, exactly or with tones missing, and returns the same reading either way. | D-099, D-047 | A | *(`core/tests/chords.test.mjs`)* |
| R-412 | A misprinted J-6 key is named from its printed notes exactly as before the functions were joined. | D-099, D-093 | A | A misprinted key is named from the notes it prints |

## 10ze. The first note

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-414 | The piano is decoded while the page loads; the audio graph is built on the first touch, after the browser has started the audio (`D-102`). | D-100, D-070 | M | The first note after opening is the piano and is not late |
| R-417 | The first note after opening sounds, in both apps, with no waiting before it, and a quick tap on the first key still sounds briefly. | D-101, D-100, D-104 | M | The first note after opening is the piano and is not late |
| R-418 | In both apps the first touch and the second each put sound out. | D-102, D-100 | M | The first note after opening is the piano and is not late |
| R-419 | The audio starts on the first touch that counts, wherever it lands, and a request to start it that was refused never blocks a later one. | D-103 | A | *(`tools/sound-check.mjs`, gate G15)* |
| R-420 | If sound is asked for and the browser has not allowed it, the page says so and offers a tap that fixes it. | D-103 | A | *(`tools/sound-check.mjs`, gate G15)* |
| R-421 | In both apps a piano key, a pad and a second note each put sound out, under every reading of the phone's touch rule that is tested. | D-103, D-102 | A | *(`tools/sound-check.mjs`, gate G15)* |
| R-415 | An embedded recording is converted to the bytes it holds, without a browser function. | D-100, D-070 | A | An embedded recording is turned into the bytes it holds |

## 10zf. The sound options

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-422 | The sound choices (instrument, how a chord is played, reverb, echo) are in one section that is folded away until asked for, and every choice the catalogues hold is offered once. | D-105 | A | The sound options are folded away and offer every choice |
| R-423 | No engine text (status, detail, voice count) is shown; the recordings' credit stays on show with the options. | D-105, D-062 | A | The sound options are folded away and offer every choice |
| R-424 | Fingers and the octave control share one row above the piano, and the legend is under it. | D-105, D-106 | A | The octave control sits above the piano |
| R-426 | The sound, silence, test sound and reset audio buttons are not shown. | D-106 | A | The octave control sits above the piano |
| R-427 | Nothing on the screen moves when the first note is played; the tap-to-turn-on bar appears only after a long wait and floats. | D-106, D-103 | A | The octave control sits above the piano |
| R-425 | Nothing on the screen is wider than a phone, with the options shut or open. | D-105, D-002 | A | The sound options are folded away and offer every choice |

## 10zg. The instruments

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-428 | Every pair of instruments differs in at least two of: how quickly it speaks, how long it takes to die away, how much is left after a second, how bright it is. | D-107, D-062 | A | The instruments sound different from one another |
| R-429 | The instruments are about as loud as one another, within a factor of two. | D-107 | A | The instruments sound different from one another |
| R-430 | The pad is wider in sound than the other instruments. | D-107 | A | The instruments sound different from one another |
| R-431 | Echo has three levels: off, light and long. Light is the default, and fades below 1% by its third repeat. | D-107, D-041 | A | A light echo fades fast |

## 10zh. Playing notes

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-432 | One setting says how notes are played, for chords and for scales: together, roll, slow roll, up, down, up and down, random. | D-108, D-068 | A | Chords and scales are played the same way |
| R-433 | A scale can only run: given together, roll or slow roll it plays up; a random scale ends on its top note. | D-108 | A | Chords and scales are played the same way |
| R-434 | The ways to play are buttons with a picture each, the same buttons in the Played row and, the runs only, in the Scales tab, sharing one state. | D-108 | A | The ways to play are buttons with pictures |

## 11. Visual system

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-237 | Every colour comes from a role-named token; no literal colours in components. | X-16, D-018 | I | Review at each change |
| R-238 | A new visual role is added to the token set before it is used. | D-018 | I | Review at each change |
| R-239 | The two visual channels remain independent: a fill does not imply a marker. | D-016 | A | The two channels are independent |

## 12. Engine invariants

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-240 | Pitch class arithmetic wraps correctly for negative and large inputs. | D-006 | A | Pitch class arithmetic wraps correctly in both directions |
| R-241 | Nearest-octave placement is deterministic, and ties resolve downward. | D-023 | A | place() finds the nearest octave, not a random one |
| R-242 | No `Math.random` appears in the theory layer. | D-024 | I | Review at each change |

## 13. Process

| ID | Requirement | Source | Mode | Verified by |
|---|---|---|---|---|
| R-243 | Every automatable scenario has a test of the same name, and every test has a scenario. | X-21, D-026 | A | *(traceability.test.mjs)* |
| R-244 | Every requirement here names a scenario that exists in the feature file. | D-026 | A | *(check-done.mjs)* |
| R-245 | Manual scenarios remain under 40% of the suite. | D-026 | A | *(traceability.test.mjs)* |
| R-246 | At least 90% of mutants are killed, with no stale mutants. | X-22, D-027 | A | *(mutate.mjs)* |
| R-247 | Every change updates the requirements, the use cases, the scenarios and the change log in the same pass. | D-028, DESIGN §9 | I | `DONE.md` checklist |
| R-248 | A change is done only when every gate in `DONE.md` passes or has a dated exception. | D-028 | I | `DONE.md` checklist |
| R-249 | The automated gates report 10/10 before a change is called done. | D-028 | A | *(check-done.mjs)* |

---

## Known gaps

Stated openly rather than left to be discovered.

| ID | Gap | Plan |
|---|---|---|
| R-004 | Offline operation is checked in a simulated browser and in headless Chromium, but not yet on a real iPhone. | The manual scenario, on the first real session. |
| R-120, R-121, R-132 | Enforced by review, which is the weakest mode here. | All three are lintable. Worth automating before the token set grows. |
| — | No requirement yet covers chord sets, voicings or the theory lessons. | They arrive with Phases 6 and 8. |
