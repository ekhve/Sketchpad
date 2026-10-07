/* core/sheet — A progression laid out as a sheet to take to an instrument: chord diagrams, the scale, the bass and optional fingering, and the same as plain text.
   Layer 3. Depends on: core/chords, core/figures, core/fingering, core/notes, core/scales. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (sheet).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { chordLabel } from "./chords.mjs";
import { place } from "./figures.mjs";
import { DEFAULT_REACH, fingerChord } from "./fingering.mjs";
import { WHITE_PCS, pc, noteName } from "./notes.mjs";
import { scaleById, activeScalePcs } from "./scales.mjs";



/* ============================================================================
   THE SHEET — a sketch you can take to an instrument, with no device.
   (D-057, UC-53)

   Nothing on paper can be tapped, so a chord name is not enough: the sheet
   carries the voicing as a small keyboard diagram. What goes on it is a pure
   function of the loop, so the layout can be checked without rendering it.
   ========================================================================== */

/* Key positions for a small diagram, in units of 0..1 across the width, so the
   caller picks the size. Shares its layout rules with the real keyboard. */
function diagramKeys(startMidi, octaves, lit = []) {
  const midis = Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i);
  const whites = midis.filter((m) => WHITE_PCS.includes(pc(m)));
  const w = 1 / whites.length;
  const on = (m) => lit.includes(m);
  return {
    whites: whites.map((m, i) => ({ midi: m, x: i * w, w, on: on(m) })),
    blacks: midis.filter((m) => !WHITE_PCS.includes(pc(m))).map((m) => {
      const before = whites.filter((x) => x < m).length;
      return { midi: m, x: before * w - w * 0.31, w: w * 0.62, on: on(m) };
    }),
  };
}

/* The window of the keyboard worth drawing: enough to hold every note, snapped
   to whole octaves so the diagrams all line up with each other. */
function diagramRange(allNotes, minOctaves = 2) {
  if (!allNotes.length) return { startMidi: 48, octaves: minOctaves };
  const lo = Math.min(...allNotes), hi = Math.max(...allNotes);
  const startMidi = Math.floor(lo / 12) * 12;
  const octaves = Math.max(minOctaves, Math.ceil((hi - startMidi + 1) / 12));
  return { startMidi, octaves };
}

function sheetData({ tonic, mode, scaleId, customScale, progression = [],
                     bpm = 88, bassFigure = null, system = "letters",
                     fingering = false, reach = DEFAULT_REACH }) {
  const scaleNotes = activeScalePcs(customScale, tonic, scaleId);
  const scaleName = customScale ? customScale.name : `${noteName(tonic, system)} ${scaleById(scaleId).name}`;
  const allNotes = progression.flatMap((c) => c.notes);
  const range = diagramRange(allNotes);

  /* the scale is drawn in one octave from the tonic, which is how anyone
     would write it out by hand */
  const scaleStart = 48 + tonic;
  const scalePitches = scaleNotes.map((p) => place(p, scaleStart + 5));

  return {
    title: `${noteName(tonic, system)} ${mode}`,
    meta: [`${bpm} bpm`, scaleName, `${progression.length} bar${progression.length === 1 ? "" : "s"}`],
    range,
    scale: { name: scaleName, notes: [...new Set(scalePitches)].sort((a, b) => a - b),
             names: scaleNotes.map((p) => noteName(p, system)),
             start: Math.floor(scaleStart / 12) * 12 },
    chords: progression.map((c, i) => ({
      bar: i + 1,
      label: chordLabel(c.rootPc, c.sym, system),
      notes: c.notes,
      names: c.notes.map((m) => noteName(m, system)),
      roman: c.roman || "",
      // D-078: right hand on the chord when asked for; a chord too wide is split
      fingers: fingering ? fingerChord(c.notes, { hand: "right", reach }).keys : [],
    })),
    bass: progression.map((c, i) => ({
      bar: i + 1,
      notes: bassFigure?.[i]?.map((n) => n.midi) ?? [c.notes[0] - 24],
      names: (bassFigure?.[i]?.map((n) => n.midi) ?? [c.notes[0] - 24]).map((m) => noteName(m, system)),
      // one bass note is the left hand's little finger; a bass riff's fingering is out of scope
      finger: fingering && (bassFigure?.[i]?.length ?? 1) === 1 ? 5 : null,
    })),
  };
}

/* The same sheet as text, for pasting somewhere that has no pictures. */
function sheetAsText(sheet) {
  const lines = [`${sheet.title}  ·  ${sheet.meta.join("  ·  ")}`, ""];
  lines.push(`Scale: ${sheet.scale.names.join(" ")}`, "");
  for (const c of sheet.chords) {
    const bass = sheet.bass.find((b) => b.bar === c.bar);
    const rh = c.fingers?.length ? `  fingers ${[...c.fingers].sort((a, b) => a.midi - b.midi).map((k) => (k.hand === "L" ? "L" : "") + k.finger).join("-")}` : "";
    lines.push(`${c.bar}. ${c.label.padEnd(10)} ${c.names.join(" ").padEnd(20)} bass: ${bass ? bass.names.join(" ") : ""}${bass?.finger ? ` (L${bass.finger})` : ""}${rh}`);
  }
  return lines.join("\n");
}

export { diagramKeys, diagramRange, sheetData, sheetAsText };
