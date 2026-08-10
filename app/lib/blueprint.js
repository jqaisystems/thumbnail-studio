// Brand blueprint data + prompt engine for this channel's thumbnails.
// Mirrors docs/BLUEPRINT.md - if you edit one, edit the other.

const COLORWAYS = [
  {
    id: 'signal-red',
    name: 'Signal Red',
    accent: '#E8382B',
    support: '#FFFFFF',
    background: 'dark blurred studio / charcoal #181A1E',
    textRule:
      'White ultra-bold text on rounded solid RED (#E8382B) sticker blocks. Red circle and arrow annotations allowed.',
  },
  {
    id: 'taxi-yellow',
    name: 'Taxi Yellow',
    accent: '#FFC814',
    support: '#FFFFFF',
    background: 'deep charcoal or deep purple #1B1030 with a soft glow behind the subjects',
    textRule:
      'The hero word/number in YELLOW (#FFC814), support words in white, plus one small red (#D6281E) badge strip for the kicker line.',
  },
  {
    id: 'electric-purple',
    name: 'Electric Purple',
    accent: '#8B3DFF',
    support: '#FFFFFF',
    background: 'purple-to-black radial glow, #2A1052 center fading to #0B0614 edges',
    textRule:
      'White ultra-bold sticker text with hard shadow; purple rim-light on the people.',
  },
  {
    id: 'cyan-circuit',
    name: 'Cyan Circuit',
    accent: '#19D3F0',
    support: '#FFFFFF',
    background: 'near-black blue #06121E with faint glowing circuit / HUD lines',
    textRule:
      'White ultra-bold text with a subtle cyan (#19D3F0) glow edge; cyan holographic UI accents.',
  },
  {
    id: 'lime-signal',
    name: 'Lime Signal',
    accent: '#B6F034',
    support: '#0C0E10',
    background: 'clean dark gray #15171A studio backdrop',
    textRule:
      'LIME (#B6F034) sticker blocks with BLACK ultra-bold text (this is the only colorway with dark text).',
  },
  {
    id: 'hot-magenta',
    name: 'Hot Magenta',
    accent: '#FF2D78',
    support: '#FFFFFF',
    background: 'magenta-to-indigo gradient, #3A0B2E to #120A2A',
    textRule:
      'White ultra-bold text; the money number sits on a MAGENTA (#FF2D78) sticker block.',
  },
  {
    id: 'cobalt-bolt',
    name: 'Cobalt Bolt',
    accent: '#2E6BFF',
    support: '#FFFFFF',
    background: 'deep navy #0A1228 with a cobalt glow behind the subjects',
    textRule:
      'White sticker text on cobalt (#2E6BFF) blocks; at most ONE word highlighted in yellow (#FFC814).',
  },
];

