/* core/instruments — Instrument presets as data (piano, Rhodes, felt keys, pad, marimba), delay and reverb settings, and the keyboard's range and sample coverage.
   Layer 1. Depends on: core/piano-samples, core/instrument-samples. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: core/MODULES.md (instruments).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */

import { PIANO_SAMPLES } from "./piano-samples.mjs";
import { STRINGS_SAMPLES, VIBES_SAMPLES, SAMPLE_CREDITS } from "./instrument-samples.mjs";




/* ============================================================================
   BUILT-IN PIANO — the recordings travel with the app. (D-069)

   Fetching samples from another site failed wherever that site is not on the
   page's allow-list, which is silence for a first-time user. Thirteen notes are
   embedded instead, every six semitones from C1 to C7: mono, 22 kHz, 2.7
   seconds, about 11 kB each. Tone fills in the gaps between them.

   There were seven, C2 to C5, and the keyboard played two octaves above the
   highest one. Those notes were the C5 recording at four times speed, which is
   thin and plinky rather than a piano. (D-071)

   Salamander Grand Piano V3 by Alexander Holm, used under CC-BY 3.0. The
   recordings were shortened, mixed to mono, resampled and re-encoded to embed
   them; CC-BY asks that such changes be declared, so the credit says so.
   ========================================================================== */

const PIANO_CREDIT =
  "Salamander Grand Piano by Alexander Holm, CC-BY 3.0 " +
  "(creativecommons.org/licenses/by/3.0) \u2014 shortened and re-encoded";

/* How far a note has to be pitch-shifted to be played at all. The recordings
   are anchors; everything else is one of them sped up or slowed down. Two
   numbers decide whether that still sounds like a piano: the gap between
   anchors, and whether the keyboard ever asks for a note outside them.

   The second one is the part that went wrong. The old test measured gaps
   between the samples and never compared the span to the range the keyboard
   actually plays, so a two-octave stretch at the top passed unnoticed. Both are
   arithmetic, so both are now checked against PIANO_RANGE. (D-071, R-230) */

const PIANO_RANGE = { lowest: 24, highest: 96 };
const KEYBOARD_OCTAVES = 4;
const HIGHEST_START_MIDI = PIANO_RANGE.highest - KEYBOARD_OCTAVES * 12;

