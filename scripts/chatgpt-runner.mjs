// Playwright persistent-profile runner: generates thumbnails through YOUR
// logged-in chatgpt.com session as a deterministic script. Zero LLM tokens,
// zero API cost, no password ever stored: you log in ONCE by hand in the
// window this opens, and the session persists in data/chatgpt-profile/.
//
// Usage:
//   node scripts/chatgpt-runner.mjs login                 one-time login window
//   node scripts/chatgpt-runner.mjs run <slug>            generate missing thumbnails
//   node scripts/chatgpt-runner.mjs run <slug> --only 3   just one variation
//
// Honest caveat: this depends on chatgpt.com's page structure. When OpenAI
// changes their UI it may break until selectors are updated; fall back to the
// browser agent or manual flow meanwhile.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// playwright-core lives in the app's node_modules
const requireApp = createRequire(path.join(ROOT, 'app', 'package.json'));
const { chromium } = requireApp('playwright-core');
const PROFILE = path.join(ROOT, 'data', 'chatgpt-profile');
const APP = 'http://localhost:4626';
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// HUMAN PACING: rate limits come from burst speed, not volume. Default gap
// between sends is 45-75s (jittered). Override with --gap <seconds>.
let GAP_MS = 45000;

async function pauseIfLimited(page) {
  const limited = await page
    .getByText(/Too many requests|temporarily limited|slow down/i)
    .count()
    .catch(() => 0);
  if (limited) {
    log('rate limit message detected, pausing 10 minutes to cool down');
    await page.waitForTimeout(10 * 60 * 1000);
    return true;
  }
  return false;
}

function chromePath() {
  const hit = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found; install Google Chrome or edit CHROME_PATHS');
  return hit;
}

