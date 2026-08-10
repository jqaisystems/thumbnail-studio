# Thumbnail Studio - the simple guide

This makes YouTube thumbnails for The Next New Thing. You give it a video
title, it gives you 7 finished pictures to choose from. This same guide lives
inside the app under **How it works**.

## The whole flow in 6 steps

1. **Open the studio.** Double-click `START.bat` in the Thumbnails folder.
   The studio opens in your browser at http://localhost:4626.

2. **Start a video.** Click the red **+ New video** button and type the
   video's title. The "hook" is the one big claim of the video, like
   "$10M with zero employees".
   Shortcut: open **Guests & ideas** in the menu and press **Start project**
   on any card, it fills everything in for you.
   **No title yet? Even better.** Many creators design the thumbnail first
   and write the title to match it afterward. Pick **Start from a concept**:
   type only the hook, and the studio runs on a provisional "working title"
   until the winner is picked. Then the **Title** section suggests real
   titles built to support that exact thumbnail; press **Use this title** on
   the one you like.

3. **Photos add themselves.** The host photo is attached automatically. For
   interviews, the studio searches the web for the guest's photo by name the
   moment you create the project. You can still add your own guest photos,
   logos and backgrounds, and the scissors button removes any photo's
   background.

4. **Press "Build the 7 prompts".** The studio writes 7 different image
   instructions: 7 layouts, 7 colors, so you always have real options.
   The **mood pills** in the Brief control the facial expression for the host
   and the guest (smiley by default; confident, curious, amazed, serious and
   intense are one click away). Change the mood, rebuild the prompts.
   Easiest option: press **✨ Auto** and the studio reads your brief and gives
   each of the 7 a different expression, so a money story gets amazement and a
   versus story gets intensity. Want something more specific than the six?
   Give Codex or Claude the project's `pack\MOOD_INSTRUCTIONS.md` and it will
   write an expression for each of the 7, tuned to that exact video, like
   "with a slow disbelieving head shake and a grin".

   **Want to change something?** Every one of the 7 cards is editable. Type
   straight over the text that will appear on the image (use `/` to force a
   line break), or open **Prompt** on a card to edit the whole instruction,
   then press **Save prompt edits**. Your changes stick even when you rebuild.
   One rule: do not edit the files in the `pack` folder by hand, because
   rebuilding replaces them. Edit here instead.

5. **Make the pictures.** Best way: open the **Codex app** with this folder
   as its workspace and give it the project's `pack\CODEX_INSTRUCTIONS.md`
   (there is a copy button on the project page). Codex generates the images
   itself and writes them straight into the project, no browser involved.
   Other ways: tell Claude
   *"generate thumbnails for [video name]"* and watch it do everything in
   ChatGPT. Or by hand: press **Copy prompt** on a card, paste it into
   ChatGPT with the photos attached, and drag the finished picture back onto
   the card's empty slot.

6. **Test, pick, export.** Use **Test & choose**: the **Arena** (click the
   better of two, six times), **Reality check** (see your candidate inside
   your REAL YouTube channel feed, or hidden among decoys, with blur and
   size stress tests), and the **Tiny-size lab** (measured legibility at
   search size). Star the winner, press **Export winner**, upload to YouTube.

   **Wrong colour?** The seven give you seven layouts each locked to one
   colour, so you can never have your favourite layout in a different accent.
   The Final round has a colour picker that fixes exactly that: pick any of the
   seven brand colours and your winning thumbnail is remade in it, same layout,
   same faces. Useful when your winner clashes with the last couple of videos
   on the channel. One option keeps your existing words, so a pure colour swap
   is a single click.

   **One last check.** After you settle the title, the **Final round** section
   tells you how well the title and the thumbnail go together. They should
   share about half their words: the picture grabs, the title finishes the
   thought. If they have drifted apart, press the button and the studio remakes
   your winning thumbnail with new words taken from your title, four ways to
   compare. Pick one and it becomes the image that goes everywhere.

