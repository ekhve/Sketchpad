import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as Tone from "tone";

/* The theory that used to sit here, between THEORY:START and THEORY:END, now lives in core/
   (what any music app can use) and sketchpad/ (what only this app needs): one module per
   capability, each documented, specified and tested on its own. See core/README.md. (D-096) */
import { bassOptions, BASS_PARAGRAPH, bassTransitions } from "./core/bass.mjs";
import { inversions, identifyChord, customChordFrom } from "./core/chords.mjs";
import { CHORD_SETS, buildSet, setsFor } from "./core/chordsets.mjs";
import { explainChord, explainProgression, describeChange } from "./core/explain.mjs";
import { rng, STYLES, patternsFor, place, renderProgressionFigure, explainFigure, planBar } from "./core/figures.mjs";
import { HAND_REACH, DEFAULT_REACH, FINGER_HANDS, effectiveFingerHand, FINGER_COPY, fingerChord, stepFingering, litLessonFingers } from "./core/fingering.mjs";
import { harmonize, suggestScaleFor, harmonizeSteps, suggestNextChords, typedChord, harmonizeCustom, TENSION_LEVELS, chordsAtTension } from "./core/harmony.mjs";
import { PIANO_RANGE, KEYBOARD_OCTAVES, HIGHEST_START_MIDI, INSTRUMENTS, instrumentById, payloadToBytes, delaySettings, reverbSettings } from "./core/instruments.mjs";
import { keyRole, keyMarker, MAX_HELD, heldAfterDown, heldAfterUp, slideTo, keyAtPosition } from "./core/keyboard.mjs";
import { melodyRole, changedNotes } from "./core/melody.mjs";
import { NAMES, pc, isWhite, baseOf, noteName, spelling } from "./core/notes.mjs";
import { createDriver, loopIndex } from "./core/transport.mjs";
import { MAX_VOICES, voiceLifetime, reapVoices, barSecondsAt, pickVoiceIndex, rollOffsets } from "./core/playback.mjs";
import { PLAY_PATTERNS, RUN_STEP, isRun, playPlan } from "./core/arpeggio.mjs";
import { scaleById, scalePcs, fitScales, keysContaining, scalesContaining, customScaleFrom, customScalePcs, activeScalePcs } from "./core/scales.mjs";
import { diagramKeys, sheetData, sheetAsText } from "./core/sheet.mjs";
import { scalesForStyle } from "./core/styles.mjs";
import { parseChordNames, TYPING_CHIPS, typedLabel } from "./core/symbols.mjs";
import { dictionaryFor, voicingsFor, voiceLeading, arpeggio, smoothestVoicing } from "./core/voicing.mjs";
import { GUIDE } from "./sketchpad/guide.mjs";
import { LESSON_TOPICS, buildLesson, lessonsFor, practiceNote, practiceFeedback, practiceHint, hintMethod, chordShape, nextKeyRound } from "./sketchpad/lessons.mjs";
import { soundSections, namingFor, activeChordFor, TAB_IDS, LEVELS, levelIndex, has, tabsAt } from "./sketchpad/model.mjs";

/* ============================================================================
   AUDIO — one instrument behind an interface, always releasable. (D-009, D-017)
   ========================================================================== */

function useInstrument() {
  const ref = useRef(null);            // { out, delay }
  const live = useRef([]);             // [{ synth, until }] — timed voices
  const held = useRef(new Map());      // midi -> synth, while a finger is down
  const preset = useRef(INSTRUMENTS[0]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [detail, setDetail] = useState("not started");
  const [voiceCount, setVoiceCount] = useState(0);
  const [asked, setAsked] = useState(false);     // sound was asked for and the browser has not yet allowed it
  const lifted = useRef(new Set());    // keys let go before their note had started
  const up = useRef(null);             // the one-time bring-up after the audio has started
  const started = useRef(false);       // has the browser let the audio start? (it needs a touch first)

  const refresh = useCallback(() => {
    try { setStatus(Tone.getContext().state === "running" ? "running" : "suspended"); }
    catch (e) { setStatus("error"); }
  }, []);

  const resume = useCallback(async () => {
    try {
      const c = Tone.getContext();
      if (c.state !== "running") await c.resume();
      refresh();
    } catch (e) { setStatus("suspended"); }
  }, [refresh]);

  const reap = useCallback((force = false) => {
    const now = (() => { try { return Tone.now(); } catch (e) { return 0; } })();
    if (force) {
      for (const [m, v] of held.current) {
        try { v.sampler ? v.sampler.triggerRelease(Tone.Frequency(m, "midi").toFrequency()) : v.dispose(); } catch (e) {}
      }
      held.current.clear();
      try { for (const k of Object.keys(ref.current?.samplers ?? {})) ref.current.samplers[k].node.releaseAll?.(); } catch (e) {}
    }
    const { keep, expired } = force
      ? { keep: [], expired: live.current }
      : reapVoices(live.current, now);
    expired.forEach((v) => { try { v.synth.dispose(); } catch (e) {} });
    live.current = keep;
    setVoiceCount(keep.length);
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && started.current) resume(); };
    const timer = setInterval(() => { if (started.current) { reap(); refresh(); } }, 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(timer); };
  }, [resume, refresh, reap]);

  const panic = useCallback(() => {
    reap(true);
    try { for (const v of ref.current?.pool?.voices ?? []) { v.synth.triggerRelease(); v.until = 0; } } catch (e) {}
    setVoiceCount(0);
  }, [reap]);

  /* Changing instrument leaves sounding notes alone: they finish on the old
     voice and are reaped normally. Only the next note is different. */
  /* Recorded instruments are loaded on demand and shared: a Sampler handles
     its own polyphony, so it is one node rather than a voice per note. (D-062) */
  /* Decoding the recordings ourselves, rather than handing the audio library a
     URL to fetch. Even a data: URI goes through fetch, and a page whose policy
     restricts where requests may go blocks that as readily as any website —
     which is why the embedded piano still reported "did not arrive". (D-070) */
  const decodeSamples = useCallback(async (preset) => {
    const ctx = Tone.getContext();
    const entries = await Promise.all(Object.entries(preset.samples.urls).map(async ([note, uri]) =>
      [note, await ctx.decodeAudioData(payloadToBytes(uri).buffer)]));
    return Object.fromEntries(entries);
  }, []);

  /* The recordings are decoded once, as early as the page loads: decoding needs
     no touch, and it is the slow part. Nothing else of the audio is built until
     the first touch, because a graph built on a context that has not started was
     silent on a phone (D-102). */
  const decoded = useRef({});
  const buffersFor = useCallback((preset) => {
    if (!decoded.current[preset.id]) decoded.current[preset.id] = decodeSamples(preset);
    return decoded.current[preset.id];
  }, [decodeSamples]);

  const samplerFor = useCallback((preset) => {
    const store = ref.current?.samplers;
    if (!store) return null;
    const entry = store[preset.id];
    if (entry) return entry.loaded ? entry.node : null;

    /* The record goes in before any work starts: onload can fire immediately
       when the buffers are already in hand, and writing into an entry that did
       not exist yet threw, was swallowed, and rebuilt the sampler on every note. (D-064) */
    store[preset.id] = { node: null, loaded: false, failed: false };
    setDetail(`preparing ${preset.name}…`);

    buffersFor(preset)
      .then((buffers) => {
        const node = new Tone.Sampler({
          urls: buffers,
          release: preset.options.release ?? 1,
          volume: preset.volume,
        }).connect(ref.current.out);
        const e = store[preset.id];
        if (e) { e.node = node; e.loaded = true; }
        setDetail(preset.name);
      })
      .catch((err) => {
        const e = store[preset.id];
        if (e) e.failed = true;
        setDetail(`${preset.name} could not be decoded (${err.message}) — using a stand-in`);
      });

    return null;
  }, [buffersFor]);

  const setInstrument = useCallback((id) => {
    preset.current = instrumentById(id);
    setDetail(preset.current.name);
    if (preset.current.kind === "sampler" && ref.current) samplerFor(preset.current);
  }, [samplerFor]);

  /* The audio graph is built on the first touch, after the browser has started
     the audio, as it always was. What is done earlier is only the slow part that
     needs nothing from the browser: decoding the piano. Building the graph at
     load as well made Sketchpad silent on a phone, where the J-6, which sets no
     echo or room, was not. (D-100, D-102) */
  const build = useCallback(() => {
    if (ref.current) return;
    try {
      /* One delay in the chain, always present, wet at zero when off. Adding
         and removing a node while notes are in flight is a good way to lose
         them; changing one number is not. (D-041) voice → delay → reverb → out. */
      const reverb = new Tone.Reverb({ decay: 1.1, wet: 0 }).toDestination();
      const delay = new Tone.FeedbackDelay({ delayTime: 0.28, feedback: 0, wet: 0 }).connect(reverb);
      ref.current = { out: delay, delay, reverb, samplers: {} };
      setReady(true);
      setDetail(preset.current.name);
    } catch (e) {
      try { ref.current = { out: Tone.getDestination(), delay: null, reverb: null, samplers: {} }; setReady(true); setDetail("no effects"); }
      catch (e2) { setStatus("error"); setDetail(`audio failed: ${e.message}`); return; }
    }
    if (preset.current.kind === "sampler") samplerFor(preset.current);
  }, [samplerFor]);

  /* Asking the browser to start the audio. A phone honours the request only
     inside an event that counts as a touch, and a finger going *down* on a piano
     key is not one; its lifting, or the click after it, is. So this is a plain
     function that can be called again and again, from every kind of touch, until
     one of them works. It must never leave a first attempt standing for everything
     else to wait on: a request made outside a touch can be lost for good, and
     with it every note after. (D-103) */
  const unlock = useCallback(() => {
    if (started.current) return;
    try {
      const c = Tone.getContext().rawContext;
      const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
      src.buffer = b; src.connect(c.destination); src.start(0);       // one silent sample wakes the hardware on iOS
    } catch (e) {}
    /* An instrument should sound with the iPhone's silent switch on, as
       GarageBand does. Safari 16.4+ lets a page ask for that; elsewhere this
       property does not exist and nothing changes. (D-076) */
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    try {
      Tone.start().then(() => { started.current = true; }, (e) => { setStatus("error"); setDetail(`start failed: ${e.message}`); });
    } catch (e) { setStatus("error"); setDetail(`start failed: ${e.message}`); }
  }, []);

  /* Once started: build the graph, one time. Nothing waits for the piano: if a
     touch beats its decoding, that note uses the stand-in. (D-104) */
  const bringUp = useCallback(() => {
    if (!up.current) { build(); refresh(); up.current = true; }
  }, [build, refresh]);

  const init = useCallback(async () => {
    if (!started.current) {
      unlock();
      /* Wait for a touch that counts. Anything waiting here is let through the
         moment one arrives. Only if none has come after a good while is the
         person told, so an ordinary first touch never shows anything. (D-106) */
      const tell = setTimeout(() => setAsked(true), 1500);
      const t0 = performance.now();
      while (!started.current && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 25));
      clearTimeout(tell);
      if (!started.current) return;
    }
    setAsked(false);
    bringUp();
    await resume();
  }, [unlock, bringUp, resume]);

  /* Every kind of touch that can count tries to start the audio, until it has
     started, so the first thing a person does, anywhere, is enough. */
  useEffect(() => {
    const kinds = ["pointerup", "touchend", "click", "keydown", "mouseup"];
    const on = () => unlock();
    const down = (e) => { if (e.pointerType === "mouse") unlock(); };
    kinds.forEach((k) => window.addEventListener(k, on, true));
    window.addEventListener("pointerdown", down, true);
    return () => { kinds.forEach((k) => window.removeEventListener(k, on, true)); window.removeEventListener("pointerdown", down, true); };
  }, [unlock]);

  useEffect(() => { if (preset.current.kind === "sampler") buffersFor(preset.current).catch(() => {}); }, [buffersFor]);   // decode now; build on the first touch

  const setSpace = useCallback(async (spaceId) => {
    const r = ref.current?.reverb;
    if (!r) return;
    const { decay, wet } = reverbSettings(spaceId);
    try {
      r.wet.value = wet;
      if (wet > 0) { r.decay = decay; await r.generate(); }
    } catch (e) {}
  }, []);

  const setEcho = useCallback((level) => {
    const d = ref.current?.delay;
    if (!d) return;
    const s = delaySettings(preset.current.id, level);
    try {
      d.wet.value = s.wet;
      d.feedback.value = s.feedback;
      d.delayTime.value = s.time;
    } catch (e) {}
  }, []);

  /* An instrument's own effects (a filter, a chorus, a tremolo), built once and shared by
     its voices, between them and the echo. (D-107) */
  const chainFor = useCallback((p) => {
    const r = ref.current;
    if (!r || !p.chain?.length) return r?.out;
    r.chains = r.chains ?? {};
    if (r.chains[p.id]) return r.chains[p.id][0];
    const nodes = p.chain.map((c) =>
      c.type === "filter" ? new Tone.Filter({ type: "lowpass", frequency: c.frequency, Q: c.q ?? 1 })
      : c.type === "chorus" ? new Tone.Chorus({ frequency: c.frequency, delayTime: c.delayTime, depth: c.depth, wet: 1 }).start()
      : new Tone.Tremolo({ frequency: c.frequency, depth: c.depth, wet: 1 }).start());
    nodes.forEach((n, i) => n.connect(nodes[i + 1] ?? r.out));
    r.chains[p.id] = nodes;
    return nodes[0];
  }, []);

  /* A fixed pool per instrument, built once and reused. Nothing is created or
     destroyed while playing. (D-066) */
  const poolFor = useCallback((p) => {
    const r = ref.current;
    if (!r) return null;
    if (r.pool && r.pool.id === p.id) return r.pool;
    if (r.pool) { for (const v of r.pool.voices) { try { v.synth.dispose(); } catch (e) {} } }
    const Voice = p.kind === "fm" ? Tone.FMSynth : p.kind === "am" ? Tone.AMSynth : Tone.Synth;
    const voices = [];
    for (let i = 0; i < MAX_VOICES; i++) {
      try {
        const synth = new Voice(p.options).connect(chainFor(p));
        synth.volume.value = p.volume;
        voices.push({ synth, until: 0 });
      } catch (e) { break; }
    }
    r.pool = { id: p.id, voices };
    setVoiceCount(0);
    return r.pool;
  }, [chainFor]);

  const plays = useRef(0);             // counts runs, so a random one differs each time
  const play = useCallback((notes, seconds, time, velocity = 0.8, how = 0) => {
    if (!ref.current) return;
    const p = preset.current;
    const list = (Array.isArray(notes) ? notes : [notes]).slice(0, 8);

    /* How the notes are played: a way from core/arpeggio (together, rolled, or a run up, down or at
       random), or, for a caller that has a number, that many seconds of roll. Each note is
       { midi, at }, at seconds after the first. (D-068, D-108) */
    const plan = typeof how === "string"
      ? playPlan(list, how, { seed: ++plays.current })
      : (() => { const s = [...list].sort((a, b) => a - b), o = rollOffsets(s.length, how); return s.map((midi, i) => ({ midi, at: o[i] })); })();
    /* Asked for "now" only when the notes are about to be struck, after any work
       needed to make a voice: a time taken before that work can already be in the
       past when the voice exists. (D-101) */
    const at0 = () => (typeof time === "number" ? time : (() => { try { return Tone.now(); } catch (e) { return 0; } })());

    /* A recorded instrument that has not arrived yet plays through a stand-in
       rather than nothing. Waiting in silence is indistinguishable from
       broken, and was reported as exactly that. (D-064) */
    let voicePreset = p;
    if (p.kind === "sampler") {
      const node = samplerFor(p);
      if (node) {
        try {
          const startAt = at0();
          plan.forEach(({ midi, at }) => {
            node.triggerAttackRelease(
              Tone.Frequency(midi, "midi").toFrequency(),
              Math.max(0.05, seconds), startAt + at, velocity
            );
          });
        } catch (e) { setDetail(`note failed: ${e.message}`); }
        return;
      }
      voicePreset = instrumentById(p.fallback ?? "felt");
    }

    const pool = poolFor(voicePreset);
    if (!pool || !pool.voices.length) return;
    const dur = Math.max(0.05, seconds);
    const startAt = at0();
    const at = startAt;
    const busy = pool.voices.map((v) => v.until);
    let sounding = 0;

    plan.forEach(({ midi: m, at: offset }) => {
      const startsAt = startAt + offset;
      const i = pickVoiceIndex(busy, startsAt);
      const v = pool.voices[i];
      try {
        v.synth.triggerAttackRelease(Tone.Frequency(m, "midi").toFrequency(), dur, startsAt, velocity);
        v.until = startsAt + voiceLifetime(dur, voicePreset.release);
        busy[i] = v.until;
        sounding++;
      } catch (e) { setDetail(`note failed: ${e.message}`); }
    });
    if (sounding) {
      const now = at;
      setVoiceCount(pool.voices.filter((v) => v.until > now).length);
    }
  }, [reap]);

  /* Held notes: pressed and not yet let go. Kept apart from the timed voices
     so a finger on a key can never be reaped out from under itself. (D-045) */
  const holdOn = useCallback(async (midi) => {
    lifted.current.delete(midi);
    await init(); await resume();
    if (!ref.current || held.current.has(midi)) return;
    /* A quick tap can be over before the first start has finished. The note was
       still asked for: sound it briefly rather than hold it for ever or lose it. */
    if (lifted.current.delete(midi)) { play([midi], 0.4, undefined, 0.85); return; }
    if (held.current.size >= MAX_HELD) return;
    const p = preset.current;

    let q = p;
    if (p.kind === "sampler") {
      const node = samplerFor(p);
      if (node) {
        try {
          node.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), undefined, 0.85);
          held.current.set(midi, { sampler: node, midi });
        } catch (e) {}
        return;
      }
      q = instrumentById(p.fallback ?? "felt");
    }

    try {
      const Voice = q.kind === "fm" ? Tone.FMSynth : q.kind === "am" ? Tone.AMSynth : Tone.Synth;
      const synth = new Voice(q.options).connect(chainFor(q));
      synth.volume.value = q.volume;
      synth.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), undefined, 0.85);
      held.current.set(midi, synth);
    } catch (e) { setDetail(`hold failed: ${e.message}`); }
  }, [init, resume, play, chainFor]);

  const holdOff = useCallback((midi) => {
    const synth = held.current.get(midi);
    if (!synth) { lifted.current.add(midi); return; }
    held.current.delete(midi);
    if (synth.sampler) {
      try { synth.sampler.triggerRelease(Tone.Frequency(midi, "midi").toFrequency()); } catch (e) {}
      return;
    }
    try {
      synth.triggerRelease();
      const now = (() => { try { return Tone.now(); } catch (e) { return 0; } })();
      live.current.push({ synth, until: now + preset.current.release + 0.3 });
    } catch (e) { try { synth.dispose(); } catch (e2) {} }
  }, []);

  return { init, resume, play, panic, setInstrument, setEcho, setSpace,
           holdOn, holdOff, ready, status, detail, voiceCount, waitingForTouch: asked };
}

