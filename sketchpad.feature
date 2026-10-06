# Sketchpad — behaviour scenarios
#
# Written in Gherkin so each scenario names a starting state, an action, and
# what must then be true. Two audiences:
#   1. theory.test.mjs — the Then-clauses about notes, chords and scales are
#      asserted automatically. Run: node --test
#   2. A human with a phone — the Then-clauses about sound, timing and layout
#      are checked by hand. Marked @manual.
#
# Traceability: @UC-nn links to USE_CASES.md, @D-nnn to DESIGN.md.

Feature: Choosing a key sets the musical context
  The key is the root of everything. Every other feature reads from it.

  @UC-01 @auto
  Scenario: The scale of a minor key
    Given the key is "C# minor"
    Then the scale notes are "C# D# E F# G# A B"
    And the home note is "C#"

  @UC-01 @auto
  Scenario Outline: Scales across keys
    Given the key is "<key>"
    Then the scale notes are "<notes>"

    Examples:
      | key      | notes                |
      | C major  | C D E F G A B        |
      | A minor  | A B C D E F G        |
      | F# minor | F# G# A B C# D E     |
      | A# minor | A# C C# D# F F# G#   |

  @UC-01 @manual
  Scenario: Changing key rebuilds everything visible
    Given the key is "C# minor"
    And the chord "A" is selected
    When I change the key to "F minor"
    Then the chord palette shows the chords of F minor
    And no chord is selected
    And the explanation names F as the new home note
    And the scale markers on the piano have moved

Feature: The chord palette
  Answering "what can I play in this key" without needing theory.

  @UC-05 @auto
  Scenario: Triads of a minor key
    Given the key is "C# minor"
    When I ask for the triads in this key
    Then I get 7 chords
    And they are "C#m D#dim E F#m G#m A B"
    And the chord "C#m" contains the notes "C# E G#"
    And the chord "A" contains the notes "A C# E"

  @UC-05 @auto
  Scenario: Triads of a major key
    Given the key is "C major"
    When I ask for the triads in this key
    Then they are "C Dm Em F G Am Bdim"

  @UC-07 @auto
  Scenario: Sevenths of a minor key
    Given the key is "C# minor"
    When I ask for the sevenths in this key
    Then they are "C#m7 D#m7♭5 Emaj7 F#m7 G#m7 Amaj7 B7"
    And the chord "C#m7" contains the notes "C# E G# B"

  @UC-05 @auto
  Scenario: Every key produces a complete, recognised palette
    Given any of the 24 keys
    When I ask for the triads in this key
    Then every chord has a recognised quality
    And no chord is labelled unknown

  @UC-06 @manual
  Scenario: Pressing a chord
    Given the key is "C# minor"
    When I press the chord "C#m"
    Then the piano lights C#, E and G# in the chord colour
    And C# carries the root ring
    And all three notes sound together
    And the chord stays lit until I select another chord

  @UC-00 @manual
  Scenario: Reading a chord off the screen to play it on my own instrument
    Given I have pressed the chord "A"
    When I look away for thirty seconds and scroll the page
    Then A, C# and E are still lit
    And the explanation still describes the A chord

Feature: Understanding why a chord fits
  Theory arrives as an explanation of something already heard.

  @UC-14 @auto
  Scenario: A diatonic chord shares notes with home
    Given the key is "C# minor"
    And the scale is "natural-minor"
    When I select the chord "A"
    Then the explanation reports no notes outside the scale
    And the explanation mentions the shared notes "C#" and "E"

  @UC-14 @auto
  Scenario: A borrowed chord is explained, not rejected
    Given the key is "C# minor"
    And the scale is "natural-minor"
    When I select a G#7 chord
    Then the explanation reports "B#" as outside the scale
    And the explanation does not tell me to avoid the chord

  @UC-14 @auto
  Scenario: The same chord explained in Do Re Mi
    Given the key is "C# minor"
    When I select the chord "A" with note names set to solfege
    Then the explanation calls the chord "La"
    And the shared notes are named "Do#" and "Mi"

Feature: Scales and their differences
  The user picks a palette by sound, then learns what changed.

  @UC-08 @auto
  Scenario Outline: Scale contents
    Given the key is "C# minor"
    When I select the scale "<scale>"
    Then the scale notes are "<notes>"

    Examples:
      | scale            | notes                 |
      | natural-minor    | C# D# E F# G# A B     |
      | dorian           | C# D# E F# G# A# B    |
      | minor-pentatonic | C# E F# G# B          |
      | harmonic-minor   | C# D# E F# G# A C     |
      | phrygian         | C# D E F# G# A B      |
      | blues            | C# E F# G G# B        |

  @UC-09 @auto
  Scenario: Dorian differs from natural minor by exactly one note
    Given the key is "C# minor"
    When I compare "dorian" with "natural-minor"
    Then exactly one note is different
    And "A" has become "A#"

  @UC-09 @auto
  Scenario: The one-note difference holds in every key
    Given any of the 12 tonics
    When I compare dorian with natural minor
    Then exactly one note differs

  @UC-10 @manual
  Scenario: Hearing a scale
    Given the scale is "dorian"
    When I press play scale
    Then the notes sound one at a time, ascending
    And each note lights as it sounds
    And I can hear it is brighter than natural minor

Feature: Building and playing a loop

  @UC-11 @manual
  Scenario: Adding chords
    Given the key is "C# minor"
    When I add "C#m", "A", "E" and "B" to the progression
    Then the loop reads "C#m A E B"
    And the notes of all four chords show faintly on the piano

  @UC-12 @manual
  Scenario: Playing the loop
    Given the loop is "C#m A E B" at 88 bpm
    When I press play
    Then each bar lights that chord's notes on the piano
    And the current slot is marked in the loop
    And the scale markers stay visible underneath
    And it returns to the first chord without a gap

  @UC-12 @UC-00 @manual
  Scenario: Adding a chord while the loop plays
    Given the loop is playing
    When I add another chord
    Then playback continues without interruption
    And the new chord joins the loop on the next pass

Feature: Finding the scale that fits what I built
  The reverse direction — from what the user made, back to what they can play.

  @UC-21 @auto
  Scenario: A diatonic loop fits its own scale
    Given the key is "C# minor"
    And the loop is "C#m A E B"
    When I ask which scales fit
    Then "Natural minor" covers every note
    And "Minor pentatonic" does not cover every note

  @UC-21 @auto
  Scenario: A loop with a borrowed chord names what does not fit
    Given the key is "C# minor"
    And the loop is "C#m A E" plus a G#7 chord
    When I ask which scales fit
    Then no seven-note scale covers every note
    And the missing note is reported as "C"

  @UC-21 @manual
  Scenario: Reaching the answer quickly
    Given I have a loop
    Then "which scales fit?" is one tap away

Feature: The piano shows harmony and palette at the same time
  Two channels, so neither hides the other.

  @D-016 @auto
  Scenario: A chord tone inside the scale
    Given the key is "C# minor"
    And the chord "C#m" is selected
    Then the key E has the fill role "chordTone"
    And the key E has the marker "scale"

  @D-016 @auto
  Scenario: The root of the selected chord is distinguished
    Given the chord "C#m" is selected
    Then the key C# has the fill role "chordRoot"
    And the key C# has the marker "home"

  @D-016 @auto
  Scenario: A note only used elsewhere in the loop
    Given the loop contains "B" but the selected chord is "C#m"
    Then the key B has the fill role "inLoop"

  @D-016 @auto
  Scenario: A sounding note overrides every other fill
    Given the chord "C#m" is selected
    And C#3 is sounding
    Then the key C#3 has the fill role "sounding"

  @D-016 @manual
  Scenario: Legibility on a phone
    Given a chord is selected and a scale is active
    Then I can tell chord tones from scale notes at arm's length
    And I can tell them apart on the black keys too

Feature: Sound is always controllable

  @UC-28 @D-017 @manual
  Scenario: Silencing a stuck note
    Given something is sounding that I did not expect
    When I press silence
    Then all sound stops immediately
    And my selected chord is still lit
    And my loop is unchanged

  @UC-28 @D-017 @manual
  Scenario: Notes release between bars
    Given the loop is playing at 60 bpm
    Then each chord has decayed before the next one starts
    And sound does not accumulate over repeated passes

Feature: Note naming
  Letters or Do Re Mi, chosen by the user.

  @UC-30 @auto
  Scenario Outline: Fixed-do naming
    Given note names are set to solfege
    Then the note "<letter>" is displayed as "<solfege>"

    Examples:
      | letter | solfege |
      | C      | Do      |
      | D      | Re      |
      | E      | Mi      |
      | F      | Fa      |
      | G      | Sol     |
      | A      | La      |
      | B      | Si      |
      | C#     | Do#     |

  @UC-30 @auto
  Scenario: Chord labels follow the naming system
    Given note names are set to solfege
    And the key is "C# minor"
    Then the home chord is labelled "Do#m"

  @UC-30 @manual
  Scenario: Switching naming does not change anything else
    Given I have a loop and a selected chord
    When I switch between letters and Do Re Mi
    Then the same keys stay lit
    And nothing stops playing

Feature: Riffs and basslines
  Authored rhythm, generated pitch. The last link in the main scenario.

  @UC-29 @auto
  Scenario: A bassline starts on the root of its chord
    Given the loop is "C#m A E B" in C# minor
    When I generate the "Walk to the next chord" bassline
    Then the first note of each bar is the root of that bar's chord

  @UC-29 @auto
  Scenario: Every note is a chord tone, a scale note, or a deliberate approach
    Given any pattern, any chord in the loop, and any seed
    When I generate a figure
    Then every note is a chord tone, a scale note, or an approach note
    And only approach notes are allowed outside the scale

  @UC-29 @D-024 @auto
  Scenario: The same seed always gives the same figure
    Given a pattern, a chord and the seed 42
    When I generate the figure twice
    Then both figures are identical

  @UC-29 @D-024 @auto
  Scenario: Different seeds give different figures
    Given a pattern and a chord
    When I generate figures across twenty seeds
    Then not all of them are the same

  @D-023 @auto
  Scenario: The rising line rises
    Given the "Rising line" riff
    When I generate it at any seed
    Then each step of the climb is higher than the one before
    And every step still lands on a scale note

  @D-023 @auto
  Scenario: The falling line falls
    Given the "Falling line" riff
    When I generate it at any seed
    Then each step of the descent is lower than the one before

  @UC-29 @auto
  Scenario: Figures stay in a playable register
    Given any pattern and any seed
    Then no note is more than eighteen semitones from its register centre
    And no two consecutive notes leap more than a major ninth

  @UC-29 @auto
  Scenario: Every style offers both a bassline and a riff
    Given any of the six styles
    Then it offers at least one bassline and at least one riff
    And every pattern has a name and a description

  @UC-29 @D-016 @auto
  Scenario: A sounding bass note reads as bass, not as a chord tone
    Given a bassline note is sounding
    Then that key has the fill role "bass"
    But a riff note sounding on the same key outranks it

  @UC-29 @manual
  Scenario: Hearing the suggestion
    Given the loop is "C#m A E B" and the style is "soul"
    When I tap suggest and play the loop
    Then a bassline and a riff play in time with the chords
    And the piano shows bass notes in the bass colour
    And the figure sounds like it belongs to the style, not like random correct notes

  @UC-29 @manual
  Scenario: Muting the riff
    Given a bassline and a riff are playing
    When I mute the riff
    Then the bassline continues uninterrupted

  @UC-29 @manual
  Scenario: Editing the loop rewrites the figures
    Given figures have been generated
    When I add or remove a chord
    Then the figures rewrite themselves against the new progression

  @UC-29 @auto
  Scenario: Only approach notes are allowed outside the scale
    Given any pattern and any seed
    When I generate a figure
    Then any note outside the scale has the role "approach"
    And at least one such note exists across the pattern library

  @UC-29 @auto
  Scenario: Consecutive notes do not leap absurdly
    Given any pattern and any seed
    Then no two consecutive notes are more than a major ninth apart

  @UC-29 @auto
  Scenario: Every note fits inside its bar
    Given any pattern in the library
    Then every step starts within the sixteen steps of the bar
    And every step has a duration greater than zero

  @UC-29 @auto
  Scenario: Pattern steps never overlap
    Given any pattern in the library
    Then no two steps collide

  @UC-29 @auto
  Scenario: A figure is generated for every chord in the loop
    Given the loop is "C#m A E B"
    When I generate a bassline
    Then I get one figure per chord
    And none of them is empty

  @UC-29 @auto
  Scenario: The last chord's approach aims at the first chord, so the loop closes
    Given the loop is "C#m A E B"
    When I generate the walking bassline
    Then the final approach note sits a semitone from the root of the first chord

  @UC-29 @auto
  Scenario: Bass roots stay anchored to the register centre
    Given any bass pattern and any seed
    Then every root note is within six semitones of the register centre
    And the root does not move within a single bar

  @UC-29 @D-024 @auto
  Scenario: Each bar of the loop is seeded independently
    Given a loop containing the same chord twice
    When I generate a riff across many seeds
    Then the two bars are not always identical

  @UC-29 @auto
  Scenario: Every pattern is described for the user
    Given any pattern in the library
    Then it has a name and a plain-language description
    And every style it claims is a known style

  @UC-29 @UC-30 @auto
  Scenario: Figures are explained in the chosen naming system
    Given a generated bassline
    When I read the explanation in letters and then in solfege
    Then the note lists differ
    And neither leaks names from the other system

  @D-023 @auto
  Scenario: Directional steps still land on scale notes
    Given a riff with directional steps
    When I generate it at any seed
    Then every stepped note is in the active scale

  @D-016 @auto
  Scenario: The melody still outranks the bass when both sound
    Given a bass note and a riff note on the same key
    Then the key shows the melody, not the bass

  @D-016 @auto
  Scenario: With no bassline playing, the note falls back to its harmonic role
    Given no bassline is playing
    Then a key that is the chord root reads as "chordRoot"
    And a key belonging to nothing reads as "plain"

