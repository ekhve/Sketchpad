/* Pulls the THEORY block out of sketchpad.jsx and writes theory.mjs.
   Tests therefore run against the code that actually ships, not a copy. */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(process.argv[2], "utf8");
const start = src.indexOf("/* THEORY:START");
const end = src.indexOf("/* THEORY:END */");
if (start < 0 || end < 0) { console.error("THEORY markers not found"); process.exit(1); }

const block = src.slice(src.indexOf("*/", start) + 2, end);
const exports = `
export { NAMES, SOLFEGE, pc, isWhite, noteName, chordLabel, SCALES, scaleById,
  scalePcs, romanFor, voice, harmonize, explainChord, fitScales, keyRole, keyMarker,
  STEPS_PER_BAR, PATTERNS, STYLES, patternsFor, place, rng,
  renderFigure, renderProgressionFigure, explainFigure, planBar, planIsClean, VOICES, VELOCITY,
  stackAscending, DICTIONARY, DEGREE_NAMES, dictionaryFor, inversions,
  bassOptions, BASS_PARAGRAPH, bassTransitions, CHORD_SETS, buildSet, setsFor,
  explainProgression, MAX_VOICES, voiceLifetime, reapVoices, allocatable, activeChordFor, INSTRUMENTS, instrumentById, delaySettings, SPACES, reverbSettings, voicingsFor, DEFAULT_BASE, barsToSchedule, barSecondsAt,
  suggestScaleFor, harmonizeSteps, voiceLeading, suggestNextChords,
  identifyChord, keysContaining, scalesContaining, arpeggio, smoothestVoicing, SIGNATURES, harmonizeIntervals,
  customChordFrom, customScaleFrom, customScalePcs, harmonizeCustom,
  STYLE_COLOURS, scalesForStyle, activeScalePcs, TAB_IDS, GUIDE, guideFor, sentenceCount, base64Payload, payloadBytes, ROLL_STYLES, rollStyleById, rollOffsets, pickVoiceIndex, MAX_HELD, heldAfterDown, heldAfterUp, slideTo, notesUnderFingers, keyAtPosition,
  melodyRole, MELODY_ROLES, melodyGuide, changedNotes, describeChange,
  TENSION_LEVELS, BORROWED, chordsAtTension,
  diagramKeys, diagramRange, sheetData, sheetAsText,
  LEVELS, levelIndex, featuresAt, has, tabsAt, TABS_BY_FEATURE, UC00_NEEDS,
  PIANO_RANGE, KEYBOARD_OCTAVES, HIGHEST_START_MIDI, PIANO_SAMPLES,
  sampleMidi, sampleAnchors, stretchAt, worstStretch,
  LESSON_TOPICS, LESSONS, buildLesson, lessonsFor, practiceNote, practiceFeedback, practiceHint, nextKeyRound,
  QUALITIES, FLAT_NAMES, keyNames, spelling, leansFlat, baseOf,
  keyLandmark, stepWords, toneWord, skipWalk, diagnoseSlip, hintMethod, chordShape,
  parseChordName, parseChordNames, typedChord, typedLabel, CHORD_ALIASES, nearestSuffix, TYPING_CHIPS,
  SCALE_FINGERING, HAND_REACH, DEFAULT_REACH, FINGER_HANDS, FINGER_COPY, handFingers, fitsHand, fingerChord, fingerCrossings, scaleFingering, stepFingering, litLessonFingers, effectiveFingerHand };
`;
writeFileSync(process.argv[3], block + exports);
console.log("extracted", block.split("\n").length, "lines of theory");
