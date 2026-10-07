# Play-test script

**For:** one session on a phone, ideally next to a synth with a beat running.
**Time:** 25 minutes for the whole thing; 5 for Part 1 alone; 5 for Part 7 (Learn) alone.
**Why this exists:** there are around ninety manual scenarios in `sketchpad.feature`. This is them, ordered so that anything badly wrong shows up in the first five minutes.

**How to use it.** Work down in order. Note anything that surprises you, even slightly — "I expected X" is more useful than "it's broken". Where a check has a ✗ answer that matters, it says so.

**Just want to try the lessons?** Do Part 1, then jump to Part 7.

---

## Part −1 — Install it (3 min, once per device)

| # | Do | Expect |
|---|---|---|
| −1.1 | Open the site's link in **Safari** → Share → **Add to Home Screen** | A Sketchpad icon: teal, with piano keys |
| −1.2 | Open it from the icon | Full screen, no Safari bars |
| −1.3 | Flip the **silent switch** on, tap **test sound** | You still hear it |
| −1.4 | Flight mode on, close it, open it again | It opens and plays |
| −1.5 | Send the link to someone else | They can do −1.1 to −1.4 with no account |

## Part 0 — First impression (2 min)

The app now opens at the **Start** level: a key, a piano, and five tabs. This is the thing that was reported as overwhelming, so judge it fresh.

| # | Do | The question |
|---|---|---|
| 0.1 | Open it and look, without touching | Is it obvious what to do first? |
| 0.2 | Try to make a four-chord loop without leaving Start | Did you need anything that was not there? |
| 0.3 | Switch to **Produce**, then **Study** | Does anything move or vanish? It should not |
| 0.4 | Drop back to **Start** | Is your loop still there? |

## Part 0b — Does it explain itself? (1 min)

Open **How to use** and read the first three sections. Not to learn the app — to check whether it explains itself. Any mismatch with what you then find is worth reporting.

## Part 1 — Does the thing work at all? (5 min)

If any of these fail, stop and report; the rest of the script is wasted.

| # | Do | Expect | Fails if |
|---|---|---|---|
| 1.1 | Open the app. Tap **test sound** | One note sounds | Nothing → read the status line next to it and report exactly what it says |
| 1.2 | Watch the status line | `running · Grand piano` | `suspended` or `error` → report the text |
| 1.3 | Tap a few piano keys | Each sounds and lights | — |
| 1.4 | Press a key and **hold it** | It sustains until you let go | It cuts off early |
| 1.5 | Drag the **strip above the keys** sideways | The keyboard moves across four octaves | Dragging a key scrolls instead of playing |
| 1.5b | Press three keys **at once** | All three sound and light; lifting one leaves two | Any of them drops out |
| 1.5c | Press a key and **drag across** the keys | Each sounds as you reach it, stops as you leave | Only the first note sounds — that means the browser is still stealing the gesture |
| 1.6 | Play 40 or so notes quickly | Still sounding; voice counter drops back near 0 between notes | It goes quiet → this was the bug that took three attempts |
| 1.7 | Tap **C#m**, then **Play loop** in Progression | Chords sound in time, piano follows, loop repeats without a gap | — |

## Part 1b — Type a song in (3 min)

| # | Do | Expect |
|---|---|---|
| 1b.1 | **Progression** → type `am7 f#m7 dm7 g7sus4` in lower case | Four chords appear as you type, named Am7 F#m7 Dm7 G7sus4; the keyboard does not capitalise anything |
| 1b.2 | Read the line under them | "No single key holds all of these…" — true for this verse |
| 1b.3 | Delete `f#m7` | A minor and C major are offered; tap A minor |
| 1b.4 | Type `Cmaj8` | Shown in red: "Did you mean Cmaj7?", and Add is gone |
| 1b.5 | Build `F#m7/E` with the **#**, **m7** and **/** buttons | Read correctly, E at the bottom when you tap it |
| 1b.6 | **Add to the loop** → Play loop | They play, with numerals (i, ♭VI…) under the names |

