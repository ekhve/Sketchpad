# Finger numbers — draft specification

**Status:** built 2026-10-01. This draft is now superseded by `D-078` in DESIGN.md, `UC-63` in USE_CASES.md, `R-323`–`R-342` in REQUIREMENTS.md and the *Finger numbers* feature in sketchpad.feature. It is kept as the record of what was agreed before building. Once agreed, each part moves into the usual documents: the decision to `DESIGN.md`, the use case to `USE_CASES.md`, requirements to `REQUIREMENTS.md`, scenarios to `sketchpad.feature`. Then tests, mutants and code follow, and the definition-of-done gates must pass.
**Prototype:** `proto/fingering-prototype.svg`, eight phone-width screens in the app's own colours.
**Proposed IDs:** decision `D-078`, use case `UC-63`, requirements `R-323`–`R-342`.

---

## Why

The app shows *which* keys to press but not *how*: which finger goes where, and where the hand has to move. That is what a teacher corrects first, and what a book can't show while you play. A learner who fingers C major 1-2-3-4-5-1-2-3 runs out of fingers. A learner who plays every chord with the same fingers gets stuck on inversions.

## Use case

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

## Decision (draft) — D-078

1. **Chords by rule, scales by table.** Chord fingering follows a few rules every method agrees on. Scale fingering does not: F major, B major and the black-key scales each have their own. So chords are computed and scales are looked up in a published standard table, never invented.
2. **The chord rule.** Fingers rise with pitch in the right hand (1 at the bottom) and fall in the left (5 at the bottom).
   - *Three notes:* the middle note takes finger 3, unless the gap between it and the little finger's note is a fourth or wider (5 keys or more); then it takes 2. The little finger plays the top note in the right hand and the bottom note in the left. This gives exactly the standard inversion fingerings: right hand 1-3-5, 1-2-5, 1-3-5; left hand 5-3-1, 5-3-1, 5-2-1.
   - *Four notes:* 1-2-3-5 / 5-3-2-1.
   - *Five notes:* all five fingers.
   - *Two notes:* by the size of the interval.
3. **Hand reach is a setting, an octave by default.** A chord wider than your reach, or with more than five notes, is split: the left hand takes the lowest notes until the rest fit the right hand. If even that is impossible, it says the voicing is too wide to play as written. Choices: a 7th, an octave, a 9th, a 10th (11, 12, 14 and 16 keys).
   - *Why an octave:* research on pianists' hand spans (Boyle, Boyle & Booker, via PASK) finds that comfortably playing an octave needs a span of about 19.3 cm, a ninth about 21.6 cm and a tenth about 23.9 cm. Adult men's spans are on average about 2.5 cm larger than women's. Nearly 30% of adult women can't play an octave with even minimal comfort, and about 87% can't reach a tenth. An octave is the safe default, and the 7th exists for smaller hands.
4. **Shown, not checked.** The app only knows which key went down, not which finger pressed it. So the wording is "suggested fingering", and nothing claims to judge fingers.
5. **Two hands look different twice over.** The right hand is a solid dark disc with a light number; the left hand is a light disc with a thick purple ring and a purple number. Purple is already the app's bass colour, and the left hand usually plays the bass. Fill against outline carries the meaning by itself, so it still works for colour-blind players and on a black-and-white printout.
6. **Both hands.** The switch is off / right / left / both. *Both* is how you play a loop: the left hand plays the bass note (the root, or the bass of a slash chord) with finger 5, and the right hand plays the chord by the chord rule. A chord that needs two hands shows both automatically, whatever is chosen, with a bracket over the keys each hand takes.
7. **Where it appears.** On by itself in Learn (right hand), off elsewhere until switched on. On the Sheet tab, a tick, *Show suggested fingering*, adds the numbers to the printed diagrams; it is off by default so the plain sheet stays plain.
8. **Thumb crossings** get a teal outline on the key, a curved arrow and the words "thumb under" or "3 crosses over".

**Sources checked for the prototype's fingerings:**
- Chord inversions, both hands: Pianote, *How to practice chord inversions*; Piano Guide Lessons, *C chord inversions*. Both agree on 1-3-5 / 1-2-5 / 1-3-5 and 5-3-1 / 5-3-1 / 5-2-1.
- F major scale: Piano Keyboard Guide, right hand 1-2-3-4-1-2-3-4, left hand 5-4-3-2-1-3-2-1.

