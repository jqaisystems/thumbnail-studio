// Builds a read-only static demo of Thumbnail Studio into demo/.
// Freezes every API response as JSON, downscales images, and strips anything
// private: no API keys, no session, no scraped guest photos, no local paths.
//
// Usage: start the studio (START.bat), then: node scripts/build-demo.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireApp = createRequire(path.join(ROOT, 'app', 'package.json'));
const sharp = requireApp('sharp');

const APP = 'http://localhost:4626';
const OUT = path.join(ROOT, 'demo');
const MAX_W = 1280;

const log = (...a) => console.log(...a);
const get = async (url) => {
  const r = await fetch(APP + url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};
const write = (rel, data) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};

// PNG sources become JPG in the demo; filenames are rewritten to match.
const demoName = (f) => f.replace(/\.png$/i, '.jpg');

async function copyImage(src, destRel) {
  const dest = path.join(OUT, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(src).resize({ width: MAX_W, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(dest);
  return fs.statSync(dest).size;
}

async function main() {
  // Wipe the output but keep .vercel, which holds the project link.
  fs.mkdirSync(OUT, { recursive: true });
  for (const entry of fs.readdirSync(OUT)) {
    if (entry === '.vercel') continue;
    fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
  }
  let bytes = 0;

  // ---- static shell (one codebase, demo flag flipped) ----
  const pub = path.join(ROOT, 'app', 'public');
  for (const f of fs.readdirSync(pub)) fs.copyFileSync(path.join(pub, f), path.join(OUT, f));
  write('demo-config.js', 'window.DEMO_MODE = true;\n');

  // ---- meta, with local paths removed ----
  const meta = await get('/api/meta');
  meta.projectsDir = 'projects';
  delete meta.root;
  // Other channels' thumbnails are not ours to republish on a public host.
  // Reality Check degrades to the real-channel feed without them.
  meta.inspiration = [];
  write('api/meta.json', meta);

  // ---- settings: an allowlist, not a denylist ----
  // Naming what may be published means a new secret-bearing setting is absent
  // by default. A `delete` list does the opposite: the day someone adds
  // `dropboxToken` it ships to Vercel and nothing says so.
  const PUBLIC_SETTINGS = [
    'chatgptProjectName', 'hostRefCount', 'hostRefPrimary', 'useWinnerBias',
    'biasThreshold', 'channelUrl', 'chatgptPlan', 'monthlyImageBudget',
    'monthlyTokenBudget', 'hostName', 'showName', 'provider', 'stripAiMetadata',
  ];
  const live = await get('/api/settings');
  const settings = Object.fromEntries(
    PUBLIC_SETTINGS.filter((k) => live[k] !== undefined).map((k) => [k, live[k]])
  );
  write('api/settings.json', settings);

  // ---- analytics: aggregate win counts, nothing personal ----
  write('api/analytics.json', await get('/api/analytics'));

  // ---- suggestions: NEVER the real file. It names real founders with
  // private revenue research. The example file exists for exactly this. ----
  const exampleSuggestions = path.join(ROOT, 'data', 'suggestions.example.json');
  write('api/suggestions.json', JSON.parse(fs.readFileSync(exampleSuggestions, 'utf8')));

  // ---- usage: keep the page rendering, publish no real history ----
  const usage = await get('/api/usage');
  write('api/usage.json', { ...usage, months: {} });

  // ---- roadmap: shipped features only, not unreleased plans ----
  const roadmap = await get('/api/roadmap');
  write('api/roadmap.json', {
    ...roadmap,
    items: (roadmap.items || []).filter((i) => i.status === 'done'),
  });
  try {
    write('api/channel-feed.json', await get('/api/channel-feed'));
  } catch {
    log('channel-feed unavailable, demo will fall back to mixed decoys');
  }

  // ---- brand images (the host's own photos, used with their permission) ----
  for (const f of meta.hostPhotos || []) {
    bytes += await copyImage(path.join(ROOT, 'brand', 'host-photos', f), `brand/host/${f}`);
  }

  // ---- projects ----
  const projects = await get('/api/projects');
  const listed = [];

  for (const p of projects) {
    // Projects with nothing generated yet have nothing to show.
    if (!p.outputs || !p.outputs.length) {
      log(`  ${p.slug}: skipped, no thumbnails`);
      continue;
    }
    const dir = path.join(ROOT, 'projects', p.slug);
    const outputs = [];
    for (const f of p.outputs) {
      const src = path.join(dir, 'output', f);
      if (!fs.existsSync(src)) continue;
      bytes += await copyImage(src, `files/${p.slug}/output/${demoName(f)}`);
      outputs.push(demoName(f));
    }

    const finals = [];
    for (const f of p.finals || []) {
      const src = path.join(dir, 'final', f);
      if (!fs.existsSync(src)) continue;
      bytes += await copyImage(src, `files/${p.slug}/final/${demoName(f)}`);
      finals.push(demoName(f));
    }

    // Guest photos were found by web search: never republish them. Style refs
    // are copies of other channels' thumbnails: not ours to republish either.
    const refs = (p.refs || []).filter((f) => !f.startsWith('guest-') && !f.startsWith('style-ref'));
    for (const f of refs) {
      const src = path.join(dir, 'refs', f);
      if (fs.existsSync(src)) bytes += await copyImage(src, `files/${p.slug}/refs/${demoName(f)}`);
    }

    const demoProject = {
      ...p,
      outputs,
      finals,
      refs: refs.map(demoName),
      winner: p.winner ? demoName(p.winner) : null,
      finalChoice: p.finalChoice ? demoName(p.finalChoice) : undefined,
      ranking: (p.ranking || []).map(demoName),
      chatUrl: undefined,
      // Notes are private prospecting research ("a white whale guest, worth
      // the pursuit", revenue claims about named people). Title and hook are
      // the video's public-facing packaging; notes are not.
      notes: '',
      refNotes: '',
    };
    write(`api/projects/${p.slug}.json`, demoProject);
    listed.push(demoProject);
    log(`  ${p.slug}: ${outputs.length} thumbnails`);

    // social pack: only the finished, publishable sizes
    let social = null;
    try { social = await get(`/api/projects/${p.slug}/social`); } catch {}
    let socialCount = 0;
    if (social) {
      const keep = (social.files || []).filter((f) => /\.jpe?g$/i.test(f));
      for (const f of keep) {
        const src = path.join(dir, 'social', f);
        if (fs.existsSync(src)) bytes += await copyImage(src, `files/${p.slug}/social/${f}`);
      }
      socialCount = keep.length;
      // The LinkedIn post derives its bullets from the project notes, so the
      // stored text can carry the private research. Recompose it noteless.
      const socialcopy = requireApp('./lib/socialcopy.js');
      write(`api/projects/${p.slug}-social.json`, {
        ...social,
        liPost: socialcopy.composeLinkedInPost({ ...p, notes: '' }, settings),
        winner: social.winner ? demoName(social.winner) : social.winner,
        files: keep,
      });
    }

    // Every demo image is re-encoded by sharp above, which drops metadata, so
    // the demo is clean by construction. Snapshot it so the status row renders
    // instead of removing itself.
    write(`api/projects/${p.slug}-metadata.json`, {
      files: outputs.length + socialCount,
      dirty: 0,
      findings: 0,
      items: [],
      errors: [],
      enabled: true,
    });

    try {
      const rows = await get(`/api/projects/${p.slug}/legibility`);
      write(
        `api/projects/${p.slug}-legibility.json`,
        rows.map((r) => ({ ...r, file: demoName(r.file) }))
      );
    } catch {}
  }

  write('api/projects.json', listed);
  write('vercel.json', JSON.stringify({ cleanUrls: false, trailingSlash: false }, null, 2));

  const total = (bytes / 1024 / 1024).toFixed(1);
  log(`\nDemo built at ${OUT}`);
  log(`Images: ${total} MB`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
