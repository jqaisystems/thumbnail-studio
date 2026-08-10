/* Thumbnail Studio */

const $ = (sel, el = document) => el.querySelector(sel);

// Read-only demo: the build script freezes every API response as a static
// JSON file, so GETs are remapped and anything that writes is refused
// politely instead of failing.
const DEMO = typeof window !== 'undefined' && window.DEMO_MODE === true;
const DEMO_REFUSAL = 'Read-only demo, so this one only works in the real studio';

function demoUrl(url) {
  const clean = url.split('?')[0].replace(/^\/api\//, '');
  if (clean === 'projects') return '/api/projects.json';
  const proj = clean.match(/^projects\/([\w-]+)$/);
  if (proj) return `/api/projects/${proj[1]}.json`;
  const sub = clean.match(/^projects\/([\w-]+)\/(\w+)$/);
  if (sub) return `/api/projects/${sub[1]}-${sub[2]}.json`;
  return `/api/${clean}.json`;
}

const api = {
  get: (url) =>
    DEMO
      ? fetch(demoUrl(url))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : fetch(url).then((r) => r.json()),
  send: (method, url, body) => {
    if (DEMO) {
      toast(DEMO_REFUSAL);
      return Promise.resolve({ error: DEMO_REFUSAL });
    }
    return fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json());
  },
  upload: (url, files) => {
    if (DEMO) {
      toast(DEMO_REFUSAL);
      return Promise.resolve({ error: DEMO_REFUSAL });
    }
    const fd = new FormData();
    for (const f of files) fd.append('photos', f);
    // A rejected upload can come back as HTML, which would throw here and
    // leave the caller silently awaiting nothing.
    return fetch(url, { method: 'POST', body: fd })
      .then((r) => r.json())
      .catch(() => ({ error: 'Upload failed' }));
  },
  // Deletes were raw fetch, so they bypassed the read-only demo refusal.
  del: (url) => {
    if (DEMO) {
      toast(DEMO_REFUSAL);
      return Promise.resolve({ error: DEMO_REFUSAL });
    }
    return fetch(url, { method: 'DELETE' }).then((r) => r.json()).catch(() => ({}));
  },
};

const state = { meta: null, projects: [], project: null, settings: null };

// The studio is a white-label template, so every place that used to name one
// channel now reads Settings. These two are the only spellings of that: use
// them instead of writing a name into markup, or the next adopter finds
// someone else's channel staring back at them from the sidebar.
const hostLabel = () => state.settings?.hostName || 'the host';
const showLabel = () => state.settings?.showName || 'your channel';

// Which photo in brand/host-photos/ leads every generation. Mirrors
// primaryHostPhoto() on the server: a name set in Settings wins, otherwise the
// first image in the folder, so a fresh install with photos dropped in works
// without anyone editing a constant.
const primaryHostPhoto = () => {
  const photos = state.meta?.hostPhotos || [];
  const picked = state.settings?.hostRefPrimary;
  return (picked && photos.includes(picked) ? picked : photos[0]) || '';
};

// Rendered as a ref cell only when a host photo actually exists. On an empty
// install this used to be a hardcoded filename, so the row showed a broken
// image and claimed a reference that was not there.
function hostAutoRefCell() {
  const photo = primaryHostPhoto();
  if (!photo) return '';
  return `<div class="ref-cell"><img class="ref-thumb" src="/brand/host/${encodeURIComponent(photo)}" alt="${esc(hostLabel())} reference"><span class="tag">host · auto</span></div>`;
}

function paintBrand() {
  const sub = $('#brandSub');
  if (!sub) return;
  const bits = [state.settings?.showName, state.settings?.hostName].filter(
    (v) => v && v !== 'Your channel' && v !== 'the host'
  );
  sub.textContent = bits.join(' · ');
}

// Every render used to set #main.innerHTML and then attach fresh delegated
// listeners to the SAME element, so handlers piled up: after N actions one
// click fired N times, each from a different stale project snapshot. Swapping
// in a clean clone drops every listener bound to the old node.
function setMain(html) {
  const old = $('#main');
  const fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  fresh.innerHTML = html;
  return fresh;
}

// Errors used to look exactly like successes and vanish just as fast, so a
// failed action was indistinguishable from a done one.
function toast(msg, kind) {
  const t = $('#toast');
  const bad = kind === 'error' || /^(could not|failed|not found|pick a winner|build the|adopt a|no image|image not|upload failed)/i.test(String(msg));
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), bad ? 5200 : 1800);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const leadColorway = (p) => state.meta.colorways[(p?.seed ?? 0) % state.meta.colorways.length];

// Paths shown to the user come from the server, so they are correct on both
// Windows and Mac and never hardcode one machine's folders.
function projectPath(slug, ...parts) {
  const base = state.meta?.projectsDir || 'projects';
  const sep = base.includes('\\') ? '\\' : '/';
  return [base, slug, ...parts].join(sep);
}

function setAccent(colorway) {
  const cw = colorway || { accent: '#e8382b', support: '#ffffff' };
  document.documentElement.style.setProperty('--accent', cw.accent);
  document.documentElement.style.setProperty(
    '--accent-ink',
    cw.support === '#0C0E10' ? '#0c0e10' : '#ffffff'
  );
}

/* ---------- sidebar ---------- */

function renderSidebar() {
  const slug = currentSlug();
  const routeKey = slug
    ? 'project'
    : location.hash.startsWith('#/suggestions') ? 'suggestions'
    : location.hash.startsWith('#/grid') ? 'grid'
    : location.hash.startsWith('#/how') ? 'how'
    : location.hash.startsWith('#/settings') ? 'settings'
    : location.hash.startsWith('#/roadmap') ? 'roadmap'
    : location.hash.startsWith('#/usage') ? 'usage'
    : 'home';
  for (const link of document.querySelectorAll('#mainNav .nav-link')) {
    link.classList.toggle('active', link.dataset.nav === routeKey);
  }
  $('#projectList').innerHTML = state.projects
    .map((p) => {
      const cw = leadColorway(p);
      const done = p.outputs.length;
      return `<a class="project-item ${p.slug === slug ? 'active' : ''}" href="#/project/${p.slug}">
        <span class="dot" style="background:${cw.accent}"></span>${esc(p.title)}
        <span class="meta">${p.episodeType === 'interview' ? 'Interview' : 'Solo'} · ${done}/7 images${p.winner ? ' · ★ winner' : ''}${p.titleStatus === 'working' ? ' · working title' : ''}</span>
      </a>`;
    })
    .join('');
  $('#rotationStrip').innerHTML = state.meta.colorways
    .map((c) => `<span style="background:${c.accent}" title="${esc(c.name)}"></span>`)
    .join('');
}

/* ---------- router ---------- */

