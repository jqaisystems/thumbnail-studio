# RUNBOOK - Thumbnail Studio

How to go from a video brief to seven thumbnail options. The workspace runs locally; generation uses your selected provider and account.

## 0. Start the studio

Double-click `START.bat` in the root folder (or run `node server.js` inside
`app\`). It opens **http://localhost:4626**.
New to the system? Read `docs\TUTORIAL.md` or the app's **How it works** page.

## 1. Create the project

Two ways to start:

- **From a suggestion**: open **Guest & idea suggestions** in the sidebar,
  pick a guest or solo idea, press **Start project** (or **Start
  thumbnail-first**). Title, hook, notes and guest name are prefilled.
  Suggestions refresh every Monday at 09:03 via a Windows scheduled task
  ("Suggestions Refresh"); you can also ask Claude "refresh the
  suggestions" anytime.
- **From scratch**: **+ New video** → title, episode type, hook, notes.
- **Thumbnail-first** (how many creators actually work): pick **Start from a
  concept** on the New video form. Only the hook (the concept: one bold claim
  or number) is required; the studio derives a provisional working title from
  it, marked with a "working title" badge everywhere. Generate and pick the
  winner as usual, then let the **Title** section suggest real titles that
  support the winning thumbnail (step 3).

Then:

1. Add references (all optional, the main host photo is automatic):
   - **+ Guest photo**, **+ Host extra**, **+ Logo**, **+ Background / prop**
     buttons, or drop images on the dropzone (saved as guest).
   - No guest photo? Leave it. The agent searches the web for the guest by
     name and adds 1-2 photos itself before generating.
   - Or describe what you want in **References to find online** and the agent
     will search, download and file them (guest-, logo-, bg- prefixes).
2. Set the **mood** pills if you want a specific expression, or pick
   **✨ Auto** to have the studio read the brief and vary the expression
   across the 7 (a money story leads amazed, a versus story leads intense).
3. Press **Build the 7 prompts**.
4. **Editing any of the 7.** The Seven shows the full path to the `pack\`
   folder, and the same 7 prompts live on the cards. Two levels of edit:
   - **The text on the image**, edited inline on the card. Use `/` for a line
     break. Everything else keeps regenerating from the brief, so this edit
     stays correct when you change the title or the hook later.
   - **The whole prompt**, in the collapsed **Prompt** panel. This freezes that
     one variation: it stops following the brief until you reset it, and the
     card says so.

   Press **Save prompt edits** and the 7 files are rewritten. Both kinds of
   edit survive every rebuild. **Reset** per card, or **Reset all edits**.
   Do NOT edit the `pack\variation-N.md` files by hand: they are outputs and
   any rebuild overwrites them without warning. The app is the editor.
5. Optional, after building: **Vary the faces across the 7** under The Seven,
   or hand `pack\MOOD_INSTRUCTIONS.md` to Codex or Claude to have expressions
   written for this specific video. Those override the mood pills and survive
   rebuilds; **Clear written expressions** returns to automatic.

The browser instruction pack caps its reference list at **10 images per variation**. Check the selected provider's current attachment limits before use.
The pack automatically caps each variation's attach list: 1-2 host photos,
1-2 guest photos, then logos and backgrounds until the cap.

This writes everything to `projects\<slug>\`:

```
projects\<slug>\
├── project.json               (the brief + the 7 generated variations)
├── refs\                      (host-ref-1.jpg, style-ref.jpg, guest-*.jpg)
├── pack\
│   ├── AGENT_INSTRUCTIONS.md  (agent-agnostic run script - the key file)
│   ├── MOOD_INSTRUCTIONS.md   (have an agent write the 7 expressions)
│   └── variation-1..7.md      (one ChatGPT-ready prompt each)
└── output\                    (drop/save generated images here)
```

<a id="2-generate-the-images---pick-any-runner"></a>

## 2. Generate the images

Choose a route supported by your account. All routes use the project's generated prompt and reference pack and require your own provider access. Usage limits remain those of the selected account.

### What leaves the workspace

When you generate externally, the selected provider receives the prompt and any references you attach or the runner submits. Guest-image search and channel-feed retrieval also make external requests. Local project files and credentials are not published by preparing a pack. Review what you attach before generation.

### Runner F: Codex app

Open the studio folder as the Codex workspace, then use the project's **In Codex** copy button. It points to:

```text
<studio-folder>/projects/<slug>/pack/CODEX_INSTRUCTIONS.md
```

Follow the pack's reference list and requested output names, including `output/variation-<n>.png`. Portraits have their own `CODEX_PORTRAIT_INSTRUCTIONS.md`. Available tools, reference limits and supported sizes depend on the account and generation tool. Inspect the saved files before import.

### Runner E: included Playwright script

Sign in manually once:

```bash
node scripts/chatgpt-runner.mjs login
```

The browser session stays in the gitignored `data/chatgpt-profile/` folder. The runner does not store or type your password. Keep that session folder private.

```bash
node scripts/chatgpt-runner.mjs run <slug>
node scripts/chatgpt-runner.mjs run <slug> --only 3
```

This route uses your signed-in ChatGPT access rather than an API key. Available generation capacity, limits and costs depend on your account. UI changes can break the runner. Use a supported alternative while it is being updated.

The runner defaults to a 45-75 second gap between requests and can pause when a limit is reported. These are local pacing settings, not provider guarantees. Stop on a limit and follow the provider's displayed guidance; avoid repeated retries or concurrent runs.

### Runner A: browser agent

Give a compatible browser agent the project's `pack/AGENT_INSTRUCTIONS.md`. Sign in manually before use. The image provider's limits and the browser agent's own account usage both apply. Review the references and outputs.

### Runner D: API provider

In **Settings → Image generation**, choose **OpenAI API** and add your own key. API access and billing are separate from a signed-in app or browser subscription. The key is stored in the gitignored `data/settings.json`; the settings page receives only a saved-key indicator. Use **Clear the saved key** to remove it.

### Custom command: explicit local opt-in

This route runs a shell command and cannot be enabled from the web settings page. Set the template by hand in `data/settings.json` and opt in through the environment, as documented by the application:

```json
"provider": "custom",
"customCommand": "hermes generate --prompt {prompt} --refs {refs} --out {out}"
```

`{prompt}` is a prompt-file path, `{refs}` is a semicolon-separated reference list, and `{out}` is the output PNG path. PowerShell:

```powershell
$env:THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND = "1"
node app/server.js
```

Only use a command you have inspected and configured for your own environment.

### Runner C: manual copy-paste

Use **Copy prompt** on a variation card. Attach the pack's listed references in your chosen provider, generate within its supported options, then save to `output/variation-<n>.png`. Keep the reference list and output filenames intact. Inspect all images before comparing or exporting them.

### Networking

The studio binds to `127.0.0.1` by default and has no login. Keep it on loopback. Generation, image search and channel-feed requests can still use external services; loopback binding describes who can reach the studio, not where a selected provider processes images.


## 3. Pick the winner and export

- The 7 fill in on the project page. Then use **Test & choose** (appears once
  2+ images exist):
  - **Arena**: 6 quick duels, two YouTube-style cards at a time, click the one
    you would tap. Saves the winner AND a full ranking.
  - **Reality check**: two feeds. "My real channel" pulls the channel's
    actual videos (Settings > YouTube channel URL, cached 12h) and places the
    selected candidate in the newest-video slot, with a candidate switcher.
    "Mixed decoys" hides all candidates among other videos. Both support size
    (desktop/search/sidebar), glance-blur, grayscale and light/dark controls.
  - **Tiny-size lab**: each candidate at its real 168px search size with
    measured brightness, contrast and color pop, plus warnings.
- The **Channel grid** section shows candidates next to previous videos' picks.
- **Pick as winner** stars it. The grid preview updates everywhere.
- **Title section** (appears with a winner): the packaging back-half. Every
  row is scored against the winning thumbnail and told what the score means:
  about 50% overlap is a good balance, above 70% the title just repeats the
  thumbnail, below 30% it may not connect to it.
  - **Now** is your current title, scored. This is often the useful shock: a
    title written from the same hook the thumbnail text came from usually
    scores 80%+, which means it adds nothing.
  - **Yours** is a free text field. Type your own and the score updates as you
    type. **Save** keeps it, **Use this title** adopts it.
  - Below that, generated candidates. These are deliberately few. They are
    mechanical reframings of the brief, and a title that supports a thumbnail
    has to add something the brief does not contain, so the real writing
    happens through the agent.
  - **Tick the ones you like**, press **Send picks**, and those titles plus
    your draft are written into `pack\TITLE_INSTRUCTIONS.md` as the taste to
    match. Hand that file to Codex or Claude and it writes five more in that
    register, then POSTs them back into the studio.
  - **Refresh suggestions** regenerates only the mechanical candidates. Your
    draft, your ticks and anything an agent wrote are kept.
  - **Use this title** adopts one and marks the title final (the project
    folder keeps its original slug). On thumbnail-first projects, do this
    before the social pack, or the posts and alt texts will carry the working
    title (the UI warns you).
- **Final round** (appears once the title is final): the last check nobody was
  doing. Your thumbnail text was written before the title existed, so the two
  drift apart. The section shows how much they share and offers to re-cut the
  winner: same layout, faces and expression, with the text derived from the
  adopted title by taking about half its words.
  It also carries a **colour picker**. The 7 weld layout to colour, so this is
  the only way to get the winning layout in a different accent, which is what
  you want when the winner clashes with the last videos in the channel grid.
  Pick a colour and one of the options keeps the winning text, so a pure
  recolour is a single click. Whatever ships is what the social pack then
  describes, in the card glow and in the alt text. Generate the
  4 options exactly like the seven (`pack\final-1..4.md`, or hand
  `pack\FINAL_INSTRUCTIONS.md` to Codex), drop them into the slots, and press
  **Ship this one**. That image then goes into the export, the social pack, the
  AI portraits and the ZIP, while the layout stats keep crediting the variation
  that won the Arena. **Keep the original** puts it back.
- **Export winner (1280x720 JPG)** in the Brief bar produces a YouTube-ready
  file (under 2MB) in `projects\<slug>\export\` and opens it for download.
- **Social pack** (appears with a winner): writes `projects\<slug>\social\`
  with `x-1200x675.jpg` (16:9), `linkedin-1200x627.jpg` (1.91:1 smart crop),
  and `portrait-1080x1350.jpg` (4:5 announcement card for X AND LinkedIn:
  title on top, the full untouched winner in the middle, hook + channel name
  below, glow in the winner's colorway; composed, never cropped, so the
  thumbnail text survives), all under 5MB, plus `social.json` holding editable post + alt texts.
  The portrait has a second option: **AI portrait x 3**. "Build the 3 portrait
  prompts" writes `pack\portrait-1..3.md` + `PORTRAIT_INSTRUCTIONS.md`; any
  runner (Claude, Codex, manual) has GPT Image RECREATE the winner as a
  full-bleed native portrait (1024x1536, faces/text in the central 83% safe
  area), three takes: Re-stack, Close-up, Continuation. Drop results into the
  slots (or save as social\portrait-ai-N.png); the studio auto-trims each to
  exactly 1080x1350. "Use this" picks card vs ai-1/2/3.
  composed in the host's voice (voice rules: docs\BLUEPRINT.md, engine:
  app\lib\socialcopy.js). Specs: X post 280 chars max, X alt 1000; LinkedIn
  alt 300, hook shows ~200 chars before "see more". Replace [link] with the
  video URL when posting.
- **Winner analytics** (bottom of the Channel grid page) counts which layout
  and colorway win over time. From 5 winners on, new packs automatically pair
  the top layout with the top colorway.
- Hover a guest or background ref and press the scissors (✂) to remove its
  background locally (no APIs; the first run downloads a model, ~1 minute).

## 4. AI metadata (automatic, but worth knowing)

Images downloaded from chatgpt.com carry a C2PA "Content Credentials" block,
roughly 25KB per file. Codex-generated images do not, and anything sharp
re-encodes (the export and the social JPGs) loses it anyway. So the ones that
matter are the raw PNGs from the browser and Playwright runners, plus the AI
portraits.

The studio strips that block automatically:

- when an image is uploaded into `output\` or `social\`,
- when the API provider generates one,
- and as a full sweep of the project right before **Export winner** or
  **Download everything (ZIP)**.

That last sweep is the important one. Codex writes files straight into
`output\` without ever talking to the server, so nothing else would catch them.

The picture data is never re-encoded. The cleaner compares a hash of the
encoded image before and after, and refuses to write if it moved by a single
byte. Reference photos in `refs\` are deliberately never touched, because
removing their EXIF can take orientation with it and rotate someone's photo.

Every project page shows a **Metadata** line under Download, telling you what
is still tagged, with a **Clean now** button. Settings has the on/off switch
(`Remove AI metadata from generated images`, on by default).

Honest limit: this removes the embedded label. It does not make an image
undetectable, and you should not tell anyone it does.

For whole folders, other file types, or field-level edits, use the
`remove-ai-image-metadata` skill from
https://github.com/jqaisystems/jqai-ai-skills

## Checking the studio still works

With the studio running:

```
node scripts\check.mjs
```

It builds a scratch project, runs the whole pipeline against the live server,
asserts about 30 invariants, deletes the scratch project and exits non-zero if
anything failed. Roughly ten seconds.

**Run it after touching `app\lib\blueprint.js` or `app\server.js`.** It covers
the failures that actually happened while building this: a fabricated `$1M`
when the brief had no number, a guest photo index that pointed at the host so
the host was drawn twice, an empty text spec, the string `null` rendered as a
giant number, a final-round pick that did not reach the export, and alt text
naming the winner's colour instead of the colour that shipped.

## Tips

- **One chat per video.** Reusing the same ChatGPT conversation for all 7
  variations keeps the host's likeness consistent.
- **Retry once, then move on.** "Same image, but fix: <problem>" fixes most
  spelling/likeness misses. Don't burn generations chasing perfection - that's
  what 7 variations are for.
- **Rate limits:** ChatGPT image generation may throttle after several images.
  The agent instructions tell the agent to stop cleanly and report which
  variations are done; just resume later.
- **Consistency knob:** the colorway rotation is seeded per project, so
  back-to-back videos automatically lead with different accents. The blueprint
  lives in `docs\BLUEPRINT.md`; the engine copy is `app\lib\blueprint.js`
  - change both together.
- **Extra props:** you can drop any image (e.g. from your stock drives) into
  References; mention it in Notes so the prompt engine picks a matching prop.