Feature: Harmony is judged against the key, melody against the palette
  A regression found by audit. Minor pentatonic and blues are subsets of the
  key, offered as melodic palettes. Judging chords against them made perfectly
  ordinary diatonic chords report as foreign.

  @UC-14 @D-025 @auto
  Scenario: A diatonic chord is not called foreign just because a subset palette is selected
    Given the key is "C# minor"
    And the selected palette is "minor-pentatonic"
    When I select the chord "A"
    Then no note is reported as outside the key
    And the headline does not call the chord foreign

  @UC-14 @D-025 @auto
  Scenario: A chord tone missing from the chosen palette is mentioned, gently
    Given the key is "C# minor"
    And the selected palette is "minor-pentatonic"
    When I select the chord "A"
    Then "A" is reported as absent from the palette
    And the explanation says the chord is still fully in key

  @UC-14 @D-025 @auto
  Scenario: Borrowed chords are still judged against the key, whatever palette is active
    Given the key is "C# minor"
    When I select a G#7 chord under any palette
    Then "C" is reported as outside the key every time

Feature: Invariants the engine must never break
  Lower-level than a use case, but a failure here corrupts everything above it.

  @auto
  Scenario: Pitch class arithmetic wraps correctly in both directions
    Given any midi number, positive or negative
    Then its pitch class is between 0 and 11

  @auto
  Scenario: Roman numerals match the degree and quality
    Given the key is "C# minor"
    Then the numerals are "i ii° ♭III iv v ♭VI ♭VII"
    And in C major they are "I ii iii IV V vi vii°"

  @auto
  Scenario: Every scale definition is well formed
    Given any scale in the library
    Then it starts on the tonic
    And its intervals ascend without duplicates
    And it stays within one octave
    And it has a mood and at least one style tag

  @auto
  Scenario: Chord voicings stay in a playable register
    Given any chord in any key
    Then its root sits between C3 and B3
    And no note is above C5
    And it has at most eight notes

  @auto
  Scenario: Chord notes ascend within a voicing
    Given any chord
    Then its notes are listed low to high

  @auto
  Scenario: An empty loop returns nothing rather than throwing
    Given no progression
    When I ask which scales fit
    Then I get an empty list

  @auto
  Scenario: A note outside chord, loop and scale has neither fill nor marker
    Given a chord is selected
    Then a key belonging to nothing is plain and unmarked

  @auto
  Scenario: The two channels are independent
    Given a chord tone that is outside the scale
    Then it carries a fill but no marker

  @auto
  Scenario: Naming never changes the underlying notes
    Given the same key and mode
    Then the chord notes are identical whichever naming system is active

  @auto
  Scenario: place() finds the nearest octave, not a random one
    Given a target pitch class and a reference note
    Then the result is the nearest octave of that pitch class
    And an exact tie resolves downward

Feature: Sound control and note length
  Added after real use. Notes rang on too long, and there was no way to keep
  the app open with the sound off.

  @R-115 @manual
  Scenario: Turning the sound off without losing my work
    Given I have a selected chord and a loop
    When I tap the speaker icon
    Then the icon shows sound is off
    And nothing sounds, including the loop if it is playing
    And the chord is still lit and the loop is unchanged
    And tapping the icon again brings the sound back

  @R-115 @manual
  Scenario: Mute and silence are different controls
    Given sound is playing
    Then "silence" stops what is sounding now but leaves sound enabled
    And the speaker toggle is a standing state that survives further taps

  @R-116 @manual
  Scenario: A tapped note does not ring on
    When I tap a piano key
    Then the note decays within about half a second
    And tapping several keys in a row does not pile them up

  @R-116 @manual
  Scenario: A tapped chord is short enough to tap the next one
    When I tap a chord and then another
    Then the first has largely decayed before the second lands

  @R-116 @manual
  Scenario: Loop chords clear before the next bar
    Given the loop is playing at 60 bpm
    Then each chord has decayed before the next bar starts
    And the bassline and riff are audible over it rather than buried

  @D-029 @manual
  Scenario: Colour reads on the sharp keys
    Given a chord is selected and a scale is active
    Then the sharps carry the same colour language as the naturals
    And a chord tone on a sharp is as obvious as one on a natural
    And the sharps are still clearly distinguishable from the naturals

Feature: A bar of playback is planned before it is played
  The scheduling bug class, made testable. Notes used to be given a duration
  built by string arithmetic and handed to the audio library's text parser,
  free to outlast the gap before the next note. They piled up until the synth
  ran out of voices and threw inside the transport callback, which ended
  playback for the rest of the session.

  @D-031 @auto
  Scenario: No voice is ever asked to hold two notes at once
    Given any chord, bassline and riff at any tempo
    When the bar is planned
    Then each voice's notes are strictly sequential

  @D-031 @auto
  Scenario: Every note ends before the note that follows it on the same voice
    Given any planned bar
    Then no note overlaps the next note on its own voice

  @D-031 @auto
  Scenario: Nothing spills past the end of its bar
    Given any planned bar
    Then every note starts inside the bar and ends by the end of it

  @D-031 @auto
  Scenario: Durations are numbers of seconds, never strings
    Given any planned bar
    Then every start time and duration is a finite positive number

  @D-031 @auto
  Scenario: A bar never asks for more voices than the instrument has
    Given any planned bar
    Then no more than twelve notes sound at the same instant

  @D-031 @auto
  Scenario: The chord leaves room for the bass and riff to be heard
    Given a planned bar
    Then the chord occupies less than sixty percent of it

  @D-031 @auto
  Scenario: A bar with no figures still plans the chord
    Given a loop with no bassline or riff
    Then the bar contains exactly the chord

  @D-031 @auto
  Scenario: An empty bar plans nothing rather than failing
    Given nothing to play
    Then the plan is empty

  @D-031 @auto
  Scenario: Faster tempos shorten notes rather than overlapping them
    Given a busy sixteenth-note bassline
    When the tempo is 60 or 200 bpm
    Then the plan is still clean

  @D-031 @manual
  Scenario: Playback survives a long session
    Given a loop with a bassline and a riff
    When I let it run for several minutes
    Then it does not get quieter, muddier or stop
    And no note is left ringing

  @D-031 @manual
  Scenario: Sound comes back after the phone is put down
    Given the loop has been playing
    When I switch apps or lock the phone and come back
    Then either sound resumes, or a banner offers to resume it
    And tapping the banner restores sound

  @D-031 @auto
  Scenario: Every note is followed by a moment of silence
    Given any planned bar
    Then each note ends before the next begins, with a gap between them

  @D-031 @auto
  Scenario: Each note is as long as its pattern intends, when there is room
    Given any pattern and any seed
    Then every planned note lasts as long as its step asks for, unless the next note arrives sooner

Feature: A chord is shown as the voicing it actually is
  Chords are stored as explicit notes in a register, then were lit by pitch
  class — so every octave of every chord tone lit at once. That filled the
  keyboard, hid the scale markers, and showed something the user could not
  copy onto their own instrument.

  @D-033 @auto
  Scenario: A chord lights only the octave it is voiced in
    Given the chord C#m is voiced at C#3 E3 G#3
    Then C#3 and E3 are lit
    But C#4, C#2 and E4 are not

  @D-033 @auto
  Scenario: The scale marker still covers every octave
    Given a key and an active scale
    Then the home and scale markers appear in every visible octave
    Because a palette is not a voicing

  @D-034 @auto
  Scenario: Chords sit underneath the melody in the mix
    Given a bar with a chord, a bassline and a riff
    Then the chord is quieter than both
    And every velocity is a fraction between zero and one

  @D-034 @manual
  Scenario: The sound is piano-like and notes decay
    When I tap a key
    Then it sounds struck rather than blown
    And it fades on its own rather than holding at a level
    And a chord does not ring on after the next one is played

  @D-033 @manual
  Scenario: I can read a voicing off the keyboard
    Given a chord is selected
    Then exactly its notes are lit, in the register it will sound in
    And I can copy those notes onto my own instrument without guessing the octave

Feature: The chord dictionary
  Fifteen qualities on any root, each with its formula and what it is for.

  @D-035 @auto
  Scenario: Every quality in the dictionary is buildable on every root
    Given any of the twelve roots
    Then every dictionary chord builds with its root lowest and no repeated notes
    And each has a formula and a plain-language description

  @D-035 @auto
  Scenario: The dictionary covers the qualities a beginner meets first
    Then major, minor, diminished, augmented, sus4, the sevenths and the ninths are all present

  @D-035 @auto
  Scenario: Chord formulas match the notes they produce
    Given any dictionary chord
    Then the formula has one degree per note

Feature: Ninth chords
  @D-035 @auto
  Scenario: A ninth sits above the seventh rather than beside the root
    Given the ninths of C# minor
    Then each chord's notes ascend
    And the ninth is more than an octave above the root

  @D-035 @auto
  Scenario: Every key produces recognised ninths
    Given any of the 24 keys
    Then all seven ninth chords have a known quality

  @D-035 @auto
  Scenario: Stacking keeps intervals ascending
    Given scale tones in chord order
    Then each interval is higher than the one before it

Feature: Inversions
  @D-035 @auto
  Scenario: An inversion keeps the same notes and changes only the bass
    Given a chord
    Then every inversion holds the same set of note names
    And the lowest note is the one named as the bass

  @D-035 @auto
  Scenario: Each inversion puts a different note at the bottom
    Given a chord
    Then no two inversions share a bass note

  @D-035 @auto
  Scenario: A seventh chord has four inversions
    Given a four-note chord
    Then there are four ways to voice it from the bottom up

Feature: Bass options under a chord
  What the picture in the brief showed: which notes are strongest right now.

  @UC-19 @D-035 @auto
  Scenario: The root is offered first and named the strongest
    Given a chord
    Then the first bass option is its root

  @UC-19 @auto
  Scenario: Chord tones are offered before passing notes
    Given a chord and a scale
    Then every option above the first passing note is a chord tone

  @UC-19 @auto
  Scenario: Every scale note appears somewhere in the options
    Given a chord and a scale
    Then no scale note is left out

  @UC-19 @auto
  Scenario: No bass option is offered twice
    Given any chord in the key
    Then each note appears at most once

  @UC-19 @auto
  Scenario: Every option explains itself
    Given the bass options
    Then each has a label and a reason

Feature: Getting from one chord to the next
  @UC-20 @auto
  Scenario: Every transition starts on this chord and lands on the next
    Given any pair of chords in the key
    Then every suggested bass line begins on the first root and ends on the second

  @UC-20 @auto
  Scenario: The chromatic approach arrives from a semitone away
    Given two chords
    Then the chromatic option's last step is a semitone

  @UC-20 @auto
  Scenario: The direct move is exactly two notes
    Given two chords
    Then the direct option is just the two roots

  @UC-20 @auto
  Scenario: Every transition explains itself
    Given the transitions between two chords
    Then each is named and has a reason

  @UC-20 @auto
  Scenario: Transitions never leap absurdly
    Given any pair of chords
    Then no step in any transition exceeds an octave