const currentSlug = () => (location.hash.match(/^#\/project\/([\w-]+)/) || [])[1] || null;

async function route() {
  state.projects = await api.get('/api/projects');
  const slug = currentSlug();
  if (slug) {
    state.project = state.projects.find((p) => p.slug === slug) || null;
    state.project ? renderProject(state.project) : renderHome();
  } else if (location.hash.startsWith('#/grid')) {
    state.project = null;
    await renderGrid();
  } else if (location.hash.startsWith('#/suggestions')) {
    state.project = null;
    await renderSuggestions();
  } else if (location.hash.startsWith('#/settings')) {
    state.project = null;
    await renderSettings();
  } else if (location.hash.startsWith('#/roadmap')) {
    state.project = null;
    await renderRoadmap();
  } else if (location.hash.startsWith('#/usage')) {
    state.project = null;
    await renderUsage();
  } else if (location.hash.startsWith('#/how')) {
    state.project = null;
    renderHow();
  } else {
    state.project = null;
    renderHome();
  }
  renderSidebar();
}

/* ---------- home / new project ---------- */

function renderHome() {
  setAccent(null);
  setMain(`
  <div class="hero">
    <div class="stack">
      <span class="s1">UPLOAD.</span><br>
      <span class="s2">GET 7.</span><br>
      <span class="s3">PICK ONE.</span>
    </div>
    <p>One project per video. The studio turns your title, notes and photos into
    7 on-brand thumbnail prompts - different layouts, rotating colorways - ready
    for ChatGPT, an agent, or your clipboard.</p>
  </div>

  <div class="section" id="new">
    <div class="section-head"><h2>New video</h2>
      <span class="hint">Thumbnail-first? Start from a concept: the title comes later, suggested to support the winning thumbnail.</span></div>
    <form class="card" id="newForm">
      <div class="mood-row" id="startMode" style="margin-bottom:14px">
        <button type="button" class="mood-pill active" data-start="title">Start from a title</button>
        <button type="button" class="mood-pill" data-start="concept">Start from a concept</button>
      </div>
      <div class="form-grid">
        <label class="field full" id="titleField"><b>Video title</b>
          <input type="text" name="title" required placeholder="e.g. Polsia: AI Agent + Zero Employees = $10M Run Rate">
        </label>
        <label class="field"><b>Episode type</b>
          <select name="episodeType">
            <option value="solo">Solo (host only)</option>
            <option value="interview">Interview (host + guest)</option>
          </select>
        </label>
        <label class="field"><b>Guest name (if interview)</b>
          <input type="text" name="guestName" placeholder="e.g. Eric Ries">
        </label>
        <label class="field full" id="hookField"><b>The hook - one bold claim or number</b>
          <input type="text" name="hook" placeholder="e.g. $10M run rate with zero employees">
        </label>
        <label class="field full"><b>Notes / summary (optional - paste anything)</b>
          <textarea name="notes" placeholder="Key moments, numbers, props, what made you say 'wow'…"></textarea>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn btn-accent" type="submit">Create project</button>
      </div>
    </form>
  </div>`);

  // Title-first vs thumbnail-first (concept) entry. Concept mode makes the
  // hook the required field; the server derives a working title from it.
  const setStartMode = (mode) => {
    const form = $('#newForm');
    form.dataset.mode = mode;
    const concept = mode === 'concept';
    for (const b of document.querySelectorAll('#startMode .mood-pill')) {
      b.classList.toggle('active', b.dataset.start === mode);
    }
    form.elements.title.required = !concept;
    form.elements.hook.required = concept;
    $('#titleField b').textContent = concept
      ? 'Working title (optional - real titles get suggested after you pick the winning thumbnail)'
      : 'Video title';
    $('#hookField b').textContent = concept
      ? 'The thumbnail concept - one bold claim or number'
      : 'The hook - one bold claim or number';
  };
  $('#startMode').addEventListener('click', (e) => {
    const pill = e.target.closest('[data-start]');
    if (pill) setStartMode(pill.dataset.start);
  });

  // Prefill from a chosen suggestion (set by the suggestions page).
  const prefill = sessionStorage.getItem('prefill');
  if (prefill) {
    sessionStorage.removeItem('prefill');
    const d = JSON.parse(prefill);
    const form = $('#newForm');
    for (const key of ['title', 'hook', 'notes', 'guestName', 'episodeType']) {
      if (d[key] != null && form.elements[key]) form.elements[key].value = d[key];
    }
    if (d.mode === 'concept') setStartMode('concept');
    $('#new').scrollIntoView();
    toast('Prefilled from suggestion, review and create');
  }

  $('#newForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (e.target.dataset.mode === 'concept') data.titleStatus = 'working';
    const p = await api.send('POST', '/api/projects', data);
    if (p.error) return toast(p.error);
    location.hash = `#/project/${p.slug}`;
    // Interview with a guest name but no photo: fetch photos online right away.
    if (p.episodeType === 'interview' && p.guestName) {
      toast(`Searching the web for photos of ${p.guestName}…`);
      api.send('POST', `/api/projects/${p.slug}/find-guest-photos`).then((r) => {
        toast(r.error ? r.error : `Guest photos added for ${p.guestName}`);
        if (!r.error && currentSlug() === p.slug) route();
      });
    }
  });
}

/* ---------- suggestions ---------- */

// "andrew" is the pre-rename prefix. Kept so refs in projects created before the
// white-label rename still show their tag instead of falling through to "ref".
const REF_KIND_TAGS = { 'guest-': 'guest', 'logo-': 'logo', 'bg-': 'background', 'host-': 'host', andrew: 'host' };

function refTag(f) {
  for (const [prefix, tag] of Object.entries(REF_KIND_TAGS)) if (f.startsWith(prefix)) return tag;
  if (f.startsWith('style-ref')) return 'style';
  return 'ref';
}

function suggestionCard(s, kind) {
  return `<article class="card sugg ${s.used ? 'used' : ''}">
    <div class="sugg-head">
      <b>${esc(kind === 'guest' ? s.name : s.title)}</b>
      ${kind === 'guest' ? `<span class="sugg-why">${esc(s.who || '')}</span>` : ''}
    </div>
    ${kind === 'guest' ? `<div class="sugg-row"><span>Title</span>${esc(s.title)}</div>` : ''}
    <div class="sugg-row"><span>Hook</span>${esc(s.hook)}</div>
    <div class="sugg-row"><span>Notes</span>${esc(s.notes)}</div>
    ${s.why ? `<div class="sugg-row"><span>Why now</span>${esc(s.why)}</div>` : ''}
    ${s.source?.url ? `<div class="sugg-row"><span>Source</span><a href="${esc(s.source.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(s.source.name || s.source.url)}</a></div>` : ''}
    <div class="varia-actions">
      <button class="btn btn-sm btn-accent" data-use='${esc(JSON.stringify({
        title: s.title, hook: s.hook, notes: s.notes,
        guestName: kind === 'guest' ? s.name : '',
        episodeType: kind === 'guest' ? 'interview' : 'solo',
      }))}'>Start project</button>
      <button class="btn btn-sm" data-use='${esc(JSON.stringify({
        title: s.title, hook: s.hook, notes: s.notes,
        guestName: kind === 'guest' ? s.name : '',
        episodeType: kind === 'guest' ? 'interview' : 'solo',
        mode: 'concept',
      }))}'>Start thumbnail-first</button>
      <button class="btn btn-sm" data-used="${esc(s.id)}">${s.used ? 'Mark unused' : 'Mark used'}</button>
    </div>
  </article>`;
}

async function renderSuggestions() {
  setAccent(null);
  const data = await api.get('/api/suggestions');
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'never';
  setMain(`
    <div class="page-kicker">Refreshed weekly, every Monday · last update: ${esc(updated)}</div>
    <h1>Guests &amp; ideas</h1>
    <div class="section">
      <div class="section-head"><h2>Suggested guests</h2>
        <span class="hint">Founders who fit your audience: people making real money building with AI. Start project prefills the brief.</span></div>
      <div class="sugg-grid">${data.guests.map((s) => suggestionCard(s, 'guest')).join('') || '<div class="card" style="color:var(--muted)">No suggestions yet. Ask Claude: "refresh the suggestions".</div>'}</div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Solo video ideas</h2>
        <span class="hint">Researched topics for your solo episodes.</span></div>
      <div class="sugg-grid">${data.solo.map((s) => suggestionCard(s, 'solo')).join('') || '<div class="card" style="color:var(--muted)">No ideas yet. Ask Claude: "refresh the suggestions".</div>'}</div>
    </div>`);

  $('#main').addEventListener('click', async (e) => {
    const use = e.target.closest('[data-use]');
    if (use) {
      sessionStorage.setItem('prefill', use.dataset.use);
      location.hash = '#/';
      return;
    }
    const used = e.target.closest('[data-used]');
    if (used) {
      await api.send('POST', `/api/suggestions/${used.dataset.used}/used`);
      renderSuggestions();
    }
  });
}

/* ---------- project view ---------- */

function outputFor(p, i) {
  return p.outputs.find((f) => new RegExp(`^variation-${i}([.-]|$)`).test(f));
}

// The mood pills plus an Auto pill. Auto lives in its own meta field rather
// than inside meta.moods, so anything treating meta.moods as the real palette
// is unaffected; guarded so a stale demo snapshot degrades instead of throwing.
function moodPills(field, current) {
  const auto = state.meta.autoMood;
  const pill = (k, l, title) =>
    `<button type="button" class="mood-pill ${current === k ? 'active' : ''}" data-mood="${k}"${title ? ` title="${title}"` : ''}>${esc(l)}</button>`;
  return `<div class="mood-row" data-mood-for="${field}">
    ${Object.entries(state.meta.moods).map(([k, l]) => pill(k, l)).join('')}
    ${auto ? pill(auto.key, auto.label, 'Reads the brief and varies the expression across the 7') : ''}
  </div>
  <input type="hidden" name="${field}" value="${esc(current)}">`;
}

// The page is long and every stage unlocks the next one thousands of pixels
// below, so the only signal used to be a toast that vanished in 1.8 seconds.
// This is the map: what is done, what is next, and a way to jump there.
function workflowStrip(p) {
  const done = (v) => (v ? 'done' : '');
  const imgs = p.outputs.length;
  const stages = [
    { id: 'sec-brief', label: 'Brief', state: done(p.hook || p.notes) },
    { id: 'sec-seven', label: 'Prompts', state: done(p.variations?.length) },
    { id: 'sec-seven', label: `Images ${imgs}/7`, state: done(imgs >= 7) },
    { id: 'sec-test', label: 'Winner', state: done(p.winner), locked: imgs < 2 },
    { id: 'sec-title', label: 'Title', state: done(p.titleStatus === 'final'), locked: !p.winner },
    { id: 'sec-download', label: 'Ship', state: done(false), locked: !p.winner },
  ];
  // The first unfinished, unlocked stage is where the user actually is.
  const now = stages.findIndex((s) => !s.state && !s.locked);
  // Buttons, not anchors: the app routes on location.hash, so an href="#..."
  // would rewrite the route and bounce the user to the home page.
  return `<nav class="flow" aria-label="Workflow">
    ${stages.map((s, i) => `
      <button type="button" class="flow-step ${s.state} ${s.locked ? 'locked' : ''} ${i === now ? 'now' : ''}"
         data-jump="${s.id}" ${s.locked ? 'disabled aria-disabled="true"' : ''}>
        <span class="flow-dot">${s.state ? '✓' : i === now ? '→' : ''}</span>${esc(s.label)}
      </button>`).join('')}
  </nav>`;
}

function renderProject(p) {
  setAccent(leadColorway(p));

  setMain(`
  <div class="page-kicker">${p.episodeType === 'interview' ? 'Interview episode' : 'Solo episode'} · lead colorway: ${esc(leadColorway(p).name)}</div>
  <h1>${esc(p.title)}${p.titleStatus === 'working' ? '<span class="title-badge" title="Derived from the concept. Adopt a real title after the winner is picked.">working title</span>' : ''}</h1>
  ${workflowStrip(p)}

  <div class="section" id="sec-brief">
    <div class="section-head"><h2>Brief</h2><span class="hint">Changes are saved when you press Save.</span></div>
    <form class="card" id="briefForm">
      <div class="form-grid">
        <label class="field full"><b>Title${p.titleStatus === 'working' ? ' (working)' : ''}</b><input type="text" name="title" value="${esc(p.title)}">
          ${p.titleStatus === 'working' ? '<span class="hint">Renaming keeps the project folder name (slug) as it is.</span>' : ''}</label>
        <label class="field"><b>Episode type</b>
          <select name="episodeType">
            <option value="solo" ${p.episodeType === 'solo' ? 'selected' : ''}>Solo</option>
            <option value="interview" ${p.episodeType === 'interview' ? 'selected' : ''}>Interview</option>
          </select>
        </label>
        <label class="field"><b>Guest name</b><input type="text" name="guestName" value="${esc(p.guestName)}"></label>
        <label class="field full"><b>Host mood</b>
          ${moodPills('hostMood', p.hostMood || 'smiley')}
        </label>
        ${p.episodeType === 'interview' ? `
        <label class="field full"><b>Guest mood</b>
          ${moodPills('guestMood', p.guestMood || 'smiley')}
        </label>
        <label class="field"><b>Guest coverage</b>
          <select name="guestEverywhere">
            <option value="" ${!p.guestEverywhere ? 'selected' : ''}>Guest in 5 of 7 (default)</option>
            <option value="true" ${p.guestEverywhere ? 'selected' : ''}>Guest in all 7</option>
          </select>
          <span class="hint">All 7 when the guest IS the story.</span>
        </label>` : ''}
        <label class="field full"><b>Hook</b><input type="text" name="hook" value="${esc(p.hook)}"></label>
        <label class="field full"><b>Notes</b><textarea name="notes">${esc(p.notes)}</textarea></label>
        <label class="field full"><b>References to find online (describe them, the agent searches and adds them)</b>
          <textarea name="refNotes" placeholder="e.g. Ben Cera's headshot from LinkedIn · Polsia logo · a Stripe dashboard screenshot for the background">${esc(p.refNotes || '')}</textarea></label>
      </div>
      <div class="form-actions">
        <button class="btn" type="submit">Save brief</button>
        <button class="btn btn-accent" type="button" id="buildBtn">${p.variations?.length ? 'Rebuild the 7 prompts' : 'Build the 7 prompts'}</button>
        ${p.variations?.length && p.promptVersion !== state.meta?.promptVersion
          ? '<span class="hint warn-hint">⚠ These prompts came from an older prompt engine. Rebuild to pick up the fixes. Rebuilding can reassign colorways.</span>'
          : ''}
        ${p.titleStatus === 'working' ? '<button class="btn" type="button" id="titleFinalBtn">Mark title as final</button>' : ''}
        ${state.settings?.provider !== 'browser' && p.variations?.length ? '<button class="btn" type="button" id="apiGenBtn">⚡ Generate via API</button>' : ''}
        <button class="btn btn-ghost btn-danger" type="button" id="deleteBtn">Delete project</button>
      </div>
    </form>
  </div>

  <div class="section" id="sec-refs">
    <div class="section-head"><h2>References</h2>
      <span class="hint">The main host photo is attached automatically. Max 10 images per generation, extras stay in the folder.</span></div>
    <div class="card">
      <div class="refs-row" id="refsRow">
        ${hostAutoRefCell()}
        ${p.refs.map((f) => `
          <div class="ref-cell">
            <img class="ref-thumb" src="/files/${p.slug}/refs/${encodeURIComponent(f)}" alt="${esc(f)}">
            <span class="tag">${refTag(f)}</span>
            <button class="del" data-del-ref="${esc(f)}" title="Remove">✕</button>
            ${(f.startsWith('guest-') || f.startsWith('bg-')) && !f.includes('-cutout') ? `<button class="del rembg" data-rembg="${esc(f)}" title="Remove background">✂</button>` : ''}
          </div>`).join('')}
        <div class="dropzone" id="guestDrop" tabindex="0">Drop photos here<br>(saved as guest)<br>or use the buttons</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-sm" data-add-kind="guest">+ Guest photo</button>
        <button class="btn btn-sm" data-add-kind="host">+ Host extra</button>
        <button class="btn btn-sm" data-add-kind="logo">+ Logo</button>
        <button class="btn btn-sm" data-add-kind="bg">+ Background / prop</button>
        ${p.episodeType === 'interview' && p.guestName && !p.refs.some((f) => f.startsWith('guest-'))
          ? '<button class="btn btn-sm" id="findGuestBtn">🔎 Find guest photos online</button>' : ''}
        <span class="hint">${p.refs.length + (primaryHostPhoto() ? 1 : 0)} refs on disk · up to 10 attach per image</span>
        ${p.refs.some((f) => f.startsWith('guest-'))
          ? '<span class="hint warn-hint">⚠ Check each guest photo is really your guest. Auto-search and drag-and-drop can both bring in the wrong face.</span>'
          : ''}
        ${(p.skippedRefs || []).filter((s) => p.refs.includes(s.file)).map((s) =>
          `<span class="hint warn-hint">⚠ ${esc(s.file)} is not attached to any prompt: ${esc(s.reason)}.</span>`).join('')}
      </div>
      <input type="file" id="refFile" accept="image/*" multiple hidden>
    </div>
  </div>

  ${p.variations?.length ? renderSeven(p) : `
  <div class="section"><div class="card" style="color:var(--muted)">
    No prompts yet - press <b style="color:var(--ink)">Build the 7 prompts</b> above.
    The pack (prompts + agent instructions + refs) will be written to
    <code>${projectPath(p.slug, 'pack')}</code>.
  </div></div>`}

  ${p.outputs.length >= 2 ? renderTestSection(p) : ''}

  ${p.winner ? renderTitleSection(p) : ''}

  ${p.winner && p.titleStatus !== 'working' ? renderFinalRound(p) : ''}

  ${p.winner ? `
  <div class="section">
    <div class="section-head"><h2>Social pack</h2>
      <span class="hint">X and LinkedIn versions of the winner: right sizes, post text in the host's voice, alt text. Edit anything before copying. Everything at once: ${cmdChip(`run the full workflow for ${p.slug}`)}</span>
      ${p.titleStatus === 'working' ? '<span class="hint warn-hint">⚠ Still a working title. Posts and alt texts will carry it - adopt a final title above first.</span>' : ''}</div>
    <div id="socialWrap"><div class="card" style="color:var(--muted)">Loading social pack…</div></div>
  </div>` : ''}

  ${p.outputs.length ? `
  <div class="section" id="sec-download">
    <div class="section-head"><h2>Download</h2>
      <span class="hint">Everything for this video in one organised ZIP, and where the files live on your computer.</span>
      ${p.titleStatus === 'working' ? '<span class="hint warn-hint">⚠ The ZIP\'s READ-ME and texts will carry the working title.</span>' : ''}</div>
    <div class="card">
      <div class="form-actions" style="margin-top:0">
        <button class="btn btn-accent" id="zipBtn">⤓ Download everything (ZIP)</button>
        ${p.winner ? '<button class="btn" type="button" id="exportBtn">Just the YouTube thumbnail (1280×720 JPG)</button>' : ''}
        <span class="hint">1-youtube · 2-social · 3-texts · 4-all-thumbnails, plus a READ-ME explaining each file.</span>
      </div>
      ${p.winner ? (() => {
        const opt = p.finalChoice
          ? (p.finalRound?.options || []).find((o) => String(p.finalChoice).startsWith(`final-${o.n}.`))
          : null;
        const swatch = opt?.accent ? `<span class="swatch-dot" style="background:${opt.accent}"></span>${esc(opt.colorwayName)} · ` : '';
        return `<div class="sugg-row" style="margin-top:10px"><span>Shipping</span>${p.finalChoice
          ? `${esc(p.finalChoice)} <span class="hint">${swatch}from the final round, layout from ${esc(String(p.winner).replace(/\.\w+$/, ''))}</span>`
          : `${esc(p.winner)} <span class="hint">the winning variation</span>`}</div>`;
      })() : ''}
      <div id="zipResult"></div>
      <div id="metaRow" class="sugg-row" style="margin-top:10px"><span>Metadata</span><span style="color:var(--muted)">checking…</span></div>
      <div class="sugg-row" style="margin-top:10px"><span>Folder</span>${cmdChip(projectPath(p.slug))}</div>
    </div>
  </div>` : ''}

  ${renderMiniGrid(p)}`);

  bindProjectEvents(p);
}

// Images made through chatgpt.com arrive carrying a C2PA "Content Credentials"
// block. The studio strips it on the way in, but Codex writes files straight to
// disk without passing through the server, so show what is actually there.
async function refreshMetadataRow(slug) {
  const row = $('#metaRow');
  if (!row) return;
  const r = await api.get(`/api/projects/${slug}/metadata`);
  if (!r || r.error) return row.remove();

  if (!r.dirty) {
    row.innerHTML = '<span>Metadata</span><span style="color:var(--muted)">'
      + `No AI provenance data in these ${r.files} image${r.files === 1 ? '' : 's'}.`
      + (r.enabled ? '' : ' Automatic removal is off in Settings.') + '</span>';
    return;
  }

  const kb = Math.round(r.items.reduce((n, i) => n + i.findings.reduce((m, f) => m + f.bytes, 0), 0) / 1024);
  row.innerHTML = `<span>Metadata</span><span>
    <b>${r.dirty} image${r.dirty === 1 ? '' : 's'}</b> still carry AI provenance data (${kb} KB):
    ${r.items.map((i) => esc(i.name)).join(', ')}.
    <button class="btn" type="button" id="cleanMetaBtn" style="margin-left:8px">Clean now</button></span>`;

  $('#cleanMetaBtn').addEventListener('click', async () => {
    toast('Cleaning…');
    const res = await api.send('POST', `/api/projects/${slug}/clean-metadata`);
    if (res.error) return toast(res.error);
    toast(`Cleaned ${res.cleaned} image${res.cleaned === 1 ? '' : 's'}, ${Math.round(res.bytesSaved / 1024)} KB removed`);
    refreshMetadataRow(slug);
  });
}

function renderSeven(p) {
  // The expression is invisible otherwise, so surface it whenever it varies.
  const auto = state.meta.autoMood?.key;
  const showMood = p.hostMood === auto || p.guestMood === auto || (p.moodPlan || []).length > 0;
  const edited = p.variations.filter((v) => v.textAuto || v.promptAuto).length;
  const moodWritten = (p.moodPlan || []).length;
  return `
  <div class="section" id="sec-seven">
    <div class="section-head"><h2>The Seven</h2>
      <span class="hint">7 layouts × rotating colorways. Every one is editable below.</span></div>

    <div class="card seven-controls">
      <div class="seven-row">
        <span class="seven-label">Generate</span>
        <div class="seven-items">
          ${cmdChip(`Follow the instructions in ${projectPath(p.slug, 'pack', 'CODEX_INSTRUCTIONS.md')}`, 'Codex instructions')}
          ${cmdChip(`node scripts\\chatgpt-runner.mjs run ${p.slug}`, 'Playwright runner')}
          ${cmdChip(`generate thumbnails for ${p.slug}`, 'Tell Claude')}
          <span class="hint">Codex is the best of the three.</span>
        </div>
      </div>

      <div class="seven-row">
        <span class="seven-label">Expressions</span>
        <div class="seven-items">
          <button class="btn btn-sm" id="moodsBtn">Vary the faces across the 7</button>
          ${cmdChip(`Follow the instructions in ${projectPath(p.slug, 'pack', 'MOOD_INSTRUCTIONS.md')}`, 'Have an agent write them')}
          ${moodWritten ? '<button class="btn btn-sm btn-ghost" id="moodsClearBtn">Clear written</button>' : ''}
          ${moodWritten ? '<span class="hint warn-hint">✍ Written expressions are overriding the mood pills.</span>' : ''}
        </div>
      </div>

      <div class="seven-row">
        <span class="seven-label">Prompt edits</span>
        <div class="seven-items">
          <button class="btn btn-sm" id="editsSaveBtn">Save prompt edits</button>
          ${edited ? '<button class="btn btn-sm btn-ghost" id="editsResetBtn">Reset all edits</button>' : ''}
          <span class="hint">Edit the text on a card, or open Prompt for the whole thing. Edits survive rebuilds. The .md files do not: they are rewritten every time.</span>
          ${edited
            ? `<span class="hint warn-hint">✍ ${edited} of the 7 ${edited === 1 ? 'is' : 'are'} edited. An edited prompt stops following the brief until you reset it.</span>`
            : ''}
        </div>
      </div>

      <div class="seven-row">
        <span class="seven-label">Folder</span>
        <div class="seven-items">${cmdChip(projectPath(p.slug, 'pack'), null, 'full')}</div>
      </div>
    </div>

    <div class="varia-grid">
      ${p.variations.map((v) => {
        const cw = state.meta.colorways.find((c) => c.id === v.colorway.id) || {};
        const out = outputFor(p, v.index);
        const ink = cw.support === '#0C0E10' ? '#0c0e10' : '#fff';
        return `
        <article class="varia" style="--vc:${v.colorway.accent}; --vc-ink:${ink}">
          <div class="varia-head">
            <span class="varia-letter">${v.archetype.letter}</span>
            <div><b>${esc(v.archetype.name)}</b>
              <span class="cw">${esc(v.colorway.name)} · ${esc(v.copyAngle)}${v.usesGuestPhoto ? ' · uses guest photo' : ''}${v.textAuto ? ' · text edited' : ''}${v.promptAuto ? ' · prompt frozen' : ''}</span>
            </div>
          </div>
          <div class="varia-text ${v.promptAuto ? 'inert' : ''}">
            <input type="text" class="varia-text-input" data-edit-text="${v.index}" maxlength="60"
                   value="${esc(v.text)}" title="Text rendered on the image. Use / for a line break.">
            ${v.textAuto ? `<button class="btn btn-sm btn-ghost" data-reset="${v.index}" data-reset-kind="text" title="Back to &quot;${esc(v.textAuto)}&quot;">Reset text</button>` : ''}
            ${v.promptAuto ? '<span class="hint warn-hint">Not in use: this variation\'s prompt was edited by hand. Reset the prompt to bring the text back.</span>' : ''}
          </div>
          ${showMood && v.mood ? `<div class="varia-mood">${esc(v.mood.host)}${v.usesGuestPhoto ? ` · guest ${esc(v.mood.guest)}` : ''}</div>` : ''}
          <div class="varia-out ${out ? 'has' : ''}" data-slot="${v.index}" ${out ? '' : 'role="button" tabindex="0"'} title="${out ? esc(out) : 'Add the generated image'}" ${out ? '' : `aria-label="Add variation ${v.index} image"`}>
            ${out
              ? `<img src="/files/${p.slug}/output/${encodeURIComponent(out)}" alt="Variation ${v.index}">`
              : `Drop / click to add<br>variation-${v.index}.png`}
          </div>
          <div class="varia-actions">
            <button class="btn btn-sm" data-copy="${v.index}">Copy prompt</button>
            ${out ? `<button class="btn btn-sm win-btn ${p.winner === out ? 'active' : ''} ${!p.winner ? 'btn-accent' : ''}"
              aria-pressed="${p.winner === out}" data-win="${esc(out)}">${p.winner === out ? '★ Winner' : 'Pick as winner'}</button>` : ''}
            ${out ? `<a class="btn btn-sm" href="${outUrl(p, out)}" download="${esc(out)}">⤓ Download</a>` : ''}
            ${out ? `<button class="btn btn-sm" data-regen="${v.index}" data-regen-file="${esc(out)}">↻ Regenerate</button>` : ''}
            ${out ? `<button class="btn btn-sm btn-ghost btn-danger" data-del-out="${esc(out)}">Remove</button>` : ''}
          </div>
          <details ${v.promptAuto ? 'open' : ''}>
            <summary>Prompt${v.promptAuto ? ' · edited by hand' : ''}</summary>
            <textarea class="varia-prompt" data-edit-prompt="${v.index}" rows="14" spellcheck="false">${esc(v.promptFinal || v.prompt)}</textarea>
            ${v.promptAuto ? `<div class="cmd-row"><span class="hint warn-hint">This prompt no longer follows the brief.</span><button class="btn btn-sm btn-ghost" data-reset="${v.index}" data-reset-kind="prompt">Reset to generated</button></div>` : ''}
          </details>
        </article>`;
      }).join('')}
    </div>
  </div>
  <input type="file" id="slotFile" accept="image/*" hidden>`;
}

// Mirrors overlapRatio in app/lib/titlecopy.js, which is the source of truth.
// Duplicated so a title can be scored live while it is being typed.
const TITLE_STOP = new Set([
  'a', 'an', 'the', 'with', 'of', 'to', 'and', 'for', 'in', 'on', 'by', 'at',
  'is', 'was', 'when', 'how', 'his', 'her', 'their', 'that', 'this', 'it', 'its',
  'he', 'she', 'they', 'i', 'you', 'we',
]);

function titleOverlap(candidate, thumbText) {
  const words = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9$%.,]+/gi, ' ')
    .split(/\s+/).map((w) => w.replace(/[.,]+$/, '')).filter((w) => w && !TITLE_STOP.has(w)));
  const a = words(candidate);
  const b = words(thumbText);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / a.size;
}

// A bare percentage does not tell you what to do about it.
function titleVerdict(overlap) {
  if (overlap >= 0.3 && overlap <= 0.7) return { text: 'good balance', warn: false };
  return overlap > 0.7
    ? { text: 'too close, repeats the thumbnail', warn: true }
    : { text: 'adds a lot, check it still connects', warn: true };
}

function titleScoreSpan(title, thumbText) {
  const o = titleOverlap(title, thumbText);
  const v = titleVerdict(o);
  return `<span class="hint ${v.warn ? 'warn-hint' : ''}">${Math.round(o * 100)}% · ${v.text}</span>`;
}

// Thumbnail-first back-half: once the winner exists, suggest titles that
// SUPPORT it, at roughly 50% text overlap (never 100%, per the blueprint).
function renderTitleSection(p) {
  const cands = p.titleCandidates || [];
  const winner = p.variations?.find((v) => String(p.winner).startsWith(`variation-${v.index}.`));
  const thumbText = String(winner?.text || '').replace(/ \/ /g, ' ');
  const picked = cands.filter((c) => c.picked).length;
  const isCurrent = (t) => p.title === t && p.titleStatus !== 'working';

  const row = (c) => `
    <div class="title-cand">
      <label class="title-pick" title="Tick to send this direction to the agent">
        <input type="checkbox" data-title-pick="${esc(c.title)}" ${c.picked ? 'checked' : ''}>
      </label>
      <span class="cmd-label">${esc(c.angle)}</span>
      <b>${esc(c.title)}</b>
      ${titleScoreSpan(c.title, thumbText)}
      ${isCurrent(c.title)
        ? '<span class="hint">★ in use</span>'
        : `<button class="btn btn-sm" data-use-title="${esc(c.title)}">Use this title</button>`}
    </div>`;

  return `
  <div class="section" id="sec-title">
    <div class="section-head"><h2>Title</h2>
      <span class="hint">The thumbnail grabs, the title completes. Aim for about 50% overlap with the thumbnail text, never 100%.</span></div>
    <div class="card">
      <div class="title-cand">
        <span class="title-pick"></span>
        <span class="cmd-label">Now</span>
        <b>${esc(p.title)}</b>
        ${titleScoreSpan(p.title, thumbText)}
        <span class="hint">${p.titleStatus === 'working' ? 'working title' : '★ in use'}</span>
      </div>

      <div class="title-cand">
        <label class="title-pick" title="Tick to send your draft to the agent">
          <input type="checkbox" id="titleDraftPick" ${cands.some((c) => c.source === 'user' && c.picked) ? 'checked' : ''}>
        </label>
        <span class="cmd-label">Yours</span>
        <input type="text" id="titleDraft" class="title-draft" maxlength="120"
               placeholder="Write your own title here" value="${esc(p.titleDraft || '')}">
        <span id="titleDraftScore">${p.titleDraft ? titleScoreSpan(p.titleDraft, thumbText) : ''}</span>
        <button class="btn btn-sm" id="titleDraftSave">Save</button>
        ${p.titleDraft && !isCurrent(p.titleDraft)
          ? `<button class="btn btn-sm" data-use-title="${esc(p.titleDraft)}">Use this title</button>` : ''}
      </div>

      ${cands.filter((c) => c.source !== 'user').map(row).join('')}

      <div class="form-actions">
        <button class="btn" id="titlesBtn">${cands.length ? 'Refresh suggestions' : 'Suggest titles from the winner'}</button>
        <button class="btn btn-accent" id="titlePicksBtn" ${picked ? '' : 'disabled'}>Send ${picked || ''} pick${picked === 1 ? '' : 's'}</button>
        ${cmdChip(`Follow the instructions in ${projectPath(p.slug, 'pack', 'TITLE_INSTRUCTIONS.md')}`, 'Title instructions')}
        <span class="hint">${picked
          ? 'Your picks and your draft go into the instructions file so the agent writes more in that register.'
          : 'Tick the ones you like first, then the agent writes more like them.'}</span>
      </div>
    </div>
  </div>`;
}

// The pair check nobody was doing: the winning thumbnail's text was written
// before the title was settled, so the two can drift apart. This re-cuts the
// winning composition with text derived from the title that was adopted.
function renderFinalRound(p) {
  const winner = p.variations?.find((v) => String(p.winner).startsWith(`variation-${v.index}.`));
  if (!winner) return '';
  const pairScore = titleOverlap(p.title, String(winner.text || '').replace(/ \/ /g, ' '));
  const verdict = titleVerdict(pairScore);
  const round = p.finalRound;
  const files = p.finals || [];
  const chosen = p.finalChoice;

  // The options were cut for whatever the title was at the time. If the title
  // has moved on since, their scores are lies and the images are stale.
  const staleFor = round && round.title !== p.title ? round.title : null;

  const head = `
    <div class="section-head"><h2>Final round</h2>
      <span class="hint">Your title and your thumbnail should share about half their words. Right now they share
        <b class="${verdict.warn ? 'warn-hint' : ''}">${Math.round(pairScore * 100)}%</b>${verdict.warn ? ', so the pair is drifting apart' : ', which is a good pair'}.</span></div>
    ${staleFor ? `<div class="cmd-row"><span class="hint warn-hint">⚠ These options were cut for a different title ("${esc(staleFor)}"). Their scores below are measured against your current title, so they no longer match what they were designed for. Re-cut to fix.</span></div>` : ''}`;

  // The 7 weld layout to colour, so this picker is the only way to get the
  // winning layout in a different accent.
  const picked = round?.colorwayId || winner.colorway.id;
  const colourRow = `
    <div class="cmd-row">
      <span class="cmd-label">Colour</span>
      <div class="mood-row" id="finalColours">
        ${(state.meta.colorways || []).map((c) => `
          <button type="button" class="mood-pill swatch ${c.id === picked ? 'active' : ''}" data-colorway="${c.id}"
                  title="${c.id === winner.colorway.id ? 'The winning colour' : `Re-render in ${esc(c.name)}`}">
            <span class="swatch-dot" style="background:${c.accent}"></span>${esc(c.name)}${c.id === winner.colorway.id ? ' ·' : ''}
          </button>`).join('')}
      </div>
    </div>
    <div class="cmd-row"><span class="hint">The dotted one is the winning colour. Pick another and the same thumbnail is re-rendered in it, keeping the layout, the faces and the expression.</span></div>`;

  if (!round) {
    return `<div class="section">${head}
      <div class="card">
        ${colourRow}
        <div class="form-actions" style="margin-top:0">
          <button class="btn btn-accent" id="finalRoundBtn">Re-cut the winner</button>
          <span class="hint">Same layout, faces and expression. The text is re-cut for your title, and the colour is whatever you pick above.</span>
        </div>
      </div>
    </div>`;
  }

  const original = `
    <div class="card social-card">
      <div class="sugg-head"><b>Original${!chosen ? ' · ★ shipping' : ''}</b><span class="sugg-why">variation ${winner.index} · ${Math.round(pairScore * 100)}% with the title</span></div>
      <img class="social-img" src="/files/${p.slug}/output/${encodeURIComponent(p.winner)}" alt="">
      <div class="varia-text">“${esc(winner.text)}”</div>
      <div class="varia-actions">
        ${chosen ? '<button class="btn btn-sm win-btn" data-final-choice="">Keep the original</button>' : '<span class="hint">★ this is what ships</span>'}
      </div>
    </div>`;

  const slots = round.options.map((o) => {
    const file = files.find((f) => f.startsWith(`final-${o.n}.`));
    const active = Boolean(file) && chosen === file;
    // Score live against the CURRENT title, never the stored value, which was
    // measured against whatever the title was when the option was cut.
    const score = Math.round(titleOverlap(p.title, o.text) * 100);
    return `
    <div class="card social-card">
      <div class="sugg-head"><b>Option ${o.n}${active ? ' · ★ shipping' : ''}</b><span class="sugg-why">${score}% with the title${o.colorwayName ? ` · <span class="swatch-dot" style="background:${o.accent}"></span>${esc(o.colorwayName)}` : ''}</span></div>
      ${file
        ? `<img class="social-img" src="/files/${p.slug}/final/${encodeURIComponent(file)}" alt="">`
        : `<div class="varia-out" data-fslot="${o.n}" role="button" tabindex="0" aria-label="Add final option ${o.n} image" title="Add the generated image">Drop / click to add<br>final-${o.n}.png</div>`}
      <div class="varia-text">“${esc(o.text)}”</div>
      <div class="varia-actions">
        <button class="btn btn-sm" data-copy-fprompt="${o.n}">Copy prompt</button>
        ${file ? `<a class="btn btn-sm" href="/files/${p.slug}/final/${encodeURIComponent(file)}" download="${esc(file)}">⤓ Image</a>` : ''}
        ${file ? `<button class="btn btn-sm win-btn ${active ? 'active' : ''}" data-final-choice="${esc(file)}">${active ? '★ Shipping' : 'Ship this one'}</button>` : ''}
      </div>
    </div>`;
  });

  return `<div class="section">${head}
    <div class="sugg-grid" style="grid-template-columns:repeat(auto-fit,minmax(186px,1fr))">${original}${slots.join('')}</div>
    ${colourRow}
    <div class="cmd-row" style="margin-top:14px">
      <button class="btn btn-sm" id="finalRoundBtn">Re-cut again</button>
      <span class="cmd-label">Or have an agent write the text</span>${cmdChip(`Follow the instructions in ${projectPath(p.slug, 'pack', 'FINAL_INSTRUCTIONS.md')}`, 'Final round instructions')}
      <span class="hint">Whichever is starred goes into the export, the social pack and the ZIP. The layout stats still credit variation ${winner.index}.</span>
    </div>
    <input type="file" id="fslotFile" accept="image/*" hidden>
  </div>`;
}

function renderMiniGrid(current) {
  const cards = state.projects.map((p) => {
    const img = p.winner
      ? `/files/${p.slug}/output/${encodeURIComponent(p.winner)}`
      : p.outputs[0]
        ? `/files/${p.slug}/output/${encodeURIComponent(p.outputs[0])}`
        : null;
    return `<div class="yt-card">
      <div class="yt-thumb">${img ? `<img src="${img}" alt="">` : 'no image yet'}</div>
      <div class="yt-title">${esc(p.title)}</div>
      <div class="yt-meta">${esc(showLabel())}${p.slug === current?.slug ? ' · this video' : ''}${p.winner ? ' · ★' : ''}</div>
    </div>`;
  });
  return `
  <div class="section">
    <div class="section-head"><h2>Channel grid</h2>
      <span class="hint">How the channel reads with the current picks. Squint.</span></div>
    <div class="yt-grid">${cards.join('')}</div>
  </div>`;
}

function bindProjectEvents(p) {
  const briefData = (form) => {
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.elements.guestEverywhere) data.guestEverywhere = data.guestEverywhere === 'true';
    return data;
  };

  $('#briefForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.send('PATCH', `/api/projects/${p.slug}`, briefData(e.target));
    toast('Brief saved');
    route();
  });

  $('#buildBtn').addEventListener('click', async () => {
    await api.send('PATCH', `/api/projects/${p.slug}`, briefData($('#briefForm')));
    // Typed but unsaved edits would otherwise be discarded by the rebuild.
    if (document.querySelector('[data-edit-text]')) {
      await api.send('POST', `/api/projects/${p.slug}/edits`, collectEdits());
    }
    const res = await api.send('POST', `/api/projects/${p.slug}/pack`);
    if (res.error) return toast(res.error);
    toast('Pack written to ' + projectPath(p.slug, 'pack'));
    route();
  });

  // mood barometer pills. The home page's title/concept toggle reuses these
  // classes without a data-mood-for, so skip it rather than wiring the brief
  // form to a row that has no field behind it.
  for (const row of document.querySelectorAll('.mood-row')) {
    if (!row.dataset.moodFor) continue;
    row.addEventListener('click', (e) => {
      const pill = e.target.closest('.mood-pill');
      if (!pill) return;
      row.querySelectorAll('.mood-pill').forEach((b) => b.classList.remove('active'));
      pill.classList.add('active');
      const form = $('#briefForm');
      form.elements[row.dataset.moodFor].value = pill.dataset.mood;
    });
  }

  if (p.winner) loadSocial(p);

  // Baselines come from the project object, never from a data- attribute:
  // round-tripping a multi-line prompt through HTML would renormalize its
  // whitespace, every field would compare as changed, and one Save would
  // freeze all 7 prompts.
  const varia = (n) => p.variations.find((x) => x.index === n) || {};
  const baseText = (n) => varia(n).textAuto || varia(n).text || '';
  const basePrompt = (n) => varia(n).promptAuto || varia(n).promptFinal || varia(n).prompt || '';

  // What the user is looking at wins over what was last saved, so Copy and
  // Regenerate never hand over a stale prompt.
  const promptTextFor = (n) =>
    document.querySelector(`[data-edit-prompt="${n}"]`)?.value || varia(n).promptFinal || varia(n).prompt || '';

  const collectEdits = () => ({
    textEdits: [...document.querySelectorAll('[data-edit-text]')]
      .map((el) => ({ index: Number(el.dataset.editText), text: el.value }))
      .filter((e) => e.text.trim() && e.text.trim() !== baseText(e.index).trim()),
    promptEdits: [...document.querySelectorAll('[data-edit-prompt]')]
      .map((el) => ({ index: Number(el.dataset.editPrompt), prompt: el.value }))
      .filter((e) => e.prompt.trim() && e.prompt.trim() !== basePrompt(e.index).trim()),
  });

  const saveEdits = async (done) => {
    const r = await api.send('POST', `/api/projects/${p.slug}/edits`, collectEdits());
    if (r.error) return toast(r.error);
    const b = await api.send('POST', `/api/projects/${p.slug}/pack`);
    if (b.error) return toast(b.error);
    toast(done);
    route();
  };

  $('#editsSaveBtn')?.addEventListener('click', () => saveEdits('Edits saved, the 7 files rewritten'));

  $('#editsResetBtn')?.addEventListener('click', () => {
    if (!confirm('Throw away every edit and go back to the generated prompts?')) return;
    // A reset is just a save with every field back at its baseline.
    for (const el of document.querySelectorAll('[data-edit-text]')) el.value = baseText(Number(el.dataset.editText));
    for (const el of document.querySelectorAll('[data-edit-prompt]')) el.value = basePrompt(Number(el.dataset.editPrompt));
    saveEdits('Back to the generated prompts');
  });

  // The mood plan lives on the project, but the 7 prompt files on disk only
  // pick it up on a rebuild, so both buttons chain into /pack.
  const applyMoods = async (body, done) => {
    const r = await api.send('POST', `/api/projects/${p.slug}/moods`, body);
    if (r.error) return toast(r.error);
    const b = await api.send('POST', `/api/projects/${p.slug}/pack`);
    if (b.error) return toast(b.error);
    toast(done);
    route();
  };

  // The button promises variety, so it has to actually switch the project to
  // Auto. Posting /moods alone left a smiley project byte-identical and still
  // toasted success.
  $('#moodsBtn')?.addEventListener('click', async () => {
    const auto = state.meta.autoMood?.key || 'auto';
    if (p.hostMood !== auto || (p.episodeType === 'interview' && p.guestMood !== auto)) {
      const body = { hostMood: auto };
      if (p.episodeType === 'interview') body.guestMood = auto;
      const r = await api.send('PATCH', `/api/projects/${p.slug}`, body);
      if (r.error) return toast(r.error);
    }
    applyMoods(undefined, 'Expressions varied across the 7, instructions written too');
  });

  $('#moodsClearBtn')?.addEventListener('click', () =>
    applyMoods({ clear: true }, 'Back to automatic expressions'));

  // Whatever is on screen goes with every call, so a refresh never loses a
  // typed draft or a tick.
  const titleState = () => ({
    draft: $('#titleDraft')?.value ?? p.titleDraft ?? '',
    picks: [
      ...[...document.querySelectorAll('[data-title-pick]:checked')].map((el) => el.dataset.titlePick),
      ...($('#titleDraftPick')?.checked && $('#titleDraft')?.value.trim() ? [$('#titleDraft').value.trim()] : []),
    ],
  });

  const sendTitles = async (done) => {
    const r = await api.send('POST', `/api/projects/${p.slug}/titles`, titleState());
    if (r.error) return toast(r.error);
    toast(done);
    route();
  };

  $('#titlesBtn')?.addEventListener('click', () =>
    sendTitles('Suggestions refreshed, your picks and draft kept'));

  $('#titlePicksBtn')?.addEventListener('click', () =>
    sendTitles('Picks written into the instructions file, hand it to an agent'));

  $('#titleDraftSave')?.addEventListener('click', () => sendTitles('Draft saved'));

  // The count came only from the server, so ticking boxes left the button
  // disabled and the primary path of this section was a dead end on first use.
  const refreshPickCount = () => {
    const btn = $('#titlePicksBtn');
    if (!btn) return;
    const n = titleState().picks.length;
    btn.disabled = n === 0;
    btn.textContent = `Send ${n || ''} pick${n === 1 ? '' : 's'}`.replace('  ', ' ');
  };
  for (const box of document.querySelectorAll('[data-title-pick], #titleDraftPick')) {
    box.addEventListener('change', refreshPickCount);
  }
  $('#titleDraft')?.addEventListener('input', refreshPickCount);

  // Live score while typing: the whole point is seeing the overlap move.
  $('#titleDraft')?.addEventListener('input', (e) => {
    const winner = p.variations?.find((v) => String(p.winner).startsWith(`variation-${v.index}.`));
    const thumbText = String(winner?.text || '').replace(/ \/ /g, ' ');
    const box = $('#titleDraftScore');
    if (box) box.innerHTML = e.target.value.trim() ? titleScoreSpan(e.target.value, thumbText) : '';
  });

  // Picking a colour only marks it; the re-cut is what applies it, so you can
  // change your mind without burning a round.
  $('#finalColours')?.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-colorway]');
    if (!pill) return;
    for (const b of document.querySelectorAll('#finalColours .mood-pill')) b.classList.remove('active');
    pill.classList.add('active');
  });

  $('#finalRoundBtn')?.addEventListener('click', async () => {
    const colorwayId = document.querySelector('#finalColours .mood-pill.active')?.dataset.colorway;
    const r = await api.send('POST', `/api/projects/${p.slug}/final-round`, colorwayId ? { colorwayId } : undefined);
    if (r.error) return toast(r.error);
    toast(`${r.options.length} options written, generate them like the seven`);
    route();
  });

  document.querySelectorAll('[data-fslot]').forEach((slot) =>
    slot.addEventListener('click', () => {
      const input = $('#fslotFile');
      input.onchange = async () => {
        if (!input.files.length) return;
        await api.upload(`/api/projects/${p.slug}/upload/final?name=final-${slot.dataset.fslot}`, [...input.files]);
        toast(`Saved as final-${slot.dataset.fslot}`);
        route();
      };
      input.click();
    })
  );

  document.querySelectorAll('[data-copy-fprompt]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const o = p.finalRound?.options.find((x) => x.n === Number(btn.dataset.copyFprompt));
      if (!o) return;
      await navigator.clipboard.writeText(o.prompt);
      toast(`Final ${o.n} prompt copied`);
    })
  );

  document.querySelectorAll('[data-final-choice]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const pick = btn.dataset.finalChoice || null;
      const r = await api.send('PATCH', `/api/projects/${p.slug}`, { finalChoice: pick });
      if (r.error) return toast(r.error);
      toast(pick ? `${pick} is what ships now` : 'Back to the original winner');
      route();
    })
  );

  $('#titleFinalBtn')?.addEventListener('click', async () => {
    await api.send('PATCH', `/api/projects/${p.slug}`, { titleStatus: 'final' });
    toast('Title marked as final');
    route();
  });

  $('#arenaBtn')?.addEventListener('click', () => startArena(p));
  $('#realityBtn')?.addEventListener('click', () => startReality(p));
  $('#labBtn')?.addEventListener('click', () => showLab(p));

  $('#findGuestBtn')?.addEventListener('click', async () => {
    toast(`Searching the web for photos of ${p.guestName}…`);
    const r = await api.send('POST', `/api/projects/${p.slug}/find-guest-photos`);
    toast(r.error ? r.error : 'Guest photos added');
    if (!r.error) route();
  });

  $('#apiGenBtn')?.addEventListener('click', async () => {
    if (!confirm(`Generate all 7 images now via the ${state.settings.provider} provider? This can take several minutes and may cost API credits.`)) return;
    toast('Generating via API… this runs all 7, hang on');
    const r = await api.send('POST', `/api/projects/${p.slug}/generate`);
    if (r.error) return toast(r.error);
    toast(`Done: ${r.done.length}/7 generated${r.failed.length ? `, ${r.failed.length} failed` : ''}`);
    route();
  });

  // A guest ref that is much wider than tall is almost never a face photo.
  // Flag it in place rather than waiting for a rebuild to explain itself.
  for (const img of document.querySelectorAll('#refsRow .ref-thumb')) {
    if (!/\/refs\/guest-/.test(img.getAttribute('src') || '')) continue;
    const flag = () => {
      if (!img.naturalWidth || img.naturalWidth / img.naturalHeight <= 1.6) return;
      img.closest('.ref-cell')?.classList.add('ref-warn');
      img.title = `${img.naturalWidth}x${img.naturalHeight}: too wide for a face reference`;
    };
    img.complete ? flag() : img.addEventListener('load', flag, { once: true });
  }

  refreshMetadataRow(p.slug);

  $('#zipBtn')?.addEventListener('click', async () => {
    toast('Building the pack…');
    const r = await api.send('POST', `/api/projects/${p.slug}/pack-zip`);
    if (r.error) return toast(r.error);
    toast(`Pack ready, ${Math.round(r.bytes / 1024 / 1024 * 10) / 10} MB`);
    $('#zipResult').innerHTML = `
      <div class="sugg-row" style="margin-top:12px"><span>Saved to</span>${cmdChip(r.absolutePath)}</div>`;
    refreshMetadataRow(p.slug);
    const a = document.createElement('a');
    a.href = `/files/${p.slug}/${r.file}`;
    a.download = `${p.slug}-pack.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('#exportBtn')?.addEventListener('click', async () => {
    toast('Exporting…');
    const res = await api.send('POST', `/api/projects/${p.slug}/export`);
    if (res.error) return toast(res.error);
    toast(`Exported, ${Math.round(res.bytes / 1024)} KB`);
    window.open(`/files/${p.slug}/${res.file}`, '_blank');
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!confirm(`Delete "${p.title}" and all its files?`)) return;
    await api.del(`/api/projects/${p.slug}`);
    location.hash = '#/';
  });

  // categorized reference uploads (guest / host / logo / bg)
  const drop = $('#guestDrop');
  const file = $('#refFile');
  const uploadRefs = async (files, kind) => {
    if (!files.length) return;
    const res = await api.upload(`/api/projects/${p.slug}/upload/refs?kind=${kind}`, files);
    const bad = res?.rejected?.[0];
    toast(bad ? `Not usable as a guest photo: ${bad.reason}` : `Added as ${kind}`);
    route();
  };
  drop.addEventListener('click', () => { file.dataset.kind = 'guest'; file.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { file.dataset.kind = 'guest'; file.click(); } });
  file.addEventListener('change', () => uploadRefs([...file.files], file.dataset.kind || 'guest'));
  for (const ev of ['dragover', 'dragleave', 'drop']) {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.toggle('drag', ev === 'dragover');
      if (ev === 'drop') uploadRefs([...e.dataTransfer.files], 'guest');
    });
  }
  for (const btn of document.querySelectorAll('[data-add-kind]')) {
    btn.addEventListener('click', () => { file.dataset.kind = btn.dataset.addKind; file.click(); });
  }

  // delegated actions
  $('#main').addEventListener('click', async (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const chip = e.target.closest('[data-cmd]');
    if (chip) {
      const ok = await copyText(chip.dataset.cmd);
      toast(ok ? 'Command copied, paste it to Claude' : 'Copy blocked, select the text manually');
      return;
    }
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const n = Number(copyBtn.dataset.copy);
      await navigator.clipboard.writeText(promptTextFor(n));
      toast(`Prompt ${n} copied - paste into ChatGPT`);
      return;
    }
    const resetBtn = e.target.closest('[data-reset]');
    if (resetBtn) {
      const n = Number(resetBtn.dataset.reset);
      const isText = resetBtn.dataset.resetKind === 'text';
      const field = document.querySelector(`[data-edit-${isText ? 'text' : 'prompt'}="${n}"]`);
      if (field) field.value = isText ? baseText(n) : basePrompt(n);
      saveEdits(`Variation ${n} back to the generated ${isText ? 'text' : 'prompt'}`);
      return;
    }
    const rembg = e.target.closest('[data-rembg]');
    if (rembg) {
      toast('Removing background… (first run downloads the model, be patient)');
      const res = await api.send('POST', `/api/projects/${p.slug}/refs/${encodeURIComponent(rembg.dataset.rembg)}/removebg`);
      if (res.error) return toast(res.error);
      toast('Cutout added');
      route();
      return;
    }
    const regen = e.target.closest('[data-regen]');
    if (regen) {
      const n = Number(regen.dataset.regen);
      const file = regen.dataset.regenFile;
      if (!confirm(`Regenerate variation ${n}? The current image is removed (a new one replaces it).`)) return;
      if (p.winner === file) await api.send('PATCH', `/api/projects/${p.slug}`, { winner: null });
      await api.del(`/api/projects/${p.slug}/file/output/${encodeURIComponent(file)}`);
      if (state.settings?.provider !== 'browser') {
        toast(`Regenerating variation ${n} via API…`);
        const r = await api.send('POST', `/api/projects/${p.slug}/generate`, { only: n });
        toast(r.error ? r.error : r.done.length ? `Variation ${n} regenerated` : `Failed: ${r.failed[0]?.error || 'unknown'}`);
      } else {
        await navigator.clipboard.writeText(promptTextFor(n));
        toast(`Prompt ${n} copied. Paste it into the video's ChatGPT chat, or tell Claude: "regenerate variation ${n} of ${p.slug}".`);
      }
      route();
      return;
    }
    // Deleting a file is irreversible, unlike the text resets that already ask.
    const delRef = e.target.closest('[data-del-ref]');
    if (delRef) {
      const f = delRef.dataset.delRef;
      if (!confirm(`Remove the reference photo ${f}? The file is deleted from disk.`)) return;
      await api.del(`/api/projects/${p.slug}/file/refs/${encodeURIComponent(f)}`);
      route();
      return;
    }
    const delOut = e.target.closest('[data-del-out]');
    if (delOut) {
      const f = delOut.dataset.delOut;
      if (!confirm(`Remove ${f}? The generated image is deleted from disk and you would have to regenerate it.`)) return;
      await api.del(`/api/projects/${p.slug}/file/output/${encodeURIComponent(f)}`);
      route();
      return;
    }
    const useTitle = e.target.closest('[data-use-title]');
    if (useTitle) {
      const r = await api.send('PATCH', `/api/projects/${p.slug}`, { title: useTitle.dataset.useTitle, titleStatus: 'final' });
      if (r.error) return toast(r.error);
      toast('Title set, now in use');
      route();
      return;
    }
    const winBtn = e.target.closest('[data-win]');
    if (winBtn) {
      const winner = p.winner === winBtn.dataset.win ? null : winBtn.dataset.win;
      await api.send('PATCH', `/api/projects/${p.slug}`, { winner });
      toast(winner ? 'Winner set' : 'Winner cleared');
      route();
      return;
    }
    // [data-slot], not .varia-out: the final-round and portrait slots share
    // that class and have their own handlers, so matching the class fired both.
    const slot = e.target.closest('[data-slot]:not(.has)');
    if (slot) {
      const input = $('#slotFile');
      input.onchange = async () => {
        if (!input.files.length) return;
        const r = await api.upload(`/api/projects/${p.slug}/upload/output?name=variation-${slot.dataset.slot}`, [...input.files]);
        if (r?.error) return toast(r.error);
        toast(`Saved as variation-${slot.dataset.slot}`);
        route();
      };
      input.click();
    }
  });

  // The whole manual ingest path was click-only, on an app whose normal
  // workflow is "generate elsewhere, bring the file back".
  $('#main').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const slot = e.target.closest('[data-slot]:not(.has), [data-fslot], [data-pslot]');
    if (!slot) return;
    e.preventDefault();
    slot.click();
  });

  // Drop images straight onto empty slots. Match the data attribute, never
  // the .varia-out class: the final-round and portrait slots share that class
  // for its shape, and matching it sent their drops into output/ as
  // variation-undefined.png.
  const DROP_TARGETS = [
    { attr: 'data-slot', bucket: 'output', name: (n) => `variation-${n}`, done: (n) => `Saved as variation-${n}` },
    { attr: 'data-fslot', bucket: 'final', name: (n) => `final-${n}`, done: (n) => `Saved as final-${n}` },
    { attr: 'data-pslot', bucket: 'social', name: (n) => `portrait-ai-${n}`, done: () => 'Portrait added, finalizing to 1080×1350…' },
  ];
  const dropTarget = (el) => {
    for (const t of DROP_TARGETS) {
      const hit = el?.closest(`[${t.attr}]`);
      if (hit) return { t, n: hit.getAttribute(t.attr) };
    }
    return null;
  };

  $('#main').addEventListener('dragover', (e) => {
    if (dropTarget(e.target)) e.preventDefault();
  });
  $('#main').addEventListener('drop', async (e) => {
    const hit = dropTarget(e.target);
    if (!hit) return;
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    const r = await api.upload(`/api/projects/${p.slug}/upload/${hit.t.bucket}?name=${hit.t.name(hit.n)}`, files);
    if (r?.error) return toast(r.error);
    toast(hit.t.done(hit.n));
    hit.t.bucket === 'social' ? loadSocial(p) : route();
  });
}