const ARCHETYPES = [
  {
    id: 'sticker-statement',
    letter: 'A',
    name: 'Sticker Statement',
    needsGuest: false,
    layout: (p) =>
      `LAYOUT: Solo close-up. The host chest-up on the RIGHT third of the frame, direct eye contact with the camera, ${p.expression}. The LEFT half is dominated by 2-3 stacked lines of giant text. Nothing else in the frame.`,
    guestLayout: (p) =>
      `LAYOUT: Duo statement. The guest and the host side by side on the RIGHT half of the frame, both chest-up: the guest slightly in front, ${p.guestMoodWord}; the host just behind, ${p.expression}. The LEFT half is dominated by 2-3 stacked lines of giant text. Nothing else in the frame.`,
  },
  {
    id: 'prop',
    letter: 'B',
    name: 'The Prop',
    needsGuest: false,
    layout: (p) =>
      `LAYOUT: Proof prop. The host on the right, holding ${p.prop} toward the camera so it is clearly readable. One key detail on the prop is circled in red with a hand-drawn red arrow pointing at it. Smaller headline text top-left.`,
    guestLayout: (p) =>
      `LAYOUT: Proof prop duo. The guest holds ${p.prop} toward the camera so it is clearly readable, ${p.guestMoodWord}; the host beside them, ${p.expression}, pointing at one key detail circled in red with a hand-drawn red arrow. Smaller headline text top-left.`,
  },
  {
    id: 'guest-duo',
    letter: 'C',
    name: 'Guest Duo',
    needsGuest: true,
    layout: (p) =>
      `LAYOUT: Interview duo. The GUEST in the foreground left-of-center, ${p.guestMoodWord} and well-lit, they are the story. The host slightly behind on the right, ${p.expression}. Both cleanly cut out on the glowing background. Headline text stacked on the far left.`,
  },
  {
    id: 'big-number',
    letter: 'D',
    name: 'Big Number',
    needsGuest: false,
    layout: (p) =>
      `LAYOUT: Big number. The number "${p.number}" rendered HUGE, about half the frame height, as the dominant element, left/center. The host beside or slightly behind it, ${p.expression}. A short 2-4 word kicker on a small badge strip under the number.`,
    guestLayout: (p) =>
      `LAYOUT: Big number duo. The number "${p.number}" rendered HUGE, about half the frame height, as the dominant element, left/center. The guest and the host beside it: the guest ${p.guestMoodWord}, the host ${p.expression}. A short 2-4 word kicker on a small badge strip under the number.`,
  },
  {
    id: 'tech-immersive',
    letter: 'E',
    name: 'Tech Immersive',
    needsGuest: false,
    guestOptional: true, // duo only when the project asks for guest-everywhere
    layout: (p) =>
      `LAYOUT: Tech immersive. The host centered in a believable futuristic workspace, ${p.expression}, hands raised interacting with floating holographic dashboards, AI agent chat windows, and code panels. Cinematic depth. One clean single-line headline across the top of the frame.`,
    guestLayout: (p) =>
      `LAYOUT: Tech immersive duo. The guest and the host together in a believable futuristic workspace, both interacting with floating holographic dashboards and AI agent windows: the guest ${p.guestMoodWord} in front, the host ${p.expression} beside them. Cinematic depth. One clean single-line headline across the top of the frame.`,
  },
  {
    id: 'split-versus',
    letter: 'F',
    name: 'Split / Versus',
    needsGuest: false,
    layout: (p) =>
      `LAYOUT: Split screen. The frame divided by a bold DIAGONAL seam into two contrasting halves (${p.split}). The host positioned on the seam or on one side, glancing toward the winning half. One short text block per half.`,
    guestLayout: (p) =>
      `LAYOUT: Split screen duo. The frame divided by a bold DIAGONAL seam into two contrasting halves (${p.split}). The guest stands in the winning half, ${p.guestMoodWord}; the host on the seam, glancing toward them. One short text block per half.`,
  },
  {
    id: 'reaction-artifact',
    letter: 'G',
    name: 'Reaction + Artifact',
    needsGuest: false,
    guestOptional: true, // duo only when the project asks for guest-everywhere
    layout: (p) =>
      `LAYOUT: Reaction. The host on the right, pointing at ${p.artifact} floating in the left half of the frame. A hand-drawn red arrow connects their eyeline to the key detail. Headline text above the artifact.`,
    guestLayout: (p) =>
      `LAYOUT: Reaction duo. The guest and the host on the right, both reacting to ${p.artifact} floating in the left half of the frame: the guest ${p.guestMoodWord}, the host pointing at it ${p.expression}. A hand-drawn red arrow connects to the key detail. Headline text above the artifact.`,
  },
];

// --- copy helpers -----------------------------------------------------------

const MONEY_RE = /\$[\d.,]+\s*[KkMmBb]?(?:\/\s*(?:mo|month|yr|year|day|week))?/;

// Returns null when the brief holds no figure at all: a thumbnail must never
// carry a number the video cannot back up.
function extractNumber(project) {
  const src = `${project.title} ${project.hook || ''} ${project.notes || ''}`;
  const m = src.match(MONEY_RE);
  if (m) return m[0].replace(/\s+/g, '');
  const n = src.match(/\b\d[\d.,]*\s*[KkMmBb%]?\b/);
  // The \s* can trail whitespace ("12 " out of "12 Startups"), which would
  // render as "12  / claim" or "12 ?" on the thumbnail.
  return n ? n[0].replace(/\s+/g, '') : null;
}

// Trimmed from both ends of a shortened phrase. The second row is words that
// only ever dangle when a claim is cut to fit ("one-person AI company, still").
const STOPWORDS = new Set([
  'a', 'an', 'the', 'with', 'of', 'to', 'and', 'for', 'in', 'on', 'by', 'at',
  'is', 'was', 'when', 'how', 'his', 'her', 'their', 'that', 'this', 'it', 'its',
  'still', 'just', 'even', 'also', 'but', 'or', 'than', 'then', 'from', 'into',
  'while', 'because', 'which', 'who', 'what', 'where', 'as', 'so',
]);

