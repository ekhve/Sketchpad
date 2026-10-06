/* J-6 Explorer — the page. (UC-64, UC-65)

   A second app in the Sketchpad repository, for the Roland J-6 chord
   synthesizer. Explore answers "what am I playing?", Find answers "how do I
   play this on the J-6?". Every chord, numeral and score comes from the engine
   in j6.mjs, which takes its theory from Sketchpad's (D-086). The piano, the
   sound and the colour tokens are Sketchpad's own, imported rather than copied.
   The layout follows the agreed screens, proto/j6/explore.svg and find.svg. */
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { T, Piano, useInstrument, spelling, scalePcs, pc } from "../sketchpad.jsx";
import * as j from "./j6.mjs";

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
  warn: "#B23A48", warnGround: "#F6E1DF",
};

const KEY_NAMES = j.KEYS.map((k) => k.replace("#", "♯"));
const LOWER = [0, 2, 4, 5, 7, 9, 11, 12];          // 12 is the high C, which plays C (D-083)
const UPPER = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];   // [key, white keys to its left]
const SET_NUMBERS = Object.keys(j.SETS).map(Number).sort((a, b) => a - b);
const [KEY_LO, KEY_HI] = j.TRANSPOSE_RANGE;
const signed = (t) => (t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0");
const DEGREE = { 0: "root", 1: "♭9", 2: "9th", 3: "3rd", 4: "3rd", 5: "4th", 6: "♭5", 7: "5th", 8: "♯5", 9: "6th", 10: "7th", 11: "7th" };
const pitchName = (m, names) => names[pc(m)] + (Math.floor(m / 12) - 1);
const majorKey = (tonic) => `${spelling("letters", tonic).names[tonic]} major`;

/* The key a whole set suggests, for spelling its pads before anything is played. */
const setTonic = (n, t) => j.likelyKeys(j.KEYS.map((_, k) => j.chordAt(n, k, t).chord))[0]?.tonic ?? 0;

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
const Button = ({ children, onClick, dark = false, disabled = false }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ border: 0, borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 700,
      background: dark ? J.ink : J.surface, color: dark ? J.panelInk : J.ink, opacity: disabled ? 0.45 : 1 }}>{children}</button>
);

/* ============================================================================
   THE VIRTUAL J-6 — what every key plays, printed on the pad.
   `marks(k)` says how to draw key k: { order, latest, dashed, lit }.
   ========================================================================== */
