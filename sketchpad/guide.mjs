/* sketchpad/guide — The How to use text, as data, so that no tab can ship undocumented.
   Layer 0. Depends on: nothing. Pure: no React, no Tone, no DOM, no dates, no randomness.
   Interface, behaviour and requirements: sketchpad/MODULES.md (guide).
   Moved verbatim from the THEORY block of sketchpad.jsx (D-096); behaviour unchanged. */


const GUIDE = [
  { id: "start", tab: null, title: "Start here",
    lead: "This is a sketchpad for finding chords that work together, hearing them, and understanding why afterwards. Nothing has to be read in order, and if you would rather be led, the Learn tab has short lessons you practise on the piano.",
    points: [
      "Pick the key your track is in at the top. Everything below rebuilds around it.",
      "Tap a chord. It lights up on the piano and stays lit, so you can copy it onto your own keyboard.",
      "The line under the piano always explains whatever you just did. It is the whole idea of the app in one sentence at a time.",
      "If you only do one thing: pick a key, tap four chords with “add”, and press Play in the Progression tab.",
    ] },

  { id: "levels", tab: null, title: "How much is on screen",
    lead: "The app has more in it than anyone needs at first, so it starts small. The control at the top right chooses how much is shown, and each level only adds to the one before it.",
    points: [
      "Start — a key, some chords, a loop and the lessons. Everything you need to make something in a minute, or to learn how.",
      "Produce — the working tools: richer chords, voicings, chord sets, bass ideas, riffs and the printable sheet.",
      "Study — where it all comes from: the chord dictionary, inversions, harmonisation, and the more formal wording.",
      "Nothing ever moves or disappears when you go up a level, so anything you have found stays where you found it.",
      "If the screen feels busy, drop back to Start. Your key, loop and chords are kept.",
    ] },

  { id: "piano", tab: null, title: "Reading the piano",
    lead: "The keyboard says two different things at once, and it uses two different signals so neither hides the other.",
    points: [
      "Orange fill is harmony — the chord you have selected right now. The one with a dark ring is its root.",
      "Pale orange is a note used somewhere else in your loop.",
      "A teal dot underneath means the note is in your scale. The larger glowing dot is the home note of the key.",
      "So: orange with a dot is a safe, strong note. Orange with no dot is a note from outside the scale — usually the interesting one.",
      "A chord lights only in the octave it will actually sound in, so you can play it at the right height without guessing.",
      "Drag the keyboard sideways for more range, or use the ‹ Oct › control above the piano, beside Fingers. Press and hold a key to sustain it.",
      "Fingers puts a suggested finger on each lit key, 1 the thumb to 5 the little finger: solid discs for the right hand, outlined purple for the left. Both puts the bass in the left hand and the chord in the right.",
      "Hand reaches sets how wide one hand can stretch; a chord wider than that is split between the hands. The app can't see your fingers, so it suggests and never checks.",
    ] },

  { id: "sound", tab: null, title: "Sound controls",
    lead: "Under the piano, “Sound options” opens the choices. They work from any tab.",
    points: [
      "Sound options holds four rows: the instrument, how notes are played, the reverb, and the echo. “Played” is one setting for chords and scales: together, roll, slow roll, up, down, up & down, or random. The Scales tab shows the same buttons, the four that run, and pressing one plays the scale that way. The grand piano, Strings and Vibraphone are real recordings, built into the app — nothing is downloaded and they work offline. Strings and Vibraphone come from public-domain (CC0) libraries.",
      "The recordings are the Salamander Grand Piano by Alexander Holm, used under CC-BY 3.0, shortened and re-encoded to fit in the file. Thirteen notes from C1 to C7 are embedded and everything between them is one of those played faster or slower, never by more than three semitones. If you publish this, keep that credit.",
      "Echo is one switch with a setting chosen to suit each instrument. It flatters the Rhodes and the pad in particular. “test sound” and “reset audio” are in there too, for when something sounds wrong.",
      "Changing tab, or stopping the loop, stops whatever is ringing, and leaves everything you have built.",
      "If the browser pauses audio — usually after switching apps — a banner appears offering to resume it.",
    ] },

  { id: "chords", tab: "chords", title: "Chords",
    lead: "What can I play in this key, and how should I arrange it?",
    points: [
      "The seven chords shown are the ones built from your key. Triads are the simplest; 7ths and 9ths are richer and are what soul, house and R&B actually use.",
      "“add” puts a chord into your loop. It also selects it, so the Bass and Theory tabs follow along.",
      "The Voicing list is the same chord arranged differently. This is most of what separates a chord that sounds like a record from one that sounds like an exercise — try Open and Spread on a 9th.",
      "Chord sets are ready-made palettes by style, each with a progression you can take whole with “add all”.",
      "If a chord contains notes from outside your key, a panel appears naming the scale it belongs to.",
    ] },

  { id: "find", tab: "find", title: "Find",
    lead: "The other direction: play notes, and the app tells you what you made.",
    points: [
      "On this tab, tapping the piano chooses notes instead of playing them momentarily. Tap again to remove one.",
      "You get every reading, not one. E G# B C# genuinely is both E6 and C#m7/E — which it is depends on the bass, and the app says so.",
      "It also shows which keys those notes fit and which scales contain them, tightest fit first.",
      "Save a set as a chord and it behaves like any other chord, with your voicing kept exactly as you played it.",
      "Save five to eight notes as a scale. If it has seven, it harmonises into its own chords.",
    ] },

  { id: "scales", tab: "scales", title: "Scales",
    lead: "Which notes can I play over this, and what will they feel like?",
    points: [
      "Start from the style row if you know the mood you want. Scales that suit it are marked and listed first, with the chord colours that go with them.",
      "Selecting a scale marks its notes on the piano and, where it differs from the last one by a single note, names that note. That one note is usually the whole difference.",
      "The ▲ ▼ ⤨ buttons play the scale up, down, or shuffled. Hearing two scales back to back teaches more than reading about them.",
      "The chords in the Chords tab are built from whichever scale you select here.",
    ] },

  { id: "prog", tab: "prog", title: "Progression",
    lead: "Your loop, and everything the app can tell you about it.",
    points: [
      "Type chord names at the top, as a chord chart writes them: “Am7 F#m7 Dm7 G7sus4”. Anything it can't read turns red with a suggestion, and the keys the chords fit are offered.",
      "Tap a chord in the loop to remove it. Play loops it at whatever tempo you set.",
      "“Why it works” describes each move, including the wrap back to the first chord, naming the notes the chords share.",
      "“What could come next” suggests chords ranked by how harmony actually behaves — a fourth up scores highest, and coming home scores once the loop is long enough to want it.",
      "“Voice leading” shows which notes hold and which move between each pair, plus the smoothest way to play the next chord.",
      "“Scales that fit” ranks scales against the notes you actually used, naming what each one misses.",
      "Riffs and basslines: pick a style, then browse the patterns or press “surprise me”. Tap a bar to hear it alone.",
    ] },

  { id: "bass", tab: "bass", title: "Bass",
    lead: "Which note should the low end play, and how do I get to the next chord?",
    points: [
      "The list ranks your options under the current chord: root is safest, the fifth is stable, the third carries the mood, and everything else works best passing through.",
      "It follows whatever chord is selected — or, if you have not selected one, the first chord of your loop.",
      "Below that are four ways of walking to the next chord: direct, through the scale, via its fifth, or chromatically from a semitone below.",
      "Tap any of them to hear it. The chromatic one leaves the key for a beat, which is exactly why it works.",
    ] },

  { id: "sheet", tab: "sheet", title: "Sheet",
    lead: "The sketch on paper, for taking to an instrument when you would rather not look at a screen.",
    points: [
      "Each bar is drawn as a small keyboard with its chord filled in — a chord name on paper tells you nothing you did not already know.",
      "The scale and the bass line are on it too, so nothing has to be worked out again at the instrument.",
      "Press Print for paper, or choose Save as PDF in the print dialogue. Only the sheet prints, not the app around it.",
      "Copy as text gives the same thing without pictures, for pasting into notes.",
      "Tick Show suggested fingering to print finger numbers on each chord and on the bass: solid for the right hand, outlined for the left.",
      "There is no theory on it yet, deliberately: the sheet is for playing, and the app is where the explaining happens.",
    ] },

  { id: "theory", tab: "theory", title: "Theory",
    lead: "Where all of it comes from. Read this after playing, not before.",
    points: [
      "“Build it” walks through making a chord out of your scale one note at a time, lighting the piano as it goes. Start on a note, skip one, take the next.",
      "The dictionary has fifteen chord types on your root, each with its formula and what it is for. It always plays them in close position so the differences are clear.",
      "Inversions are the same chord with a different note at the bottom. The chord does not change; its weight does.",
      "The bass paragraph is the short version of everything the Bass tab does.",
    ] },

  { id: "learn", tab: "learn", title: "Learn",
    lead: "Short lessons on notes, scales and chords that you practise on the piano, with the app listening to each note you play.",
    points: [
      "Pick a lesson and read one line about it. Each step asks you to play something: a note, a scale, or a chord.",
      "Play it on the piano. Each note is answered straight away, and a wrong one is explained: how many keys you counted, which scale note a chord skips, or how big the next step of a scale is.",
      "Chords can be played one note at a time or all together, in any octave. Scales have to go the way the step says, up or down.",
      "“Hint” first tells you how to find the next note, by counting keys or by the black keys around it. Press it again to light the note. “Show me” plays the whole answer.",
      "When a step is done, “Take away” gives you the rule that works in every key, and chords show their shape of white and black keys, shared with other chords.",
      "Lessons follow the key at the top. When you finish one, “next key” moves one step round the circle of fifths so you can play it again somewhere new.",
      "Lessons that end in a progression can send it straight to your loop, ready to play in the Progression tab.",
    ] },
];

const guideFor = (tabId) => GUIDE.filter((g) => g.tab === tabId);


/* How many sentences is this? The beginner cap in D-011 was written as a rule
   and never checked; two thirds of explanations broke it. (D-051) */
const sentenceCount = (text) => (String(text).match(/[.!?](?:\s|$)/g) || []).length;

export { GUIDE, guideFor, sentenceCount };