Feature: Chord sets
  Eight slots and a ready-made progression, in the shape of the J-6 sets but
  with our own content.

  @UC-16 @D-035 @auto
  Scenario: Every set builds in every key
    Given any set and any key
    Then it produces eight playable chords and its progression

  @UC-16 @auto
  Scenario: Every set contains the home chord somewhere
    Given any set built in a key
    Then one of its chords is on the tonic

  @UC-16 @auto
  Scenario: Every set names a quality the dictionary knows
    Given any set
    Then every slot uses a known chord quality

  @UC-16 @auto
  Scenario: Every set is described and belongs to a mode
    Given any set
    Then it has a name, a description, a reason for its progression and a mode

  @UC-16 @auto
  Scenario: Both modes have sets to choose from
    Then minor and major each offer at least two sets

  @UC-16 @manual
  Scenario: Taking a whole progression from a set
    Given a chord set is open
    When I tap "add all"
    Then its progression becomes my loop and I am taken to the Progression tab

Feature: A progression explains itself
  @UC-14 @auto
  Scenario: Each move is described, including the wrap back to the start
    Given a loop of chords
    Then there is one explanation per move, including the return to the first

  @UC-14 @auto
  Scenario: Shared notes between chords are named
    Given C#m moving to A
    Then the explanation names C# and E as the notes they share

  @UC-14 @auto
  Scenario: A loop starting at home is recognised as such
    Given a loop beginning on the tonic
    Then the summary says so

  @UC-14 @auto
  Scenario: A single chord is not a progression
    Given one chord
    Then there is nothing to explain

Feature: The app is organised into tabs
  @D-036 @manual
  Scenario: The key and the piano stay put
    Given I am on any tab
    Then the key selector and the piano are visible without scrolling back

  @D-036 @manual
  Scenario: Each tab answers one question
    Then Chords answers what can I play, Scales what notes are available,
    Progression what have I built, Bass what does the low end do,
    and Theory where all of it comes from

Feature: The audio layer reports on itself
  It is the one part of this project that cannot be unit tested — there is no
  audio device in the build environment. So it says what it is doing instead.

  @D-037 @manual
  Scenario: The app says why it is silent
    Given the app is open
    Then a status line shows the audio state and the current voice
    And if startup failed it shows the actual error rather than nothing

  @D-037 @manual
  Scenario: A test note proves whether the chain works
    When I tap "test sound"
    Then one note plays through the same path as every other sound
    And if it sounds while the rest of the app does not, the fault is not the audio chain

  @D-037 @manual
  Scenario: Loading the real piano cannot break the sound
    Given the synth is working
    When I tap "real piano" and the download fails
    Then the synth keeps working and the status says the samples were unavailable

Feature: The voice budget cannot leak
  The app went permanently silent after about thirty notes — the polyphony
  limit. Voices were being allocated and never returned by a pool inside the
  audio library, where no test here can reach. The pool is gone: one voice per
  note, destroyed when the note is finished, and a budget that is arithmetic.

  @D-038 @auto
  Scenario: A voice outlives its note, but not by much
    Given a note of any length
    Then its voice lives past its own release
    But not by more than a second

  @D-038 @auto
  Scenario: Every voice eventually expires
    Given voices for notes of any length
    When enough time has passed for the longest of them
    Then none remain

  @D-038 @auto
  Scenario: Reaping keeps the voices that are still sounding
    Given three voices ending at different times
    Then those already finished are destroyed and the rest are kept

  @D-038 @auto
  Scenario: Reaping an empty list is not an error
    Given no voices
    Then reaping returns nothing

  @D-038 @auto
  Scenario: The budget is never exceeded, however many notes are asked for
    Given any number of live voices and any number of requested notes
    Then the total never passes the budget
    And a full budget starts nothing new

  @D-038 @auto
  Scenario: A full budget drops notes rather than going silent forever
    Given the budget is full
    Then notes are dropped
    But as soon as one voice is reaped, sound resumes

  @D-038 @auto
  Scenario: A whole bar fits inside the budget
    Given a five-note chord, a bass note and a riff note at once
    Then the budget is not close to full

  @D-038 @auto
  Scenario: Voices from a finished loop do not accumulate across passes
    Given eight bars of a loop with seven notes each
    Then every bar can start all of its notes

  @D-038 @manual
  Scenario: A long session does not go quiet
    When I play more than a hundred notes
    Then sound continues
    And the voice counter returns to a low number between notes

  @D-038 @manual
  Scenario: Audio can be reset without reloading
    Given something has gone wrong with the sound
    When I tap "reset audio"
    Then every voice is destroyed and the next note sounds

Feature: A tab always has a chord to talk about
  The Bass and Theory tabs required an explicitly selected chord. A loop built
  entirely with the "add" button left them empty, with no explanation.

  @D-039 @auto
  Scenario: An explicitly selected chord always wins
    Given I have tapped a chord
    Then the tab describes that chord, whatever else is happening

  @D-039 @auto
  Scenario: While the loop plays, the tab follows the bar being heard
    Given the loop is playing and I have selected nothing
    Then the tab describes the chord currently sounding

  @D-039 @auto
  Scenario: With a loop but nothing selected, the first chord is used
    Given a loop built with the add button
    Then the tab describes its first chord

  @D-039 @auto
  Scenario: With no loop at all, the home chord is used
    Given an empty loop and no selection
    Then the tab describes the home chord of the key

  @D-039 @auto
  Scenario: With nothing at all, nothing is claimed
    Given no key, no loop and no selection
    Then the tab says it has nothing rather than inventing something

  @D-039 @auto
  Scenario: A playing index that points nowhere falls through safely
    Given a stale playing position
    Then the tab still finds a chord to describe

  @D-039 @manual
  Scenario: The progression loop actually plays
    Given a loop of chords
    When I press play
    Then the chords sound in time and the piano follows
    And if the transport cannot start, the explanation line says so

  @D-039 @manual
  Scenario: Adding a chord also selects it
    When I tap "add" under a chord
    Then that chord is lit on the piano and the Bass tab describes it

Feature: Instrument presets
  Three struck voices and a pad, chosen as data so the audio layer holds no
  opinions of its own.

  @D-040 @auto
  Scenario: Every preset is complete and playable
    Given any instrument
    Then it has a name, a description, a known voice kind, an envelope and a sane volume

  @D-040 @auto
  Scenario: A preset's release matches its envelope
    Given any instrument
    Then the release used by the voice budget is the release the envelope actually uses

  @D-040 @auto
  Scenario: Struck voices decay; only a pad holds at a level
    Given any instrument with an envelope
    Then the pad holds while the key is down
    But every struck voice has a tail rather than a plateau

  @D-040 @auto
  Scenario: Every instrument's voices fit the budget
    Given any instrument playing a normal note
    Then its voice lifetime is short enough not to starve the budget

  @D-040 @auto
  Scenario: An unknown instrument falls back rather than failing
    Given an instrument id that does not exist
    Then the first instrument is used

  @D-040 @auto
  Scenario: There is more than one sound to choose from
    Then at least three instruments exist, with distinct ids

  @D-040 @manual
  Scenario: Changing instrument does not interrupt what is sounding
    Given notes are sounding
    When I choose another instrument
    Then those notes finish normally and only the next note is different

Feature: Echo
  One switch, one fixed setting per instrument. No controls to get lost in.

  @D-041 @auto
  Scenario: Echo off is silent, not quiet
    Given echo is off
    Then the wet level and the feedback are both zero

  @D-041 @auto
  Scenario: Echo on stays inside safe bounds
    Given echo is on for any instrument
    Then the wet level cannot drown the dry signal
    And the feedback cannot run away
    And the delay time is musical

  @D-041 @auto
  Scenario: The pad gets a wider echo than the struck voices
    Then the pad's delay is slower than the Rhodes'

  @D-041 @manual
  Scenario: Echo can be switched without losing notes
    Given a loop is playing
    When I toggle echo
    Then no note is cut off, because only a level changes

Feature: Voicings
  The J-6 lesson applied: the same chord arranged differently.

  @UC-35 @D-042 @auto
  Scenario: Close voicing is the chord as written
    Given a chord
    Then its close voicing is exactly the notes it was built with

  @UC-35 @auto
  Scenario: Every voicing ascends and stays playable
    Given any chord of three, four or five notes
    Then every arrangement is ordered low to high, within a piano, and explained

  @UC-35 @auto
  Scenario: Open and spread keep every note of the chord
    Given a chord
    Then rearranging it does not change which notes it contains

  @UC-35 @auto
  Scenario: Open really opens: it spans wider than close
    Given a chord
    Then the open arrangement covers more distance than the close one

  @UC-35 @auto
  Scenario: Rootless drops the root, shell drops the fifth
    Given a seventh chord
    Then the rootless arrangement has no root
    And the shell keeps its root but is only three notes

  @UC-35 @auto
  Scenario: A triad offers no rootless or shell voicing
    Given a three-note chord
    Then arrangements that drop a note are not offered

  @UC-35 @auto
  Scenario: Every chord offers at least three arrangements
    Given any chord in the key
    Then there is a real choice to make

  @UC-35 @manual
  Scenario: The chosen voicing is what plays and what lights up
    Given I have chosen the open voicing
    When I tap a chord or add it to the loop
    Then that arrangement is what sounds and what the piano shows

Feature: More patterns to choose from
  @UC-29 @auto
  Scenario: Every style offers a choice, not a single answer
    Given any style
    Then it has at least two basslines and at least two riffs

  @UC-29 @auto
  Scenario: Pattern names are unique
    Then no two patterns share a name

  @UC-29 @manual
  Scenario: Browsing ideas rather than being given one
    Given a style
    Then I can see every bassline and mini melody it offers, each described
    And tapping one uses it, rather than having to press "surprise me" until it appears

Feature: The loop scheduler
  Our own, because the library transport failed silently twice and could not
  be tested here. A scheduler is a question about time, and time is arithmetic.

  @D-043 @auto
  Scenario: A bar lasts as long as the tempo says
    Given a tempo
    Then a bar of four beats lasts the right number of seconds

  @D-043 @auto
  Scenario: Only bars inside the lookahead window are scheduled
    Given a bar longer than the window
    Then only one bar is scheduled at a time

  @D-043 @auto
  Scenario: The cursor advances so no bar is scheduled twice
    Given the clock ticking repeatedly over twenty seconds
    Then every bar is scheduled exactly once, in order

  @D-043 @auto
  Scenario: No bar is ever scheduled in the past
    Given a cursor that has fallen behind
    Then bars are scheduled from now, not from where the cursor was

  @D-043 @auto
  Scenario: A stalled clock catches up without scheduling forever
    Given the tab was backgrounded for a minute
    Then catching up is bounded

  @D-043 @auto
  Scenario: Every scheduled bar knows which chord it is
    Given a cursor part-way through a loop
    Then each scheduled bar carries its index

  @D-043 @manual
  Scenario: The progression loop plays
    Given a loop of chords
    When I press play
    Then the chords sound in time, the piano follows, and it repeats without a gap

Feature: Where a borrowed chord comes from
  Turning an experiment into a lesson: name the scale the chord belongs to.

  @UC-37 @D-044 @auto
  Scenario: A chord outside the key is traced to a scale that contains it
    Given G#7 in the key of C# minor
    Then the app names harmonic minor and says which note is foreign

  @UC-37 @auto
  Scenario: A diatonic chord needs no suggestion
    Given a chord already inside the key
    Then nothing is suggested

  @UC-37 @auto
  Scenario: The suggested scale really does contain the whole chord
    Given any borrowed chord in any key
    Then the scale offered contains every note of it

  @UC-37 @manual
  Scenario: The suggestion is one tap away
    Given a chord with notes outside the scale
    Then a button offers the scale it belongs to, and tapping it switches

Feature: Building a chord out of the scale
  @UC-38 @D-044 @auto
  Scenario: Every step adds exactly one note
    Given any degree of the scale
    Then the walkthrough adds one note per step and ends with a conclusion

  @UC-38 @auto
  Scenario: The notes taken are every other note of the scale
    Given the first degree of C# minor
    Then the notes taken are C#, E and G#

  @UC-38 @auto
  Scenario: The steps end on the chord they build
    Given any degree
    Then the final step holds exactly that degree's chord

  @UC-38 @auto
  Scenario: Every step says what it is doing
    Given any walkthrough
    Then each step is described in words

  @UC-38 @auto
  Scenario: A five-note scale cannot be harmonised this way
    Given a pentatonic scale
    Then no walkthrough is offered rather than a wrong one

  @UC-38 @manual
  Scenario: The piano follows the walkthrough
    When I step through building a chord
    Then each note lights and sounds as it is added