function trimStops(words) {
  const w = [...words];
  const bare = (s) => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  while (w.length && STOPWORDS.has(bare(w[0]))) w.shift();
  while (w.length && STOPWORDS.has(bare(w[w.length - 1]))) w.pop();
  return w;
}

// Cutting a claim short can leave the punctuation that joined it to the rest
// of the sentence ("one-person AI company,"), which then gets rendered.
function tidyEdges(text) {
  return String(text || '').replace(/^[\s,;:.-]+/, '').replace(/[\s,;:-]+$/, '').trim();
}

function shortWords(text, max) {
  let words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length > max) words = trimStops(words.slice(0, max));
  return tidyEdges(words.join(' '));
}

// The punchline usually lives at the END of a claim ("…zero employees").
function punch(text, max) {
  const words = trimStops(String(text || '').trim().split(/\s+/).filter(Boolean));
  const meaningful = words.filter((w) => !MONEY_RE.test(w));
  return tidyEdges(trimStops(meaningful.slice(-max)).join(' '));
}

// Four copy angles rotated across the 7 variations so wording differs.
// Every angle must come back non-empty: textSpec renders the text verbatim,
// so an empty angle would instruct the model to render "".
function copyAngles(project) {
  const number = extractNumber(project);
  const titleSrc = String(project.title || project.hook || '').trim();
  const hookSrc = String(project.hook || project.title || '').trim();
  const tail = punch(hookSrc, 3) || punch(titleSrc, 3) || 'with AI';
  const angles = [
    { name: 'exact-title', text: shortWords(titleSrc, 6) || tail },
    number
      ? { name: 'number-first', text: `${number} / ${tail}` }
      : { name: 'how-angle', text: `HOW / ${tail}` },
    { name: 'question', text: number ? `${tail} / ${number}?` : `${tail}?` },
    { name: 'outcome-claim', text: shortWords(hookSrc, 6) || tail },
  ];
  // Concept-first projects start with title === hook, which would give the
  // exact-title and outcome-claim angles identical text.
  if (angles[3].text === angles[0].text) {
    const firstNote = String(project.notes || '').split(/[.!?\n]/)[0];
    angles[3].text = punch(firstNote, 6) || shortWords(hookSrc, 4);
    if (!angles[3].text || angles[3].text === angles[0].text) angles[3].text = tail;
  }
  return angles;
}

// --- prompt builder ---------------------------------------------------------

// Bump whenever the generated prompt text changes in a way that makes packs
// already on disk wrong. The UI compares a project's stamp against this and
// nudges a rebuild. 2: people identified by count, never by ordinal.
// 3: expression varies across the 7, and archetypes D and E respond to it.
const PROMPT_ENGINE = 4;

// People are identified by HOW MANY photos belong to each person, never by an
// ordinal like "the second attached photo". The attachment list puts every host
// photo first and the guest photos after, so with 2 host refs "the second
// photo" is another photo of the host. Saying so produced thumbnails with the
// host rendered twice and no guest.
// The host is described without a gender: the studio is a template and the
// person in front of the camera is whoever the adopter puts there. The attached
// photos carry the appearance, so naming a gender in the prompt adds nothing and
// gets it wrong for half of the people who use this.
function hostIdentity(hostName, hostCount) {
  const name = String(hostName || '').trim();
  // "the host" is the unnamed default, so "the host, the host" never happens.
  const who = name && name.toLowerCase() !== 'the host' ? `the host, ${name}` : 'the host';
  const lead =
    hostCount >= 2
      ? `The FIRST ${hostCount} attached photos all show the SAME person, ${who}. They are different photos of one person, not different people.`
      : hostCount === 1
        ? `The FIRST attached photo shows ${who}.`
        : `The person in the frame is ${who}.`;
  return `${lead} Match their face, hair, and features EXACTLY. Photorealistic, not stylized, natural skin tones. They should look like the same real person in every image.`;
}

