/* Mutation testing: break the theory on purpose, one change at a time, and
   see whether the suite notices. A test that survives every mutation of the
   code it claims to cover is not testing anything. */
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";

const MUTANTS = [
  ["approach notes stop approaching",   'midi = r() < 0.6 ? t - 1 : t + 1;', 'midi = t;'],
  ["place() ignores the nearer octave", 'return Math.abs(base - near) <= Math.abs(base + 12 - near) ? base : base + 12;', 'return base;'],
  ["bass roots drift off the centre",   'midi = place(rootPc, center);\n        break;\n      case "octave":', 'midi = place(rootPc, ref);\n        break;\n      case "octave":'],
  ["sevenths stack a sixth instead",    'const idx = size === 5 ? [0, 2, 4, 6, 8] : size === 4 ? [0, 2, 4, 6] : [0, 2, 4];', 'const idx = size === 5 ? [0, 2, 4, 6, 8] : size === 4 ? [0, 2, 4, 5] : [0, 2, 4];'],
  ["roman numerals lose their case",    ' base = base.toLowerCase();', ''],
  ["the bass channel is dropped",       'if (bass.includes(midi)) return "bass";', ''],
  ["outside-the-key detection flips",   'const outside = chordPcs.filter((p) => !keyNotes.includes(p));', 'const outside = chordPcs.filter((p) => keyNotes.includes(p));'],
  ["scale fitting ignores misses",      'return { scale: s, fit: covered.length / used.length, missing: used.filter((p) => !notes.includes(p)) };', 'return { scale: s, fit: 1, missing: [] };'],
  ["solfege falls back to letters",     '  : (system === "solfege" ? SOLFEGE : NAMES)[pc(m)]);', '  : NAMES[pc(m)]);'],
  ["spelled Do-Re-Mi falls back to letters", 'const renderName = (name, base) => (base === "solfege" ? SOLFEGE_OF[name[0]] + name.slice(1) : name);', 'const renderName = (name, base) => name;'],
  ["rising line loses its direction",   'const up = s.r === "stepUp" ? true : s.r === "stepDown" ? false : r() < 0.5;', 'const up = r() < 0.5;'],
  ["variation stops varying",           'renderFigure(pattern, chord, progression[(i + 1) % progression.length], scaleSet, seed + i * 7919, center)', 'renderFigure(pattern, chord, progression[(i + 1) % progression.length], scaleSet, 0, center)'],
  ["voicings lose their register",      'const root = base + rootPc;', 'const root = base - 24 + rootPc;'],
  ["harmony judged against the palette", 'const keyNotes = scalePcs(ctx.tonic, parentId);', 'const keyNotes = scalePcs(ctx.tonic, ctx.scaleId);'],
  ["notes outlast the gap before the next", 'const dur = Math.max(0.05, Math.min(n.dur * sixteenth, nextAt - at - gap));', 'const dur = n.dur * sixteenth;'],
  ["the chord fills the whole bar",      'dur: Math.max(0.1, barSeconds * 0.5 - gap), vel: VELOCITY.chord });', 'dur: barSeconds, vel: VELOCITY.chord });'],
  ["chords are as loud as the melody",   'const VELOCITY = { chord: 0.5, bass: 0.85, riff: 0.8 };', 'const VELOCITY = { chord: 0.9, bass: 0.85, riff: 0.8 };'],
  ["chords light every octave",          'if (chordNotes.includes(midi)) return "chordTone";', 'if (chordNotes.map((n) => ((n % 12) + 12) % 12).includes(((midi % 12) + 12) % 12)) return "chordTone";'],
  ["figures are not sorted before planning", 'const sorted = [...figure].sort((a, b) => a.pos - b.pos);', 'const sorted = [...figure].reverse();'],
  ["ninths fold into one octave",        'notes: voice(rootPc, stackAscending(tones, rootPc), base),', 'notes: voice(rootPc, intervals, base),'],
  ["bass options lead with a passing note", 'const out = [{ pc: chord.rootPc, role: "root", ...BASS_ROLES.root }];', 'const out = [{ pc: scaleSet[1], role: "passing", ...BASS_ROLES.passing }, { pc: chord.rootPc, role: "root", ...BASS_ROLES.root }];'],
  ["transitions do not land on the target", 'out.push({ name: "Direct", notes: [a, b],', 'out.push({ name: "Direct", notes: [a, b + 2],'],
  ["chord sets lose their progressions",  'progressionChords: setDef.progression.map((i) => chords[i]) };', 'progressionChords: [] };'],
  ["inversions change the chord",         'notes = [...notes.slice(1), notes[0] + 12];', 'notes = [...notes.slice(1), notes[0] + 13];'],
  ["voices are never reaped",           'for (const v of voices) (v.until <= now ? expired : keep).push(v);', 'for (const v of voices) keep.push(v);'],
  ["the budget is ignored",             'return Math.max(0, Math.min(requested, max - liveCount));', 'return requested;'],
  ["voices are cut off before they finish", 'return Math.max(0.1, seconds) + release + margin;', 'return Math.max(0.1, seconds);'],
  ["tabs demand an explicit selection", 'if (progression.length) return progression[0];', ''],
  ["a playing bar is ignored",          'if (playingIndex >= 0 && progression[playingIndex]) return progression[playingIndex];', ''],
  ["echo leaks when switched off",      'if (!on) return { wet: 0, feedback: 0, time: 0.25 };', 'if (!on) return { wet: 0.2, feedback: 0.2, time: 0.25 };'],
  ["the open voicing does not open",    'dropped[dropped.length - 2] -= 12;', 'dropped[dropped.length - 2] -= 0;'],
  ["rootless keeps its root",           'out.push({ id: "rootless", name: "Rootless", notes: notes.slice(1),', 'out.push({ id: "rootless", name: "Rootless", notes: notes.slice(0),'],
  ["a struck voice sustains",           'envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.3 },', 'envelope: { attack: 0.002, decay: 0.8, sustain: 0.5, release: 0.3 },'],
  ["the scheduler repeats a bar",       'while (at < now + lookahead && guard++ < 32) {', 'while (at < now + lookahead + 2 && guard++ < 32) {'],
  ["bars can be scheduled in the past", 'bars.push({ at: Math.max(at, now), index: i });', 'bars.push({ at, index: i });'],
  ["voice leading ignores common notes", 'const common = a.filter((p) => b.includes(p));', 'const common = [];'],
  ["suggestions repeat the current chord", '.filter((c) => c.rootPc !== last.rootPc)', '.filter(() => true)'],
  ["a fourth up is not preferred",      'if (interval === 5) { score += 3;', 'if (interval === 5) { score += 0;'],
  ["harmonise takes adjacent notes",    'const idx = size === 5 ? [0, 2, 4, 6, 8] : size === 4 ? [0, 2, 4, 6] : [0, 2, 4];\n  const steps = [];', 'const idx = size === 5 ? [0, 1, 2, 3, 4] : size === 4 ? [0, 1, 2, 3] : [0, 1, 2];\n  const steps = [];'],
  ["inversions are not marked as such",  'label: chordLabel(root, q.sym, system) + (inverted ? `/${noteName(bass, system)}` : ""),', 'label: chordLabel(root, q.sym, system),'],
  ["root position is not preferred",     'score: q.rank + (inverted ? 0 : 2),', 'score: q.rank,'],
  ["intervals measured the short way",   'const up = pc(top - bass);', 'const up = Math.min(pc(top - bass), pc(bass - top));'],
  ["arpeggios ignore direction",         'if (direction === "down") return [...asc].reverse();', 'if (direction === "down") return asc;'],
  ["the smoothest voicing is not sorted", '}).sort((a, b) => a.distance - b.distance);', '});'],
  ["scales are not ranked by tightness", 'return out.sort((a, b) => a.extra - b.extra || a.scale.iv.length - b.scale.iv.length).slice(0, limit);', 'return out.slice(0, limit);'],
  ["saved chords are tidied into root position", 'const notes = [...new Set(midis)].sort((a, b) => a - b);\n  if (notes.length < 2) return null;', 'const notes = [...new Set(midis.map((m) => 48 + pc(m)))].sort((a, b) => a - b);\n  if (notes.length < 2) return null;'],
  ["any selection counts as a scale", 'if (pcs.length < 5 || pcs.length > 8) return null;', ''],
  ["style suggestions are not sorted", 'return { suited: tagged, others: rest, ...STYLE_COLOURS[style] };', 'return { suited: [], others: inMode, ...STYLE_COLOURS[style] };'],
  ["a borrowed chord is traced to any scale", 'const fits = SCALES\n    .filter((s) => s.mode === ctx.mode && s.id !== parentId && s.iv.length >= 7)\n    .map((s) => ({ scale: s, missing: chordPcs.filter((p) => !scalePcs(ctx.tonic, s.id).includes(p)) }))\n    .filter((f) => f.missing.length === 0);', 'const fits = SCALES\n    .filter((s) => s.mode === ctx.mode && s.id !== parentId && s.iv.length >= 7)\n    .map((s) => ({ scale: s, missing: [] }));'],
  ["a saved scale never lights the piano", 'return customScale ? customScalePcs(customScale) : scalePcs(tonic, scaleId);', 'return scalePcs(tonic, scaleId);'],
  ["a tab goes undocumented",           'const guideFor = (tabId) => GUIDE.filter((g) => g.tab === tabId);', 'const guideFor = (tabId) => GUIDE.filter((g) => g.tab === tabId && tabId !== "bass");'],
  ["explanations grow past the cap",   'const base = (roles[chord.degreeIndex] || "chord") + (shared.length', 'const base = (roles[chord.degreeIndex] || "chord") + ". It is a chord. " + (shared.length'],
  ["sentence counting misses the last", "(String(text).match(/[.!?](?:\\s|$)/g) || []).length", "(String(text).match(/[.!?]\\s/g) || []).length"],
  ["a new key replaces the held ones", 'return [...held, midi].sort((a, b) => a - b);', 'return [midi];'],
  ["lifting one finger clears them all", 'const heldAfterUp = (held, midi) => held.filter((m) => m !== midi);', 'const heldAfterUp = (held, midi) => [];'],
  ["the eight-finger limit is ignored", 'if (held.length >= max) return held;', ''],
  ["a glissando never releases",       'released: prev !== null && !heldElsewhere(prev) && !Object.values(next).includes(prev) ? prev : null,', 'released: null,'],
  ["sliding retriggers a held note",   'pressed: midi !== null && !Object.values(active).includes(midi) ? midi : null,', 'pressed: midi,'],
  ["black keys swallow the whole key height", 'if (y <= height * 0.64) {', 'if (y <= height) {'],
  ["the keyboard has no edges",          'if (x < 0 || y < 0 || x > width || y > height) return null;', ''],
  ["chord tones are not marked stable", 'if (chordPcs.includes(p)) return "stable";', ''],
  ["nothing is ever reported as changed", 'added: b.filter((p) => !a.includes(p)).sort((x, y) => x - y),', 'added: [],'],
  ["borrowed chords stay inside the key", 'const borrowed = BORROWED[mode]', 'const borrowed = [].concat(BORROWED[mode]).slice(0, 0); const _unused = BORROWED[mode]'],
  ["diagrams drop the voicing",        'notes: c.notes,\n      names: c.notes.map((m) => noteName(m, system)),', 'notes: [],\n      names: c.notes.map((m) => noteName(m, system)),'],
  ["the diagram range ignores wide chords", 'const octaves = Math.max(minOctaves, Math.ceil((hi - startMidi + 1) / 12));', 'const octaves = minOctaves;'],
  ["black keys are drawn off-centre",  'return { midi: m, x: before * w - w * 0.31, w: w * 0.62, on: on(m) };', 'return { midi: m, x: before * w + w * 0.5, w: w * 0.62, on: on(m) };'],
  ["a level hides what the one below showed", 'return new Set(LEVELS.slice(0, upto + 1).flatMap((l) => l.adds));', 'return new Set(LEVELS[upto].adds);'],
  ["tabs are reordered by level",      'return TAB_IDS.filter((id) => {', 'return [...TAB_IDS].reverse().filter((id) => {'],
  ["signature voicings are ignored",   'if (entry?.voicing) {', 'if (false && entry?.voicing) {'],
  ["the eleventh is stacked in thirds", 'voicing: [0,5,10,15,19] },', 'voicing: [0,3,7,10,14] },'],
  ["chords ignore the visible octave",  'function voice(rootPc, intervals, base = DEFAULT_BASE) {\n  const root = base + rootPc;', 'function voice(rootPc, intervals, base = DEFAULT_BASE) {\n  const root = DEFAULT_BASE + rootPc;'],
  ["dry is not dry",                    'const s = SPACES.find((x) => x.id === spaceId) ?? SPACES[0];', 'const s = SPACES.find((x) => x.id === spaceId) ?? SPACES[1];'],
  ["a sampled instrument has no stand-in", 'volume: -6, release: 1.2, delay: false, fallback: "felt",', 'volume: -6, release: 1.2, delay: false,'],
  ["voicings are read from the current arrangement", 'const base = chord.base ?? Math.floor(Math.min(...chord.notes) / 12) * 12;', 'const base = Math.floor(Math.min(...chord.notes) / 12) * 12;'],
  ["big chords drop only one note",     'if (notes.length >= 5) dropped[dropped.length - 4] -= 12;', ''],
  ["busy voices are stolen first",      'if (busyUntil[i] <= now) { freeIdx = i; break; }', ''],
  ["a roll is not spread at all",       'const step = Math.min(spread, maxTotal / (count - 1));', 'const step = 0;'],
  ["a roll outlasts its own note",      'const step = Math.min(spread, maxTotal / (count - 1));', 'const step = spread;'],
  ["the piano is fetched from a website", 'samples: { baseUrl: "", urls: PIANO_SAMPLES },', 'samples: { baseUrl: "https://example.com/", urls: PIANO_SAMPLES },'],
  ["the recordings lose their credit",   'credit: PIANO_CREDIT,', ''],
  ["the keyboard outruns the recordings", 'const HIGHEST_START_MIDI = PIANO_RANGE.highest - KEYBOARD_OCTAVES * 12;', 'const HIGHEST_START_MIDI = PIANO_RANGE.highest;'],
  ["the recorded range is overstated",   'const PIANO_RANGE = { lowest: 24, highest: 96 };', 'const PIANO_RANGE = { lowest: 24, highest: 132 };'],
  ["a sample name loses its sharp",      "return SAMPLE_STEPS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;", "return SAMPLE_STEPS[m[1]] + (Number(m[3]) + 1) * 12;"],
  ["the worst stretch becomes the best", 'for (let m = lo; m <= hi; m++) worst = Math.max(worst, stretchAt(m, anchors));', 'for (let m = lo; m <= hi; m++) worst = Math.min(worst, stretchAt(m, anchors));'],
  ["a sample payload is truncated",     'const i = String(uri).indexOf(",");', 'const i = String(uri).length - 40;'],
  ["the palette note is never mentioned", 'const outsidePalette = chordPcs.filter((p) => !paletteNotes.includes(p) && !outside.includes(p));', 'const outsidePalette = [];'],

  /* practising lessons (D-073) */
  ["a wrong note in a chord counts",     'if (!target.pcs.includes(p)) {', 'if (false) {'],
  ["a scale can be played in any order", 'if (p !== want) return { attempt, verdict: "wrong", played: p, want };', 'if (false) return { attempt, verdict: "wrong", played: p, want };'],
  ["a scale going up may go down",       'target.direction === "up" && midi <= last', 'target.direction === "up" && false'],
  ["a scale going down may go up",       'target.direction === "down" && midi >= last', 'target.direction === "down" && false'],
  ["the bottom note is not checked",     'if (target.bassPc !== undefined && lowest !== target.bassPc) {', 'if (false) {'],
  ["a slip wipes the attempt",           'return { attempt, verdict: "wrong", played: p, missing:', 'return { attempt: [], verdict: "wrong", played: p, missing:'],
  ["a step completes one note early",    'const done = next.length === target.pcs.length;', 'const done = next.length >= target.pcs.length - 1;'],
  ["lessons ignore the key",             'major: scalePcs(r, "major"),', 'major: scalePcs(0, "major"),'],
  ["the circle goes the wrong way",      'const nextKeyRound = (root) => pc(root + 7);', 'const nextKeyRound = (root) => pc(root + 5);'],
  ["the reason is given away early",     'plain: `${plural(result.left, "note")} to go.`', 'plain: step.why'],
  ["a demonstration always climbs",      'do { m += direction === "down" ? -1 : 1; }', 'do { m += 1; }'],
  ["a hint points at the first note",    'if (t.kind === "sequence") return step.show[attempt.length] ?? null;', 'if (t.kind === "sequence") return step.show[0] ?? null;'],
  ["the four-chord loop loses vi",       'const [I, V, vi, IV] = [tri[0], tri[4], tri[5], tri[3]];', 'const [I, V, vi, IV] = [tri[0], tri[4], tri[3], tri[3]];'],
  ["lessons leave the first screen",     '"explain", "lessons", "guide"] },', '"explain", "guide"] },'],

  /* spelling notes for the key, and the chord table (D-074) */
  ["flat keys spell with sharps",        'const FLAT_SIDE_MAJORS = [0, 1, 3, 5, 8, 10];', 'const FLAT_SIDE_MAJORS = [];'],
  ["alterations lose their letters",     '[11, 7],\n          [3, 3], [8, 6], [10, 7], [6, 4]],', '[11, 7]],'],
  ["minor keys lean like their tonic's major", 'FLAT_SIDE_MAJORS.includes(mode === "minor" ? pc(tonic + 3) : pc(tonic))', 'FLAT_SIDE_MAJORS.includes(pc(tonic))'],
  ["white keys take accidentals",        'if (name && name.length > 1 && WHITE_PCS.includes(pc(p))) return null;', ''],
  ["a lesson forgets its own key",       'const names = spelling(system, r, def.mode ?? "major");', 'const names = spelling(system, r, "major");'],
  ["Find ignores the naming layer",      'label: chordLabel(root, q.sym, system) +', 'label: chordLabel(root, q.sym, "letters") +'],
  ["sus2 is overwritten again",          '"0,2,7": { sym: "sus2"', '"0,2,5,7": { sym: "sus2"'],
  // D-075: feedback that teaches a way of thinking
  ["half and whole steps swapped",       'if (n === 1) return `a half step', 'if (n === 2) return `a half step'],
  ["the skip walk is never offered",     'if (walk && step.scale.includes(P)) return', 'if (false) return'],
  ["a skipped note is not recognised",   'const later = t.pcs.slice(result.attempt.length + 1).includes(P);', 'const later = false;'],
  ["a near miss is not recognised",      'if (Math.min(pc(P - W), pc(W - P)) === 1) {', 'if (false) {'],
  ["the first hint names the note",      'return `Count ${plural(pc(missing - root), "key")} up from ${nm(root)} for the ${toneWord(missing - root)}, counting every key.`;', 'return `Try ${nm(missing)}.`;'],
  ["the scale hint counts from the wrong note", 'return `From ${nm(prev)}, go ${stepWords(down ? pc(prev - want) : pc(want - prev), down ? "down" : "up")}.`;', 'return `From ${nm(prev)}, go ${stepWords(pc(want - t.pcs[0]), down ? "down" : "up")}.`;'],
  ["landmarks are off by one key",       'const keyLandmark = (p) => LANDMARKS[pc(p)];', 'const keyLandmark = (p) => LANDMARKS[pc(p + 1)];'],
  ["the tone is named from the wrong note", 'the ${toneWord(near - root)} is', 'the ${toneWord(P - root)} is'],
  ["a rule states the wrong count",      'Every major chord is 4 + 3', 'Every major chord is 3 + 4'],
  ["a step loses its rule",              'rule: "Count every key, black and white: an octave is always 12 keys up."', 'rule: ""'],
  ["chord shapes flip white and black",  "(WHITE_PCS.includes(pc(r + i)) ? \"W\" : \"B\")", "(WHITE_PCS.includes(pc(r + i)) ? \"B\" : \"W\")"],
  ["a shape lists itself",               'if (r !== root && pattern(r) === own)', 'if (pattern(r) === own)'],
  // D-077: typing chord names
  ["a capital M reads as minor",         'maj: "", major: "", M: "",', 'maj: "", major: "", M: "m",'],
  ["maj7 numerals are lowercase again",  'if (/^m(?!aj)/.test(sym) || sym.startsWith("dim"))', 'if (sym.startsWith("m") || sym.startsWith("dim"))'],
  ["slash chords lose their bass",       'notes = [bass, ...notes];', 'notes = [...notes];'],
  ["slash chords are not read",          'if (slash > 0) {', 'if (false) {'],
  ["lowercase roots are refused",        'const p = TYPED_LETTER_PC[text[0]?.toLowerCase()];', 'const p = TYPED_LETTER_PC[text[0]];'],
  ["flats are read as sharps",           'if (/^(b|♭)/.test(rest)) return { pc: pc(p - 1), rest: rest.slice(1) };', 'if (/^(b|♭)/.test(rest)) return { pc: pc(p + 1), rest: rest.slice(1) };'],
  ["no suggestion is offered",           'return bestLen > 0 ? best : null;', 'return null;'],
  ["bar lines are read as chords",       'return line.split(/[\\s,|]+/)', 'return line.split(/[\\s,]+/)'],
  ["typed chords fold their ninths",     'let notes = voice(parsed.rootPc, d.iv, base);', 'let notes = voice(parsed.rootPc, d.iv.map((i) => i % 12), base);'],
  ["chords outside the key lose their numeral", 'if (degreeIndex < 0) degreeIndex = MAJOR_REF.indexOf(offset + 1);', ''],
  ["Do-Re-Mi chord names are not read",  'if (baseOf(system) === "solfege") {\n    const low', 'if (false) {\n    const low'],
  ["7sus4 leaves the chord table",       '"0,5,7,10": { sym: "7sus4"', '"0,5,7,9,11": { sym: "7sus4"'],
  ["the guide forgets the chord box",     '"Type chord names at the top, as a chord chart writes them:', '"Chords go in from the Chords tab:'],
  ["a refused name vanishes from the line", '.map((t) => parseChordName(t, system));', '.map((t) => parseChordName(t, system)).filter((r) => r.ok);'],
  // D-078: finger numbers
  ["inversions keep the root-position fingers", 'return R ? [1, notes[2] - notes[1] >= 5 ? 2 : 3, 5]', 'return R ? [1, 3, 5]'],
  ["the left hand fingers like the right",    ': [5, notes[1] - notes[0] >= 5 ? 2 : 3, 1];', ': [1, notes[1] - notes[0] >= 5 ? 2 : 3, 5];'],
  ["sevenths use the fourth finger",          'if (n === 4) return R ? [1, 2, 3, 5] : [5, 3, 2, 1];', 'if (n === 4) return R ? [1, 2, 4, 5] : [5, 3, 2, 1];'],
  ["one hand stretches past its reach",       'notes.length >= 1 && notes.length <= 5 && notes[notes.length - 1] - notes[0] <= reach;', 'notes.length >= 1 && notes.length <= 5;'],
  ["six notes fit one hand",                  'notes.length >= 1 && notes.length <= 5 && notes[notes.length - 1]', 'notes.length >= 1 && notes.length <= 6 && notes[notes.length - 1]'],
  ["a split gives the left hand too much",    'for (let k = 1; k < ns.length; k++) {', 'for (let k = ns.length - 1; k >= 1; k--) {'],
  ["an impossible chord gets numbers",        'return { ...none, tooWide: true };', 'return { ...none, keys: assign(ns.slice(0, 5), "R"), tooWide: true };'],
  ["both forgets the bass",                   'return twoHands([bass], notes, bass);', 'return { ...none, keys: assign(notes, "R") };'],
  ["the bass sits inside the chord",          'if (bass > notes[0] - 12) bass -= 12;', ''],
  ["a slash bass is doubled below",           'if (bassPc !== null && bassPc !== rootPc && pc(notes[0]) === bassPc', 'if (false && bassPc !== null && bassPc !== rootPc && pc(notes[0]) === bassPc'],
  ["the default reach is a tenth",            'const DEFAULT_REACH = 12;', 'const DEFAULT_REACH = 16;'],
  ["F major is fingered like C",              '5: { R: [1,2,3,4,1,2,3,4]', '5: { R: [1,2,3,1,2,3,4,5]'],
  ["a black-key scale puts the thumb on black", '10: { R: [4,1,2,3,1,2,3,4]', '10: { R: [1,2,3,1,2,3,4,5]'],
  ["crossings are never found",               'const against = rising ? fingers[i] < fingers[i - 1] : fingers[i] > fingers[i - 1];', 'const against = false;'],
  ["a crossing is always the thumb",          'label: fingers[i] === 1 ? "thumb under" : `${fingers[i]} crosses over`', 'label: "thumb under"'],
  ["a scale run downwards keeps its upward fingers", 'const fingers = down ? [...ascending].reverse() : ascending;', 'const fingers = ascending;'],
  ["a run with no table is guessed",          'if (!fitsHand(sorted, reach)) return null;   // a long run', 'if (false) return null;   // a long run'],
  ["the lesson numbers keys it hasn't lit",   'attempt.forEach((m, i) => { const k = fingering.keys[i]; if (k && pc(k.midi) === pc(m)) out.set(m, k); });', 'fingering.keys.forEach((k) => out.set(k.midi, k));'],
  ["Learn starts with fingers off",           '(choice, tab) => choice ?? (tab === "learn" ? "right" : "off");', '(choice, tab) => choice ?? "off";'],
  ["fingering claims to be checked",          'suggested: "Suggested fingering",', 'suggested: "Fingering",'],
  ["the sheet ignores the tick",              'fingers: fingering ? fingerChord(c.notes, { hand: "right", reach }).keys : [],', 'fingers: [],'],
  ["the sheet bass loses its finger",         'finger: fingering && (bassFigure?.[i]?.length ?? 1) === 1 ? 5 : null,', 'finger: null,'],
  ["the guide forgets the fingers",           '"Fingers puts a suggested finger on each lit key, 1 the thumb to 5 the little finger:', '"Fingers puts a number on each lit key:'],
];