Feature: Voice leading
  @UC-39 @D-044 @auto
  Scenario: Notes common to both chords are held
    Given C#m moving to A
    Then C# and E are held and the move is called very smooth

  @UC-39 @auto
  Scenario: Every departing note is paired with its nearest arrival
    Given C#m moving to A
    Then only one note moves, and it moves the shortest distance available

  @UC-39 @auto
  Scenario: Chords with nothing in common are named as a real move
    Given two chords sharing no notes
    Then the app says so rather than pretending it is smooth

  @UC-39 @auto
  Scenario: Voice leading is measured, not guessed
    Given a smooth move and an abrupt one
    Then the smooth one measures a shorter distance

  @UC-39 @auto
  Scenario: Every pair of chords in the key can be described
    Given any two chords in the key
    Then the movement between them is explained

Feature: What could come next
  @UC-40 @D-044 @auto
  Scenario: An empty loop gets somewhere to start
    Given no chords yet
    Then some are offered, each with a reason

  @UC-40 @auto
  Scenario: The chord just played is never suggested again
    Given a loop ending on any chord
    Then that chord is not offered as the next one

  @UC-40 @auto
  Scenario: A fourth up is ranked highly, because it is the strongest move
    Given a loop ending on C#m
    Then F#m is the first suggestion

  @UC-40 @auto
  Scenario: Coming home is suggested once the loop is long enough
    Given a loop of three chords away from home
    Then returning home is among the suggestions

  @UC-40 @auto
  Scenario: Every suggestion explains itself
    Given any suggestions
    Then each says why it would work

  @UC-40 @auto
  Scenario: Suggestions work for every key and both modes
    Given any key and mode
    Then at least three chords are offered

Feature: Playing the piano directly
  @D-045 @manual
  Scenario: A held key sustains
    When I press a piano key and keep holding it
    Then the note keeps sounding until I let go

  @D-045 @manual
  Scenario: The keyboard can be scrolled
    Given four octaves of keys
    Then I can drag the keyboard left and right to reach any of them

  @D-044 @manual
  Scenario: Major and minor are audibly different in the dictionary
    Given the chord dictionary
    When I play C and then C minor
    Then they sound clearly different, because the dictionary always plays close position

Feature: Reverse search
  The piano as an input device: choose notes, and the app says what they are.
  Ambiguity is the interesting part, so every reading is offered.

  @UC-42 @D-047 @auto
  Scenario: Notes played in root position name the obvious chord first
    Given C# E G# B chosen on the piano
    Then the first reading is C#m7

  @UC-42 @auto
  Scenario: An inversion is named as one, with the bass after a slash
    Given E G# B C# chosen
    Then C#m7/E is among the readings
    And E6 ranks first, because E is the lowest note

  @UC-42 @auto
  Scenario: Both readings of an ambiguous set are offered, not just one
    Given a set of notes with more than one name
    Then every reading is shown rather than one being chosen for the user

  @UC-42 @auto
  Scenario: The lowest note decides which reading ranks first
    Given any set of notes
    Then a reading whose root is the lowest note ranks above one whose root is not

  @UC-42 @auto
  Scenario: Two notes are named as an interval, not forced into a chord
    Given only two notes
    Then the interval is named and the app says a third would give it a mood

  @UC-42 @auto
  Scenario: An interval is measured upward from the lowest note played
    Given C and G
    Then it is a fifth, not the fourth it would be measured the other way

  @UC-42 @auto
  Scenario: One note or none identifies nothing
    Given fewer than two notes
    Then nothing is claimed

  @UC-42 @auto
  Scenario: Notes with no standard name return nothing rather than inventing one
    Given a chromatic cluster
    Then no chord name is offered

  @UC-42 @auto
  Scenario: Every chord in the dictionary can be found again from its notes
    Given any dictionary chord on any root
    Then playing its notes identifies it with the right root

  @UC-42 @auto
  Scenario: Octave doubling does not change the answer
    Given a chord with its root doubled an octave up
    Then it is named the same

  @UC-42 @manual
  Scenario: Choosing notes on the piano
    Given I am on the Find tab
    When I tap keys
    Then they latch as chosen rather than sounding momentarily
    And tapping a chosen key again removes it

Feature: Finding the key and scale from notes
  @UC-42 @auto
  Scenario: The keys offered all contain every note
    Given a set of notes
    Then every key offered really contains all of them

  @UC-42 @auto
  Scenario: Notes from no single key say so
    Given notes spanning a chromatic run
    Then no key is claimed

  @UC-42 @auto
  Scenario: Scales are ranked by how few notes they add
    Given a set of notes
    Then the tightest fitting scale comes first

  @UC-42 @auto
  Scenario: Every scale offered really contains the notes
    Given a set of notes
    Then no scale is offered that is missing one of them

Feature: Arpeggios
  @UC-43 @auto
  Scenario: Up plays low to high, down plays high to low
    Given a chord
    Then its arpeggio runs in the direction asked for

  @UC-43 @auto
  Scenario: Up and down comes back without repeating the turning points
    Given a three-note chord
    Then the round trip does not play the top or bottom note twice in a row

  @UC-43 @auto
  Scenario: An arpeggio contains exactly the chord's notes
    Given any chord
    Then arpeggiating it adds and removes nothing

  @UC-43 @auto
  Scenario: A single note arpeggiates to itself
    Given one note
    Then nothing breaks

  @UC-43 @manual
  Scenario: Hearing a chord as an arpeggio
    Given a selected chord
    Then I can play it together, upward, or downward, and the piano follows

Feature: The smoothest way to play the next chord
  @UC-44 @D-047 @auto
  Scenario: The chosen voicing moves less than the alternatives
    Given two chords
    Then no other arrangement of the second requires less movement

  @UC-44 @auto
  Scenario: It is still a real voicing of the right chord
    Given two chords
    Then the suggestion is one of the arrangements the second chord actually has

  @UC-44 @auto
  Scenario: It explains itself, naming the held notes where there are any
    Given two chords
    Then the reason says what stays and what travels

  @UC-44 @auto
  Scenario: Every pair of chords in the key gets an answer
    Given any two chords
    Then a voicing is chosen and its distance is measurable

Feature: The chord palette follows the chosen scale
  @D-046 @manual
  Scenario: Choosing Dorian changes the chords, not just the notes
    Given the key is C# minor
    When I select Dorian
    Then the chord palette is harmonised from Dorian, not from natural minor

  @D-046 @manual
  Scenario: Note labels never move
    Given keys with and without scale markers
    Then every note name sits at the same height, whatever else the key is showing

Feature: Chords and scales of your own
  A selection, named, that behaves like anything built in.

  @UC-45 @D-048 @auto
  Scenario: A saved chord keeps exactly the notes you chose
    Given six notes chosen on the piano
    When I save them as a chord
    Then the voicing is kept as played, not tidied into root position

  @UC-45 @auto
  Scenario: A saved chord is named for you if you don't name it
    Given a recognisable set of notes
    Then the saved chord takes the name the app would have given it

  @UC-45 @auto
  Scenario: A voicing with no standard name is still saveable
    Given notes that match no chord
    Then it saves anyway, because the app is an instrument and not a marker

  @UC-45 @auto
  Scenario: The same notes always produce the same saved chord
    Given the same notes chosen twice, in any order
    Then the saved chord is identical

  @UC-45 @auto
  Scenario: One note is not a chord
    Given a single note
    Then nothing is saved

  @UC-45 @auto
  Scenario: A scale needs between five and eight notes
    Given a selection outside that range
    Then it is not offered as a scale

  @UC-45 @auto
  Scenario: A saved scale starts on its lowest note unless told otherwise
    Given notes chosen on the piano
    Then the lowest is the tonic

  @UC-45 @auto
  Scenario: A saved scale's notes are the notes you chose
    Given any saved scale
    Then it contains exactly those pitch classes

  @UC-45 @auto
  Scenario: A seven-note scale of your own harmonises into chords
    Given a scale of your own with seven notes
    Then it produces its own seven chords

  @UC-45 @auto
  Scenario: A scale with the wrong number of notes yields no chords, rather than wrong ones
    Given a five-note scale of your own
    Then no chords are built from it

  @UC-45 @auto
  Scenario: Harmonising works from bare intervals, not only from named scales
    Given any seven intervals
    Then chords can be built from them

  @UC-45 @manual
  Scenario: Saving and using your own chord
    Given notes chosen in the Find tab
    When I save them as a chord
    Then it appears under "Yours" in the Chords tab and can be played and added to the loop

Feature: Style as a way in
  @UC-46 @D-048 @auto
  Scenario: Every style suggests scales and chord colours
    Given any style
    Then it names chord colours and says what it is going for

  @UC-46 @auto
  Scenario: Scales suited to the style come first, and none are lost
    Given a style and a mode
    Then suited scales are listed first and every other scale is still available

  @UC-46 @auto
  Scenario: Every chord colour a style names is one the app can build
    Given any style
    Then each colour it names exists in the dictionary

  @UC-46 @auto
  Scenario: Every style suits at least one scale in each mode
    Given any style
    Then it is not left pointing at nothing

  @UC-46 @manual
  Scenario: Choosing an intention rather than a scale name
    Given the Scales tab
    When I pick "soul"
    Then the scales that suit it are marked and listed first, with the chord colours to use

Feature: A wider chord-set library
  @UC-16 @auto
  Scenario: There are enough sets to browse rather than exhaust
    Then at least ten sets exist

  @UC-16 @auto
  Scenario: Both modes are well served
    Then minor and major each offer at least four sets

  @UC-16 @auto
  Scenario: Set names and ids are unique
    Then no two sets share a name or an id

Feature: The octave control
  @D-048 @manual
  Scenario: One control, not three
    Given the piano
    Then the octave is a single control with an arrow either side of the number

Feature: The piano follows whichever scale is chosen
  @D-049 @auto
  Scenario: A built-in scale lights its own notes
    Given a named scale
    Then the piano marks exactly its notes

  @D-049 @auto
  Scenario: A scale of your own lights its own notes too
    Given a scale I saved
    When I select it
    Then the piano marks its notes, exactly as it would for a built-in one

  @D-049 @auto
  Scenario: Choosing a built-in scale replaces one of your own
    Given a scale of mine is active
    When I pick a named scale
    Then the named one takes over

  @D-049 @manual
  Scenario: Tapping a voicing plays that voicing
    Given a chord and the list of arrangements
    When I tap "Open"
    Then the open arrangement is what sounds, not the one selected before it

  @D-049 @manual
  Scenario: A held note stops when I leave the tab
    Given I am holding a piano key
    When I switch tabs
    Then the note stops rather than sounding for ever

Feature: The guide
  A page explaining each part, because everything here was previously
  discoverable only by poking at it.

  @UC-49 @D-050 @auto
  Scenario: Every tab is documented
    Given the tabs the app has
    Then each one has a section in the guide

  @UC-49 @auto
  Scenario: Every section points at a tab that exists
    Given any guide section with a "take me there" link
    Then the tab it names is real

  @UC-49 @auto
  Scenario: Every section actually says something
    Given any section
    Then it has a title, a lead worth reading, and at least three points

  @UC-49 @auto
  Scenario: The parts with no tab of their own are still covered
    Then reading the piano, the sound controls and where to start are all explained

  @UC-49 @auto
  Scenario: It opens with how to begin
    Then the first section is where to start, not a feature list

  @UC-49 @auto
  Scenario: Section ids are unique
    Then no two sections share an id

  @UC-49 @manual
  Scenario: Finding the guide without being told
    Given I have just opened the app and done nothing
    Then the line under the piano offers "How to use"
    And the last tab is called "How to use"

  @UC-49 @manual
  Scenario: Reading it and acting on it
    Given I am reading a section about a tab
    When I tap "Open …"
    Then I am taken there with everything I have built intact

Feature: Explanations stay short enough to read
  The two-sentence cap was written as a rule and never checked. Two thirds of
  explanations broke it, in an app whose whole promise is a readable sentence.

  @D-051 @auto
  Scenario: Sentences are counted, including the last one
    Given any text
    Then its sentences are counted correctly

  @D-051 @auto
  Scenario: No chord explanation runs past two sentences, in any key or palette
    Given any chord in any key, under any scale
    Then its beginner explanation is at most two sentences and fits on a phone

  @D-051 @auto
  Scenario: A borrowed chord is explained just as briefly
    Given a chord from outside the key
    Then the explanation is still at most two sentences

  @D-051 @auto
  Scenario: Every explanation ends in a full stop
    Given any explanation
    Then it does not trail off

  @D-051 @auto
  Scenario: Figures are explained briefly too
    Given any bassline or riff
    Then its description is at most three sentences

