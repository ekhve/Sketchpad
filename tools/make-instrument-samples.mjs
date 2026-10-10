/* Builds core/instrument-samples.mjs from the CC0 sources, so the embedded recordings can be redone.
   Needs ffmpeg and local clones of the two libraries (paths below, or the two arguments):
     node tools/make-instrument-samples.mjs [VSCO-2-CE dir] [VCSL dir]
   VSCO-2 CE (Strings/Cello Section, Strings/Viola Section, susvib) and VCSL (Vibraphone, Soft Mallets) are CC0 1.0.
   Their file names count the octave one higher than scientific naming (their C3 is middle C, MIDI 60); the pitches
   were checked against the spectrum, so the names below are converted with midi = 12 * (octave + 2) + step. (D-109) */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const VSCO = process.argv[2] ?? "/tmp/smp/VSCO-2-CE";
const VCSL = process.argv[3] ?? "/tmp/smp/VCSL";
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiOf = (n) => 12 * (Number(n.slice(1)) + 2) + STEPS[n[0]];
const sci = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

const STRINGS = [
  ...["G1", "D2", "A2"].map((n) => [n, `${VSCO}/Strings/Cello Section/susvib/susvib_${n}_v1_1.wav`]),
  ...["D3", "A3", "E4", "B4"].map((n) => [n, `${VSCO}/Strings/Viola Section/susvib/ViolaEns_susvib_${n}_v1_1.wav`]),
];
const VIBES = ["F2", "C3", "G3", "D4", "A4", "E5"].map((n) =>
  [n, `${VCSL}/Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/Vibes_soft_${n}_v2_rr1_Main.wav`]);

function encode(file, seconds, fade) {
  const out = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-t", String(seconds), "-ac", "1", "-ar", "22050",
    "-af", `loudnorm=I=-20:TP=-3:LRA=7,afade=t=out:st=${seconds - fade}:d=${fade}`,
    "-c:a", "libmp3lame", "-b:a", "40k", "-f", "mp3", "-"], { maxBuffer: 1 << 26 });
  return "data:audio/mpeg;base64," + out.toString("base64");
}
const table = (list, seconds, fade) =>
  Object.fromEntries(list.map(([n, f]) => [sci(midiOf(n)), encode(f, seconds, fade)]).sort((a, b) => a[0].localeCompare(b[0])));
const lit = (o) => "{\n" + Object.entries(o).map(([k, v]) => `  "${k}": "${v}",`).join("\n") + "\n}";

writeFileSync(new URL("../core/instrument-samples.mjs", import.meta.url),
`/* core/instrument-samples — String ensemble and vibraphone recordings, embedded as data so the app works with no network.
   Layer 0. Depends on: nothing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (instrument-samples).
   Made by tools/make-instrument-samples.mjs; do not edit by hand. (D-109) */

/* VSCO 2 Community Edition (Cello Section and Viola Section, sustained vibrato) and the Versilian Community
   Sample Library (vibraphone, soft mallets), both CC0 1.0: public domain, no credit required. Shortened, mixed
   to mono, levelled and re-encoded to embed them. */
const STRINGS_SAMPLES = ${lit(table(STRINGS, 4.2, 1.4))};

const VIBES_SAMPLES = ${lit(table(VIBES, 3.4, 1.6))};

const SAMPLE_CREDITS = {
  strings: "String section from VSCO 2 Community Edition (Versilian Studios), CC0 \\u2014 shortened and re-encoded",
  vibes: "Vibraphone from the Versilian Community Sample Library, CC0 \\u2014 shortened and re-encoded",
};

export { STRINGS_SAMPLES, VIBES_SAMPLES, SAMPLE_CREDITS };
`);