/* ---------- test & choose: Arena, Reality Check, Tiny-size Lab ---------- */

const outUrl = (p, f) => `/files/${p.slug}/output/${encodeURIComponent(f)}`;

const INSPO_TITLES = {
  'kb3es9LS8Wc-HD.jpg': '$0 AI bill. My exact stack',
  'HoVxjMNFYv4-HD.jpg': '30K stars on GitHub, then he got hired',
  'JxhC6Tch2T0-HD.jpg': 'OpenAI created Jarvis',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fakeMeta() {
  const views = ['8.1K', '12K', '24K', '48K', '102K'][Math.floor(Math.random() * 5)];
  const age = ['2 days', '5 days', '1 week', '2 weeks', '3 weeks'][Math.floor(Math.random() * 5)];
  return `${showLabel()} · ${views} views · ${age} ago`;
}

function ytCard(url, title, opts = {}) {
  return `<div class="ytsim-card ${opts.candidate ? 'is-candidate' : ''}" ${opts.pick ? `data-pick="${esc(opts.pick)}"` : ''} ${opts.pick ? 'role="button" tabindex="0"' : ''}>
    <div class="ytsim-thumb"><img src="${url}" alt=""></div>
    <div class="ytsim-title">${esc(title)}</div>
    <div class="ytsim-meta">${fakeMeta()}</div>
  </div>`;
}

function openOverlay(html) {
  const o = $('#overlay');
  o.innerHTML = `<div class="overlay-inner">${html}</div>`;
  o.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  const o = $('#overlay');
  o.hidden = true;
  o.innerHTML = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeOverlay(); });