Feature: Several fingers at once
  @D-052 @auto
  Scenario: A second key joins the first rather than replacing it
    Given one key held
    When I press another
    Then both are held and both are lit

  @D-052 @auto
  Scenario: Lifting one finger leaves the others down
    Given three keys held
    When I lift one
    Then the other two keep sounding

  @D-052 @auto
  Scenario: Held notes stay in order however they were pressed
    Given keys pressed out of order
    Then they are held low to high

  @D-052 @auto
  Scenario: Pressing a key that is already down changes nothing
    Given a key already held
    Then pressing it again is ignored

  @D-052 @auto
  Scenario: Lifting a key that was never down changes nothing
    Given a key that is not held
    Then lifting it is ignored

  @D-052 @auto
  Scenario: Eight fingers is the limit, and a ninth is refused rather than stealing
    Given eight keys already held
    When a ninth is pressed
    Then it is refused and the eight keep sounding

  @D-052 @auto
  Scenario: Releasing after the limit makes room again
    Given the limit has been reached
    When I lift a finger
    Then the next key can be held

  @D-052 @auto
  Scenario: A whole chord can be held at once
    Given a five-note chord
    Then every note of it can be held together

  @D-052 @manual
  Scenario: Playing a chord with several fingers
    When I press three keys at once
    Then all three sound together and all three light up
    And lifting one leaves the other two sounding and lit

  @D-052 @manual
  Scenario: Scrolling without interrupting a note
    Given the keyboard is wider than the screen
    Then I drag the strip above the keys to move it
    And touching a key never scrolls the keyboard instead of playing

Feature: Rolling a finger across the keys
  A glissando. A touch belongs to the key it started on, so keys slid onto
  never hear about it; the keyboard has to track the finger instead.

  @D-053 @auto
  Scenario: A finger arriving on a key sounds it
    Given a finger pressing the keyboard
    Then the key under it sounds

  @D-053 @auto
  Scenario: Rolling onto the next key stops the one behind it
    Given a finger on one key
    When it rolls onto the next
    Then the new key sounds and the old one stops

  @D-053 @auto
  Scenario: Staying on the same key does nothing
    Given a finger that has not left its key
    Then nothing is retriggered

  @D-053 @auto
  Scenario: A note another finger is still holding is not cut off
    Given two fingers on the same key
    When one rolls away
    Then the note keeps sounding

  @D-053 @auto
  Scenario: A second finger landing on a sounding key does not retrigger it
    Given a key already sounding
    When another finger lands on it
    Then it is not struck again

  @D-053 @auto
  Scenario: Lifting releases only what that finger held
    Given two fingers on different keys
    When one lifts
    Then only its own note stops

  @D-053 @auto
  Scenario: Sliding off the keyboard releases the note
    Given a finger leaving the keys
    Then its note stops

  @D-053 @auto
  Scenario: A run up the keyboard sounds every key once, in order
    Given a finger dragged up five keys
    Then each sounds once, in order, and only the last is still down

  @D-053 @auto
  Scenario: Two fingers rolling at once stay independent
    Given two fingers each rolling to a new key
    Then each ends on its own note

  @D-053 @manual
  Scenario: Playing a glissando
    When I press a key and drag left and right across the keyboard
    Then each key sounds as I reach it and stops as I leave
    And the lighting follows my finger

Feature: Finding the key under a finger
  Geometry, not the DOM. Asking the document what is under the finger depended
  on capture, hit-testing and retargeting all behaving; the keyboard knows its
  own layout, so the question is arithmetic.

  @D-055 @auto
  Scenario: The middle of the first white key is that key
    Given a point in the middle of a white key
    Then that key is found

  @D-055 @auto
  Scenario: Black keys win in the upper part of the keyboard
    Given a point near the top where a black key sits
    Then the black key is found

  @D-055 @auto
  Scenario: Below the black keys, the white key underneath wins
    Given the same horizontal position lower down
    Then the white key is found, so the lower half is never unplayable

  @D-055 @auto
  Scenario: Every white key is reachable at its own centre
    Given four octaves
    Then no white key is unreachable

  @D-055 @auto
  Scenario: Every black key is reachable at its own centre
    Given four octaves
    Then no black key is unreachable

  @D-055 @auto
  Scenario: A point outside the keyboard belongs to no key
    Given a point past any edge
    Then no key is found, so the note is released

  @D-055 @auto
  Scenario: Dragging across the keyboard visits keys in order
    Given a drag from one side to the other
    Then every white key is crossed exactly once, ascending

  @D-055 @auto
  Scenario: The layout follows the octave shift
    Given the keyboard shifted an octave
    Then the same point resolves to the shifted key

  @D-055 @auto
  Scenario: A narrow phone-width keyboard still resolves every white key
    Given two octaves at 380 pixels
    Then all fifteen white keys can be hit

  @D-055 @manual
  Scenario: The glissando actually sounds
    When I press a key and drag across the keyboard
    Then every key sounds and lights as my finger reaches it

Feature: Which notes work over this chord
  The scale says what is available; the chord playing says what is strong.

  @UC-50 @D-056 @auto
  Scenario: Chord tones land, scale notes move, the rest pull
    Given a chord and a scale
    Then each note is one of: lands well, moves through, or pulls

  @UC-50 @auto
  Scenario: Every note of the octave gets exactly one answer
    Given any chord
    Then all twelve notes are classified, none twice

  @UC-50 @auto
  Scenario: The chord's own notes are always the stable ones
    Given any chord in the key
    Then its own notes are the ones that land well

  @UC-50 @auto
  Scenario: With no chord selected, the scale still divides the octave
    Given no chord
    Then scale notes move and the rest pull

  @UC-50 @auto
  Scenario: Every role explains what to do with it
    Given the three roles
    Then each says what it is for

  @UC-50 @manual
  Scenario: Using the melody guide
    Given a chord is playing and I turn on the melody guide
    Then the dots tell me which notes land, which move and which pull

Feature: What changed
  Animating the difference, not just the result.

  @UC-51 @D-056 @auto
  Scenario: A one-note difference is named as one
    Given natural minor becoming Dorian
    Then the explanation says A became A#

  @UC-51 @auto
  Scenario: A bigger change lists both directions and what stayed
    Given a change of several notes
    Then what came in, what went out and how much stayed are all said

  @UC-51 @auto
  Scenario: No change says so rather than inventing a difference
    Given the same scale twice
    Then nothing is claimed to have changed

  @UC-51 @auto
  Scenario: Octaves are ignored: it is about which notes, not where
    Given the same notes an octave apart
    Then nothing changed

  @UC-51 @auto
  Scenario: It is described in the chosen naming system
    Given Do-Re-Mi naming
    Then the change is described in it

  @UC-51 @manual
  Scenario: Seeing what changed
    When I switch from one scale to another
    Then only the notes that came in or went out are ringed, briefly

Feature: How adventurous?
  One slider from safe to adventurous, so advanced harmony needs no vocabulary.

  @UC-52 @D-056 @auto
  Scenario: Safe gives the plain chords of the key and nothing else
    Given the slider at its lowest
    Then only the seven triads of the key are offered

  @UC-52 @auto
  Scenario: Colour keeps the same seven chords, richer
    Given the slider one step up
    Then the same seven chords appear as sevenths

  @UC-52 @auto
  Scenario: Each step up adds chords and never removes any
    Given any key and mode
    Then raising the slider only widens the choice

  @UC-52 @auto
  Scenario: Every borrowed chord explains why it is worth trying
    Given the slider high enough to borrow
    Then each borrowed chord says what it does

  @UC-52 @auto
  Scenario: Borrowed chords really do leave the key
    Given any borrowed chord
    Then it contains at least one note from outside the key

  @UC-52 @auto
  Scenario: Every level is named and described
    Then all four levels say what they mean

  @UC-52 @auto
  Scenario: Both modes have borrowed chords to offer
    Then minor and major each have at least three

  @UC-52 @auto
  Scenario: Borrowed chords are playable, like anything else
    Given any borrowed chord
    Then it is a real voicing with its root lowest

  @UC-52 @manual
  Scenario: Turning the slider up
    Given a loop built from safe chords
    When I raise the slider
    Then chords from outside the key appear, marked, each with a reason

  @UC-52 @auto
  Scenario: Adventurous actually offers chords from outside the key
    Given the slider at its highest, in any key
    Then several borrowed chords are offered, widening the choice rather than relabelling it

Feature: A sheet to take to an instrument
  Nothing on paper can be tapped, so the sheet carries voicings as diagrams
  rather than chord names. Prototype: no explanations yet.

  @UC-53 @D-057 @auto
  Scenario: The sheet carries one chord per bar, in order
    Given a loop
    Then the sheet lists each bar with its chord

  @UC-53 @auto
  Scenario: Each chord carries its actual voicing, not just its name
    Given a loop
    Then the notes printed are the notes that would sound

  @UC-53 @auto
  Scenario: Every chord fits inside the drawn range
    Given any loop
    Then no note falls off the edge of its diagram

  @UC-53 @auto
  Scenario: The range snaps to whole octaves so the diagrams line up
    Given any loop
    Then every diagram starts on a C

  @UC-53 @auto
  Scenario: A wide voicing widens the range rather than being cut off
    Given a chord spanning several octaves
    Then the diagram grows to hold it

  @UC-53 @auto
  Scenario: The bass line is on the sheet, one entry per bar
    Given a loop
    Then the bass note for each bar is printed

  @UC-53 @auto
  Scenario: A generated bassline is used where there is one
    Given a bassline has been generated
    Then the sheet prints that, not the plain root

  @UC-53 @auto
  Scenario: The scale is written out once, from the tonic
    Given a sheet
    Then the scale appears as notes and as a diagram

  @UC-53 @auto
  Scenario: A scale of your own goes on the sheet under its own name
    Given a saved scale is active
    Then the sheet names it and prints its notes

  @UC-53 @auto
  Scenario: The heading says what a player needs before starting
    Given a sheet
    Then the key and the tempo are at the top

  @UC-53 @auto
  Scenario: An empty loop produces an empty sheet rather than failing
    Given no chords
    Then the sheet still prints the scale

  @UC-53 @auto
  Scenario: It follows the chosen naming system
    Given Do-Re-Mi naming
    Then the sheet is written in it

  @UC-53 @auto
  Scenario: The text version holds everything the picture does
    Given a sheet
    Then copying it as text loses nothing but the diagrams

  @UC-53 @manual
  Scenario: Printing the sheet
    Given a loop
    When I open the Sheet tab and press Print
    Then only the sheet is printed, and it fits a page

  @UC-53 @manual
  Scenario: Reading it away from the app
    Given a printed sheet and an instrument
    Then I can play the loop from it without needing the app

Feature: Chord diagrams
  @UC-53 @D-057 @auto
  Scenario: Every key is drawn exactly once, in order
    Given a diagram of two octaves
    Then fifteen white keys and ten black ones are drawn, left to right

  @UC-53 @auto
  Scenario: The keys of the chord are the lit ones, and no others
    Given a chord
    Then exactly its notes are filled in

  @UC-53 @auto
  Scenario: A black key straddles the boundary between its two white keys
    Given a diagram
    Then every black key is centred on the join between its two white keys

  @UC-53 @auto
  Scenario: The layout spans the full width
    Given any number of octaves
    Then the keyboard fills the space given to it

  @UC-53 @auto
  Scenario: Nothing lit means nothing lit
    Given no notes
    Then no key is filled

Feature: Levels
  Feedback on first use was that there is too much on screen. The old
  Beginner/Producer toggle changed how things were described and never what was
  shown, which is the wrong axis.

  @UC-54 @D-058 @auto
  Scenario: The main scenario is completable at the simplest level
    Given the Start level
    Then everything the main scenario needs is present

  @UC-54 @auto
  Scenario: Start is genuinely small
    Given the Start level
    Then there are at most five tabs, and they include chords, scales, the loop and the lessons

  @UC-54 @auto
  Scenario: Levels only ever add, so nothing a user found disappears
    Given any two adjacent levels
    Then the higher contains everything the lower had, and more

  @UC-54 @auto
  Scenario: Tabs keep their order, so one never moves when another appears
    Given any level
    Then the tabs appear in the same order as at every other level

  @UC-54 @auto
  Scenario: Every tab is reachable at some level
    Given the highest level
    Then no tab is stranded

  @UC-54 @auto
  Scenario: The guide is available from the very beginning
    Given the Start level
    Then "How to use" is there, because that is who needs it

  @UC-54 @auto
  Scenario: Every level says what it is for
    Given any level
    Then it is named and described

  @UC-54 @auto
  Scenario: An unknown level falls back to the simplest rather than showing nothing
    Given a level that does not exist
    Then the app shows the Start level

  @UC-54 @auto
  Scenario: Theory and the sheet are not in a beginner's way
    Given the Start level
    Then the theory tab, the sheet, the voicing list and the adventurousness slider are all absent

  @UC-54 @auto
  Scenario: Producing does not require studying
    Given the Produce level
    Then the working tools are present but the dictionary is not

  @UC-54 @auto
  Scenario: Every feature named by a level maps to something real
    Given any level
    Then nothing it claims to add is invented

  @UC-54 @manual
  Scenario: Opening the app for the first time
    Given I have never used it
    Then I see a key, a piano, three tabs and a line telling me what the next level would add

  @UC-54 @manual
  Scenario: Moving up a level keeps my work
    Given a loop I have built at Start
    When I switch to Produce
    Then my key, scale and loop are all still there, with more tools around them

