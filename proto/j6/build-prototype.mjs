// Generates explore.svg and find.svg from j6.mjs, so every chord, voicing, numeral and score on
// screen is computed by the engine rather than typed by hand (D-J06). Run: node build-prototype.mjs
import { writeFileSync } from "node:fs";
import * as j from "../../j6/j6.mjs";

const C = {
  bg: "#F3EFE6", card: "#FFFFFF", line: "#E6E1D6", ink: "#1D1B18", soft: "#6F6A60", faint: "#8B857A",
  panel: "#18191C", padDark: "#2A2B2F", padDarkInk: "#C9C9CC", padLight: "#ECE9E2", padLightInk: "#2A2824",
  amber: "#FF9D2E", amberInk: "#1A1206", amberDim: "#FDE7C8", amberDimDark: "#6B4A1F", led: "#FF3B2F",
  good: "#2F7D4F", seg: "#E4DFD3",
};
const FONT = `font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"`;
const MONO = `font-family="ui-monospace,SF Mono,Menlo,monospace"`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const t = (x, y, s, a = "") => `<text x="${x}" y="${y}" ${a}>${esc(s)}</text>`;
const KEYNAME = { "C#": "C♯", "D#": "D♯", "F#": "F♯", "G#": "G♯", "A#": "A♯" };
const kn = (k) => KEYNAME[k] ?? k;

const LOWER = ["C", "D", "E", "F", "G", "A", "B", "C'"];
const UPPER = [["C#", 0], ["D#", 1], ["F#", 3], ["G#", 4], ["A#", 5]];

/** J-6 keyboard: 8 lower pads (the 8th is the high C), 5 upper pads, as on the device. */
function keyboard({ set, transpose = 0, x0, step, w, uw, upperY, upperH, lowerY, lowerH, state }) {
  const out = [];
  const pad = (key, x, y, pw, ph, dark) => {
    const k = key === "C'" ? "C" : key;
    const name = j.nameOf(j.chordAt(set, j.KEYS.indexOf(k), transpose).chord);
    const s = state[key] ?? state[k === key ? key : "__"] ?? {};
    let fill = dark ? C.padDark : C.padLight, ink = dark ? C.padDarkInk : C.padLightInk, extra = "";
    if (s.lit === "now") { fill = C.amber; ink = C.amberInk; extra = ` filter="url(#glow)"`; }
    if (s.lit === "dim") { fill = dark ? C.amberDimDark : C.amberDim; ink = dark ? "#FFE3BF" : C.padLightInk; }
    out.push(`<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="5" fill="${fill}"${extra}/>`);
    if (s.alt) out.push(`<rect x="${x + 1.5}" y="${y + 1.5}" width="${pw - 3}" height="${ph - 3}" rx="4" fill="none" stroke="${C.amber}" stroke-width="1.5" stroke-dasharray="3 2.5"/>`);
    out.push(t(x + pw / 2, y + 13, key === "C'" ? "C′" : kn(key), `${FONT} font-size="8.5" text-anchor="middle" fill="${ink}" opacity="0.7"`));
    out.push(t(x + pw / 2, y + ph - 9, name, `${FONT} font-size="${Math.min(9, (pw - 5) / (name.length * 0.62)).toFixed(1)}" font-weight="600" text-anchor="middle" fill="${ink}"`));
    if (s.step) {
      out.push(`<circle cx="${x + pw - 3}" cy="${y + 3}" r="7.5" fill="${C.ink}" stroke="${C.amber}" stroke-width="1.2"/>`);
      out.push(t(x + pw - 3, y + 6.5, s.step, `${FONT} font-size="9" font-weight="700" text-anchor="middle" fill="${C.amber}"`));
    }
  };
  LOWER.forEach((k, i) => pad(k, x0 + i * step, lowerY, w, lowerH, false));
  UPPER.forEach(([k, i]) => {
    const mid = x0 + i * step + w + (step - w) / 2;
    pad(k, mid - uw / 2, upperY, uw, upperH, true);
  });
  return out.join("\n");
}

