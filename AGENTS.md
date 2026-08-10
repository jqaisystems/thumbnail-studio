# AGENTS.md

House rules for any AI agent working in this repository (Codex, Claude Code,
or anything else). Read this before changing code.

**Thumbnail Studio** turns a video title into 7 on-brand YouTube thumbnails,
then into social images and posts. Built by João Queirós. It is planned for
open-source release, so keep everything adaptable and never hardcode
brand-specific values where a setting already exists.

Start the app: `START.bat` (Windows) or `START.command` (Mac). It serves
http://localhost:4626 from `app/server.js`.

---

## Rules that break things if ignored

1. **`app/lib/blueprint.js` and `docs/BLUEPRINT.md` are one thing in two
   files.** The first is the prompt engine, the second is the human brand
   book. Change the colorways, layouts or rules in one and you MUST mirror
   the other, or generated prompts drift from the documented brand.

2. **Never store, type or automate ChatGPT credentials.** No passwords, no
   auto-login. The supported paths are: Codex native image generation, the
   Playwright runner (user logs in ONCE by hand into `data/chatgpt-profile`,
   which is gitignored), the OpenAI API, a custom command, or manual.

3. **Pace ChatGPT web requests: 45 to 75 seconds between messages.** OpenAI
   throttles burst SPEED, not volume. Faster loops trigger "Too many
   requests" and lock the user's account for up to hours. This applies to
   any browser-driving code or agent behaviour.

4. **Background removal must run in a child process**
   (`app/lib/removebg-worker.js`). Loading `@imgly/background-removal-node`
   inside the server process crashes Node, because sharp and
   onnxruntime-node native modules conflict. Its input must be a typed Blob,
   never a Windows path string.

5. **Keep `archiver` pinned at v7.** Version 8 is ESM-only with a different
   API and breaks `require('archiver')`.

6. **Filenames are an API.** The studio only recognises
   `output/variation-<1-7>.png`, `social/portrait-ai-<1-3>.png`,
   and ref prefixes `host-`, `guest-`, `logo-`, `bg-`, `style-ref`.
   Renaming breaks detection silently.
   A `guest-` ref must be a FACE photo: uploads wider than 1.6:1, or
   byte-identical to a file in `brand/inspiration/`, are rejected. Those
   inspiration files are old thumbnails from this channel and contain the
   host's face, so using one as a guest photo puts the host in the frame twice.