Feature: Extended chords and their spacing
  An eleventh stacked in thirds is mud. The name is half the chord; the spacing
  is the other half.

  @UC-55 @D-059 @auto
  Scenario: The dictionary reaches elevenths and thirteenths
    Then m11, maj13, 13, m13, 6/9, add9, maj7♯11, 7♭9, 7♯9 and sus4(9) are all available

  @UC-55 @auto
  Scenario: An extended chord offers the spacing it is usually played with
    Given a minor eleventh
    Then its signature voicing is stacked in fourths, not thirds

  @UC-55 @auto
  Scenario: A signature voicing holds the notes that name the chord
    Given any chord with a signature voicing
    Then it keeps its root and the extension it is named for
    But it may drop an inner extension, as players do

  @UC-55 @auto
  Scenario: Signature voicings stay inside a piano and ascend
    Given any extended chord on any root
    Then its signature voicing is playable

  @UC-55 @auto
  Scenario: Plain chords have no signature voicing, because they need none
    Given a triad
    Then no signature arrangement is offered

  @UC-55 @auto
  Scenario: Every extended chord can still be identified from its notes
    Given any extended chord played on the piano
    Then reverse search names it

  @UC-55 @auto
  Scenario: The wide chord sets are built from the extended qualities
    Given the Storybook and Wandering minor sets
    Then most of their chords are extended ones

  @UC-55 @manual
  Scenario: Hearing the difference spacing makes
    Given a minor eleventh
    When I play Close and then Signature
    Then the second sounds wide and settled where the first sounds like a stack

Feature: Chords follow the keyboard
  Shifting the octave moved the picture and left the sound where it was.

  @D-060 @auto
  Scenario: A chord is built in the octave being shown
    Given the keyboard shifted to any octave
    Then a chord built there sounds there

  @D-060 @auto
  Scenario: Every chord source follows the octave
    Given the palette, the dictionary, a chord set and the tension slider
    Then all of them build in the octave on screen

  @D-060 @auto
  Scenario: The default octave is unchanged when none is given
    Given no octave
    Then chords are built where they always were

  @D-060 @auto
  Scenario: A signature voicing is built around the chord it belongs to
    Given an extended chord in any octave
    Then its signature voicing sits with it, not an octave away

  @D-060 @manual
  Scenario: Sensible defaults on opening
    Given I open the app for the first time
    Then it is in C major, and major is offered before minor

Feature: Rooms
  Echo alone was why everything sounded dry and small.

  @D-061 @auto
  Scenario: Dry is actually dry
    Given the dry setting
    Then there is no reverb at all

  @D-061 @auto
  Scenario: Each room is bigger than the last
    Given the rooms in order
    Then each has a longer decay and at least as much level

  @D-061 @auto
  Scenario: No room drowns the dry signal
    Given any room
    Then the notes are still the loudest thing

  @D-061 @auto
  Scenario: An unknown room falls back to dry rather than to noise
    Given a room that does not exist
    Then nothing is added

  @D-061 @auto
  Scenario: Every room says what it is for
    Given any room
    Then it is named and described

  @D-061 @manual
  Scenario: Choosing a space
    Given a chord
    When I switch between Dry, Room, Hall and Cave
    Then the difference is obvious and nothing gets muddy

Feature: Real recorded sound
  Synthesis is why it sounded like a toy.

  @D-062 @auto
  Scenario: A recorded instrument declares a release too
    Given a sampled instrument
    Then the voice budget knows how long its notes last
    And it has enough samples to cover the keyboard

  @D-062 @manual
  Scenario: The grand piano sounds like a piano
    Given the app has just opened
    When the samples finish downloading and I play a chord
    Then it sounds recorded, not synthesised

  @D-062 @manual
  Scenario: A slow download does not break anything
    Given the samples are still downloading
    Then the app says so, and nothing sounds wrong in the meantime

  @D-062 @manual
  Scenario: The Rhodes stops sounding like a marimba
    Given the Rhodes
    Then the bell is only in the attack and the note has a long tail

Feature: A recorded instrument never leaves you in silence
  Reported: the grand piano made no sound while the other instruments did.

  @D-064 @auto
  Scenario: Every sampled instrument names a stand-in to use while it loads
    Given a recorded instrument
    Then it names a synth to play through until the samples arrive

  @D-064 @auto
  Scenario: The stand-in is a reasonable substitute, not just anything
    Given a recorded instrument and its stand-in
    Then they decay at a similar rate

  @D-064 @auto
  Scenario: Instrument lookup never returns nothing
    Given any instrument name, or none
    Then something playable comes back

  @D-064 @manual
  Scenario: Playing before the samples arrive
    Given the grand piano is selected and still downloading
    When I play a chord
    Then it sounds through the stand-in, and the status says what is happening

  @D-064 @manual
  Scenario: Samples that never arrive
    Given a network that blocks the download
    Then within a few seconds the app says so and keeps playing the stand-in

Feature: Voicings are derived from the chord, not from the last choice
  Reported: the big extended chords all sounded similar.

  @D-065 @auto
  Scenario: Close stays close, whatever was picked before
    Given a thirteenth chord
    When I try every arrangement in turn
    Then close position is still close position

  @D-065 @auto
  Scenario: Every arrangement of a big chord is audibly different from the others
    Given any extended chord
    Then no two arrangements contain the same notes

  @D-065 @auto
  Scenario: A big chord opens by dropping two notes, not one
    Given a six-note chord
    Then its open voicing is wider and its notes further apart

  @D-065 @auto
  Scenario: Arrangements still contain the chord, however it was reached
    Given any arrangement
    Then it introduces no note the chord does not have

Feature: A reused pool of voices
  Reported: after a while the audio scrambles and slows down. Building a synth
  per note meant hundreds of audio nodes created and destroyed a minute.

  @D-066 @auto
  Scenario: A free voice is used before a busy one is stolen
    Given some voices are still sounding
    Then a free one is chosen

  @D-066 @auto
  Scenario: With everything busy, the one finishing soonest is taken
    Given every voice is sounding
    Then the one closest to finishing is reused

  @D-066 @auto
  Scenario: The first free voice is used, so allocation is predictable
    Given several voices are free
    Then they are taken in order, so the same chord allocates the same way twice

  @D-066 @auto
  Scenario: A voice free exactly now counts as free
    Given a voice whose note has just ended
    Then it is available

  @D-066 @auto
  Scenario: It always returns a usable index
    Given any pool
    Then the choice is within it

  @D-066 @auto
  Scenario: A whole chord fits the pool without stealing from itself
    Given a six-note chord
    Then each note gets its own voice

  @D-066 @manual
  Scenario: A long session stays responsive
    When I play for several minutes
    Then the sound does not slow down, thicken or lag behind my fingers

  @D-066 @manual
  Scenario: Reset audio really resets
    Given the sound has gone wrong
    When I press reset audio
    Then the voices are rebuilt from scratch and playing feels normal again

Feature: Recorded sound is optional, not assumed
  @D-067 @manual
  Scenario: The default instrument always works
    Given a network that blocks the sample host
    Then the app still opens with a working instrument
    And the grand piano is offered but not assumed

Feature: Rolling a chord
  Six notes struck together are one sound. Spread them slightly and every note
  is audible, while the chord still arrives as a chord.

  @UC-57 @D-068 @auto
  Scenario: Together means together
    Given the together setting
    Then every note starts at the same moment

  @UC-57 @auto
  Scenario: A roll lays the notes down in order, lowest first
    Given a roll
    Then the first note lands on the beat and the rest follow in order

  @UC-57 @auto
  Scenario: The gaps are even
    Given a roll
    Then the notes are evenly spaced, not bunched

  @UC-57 @auto
  Scenario: A slow roll is slower than a quick one
    Given both roll settings
    Then the slow one takes longer to complete

  @UC-57 @auto
  Scenario: The roll never outlasts the note it belongs to
    Given a short note and a slow roll
    Then the last note still arrives while the chord is sounding

  @UC-57 @auto
  Scenario: One note cannot be rolled
    Given a single note, or none
    Then nothing is spread

  @UC-57 @auto
  Scenario: Every roll style is named and described
    Given the roll settings
    Then each is described, and an unknown one plays the chord normally

  @UC-57 @manual
  Scenario: Hearing the notes of a big chord
    Given a six-note chord that sounds like a wash
    When I switch to slow roll and play it again
    Then I can hear each note arrive

Feature: The piano travels with the app
  Fetching recordings from another site is silence wherever that site is not
  allowed. These are embedded instead.

  @D-069 @auto
  Scenario: Nothing is fetched from another site
    Given the grand piano
    Then every sample is embedded in the app, not a link to somewhere else

  @D-069 @auto
  Scenario: The samples are evenly spaced
    Given the embedded set
    Then no two neighbouring recordings are more than six semitones apart

  @D-069 @auto
  Scenario: Each sample is small enough to ship
    Given any embedded sample
    Then it is small enough to carry and large enough to be a note

  @D-069 @auto
  Scenario: The whole set stays within a sensible budget
    Given all the samples together
    Then they do not dominate the size of the app

  @D-069 @auto
  Scenario: The recordings are credited
    Given embedded recordings made by someone else
    Then the app carries their credit and licence

  @D-069 @auto
  Scenario: It still names a stand-in, in case decoding fails
    Given the samples are embedded
    Then a synth is still named, because decoding can fail where downloading cannot

  @D-069 @manual
  Scenario: A real piano with no network
    Given the app has just opened
    When I play a chord
    Then it sounds like a recorded piano immediately, with nothing downloaded

Feature: The embedded recordings are usable audio
  Embedding the samples was not enough: the app still reported that the piano
  had not arrived, because handing a data URI to the audio library still goes
  through fetch, and a restrictive page policy blocks that too.

  @D-070 @auto
  Scenario: A data URI yields its payload
    Given an embedded sample
    Then its base64 payload can be separated from its header

  @D-070 @auto
  Scenario: Every sample decodes to a plausible amount of audio
    Given any embedded sample
    Then it holds enough bytes to be a note and few enough to ship

  @D-070 @auto
  Scenario: The payload is valid base64
    Given any embedded sample
    Then it can be decoded without error

  @D-070 @auto
  Scenario: Every sample begins with an MPEG frame
    Given any embedded sample
    Then it starts like an mp3, so a truncated embed cannot masquerade as a network failure

  @D-070 @auto
  Scenario: No two samples are the same recording
    Given the embedded set
    Then each note is its own recording

  @D-071 @auto
  Scenario: Samples differ in their audio, not just their header
    Given the embedded set
    Then no two of them share the tail of their recording
    And a matching header alone does not make two notes the same

  @D-071 @auto
  Scenario: Sample names are read as the notes they claim to be
    Given a sample named "C4"
    Then it is understood as midi 60
    And a name with no octave is not a pitch at all

  @D-071 @auto
  Scenario: Every note the keyboard can reach is near a recording
    Given the embedded set
    When I walk every note the keyboard can play, from C1 to C7
    Then none of them is more than three semitones from a real recording

  @D-071 @auto
  Scenario: A set that does not span the range fails
    Given the seven recordings that used to ship, C2 to C5
    Then the worst stretch is twenty-four semitones
    And the check that measures it would have caught them

  @D-071 @auto
  Scenario: The keyboard cannot be scrolled past the recordings
    Given the octave control
    Then its highest position still leaves a full keyboard inside the recorded range
    And that limit is derived from the samples rather than written down separately

  @D-071 @manual
  Scenario: The top of the keyboard sounds like a piano
    Given the grand piano is selected
    When I scroll to the top of the keyboard and play a chord at C6
    Then it sounds recorded rather than thin and sped up

  @D-071 @manual
  Scenario: The octave control stops where the recordings stop
    Given the keyboard is at its highest octave
    Then the up arrow is visibly disabled rather than doing nothing

  @D-070 @manual
  Scenario: The piano arrives without any request
    Given the app has just opened
    Then the status line moves from "preparing" to "Grand piano"
    And a chord sounds recorded, with nothing fetched from anywhere


