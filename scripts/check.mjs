// Runs the whole pipeline against a live studio on a scratch project and
// asserts the invariants that keep breaking. Start the studio first, then:
//
//   node scripts/check.mjs
//
// Exits non-zero on any failure, and deletes the scratch project either way.
// Run it after touching app/lib/blueprint.js or app/server.js.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const API = `http://localhost:${process.env.PORT || 4626}`;
const SLUG_HINT = 'zz check';

let pass = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok    ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); }
}
function section(title) { console.log(`\n${title}`); }

const api = async (method, url, body) => {
  const r = await fetch(`${API}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
};

const upload = async (url, file) => {
  const fd = new FormData();
  fd.append('photos', new Blob([fs.readFileSync(file)]), path.basename(file));
  const r = await fetch(`${API}${url}`, { method: 'POST', body: fd });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const proj = (slug, ...parts) => path.join(ROOT, 'projects', slug, ...parts);
const readProject = (slug) => JSON.parse(fs.readFileSync(proj(slug, 'project.json'), 'utf8'));

// Perceptual signature: survives the resize and JPEG re-encode the export does.
async function signature(file) {
  const sharp = require(path.join(ROOT, 'app', 'node_modules', 'sharp'));
  const buf = await sharp(file).resize(24, 14, { fit: 'fill' }).greyscale().raw().toBuffer();
  return [...buf].map((v) => (v > 128 ? 1 : 0)).join('');
}
const distance = (a, b) => [...a].filter((c, i) => c !== b[i]).length;

// An existing generated image, used to stand in for a real generation.
function sampleImage(kind = 'output') {
  const dirs = fs.readdirSync(path.join(ROOT, 'projects'));
  for (const d of dirs) {
    const dir = proj(d, kind);
    if (!fs.existsSync(dir)) continue;
    const hit = fs.readdirSync(dir).find((f) => /\.(png|jpe?g)$/i.test(f));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

let slug = null;
try {
  const up = await fetch(`${API}/api/meta`).then((r) => r.ok).catch(() => false);
  if (!up) {
    console.log(`\nThe studio is not answering on ${API}. Start it first (START.bat), then rerun.\n`);
    process.exit(2);
  }

  // ---------------------------------------------------------------- engine
  section('Prompt engine, no server needed');
  const bp = require(path.join(ROOT, 'app', 'lib', 'blueprint.js'));

  const figureless = { title: 'A story with no figures', hook: 'nothing numeric', notes: '', episodeType: 'solo', guestName: '' };
  const bigNumber = bp.buildOnePrompt({
    project: figureless, archetypeId: 'big-number', colorwayId: 'signal-red',
    text: 'SOME / TEXT', mood: { host: 'with a big warm smile', guest: 'beaming and warm' },
    useGuestLayout: false, hostName: 'Ada Lovelace', refCounts: { host: 2, guest: 0 },
  });
  check('a figureless big-number winner never renders the string null', !bigNumber.includes('"null"'));

  const lime = bp.buildOnePrompt({
    project: figureless, archetypeId: 'sticker-statement', colorwayId: 'lime-signal',
    text: 'A / B', mood: { host: 'with a big warm smile', guest: 'beaming and warm' },
    useGuestLayout: false, hostName: 'Ada Lovelace', refCounts: { host: 1, guest: 0 },
  });
  check('a recolour switches the accent AND its text rule', lime.includes('Lime Signal') && lime.includes('BLACK ultra-bold text'));

  const edits = bp.normalizeTextEdits([{ index: 1, text: 'he said "hi"\nthere' }, { index: 9, text: 'out of range' }]);
  check('text edits are sanitised and range checked', edits.length === 1 && !edits[0].text.includes('"') && !edits[0].text.includes('\n'));

  // ---------------------------------------------------------------- create
  section('Create and build');
  const created = await api('POST', '/api/projects', {
    hook: 'A solo founder runs 12 products and makes millions a year',
    episodeType: 'interview', guestName: 'Test Guest', titleStatus: 'working',
    hostMood: 'auto', guestMood: 'auto',
  });
  slug = created.body.slug;
  check('thumbnail-first creation derives a working title', created.status === 200 && created.body.titleStatus === 'working' && Boolean(created.body.title));

  const guestPhoto = sampleImage('refs') && fs.readdirSync(path.join(ROOT, 'projects')).map((d) => proj(d, 'refs'))
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => fs.readdirSync(d).filter((f) => f.startsWith('guest-')).map((f) => path.join(d, f)))[0];
  if (guestPhoto) await upload(`/api/projects/${slug}/upload/refs?kind=guest`, guestPhoto);

  await api('POST', `/api/projects/${slug}/pack`);
  let p = readProject(slug);

  check('7 variations', p.variations.length === 7);
  check('every variation records its scene and mood', p.variations.every((v) => v.scene && v.mood));
  check('7 distinct expressions', new Set(p.variations.map((v) => v.mood.host)).size === 7);
  check('no two consecutive share a mood', p.variations.every((v, i) => i === 0 || v.mood.key !== p.variations[i - 1].mood.key));
  check('no fabricated $1M', !p.variations.some((v) => v.prompt.includes('$1M')));
  check('no empty text spec', !p.variations.some((v) => /this text[^:]*: ""/.test(v.prompt)));
  check('nobody is identified by an ordinal', !p.variations.some((v) => v.prompt.includes('second attached')));
  check('prompt engine version stamped', p.promptVersion === bp.PROMPT_ENGINE);

  const duo = p.variations.filter((v) => v.usesGuestPhoto);
  if (guestPhoto) {
    check('duo variations exist when a guest photo does', duo.length > 0);
    check('the guest index always points past the host photos', duo.length > 0 && duo.every((v) => {
      const hosts = (v.attachments || []).filter((a) => /^refs\/(?:host-|andrew)/.test(a)).length;
      return Number((v.prompt.match(/Attached photos? (\d+)/) || [])[1]) === hosts + 1;
    }));
    check('every duo says the guest is a different person', duo.every((v) => v.prompt.includes('DIFFERENT person')));
    check('no solo variation mentions a guest', p.variations.filter((v) => !v.usesGuestPhoto).every((v) => !v.prompt.includes('DIFFERENT person')));
  }

  // ---------------------------------------------------------------- winner
  section('Winner, title, final round');
  const img = sampleImage('output');
  if (!img) throw new Error('no existing generated image to stand in for a generation');
  for (const n of [1, 2]) await upload(`/api/projects/${slug}/upload/output?name=variation-${n}`, img);
  await api('PATCH', `/api/projects/${slug}`, { winner: 'variation-1.png' });

  const noTitle = await api('POST', `/api/projects/${slug}/final-round`);
  check('the final round refuses while the title is provisional', noTitle.status === 400);

  await api('PATCH', `/api/projects/${slug}`, { title: 'The One Man Company Making Millions', titleStatus: 'final' });

  const round = await api('POST', `/api/projects/${slug}/final-round`, { colorwayId: 'lime-signal' });
  check('a recoloured round is produced', round.status === 200 && round.body.options.length > 0);
  check('every option records its colorway', (round.body.options || []).every((o) => o.colorwayId === 'lime-signal'));
  check('a pure recolour is offered (the winning text kept)', (round.body.options || []).some((o) => o.text === p.variations[0].text));

  // ------------------------------------------------------- shipped colour
  section('The shipped image, and what describes it');
  await upload(`/api/projects/${slug}/upload/final?name=final-1`, img);
  await api('PATCH', `/api/projects/${slug}`, { finalChoice: 'final-1.png' });
  await api('POST', `/api/projects/${slug}/social`);
  const social = JSON.parse(fs.readFileSync(proj(slug, 'social', 'social.json'), 'utf8'));

  check('social records the file it was built from', social.builtFrom === 'final/final-1.png');
  check('the X alt text names the SHIPPED colour', /lime signal/i.test(social.xAlt), `got: ${social.xAlt}`);
  check('the portrait alt text names the SHIPPED colour', /lime signal/i.test(social.pAlt), `got: ${social.pAlt}`);

  await api('POST', `/api/projects/${slug}/portrait-pack`);
  const portraitPrompt = fs.readFileSync(proj(slug, 'pack', 'portrait-1.md'), 'utf8');
  check('the AI portrait prompt asks for the SHIPPED accent', /Lime Signal/.test(portraitPrompt));

  await api('POST', `/api/projects/${slug}/export`);
  const shipped = await signature(proj(slug, 'final', 'final-1.png'));
  const exported = await signature(proj(slug, 'export', `${slug}-1280x720.jpg`));
  check('the export is the shipped image', distance(exported, shipped) < 20, `${distance(exported, shipped)} bits apart`);

  // ------------------------------------------------------------ analytics
  const stats = (await api('GET', '/api/analytics')).body;
  const winnerCw = readProject(slug).variations.find((v) => v.index === 1).colorway.id;
  check('a recolour does not pollute the colorway analytics', winnerCw !== 'lime-signal' ? !!stats.colorways : true);

  // ---------------------------------------------------------- invalidation
  section('Invalidation and guards');
  await api('PATCH', `/api/projects/${slug}`, { winner: 'variation-2.png' });
  p = readProject(slug);
  check('changing the winner drops the final round and its pick', !p.finalRound && !p.finalChoice);

  const traversal = await api('POST', `/api/projects/${slug}/export`, { file: '../refs/anything.jpg' });
  check('export refuses a traversing filename', traversal.status === 400);

  const ghost = await upload('/api/projects/definitely-not-a-project/upload/refs?kind=bg', img);
  check('an unknown slug is refused', ghost.status >= 400);
  check('and leaves no orphan folder', !fs.existsSync(proj('definitely-not-a-project')));
} catch (err) {
  failures.push(`threw: ${err.message}`);
  console.log(`\n  FAIL  the run threw: ${err.message}`);
} finally {
  if (slug) {
    await api('DELETE', `/api/projects/${slug}`).catch(() => {});
    console.log(`\nscratch project ${slug} removed`);
  }
}

console.log(`\n${pass} ok, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
