// Social post composer in the host's voice, plus honest alt text.
// Voice rules distilled from the real X posts of the channel this was tuned on
// (see docs/BLUEPRINT.md,
// "Voice" section): bold claim first, one idea per line, blank lines between,
// selective CAPS on one or two words, "~" bullets for benefits, curiosity gap,
// heavy "you", plain words, no hashtags.

const { extractNumber } = require('./blueprint');

// Rendering engines sometimes drop punctuation inside money figures
// ("$3.6M" came back as "$3 6M"). Spelling instructions must say so.
const PUNCTUATION_RULE =
  'Reproduce every character of the text exactly, INCLUDING decimal points, commas, dollar signs and question marks (for example "$3.6M" must keep its period, never "$3 6M").';

const X_POST_LIMIT = 280;
const X_ALT_LIMIT = 1000;
const LI_ALT_LIMIT = 300;
const LI_HOOK_VISIBLE = 200; // chars shown before "see more"

function firstSentence(text, max) {
  const t = String(text || '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

// X: bold claim, curiosity line, link. Under 280 including the link placeholder.
function composeXPost(project) {
  const number = extractNumber(project);
  const hook = firstSentence(project.hook || project.title, 120);
  const isInterview = project.episodeType === 'interview' && project.guestName;
  const lines = isInterview
    ? [
        `${hook}.`,
        '',
        `I sat down with ${project.guestName} to find out HOW.`,
        '',
        `Full story: [link]`,
      ]
    : [
        `${hook}.`,
        '',
        `Most people have no idea this is possible. New video shows exactly how.`,
        '',
        `Watch: [link]`,
      ];
  let post = lines.join('\n');
  if (post.length > X_POST_LIMIT) {
    post = [`${firstSentence(hook, 90)}.`, '', `HOW? New video: [link]`].join('\n');
  }
  // Emphasize the money number in CAPS-adjacent style by leaving it as-is;
  // numbers already pop. Guarantee limit.
  return post.slice(0, X_POST_LIMIT);
}

// LinkedIn: hook under 200 chars (pre-fold), then short story lines and "~" bullets.
function composeLinkedInPost(project, settings) {
  const number = extractNumber(project);
  const isInterview = project.episodeType === 'interview' && project.guestName;
  const hook = firstSentence(project.hook || project.title, LI_HOOK_VISIBLE - 30);
  const noteLines = String(project.notes || '')
    .split(/\n|\. /)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 15 && s.length < 120)
    .slice(0, 3);
  const bullets = noteLines.length
    ? noteLines.map((s) => `~ ${s}.`)
    : [
        number ? `~ The real numbers behind ${number}.` : '~ The real story behind it.',
        '~ What actually worked (and what flopped).',
        '~ How you could copy the playbook.',
      ];
  const lines = [
    `${hook}.`,
    '',
    isInterview
      ? `I interviewed ${project.guestName} for ${settings?.showName || 'the channel'} and pushed for the details everyone else skips:`
      : `In the new ${settings?.showName || 'the channel'} video I break it down:`,
    '',
    ...bullets,
    '',
    'The full conversation is worth your time.',
    '',
    'Watch here: [link]',
  ];
  return lines.join('\n');
}

// Alt text describes what is actually in the image. platform: 'x' | 'linkedin'.
function composeAltText(project, variation, settings, platform) {
  const host = settings?.hostName || 'the host';
  // The guest is only IN the image on the Guest Duo layout.
  const guestInImage =
    project.episodeType === 'interview' && project.guestName && variation?.archetype?.id === 'guest-duo';
  const who = guestInImage ? `${host} and guest ${project.guestName}` : host;
  const colorName = variation?.colorway?.name || 'bold accent';
  const text = variation?.text || project.title;
  const sceneByArchetype = {
    'sticker-statement': `${who} looking at the camera beside large sticker-style text`,
    prop: `${who} holding a printed document with a key figure circled in red, next to bold text`,
    'guest-duo': `${who} side by side, cut out on a glowing background, with bold headline text`,
    'big-number': `a huge glowing number dominating the frame with ${who} reacting beside it`,
    'tech-immersive': `${who} surrounded by floating holographic dashboards, headline text across the top`,
    'split-versus': `a split-screen contrast with ${who} between the two halves and short text on each side`,
    'reaction-artifact': `${who} pointing at a floating app screenshot, connected by a red arrow, headline above`,
  };
  const scene = sceneByArchetype[variation?.archetype?.id] || `${who} with bold headline text`;
  const alt = `YouTube thumbnail for "${project.title}": ${scene}. The text reads "${String(text).replace(/ \/ /g, ' ')}" in ${colorName.toLowerCase()} and white.`;
  const limit = platform === 'x' ? X_ALT_LIMIT : LI_ALT_LIMIT;
  return alt.length <= limit ? alt : alt.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
}

// Alt text for the 1080x1350 portrait announcement card. Capped at 300 chars
// so the same alt is valid on both X and LinkedIn.
function composePortraitAlt(project, variation, settings) {
  const show = settings?.showName || 'the channel';
  const colorName = (variation?.colorway?.name || 'accent').toLowerCase();
  const alt = `Portrait announcement card for the video "${project.title}": bold white title at the top, the video's thumbnail in the middle, and the channel name ${show} at the bottom, on a dark background with a ${colorName} glow.`;
  return alt.length <= LI_ALT_LIMIT ? alt : alt.slice(0, LI_ALT_LIMIT - 1).replace(/\s+\S*$/, '') + '…';
}

module.exports = {
  PUNCTUATION_RULE,
  composeXPost,
  composeLinkedInPost,
  composeAltText,
  composePortraitAlt,
  LIMITS: { X_POST_LIMIT, X_ALT_LIMIT, LI_ALT_LIMIT, LI_HOOK_VISIBLE },
};
