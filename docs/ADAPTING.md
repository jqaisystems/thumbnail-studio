# Adapting Thumbnail Studio to your own channel

The studio ships tuned on one real channel, but everything brand-specific is
data rather than code. Here is the full checklist to make it yours.

## 1. Settings (5 minutes)

Open **Settings** in the app and change:

- **Host name**: who appears in the thumbnails. Used inside every prompt
  ("the host, <name>").
- **Show / channel name**: shown in the YouTube simulations.
- **YouTube channel URL**: your channel; Reality Check pulls its real feed.
- **ChatGPT project name**: where your generation chats are kept.

## 2. Photos (10 minutes)

- Put 3-5 photos of your host in `brand/host-photos/`: at least one sharp,
  frontal, well-lit headshot. Then pick which one leads in **Settings > main
  host photo**. Leave that alone and the first image in the folder is used, so
  dropping photos in is enough to get started.
- Replace `brand/inspiration/` with 3-5 thumbnails whose style you want.

## 3. The visual DNA (30-60 minutes, the fun part)

- `docs/BLUEPRINT.md` is the human-readable brand book: positioning, the
  thumbnail rules, 7 colorways, 7 layout archetypes.
- `app/lib/blueprint.js` is the machine copy the prompt engine uses:
  `COLORWAYS` (names, hexes, text rules) and `ARCHETYPES` (layout
  descriptions). Edit both together; they must match.
- Keep the constants that make thumbnails work: 3-6 words max, one idea per
  image, sticker-style text, high contrast, legible at 168px.

## 4. Generation

- **Default (no APIs)**: a browser agent (Claude in Chrome, Codex in Chrome)
  follows each project's `pack/AGENT_INSTRUCTIONS.md` against your logged-in
  chatgpt.com. Manual copy-paste always works too.
- **OpenAI API**: set provider to OpenAI in Settings and paste a key;
  the Generate via API button appears on projects.
- **Anything else**: provider "Custom command" runs your command per
  variation with `{prompt}` (path to a prompt text file), `{refs}`
  (image paths joined with ";"), `{out}` (target PNG). Works with hermes,
  ComfyUI/Stable Diffusion CLIs, any script.

## 5. Schedulers (optional)

Two recurring jobs exist on Windows (Task Scheduler): weekly suggestions
refresh (Mondays) and monthly roadmap proposals (1st of the month). Both are
thin wrappers that run `claude -p "<research prompt>"` headless; see
`scripts/`. On Mac, recreate them with launchd or cron, e.g.:

```
# crontab -e
3 9 * * 1  cd /path/to/studio && /usr/local/bin/claude -p "Refresh the suggestions..." --allowedTools "WebSearch,WebFetch,Read,Write,Edit"
7 9 1 * *  cd /path/to/studio && /usr/local/bin/claude -p "Propose improvements..." --allowedTools "Read,Write,Edit,Glob,Grep"
```

Or skip them and just ask your assistant "refresh the suggestions" /
"propose improvements" whenever you like.

## 6. Sharing

`.gitignore` already excludes personal data (settings, projects, caches).
`git init && git add . && git commit` gives you a clean repo; the MIT LICENSE
is included.