function J6Pads({ set, t, tonic, marks, onPress }) {
  const pad = (k, slot, black) => {
    const c = j.chordAt(set, k % 12, t);
    /* the high C plays C's chord (D-083), so it is drawn as the same chord, dashed, never numbered */
    const m = k === 12 ? (({ order, dashed }) => ({ dashed: Boolean(order || dashed) }))(marks(0)) : marks(k);
    const fill = m.latest ? J.padLatest : m.lit ? J.padEarlier : black ? J.padBlack : J.padWhite;
    const ink = m.latest ? J.badgeInk : m.lit ? J.padEarlierInk : black ? J.padInkLight : J.padInkDark;
    return (
      <button key={slot} onClick={() => onPress?.(k % 12)} aria-label={`J-6 key ${KEY_NAMES[k % 12]}${k === 12 ? " (high C)" : ""}: ${j.nameInKey(c.chord, tonic)}`}
        style={{ position: "relative", width: "100%", height: black ? 46 : 62, borderRadius: 6, background: fill, color: ink,
          border: m.dashed ? `1.5px dashed ${J.padLatest}` : 0,
          /* the latest key is told apart by a thick outline as well as by colour (R-351) */
          boxShadow: m.latest ? `0 0 0 3px ${J.panelInk}` : "none",
          display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "4px 2px" }}>
        <span style={{ fontSize: 10, opacity: 0.8 }}>{k === 12 ? "C′" : KEY_NAMES[k]}</span>
        <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1, textAlign: "center", letterSpacing: "-.02em", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden" }}>{j.nameInKey(c.chord, tonic)}</span>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 }}>
        {LOWER.map((k) => <div key={k}>{pad(k, k, false)}</div>)}
      </div>
    </div>
  );
}

function Panel({ set, t, children, onSet, onKey }) {
  const bad = j.validateSet(set);
  return (
    <div style={{ background: J.panel, color: J.panelInk, borderRadius: 18, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div aria-label={`chord set ${set}`} style={{ background: J.ledGround, color: J.led, fontFamily: "ui-monospace,monospace", fontSize: 30, fontWeight: 700, padding: "4px 14px", borderRadius: 6, minWidth: 72, textAlign: "center" }}>{set}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: J.panelSoft }}>CHORD SET</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{j.SETS[set].genre}</div>
          <div style={{ fontSize: 12, color: J.panelSoft }}>KEY {signed(t)} · chord mode</div>
        </div>
        {onSet && (
          <div style={{ display: "flex", gap: 6 }}>
            {[["‹", -1, "previous set"], ["›", 1, "next set"]].map(([s, d, a]) => (
              <button key={s} aria-label={a} onClick={() => onSet(d)} style={{ width: 32, height: 32, borderRadius: 16, border: 0, background: J.padBlack, color: J.panelInk, fontSize: 18 }}>{s}</button>
            ))}
          </div>
        )}
      </div>
      {onKey && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: J.panelSoft }}>
          <span>KEY</span>
          <button aria-label="KEY down" onClick={() => onKey(-1)} disabled={t <= KEY_LO} style={{ width: 28, height: 24, borderRadius: 6, border: 0, background: J.padBlack, color: J.panelInk }}>−</button>
          <span style={{ minWidth: 22, textAlign: "center", color: J.panelInk, fontWeight: 700 }}>{signed(t)}</span>
          <button aria-label="KEY up" onClick={() => onKey(1)} disabled={t >= KEY_HI} style={{ width: 28, height: 24, borderRadius: 6, border: 0, background: J.padBlack, color: J.panelInk }}>+</button>
          <span style={{ marginLeft: "auto", fontSize: 10.5 }}>sound controls: display only</span>
        </div>
      )}
      {bad.length > 0 && (
        <div role="alert" style={{ marginTop: 10, background: J.warnGround, color: J.warn, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
          The manual's chord data for set {set} fails on {bad.length} of 12 keys, so search never suggests it. Its chord names below are the manual's, not what the J-6 may play.
        </div>
      )}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

/* ============================================================================
   EXPLORE — what am I playing? (UC-64)
   ========================================================================== */
function Explore({ audio }) {
  const [set, setSet] = useState(54);
  const [t, setT] = useState(0);
  const [played, setPlayed] = useState([]);
  const [showPiano, setShowPiano] = useState(true);
  const [held, setHeld] = useState([]);

  const chords = played.map((k) => j.chordAt(set, k, t));
  const keys = j.likelyKeys(chords.map((c) => c.chord));
  const best = keys[0], next = keys[1];
  const tonic = best ? best.tonic : setTonic(set, t);
  const names = spelling("letters", tonic).names;
  const latest = chords[chords.length - 1];

  const press = async (k) => {
    setPlayed((p) => [...p, k]);
    await audio.init(); await audio.resume();
    audio.play(j.chordAt(set, k, t).midi, 1.4, undefined, 0.75);
  };
  const changeSet = (d) => {
    const i = SET_NUMBERS.indexOf(set);
    setSet(SET_NUMBERS[(i + d + SET_NUMBERS.length) % SET_NUMBERS.length]);
    setPlayed([]);
  };
  const changeKey = (d) => setT((x) => Math.max(KEY_LO, Math.min(KEY_HI, x + d)));
  const playAll = async () => {
    await audio.init(); await audio.resume();
    chords.forEach((c, i) => setTimeout(() => audio.play(c.midi, 0.95, undefined, 0.75), i * 1000));
  };

  const marks = (k) => {
    const last = played.lastIndexOf(k);
    return { order: last >= 0 ? last + 1 : null, latest: played.length > 0 && played[played.length - 1] === k, lit: last >= 0 };
  };

  const lo = latest ? Math.min(...latest.midi) : 48;
  const hi = latest ? Math.max(...latest.midi) : 72;
  const start = Math.floor(lo / 12) * 12;
  const octaves = Math.max(2, Math.ceil((hi - start + 1) / 12));
  const notes = latest ? j.QUALITIES[latest.chord.quality] : [];

  return (
    <>
      <Panel set={set} t={t} onSet={changeSet} onKey={changeKey}>
        <J6Pads set={set} t={t} tonic={tonic} marks={marks} onPress={press} />
      </Panel>
      <p style={{ fontSize: 13, color: J.inkSoft, margin: "8px 4px" }}>Tap the keys in the order you played them on your J-6.</p>

      <Card>
        <Label>Now</Label>
        {!latest ? (
          <p style={{ fontSize: 14, color: J.inkSoft }}>Tap a key on the J-6 above to see the chord it plays.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>{j.nameInKey(latest.chord, tonic)}</div>
                <div style={{ fontSize: 12.5, color: J.inkSoft, marginTop: 4 }}>J-6 key {KEY_NAMES[j.KEYS.indexOf(latest.key)]} · manual says {latest.label}</div>
              </div>
              {best && (
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
                  <div style={{ fontSize: 11, color: J.inkSoft, marginTop: 3 }}>{DEGREE[iv]}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 11, color: J.inkSoft }}>
                <div style={{ letterSpacing: ".1em" }}>J-6 VOICING</div>
                <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: J.ink }}>{latest.midi.map((m) => pitchName(m, names)).join(" ")}</div>
                <div>low → high</div>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card style={{ paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Piano</Label>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: J.inkSoft }}>Show <Toggle on={showPiano} onChange={setShowPiano} label="show the piano" /></span>
        </div>
        {showPiano && (
          <Piano startMidi={start} octaves={octaves} chordNotes={latest ? latest.midi : []}
            chordRootMidi={latest ? latest.midi.find((m) => pc(m) === latest.chord.root) ?? -1 : -1}
            loopNotes={[]} scaleSet={best ? scalePcs(tonic, "major") : []} tonic={tonic} sounding={held}
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
                <div>{best.inKey === chords.length ? `all ${chords.length} chord${chords.length > 1 ? "s" : ""} fit` : `${best.inKey} of ${chords.length} chords fit`}</div>
                {next && <div style={{ color: J.inkSoft }}>next: {majorKey(next.tonic)}, {next.inKey} of {chords.length}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {scalePcs(best.tonic, "major").map((p) => {
                const inLatest = latest && j.pcsOf(latest.chord).has(p);
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
            <Button onClick={() => setPlayed((p) => p.slice(0, -1))} disabled={!played.length}>↶ Undo</Button>
            <Button onClick={() => setPlayed([])} disabled={!played.length}>Clear</Button>
            <Button dark onClick={playAll} disabled={!played.length}>▶ Play</Button>
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8 }}>
          {chords.map((c, i) => (
            <div key={i} style={{ minWidth: 82, borderRadius: 12, padding: "8px 6px", textAlign: "center",
              background: J.surface, boxShadow: i === chords.length - 1 ? `0 0 0 2px ${J.padLatest}` : `0 0 0 1px ${J.edge}` }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{j.nameInKey(c.chord, tonic)}</div>
              <div style={{ fontSize: 13 }}>{best ? j.romanOf(c.chord, tonic) : ""}</div>
              <div style={{ fontSize: 10.5, color: J.inkSoft }}>J-6 key {KEY_NAMES[j.KEYS.indexOf(c.key)]}</div>
            </div>
          ))}
          {!chords.length && <p style={{ fontSize: 13, color: J.inkSoft }}>Nothing yet.</p>}
        </div>
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

function Find({ audio }) {
  const [text, setText] = useState("Dm7 G7 Cmaj7 Am7");
  const [mode, setMode] = useState("musical");
  const [transpose, setTranspose] = useState(true);

  const tokens = text.split(/[\s,|]+/).filter(Boolean);
  const parsed = tokens.map((s) => { try { return { s, chord: j.parseChord(s) }; } catch (e) { return { s, error: e.message.replace(/^cannot read chord: /, "") }; } });
  const ok = parsed.length > 0 && parsed.every((p) => p.chord);
  const results = useMemo(() => (ok ? j.search(tokens.join(" "), { mode, transpose }) : []), [text, mode, transpose, ok]); // eslint-disable-line
  const best = results[0] && results[0].score > 0 ? results[0] : null;
  const skipped = SET_NUMBERS.filter((n) => j.validateSet(n).length);
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
            <Button dark onClick={hear}>▶ Hear it</Button>
          </div>
          <ol style={{ listStyle: "none", padding: 0, margin: "8px 0", fontSize: 14, display: "grid", gap: 6 }}>
            {[`SHIFT + CHORD, turn to ${best.set}`, `SHIFT + KEY, turn to ${signed(best.transpose)}`,
              `Play ${order.filter((k) => k !== null).map((k) => KEY_NAMES[k]).join(" → ")}`].map((s, i) => (
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
          {results.slice(1).map((r) => (
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
        </Card>
      )}

      <p style={{ fontSize: 11.5, color: J.inkSoft, margin: "8px 4px" }}>
        Ranked over sets {SET_NUMBERS.filter((n) => !skipped.includes(n)).join(", ")}
        {skipped.length ? `; set ${skipped.join(", ")} left out because the manual's data for it doesn't add up` : ""}.
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

      {tab === "explore" ? <Explore audio={audio} /> : <Find audio={audio} />}

      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          Sound <Segmented label="sound" value={sound} onChange={setSound} options={[["grand", "Piano"], ["pad", "Pad"]]} />
        </span>
        <Button onClick={stopAll}>Stop sound</Button>
      </footer>

      {/* what only the hardware can confirm stays visible until it has (D-081, D-083) */}
      <p style={{ fontSize: 11.5, color: J.inkSoft, marginTop: 14, lineHeight: 1.45 }}>
        Not yet checked on a J-6: that KEY runs from −6 to +5 and + transposes up, and that the high C pad plays the C chord.
        Only sets {SET_NUMBERS.join(", ")} of the J-6's 100 are in the app so far.
      </p>
    </main>
  );
}
