// backup.mjs - a dated ZIP of everything you would miss, into OneDrive.
//
// Why a ZIP and not a git remote: projects/ is 149MB of generated images and
// is gitignored, so a git push protects the code and none of the actual work.
// Git also keeps every version of every file forever and images do not
// delta-compress, so committing them would grow without bound. A dated ZIP
// with retention stays the same size forever, because old snapshots roll off.
//
// The archive is deliberately credential-free: no ChatGPT session, no
// settings file. That means it is safe to store anywhere, including a cloud
// folder that syncs to someone else's servers.
//
// Usage:  node scripts/backup.mjs [--dest <folder>] [--keep <n>]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireApp = createRequire(path.join(ROOT, 'app', 'package.json'));
// archiver stays pinned at v7: v8 is ESM-only with a different API (AGENTS.md rule 5).
const archiver = requireApp('archiver');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const KEEP = Number(argValue('--keep')) || 3;

// OneDrive moves around between machines and locales, so ask the environment
// before falling back to the usual spot.
function defaultDest() {
  const fromEnv = process.env.OneDriveCommercial || process.env.OneDriveConsumer || process.env.OneDrive;
  const base = fromEnv && fs.existsSync(fromEnv) ? fromEnv : path.join(os.homedir(), 'OneDrive');
  return path.join(base, 'Backups', 'thumbnail-studio');
}

const DEST = argValue('--dest') || defaultDest();

// What goes in. Everything else in the folder is either rebuildable or a
// credential.
const INCLUDE_DIRS = ['projects', 'brand', 'docs', 'scripts', 'app', '.git'];
const INCLUDE_FILES = [
  'README.md', 'AGENTS.md', 'LICENSE', 'SETUP.md',
  'START.bat', 'START.command', '.gitignore',
];
const INCLUDE_DATA = ['roadmap.json', 'suggestions.json', 'usage.json', 'channel-cache.json'];

// What stays out, and why it is safe to leave out.
const EXCLUDED = [
  ['app/node_modules/', '382MB, npm install rebuilds it'],
  ['data/chatgpt-profile/', 'a live logged-in session, and 90% of the excluded weight'],
  ['data/settings.json', 'can hold an API key; keeps this archive safe to store anywhere'],
  ['demo/', 'rebuilt by scripts/build-demo.mjs'],
  ['handoff*', 'rebuilt by scripts/build-handoff.mjs'],
];

const skip = (p) => p.split(path.sep).includes('node_modules');

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (skip(full)) continue;
    if (entry.isDirectory()) walk(full, onFile);
    else if (entry.isFile()) onFile(full);
  }
}

// YYYY-MM-DD in local time. toISOString() would use UTC and can name a
// backup with yesterday's date depending on the hour.
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function prune(dest, keep) {
  const archives = fs
    .readdirSync(dest)
    .filter((f) => /^thumbnail-studio-\d{4}-\d{2}-\d{2}\.zip$/.test(f))
    .sort()
    .reverse();
  const doomed = archives.slice(keep);
  for (const f of doomed) fs.rmSync(path.join(dest, f), { force: true });
  return { kept: archives.slice(0, keep), removed: doomed };
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });

  const name = `thumbnail-studio-${today()}.zip`;
  const finalPath = path.join(DEST, name);
  // Build to a temp name so a crashed run never leaves a half-written archive
  // sitting there looking like a valid backup.
  const tempPath = `${finalPath}.partial`;

  const output = fs.createWriteStream(tempPath);
  const zip = archiver('zip', { zlib: { level: 6 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    zip.on('error', reject);
  });
  zip.pipe(output);

  let files = 0;
  let rawBytes = 0;
  const add = (abs) => {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    zip.file(abs, { name: `thumbnail-studio/${rel}` });
    files++;
    try { rawBytes += fs.statSync(abs).size; } catch {}
  };

  for (const dir of INCLUDE_DIRS) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) walk(full, add);
  }
  for (const f of INCLUDE_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) add(full);
  }
  for (const f of INCLUDE_DATA) {
    const full = path.join(ROOT, 'data', f);
    if (fs.existsSync(full)) add(full);
  }

  zip.append(
    `Thumbnail Studio backup, ${today()}\n` +
    `${'='.repeat(40)}\n\n` +
    `To restore: unzip, then inside thumbnail-studio/app run "npm install",\n` +
    `then double-click START.bat (Windows) or START.command (Mac).\n\n` +
    `Deliberately NOT in this archive:\n` +
    EXCLUDED.map(([what, why]) => `  ${what.padEnd(28)} ${why}`).join('\n') +
    `\n\nSo after restoring you will need to re-enter Settings (host name, show\n` +
    `name, channel URL, ChatGPT project URL, any API key), and run\n` +
    `"node scripts/chatgpt-runner.mjs login" once if you use that runner.\n` +
    `Both take about a minute. Nothing else is missing.\n`,
    { name: 'thumbnail-studio/RESTORE-ME.txt' }
  );

  await zip.finalize();
  await done;

  fs.renameSync(tempPath, finalPath);
  const bytes = fs.statSync(finalPath).size;
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

  const { kept, removed } = prune(DEST, KEEP);

  console.log(`Backed up ${files} files (${mb(rawBytes)} raw) to`);
  console.log(`  ${finalPath}`);
  console.log(`  ${mb(bytes)} compressed`);
  console.log(`\nExcluded on purpose:`);
  for (const [what, why] of EXCLUDED) console.log(`  ${what.padEnd(28)} ${why}`);
  console.log(`\nArchives kept (${kept.length}/${KEEP}):`);
  for (const f of kept) console.log(`  ${f}`);
  if (removed.length) {
    console.log(`Rolled off:`);
    for (const f of removed) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error('BACKUP FAILED:', e.message);
  process.exit(1);
});
