# Setting up Thumbnail Studio

The studio runs on your computer and ships without credentials or a signed-in browser session. It prepares briefs, reference packs and comparisons locally. Image generation uses the provider you choose; prompts and attached reference images are sent to that provider when you generate.

You can set up the workspace before choosing a generation provider. Account access, supported features, usage limits and costs belong to the selected provider.

## 1. Install Node.js (once, about two minutes)

Go to **https://nodejs.org** and download the version marked **LTS**. Install
it with all the default options. That is the only thing you need to install.

## 2. Put the folder somewhere sensible

Anywhere you like, for example `Documents/thumbnail-studio`. Keep the folder
together, the app reads its own files.

## 3. Start it

- **Mac**: double-click `START.command`.
  The first time, macOS may say it cannot verify the file. Right-click it,
  choose **Open**, then **Open** again. If it refuses to run at all, open
  Terminal, drag the folder in, and run `bash app/start.sh`.
- **Windows**: double-click `START.bat`.

A black window opens and stays open, that is the studio running. Leave it
open. Your browser opens at **http://localhost:4626**.

To stop it, close the black window.

## 4. Make it yours

Two things, five minutes.

**Photos.** Put 3 to 5 pictures of whoever appears in the thumbnails into the
`brand/host-photos/` folder. At least one should be a sharp, well-lit photo
looking straight at the camera. These are attached to every picture the studio
makes, so they decide how much it looks like the real person. Drop more in any
time, they appear automatically.

**Settings**, in the left menu:

- **Host name** and **Show name**, used in the prompts and the previews
- **Main host photo**, which of your photos leads every generation. Pick the
  sharpest frontal one.
- **Channel URL**, used to pull your real feed in Reality Check
- **How you generate images**, see the next section

## 5. Choose how the pictures get made

The studio prepares prompts and reference packs. Choose a generation route you have access to:

1. **Codex app, built-in image generation.** Open the studio folder in Codex. On a project page, copy the line beside **In Codex** and follow the generated instruction pack. Check that your account supports the requested image features and output formats.
2. **Included Playwright runner.** This uses your signed-in ChatGPT browser session. Sign in manually once with `node scripts/chatgpt-runner.mjs login`, then run `node scripts/chatgpt-runner.mjs run <project-name>`. The runner stores a local browser session, not your password. Provider limits still apply, and UI changes can interrupt this route.
3. **Browser agent.** Use the generated agent instructions with a compatible browser tool and a session you have signed in to yourself.
4. **OpenAI API.** Add your own key in Settings if you choose this route. API access and billing are separate from access through a signed-in app or browser.
5. **Manual copy-paste.** Copy a prompt and attach its listed references in your chosen provider. Save the results and inspect them before import or export.

The pack can include host and guest photos, logos and backgrounds. Only attach references you are permitted to share with the selected provider. Fetching guest images or the channel feed also makes external requests.

The included browser runner spaces requests by default. That delay is an implementation setting, not a guarantee of available quota. If the provider reports a limit, stop and follow its stated retry time. See the [runbook](docs/RUNBOOK.md#2-generate-the-images) for the supported routes.

## 6. The normal loop

1. **+ New video**, type the title, the hook and any notes. Or open
   **Guests & ideas** and press "Start project" on a card, which fills it in
   for you.
2. The host photo attaches itself. For interviews the studio searches the web
   for the guest's photo by name. **Always glance at it**, the search once
   returned the wrong person.
3. **Build the 7 prompts.**
4. Generate with whichever runner you picked.
5. **Test & choose**: the Arena (head-to-head duels), Reality Check (your
   candidates dropped into your real channel feed), the Tiny-size Lab
   (measured legibility at search-result size).
6. **Export winner** for the 1280x720 upload, then **Create social pack** for
   the X and LinkedIn images, the portrait, and the post texts in your voice.
7. **Download everything (ZIP)** gives you one archive with `1-youtube/`,
   `2-social/`, `3-texts/`, `4-all-thumbnails/` and a READ-ME.

One thing happening quietly in the background: pictures made through ChatGPT
come with a hidden "Content Credentials" tag baked into the file. The studio
strips it out of your images automatically, without ever re-saving or
degrading the picture, and checks again before it builds your ZIP. It is on by
default and there is a switch in Settings if you would rather keep the tag.
Your reference photos are never touched. To be clear about what this is: it
removes the embedded label, it does not make an image undetectable.

## 7. What is not included, on purpose

No API key, no ChatGPT session, no passwords, nothing belonging to whoever sent
you this. The studio never asks for, stores or types a ChatGPT password, and it
never will. You supply your own settings and optional API key, stored in the gitignored
`data/settings.json`. The browser route stores its signed-in session separately in
`data/chatgpt-profile/`. Keep both private.

## If something breaks

- The black window shows the error. That text is what to send to whoever set
  this up for you.
- Nothing loads at localhost:4626: the window probably closed, start it again.
- Guest photo is the wrong person: press the ✕ on it and drop in the right one.
- "Too many requests" from ChatGPT: stop and follow the provider's stated retry time. Do not repeatedly retry a limited session.

Operational detail lives in `docs/RUNBOOK.md`, the brand rules in
`docs/BLUEPRINT.md`, and rebranding for anyone else in `docs/ADAPTING.md`.

---

Built by **João Queirós** in Porto, Portugal · joaojbq@ai.joaoqueiros.com · © 2026
[www.ai.joaoqueiros.com](https://www.ai.joaoqueiros.com)
