/* J-6 Explorer — the page. (UC-64, UC-65)

   A second app in the Sketchpad repository, for the Roland J-6 chord
   synthesizer. Explore answers "what am I playing?", Find answers "how do I
   play this on the J-6?". Every chord, numeral and score comes from the engine
   in j6.mjs, which takes its theory from Sketchpad's (D-086). The piano, the
   sound and the colour tokens are Sketchpad's own, imported rather than copied.
   The layout follows the agreed screens, proto/j6/explore.svg and find.svg. */
import React, { useState, useMemo, useCallback, useEffect, useReducer, useRef } from "react";
import * as Tone from "tone";
import { T, Piano, Diagram, PRINT_CSS, useInstrument } from "../sketchpad.jsx";
import { spelling, pc } from "../core/notes.mjs";
import { scalePcs } from "../core/scales.mjs";
import * as j from "./j6.mjs";
import * as pr from "./progression.mjs";
import * as pb from "../core/transport.mjs";
import { j6Sheet, j6SheetText } from "./sheet.mjs";

/* ============================================================================
   DESIGN TOKENS — Sketchpad's Bone palette plus the roles the J-6 needs.
   A new role is added here before it is used (D-018, DoD-20); components use
   these names and never a colour literal (G8 reads this file too).
   ========================================================================== */
const J = {
  ...T,
  card: "#FBF8F1",                       // a card on the ground
  panel: "#1F1C19", panelInk: "#F3EFE6", panelSoft: "#8E867A",   // the J-6's own black panel
  led: "#E8412C", ledGround: "#0D0C0B",   // the set number display
  padWhite: "#ECE6DA", padBlack: "#3A3631", padInkDark: "#2E2A24", padInkLight: "#CFC8BB",
  padLatest: "#FFAE45", padEarlier: "#8A5A26", padEarlierInk: "#FBE6CB",
  badge: "#FFAE45", badgeInk: "#2A1A06",
  pill: "#FFAE45", pillInk: "#2A1A06",
  chip: "#FBE3C0", chipStrong: "#FFAE45",
  toggleOn: "#3E7D5A", toggleOff: "#CFC4AE", knob: "#2E2A27",
  rec: "#E8412C", recInk: "#FFF6E8",      // Rec on: every tap is kept (D-089)
  warn: "#B23A48", warnGround: "#F6E1DF",
};

const KEY_NAMES = j.KEYS.map((k) => k.replace("#", "♯"));
const LOWER = [0, 2, 4, 5, 7, 9, 11, 12];          // 12 is the high C, which plays C (D-083)
const UPPER = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];   // [key, white keys to its left]
const SET_NUMBERS = Object.keys(j.SETS).map(Number).sort((a, b) => a - b);
const [KEY_LO, KEY_HI] = j.TRANSPOSE_RANGE;
const signed = (t) => (t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0");
const DEGREE = { 0: "root", 1: "♭9", 2: "9th", 3: "3rd", 4: "3rd", 5: "4th", 6: "♭5", 7: "5th", 8: "♯5", 9: "6th", 10: "7th", 11: "7th" };
/* with a fifth already there, 8 is a ♭13 rather than a ♯5, and with a seventh 5 and 9 are an 11th and a 13th; with both thirds, 3 is a ♯9 */
const degreeOf = (i, iv) => (i === 8 && iv.includes(7) ? "♭13" : i === 6 && iv.includes(7) ? "♯11"
  : i === 5 && (iv.includes(10) || iv.includes(11)) && (iv.includes(3) || iv.includes(4)) ? "11th"
  : i === 9 && (iv.includes(10) || iv.includes(11)) ? "13th" : i === 3 && iv.includes(4) ? "♯9" : DEGREE[i]);
/* An unlabelled key (the interval stacks, sets 14–16) or one whose label can't be read has no chord. */
const chordName = (c, tonic) => (c.chord ? j.nameInKey(c.chord, tonic) : c.label ? "?" : "—");
const padFont = (rest) => (rest.length <= 4 ? 10 : rest.length <= 5 ? 8.5 : rest.length <= 6 ? 7.5 : 6.8);
const flagged = (set, k) => j.validateSet(set).find((r) => r.key === j.KEYS[k]);
const pitchName = (m, names) => names[pc(m)] + (Math.floor(m / 12) - 1);
const majorKey = (tonic) => `${spelling("letters", tonic).names[tonic]} major`;

/* The key a whole set plays in (D-094), for spelling its pads before anything is played. */
const setTonic = (n, t) => j.setKey(n, t)?.tonic ?? 0;
const minorOf = (tonic) => `${spelling("letters", tonic).names[(tonic + 9) % 12]} minor`;

/* ============================================================================
   SMALL PARTS
   ========================================================================== */
const Card = ({ children, style }) => (
  <section style={{ background: J.card, borderRadius: 18, padding: 16, margin: "12px 0", boxShadow: `0 0 0 1px ${J.edge}`, ...style }}>{children}</section>
);
const Label = ({ children }) => (
  <div style={{ fontSize: 11, letterSpacing: ".12em", color: J.inkSoft, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>
);
function Segmented({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: "inline-flex", background: J.surface, borderRadius: 999, padding: 2 }}>
      {options.map(([id, text]) => (
        <button key={id} onClick={() => onChange(id)} aria-pressed={value === id}
          style={{ border: 0, borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: value === id ? 700 : 500,
            background: value === id ? J.card : "transparent", color: value === id ? J.ink : J.inkSoft }}>{text}</button>
      ))}
    </div>
  );
}
const Toggle = ({ on, onChange, label }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    style={{ width: 46, height: 26, borderRadius: 13, border: 0, position: "relative", background: on ? J.toggleOn : J.toggleOff }}>
    <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: J.card, transition: "left 120ms" }} />
  </button>
);
const Button = ({ children, onClick, dark = false, disabled = false, label }) => (
  <button onClick={onClick} disabled={disabled} aria-label={label}
    style={{ border: 0, borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 700,
      background: dark ? J.ink : J.surface, color: dark ? J.panelInk : J.ink, opacity: disabled ? 0.45 : 1 }}>{children}</button>
);

