/* core/keyboard — unit tests, one per requirement in core/REQUIREMENTS.md (CR-KEYBOARD-nn). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { keyRole, keyMarker, MAX_HELD, heldAfterDown, heldAfterUp, slideTo, notesUnderFingers, keyAtPosition } from "../keyboard.mjs";
import { isWhite, pc } from "../notes.mjs";

test("CR-KEYBOARD-01 a key's role is the first that applies: sounding, bass, chord root, chord tone, in the loop, else plain", () => {
  const all = { chordNotes: [60, 64, 67], chordRootMidi: 60, loopNotes: [60, 62], sounding: [60], bass: [60, 48] };
  assert.equal(keyRole(60, all), "sounding"); assert.equal(keyRole(48, all), "bass");
  assert.equal(keyRole(60, { ...all, sounding: [] }), "bass", "bass outranks the root it also is");
  assert.equal(keyRole(60, { ...all, sounding: [], bass: [] }), "chordRoot");
  assert.equal(keyRole(64, all), "chordTone"); assert.equal(keyRole(62, all), "inLoop"); assert.equal(keyRole(61, all), "plain");
  assert.equal(keyRole(60, {}), "plain", "nothing known, nothing lit");
});

test("CR-KEYBOARD-02 a chord lights the notes it is voiced in, not every octave of them", () => {
  const chord = { chordNotes: [60, 64, 67], chordRootMidi: 60 };
  for (const m of [48, 72, 76, 79]) assert.equal(keyRole(m, chord), "plain", `${m} is the same note in another octave`);
  assert.equal(keyRole(64, chord), "chordTone");
});

test("CR-KEYBOARD-03 a key is marked home on the tonic and scale on the other notes of the scale, in every octave, else nothing", () => {
  const scaleSet = [0, 2, 4, 5, 7, 9, 11];
  for (let m = 24; m < 100; m++) assert.equal(keyMarker(m, { tonic: 0, scaleSet }), pc(m) === 0 ? "home" : scaleSet.includes(pc(m)) ? "scale" : null);
  assert.equal(keyMarker(61, { tonic: 1 }), "home", "with no scale, the tonic is still home");
  assert.equal(keyMarker(62, { tonic: 1 }), null);
});

test("CR-KEYBOARD-04 pressing a key adds it to the held set, sorted, once, up to eight at a time", () => {
  assert.equal(MAX_HELD, 8);
  assert.deepEqual(heldAfterDown([60, 64], 62), [60, 62, 64]);
  const held = [60, 64]; assert.equal(heldAfterDown(held, 60), held, "a repeat is ignored");
  let h = []; for (let m = 60; m < 72; m++) h = heldAfterDown(h, m);
  assert.equal(h.length, 8); assert.deepEqual(h, [60, 61, 62, 63, 64, 65, 66, 67], "a ninth is refused, not stolen");
  assert.deepEqual(heldAfterDown([1, 2], 3, 2), [1, 2], "or a limit of your own");
});

test("CR-KEYBOARD-05 lifting a finger releases only its own key", () => {
  assert.deepEqual(heldAfterUp([60, 64, 67], 64), [60, 67]);
  assert.deepEqual(heldAfterUp([60], 61), [60]); assert.deepEqual(heldAfterUp([], 60), []);
  const held = Object.freeze([60, 64]); assert.deepEqual(heldAfterUp(held, 60), [64]);
});

test("CR-KEYBOARD-06 sliding a finger onto a new key sounds that key and releases the one it left", () => {
  let a = {};
  let r = slideTo(a, 1, 60); assert.deepEqual([r.pressed, r.released, r.next], [60, null, { 1: 60 }]); a = r.next;
  r = slideTo(a, 1, 62); assert.deepEqual([r.pressed, r.released, r.next], [62, 60, { 1: 62 }]); a = r.next;
  r = slideTo(a, 1, 62); assert.deepEqual([r.pressed, r.released], [null, null], "staying put is not a change"); assert.equal(r.next, a);
  r = slideTo(a, 1, null); assert.deepEqual([r.pressed, r.released, r.next], [null, 62, {}], "lifting");
  assert.deepEqual(a, { 1: 62 }, "the old map is not changed");
});

test("CR-KEYBOARD-07 a key held by two fingers keeps sounding until both have left it", () => {
  let a = slideTo({}, 1, 60).next;
  let r = slideTo(a, 2, 60); assert.equal(r.pressed, null, "already sounding"); a = r.next;
  r = slideTo(a, 1, null); assert.equal(r.released, null, "finger 2 still holds it"); a = r.next;
  r = slideTo(a, 2, 64); assert.deepEqual([r.pressed, r.released], [64, 60]);
  r = slideTo({ 0: 60 }, 0, 62); assert.equal(Object.prototype.hasOwnProperty.call(r.next, 0), true, "pointer id 0 is a finger like any other");
});

test("CR-KEYBOARD-08 the notes under the fingers are each listed once, in ascending order", () => {
  assert.deepEqual(notesUnderFingers({ 3: 64, 1: 60, 2: 64 }), [60, 64]); assert.deepEqual(notesUnderFingers({}), []);
});

test("CR-KEYBOARD-09 keyAtPosition finds the key under a point from the layout alone: white keys by width, black keys on the top part", () => {
  const W = 700, H = 200, start = 48, oct = 1;                              // C3..C4: 8 white keys of 87.5px
  const ww = W / 8;
  assert.equal(keyAtPosition(5, 190, W, H, start, oct), 48);
  assert.equal(keyAtPosition(ww * 1.5, 190, W, H, start, oct), 50);
  assert.equal(keyAtPosition(W - 1, 190, W, H, start, oct), 60, "the last white key");
  assert.equal(keyAtPosition(ww, 20, W, H, start, oct), 49, "C♯ sits between C and D, high up");
  assert.equal(keyAtPosition(ww, 190, W, H, start, oct), 50, "…and below it, the white key");
  assert.equal(keyAtPosition(ww * 2.5, 20, W, H, start, oct), 52, "no black key between E and F: the white key under the point");
  for (const [x, y] of [[-1, 10], [10, -1], [W + 1, 10], [10, H + 1]]) assert.equal(keyAtPosition(x, y, W, H, start, oct), null, `${x},${y} is outside`);
});

test("CR-KEYBOARD-10 every key of the keyboard can be found at its own centre, black or white", () => {
  for (const [start, oct, W, H] of [[48, 2, 840, 160], [36, 4, 1200, 220], [60, 1, 300, 100]]) {
    const midis = Array.from({ length: oct * 12 + 1 }, (_, i) => start + i);
    const whites = midis.filter(isWhite), ww = W / whites.length;
    whites.forEach((m, i) => assert.equal(keyAtPosition(ww * (i + 0.5), H - 2, W, H, start, oct), m, `white ${m}`));
    for (const m of midis.filter((x) => !isWhite(x))) {
      const before = whites.filter((w) => w < m).length;
      assert.equal(keyAtPosition(before * ww, 5, W, H, start, oct), m, `black ${m}`);
    }
  }
});