function guestIdentity(guestName, hostCount, guestCount) {
  if (guestCount < 1) return null;
  const from = hostCount + 1;
  const to = hostCount + guestCount;
  const which = guestCount === 1 ? `Attached photo ${from} shows` : `Attached photos ${from} to ${to} show`;
  const named = guestName ? `the guest, ${guestName},` : 'the guest,';
  return (
    `${which} ${named} a DIFFERENT person from the host. Match their face and features EXACTLY too. ` +
    'Exactly TWO different people appear in the image: the host once and the guest once. ' +
    "Never render the host twice and never give the guest the host's face."
  );
}

const QUALITY_BAR =
  'QUALITY: Crisp studio lighting, high contrast, subtle rim light matching the accent color, tack-sharp focus on the face, clean uncluttered background, slightly lifted saturation. Every element must stay legible when the image is shrunk to 168 pixels wide. Keep faces and text inside the middle 90% of the frame.';

const NEGATIVE =
  'DO NOT include: watermarks, channel logos, any text beyond what is specified, the same person shown twice, warped or extra fingers, plastic AI-looking skin, cluttered backgrounds.';

function textSpec(text, colorway) {
  const lines = text.includes('/') ? text : text.split(/\s+/).length > 3 ? splitLines(text) : text;
  return (
    `TEXT: Render EXACTLY this text (line breaks marked with "/"): "${lines}". ` +
    `Ultra-bold condensed sans-serif (Anton / Archivo Black style), stacked lines, filling about half the frame width. ${colorway.textRule} ` +
    'Rounded-corner sticker blocks with a hard drop shadow. Spell the text EXACTLY as given, no extra words, no misspellings. ' +
    'Reproduce every character including decimal points, commas, dollar signs and question marks (for example "$3.6M" must keep its period, never "$3 6M").'
  );
}

function splitLines(text) {
  const words = text.trim().split(/\s+/);
  const mid = Math.ceil(words.length / 2);
  return `${words.slice(0, mid).join(' ')} / ${words.slice(mid).join(' ')}`;
}

function defaultProp(project) {
  const src = `${project.title} ${project.hook || ''}`.toLowerCase();
  if (/invoice|bill|cost|\$0|free/.test(src)) return 'a printed invoice';
  if (/phone|app|mobile/.test(src)) return 'a smartphone showing the app';
  if (/revenue|earn|made|\$|profit|mrr|arr/.test(src)) return 'a printed revenue report';
  return 'a printed one-page report proving the claim';
}

function defaultArtifact(project) {
  const src = `${project.title} ${project.hook || ''}`.toLowerCase();
  if (/agent/.test(src)) return 'an AI agent chat window screenshot';
  if (/revenue|earn|made|\$|profit/.test(src)) return 'a revenue dashboard screenshot with a chart going up and to the right';
  return 'a glowing product screenshot';
}

function defaultSplit(project) {
  const src = `${project.title} ${project.hook || ''}`.toLowerCase();
  if (/vs|versus/.test(src)) return 'the two things being compared, one per half';
  if (/replac|instead|old|new/.test(src)) return 'the old way (muted, gray) versus the new AI way (vivid, glowing)';
  return 'BEFORE (muted, gray, struggling) versus AFTER (vivid, glowing, winning)';
}

// Mood barometer: the default is warm/smiley; a project can override the
// host's and guest's mood. Each mood keeps 3 phrasings so the 7 variations
// still vary naturally within the chosen mood.
const MOODS = {
  smiley: {
    label: '😄 Smiley',
    host: ['with a big warm smile', 'with a bright genuine grin', 'smiling openly at the camera'],
    guest: 'beaming and warm',
  },
  confident: {
    label: '😎 Confident',
    host: ['with a confident curious smile', 'with a relaxed self-assured half-smile', 'with calm confident eyes'],
    guest: 'composed and confident',
  },
  curious: {
    label: '🤔 Curious',
    host: ['with a curious raised-brow look', 'with an intrigued head tilt and slight smile', 'with wide curious eyes'],
    guest: 'intrigued and engaged',
  },
  amazed: {
    label: '😲 Amazed',
    host: ['with raised-brow genuine amazement', 'with an astonished wow expression', 'with wide amazed eyes and a rising smile'],
    guest: 'genuinely amazed',
  },
  serious: {
    label: '😐 Serious',
    host: ['with a calm serious expression', 'with focused unsmiling intensity', 'with a thoughtful steady gaze'],
    guest: 'serious and thoughtful',
  },
  intense: {
    label: '🔥 Intense',
    host: ['with intense focused eyes and a slight smile', 'with fierce determined focus', 'with a piercing driven stare'],
    guest: 'driven and intense',
  },
};