const SAMPLE_STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function sampleMidi(name) {
  const m = /^([A-G])(#?)(-?\d+)$/.exec(String(name));
  if (!m) return NaN;
  return SAMPLE_STEPS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
}

function sampleAnchors(samples = PIANO_SAMPLES) {
  return Object.keys(samples).map(sampleMidi).sort((a, b) => a - b);
}

/* Semitones between this note and the nearest recording. Zero means the note
   has its own. */
function stretchAt(midi, anchors = sampleAnchors()) {
  let worst = Infinity;
  for (const a of anchors) worst = Math.min(worst, Math.abs(midi - a));
  return worst;
}

/* The worst stretch anywhere the keyboard can reach. */
function worstStretch(anchors = sampleAnchors(),
                      lo = PIANO_RANGE.lowest, hi = PIANO_RANGE.highest) {
  let worst = 0;
  for (let m = lo; m <= hi; m++) worst = Math.max(worst, stretchAt(m, anchors));
  return worst;
}

/* ============================================================================
   INSTRUMENTS, DELAY, VOICINGS — data and arithmetic. (D-040, D-041, D-042)
   ========================================================================== */

/* Each preset is data: the audio layer builds from it and holds no opinions.
   `release` feeds the voice budget, so a long tail is accounted for rather
   than cut off or leaked. (D-038, D-040) */
const INSTRUMENTS = [
  /* Recorded piano. Everything else here is synthesis, and synthesis is why
     the app sounded like a toy. (D-062) */
  /* Kept, but no longer the default: the recordings are fetched from another
     site and some environments block that outright, which is silence where a
     first-time user expects a piano. (D-067) */
  { id: "grand", name: "Grand piano", kind: "sampler",
    note: "Real recordings, built into the app. No download, works offline.",
    volume: -6, release: 1.2, delay: false, fallback: "felt",
    samples: { baseUrl: "", urls: PIANO_SAMPLES },
    credit: PIANO_CREDIT,
    options: { release: 1.2 } },

  /* A Rhodes is a struck tine: the bell is the attack only, and the body that
     follows is nearly a sine. The first attempt kept the bell ringing for the
     whole note, which is exactly why it sounded like a marimba. (D-062)
     A slow tremolo is what makes it a Rhodes and not a plain electric tone. (D-107) */
  { id: "rhodes", name: "Rhodes", kind: "fm",
    note: "Struck tine with a bell in the attack and a slow shimmer. Soul and R&B.",
    volume: -1, release: 1.1, delay: true,
    chain: [{ type: "tremolo", frequency: 4.6, depth: 0.4 }],
    options: {
      harmonicity: 2.01, modulationIndex: 11,
      oscillator: { type: "sine" },
      envelope: { attack: 0.003, decay: 14, sustain: 0.1, release: 1.1 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
    } },

  /* Felt keys: a piano with a strip of felt over the strings. Dark, round, and gone
     quickly; nothing like a Rhodes's ring. (D-107) */
  { id: "felt", name: "Felt keys", kind: "synth",
    note: "Soft and close, with the hammers muted. Dark, round, quick to fade.",
    volume: -14, release: 0.6, delay: false,
    chain: [{ type: "filter", frequency: 380, q: 0.7 }],
    options: {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.06, decay: 0.9, sustain: 0.04, release: 0.6 },
    } },

  /* A pad is wide and slow. The first one was a sine through a square: thin. Three
     detuned saws through a filter and a chorus is what a pad is. (D-107) */
  { id: "pad", name: "Warm pad", kind: "synth",
    note: "Wide and slow: three detuned voices, filtered and softened. Chords over anything.",
    volume: -12, release: 1.8, delay: true,
    chain: [{ type: "filter", frequency: 1500, q: 0.8 }, { type: "chorus", frequency: 1.3, delayTime: 3.5, depth: 0.7 }],
    options: {
      oscillator: { type: "fatsawtooth", count: 3, spread: 28 },
      envelope: { attack: 0.55, decay: 0.5, sustain: 0.75, release: 1.8 },
    } },

  { id: "pluck", name: "Marimba", kind: "fm",
    note: "Short and wooden. Cuts through a busy beat.",
    volume: -5, release: 0.3, delay: false,
    options: {
      harmonicity: 3.5, modulationIndex: 9,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.3 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    } },

  /* Two more recorded instruments, both CC0, for the sounds a synth does not give: a
     string section that swells in, and a vibraphone. They are held to the same rule as
     the piano: embedded, offline, with a synth standing in until they are decoded. (D-109) */
  { id: "strings", name: "Strings", kind: "sampler",
    note: "A real string section, bowed. Swells in and sings under chords.",
    volume: -5, release: 1.6, delay: true, fallback: "pad",
    samples: { baseUrl: "", urls: STRINGS_SAMPLES },
    credit: SAMPLE_CREDITS.strings,
    options: { attack: 0.35, release: 1.6 } },

  { id: "vibes", name: "Vibraphone", kind: "sampler",
    note: "Soft mallets on metal bars. Round, ringing and a little dreamy.",
    volume: -5, release: 1.2, delay: true, fallback: "pluck",
    samples: { baseUrl: "", urls: VIBES_SAMPLES },
    credit: SAMPLE_CREDITS.vibes,
    options: { release: 1.2 } },
];

const instrumentById = (id) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

/* Echo has three settings. Light is the default: a quick, quiet repeat or two that is gone
   almost at once, which gives a sound some air without anyone hearing a delay. Long is the
   old echo, wider on the pad. (D-041, D-061, D-107) */
const ECHO_LEVELS = [
  { id: "off",   name: "Off",   note: "No repeat." },
  { id: "light", name: "Light", note: "A quick, quiet repeat that is gone almost at once." },
  { id: "long",  name: "Long",  note: "A slower echo that rings on for a few repeats." },
];

function delaySettings(instrumentId, level) {
  if (level === "off" || !level) return { wet: 0, feedback: 0, time: 0.25 };
  if (level === "light") return { wet: 0.2, feedback: 0.16, time: 0.17 };
  const inst = instrumentById(instrumentId);
  return inst.id === "pad"
    ? { wet: 0.30, feedback: 0.40, time: 0.42 }
    : { wet: 0.22, feedback: 0.30, time: 0.28 };
}

const SPACES = [
  { id: "dry",   name: "Dry",   decay: 0.3, wet: 0,    note: "No room at all. Every note stops where it stops." },
  { id: "room",  name: "Room",  decay: 1.1, wet: 0.20, note: "A small space. Takes the hard edge off without blurring anything." },
  { id: "hall",  name: "Hall",  decay: 3.2, wet: 0.34, note: "Wide and slow. Chords bloom into each other." },
  { id: "cave",  name: "Cave",  decay: 6.5, wet: 0.44, note: "Enormous. One chord is an arrangement." },
];

function reverbSettings(spaceId) {
  const s = SPACES.find((x) => x.id === spaceId) ?? SPACES[0];
  return { decay: s.decay, wet: s.wet };
}



/* Turning an embedded data URI back into bytes. Pure, and the only part of
   decoding that can be checked without an audio device. (D-070) */
function base64Payload(uri) {
  const i = String(uri).indexOf(",");
  return i < 0 ? "" : String(uri).slice(i + 1);
}

function payloadBytes(uri) {
  const b64 = base64Payload(uri);
  if (!b64) return 0;
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
}

/* The recording's bytes, ready to hand to the audio decoder. Done here, by hand,
   so it needs no browser function and can be checked against a known decoder.
   Decoding the audio itself stays with the app. (D-070, D-100) */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function payloadToBytes(uri) {
  const b64 = base64Payload(uri).replace(/=+$/, "");
  const out = new Uint8Array(payloadBytes(uri));
  let bits = 0, acc = 0, n = 0;
  for (const ch of b64) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (acc >> bits) & 0xff; }
  }
  return out;
}

export { ECHO_LEVELS, payloadToBytes, PIANO_RANGE, KEYBOARD_OCTAVES, HIGHEST_START_MIDI, sampleMidi, sampleAnchors, stretchAt, worstStretch, INSTRUMENTS, instrumentById, delaySettings, SPACES, reverbSettings, base64Payload, payloadBytes };