Feature: Practising lessons on the piano
  Short lessons on notes, scales and chords. Each step asks for something to be
  played, and every note played is answered. (D-072, D-073, UC-58, UC-61)

  @UC-58 @auto
  Scenario: Every lesson builds in all twelve keys
    Given any lesson and any key
    Then it has an intro and at least two steps
    And every step has a prompt, a reason, a target and notes to demonstrate it

  @D-073 @auto
  Scenario: A lesson's demonstration is itself a correct answer
    Given any step of any lesson in any key
    When the notes "Show me" plays are played back into the step
    Then the step is complete, and no note along the way was called wrong

  @UC-58 @auto
  Scenario: A chord can be played one note at a time, in any order, in any octave
    Given a step asking for C E G
    When I play G, then C an octave down, then E
    Then the step is complete

  @D-073 @auto
  Scenario: A wrong note in a chord is named and not counted
    Given a step asking for C E G, and I have played C
    When I play F
    Then F is called wrong, E and G are named as still to find
    And the C I already played still counts

  @UC-58 @auto
  Scenario: A scale must be played in order
    Given a step asking for C D E going up
    When I play C and then E
    Then E is called wrong and D is named as the note wanted

  @D-073 @auto
  Scenario: A scale going up must go up, and one going down must go down
    Given a step asking for the scale going up, and I have played C4
    When I play the D below it
    Then it is the right note played the wrong way
    And the same holds in reverse for a scale going down

  @D-073 @auto
  Scenario: An inversion needs the right note at the bottom
    Given a step asking for C major with E at the bottom
    When I play C4 E4 G4
    Then all the notes are there but I am told E belongs at the bottom
    When I add E3
    Then the step is complete

  @D-073 @auto
  Scenario: Lesson text and feedback stay short enough to read
    Given every lesson in every key, in letters and in Do-Re-Mi
    Then every intro, prompt, reason and piece of feedback is at most two sentences

  @D-073 @auto
  Scenario: Feedback speaks the chosen note names
    Given the naming system is Do-Re-Mi
    When I play a wrong note in a lesson
    Then the feedback names it in Do-Re-Mi

  @UC-61 @auto
  Scenario: Lessons follow the key you chose
    Given the key is D
    Then the major scale lesson starts on D and contains F#
    And in F it contains A#

  @D-073 @auto
  Scenario: The next key is one step round the circle of fifths
    Given a lesson finished in C
    Then the next key offered is G, and after G it is D
    And twelve steps visit every key once and come back to C

  @D-073 @auto
  Scenario: A hint lights the note you need next
    Given a scale step where I have played C
    Then the hint is D
    And in a chord step the hint is the first note still missing

  @UC-59 @auto
  Scenario: The four-chord loop is I, V, vi and IV in every key
    Given the four-chord lesson in any key
    Then its loop is chords I, V, vi and IV of that key, with vi minor

  @D-073 @auto
  Scenario: Lessons come in order, simplest first
    Given the lesson list
    Then it starts with the home note, every lesson has at least two steps
    And every lesson belongs to a known topic and has a unique id

  @D-072 @auto
  Scenario: Practice is available from the very first screen
    Given the Start level
    Then the Learn tab is there

  @D-073 @auto
  Scenario: The reason for a step arrives only once it is played
    Given any step
    Then feedback for a right note, a wrong note or a wrong direction never gives the step's reason
    And feedback for the finished step does

  @D-073 @manual
  Scenario: The piano shows only the lesson
    Given a lesson is open
    Then scale dots and loop colours are hidden and only the home dot shows
    And the notes I have got right are marked as I play them

  @D-073 @manual
  Scenario: Show me plays and lights the step
    Given a chord step
    When I press "Show me"
    Then the chord sounds and its notes light on the piano

  @UC-59 @manual
  Scenario: A lesson's progression goes to the loop in one tap
    Given I have finished the four-chord lesson
    When I press "Put C G Am F in my loop"
    Then the Progression tab opens with those four chords ready to play

  @D-073 @manual
  Scenario: Changing key restarts the open lesson
    Given I am halfway through a lesson in C
    When I choose G at the top
    Then the lesson starts again from step 1 in G

  @UC-61 @manual
  Scenario: Practising a lesson on a phone
    Given a phone in one hand
    When I work through "Your first chord" and "The major scale"
    Then it feels like playing with someone beside me, not like being tested


Feature: Notes are spelled the way the key writes them
  One spelling per key, chosen by scale degree, so a lesson about C minor
  teaches E♭ and not D#. Through the naming layer, in letters and Do-Re-Mi.
  (D-019, D-074)

  @D-074 @auto
  Scenario: Keys on the flat side spell their notes with flats
    Given the key of C minor
    Then its scale reads C D E♭ F G A♭ B♭
    And F major reads F G A B♭ C D E, and in Do-Re-Mi C minor has Mi♭

  @D-074 @auto
  Scenario: Keys on the sharp side keep their sharps
    Given the key of E major
    Then its scale reads E F# G# A B C# D#
    And A minor's leading note is G#, not A♭

  @D-074 @auto
  Scenario: Borrowed and altered notes are spelled by their scale degree
    Given the key of G major, which is a sharp key
    When a chord borrows G minor's third
    Then that note reads B♭, because it is the third of G

  @D-074 @auto
  Scenario: Every spelling names the right pitch, and no white key takes an accidental
    Given every note in every key
    Then its name is the pitch it stands for
    And nothing is written F♭, C♭, E# or B#

  @D-074 @auto
  Scenario: Each key uses every letter once in its scale
    Given any key
    Then its seven notes use seven different letters
    Except F# major and D# minor, which would need E# and show F instead

  @D-074 @auto
  Scenario: Every key is labelled the way it is written
    Given the key buttons at the top
    Then the key on the black key between D and E reads E♭ in major and D# in minor

  @D-074 @auto
  Scenario: Lessons in flat keys use flats
    Given the minor scale lesson in C
    Then it asks for C D E♭ F G A♭ B♭ C
    And a wrong note is answered by the half step from D that lands on E♭

  @D-074 @auto
  Scenario: Every note name in an explanation follows the naming system
    Given the naming system is Do-Re-Mi in C minor
    Then "Build it", voice leading, Find and the smoothest-voicing note all speak it

  @D-019 @auto
  Scenario: The plain naming systems still spell with sharps
    Given no key has been applied to the naming
    Then D# is still D#

  @D-074 @auto
  Scenario: A suspended second is in the chord table
    Given the notes C D G
    Then they are named Csus2, a suspended 2nd

  @D-074 @auto
  Scenario: No chord formula is listed twice
    Given the table of chord formulas
    Then every formula appears once, because a repeated one silently replaces the first

  @D-074 @manual
  Scenario: The whole app reads in flats in a flat key
    Given I choose E♭ major, then C minor
    Then the key buttons, the piano labels, the chord names and the explanations all use flats
    And in G major everything uses sharps

Feature: Feedback teaches a way of finding the note
  A wrong note is a chance to learn how to find the right one. The app says why
  it was wrong in terms you can reuse: count keys from the root, take every other
  note, look for the landmark. The hint gives the method before the note, and
  every step ends on a rule that works in any key. (D-075)

  @D-075 @auto
  Scenario: A wrong interval is explained by counting keys from the root
    Given the lesson "Your first chord" in C, with C played
    When I play E♭ instead of E
    Then it says "E♭ is 3 keys above C; the major third is 4 keys up, at E."

  @D-075 @auto
  Scenario: A scale note a chord skips is explained by the skip
    Given the lesson "Your first chord" in C, with C played
    When I play F
    Then it says F is in the scale, but a chord takes every other note: C, skip D, E, skip F, G

  @D-075 @auto
  Scenario: A skipped scale note is named, with the step to it
    Given the lesson "The major scale" in C, with C played
    When I play E
    Then it says "You skipped D: from C the next note is a whole step up (skip one key)."

  @D-075 @auto
  Scenario: A near miss in a scale names the size of the step
    Given the major scale in C, played up to E
    When I play F# instead of F
    Then it says from E it's a half step up, the very next key, which lands on F

  @D-075 @auto
  Scenario: The first hint gives the method, not the note
    Given any step of any lesson in any key, with one note played
    When I ask for a hint the first time
    Then it says how to find the next note, by counting keys or stepping, without naming it
    And asking again lights the note

  @D-075 @auto
  Scenario: A landmark finds any note on the keyboard
    Given the twelve notes
    Then each has its own landmark among the black keys, such as C "just left of the pair of black keys"

  @D-075 @auto
  Scenario: Every step leaves a rule that works in any key
    Given every step of every lesson, in every key and both naming systems
    Then it has a take-away rule of at most two sentences
    And a hint of at most two sentences

  @D-075 @auto
  Scenario: Rules that count keys match the chord
    Given a rule that says a chord is "4 + 3" keys, or that V is 7 keys above I
    Then the notes of that chord, in every key, have exactly those gaps

  @D-075 @auto
  Scenario: Chord shapes are named by their white and black keys
    Given a finished major or minor triad
    Then it names its shape, like "white, black, white", and the other chords that share it
    And a shape no other chord shares is said to be its own

  @D-075 @manual
  Scenario: The hint ladder on the phone
    Given a lesson step I'm stuck on
    When I press Hint
    Then I see how to find the note, and the button now says "Show the note"
    When I press it
    Then the note lights, and a right note resets the ladder for the next one

  @D-075 @manual
  Scenario: Feedback teaches a way of finding the note, not just the answer
    Given I play ten lessons with deliberate mistakes
    Then after each finished step I can say the take-away rule back without looking
    And the next time I make the same mistake I can correct it without a hint

Feature: Sketchpad installs as an app and works offline
  The same single-file app, packaged as a small website that installs to the
  home screen of an iPhone or iPad, opens full screen, works with no network,
  and replaces itself when a new version is uploaded. Anyone with the link can
  install it. (D-076, UC-31)

  @D-076 @auto
  Scenario: The site installs as an app with its own name and icon
    Given the packaged site
    Then its manifest names it Sketchpad, opens full screen at its own folder
    And every icon it names is shipped, square, at the size it claims

  @D-076 @auto
  Scenario: The page asks to be kept offline and looks like an app on iOS
    Given the packaged page
    Then its head carries the manifest, the iOS home-screen icon, title and full-screen tags
    And it registers the offline service worker without ever breaking the app if refused

  @D-076 @auto
  Scenario: Every file the site ships is kept for offline use
    When the service worker installs
    Then it caches the page, the manifest and every icon, fetched past the HTTP cache

  @D-076 @auto
  Scenario: It works offline once installed
    Given the app was opened once with a network
    When the network is gone
    Then the home-screen icon still opens the app, and its icons still load

  @D-076 @auto
  Scenario: A new version of the app replaces the old one on the next open
    Given a new version of the page is uploaded
    Then the site gets a new version, and an unchanged upload keeps the old one
    And after the next open, the new page is what opens offline

  @D-076 @auto
  Scenario: Old versions are cleared out, and nothing else is touched
    When a new version takes over
    Then the old version's cache is deleted, and caches that are not Sketchpad's are left alone

  @UC-31 @manual
  Scenario: Installed on an iPhone and iPad, it opens offline
    Given I open the site in Safari and choose Share, then Add to Home Screen
    Then a Sketchpad icon appears, and it opens full screen without Safari's bars
    When I turn on flight mode and open it again
    Then it opens and plays

  @D-076 @manual
  Scenario: Sound plays with the iPhone on silent
    Given the iPhone's silent switch is on
    When I tap test sound in the installed app
    Then I hear the piano, as in GarageBand

  @D-076 @manual
  Scenario: The site builds and publishes from the repository
    Given a fresh clone of the repository and Node 22
    When I run npm install and npm run site
    Then dist/ holds the installable site, and pushing to main runs the tests and publishes it to GitHub Pages

  @UC-31 @manual
  Scenario: Someone else installs it from the link
    Given I send the site's link to someone with no Claude account
    Then they can open it and add it to their home screen the same way
    And their saved work, when saving exists, stays on their own device