// --- Auto mood --------------------------------------------------------------
// The 6 above are a palette, not a menu. "Auto" reads the brief, picks a base
// mood, and spreads a related ring across the 7 so the options differ by
// expression as well as by layout and colorway. An agent can then replace the
// whole plan with free-form expressions written for one specific video
// (see normalizeMoodPlan and pack/MOOD_INSTRUCTIONS.md).

const AUTO_MOOD = { key: 'auto', label: '✨ Auto' };

// Same shape as defaultProp/defaultArtifact/defaultSplit: first match wins.
function autoBaseMood(project) {
  const src = `${project.title || ''} ${project.hook || ''} ${project.notes || ''}`.toLowerCase();
  if (/killed|beat |beats |versus|\bvs\b|\bwar\b|replac|destroy|dead|shut down/.test(src)) return 'intense';
  if (/\$|revenue|mrr|arr|profit|earn|made|million|billion|\bk\/mo\b|run rate/.test(src)) return 'amazed';
  if (/\bhow\b|\bwhy\b|secret|nobody|actually|really|mistake|wrong/.test(src)) return 'curious';
  if (/interview|founder|\bceo\b|talks|conversation|sat down/.test(src)) return 'confident';
  return 'smiley';
}

// A ring of 3 related moods per base, so the spread stays on-message.
const MOOD_RINGS = {
  smiley: ['smiley', 'curious', 'confident'],
  confident: ['confident', 'smiley', 'curious'],
  curious: ['curious', 'amazed', 'confident'],
  amazed: ['amazed', 'curious', 'smiley'],
  serious: ['serious', 'confident', 'intense'],
  intense: ['intense', 'serious', 'confident'],
};

// 7 mood keys, deterministic: same brief and seed always give the same plan.
function autoMoodPlan(project, seed = 0) {
  const ring = MOOD_RINGS[autoBaseMood(project)] || MOOD_RINGS.smiley;
  return ARCHETYPES.map((a, i) => ring[(seed + i) % ring.length]);
}

// --- free-form expressions (agent write-back) -------------------------------
// Host fragments slot into "the host ___" and must read as a prepositional or
// participial phrase. Guest fragments slot into "the guest ___" and must read
// as an adjective phrase. A value of the wrong shape would produce a broken
// sentence in the prompt, so it is normalized where that is safe and dropped
// where it is not.

const MOOD_TEXT_MAX = 90;
const REJECT_LEAD = /^(he|she|they|his|her|their|the host|the guest|is|are|was|were|has|have|looks?|smiles?|reacts?|stares?|appears?|and|but|then)\b/i;
const HOST_OK = /^(with|without|in|under|behind|beside|through|between|\w+ing)\b/i;

function cleanMoodText(text) {
  let t = String(text == null ? '' : text)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["“”`]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > MOOD_TEXT_MAX) {
    t = t.slice(0, MOOD_TEXT_MAX).replace(/\s+\S*$/, '');
    // Cutting mid-clause leaves a dangling phrase ("...cannot wait to say"),
    // so fall back to the last complete clause when there is one.
    if (t.includes(',')) t = t.slice(0, t.lastIndexOf(','));
  }
  t = t.replace(/[.,;:!]+$/, '').trim();
  if (/^[A-Z][a-z]/.test(t)) t = t[0].toLowerCase() + t.slice(1);
  return t;
}

function hostFragment(text) {
  const t = cleanMoodText(text);
  if (t.length < 3 || REJECT_LEAD.test(t)) return null;
  if (HOST_OK.test(t)) return t;
  // A noun phrase takes "with a huge grin"; an adjective takes
  // "looking deadpan", because "with deadpan" is not English.
  return /^(a|an|the)\s/i.test(t) ? `with ${t}` : `looking ${t}`;
}

function guestFragment(text) {
  let t = cleanMoodText(text).replace(/^(with|looking|appearing|seeming)\s+/i, '');
  if (t.length < 3 || REJECT_LEAD.test(t) || /^(a|an|the)\s/i.test(t)) return null;
  return t;
}