// Arena: king-of-the-hill duels. 6 clicks, full ranking, winner saved.
function startArena(p) {
  const files = shuffle(p.outputs);
  let champion = files[0];
  const queue = files.slice(1);
  const eliminated = [];
  let duel = 1;

  const finish = async () => {
    const order = [champion, ...eliminated.reverse()];
    if (!DEMO) await api.send('POST', `/api/projects/${p.slug}/ranking`, { order });
    const note = DEMO
      ? 'In the real studio this saves the winner and the full ranking, and feeds the analytics.'
      : 'Winner saved, full ranking stored. This feeds the analytics too.';
    openOverlay(`
      <div class="overlay-head"><b>⚔ Champion</b><span>${note}</span><button class="btn btn-sm" data-close>Close</button></div>
      <div class="arena-champ">${ytCard(outUrl(p, champion), p.title)}</div>`);
    $('#overlay').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) route(); }, { once: true });
  };

  const render = () => {
    const challenger = queue[0];
    const pair = shuffle([champion, challenger]);
    openOverlay(`
      <div class="overlay-head"><b>⚔ The Arena</b><span>Duel ${duel} of ${files.length - 1}. Click the one YOU would tap.</span><button class="btn btn-sm" data-close>Esc</button></div>
      <div class="arena-duel">
        ${ytCard(outUrl(p, pair[0]), p.title, { pick: pair[0] })}
        <span class="arena-vs">VS</span>
        ${ytCard(outUrl(p, pair[1]), p.title, { pick: pair[1] })}
      </div>`);
    for (const el of document.querySelectorAll('[data-pick]')) {
      el.addEventListener('click', () => {
        const pick = el.dataset.pick;
        eliminated.push(pick === champion ? challenger : champion);
        champion = pick;
        queue.shift();
        duel++;
        queue.length ? render() : finish();
      });
    }
  };
  render();
}