/* ============================================================================
   DESIGN TOKENS — Bone palette. (D-018)
   Named by role, not by colour, so new roles slot in without renaming anything.
   ========================================================================== */

const T = {
  ground: "#EDE7DA", surface: "#E3DBCA", raised: "#D8CFBB", edge: "#CFC4AE",
  ink: "#2E2A24", inkSoft: "#7A7166", inkOnAccent: "#2A1A06",

  keyWhite: "#FFFDF7", keyBlack: "#B3ABA0",   // grey, not black: colour reads on it (D-029)

  /* key labels, one per fill state — never a literal in a component (X-16) */
  labelPlain: "#9C948A", labelSharp: "#5A544B", labelLoop: "#7A5A24",
  labelOnBass: "#FFF2FA", labelRing: "#FFFFFF",
  padInk: "#FFF6E8", padSub: "#FBE6CB",

  /* fill channel — harmony */
  chordW: "#D4802F", chordB: "#BE6F23", chordRootRing: "#7A3F0E",
  loopW: "#F0DCB6", loopB: "#DEC49A",
  soundingW: "#FFC46B", soundingB: "#F0B052",

  /* marker channel — palette */
  scaleDot: "#2F6470", scaleDotOnFill: "#8FD8D0",
  homeDot: "#0E7C86", homeDotOnFill: "#5BEBDA",

  /* reserved for roles not yet built, kept here so the system stays coherent */
  bass: "#7B4B8A", bassW: "#9A6BA8", bassB: "#8A5A99",   // UC-19, UC-29 bass
  pickedW: "#8C63A0", pickedB: "#7A5490",                // UC-42 notes chosen for identification
  moveDot: "#8AA37B", tensionDot: "#C2586A",             // UC-50 melody guide
  changedRing: "#7B4B8A",                                // UC-51 what just changed

  /* the printed sheet: paper, not screen (D-057) */
  paper: "#FFFFFF", paperInk: "#1C1814", paperFaint: "#6A6258", paperLine: "#3A342C",
  passing: "#9A8A6B",   // UC-20 approach and passing notes
  tension: "#B23A48",   // outside-the-scale emphasis, stop states
  ok: "#3E7D5A",        // compatibility confirmations
};

/* The ways to play notes, as buttons with a picture: the same control for chords and for scales.
   `only="runs"` offers the four that run through the notes one at a time, which is all a scale can
   do. (D-108) */
const PatternIcon = ({ id }) => {
  const dots = (pts) => pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.9" fill="currentColor" />);
  const arrow = (d) => <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;
  const body = {
    block:  dots([[10, 3], [10, 8], [10, 13]]),
    roll:   dots([[5, 13], [10, 8], [15, 3]]),
    slow:   dots([[3, 13], [10, 8], [17, 3]]),
    up:     arrow("M10 14V3M5.5 7.5L10 3l4.5 4.5"),
    down:   arrow("M10 2v11M5.5 8.5L10 13l4.5-4.5"),
    updown: arrow("M6 14V3M2.5 6.5L6 3l3.5 3.5M14 2v11M10.5 9.5L14 13l3.5-3.5"),
    random: arrow("M2 4h3c4 0 5 8 9 8h4M15.5 9.5L18 12l-2.5 2.5M2 12h3c1.6 0 2.7-1.4 3.6-2.8M11.4 6.8C12.3 5.4 13 4 14 4h4M15.5 1.5L18 4l-2.5 2.5"),
  }[id];
  return <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" style={{ flex: "none" }}>{body}</svg>;
};
function PatternPicker({ value, onPick, only }) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="how the notes are played">
      {PLAY_PATTERNS.filter((p) => only !== "runs" || isRun(p.id)).map((p) => (
        <button key={p.id} onClick={() => onPick(p.id)} title={p.note} aria-pressed={value === p.id} aria-label={p.name}
          className="px-2 py-1 rounded-md text-xs whitespace-nowrap flex items-center gap-1"
          style={{ background: value === p.id ? T.ink : T.raised, color: value === p.id ? T.keyWhite : T.inkSoft, fontWeight: value === p.id ? 600 : 400 }}>
          <PatternIcon id={p.id} />{p.name}
        </button>
      ))}
    </div>
  );
}

/* Shown while sound has been asked for and the browser has not yet allowed it.
   A tap on this is a click, which every phone counts as a touch. (D-103) */
function SoundBanner({ audio }) {
  if (!audio.waitingForTouch) return null;
  return (
    <button onClick={() => audio.init()} aria-label="turn the sound on"
      className="text-sm px-4 py-2 rounded-full shadow-lg"
      style={{ position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 50, background: T.ink, color: T.keyWhite, fontWeight: 600 }}>
      Tap to turn the sound on
    </button>
  );
}