## Part 1c — Finger numbers (4 min)

| # | Do | Expect |
|---|---|---|
| 1c.1 | Tap **C** in Chords, then **Fingers: right** under the keyboard | 1, 3, 5 on C, E, G in solid dark discs |
| 1c.2 | **left**, then **both** | 5-3-1 in outlined purple discs; then a purple bass C in the octave below, with the chord in the right hand and a bracket over each hand |
| 1c.3 | Type `Cmaj9` in Progression and tap it, with **right** chosen | If it's wider than your reach, both hands appear anyway and it says "split between hands" |
| 1c.4 | **hand reaches: 7th**, then **10th** | The split appears and disappears |
| 1c.5 | **Learn → The major scale** | Right-hand numbers on by themselves; the card says "thumb under onto F"; play it and follow them |
| 1c.6 | Switch to a key like **E♭**, open the scale again | The thumb never lands on a black key |
| 1c.7 | **Sheet** (Produce level) → tick **Show suggested fingering** → print in black and white | Numbers on each chord and a 5 on each bass; solid and outlined still tell the hands apart |

**The questions that matter here:** Can you read the numbers at arm's length? Did any suggested fingering feel wrong in your hand?

## Part 2 — The main scenario (5 min)

This is `UC-00`, the thing the app exists for. Do it as if you meant it.

| # | Do | Expect |
|---|---|---|
| 2.1 | Pick your key. Say C# minor | Chords and scales rebuild; explanation names your seven notes |
| 2.2 | Tap a chord you like | Its notes light **in one octave only**, and it sounds |
| 2.3 | **Look away and play it on your synth**, reading it off the screen | It's still lit when you look back |
| 2.4 | Add four chords with **add** | Each lights as you add it |
| 2.5 | Play the loop | Piano follows; scale dots stay visible underneath |
| 2.6 | Go to **Bass** | It describes a chord without you having selected one |
| 2.7 | Go to **Progression** → "which scales fit" | Ranked, naming what each one misses |
| 2.8 | Tap one | Piano lights the palette to play over your loop |

**The question that matters:** did you at any point want to do something and not find it?

## Part 3 — Sound and feel (3 min)

| # | Do | Expect | Watch for |
|---|---|---|---|
| 3.1 | Try each instrument on the same chord | Clearly different sounds | Which would you actually use? |
| 3.2 | Toggle **echo** on the Rhodes and the pad | Obvious, and not muddy | Too much? Too little? |
| 3.3 | Tap a chord, then quickly another | The first stops; they don't pile up | |
| 3.4 | Play the loop for two minutes | No drift, no build-up, no fade | |
| 3.5 | Switch apps, come back | Sound resumes, or a banner offers to | |

**The judgement call:** does it sound good, or merely correct? A correct chord in a bad voice teaches nothing.

## Part 4 — The teaching (4 min)

| # | Do | Expect |
|---|---|---|
| 4.1 | Chords → **9ths** → tap one | Rich, and the ninth sits above the seventh, not next to the root |
| 4.2 | **Voicing** list → tap each | Each sounds different; **the one you tap is the one you hear** |
| 4.3 | Tap ▶ chord, arp ↑, arp ↓ | Same notes, three ways |
| 4.4 | Theory → dictionary → **C** then **C minor** | Clearly different. If they sound alike, report it — this was a reported bug |
| 4.5 | Theory → **Build it**, step through | One note at a time, lighting up, with the rule in words |
| 4.6 | Progression → **Voice leading** | Which notes hold, which move, and the smoothest arrangement |
| 4.7 | Progression → **What could come next** | Ranked, each with a reason. Do the reasons ring true? |

## Part 5 — Discovery (3 min)