const defs = `<defs><filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
const card = (y, h) => `<rect x="12" y="${y}" width="366" height="${h}" rx="16" fill="${C.card}" stroke="${C.line}"/>`;
const label = (x, y, s) => t(x, y, s, `${FONT} font-size="10" letter-spacing="1.5" fill="${C.faint}"`);
function header(active) {
  const tabs = ["Explore", "Find"].map((name, i) => {
    const x = 208 + i * 82, on = name === active;
    return (on ? `<rect x="${x}" y="20" width="82" height="26" rx="13" fill="${C.card}"/>` : "") +
      t(x + 41, 37, name, `${FONT} font-size="12.5" font-weight="${on ? 600 : 500}" text-anchor="middle" fill="${on ? C.ink : C.soft}"`);
  }).join("");
  return t(16, 38, "J-6 Explorer", `${FONT} font-size="19" font-weight="700" fill="${C.ink}"`) +
    `<rect x="206" y="18" width="168" height="30" rx="15" fill="${C.seg}"/>` + tabs;
}

/* ================= EXPLORE ================= */
function explore() {
  const SET = 54;
  const played = ["C", "C#", "G", "D#"];
  const chords = played.map((k) => j.chordAt(SET, j.KEYS.indexOf(k)));
  const keys = j.likelyKeys(chords.map((c) => c.chord));
  const tonic = keys[0].tonic;
  const now = chords.at(-1);
  const nowName = j.nameOf(now.chord);
  const state = Object.fromEntries(played.map((k, i) => [k, { lit: i === played.length - 1 ? "now" : "dim", step: i + 1 }]));
  state["C'"] = state.C ? { lit: "dim" } : {};

  const ivals = j.CHORD_PCS[now.chord.quality];
  const DEG = { 0: "root", 3: "♭3rd", 4: "3rd", 7: "5th", 9: "6th", 10: "♭7th", 11: "7th", 2: "9th" };
  const pcs = ivals.map((i) => (now.chord.root + i) % 12);
  const noteName = (pc) => j.FLAT_NAMES[pc];
  const voiceStr = now.midi.map((m) => noteName(m % 12) + (Math.floor(m / 12) - 1)).join("  ");
  const scale = [0, 2, 4, 5, 7, 9, 11].map((i) => (tonic + i) % 12);
  const second = keys[1];

  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 970" width="390" height="970">`, defs);
  o.push(`<rect width="390" height="970" fill="${C.bg}"/>`, header("Explore"));

  // J-6 panel
  o.push(`<rect x="12" y="64" width="366" height="240" rx="16" fill="${C.panel}"/>`);
  o.push(`<rect x="26" y="80" width="84" height="44" rx="6" fill="#0B0B0C"/>`);
  o.push(t(68, 113, String(SET), `${MONO} font-size="30" font-weight="700" text-anchor="middle" fill="${C.led}"`));
  o.push(label(122, 92, "CHORD SET"));
  o.push(t(122, 111, j.SETS[SET].genre, `${FONT} font-size="15" font-weight="600" fill="#F2F2F2"`));
  o.push(t(122, 125, "KEY 0  ·  chord mode", `${FONT} font-size="10" fill="#8A8A8A"`));
  for (const [cx, ch] of [[314, "‹"], [352, "›"]]) {
    o.push(`<circle cx="${cx}" cy="102" r="15" fill="${C.padDark}" stroke="#3A3B40"/>`);
    o.push(t(cx, 108, ch, `${FONT} font-size="19" text-anchor="middle" fill="#EDEDED"`));
  }
  ["FILTER", "ENV", "DELAY", "REVERB"].forEach((n, i) => {
    o.push(`<circle cx="${44 + i * 46}" cy="148" r="8" fill="#232428" stroke="#34353A"/>`);
    o.push(t(44 + i * 46, 168, n, `${FONT} font-size="7" text-anchor="middle" fill="#55565C"`));
  });
  o.push(t(362, 152, "sound controls: display only", `${FONT} font-size="8" text-anchor="end" fill="#55565C"`));
  o.push(keyboard({ set: SET, x0: 25, step: 43, w: 37, uw: 32, upperY: 178, upperH: 46, lowerY: 232, lowerH: 62, state }));

  o.push(t(16, 322, "Tap the keys in the order you played them on your J-6.", `${FONT} font-size="11" fill="${C.soft}"`));

  // NOW card
  const roman = j.romanOf(now.chord, tonic);
  o.push(card(334, 176), label(28, 358, "NOW"));
  o.push(t(28, 400, nowName, `${FONT} font-size="40" font-weight="700" fill="${C.ink}"`));
  o.push(`<rect x="262" y="366" width="100" height="30" rx="15" fill="${C.amber}"/>`);
  o.push(t(312, 386, roman, `${FONT} font-size="15" font-weight="700" text-anchor="middle" fill="${C.amberInk}"`));
  o.push(t(312, 413, `in ${noteName(tonic)} major`, `${FONT} font-size="11" text-anchor="middle" fill="${C.soft}"`));
  o.push(t(28, 424, `J-6 key ${kn(now.key)}  ·  manual says ${now.label}`, `${FONT} font-size="11" fill="${C.faint}"`));
  pcs.forEach((pc, i) => {
    const x = 28 + i * 56;
    o.push(`<rect x="${x}" y="438" width="50" height="34" rx="8" fill="${i === 0 ? C.amber : C.amberDim}"/>`);
    o.push(t(x + 25, 461, noteName(pc), `${FONT} font-size="16" font-weight="600" text-anchor="middle" fill="${C.amberInk}"`));
    o.push(t(x + 25, 488, DEG[ivals[i]], `${FONT} font-size="9" text-anchor="middle" fill="${C.faint}"`));
  });
  o.push(t(262, 452, "J-6 VOICING", `${FONT} font-size="8.5" letter-spacing="1" fill="${C.faint}"`));
  o.push(t(262, 470, voiceStr, `${MONO} font-size="11.5" fill="${C.ink}"`));
  o.push(t(262, 488, "low → high", `${FONT} font-size="9" fill="${C.faint}"`));

  // PIANO card — lights the actual J-6 voicing (D-J02)
  o.push(card(522, 134), label(28, 546, "PIANO"));
  o.push(t(310, 549, "Show", `${FONT} font-size="11" text-anchor="end" fill="${C.soft}"`));
  o.push(`<rect x="318" y="532" width="44" height="24" rx="12" fill="${C.good}"/><circle cx="350" cy="544" r="9" fill="#fff"/>`);
  const startMidi = 48, W = 334 / 14, px0 = 28, py = 558;
  const whites = [], blacks = [];
  for (let m = startMidi, wi = 0; m < startMidi + 24; m++) {
    const pc = m % 12, isBlack = [1, 3, 6, 8, 10].includes(pc);
    const on = now.midi.includes(m), root = on && pc === now.chord.root;
    if (!isBlack) {
      const x = px0 + wi * W;
      whites.push(`<rect x="${x.toFixed(1)}" y="${py}" width="${(W - 1.5).toFixed(1)}" height="86" rx="3" fill="${root ? C.amber : on ? C.amberDim : "#FBFAF7"}" stroke="#D8D2C5"/>`);
      if (on) whites.push(t((x + W / 2 - 0.75).toFixed(1), py + 78, noteName(pc), `${FONT} font-size="10" font-weight="700" text-anchor="middle" fill="${C.amberInk}"`));
      if (m === startMidi || m === startMidi + 12) whites.push(t((x + W / 2 - 0.75).toFixed(1), py + 78, on ? "" : `C${m / 12 - 1}`, `${FONT} font-size="8" text-anchor="middle" fill="${C.faint}"`));
      wi++;
    } else {
      const x = px0 + wi * W - 7;
      blacks.push(`<rect x="${x.toFixed(1)}" y="${py}" width="14" height="52" rx="2" fill="${root ? C.amber : on ? "#C98A3E" : "#3A3835"}"/>`);
    }
  }
  o.push(...whites, ...blacks);

  // KEY card
  o.push(card(668, 98), label(28, 692, "KEY"));
  o.push(t(28, 722, `${noteName(tonic)} major`, `${FONT} font-size="22" font-weight="700" fill="${C.ink}"`));
  o.push(t(362, 712, `all ${keys[0].inKey} chords fit`, `${FONT} font-size="11" text-anchor="end" fill="${C.ink}"`));
  o.push(t(362, 728, `next: ${noteName(second.tonic)} major, ${second.inKey} of ${chords.length}`, `${FONT} font-size="10.5" text-anchor="end" fill="${C.faint}"`));
  scale.forEach((pc, i) => {
    const cx = 40 + i * 32, inChord = pcs.includes(pc), root = pc === now.chord.root;
    o.push(`<circle cx="${cx}" cy="746" r="12" fill="${root ? C.amber : inChord ? C.amberDim : "none"}" stroke="${inChord ? "none" : "#D8D2C5"}"/>`);
    o.push(t(cx, 750.5, noteName(pc), `${FONT} font-size="11" font-weight="600" text-anchor="middle" fill="${C.ink}"`));
  });

  // PROGRESSION card
  o.push(card(778, 132), label(28, 802, "PROGRESSION"));
  [["↶ Undo", 206, 46], ["Clear", 258, 44], ["▶ Play", 308, 54]].forEach(([s, x, w], i) => {
    o.push(`<rect x="${x}" y="788" width="${w}" height="24" rx="12" fill="${i === 2 ? C.ink : C.seg}"/>`);
    o.push(t(x + w / 2, 804, s, `${FONT} font-size="11" font-weight="600" text-anchor="middle" fill="${i === 2 ? "#fff" : C.ink}"`));
  });
  chords.forEach((c, i) => {
    const x = 20 + i * 88, cur = i === chords.length - 1;
    o.push(`<rect x="${x}" y="822" width="80" height="74" rx="10" fill="${cur ? "#FFF3E2" : "#F7F4EE"}" stroke="${cur ? C.amber : C.line}" stroke-width="${cur ? 2 : 1}"/>`);
    o.push(t(x + 40, 848, j.nameOf(c.chord), `${FONT} font-size="15" font-weight="700" text-anchor="middle" fill="${C.ink}"`));
    o.push(t(x + 40, 868, j.romanOf(c.chord, tonic), `${FONT} font-size="12" text-anchor="middle" fill="${C.soft}"`));
    o.push(t(x + 40, 886, `J-6 key ${kn(c.key)}`, `${FONT} font-size="9" text-anchor="middle" fill="${C.faint}"`));
    if (i < chords.length - 1) o.push(t(x + 84, 863, "›", `${FONT} font-size="12" text-anchor="middle" fill="#B9B2A5"`));
  });

  // Sound
  o.push(t(16, 945, "Sound", `${FONT} font-size="12" font-weight="600" fill="${C.ink}"`));
  o.push(`<rect x="64" y="926" width="150" height="30" rx="15" fill="${C.seg}"/><rect x="66" y="928" width="73" height="26" rx="13" fill="${C.card}"/>`);
  o.push(t(102.5, 945, "Piano", `${FONT} font-size="12" font-weight="600" text-anchor="middle" fill="${C.ink}"`));
  o.push(t(177, 945, "Pad", `${FONT} font-size="12" text-anchor="middle" fill="${C.soft}"`));
  o.push(t(374, 945, `Set ${SET} · KEY 0`, `${FONT} font-size="10" text-anchor="end" fill="${C.faint}"`));
  o.push(`</svg>`);
  return o.join("\n");
}

