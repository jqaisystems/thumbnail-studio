# Setting up Thumbnail Studio

For people who do not write code. It runs on your own computer, nothing goes to
the cloud, and it ships with **no credentials of anyone's**. You plug in your
own ChatGPT or Codex when you want to generate pictures, and until then
everything else still works.

Fifteen minutes end to end, most of it waiting for Node to install.

---

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

The studio writes the prompts and the reference packs. Something else draws
the pictures. Five options, all reading the same pack, ranked by how well they
work in practice:

1. **Codex app, built-in image generation.** Best quality and best cost. No
   browser involved, it accepts 16 reference photos, renders at 2K and writes
   the files straight into the project folder. On a project page, press the
   copy button next to "In Codex" and paste that line into Codex.
2. **Playwright script**, free and unlimited on ChatGPT Pro. You log in **once
   by hand** in a window it opens, and the session stays on your machine.
   Run `node scripts/chatgpt-runner.mjs login` once, then
   `node scripts/chatgpt-runner.mjs run <project-name>`.
3. **Browser agent** (Claude or Codex in Chrome). Copy the chip that says
   "generate thumbnails for ...".
4. **OpenAI API**, if you would rather pay per image. Paste your own key in
   Settings.
5. **Manual copy-paste** into ChatGPT. Every prompt has a copy button.

There is a fuller comparison inside the app under **Settings → How generation
connects**, and a plain-language walkthrough under **How it works**.

**One rule that matters:** if you drive ChatGPT through a browser, leave 45 to
75 seconds between messages. OpenAI throttles bursts, not volume. Going faster
triggers "Too many requests" and can lock the account for hours. The Playwright
script already paces itself.

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
never will. Everything it needs, you supply in Settings, and it stays in
`data/settings.json` on your own machine.

## If something breaks

- The black window shows the error. That text is what to send to whoever set
  this up for you.
- Nothing loads at localhost:4626: the window probably closed, start it again.
- Guest photo is the wrong person: press the ✕ on it and drop in the right one.
- "Too many requests" from ChatGPT: stop, wait an hour, then keep to the
  45 to 75 second pacing.

Operational detail lives in `docs/RUNBOOK.md`, the brand rules in
`docs/BLUEPRINT.md`, and rebranding for anyone else in `docs/ADAPTING.md`.

---

Built by **João Queirós** in Porto, Portugal · joaojbq@ai.joaoqueiros.com · © 2026
[www.ai.joaoqueiros.com](https://www.ai.joaoqueiros.com)
