/* core/bass — Bass under a chord: the ranked options (root, fifth, third, passing) and the transitions from one chord's bass to the next.
   Layer 2. Depends on: core/figures, core/notes. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (bass).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { place } from "./figures.mjs";
import { pc } from "./notes.mjs";


/* What can the bass play under this chord, and how safe is each choice? */
const BASS_ROLES = {
  root:    { label: "Strongest", why: "The chord root — always safe" },
  fifth:   { label: "Stable",    why: "The fifth — solid but less obvious" },
  third:   { label: "Colour",    why: "The third — brings out the chord's mood" },
  seventh: { label: "Colour",    why: "The seventh — richer, leans forward" },
  passing: { label: "Passing",   why: "Scale note — good between chords" },
};

function bassOptions(chord, scaleSet) {
  const iv = chord.notes.map((m) => pc(m - chord.notes[0]));
  const out = [{ pc: chord.rootPc, role: "root", ...BASS_ROLES.root }];
  const add = (interval, role) => {
    if (interval === null) return;
    out.push({ pc: pc(chord.rootPc + interval), role, ...BASS_ROLES[role] });
  };
  add(iv.includes(7) ? 7 : iv.includes(6) ? 6 : iv.includes(8) ? 8 : null, "fifth");
  add(iv.includes(3) ? 3 : iv.includes(4) ? 4 : null, "third");
  add(iv.includes(10) ? 10 : iv.includes(11) ? 11 : null, "seventh");
  const taken = out.map((o) => o.pc);
  for (const p of scaleSet) {
    if (!taken.includes(p)) out.push({ pc: p, role: "passing", ...BASS_ROLES.passing });
  }
  return out;
}

const BASS_PARAGRAPH =
  "Your scale is the general set of notes you can use. The chord playing right now decides which of those sound strongest. " +
  "The root is safest, the fifth is stable, the third carries the mood, and anything else works best as a quick passing note that lands on a chord tone.";

/* Ways of getting from one chord to the next, in the bass. (UC-20) */
function bassTransitions(from, to, scaleSet) {
  const a = 36 + from.rootPc;
  const b = place(to.rootPc, a);
  const out = [];

  out.push({ name: "Direct", notes: [a, b],
             why: "Just land on it. Always works, never surprises anyone." });

  const sorted = [...scaleSet].sort((x, y) => x - y);
  const walk = [a];
  let cur = a;
  const up = b > a;
  let guard = 0;
  while (cur !== b && guard++ < 12) {
    let next = cur;
    for (let k = 1; k <= 12; k++) {
      const t = cur + (up ? k : -k);
      if (sorted.includes(pc(t))) { next = t; break; }
    }
    if (next === cur) break;
    cur = next;
    walk.push(cur);
    if ((up && cur >= b) || (!up && cur <= b)) break;
  }
  if (walk.length > 2) {
    out.push({ name: "Scale walk", notes: walk[walk.length - 1] === b ? walk : [...walk, b],
               why: "Step through the scale. Sounds inevitable rather than surprising." });
  }

  out.push({ name: "Fifth approach", notes: [a, place(pc(to.rootPc + 7), a), b],
             why: "Drop to the fifth of the next chord first. The strongest pull in music." });

  out.push({ name: "Chromatic", notes: [a, b - 1, b],
             why: "Slide in from a semitone below. Leaves the key for one beat, which is the point." });

  return out;
}

export { bassOptions, BASS_PARAGRAPH, bassTransitions };