// Idempotent: safe to run when writing and again when reading.
function normalizeMoodPlan(plan) {
  if (!Array.isArray(plan)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of plan) {
    const index = Number(entry?.index);
    if (!Number.isInteger(index) || index < 1 || index > ARCHETYPES.length) continue;
    if (seen.has(index)) continue;
    const host = hostFragment(entry?.host);
    const guest = guestFragment(entry?.guest);
    if (!host && !guest) continue;
    seen.add(index);
    const item = { index };
    if (host) item.host = host;
    if (guest) item.guest = guest;
    out.push(item);
  }
  return out.sort((a, b) => a.index - b.index);
}

// --- per-variation edits ----------------------------------------------------
// Both stores live on the PROJECT, keyed by variation index, because the pack
// build replaces project.variations wholesale on every rebuild.

const TEXT_EDIT_MAX = 60; // a thumbnail line, not a paragraph
const PROMPT_EDIT_MAX = 8000;

function cleanEditText(text) {
  let t = String(text == null ? '' : text)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["“”`]/g, '') // would break the quoting inside textSpec
    .replace(/[—–]/g, '-')
    .replace(/\s*\/\s*/g, ' / ') // "/" is the manual line break
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .trim();
  if (t.length > TEXT_EDIT_MAX) t = t.slice(0, TEXT_EDIT_MAX).replace(/\s+\S*$/, '').trim();
  // An empty edit would tell the model to render "", so fall back instead.
  return t.replace(/[/\s]/g, '').length < 2 ? null : t;
}

function normalizePromptText(prompt) {
  const t = String(prompt == null ? '' : prompt)
    .replace(/\r\n/g, '\n')
    .replace(/[—–]/g, '-')
    .trim()
    .slice(0, PROMPT_EDIT_MAX);
  return t.length < 20 ? null : t;
}

// Both idempotent, same skeleton as normalizeMoodPlan.
function normalizeEdits(list, field, clean) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const index = Number(entry?.index);
    if (!Number.isInteger(index) || index < 1 || index > ARCHETYPES.length) continue;
    if (seen.has(index)) continue;
    const value = clean(entry?.[field]);
    if (!value) continue;
    seen.add(index);
    out.push({ index, [field]: value });
  }
  return out.sort((a, b) => a.index - b.index);
}

const normalizeTextEdits = (list) => normalizeEdits(list, 'text', cleanEditText);
const normalizePromptEdits = (list) => normalizeEdits(list, 'prompt', normalizePromptText);

/**
 * The one place a variation's expression is decided. Precedence:
 * a written plan entry, then the auto ring, then the chosen fixed mood.
 * The fixed-mood path keeps the original i % 3 rotation so projects that
 * never touch Auto keep their existing prompts.
 */
function resolveMoods(project, seed = 0) {
  const plan = normalizeMoodPlan(project.moodPlan);
  const auto = autoMoodPlan(project, seed);
  const hostAuto = project.hostMood === AUTO_MOOD.key;
  const guestAuto = project.guestMood === AUTO_MOOD.key;
  const fixed = (key) => (MOODS[key] ? key : 'smiley');

  return ARCHETYPES.map((a, i) => {
    const entry = plan.find((e) => e.index === i + 1);
    const hostKey = hostAuto ? auto[i] : fixed(project.hostMood);
    const guestKey = guestAuto ? auto[i] : fixed(project.guestMood);
    // Auto walks the phrasings more slowly so mood and phrasing never repeat
    // as a pair across the 7; a fixed mood keeps the original rotation.
    const phrase = MOODS[hostKey].host[(hostAuto ? Math.floor(i / 3) : i) % MOODS[hostKey].host.length];
    return {
      key: entry?.host ? 'agent' : hostKey,
      host: entry?.host || phrase,
      guest: entry?.guest || MOODS[guestKey].guest,
    };
  });
}

/**
 * One prompt for one archetype/colorway/text, assembled exactly the way
 * buildVariations assembles each of the 7. Used by the final round, which
 * holds the winning composition fixed and changes only the text, so every
 * section except TEXT must come out byte-identical to the winner's prompt.
 */