// Reality Check: candidates in the REAL channel feed, or a mixed decoy feed.
async function startReality(p) {
  const decoys = [];
  for (const q of state.projects) {
    if (q.slug === p.slug) continue;
    const img = q.winner || q.outputs[0];
    if (img) decoys.push({ url: `/files/${q.slug}/output/${encodeURIComponent(img)}`, title: q.title });
  }
  for (const f of state.meta.inspiration) {
    decoys.push({ url: `/brand/inspo/${encodeURIComponent(f)}`, title: INSPO_TITLES[f] || 'How he built it with AI' });
  }
  const candidates = p.outputs.map((f) => ({ file: f, url: outUrl(p, f), title: p.title, candidate: true }));

  openOverlay(`
    <div class="overlay-head"><b>👁 Reality Check</b><span id="simHint">Loading your real channel…</span><button class="btn btn-sm" data-close>Esc</button></div>
    <div class="sim-controls">
      <label>Feed
        <select id="simFeed">
          <option value="channel">My real channel</option>
          <option value="mixed">Mixed decoys</option>
        </select>
      </label>
      <label id="simCandWrap">Candidate
        <select id="simCand">
          ${candidates.map((c) => `<option value="${esc(c.file)}" ${p.winner === c.file ? 'selected' : ''}>${esc(c.file.replace(/\.\w+$/, ''))}${p.winner === c.file ? ' ★' : ''}</option>`).join('')}
        </select>
      </label>
      <label>Size
        <select id="simSize">
          <option value="360">Desktop</option>
          <option value="240">Search</option>
          <option value="168">Sidebar</option>
        </select>
      </label>
      <label>Glance blur <input type="range" id="simBlur" min="0" max="5" step="1" value="0"></label>
      <label><input type="checkbox" id="simGray"> Grayscale</label>
      <label><input type="checkbox" id="simLight"> Light mode</label>
      <label><input type="checkbox" id="simReveal"> Reveal mine</label>
      <button class="btn btn-sm" id="simShuffle">Shuffle</button>
    </div>
    <div class="ytsim" id="simWrap"><div class="ytsim-grid" id="simGrid"></div></div>`);

  let channel = null;
  try {
    const feed = await api.get('/api/channel-feed');
    if (!feed.error && feed.videos?.length) channel = feed.videos;
  } catch {}
  if (!channel) {
    $('#simFeed').value = 'mixed';
    $('#simFeed').querySelector('option[value="channel"]').disabled = true;
    $('#simHint').textContent = 'Channel feed unavailable right now, showing the mixed feed.';
  }

  const renderCards = () => {
    const mode = $('#simFeed').value;
    if (mode === 'channel' && channel) {
      const file = $('#simCand').value;
      const cand = candidates.find((c) => c.file === file) || candidates[0];
      $('#simHint').textContent = 'Your real channel, with the selected candidate as the newest video.';
      $('#simGrid').innerHTML = [
        ytCard(cand.url, cand.title, { candidate: true }),
        ...channel.map((v) => ytCard(v.thumb, v.title)),
      ].join('');
    } else {
      $('#simHint').textContent = 'All candidates hidden among other videos. Which grabs you first?';
      const cards = shuffle([...candidates, ...shuffle(decoys).slice(0, 8)]);
      $('#simGrid').innerHTML = cards.map((c) => ytCard(c.url, c.title, { candidate: c.candidate })).join('');
    }
    $('#simCandWrap').style.display = mode === 'channel' ? '' : 'none';
  };
  const applyLook = () => {
    const wrap = $('#simWrap');
    wrap.style.setProperty('--sim-w', `${$('#simSize').value}px`);
    $('#simGrid').style.filter =
      `blur(${$('#simBlur').value}px)` + ($('#simGray').checked ? ' grayscale(1)' : '');
    wrap.classList.toggle('light', $('#simLight').checked);
    wrap.classList.toggle('reveal', $('#simReveal').checked);
  };
  renderCards();
  applyLook();
  for (const id of ['simSize', 'simBlur', 'simGray', 'simLight', 'simReveal']) {
    $(`#${id}`).addEventListener('input', applyLook);
  }
  for (const id of ['simFeed', 'simCand']) {
    $(`#${id}`).addEventListener('input', () => { renderCards(); applyLook(); });
  }
  $('#simShuffle').addEventListener('click', () => { renderCards(); applyLook(); });
}

