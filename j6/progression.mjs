/* Playing a chord versus keeping it. (D-089, UC-64, UC-65)

   Tapping a J-6 key used to both play it and add it to the progression, so
   trying chords out filled the progression with chords nobody chose. Now a
   tap plays and shows the chord; it is kept only by "+ Add", or by every tap
   while Rec is on, for copying down what was just played on the hardware.

   Pure: the page holds this state with useReducer and does the sound. Each
   chord kept remembers its own set and KEY, so a progression can mix sets. */
import { chordAt, KEYS } from "./j6.mjs";

/** { rec, current, items }: current is the last key tapped, items the progression. */
export const START = { rec: false, current: null, items: [] };

/** A key on the J-6: set, key index 0–11, KEY transpose. */
const at = (set, key, t) => ({ set, key, t });

export function explore(state, action) {
  switch (action.type) {
    case "tap": {
      const k = at(action.set, action.key, action.t);
      return { ...state, current: k, items: state.rec ? [...state.items, k] : state.items };
    }
    case "add":
      return state.current ? { ...state, items: [...state.items, state.current] } : state;
    case "addMany":
      return { ...state, items: [...state.items, ...action.items] };
    case "remove":
      return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case "undo":
      return { ...state, items: state.items.slice(0, -1) };
    case "clear":
      return { ...state, items: [] };
    case "rec":
      return { ...state, rec: action.on };
    default:
      return state;
  }
}

/** What the J-6 plays for a kept or tapped key. */
export const resolve = (k) => chordAt(k.set, k.key, k.t);

/** The chords the key is judged from: the progression once it has any, the last key tapped before that. */
export const keyFocus = (state) => (state.items.length ? state.items : state.current ? [state.current] : []);

/** A search result's keys to press, in the order of the progression searched for. */
export const fromSearch = (result) =>
  result.rows.filter((r) => r.keys.length).map((r) => at(result.set, KEYS.indexOf(r.keys[0]), result.transpose));
