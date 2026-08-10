# Two repositories, and the rules that keep them apart

Thumbnail Studio lives in two places. They hold almost the same files and they
must never become the same repository.

| | Repository | Contains |
|---|---|---|
| **Public** | `jqaisystems/thumbnail-studio` | the code. No photos, no channel data, no credentials |
| **Private** | `jqaisystems/thumbnail-studio-<host>` | the same code plus the host's photos and their configured settings |

**The public repo is the source of truth and the one you work in.** The private
one is a build output: `node scripts/build-handoff.mjs` produces it, and the
person it is for gets **Read** access so they can pull updates without being
able to push.

## Why they are separate repositories and not a fork

Two reasons, both of which have bitten real projects.

**A GitHub fork shares an object network with its parent.** Commits pushed to a
private fork can be reachable from the public repository. The private copy
carries photos of a real person by design, so it must have no fork relationship
with anything public. Create it as a new empty repository and push into it.

**Committing a photo is permanent.** The moment host photos enter a repository's
history, that repository can never be made public, because deleting a file does
not remove it from history and every existing clone keeps the old copy. This is
also why the public repo is the working one: the direction that could leak
(strip before publishing) does not exist, since nothing sensitive is ever there
to strip.

## What must never be tracked

Enforced by `.gitignore`, and proved by `node scripts/check-release.mjs`, which
checks **history as well as the working tree**, and **content as well as
filenames**. `git ls-files` is clean the moment you gitignore something; history
is where the damage lives.

That second half was learned the hard way. An earlier version of the guard
checked historical paths but read content only at `HEAD`, and reported this
repository clean while a private ChatGPT project URL sat in `app/server.js` in
the first commit, deleted three commits later. **A secret committed once and
removed is still published.** The guard now reads every blob in every reachable
commit.

| Never tracked | Why |
|---|---|
| `brand/**` images | photos of a real person are a ready-made reference set for generating that person's face, which is a different thing from permission to appear in someone's video. `brand/inspiration/` holds other channels' thumbnails, which are not ours to relicense under MIT |
| `data/settings.json` | can hold an OpenAI API key and a private ChatGPT project URL |
| `data/chatgpt-profile/` | a logged-in browser session. The cookies in it are the account |
| `data/usage.json` | personal spend history |
| `data/suggestions.json` | names real founders with commercial notes. `data/suggestions.example.json` shows the schema with invented entries |
| `data/channel-cache.json` | a cached channel feed |
| `projects/` | hundreds of MB of generated work; images never delta-compress |
| `demo/`, `handoff/` | build outputs that carry one channel's real data |
| any `.log`, any debug screenshot | `scripts/runner-debug.png` was committed once and showed a private ChatGPT sidebar listing unrelated client projects. Screenshots are the highest-risk file in any repo because nobody looks at them before publishing |

Every allowed picture is named by **exact path** in `ALLOWED_IMAGES`. A
directory allowlist is not enough: `logo/headshot.jpg` sails through a rule that
trusts `logo/`, and that is the realistic accident. The `brand/**` rule is
extension-agnostic for the same reason, because a list of `jpg|png|webp` misses
the `.heic` an iPhone actually hands you.

The editable logo master (`logo/*.ai`) is **not** tracked. Nothing in the app
reads it, it carried the building machine's account name in its XMP and
PostScript metadata, and MIT would hand strangers the right to redistribute a
modified brand mark. Pictures carry text, so the guard reads image bytes too
rather than skipping anything that ends in an image extension.

**This covers derived media too.** A GIF cut from a video, a poster frame, a
crop: each is as much a face in git history as a `.jpg` is. The README header
`docs/readme-hero.gif` is cut from the face-free stretch of the trailer for that
reason.

## Turn the guard on

Hooks are not carried by git, so each clone enables them once:

```bash
git config core.hooksPath .githooks
node scripts/check-release.mjs        # should print ok
```

After that, `git push` runs the check and refuses on any finding. Verify it
actually bites before trusting it:

