/* core/instruments + core/piano-samples — unit tests, one per requirement in core/REQUIREMENTS.md (CR-INSTRUMENTS-nn, CR-PIANOSAMPLES-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ECHO_LEVELS, payloadToBytes, PIANO_RANGE, KEYBOARD_OCTAVES, HIGHEST_START_MIDI, sampleMidi, sampleAnchors, stretchAt, worstStretch, INSTRUMENTS, instrumentById, delaySettings, SPACES, reverbSettings, base64Payload, payloadBytes } from "../instruments.mjs";
import { PIANO_SAMPLES } from "../piano-samples.mjs";

test("CR-PIANOSAMPLES-01 the built-in piano holds thirteen recordings, every six semitones from C1 to C7, each an embedded audio data URI", () => {
  const names = Object.keys(PIANO_SAMPLES);
  assert.equal(names.length, 13);
  assert.deepEqual(names.map(sampleMidi), [24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96]);
  for (const [n, uri] of Object.entries(PIANO_SAMPLES)) {
    assert.match(uri, /^data:audio\/mpeg;base64,[A-Za-z0-9+/]+=*$/, n);
    const bytes = payloadBytes(uri);
    assert.ok(bytes > 5000 && bytes < 40000, `${n}: ${bytes} bytes, about 11 kB`);
  }
});

test("CR-PIANOSAMPLES-02 the recordings add up to a size a single-file app can carry", () => {
  const total = Object.values(PIANO_SAMPLES).reduce((n, u) => n + u.length, 0);
  assert.ok(total < 400_000, `${total} characters`);
});

test("CR-INSTRUMENTS-01 sampleMidi reads a note name as a MIDI number, and anything else as not-a-number", () => {
  assert.equal(sampleMidi("C4"), 60); assert.equal(sampleMidi("A0"), 21); assert.equal(sampleMidi("F#1"), 30); assert.equal(sampleMidi("C-1"), 0); assert.equal(sampleMidi("G9"), 127);
  for (const bad of ["H4", "C", "4C", "", "c4", "Cb4", undefined, null]) assert.ok(Number.isNaN(sampleMidi(bad)), String(bad));
});

test("CR-INSTRUMENTS-02 the anchors are the recordings' notes in ascending order, from the samples given or the built-in piano", () => {
  assert.deepEqual(sampleAnchors(), [24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96]);
  assert.deepEqual(sampleAnchors({ C4: "x", C2: "y", E3: "z" }), [36, 52, 60]);
  assert.deepEqual(sampleAnchors({}), []);
});

test("CR-INSTRUMENTS-03 stretchAt is how far a note is from its nearest recording, and zero where it has its own", () => {
  const a = sampleAnchors();
  for (const m of a) assert.equal(stretchAt(m, a), 0);
  assert.equal(stretchAt(27, a), 3); assert.equal(stretchAt(28, a), 2); assert.equal(stretchAt(100, a), 4); assert.equal(stretchAt(0, a), 24);
  assert.equal(stretchAt(60, []), Infinity);
});

test("CR-INSTRUMENTS-04 the keyboard never asks the piano for a note farther than three semitones from a recording", () => {
  assert.deepEqual(PIANO_RANGE, { lowest: 24, highest: 96 });
  assert.equal(KEYBOARD_OCTAVES, 4); assert.equal(HIGHEST_START_MIDI, 48);
  assert.equal(worstStretch(), 3);
  assert.ok(worstStretch(sampleAnchors(), 24, 96) <= 3);
  assert.ok(worstStretch(sampleAnchors({ C1: 1, C5: 1 }), 24, 96) > 12, "recordings that stop short of the range are caught");
  assert.equal(worstStretch([60], 60, 60), 0);
});

test("CR-INSTRUMENTS-05 every instrument preset has what the audio layer needs to build it, and a sampler has a fallback that is itself a synth", () => {
  assert.equal(INSTRUMENTS.length, 5); assert.equal(new Set(INSTRUMENTS.map((i) => i.id)).size, 5);
  for (const i of INSTRUMENTS) {
    assert.ok(i.name && i.note && ["sampler", "fm", "am", "synth"].includes(i.kind), i.id);
    assert.ok(typeof i.volume === "number" && i.volume < 0 && i.release > 0 && typeof i.delay === "boolean", i.id);
    assert.ok(i.options, `${i.id} has options`);
    if (i.kind === "sampler") { assert.equal(i.samples.urls, PIANO_SAMPLES); assert.ok(i.credit.includes("CC-BY")); assert.ok(INSTRUMENTS.find((x) => x.id === i.fallback).kind !== "sampler"); }
  }
  assert.deepEqual(INSTRUMENTS.map((i) => i.id), ["grand", "rhodes", "felt", "pad", "pluck"]);
});

test("CR-INSTRUMENTS-11 an instrument's own effects are a short list of known kinds, each with the numbers it needs", () => {
  const need = { filter: ["frequency"], chorus: ["frequency", "delayTime", "depth"], tremolo: ["frequency", "depth"] };
  for (const i of INSTRUMENTS) for (const fx of i.chain ?? []) {
    assert.ok(need[fx.type], `${i.id}: ${fx.type}`);
    for (const k of need[fx.type]) assert.ok(typeof fx[k] === "number" && fx[k] > 0, `${i.id} ${fx.type}.${k}`);
    if (fx.type !== "filter") assert.ok(fx.depth > 0 && fx.depth <= 1, `${i.id}: depth ${fx.depth}`);
  }
  assert.ok(INSTRUMENTS.filter((i) => i.chain?.length).length >= 3, "the instruments are told apart by more than their envelopes");
  assert.deepEqual(INSTRUMENTS.find((i) => i.id === "pad").options.oscillator.type, "fatsawtooth", "a pad is wide: detuned voices, not a sine");
});

test("CR-INSTRUMENTS-06 instrumentById finds a preset, and falls back to the first for an id it does not know", () => {
  for (const i of INSTRUMENTS) assert.equal(instrumentById(i.id), i);
  assert.equal(instrumentById("nope"), INSTRUMENTS[0]); assert.equal(instrumentById(undefined), INSTRUMENTS[0]);
});

test("CR-INSTRUMENTS-07 echo has three levels, off, light and long; off is silent, light is quieter and quicker than long, and both stay inside safe bounds", () => {
  assert.deepEqual(ECHO_LEVELS.map((e) => e.id), ["off", "light", "long"]); assert.ok(ECHO_LEVELS.every((e) => e.name && e.note));
  for (const i of INSTRUMENTS) {
    assert.deepEqual(delaySettings(i.id, "off"), { wet: 0, feedback: 0, time: 0.25 }, `${i.id}: echo leaks when off`);
    const light = delaySettings(i.id, "light"), long = delaySettings(i.id, "long");
    for (const s of [light, long]) { assert.ok(s.wet > 0 && s.wet <= 0.5 && s.feedback > 0 && s.feedback < 0.7 && s.time > 0.05 && s.time < 1, `${i.id}: ${JSON.stringify(s)}`); }
    assert.ok(light.feedback < long.feedback && light.time < long.time && light.wet <= long.wet, `${i.id}: light fades faster than long`);
    assert.ok(light.feedback ** 3 < 0.01, "light is inaudible by the third repeat");
  }
  const pad = delaySettings("pad", "long"), other = delaySettings("rhodes", "long");
  assert.ok(pad.wet > other.wet && pad.time > other.time && pad.feedback > other.feedback, "a long echo is wider on the pad");
  assert.deepEqual(delaySettings("pad", "light"), delaySettings("rhodes", "light"), "light is the same everywhere");
  assert.deepEqual(delaySettings("nope", "long"), other, "an unknown instrument gets the ordinary settings");
  assert.deepEqual(delaySettings("pad", undefined), delaySettings("pad", "off"), "no level is off");
});

test("CR-INSTRUMENTS-08 the spaces run from dry to cave, each longer and wetter than the last, and reverb falls back to dry", () => {
  assert.deepEqual(SPACES.map((s) => s.id), ["dry", "room", "hall", "cave"]);
  SPACES.forEach((s, i) => { assert.ok(s.name && s.note); if (i) { assert.ok(s.decay > SPACES[i - 1].decay && s.wet > SPACES[i - 1].wet, s.id); } });
  assert.equal(SPACES[0].wet, 0);
  for (const s of SPACES) assert.deepEqual(reverbSettings(s.id), { decay: s.decay, wet: s.wet });
  assert.deepEqual(reverbSettings("nope"), reverbSettings("dry"));
});

test("CR-INSTRUMENTS-09 an embedded audio payload is read back to its size without decoding it", () => {
  assert.equal(base64Payload("data:audio/mpeg;base64,QUJD"), "QUJD");
  assert.equal(base64Payload("no comma"), ""); assert.equal(base64Payload(undefined), "");
  assert.equal(payloadBytes("data:x;base64,QUJD"), 3); assert.equal(payloadBytes("data:x;base64,QUI="), 2); assert.equal(payloadBytes("data:x;base64,QQ=="), 1);
  assert.equal(payloadBytes("data:x;base64,"), 0); assert.equal(payloadBytes("junk"), 0);
  for (const [n, uri] of Object.entries(PIANO_SAMPLES)) assert.equal(payloadBytes(uri), Buffer.from(base64Payload(uri), "base64").length, n);
});

test("CR-INSTRUMENTS-10 payloadToBytes turns an embedded payload into the bytes it holds, whatever its padding, with no browser function", () => {
  const bytes = (s) => [...payloadToBytes(`data:x;base64,${s}`)];
  assert.deepEqual(bytes("QUJD"), [65, 66, 67]); assert.deepEqual(bytes("QUI="), [65, 66]); assert.deepEqual(bytes("QQ=="), [65]);
  assert.deepEqual(bytes(""), []); assert.deepEqual([...payloadToBytes("junk")], []);
  for (let n = 0; n < 40; n++) {
    const raw = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255));
    assert.deepEqual(bytes(raw.toString("base64")), [...raw], `${n} bytes`);
  }
  assert.deepEqual(bytes("+/+/"), [0xfb, 0xff, 0xbf], "the last two characters of the alphabet");
  assert.equal(payloadToBytes(PIANO_SAMPLES.C4).length, payloadBytes(PIANO_SAMPLES.C4));
});