// Tiny-size Lab: measured legibility at real 168px search size.
async function showLab(p) {
  toast('Measuring at 168px…');
  const rows = await api.get(`/api/projects/${p.slug}/legibility`);
  if (rows.error) return toast(rows.error);
  openOverlay(`
    <div class="overlay-head"><b>🔬 Tiny-size Lab</b><span>Every candidate at its real search-result size, with measured numbers.</span><button class="btn btn-sm" data-close>Esc</button></div>
    <div class="lab-rows">
      ${rows.map((r) => `
        <div class="lab-row">
          <img src="${r.tiny}" width="168" height="94" alt="">
          <div class="lab-info">
            <b>${esc(r.file)}${p.winner === r.file ? ' · ★ winner' : ''}</b>
            <div class="lab-metrics"><span>brightness ${r.brightness}</span><span>contrast ${r.contrast}</span><span>color pop ${r.pop}</span></div>
            ${r.flags.length
              ? `<div class="lab-flags">${r.flags.map((f) => `⚠ ${esc(f)}`).join('<br>')}</div>`
              : '<div class="lab-ok">✓ reads well at tiny size</div>'}
          </div>
        </div>`).join('')}
    </div>`);
}

/* ---------- social pack ---------- */

function socialCounter(value, limit, label) {
  const len = value.length;
  return `<span class="cnt ${len > limit ? 'over' : ''}">${len}/${limit}${label ? ` ${label}` : ''}</span>`;
}

function renderSocialInner(p, s) {
  if (!s) {
    return `<div class="card">
      <div class="form-actions" style="margin-top:0">
        <button class="btn btn-accent" id="socialGenBtn">Create social pack from the winner</button>
        <span class="hint">Makes x-1200x675.jpg + linkedin-1200x627.jpg in projects/${esc(p.slug)}/social/ and writes the post texts.</span>
      </div>
    </div>`;
  }
  const ts = Date.now();
  const platform = (key, altKey, title, img, dims, postLimit, altLimit, hookNote) => `
    <div class="card social-card">
      <div class="sugg-head"><b>${title}</b><span class="sugg-why">${dims} · image under 5MB</span></div>
      <img class="social-img" src="/files/${p.slug}/social/${img}?${ts}" alt="">
      <label class="field"><b>Post text ${socialCounter(s[key], postLimit, hookNote)}</b>
        <textarea data-social="${key}" rows="7">${esc(s[key])}</textarea></label>
      <label class="field"><b>Alt text ${socialCounter(s[altKey], altLimit)}</b>
        <textarea data-social="${altKey}" rows="3">${esc(s[altKey])}</textarea></label>
      <div class="varia-actions">
        <button class="btn btn-sm" data-copy-social="${key}">Copy post</button>
        <button class="btn btn-sm" data-copy-social="${altKey}">Copy alt text</button>
        <a class="btn btn-sm" href="/files/${p.slug}/social/${img}" download="${img}">⤓ Image</a>
      </div>
    </div>`;
  return `
    <div class="sugg-grid">
      ${platform('xPost', 'xAlt', '𝕏 (Twitter)', 'x-1200x675.jpg', '1200×675, 16:9', s.limits.X_POST_LIMIT, s.limits.X_ALT_LIMIT, '')}
      ${platform('liPost', 'liAlt', 'LinkedIn', 'linkedin-1200x627.jpg', '1200×627, 1.91:1', 3000, s.limits.LI_ALT_LIMIT, `· first ${s.limits.LI_HOOK_VISIBLE} show before "see more"`)}
      <div class="card social-card">
        <div class="sugg-head"><b>Portrait card · X + LinkedIn${(s.pChoice || 'card') === 'card' ? ' · ★ in use' : ''}</b><span class="sugg-why">1080×1350, 4:5 · instant, composed locally</span></div>
        <img class="social-img portrait" src="/files/${p.slug}/social/portrait-1080x1350.jpg?${ts}" alt="">
        <label class="field"><b>Alt text ${socialCounter(s.pAlt || '', s.limits.LI_ALT_LIMIT)}</b>
          <textarea data-social="pAlt" rows="3">${esc(s.pAlt || '')}</textarea></label>
        <div class="varia-actions">
          <button class="btn btn-sm" data-copy-social="pAlt">Copy alt text</button>
          <a class="btn btn-sm" href="/files/${p.slug}/social/portrait-1080x1350.jpg" download="portrait-1080x1350.jpg">⤓ Image</a>
          ${s.aiPrompts ? `<button class="btn btn-sm win-btn ${(s.pChoice || 'card') === 'card' ? 'active' : ''}" data-pchoice="card">${(s.pChoice || 'card') === 'card' ? '★ in use' : 'Use this'}</button>` : ''}
          <span class="hint">Use the X or LinkedIn post text with this image.</span>
        </div>
      </div>
    </div>
    ${renderAiPortraits(p, s, ts)}
    <div class="form-actions">
      <button class="btn" id="socialSaveBtn">Save texts</button>
      <button class="btn btn-sm" id="socialGenBtn">Refresh images</button>
      <button class="btn btn-sm btn-ghost" id="socialRewriteBtn">Rewrite texts from scratch</button>
      <span class="hint">Replace [link] with the video URL when posting. Made from ${esc(s.winner)}.</span>
    </div>`;
}

// Clipboard with a fallback: the async API rejects when the page is not
// focused, so fall back to a hidden textarea + execCommand.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

// Copy-ready command with the real project slug already filled in. Pass a
// label when the command is a long absolute path: the chip stays short, the
// clipboard and the tooltip still carry the whole thing.
const cmdChip = (cmd, label, cls = '') =>
  `<button class="cmd-chip ${cls}" data-cmd="${esc(cmd)}" title="${esc(cmd)}"><code>${esc(label || cmd)}</code><span>⧉</span></button>`;

const AI_TAKE_NAMES = ['Re-stack', 'Close-up', 'Continuation'];

function renderAiPortraits(p, s, ts) {
  const head = `
    <div class="section-head" style="margin-top:26px"><h2>AI portrait × 3</h2>
      <span class="hint">The winner recreated by ChatGPT as a TRUE full-bleed portrait, three takes. Or tell Claude: ${cmdChip(`generate the AI portraits for ${p.slug}`)}</span></div>`;
  if (!s.aiPrompts) {
    return `${head}
    <div class="card"><div class="form-actions" style="margin-top:0">
      <button class="btn btn-accent" id="portraitPackBtn">Build the 3 portrait prompts</button>
      <span class="hint">Writes pack/portrait-1..3.md + PORTRAIT_INSTRUCTIONS.md for any runner.</span>
    </div></div>`;
  }
  const files = s.files || [];
  const slots = [1, 2, 3].map((n) => {
    const finalized = files.find((f) => f === `portrait-ai-${n}-1080x1350.jpg`);
    const chosen = s.pChoice === `ai-${n}`;
    return `
    <div class="card social-card">
      <div class="sugg-head"><b>Take ${n} · ${AI_TAKE_NAMES[n - 1]}${chosen ? ' · ★ in use' : ''}</b><span class="sugg-why">${esc(s.aiPrompts[n - 1]?.take || '')} → 1080×1350 after trim</span></div>
      ${finalized
        ? `<img class="social-img portrait" src="/files/${p.slug}/social/${finalized}?${ts}" alt="">`
        : `<div class="varia-out pslot" data-pslot="${n}" role="button" tabindex="0" aria-label="Add portrait ${n} image" title="Add the generated portrait">Drop / click to add<br>portrait-ai-${n}.png</div>`}
      <div class="varia-actions">
        <button class="btn btn-sm" data-copy-pprompt="${n}">Copy prompt</button>
        ${finalized ? `<a class="btn btn-sm" href="/files/${p.slug}/social/${finalized}" download="${finalized}">⤓ Image</a>` : ''}
        ${finalized ? `<button class="btn btn-sm win-btn ${chosen ? 'active' : ''}" data-pchoice="ai-${n}">${chosen ? '★ in use' : 'Use this'}</button>` : ''}
        ${finalized ? `<button class="btn btn-sm btn-ghost btn-danger" data-pdel="${n}">Remove</button>` : ''}
      </div>
    </div>`;
  });
  return `${head}<div class="sugg-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${slots.join('')}</div><input type="file" id="pslotFile" accept="image/*" hidden>`;
}

async function loadSocial(p, force) {
  const wrap = $('#socialWrap');
  if (!wrap) return;
  let s = force ? null : await api.get(`/api/projects/${p.slug}/social`);
  // Stale when the winner changed OR when a different image now ships, which
  // is what happens the moment a final-round option is picked.
  const ships = p.finalChoice ? `final/${p.finalChoice}` : `output/${p.winner}`;
  if (s && s.winner && s.winner !== p.winner) s = null;
  if (s && s.builtFrom && s.builtFrom !== ships) s = null;
  // An error response is an object too, and it would render as a broken pack.
  if (s && s.error) s = null;
  wrap.innerHTML = renderSocialInner(p, s);
  $('#socialGenBtn')?.addEventListener('click', async () => {
    toast('Building social pack…');
    const r = await api.send('POST', `/api/projects/${p.slug}/social`);
    if (r.error) return toast(r.error);
    toast('Social pack ready');
    loadSocial(p);
  });
  loadSocialBindings(p, s);

  // While AI portrait slots are still empty (an agent may be generating),
  // watch for arriving files and refresh the section automatically.
  const aiCount = (x) => (x?.files || []).filter((f) => /^portrait-ai-\d-1080x1350\.jpg$/.test(f)).length;
  clearTimeout(window._socialPoll);
  if (s?.aiPrompts && aiCount(s) < 3) {
    const watch = (lastCount) => {
      window._socialPoll = setTimeout(async () => {
        if (currentSlug() !== p.slug) return;
        const fresh = await api.get(`/api/projects/${p.slug}/social`);
        const count = aiCount(fresh);
        if (count !== lastCount) {
          toast('New AI portrait arrived');
          loadSocial(p);
        } else if (count < 3) {
          watch(count);
        }
      }, 15000);
    };
    watch(aiCount(s));
  }
}

function loadSocialBindings(p, s) {
  $('#portraitPackBtn')?.addEventListener('click', async () => {
    toast('Writing the 3 portrait prompts…');
    const r = await api.send('POST', `/api/projects/${p.slug}/portrait-pack`);
    if (r.error) return toast(r.error);
    toast('Portrait pack ready, prompts in pack/portrait-1..3.md');
    loadSocial(p);
  });
  document.querySelectorAll('[data-copy-pprompt]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const n = Number(btn.dataset.copyPprompt);
      await navigator.clipboard.writeText(s?.aiPrompts?.[n - 1]?.prompt || '');
      toast(`Portrait prompt ${n} copied, paste into ChatGPT with the winner attached`);
    })
  );
  document.querySelectorAll('[data-pchoice]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const r = await api.send('PATCH', `/api/projects/${p.slug}/social`, { pChoice: btn.dataset.pchoice });
      if (r.error) return toast(r.error);
      toast('Portrait choice saved ★');
      loadSocial(p);
    })
  );
  document.querySelectorAll('[data-pslot]').forEach((slot) =>
    slot.addEventListener('click', () => {
      const input = $('#pslotFile');
      input.onchange = async () => {
        if (!input.files.length) return;
        await api.upload(`/api/projects/${p.slug}/upload/social?name=portrait-ai-${slot.dataset.pslot}`, [...input.files]);
        toast('Portrait added, finalizing to 1080×1350…');
        loadSocial(p);
      };
      input.click();
    })
  );
  document.querySelectorAll('[data-pdel]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const n = btn.dataset.pdel;
      for (const f of (s?.files || []).filter((x) => x.startsWith(`portrait-ai-${n}`))) {
        await api.del(`/api/projects/${p.slug}/file/social/${encodeURIComponent(f)}`);
      }
      toast('Removed');
      loadSocial(p);
    })
  );
  $('#socialSaveBtn')?.addEventListener('click', async () => {
    const body = {};
    for (const ta of document.querySelectorAll('[data-social]')) body[ta.dataset.social] = ta.value;
    const r = await api.send('PATCH', `/api/projects/${p.slug}/social`, body);
    toast(r.error ? r.error : 'Texts saved');
  });
  $('#socialRewriteBtn')?.addEventListener('click', async () => {
    if (!confirm('Throw away your edits and rewrite all the texts?')) return;
    const r = await api.send('POST', `/api/projects/${p.slug}/social?rewrite=1`);
    if (r.error) return toast(r.error);
    toast('Rewritten');
    loadSocial(p);
  });
  document.querySelectorAll('[data-copy-social]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const ta = document.querySelector(`[data-social="${btn.dataset.copySocial}"]`);
      await navigator.clipboard.writeText(ta.value);
      toast('Copied');
    })
  );
  document.querySelectorAll('[data-social]').forEach((ta) =>
    ta.addEventListener('input', () => {
      const label = ta.closest('label').querySelector('.cnt');
      if (!label) return;
      const limit = Number(label.textContent.split('/')[1]) || 280;
      const parts = label.textContent.split('/');
      label.textContent = `${ta.value.length}/${parts.slice(1).join('/')}`;
      label.classList.toggle('over', ta.value.length > limit);
    })
  );
}

function renderTestSection(p) {
  const rankHint = p.ranking?.length
    ? `Last Arena ranking: ${p.ranking.map((f) => f.replace(/^variation-(\d+).*/, '$1')).join(' › ')}`
    : 'No Arena run yet.';
  return `
  <div class="section" id="sec-test">
    <div class="section-head"><h2>Test &amp; choose</h2>
      <span class="hint">Stop guessing. Judge them the way viewers will actually see them.</span></div>
    <div class="card">
      <div class="form-actions" style="margin-top:0">
        <button class="btn" id="arenaBtn">⚔ Arena, pick like a viewer</button>
        <button class="btn" id="realityBtn">👁 Reality check, fake feed</button>
        <button class="btn" id="labBtn">🔬 Tiny-size lab</button>
        <span class="hint">${rankHint}</span>
      </div>
    </div>
  </div>`;
}

/* ---------- settings ---------- */