Feature: Typing chord names
  "Bm7 F#m7 Fmaj7" is how chord charts are written, and quicker than tapping
  every note. A name is read only if the dictionary can voice it; anything
  else is refused with a reason, never guessed. (D-077, UC-62)

  @D-077 @auto
  Scenario: A chord name is read into its notes
    When I type Bm7, F#m7, Fmaj7, G7sus4 and D7sus4(9)
    Then they read as B D F# A, F# A C# E, F A C E, G C D F and D G A C E
    And a ninth sits above the seventh, not beside the root

  @D-077 @auto
  Scenario: Typed chords sound like the same chord picked from a list
    Given every chord in the dictionary on every root
    When I type its name
    Then I get exactly the notes the dictionary plays for it

  @D-077 @auto
  Scenario: Common ways of writing a chord are understood
    Then CM7, CΔ7 and C7M all read as Cmaj7, C-7 and Cmin7 as Cm7, Cø as Cm7♭5
    And D7(4/9) as D9sus4, while a capital M means major and a small m minor

  @D-077 @auto
  Scenario: Flats and sharps in chord names
    Then Bb, B♭, A#, bb and A♯ all start on the same key, in any letter case
    And the name is written the way the current key spells it

  @D-077 @auto
  Scenario: A slash chord puts its bass note at the bottom
    When I type C/E
    Then E is the lowest note, just under the chord, and the chord is still C major
    And C6/9 is read as a chord type, not as a slash chord

  @D-077 @auto
  Scenario: A line of chords is read in order, ignoring bar lines
    When I type "Am7 | F#m7 - Dm7, G7sus4"
    Then I get Am7, F#m7, Dm7 and G7sus4 in that order

  @D-077 @auto
  Scenario: An unknown chord is refused with a reason and a suggestion
    When I type Cmaj8
    Then it says "maj8" isn't a chord type it knows, and asks if I meant Cmaj7
    And the chords around it are still read

  @D-077 @auto
  Scenario: Typed chords can be read in Do-Re-Mi
    Given the app speaks Do-Re-Mi
    When I type Lam7 Fa#m7 Rem7 Sol7sus4
    Then they read as Am7 F#m7 Dm7 G7sus4

  @D-077 @auto
  Scenario: Typed chords get numerals in the key
    Given the key of A minor
    Then Am7 is i, Fmaj7 is ♭VI, Amaj7 is I, and F#m7, from outside the key, is vi

  @D-077 @auto
  Scenario: A major seventh chord keeps a capital numeral
    Given C major with seventh chords
    Then Cmaj7 is I and Fmaj7 is IV, not i and iv

  @D-077 @auto
  Scenario: The chords you type say which keys hold them
    When I type Am7 Dm7 G7sus4
    Then A minor and C major are among the keys offered
    And for Am7 F#m7 Dm7 G7sus4 it says no single key holds them

  @D-077 @auto
  Scenario: Suspended sevenths are chords the app knows
    Then G7sus4 and D9sus4 are in the dictionary and the chord table
    And G C D F with G at the bottom is named G7sus4

  @D-077 @auto
  Scenario: The typing buttons insert text the reader understands
    When I build "A♭maj7 F#m7/E" from the buttons
    Then both chords are read

  @UC-62 @manual
  Scenario: Typing a song's chords on the phone
    Given the Progression tab on a phone
    When I type "am7 f#m7 dm7 g7sus4" with the phone's keyboard and the buttons
    Then the keyboard does not capitalise or autocorrect, each chord appears as I type
    And one tap adds them to the loop, where they play

  @D-077 @auto
  Scenario: The guide explains typing chord names
    Given How to use, Progression section
    Then it says chord names can be typed, with an example the box reads cleanly

Feature: Finger numbers
  Which finger plays each lit key, for chords and scales, in either hand.
  Suggested, not checked: the app cannot see your fingers. (D-078, UC-63)

  @D-078 @auto
  Scenario: A root-position triad is fingered 1-3-5
    Given fingers are set to the right hand
    When I tap C major
    Then C, E and G show 1, 3 and 5
    And with the left hand they show 5, 3 and 1

  @D-078 @auto
  Scenario: Inversions change the fingers the standard way
    Given every major and minor triad in every key
    Then first inversion is 1-2-5 in the right hand and 5-3-1 in the left
    And second inversion is 1-3-5 in the right hand and 5-2-1 in the left

  @D-078 @auto
  Scenario: Seventh chords use four fingers
    When I tap Cmaj7 in close position
    Then the right hand is 1-2-3-5 and the left hand 5-3-2-1

  @D-078 @auto
  Scenario: Fingers rise with pitch and never repeat
    Given every chord and voicing the app can show, within one hand's reach
    Then right-hand fingers rise from bottom to top, left-hand fingers fall, and no finger is used twice

  @D-078 @auto
  Scenario: A chord too wide for one hand is split between the hands
    When I tap a Cmaj9 spread over more than an octave
    Then the left hand takes C, the right hand takes E G B D as 1-2-3-5
    And the app says "split between hands"

  @D-078 @auto
  Scenario: A chord no two hands can play is said to be too wide
    Given a voicing spread over more than two hand-spans
    Then no finger numbers are shown, and it says "too wide to play as written"

  @D-078 @auto
  Scenario: Scales use the standard fingering in every key
    Given the major and natural minor scales in all 12 keys, both hands, one octave up
    Then each matches the published table
    And C major is 1-2-3-1-2-3-4-5 in the right hand, F major 1-2-3-4-1-2-3-4

  @D-078 @auto
  Scenario: The thumb never lands on a black key in a scale
    Given every scale fingering in the table
    Then finger 1 is only ever on a white key

  @D-078 @auto
  Scenario: The thumb crossing is marked and named
    Given the C major scale in the right hand
    Then F is marked as the key where the thumb tucks under
    And in the left hand A is marked as the key where 3 crosses over

  @UC-63 @auto
  Scenario: Scale lessons say where the thumb crosses
    When I open "The major scale" in Learn, in any key
    Then the scale shows its fingering and the step names the key where the thumb tucks under
    And chord lessons say which fingers to use, inversions included

  @UC-63 @auto
  Scenario: The finger switch has four settings and is remembered
    Then it offers off, right, left and both
    And Learn starts on the right hand, everywhere else starts off
    And the setting holds when I change tab

  @D-078 @auto
  Scenario: Fingering is suggested, never checked
    Then every place that shows fingering calls it suggested fingering
    And no message judges which finger was used

  @D-078 @auto
  Scenario: The guide explains finger numbers
    Given How to use
    Then it explains the numbers, the two hands and the switch

  @D-078 @auto
  Scenario: Both hands put the bass in the left hand
    Given fingers are set to both
    When I tap C major, then C/E
    Then the left hand plays C, then E, with 5
    And the right hand plays the chord, 1-3-5

  @D-078 @auto
  Scenario: A chord that needs two hands shows both
    Given fingers are set to the right hand
    When I tap a chord wider than my reach
    Then both hands are numbered, each with a bracket over its keys

  @D-078 @auto
  Scenario: Hand reach decides when a chord is split
    Given C E G B D spread over 14 keys
    Then with a reach of an octave it is split between the hands
    And with a reach of a 10th the right hand plays it alone
    And an octave is the reach until I choose another

  @D-078 @auto
  Scenario: The sheet can show suggested fingering
    Given a loop of C Am F G on the Sheet tab
    When I tick Show suggested fingering
    Then each bar shows right-hand numbers on the chord and a left-hand 5 on the bass
    And with it unticked the sheet has no numbers

  @D-078 @manual
  Scenario: The two hands can be told apart without colour
    Given fingers set to both, on screen and on a black-and-white printout
    Then solid and outlined discs are told apart at a glance

  @D-078 @manual
  Scenario: Finger numbers are legible on the phone
    Given fingers on, on a phone at arm's length
    Then I can read the numbers on white keys, black keys, lit chords and scale tints

  @UC-63 @manual
  Scenario: The suggested fingering feels natural to play
    Given I play the first five lessons following the numbers
    Then nothing asks for a stretch I can't make, and the thumb crossings feel right

# ============================================================================
# J-6 Explorer — a second page in the same repository, for the Roland J-6
# chord synthesizer. Its engine is j6/j6.mjs; its tests are tests/j6.test.mjs.
# The scenarios live here, in the one feature file, so the same traceability
# test and the same gates cover both apps. (D-085)
# ============================================================================

Feature: J-6 chord data
  The J-6's chord sets, as printed in the owner's manual, are checked before
  anything is built on them: every voicing must sound its label's root and no
  note outside its label's chord. (D-080, D-082)

  @D-080 @auto
  Scenario: Every chord in sets 29, 47 and 54 is spelled by its J-6 voicing
    Given the voicings printed in the J-6 Chord Set List
    When each voicing is checked against its label
    Then no set reports a problem

  @D-082 @auto
  Scenario: A set whose published voicings contradict their labels is flagged and never recommended
    Given set 59 as printed in the manual
    When the set is validated
    Then all 12 keys are flagged
    And key C♯ ("C6") is flagged because its root is not sounded
    And a search over set 59 returns no results

  @D-080 @auto
  Scenario: A 4-voice voicing with a missing tone still counts as its chord
    Given the voicing G4 B3 F3 G2 labelled G7
    Then it is valid
    But G4 B3 F3 G♯2 labelled G7 is not

Feature: J-6 Explore — what am I playing?
  Tap the J-6 keys in the order they were played on the hardware, and see each
  chord's name, numeral, notes and real voicing, and the key they suggest.
  (UC-64)

  @D-079 @UC-64 @auto
  Scenario: Pressing D# on set 54 shows Fmaj7 with the J-6 voicing F3 A3 C4 E4
    Given chord set 54 at KEY 0
    When the user presses D♯
    Then the chord reads "Fmaj7"
    And the manual label reads "FM7"
    And the voicing is F3 A3 C4 E4

  @UC-64 @auto
  Scenario: Keys C, C#, G, D# on set 54 read as Imaj7 iii7 vi7 IVmaj7 in C major
    Given chord set 54 at KEY 0
    When the user presses C, C♯, G, D♯
    Then the likely key is C major with 4 of 4 chords fitting
    And the numerals read Imaj7 iii7 vi7 IVmaj7

  @UC-64 @auto
  Scenario: Roman numerals follow the key, not the letter C
    Given the progression Fmaj7 Am7 Dm7 B♭maj7 C7
    Then the likely key is F major
    And the numerals read Imaj7 iii7 vi7 IVmaj7 V7

  @D-086 @UC-64 @auto
  Scenario: J-6 chords are spelled the way their key writes them
    Given chord set 54 at KEY +2
    When the user presses C, C♯, G, D♯
    Then the likely key is D major
    And the chords read Dmaj7 F#m7 Bm7 Gmaj7, never G♭m7
    And at every KEY from −6 to +5 the same four chords never mix sharps and flats

  @UC-64 @manual
  Scenario: The pad labels are readable at arm's length beside the hardware
    Given the phone is next to the J-6 on a desk
    Then every pad's chord name can be read without picking the phone up
    And the latest key is distinguishable from earlier ones without colour vision

Feature: J-6 Find — how do I play this on the J-6?
  Type a progression and find the chord set, and the KEY transpose, that plays
  it, with the keys to press. (UC-65)

  @D-081 @auto
  Scenario: KEY transpose moves every chord and its voicing by the same amount
    Given chord set 47
    When KEY is −6, −3, +2 or +5
    Then every key's chord root and every voicing note move by that amount

  @D-081 @UC-65 @auto
  Scenario: Dm7 G7 Cmaj7 Am7 finds set 47 at KEY −3 with four exact matches
    Given sets 29, 47 and 54, musical mode, transpose allowed
    When the user searches "Dm7 G7 Cmaj7 Am7"
    Then the best match is set 47 at KEY −3 scoring 100%
    And Dm7 is on D♯ or F♯, G7 on A, Cmaj7 on C♯ or E, Am7 on C
    And when several KEY values play a progression equally well, the one nearest 0 wins

  @UC-65 @auto
  Scenario: Musical search counts an inversion and a missing seventh as near matches
    Given set 29 without transpose
    When the user searches "Dm7 G7 Cmaj7 Am7"
    Then Dm7 and G7 are exact, Cmaj7 is an inversion on F, Am7 is close on A
    And the score is 87.5%

  @UC-65 @auto
  Scenario: A chord with the wrong third is never a musical match
    Then Gm7 is not a match for G7
    And A is not a match for Am7

  @UC-65 @auto
  Scenario: Exact search without transpose ranks set 54 first at 75%
    Given sets 29, 47 and 54, exact mode, no transpose
    Then the ranking is set 54 (75%), set 29 (50%), set 47 (25%)

  @D-079 @UC-65 @auto
  Scenario: Chord symbols are read the way musicians type them
    Then "Cmaj7", "CM7", "Bbmaj7", "A#M7", "CM7/E" and "C-7" are all understood
    And "H7" and "Cfoo" are rejected

  @D-081 @manual
  Scenario: The KEY direction and range match the hardware
    Given the J-6 on set 47
    When KEY is set to −3 and A is pressed
    Then the J-6 plays G7 (G B D F)
    And the KEY range on the device is recorded in D-081

  @D-083 @manual
  Scenario: The high C pad plays the C chord
    Given any chord set
    When the 8th lower pad is pressed
    Then it plays the same chord as C