/* ================= FIND ================= */
function find() {
  const QUERY = "Dm7 G7 Cmaj7 Am7";
  const SETS = [29, 47, 54];
  const results = j.search(QUERY, { sets: SETS, mode: "musical", transpose: true });
  const best = results[0];
  const KIND = { exact: "Exact", inversion: "Inversion", close: "Close", none: "Missing" };
  const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

  const state = {};
  best.rows.forEach((r, i) => {
    const [first, ...rest] = r.keys;
    state[first] = { lit: "now", step: i + 1 };
    rest.forEach((k) => { if (!state[k]) state[k] = { alt: true }; });
  });
  if (state.C && !state["C'"]) state["C'"] = { alt: true }; // the high C pad plays the same chord (assumption, D-J05)

  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 896" width="390" height="896">`, defs);
  o.push(`<rect width="390" height="896" fill="${C.bg}"/>`, header("Find"));

  // input
  o.push(card(64, 132), label(28, 88, "PROGRESSION YOU WANT"));
  o.push(`<rect x="28" y="98" width="334" height="44" rx="10" fill="#F7F4EE" stroke="#D9D3C6"/>`);
  o.push(t(42, 126, QUERY.split(" ").join("  "), `${MONO} font-size="16" fill="${C.ink}"`));
  o.push(`<rect x="${(46 + QUERY.split(" ").join("  ").length * 9.7).toFixed(0)}" y="109" width="1.6" height="22" fill="${C.amber}"/>`);
  let cx = 28;
  QUERY.split(" ").forEach((s) => {
    const name = j.nameOf(j.parseChord(s)), w = 26 + name.length * 7.2;
    o.push(`<rect x="${cx}" y="154" width="${w}" height="26" rx="13" fill="${C.amberDim}"/>`);
    o.push(t(cx + w / 2, 171.5, `✓ ${name}`, `${FONT} font-size="11.5" font-weight="600" text-anchor="middle" fill="${C.amberInk}"`));
    cx += w + 6;
  });

  // options
  o.push(`<rect x="12" y="208" width="170" height="30" rx="15" fill="${C.seg}"/><rect x="97" y="210" width="83" height="26" rx="13" fill="${C.card}"/>`);
  o.push(t(55, 227, "Exact", `${FONT} font-size="12" text-anchor="middle" fill="${C.soft}"`));
  o.push(t(138.5, 227, "Musical", `${FONT} font-size="12" font-weight="600" text-anchor="middle" fill="${C.ink}"`));
  o.push(t(322, 227, "Use KEY transpose", `${FONT} font-size="11.5" text-anchor="end" fill="${C.soft}"`));
  o.push(`<rect x="330" y="211" width="44" height="24" rx="12" fill="${C.good}"/><circle cx="362" cy="223" r="9" fill="#fff"/>`);

  // best match
  const exact = best.rows.filter((r) => r.kind === "exact").length;
  o.push(card(250, 438), label(28, 274, "BEST MATCH"));
  o.push(t(28, 310, `Set ${best.set}`, `${FONT} font-size="30" font-weight="700" fill="${C.ink}"`));
  o.push(t(28, 332, best.genre, `${FONT} font-size="12" fill="${C.soft}"`));
  o.push(`<rect x="252" y="266" width="110" height="30" rx="15" fill="${C.good}"/>`);
  o.push(t(307, 286, `${exact}/${best.rows.length} exact`, `${FONT} font-size="13" font-weight="700" text-anchor="middle" fill="#fff"`));
  o.push(`<rect x="252" y="304" width="110" height="28" rx="14" fill="${C.panel}"/>`);
  o.push(t(307, 323, `KEY ${sign(best.transpose)}`, `${MONO} font-size="13" font-weight="700" text-anchor="middle" fill="${C.amber}"`));

  o.push(`<rect x="28" y="346" width="334" height="142" rx="12" fill="${C.panel}"/>`);
  o.push(keyboard({ set: best.set, transpose: best.transpose, x0: 37, step: 40.5, w: 35, uw: 30, upperY: 358, upperH: 48, lowerY: 414, lowerH: 62, state }));

  o.push(t(28, 512, "On your J-6", `${FONT} font-size="13" font-weight="700" fill="${C.ink}"`));
  o.push(`<rect x="282" y="496" width="80" height="24" rx="12" fill="${C.ink}"/>`);
  o.push(t(322, 512, "▶ Hear it", `${FONT} font-size="11" font-weight="600" text-anchor="middle" fill="#fff"`));
  const keysInOrder = best.rows.map((r) => kn(r.keys[0])).join(" → ");
  [`SHIFT + CHORD, turn to ${best.set}`, `SHIFT + KEY, turn to ${sign(best.transpose)}`, `Play ${keysInOrder}`].forEach((s, i) => {
    const y = 538 + i * 24;
    o.push(`<circle cx="38" cy="${y - 4}" r="9" fill="${C.amberDim}"/>`);
    o.push(t(38, y, i + 1, `${FONT} font-size="10" font-weight="700" text-anchor="middle" fill="${C.amberInk}"`));
    o.push(t(56, y, s, `${FONT} font-size="12" fill="${C.ink}"`));
  });
  o.push(`<line x1="28" y1="598" x2="362" y2="598" stroke="${C.line}"/>`);
  best.rows.forEach((r, i) => {
    const y = 618 + i * 20;
    const alt = r.keys.length > 1 ? `  (or ${r.keys.slice(1).map(kn).join(", ")})` : "";
    o.push(t(28, y, j.nameOf(r.want), `${FONT} font-size="12.5" font-weight="700" fill="${C.ink}"`));
    o.push(t(92, y, `→ key ${kn(r.keys[0])}${alt}`, `${FONT} font-size="12" fill="${C.soft}"`));
    o.push(t(362, y, KIND[r.kind], `${FONT} font-size="11.5" font-weight="600" text-anchor="end" fill="${r.kind === "exact" ? C.good : C.soft}"`));
  });

  // other sets
  const others = results.slice(1, 3);
  o.push(card(700, 44 + others.length * 56), label(28, 724, "OTHER SETS"));
  others.forEach((r, i) => {
    const y = 750 + i * 56;
    const notes = r.rows.filter((w) => w.kind !== "exact").map((w) =>
      w.kind === "none" ? `no ${j.nameOf(w.want)}` : `${j.nameOf(w.got)} for ${j.nameOf(w.want)}`);
    o.push(t(28, y, `Set ${r.set} · ${r.genre}`, `${FONT} font-size="14" font-weight="700" fill="${C.ink}"`));
    o.push(t(362, y, `${Math.round(r.score * 100)}%`, `${FONT} font-size="14" font-weight="700" text-anchor="end" fill="${C.ink}"`));
    o.push(t(28, y + 18, `KEY ${sign(r.transpose)}  ·  ${notes.join("  ·  ")}`, `${FONT} font-size="11" fill="${C.soft}"`));
    o.push(`<rect x="28" y="${y + 28}" width="334" height="4" rx="2" fill="#EFEBE3"/><rect x="28" y="${y + 28}" width="${(334 * r.score).toFixed(1)}" height="4" rx="2" fill="${C.amber}"/>`);
  });
  o.push(t(16, 774 + others.length * 56, `Prototype: ranked over sets ${SETS.join(", ")} only · dashed = same chord`, `${FONT} font-size="10" fill="${C.faint}"`));
  o.push(`</svg>`);
  return o.join("\n");
}

writeFileSync(new URL("explore.svg", import.meta.url), explore());
writeFileSync(new URL("find.svg", import.meta.url), find());
console.log("wrote explore.svg, find.svg");
