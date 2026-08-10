#!/usr/bin/env node
/**
 * Builds a runnable private copy of the studio for the person whose channel it
 * was made for: the tracked code, plus their photos, plus a start guide
 * addressed to them.
 *
 *   node scripts/build-handoff.mjs
 *     -> handoff/           a git working copy, push it to the PRIVATE repo
 *     -> handoff.zip        the same thing, for someone who does not want git
 *
 * Same shape as scripts/build-demo.mjs: one codebase, one derived artifact, so
 * the copy they hold can never drift from the code you develop.
 *
 * Two rules this script exists to enforce:
 *
 *  1. It starts from `git archive HEAD`, so ONLY tracked files travel. Nothing
 *     untracked can ride along by accident, which is the whole failure mode of
 *     copying a folder by hand.
 *  2. It adds back exactly one thing, `brand/host-photos/`, and then verifies
 *     the result against the never-ship list before writing anything. A
 *     handoff that would carry a key, a session or someone's research is a
 *     failed build, not a warning.
 *
 * Configure with `handoff.config.json` in the repo root (gitignored, so no real
 * person's name lives in the public repository). See handoff.config.example.json.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'handoff');
const ZIP = path.join(ROOT, 'handoff.zip');

const log = (m) => console.log(`  ${m}`);
const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1); };

// --------------------------------------------------------------- the config

const CONFIG_FILE = path.join(ROOT, 'handoff.config.json');
if (!fs.existsSync(CONFIG_FILE)) {
  die(`no handoff.config.json.\n  Copy handoff.config.example.json to handoff.config.json and fill it in.\n  It is gitignored on purpose: a real person's name does not belong in a public repo.`);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
for (const k of ['hostName', 'showName', 'channelUrl', 'builtBy']) {
  if (!String(cfg[k] || '').trim()) die(`handoff.config.json is missing "${k}".`);
}

// -------------------------------------------------- what must never ship

// Checked against the built tree, after the photos are added back. Paths are
// repo-relative and matched as prefixes or exact names.
const NEVER_SHIP = [
  ['data/settings.json', 'your API key and your private ChatGPT project URL'],
  ['data/chatgpt-profile', 'your logged-in ChatGPT session'],
  ['data/usage.json', 'your spend history'],
  ['data/suggestions.json', 'guest research naming real people with commercial notes'],
  ['data/channel-cache.json', 'a cached channel feed'],
  ['projects', 'your generated work'],
  ['demo', 'the built demo'],
  ['handoff', 'a previous handoff build'],
  ['node_modules', 'installed packages'],
  ['.git', 'the repository history'],
];

// Style references are other channels' thumbnails. They are not ours to pass
// on even privately, so the folder ships with its README and nothing else.
const NEVER_SHIP_GLOB = [
  [/^brand\/inspiration\/.*\.(jpe?g|png|webp)$/i, "other channels' thumbnails, which are not yours to redistribute"],
  [/\.log$/i, 'a log file'],
  [/runner-debug\.png$/i, 'a debug screenshot of your ChatGPT sidebar'],
];

const SECRETS = [
  [/\bsk-[A-Za-z0-9_-]{16,}/, 'an OpenAI-shaped API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'a GitHub token'],
  [/\bE:\\+Codex\b/i, "an absolute path from the author's machine"],
  [/\bC:\\+Users\\+[A-Za-z0-9._-]+/i, 'a Windows user folder'],
];

// ------------------------------------------------------------------ helpers

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// ------------------------------------------------------------------- build

console.log('\n  Building the private handoff\n');

if (git('status', '--porcelain').trim()) {
  log('note: uncommitted changes exist. The handoff is built from HEAD, so they are NOT included.');
}

try {
  fs.rmSync(OUT, { recursive: true, force: true });
} catch (err) {
  // On Windows a terminal or editor sitting inside handoff/ locks the folder,
  // and the raw stack trace says nothing useful about why.
  if (err.code === 'EPERM' || err.code === 'EBUSY') {
    die(`handoff/ is in use and cannot be replaced.\n  Close any terminal, editor or file manager that is inside it, then run this again.`);
  }
  throw err;
}
fs.mkdirSync(OUT, { recursive: true });

// 1. tracked files only, read out of HEAD rather than off disk, so uncommitted
//    work in progress cannot ride along. Copied one by one instead of through
//    `git archive | tar`: GNU tar reads a Windows path like C:\tmp\x.tar as a
//    remote host and fails with "Cannot connect to C".
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
for (const rel of tracked) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  }));
}
log(`${tracked.length} tracked files from HEAD`);

// 2. the one thing added back
const photosSrc = path.join(ROOT, 'brand', 'host-photos');
const photosOut = path.join(OUT, 'brand', 'host-photos');
const photos = fs.existsSync(photosSrc)
  ? fs.readdirSync(photosSrc).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  : [];
if (!photos.length) die('brand/host-photos/ has no images. A handoff without the photos is not runnable.');
fs.mkdirSync(photosOut, { recursive: true });
for (const f of photos) fs.copyFileSync(path.join(photosSrc, f), path.join(photosOut, f));
log(`${photos.length} host photos`);

// 3. their settings, without anything of yours
const settings = {
  hostName: cfg.hostName,
  showName: cfg.showName,
  channelUrl: cfg.channelUrl,
  chatgptProjectName: cfg.chatgptProjectName || cfg.showName,
  hostRefPrimary: cfg.hostRefPrimary && photos.includes(cfg.hostRefPrimary) ? cfg.hostRefPrimary : '',
  hostRefCount: 2,
  provider: 'browser',
  // Deliberately absent: openaiApiKey and chatgptProjectUrl. Those are personal
  // to whoever runs the studio, and the point of this build is that none of the
  // builder's are in it.
};
// Belt and braces: the object above is built key by key, but this is the file
// the whole "no credentials of mine" promise rests on, so assert it rather than
// trusting a future edit not to spread something in.
for (const banned of ['openaiApiKey', 'chatgptProjectUrl', 'customCommand']) {
  if (banned in settings) die(`the handoff settings would carry "${banned}". That is personal to whoever runs the studio.`);
}
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
const settingsJson = JSON.stringify(settings, null, 2) + '\n';
// Written twice on purpose. settings.json makes the studio work on first run
// with no setup at all, and it is gitignored in their repo, so their later
// edits survive every `git pull`. settings.example.json is tracked, so there is
// always something to restore from if they break it.
fs.writeFileSync(path.join(OUT, 'data', 'settings.json'), settingsJson);
fs.writeFileSync(path.join(OUT, 'data', 'settings.example.json'), settingsJson);
log('data/settings.json and settings.example.json, prefilled, no credentials');

// 4. a start guide addressed to them
const first = cfg.hostName.trim().split(/\s+/)[0];
fs.writeFileSync(path.join(OUT, 'START-HERE.md'), `# Thumbnail Studio, for ${cfg.showName}

Hi ${first}. This is the whole system. It runs on your own computer, nothing
goes to the cloud, and it ships with **zero credentials of ${cfg.builtBy}'s**:
no API key, no ChatGPT session, no passwords, nothing that could bill or log in
as anyone but you.

Two things are already done for you:

- **Your photos are in \`brand/host-photos/\`.** They attach themselves to every
  picture the studio makes. Drop more in whenever you like.
- **Your channel is already configured.** Host name, show name and channel URL
  are filled in and the studio picks them up the first time it starts. Change
  anything you like in Settings; if you ever want the original back, copy
  \`data/settings.example.json\` over \`data/settings.json\` and restart.

**Now read \`SETUP.md\`.** It is the fifteen-minute walkthrough: install Node,
start the studio, choose how pictures get made, and the normal loop from a new
video to a finished thumbnail. Skip its section 4, that part is done.

## Updating later

If you are comfortable with git, this folder is a repository:

\`\`\`
git pull
\`\`\`

Your photos, your settings and your projects are yours and are never
overwritten by an update. If you are not using git, you will be sent a new ZIP;
replace everything EXCEPT \`brand/\`, \`data/settings.json\` and \`projects/\`.

---

Built by ${cfg.builtBy}. Questions go there.
`);
log('START-HERE.md');

// 5. a .gitignore that keeps their own work out of their repo, while allowing
//    the photos this build exists to deliver
fs.writeFileSync(path.join(OUT, '.gitignore'), `node_modules/
data/settings.json
data/chatgpt-profile/
data/usage.json
data/channel-cache.json
data/suggestions.json
projects/
demo/
handoff/
handoff.zip
*.log

# Host photos ARE tracked here, unlike the public repository. This is what makes
# this copy runnable, and it is why this repository must stay private forever.
`);

// --------------------------------------------------------------- verify it

const built = walk(OUT);
const findings = [];

// The path rules apply to what was COPIED off this machine, not to the handful
// of files written above. data/settings.json is the difference that matters: a
// copied one carries the builder's API key, a generated one is the point of the
// build. Keeping the rule but narrowing its scope means a future edit that
// copies the data folder wholesale still gets caught.
const GENERATED = new Set([
  'data/settings.json', 'data/settings.example.json', 'START-HERE.md', '.gitignore',
]);
const copied = built.filter((f) => !GENERATED.has(f));

for (const [p, why] of NEVER_SHIP) {
  const hit = copied.find((f) => f === p || f.startsWith(p + '/'));
  if (hit) findings.push(`${hit} would ship ${why}`);
}
for (const [re, why] of NEVER_SHIP_GLOB) {
  for (const f of copied) if (re.test(f)) findings.push(`${f} is ${why}`);
}
for (const f of built) {
  if (/\.(jpe?g|png|webp|gif|zip|ai|woff2?)$/i.test(f)) continue;
  const body = fs.readFileSync(path.join(OUT, f), 'utf8');
  for (const [re, why] of SECRETS) {
    const m = body.match(re);
    if (m) findings.push(`${f} contains ${why}: ${JSON.stringify(m[0].slice(0, 24))}`);
  }
}

if (findings.length) {
  fs.rmSync(OUT, { recursive: true, force: true });
  console.error(`\n  ${findings.length} problem${findings.length > 1 ? 's' : ''}, nothing was written:\n`);
  for (const f of findings) console.error(`  x ${f}`);
  console.error('');
  process.exit(1);
}

// ------------------------------------------------------------------ the zip

fs.rmSync(ZIP, { force: true });
try {
  // Relative paths and cwd, for the same "Cannot connect to C" reason as above.
  execFileSync('tar', ['-a', '-c', '-f', '../handoff.zip', '.'], {
    cwd: OUT, stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  log(`note: could not write handoff.zip (${String(err.message).split('\n')[0]}). The folder is fine.`);
}

const bytes = built.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`\n  ok  ${built.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, no credentials, no research, no other channels' images.

  Next:
    cd handoff && git init && git add . && git commit -m "Thumbnail Studio"
    git remote add origin <the PRIVATE repo>   (a new empty repo, NEVER a fork)
    git push -u origin main

  Then add ${first} as a collaborator with READ access.
  That repository can never be made public: it carries real photos of a person.
`);
