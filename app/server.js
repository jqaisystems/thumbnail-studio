// Thumbnail Studio
// Local server: projects on disk, prompt packs, gallery. No external services.

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const {
  COLORWAYS, ARCHETYPES, MOODS, AUTO_MOOD, PROMPT_ENGINE,
  buildVariations, normalizeMoodPlan, resolveMoods,
  normalizeTextEdits, normalizePromptEdits,
  buildOnePrompt, titleThumbTexts, cleanEditText,
} = require('./lib/blueprint');

const isMoodKey = (k) => k === AUTO_MOOD.key || Boolean(MOODS[k]);
const usage = require('./lib/usage');
const cleanmeta = require('./lib/cleanmeta');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT, 'projects');
const HOST_DIR = path.join(ROOT, 'brand', 'host-photos');
const INSPO_DIR = path.join(ROOT, 'brand', 'inspiration');
const DATA_DIR = path.join(ROOT, 'data');
const MAX_ATTACH = 10; // GPT Image on chatgpt.com accepts at most 10 images per message

// ---------- settings --------------------------------------------------------

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  chatgptProjectName: 'Thumbnail Studio', // ChatGPT project all thumbnail chats live in
  hostRefCount: 2,                     // how many host photos to attach (1-2)
  // Filename inside brand/host-photos/ attached first to every generation. Empty
  // means "use the first image in the folder", so a fresh install works with no
  // editing; set it in Settings once you know which headshot is your best.
  hostRefPrimary: '',
  useWinnerBias: true,                 // pair top layout with top colorway once enough winners exist
  biasThreshold: 5,                    // winners needed before the bias kicks in
  channelUrl: '',                      // your channel; the real feed Reality Check pulls
  chatgptPlan: 'pro',                  // free | plus | pro | team (for the limits reference)
  // The ChatGPT project page where new video chats are created (runner + agents)
  // Personal to whoever runs this. Set it in Settings; the local
  // data/settings.json is gitignored so it never travels with the code.
  chatgptProjectUrl: '',
  monthlyImageBudget: 0,               // 0 = no budget cap tracking
  monthlyTokenBudget: 0,               // 0 = no budget cap tracking
  hostName: 'the host',                // who the thumbnails feature (white-label)
  showName: 'Your channel',            // channel name shown in simulations
  provider: 'browser',                 // browser (no APIs, default) | openai | custom
  openaiApiKey: '',                    // only used when provider = openai
  customCommand: '',                   // shell template with {prompt} {refs} {out}, used when provider = custom
  // Images downloaded from chatgpt.com carry a ~25KB C2PA "Content
  // Credentials" block that otherwise travels into every delivered ZIP.
  stripAiMetadata: true,               // remove it from generated images (never from refs/)
};

// A shell template the app hands to exec(). It is deliberately NOT settable
// over HTTP, and not honoured at all unless the person who started the process
// opted in: an unauthenticated request that can set this turns the studio into
// a remote shell for anyone who can reach the port. Write it into
// data/settings.json by hand and start with
// THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND=1. See docs/RUNBOOK.md, runner E.
const ALLOW_CUSTOM_COMMAND = process.env.THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND === '1';

// What a browser is allowed to see. The API key is a credential and the custom
// command is executable, so neither ever leaves this process; the UI gets a
// boolean and posts a value only when it is actually changing one.
function redactSettings(s) {
  const { openaiApiKey, customCommand, ...safe } = s;
  return {
    ...safe,
    hasOpenaiApiKey: Boolean(openaiApiKey),
    hasCustomCommand: Boolean(customCommand),
    customCommandAllowed: ALLOW_CUSTOM_COMMAND,
  };
}

function readSettings() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  // Settings files written before the white-label rename carry andrewRefCount.
  // Spreading the file over the defaults would silently drop a saved 2 back to
  // the default, so the old key is read once and then forgotten on the next save.
  if (saved.hostRefCount === undefined && [1, 2].includes(Number(saved.andrewRefCount))) {
    saved.hostRefCount = Number(saved.andrewRefCount);
  }
  delete saved.andrewRefCount;
  return { ...DEFAULT_SETTINGS, ...saved };
}

// The photo attached first to every generation. A name set in Settings wins; a
// fresh install with photos dropped in and nothing configured still works.
function primaryHostPhoto(settings) {
  const photos = listImages(HOST_DIR);
  const picked = String(settings?.hostRefPrimary || '').trim();
  return (picked && photos.includes(picked) ? picked : photos[0]) || '';
}

const PORT = Number(process.env.PORT) || 4626;
const app = express();
app.use(express.json({ limit: '5mb' }));

fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- helpers ---------------------------------------------------------

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function projectDir(slug) {
  const dir = path.resolve(PROJECTS_DIR, slug);
  // The separator matters: without it "projects-other" passes as a prefix of
  // "projects", so ../projects-x/y would escape the tree.
  if (dir !== PROJECTS_DIR && !dir.startsWith(PROJECTS_DIR + path.sep)) throw new Error('bad slug');
  return dir;
}

// Concept-first projects arrive with a hook but no title yet. The working
// title keeps project.title non-empty until a real title is adopted, because
// the slug, the ZIP README, the portrait card and every alt text assume one.
function workingTitleFrom(hook) {
  const first = String(hook).split(/[.!?\n]/)[0].trim();
  return first.split(/\s+/).filter(Boolean).slice(0, 8).join(' ') || 'untitled';
}

function readProject(slug) {
  const file = path.join(projectDir(slug), 'project.json');
  if (!fs.existsSync(file)) return null;
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!p.titleStatus) p.titleStatus = 'final'; // projects predating thumbnail-first
  p.refs = listImages(path.join(projectDir(slug), 'refs'));
  p.outputs = listImages(path.join(projectDir(slug), 'output'));
  p.finals = listImages(path.join(projectDir(slug), 'final'));
  return p;
}

function writeProject(p) {
  const { refs, outputs, finals, ...data } = p;
  fs.writeFileSync(
    path.join(projectDir(p.slug), 'project.json'),
    JSON.stringify(data, null, 2)
  );
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => IMAGE_RE.test(f)).sort();
}