function buildOnePrompt({
  project, archetypeId, colorwayId, text, mood,
  useGuestLayout = false, hostName = 'the host', refCounts = { host: 1, guest: 0 }, scene,
}) {
  let archetype = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0];
  const colorway = COLORWAYS.find((c) => c.id === colorwayId) || COLORWAYS[0];
  const hostCount = Math.max(0, Number(refCounts?.host) || 0);
  const guestCount = Math.max(0, Number(refCounts?.guest) || 0);
  // `scene` carries the winner's own prop/artifact/split/number so the
  // composition really is held fixed. Recomputing them from the project would
  // let a newly adopted title silently change the prop or the split.
  const number = scene && 'number' in scene ? scene.number : extractNumber(project);
  const params = {
    expression: mood?.host || MOODS.smiley.host[0],
    guestMoodWord: mood?.guest || MOODS.smiley.guest,
    prop: scene?.prop || defaultProp(project),
    artifact: scene?.artifact || defaultArtifact(project),
    split: scene?.split || defaultSplit(project),
    number,
  };

  // Same guard as buildVariations: never render a fabricated figure.
  if (archetype.id === 'big-number' && !number) archetype = ARCHETYPES[0];

  return [
    'Create a photorealistic YouTube thumbnail image, 16:9 landscape, high resolution.',
    hostIdentity(hostName, hostCount),
    useGuestLayout ? guestIdentity((project.guestName || '').trim(), hostCount, guestCount) : null,
    useGuestLayout && archetype.guestLayout ? archetype.guestLayout(params) : archetype.layout(params),
    textSpec(text, colorway),
    `COLOR: Accent color ${colorway.name} ${colorway.accent}. Support color ${colorway.support}. Background: ${colorway.background}. Use ONLY this accent (plus red annotation marks if specified), no other accent colors. Natural skin tones.`,
    QUALITY_BAR,
    NEGATIVE,
  ].filter(Boolean).join('\n\n');
}

/**
 * Thumbnail texts derived FROM an adopted title by taking about half of its
 * content words. Subsetting lands inside the 30 to 70 percent window by
 * construction, which is why this works where inventing a title did not.
 * The full title is never used: that would be 100% overlap and too long.
 */
