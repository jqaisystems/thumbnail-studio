#!/usr/bin/env node
/**
 * The one check that matters before this repository is public.
 *
 * Everything else in the project is guarded by scripts/check.mjs, which proves
 * the prompts are correct. This one proves nothing private ever entered git.
 * It reads HISTORY, not just the working tree: `git ls-files` is clean by
 * definition the moment you gitignore something, and history is where the
 * damage actually lives. This repo already paid for that lesson once with a
 * filter-branch purge and an orphan branch.
 *
 * It reads historical CONTENT too, not only historical filenames. An earlier
 * version of this script checked paths across all commits but content only at
 * HEAD, and reported the repository clean while a private ChatGPT project URL
 * sat in app/server.js in the first commit, deleted three commits later. A
 * secret that was committed once and removed is still published.
 *
 *   node scripts/check-release.mjs          check the whole repo
 *   node scripts/check-release.mjs --staged only what is about to be committed
 *
 * Exits 1 on any finding, so it works as a pre-push hook (.githooks/pre-push).
 */

import { execFileSync } from 'node:child_process';

const STAGED_ONLY = process.argv.includes('--staged');

// stderr is piped, not inherited: a file that exists on disk but not yet in
// HEAD is an expected miss, and letting git print "fatal:" for each one buries
// the real findings under noise.
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

// ---------------------------------------------------------------- the rules