| # | Do | Expect |
|---|---|---|
| 5.1 | **Find** tab → tap C#, E, G#, B | Latch as chosen (not momentary). Reads **C#m7** |
| 5.2 | Now tap notes E G# B C# instead | Offers **E6** *and* **C#m7/E**, E6 first because E is lowest |
| 5.3 | Tap ▶ together, arp ↑ | Sounds what you chose |
| 5.4 | **Save as chord**, name it | Appears under "Yours" in Chords, playable and addable |
| 5.5 | Choose 7 notes → **Save as scale** → select it in Scales | Piano lights **your** notes, and it harmonises into its own chords |
| 5.6 | Scales tab → pick a style like **soul** | Suited scales marked and first, with chord colours |
| 5.7 | Chords → a chord set → **add all** | Its progression becomes your loop |

## Part 5b — The sheet (2 min)

| # | Do | Expect |
|---|---|---|
| 5b.1 | Build a loop, open the **Sheet** tab | Each bar as a small keyboard with its voicing filled in, plus scale and bass |
| 5b.2 | Press **Print** | Only the sheet prints, and it fits a page |
| 5b.3 | Look at it without the app | Could you play the loop from this alone? That is the only question that matters |

## Part 6 — Where it should break (deliberate)

| # | Do | Expect |
|---|---|---|
| 6.1 | Find tab → tap six adjacent semitones | "No standard chord matches" — not an invented name |
| 6.2 | Find tab → tap two notes only | Named as an interval, saying a third would give it a mood |
| 6.3 | Select minor pentatonic, then tap the **A** chord | It must **not** say A is outside the key. It is in the key |
| 6.4 | Hold a key, then switch tabs | The note stops |
| 6.5 | Press **silence** mid-loop | Sound stops; your chord stays lit, loop unchanged |
| 6.6 | Press **reset audio**, then a chord | Sounds again |

## Part 7 — Learn: practising on the piano (5 min)

New. The lessons listen to what you play, so play them for real rather than reading them.

| # | Do | Expect |
|---|---|---|
| 7.1 | Open **Learn** | Ten lessons in one numbered list, and a line saying which key they follow |
| 7.2 | Open **1 · Find the home note** and play it | Each note is answered under the piano straight away; the reason appears only when the step is done |
| 7.3 | **3 · Your first chord** → play C E G going up, then the chord, with one deliberate wrong note | The wrong note is named, along with what is still missing; your right notes stay marked on the piano |
| 7.4 | While a lesson is open, look at the piano | No scale dots and no loop colours — only the home dot and the notes you've got right |
| 7.5 | **2 · The major scale** → press **Show me**, then **Hint** partway through | Show me plays and lights the whole scale. Hint first says *how* to find the next note ("From D, go a whole step up") without naming it; the button then reads **Show the note**, which lights it |
| 7.6 | Play a scale note in the wrong direction (the D **below** your C) | "Right note, wrong way" |
| 7.7 | Finish a lesson → **Again in G** | The same lesson restarts in G; the key at the top changes too |
| 7.8 | Halfway through a lesson, pick another key at the top | The lesson starts again from step 1 in that key |
| 7.9 | **8 · The four-chord loop** → finish → **Put C G Am F in my loop** | Progression opens with those four chords, ready to play |
| 7.10 | **5 · The minor scale** in C | It asks for C D E♭ F G A♭ B♭ C — flats, not D# G# A# |
| 7.11 | Pick **E♭** at the top (major), then switch to **minor** | Major: the key button reads E♭ and the chords use flats. Minor: the same button reads D#, and everything uses sharps |
| 7.12 | Switch **A B C → Do Re Mi** and open Theory → **Build it** in C minor | It speaks Do Re Mi♭, not C D E |
| 7.13 | **3 · Your first chord** step 2, after C: play **E♭** | "E♭ is 3 keys above C; the major third is 4 keys up, at E." |
| 7.14 | Same step, play **F** instead | It walks the scale: "C, skip D, E, skip F, G" |
| 7.15 | **2 · The major scale**: C then **E** | "You skipped D: from C the next note is a whole step up (skip one key)." |
| 7.16 | Finish any chord step | A **Take away** line you could use in another key, and for a triad its shape: C shares "all white keys" with F and G |
| 7.17 | Next day, same lesson in a new key, no hints | Did yesterday's take-away rules get you there? That is the real test of `D-075` |