6b. **Never identify a person in a prompt by an ordinal** ("the second attached
   photo"). Host photos are attached first, so an ordinal silently points at
   the wrong person as soon as `hostRefCount` changes. Prompts say how many
   photos belong to each person instead, and `buildVariations` must receive the
   exact arrays the pack attaches. Bump `PROMPT_ENGINE` in `app/lib/blueprint.js`
   whenever prompt text changes in a way that makes packs on disk wrong.

7. **Max 10 reference images per ChatGPT message** (platform limit). Codex
   native supports up to 16. Packs cap attachments automatically.

8. **Verify guest photos are the right person.** The auto-search once
   returned a photo of Sam Altman for a different guest. Wrong face means a
   wasted run and misrepresenting a real person. Look at the image, and ask
   the user when unsure.

9. **No em dashes anywhere** in code comments, UI copy, docs or generated
   text. Use commas, colons or plain hyphens. This is a house style rule.

10. **Never commit private data.** `.gitignore` already excludes
    `data/settings.json` (may hold an API key), `data/chatgpt-profile/`
    (a logged-in browser session), `data/usage.json`, `projects/`,
    `demo/` and `node_modules/`. Do not weaken it. Debug screenshots from
    the Playwright runner belong nowhere near git: they capture the user's
    ChatGPT sidebar, which lists unrelated private projects.

11. **The demo is the same codebase, not a fork.** `scripts/build-demo.mjs`
    snapshots the running studio into `demo/`. `app/public/demo-config.js`
    ships `window.DEMO_MODE = false`; only the build flips it to true.
    Anything you add to the UI that writes must degrade to the read-only
    toast, and any new API the UI reads must be snapshotted by the build,
    or the demo silently breaks.

12. **Never print an absolute local path in the UI.** Use `projectPath()` in
    `app/public/app.js`, which reads `state.meta.projectsDir` from the
    server. Hardcoding one machine's folders leaks it into the public demo.

13. **Generated images get their AI provenance stripped, refs never do.**
    Images downloaded from chatgpt.com carry a ~25KB C2PA `caBX` block that
    otherwise travels inside every delivered ZIP. `app/lib/cleanmeta.js`
    removes it without re-encoding, and refuses to write if the encoded
    picture payload changed by a byte. It runs on upload, on API generation,
    and as a sweep at export and pack-zip. That sweep is the ONLY thing that
    catches images Codex writes straight to `output/`, so do not remove it.
    `refs/` is never swept: those are real photos, and dropping their EXIF can
    take orientation with it. The setting is `stripAiMetadata`, on by default.
    Node port of the `remove-ai-image-metadata` skill, which stays the
    reference implementation: https://github.com/jqaisystems/jqai-ai-skills

---

## How things are laid out

- `app/server.js` - Express API and all endpoints. Restart the server after
  editing it, changes are not hot-reloaded.
- `app/lib/` - `blueprint.js` (prompt engine), `socialcopy.js` (post texts in
  the host's voice), `providers.js` (OpenAI + custom command),
  `imagesearch.js` (keyless guest photo search), `usage.js`,
  `removebg-worker.js`.
- `app/public/` - the whole UI: `index.html`, `app.js` (vanilla, hash
  router), `style.css`. No build step, no framework.
- `projects/<slug>/` - `project.json`, `refs/`, `pack/`, `output/`,
  `social/`, `export/`, `download/`.
- `data/` - `settings.json`, `suggestions.json`, `roadmap.json`,
  `usage.json`, caches.
- `docs/` - TUTORIAL (plain language), RUNBOOK (operations), BLUEPRINT
  (brand), ADAPTING (rebranding for other creators).
- `scripts/` - `chatgpt-runner.mjs` (Playwright), scheduled refresh jobs.

## White-label

Host name, show name, channel URL, ChatGPT project name and URL, provider
and budgets all live in Settings (`data/settings.json`). Read them from
there rather than hardcoding a person's name or a channel name.

## Before you say it works

Actually run it. Restart the server, hit the endpoint or open the page, and
confirm the result. Syntax-checking is not verification.

## Sharing it

Three separate mechanisms, easy to confuse:

- **Read-only demo**: `node scripts/build-demo.mjs` with the studio running,
  then `npx vercel deploy --prod --cwd demo`. One codebase, not a fork:
  `app/public/demo-config.js` ships `DEMO_MODE = false` and only the build
  flips it.
- **Private handoff**: `node scripts/build-handoff.mjs`. Produces a runnable
  copy WITH the host photos, plus a ZIP, for the person whose channel this was
  built around. It goes to a private repository that must never be public.
- **Public release**: this repository, as it stands. `SETUP.md` is the
  non-developer entry point.

## Before publishing this repo publicly

**Read `docs/RELEASING.md`.** It holds the two-repository rules, the full
checklist and what is already verified.

The rule that must not be undone: host photos, other channels' thumbnails and
guest research stay **untracked**. They are gitignored and were purged from
history, because photos of a real person in a public repo are a ready-made
reference set for generating that person's face, and other people's thumbnails
are not ours to relicense. The files stay on disk and the studio uses them
normally. Do not re-add them to git to "make the handoff work": that is what
`scripts/build-handoff.mjs` is for.

`node scripts/check-release.mjs` proves it, against history and not only the
working tree, and `.githooks/pre-push` runs it on every push once you have run
`git config core.hooksPath .githooks`.

## Backup

`node scripts/backup.mjs` writes a dated ZIP to `%OneDrive%\Backups\
thumbnail-studio` and keeps the 3 newest. A weekly scheduled task
("ThumbnailStudio Backup", Sundays 09:11) runs `scripts/backup.cmd`.

**Git is not the backup and cannot be.** `projects/` is 149MB and gitignored,
and committing generated images would grow the repo without bound because they
never delta-compress. The ZIP carries `projects/`, `brand/` and `.git`, and
deliberately excludes the ChatGPT session and `data/settings.json` so the
archive holds no credentials. Restore-tested: unzip, `npm install`, boot.

## Handing a runnable copy to someone else

`git archive` alone no longer produces a working studio, because host photos are
not tracked. That is correct for a public release. `scripts/build-handoff.mjs`
is the supported path: it archives HEAD, copies `brand/host-photos/` in, writes
a personal start guide and a `settings.example.json` from a gitignored
`handoff.config.json`, and refuses to include anything from the never-tracked
list. Only send a build it produced, and only to the person whose photos those
are.