/* Mutants of files other than the theory layer: [name, find, replace, file]. */
const OTHER_MUTANTS = [
  // D-076: the installable site
  ["the manifest opens in a browser tab",   'display: "standalone",', 'display: "browser",'],
  ["the site forgets its iOS icon",         '`<link rel="apple-touch-icon" href="${iconName(180)}">`,', ''],
  ["the page never registers for offline",  'return withHead.slice(0, j) + REGISTER + withHead.slice(j);', 'return withHead;'],
  ["the service worker skips a file",       'const files = ["./", ...fileNames.map((f) => "./" + f)];', 'const files = ["./", ...fileNames.slice(1).map((f) => "./" + f)];'],
  ["a new upload keeps the old version",    'h.update(files[name]);', ''],
  ["renaming a file keeps the version",     'h.update(name); h.update("\\0");', ''],
  ["installing trusts the HTTP cache",      '{ cache: "reload" }', '{ cache: "default" }'],
  ["old versions are never deleted",        '.filter((k) => k.startsWith(${JSON.stringify(CACHE_PREFIX)}) && k !== VERSION)', '.filter((k) => false)'],
  ["updates delete other sites' caches",    '.filter((k) => k.startsWith(${JSON.stringify(CACHE_PREFIX)}) && k !== VERSION)', '.filter((k) => k !== VERSION)'],
  ["offline requests go to the network",    '.then((hit) => hit || fetch(event.request)));', '.then(() => fetch(event.request)));'],
].map(([name, from, to]) => [name, from, to, "tools/package-site.mjs"]);

const ALL = [...MUTANTS.map((m) => [...m, "tests/theory.mjs"]), ...OTHER_MUTANTS];
let killed = 0, survived = [];

for (const [name, from, to, file] of ALL) {
  const orig = readFileSync(file, "utf8");
  if (!orig.includes(from)) { console.log(`SKIP   ${name} — pattern not found, mutant is stale`); continue; }
  copyFileSync(file, file + ".orig");
  writeFileSync(file, orig.replace(from, to));
  let caught = false, failing = "";
  try {
    execSync("node --test tests/*.test.mjs 2>&1", { encoding: "utf8" });
  } catch (e) {
    caught = true;
    failing = (e.stdout.match(/^# fail (\d+)/m) || [, "?"])[1];
  } finally {
    copyFileSync(file + ".orig", file);
    unlinkSync(file + ".orig");
  }
  if (caught) { killed++; console.log(`killed ${name}  (${failing} tests failed)`); }
  else { survived.push(name); console.log(`SURVIVED  ${name}`); }
}

console.log(`\n${killed}/${ALL.length} mutants killed`);
if (survived.length) { console.log("\nSurvivors — bugs the suite would not notice:"); survived.forEach((s) => console.log("  ·", s)); }
