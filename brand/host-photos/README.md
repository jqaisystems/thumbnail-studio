# Host photos

Put **3 to 5 photos of the person who appears in your thumbnails** in this
folder. They are attached as references to every image the studio generates, so
they decide how well the likeness holds.

The images themselves are gitignored on purpose. Photos of a real person are not
something a repository should hand out: anyone who cloned it would have a
ready-made reference set for generating that person's face. Yours stay on your
machine.

## What works

- **At least one sharp, frontal, well-lit headshot.** This does the heavy
  lifting. Blurry or heavily filtered photos produce a face that drifts.
- A couple of different angles and expressions helps variety across the seven.
- Plain or simple backgrounds beat busy ones.
- Roughly 800px on the short side or larger. Bigger is not better past that.
- `.jpg` or `.png`.

## Two settings that go with them

Both live in **Settings**, no code to edit:

- **Main host photo**: which file is attached first to every generation, so it
  decides how well the likeness holds. Leave it alone and the studio uses the
  first image in this folder, which means a fresh install works the moment you
  drop photos in.
- **Host photos attached per image**: 1 for speed, 2 for the best likeness.

## Permission

If the person in these photos is not you, get their agreement before generating
images of them, and again before publishing anything you generate. Full guide:
`docs/ADAPTING.md`.