function titleThumbTexts(title, currentText = '', count = 4) {
  const bare = (w) => w.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  const content = words.filter((w) => !STOPWORDS.has(bare(w)));
  // Verbs and prepositions carry the sentence, not the claim, and a thumbnail
  // line ending on "making" or "without" reads as a fragment.
  const WEAK = new Set([
    'making', 'made', 'makes', 'being', 'having', 'doing', 'getting', 'using', 'built',
    'without', 'about', 'over', 'under', 'after', 'before', 'through', 'behind', 'runs',
  ]);
  const strong = content.filter((w) => !WEAK.has(bare(w)));
  const pool = strong.length >= 2 ? strong : content;
  if (pool.length < 2) return [];

  const join = (ws) => tidyEdges(ws.join(' '));
  // A " / " marks the line break the renderer honours.
  const pair = (a, b) => (a && b ? `${a} / ${b}` : a || b);

  const raw = [
    pair(join(pool.slice(0, 2)).toUpperCase(), join(pool.slice(2, 3))),
    pair(join(pool.slice(-2, -1)).toUpperCase(), join(pool.slice(-1))),
    join(pool.slice(0, 3)),
    pair(join(pool.slice(0, 1)).toUpperCase(), join(pool.slice(-2))),
  ];

  const seen = new Set([cleanEditText(currentText) || '']);
  const out = [];
  for (const r of raw) {
    const t = cleanEditText(r);
    if (!t || seen.has(t)) continue;
    if (t.replace(/ \/ /g, ' ').split(/\s+/).length > 6) continue; // the 3-6 word rule
    seen.add(t);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Build the 7 variation prompts for a project.
 * seed shifts the colorway rotation so consecutive projects lead differently.
 * bias ({archetypeId, colorwayId}, optional) pairs the historically
 * winning archetype with the historically winning colorway by swapping
 * assignments, keeping all 7 colorways distinct.
 * refCounts ({host, guest}) must be the LENGTHS OF THE ARRAYS THE PACK
 * ACTUALLY ATTACHES, not a second guess at them, because the prompt tells the
 * model which photo is whom by counting.
 */
function buildVariations(project, seed, bias, hostName = 'the host', refCounts = { host: 1, guest: 0 }) {
  const angles = copyAngles(project);
  const moods = resolveMoods(project, seed);
  // Resolved HERE rather than in the server, because v.text feeds textSpec,
  // the pack file header, the social alt text, the portrait prompt, the mood
  // instructions and the title suggester. Overriding it downstream would leave
  // all of those describing text that is not on the image.
  const textEdits = normalizeTextEdits(project.textEdits);
  const number = extractNumber(project);
  const guestName = (project.guestName || '').trim();
  const hasGuest = project.episodeType === 'interview' && project.hasGuestPhoto;
  const hostCount = Math.max(0, Number(refCounts?.host) || 0);
  const guestCount = Math.max(0, Number(refCounts?.guest) || 0);

  const assigned = ARCHETYPES.map((a, i) => COLORWAYS[(seed + i) % COLORWAYS.length]);
  if (bias && bias.archetypeId && bias.colorwayId) {
    const bi = ARCHETYPES.findIndex((a) => a.id === bias.archetypeId);
    const ci = assigned.findIndex((c) => c.id === bias.colorwayId);
    if (bi >= 0 && ci >= 0 && bi !== ci) {
      [assigned[bi], assigned[ci]] = [assigned[ci], assigned[bi]];
    }
  }

  return ARCHETYPES.map((arch, i) => {
    const colorway = assigned[i];
    const angle = angles[i % angles.length];
    let archetype = arch;

    // No guest photo → archetype C falls back to a second Sticker Statement.
    if (arch.needsGuest && !hasGuest) archetype = ARCHETYPES[0];

    // No real number in the brief → archetype D falls back the same way,
    // rather than rendering a figure the video never claims.
    if (archetype.id === 'big-number' && !number) archetype = ARCHETYPES[0];

    // Interview episodes: the guest joins every archetype that has a duo
    // variant (A, B, C, D, F = at least 5 of 7). E and G stay host-solo
    // for variety unless the project sets guestEverywhere (then 7 of 7).
    const useGuestLayout =
      hasGuest &&
      (archetype.needsGuest ||
        (archetype.guestLayout && (!archetype.guestOptional || project.guestEverywhere)));

    const mood = moods[i];
    const params = {
      expression: mood.host,
      guestMoodWord: mood.guest,
      prop: defaultProp(project),
      artifact: defaultArtifact(project),
      split: defaultSplit(project),
      number,
    };

    const textEdit = textEdits.find((e) => e.index === i + 1)?.text || null;
    const text = textEdit || angle.text;

    const promptParts = [
      'Create a photorealistic YouTube thumbnail image, 16:9 landscape, high resolution.',
      hostIdentity(hostName, hostCount),
      useGuestLayout ? guestIdentity(guestName, hostCount, guestCount) : null,
      useGuestLayout && archetype.guestLayout ? archetype.guestLayout(params) : archetype.layout(params),
      textSpec(text, colorway),
      `COLOR: Accent color ${colorway.name} ${colorway.accent}. Support color ${colorway.support}. Background: ${colorway.background}. Use ONLY this accent (plus red annotation marks if specified), no other accent colors. Natural skin tones.`,
      QUALITY_BAR,
      NEGATIVE,
    ].filter(Boolean);

    return {
      index: i + 1,
      archetype: { id: archetype.id, letter: archetype.letter, name: archetype.name },
      colorway: { id: colorway.id, name: colorway.name, accent: colorway.accent },
      copyAngle: angle.name,
      text,
      // Only present when an edit is in force: it is the badge signal, the
      // reset baseline and the is-edited test for everything downstream.
      ...(textEdit ? { textAuto: angle.text } : {}),
      mood,
      // What this image actually depicts, so a later re-cut can hold the
      // composition fixed instead of recomputing it from a changed brief.
      scene: { prop: params.prop, artifact: params.artifact, split: params.split, number },
      usesGuestPhoto: Boolean(useGuestLayout),
      prompt: promptParts.join('\n\n'),
    };
  });
}

module.exports = {
  COLORWAYS,
  ARCHETYPES,
  MOODS,
  AUTO_MOOD,
  PROMPT_ENGINE,
  buildVariations,
  extractNumber,
  autoMoodPlan,
  normalizeMoodPlan,
  resolveMoods,
  normalizeTextEdits,
  normalizePromptEdits,
  buildOnePrompt,
  titleThumbTexts,
  cleanEditText,
};