// Paths that must never be tracked, in the tree or anywhere in history.
// Each is a reason, not a preference: see .gitignore and docs/RELEASING.md.
const FORBIDDEN_PATHS = [
  // Extension-agnostic on purpose. A rule listing jpg/png/webp misses the
  // .heic an iPhone actually produces, which is the realistic accident.
  [/^brand\/(?!(?:.*\/)?README\.md$).+/i,
   'a file in brand/. Host photos are a ready-made reference set for generating a real person\'s face, and style refs are other channels\' work. Only READMEs belong here'],
  [/^data\/settings\.json$/, 'local settings, which can hold an API key and a private ChatGPT project URL'],
  [/^data\/chatgpt-profile\//, 'a logged-in ChatGPT browser session. The cookies in it ARE the account'],
  [/^data\/usage\.json$/, 'personal spend history'],
  [/^data\/suggestions\.json$/, 'guest research naming real people with commercial notes'],
  [/^data\/channel-cache\.json$/, 'a cached channel feed'],
  [/^projects\//, 'generated project work, hundreds of MB that git cannot delta-compress'],
  [/^demo\//, 'the built demo, which carries one channel\'s real data'],
  [/^handoff\//, 'a built private handoff, which carries host photos by design'],
  [/\.log$/i, 'a log file'],
  [/runner-debug\.png$/i, 'a Playwright debug screenshot. These capture the ChatGPT sidebar, which lists unrelated private projects'],
];

// Every picture this repository is allowed to contain, by exact path.
//
// A directory allowlist is not enough: the realistic accident is a photo copied
// into a folder that already holds images, and `logo/headshot.jpg` would sail
// through a rule that trusts `logo/`. Naming each file makes adding a picture a
// deliberate act, which is the point, because a screenshot is the highest-risk
// file in any repo and nobody looks at one before publishing.
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|svg|ai|eps|psd|sketch|fig)$/i;
const ALLOWED_IMAGES = new Set([
  'docs/readme-hero.gif',
  'docs/readme-hero-poster.png',
  'assets/social-preview.png',
  ...Array.from({ length: 7 }, (_, i) => [
    `logo/logo_thumbnail_studio-0${i + 1}.png`,
    `logo/logo_thumbnail_studio-0${i + 1}.svg`,
  ]).flat(),
]);

// Things that grant access, or identify a private workspace. Checked against
// every blob in every reachable commit, because deleting the file later does
// not unpublish it.
const CREDENTIAL_PATTERNS = [
  [/\bsk-[A-Za-z0-9_-]{16,}/, 'an OpenAI-shaped API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'a GitHub token'],
  [/\bAIza[0-9A-Za-z_-]{30,}/, 'a Google API key'],
  [/\bxox[abprs]-[0-9A-Za-z-]{10,}/, 'a Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bBearer\s+[A-Za-z0-9._-]{24,}/, 'a bearer token'],
  // The one that got through. A project URL is not a capability, but it names a
  // private workspace and in this repo's case a real person in the slug.
  [/chatgpt\.com\/g\/g-p-[A-Za-z0-9-]{8,}/, 'a private ChatGPT project URL'],
  [/chatgpt\.com\/(?:share|c)\/[0-9a-f-]{8,}/, 'a ChatGPT conversation or share URL'],
  [/^Claude-Session:/m, 'a Claude session URL trailer'],
];

// Untidy rather than dangerous: a folder name from the machine that built this.
// Checked at HEAD only. Blanket-failing on a stale path in a commit from months
// ago would just train you to bypass the hook, and the hook is worth more.
const HYGIENE_PATTERNS = [
  [/\bE:\\+Codex\b/i, 'an absolute path from the author\'s machine'],
  [/\bC:\\+Users\\+[A-Za-z0-9._-]+/i, 'a Windows user folder from a real machine'],
  [/\/Users\/[A-Za-z0-9._-]+\//, 'a macOS home folder from a real machine'],
];

// Pictures carry text too. Illustrator writes the account name into the
// PostScript header and an XMP block into the file, which is invisible to a
// scan that skips anything ending in .ai. Checked at HEAD only, same reasoning
// as the hygiene set.
const METADATA_PATTERNS = [
  [/%%For:\s*\(([^)]{1,60})\)/, 'an author name in an embedded PostScript header'],
  [/<(?:dc:creator|xmp:CreatorTool|photoshop:AuthorsPosition)>/, 'embedded XMP author metadata'],
];

// This file necessarily contains the patterns it looks for.
const SELF = 'scripts/check-release.mjs';

const findings = [];
const report = (where, what) => findings.push(`${where}\n      ${what}`);

const scan = (label, text, patterns) => {
  for (const [re, why] of patterns) {
    const m = text.match(re);
    if (m) report(label, `${why}: ${JSON.stringify(m[0].slice(0, 40))}`);
  }
};

// ------------------------------------------------------------ path scanning

function checkPaths(label, files) {
  for (const f of files) {
    if (!f) continue;
    for (const [re, why] of FORBIDDEN_PATHS) {
      if (re.test(f)) report(`${label}: ${f}`, why);
    }
    if (IMAGE_RE.test(f) && !ALLOWED_IMAGES.has(f)) {
      report(`${label}: ${f}`, 'a picture that is not on the allowlist. Open it and look at what is actually in it, including the background and its metadata, then add it to ALLOWED_IMAGES in this script if it really belongs in a public repo');
    }
  }
}

// ---------------------------------------------------------- content scanning

// One `git cat-file --batch` for the whole history rather than 146 spawns, so
// this stays fast enough to sit in a pre-push hook.
function readBlobs(shas) {
  if (!shas.length) return new Map();
  const out = execFileSync('git', ['cat-file', '--batch', '--buffer'], {
    input: shas.join('\n') + '\n',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const blobs = new Map();
  let i = 0;
  while (i < out.length) {
    const nl = out.indexOf(0x0a, i);
    if (nl === -1) break;
    const [sha, type, size] = out.slice(i, nl).toString('utf8').split(' ');
    if (type !== 'blob') { i = nl + 1; continue; } // "missing", or a tree
    const start = nl + 1;
    blobs.set(sha, out.slice(start, start + Number(size)));
    i = start + Number(size) + 1; // git writes a newline after the payload
  }
  return blobs;
}

// latin1 keeps every byte addressable as one character, so an ASCII pattern
// still matches inside a PNG or an .ai without any guessing about encoding.
const asText = (buf) => buf.toString('latin1');

function checkHeadContent(files) {
  for (const f of files) {
    if (f === SELF) continue;
    let body;
    try {
      body = asText(execFileSync('git', ['show', `HEAD:${f}`], {
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
    } catch {
      continue; // not in HEAD yet
    }
    scan(f, body, CREDENTIAL_PATTERNS);
    if (IMAGE_RE.test(f)) scan(f, body, METADATA_PATTERNS);
    else scan(f, body, HYGIENE_PATTERNS);
  }
}

// ------------------------------------------------------------------- run it

const root = git('rev-parse', '--show-toplevel').trim();
process.chdir(root);

if (STAGED_ONLY) {
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);
  checkPaths('staged', staged);
} else {
  const tracked = git('ls-files').split('\n').filter(Boolean);
  checkPaths('tracked', tracked);

  // Every path that has ever existed in any commit, including ones deleted
  // later. This is the check that a working-tree scan cannot do.
  const paths = new Map(); // sha -> Set of paths it was ever stored under
  for (const line of git('rev-list', '--objects', '--all').split('\n')) {
    const sha = line.slice(0, 40);
    const p = line.slice(41).trim();
    if (!p || !/^[0-9a-f]{40}$/.test(sha)) continue;
    if (!paths.has(sha)) paths.set(sha, new Set());
    paths.get(sha).add(p);
  }
  // Blobs only. `rev-list --objects` lists trees too, and a directory named
  // brand/host-photos is not itself a photo.
  const blobs = readBlobs([...paths.keys()]);
  const historicalFiles = new Set();
  for (const sha of blobs.keys()) for (const p of paths.get(sha)) historicalFiles.add(p);
  checkPaths('history', [...historicalFiles]);

  // ...and every byte those commits contain.
  for (const [sha, buf] of blobs) {
    const where = [...paths.get(sha)];
    if (where.every((p) => p === SELF)) continue; // this file holds the patterns
    scan(`history: ${where.join(', ')} (${sha.slice(0, 8)})`, asText(buf), CREDENTIAL_PATTERNS);
  }

  checkHeadContent(tracked);
}

// --------------------------------------------------------------- the verdict

if (findings.length) {
  console.error(`\n  ${findings.length} thing${findings.length > 1 ? 's' : ''} must not be published:\n`);
  for (const f of findings) console.error(`  x ${f}\n`);
  console.error('  Nothing was pushed. Anything found in HISTORY cannot be fixed by deleting the file:');
  console.error('  it needs a history rewrite, and every clone that already exists keeps the old copy.');
  console.error('  See docs/RELEASING.md.\n');
  process.exit(1);
}

const scope = STAGED_ONLY
  ? 'the staged changes'
  : `${git('ls-files').split('\n').filter(Boolean).length} tracked files and every blob in every commit`;
console.log(`\n  ok  ${scope}: no photos, no credentials, no machine paths.\n`);
