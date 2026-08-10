# The Thumbnail Blueprint

This is the single source of truth for every thumbnail on your channel. The
app's prompt engine reads from the same rules defined here. If you change this
file, change `app/lib/blueprint.js` to match, or the two drift and the prompts
stop describing what you wrote down.

**Section 1 is yours to write. Sections 2 to 10 are the method**, tuned on a real
channel over a few hundred generations, and they work as they stand. Change them
once you have opinions of your own, not before.

---

## 1. Positioning - who is on the thumbnail and why people click

Replace this section with your own. It is the part the rest of the document
serves, and the part no tool can write for you. Answer six things:

- **Host:** who appears, in one sentence carrying the credential that makes a
  stranger stop scrolling. Not a bio, the one line that earns attention.
- **Channel:** name plus the promise, short enough to fit on a business card.
- **Tagline energy:** how the channel sounds when it is being itself.
- **Persona:** the character the host plays on camera. Three adjectives.
- **Audience:** who they are, and roughly how many. Be honest about the number.
- **Never on a thumbnail:** sponsors, logos, anything contractually awkward.

Then list **6 real titles from your own channel**, the ones that actually did
well, and write the pattern underneath them. That pattern is what every
thumbnail has to compress into 3 to 6 words and one image idea.

A worked example, from the channel this studio was tuned on: its titles were
consistently a money number, plus AI, plus a surprising mechanism ("Zero
Employees = $10M Run Rate"). So the blueprint pushes the number to hero size and
lets the words support it, which is why archetype D exists at all. Your pattern
will be different, and it should change which archetypes you favour.

---

## 2. Thumbnail DNA - the constants (never change these)

These are what make every thumbnail unmistakably "The Next New Thing" even
though colors rotate.

1. **The host's face is always present.** Photoreal, sharp, well-lit, warm
   expression (curious smile, raised-brow amazement, or intense focus - never
   fake-shocked clickbait gurning). Reference photos live in
   `brand/host-photos/` - always attach 1-2 when generating.
2. **Face placement:** the host right third (solo) or behind-right (interview,
   guest gets the foreground left/center-right position - the guest is the story).
3. **Text: 3-6 words max.** Ultra-bold condensed grotesque (Archivo Black /
   Anton energy), set in 2-3 stacked lines, left side, filling ~50% of frame width.
4. **Sticker treatment:** text sits on rounded-corner solid color blocks
   ("stickers") or has a heavy hard-edged outline/shadow. It must survive at
   168px wide (YouTube sidebar size).
5. **One idea per thumbnail.** A number, a prop, or a bold claim. Never two.
6. **Money numbers get the biggest type.** "$10M", "$689K", "$0" - the number
   is the hero, the words are support.
7. **Backgrounds are clean and deep:** dark studio blur, deep color gradient
   with subtle glow behind subjects, or a believable tech environment. Never
   busy, never cluttered.
8. **High contrast, slightly lifted saturation** - must pop against YouTube's
   white AND dark UI.
9. **Format:** 16:9, minimum 1280x720. Keep faces and text inside the middle
   90% (YouTube overlays timestamp bottom-right).

---

## 3. Colorway rotation - the variety (7 accents)

Every video's 7 variations draw from these colorways, and the rotation is
seeded per project so consecutive videos lead with different accents. The
channel grid stays cohesive because typography, face treatment, and layout DNA
never change - only the accent moves.

| # | Colorway | Accent | Support | Background pairing | Text rule |
|---|----------|--------|---------|--------------------|-----------|
| 1 | **Signal Red** | `#E8382B` | White `#FFFFFF` | Dark studio blur / charcoal `#181A1E` | White text on red stickers; red circle/arrow annotations |
| 2 | **Taxi Yellow** | `#FFC814` | White + red badge `#D6281E` | Deep charcoal or deep purple `#1B1030` | Yellow headline word, white support words, red badge strip for the kicker |
| 3 | **Electric Purple** | `#8B3DFF` | White | Purple-to-black radial glow `#2A1052 -> #0B0614` | White sticker text; purple rim-light on subjects |
| 4 | **Cyan Circuit** | `#19D3F0` | White | Near-black blue `#06121E` with faint circuit/HUD glow | White text with cyan glow edge; cyan UI elements |
| 5 | **Lime Signal** | `#B6F034` | Black `#0C0E10` | Clean dark gray `#15171A` | Lime stickers with BLACK text (only colorway using dark text) |
| 6 | **Hot Magenta** | `#FF2D78` | White | Magenta-to-indigo gradient `#3A0B2E -> #120A2A` | White text, magenta sticker for the money number |
| 7 | **Cobalt Bolt** | `#2E6BFF` | White + yellow pop `#FFC814` | Deep navy `#0A1228` | White stickers; one yellow highlight word max |

Rules:
- **One accent per thumbnail** (+ its defined support colors). Never mix two colorways.
- **The 7 weld layout to colour**: slot i always gets colorway (seed + i) mod 7,
  so within one project you cannot have this layout in that colour. The **final
  round** is the release valve: it re-renders the winning composition in any
  colorway you pick, keeping the layout, the references and the expression. All
  the rules above still bind, the accent simply moves. Whatever colour actually
  ships is what the social pack describes, in the card glow and in the alt text.
- Skin tones stay natural - accent lives in text, stickers, glow, and props.
- Red arrows/circles are allowed in any colorway (they read as "annotation", not "color").

---

## 4. Layout library - 7 archetypes

Each video gets all 7, so you always pick from genuinely different options
(not 7 recolors of one idea).

### A. Sticker Statement (solo close-up)
The host chest-up on the right, direct eye contact. 2-3 lines of giant sticker
text left. The claim IS the image. *(Ref: "$0 AI bill.")*

### B. The Prop
The host holds a physical object that proves the claim - printed invoice, phone
screen, contract, stack of cash, product box - with one detail circled/arrowed
in red. Text smaller, top-left. *(Ref: the "$0 TOTAL DUE" invoice.)*

### C. Guest Duo (interview episodes)
Guest foreground left-of-center (they're the story), the host behind-right,
both lit and cut out on the colorway background glow. Guest name or company
logo may appear as a small badge. *(Ref: "30K★ on GitHub".)*

### D. Big Number
The money/metric number at massive scale - 40%+ of frame height - the host
reacting beside/behind it. Words reduced to a 2-4 word kicker on a badge strip.

### E. Tech Immersive
The host inside a believable futuristic scene - holographic dashboards, agent
UIs, code panels floating around their hands - one clean white headline across
the top. The scene carries the wow. *(Ref: "OpenAI created Jarvis".)*

### F. Split / Versus
Frame divided in two: before/after, human vs AI, $X vs $Y, tool A vs tool B.
The host on one side or centered on the seam. Diagonal splits beat vertical.

### G. Reaction + Artifact
The host pointing or looking at a floating artifact - a chart going vertical, a
Stripe-style revenue screenshot, an agent chat window - with a red arrow
connecting their eyeline to the payoff detail.

---

## 5. Per-video variation matrix

For every video, the 7 variations are the 7 archetypes A-G, each assigned a
colorway from a rotation seeded by project number:

```
variation i (1..7) -> archetype[i]  x  colorway[(seed + i) mod 7]
```

- Interview episodes: the guest appears in A, B, C, D and F (5 of 7), plus E
  and G when the project sets `guestEverywhere`. If no guest photo is provided,
  C becomes a second Sticker Statement with alternate copy.
- The engine also varies **copy angle** across the 7: exact-title, money-number-first,
  question form, and outcome-claim - so wording isn't identical 7 times.
- **No real number in the brief, no number on the thumbnail.** When the title,
  hook and notes contain no figure at all, the engine never invents one:
  archetype D (Big Number) falls back to a second Sticker Statement, the
  money-number-first angle becomes a HOW angle ("HOW / <payoff>"), and the
  question angle drops the number. A thumbnail must not carry a claim the
  video cannot back up.
- When the working title and the hook are the same (thumbnail-first projects),
  the outcome-claim angle pulls from the notes instead, so no two variations
  render identical text.

---

## 6. Mood barometer - the facial expression

Mirrors `MOODS`, `MOOD_RINGS` and `resolveMoods` in `app/lib/blueprint.js`.

Six moods, each with 3 host phrasings and 1 guest word: **Smiley** (default),
**Confident**, **Curious**, **Amazed**, **Serious**, **Intense**.

**The two shapes are not interchangeable.** The host phrasing drops into a
sentence as "the host ___", so it must be a prepositional or participial
phrase ("with a big warm smile", "leaning in with narrowed eyes"). The guest
phrasing drops in as "the guest ___", so it must be an adjective phrase
("beaming and warm"). Swapping them breaks the sentence.

**Auto.** Reads title, hook and notes, picks a base mood by first match
(killed/versus/replaced gives intense, money gives amazed, how/why/secret
gives curious, interview/founder gives confident, else smiley), then spreads
that mood's ring of 3 related moods across the 7 so no two consecutive
variations share an expression and all 7 phrasings differ. Seeded per project,
so a rebuild reproduces it exactly.

**Written for one video.** The six are a palette, not a limit. An agent can
read `pack/MOOD_INSTRUCTIONS.md` and POST back a free-form expression per
variation, which overrides everything above. Incoming text is cleaned (quotes,
line breaks and em dashes stripped, capped at 90 characters, truncated at a
clause boundary), normalized into the right shape where that is safe ("a huge
grin" becomes "with a huge grin", "deadpan" becomes "looking deadpan"), and
dropped where it is not (a full clause like "he smiles"). Anything dropped
falls back to the automatic plan, so the prompt is never broken.

Whatever the source, section 2 item 1 still binds: a curious smile, raised-brow
amazement or intense focus, never fake-shocked clickbait gurning.

---

## 7. Prompt template rules (ChatGPT image generation)

Every generated prompt includes, in this order:

1. **Role line:** "Create a photorealistic YouTube thumbnail, 16:9 landscape."
2. **Likeness lock, scoped by COUNT:** "The FIRST 2 attached photos all show the
   SAME person, the host, <name>. They are different photos of one person, not
   different people. Match their face, hair, and features EXACTLY..." The count
   comes from how many host photos the pack actually attaches.
2b. **Guest identity, on duo variations only:** "Attached photo 3 shows the
   guest, <name>, a DIFFERENT person from the host... Exactly TWO different
   people appear in the image: the host once and the guest once. Never render
   the host twice and never give the guest the host's face."
   **Never identify a person by an ordinal like "the second attached photo".**
   The attachment list puts every host photo first, so with 2 host refs "the
   second photo" is another photo of the host. Saying otherwise produced
   thumbnails with the host rendered twice and no guest at all.
3. **Layout spec** from the archetype (placement, pose, expression, prop/scene).
   Layouts describe composition only. Identity lives in 2 and 2b, one place.
4. **Exact text spec:** the words in double quotes, line breaks marked with " / ",
   font direction ("ultra-bold condensed sans, sticker blocks with rounded
   corners and hard drop shadow"), and: "Spell the text EXACTLY as given -
   no extra words, no misspellings."
5. **Colorway spec:** accent hex, support color, background pairing from section 3.
6. **Quality bar:** "Crisp studio lighting, high contrast, subtle rim light,
   sharp focus on face, clean uncluttered background, everything legible at
   thumbnail size."
7. **Negative:** "No watermark, no channel logo, no extra text, no duplicate of
   the same person, no warped hands, no plastic AI-looking skin."

**Attachments per generation, in this fixed order:** 1-2 host photos first
(the sharpest frontal headshot leads, chosen in Settings > main host photo),
then up to 2 guest photos on duo variations, then logos and backgrounds. The
prompt counts these, so the same arrays that get attached are the ones the
prompt describes; never recompute one without the other.

**The pair is checked after the title is adopted.** The winning thumbnail's
text was written before the title existed, so the two drift apart: a real
example scored 17% once the title moved from the hook. The **final round**
re-cuts the winning composition, changing ONLY the text, deriving it from the
adopted title by taking about half its content words. "The Solo Founder Making
Millions Without a Team" gives "SOLO FOUNDER / Millions", three of its six
content words, so 50% by construction. The full title never goes on the image:
that is 100% overlap and past the 3-6 word limit, and it throws away the second
hook. The chosen final is what ships (export, social pack, portraits, ZIP)
while the layout and colorway statistics keep crediting the variation that won.

**Per-variation overrides.** Any of the 7 can be edited in the studio and the
edit is stored on the project, so it survives every rebuild. Editing the TEXT
still passes through all the rules above: it is rendered by `textSpec` with the
same font, sticker and exact-spelling instructions, and `/` marks a line break.
Editing the WHOLE prompt takes that variation outside these rules by design;
it stops regenerating from the brief until it is reset. The `pack/*.md` files
are outputs, never inputs, and every rebuild overwrites them.

**Guest photo hygiene.** A guest ref is a FACE reference. The studio rejects a
guest upload that is wider than 1.6:1 (a thumbnail or screenshot, not a
portrait) or byte-identical to anything in `brand/inspiration/`, because those
are your own past thumbnails and almost every one of them contains the host's
face. Style refs are never attached to a generation prompt at all.

---

## 8. Voice (for social posts)

Write this section from the host's own posts, not from a style guide. Read 20
of their real ones and distil the mechanics. These nine came out of that
exercise on the channel this was tuned on, and they are a reasonable starting
set for any founder-led channel:

1. Open with a bold, urgent, or contrarian claim. One sentence, no windup.
2. One idea per line. Blank line between every line. Never a paragraph block.
3. Selective CAPS on one or two words for emphasis (FREE, YOUR, HOW), never more.
4. "~" bullets for benefit lists, if the host uses a bullet mark of their own.
5. Build a curiosity gap, then promise the payoff in the last line.
6. Heavy second person: "you", "your". Talk TO the reader.
7. @mention the people involved when relevant.
8. Plain conversational words. No hashtags, no emoji strings, no corporate talk.
9. Genuine enthusiasm is allowed. Flat professional copy reads as a press release.

The engine copy of these rules lives in `app/lib/socialcopy.js`.

## 9. Quality checklist (before picking a winner)

- [ ] Readable at 168px wide? (squint test)
- [ ] Is it ONE idea?
- [ ] Does the host actually look like the host?
- [ ] Text spelled exactly right?
- [ ] Does it pop on both white and dark backgrounds?
- [ ] Different enough from the last 3 published thumbnails (check grid preview)?
- [ ] Would it still make sense with the title hidden? (thumbnail + title should
      overlap ~50%, not 100%)

## 10. Packaging order: title-first and thumbnail-first

Both orders are supported, because both are real ways creators work:

- **Title-first** (the original flow): the brief starts from a title, the 7
  variations derive their text from it.
- **Thumbnail-first**: the project starts from a concept (the hook). The
  studio derives a provisional working title from it, generates the 7, and
  once a winner is picked, the **Title section** suggests real titles built
  to SUPPORT that thumbnail: about 50% text overlap, never 100%. The
  thumbnail grabs, the title completes; the engine copy of the suggester
  lives in `app/lib/titlecopy.js`, and `pack/TITLE_INSTRUCTIONS.md` is the
  agent path for higher-quality suggestions.