/* ============================================================================
   THE VIRTUAL J-6 — what every key plays, printed on the pad.
   `marks(k)` says how to draw key k: { order, latest, dashed, lit }.
   ========================================================================== */
function J6Pads({ set, t, tonic, marks, onPress, roleTonic = null }) {
  const pad = (k, slot, black) => {
    const c = j.chordAt(set, k % 12, t);
    /* the high C plays C's chord (D-083), so it is drawn as the same chord, dashed, never numbered */
    const m = k === 12 ? (({ order, dashed }) => ({ dashed: Boolean(order || dashed) }))(marks(0)) : marks(k);
    const fill = m.latest ? J.padLatest : m.lit ? J.padEarlier : black ? J.padBlack : J.padWhite;
    const ink = m.latest ? J.badgeInk : m.lit ? J.padEarlierInk : black ? J.padInkLight : J.padInkDark;
    const bad = flagged(set, k % 12);
    /* I, IV, V and vi of the key the set plays in, so the key shows on the pads (D-094) */
    const role = roleTonic === null ? null : j.homeRole(c.chord, roleTonic);
    return (
      <button key={slot} onClick={() => onPress?.(k % 12)} aria-label={`J-6 key ${KEY_NAMES[k % 12]}${k === 12 ? " (high C)" : ""}: ${chordName(c, tonic)}${bad ? " (the manual's notes don't match)" : ""}`}
        style={{ position: "relative", width: "100%", minHeight: black ? 46 : 62, borderRadius: 6, background: fill, color: ink,
          border: m.dashed ? `1.5px dashed ${J.padLatest}` : 0,
          /* the latest key is told apart by a thick outline as well as by colour (R-351) */
          boxShadow: m.latest ? `0 0 0 3px ${J.panelInk}` : "none",
          display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "4px 1px" }}>
        <span style={{ fontSize: 10, opacity: 0.8, whiteSpace: "nowrap" }}>{k === 12 ? "C′" : KEY_NAMES[k]}{bad ? " !" : ""}{role && <strong style={{ opacity: 1 }}> {role}</strong>}</span>
        {/* the root on one line and the rest below it, each sized to fit the pad, so no name is cut off */}
        {(() => {
          const name = chordName(c, tonic);
          const root = c.chord ? spelling("letters", tonic).names[c.chord.root] : name;
          const rest = name.slice(root.length);
          /* a long type breaks before its bracket, slash, add or sus: maj9 / (no3) / /G */
          const lines = j.typeLines(rest);
          return (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05, fontWeight: 700, maxWidth: "100%" }}>
              <span style={{ fontSize: 12 }}>{root}</span>
              {lines.map((l) => <span key={l} style={{ fontSize: padFont(l), letterSpacing: "-.03em", whiteSpace: "nowrap" }}>{l}</span>)}
            </span>
          );
        })()}
        {m.order && (
          <span style={{ position: "absolute", top: -7, right: -5, minWidth: 18, height: 18, borderRadius: 9, fontSize: 11, fontWeight: 800,
            background: J.badge, color: J.badgeInk, boxShadow: `0 0 0 2px ${J.panel}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.order}</span>
        )}
      </button>
    );
  };
  return (
    <div style={{ position: "relative", paddingTop: 52 + 8 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52 }}>
        {UPPER.map(([k, left]) => (
          <div key={k} style={{ position: "absolute", left: `calc(${(left + 0.5) * 12.5}% + 4px)`, width: "calc(12.5% - 6px)" }}>{pad(k, k, true)}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 4 }}>
        {LOWER.map((k) => <div key={k}>{pad(k, k, false)}</div>)}
      </div>
    </div>
  );
}

function Panel({ set, t, children, onSet, onPick, onKey, rec, onRec }) {
  const bad = j.validateSet(set);
  const key = j.setKey(set, t);
  return (
    <div style={{ background: J.panel, color: J.panelInk, borderRadius: 18, padding: 14 }}>
      {/* One row: a display the size of the J-6's own four digits, the set, and the arrows.
          The key the set plays in gets a line of its own, where it can be read (D-094). */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div aria-label={`chord set ${set}`} style={{ background: J.ledGround, color: J.led, fontFamily: "ui-monospace,monospace", fontSize: 19, fontWeight: 700, letterSpacing: ".08em", padding: "3px 8px", borderRadius: 5, minWidth: 46, textAlign: "center" }}>{set}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {onPick ? (
            <select aria-label="chord set" value={set} onChange={(e) => onPick(Number(e.target.value))}
              style={{ fontSize: 16, fontWeight: 700, background: "transparent", color: J.panelInk, border: 0, padding: 0, width: "100%", textOverflow: "ellipsis" }}>
              {SET_NUMBERS.map((n) => <option key={n} value={n}>{n} · {j.SETS[n].genre}</option>)}
            </select>
          ) : <div style={{ fontSize: 16, fontWeight: 700 }}>{j.SETS[set].genre} · KEY {signed(t)}</div>}
        </div>
        {onSet && (
          <div style={{ display: "flex", gap: 6 }}>
            {[["‹", -1, "previous set"], ["›", 1, "next set"]].map(([s, d, a]) => (
              <button key={s} aria-label={a} onClick={() => onSet(d)} style={{ width: 30, height: 30, borderRadius: 15, border: 0, background: J.padBlack, color: J.panelInk, fontSize: 17 }}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: J.panelSoft, marginTop: 6 }}>
        {key ? <>Plays in <strong style={{ color: J.panelInk }}>{majorKey(key.tonic)}</strong> / {minorOf(key.tonic)} · {key.fit} of {key.of} pads fit</>
          : <>Interval stacks: no key</>}
      </div>
      {onKey && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: J.panelSoft }}>
          {/* on the J-6, KEY is the A key's second function: SHIFT + [A (KEY)] */}
          <span title="on the J-6: SHIFT + [A (KEY)], turn [TEMPO/VALUE], then [C (EXIT)]">KEY (transpose)</span>
          <button aria-label="KEY down" onClick={() => onKey(-1)} disabled={t <= KEY_LO} style={{ width: 28, height: 24, borderRadius: 6, border: 0, background: J.padBlack, color: J.panelInk }}>−</button>
          <span style={{ minWidth: 22, textAlign: "center", color: J.panelInk, fontWeight: 700 }}>{signed(t)}</span>
          <button aria-label="KEY up" onClick={() => onKey(1)} disabled={t >= KEY_HI} style={{ width: 28, height: 24, borderRadius: 6, border: 0, background: J.padBlack, color: J.panelInk }}>+</button>
          {onRec ? (
            /* on: filled red with "REC" in capitals and a solid dot; off: an outline and a hollow dot,
               so the state reads without colour (D-089) */
            <button role="switch" aria-checked={rec} aria-label="record every tap into the progression" onClick={() => onRec(!rec)}
              style={{ marginLeft: "auto", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".06em",
                border: `1.5px solid ${rec ? J.rec : J.panelSoft}`, background: rec ? J.rec : "transparent", color: rec ? J.recInk : J.panelSoft }}>
              {rec ? "● REC" : "○ Rec"}
            </button>
          ) : <span style={{ marginLeft: "auto", fontSize: 10.5 }}>sound controls: display only</span>}
        </div>
      )}
      {bad.length > 0 && (
        <div role="alert" style={{ marginTop: 10, background: J.warnGround, color: J.warn, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          {j.untrustedSet(set)
            ? `The manual's chord data for set ${set} fails on ${bad.length} of 12 keys, so search never suggests this set. Its chord names are the manual's, not necessarily what the J-6 plays.`
            : `! marks a misprint in the J-6 manual: for ${bad.length === 1 ? "that key" : `those ${bad.length} keys`}, the notes it lists don't fit the chord name it gives. You can still tap ${bad.length === 1 ? "it" : "them"} to hear the notes as printed; Find just won't suggest ${bad.length === 1 ? "it" : "them"}.`}
        </div>
      )}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

/* ============================================================================
   EXPLORE — what am I playing? (UC-64)
   ========================================================================== */
/* A tap plays and shows; "+ Add" keeps; Rec keeps every tap. The progression
   lives in J6App, so Find can add to it too. (D-089) */
function Explore({ audio, state, dispatch, set, setSet, t, setT, opts, setOpts, along, setAlong }) {
  const [showPiano, setShowPiano] = useState(true);
  const [held, setHeld] = useState([]);

  /* Playback (D-090): Sketchpad's look-ahead scheduler (D-043) asks which beats fall in the
     next half second; core/transport says what each beat holds. Options and the progression
     are read through refs, so a change while playing takes effect from the next beat. */
  const [sounding, setSounding] = useState(null);      // index of the chord sounding, while playing
  const [running, setRunning] = useState(false);
  const driver = useRef(pb.createDriver({ now: () => Tone.now(), every: (fn, ms) => setInterval(fn, ms), cancel: (h) => clearInterval(h) })), timers = useRef([]), clickSynth = useRef(null);
  const optsRef = useRef(opts); optsRef.current = opts;
  const itemsRef = useRef(state.items); itemsRef.current = state.items;
  const at = (time, fn) => {
    const id = setTimeout(() => { timers.current = timers.current.filter((x) => x !== id); fn(); }, Math.max(0, (time - Tone.now()) * 1000));
    timers.current.push(id);
  };
  const halt = () => {
    driver.current.stop();
    timers.current.forEach(clearTimeout); timers.current = [];
    setSounding(null); setRunning(false);
  };
  const stop = () => { halt(); audio.panic(); };
  const click = (time, accent) => {
    try {
      if (!clickSynth.current) clickSynth.current = new Tone.Synth({ oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -12 }).toDestination();
      clickSynth.current.triggerAttackRelease(accent ? "C6" : "G5", 0.03, time);
    } catch (e) {}
  };
  const play = async () => {
    if (running || !state.items.length) return;
    await audio.init(); await audio.resume();
    driver.current.start({
      unitSeconds: () => pb.beatSeconds(optsRef.current.bpm),
      onUnit: (b) => {
        const o = optsRef.current, items = itemsRef.current;
        const e = pb.beatAt(b.index, items.length, o);
        if (e.end) { at(b.at, halt); return "end"; }
        if (e.click) click(b.at, e.click === "accent");
        if (e.chord !== null) {
          const idx = e.chord;
          audio.play(pr.resolve(items[idx]).midi, pb.chordSeconds(o), b.at, 0.75);
          at(b.at, () => setSounding(idx));
        }
      },
    });
    setRunning(true);
  };
  useEffect(() => () => { driver.current.stop(); timers.current.forEach(clearTimeout); }, []);

  const chords = state.items.map(pr.resolve);
  const keys = j.likelyKeys(pr.keyFocus(state).map(pr.resolve).map((c) => c.chord).filter(Boolean));
  const judged = pr.keyFocus(state).length;
  const best = keys[0], next = keys[1];
  const tonic = best ? best.tonic : setTonic(set, t);
  const names = spelling("letters", tonic).names;
  const latest = state.current && pr.resolve(state.current);

  const sound = async (midi, seconds = 1.4) => {
    await audio.init(); await audio.resume();
    audio.play(midi, seconds, undefined, 0.75);
  };
  const press = (k) => { dispatch({ type: "tap", set, key: k, t }); sound(j.chordAt(set, k, t).midi); };
  const changeSet = (d) => {
    const i = SET_NUMBERS.indexOf(set);
    setSet(SET_NUMBERS[(i + d + SET_NUMBERS.length) % SET_NUMBERS.length]);
  };
  const changeKey = (d) => setT((x) => Math.max(KEY_LO, Math.min(KEY_HI, x + d)));

  /* Numbers on the pads show what has been kept, Rec on or off; the latest tap is outlined. */
  const marks = (k) => {
    const m = pr.padMarks(state, set, t, k);
    const now = sounding !== null && state.items[sounding];
    /* while playing, the outline follows the chord sounding */
    return now ? { ...m, latest: now.set === set && now.t === t && now.key === k } : m;
  };
  const where = (x) => `${x.set === set && x.t === t ? "" : `set ${x.set}${x.t ? ` · KEY ${signed(x.t)}` : ""} · `}key ${KEY_NAMES[x.key]}`;

  /* The piano spans the whole progression and the chord on screen, so it holds still while
     the progression plays under a melody (D-092). */
  const span = [...chords.flatMap((c) => c.midi), ...(latest ? latest.midi : [])];
  const lo = span.length ? Math.min(...span) : 48;
  const hi = span.length ? Math.max(...span) : 72;
  const lit = sounding !== null && chords[sounding] ? chords[sounding] : latest;
  const offer = j.scalesToPlay(pr.keyFocus(state).map(pr.resolve).map((c) => c.chord));
  const [sheetOn, setSheetOn] = useState(false);
  const [fingers, setFingers] = useState(false);
  const [copied, setCopied] = useState(false);
  const sheet = sheetOn && chords.length ? j6Sheet(state.items, { bpm: opts.bpm, bars: opts.bars, scale: along, fingering: fingers }) : null;
  const start = Math.floor(lo / 12) * 12;
  const octaves = Math.max(2, Math.ceil((hi - start + 1) / 12));
  const notes = latest?.chord ? latest.chord.iv : [];
  const latestBad = latest && flagged(state.current.set, state.current.key);
  const misread = latestBad && j.nameFromNotes(latest.midi);   // what the printed notes make (D-093)

  return (
    <>
      <Panel set={set} t={t} onSet={changeSet} onPick={setSet} onKey={changeKey}
        rec={state.rec} onRec={(on) => dispatch({ type: "rec", on })}>
        <J6Pads set={set} t={t} tonic={tonic} marks={marks} onPress={press} roleTonic={j.setKey(set, t)?.tonic ?? null} />
      </Panel>
      <p style={{ fontSize: 13, color: J.inkSoft, margin: "8px 4px" }}>
        {state.rec ? "Recording: every key you tap joins the progression, in order. Tap ● REC to stop; what you recorded stays."
          : "Tap a key to hear it. + Add keeps it; ○ Rec keeps every tap, to copy down what you played on the J-6. Clear empties the progression."}
      </p>

      <Card>
        <Label>Now</Label>
        {!latest ? (
          <p style={{ fontSize: 14, color: J.inkSoft }}>Tap a key on the J-6 above to see the chord it plays.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: chordName(latest, tonic).length > 7 ? 28 : 40, fontWeight: 800, lineHeight: 1.05, overflowWrap: "anywhere" }}>{chordName(latest, tonic)}</div>
                <div style={{ fontSize: 12.5, color: J.inkSoft, marginTop: 4 }}>J-6 {where(state.current)} · {latest.label ? `manual says ${latest.label}` : "no chord name in the manual: an interval"}</div>
              </div>
              {best && latest.chord && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ background: J.pill, color: J.pillInk, borderRadius: 999, padding: "6px 16px", fontSize: 18, fontWeight: 800 }}>{j.romanOf(latest.chord, tonic)}</div>
                  <div style={{ fontSize: 12, color: J.inkSoft, marginTop: 4 }}>in {majorKey(tonic)}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              {notes.map((iv, i) => (
                <div key={iv} style={{ textAlign: "center" }}>
                  <div style={{ width: 50, height: 38, borderRadius: 8, background: i === 0 ? J.chipStrong : J.chip, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                    {names[pc(latest.chord.root + iv)]}
                  </div>
                  <div style={{ fontSize: 11, color: J.inkSoft, marginTop: 3 }}>{degreeOf(iv, notes)}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 11, color: J.inkSoft }}>
                <div style={{ letterSpacing: ".1em" }}>J-6 VOICING</div>
                <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: J.ink }}>{latest.midi.map((m) => pitchName(m, names)).join(" ")}</div>
                <div>low → high</div>
              </div>
            </div>
            {!state.rec && (
              <div style={{ marginTop: 12 }}><Button dark onClick={() => dispatch({ type: "add" })}>+ Add to progression</Button></div>
            )}
            {latestBad && (
              <p role="alert" style={{ marginTop: 10, background: J.warnGround, color: J.warn, borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}>
                Misprint in the manual: the notes it lists for this key don't fit "{latest.label}" ({latestBad.problems.join("; ")}). {misread ? ` The printed notes make ${j.nameInKey(misread, tonic)}.` : ""} You hear and see the notes as printed; Find won't suggest this key.
              </p>
            )}
          </>
        )}
      </Card>

      <Card style={{ paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Piano · play along</Label>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: J.inkSoft }}>Show <Toggle on={showPiano} onChange={setShowPiano} label="show the piano" /></span>
        </div>
        {/* scales to play a melody with over the progression (D-092) */}
        {offer.scales.length > 0 && (
          <div style={{ margin: "6px 0 10px" }}>
            <div style={{ fontSize: 12.5, color: J.inkSoft, marginBottom: 6 }}>Scales that work over {state.items.length ? "the progression" : "this chord"}:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {offer.scales.map((s) => {
                const on = along && along.tonic === s.tonic && along.id === s.id;
                return (
                  <button key={s.id} onClick={() => setAlong(on ? null : { tonic: s.tonic, id: s.id })} aria-pressed={Boolean(on)}
                    style={{ border: 0, borderRadius: 12, padding: "6px 10px", textAlign: "left", maxWidth: 200,
                      background: on ? J.chipStrong : J.chip, color: J.ink, boxShadow: on ? `0 0 0 2px ${J.ink}` : "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{spelling("letters", s.tonic).names[s.tonic]} {s.name.toLowerCase()}</div>
                    <div style={{ fontSize: 11 }}>{s.notes.map((p) => spelling("letters", s.tonic).names[p]).join(" ")}</div>
                    <div style={{ fontSize: 10.5, color: J.inkSoft }}>{s.mood}</div>
                  </button>
                );
              })}
            </div>
            {offer.outside.length > 0 && (
              <p style={{ fontSize: 12, color: J.inkSoft, margin: "6px 0 0" }}>
                Over {offer.outside.map((c) => j.nameInKey(c, tonic)).join(", ")} some of these notes will clash: {offer.outside.length === 1 ? "it isn't" : "they aren't"} in the key.
              </p>
            )}
            {along && <p style={{ fontSize: 12, color: J.inkSoft, margin: "6px 0 0" }}>Dots on the piano mark the scale; play over the progression while it loops.</p>}
          </div>
        )}
        {showPiano && (
          <Piano startMidi={start} octaves={octaves} chordNotes={lit ? lit.midi : []}
            chordRootMidi={lit?.chord ? lit.midi.find((m) => pc(m) === lit.chord.root) ?? -1 : -1}
            loopNotes={[]} scaleSet={along ? scalePcs(along.tonic, along.id) : best ? scalePcs(tonic, "major") : []}
            tonic={along ? along.tonic : tonic} sounding={held}
            system={spelling("letters", tonic)}
            onDown={(m) => { setHeld((h) => [...h, m]); audio.holdOn(m); }}
            onUp={(m) => { setHeld((h) => h.filter((x) => x !== m)); audio.holdOff(m); }} />
        )}
      </Card>

      <Card>
        <Label>Key</Label>
        {!best ? <p style={{ fontSize: 14, color: J.inkSoft }}>Play a few keys and the likely key appears here.</p> : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{majorKey(best.tonic)}</div>
              <div style={{ textAlign: "right", fontSize: 12.5 }}>
                <div>{state.items.length ? (best.inKey === judged ? `all ${judged} chord${judged > 1 ? "s" : ""} fit` : `${best.inKey} of ${judged} chords fit`) : "from the chord on screen"}</div>
                {next && state.items.length > 0 && <div style={{ color: J.inkSoft }}>next: {majorKey(next.tonic)}, {next.inKey} of {judged}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {scalePcs(best.tonic, "major").map((p) => {
                const inLatest = latest?.chord && j.pcsOf(latest.chord).has(p);
                return (
                  <span key={p} style={{ width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700,
                    background: inLatest ? J.chipStrong : J.chip, boxShadow: `0 0 0 1px ${J.edge}` }}>{names[p]}</span>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Progression</Label>
          <span style={{ display: "flex", gap: 6 }}>
            <Button onClick={() => dispatch({ type: "undo" })} disabled={!chords.length}>↶ Undo</Button>
            <Button onClick={() => dispatch({ type: "clear" })} disabled={!chords.length}>Clear</Button>
            {running ? <Button dark onClick={stop}>■ Stop</Button>
              : <Button dark onClick={play} disabled={!chords.length}>▶ Play</Button>}
          </span>
        </div>
        {/* tempo, length, loop and click: one row, wrapping on a narrow phone (D-090) */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", marginTop: 10, fontSize: 12.5, color: J.inkSoft }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Tempo
            <Button label="slower" onClick={() => setOpts((o) => ({ ...o, bpm: pb.setTempo(o.bpm - pb.TEMPO.step) }))} disabled={opts.bpm <= pb.TEMPO.min}>−</Button>
            <strong style={{ color: J.ink, minWidth: 26, textAlign: "center" }} aria-label="tempo in BPM">{opts.bpm}</strong>
            <Button label="faster" onClick={() => setOpts((o) => ({ ...o, bpm: pb.setTempo(o.bpm + pb.TEMPO.step) }))} disabled={opts.bpm >= pb.TEMPO.max}>+</Button>
            BPM
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Each chord
            <Segmented label="bars per chord" value={opts.bars} onChange={(bars) => setOpts((o) => ({ ...o, bars }))}
              options={pb.LENGTHS.map((l) => [l, l === 0.5 ? "½ bar" : l === 1 ? "1 bar" : "2 bars"])} />
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>Loop <Toggle on={opts.loop} onChange={(loop) => setOpts((o) => ({ ...o, loop }))} label="loop the progression" /></span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>Click <Toggle on={opts.click} onChange={(click) => setOpts((o) => ({ ...o, click }))} label="metronome click with a one-bar count-in" /></span>
        </div>
        {/* the strip scrolls sideways, and scrolling clips at its padding: room for each chord's × */}
        <div style={{ display: "flex", gap: 10, overflowX: "auto", marginTop: 4, padding: "10px 10px 4px 2px" }}>
          {chords.map((c, i) => (
            <div key={i} style={{ position: "relative", minWidth: 86 }}>
              <button onClick={() => sound(c.midi, 1.2)} aria-label={`play ${chordName(c, tonic)}`}
                style={{ width: "100%", border: 0, borderRadius: 12, padding: "8px 6px", textAlign: "center", color: J.ink,
                  background: i === sounding ? J.chip : J.surface,
                  boxShadow: i === sounding ? `0 0 0 3px ${J.padLatest}` : sounding === null && i === chords.length - 1 ? `0 0 0 2px ${J.padLatest}` : `0 0 0 1px ${J.edge}` }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{chordName(c, tonic)}</div>
                <div style={{ fontSize: 13 }}>{best && c.chord ? j.romanOf(c.chord, tonic) : ""}</div>
                <div style={{ fontSize: 10.5, color: J.inkSoft }}>{where(state.items[i])}</div>
              </button>
              <button onClick={() => dispatch({ type: "remove", index: i })} aria-label={`remove ${chordName(c, tonic)}`}
                style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 0,
                  background: J.ink, color: J.card, fontSize: 12, lineHeight: "22px" }}>×</button>
            </div>
          ))}
          {!chords.length && <p style={{ fontSize: 13, color: J.inkSoft }}>Nothing kept yet. Tap a key, then + Add, or turn on Rec.</p>}
        </div>
      </Card>

      {/* Sketchpad's sheet (D-057), for taking the progression to a piano (D-091) */}
      <Card>
        <style>{PRINT_CSS}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} className="no-print">
          <Label>Sheet</Label>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: J.inkSoft }}>Show <Toggle on={sheetOn} onChange={setSheetOn} label="show the sheet" /></span>
        </div>
        {sheetOn && !sheet && <p style={{ fontSize: 13, color: J.inkSoft }}>Keep a few chords first: the sheet is the progression, written out to play at a piano.</p>}
        {sheet && (
          <>
            <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "6px 0 10px" }}>
              <Button dark onClick={() => window.print()}>Print</Button>
              <Button onClick={() => { try { navigator.clipboard?.writeText(j6SheetText(sheet)); setCopied(true); } catch (e) {} }}>{copied ? "Copied" : "Copy as text"}</Button>
              <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: J.inkSoft, marginLeft: "auto" }}>
                Suggested fingering <Toggle on={fingers} onChange={setFingers} label="show suggested fingering" />
              </span>
              <span style={{ fontSize: 11, color: J.inkSoft, width: "100%" }}>Print, or save as PDF from the print dialogue.</span>
            </div>
            <div id="sheet" style={{ background: J.paper, color: J.paperInk, borderRadius: 10, padding: 14, boxShadow: `inset 0 0 0 1px ${J.edge}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                <strong style={{ fontSize: 17 }}>{sheet.title}</strong>
                <span style={{ fontSize: 11, color: J.paperFaint }}>{sheet.meta.join("  ·  ")}</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: J.paperFaint }}>Scale</div>
              <Diagram startMidi={sheet.scale.start} octaves={2} notes={sheet.scale.notes} width={300} height={52} />
              <div style={{ fontSize: 11, margin: "2px 0 12px" }}>{sheet.scale.name}: {sheet.scale.names.join("  ")}</div>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: J.paperFaint, marginBottom: 6 }}>Chords</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 10px", marginBottom: 12 }}>
                {sheet.chords.map((c, i) => (
                  <div key={c.bar} style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <strong style={{ fontSize: 13 }}>{c.bar}. {c.label}</strong>
                      <span style={{ fontSize: 10, color: J.paperFaint }}>{c.roman}</span>
                    </div>
                    <Diagram startMidi={sheet.range.startMidi} octaves={sheet.range.octaves} notes={c.notes} width={150} height={42} fingers={c.fingers} />
                    <div style={{ fontSize: 10, color: J.paperLine }}>{c.names.join(" ")}</div>
                    <div style={{ fontSize: 10, color: J.paperFaint }}>J-6 {sheet.j6[i].where}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: J.paperFaint }}>Bass</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
                {sheet.bass.map((b) => <span key={b.bar}><strong>{b.bar}.</strong> {b.names.join(" ")}{b.finger ? ` (left hand ${b.finger})` : ""}</span>)}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/* ============================================================================
   FIND — how do I play this on the J-6? (UC-65)
   ========================================================================== */
const KIND = { exact: "Exact", inversion: "Inversion", close: "Close", none: "Not in set" };
function reasonFor(r) {
  const parts = r.rows.filter((w) => w.kind !== "exact").map((w) =>
    w.kind === "none" ? `no ${j.nameOf(w.want)}` : `${j.nameOf(w.got)} for ${j.nameOf(w.want)}`);
  return [`KEY ${signed(r.transpose)}`, ...parts].join(" · ");
}

function Find({ audio, dispatch }) {
  const [text, setText] = useState("Dm7 G7 Cmaj7 Am7");
  const [mode, setMode] = useState("musical");
  const [transpose, setTranspose] = useState(true);

  const tokens = text.split(/[\s,|]+/).filter(Boolean);
  const parsed = tokens.map((s) => { try { return { s, chord: j.parseChord(s) }; } catch (e) { return { s, error: e.message.replace(/^cannot read chord: /, "") }; } });
  const ok = parsed.length > 0 && parsed.every((p) => p.chord);
  const results = useMemo(() => (ok ? j.search(tokens.join(" "), { mode, transpose }) : []), [text, mode, transpose, ok]); // eslint-disable-line
  const best = results[0] && results[0].score > 0 ? results[0] : null;
  const skipped = SET_NUMBERS.filter((n) => j.untrustedSet(n));
  const badKeys = SET_NUMBERS.reduce((sum, n) => sum + (j.untrustedSet(n) ? 0 : j.validateSet(n).length), 0);
  const wantTonic = ok ? j.likelyKeys(parsed.map((p) => p.chord))[0]?.tonic ?? 0 : 0;

  /* the keys to press, in order: the first key that plays each chord. */
  const order = best ? best.rows.map((r) => (r.keys[0] ? j.KEYS.indexOf(r.keys[0]) : null)) : [];
  const marks = (k) => {
    if (!best) return {};
    const firsts = order.map((x, i) => [x, i]).filter(([x]) => x === k);
    const alt = best.rows.some((r) => r.keys.slice(1).includes(j.KEYS[k]));
    return { order: firsts.length ? firsts.map(([, i]) => i + 1).join("·") : null, latest: firsts.length > 0, dashed: !firsts.length && alt };
  };
  const hear = async () => {
    await audio.init(); await audio.resume();
    order.forEach((k, i) => { if (k !== null) setTimeout(() => audio.play(j.chordAt(best.set, k, best.transpose).midi, 0.95, undefined, 0.75), i * 1000); });
  };
  const exact = best ? best.rows.filter((r) => r.kind === "exact").length : 0;
  const [added, setAdded] = useState(null);
  useEffect(() => setAdded(null), [text, mode, transpose]);
  const addAll = () => { const items = pr.fromSearch(best); dispatch({ type: "addMany", items }); setAdded(items.length); };

  return (
    <>
      <Card>
        <Label>Progression you want</Label>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="chord progression"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          style={{ width: "100%", fontSize: 19, padding: "12px 14px", borderRadius: 12, border: `1px solid ${J.edge}`, background: J.ground, color: J.ink, fontFamily: "ui-monospace,monospace" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {parsed.map((p, i) => (
            <span key={i} title={p.error} style={{ borderRadius: 999, padding: "4px 10px", fontSize: 13, fontWeight: 700,
              background: p.chord ? J.chip : J.warnGround, color: p.chord ? J.ink : J.warn }}>
              {p.chord ? `✓ ${j.nameInKey(p.chord, wantTonic)}` : `✗ ${p.s}`}
            </span>
          ))}
        </div>
        {parsed.filter((p) => p.error).map((p, i) => <p key={i} style={{ fontSize: 12.5, color: J.warn, marginTop: 6 }}>{p.error}</p>)}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 2px" }}>
        <Segmented label="matching" value={mode} onChange={setMode} options={[["exact", "Exact"], ["musical", "Musical"]]} />
        <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: J.inkSoft }}>Use KEY transpose <Toggle on={transpose} onChange={setTranspose} label="use KEY transpose" /></span>
      </div>

      {ok && !best && <Card><p style={{ fontSize: 14 }}>No chord set plays any of these chords{transpose ? "" : " without transposing"}.</p></Card>}

      {best && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <Label>Best match</Label>
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>Set {best.set}</div>
              <div style={{ fontSize: 13, color: J.inkSoft, marginTop: 4 }}>{best.genre}</div>
            </div>
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <span style={{ background: J.toggleOn, color: J.card, borderRadius: 999, padding: "6px 16px", fontWeight: 800 }}>
                {exact === best.rows.length ? `${exact}/${exact} exact` : `${Math.round(best.score * 100)}%`}
              </span>
              <span style={{ background: J.panel, color: J.padLatest, borderRadius: 999, padding: "6px 16px", fontWeight: 800 }}>KEY {signed(best.transpose)}</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ background: J.panel, borderRadius: 14, padding: 12 }}>
              <J6Pads set={best.set} t={best.transpose} tonic={wantTonic} marks={marks} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <strong>On your J-6</strong>
            <span style={{ display: "flex", gap: 6 }}>
              <Button onClick={addAll}>+ Add to progression</Button>
              <Button dark onClick={hear}>▶ Hear it</Button>
            </span>
          </div>
          {added !== null && <p role="status" style={{ fontSize: 12.5, color: J.ok, margin: "6px 0 0" }}>Added {added} chord{added === 1 ? "" : "s"} to the progression in Explore.</p>}
          <ol style={{ listStyle: "none", padding: 0, margin: "8px 0", fontSize: 14, display: "grid", gap: 6 }}>
            {j.hardwareSteps(best, order.filter((k) => k !== null)).map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 20, height: 20, borderRadius: 10, background: J.chip, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>{s}
              </li>
            ))}
          </ol>
          <div style={{ borderTop: `1px solid ${J.edge}`, paddingTop: 8 }}>
            {best.rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", fontSize: 13.5, padding: "3px 0" }}>
                <strong>{j.nameInKey(r.want, wantTonic)}</strong>
                <span style={{ color: J.inkSoft }}>{r.keys.length ? `→ key ${KEY_NAMES[j.KEYS.indexOf(r.keys[0])]}${r.keys.length > 1 ? ` (or ${r.keys.slice(1).map((k) => KEY_NAMES[j.KEYS.indexOf(k)]).join(", ")})` : ""}${r.kind !== "exact" ? ` · plays ${j.nameInKey(r.got, wantTonic)}` : ""}` : "—"}</span>
                <span style={{ fontWeight: 700, color: r.kind === "exact" ? J.ok : r.kind === "none" ? J.warn : J.inkSoft }}>{KIND[r.kind]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {results.length > 1 && (
        <Card>
          <Label>Other sets</Label>
          {results.slice(1, 6).map((r) => (
            <div key={r.set} style={{ margin: "8px 0 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                <span>Set {r.set} · {r.genre}</span><span>{Math.round(r.score * 1000) / 10}%</span>
              </div>
              <div style={{ fontSize: 12, color: J.inkSoft }}>{reasonFor(r)}</div>
              <div style={{ height: 5, borderRadius: 3, background: J.surface, marginTop: 5 }}>
                <div style={{ width: `${r.score * 100}%`, height: 5, borderRadius: 3, background: J.chipStrong }} />
              </div>
            </div>
          ))}
          {results.filter((r) => r.score > 0).length > 6 && (
            <p style={{ fontSize: 12, color: J.inkSoft }}>and {results.filter((r) => r.score > 0).length - 6} more sets with at least one of these chords.</p>
          )}
        </Card>
      )}

      <p style={{ fontSize: 11.5, color: J.inkSoft, margin: "8px 4px" }}>
        Ranked over all {SET_NUMBERS.length - skipped.length} sets but set {skipped.join(", ")}, whose printed notes mostly don't match their chord names.
        The {badKeys} other keys where the manual's notes and names disagree are never suggested.
        Dashed pads play the same chord as a numbered one.
      </p>
    </>
  );
}

/* ============================================================================
   THE PAGE
   ========================================================================== */
export default function J6App() {
  const [tab, setTab] = useState("explore");
  const [sound, setSound] = useState("grand");
  const audio = useInstrument();
  const [state, dispatch] = useReducer(pr.explore, pr.START);
  const [set, setSet] = useState(54);
  const [t, setT] = useState(0);
  const [opts, setOpts] = useState(pb.OPTIONS);
  const [along, setAlong] = useState(null);           // the scale chosen to play over the progression (D-092)
  useEffect(() => { audio.setInstrument(sound); }, [sound]); // eslint-disable-line
  const stopAll = useCallback(() => audio.panic(), [audio]);

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px", color: J.ink }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>J-6 Explorer</h1>
          <a href="../" style={{ fontSize: 12, color: J.homeDot }}>← Sketchpad</a>
        </div>
        <Segmented label="screen" value={tab} onChange={(id) => { stopAll(); setTab(id); }} options={[["explore", "Explore"], ["find", "Find"]]} />
      </header>

      {tab === "explore"
        ? <Explore audio={audio} state={state} dispatch={dispatch} set={set} setSet={setSet} t={t} setT={setT} opts={opts} setOpts={setOpts} along={along} setAlong={setAlong} />
        : <Find audio={audio} dispatch={dispatch} />}

      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          Sound <Segmented label="sound" value={sound} onChange={setSound} options={[["grand", "Piano"], ["pad", "Pad"]]} />
        </span>
        <Button onClick={stopAll}>Stop sound</Button>
      </footer>

      {/* what only the hardware can confirm stays visible until it has (D-081, D-083) */}
      <p style={{ fontSize: 11.5, color: J.inkSoft, marginTop: 14, lineHeight: 1.45 }}>
        KEY is SHIFT + [A (KEY)] on the J-6: it transposes the keyboard. Not yet checked on a J-6: its range (the manual doesn't give one; the app assumes −6 to +5), that + goes up, and that the high C pad plays the C chord.
        Chord data: the J-6 manual's Chord Set List, all {SET_NUMBERS.length} sets, checked key by key.
      </p>
    </main>
  );
}