function Piano({ startMidi, octaves = 4, chordNotes, chordRootMidi, loopNotes, scaleSet, tonic, sounding, bassLit, picked = [], changed = [], guide = false, system, onDown, onUp, fingers = [], brackets = [] }) {
  const midis = useMemo(() => Array.from({ length: octaves * 12 + 1 }, (_, i) => startMidi + i), [startMidi, octaves]);
  const whites = midis.filter(isWhite);
  const w = 100 / whites.length;
  const snd = [...sounding];

  const look = (m) => {
    const white = isWhite(m);
    const role = picked.includes(m) ? "picked" : keyRole(m, { chordNotes, chordRootMidi, loopNotes, sounding: snd, bass: bassLit });
    const marker = keyMarker(m, { tonic, scaleSet });
    let fill = white ? T.keyWhite : T.keyBlack;
    let text = white ? T.labelPlain : T.labelSharp;
    let ring = null;

    if (role === "inLoop")    { fill = white ? T.loopW : T.loopB;   text = T.labelLoop; }
    if (role === "chordTone") { fill = white ? T.chordW : T.chordB; text = T.inkOnAccent; }
    if (role === "chordRoot") { fill = white ? T.chordW : T.chordB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.chordRootRing}`; }
    if (role === "bass")      { fill = white ? T.bassW : T.bassB;   text = T.labelOnBass; ring = `inset 0 0 0 2px ${T.bass}`; }
    if (role === "picked")    { fill = white ? T.pickedW : T.pickedB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.bass}`; }
    if (role === "sounding")  { fill = white ? T.soundingW : T.soundingB; text = T.inkOnAccent; ring = `inset 0 0 0 3px ${T.labelRing}`; }

    /* Both key types are light now, so the dot colour follows the FILL rather
       than the key. Dark teal on pale keys, pale teal on saturated ones. */
    const onFill = role === "chordTone" || role === "chordRoot" || role === "bass" || role === "picked";
    let dotColor = marker === "home"
      ? (onFill ? T.homeDotOnFill : T.homeDot)
      : (onFill ? T.scaleDotOnFill : T.scaleDot);
    let mark = marker;

    /* the melody guide replaces the plain in-scale dot with three answers:
       lands well, moves through, pulls. (D-056) */
    if (guide) {
      const r = melodyRole(m, chordNotes.map(pc), scaleSet);
      mark = r === "tension" ? "scale" : mark ?? "scale";
      dotColor = r === "stable" ? (onFill ? T.homeDotOnFill : T.homeDot)
        : r === "movement" ? T.moveDot : T.tensionDot;
      if (r === "tension" && !chordNotes.map(pc).includes(pc(m))) mark = "scale";
    }

    if (changed.includes(pc(m))) ring = `inset 0 0 0 3px ${T.changedRing}`;
    return { fill, text, ring, marker: mark, dotColor };
  };

  /* Pointer handling lives on the window, not on the keys and not on the
     container. A key cannot learn that a finger rolled onto it, and container
     handlers depend on capture behaving; window listeners always fire. (D-055) */
  const active = useRef({});
  const surface = useRef(null);

  const midiAt = (e) => {
    const el = surface.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return keyAtPosition(e.clientX - r.left, e.clientY - r.top, r.width, r.height, startMidi, octaves);
  };

  const apply = (pointerId, midi) => {
    const { next, pressed, released } = slideTo(active.current, pointerId, midi);
    active.current = next;
    if (released !== null) onUp(released);
    if (pressed !== null) onDown(pressed);
  };

  const handleDown = (e) => {
    e.preventDefault();
    apply(e.pointerId, midiAt(e));
  };

  useEffect(() => {
    const move = (e) => {
      if (!Object.prototype.hasOwnProperty.call(active.current, e.pointerId)) return;
      e.preventDefault();
      apply(e.pointerId, midiAt(e));
    };
    const up = (e) => {
      if (!Object.prototype.hasOwnProperty.call(active.current, e.pointerId)) return;
      apply(e.pointerId, null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }); // no dep array: the handlers close over the current layout every render

  const fingerOn = (m) => fingers.find((k) => k.midi === m);
  const keyLeft = (m) => isWhite(m) ? whites.indexOf(m) * w : whites.filter((x) => x < m).length * w - w * 0.31;
  const keyRight = (m) => isWhite(m) ? (whites.indexOf(m) + 1) * w : whites.filter((x) => x < m).length * w + w * 0.31;

  const Dot = ({ marker, color, size }) =>
    !marker ? null : (
      <span className="block rounded-full" style={{
        width: size, height: size, background: color,
        boxShadow: marker === "home" ? `0 0 0 3px ${color}44` : "none",
      }} />
    );

  /* Wider than the screen and scrollable, so the whole usable range is
     reachable by dragging rather than only by the octave buttons. (D-045) */
  return (
    <div className="overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
    {/* the strip above the keys is what scrolls: the keys themselves take
        touch-action none, or the browser treats a second finger as a pan and
        cancels the note (D-052) */}
    <div style={{ width: `${octaves * 190}px`, minWidth: "100%" }}>
      {/* pannable: this strip is the only way to scroll, and it is deliberately
          not inside the keyboard, because touch-action is intersected down the
          ancestor chain and a child cannot re-enable what a parent forbids */}
      <div className="flex items-center justify-center"
        style={{ height: 16, color: T.inkSoft, fontSize: 9, letterSpacing: ".08em" }}>
        drag here to move the keyboard
      </div>

      {/* which hand takes which keys, when a chord needs both (D-078) */}
      {brackets.length > 0 && (
        <div className="relative pointer-events-none" style={{ height: 16 }}>
          {brackets.filter((b) => b.lo >= startMidi && b.hi <= startMidi + octaves * 12).map((b) => (
            <div key={b.hand} className="absolute" style={{
              left: `${keyLeft(b.lo)}%`, width: `${keyRight(b.hi) - keyLeft(b.lo)}%`, bottom: 1, height: 6,
              borderTop: `2px solid ${b.hand === "L" ? T.bass : T.ink}`, borderLeft: `2px solid ${b.hand === "L" ? T.bass : T.ink}`,
              borderRight: `2px solid ${b.hand === "L" ? T.bass : T.ink}` }}>
              <span className="absolute text-[9px] font-semibold whitespace-nowrap" style={{ bottom: 5, left: 0, color: b.hand === "L" ? T.bass : T.ink }}>
                {b.hand === "L" ? "left hand" : "right hand"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* the keyboard refuses pan and zoom outright, so a sideways drag is a
          glissando and never a scroll (D-054) */}
      <div ref={surface} className="relative select-none"
        style={{ height: 140, touchAction: "none" }}
        onPointerDown={handleDown}>
      <div className="flex w-full gap-px absolute left-0 right-0" style={{ top: 0, bottom: 0 }}>
        {whites.map((m) => {
          const { fill, text, ring, marker, dotColor } = look(m);
          return (
            <button key={m} data-midi={m}
              className="relative flex-1 rounded-b-md"
              style={{
                background: fill,
                boxShadow: `${ring ? ring + ", " : ""}inset 0 -3px 0 rgba(0,0,0,.10), inset 0 0 0 1px ${T.edge}`,
                transition: "background 90ms linear", touchAction: "none",
              }}>
              {fingerOn(m) && (
                <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 30 }}><FingerMark k={fingerOn(m)} /></span>
              )}
              <span className="absolute inset-x-0 text-[9.5px] font-semibold text-center"
                    style={{ color: text, bottom: 16 }}>{noteName(m, system)}</span>
              <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 6 }}>
                <Dot marker={marker} color={dotColor} size={7} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 0, bottom: 0 }}>
        {midis.filter((m) => !isWhite(m)).map((m) => {
          const before = whites.filter((x) => x < m).length;
          const { fill, text, ring, marker, dotColor } = look(m);
          return (
            <button key={m} data-midi={m}
              className="absolute top-0 rounded-b-md pointer-events-auto"
              style={{
                left: `calc(${before * w}% - ${w * 0.31}%)`,
                width: `${w * 0.62}%`, height: "64%",
                background: fill, border: `1px solid ${T.ground}`,
                boxShadow: `${ring ? ring + ", " : ""}inset 0 0 0 1px ${T.edge}`,
                transition: "background 90ms linear", touchAction: "none",
              }}>
              {fingerOn(m) && (
                <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 25 }}><FingerMark k={fingerOn(m)} small /></span>
              )}
              <span className="absolute inset-x-0 text-[7.5px] font-semibold text-center"
                    style={{ color: text, bottom: 14 }}>{noteName(m, system)}</span>
              <span className="absolute inset-x-0 flex justify-center" style={{ bottom: 5 }}>
                <Dot marker={marker} color={dotColor} size={6} />
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
    </div>
  );
}

/* A finger number. Right hand: a solid dark disc. Left hand: a light disc with
   a purple ring, purple being the bass colour. Solid against outlined tells
   them apart without colour, on screen and in black and white. (D-078) */
const FingerMark = ({ k, small = false }) => (
  <span role="img" aria-label={`${k.hand === "L" ? "left" : "right"} hand, finger ${k.finger}`}
    className="flex items-center justify-center rounded-full font-bold"
    style={{ width: small ? 15 : 17, height: small ? 15 : 17, fontSize: small ? 9.5 : 10.5, lineHeight: 1,
      background: k.hand === "L" ? T.padInk : T.ink, color: k.hand === "L" ? T.bass : T.padInk,
      boxShadow: k.hand === "L" ? `inset 0 0 0 2px ${T.bass}` : "none" }}>{k.finger}</span>
);

/* A chord as a picture, because a name on paper tells you nothing you did not
   already know. (D-057) */
const Diagram = ({ startMidi, octaves, notes, width = 168, height = 46, fingers = [] }) => {
  const { whites, blacks } = diagramKeys(startMidi, octaves, notes);
  const at = (m) => whites.find((k) => k.midi === m) ?? blacks.find((k) => k.midi === m);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {whites.map((k) => (
        <rect key={k.midi} x={k.x * width} y={0} width={k.w * width - 0.8} height={height}
          fill={k.on ? T.chordW : T.paper} stroke={T.paperLine} strokeWidth="0.7" />
      ))}
      {blacks.map((k) => (
        <rect key={k.midi} x={k.x * width} y={0} width={k.w * width} height={height * 0.62}
          fill={k.on ? T.chordB : T.paperLine} stroke={T.paperLine} strokeWidth="0.7" />
      ))}
      {fingers.filter((f) => at(f.midi)).map((f) => {
        const k = at(f.midi);
        const cx = (k.x + k.w / 2) * width - (isWhite(f.midi) ? 0.4 : 0);
        const cy = isWhite(f.midi) ? height - 7 : height * 0.62 - 6;
        return (
          <g key={f.midi}>
            <circle cx={cx} cy={cy} r={5.2} fill={f.hand === "L" ? T.paper : T.paperInk}
              stroke={f.hand === "L" ? T.bass : "none"} strokeWidth={f.hand === "L" ? 1.6 : 0} />
            <text x={cx} y={cy + 2.9} fontSize="7.5" fontWeight="700" textAnchor="middle"
              fill={f.hand === "L" ? T.bass : T.paper}>{f.finger}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Legend = () => (
  <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1.5" style={{ color: T.inkSoft }}>
    <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.homeDot, boxShadow: `0 0 0 3px ${T.homeDot}44` }} /> home</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.scaleDot }} /> in scale</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.chordW }} /> this chord</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.loopW, boxShadow: `inset 0 0 0 1px ${T.edge}` }} /> in your loop</span>
    <span className="flex items-center gap-1.5"><i className="block rounded-sm" style={{ width: 9, height: 9, background: T.bassW }} /> bass</span>
  </div>
);

const TAB_LABELS = {
  chords: "Chords", find: "Find", scales: "Scales",
  prog: "Progression", bass: "Bass", theory: "Theory", sheet: "Sheet", learn: "Learn", guide: "How to use",
};
const TABS = TAB_IDS.map((id) => ({ id, label: TAB_LABELS[id] }));

const Row = ({ left, mid, right, onClick, accent = T.homeDot }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mb-1.5"
    style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
    <span className="text-sm font-semibold w-10 shrink-0" style={{ color: accent }}>{left}</span>
    <span className="text-sm font-medium shrink-0">{mid}</span>
    <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{right}</span>
  </button>
);

/* Tone 15 moved the transport and the draw scheduler behind accessors.
   its accessors, and then kept failing for reasons I could not observe. It is
   gone: the loop now runs on our own lookahead scheduler. (D-039, D-043) */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #sheet, #sheet * { visibility: visible !important; }
  #sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; padding: 0 !important; }
  .no-print { display: none !important; }
  @page { margin: 14mm; }
}`;

export default function App() {
  const inst = useInstrument();

  const [tonic, setTonic] = useState(0);      // C, not C# (D-060)
  const [mode, setMode] = useState("major");  // major is where most people start
  const [scaleId, setScaleId] = useState("major");
  const [size, setSize] = useState(3);
  const [chord, setChord] = useState(null);
  const [prog, setProg] = useState([]);
  const [bpm, setBpm] = useState(88);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [withBass, setWithBass] = useState(true);
  const [startMidi, setStartMidi] = useState(48);
  const [sounding, setSounding] = useState(new Set());
  const [bassLit, setBassLit] = useState([]);
  const [instId, setInstId] = useState("grand");
  const [echo, setEchoLevel] = useState("light");   // D-107: off, light (the default) or long
  const [space, setSpace] = useState("room");
  const [pattern, setPattern] = useState("block");   // D-108: how notes are played, for chords and scales
  const [soundOpen, setSoundOpen] = useState(false);    // D-105: the sound options are folded away until asked for
  const [voicingId, setVoicingId] = useState("close");
  const [lesson, setLesson] = useState({ degree: 0, step: -1 });
  const [picked, setPicked] = useState([]);
  /* Kept for the session only. Real persistence arrives with deployment —
     saving to a device nobody has opened yet would be pointless. (D-048) */
  const [mine, setMine] = useState({ chords: [], scales: [] });
  const [customScale, setCustomScale] = useState(null);
  const [guide, setGuide] = useState(false);
  const [changed, setChanged] = useState([]);
  const [tension, setTension] = useState(0);
  const [level, setLevel] = useState("start");
  const [baseSystem, setSystem] = useState("letters");
  const [accidentals, setAccidentals] = useState("sharps");   // D-097: sharps, or the way each key writes them
  const [chordText, setChordText] = useState("");   // D-077: chord names typed in the Progression tab
  /* D-078: finger numbers. null until chosen, so Learn can show the right hand
     by itself while everywhere else stays clean. */
  const [fingerChoice, setFingerChoice] = useState(null);
  const [reach, setReach] = useState(DEFAULT_REACH);
  const [sheetFingers, setSheetFingers] = useState(false);
  /* Names are spelled for the key: letters or Do-Re-Mi, with flats where the
     key uses them. Every `system` below is this spelling. (D-019, D-074) */
  const system = useMemo(() => namingFor({ base: baseSystem, accidentals, tonic, mode }), [baseSystem, accidentals, tonic, mode]);
  const [note, setNote] = useState(null);
  const [tab, setTab] = useState("chords");
  const [setId, setSetId] = useState(null);
  const [style, setStyle] = useState("soul");
  const [bassPat, setBassPat] = useState(null);
  const [riffPat, setRiffPat] = useState(null);
  const [seed, setSeed] = useState(1);
  const [playRiff, setPlayRiff] = useState(true);
  /* Practice: which lesson is open, which step, the notes accepted so far, and
     what the piano is lighting for it. Judging is pure; this only holds the
     result. Completed lessons are kept for the session, like saved chords. (D-073) */
  /* hintLevel is the rung of the hint ladder: 0 nothing yet, 1 the method,
     2 the note lit. It goes back to 0 whenever a right note is played. (D-075) */
  const NO_PRACTICE = { lessonId: null, step: 0, attempt: [], stepDone: false, lessonDone: false, slips: 0, shown: [], hint: null, hintLevel: 0, method: null };
  const [practice, setPractice] = useState(NO_PRACTICE);
  const [learned, setLearned] = useState([]);
  const practiceRef = useRef(practice); practiceRef.current = practice;

  const pro = has(level, "numerals");           // depth follows from the level
  const can = (f) => has(level, f);
  const ctx = { tonic, mode, scaleId };
  const scaleSet = useMemo(() => activeScalePcs(customScale, tonic, scaleId), [customScale, tonic, scaleId]);
  const parentScale = mode === "minor" ? "natural-minor" : "major";
  /* Harmonise the scale the user actually chose. Picking Dorian and still
     being shown natural-minor chords was simply wrong. (D-046) */
  const harmonyScale = scaleById(scaleId).iv.length === 7 ? scaleId : parentScale;
  /* everything is built in the octave the keyboard is showing (D-060) */
  const base = startMidi;
  const chords = useMemo(
    () => (tension > 0
      ? chordsAtTension(tonic, mode, tension, base)
      : harmonize(tonic, harmonyScale, size, base)),
    [tonic, mode, harmonyScale, size, tension, base]
  );
  const chordNotes = chord ? chord.notes : [];
  const loopNotes = useMemo(() => [...new Set(prog.flatMap((c) => c.notes))], [prog]);
  const activeSet = useMemo(() => (setId ? buildSet(CHORD_SETS.find((x) => x.id === setId), tonic, base) : null), [setId, tonic, base]);
  const lbl = (c) => typedLabel(c, system);   // a slash chord keeps its bass in its name (D-077)
  /* Lessons are built in the octave the keyboard shows, so a demonstration is
     always on screen and a lesson's loop matches the Chords tab. */
  const lessonNow = useMemo(
    () => (practice.lessonId ? buildLesson(practice.lessonId, tonic, system, startMidi) : null),
    [practice.lessonId, tonic, system, startMidi]
  );
  const stepNow = lessonNow ? lessonNow.steps[practice.step] : null;

  /* D-078: which hand's fingers are on the keys, and for what */
  const fingerHand = effectiveFingerHand(fingerChoice, tab);
  const inLesson = tab === "learn" && !!lessonNow;
  const lessonFingering = useMemo(
    () => (stepNow && fingerHand !== "off" ? stepFingering(stepNow, lessonNow.mode, fingerHand === "left" ? "L" : "R", reach, lessonNow.system) : null),
    [stepNow, lessonNow, fingerHand, reach]);
  const chordFingering = useMemo(
    () => (chord && fingerHand !== "off" ? fingerChord(chord.notes, { hand: fingerHand, reach, rootPc: chord.rootPc, bassPc: chord.bassPc ?? null }) : null),
    [chord, fingerHand, reach]);
  const pianoFingers = inLesson
    ? litLessonFingers(lessonFingering, stepNow, practice.attempt, practice.shown, practice.hint)
    : chordFingering?.keys ?? [];
  const pianoBrackets = inLesson ? [] : chordFingering?.brackets ?? [];
  const extraBass = inLesson ? null : chordFingering?.extraBass ?? null;
  useEffect(() => {   // a left-hand bass below the visible keys brings the view down to it
    if (extraBass !== null && extraBass < startMidi) setStartMidi(Math.max(PIANO_RANGE.lowest, Math.floor(extraBass / 12) * 12));
  }, [extraBass]);

  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (scaleById(scaleId).mode !== mode) setScaleId(mode === "minor" ? "natural-minor" : "major");
    if (activeSet && activeSet.mode !== mode) setSetId(null);
  }, [mode]); // eslint-disable-line
  /* Leaving a tab with a finger down used to leave the note sounding for ever,
     because the key that would have released it is no longer on screen. */
  useEffect(() => { inst.panic(); setSounding(new Set()); }, [tab]); // eslint-disable-line
  useEffect(() => { inst.setInstrument(instId); inst.setEcho(echo); inst.setSpace(space); }, [instId]); // eslint-disable-line
  useEffect(() => { inst.setEcho(echo); }, [echo, inst.ready]); // eslint-disable-line
  useEffect(() => { inst.setSpace(space); }, [space, inst.ready]); // eslint-disable-line

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setChord(null);
    setNote({
      head: `${noteName(tonic, system)} ${mode}`,
      plain: `Home note is ${noteName(tonic, system)}. Your seven notes are ${scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")}.`,
      formal: `Tonic ${noteName(tonic, system)}, ${mode}.`,
    });
  }, [tonic, mode, system]); // eslint-disable-line

  /* A lesson follows the key. Changing key restarts the open lesson in the new
     one rather than judging half an attempt against notes that have moved. */
  useEffect(() => {
    const id = practiceRef.current.lessonId;
    if (!id) return;
    setPractice({ ...NO_PRACTICE, lessonId: id });
    const l = buildLesson(id, tonic, system, startMidi);
    setNote({ head: `${l.title} in ${noteName(tonic, system)} · step 1 of ${l.steps.length}`, plain: l.steps[0].prompt });
  }, [tonic]); // eslint-disable-line

  /* Show what moved, not just the result. Only the notes that came in or went
     out are ringed, and only for a moment. (D-056) */
  const prevScale = useRef(scaleSet);
  useEffect(() => {
    const diff = changedNotes(prevScale.current, scaleSet);
    prevScale.current = scaleSet;
    const marks = [...diff.added, ...diff.removed];
    if (!marks.length) return;
    setChanged(marks);
    const id = setTimeout(() => setChanged([]), 1600);
    return () => clearTimeout(id);
  }, [scaleSet.join(",")]); // eslint-disable-line

  const flash = (notes, ms = 420) => {
    setSounding(new Set(notes));
    const id = setTimeout(() => {
      setSounding(new Set());
      timers.current = timers.current.filter((t) => t !== id);
    }, ms);
    timers.current.push(id);
  };

  /* One note played during a lesson. The ref is updated at once, so a quick run
     of notes — a finger sliding up a scale — is judged against the attempt as
     it really stands, not against a render that has not happened yet. (D-073) */
  const judgeNote = (m) => {
    const p = practiceRef.current;
    const step = lessonNow?.steps[p.step];
    if (!step || p.stepDone) return;
    const r = practiceNote(step.target, p.attempt, m);
    const slips = p.slips + (r.verdict === "wrong" || r.verdict === "direction" ? 1 : 0);
    const stepDone = r.verdict === "done";
    const lessonDone = stepDone && p.step === lessonNow.steps.length - 1;
    const moved = r.verdict === "progress" || r.verdict === "done";
    const next = { ...p, attempt: r.attempt, slips, stepDone, lessonDone, hint: null,
      hintLevel: moved ? 0 : p.hintLevel, method: moved ? null : p.method };
    practiceRef.current = next;
    setPractice(next);
    setNote(practiceFeedback(step, r, lessonNow.system));
    if (lessonDone) {
      const key = `${lessonNow.id}@${tonic}`;
      setLearned((l) => (l.includes(key) ? l : [...l, key]));
    }
  };

  const openLesson = (id) => {
    const l = buildLesson(id, tonic, system, startMidi);
    setPractice({ ...NO_PRACTICE, lessonId: id });
    setNote({ head: `${l.title} · step 1 of ${l.steps.length}`, plain: l.steps[0].prompt });
  };

  const nextStep = () => {
    if (!lessonNow) return;
    const i = practice.step + 1;
    setPractice({ ...NO_PRACTICE, lessonId: practice.lessonId, step: i, slips: practice.slips });
    setNote({ head: `${lessonNow.title} · step ${i + 1} of ${lessonNow.steps.length}`, plain: lessonNow.steps[i].prompt });
  };

  const showStep = async () => {
    if (!stepNow) return;
    await inst.init(); await inst.resume();
    setPractice({ ...practice, shown: stepNow.show, hint: null });
    if (stepNow.target.kind === "sequence") playSequence(stepNow.show, 330, 0.4);
    else inst.play(stepNow.show, 1.1, undefined, 0.7, pattern);
  };

  /* The hint ladder: first how to find the note, then the note itself. Show me
     is the last rung, and stays a separate button. (D-075) */
  const hintStep = () => {
    if (!stepNow) return;
    if (practice.hintLevel === 0) {
      const method = hintMethod(stepNow, practice.attempt, lessonNow.system);
      setPractice({ ...practice, hintLevel: 1, method });
      setNote({ head: "How to find it", plain: method });
      return;
    }
    const h = practiceHint(stepNow, practice.attempt);
    setPractice({ ...practice, hint: h, hintLevel: 2 });
    if (h !== null) setNote({ head: `Try ${noteName(h, lessonNow.system)}.`, plain: "It's lit on the piano." });
  };

  /* Press and hold sustains; a quick tap still behaves like a tap, because
     the note is released as soon as the finger lifts. (D-045) */
  const noteDown = async (m) => {
    if (tab === "find") {
      setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m].sort((a, b) => a - b)));
      await inst.init(); await inst.resume();
      inst.play([m], 0.5, undefined, 0.85);
      return;
    }
    setSounding((prev) => new Set(heldAfterDown([...prev], m)));
    /* judged before the sound is awaited, so feedback never waits on audio */
    if (tab === "learn" && lessonNow) { judgeNote(m); await inst.holdOn(m); return; }
    await inst.holdOn(m);
    const p = pc(m);
    setNote(
      p === tonic
        ? { head: `${noteName(p, system)} — home`, plain: "The note your key is named after. Everything resolves here." }
        : scaleSet.includes(p)
        ? { head: `${noteName(p, system)} — in your scale`, plain: `Degree ${scaleSet.indexOf(p) + 1} of ${noteName(tonic, system)} ${scaleById(scaleId).name.toLowerCase()}.` }
        : { head: `${noteName(p, system)} — outside the scale`, plain: "Tense on its own, but it works well as a passing note." }
    );
  };

  const noteUp = (m) => {
    if (tab === "find") return;
    inst.holdOff(m);
    setSounding((prev) => new Set(heldAfterUp([...prev], m)));
  };

  /* A chord is played in the voicing the user has chosen, and the piano shows
     that voicing — the arrangement is the chord, not a decoration of it. (D-042) */
  const voiced = useCallback((c) => {
    if (!c) return c;
    const v = voicingsFor(c).find((x) => x.id === voicingId);
    return v ? { ...c, notes: v.notes } : c;
  }, [voicingId]);

  const tapChord = async (c, explain = true) => {
    const vc = voiced(c);
    await inst.init(); await inst.resume();
    if (!playing) inst.panic();
    inst.play(vc.notes, 0.85, undefined, 0.65, pattern);
    setChord(vc);
    if (explain) setNote(explainChord(vc, ctx, system));
  };

  const playSequence = async (notes, gapMs = 260, dur = 0.3, asBass = false) => {
    await inst.init(); await inst.resume();
    clearTimers();
    notes.forEach((m, i) => {
      const id = setTimeout(() => {
        inst.play([m], dur, undefined, 0.85);
        if (asBass) setBassLit([m]); else setSounding(new Set([m]));
        if (i === notes.length - 1) {
          const clear = setTimeout(() => { setSounding(new Set()); setBassLit([]); }, 420);
          timers.current.push(clear);
        }
      }, i * gapMs);
      timers.current.push(id);
    });
  };

  /* The dictionary is about the quality, so it always plays close position.
     Heard through a chosen voicing — rootless, say — a major and a minor triad
     can end up sounding far more alike than they are. (D-044) */
  const playDictionaryChord = async (c) => {
    await inst.init(); await inst.resume();
    if (!playing) inst.panic();
    inst.play(c.notes, 1.1, undefined, 0.7, pattern);
    setChord(c);
    setNote({
      head: `${lbl(c)} — ${c.full}`,
      plain: `${c.plain} Notes: ${c.notes.map((m) => noteName(m, system)).join(" ")}.`,
      formal: `Formula ${c.formula}. Played in close position so the quality is what you hear.`,
    });
  };

  const playArp = async (notes, direction) => {
    await inst.init(); await inst.resume();
    playSequence(arpeggio(notes, direction), 170, 0.45);
  };

  const addChord = (c) => { if (prog.length < 8) { const vc = voiced(c); setProg([...prog, vc]); setChord(vc); } };
  const addAll = (cs) => setProg(cs.slice(0, 8).map(voiced));

  /* Typed chords keep the dictionary's voicing, and a slash chord its bass. */
  const typed = useMemo(() => parseChordNames(chordText, system), [chordText, system]);
  const typedOk = typed.filter((r) => r.ok).map((r) => typedChord(r, tonic, mode, base));
  const typedErrors = typed.filter((r) => !r.ok);
  const addTyped = (replace) => {
    if (typedErrors.length || !typedOk.length) return;
    const next = replace ? typedOk : [...prog, ...typedOk];
    if (next.length > 8) return;
    setProg(next); setChord(typedOk[typedOk.length - 1]); setChordText("");
  };

  const progRef = useRef(prog); progRef.current = prog;
  const bassRef = useRef(withBass); bassRef.current = withBass;
  const sysRef = useRef(system); sysRef.current = system;
  const bpmRef = useRef(bpm); bpmRef.current = bpm;

  const bassFigure = useMemo(
    () => (bassPat && prog.length ? renderProgressionFigure(bassPat, prog, scaleSet, seed, 36) : null),
    [bassPat, prog, scaleSet, seed]
  );
  const riffFigure = useMemo(
    () => (riffPat && prog.length ? renderProgressionFigure(riffPat, prog, scaleSet, seed + 101, 64) : null),
    [riffPat, prog, scaleSet, seed]
  );
  const figRef = useRef({}); figRef.current = { bass: bassFigure, riff: riffFigure, playRiff };

  const suggest = () => {
    const b = patternsFor("bass", style), m = patternsFor("melody", style);
    const r = rng(seed + 31);
    setBassPat(b[Math.floor(r() * b.length)] || null);
    setRiffPat(m[Math.floor(r() * m.length)] || null);
    setSeed((x) => x + 1);
  };



  const stop = () => {
    driver.current.stop();
    clearTimers();
    inst.panic();
    setPlaying(false); setStep(-1); setSounding(new Set()); setBassLit([]);
  };

  /* Our own scheduler. The library transport failed silently twice — once on a
     moved API, once for a reason I never identified — and I cannot test it.
     A lookahead loop over `barsToSchedule` (now core/transport's driver) is arithmetic I can. (D-043, D-098) */
  const driver = useRef(createDriver({ now: () => Tone.now(), every: (fn, ms) => setInterval(fn, ms), cancel: (h) => clearInterval(h) }));

  const emitBar = (index, at) => {
    const p = progRef.current;
    if (!p.length) return;
    const idx = loopIndex(index, p.length);
    const c = p[idx];
    const { bass, riff, playRiff: rOn } = figRef.current;
    const secs = barSecondsAt(bpmRef.current);
    const sixteenth = secs / 16;

    const events = planBar({
      chordNotes: c.notes,
      bassFigure: bass?.[idx] ?? (bassRef.current ? [{ midi: c.notes[0] - 24, pos: 0, dur: 8, role: "root" }] : []),
      riffFigure: rOn ? (riff?.[idx] ?? []) : [],
      sixteenth, barSeconds: secs,
    });

    for (const e of events) inst.play(e.notes, e.dur, at + e.at, e.vel);

    const delayMs = Math.max(0, (at - Tone.now()) * 1000);
    const id = setTimeout(() => {
      setStep(idx); setChord(c); setNote(explainChord(c, ctx, sysRef.current));
      timers.current = timers.current.filter((t) => t !== id);
    }, delayMs);
    timers.current.push(id);
  };

  const start = async () => {
    if (!prog.length || playing) return;
    await inst.init(); await inst.resume();
    try {
      driver.current.start({ unitSeconds: () => barSecondsAt(bpmRef.current), lookahead: 0.6, interval: 120, onUnit: (b) => emitBar(b.index, b.at) });
      setPlaying(true);
    } catch (e) {
      setNote({ head: "The loop could not start", plain: String(e.message ?? e) });
    }
  };

  useEffect(() => () => driver.current.stop(), []);

  /* The scale is played the way notes are played everywhere: the same setting as for chords, and
     only the running ones, because a scale is one note after another. (D-108) */
  const playScale = (id) => {
    const notes = [...scaleById(scaleId).iv, 12].map((i) => 48 + tonic + i);
    const run = playPlan(notes, isRun(id) ? id : "up", { kind: "scale", seed: seed * 13 + 7 });
    if (id === "random") setSeed((x) => x + 1);
    playSequence(run.map((x) => x.midi), RUN_STEP.scale * 1000, 0.24);
  };

  const pickScale = (sc) => {
    setCustomScale(null);                 // a built-in choice replaces one of your own
    const prev = scaleById(scaleId);
    setScaleId(sc.id);
    const a = scalePcs(tonic, prev.id), b = scalePcs(tonic, sc.id);
    const gained = b.filter((x) => !a.includes(x)), lost = a.filter((x) => !b.includes(x));
    setNote({
      head: `${noteName(tonic, system)} ${sc.name}`,
      plain: `${sc.mood}. ${describeChange(a, b, system)}`,
      formal: `Intervals: ${sc.iv.join(" ")}. Common in ${sc.tags.join(", ")}.`,
    });
  };

  const sheet = useMemo(
    () => sheetData({ tonic, mode, scaleId, customScale, progression: prog, bpm, bassFigure, system, fingering: sheetFingers, reach }),
    [tonic, mode, scaleId, customScale, prog, bpm, bassFigure, system, sheetFingers, reach]
  );
  const styleGuide = useMemo(() => scalesForStyle(style, mode), [style, mode]);
  const fits = useMemo(() => fitScales(prog, tonic), [prog, tonic]);
  const scaleHint = useMemo(() => (chord ? suggestScaleFor(chord, ctx) : null), [chord, tonic, mode, scaleId]); // eslint-disable-line
  const progStory = useMemo(() => explainProgression(prog, ctx, system), [prog, tonic, mode, system]); // eslint-disable-line
  const activeChord = activeChordFor({ selected: chord, playingIndex: step, progression: prog, palette: chords });
  const nextBassTarget = (() => {
    if (!activeChord) return null;
    if (prog.length > 1) {
      const i = prog.findIndex((c) => c.id === activeChord.id);
      return prog[((i < 0 ? 0 : i) + 1) % prog.length];
    }
    /* no loop yet: still useful to show how to reach the home chord */
    const home = chords[0];
    return home && home.id !== activeChord.id ? home : chords[3] ?? null;
  })();

  /* The harmonisation lesson, one note at a time, lit on the piano. (UC-38) */
  const lessonSteps = useMemo(
    () => harmonizeSteps(tonic, parentScale, lesson.degree, 3, system),
    [tonic, parentScale, lesson.degree, system]
  );

  const stepLesson = async () => {
    const next = lesson.step >= lessonSteps.length - 1 ? 0 : lesson.step + 1;
    setLesson({ ...lesson, step: next });
    const st = lessonSteps[next];
    if (!st) return;
    await inst.init(); await inst.resume();
    const midis = st.pcs.map((p) => place(p, 54));
    inst.play(st.added !== null ? [place(st.added, 54)] : midis, st.added !== null ? 0.6 : 1.2, undefined, 0.75);
    setChord({ id: "lesson", rootPc: tonic, sym: "", full: "building", notes: midis, degreeIndex: 0, roman: "" });
  };

  const H = ({ children, right }) => (
    <div className="flex items-baseline justify-between mb-2 mt-1">
      <h2 className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: T.inkSoft }}>{children}</h2>
      {right}
    </div>
  );

  return (
    <div className="min-h-screen w-full" style={{ background: T.ground, color: T.ink, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ---- key ---- */}
      <style>{PRINT_CSS}</style>
      <SoundBanner audio={inst} />
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Sketchpad</h1>
          <div className="flex gap-1.5">
            {can("naming") && (
              <button onClick={() => setSystem(baseSystem === "letters" ? "solfege" : "letters")}
                className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.ink }}>
                {baseSystem === "letters" ? "A B C" : "Do Re Mi"}
              </button>
            )}
            {can("naming") && (
              <button onClick={() => setAccidentals(accidentals === "sharps" ? "key" : "sharps")}
                title={accidentals === "sharps" ? "Every black key is a sharp" : "Each key spelled the way it is written: E♭ in C minor"}
                className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.ink }}>
                {accidentals === "sharps" ? "♯" : "♯/♭"}
              </button>
            )}
            <div className="flex rounded-md overflow-hidden" style={{ background: T.raised }}>
              {LEVELS.map((l) => (
                <button key={l.id} onClick={() => { setLevel(l.id); if (!tabsAt(l.id).includes(tab)) setTab("chords"); }}
                  className="text-xs px-2.5 py-1"
                  style={{ background: level === l.id ? T.ink : "transparent", color: level === l.id ? T.keyWhite : T.inkSoft, fontWeight: level === l.id ? 600 : 400 }}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-6 gap-1 mb-1.5">
          {NAMES.map((_, i) => (
            <button key={i} onClick={() => setTonic(i)} className="py-1.5 rounded-md text-[13px]"
              style={{ background: i === tonic ? T.homeDot : T.raised, color: i === tonic ? T.keyWhite : T.ink, fontWeight: i === tonic ? 600 : 400 }}>
              {/* each key is labelled the way it is written in the current mode:
                  E♭ major, but D# minor */}
              {noteName(i, namingFor({ base: baseSystem, accidentals, tonic: i, mode }))}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-3">
          {["major", "minor"].map((m) => (
            <button key={m} onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-sm capitalize"
              style={{ background: mode === m ? T.homeDot : T.raised, color: mode === m ? T.keyWhite : T.ink, fontWeight: mode === m ? 600 : 400 }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ---- piano + explanation + tabs, pinned ---- */}
      <div className="sticky top-0 z-10" style={{ background: T.ground, borderBottom: `1px solid ${T.edge}` }}>
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-2">
          {/* In a lesson the piano shows only what the lesson is about: the
              answer when asked for, the notes already right, and the home dot.
              Scale dots would give a scale step away before it was played. (D-073) */}
          <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1 flex-wrap text-[10px]" style={{ color: T.inkSoft }}>
            <span className="mr-0.5">Fingers</span>
            {FINGER_HANDS.map((h) => (
              <button key={h} onClick={() => setFingerChoice(h)} aria-pressed={fingerHand === h}
                className="px-2 py-0.5 rounded"
                style={{ background: fingerHand === h ? T.homeDot : T.raised, color: fingerHand === h ? T.keyWhite : T.ink, fontWeight: fingerHand === h ? 600 : 400 }}>{h}</button>
            ))}
            {fingerHand !== "off" && (
              <>
                <span className="ml-2 mr-0.5">hand reaches</span>
                {HAND_REACH.map((r) => (
                  <button key={r.id} onClick={() => setReach(r.keys)} aria-pressed={reach === r.keys}
                    className="px-1.5 py-0.5 rounded"
                    style={{ background: reach === r.keys ? T.homeDot : T.raised, color: reach === r.keys ? T.keyWhite : T.ink, fontWeight: reach === r.keys ? 600 : 400 }}>{r.id}</button>
                ))}
              </>
            )}
          </div>
                      <div className="flex items-center rounded-md overflow-hidden" style={{ background: T.raised }}>
              <button onClick={() => setStartMidi(Math.max(PIANO_RANGE.lowest, startMidi - 12))} aria-label="Octave down"
                disabled={startMidi <= PIANO_RANGE.lowest}
                className="px-2.5 py-1 text-sm disabled:opacity-40" style={{ color: T.ink }}>‹</button>
              <span className="text-[11px] px-1 tabular-nums" style={{ color: T.inkSoft }}>Oct {Math.floor(startMidi / 12) - 1}</span>
              <button onClick={() => setStartMidi(Math.min(HIGHEST_START_MIDI, startMidi + 12))} aria-label="Octave up"
                disabled={startMidi >= HIGHEST_START_MIDI}
                className="px-2.5 py-1 text-sm disabled:opacity-40" style={{ color: T.ink }}>›</button>
            </div>
          </div>
          <Piano startMidi={startMidi}
            chordNotes={tab === "learn" && lessonNow ? (practice.shown.length ? practice.shown : practice.hint !== null ? [practice.hint] : []) : chordNotes}
            chordRootMidi={tab === "learn" && lessonNow ? -1 : chord?.notes?.[0] ?? -1}
            loopNotes={tab === "learn" && lessonNow ? [] : loopNotes}
            scaleSet={tab === "learn" && lessonNow ? [] : scaleSet} tonic={tonic} sounding={sounding}
            bassLit={extraBass !== null ? [...bassLit, extraBass] : bassLit} picked={tab === "find" ? picked : tab === "learn" && lessonNow ? practice.attempt : []}
            changed={changed} guide={guide}
            fingers={pianoFingers} brackets={pianoBrackets}
            system={system} onDown={noteDown} onUp={noteUp} octaves={KEYBOARD_OCTAVES} />

          {fingerHand !== "off" && !inLesson && chordFingering && (chordFingering.split || chordFingering.tooWide) && (
            <p className="text-[11px] mt-1" style={{ color: chordFingering.tooWide ? T.tension : T.inkSoft }}>
              {FINGER_COPY.suggested}: {(chordFingering.tooWide ? FINGER_COPY.tooWide : FINGER_COPY.split).toLowerCase()}.
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <Legend />
            {can("melodyGuide") && <button onClick={() => setGuide(!guide)} aria-pressed={guide}
              className="text-[10px] px-2 py-0.5 rounded ml-auto"
              style={{ background: guide ? T.homeDot : T.raised, color: guide ? T.keyWhite : T.inkSoft, fontWeight: guide ? 600 : 400 }}>
              melody guide
            </button>}
          </div>
          {guide && (
            <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1.5" style={{ color: T.inkSoft }}>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.homeDot }} /> lands well</span>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.moveDot }} /> moves through</span>
              <span className="flex items-center gap-1.5"><i className="block rounded-full" style={{ width: 7, height: 7, background: T.tensionDot }} /> pulls</span>
              <span>over {activeChord ? lbl(activeChord) : "the key"}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setSoundOpen(!soundOpen)} aria-expanded={soundOpen} aria-controls="sound-options"
              className="text-xs px-2.5 py-1 rounded-md"
              style={{ background: soundOpen ? T.ink : T.raised, color: soundOpen ? T.keyWhite : T.ink, fontWeight: soundOpen ? 600 : 400 }}>
              Sound options {soundOpen ? "▴" : "▾"}
            </button>
          </div>

          {soundOpen && (
            <div id="sound-options" className="mt-2 rounded-md p-2 flex flex-col gap-2" style={{ background: T.surface }}>
              {soundSections().map((sec) => {
                const chosen = { instrument: instId, played: pattern, room: space, echo }[sec.id];
                const choose = { instrument: setInstId, played: setPattern, room: setSpace, echo: setEchoLevel }[sec.id];
                return (
                  <div key={sec.id} role="group" aria-label={sec.label} className="flex items-center gap-1.5">
                    <span className="text-[10px] w-14 shrink-0" style={{ color: T.inkSoft }}>{sec.label}</span>
                    {sec.id === "played"
                      ? <PatternPicker value={pattern} onPick={setPattern} />
                      : (
                    <div className="flex items-center gap-1 flex-wrap">
                      {sec.options.map((o) => (
                        <button key={o.id} onClick={() => choose(o.id)} title={o.note} aria-pressed={chosen === o.id}
                          className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap"
                          style={{ background: chosen === o.id ? T.ink : T.raised, color: chosen === o.id ? T.keyWhite : T.inkSoft, fontWeight: chosen === o.id ? 600 : 400 }}>
                          {o.name}
                        </button>
                      ))}
                    </div>)}
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5 flex-wrap pt-1" style={{ borderTop: `1px solid ${T.edge}` }}>
                {instrumentById(instId).credit && (
                  <span className="text-[10px] w-full" style={{ color: T.inkSoft }}>{instrumentById(instId).credit}</span>
                )}
              </div>
            </div>
          )}
          {inst.status === "suspended" && (
            <button onClick={() => inst.resume()} className="w-full text-xs py-1.5 mt-2 rounded"
              style={{ background: T.tension, color: T.keyWhite, fontWeight: 600 }}>
              Sound is paused by the browser — tap to resume
            </button>
          )}

          <div className="mt-2 min-h-[40px]">
            {note ? (
              <>
                <div className="text-xs font-semibold" style={{ color: T.chordB }}>{note.head}</div>
                <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>{pro && note.formal ? note.formal : note.plain}</div>
              </>
            ) : (
              <div className="text-xs" style={{ color: T.inkSoft }}>
                Tap a chord or a key — the first tap also turns the sound on. New here?{" "}
                <button onClick={() => setTab("guide")} className="underline" style={{ color: T.homeDot }}>How to use</button>.
              </div>
            )}
          </div>

          {levelIndex(level) < LEVELS.length - 1 && (
            <p className="text-[10px] mt-1.5" style={{ color: T.inkSoft }}>
              {LEVELS[levelIndex(level)].note}{" "}
              <button onClick={() => setLevel(LEVELS[levelIndex(level) + 1].id)} className="underline" style={{ color: T.homeDot }}>
                Show {LEVELS[levelIndex(level) + 1].name.toLowerCase()} tools
              </button>
            </p>
          )}
          <div className="flex gap-1 mt-2 -mx-1 px-1 overflow-x-auto">
            {TABS.filter((t) => tabsAt(level).includes(t.id)).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap"
                style={{ background: tab === t.id ? T.ink : T.raised, color: tab === t.id ? T.keyWhite : T.inkSoft, fontWeight: tab === t.id ? 600 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- tab content ---- */}
      <div className="max-w-2xl mx-auto px-4 py-4" style={{ paddingBottom: 80 }}>

        {tab === "chords" && (
          <>
            {can("tension") && <div className="mb-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.inkSoft }}>
                  How adventurous?
                </span>
                <span className="text-[11px] font-semibold" style={{ color: tension > 1 ? T.tension : T.chordB }}>
                  {TENSION_LEVELS[tension].name}
                </span>
              </div>
              <input type="range" min="0" max="3" value={tension} onChange={(e) => setTension(+e.target.value)}
                className="w-full" style={{ accentColor: tension > 1 ? T.tension : T.chordB }} />
              <p className="text-[11px]" style={{ color: T.inkSoft }}>{TENSION_LEVELS[tension].note}</p>
            </div>}

            <H right={
              <div className="flex gap-1">
                {can("sevenths") && tension === 0 && [[3, "Triads"], [4, "7ths"], [5, "9ths"]].map(([n, label]) => (
                  <button key={n} onClick={() => setSize(n)} className="px-2.5 py-1 rounded text-xs"
                    style={{ background: size === n ? T.chordW : T.raised, color: size === n ? T.keyWhite : T.inkSoft, fontWeight: size === n ? 600 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
            }>In this key</H>
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {chords.map((c) => {
                const on = chord?.id === c.id;
                return (
                  <div key={c.id} className="rounded-lg overflow-hidden"
                    style={{ background: on ? T.chordW : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.chordW : c.extra ? T.tension : T.edge}` }}>
                    <button onClick={() => { tapChord(c); if (c.why) setNote({ head: `${lbl(c)} — borrowed`, plain: c.why }); }}
                      className="w-full px-2 pt-2 pb-1 text-left">
                      <div className="text-[14px] font-semibold leading-tight" style={{ color: on ? T.padInk : T.ink }}>{lbl(c)}</div>
                      <div className="text-[9px] leading-tight" style={{ color: on ? T.padSub : T.inkSoft }}>
                        {c.extra ? "borrowed" : pro ? c.roman : c.notes.map((m) => noteName(m, system)).join(" ")}
                      </div>
                    </button>
                    <button onClick={() => addChord(c)} className="w-full text-[10px] py-1"
                      style={{ background: on ? "rgba(0,0,0,.14)" : T.raised, color: on ? T.padInk : T.inkSoft }}>add</button>
                  </div>
                );
              })}
            </div>

            {scaleHint && (
              <div className="rounded-lg p-3 mb-5" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.tension}` }}>
                <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
                  <strong style={{ color: T.tension }}>{scaleHint.outside.map((p) => noteName(p, system)).join(" and ")}</strong> {scaleHint.outside.length > 1 ? "are" : "is"} outside your scale. {scaleHint.why}
                </p>
                <button onClick={() => { pickScale(scaleHint.scale); setTab("scales"); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: T.homeDot, color: T.keyWhite }}>
                  Try {noteName(tonic, system)} {scaleHint.scale.name}
                </button>
              </div>
            )}

            {can("voicings") && <><H right={activeChord ? (
              <div className="flex gap-1">
                <button onClick={() => tapChord(activeChord)} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB, fontWeight: 600 }}>▶ chord</button>
                <button onClick={() => playArp(activeChord.notes, "up")} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB }}>arp ↑</button>
                <button onClick={() => playArp(activeChord.notes, "down")} className="text-xs px-2 py-1 rounded"
                  style={{ background: T.raised, color: T.chordB }}>arp ↓</button>
              </div>
            ) : null}>Voicing</H>
            <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
              The same chord, arranged differently. This is most of why a chord sounds like a record rather than an exercise.
            </p>
            <div className="mb-5">
              {(activeChord ? voicingsFor(activeChord) : []).map((v) => (
                <button key={v.id} onClick={async () => {
                    /* play these notes directly: setVoicingId has not applied
                       yet, so going through tapChord would sound the previous
                       arrangement — right list, wrong sound. (D-049) */
                    setVoicingId(v.id);
                    const c = { ...activeChord, notes: v.notes };
                    setChord(c);
                    await inst.init(); await inst.resume();
                    if (!playing) inst.panic();
                    inst.play(v.notes, 0.9, undefined, 0.65, pattern);
                    setNote({ head: `${lbl(activeChord)} — ${v.name}`, plain: v.why });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                  style={{ background: voicingId === v.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${voicingId === v.id ? T.chordW : T.edge}` }}>
                  <span className="text-sm font-semibold shrink-0" style={{ minWidth: 62, color: voicingId === v.id ? T.chordB : T.ink }}>{v.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: T.inkSoft, minWidth: 92 }}>
                    {v.notes.map((m) => noteName(m, system)).join(" ")}
                  </span>
                  <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{v.why}</span>
                </button>
              ))}
            </div>

            {mine.chords.length > 0 && (
              <>
                <H right={<button onClick={() => setMine({ ...mine, chords: [] })} className="text-xs" style={{ color: T.inkSoft }}>clear</button>}>Yours</H>
                <div className="grid grid-cols-3 gap-1.5 mb-5">
                  {mine.chords.map((c) => (
                    <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${chord?.id === c.id ? T.bass : T.edge}` }}>
                      <button onClick={() => { tapChord(c, false); setNote({ head: c.name, plain: `Your own: ${c.notes.map((m) => noteName(m, system)).join(" ")}. ${c.full}.` }); }}
                        className="w-full px-2 pt-2 pb-1 text-left">
                        <div className="text-[13px] font-semibold leading-tight">{c.name}</div>
                        <div className="text-[9px] leading-tight" style={{ color: T.inkSoft }}>{c.notes.map((m) => noteName(m, system)).join(" ")}</div>
                      </button>
                      <button onClick={() => addChord(c)} className="w-full text-[10px] py-1" style={{ background: T.raised, color: T.inkSoft }}>add</button>
                    </div>
                  ))}
                </div>
              </>
            )}

</>}

            {can("sets") && <><H>Chord sets</H>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {setsFor(mode).map((sd) => (
                <button key={sd.id} onClick={() => setSetId(setId === sd.id ? null : sd.id)}
                  className="px-2.5 py-1.5 rounded-md text-xs"
                  style={{ background: setId === sd.id ? T.bass : T.raised, color: setId === sd.id ? T.keyWhite : T.inkSoft, fontWeight: setId === sd.id ? 600 : 400 }}>
                  {sd.name}
                </button>
              ))}
            </div>

            {activeSet && (
              <div className="rounded-lg p-3" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                <p className="text-[11px] mb-2.5" style={{ color: T.inkSoft }}>{activeSet.note}</p>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {activeSet.chords.map((c) => (
                    <button key={c.id} onClick={() => tapChord(c)}
                      className="px-2 py-2 rounded-md text-left"
                      style={{ background: chord?.id === c.id ? T.chordW : T.raised, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                      <div className="text-[13px] font-semibold" style={{ color: chord?.id === c.id ? T.padInk : T.ink }}>{lbl(c)}</div>
                      <div className="text-[9px]" style={{ color: chord?.id === c.id ? T.padSub : T.inkSoft }}>{c.notes.map((m) => noteName(m, system)).join(" ")}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className="text-[11px] font-semibold" style={{ color: T.inkSoft }}>Progression</span>
                  {activeSet.progressionChords.map((c, i) => (
                    <button key={i} onClick={() => tapChord(c)} className="px-2.5 py-1 rounded text-xs font-medium"
                      style={{ background: T.raised, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>{lbl(c)}</button>
                  ))}
                  <button onClick={() => { addAll(activeSet.progressionChords); setTab("prog"); }}
                    className="ml-auto px-2.5 py-1 rounded text-xs font-semibold"
                    style={{ background: T.homeDot, color: T.keyWhite }}>add all</button>
                </div>
                <p className="text-[11px]" style={{ color: T.inkSoft }}>{activeSet.why}</p>
              </div>
            )}</>}
          </>
        )}

        {tab === "sheet" && (
          <>
            {prog.length === 0 ? (
              <p className="text-sm" style={{ color: T.inkSoft }}>
                Build a loop first. The sheet is the thing you take to an instrument once you have one.
              </p>
            ) : (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3 no-print">
                  <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: T.homeDot, color: T.keyWhite }}>Print</button>
                  <button onClick={() => { try { navigator.clipboard?.writeText(sheetAsText(sheet)); setNote({ head: "Copied", plain: "The sheet is on your clipboard as plain text." }); } catch (e) {} }}
                    className="px-3 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>Copy as text</button>
                  <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>
                    Print, or save as PDF from the print dialogue.
                  </span>
                  <label className="flex items-center gap-1.5 text-[12px] w-full mt-1" style={{ color: T.ink }}>
                    <input type="checkbox" checked={sheetFingers} onChange={(e) => setSheetFingers(e.target.checked)} style={{ accentColor: T.homeDot }} />
                    Show suggested fingering
                  </label>
                </div>

                <div id="sheet" className="rounded-lg p-4"
                  style={{ background: T.paper, color: T.paperInk, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-lg font-semibold">{sheet.title}</h2>
                    <span className="text-[11px]" style={{ color: T.paperFaint }}>{sheet.meta.join("  ·  ")}</span>
                  </div>

                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.paperFaint }}>Scale</div>
                    <Diagram startMidi={sheet.scale.start} octaves={2} notes={sheet.scale.notes} width={300} height={52} />
                    <div className="text-[11px] mt-1">{sheet.scale.names.join("  ")}</div>
                  </div>

                  <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: T.paperFaint }}>Chords</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 mb-4">
                    {sheet.chords.map((c) => (
                      <div key={c.bar}>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[13px] font-semibold">{c.bar}. {c.label}</span>
                          <span className="text-[10px]" style={{ color: T.paperFaint }}>{c.roman}</span>
                        </div>
                        <Diagram startMidi={sheet.range.startMidi} octaves={sheet.range.octaves} notes={c.notes} width={168} height={44} fingers={c.fingers} />
                        <div className="text-[10px] mt-0.5" style={{ color: T.paperLine }}>{c.names.join(" ")}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.paperFaint }}>Bass</div>
                  <div className="flex gap-3 flex-wrap text-[11px]">
                    {sheet.bass.map((b) => (
                      <span key={b.bar} className="inline-flex items-center gap-1"><strong>{b.bar}.</strong> {b.names.join(" ")}
                        {b.finger && (
                          <svg width="13" height="13" viewBox="0 0 13 13" aria-label={`left hand, finger ${b.finger}`}>
                            <circle cx="6.5" cy="6.5" r="5.3" fill={T.paper} stroke={T.bass} strokeWidth="1.5" />
                            <text x="6.5" y="9.3" fontSize="7.5" fontWeight="700" textAnchor="middle" fill={T.bass}>{b.finger}</text>
                          </svg>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === "learn" && !lessonNow && (
          <>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: T.inkSoft }}>
              Short lessons you play on the piano. Each note is checked as you play it. They follow the key at the top — you are in{" "}
              <span style={{ color: T.homeDot, fontWeight: 600 }}>{noteName(tonic, system)}</span> now.
            </p>
            {/* one list in teaching order: each lesson leans on the ones above it,
                so grouping by topic would scramble the path */}
            <div className="mb-4">
              {lessonsFor(tonic, system, startMidi).map((l, i) => {
                const got = learned.includes(`${l.id}@${tonic}`);
                const topic = LESSON_TOPICS.find((t) => t.id === l.topic)?.name ?? "";
                return (
                  <Row key={l.id} left={got ? "✓" : `${i + 1}`}
                    mid={l.title}
                    right={got ? `done in ${noteName(tonic, system)}` : `${topic} · ${l.steps.length} steps`}
                    accent={got ? T.ok : T.homeDot}
                    onClick={() => openLesson(l.id)} />
                );
              })}
            </div>
            <p className="text-[11px] pt-2" style={{ color: T.inkSoft, borderTop: `1px solid ${T.edge}` }}>
              Finished lessons are ticked for this session only. Saving arrives with the sketchbook.
            </p>
          </>
        )}

        {tab === "learn" && lessonNow && stepNow && (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <button onClick={() => { setPractice(NO_PRACTICE); setNote(null); }} className="text-xs" style={{ color: T.homeDot }}>‹ Lessons</button>
              <span className="text-[11px] ml-auto tabular-nums" style={{ color: T.inkSoft }}>
                {noteName(tonic, system)} · step {practice.step + 1} of {lessonNow.steps.length}
              </span>
            </div>
            <h2 className="text-[17px] font-semibold mb-1">{lessonNow.title}</h2>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>{lessonNow.intro}</p>

            <div className="rounded-lg px-3 py-3 mb-3" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${practice.stepDone ? T.ok : T.edge}` }}>
              <p className="text-[15px] font-medium leading-snug mb-2">{stepNow.prompt}</p>
              {lessonFingering && (
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>{lessonFingering.text}</p>
              )}
              {practice.method && !practice.stepDone && (
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.homeDot }}>{practice.method}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap min-h-[28px] mb-2">
                {practice.attempt.length === 0 ? (
                  <span className="text-[12px]" style={{ color: T.inkSoft }}>Play on the piano above.</span>
                ) : practice.attempt.map((m, i) => (
                  <span key={`${m}-${i}`} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: T.bass, color: T.keyWhite }}>
                    {noteName(m, lessonNow.system)}
                  </span>
                ))}
              </div>
              {!practice.stepDone && (
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={showStep} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>▶ Show me</button>
                  <button onClick={hintStep} className="px-3 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>
                    {practice.hintLevel === 0 ? "Hint" : "Show the note"}
                  </button>
                  {practice.attempt.length > 0 && (
                    <button onClick={() => setPractice({ ...practice, attempt: [], shown: [], hint: null })}
                      className="px-3 py-1.5 rounded-md text-xs ml-auto" style={{ color: T.inkSoft }}>start over</button>
                  )}
                </div>
              )}
              {practice.stepDone && (
                <>
                  <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.ink }}>
                    <span style={{ color: T.ok, fontWeight: 600 }}>✓ </span>{stepNow.why}
                  </p>
                  {/* the rule to take away, and the shape family for a triad:
                      the parts that work on any keyboard, without the app (D-075) */}
                  <p className="text-[12px] leading-relaxed mb-1" style={{ color: T.ink }}>
                    <span className="font-semibold" style={{ color: T.homeDot }}>Take away: </span>{stepNow.rule}
                  </p>
                  {stepNow.target.kind === "set" && chordShape(stepNow.target.pcs, lessonNow.system) && (
                    <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>
                      {chordShape(stepNow.target.pcs, lessonNow.system).text}
                    </p>
                  )}
                  {!practice.lessonDone && (
                    <button onClick={nextStep} className="w-full py-2 rounded-md text-sm font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                      Next step
                    </button>
                  )}
                </>
              )}
            </div>

            {practice.lessonDone && (
              <div className="rounded-lg px-3 py-3 mb-3" style={{ background: T.raised }}>
                <p className="text-sm font-semibold mb-1">Lesson done in {noteName(tonic, system)}.</p>
                <p className="text-[12px] mb-3" style={{ color: T.inkSoft }}>
                  {practice.slips === 0 ? "No slips at all." : `${practice.slips} slip${practice.slips === 1 ? "" : "s"} on the way — play it again and see if that number drops.`}
                </p>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => setTonic(nextKeyRound(tonic))}
                    className="w-full py-2 rounded-md text-sm font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                    Again in {noteName(nextKeyRound(tonic), namingFor({ base: baseSystem, accidentals, tonic: nextKeyRound(tonic), mode }))} — one step round the circle of fifths
                  </button>
                  {lessonNow.loop && (
                    <button onClick={() => { addAll(lessonNow.loop); setTab("prog"); }}
                      className="w-full py-2 rounded-md text-sm" style={{ background: T.surface, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                      Put {lessonNow.loop.map(lbl).join(" ")} in my loop
                    </button>
                  )}
                  <button onClick={() => openLesson(lessonNow.id)} className="text-xs py-1" style={{ color: T.inkSoft }}>play it again here</button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "guide" && (
          <>
            {GUIDE.map((g) => (
              <section key={g.id} className="mb-6">
                <h2 className="text-[15px] font-semibold mb-1">{g.title}</h2>
                <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>{g.lead}</p>
                <ul className="mb-2">
                  {g.points.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-relaxed mb-1.5" style={{ color: T.ink }}>
                      <span style={{ color: T.chordB }}>·</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                {g.tab && (
                  <button onClick={() => setTab(g.tab)} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: T.raised, color: T.homeDot }}>
                    Open {TAB_LABELS[g.tab]} →
                  </button>
                )}
              </section>
            ))}
            <p className="text-[11px] pt-2" style={{ color: T.inkSoft, borderTop: `1px solid ${T.edge}` }}>
              Nothing is saved yet — reload and you start fresh. That is coming.
            </p>
          </>
        )}

        {tab === "find" && (
          <>
            <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              Tap notes on the piano to choose them, then see what you have made. The piano is an input here, not a display.
            </p>

            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {picked.length === 0 ? (
                <span className="text-sm" style={{ color: T.inkSoft }}>Nothing chosen yet.</span>
              ) : (
                <>
                  {picked.map((m) => (
                    <button key={m} onClick={() => setPicked(picked.filter((x) => x !== m))}
                      className="px-2.5 py-1 rounded-md text-xs font-medium"
                      style={{ background: T.bass, color: T.keyWhite }}>
                      {noteName(m, system)}
                    </button>
                  ))}
                  <button onClick={() => { inst.init().then(() => inst.play(picked, 1.1, undefined, 0.7, pattern)); }}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>▶ together</button>
                  <button onClick={() => playArp(picked, "up")} className="px-2.5 py-1 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>▶ arp ↑</button>
                  <button onClick={() => playArp(picked, "down")} className="px-2.5 py-1 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>▶ arp ↓</button>
                  <button onClick={() => setPicked([])} className="text-xs ml-auto" style={{ color: T.inkSoft }}>clear</button>
                </>
              )}
            </div>

            {picked.length >= 2 && (
              <>
                <H>What you played</H>
                <div className="mb-4">
                  {identifyChord(picked, system).length === 0 ? (
                    <p className="text-sm" style={{ color: T.inkSoft }}>
                      No standard chord matches these notes. That is not a mistake — it just has no common name.
                    </p>
                  ) : (
                    identifyChord(picked, system).slice(0, 4).map((r, i) => (
                      <button key={i}
                        onClick={() => { const c = { id: `found-${i}`, rootPc: r.rootPc, sym: r.sym, full: r.full, notes: picked, degreeIndex: 0, roman: "" }; tapChord(c, false); setNote({ head: `${r.label} — ${r.full}`, plain: r.why }); }}
                        className="w-full flex items-baseline gap-3 px-3 py-2.5 rounded-lg text-left mb-1.5"
                        style={{ background: i === 0 ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${i === 0 ? T.chordW : T.edge}` }}>
                        <span className="text-base font-semibold shrink-0" style={{ minWidth: 88, color: i === 0 ? T.chordB : T.ink }}>{r.label}</span>
                        <span className="text-[11px] shrink-0" style={{ color: T.inkSoft, minWidth: 92 }}>{r.full}</span>
                        <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{r.why}</span>
                      </button>
                    ))
                  )}
                  {identifyChord(picked, system).length > 1 && (
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      More than one reading fits. Which one it is depends on what the bass is doing and what came before it.
                    </p>
                  )}
                </div>

                {identifyChord(picked, system)[0]?.sym !== undefined && picked.length >= 3 && (
                  <button onClick={() => { const r = identifyChord(picked, system)[0]; addChord({ id: `found-add-${Date.now()}`, rootPc: r.rootPc, sym: r.sym, full: r.full, notes: picked, degreeIndex: 0, roman: "" }); setTab("prog"); }}
                    className="w-full py-2 rounded-md text-sm font-semibold mb-5"
                    style={{ background: T.homeDot, color: T.keyWhite }}>
                    Add to progression
                  </button>
                )}

                <H>Keep it</H>
                <div className="flex gap-1.5 flex-wrap mb-5">
                  <button onClick={() => {
                      const c = customChordFrom(picked);
                      if (c && !mine.chords.some((x) => x.id === c.id)) setMine({ ...mine, chords: [...mine.chords, c] });
                      setNote({ head: `Saved ${c?.name}`, plain: "It's in the Chords tab under “Yours”, and behaves like any other chord." });
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.bass, color: T.keyWhite }}>
                    Save as chord
                  </button>
                  {picked.length >= 5 && picked.length <= 8 && (
                    <button onClick={() => {
                        const sc = customScaleFrom(picked);
                        if (sc && !mine.scales.some((x) => x.id === sc.id)) setMine({ ...mine, scales: [...mine.scales, sc] });
                        setCustomScale(sc);
                        setNote({ head: `Saved ${sc?.name}`, plain: sc && sc.iv.length === 7 ? "Seven notes, so it can be harmonised into chords. Look under “Yours” in Scales." : "Under “Yours” in Scales. Fewer than seven notes, so it has no chords of its own." });
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: T.homeDot, color: T.keyWhite }}>
                      Save as scale
                    </button>
                  )}
                  <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>kept for this session</span>
                </div>

                <H>Keys these notes fit</H>
                <div className="flex gap-1.5 flex-wrap mb-5">
                  {keysContaining(picked).length === 0 ? (
                    <span className="text-[12px]" style={{ color: T.inkSoft }}>No single key holds all of them — something here is borrowed.</span>
                  ) : keysContaining(picked).map((k, i) => (
                    <button key={i} onClick={() => { setTonic(k.tonic); setMode(k.mode); }}
                      className="px-2.5 py-1.5 rounded-md text-xs"
                      style={{ background: k.tonic === tonic && k.mode === mode ? T.homeDot : T.raised, color: k.tonic === tonic && k.mode === mode ? T.keyWhite : T.ink }}>
                      {noteName(k.tonic, system)} {k.mode}
                    </button>
                  ))}
                </div>

                <H>Scales that contain them</H>
                <div>
                  {scalesContaining(picked).map((f, i) => (
                    <Row key={i} left={noteName(f.tonic, system)} mid={f.scale.name}
                      right={f.extra === 0 ? "exactly these notes" : `adds ${f.extra} more note${f.extra === 1 ? "" : "s"}`}
                      accent={f.extra === 0 ? T.ok : T.homeDot}
                      onClick={() => { setTonic(f.tonic); pickScale(f.scale); setTab("scales"); }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "scales" && (
          <>
            <H>Play the scale</H>
            <div className="mb-2"><PatternPicker only="runs" value={pattern} onPick={(id) => { setPattern(id); playScale(id); }} /></div>
            <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>What are you going for?</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {STYLES.map((sName) => (
                <button key={sName} onClick={() => setStyle(sName)} className="px-2.5 py-1 rounded-md text-xs"
                  style={{ background: style === sName ? T.homeDot : T.raised, color: style === sName ? T.keyWhite : T.inkSoft, fontWeight: style === sName ? 600 : 400 }}>
                  {sName}
                </button>
              ))}
            </div>
            {styleGuide.note && (
              <p className="text-[11px] mb-3" style={{ color: T.inkSoft }}>
                {styleGuide.note} Chord colours: <strong style={{ color: T.chordB }}>{styleGuide.chords.map((q) => q || "major").join(" · ")}</strong>
              </p>
            )}

            {mine.scales.length > 0 && (
              <>
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: T.inkSoft }}>Yours</p>
                <div className="grid gap-1.5 mb-3">
                  {mine.scales.map((sc) => (
                    <button key={sc.id} onClick={() => { setCustomScale(sc); setTonic(sc.tonicPc); setNote({ head: sc.name, plain: `${customScalePcs(sc).map((p) => noteName(p, system)).join(" ")}. ${sc.iv.length === 7 ? "Seven notes, so it harmonises into its own chords." : "Fewer than seven notes, so no chords are built from it."}` }); }}
                      className="text-left px-3 py-2.5 rounded-lg"
                      style={{ background: customScale?.id === sc.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${customScale?.id === sc.id ? T.bass : T.edge}` }}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium" style={{ color: T.bass }}>{sc.name}</span>
                        <span className="text-[11px]" style={{ color: T.inkSoft }}>{customScalePcs(sc).map((p) => noteName(p, system)).join(" ")}</span>
                      </div>
                      {customScale?.id === sc.id && harmonizeCustom(sc).length > 0 && (
                        <div className="mt-1.5 flex gap-1 flex-wrap">
                          {harmonizeCustom(sc, size, base).map((c) => (
                            <span key={c.id} onClick={(e) => { e.stopPropagation(); tapChord(c, false); }}
                              className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: T.raised }}>
                              {lbl(c)}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              {[...styleGuide.suited, ...styleGuide.others].map((sc) => {
                const on = sc.id === scaleId;
                return (
                  <button key={sc.id} onClick={() => pickScale(sc)}
                    className="text-left px-3 py-2.5 rounded-lg"
                    style={{ background: on ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.homeDot : T.edge}` }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium" style={{ color: on ? T.homeDot : T.ink }}>
                        {sc.name}
                        {styleGuide.suited.includes(sc) && <span className="ml-1.5 text-[10px]" style={{ color: T.ok }}>suits {style}</span>}
                      </span>
                      <span className="text-[11px] text-right" style={{ color: T.inkSoft }}>{sc.mood}</span>
                    </div>
                    {on && (
                      <div className="mt-1.5 text-[11px]" style={{ color: T.inkSoft }}>
                        {scalePcs(tonic, sc.id).map((p) => noteName(p, system)).join(" ")} · good for {sc.tags.join(", ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === "prog" && (
          <>
            <H>Type chords</H>
            <input value={chordText} onChange={(e) => setChordText(e.target.value)}
              placeholder={baseOf(system) === "solfege" ? "e.g. Lam7 Fa#m7 Rem7 Sol7sus4" : "e.g. Am7 F#m7 Dm7 G7sus4"}
              aria-label="Chord names" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="w-full px-3 py-2.5 rounded-md text-base mb-2"
              style={{ background: T.keyWhite, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }} />
            <div className="flex gap-1.5 flex-wrap mb-3">
              {TYPING_CHIPS.map(([show, insert]) => (
                <button key={show} onClick={() => setChordText(chordText + insert)}
                  className="px-2.5 py-1.5 rounded-md text-xs" style={{ background: T.raised, color: T.ink }}>{show}</button>
              ))}
            </div>
            {typed.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {typed.map((r, i) => r.ok ? (
                    <button key={i} onClick={() => tapChord(typedChord(r, tonic, mode, base))}
                      className="px-2.5 py-1.5 rounded-md text-sm"
                      style={{ background: T.surface, color: T.ink, boxShadow: `inset 0 0 0 1px ${T.ok}` }}>
                      {typedLabel(typedChord(r, tonic, mode, base), system)}
                      <span className="ml-1.5 text-[11px]" style={{ color: T.inkSoft }}>{typedChord(r, tonic, mode, base).roman}</span>
                    </button>
                  ) : (
                    <span key={i} className="px-2.5 py-1.5 rounded-md text-sm"
                      style={{ background: T.surface, color: T.tension, boxShadow: `inset 0 0 0 1px ${T.tension}` }}>{r.text}</span>
                  ))}
                </div>
                {typedErrors.map((r, i) => (
                  <p key={i} className="text-[12px] mb-1" style={{ color: T.tension }}>{r.reason}</p>
                ))}
                {typedErrors.length === 0 && typedOk.length > 0 && (
                  <>
                    <p className="text-[12px] mb-1.5" style={{ color: T.inkSoft }}>
                      {keysContaining(typedOk.flatMap((c) => c.notes)).length === 0
                        ? "No single key holds all of these. Songs often change key between sections: try one section at a time."
                        : "Keys these chords fit:"}
                    </p>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {keysContaining(typedOk.flatMap((c) => c.notes)).map((k, i) => (
                        <button key={i} onClick={() => { setTonic(k.tonic); setMode(k.mode); }}
                          className="px-2.5 py-1.5 rounded-md text-xs"
                          style={{ background: k.tonic === tonic && k.mode === mode ? T.homeDot : T.raised, color: k.tonic === tonic && k.mode === mode ? T.keyWhite : T.ink }}>
                          {noteName(k.tonic, namingFor({ base: baseSystem, accidentals, tonic: k.tonic, mode: k.mode }))} {k.mode}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => addTyped(false)} disabled={prog.length + typedOk.length > 8}
                        className="px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: T.homeDot, color: T.keyWhite }}>
                        Add {typedOk.length === 1 ? "it" : `these ${typedOk.length}`} to the loop
                      </button>
                      {prog.length > 0 && (
                        <button onClick={() => addTyped(true)} disabled={typedOk.length > 8}
                          className="px-3 py-2 rounded-md text-sm disabled:opacity-40" style={{ background: T.raised, color: T.ink }}>
                          Replace the loop
                        </button>
                      )}
                    </div>
                    {prog.length + typedOk.length > 8 && (
                      <p className="text-[12px] mt-1.5" style={{ color: T.inkSoft }}>The loop holds 8 chords.</p>
                    )}
                  </>
                )}
              </div>
            )}

            <H right={prog.length ? <button onClick={() => { stop(); setProg([]); }} className="text-xs" style={{ color: T.inkSoft }}>clear</button> : null}>
              Your loop
            </H>
            {prog.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: T.inkSoft }}>
                Nothing yet. Type chord names above, add chords from the Chords tab, or take a whole progression from a chord set.
              </p>
            ) : (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {prog.map((c, i) => (
                    <button key={i} onClick={() => setProg(prog.filter((_, j) => j !== i))}
                      className="px-3 py-2 rounded-md text-sm font-medium"
                      style={{ background: step === i ? T.chordW : T.surface, color: step === i ? T.padInk : T.ink, boxShadow: `inset 0 0 0 1px ${step === i ? T.chordW : T.edge}` }}>
                      {lbl(c)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <button onClick={() => (playing ? stop() : start())} className="px-4 py-2 rounded-md text-sm font-semibold"
                    style={{ background: playing ? T.tension : T.homeDot, color: T.keyWhite }}>
                    {playing ? "Stop" : "Play loop"}
                  </button>
                  <label className="flex items-center gap-2 text-xs" style={{ color: T.inkSoft }}>
                    {bpm} bpm
                    <input type="range" min="60" max="140" value={bpm} onChange={(e) => setBpm(+e.target.value)} style={{ width: 90, accentColor: T.homeDot }} />
                  </label>
                  <button onClick={() => setWithBass(!withBass)} className="text-xs px-2 py-1 rounded"
                    style={{ background: T.raised, color: withBass ? T.bass : T.inkSoft, fontWeight: withBass ? 600 : 400 }}>bass root</button>
                </div>

                {progStory && (
                  <>
                    <H>Why it works</H>
                    <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>{progStory.summary}</p>
                    <div className="mb-4">
                      {progStory.moves.map((m, i) => (
                        <div key={i} className="flex gap-2 py-1.5 text-[11px]" style={{ borderBottom: `1px solid ${T.edge}` }}>
                          <span className="font-semibold shrink-0" style={{ minWidth: 78 }}>{m.from} → {m.to}</span>
                          <span style={{ color: T.inkSoft }}>{m.why}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <H>What could come next</H>
                <div className="mb-4">
                  {suggestNextChords(prog, tonic, mode, size).map(({ chord: c, why }) => (
                    <Row key={c.id} left={lbl(c)} mid="" right={why} accent={T.chordB}
                      onClick={() => { tapChord(c); addChord(c); }} />
                  ))}
                  <p className="text-[11px]" style={{ color: T.inkSoft }}>Tap one to hear it and add it to the loop.</p>
                </div>

                {prog.length > 1 && (
                  <>
                    <H>Voice leading</H>
                    <p className="text-[11px] mb-2" style={{ color: T.inkSoft }}>
                      Which notes stay put between chords, and which have to move. Fewer moving notes sounds smoother.
                    </p>
                    <div className="mb-4">
                      {prog.map((c, i) => {
                        const next = prog[(i + 1) % prog.length];
                        const vl = voiceLeading(c, next, system);
                        return (
                          <button key={i}
                            onClick={() => { setChord(c); playSequence([...c.notes, ...next.notes], 420, 0.9); }}
                            className="w-full text-left px-3 py-2 rounded-lg mb-1.5"
                            style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-medium">{lbl(c)} → {lbl(next)}</span>
                              <span className="text-[11px]" style={{ color: vl.common.length >= 2 ? T.ok : vl.common.length === 1 ? T.chordB : T.tension }}>
                                {vl.smoothness}
                              </span>
                            </div>
                            <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                              {vl.common.length > 0 && (
                                <>held: <strong>{vl.common.map((p) => noteName(p, system)).join(" ")}</strong> · </>
                              )}
                              {vl.moves.filter((m) => m.from !== null && m.to !== null)
                                .map((m) => `${noteName(m.from, system)}→${noteName(m.to, system)}`).join(", ") || "everything moves"}
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: T.bass }}>
                              smoothest: {smoothestVoicing(c, next, system).name} — {smoothestVoicing(c, next, system).notes.map((m) => noteName(m, system)).join(" ")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <H>Scales that fit</H>
                <div className="mb-4">
                  {fits.map(({ scale: sc, fit, missing }) => (
                    <Row key={sc.id} left={fit === 1 ? "✓" : "~"} mid={`${noteName(tonic, system)} ${sc.name}`}
                      right={fit === 1 ? "every note fits" : `misses ${missing.map((p) => noteName(p, system)).join(", ")}`}
                      accent={fit === 1 ? T.ok : T.inkSoft}
                      onClick={() => { pickScale(sc); setTab("scales"); }} />
                  ))}
                </div>

                {can("riffs") && <><H right={<button onClick={suggest} className="text-xs px-2 py-1 rounded" style={{ background: T.raised, color: T.bass, fontWeight: 600 }}>surprise me</button>}>
                  Riffs &amp; basslines
                </H>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {STYLES.map((sName) => (
                    <button key={sName} onClick={() => { setStyle(sName); setBassPat(null); setRiffPat(null); }}
                      className="px-2.5 py-1 rounded-md text-xs"
                      style={{ background: style === sName ? T.bass : T.raised, color: style === sName ? T.keyWhite : T.inkSoft, fontWeight: style === sName ? 600 : 400 }}>
                      {sName}
                    </button>
                  ))}
                </div>

                {[["bass", "Basslines", bassPat, setBassPat], ["melody", "Mini melodies", riffPat, setRiffPat]].map(([kind, title, current, setter]) => (
                  <div key={kind} className="mb-4">
                    <p className="text-[11px] font-semibold mb-1.5" style={{ color: T.inkSoft }}>{title}</p>
                    {patternsFor(kind, style).map((pat) => {
                      const on = current?.id === pat.id;
                      return (
                        <button key={pat.id} onClick={() => setter(on ? null : pat)}
                          className="w-full flex items-baseline gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                          style={{ background: on ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${on ? T.bass : T.edge}` }}>
                          <span className="text-sm font-medium shrink-0" style={{ color: on ? T.bass : T.ink, minWidth: 104 }}>{pat.name}</span>
                          <span className="text-[11px]" style={{ color: T.inkSoft }}>{pat.note}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {(bassFigure || riffFigure) && (
                  <div className="rounded-lg p-3 mb-2" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                    {[[bassPat, bassFigure, "Bass"], [riffPat, riffFigure, "Riff"]].map(([pat, fig, kind]) =>
                      !pat || !fig ? null : (
                        <div key={kind} className="mb-2 last:mb-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[11px] font-semibold">{kind} — {pat.name}</span>
                            {kind === "Riff" && (
                              <button onClick={() => setPlayRiff(!playRiff)} className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: T.raised, color: playRiff ? T.bass : T.inkSoft }}>{playRiff ? "playing" : "muted"}</button>
                            )}
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {fig.map((barNotes, i) => (
                              <button key={i} onClick={() => playSequence(barNotes.map((n) => n.midi), 200, 0.2, kind === "Bass")}
                                className="text-[10px] px-2 py-1 rounded"
                                style={{ background: step === i ? T.bass : T.raised, color: step === i ? T.keyWhite : T.ink }}>
                                {barNotes.map((n) => noteName(n.midi, system)).join(" ")}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                    {bassPat && bassFigure?.[0] && (
                      <p className="text-[11px] mt-1.5" style={{ color: T.inkSoft }}>
                        {explainFigure(bassPat, bassFigure[0], system)}
                      </p>
                    )}
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>Tap a bar to hear it on its own, or press play to hear it over the loop.</p>
                  </div>
                )}</>}
              </>
            )}
          </>
        )}

        {tab === "bass" && (
          <>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: T.inkSoft }}>{BASS_PARAGRAPH}</p>
            {!activeChord ? (
              <p className="text-sm" style={{ color: T.inkSoft }}>Pick a key to get started.</p>
            ) : (
              <>
                <H right={!chord && prog.length ? <span className="text-[10px]" style={{ color: T.inkSoft }}>first chord of your loop</span> : null}>
                  Under {lbl(activeChord)}
                </H>
                {bassOptions(activeChord, scaleSet).slice(0, 7).map((o, i) => (
                  <Row key={i} left={noteName(o.pc, system)} mid={o.label} right={o.why}
                    accent={o.role === "passing" ? T.passing : T.bass}
                    onClick={() => { const m = 36 + o.pc; inst.init().then(() => { inst.play([m], 0.5, undefined, 0.9); setBassLit([m]); }); }} />
                ))}

                {nextBassTarget && (
                  <>
                    <H>Getting to {lbl(nextBassTarget)}</H>
                    {bassTransitions(activeChord, nextBassTarget, scaleSet).map((t, i) => (
                      <Row key={i} left="▶" mid={t.name}
                        right={t.notes.map((m) => noteName(m, system)).join(" → ")}
                        accent={T.bass}
                        onClick={() => playSequence(t.notes, 300, 0.28, true)} />
                    ))}
                    <p className="text-[11px] mt-1" style={{ color: T.inkSoft }}>
                      Tap any of these to hear it. They all start on {noteName(activeChord.rootPc, system)} and land on {noteName(nextBassTarget.rootPc, system)}.
                    </p>
                  </>
                )}
                {!nextBassTarget && (
                  <p className="text-[11px] mt-3" style={{ color: T.inkSoft }}>
                    Add a second chord to your loop to see ways of walking between them.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {tab === "theory" && (
          <>
            <H>Where the chords come from</H>
            <p className="text-[12px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>
              Take your scale — {scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")} — start on any note, then skip
              every other one. Three notes gives a triad, four gives a seventh, five gives a ninth. Do that from all seven
              notes and you get exactly the chords in this key. Nothing else is involved.
            </p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {harmonize(tonic, parentScale, 3, base).map((c, i) => (
                <button key={c.id} onClick={() => { setLesson({ degree: i, step: -1 }); tapChord(c); }}
                  className="px-2.5 py-1 rounded text-xs font-medium"
                  style={{ background: lesson.degree === i ? T.chordW : T.raised, color: lesson.degree === i ? T.padInk : T.ink, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
                  {lbl(c)} <span style={{ color: lesson.degree === i ? T.padSub : T.inkSoft }}>{c.roman}</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg p-3 mb-5" style={{ background: T.surface, boxShadow: `inset 0 0 0 1px ${T.edge}` }}>
              <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>
                {lessonSteps[lesson.step]?.text ?? "Step through it one note at a time and watch the piano."}
              </p>
              <div className="flex gap-1.5">
                <button onClick={stepLesson} className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: T.homeDot, color: T.keyWhite }}>
                  {lesson.step < 0 ? "Build it" : lesson.step >= lessonSteps.length - 1 ? "Again" : "Next note"}
                </button>
                <span className="text-[11px] self-center" style={{ color: T.inkSoft }}>
                  {lesson.step >= 0 ? `${lesson.step + 1} of ${lessonSteps.length}` : `${scalePcs(tonic, parentScale).map((p) => noteName(p, system)).join(" ")}`}
                </span>
              </div>
            </div>

            <H>Chord dictionary — {noteName(tonic, system)}</H>
            <div className="mb-5">
              {dictionaryFor(tonic, base).map((c) => (
                <button key={c.id} onClick={() => { playDictionaryChord(c); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left mb-1.5"
                  style={{ background: chord?.id === c.id ? T.raised : T.surface, boxShadow: `inset 0 0 0 1px ${chord?.id === c.id ? T.chordW : T.edge}` }}>
                  <span className="text-sm font-semibold shrink-0" style={{ minWidth: 62 }}>{lbl(c)}</span>
                  <span className="text-[11px] shrink-0" style={{ color: T.chordB, minWidth: 70 }}>{c.formula}</span>
                  <span className="text-[10px] shrink-0" style={{ color: T.inkSoft, minWidth: 84 }}>
                    {c.notes.map((m) => noteName(m, system)).join(" ")}
                  </span>
                  <span className="text-[11px] ml-auto text-right" style={{ color: T.inkSoft }}>{c.plain}</span>
                </button>
              ))}
            </div>

            <H>Inversions</H>
            {!activeChord ? (
              <p className="text-sm mb-5" style={{ color: T.inkSoft }}>Pick a chord to hear its inversions.</p>
            ) : (
              <div className="mb-5">
                <p className="text-[12px] mb-2" style={{ color: T.inkSoft }}>
                  Same notes, different note at the bottom. The chord doesn't change; its weight does.
                </p>
                {inversions(activeChord).map((inv, i) => (
                  <Row key={i} left={noteName(inv.bass, system)} mid={inv.name}
                    right={inv.notes.map((m) => noteName(m, system)).join(" ")}
                    accent={T.chordB}
                    onClick={() => { inst.init().then(() => { inst.play(inv.notes, 0.9, undefined, 0.7, pattern); flash(inv.notes, 700); }); }} />
                ))}
              </div>
            )}

            <H>Bass in one paragraph</H>
            <p className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>{BASS_PARAGRAPH}</p>
          </>
        )}
      </div>
    </div>
  );
}

/* For the J-6 Explorer page (j6/app.jsx): it reuses the piano, the sound, the
   colour tokens and the theory from here, imported rather than copied, so
   there is one of each. Its engine's theory import is pointed at this file
   when the page is bundled. (D-086) */
export { T, Piano, Diagram, PRINT_CSS, useInstrument, SoundBanner };
