// J-6 Explorer — prototype engine.
// Pure functions only. Data transcribed from the Roland J-6 Chord Set List (manual v1.02):
// https://static.roland.com/manuals/J-6_manual_v102/eng/28645807.html
// Only the sets the prototype screens use are transcribed here (29, 47, 54) plus set 59,
// kept because its published voicings do not match its labels (see PROTOTYPE.md, D-J04).

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Each key: [manual label, voicing high→low exactly as printed]
export const SETS = {
  29: { genre: "Pop", keys: [
    ["C", "E4 C4 C3 C2"], ["FM7", "E4 C4 F2 F1"], ["G", "D4 B3 G2 G1"], ["Em7", "D4 G3 B2 E2"],
    ["Dm7", "C4 F3 A2 D2"], ["CM7/E", "C4 G3 B2 E2"], ["F", "C4 A3 C3 F2"], ["D7/G", "D4 A3 C3 G2"],
    ["G", "D4 B3 D3 G2"], ["Am", "E4 C4 E3 A2"], ["Dm", "F4 A3 A2 D2"], ["G7", "G4 B3 F3 G2"]] },
  47: { genre: "Synthwave/House", keys: [
    ["Cm7", "A#3 G3 D#3 C3"], ["D#M7", "D4 A#3 G3 D#3"], ["Dm7", "C4 A3 F3 D3"], ["Fm7", "D#4 C4 G#3 F3"],
    ["D#M7", "D4 A#3 G3 D#3"], ["Gm7", "F4 D4 A#3 G3"], ["Fm7", "D#4 C4 G#3 F3"], ["G#M7", "G4 D#4 C4 G#3"],
    ["Gm7", "F4 D4 A#3 G3"], ["A#7", "G#4 F4 D4 A#3"], ["G#M7", "G4 D#4 C4 G#3"], ["C#/C", "G#4 F4 C#4 C4"]] },
  54: { genre: "House", keys: [
    ["CM7", "B3 G3 E3 C3"], ["Em7", "D4 B3 G3 E3"], ["Dm7", "C4 A3 F3 D3"], ["FM7", "E4 C4 A3 F3"],
    ["D#M7", "D4 A#3 G3 D#3"], ["Gm7", "F4 D4 A#3 G3"], ["FM7", "E4 C4 A3 F3"], ["Am7", "G4 E4 C4 A3"],
    ["Gm7", "F4 D4 A#3 G3"], ["A#M7", "A4 F4 D4 A#3"], ["Am7", "G4 E4 C4 A3"], ["Bm7", "A4 F#4 D4 B3"]] },
  59: { genre: "EDM", keys: [
    ["CM9", "B3 A3 D3 C3"], ["C6", "F#3 B3 E3 D#3"], ["Dm9", "C#4 B3 E3 D3"], ["Dm6", "G#4 C#4 F#3 F3"],
    ["EM9", "D#4 C#4 F#3 E3"], ["FM9", "E4 D4 G3 F3"], ["F6", "B4 E4 A3 G#3"], ["GM9", "F#4 E4 A3 G3"],
    ["G6", "C#4 F#4 B3 A#3"], ["Am9", "G#5 F#4 B3 A3"], ["Am6", "D#5 G#4 C#4 C4"], ["Bm9", "A#5 G#4 C#4 B3"]] },
};

/* ---------- notes ---------- */
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { "": 0, "#": 1, "♯": 1, b: -1, "♭": -1 };