// Host references inside a project's refs/. Seeded copies are host-ref-1 and
// host-ref-2; extras the user uploads arrive as host-<name>. Projects created
// before the white-label rename carry andrew-ref.jpg, so both names match or an
// old project would suddenly generate with no face reference at all.
const isHostRef = (f) => /^(?:host-|andrew)/i.test(String(f).replace(/^refs\//, ''));
const HOST_SEED_RE = /^(?:host-ref|andrew-ref)-?(\d*)\./i;

// hostRefs[0] is the face the agent instructions point at, so a plain
// alphabetical sort is not enough: "host-alice.jpg" would outrank the headshot
// chosen in Settings. Seeded refs come first and in order, extras follow.
function orderHostRefs(files) {
  const rank = (f) => {
    const m = f.match(HOST_SEED_RE);
    return m ? Number(m[1] || 1) : 1000;
  };
  return [...files].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readProject(d.name))
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

// A final round is a re-cut of one specific winning thumbnail. Once the winner
// changes it describes an image that no longer wins, so it stops shipping and
// stops being offered. The generated files stay on disk.
function dropFinalRound(p) {
  delete p.finalChoice;
  delete p.finalRound;
}

// The colour of the image that actually ships. Everything that DESCRIBES the
// thumbnail (the portrait card glow, both alt texts, the AI portrait prompts)
// used to read the winning variation's colorway, which is only correct while
// the final round preserves colour. Once a final option can be recoloured,
// that inference is wrong and nothing else records the truth.
function shippedColorway(p) {
  const winnerVar = p.variations?.find((x) => String(p.winner).startsWith(`variation-${x.index}.`)) || null;
  const fallback = winnerVar ? COLORWAYS.find((c) => c.id === winnerVar.colorway.id) || null : null;
  if (!p.finalChoice) return fallback;
  const opt = (p.finalRound?.options || []).find((o) => String(p.finalChoice).startsWith(`final-${o.n}.`));
  return (opt?.colorwayId && COLORWAYS.find((c) => c.id === opt.colorwayId)) || fallback;
}

// The image that actually ships. p.winner always names a variation, because
// the layout analytics and half a dozen lookups resolve the winning variation
// object from that filename. A final-round pick overrides only what leaves the
// studio: the export, the social pack, the portraits and the ZIP.
function deliveredImage(p) {
  const rel = (bucket, file) => ({ bucket, file, path: path.join(projectDir(p.slug), bucket, file) });
  if (p.finalChoice) {
    const hit = rel('final', p.finalChoice);
    if (fs.existsSync(hit.path)) return hit;
  }
  return p.winner ? rel('output', p.winner) : null;
}

// ---------- guest reference hygiene -----------------------------------------
// A guest photo is a FACE reference. Two things must never reach that slot:
// a wide 16:9 image (a thumbnail or screenshot, not a portrait), and anything
// from brand/inspiration/, which holds old thumbnails from the host's own
// channel and therefore contains the host's face. One of those was dropped in
// as a guest photo and every duo prompt then carried two host faces.

const MAX_GUEST_ASPECT = 1.6; // same threshold the guest photo search uses

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function inspirationHashes() {
  const map = new Map();
  for (const f of listImages(INSPO_DIR)) {
    try { map.set(md5(path.join(INSPO_DIR, f)), f); } catch {}
  }
  return map;
}

// Returns a human reason string, or null when the file is usable as a guest ref.
async function guestRefProblem(file, inspoHashes) {
  try {
    const hit = inspoHashes.get(md5(file));
    if (hit) return `same image as brand/inspiration/${hit}, a thumbnail from this channel (it has the host's face in it)`;
    const m = await sharp(file).metadata();
    const rotated = m.orientation >= 5; // EXIF sideways: width and height are swapped
    const w = rotated ? m.height : m.width;
    const h = rotated ? m.width : m.height;
    if (!w || !h) return 'could not read the image size';
    if (w / h > MAX_GUEST_ASPECT) return `${w}x${h} is too wide for a face reference, it looks like a thumbnail or screenshot`;
    return null;
  } catch (err) {
    return `could not be read (${err.message || err})`;
  }
}

// ---------- AI metadata -----------------------------------------------------
// Only the buckets we generate. refs/ holds real photos of real people, and
// stripping their EXIF can take orientation with it, so it is never swept.

const CLEANABLE_BUCKETS = ['output', 'social', 'export', 'final'];

function cleanOne(file) {
  try {
    return cleanmeta.cleanFile(file);
  } catch (err) {
    // A single odd file must never break an upload or a ZIP.
    console.warn(`[cleanmeta] skipped ${path.basename(file)}: ${err.message || err}`);
    return null;
  }
}

// Sweeps a project's generated images. This is the only thing that catches
// files written straight to disk by Codex, which never touches this server.
function sweepProject(slug) {
  const dir = projectDir(slug);
  const total = { cleaned: 0, removed: 0, bytesSaved: 0, errors: [] };
  for (const bucket of CLEANABLE_BUCKETS) {
    const r = cleanmeta.cleanDir(path.join(dir, bucket));
    total.cleaned += r.cleaned;
    total.removed += r.removed;
    total.bytesSaved += r.bytesSaved;
    total.errors.push(...r.errors);
  }
  return total;
}

function metadataReport(slug) {
  const dir = projectDir(slug);
  const report = { files: 0, dirty: 0, findings: 0, items: [], errors: [] };
  for (const bucket of CLEANABLE_BUCKETS) {
    const r = cleanmeta.inspectDir(path.join(dir, bucket));
    report.files += r.files;
    report.dirty += r.dirty;
    report.findings += r.findings;
    report.items.push(...r.items.map((i) => ({ ...i, bucket })));
    report.errors.push(...r.errors);
  }
  return report;
}

// ---------- uploads ---------------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Multer runs before the route handler, so this has to reject an unknown
      // or traversing slug itself: throwing here is uncaught and would take the
      // process down, and creating the folder first left orphans behind.
      try {
        const dir = path.join(projectDir(req.params.slug), '');
        if (!fs.existsSync(path.join(dir, 'project.json'))) return cb(new Error('project not found'));
        // Anything not named here silently lands in refs/, so a new bucket
        // must be added on purpose.
        const named = ['output', 'social', 'final'];
        const sub = named.includes(req.params.bucket) ? req.params.bucket : 'refs';
        const target = path.join(dir, sub);
        fs.mkdirSync(target, { recursive: true });
        cb(null, target);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const clean = file.originalname.replace(/[^\w.\-]+/g, '_');
      if (req.query.name) {
        // exact target name (e.g. variation-3), keep original extension
        return cb(null, `${String(req.query.name).replace(/[^\w-]/g, '')}${path.extname(clean) || '.png'}`);
      }
      const prefix = req.query.kind ? `${req.query.kind}-` : '';
      cb(null, `${prefix}${clean}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, IMAGE_RE.test(file.originalname)),
});

// ---------- API -------------------------------------------------------------

app.get('/api/meta', (req, res) => {
  res.json({
    colorways: COLORWAYS,
    moods: Object.fromEntries(Object.entries(MOODS).map(([k, v]) => [k, v.label])),
    autoMood: AUTO_MOOD,
    archetypes: ARCHETYPES.map(({ layout, ...a }) => a),
    hostPhotos: listImages(HOST_DIR),
    inspiration: listImages(INSPO_DIR),
    promptVersion: PROMPT_ENGINE,
    projectsDir: PROJECTS_DIR,
    root: ROOT,
  });
});

app.get('/api/projects', (req, res) => res.json(listProjects()));

app.post('/api/projects', (req, res) => {
  const { title = '', hook = '', notes = '', episodeType = 'solo', guestName = '', refNotes = '', hostMood = 'smiley', guestMood = 'smiley' } = req.body;
  if (!String(title).trim() && !String(hook).trim()) {
    return res.status(400).json({ error: 'title or hook required' });
  }

  // Thumbnail-first: no title yet means a working title derived from the hook,
  // to be replaced by the title suggester once a winner exists.
  const finalTitle = String(title).trim() || workingTitleFrom(hook);
  const titleStatus =
    String(title).trim() && req.body.titleStatus !== 'working' ? 'final' : 'working';

  let slug = slugify(finalTitle);
  let n = 2;
  while (fs.existsSync(projectDir(slug))) slug = `${slugify(finalTitle)}-${n++}`;

  const seed = listProjects().length % COLORWAYS.length;
  const project = {
    slug,
    title: finalTitle,
    titleStatus,
    hook: hook.trim(),
    notes: notes.trim(),
    episodeType,
    guestName: guestName.trim(),
    refNotes: refNotes.trim(),
    hostMood: isMoodKey(hostMood) ? hostMood : 'smiley',
    guestMood: isMoodKey(guestMood) ? guestMood : 'smiley',
    guestEverywhere: Boolean(req.body.guestEverywhere),
    seed,
    winner: null,
    variations: [],
    createdAt: new Date().toISOString(),
  };

  const dir = projectDir(slug);
  for (const sub of ['refs', 'output', 'pack']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  writeProject(project);
  res.json(readProject(slug));
});

app.get('/api/projects/:slug', (req, res) => {
  const p = readProject(req.params.slug);
  return p ? res.json(p) : res.status(404).json({ error: 'not found' });
});

app.patch('/api/projects/:slug', (req, res) => {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });
  const allowed = ['hook', 'notes', 'episodeType', 'guestName', 'winner', 'refNotes'];
  const hadWinner = p.winner;
  for (const key of allowed) if (key in req.body) p[key] = req.body[key];
  if ('winner' in req.body && p.winner !== hadWinner) dropFinalRound(p);
  // An emptied title would corrupt everything downstream that assumes one.
  if ('title' in req.body && String(req.body.title).trim()) p.title = String(req.body.title).trim();
  if (['working', 'final'].includes(req.body.titleStatus)) p.titleStatus = req.body.titleStatus;
  // The final-round pick is what ships; null falls back to the winner.
  if ('finalChoice' in req.body) {
    const pick = req.body.finalChoice;
    if (!pick) delete p.finalChoice;
    else if (listImages(path.join(projectDir(p.slug), 'final')).includes(pick)) p.finalChoice = pick;
  }
  for (const key of ['hostMood', 'guestMood']) {
    if (key in req.body && isMoodKey(req.body[key])) p[key] = req.body[key];
  }
  if ('guestEverywhere' in req.body) p.guestEverywhere = Boolean(req.body.guestEverywhere) && req.body.guestEverywhere !== 'false';
  // Each video keeps ONE ChatGPT conversation; the runner stores it here.
  if (typeof req.body.chatUrl === 'string' && /^https:\/\/chatgpt\.com\//.test(req.body.chatUrl)) {
    p.chatUrl = req.body.chatUrl;
  }
  writeProject(p);
  res.json(readProject(p.slug));
});

app.delete('/api/projects/:slug', (req, res) => {
  const dir = projectDir(req.params.slug);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'not found' });
  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

app.post('/api/projects/:slug/upload/:bucket', upload.array('photos', 10), async (req, res) => {
  try {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });

  // Guest photos are face references. Reject anything that cannot be one
  // before it reaches a prompt. Multer has already written the file, so the
  // check happens here and removes what it rejects.
  const rejected = [];
  if (req.query.kind === 'guest') {
    const inspoHashes = inspirationHashes();
    for (const f of req.files || []) {
      const reason = await guestRefProblem(f.path, inspoHashes);
      if (!reason) continue;
      try { fs.rmSync(f.path, { force: true }); } catch {}
      rejected.push({ file: f.filename, reason });
    }
  }

  // Strip provenance the moment a generated image lands. This covers the
  // Playwright runner, the browser agents and manual drops, which is where
  // every C2PA block found so far came from.
  if (readSettings().stripAiMetadata && CLEANABLE_BUCKETS.includes(req.params.bucket)) {
    for (const f of req.files || []) cleanOne(f.path);
  }
  // A thumbnail arriving in output/ means one image was generated via ChatGPT web.
  const m = String(req.query.name || '').match(/^variation-(\d)$/);
  if (req.params.bucket === 'output' && m) {
    const v = p.variations?.find((x) => x.index === Number(m[1]));
    const runner = String(req.query.runner || 'manual');
    usage.record({
      kind: runner === 'codex' ? 'codex-image' : 'browser-image',
      model: runner === 'codex' ? 'gpt-image-2 (Codex plan)' : `gpt-image (ChatGPT plan, ${runner})`,
      images: 1,
      estTokens: usage.estTokens(v?.promptFinal || v?.prompt || ''),
    });
    // An LLM piloting the browser costs Claude tokens; the scripted runner
    // and manual flow cost none. Rough estimate per piloted image.
    if (runner === 'claude') {
      usage.record({ kind: 'claude-piloting', model: 'claude (browser piloting)', estTokens: 20000 });
    }
  }
  res.json({ ...readProject(req.params.slug), rejected });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Read-only: what provenance metadata is still sitting in this project.
app.get('/api/projects/:slug/metadata', (req, res) => {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });
  try {
    res.json({ ...metadataReport(p.slug), enabled: readSettings().stripAiMetadata });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Sweep on demand. Works even with the setting off, because pressing the
// button is itself the decision.
app.post('/api/projects/:slug/clean-metadata', (req, res) => {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });
  try {
    const swept = sweepProject(p.slug);
    res.json({ ...swept, report: metadataReport(p.slug) });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.delete('/api/projects/:slug/file/:bucket/:name', (req, res) => {
  const { slug, bucket, name } = req.params;
  if (!['refs', 'output', 'social', 'final'].includes(bucket)) return res.status(400).json({ error: 'bad bucket' });
  const file = path.resolve(projectDir(slug), bucket, name);
  if (!file.startsWith(projectDir(slug))) return res.status(400).json({ error: 'bad path' });
  if (fs.existsSync(file)) fs.rmSync(file);
  res.json(readProject(slug));
});

// Generate the 7 prompts + write the handoff pack to disk.
app.post('/api/projects/:slug/pack', async (req, res) => {
  try {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });

  const dir = projectDir(p.slug);
  const packDir = path.join(dir, 'pack');
  const refsDir = path.join(dir, 'refs');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(refsDir, { recursive: true });

  // Ensure the canonical host refs + one style ref are in the project's refs.
  // Which photo leads is a setting, not a constant, so an adopter drops their
  // own images into brand/host-photos/ and the studio works with no code edit.
  const settings = readSettings();
  // Seed only into a project that has no host reference yet. Topping up a
  // project that already holds the pre-rename andrew-ref.jpg would leave two
  // copies of one face in refs/, and the pack would attach the same photo twice.
  if (!listImages(refsDir).some(isHostRef)) {
    const primary = primaryHostPhoto(settings);
    const seedPhotos = [primary, listImages(HOST_DIR).find((f) => f !== primary)].filter(Boolean);
    seedPhotos.slice(0, 2).forEach((src, i) => {
      fs.copyFileSync(path.join(HOST_DIR, src), path.join(refsDir, `host-ref-${i + 1}${path.extname(src)}`));
    });
  }
  const inspo = listImages(INSPO_DIR);
  if (inspo.length && !listImages(refsDir).some((f) => f.startsWith('style-ref'))) {
    fs.copyFileSync(path.join(INSPO_DIR, inspo[0]), path.join(refsDir, `style-ref${path.extname(inspo[0])}`));
  }

  const refFiles = listImages(refsDir);
  const hostRefFiles = orderHostRefs(refFiles.filter(isHostRef));
  const logoRefs = refFiles.filter((f) => f.startsWith('logo-'));
  const bgRefs = refFiles.filter((f) => f.startsWith('bg-'));

  // Drop guest refs that cannot be a face (see guestRefProblem). Files stay on
  // disk so the user can see and delete them; they just never reach a prompt.
  const inspoHashes = inspirationHashes();
  const guestPhotos = [];
  const skippedRefs = [];
  for (const f of refFiles.filter((x) => x.startsWith('guest-'))) {
    const reason = await guestRefProblem(path.join(refsDir, f), inspoHashes);
    reason ? skippedRefs.push({ file: f, reason }) : guestPhotos.push(f);
  }

  // These two arrays are the ONE source of truth: they are both what gets
  // attached and what the prompt counts. Never re-slice them somewhere else,
  // or the prompt starts describing a different photo than the one attached.
  const hostRefs = hostRefFiles.slice(0, settings.hostRefCount);
  const guestRefs = guestPhotos.slice(0, 2);

  p.hasGuestPhoto = guestRefs.length > 0;
  p.skippedRefs = skippedRefs;
  p.promptVersion = PROMPT_ENGINE;
  // This replaces the array wholesale, so anything a user edits must live on
  // the PROJECT (textEdits, promptEdits, moodPlan), never on a variation.
  p.variations = buildVariations(p, p.seed, currentBias(), settings.hostName, {
    host: hostRefs.length,
    guest: guestRefs.length,
  });
  writeProject(p);

  // Per-variation prompt files. Attachments are capped at MAX_ATTACH (10),
  // the limit for images per message on chatgpt.com.
  const promptEdits = normalizePromptEdits(p.promptEdits);
  for (const v of p.variations) {
    const attach = [];
    attach.push(...hostRefs.map((f) => `refs/${f}`));
    if (v.usesGuestPhoto && guestRefs.length) {
      attach.push(...guestRefs.map((f) => `refs/${f}`));
    }
    attach.push(...logoRefs.map((f) => `refs/${f}`));
    attach.push(...bgRefs.map((f) => `refs/${f}`));
    const capped = attach.slice(0, MAX_ATTACH);
    const extraLines = [];
    if (logoRefs.length) {
      extraLines.push(
        'The attached logo image(s) must appear in the thumbnail exactly as provided, clean and undistorted, sized like a small badge.'
      );
    }
    if (bgRefs.length) {
      extraLines.push(
        'Use the attached background/prop reference image(s) as visual direction for the scene.'
      );
    }
    const promptAuto = extraLines.length ? `${v.prompt}\n\n${extraLines.join(' ')}` : v.prompt;
    // A hand-edited prompt freezes this variation. v.prompt keeps the raw
    // engine output, so resetting is always possible.
    const promptEdit = promptEdits.find((e) => e.index === v.index)?.prompt || null;
    v.attachments = capped;
    v.promptFinal = promptEdit || promptAuto;
    if (promptEdit) v.promptAuto = promptAuto;
    const body = [
      `# Variation ${v.index} - ${v.archetype.name} × ${v.colorway.name}`,
      ``,
      `> This file is an output. Edit the prompt in the studio, under The Seven.`,
      `> Rebuilding the 7 prompts overwrites everything in this file.`,
      ``,
      `- Text on image: "${v.text}"${promptEdit ? ' (not in use, the prompt below was edited by hand)' : ''}`,
      `- Attach (max ${MAX_ATTACH}): ${capped.join(', ')}`,
      `- Save result as: output/variation-${v.index}.png`,
      ``,
      `## Prompt (paste everything below into ChatGPT)`,
      ``,
      v.promptFinal,
    ].join('\n');
    fs.writeFileSync(path.join(packDir, `variation-${v.index}.md`), body);
  }
  writeProject(p);

  fs.writeFileSync(
    path.join(packDir, 'AGENT_INSTRUCTIONS.md'),
    agentInstructions(p, dir, guestRefs, hostRefs[0] || 'host-ref-1.jpg')
  );
  fs.writeFileSync(path.join(packDir, 'CODEX_INSTRUCTIONS.md'), codexInstructions(p, dir));
  fs.writeFileSync(path.join(packDir, 'MOOD_INSTRUCTIONS.md'), moodInstructions(p, resolveMoods(p, p.seed)));
  usage.record({
    kind: 'prompt-build',
    model: 'prompt-engine (local)',
    estTokens: p.variations.reduce((sum, v) => sum + usage.estTokens(v.promptFinal || v.prompt), 0),
  });
  res.json(readProject(p.slug));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Codex generates images natively (GPT Image 2 inside the app): no browser,
// direct file writes, up to 16 reference images, 2K output. Because there is
// no chat carrying context, refs must ride EVERY generation.
function codexInstructions(p, dir) {
  const list = (p.variations || [])
    .map((v) => {
      const refs = (v.attachments || []).map((a) => path.join(dir, a)).join('\n     ');
      return `${v.index}. Prompt file: ${path.join(dir, 'pack', `variation-${v.index}.md`)}
   Reference images to include:
     ${refs}
   Save as: ${path.join(dir, 'output', `variation-${v.index}.png`)}`;
    })
    .join('\n');

  return `# Codex Instructions - "${p.title}"

Generate 7 YouTube thumbnails using Codex's BUILT-IN image generation
(GPT Image 2 / $imagegen). Do NOT drive a browser and do NOT use chatgpt.com:
native generation is faster, writes files directly, and accepts more
reference images.

## Per image (repeat for n = 1 to 7)
1. Open the prompt file for that variation and use the text under
   "## Prompt" verbatim as the image prompt.
2. Attach the reference images listed for that variation. IMPORTANT: include
   them on EVERY image. There is no conversation carrying them over, so a
   missing reference means the wrong face.
3. Generate 16:9 landscape at 2K.
4. Save the result to the exact path listed below. Codex saves generated
   images to ~/.codex/generated_images/ by default, so move and rename the
   file into the project's output folder. The studio only recognises the
   exact filenames variation-1.png ... variation-7.png.

## The seven
${list}

## Quality gate
- The text must be spelled EXACTLY as written in the prompt, including
  decimal points, dollar signs and question marks ("$3.6M", never "$3 6M").
- The host (and guest, where included) must match the reference photos.
- One retry maximum per image if something is clearly broken, then move on.

## Notes
- Up to 16 reference images are supported, so attaching every listed
  reference is safe.
- Image turns consume Codex plan limits roughly 3-5x faster than text turns.
  If you run low, the studio's Playwright runner does the same job through
  the user's ChatGPT Pro plan instead.
- When finished, confirm all 7 files exist in
  ${path.join(dir, 'output')} and report anything you skipped.
`;
}

function agentInstructions(p, dir, guestPhotos, hostRef) {
  const isInterview = p.episodeType === 'interview';
  const guestLine = guestPhotos.length
    ? `- Guest photo(s): ${guestPhotos.map((g) => path.join(dir, 'refs', g)).join(', ')}`
    : isInterview && p.guestName
      ? `- No guest photo yet. FIRST: search the web (Google Images, LinkedIn, their site) for "${p.guestName}", download 1-2 clear, front-facing, rights-appropriate photos, and save them as ${path.join(dir, 'refs')}\\guest-1.jpg (and guest-2.jpg). Then continue.`
      : '- No guest photo (solo episode).';
  const refNotesBlock = p.refNotes
    ? `\n## References described in writing (find these online first)\n${p.refNotes}\nSearch the web for each described item, download a suitable image, and save it into ${path.join(dir, 'refs')} with the right prefix: guest- for people, logo- for logos, bg- for backgrounds or props. Then rebuild the pack (POST http://localhost:4626/api/projects/${p.slug}/pack) so the attachment lists update.\n`
    : '';
  return `# Agent Instructions - "${p.title}"

You are a browser agent (Claude-in-Chrome, Codex-in-Chrome, or similar) with
access to the user's logged-in chatgpt.com session. Generate 7 YouTube
thumbnail images for this project. Work autonomously; only stop if ChatGPT
blocks generation or the user intervenes.

## Files
- Project folder: ${dir}
- Host face reference (ALWAYS attach): ${path.join(dir, 'refs', hostRef)}
${guestLine}
- Prompts: ${path.join(dir, 'pack')}\\variation-1.md ... variation-7.md
- Save results to: ${path.join(dir, 'output')}\\variation-<n>.png
${refNotesBlock}
## ChatGPT workspace
All thumbnail chats live in the ChatGPT project named "${readSettings().chatgptProjectName}":
1. In the chatgpt.com sidebar, look for a project called "${readSettings().chatgptProjectName}".
2. If it does not exist, create it (New project, name it exactly "${readSettings().chatgptProjectName}").
3. Start ONE new chat INSIDE that project for this video (all 7 images in the
   same chat keeps the host's likeness consistent). Use the default GPT with
   image generation.

## Procedure (repeat for n = 1 to 7)
1. Read pack/variation-<n>.md. Attach the files listed under "Attach:" using
   the paperclip/upload button. Never attach more than 10 images to one
   message, that is the chatgpt.com limit.
2. Paste the entire "Prompt" section as the message. Send.
3. Wait for the image to fully render (this can take 1-2 minutes).
4. Download the generated image and save it as output/variation-<n>.png
   (download lands in the browser's download folder, move/rename it to the
   output path above).
5. Quick check before moving on: text spelled exactly right, host's face looks
   like the reference, image is 16:9. If clearly broken, reply in the same chat:
   "Same image, but fix: <problem>", one retry max, then move on.

## Rules
- PACING (important): wait 45 to 75 seconds between messages. ChatGPT throttles
  burst SPEED, not volume, and a fast loop trips "Too many requests" for
  everyone using this account. Never reload the page repeatedly or hammer retries.
- Never change the prompt text except for the single-retry fix line.
- Do not generate more than 7 + 7 retries of images.
- If ChatGPT shows a rate-limit message, stop cleanly and report which
  variations are done. Nothing is lost: rerunning skips finished images.
- When finished, confirm all 7 files exist in the output folder.
`;
}

// ---------- winner analytics ------------------------------------------------
// Which archetype × colorway actually gets picked. Once 5+ winners exist the
// pack generator pairs the top archetype with the top colorway.

function winnerStats() {
  const stats = { total: 0, archetypes: {}, colorways: {}, moods: {}, pairs: {} };
  for (const p of listProjects()) {
    if (!p.winner || !p.variations?.length) continue;
    const m = String(p.winner).match(/^variation-(\d+)/);
    if (!m) continue;
    const v = p.variations.find((x) => x.index === Number(m[1]));
    if (!v) continue;
    stats.total++;
    const a = stats.archetypes[v.archetype.id] || { id: v.archetype.id, name: v.archetype.name, wins: 0 };
    a.wins++;
    stats.archetypes[v.archetype.id] = a;
    const c = stats.colorways[v.colorway.id] || { id: v.colorway.id, name: v.colorway.name, accent: v.colorway.accent, wins: 0 };
    c.wins++;
    stats.colorways[v.colorway.id] = c;
    // Only variations built by the current engine carry a mood.
    const mk = v.mood?.key;
    if (mk) {
      const label = mk === 'agent' ? '✍ Written for the video' : MOODS[mk]?.label || mk;
      const mo = stats.moods[mk] || { id: mk, name: label, wins: 0 };
      mo.wins++;
      stats.moods[mk] = mo;
    }
    const key = `${v.archetype.name} × ${v.colorway.name}`;
    stats.pairs[key] = (stats.pairs[key] || 0) + 1;
  }
  const settings = readSettings();
  const top = (obj) => Object.values(obj).sort((x, y) => y.wins - x.wins)[0] || null;
  stats.topArchetype = top(stats.archetypes);
  stats.topColorway = top(stats.colorways);
  stats.threshold = settings.biasThreshold;
  stats.biasEnabled = settings.useWinnerBias;
  stats.biasActive = settings.useWinnerBias && stats.total >= settings.biasThreshold;
  return stats;
}

function currentBias() {
  const s = winnerStats();
  return s.biasActive && s.topArchetype && s.topColorway
    ? { archetypeId: s.topArchetype.id, colorwayId: s.topColorway.id }
    : null;
}

// Arena result: full preference ranking from pairwise duels. First = winner.
app.post('/api/projects/:slug/ranking', (req, res) => {
  const p = readProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });
  const order = Array.isArray(req.body?.order) ? req.body.order.filter((f) => p.outputs.includes(f)) : [];
  if (!order.length) return res.status(400).json({ error: 'order required' });
  const hadWinner = p.winner;
  p.ranking = order;
  p.winner = order[0];
  if (p.winner !== hadWinner) dropFinalRound(p);
  writeProject(p);
  res.json(readProject(p.slug));
});

