/* Reading the chord labels printed in the J-6 manual's Chord Set List. (D-088)

   The manual spells about 550 labels in its own, inconsistent way: M7 and
   maj7 and Maj7, "/9" and "/b13" meaning an added note rather than a bass,
   sus9/13, (no3), 7alt, "D# dim7" with a space. Sketchpad's chord-name reader
   (D-077) refuses anything outside its dictionary, which is right for typing
   but would refuse most of the manual. This reader is the manual's
   vocabulary only: it turns a label into a root, a bass and the notes the
   label allows, so the voicing printed beside it can be checked against it.

   It never guesses. A label it cannot read is an error with a reason, and
   the set's validation reports it. */

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE = /^([A-G])(#|♯|b|♭)?/;
const pc = (n) => ((n % 12) + 12) % 12;

function readNote(text) {
  const m = NOTE.exec(text);
  if (!m) return null;
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  return { pc: pc(LETTER[m[1]] + acc), rest: text.slice(m[0].length) };
}

/* degree → semitones above the root */
const EXT = { 2: 2, 4: 5, 6: 9, 9: 2, 11: 5, 13: 9 };
const ALTERED = { "b5": 6, "#5": 8, "b6": 8, "b9": 1, "#9": 3, "#11": 6, "b13": 8, "#4": 6, "b2": 1 };

/** "CM9/#11" → { ok, root, bass, iv: [intervals above the root], name }, or { ok: false, reason }. */
export function readLabel(label) {
  const raw = label;
  const text = label.replace(/\s+/g, "").replace(/♯/g, "#").replace(/♭/g, "b");
  const root = readNote(text);
  if (!root) return { ok: false, label: raw, reason: `"${raw}" doesn't start with a note name` };

  let s = root.rest, bass = root.pc;
  /* A trailing "/X" is a bass when X is a note name and nothing follows it;
     "/9", "/11", "/#11", "/b13" are added notes, the manual's shorthand. */
  const slash = s.lastIndexOf("/");
  if (slash >= 0) {
    const b = readNote(s.slice(slash + 1));
    if (b && b.rest === "" && !/^b\d/.test(s.slice(slash + 1))) { bass = b.pc; s = s.slice(0, slash); }
  }
  s = s.replace(/\/(?=[#b]?\d)/g, "(");         // the remaining slashes join extensions

  let third = 4, fifth = 7, seventh = null, majorSeventh = false;
  let noThird = false, noFifth = false, sus = null, sixth = false;
  const add = new Set();
  let i = 0;
  const take = (re) => {
    const m = re.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return m;
  };
  const number = (n, explicitAdd) => {
    if (n === 7) { seventh = majorSeventh ? 11 : 10; return true; }
    if (!(n in EXT)) return false;
    if (n === 6 && !explicitAdd && seventh === null) { add.add(9); sixth = true; return true; }
    if (n === 9 && sixth && seventh === null) { add.add(2); return true; }   // 6/9 has no seventh
    if (explicitAdd || n === 2 || n === 4 || n === 6) { add.add(EXT[n]); return true; }
    if (seventh === null) seventh = majorSeventh === true ? 11 : 10;   // 9, 11 and 13 carry the seventh
    add.add(2);
    if (n >= 11) add.add(5);
    if (n === 13) add.add(9);
    return true;
  };

  /* the triad, once, at the start */
  if (take(/^\(?no3\)?/)) noThird = true;
  if (take(/^(dim|Dim|°)M(aj)?7/)) { third = 3; fifth = 6; seventh = 11; }
  else if (take(/^(dim|Dim|°)7/)) { third = 3; fifth = 6; seventh = 9; }
  else if (take(/^(dim|Dim|°)/)) { third = 3; fifth = 6; }
  else if (take(/^(aug|\+)/)) { fifth = 8; }
  else if (take(/^(mM|mMaj|mmaj|minMaj)(?=\d)/)) { third = 3; majorSeventh = true; }
  else if (take(/^(min|m|-)(?!aj)/)) { third = 3; }
  else if (take(/^5(?![0-9])/)) { noThird = true; }
  if (take(/^(maj|Maj|M|Δ)(?=[\d(]|add|b|#|$|sus)/)) majorSeventh = true;

  while (i < s.length) {
    let m;
    if (take(/^[()]/)) continue;
    if (take(/^no3/)) { noThird = true; continue; }
    if (take(/^no5/)) { noFifth = true; continue; }
    if (take(/^alt/)) { seventh = 10; for (const x of [1, 3, 6, 8]) add.add(x); continue; }
    if ((m = take(/^sus(2|4)?/))) {
      sus = m[1] === "2" ? 2 : 5;
      /* "sus9", "sus13", "sus7": a suspended chord carrying that number (9sus4, 13sus4) */
      const n = take(/^(\d+)/);
      if (n && !number(Number(n[1]), false)) return fail(raw, n[1]);
      continue;
    }
    if ((m = take(/^[Aa]dd([#b]?)(\d+)/))) {
      const key = m[1] + m[2];
      if (m[1]) { if (!(key in ALTERED)) return fail(raw, key); add.add(ALTERED[key]); }
      else if (!number(Number(m[2]), true)) return fail(raw, m[2]);
      continue;
    }
    if ((m = take(/^(b|#)(\d+)/))) {
      const key = m[1] + m[2];
      if (key === "b7") { seventh = 10; continue; }
      if (key === "b5") { fifth = 6; continue; }
      if (key === "#5") { fifth = 8; continue; }
      if (!(key in ALTERED)) return fail(raw, key);
      add.add(ALTERED[key]);
      continue;
    }
    if ((m = take(/^(maj|Maj|M)(?=\d)/))) { majorSeventh = true; continue; }
    if ((m = take(/^(\d+)/))) {
      const n = Number(m[1]);
      if (seventh !== null || (n === 6 && add.has(9))) { if (!(n in EXT)) return fail(raw, m[1]); add.add(EXT[n]); continue; }
      if (!number(n, false)) return fail(raw, m[1]);
      continue;
    }
    return fail(raw, s.slice(i));
  }

  const iv = new Set([0]);
  if (sus !== null) iv.add(sus);
  else if (!noThird) iv.add(third);
  if (!noFifth) iv.add(fifth);
  if (seventh !== null) iv.add(seventh);
  for (const x of add) iv.add(x);
  return { ok: true, label: raw, root: root.pc, bass, iv: [...iv].sort((a, b) => a - b), name: tidy(text.slice(text.length - root.rest.length), bass !== root.pc) };
}

const fail = (label, part) => ({ ok: false, label, reason: `"${label}": can't read "${part}"` });

/* The manual's spelling, tidied for display: maj for M, ♯ and ♭, added notes
   in brackets rather than after a slash. The slash bass is shown separately. */
function tidy(suffix, hasBass) {
  let q = suffix.replace(/\s+/g, "");
  if (hasBass) q = q.slice(0, q.lastIndexOf("/"));
  q = q.replace(/\/([#b]?\d+)/g, "($1)")
    .replace(/^M(?=$|add|b|#|sus)/, "")
    .replace(/(^|[^a-z])M(?=\d)/g, "$1maj").replace(/Maj/g, "maj").replace(/Dim/g, "dim")
    .replace(/b(?=\d)/g, "♭").replace(/#/g, "♯");
  return q;
}