export function pcOf(name) {
  const m = /^([A-G])(#|♯|b|♭)?$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return (LETTER[m[1]] + ACC[m[2] ?? ""] + 12) % 12;
}

export function midiOf(note) {
  const m = /^([A-G](?:#|♯|b|♭)?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`not a pitch: ${note}`);
  return pcOf(m[1]) + 12 * (Number(m[2]) + 1);
}

/** Voicing as printed (high→low) → ascending MIDI numbers. */
export const voicing = (s) => s.split(/\s+/).map(midiOf).sort((a, b) => a - b);

/* ---------- chord symbols ---------- */
// canonical quality → intervals above the root
export const QUALITIES = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  maj9: [0, 4, 7, 11, 2], m9: [0, 3, 7, 10, 2], "6": [0, 4, 7, 9], m6: [0, 3, 7, 9],
};
const ALIAS = { M7: "maj7", M9: "maj9", Maj7: "maj7", "Δ7": "maj7", min: "m", "-": "m", min7: "m7", "-7": "m7" };

/** "Cmaj7", "CM7/E", "A#7", "B♭maj7" → { root, quality, bass } (pitch classes). */
export function parseChord(symbol) {
  const m = /^([A-G](?:#|♯|b|♭)?)([^/]*)(?:\/([A-G](?:#|♯|b|♭)?))?$/.exec(symbol.trim());
  if (!m) throw new Error(`cannot read chord: ${symbol}`);
  const quality = ALIAS[m[2]] ?? m[2];
  if (!(quality in QUALITIES)) throw new Error(`unknown quality "${m[2]}" in ${symbol}`);
  const root = pcOf(m[1]);
  const bass = m[3] ? pcOf(m[3]) : root;
  return { root, quality, bass };
}

export const pcsOf = ({ root, quality, bass }) =>
  new Set([...QUALITIES[quality].map((i) => (root + i) % 12), bass]);

const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** Display name (D-J01): musician spelling, flats for the black keys by default. */
export function nameOf({ root, quality, bass }, names = FLAT_NAMES) {
  return names[root] + quality + (bass !== root ? "/" + names[bass] : "");
}
export { FLAT_NAMES, SHARP_NAMES };

/* ---------- data validation (D-J04) ---------- */
/** A J-6 voicing is valid for its label if the label's root is sounded and every sounded
 *  pitch class belongs to the labelled chord. Missing tones are allowed: the J-6 has 4 voices. */
export function validateKey(label, notes) {
  const chord = parseChord(label);
  const want = pcsOf(chord);
  const midi = voicing(notes);
  const got = new Set(midi.map((n) => n % 12));
  const problems = [];
  if (!got.has(chord.root)) problems.push("root not sounded");
  const strays = [...got].filter((pc) => !want.has(pc));
  if (strays.length) problems.push(`notes outside the chord: ${strays.map((p) => SHARP_NAMES[p]).join(" ")}`);
  if (chord.bass !== chord.root && midi[0] % 12 !== chord.bass) problems.push("slash bass is not the lowest note");
  return problems;
}

export function validateSet(n) {
  return SETS[n].keys
    .map(([label, notes], i) => ({ key: KEYS[i], label, problems: validateKey(label, notes) }))
    .filter((r) => r.problems.length);
}

/* ---------- J-6 adapter ---------- */
/** Chord produced by key index k on set n at KEY transpose t. */
export function chordAt(n, k, t = 0) {
  const [label, notes] = SETS[n].keys[k];
  const c = parseChord(label);
  return {
    key: KEYS[k], label,
    chord: { root: (c.root + t + 12) % 12, quality: c.quality, bass: (c.bass + t + 12) % 12 },
    midi: voicing(notes).map((m) => m + t),
  };
}

/* ---------- analysis ---------- */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Major keys in which every chord is diatonic, best first (tie-break: first chord's root). */
export function likelyKeys(chords) {
  const fits = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const scale = new Set(MAJOR.map((i) => (tonic + i) % 12));
    const inKey = chords.filter((c) => [...pcsOf(c)].every((pc) => scale.has(pc))).length;
    fits.push({ tonic, inKey });
  }
  const first = chords[0]?.root;
  return fits.filter((f) => f.inKey > 0)
    .sort((a, b) => b.inKey - a.inKey || (b.tonic === first) - (a.tonic === first) || a.tonic - b.tonic);
}

export function romanOf(chord, tonic) {
  const degree = MAJOR.indexOf((chord.root - tonic + 12) % 12);
  if (degree < 0) return null;
  const minor = QUALITIES[chord.quality].includes(3);
  const base = minor ? NUMERALS[degree].toLowerCase() : NUMERALS[degree];
  const suffix = chord.quality.replace(/^m(?!aj)/, "");
  return base + suffix;
}

/* ---------- reverse search ---------- */
const third = (c) => (QUALITIES[c.quality].includes(4) ? 4 : QUALITIES[c.quality].includes(3) ? 3 : null);
const subset = (a, b) => [...a].every((x) => b.has(x));

/** Score one produced chord against one requested chord. */
export function matchScore(want, got, mode) {
  if (got.root !== want.root) return { score: 0, kind: "none" };
  if (got.quality === want.quality) {
    if (got.bass === want.bass) return { score: 1, kind: "exact" };
    return mode === "exact" ? { score: 0, kind: "none" } : { score: 0.9, kind: "inversion" };
  }
  if (mode === "exact") return { score: 0, kind: "none" };
  const a = new Set(QUALITIES[want.quality].map((i) => (want.root + i) % 12));
  const b = new Set(QUALITIES[got.quality].map((i) => (got.root + i) % 12));
  const shared = [...a].filter((x) => b.has(x)).length;
  if (third(want) === third(got) && shared >= 3 && (subset(a, b) || subset(b, a))) return { score: 0.6, kind: "close" };
  return { score: 0, kind: "none" };
}

/** Rank chord sets for a progression. TRANSPOSE_RANGE is an assumption until checked on the device. */
export const TRANSPOSE_RANGE = [-6, 5];
export function search(progression, { sets = Object.keys(SETS).map(Number), mode = "musical", transpose = true } = {}) {
  const wanted = progression.trim().split(/\s+/).map(parseChord);
  const [lo, hi] = transpose ? TRANSPOSE_RANGE : [0, 0];
  const results = [];
  for (const n of sets) {
    if (validateSet(n).length) continue; // never recommend a set whose data fails validation
    for (let t = lo; t <= hi; t++) {
      const rows = wanted.map((want) => {
        let best = { score: 0, kind: "none", keys: [] };
        for (let k = 0; k < 12; k++) {
          const at = chordAt(n, k, t);
          const m = matchScore(want, at.chord, mode);
          if (m.score > best.score) best = { ...m, keys: [at.key], got: at.chord };
          else if (m.score > 0 && m.score === best.score) best.keys.push(at.key);
        }
        return { want, ...best };
      });
      const score = rows.reduce((s, r) => s + r.score, 0) / rows.length;
      results.push({ set: n, genre: SETS[n].genre, transpose: t, score, rows });
    }
  }
  return results.sort((a, b) => b.score - a.score || Math.abs(a.transpose) - Math.abs(b.transpose) || a.set - b.set)
    .filter((r, i, all) => all.findIndex((x) => x.set === r.set) === i); // best transpose per set
}