**The questions that matter here:**
- Does it feel like playing with someone beside you, or like being tested?
- Were the prompts clear enough to play without pressing Show me?
- Which lesson did you want next that wasn't there?
- In a flat key, does anything still say D# or A# where you'd expect E♭ or B♭? That would be a spelling bug.
- When you got a note wrong, did the explanation tell you something you could use next time, or just the answer?

---

## Part 8 — J-6 Explorer, next to the J-6 (6 min)

Open the site's **j6/** link (or "J-6 Explorer" from the home screen). Put the phone on the desk beside the J-6.

| # | Do | Expect |
|---|---|---|
| 8.1 | Add **j6/** to the home screen and open it; then flight mode, close, open again | Its own icon (a black J-6 with one amber pad), full screen, works offline. Sketchpad's icon still works offline too |
| 8.2 | Without picking the phone up, read the chord names on the pads | Every pad's chord is readable at arm's length (*The pad labels are readable at arm's length beside the hardware*) |
| 8.3 | On set 54, tap ten pads at random | Each plays and shows its chord; the progression stays empty. Tap **+ Add** on one: only that one is kept (*Trying chords out never fills the progression by accident*) |
| 8.3b | Turn on **Rec**, tap C, C♯, G, D♯ | Rec is filled red, "● REC"; you can tell it is on without relying on the colour. Numbers 1–4 on the pads; the latest has a white outline. Progression Cmaj7 Em7 Am7 Fmaj7, key C major. Turn Rec off: the progression and the numbers stay. Take out Em7 with ×, then Clear: the numbers go |
| 8.3c | With four chords kept: Click on, Tempo to the J-6's tempo, ▶ Play, and play along on the J-6 | A one-bar count-in, then the chords in time; the one sounding is highlighted in the progression and on its pad. Change the tempo while it plays: it follows from the next beat. Try ½ bar and 2 bars, Loop off (plays once and stops), ■ Stop (silent at once) (*Playing along with the J-6 at the app's tempo*) |
| 8.3d | With the progression looping, tap a scale under Piano · play along and play a melody on the piano | The dots show the scale; the piano doesn't move; the loop doesn't stop (*Playing along on the piano while the progression plays*) |
| 8.3e | Show the Sheet, tick Suggested fingering, Print (or save as PDF) | Only the sheet prints: chords as the J-6 voices them, finger numbers, and the J-6 set, KEY and key for each (*A printed J-6 sheet can be played from at a piano*) |
| 8.4 | On the J-6: set 47, KEY −3, press A | It plays **G7** (G B D F). If not, the KEY direction is backwards: report it (*The KEY direction and range match the hardware*) |
| 8.5 | Turn KEY as far as it goes both ways | Write down the lowest and highest values. The app assumes −6 and +5 |
| 8.6 | On the J-6, press the 8th lower pad (high C) | Same chord as C? (*The high C pad plays the C chord*) |
| 8.7 | In **Find**, type your own progression | Each chord gets a ✓ or a reason; the best set and KEY; ▶ Hear it plays it |
| 8.8 | Switch Sound between Piano and Pad; tap **← Sketchpad** | Both sounds work; Sketchpad opens (*The J-6 Explorer installs from its link and works beside the J-6*) |

## What to report back

Ranked by how much it helps me:

1. **Anything from Part 1** — a broken foundation makes everything else noise.
2. **"I expected X"** — mismatches between what you thought would happen and what did. These are design bugs and I cannot find them by reading code.
3. **The judgement calls:** does it sound good? Would you use it in a session? What did you want that wasn't there?
4. **Legibility:** night, one hand, arm's length. Can you tell chord tones from scale notes on the sharps?
5. Cosmetic things last.

## What I already know is missing

Don't spend time reporting these.

- Nothing persists. Reload and everything is gone, including saved chords and scales and finished lessons.
- No swing; figures can't be edited note by note.
- No MIDI export.
- F# major and D# minor show F where a score would write E#.
- There is no Explore mode yet; the chord dials are still spread across tabs and levels.