## Requirements (draft)

Mode: A = automated test, M = manual check on a phone.

| ID | Requirement | Source | Mode |
|---|---|---|---|
| R-323 | With fingers on, every lit key of a chord shows one finger number, 1–5, for the chosen hand. | D-078, UC-63 | A |
| R-324 | Triads follow the standard fingering: right hand 1-3-5 in root position, 1-2-5 in first inversion, 1-3-5 in second; left hand 5-3-1, 5-3-1, 5-2-1. In every key, major and minor. | D-078 | A |
| R-325 | Four-note chords within reach are 1-2-3-5 (right) and 5-3-2-1 (left); five-note chords use all five fingers. | D-078 | A |
| R-326 | For any chord in one hand, fingers rise with pitch in the right hand and fall in the left, and no finger is used twice. | D-078 | A |
| R-327 | A chord wider than the player's reach, or with more than five notes, is split between the hands: the left takes the lowest notes, the right the rest, each fingered by its own rule, and the app says "split between hands". | D-078 | A |
| R-328 | A chord that cannot be split into two playable hands is shown without numbers, with "too wide to play as written". | D-078 | A |
| R-329 | Major and natural minor scales, one octave up, in all 12 keys and both hands, use the fingering from a published standard table, checked against the source. | D-078 | A |
| R-330 | No scale fingering puts the thumb on a black key. | D-078 | A |
| R-331 | The key where the thumb tucks under (or a finger crosses over) is marked on the piano and named in words. | D-078, UC-63 | A |
| R-332 | The scale lessons in Learn show the fingering and say where the thumb crosses; the chord lessons say which fingers to use. | UC-63, D-073 | A |
| R-333 | A switch next to the keyboard offers off, right, left and both. Learn shows the right hand by default; elsewhere it is off until chosen; the choice is remembered across tabs. | UC-63 | A |
| R-334 | Wherever fingering appears, the app calls it "suggested fingering" and never claims to check the fingers used. | D-078 | A |
| R-335 | The finger numbers can be read on white and black keys, in every fill colour, at arm's length on a phone. | D-078 | M |
| R-336 | The How to use guide explains finger numbers and the switch. | D-078, D-050 | A |
| R-337 | Playing a lesson with the suggested fingering feels natural; nothing asks for a stretch a beginner can't make. | UC-63 | M |
| R-338 | In *both*, the left hand plays the bass note (the root, or the bass of a slash chord) with 5, and the right hand plays the chord by the chord rule. | D-078 | A |
| R-339 | A chord that needs two hands shows both hands, with a bracket over each hand's keys, whichever hand is chosen. | D-078 | A |
| R-340 | The hand reach setting offers a 7th, an octave, a 9th and a 10th (11, 12, 14 and 16 keys), defaults to an octave, and decides when a chord is split. | D-078 | A |
| R-341 | With *Show suggested fingering* ticked (off by default), each bar on the sheet shows right-hand numbers on the chord and the left-hand finger on the bass. | D-078, D-057 | A |
| R-342 | The two hands can be told apart without colour: solid discs for the right hand, outlined for the left, on screen and in a black-and-white printout. | D-078 | M |

## Scenarios (draft)

```gherkin
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
```

## Out of scope for this step

- Checking which finger was used. It can't be seen.
- Fingering for riffs, basslines and melodies. That needs phrase-level fingering, a harder problem.
- Two-octave scales, harmonic and melodic minor, and the modes.
- "Which hand plays what" for the loop (left-hand bass, right-hand chord): the natural next step after this one.

## Decisions taken (2026-10-01)

1. **Hand reach:** an octave by default, with a setting for a 7th, a 9th or a 10th. This is based on the hand-span research above.
2. **Where:** on by itself in Learn, plus an optional *Show suggested fingering* on the printed sheet.
3. **Minor scales:** natural minor only for now, because it's what the lessons teach and what the app calls minor. Harmonic minor comes with the scale lessons that use it.
4. **Thumb crossings:** the arrow is clear, so it stays.
5. **Two hands look different:** solid disc for the right hand, outlined purple for the left. That's both a different colour and a different fill, so it also survives black-and-white printing.
6. **Chords that need both hands:** both hands appear on their own, with a bracket over each hand's keys. A fourth setting, *both*, puts the bass in the left hand and the chord in the right, for playing along with a loop.

## Still open

- Nothing blocking. The two manual scenarios get checked on your phone after the build.
