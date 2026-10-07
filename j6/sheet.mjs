/* The J-6 progression as a sheet to take to a piano. (D-091)

   Sketchpad's own sheet (D-057), reused: sheetData lays it out and
   sheetAsText writes it as text, with chord diagrams, the scale, a bass note
   per chord and, when ticked, suggested fingering (D-078). The J-6 adds two
   things: each chord is the J-6's voicing, as it sounds; and a list of where
   to find each chord on the J-6, so the sheet works at either instrument. */
import { spelling } from "../core/notes.mjs";
import { sheetData, sheetAsText } from "../core/sheet.mjs";
import { KEYS, romanOf, nameInKey, likelyKeys } from "./j6.mjs";
import { resolve } from "./progression.mjs";

const signed = (t) => (t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0");
const KEY_NAMES = KEYS.map((k) => k.replace("#", "♯"));

/** items: the kept progression; scale: { tonic, id } or null for the key's major scale. */
export function j6Sheet(items, { bpm = 90, bars = 1, scale = null, fingering = false } = {}) {
  const played = items.map((k) => ({ k, c: resolve(k) })).filter((x) => x.c.chord);
  const [key] = likelyKeys(played.map((x) => x.c.chord));
  const tonic = key ? key.tonic : 0;
  const system = spelling("letters", tonic);
  const progression = played.map(({ c }) => ({
    rootPc: c.chord.root, sym: c.chord.quality, notes: c.midi, roman: key ? romanOf(c.chord, tonic) : "",
  }));
  const s = sheetData({ tonic: scale ? scale.tonic : tonic, mode: "major", scaleId: scale ? scale.id : "major",
    customScale: null, progression, bpm, system, fingering });
  return {
    ...s,
    title: key ? `${system.names[tonic]} major` : "Progression",
    meta: [`${bpm} bpm`, `each chord ${bars === 0.5 ? "½ bar" : bars === 1 ? "1 bar" : "2 bars"}`, s.meta[1], `${progression.length} chord${progression.length === 1 ? "" : "s"}`],
    // the J-6's names, with any slash bass, rather than the bare chord symbol
    chords: s.chords.map((c, i) => ({ ...c, label: nameInKey(played[i].c.chord, tonic) })),
    j6: played.map(({ k }, i) => ({ bar: i + 1, where: `set ${k.set} · KEY ${signed(k.t)} · key ${KEY_NAMES[k.key]}` })),
  };
}

/** The sheet as text: Sketchpad's text, then where each chord is on the J-6. */
export const j6SheetText = (sheet) =>
  `${sheetAsText(sheet)}\n\nOn the J-6:\n${sheet.j6.map((x) => `${x.bar}. ${x.where}`).join("\n")}`;