// Tiny-size legibility analysis: how each candidate behaves at 168px
// (YouTube search / sidebar size). Real pixels, not opinions.
app.get('/api/projects/:slug/legibility', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    const results = [];
    for (const f of p.outputs) {
      const src = path.join(projectDir(p.slug), 'output', f);
      const tinyBuf = await sharp(src).resize(168, 94, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
      const st = await sharp(tinyBuf).stats();
      const [r, g, b] = st.channels;
      const brightness = (r.mean + g.mean + b.mean) / 3;
      const contrast = (r.stdev + g.stdev + b.stdev) / 3;
      const pop = Math.max(r.mean, g.mean, b.mean) - Math.min(r.mean, g.mean, b.mean);
      const flags = [];
      if (contrast < 40) flags.push('low contrast at small size');
      if (brightness < 45) flags.push('dark, may sink on YouTube dark mode');
      if (brightness > 200) flags.push('very bright, may wash out on white');
      if (pop < 12) flags.push('muted colors, may not pop in the feed');
      results.push({
        file: f,
        brightness: Math.round(brightness),
        contrast: Math.round(contrast),
        pop: Math.round(pop),
        flags,
        tiny: `data:image/jpeg;base64,${tinyBuf.toString('base64')}`,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get('/api/usage', (req, res) => res.json({ months: usage.summary() }));

app.get('/api/settings', (req, res) => res.json(redactSettings(readSettings())));

app.post('/api/settings', (req, res) => {
  const merged = { ...readSettings() };
  const b = req.body || {};
  for (const key of ['chatgptProjectName', 'hostName', 'showName']) {
    if (typeof b[key] === 'string' && b[key].trim()) merged[key] = b[key].trim();
  }
  if (typeof b.channelUrl === 'string' && /^https:\/\/(www\.)?youtube\.com\//.test(b.channelUrl.trim())) {
    merged.channelUrl = b.channelUrl.trim().replace(/\/(videos)?\/*$/, '');
  }
  if (typeof b.chatgptProjectUrl === 'string' && /^https:\/\/chatgpt\.com\//.test(b.chatgptProjectUrl.trim())) {
    merged.chatgptProjectUrl = b.chatgptProjectUrl.trim();
  }
  if ([1, 2].includes(Number(b.hostRefCount))) merged.hostRefCount = Number(b.hostRefCount);
  if (typeof b.hostRefPrimary === 'string') {
    const wanted = b.hostRefPrimary.trim();
    // Only a filename that is actually in the folder, so a typo cannot leave
    // every generation running without a face reference.
    merged.hostRefPrimary = listImages(HOST_DIR).includes(wanted) ? wanted : '';
  }
  if (typeof b.useWinnerBias === 'boolean') merged.useWinnerBias = b.useWinnerBias;
  if (typeof b.stripAiMetadata === 'boolean') merged.stripAiMetadata = b.stripAiMetadata;
  const t = Number(b.biasThreshold);
  if (Number.isInteger(t) && t >= 2 && t <= 50) merged.biasThreshold = t;
  if (['browser', 'playwright', 'openai', 'custom'].includes(b.provider)) merged.provider = b.provider;
  if (['free', 'plus', 'pro', 'team'].includes(b.chatgptPlan)) merged.chatgptPlan = b.chatgptPlan;
  for (const key of ['monthlyImageBudget', 'monthlyTokenBudget']) {
    const n = Number(b[key]);
    if (Number.isFinite(n) && n >= 0) merged[key] = Math.round(n);
  }
  // An empty key means "keep the stored one". The UI never receives the key, so
  // without this rule saving any unrelated field would silently wipe it and the
  // next generation would fail with an auth error nobody would connect to a
  // settings save. Clearing is therefore explicit.
  if (typeof b.openaiApiKey === 'string' && b.openaiApiKey.trim()) {
    merged.openaiApiKey = b.openaiApiKey.trim();
  }
  if (b.clearOpenaiApiKey === true) merged.openaiApiKey = '';
  // customCommand is intentionally absent here. See ALLOW_CUSTOM_COMMAND above.
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  res.json(redactSettings(merged));
});

// ---------- live channel feed (no API) --------------------------------------
// Fetches the channel's /videos page (consent cookies bypass the EU wall),
// pulls the ordered video ids, and resolves titles via the public oembed
// endpoint. Cached for 12h in data/channel-cache.json.

const CHANNEL_CACHE = path.join(DATA_DIR, 'channel-cache.json');
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function fetchChannelFeed(channelUrl) {
  const url = channelUrl.replace(/\/+$/, '') + '/videos';
  const res = await fetch(url, {
    headers: {
      Cookie: 'SOCS=CAI; CONSENT=YES+cb',
      'User-Agent': BROWSER_UA,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const ids = [];
  for (const m of html.matchAll(/i\.ytimg\.com\/vi\/([\w-]{11})\//g)) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  const videos = await Promise.all(
    ids.slice(0, 12).map(async (id) => {
      try {
        const r = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
          { signal: AbortSignal.timeout(10000) }
        );
        const j = await r.json();
        return { id, title: j.title, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
      } catch {
        return null;
      }
    })
  );
  return videos.filter(Boolean);
}

app.get('/api/channel-feed', async (req, res) => {
  const settings = readSettings();
  if (!settings.channelUrl) {
    return res.status(400).json({ error: 'add your YouTube channel URL in Settings first, Reality Check pulls its real feed' });
  }
  let cache = null;
  try { cache = JSON.parse(fs.readFileSync(CHANNEL_CACHE, 'utf8')); } catch {}
  const cacheValid = cache && cache.channelUrl === settings.channelUrl;
  const cacheFresh = cacheValid && Date.now() - cache.fetchedAt < 12 * 3600 * 1000;
  if (cacheFresh && !req.query.refresh) return res.json(cache);
  try {
    const videos = await fetchChannelFeed(settings.channelUrl);
    if (!videos.length) throw new Error('no videos found on the channel page');
    const data = { channelUrl: settings.channelUrl, fetchedAt: Date.now(), videos };
    fs.writeFileSync(CHANNEL_CACHE, JSON.stringify(data, null, 2));
    res.json(data);
  } catch (err) {
    if (cacheValid) return res.json(cache); // stale beats nothing
    res.status(502).json({ error: `could not load the channel feed: ${String(err.message || err)}` });
  }
});

app.get('/api/analytics', (req, res) => res.json(winnerStats()));

// ---------- export (YouTube-ready JPG) --------------------------------------

app.post('/api/projects/:slug/export', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    const delivered = deliveredImage(p);
    const explicit = req.body && req.body.file;
    const file = explicit || delivered?.file || p.outputs[0];
    if (!file) return res.status(400).json({ error: 'no image to export, pick a winner first' });
    const bucket = explicit ? 'output' : delivered?.bucket || 'output';
    // A bare filename only: "../refs/guest-1.jpg" used to pass the prefix
    // check and export a reference photo.
    if (path.basename(String(file)) !== String(file)) {
      return res.status(400).json({ error: 'image not found' });
    }
    const src = path.resolve(projectDir(p.slug), bucket, file);
    if (!fs.existsSync(src)) return res.status(400).json({ error: 'image not found' });
    if (readSettings().stripAiMetadata) cleanOne(src);
    const outDir = path.join(projectDir(p.slug), 'export');
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `${p.slug}-1280x720.jpg`;
    let quality = 92;
    let buf = null;
    // YouTube's thumbnail limit is 2MB; step quality down until under it.
    do {
      buf = await sharp(src).resize(1280, 720, { fit: 'cover' }).jpeg({ quality, mozjpeg: true }).toBuffer();
      quality -= 8;
    } while (buf.length > 2 * 1024 * 1024 && quality > 40);
    fs.writeFileSync(path.join(outDir, outName), buf);
    res.json({ file: `export/${outName}`, bytes: buf.length, source: file });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- social pack (X + LinkedIn) --------------------------------------
// After a winner exists: correctly sized images + post/alt texts in the
// host's voice. X: 1200x675 (16:9), post <= 280, alt <= 1000. LinkedIn:
// 1200x627 (1.91:1), hook shows ~200 chars, alt <= 300. Both images < 5MB.

async function sizedJpg(src, dest, width, height, position = sharp.strategy.attention) {
  let quality = 92;
  let buf;
  do {
    buf = await sharp(src)
      .resize(width, height, { fit: 'cover', position })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    quality -= 8;
  } while (buf.length > 5 * 1024 * 1024 && quality > 40);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function socialJsonPath(slug) {
  return path.join(projectDir(slug), 'social', 'social.json');
}

// 1080x1350 portrait announcement card: a 16:9 thumbnail cropped to 4:5 would
// lose the text, so instead we compose a card - title on top, the full
// untouched winner in the middle, hook + show name below, glow in the
// winner's colorway.

function svgEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapWords(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length <= maxChars) {
      line = (line + ' ' + w).trim();
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}

async function portraitCard(project, variation, settings, src, dest) {
  const W = 1080;
  const H = 1350;
  const accent = variation?.colorway?.accent || '#E8382B';
  const show = (settings?.showName || 'Your channel').toUpperCase();
  const titleLines = wrapWords(project.title, 24, 3);
  const hookLines = project.hook && project.hook.trim() !== project.title.trim()
    ? wrapWords(project.hook, 44, 2)
    : [];
  const titleSize = titleLines.some((l) => l.length > 18) ? 58 : 66;
  const titleTop = 218;
  const lineGap = titleSize + 14;
  const imgH = Math.round((W * 9) / 16); // 608
  const imgTop = titleTop + titleLines.length * lineGap + 20;
  const hookTop = imgTop + imgH + 78;
  const font = 'font-family="Arial, Helvetica, sans-serif"';

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#0d0e11" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0d0e11"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="70" y="96" rx="14" width="236" height="52" fill="${accent}"/>
  <text x="188" y="131" ${font} font-weight="900" font-size="26" letter-spacing="4" fill="#ffffff" text-anchor="middle">NEW VIDEO</text>
  ${titleLines
    .map((l, i) => `<text x="70" y="${titleTop + i * lineGap}" ${font} font-weight="900" font-size="${titleSize}" fill="#ffffff">${svgEscape(l)}</text>`)
    .join('\n  ')}
  ${hookLines
    .map((l, i) => `<text x="70" y="${hookTop + i * 46}" ${font} font-weight="700" font-size="34" fill="#9aa0ab">${svgEscape(l)}</text>`)
    .join('\n  ')}
  <rect x="70" y="${H - 118}" width="56" height="8" fill="${accent}"/>
  <text x="70" y="${H - 62}" ${font} font-weight="900" font-size="30" letter-spacing="5" fill="${accent}">${svgEscape(show)}</text>
</svg>`;

  const thumb = await sharp(src).resize(W, imgH, { fit: 'cover' }).toBuffer();
  let quality = 92;
  let buf;
  do {
    buf = await sharp(Buffer.from(svg))
      .composite([{ input: thumb, top: imgTop, left: 0 }])
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    quality -= 8;
  } while (buf.length > 5 * 1024 * 1024 && quality > 40);
  fs.writeFileSync(dest, buf);
}

app.post('/api/projects/:slug/social', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.winner) return res.status(400).json({ error: 'pick a winner first' });
    const src = deliveredImage(p)?.path;
    if (!src || !fs.existsSync(src)) return res.status(400).json({ error: 'winner image missing' });
    const socialDir = path.join(projectDir(p.slug), 'social');
    fs.mkdirSync(socialDir, { recursive: true });

    const settings = readSettings();
    const winnerVar = p.variations?.find((v) => String(p.winner).startsWith(`variation-${v.index}.`)) || null;
    // Describe the image that SHIPS, not the one that won. They are the same
    // thumbnail unless the final round recoloured it.
    const shipped = winnerVar ? { ...winnerVar, colorway: shippedColorway(p) || winnerVar.colorway } : null;
    const social = require('./lib/socialcopy');

    await sizedJpg(src, path.join(socialDir, 'x-1200x675.jpg'), 1200, 675);
    await sizedJpg(src, path.join(socialDir, 'linkedin-1200x627.jpg'), 1200, 627);
    await portraitCard(p, shipped, settings, src, path.join(socialDir, 'portrait-1080x1350.jpg'));
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(socialJsonPath(p.slug), 'utf8')); } catch {}
    const fresh = req.query.rewrite === '1';
    const data = {
      generatedAt: new Date().toISOString(),
      winner: p.winner,
      // What the images were actually built from, so shipping a final-round
      // pick marks the social pack stale instead of silently keeping the old
      // winner's crops and portraits.
      builtFrom: `${deliveredImage(p).bucket}/${deliveredImage(p).file}`,
      xPost: !fresh && existing.xPost ? existing.xPost : social.composeXPost(p),
      xAlt: !fresh && existing.xAlt ? existing.xAlt : social.composeAltText(p, shipped, settings, 'x'),
      liPost: !fresh && existing.liPost ? existing.liPost : social.composeLinkedInPost(p, settings),
      liAlt: !fresh && existing.liAlt ? existing.liAlt : social.composeAltText(p, shipped, settings, 'linkedin'),
      pAlt: !fresh && existing.pAlt ? existing.pAlt : social.composePortraitAlt(p, shipped, settings),
      limits: social.LIMITS,
    };
    fs.writeFileSync(socialJsonPath(p.slug), JSON.stringify(data, null, 2));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get('/api/projects/:slug/social', async (req, res) => {
  try {
    const socialDir = path.join(projectDir(req.params.slug), 'social');
    // Finalize any freshly dropped AI portraits (agent or UI) to exact 4:5.
    if (fs.existsSync(socialDir)) {
      for (const f of fs.readdirSync(socialDir)) {
        const m = f.match(/^portrait-ai-(\d)\.(png|jpe?g|webp)$/i);
        if (m && !fs.existsSync(path.join(socialDir, `portrait-ai-${m[1]}-1080x1350.jpg`))) {
          await sizedJpg(path.join(socialDir, f), path.join(socialDir, `portrait-ai-${m[1]}-1080x1350.jpg`), 1080, 1350, 'centre');
          usage.record({ kind: 'browser-image', model: 'gpt-image (ChatGPT plan)', images: 1, estTokens: 350 });
        }
      }
    }
    const data = JSON.parse(fs.readFileSync(socialJsonPath(req.params.slug), 'utf8'));
    data.files = listImages(socialDir);
    res.json(data);
  } catch {
    res.json(null);
  }
});

// Build the 3 AI-portrait prompts: the winner recreated as a full-bleed
// native portrait by GPT Image, three different takes.
app.post('/api/projects/:slug/portrait-pack', (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.winner) return res.status(400).json({ error: 'pick a winner first' });
    const settings = readSettings();
    const v = p.variations?.find((x) => String(p.winner).startsWith(`variation-${x.index}.`)) || null;
    // The portrait recreates the SHIPPED image, so it must be told the shipped
    // colour and the shipped text, not the winning variation's.
    const shippedOpt = p.finalChoice
      ? (p.finalRound?.options || []).find((o) => String(p.finalChoice).startsWith(`final-${o.n}.`))
      : null;
    const text = shippedOpt?.text || v?.text || p.title;
    const cw = shippedColorway(p);
    const accent = cw ? `${cw.name} ${cw.accent}` : 'the same accent color';
    const dir = projectDir(p.slug);
    const packDir = path.join(dir, 'pack');
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'social'), { recursive: true });

    // The guest belongs in the portrait whenever the WINNING variation used
    // one, not only on archetype C. Reusing the winner's own attachment list
    // also inherits the guest-ref filtering the pack applied.
    const shipped = deliveredImage(p);
    const hostRef = (v?.attachments || []).find(isHostRef) || 'refs/host-ref-1.jpg';
    const attach = [`${shipped.bucket}/${shipped.file}`, hostRef];
    attach.push(...(v?.attachments || []).filter((a) => a.startsWith('refs/guest-')));

    // Fidelity ladder: take 1 hugs the original, takes 2 and 3 get
    // progressively freer while keeping text, palette and likeness. The three
    // must read as clearly different images.
    const angles = [
      ['Faithful re-stack', 'FIDELITY HIGH, stay as close to the original thumbnail as possible. Only re-stack the same elements vertically: text block at the top at large scale, the person/people noticeably larger below. Same background, same props, same lighting, nothing new added.'],
      ['Bolder close-up', 'FIDELITY MEDIUM, keep the style but push the drama. A much tighter close-up on the face(s), text noticeably bigger and punchier, more cinematic lighting, simplified background. It must read as a clearly different image from a faithful copy.'],
      ['Creative continuation', 'FIDELITY CREATIVE, the freest of the three takes. Extend and reinterpret the scene above and below: new depth, environment details, atmosphere and glow are welcome, even new supporting props in the same visual language. Keep ONLY the exact text, the color palette and the people identical. It must look clearly different from the other two takes.'],
    ];

    const aiPrompts = angles.map(([name, angleLine], i) => {
      const prompt = [
        `Attached is the finished 16:9 YouTube thumbnail for "${p.title}". RECREATE it as a NATIVE PORTRAIT image, 1024x1536 (2:3 vertical), designed for a 4:5 social post.`,
        `This is NOT a crop and NOT padding: rebuild the composition so the same scene naturally fills the entire vertical frame. No blurred bars, no letterboxing, no stretched or smeared areas, no duplicated textures.`,
        `Keep IDENTICAL to the attached thumbnail: the exact text "${String(text).replace(/ \/ /g, ' / ')}" spelled exactly the same (line breaks may move), the ${accent} accent and overall color scheme, the same person/people with their exact likeness (reference photo also attached), the same style, mood and meaning. Reproduce every character including decimal points, commas, dollar signs and question marks (for example "$3.6M" must keep its period, never "$3 6M").`,
        `LAYOUT FOR THIS TAKE (${i + 1} of 3, each take in this series must look clearly DIFFERENT from the others): ${angleLine}`,
        `SAFE AREA: keep every face and all text inside the central 83% of the height. The top and bottom edges will be trimmed when cropping to 4:5, so only background, glow or environment may live there.`,
        `QUALITY: Crisp lighting, high contrast, tack-sharp face, text legible at small sizes, natural skin tones.`,
        `DO NOT include: watermarks, any extra text, warped hands, plastic AI-looking skin.`,
      ].join('\n\n');
      const body = [
        `# AI Portrait ${i + 1} - ${name}`,
        ``,
        `- Attach: ${attach.join(', ')}`,
        `- Save result as: social/portrait-ai-${i + 1}.png`,
        ``,
        `## Prompt (paste everything below into ChatGPT)`,
        ``,
        prompt,
      ].join('\n');
      fs.writeFileSync(path.join(packDir, `portrait-${i + 1}.md`), body);
      return { take: name, prompt };
    });

    fs.writeFileSync(
      path.join(packDir, 'PORTRAIT_INSTRUCTIONS.md'),
      `# AI Portrait Instructions - "${p.title}"

Generate 3 portrait recreations of the winning thumbnail. Same rules as
AGENT_INSTRUCTIONS.md: work in the ChatGPT project "${settings.chatgptProjectName}",
reuse this video's existing chat if it exists.

For n = 1 to 3:
1. Read pack/portrait-<n>.md. Attach the files listed under "Attach:"
   (${attach.map((a) => path.join(dir, a)).join(', ')}).
2. Paste the entire Prompt section. Send. If the interface offers an image
   size choice, pick PORTRAIT (1024x1536 / 2:3).
3. Wait for the render, download, save as ${path.join(dir, 'social')}\\portrait-ai-<n>.png
4. One retry max ("Same image, but fix: <problem>"), then move on.

When done, the studio finalizes each to portrait-ai-<n>-1080x1350.jpg
automatically the next time the Social pack loads.
`
    );

    fs.writeFileSync(
      path.join(packDir, 'CODEX_PORTRAIT_INSTRUCTIONS.md'),
      `# Codex Portrait Instructions - "${p.title}"

Generate 3 portrait recreations of the winning thumbnail using Codex's
BUILT-IN image generation (GPT Image 2 / $imagegen). No browser needed.

For n = 1 to 3:
1. Use the prompt under "## Prompt" in
   ${path.join(dir, 'pack')}\\portrait-<n>.md verbatim.
2. Attach these reference images to EVERY generation:
${attach.map((a) => `     ${path.join(dir, a)}`).join('\n')}
3. Generate PORTRAIT orientation (2:3 vertical, e.g. 1024x1536) at 2K.
   Keep faces and text inside the central 83% of the height: the studio
   trims to 4:5 afterwards.
4. Save to ${path.join(dir, 'social')}\\portrait-ai-<n>.png (move it out of
   ~/.codex/generated_images/; exact filenames matter).

The three takes must look clearly different from each other: take 1 stays
closest to the original thumbnail, take 3 is the most creative.
The studio auto-crops each to 1080x1350 when the Social pack next loads.
`
    );

    let social = {};
    try { social = JSON.parse(fs.readFileSync(socialJsonPath(p.slug), 'utf8')); } catch {}
    social.aiPrompts = aiPrompts;
    if (!social.pChoice) social.pChoice = 'card';
    fs.writeFileSync(socialJsonPath(p.slug), JSON.stringify(social, null, 2));
    usage.record({
      kind: 'prompt-build',
      model: 'prompt-engine (local)',
      estTokens: aiPrompts.reduce((sum, a) => sum + usage.estTokens(a.prompt), 0),
    });
    res.json(social);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Title suggester (thumbnail-first packaging): candidate titles that support
// the winning thumbnail, at ~50% text overlap. Heuristic by default; an agent
// can write better ones back by POSTing { candidates: ["..."] }.
app.post('/api/projects/:slug/titles', (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.winner) return res.status(400).json({ error: 'pick a winner first' });
    const titlecopy = require('./lib/titlecopy');
    const v = p.variations?.find((x) => String(p.winner).startsWith(`variation-${x.index}.`)) || null;
    const thumbText = String(v?.text || '').replace(/ \/ /g, ' ');

    const score = (t) => Math.round(titlecopy.overlapRatio(t, thumbText) * 100) / 100;
    // Candidates written before `source` existed carry only angle:'agent'.
    // Defaulting them to heuristic threw away exactly what this protects.
    const existing = (p.titleCandidates || []).map((c) => ({
      ...c,
      source: c.source || (c.angle === 'agent' ? 'agent' : 'heuristic'),
      // Rescore: a carried-forward candidate's stored overlap was measured
      // against whatever the winner's text was at the time.
      overlap: score(c.title),
    }));
    const byTitle = new Map();
    const add = (c) => { if (c.title && !byTitle.has(c.title)) byTitle.set(c.title, c); };

    // Anything a person chose or an agent wrote outlives a refresh. Only the
    // mechanical candidates are thrown away and recomputed.
    for (const c of existing) if (c.source !== 'heuristic') add(c);

    const agentTitles = Array.isArray(req.body?.candidates)
      ? req.body.candidates.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim())
      : [];
    for (const t of agentTitles) add({ title: t, angle: 'agent', source: 'agent', overlap: score(t) });

    // The user's own draft is a candidate like any other, and it is scored.
    if (typeof req.body?.draft === 'string') {
      p.titleDraft = req.body.draft.trim().slice(0, 120);
      if (!p.titleDraft) delete p.titleDraft;
    }
    if (p.titleDraft) {
      add({ title: p.titleDraft, angle: 'yours', source: 'user', overlap: score(p.titleDraft) });
    }

    for (const c of titlecopy.composeTitleCandidates(p, v, readSettings())) add(c);

    // A heuristic candidate is rebuilt from scratch on every refresh, so its
    // tick has to be remembered separately or it is lost.
    const priorPicked = new Set(existing.filter((c) => c.picked).map((c) => c.title));
    const picks = new Set(Array.isArray(req.body?.picks) ? req.body.picks : []);
    p.titleCandidates = [...byTitle.values()].map((c) => {
      const picked = Array.isArray(req.body?.picks) ? picks.has(c.title) : priorPicked.has(c.title);
      return picked ? { ...c, picked: true } : (({ picked: _drop, ...rest }) => rest)(c);
    });
    p.titleCandidatesAt = new Date().toISOString();
    writeProject(p);

    const packDir = path.join(projectDir(p.slug), 'pack');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(path.join(packDir, 'TITLE_INSTRUCTIONS.md'), titleInstructions(p, thumbText));
    usage.record({
      kind: 'prompt-build',
      model: 'prompt-engine (local)',
      estTokens: usage.estTokens(JSON.stringify(p.titleCandidates)),
    });
    res.json({ candidates: p.titleCandidates, generatedAt: p.titleCandidatesAt });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Final round: the winning composition, re-cut so its text pairs with the
// title that was actually adopted. Only the TEXT changes; layout, colorway,
// references and expression are taken from the winner unchanged.
app.post('/api/projects/:slug/final-round', (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.winner) return res.status(400).json({ error: 'pick a winner first' });
    if (p.titleStatus === 'working') return res.status(400).json({ error: 'adopt a final title first' });

    const { overlapRatio } = require('./lib/titlecopy');
    const v = p.variations?.find((x) => String(p.winner).startsWith(`variation-${x.index}.`));
    if (!v) return res.status(400).json({ error: 'the winning variation is missing, rebuild the 7 prompts' });

    const settings = readSettings();
    const refs = v.attachments || [];
    const refCounts = {
      host: refs.filter(isHostRef).length,
      guest: refs.filter((a) => a.startsWith('refs/guest-')).length,
    };

    // Second axis: the same composition in a different accent. The 7 weld
    // layout to colour, so this is the only way to get this layout in that
    // colour.
    const colorway =
      COLORWAYS.find((c) => c.id === req.body?.colorwayId) ||
      COLORWAYS.find((c) => c.id === v.colorway.id) ||
      COLORWAYS[0];
    const recoloured = colorway.id !== v.colorway.id;

    const written = Array.isArray(req.body?.texts)
      ? req.body.texts.map((t) => cleanEditText(t)).filter(Boolean).slice(0, 4)
      : [];
    let texts = written.length ? written : titleThumbTexts(p.title, v.text, 4);
    // A pure recolour is a real want ("I like it, the red just clashes"), so
    // keeping the winning text has to be one click.
    if (recoloured && !written.length) texts = [v.text, ...texts].slice(0, 4);
    if (!texts.length) return res.status(400).json({ error: 'could not derive any text from this title' });

    const dir = projectDir(p.slug);
    const packDir = path.join(dir, 'pack');
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'final'), { recursive: true });

    // The winner's prompt carries the logo/background lines that /pack appends;
    // the re-cut must carry them too or the refs are attached without the
    // instruction to use them.
    const extraLines = (v.promptFinal || '').split(`${v.prompt}\n\n`)[1] || '';

    const options = texts.map((text, i) => {
      const base = buildOnePrompt({
        project: p,
        archetypeId: v.archetype.id,
        colorwayId: colorway.id,
        text,
        mood: v.mood,
        useGuestLayout: v.usesGuestPhoto,
        hostName: settings.hostName,
        refCounts,
        scene: v.scene,
      });
      const prompt = extraLines ? `${base}\n\n${extraLines}` : base;
      const body = [
        `# Final ${i + 1} - ${v.archetype.name} × ${colorway.name}`,
        ``,
        `> Same layout, faces and expression as the winning thumbnail.`,
        `> ${recoloured ? `The colorway changes to ${colorway.name}.` : 'Only the text changes.'}`,
        ``,
        `- Text on image: "${text}"${recoloured && text === v.text ? ' (unchanged, this one is a pure recolour)' : ''}`,
        `- Pairs with the title: "${p.title}" (${Math.round(overlapRatio(p.title, text) * 100)}% overlap)`,
        `- Attach (max ${MAX_ATTACH}): ${refs.join(', ')}`,
        `- Save result as: final/final-${i + 1}.png`,
        ``,
        `## Prompt (paste everything below into ChatGPT)`,
        ``,
        prompt,
      ].join('\n');
      fs.writeFileSync(path.join(packDir, `final-${i + 1}.md`), body);
      return {
        n: i + 1,
        text,
        colorwayId: colorway.id,
        colorwayName: colorway.name,
        accent: colorway.accent,
        overlap: Math.round(overlapRatio(p.title, text) * 100) / 100,
        prompt,
        attachments: refs,
      };
    });

    p.finalRound = { title: p.title, colorwayId: colorway.id, at: new Date().toISOString(), options };
    writeProject(p);
    fs.writeFileSync(path.join(packDir, 'FINAL_INSTRUCTIONS.md'), finalInstructions(p, v, dir, options));
    usage.record({
      kind: 'prompt-build',
      model: 'prompt-engine (local)',
      estTokens: options.reduce((sum, o) => sum + usage.estTokens(o.prompt), 0),
    });
    res.json(p.finalRound);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

function finalInstructions(p, v, dir, options) {
  const list = options
    .map((o) => `${o.n}. Prompt file: ${path.join(dir, 'pack', `final-${o.n}.md`)}
   Text on image: "${o.text}"
   Save as: ${path.join(dir, 'final', `final-${o.n}.png`)}`)
    .join('\n');

  return `# Final Round Instructions - "${p.title}"

The thumbnail is chosen and the title is chosen. These ${options.length} images are the
same winning composition with the text re-cut so it pairs with the title.

## Why
The winning thumbnail says "${v.text}", which was written before the title was
settled. A title and a thumbnail should share about half their words: the
thumbnail grabs, the title completes. Repeating the whole title on the image
wastes the second hook, and saying something unrelated breaks the pair.

## What stays the same
Layout ${v.archetype.name}, the same reference photos, the same expression.
${options[0]?.colorwayId && options[0].colorwayId !== v.colorway.id
  ? `The colorway changes from ${v.colorway.name} to ${options[0].colorwayName}, because the
winning colour did not suit this video or the channel grid. Apply the new
colorway exactly: accent, support colour and background all move together.`
  : `Colorway ${v.colorway.name} as well. ONLY the text changes, so the comparison
shows what the words do and nothing else.`}

## The ${options.length}
${list}

## Reference images to attach to EVERY one
${(v.attachments || []).map((a) => `     ${path.join(dir, a)}`).join('\n')}

## If you can write better text
The ${options.length} above are mechanical subsets of the title. Better ones probably exist.
Aim for 3 to 6 words that share about half their meaningful words with
"${p.title}", never the whole title, and POST them back to regenerate the prompts:

    POST http://localhost:${PORT}/api/projects/${p.slug}/final-round
    Content-Type: application/json

    {"texts": ["TEXT ONE", "TEXT / TWO", "TEXT THREE", "TEXT FOUR"]}

## Quality gate
- Spell the text EXACTLY, including decimal points and dollar signs.
- Same faces as the reference photos, same person once each.
- When finished, confirm the files exist in ${path.join(dir, 'final')}.
`;
}

// Expressions across the 7. The heuristic plan is always available; an agent
// can replace it with free-form expressions written for this one video.
app.post('/api/projects/:slug/moods', (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.variations?.length) return res.status(400).json({ error: 'build the 7 prompts first' });

    if (req.body?.clear === true) {
      delete p.moodPlan;
      delete p.moodPlanAt;
    } else {
      const clean = normalizeMoodPlan(req.body?.plan);
      if (clean.length) {
        p.moodPlan = clean;
        p.moodPlanAt = new Date().toISOString();
      }
    }
    writeProject(p);

    const plan = resolveMoods(p, p.seed);
    const packDir = path.join(projectDir(p.slug), 'pack');
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(path.join(packDir, 'MOOD_INSTRUCTIONS.md'), moodInstructions(p, plan));
    usage.record({
      kind: 'prompt-build',
      model: 'prompt-engine (local)',
      estTokens: usage.estTokens(JSON.stringify(plan)),
    });
    res.json({ plan, source: p.moodPlan?.length ? 'agent' : 'auto', generatedAt: p.moodPlanAt || null });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Per-variation edits. The body carries the WHOLE edit state for whichever key
// it includes, so clearing one is just sending the array without it. No pack
// rebuild here: the UI chains /pack, the same way the mood buttons do.
app.post('/api/projects/:slug/edits', (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.variations?.length) return res.status(400).json({ error: 'build the 7 prompts first' });

    for (const [key, normalize] of [['textEdits', normalizeTextEdits], ['promptEdits', normalizePromptEdits]]) {
      if (!Array.isArray(req.body?.[key])) continue;
      const clean = normalize(req.body[key]);
      clean.length ? (p[key] = clean) : delete p[key];
    }
    p.textEdits?.length || p.promptEdits?.length
      ? (p.editsAt = new Date().toISOString())
      : delete p.editsAt;

    writeProject(p);
    res.json({ textEdits: p.textEdits || [], promptEdits: p.promptEdits || [] });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

function moodInstructions(p, plan) {
  const rows = (p.variations || [])
    .map((v, i) => {
      const m = plan[i] || {};
      return `${v.index}. ${v.archetype.letter} ${v.archetype.name} x ${v.colorway.name} - text "${v.text}" - guest in frame: ${v.usesGuestPhoto ? 'yes' : 'no'}
   now: host ${m.host || '(none)'}${v.usesGuestPhoto ? ` / guest ${m.guest || '(none)'}` : ''}`;
    })
    .join('\n');

  return `# Mood Instructions - "${p.title}"

Write the facial expression for each of the 7 thumbnails, tuned to THIS video.
The six built-in moods are a starting palette, not a limit. Write whatever
expression actually fits the story.

## Context
- Hook / claim: ${p.hook || '(none)'}
- Notes: ${p.notes || '(none)'}
- Episode: ${p.episodeType === 'interview' ? `interview with ${p.guestName || 'a guest'}` : 'solo'}

## The 7 variations
${rows}

## The shape that matters
The host expression is dropped into a sentence as "the host ___", so it must
read as a prepositional or participial phrase.
  good: with a curious raised-brow look / leaning in with narrowed eyes /
        looking deadpan, unimpressed
  bad:  he smiles (a full clause) / smiling! (punctuation) / a grin (bare noun)

The guest expression is dropped in as "the guest ___", so it must read as an
adjective phrase.
  good: genuinely amazed / quietly stunned / composed and confident
  bad:  with a grin (prepositional) / a big grin (bare noun)

Keep each under 90 characters. Double quotes, line breaks and em dashes are
stripped, and anything that cannot be made grammatical is ignored and falls
back to the automatic plan.

## The brand rule
From the blueprint: a curious smile, raised-brow amazement, or intense focus,
never fake-shocked clickbait gurning. It must read as a real human reaction to
the specific claim in this video.

## Vary them
All 7 should differ, and two variations in a row must never carry the same
expression. Match the expression to the layout: the big-number frame wants
genuine reaction, the split-screen wants judgement, the prop wants proof.

## Deliver
POST the plan back so it lands in the studio:

    POST http://localhost:${PORT}/api/projects/${p.slug}/moods
    Content-Type: application/json

    {"plan": [{"index": 1, "host": "...", "guest": "..."}, {"index": 2, "host": "..."}]}

Then rewrite the 7 prompt files with the new expressions:

    POST http://localhost:${PORT}/api/projects/${p.slug}/pack

Or hand the 7 expressions to the user as a plain list.
`;
}

function titleInstructions(p, thumbText) {
  const { titleVerdict } = require('./lib/titlecopy');
  const picked = (p.titleCandidates || []).filter((c) => c.picked);
  // What the user ticked is the whole point of ticking: the agent should
  // write more in that register rather than starting from nothing.
  const likedBlock = picked.length
    ? `\n## Directions the user liked
Write more in this register. These are what they picked out of the options
they were shown, so treat them as the taste to match, not as text to reuse:
${picked.map((c) => `- "${c.title}" (${c.angle}, ${Math.round(c.overlap * 100)}% overlap, ${titleVerdict(c.overlap)})`).join('\n')}
`
    : '';
  const draftBlock = p.titleDraft
    ? `\n## The user's own draft
"${p.titleDraft}"
Their instinct for this video. Keep what makes it work and sharpen it.
`
    : '';

  return `# Title Instructions - "${p.title}"

The winning thumbnail is chosen. Write 5 video titles that SUPPORT it.
${likedBlock}${draftBlock}

## Context
- Thumbnail text: "${thumbText || '(image only, no text)'}"
- Working title: "${p.title}"${p.titleStatus === 'working' ? ' (provisional, derived from the hook)' : ''}
- Hook / claim: ${p.hook || '(none)'}
- Notes: ${p.notes || '(none)'}
${p.episodeType === 'interview' && p.guestName ? `- Guest: ${p.guestName}\n` : ''}
## The rule that matters
Title and thumbnail must overlap about 50%, never 100%. The thumbnail grabs,
the title completes. If the thumbnail already says "${thumbText}", the title
should add the mechanism, the person, the stakes or the timeframe rather than
repeating the same words. Worked example: thumbnail "150K STARS / in 72 hours"
plus title "How a solo dev's open source project exploded overnight". Together
they tell one story; neither is redundant.

## Style
- Under 70 characters where possible (YouTube truncates around there).
- Concrete and specific beats clever. Keep real numbers exact.
- No claims the video cannot back up, no em dashes, no hashtags.

## Deliver
Either POST them back so they appear in the studio:

    POST http://localhost:${PORT}/api/projects/${p.slug}/titles
    Content-Type: application/json

    {"candidates": ["title 1", "title 2", "title 3", "title 4", "title 5"]}

or hand the 5 titles to the user as a plain list.
`;
}

app.patch('/api/projects/:slug/social', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(socialJsonPath(req.params.slug), 'utf8'));
    for (const key of ['xPost', 'xAlt', 'liPost', 'liAlt', 'pAlt']) {
      if (typeof req.body?.[key] === 'string') data[key] = req.body[key];
    }
    if (['card', 'ai-1', 'ai-2', 'ai-3'].includes(req.body?.pChoice)) data.pChoice = req.body.pChoice;
    fs.writeFileSync(socialJsonPath(req.params.slug), JSON.stringify(data, null, 2));
    res.json(data);
  } catch {
    res.status(400).json({ error: 'generate the social pack first' });
  }
});

// ---------- download everything (organised ZIP) -----------------------------
// One archive per video, foldered in the order you actually use the files.
// Saved to projects/<slug>/download/ so it also lives on disk, not only in
// the browser's download folder.

app.post('/api/projects/:slug/pack-zip', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.outputs.length) return res.status(400).json({ error: 'no thumbnails yet' });

    // Last gate before anything leaves the machine. Codex writes images
    // straight into output/ without ever calling this server, so this sweep
    // is the only thing standing between those files and the delivered ZIP.
    const swept = readSettings().stripAiMetadata ? sweepProject(p.slug) : null;

    const dir = projectDir(p.slug);
    const outDir = path.join(dir, 'output');
    const socialDir = path.join(dir, 'social');
    const zipDir = path.join(dir, 'download');
    fs.mkdirSync(zipDir, { recursive: true });

    // Make sure the YouTube-ready export exists before packing.
    const shipped = deliveredImage(p);
    let exportName = null;
    if (shipped && fs.existsSync(shipped.path)) {
      exportName = `${p.slug}-1280x720.jpg`;
      const exportPath = path.join(dir, 'export', exportName);
      // Rebuild when the delivered image is newer, otherwise shipping a
      // final-round pick leaves the ZIP holding an export of the old winner
      // next to a full-size image of the new one.
      const stale =
        fs.existsSync(exportPath) &&
        fs.statSync(shipped.path).mtimeMs > fs.statSync(exportPath).mtimeMs;
      if (stale) fs.rmSync(exportPath, { force: true });
      if (!fs.existsSync(exportPath)) {
        fs.mkdirSync(path.join(dir, 'export'), { recursive: true });
        await sizedJpg(shipped.path, exportPath, 1280, 720);
      }
    }

    let social = null;
    try { social = JSON.parse(fs.readFileSync(socialJsonPath(p.slug), 'utf8')); } catch {}
    const chosenPortrait =
      social?.pChoice && social.pChoice !== 'card'
        ? `portrait-ai-${social.pChoice.split('-')[1]}-1080x1350.jpg`
        : 'portrait-1080x1350.jpg';

    const zipPath = path.join(zipDir, `${p.slug}-pack.zip`);
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipPath);
    const zip = archiver('zip', { zlib: { level: 9 } });
    const done = new Promise((resolve, reject) => {
      output.on('close', resolve);
      zip.on('error', reject);
    });
    zip.pipe(output);
    const root = `${p.slug}-pack`;
    const add = (file, dest) => { if (fs.existsSync(file)) zip.file(file, { name: `${root}/${dest}` }); };

    // 1 - YouTube
    if (exportName) {
      add(path.join(dir, 'export', exportName), `1-youtube/thumbnail-1280x720.jpg`);
      add(shipped.path, `1-youtube/winner-full-size${path.extname(shipped.file)}`);
    }
    // 2 - Social images
    for (const f of ['x-1200x675.jpg', 'linkedin-1200x627.jpg']) add(path.join(socialDir, f), `2-social/${f}`);
    add(path.join(socialDir, chosenPortrait), `2-social/portrait-1080x1350.jpg`);
    // 3 - Texts
    if (social) {
      const texts = {
        'x-post.txt': social.xPost,
        'x-alt-text.txt': social.xAlt,
        'linkedin-post.txt': social.liPost,
        'linkedin-alt-text.txt': social.liAlt,
        'portrait-alt-text.txt': social.pAlt,
      };
      for (const [name, body] of Object.entries(texts)) {
        if (body) zip.append(String(body), { name: `${root}/3-texts/${name}` });
      }
    }
    // 4 - Every thumbnail
    for (const f of p.outputs) add(path.join(outDir, f), `4-all-thumbnails/${f}`);

    zip.append(readmeText(p, social, exportName, chosenPortrait), { name: `${root}/READ-ME.txt` });
    await zip.finalize();
    await done;

    const bytes = fs.statSync(zipPath).size;
    res.json({ file: `download/${p.slug}-pack.zip`, absolutePath: zipPath, folder: dir, bytes, swept });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

function readmeText(p, social, exportName, chosenPortrait) {
  const s = readSettings();
  return `${p.title}
${'='.repeat(p.title.length)}

Everything you need to publish this video, in the order you use it.

1-youtube/
  thumbnail-1280x720.jpg   Upload this as the YouTube thumbnail (under 2MB).
  winner-full-size.png     The original full resolution image, for reuse.
${exportName ? '' : '  (empty: no winner was picked yet)\n'}
2-social/
  x-1200x675.jpg           X / Twitter, 16:9.
  linkedin-1200x627.jpg    LinkedIn landscape, 1.91:1.
  portrait-1080x1350.jpg   4:5 portrait, works on BOTH X and LinkedIn and
                           takes the most space in mobile feeds.
                           (this pack contains: ${chosenPortrait})

3-texts/
  x-post.txt               Post text for X, max 280 characters.
  x-alt-text.txt           Image alt text for X, max 1000 characters.
  linkedin-post.txt        Post text for LinkedIn. Only the first ~200
                           characters show before "see more".
  linkedin-alt-text.txt    Image alt text for LinkedIn, max 300 characters.
  portrait-alt-text.txt    Alt text for the portrait image.
  Replace [link] with the video URL before posting.

4-all-thumbnails/
  variation-1..7.png       All seven candidates, in case you change your mind.

Channel: ${s.showName}
Host: ${s.hostName}
Generated by Thumbnail Studio.
Built by Joao Queiros in Porto, Portugal | joaojbq@ai.joaoqueiros.com | (c) 2026
www.ai.joaoqueiros.com
`;
}

// ---------- guest photo auto-fetch (no API) ---------------------------------

app.post('/api/projects/:slug/find-guest-photos', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    const name = (p.guestName || '').trim();
    if (!name) return res.status(400).json({ error: 'add a guest name first' });
    const { ddgImageSearch, downloadImageAsJpg } = require('./lib/imagesearch');
    const refsDir = path.join(projectDir(p.slug), 'refs');
    fs.mkdirSync(refsDir, { recursive: true });
    // "headshot" strongly biases results toward frontal face photos
    const results = await ddgImageSearch(`${name} founder headshot`);
    let saved = listImages(refsDir).filter((f) => f.startsWith('guest-')).length;
    for (const r of results.slice(0, 20)) {
      if (saved >= 2) break;
      if (r.width && r.width < 400) continue;
      // skip banner/screenshot shapes; a usable face photo is portrait-ish
      if (r.width && r.height && r.width / r.height > 1.6) continue;
      try {
        await downloadImageAsJpg(r.url, path.join(refsDir, `guest-${saved + 1}.jpg`), sharp);
        saved++;
      } catch {}
    }
    if (!saved) return res.status(502).json({ error: 'no usable photos found online, add one manually' });
    res.json(readProject(p.slug));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- background removal (local, no APIs) -----------------------------

app.post('/api/projects/:slug/refs/:name/removebg', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    const src = path.resolve(projectDir(p.slug), 'refs', req.params.name);
    if (!src.startsWith(projectDir(p.slug)) || !fs.existsSync(src)) {
      return res.status(400).json({ error: 'ref not found' });
    }
    const outName = req.params.name.replace(/\.\w+$/, '') + '-cutout.png';
    const out = path.join(projectDir(p.slug), 'refs', outName);
    // Isolated child process: onnxruntime-node crashes if loaded next to sharp.
    await new Promise((resolve, reject) => {
      const { execFile } = require('child_process');
      execFile(
        process.execPath,
        [path.join(__dirname, 'lib', 'removebg-worker.js'), src, out],
        { timeout: 5 * 60 * 1000 },
        (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve())
      );
    });
    res.json(readProject(p.slug));
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- roadmap (monthly improvement cycle) -----------------------------

const ROADMAP_FILE = path.join(DATA_DIR, 'roadmap.json');

function readRoadmap() {
  try {
    return JSON.parse(fs.readFileSync(ROADMAP_FILE, 'utf8'));
  } catch {
    return { items: [] };
  }
}

app.get('/api/roadmap', (req, res) => res.json(readRoadmap()));

// Append new proposals (used by the monthly Claude run).
app.post('/api/roadmap', (req, res) => {
  const data = readRoadmap();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const it of items) {
    if (!it.title) continue;
    data.items.push({
      id: it.id || `r${Date.now()}${Math.floor(Math.random() * 100)}`,
      title: String(it.title),
      detail: String(it.detail || ''),
      category: String(it.category || 'general'),
      status: 'proposed',
      proposedAt: new Date().toISOString().slice(0, 10),
    });
  }
  fs.writeFileSync(ROADMAP_FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

app.post('/api/roadmap/:id/status', (req, res) => {
  const data = readRoadmap();
  const item = data.items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  if (!['proposed', 'accepted', 'done', 'declined'].includes(req.body?.status)) {
    return res.status(400).json({ error: 'bad status' });
  }
  item.status = req.body.status;
  fs.writeFileSync(ROADMAP_FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

// ---------- generation providers (optional, off by default) -----------------

app.post('/api/projects/:slug/generate', async (req, res) => {
  try {
    const p = readProject(req.params.slug);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (!p.variations?.length) return res.status(400).json({ error: 'build the 7 prompts first' });
    const settings = readSettings();
    if (settings.provider === 'browser') {
      return res.status(400).json({
        error: 'provider is set to browser: generate with your browser agent (Claude or Codex), or pick an API provider in Settings',
      });
    }
    if (settings.provider === 'playwright') {
      // Fire the scripted runner detached; it reports back through the
      // upload endpoint as images complete.
      const { spawn } = require('child_process');
      const args = [path.join(ROOT, 'scripts', 'chatgpt-runner.mjs'), 'run', p.slug];
      if (Number(req.body?.only)) args.push('--only', String(Number(req.body.only)));
      const child = spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: 'ignore' });
      child.unref();
      return res.json({ started: true, done: [], failed: [], message: 'Playwright runner launched, a Chrome window is doing the work' });
    }
    const providers = require('./lib/providers');
    const dir = projectDir(p.slug);
    const done = [];
    const failed = [];
    // {only: N} regenerates a single variation instead of all 7
    const only = Number(req.body?.only) || null;
    const targets = only ? p.variations.filter((v) => v.index === only) : p.variations;
    for (const v of targets) {
      const outPath = path.join(dir, 'output', `variation-${v.index}.png`);
      const refPaths = (v.attachments || []).map((a) => path.join(dir, a)).filter((f) => fs.existsSync(f));
      const prompt = v.promptFinal || v.prompt;
      try {
        if (settings.provider === 'openai') {
          const u = await providers.generateWithOpenAI({ prompt, refPaths, outPath, apiKey: settings.openaiApiKey });
          usage.record({
            kind: 'api-image',
            model: 'gpt-image-1 (OpenAI API)',
            images: 1,
            tokensIn: u?.input_tokens || 0,
            tokensOut: u?.output_tokens || 0,
            // published gpt-image-1 pricing: image input $10/M tokens, image output $40/M
            cost: u ? (u.input_tokens * 10 + u.output_tokens * 40) / 1e6 : 0,
          });
        } else {
          if (!ALLOW_CUSTOM_COMMAND) {
            throw new Error(
              'the custom command provider is off. It runs a shell command, so it is not something a web request can switch on: ' +
                'put the template in data/settings.json yourself and restart with THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND=1'
            );
          }
          await providers.generateWithCustom({ prompt, refPaths, outPath, template: settings.customCommand });
          usage.record({ kind: 'api-image', model: 'custom command', images: 1, estTokens: usage.estTokens(prompt) });
        }
        if (settings.stripAiMetadata) cleanOne(outPath);
        done.push(v.index);
      } catch (err) {
        failed.push({ index: v.index, error: String(err.message || err) });
      }
    }
    res.json({ done, failed, project: readProject(p.slug) });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// ---------- suggestions -----------------------------------------------------
// data/suggestions.json holds researched guest + solo-video ideas. Claude
// refreshes it weekly (Monday cron) or on request; the UI reads it and can
// prefill a new project from any entry.

const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');

function readSuggestions() {
  if (!fs.existsSync(SUGGESTIONS_FILE)) return { updatedAt: null, guests: [], solo: [] };
  try {
    return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, guests: [], solo: [] };
  }
}

app.get('/api/suggestions', (req, res) => res.json(readSuggestions()));

app.post('/api/suggestions', (req, res) => {
  const { guests = [], solo = [] } = req.body || {};
  const data = { updatedAt: new Date().toISOString(), guests, solo };
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

app.post('/api/suggestions/:id/used', (req, res) => {
  const data = readSuggestions();
  for (const list of [data.guests, data.solo]) {
    const hit = list.find((s) => s.id === req.params.id);
    if (hit) hit.used = !hit.used;
  }
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2));
  res.json(data);
});

// ---------- static ----------------------------------------------------------

app.use('/files', express.static(PROJECTS_DIR));
app.use('/brand/host', express.static(HOST_DIR));
app.use('/brand/inspo', express.static(INSPO_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// The UI parses every response as JSON. Without this, a multer rejection (an
// oversized file, an unknown slug) arrives as Express's default HTML page, the
// parse throws inside api.upload, and the user sees nothing at all.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  res.status(status).json({ error: String(err?.message || err) });
});

// Loopback by default. Without a host argument Node binds every interface, which
// put an unauthenticated settings API and an image generator on the local
// network: anyone on the same Wi-Fi could read the OpenAI key. Set HOST=0.0.0.0
// only when you actually mean to serve the network, and know that nothing here
// asks for a password.
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`\n  Thumbnail Studio`);
  console.log(`  http://localhost:${PORT}`);
  console.log(
    HOST === '127.0.0.1'
      ? `  bound to ${HOST}, this machine only\n`
      : `  bound to ${HOST}. Reachable from the network, and there is no login\n`
  );
});