```bash
cp brand/host-photos/<any>.jpg logo/oops.heic && git add -f logo/oops.heic
node scripts/check-release.mjs        # must exit 1
git reset logo/oops.heic && rm logo/oops.heic
```

## Before making the public repo visible

Verified done, not assumed:

- [x] **No credentials anywhere.** `app/server.js` ships `openaiApiKey: ''` and
      `chatgptProjectUrl: ''`. A fresh clone boots with both empty.
- [x] **No absolute local paths.** The UI builds display paths from
      `state.meta.projectsDir` via `projectPath()` in `app/public/app.js`, and
      the `.cmd` scripts use `%~dp0..`.
- [x] **No host photos, style references or guest research**, in the tree or in
      history. Purged 2026-08-06, audited again 2026-08-09.
- [x] **No AI provenance in generated output.** `app/lib/cleanmeta.js` strips the
      C2PA Content Credentials block. See AGENTS.md rule 13.
- [x] **A fresh clone runs** with no photos, no settings and no projects. Empty
      state, not a crash.
- [x] **White-label.** No person's name and no channel name is hardcoded in the
      code or the UI. Host name, show name, channel URL and which photo leads
      are all settings. `git grep -i <host name>` returns only the deliberate
      credit in the README and the demo banner.
- [x] **The server is not on the network.** `app.listen` binds `127.0.0.1`
      unless `HOST` says otherwise. Before 2026-08-10 it bound every interface,
      which put an unauthenticated settings API, an API key in a `GET` response
      and a shell template in a `POST` body on the local network. Prove it:
      `Get-NetTCPConnection -LocalPort 4626 -State Listen` must show
      `127.0.0.1`, and a request to the machine's LAN address must be refused.
- [x] **The API key never reaches a browser.** `GET /api/settings` returns
      `hasOpenaiApiKey`, not the key. An empty key in a `POST` means "keep the
      stored one", so saving any other field cannot silently wipe it.
- [x] **The custom command is not settable over HTTP.** It runs a shell command,
      so it needs `THUMBNAIL_STUDIO_ALLOW_CUSTOM_COMMAND=1` in the environment
      and a hand-edited `data/settings.json`.
- [x] **The demo build publishes an allowlist**, not "everything minus a
      denylist". A new secret-bearing setting is therefore absent by default
      rather than shipped by default.
- [x] **The repository was recreated, not just force-pushed.** A force-push
      leaves the old objects in GitHub's object store: they are unreachable from
      any branch and invisible to `git clone`, but
      `gh api repos/<owner>/<repo>/commits/<old-sha>` still returns them until
      GitHub garbage-collects, and a public repo serves them to anyone with the
      SHA. Rewriting history in place does not unpublish anything. Verify with
      the API, never with a clone. Old SHAs must return 404 or 422.
- [x] **The history is a single commit.** The 19-commit build history contained
      the ChatGPT project URL above and absolute paths from the author's machine
      in an early `docs/RUNBOOK.md`, and six of its subjects advertised removal of
      private data, which is an invitation to go digging. It is preserved in the
      private `jqaisystems/thumbnail-studio-history` and in the OneDrive backups.

Still to decide, none of them blocking:

- [ ] **Whether to link the demo.** It is deliberately not linked from the README
      today, because it is full of one person's thumbnails and channel data.
      Linking it from a public repo needs that person's agreement, which is a
      different ask from the demo merely existing.
- [ ] **`@imgly/background-removal-node`** carries 3 high and 1 moderate advisory
      with no fixed release. Documented in the README under Known advisories.
      Revisit when upstream ships, or drop the feature.

Then clone to a temp folder, `npm install` in `app/`, boot with
`PORT=4629 node app/server.js`, and confirm the empty state renders.

## After going public

- The MIT licence lets anyone use, modify and sell this. That is intended.
- Generated images and any reference photos an adopter downloads are their
  responsibility, which the README already says.
- The backup (`scripts/backup.mjs`, weekly to OneDrive) is unaffected by
  visibility. It is a separate mechanism, and it is the one that protects
  `projects/`, which git deliberately never carries.