async function openContext(headless = false) {
  fs.mkdirSync(PROFILE, { recursive: true });
  return chromium.launchPersistentContext(PROFILE, {
    executablePath: chromePath(),
    headless,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

async function login() {
  const ctx = await openContext(false);
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://chatgpt.com');
  log('Log in to ChatGPT in the opened window (once).');
  log('When you see the normal chat screen, just CLOSE the window.');
  await new Promise((resolve) => ctx.on('close', resolve));
  log('Profile saved. Future runs need no login.');
}

// Generated images carry alt="Generated image"; attachments never do, so
// counting THESE before and after the send is a reliable completion signal.
const GEN_IMG = 'img[alt*="Generated" i]';

async function countGenerated(page) {
  return page.locator(GEN_IMG).count();
}

async function waitForGeneration(page, baseline) {
  const deadline = Date.now() + 8 * 60 * 1000;
  await page.waitForTimeout(10000);
  while (Date.now() < deadline) {
    const busy = await page.locator('[data-testid="stop-button"]').count();
    const previews = await page.getByText('Preview', { exact: true }).count();
    const generated = await countGenerated(page);
    if (!busy && !previews && generated > baseline) return;
    await pauseIfLimited(page);
    await page.waitForTimeout(8000);
  }
  throw new Error('generation timed out after 8 minutes');
}

async function grabLastImage(page) {
  let imgs = page.locator(GEN_IMG);
  let n = await imgs.count();
  if (!n) {
    imgs = page.locator('main img[src*="oaiusercontent"], main img[src*="backend-api"]');
    n = await imgs.count();
  }
  if (!n) throw new Error('no generated image found on the page');
  const src = await imgs.nth(n - 1).getAttribute('src');
  // Fetch inside the page so the session cookies apply.
  const b64 = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }, src);
  return Buffer.from(b64, 'base64');
}

async function uploadToApp(slug, name, buf) {
  const fd = new FormData();
  fd.append('photos', new Blob([buf], { type: 'image/png' }), `${name}.png`);
  const res = await fetch(`${APP}/api/projects/${slug}/upload/output?name=${name}&runner=playwright`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`app upload failed: ${res.status}`);
}

async function run(slug, only) {
  const project = await (await fetch(`${APP}/api/projects/${slug}`)).json();
  if (project.error) throw new Error(project.error);
  if (!project.variations?.length) throw new Error('build the 7 prompts first');
  const projDir = path.join(ROOT, 'projects', slug);
  const targets = project.variations.filter(
    (v) => (!only || v.index === only) && (only || !project.outputs.some((f) => f.startsWith(`variation-${v.index}.`)))
  );
  if (!targets.length) return log('nothing to generate, all variations exist');
  log(`Generating ${targets.length} variation(s) for "${project.title}"`);

  const ctx = await openContext(false);
  const page = ctx.pages()[0] || (await ctx.newPage());
  // One ChatGPT conversation per video: reuse the saved chat when it exists.
  // New chats are created from the configured ChatGPT project page so
  // every video's chat lives inside that project.
  let settings = {};
  try { settings = await (await fetch(`${APP}/api/settings`)).json(); } catch {}
  const newChatUrl = settings.chatgptProjectUrl || 'https://chatgpt.com';
  const startUrl = project.chatUrl || newChatUrl;
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const findComposer = () => page.locator('#prompt-textarea, div[contenteditable="true"]').first();
  try {
    await findComposer().waitFor({ timeout: 15000 });
    if (project.chatUrl) log('continuing this video\'s existing chat');
  } catch {
    if (project.chatUrl) {
      log('saved chat unavailable, starting a fresh one in the project');
      project.chatUrl = null;
      await page.goto(newChatUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      await findComposer().waitFor({ timeout: 15000 });
    } else {
      throw new Error('composer not found: are you logged in? run "login" first');
    }
  }
  let chatSaved = Boolean(project.chatUrl);

  let first = true;
  for (const v of targets) {
    log(`variation ${v.index} (${v.archetype.name} x ${v.colorway.name})`);
    try {
    // The DOM re-renders between messages; resolve everything fresh.
    await page.mouse.wheel(0, 20000);
    await page.waitForTimeout(1000);
    const composer = findComposer();
    // Attach this variation's reference images (first message carries them;
    // later ones only when the variation itself needs the guest).
    const attach = (v.attachments || [])
      .filter((a) => first || a.includes('guest'))
      .map((a) => path.join(projDir, a))
      .filter((f) => fs.existsSync(f));
    if (attach.length) {
      await page.locator('input[type="file"]').first().setInputFiles(attach);
      await page.waitForTimeout(4000);
    }
    const prompt = (v.promptFinal || v.prompt).replace(/\n+/g, ' ');
    const baseline = await countGenerated(page);
    await pauseIfLimited(page);
    // Popups (onboarding, cookie banners) block the composer on fresh profiles.
    await page.keyboard.press('Escape').catch(() => {});
    await composer.click();
    await composer.fill(prompt);
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    // Verify the send happened: the stop button appears OR the composer
    // empties. Be patient, the UI can take several seconds to react.
    let sent = false;
    for (let t = 0; t < 24 && !sent; t += 2) {
      await page.waitForTimeout(2000);
      const busy = (await page.locator('[data-testid="stop-button"]').count()) > 0;
      const text = (await composer.innerText().catch(() => '')) || '';
      sent = busy || text.trim().length < 20;
      if (!sent && t === 6) {
        const sendBtn = page.locator('button[data-testid="send-button"], button[aria-label*="Send" i]').first();
        if (await sendBtn.count()) await sendBtn.click().catch(() => {});
      }
    }
    if (!sent) {
      await page.screenshot({ path: path.join(ROOT, 'scripts', 'runner-debug.png') });
      throw new Error('message did not send; see scripts/runner-debug.png');
    }
    // First message of a new chat: remember this conversation for the video.
    if (!chatSaved) {
      try {
        await page.waitForURL(/chatgpt\.com\/.*c\//, { timeout: 30000 });
        await fetch(`${APP}/api/projects/${slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatUrl: page.url() }),
        });
        chatSaved = true;
        log(`chat saved for this video: ${page.url()}`);
      } catch {}
    }
    try {
      await waitForGeneration(page, baseline);
    } catch (err) {
      await page.screenshot({ path: path.join(ROOT, 'scripts', 'runner-debug.png') });
      throw err;
    }
    const buf = await grabLastImage(page);
    await uploadToApp(slug, `variation-${v.index}`, buf);
    log(`variation ${v.index} saved (${Math.round(buf.length / 1024)} KB)`);
    first = false;
    // Human pacing between sends so the account never trips a burst limit.
    if (targets.indexOf(v) < targets.length - 1) {
      const gap = GAP_MS + Math.floor(Math.random() * 30000);
      log(`pacing: waiting ${Math.round(gap / 1000)}s before the next one`);
      await page.waitForTimeout(gap);
    }
    } catch (err) {
      await page.screenshot({ path: path.join(ROOT, 'scripts', 'runner-debug.png') }).catch(() => {});
      throw err;
    }
  }
  await ctx.close();
  log('Done.');
}

const [, , cmd, slug, ...rest] = process.argv;
const only = rest.includes('--only') ? Number(rest[rest.indexOf('--only') + 1]) : null;
if (rest.includes('--gap')) GAP_MS = Math.max(10, Number(rest[rest.indexOf('--gap') + 1]) || 45) * 1000;

try {
  if (cmd === 'login') await login();
  else if (cmd === 'run' && slug) await run(slug, only);
  else console.log('usage: node scripts/chatgpt-runner.mjs login | run <slug> [--only N]');
} catch (err) {
  console.error('FAILED:', err.message);
  process.exit(1);
}
