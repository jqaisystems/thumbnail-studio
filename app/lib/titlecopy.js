// Title candidates that SUPPORT an already-chosen winning thumbnail.
// Implements the packaging rule from docs/BLUEPRINT.md ("Would it still make
// sense with the title hidden?"): title and thumbnail text should overlap
// about 50%, never 100%. Candidates inside the 0.3-0.7 overlap window rank
// first. Heuristic on purpose, like socialcopy.js; pack/TITLE_INSTRUCTIONS.md
// is the agent path for higher-quality suggestions.

const { extractNumber } = require('./blueprint');

const STOP = new Set([
  'a', 'an', 'the', 'with', 'of', 'to', 'and', 'for', 'in', 'on', 'by', 'at',
  'is', 'was', 'when', 'how', 'his', 'her', 'their', 'that', 'this', 'it', 'its',
  'he', 'she', 'they', 'i', 'you', 'we',
]);

function firstSentence(text) {
  return String(text || '').split(/[.!?\n]/)[0].trim();
}

function meaningfulWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9$%.,]+/gi, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[.,]+$/, ''))
    .filter((w) => w && !STOP.has(w));
}

// Fraction of the candidate's meaningful words that also sit on the thumbnail.
function overlapRatio(candidate, thumbText) {
  const a = new Set(meaningfulWords(candidate));
  const b = new Set(meaningfulWords(thumbText));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / a.size;
}

function capFirst(text) {
  const t = String(text || '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// YouTube truncates around 70 characters in most surfaces.
function capLength(text, max = 70) {
  const t = String(text || '').trim().replace(/[.\s]+$/, '');
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '');
}

const inWindow = (o) => o >= 0.3 && o <= 0.7;

// One wording for the score, used by the instructions file and mirrored in the UI.
function titleVerdict(overlap) {
  if (inWindow(overlap)) return 'good balance';
  return overlap > 0.7 ? 'too close, repeats the thumbnail' : 'adds a lot, check it still connects';
}

// A title has to be a title, not a leftover fragment.
function usable(title) {
  const words = meaningfulWords(title);
  if (words.length < 3) return false;
  const last = title.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z0-9'-]/g, '');
  return !STOP.has(last);
}

/**
 * Mechanical reframings of the brief, scored against the winning thumbnail.
 * These do not write titles: a title that SUPPORTS a thumbnail has to add
 * something the thumbnail lacks, and everything here comes from the same hook
 * the thumbnail text was built from. The real writing happens through
 * pack/TITLE_INSTRUCTIONS.md; this exists so there is always something on
 * screen and so any title, typed or written by an agent, gets a score.
 */
function composeTitleCandidates(project, winnerVariation, settings) {
  const thumbText = String(winnerVariation?.text || '').replace(/ \/ /g, ' ');
  const hook = firstSentence(project.hook || project.title);
  const number = extractNumber(project);
  const guestName = (project.guestName || '').trim();
  const isInterview = project.episodeType === 'interview' && guestName;

  const thumbSet = new Set(meaningfulWords(thumbText));
  const hookWords = String(hook).split(/\s+/).filter(Boolean);
  const tail = hookWords.slice(-5).join(' ');
  // Leading with a number the thumbnail already shows is pure repetition.
  const numberIsFresh = number && !thumbSet.has(String(number).toLowerCase());

  const raw = [
    { angle: 'hook-as-title', title: capFirst(hook) },
    numberIsFresh
      ? { angle: 'number-payoff', title: capFirst(`${number} ${tail.replace(number, '').trim()}`) }
      : null,
    /\?$/.test(hook) ? null : { angle: 'question', title: `${capFirst(hook)}?` },
    // The one formula that adds something genuinely absent from the thumbnail.
    isInterview && !hook.startsWith(guestName)
      ? { angle: 'guest-forward', title: `${guestName}: ${capFirst(tail)}` }
      : null,
  ].filter(Boolean);

  const seen = new Set();
  const candidates = [];
  for (const c of raw) {
    const title = capLength(c.title);
    if (!usable(title)) continue;
    // A question that differs from the hook only by "?" is not a second option.
    const key = title.toLowerCase().replace(/\?$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      title,
      angle: c.angle,
      source: 'heuristic',
      overlap: Math.round(overlapRatio(title, thumbText) * 100) / 100,
    });
  }

  candidates.sort((a, b) => {
    if (inWindow(a.overlap) !== inWindow(b.overlap)) return inWindow(a.overlap) ? -1 : 1;
    return Math.abs(a.overlap - 0.5) - Math.abs(b.overlap - 0.5);
  });
  return candidates;
}

module.exports = { composeTitleCandidates, overlapRatio, titleVerdict };