7. **Share it.** Once a winner exists, the **Social pack** section builds
   three images: X (1200×675), LinkedIn (1200×627), and a portrait
   announcement card (1080×1350, 4:5) that works on BOTH platforms and takes
   the most space in mobile feeds. The portrait is a designed card (title,
   full thumbnail, channel name), not a crop, so nothing gets cut off.
   Want a fancier portrait? Press **Build the 3 portrait prompts** and
   ChatGPT recreates the thumbnail itself as a true vertical image, three
   different takes; pick your favorite with **Use this**. Plus
   post text written in the host's voice and alt text for everything. Edit
   anything, copy, replace `[link]` with the video URL, post. Limits are
   shown live: X posts 280 characters, X alt 1000, LinkedIn alt 300,
   LinkedIn shows ~200 characters before "see more".

## Two ways to run it

- **Full workflow**: "run the full workflow for [video]" makes everything:
  7 thumbnails, YouTube export, X + LinkedIn images and texts, 3 AI
  portraits. For videos that get promoted on socials.
- **Thumbnails only**: "generate thumbnails for [video]" makes just the 7.
  The Social pack stays one click away if you want it later.
- On interviews, the guest appears in at least 5 of the 7 thumbnails.

## It keeps improving

- New guest and topic **suggestions** arrive every Monday.
- The **Roadmap** page gets fresh improvement proposals on the 1st of each
  month. Accept what you want, decline the rest; nothing is built without
  a yes.
- Every winner you pick teaches the studio which layouts and colors work.

## The Playwright runner (zero-cost automation)

- Setup once: `node scripts\chatgpt-runner.mjs login`, log in to ChatGPT in
  the window, close it. A session is saved locally, never a password.
- Then `node scripts\chatgpt-runner.mjs run [project]` makes every missing
  thumbnail by itself, one ChatGPT chat per video, inside your project.
- It deliberately waits 45-75 seconds between images because ChatGPT limits
  burst speed, not volume. If ChatGPT ever says "Too many requests", nothing
  is lost: wait a few minutes and rerun, it resumes where it stopped.

## Mac users

Same system, same folder. First time only, open Terminal in the folder and
run `chmod +x START.command app/start.sh`. From then on, double-click
**START.command**. The two scheduled refresh jobs are Windows-only; on Mac
either ask Claude ("refresh the suggestions", "propose improvements") or set
up cron per `docs/ADAPTING.md`.

## Using this for anything else

The studio is a template: host name, show name, channel URL and generation
provider are Settings; photos are folders; the visual DNA is
`docs/BLUEPRINT.md` + `app/lib/blueprint.js`. Podcast covers, Shorts,
course cards, product images, another channel entirely: see
`docs/ADAPTING.md`.

## Words you will see

- **Prompt**: the written instructions ChatGPT uses to draw one picture.
- **Reference**: a photo you give ChatGPT so it knows what someone looks like.
- **Layout**: how a thumbnail is arranged (big text, a prop, two people, a giant number...).
- **Colorway**: the one accent color of a thumbnail. Seven exist so videos never look repeated.
- **Pack**: the folder with everything an assistant needs to make all 7 pictures alone.
- **Winner**: the thumbnail you choose to actually use on YouTube.

## If something looks wrong

- **Face is off**: reply in the same ChatGPT chat, "Same image, but make the
  face match the reference photo exactly."
- **Text misspelled**: reply, "Same image, but spell the text exactly: [the text]."
- **Nothing happens**: close the black window and double-click START.bat again.

## Where everything lives

```
26_Youtube_Thumbnails\
├── START.bat            double-click to open the studio
├── app\                 the studio itself
├── brand\
│   ├── host-photos\     the host's reference photos
│   └── inspiration\     thumbnails whose style we follow
├── projects\            one folder per video (prompts, photos, results)
├── data\                suggestions and settings
├── docs\                this guide, the brand blueprint, the full runbook
└── scripts\             the weekly suggestions refresh
```

## Getting the files out

Press **Download everything (ZIP)** on any project. One archive with
`1-youtube/`, `2-social/`, `3-texts/`, `4-all-thumbnails/` and a READ-ME that
explains each file. Individual images have their own **⤓ Download** buttons.
Everything also lives on disk: the project page shows the exact folder path,
click it to copy.

For the full technical version, read `docs\RUNBOOK.md`. For the brand rules,
`docs\BLUEPRINT.md`.

---

Built by **João Queirós** in Porto, Portugal · joaojbq@ai.joaoqueiros.com · © 2026
www.ai.joaoqueiros.com