async function renderSettings() {
  setAccent(null);
  const s = await api.get('/api/settings');
  setMain(`
    <div class="page-kicker">Studio configuration</div>
    <h1>Settings</h1>
    <div class="section">
      <form class="card" id="settingsForm">
        <div class="form-grid">
          <label class="field full"><b>ChatGPT project name</b>
            <input type="text" name="chatgptProjectName" value="${esc(s.chatgptProjectName)}">
            <span class="hint">All thumbnail chats are kept inside this project on chatgpt.com. The agent creates it if it does not exist.</span>
          </label>
          <label class="field full"><b>ChatGPT project URL (for the Playwright runner)</b>
            <input type="text" name="chatgptProjectUrl" value="${esc(s.chatgptProjectUrl || '')}">
            <span class="hint">The runner opens this page to start each video's chat inside the project. Copy it from your browser's address bar while viewing the project.</span>
          </label>
          <label class="field"><b>Host photos attached per image</b>
            <select name="hostRefCount">
              <option value="1" ${s.hostRefCount === 1 ? 'selected' : ''}>1 (fastest)</option>
              <option value="2" ${s.hostRefCount === 2 ? 'selected' : ''}>2 (best likeness)</option>
            </select>
          </label>
          <label class="field"><b>Main host photo</b>
            <select name="hostRefPrimary">
              ${(state.meta?.hostPhotos || []).length
                ? (state.meta.hostPhotos).map((f) => `<option value="${esc(f)}" ${primaryHostPhoto() === f ? 'selected' : ''}>${esc(f)}</option>`).join('')
                : '<option value="">no photos in brand/host-photos/ yet</option>'}
            </select>
            <span class="hint">Attached first to every generation, so it decides how well the likeness holds. Your sharpest frontal headshot belongs here.</span>
          </label>
          <label class="field"><b>Learn from winners</b>
            <select name="useWinnerBias">
              <option value="true" ${s.useWinnerBias ? 'selected' : ''}>On (recommended)</option>
              <option value="false" ${!s.useWinnerBias ? 'selected' : ''}>Off</option>
            </select>
            <span class="hint">When on, new packs pair the layout and colorway that win most often.</span>
          </label>
          <label class="field"><b>Winners needed before learning kicks in</b>
            <input type="text" name="biasThreshold" value="${esc(String(s.biasThreshold))}">
          </label>
          <label class="field full"><b>YouTube channel URL</b>
            <input type="text" name="channelUrl" value="${esc(s.channelUrl)}">
            <span class="hint">Reality Check pulls this channel's real feed so you can see candidates in place.</span>
          </label>
          <label class="field"><b>Host name</b>
            <input type="text" name="hostName" value="${esc(s.hostName)}">
            <span class="hint">Who the thumbnails feature. Used in every prompt.</span>
          </label>
          <label class="field"><b>Show / channel name</b>
            <input type="text" name="showName" value="${esc(s.showName)}">
          </label>
          <label class="field"><b>Image generation</b>
            <select name="provider">
              <option value="browser" ${s.provider === 'browser' ? 'selected' : ''}>Browser agent (Claude/Codex extension)</option>
              <option value="playwright" ${s.provider === 'playwright' ? 'selected' : ''}>Playwright script (login once, zero cost)</option>
              <option value="openai" ${s.provider === 'openai' ? 'selected' : ''}>OpenAI API (needs key, costs credits)</option>
              <option value="custom" ${s.provider === 'custom' ? 'selected' : ''}>Custom command (advanced)</option>
            </select>
          </label>
          <div class="field">
            <label><b>OpenAI API key</b>
              <input type="password" name="openaiApiKey" value="" placeholder="${s.hasOpenaiApiKey ? 'a key is saved. Type a new one to replace it' : 'sk-… (only for the OpenAI provider)'}">
            </label>
            <span class="hint">${s.hasOpenaiApiKey
              ? 'Saved. The key is never sent back to this page, so leaving this blank keeps it.'
              : 'Stored in data/settings.json on this machine only, and never sent back to this page once saved.'}</span>
            ${s.hasOpenaiApiKey ? '<button type="button" class="btn btn-sm btn-danger" data-clearkey>Clear the saved key</button>' : ''}
          </div>
          <label class="field full"><b>Custom command</b>
            <input type="text" value="${s.hasCustomCommand ? '(set in data/settings.json)' : ''}" placeholder="off" disabled>
            <span class="hint">Runs a shell command once per variation, so it cannot be set from this page:
              a form that can set it would let anyone who reaches this port run commands on your machine.
              Put the template in <code>data/settings.json</code> and start with
              <code>THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND=1</code>. Currently
              <b>${s.customCommandAllowed ? 'enabled' : 'off'}</b>. {prompt} = path to a text file with the
              prompt, {refs} = image paths joined with ";", {out} = target PNG.</span>
          </label>
          <label class="field"><b>ChatGPT plan (for the limits reference)</b>
            <select name="chatgptPlan">
              ${['free', 'plus', 'pro', 'team'].map((k) => `<option value="${k}" ${s.chatgptPlan === k ? 'selected' : ''}>${k[0].toUpperCase()}${k.slice(1)}</option>`).join('')}
            </select>
          </label>
          <label class="field"><b>Monthly image budget (0 = off)</b>
            <input type="text" name="monthlyImageBudget" value="${esc(String(s.monthlyImageBudget || 0))}">
          </label>
          <label class="field"><b>Monthly token budget (0 = off)</b>
            <input type="text" name="monthlyTokenBudget" value="${esc(String(s.monthlyTokenBudget || 0))}">
          </label>
          <label class="field full"><b>Remove AI metadata from generated images</b>
            <span><input type="checkbox" name="stripAiMetadata" ${s.stripAiMetadata ? 'checked' : ''}>
              Strip Content Credentials on the way in</span>
            <span class="hint">Images made through ChatGPT arrive with a C2PA "Content Credentials"
              block of about 25 KB, which otherwise travels inside every ZIP you hand over. This removes
              that block and any generator tag, without re-encoding: the picture data is checked
              byte for byte and nothing is written if it changed. Your reference photos are never
              touched. It removes the embedded label, it does not make an image undetectable.
              For whole folders and other file types, use the
              <a href="https://github.com/jqaisystems/jqai-ai-skills" target="_blank" rel="noopener">remove-ai-image-metadata</a> skill.</span>
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-accent" type="submit">Save settings</button>
          <span class="hint">Fixed by the platform: max 10 images per ChatGPT message. Fixed by the brand: the 7 layouts and 7 colorways (edit docs\\BLUEPRINT.md + app\\lib\\blueprint.js to change them).</span>
        </div>
      </form>
    </div>
    <div class="section">
      <div class="section-head"><h2>How generation connects</h2>
        <span class="hint">The <b>Codex app is the main tool</b> for this system, best quality and best cost. The rest are fallbacks. The studio never asks for, stores, or types your ChatGPT password.</span></div>
      <div class="card">
        <div class="sugg-row"><span>1 · Best</span><b>Codex app, built-in image generation</b> · GPT Image 2 runs natively inside Codex: no browser at all, it writes files straight into the project, accepts up to 16 reference photos (vs 10 on the web) and renders at 2K. Hand it <code>pack\\CODEX_INSTRUCTIONS.md</code>. Only caveat: image turns burn Codex plan limits 3-5x faster than text.</div>
        <div class="sugg-row"><span>2 · Free</span><b>Playwright script</b> · log in ONCE by hand in a window the runner opens (no password ever stored, session in data/chatgpt-profile). Then generation is a deterministic script through your ChatGPT Pro plan: unlimited volume, zero Claude tokens, zero API cost. Breaks when ChatGPT redesigns its interface. Setup: <code>node scripts/chatgpt-runner.mjs login</code>.</div>
        <div class="sugg-row"><span>3 · Flexible</span><b>Browser agent</b> · Claude-in-Chrome or Codex-in-Chrome drives your logged-in chatgpt.com. Adapts to any UI change and can fix problems as it goes, but the AI piloting consumes Claude tokens (~20k per image, tracked on the Usage page).</div>
        <div class="sugg-row"><span>4 · Portable</span><b>OpenAI API key</b> · headless on any machine, exact cost reporting, pay per image (~$0.15-0.25). Best choice when sharing this system with someone else.</div>
        <div class="sugg-row"><span>5 · Anything</span><b>Custom command</b> · wire a local generator (hermes, Stable Diffusion, ComfyUI) with zero cloud dependency. Manual copy-paste always works too.</div>
        <div class="sugg-row"><span>⚠ Never</span>Email + password automation. Stored passwords leak, OpenAI's bot detection blocks scripted logins, and 2FA breaks it. Options 1 and 2 exist precisely so nobody needs this.</div>
      </div>
    </div>`);

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const res = await api.send('POST', '/api/settings', {
      chatgptProjectName: d.chatgptProjectName,
      hostRefCount: Number(d.hostRefCount),
      hostRefPrimary: d.hostRefPrimary,
      useWinnerBias: d.useWinnerBias === 'true',
      biasThreshold: Number(d.biasThreshold),
      channelUrl: d.channelUrl,
      chatgptProjectUrl: d.chatgptProjectUrl,
      hostName: d.hostName,
      showName: d.showName,
      provider: d.provider,
      // Blank means "keep the stored key": the server never sends it back, so
      // posting an empty string on every save would wipe it. customCommand is
      // not here on purpose, see the hint under the field.
      openaiApiKey: d.openaiApiKey,
      chatgptPlan: d.chatgptPlan,
      monthlyImageBudget: Number(d.monthlyImageBudget),
      monthlyTokenBudget: Number(d.monthlyTokenBudget),
      // An unchecked box is absent from FormData entirely, so test presence.
      stripAiMetadata: d.stripAiMetadata === 'on',
    });
    if (res.error) return toast(res.error);
    state.settings = res;
    paintBrand(); // host and show name live in the sidebar, so it has to follow
    toast('Settings saved');
    renderSettings(); // repaint, so the key field flips to "a key is saved"
  });

  $('#settingsForm').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-clearkey]')) return;
    const res = await api.send('POST', '/api/settings', { clearOpenaiApiKey: true });
    if (res.error) return toast(res.error);
    state.settings = res;
    toast('Saved key cleared');
    renderSettings();
  });
}

/* ---------- roadmap ---------- */

async function renderRoadmap() {
  setAccent(null);
  const data = await api.get('/api/roadmap');
  const items = data.items || [];
  const byStatus = (s) => items.filter((i) => i.status === s);
  const card = (i) => `
    <article class="card sugg">
      <div class="sugg-head"><b>${esc(i.title)}</b><span class="sugg-why">${esc(i.category)} · proposed ${esc(i.proposedAt)}</span></div>
      <div class="sugg-row"><span>What</span>${esc(i.detail)}</div>
      <div class="varia-actions">
        ${i.status === 'proposed' ? `
          <button class="btn btn-sm btn-accent" data-rm-status="accepted" data-rm-id="${esc(i.id)}">Accept</button>
          <button class="btn btn-sm" data-rm-status="declined" data-rm-id="${esc(i.id)}">Decline</button>` : ''}
        ${i.status === 'accepted' ? `
          <span class="hint">Accepted. Tell Claude: "implement the accepted roadmap items".</span>
          <button class="btn btn-sm" data-rm-status="proposed" data-rm-id="${esc(i.id)}">Undo</button>` : ''}
        ${i.status === 'declined' ? `<button class="btn btn-sm" data-rm-status="proposed" data-rm-id="${esc(i.id)}">Reconsider</button>` : ''}
      </div>
    </article>`;
  const section = (title, hint, list) => list.length ? `
    <div class="section">
      <div class="section-head"><h2>${title}</h2><span class="hint">${hint}</span></div>
      <div class="sugg-grid">${list.map(card).join('')}</div>
    </div>` : '';
  setMain(`
    <div class="page-kicker">New proposals arrive on the 1st of every month · you decide what gets built</div>
    <h1>Roadmap</h1>
    ${section('Proposed', 'Fresh ideas waiting for a yes or no.', byStatus('proposed'))}
    ${section('Accepted', 'Queued for the next build session.', byStatus('accepted'))}
    ${section('Done', 'Already part of the studio.', byStatus('done'))}
    ${section('Declined', 'Passed on, can be reconsidered anytime.', byStatus('declined'))}
    ${items.length ? '' : '<div class="section"><div class="card" style="color:var(--muted)">No proposals yet. Ask Claude: "propose improvements".</div></div>'}`);

  $('#main').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-rm-id]');
    if (!btn) return;
    await api.send('POST', `/api/roadmap/${btn.dataset.rmId}/status`, { status: btn.dataset.rmStatus });
    toast(btn.dataset.rmStatus === 'accepted' ? 'Accepted ✓' : 'Updated');
    renderRoadmap();
  });
}

/* ---------- usage ---------- */

const LIMITS_REF = [
  ['Codex app', 'gpt-image-2 (native)', 'image turns burn plan limits 3-5x faster than text; 250 images/min ceiling', 'best quality, watch your Codex quota'],
  ['ChatGPT Free', 'gpt-image (web)', 'about 2-3 images per day', 'not viable for full packs'],
  ['ChatGPT Plus', 'gpt-image (web)', 'about 50 image prompts per 3h (~200/day)', 'one full pack (7+3 images) fits easily'],
  ['ChatGPT Pro', 'gpt-image (web)', 'unlimited, fair-use guardrails', 'never a practical limit for this studio'],
  ['Claude (piloting)', 'browser-agent runs', 'plan limits per 5h session and week', 'Playwright/API/manual runs cost ZERO Claude tokens'],
  ['OpenAI API', 'gpt-image-1', 'pay per token: ~$10/M input + $40/M output (~$0.15-0.25 per image)', 'no daily cap, watch spend instead'],
  ['Claude Code', 'claude (weekly refreshes)', 'plan usage limits apply per 5h session and week', 'suggestion/roadmap refreshes are small'],
];

async function renderUsage() {
  setAccent(null);
  const [data, s] = await Promise.all([api.get('/api/usage'), api.get('/api/settings')]);
  const months = Object.keys(data.months || {}).sort().reverse();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const cur = data.months?.[thisMonth] || {};
  const rows = Object.values(cur);
  const totImages = rows.reduce((a, r) => a + r.images, 0);
  const totTokens = rows.reduce((a, r) => a + r.tokensReal + r.tokensEst, 0);
  const totCost = rows.reduce((a, r) => a + r.cost, 0);

  const bar = (used, budget) => {
    if (!budget) return '<span class="hint">no budget set</span>';
    const pct = Math.min(100, Math.round((used / budget) * 100));
    return `<div class="bar"><div class="bar-fill ${pct >= 80 ? 'warn' : ''}" style="width:${pct}%"></div></div>
      <span class="hint">${used.toLocaleString()} / ${budget.toLocaleString()} (${pct}%)</span>`;
  };

  setMain(`
    <div class="page-kicker">${esc(thisMonth)} · your plan: ChatGPT ${esc(s.chatgptPlan)}</div>
    <h1>Usage</h1>
    <div class="section">
      <div class="section-head"><h2>This month</h2>
        <span class="hint">API numbers are exact (reported by OpenAI). ChatGPT-web numbers are estimates, the web UI has no token meter.</span></div>
      <div class="card">
        ${rows.length ? rows.map((r) => `
          <div class="sugg-row"><span>${esc(r.model)}</span>
            ${r.images} image${r.images === 1 ? '' : 's'} ·
            ${r.tokensReal ? `${r.tokensReal.toLocaleString()} tokens (exact)` : ''}
            ${r.tokensReal && r.tokensEst ? ' + ' : ''}
            ${r.tokensEst ? `~${r.tokensEst.toLocaleString()} tokens (est.)` : ''}
            ${r.cost ? ` · $${r.cost.toFixed(2)}` : ''}
          </div>`).join('') : '<div class="sugg-row" style="color:var(--muted)">Nothing recorded yet this month.</div>'}
        <div class="sugg-row"><span>Total</span>${totImages} images · ~${totTokens.toLocaleString()} tokens${totCost ? ` · $${totCost.toFixed(2)} API spend` : ''}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Budgets</h2><span class="hint">Optional caps you set in Settings; amber from 80%.</span></div>
      <div class="sugg-grid">
        <div class="card"><b>Images / month</b>${bar(totImages, s.monthlyImageBudget)}</div>
        <div class="card"><b>Tokens / month</b>${bar(totTokens, s.monthlyTokenBudget)}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Limits reference</h2><span class="hint">So you never hit a wall mid-pack. Verify on the providers' pricing pages, these change.</span></div>
      <div class="card">
        ${LIMITS_REF.map(([plan, model, limit, note]) => `
          <div class="sugg-row ${plan.toLowerCase().includes(s.chatgptPlan) ? 'limit-mine' : ''}"><span>${esc(plan)}</span><b>${esc(model)}</b> · ${esc(limit)} · <i style="color:var(--muted)">${esc(note)}</i></div>`).join('')}
      </div>
    </div>
    ${months.length > 1 ? `
    <div class="section">
      <div class="section-head"><h2>History</h2></div>
      <div class="card">
        ${months.slice(0, 6).map((mo) => {
          const rs = Object.values(data.months[mo]);
          return `<div class="sugg-row"><span>${esc(mo)}</span>${rs.reduce((a, r) => a + r.images, 0)} images · ~${rs.reduce((a, r) => a + r.tokensReal + r.tokensEst, 0).toLocaleString()} tokens</div>`;
        }).join('')}
      </div>
    </div>` : ''}`);
}

