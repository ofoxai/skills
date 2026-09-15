# Changelog

All notable changes to the **explainer** skill. Versioning follows SemVer.

## 1.0.0 — first release

A scenario skill for turning something written — an article, a README, a
release note, a paper — into a short clip of it being said out loud, either by
a presenter to camera or as a voiceover over footage. Execution is delegated
to `ofox-video-core`.

**The scenario was redefined before it was built, by a measurement.** The
original framing assumed a script could be supplied as audio. It cannot: the
API accepts an `audio_url` reference, validates it, fetches it and bills the
job, and the delivered audio is **not** the audio that was sent — measured
2026-09-15 on job `d8561509-dcc6-4f2c-8864-a193cd239b14`, 55 cents, envelope
correlation 0.41 between input and output. The user supplies text; the model
generates the speech.

**The skill's first section exists to correct the request it almost always
receives.** People ask for "a 30-second video of this article". A 30-second
clip holds about **ninety spoken words** — 7.5% of a 1,200-word post, under a
tenth of it — so it cannot summarise anything. The honest product is *one idea
from the source, said once*, and the skill says so in the first reply rather
than after the bill. It also refuses the tempting alternative explicitly: a
summary squeezed into ninety words becomes a string of abstractions that means
nothing to someone who has not read the source, which is worse than one
concrete idea fully said.

**Picking the idea is treated as the actual work**, and gets a procedure
rather than a suggestion: list the source's candidate claims, write each as
the sentence that would really be spoken, score all of them against four tests
(stands alone, concrete, fits the budget, worth someone's attention), then
offer the two or three survivors to the user as the actual sentences. `Idea`
is a must-ask row with no "Let the AI decide" — it is their article. A worked
selection over a fictional release post shows two candidates failing and two
passing, with the reason for each.

**The word capacity is linked, not restated, and budgeted against the right
tier.** The measured rates live in `ofox-video-core`'s `prompt-structure.md`;
this skill carries only the consequence — a clip-length-to-word-count table
with the share of a 1,200-word article each length represents. The tier that
applies to a single continuous speaker is monologue / talking head, 3.5 words
a second in English and 5 characters a second in Chinese; the dialogue-drama
band (0.4–1.7 words/s) measures two people with silence between their lines
and is a floor here rather than a budget. The skill plans a little under its
own tier — **3 words a second, 4 characters a second** — because the templates
spend clip time on an opening beat and a written silent ending while asking
for an unhurried delivery, and because the asymmetry is one-sided:
under-filling costs a pause, overrunning costs the whole clip.

**What is measured and what is not is a table, not a footnote.** The audio
finding, the five completed text-to-video jobs built around photoreal people,
the submission-time refusal of a photoreal person in an attached frame, the
music/moderation failure and the invented-text rule are marked measured; the
word rates and the voiceover-with-no-visible-speaker shape are marked gallery
practice. **This skill has no paid run of its own**, and the approval-gate
section requires that to be said in the same message as the cost table.

**Two limits users hit immediately are stated before they are hit:**

- **On-screen text is not available from a description.** Text rendered from
  prompt text comes back invented or garbled, repeatedly; a negative list
  alone does not hold on a lettered set. Captions and lower thirds go on in an
  editor, where they are free and correct. The one working route — a prepared
  title card attached as the first frame, which is preserved — is documented
  along with what it costs (the frame slot, and the clip's shape follows the
  image).
- **A photoreal presenter does not survive between jobs.** Each `generate` is
  stateless, and the usual fix of carrying the last frame forward is refused
  at submission when that frame holds a photoreal person. The skill gives four
  available series shapes instead of one impossible one, and points an
  illustrated recurring presenter at `seedance-anime-drama`, which works for
  exactly that reason.

Also in this release:

- **Two prompt templates** — presenter to camera (the shape this repo has run)
  and voiceover over footage (gallery practice only, priced as an experiment)
  — both single-shot with no manifest and no cut list, both quoting the chosen
  idea verbatim, both carrying `no music` in the sound block *and* the music
  words in `AVOID` after a scored cue failed output moderation on copyright in
  this repo, unbilled.
- **The spoken language follows the source's language**, never asked, with the
  warning that translating a line on the way into the prompt buys an
  English-dubbed clip the user discovers after paying.
- **A four-question brief** with skip rows that route "use my photo" to
  `talking-head`, "put the bullet points on screen" to the text section, and a
  six-feature doc back through idea selection rather than into one clip.
- **No hardcoded model, price, resolution, duration or aspect-ratio table.**
  Those are catalog facts and the skill points at `ofox-video.sh models` /
  `providers MODEL` / `generate --dry-run`. The default model is the script's
  own, because nothing here attaches a portrait and so nothing forces a
  different one.
- **No cost anchor, because there has never been a bill.** The dry-run figure
  at the parameters about to be sent is the only number to show, and the gate
  message also carries the chosen idea in full and one line saying what the
  clip is *not*.
- **An after-it-lands checklist** — were all the words said, is the idea still
  the idea, did any lettering get invented — because `STATUS completed`
  answers none of them.
- **It says when not to buy.** If the user wants the article summarised, that
  is a free writing task; if they want slides, diagrams or readable bullets, a
  narrated deck does it properly; past two or three parts, a screen recording
  with a voiceover is the better product.
- **The core-directory probe ships from day one**, so the skill works on
  LobeHub's `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.

**What a caller has to do**: install `ofox-video-core` beside this skill.
`npx ofox-skills` installs every skill in this repo, which is what keeps the
sibling path resolvable.
