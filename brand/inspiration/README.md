# Style references

Put **3 to 5 thumbnails whose style you want to borrow** in this folder. The
studio attaches one as a style reference so generated images inherit a look
rather than inventing one each time.

The images themselves are gitignored on purpose. Thumbnails from other people's
channels are their work, not yours to redistribute, so they stay on your machine
even though the studio uses them locally.

## What works

- Thumbnails you genuinely admire, from any channel, including your own.
- Consistent in feel rather than in subject. You are borrowing lighting, colour
  energy and text treatment, not composition.
- Full size, roughly 1280x720. Small ones give the generator little to read.
- `.jpg` or `.png`.

## A note on copying

Style references push the generator toward a look. They are not a way to
reproduce someone's thumbnails, and using them to closely imitate one specific
channel is both a legal risk and a bad growth strategy: a channel that looks
like a copy reads as a copy.

The real brand definition lives in `docs/BLUEPRINT.md` and its machine copy
`app/lib/blueprint.js`, which is where your own layouts and colourways belong.
Edit both together, they must match.