/* ---------- how it works ---------- */

function renderHow() {
  setAccent(null);
  const steps = [
    ['Open the studio', 'Windows: double-click <b>START.bat</b>. Mac: double-click <b>START.command</b>. The studio opens in your browser. If you are reading this, it is already open.'],
    ['Start a video', 'Click the red <b>+ New video</b> button and type the video\'s title. The "hook" is the one big claim of the video, like "$10M with zero employees". Shortcut: open <b>Guests &amp; ideas</b> and press <b>Start project</b> on any card, it fills everything in for you. No title yet? Pick <b>Start from a concept</b>: type only the hook, generate, and once the winner is picked the <b>Title</b> section suggests real titles built to support that exact thumbnail.'],
    ['Photos add themselves', 'The host photo is attached automatically. For interviews, the studio searches the web for the guest\'s photo by name the moment you create the project, no uploading needed. You can still add your own guest photos, logos and backgrounds, and the ✂ button removes any photo\'s background.'],
    ['Press "Build the 7 prompts"', 'The studio writes 7 different image instructions: 7 layouts, 7 colors, so you always have real options to choose from. The <b>mood pills</b> in the Brief set the facial expression for the host and the guest, smiley by default; change the mood and rebuild the prompts to apply it.'],
    ['Make the pictures', 'Best: open the <b>Codex app</b> and give it the project\'s <b>CODEX_INSTRUCTIONS.md</b> (copy button on the project page). Codex generates the images itself and writes them straight into the project. Alternatives: the <b>Playwright script</b> (free and unlimited on ChatGPT Pro), a <b>browser agent</b> ("generate thumbnails for [video]"), the <b>OpenAI API</b>, or plain copy-paste. All are compared under Settings → How generation connects.'],
    ['Test, pick, export', 'Use <b>Test &amp; choose</b>: the <b>Arena</b> makes picking fun (click the better of two, six times), <b>Reality check</b> shows your candidate inside your REAL YouTube channel feed, and the <b>Tiny-size lab</b> warns about images that die at small size. Star the winner, press <b>Export winner</b>, upload to YouTube.'],
    ['Share it', 'Once a winner exists, the <b>Social pack</b> section builds the X version (1200×675), the LinkedIn version (1200×627), and a portrait (1080×1350, the format that takes the most space in mobile feeds on both platforms). The portrait comes two ways: an instant designed card, or <b>AI portrait × 3</b> where ChatGPT recreates the thumbnail as a true vertical image in three takes and you pick one. Plus post text in the host\'s voice and alt text for everything. Edit, copy, replace [link] with the video URL, post.'],
  ];
  const words = [
    ['Prompt', 'The written instructions ChatGPT uses to draw one picture.'],
    ['Reference', 'A photo you give ChatGPT so it knows what someone or something looks like.'],
    ['Layout', 'How a thumbnail is arranged: big text, a prop, two people, a giant number...'],
    ['Colorway', 'The one accent color of a thumbnail. Seven exist so videos never look repeated.'],
    ['Pack', 'The folder with everything an assistant needs to make all 7 pictures on its own.'],
    ['Winner', 'The one thumbnail you choose to actually use on YouTube.'],
  ];
  setMain(`
    <div class="page-kicker">The whole flow in 6 steps</div>
    <h1>How it works</h1>
    <div class="section">
      <div class="how-steps">
        ${steps.map(([t, d], i) => `
          <div class="card how-step">
            <span class="how-num">${i + 1}</span>
            <div><b>${t}</b><p>${d}</p></div>
          </div>`).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Two ways to run it</h2>
        <span class="hint">You never have to make everything. Pick the run that fits the video.</span></div>
      <div class="card">
        <div class="sugg-row"><span>Full workflow</span>Tell Claude <b>"run the full workflow for [video]"</b>: 7 thumbnails, winner support, YouTube export, X + LinkedIn images and texts, and the 3 AI portraits. Use when the video gets promoted on socials.</div>
        <div class="sugg-row"><span>Thumbnails only</span>Tell Claude <b>"generate thumbnails for [video]"</b>: just the 7 thumbnails. No social images, no posts. The Social pack stays one click away if you change your mind later.</div>
        <div class="sugg-row"><span>Guest rule</span>On interview episodes the guest appears in at least 5 of the 7 thumbnails (two stay host-only on purpose, for variety).</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Words you will see</h2></div>
      <div class="card">
        ${words.map(([w, d]) => `<div class="sugg-row"><span>${w}</span>${d}</div>`).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>If something looks wrong</h2></div>
      <div class="card">
        <div class="sugg-row"><span>Face is off</span>Reply in the same ChatGPT chat: "Same image, but make the face match the reference photo exactly."</div>
        <div class="sugg-row"><span>Text misspelled</span>Reply: "Same image, but spell the text exactly: [the text]." One retry is usually enough.</div>
        <div class="sugg-row"><span>Nothing happens</span>Close the black window and double-click START.bat (Mac: START.command) again.</div>
        <div class="sugg-row"><span>No guest photo found</span>Press "Find guest photos online" again with a more specific name, or add one with + Guest photo.</div>
        <div class="sugg-row"><span>One bad image</span>Press <b>↻ Regenerate</b> on that card: the prompt is copied (or re-run via API automatically) and only that slot refills.</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>The Playwright runner, explained</h2>
        <span class="hint">The zero-cost automation, and how to use it without tripping ChatGPT's limits.</span></div>
      <div class="card">
        <div class="sugg-row"><span>Setup once</span>Run <b>node scripts\\chatgpt-runner.mjs login</b>, log in to ChatGPT in the window that opens, close it. Your session is saved locally (never a password), delete the data\\chatgpt-profile folder anytime to log out.</div>
        <div class="sugg-row"><span>Then</span><b>node scripts\\chatgpt-runner.mjs run [project]</b> generates every missing thumbnail by itself: one chat per video, kept inside your ChatGPT project. Rerunning never redoes finished images.</div>
        <div class="sugg-row"><span>Pacing</span>ChatGPT limits burst SPEED, not volume. The runner deliberately waits 45-75 seconds between images (a full pack takes ~15 relaxed minutes) and pauses itself for 10 minutes if ChatGPT ever says "Too many requests". Don't launch it repeatedly in quick succession.</div>
        <div class="sugg-row"><span>If limited</span>Nothing is lost, chats stay safe on OpenAI's servers. Wait a few minutes (heavier limits clear within 1-3 hours) and rerun; it resumes exactly where it stopped.</div>
        <div class="sugg-row"><span>If it breaks</span>ChatGPT redesigns can break the script. Fall back to the browser agent or manual copy-paste until it's updated, all runners share the same prompts.</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Your images travel clean</h2>
        <span class="hint">Something the studio does quietly, that you should know about.</span></div>
      <div class="card">
        <div class="sugg-row"><span>The problem</span>Pictures made through ChatGPT arrive with a hidden <b>"Content Credentials"</b> tag baked in, about 25 KB per image. It rides along into anything you hand over.</div>
        <div class="sugg-row"><span>What happens</span>The studio removes that tag the moment an image arrives, and checks again before building a download ZIP. The picture itself is never re-saved or re-compressed: it is compared byte by byte, and if anything about the image changed, nothing is written.</div>
        <div class="sugg-row"><span>Your control</span>It is on by default. Turn it off in <b>Settings</b> if you would rather keep the tag. Your reference photos are never touched.</div>
        <div class="sugg-row"><span>Honest limit</span>This removes the embedded label. It does not make an image undetectable, and nobody should claim otherwise.</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Skills that pair with this</h2>
        <span class="hint">Optional add-ons for Claude Code and Codex, free and open source at
          <a href="https://github.com/jqaisystems/jqai-ai-skills" target="_blank" rel="noopener">jqaisystems/jqai-ai-skills</a>.</span></div>
      <div class="card">
        <div class="sugg-row"><span>Pacing</span><b>ai-image-run-pacing</b> · the rules that keep a 7-image run from getting rate limited, and why a password is never stored.</div>
        <div class="sugg-row"><span>Design</span><b>thumbnail-set-designer</b> · the layout and colour rotation method, for adapting this system to another channel.</div>
        <div class="sugg-row"><span>Testing</span><b>thumbnail-legibility-check</b> · the Tiny-size Lab as a standalone tool you can point at any folder of images.</div>
        <div class="sugg-row"><span>Metadata</span><b>remove-ai-image-metadata</b> · the full version of what is built in above: more file types, whole folders at once.</div>
        <div class="sugg-row"><span>Sharing</span><b>local-app-public-demo</b> · how the read-only web demo of this studio is built and checked before going public.</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>The studio keeps improving</h2></div>
      <div class="card">
        <div class="sugg-row"><span>Weekly</span>New guest and topic suggestions arrive every Monday.</div>
        <div class="sugg-row"><span>Monthly</span>The <b>Roadmap</b> page gets fresh improvement proposals on the 1st. Accept the ones you want, decline the rest; nothing is built without a yes.</div>
        <div class="sugg-row"><span>Learning</span>Every winner you pick teaches the studio which layouts and colors work; new prompt packs lean toward proven combinations.</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><h2>Other ways to use this</h2>
        <span class="hint">The studio is a template. Everything channel-specific is a setting or a photo folder (see docs/ADAPTING.md).</span></div>
      <div class="card">
        <div class="sugg-row"><span>Any channel</span>Swap the host photos, blueprint colors and channel URL, and it works for any YouTuber.</div>
        <div class="sugg-row"><span>Podcasts</span>Square episode covers: change the format line in the prompts to 1:1.</div>
        <div class="sugg-row"><span>Shorts / Reels / TikTok</span>Vertical covers with the same brand system (a one-click vertical variant is on the Roadmap).</div>
        <div class="sugg-row"><span>Courses &amp; products</span>Lesson cards, Etsy or Gumroad listing images: same 7-options workflow, different prompt rules.</div>
        <div class="sugg-row"><span>Teams</span>Because everything is files on disk, a shared drive or git repo makes it collaborative.</div>
      </div>
    </div>
    <div class="section">
      <div class="card credit-card">
        Built by <b>João Queirós</b> in Porto, Portugal ·
        <a href="mailto:joaojbq@ai.joaoqueiros.com">joaojbq@ai.joaoqueiros.com</a> · © 2026<br>
        <a href="https://www.ai.joaoqueiros.com" target="_blank" rel="noopener">www.ai.joaoqueiros.com</a>
      </div>
    </div>`);
}

/* ---------- channel grid page ---------- */

async function renderGrid() {
  setAccent(null);
  const stats = await api.get('/api/analytics');
  const list = (obj) =>
    Object.values(obj).sort((a, b) => b.wins - a.wins)
      .map((x) => `<div class="sugg-row"><span>${x.wins} win${x.wins > 1 ? 's' : ''}</span>${esc(x.name)}</div>`)
      .join('') || '<div class="sugg-row" style="color:var(--muted)">no winners yet</div>';
  setMain(`
    <div class="page-kicker">All videos</div>
    <h1>Channel grid preview</h1>
    ${renderMiniGrid(null)}
    <div class="section">
      <div class="section-head"><h2>Winner analytics</h2>
        <span class="hint">${stats.total} winner${stats.total === 1 ? '' : 's'} picked so far. ${stats.biasActive
          ? `Bias ACTIVE: new packs pair ${esc(stats.topArchetype.name)} with ${esc(stats.topColorway.name)}.`
          : 'From 5 winners on, new packs pair the top archetype with the top colorway.'}</span></div>
      <div class="sugg-grid">
        <div class="card"><b>Layouts</b>${list(stats.archetypes)}</div>
        <div class="card"><b>Colorways</b>${list(stats.colorways)}</div>
        <div class="card"><b>Expressions</b>${list(stats.moods || {})}</div>
      </div>
    </div>`);
}

/* ---------- boot ---------- */

$('#newProjectBtn').addEventListener('click', () => {
  location.hash = '#/';
  setTimeout(() => $('#new')?.scrollIntoView({ behavior: 'smooth' }), 50);
});
window.addEventListener('hashchange', route);

function mountDemoBanner() {
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  // The second sentence is the approved attribution, word for word. Three things
  // it has to do at once: say Andrew consented to his own image, say the guests
  // in these episode thumbnails did not without implying they did, and not
  // suggest this was commissioned, because it was not. "Made for his channel"
  // read as client work and was corrected 2026-08-10. It is the same text as the
  // product page and the case study. Do not paraphrase it.
  bar.innerHTML =
    '<b>Read-only demo</b> · Thumbnail Studio, built by João Queirós. ' +
    'Browse everything, compare, and rank. Generating and saving are turned off here. ' +
    'Andrew Warner appears with his permission. Thumbnail Studio was not commissioned ' +
    'by him: the thumbnails are demonstration artwork based on episodes of his channel, ' +
    '<a href="https://www.youtube.com/@TheNextNewThingAI" target="_blank" rel="noopener">The Next New Thing</a>, ' +
    'and feature those episodes’ guests. No affiliation or endorsement is implied.';
  document.body.appendChild(bar);
  document.body.classList.add('is-demo');
}

(async function boot() {
  if (DEMO) mountDemoBanner();
  [state.meta, state.settings] = await Promise.all([api.get('/api/meta'), api.get('/api/settings')]);
  paintBrand();
  await route();
})();
