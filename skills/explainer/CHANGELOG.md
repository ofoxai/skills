# Changelog

All notable changes to the **explainer** skill. Versioning follows SemVer.

## 1.1.1 — the defaults table called a measured flag untested

**Documentation only. No default, price, prompt template or behaviour
changed.**

The `--real-person` row said "untested on this model in this repo". It was
measured on 2026-09-16 lifting `bytedance/seedance-2.5`'s refusal of a
real-person reference image. The row now says so, names the flag for what it
is — Ofox's privacy-preserving preprocessing path for **authorised**
real-person references, an authorisation route rather than a way past a check
— and links `ofox-video-core`'s `references/api-params.md` for the evidence
and its limits.

The advice itself does not move: this skill's presenter is written in text, a
text-generated person was never what the refusal was about, and a skill whose
presenter comes from a photograph is `talking-head`. The continuity table's
"a portrait re-attached to each job is `talking-head`'s route, and its own
continuity is unmeasured" is a claim about a different thing — whether a face
holds across jobs — and nothing has measured that, so it stands as written.

## 1.1.0 — the number this skill is built on is no longer an extrapolation

**One paid run, and it was aimed at the one claim that mattered.** Job
`edef379e-9ac0-41c9-ab59-6378d030239e`, 2026-09-16,
`bytedance/seedance-2.5` on `byteplus`, 20 seconds at 480p, seed `623333235`,
text-to-video with nothing attached, 2 dollars 20. A 59-word
presenter-to-camera monologue written from this file's own template.

| Question | Measured |
|---|---|
| **Speech rate** | **3.05 words a second** — 59 words across a 19.33s speech span (`silencedetect` at -30dB: first word 0.399s, last 19.729s, 7 internal pauses) |
| **The thesis** | 3.05 x 30 = 91.5, so "a 30-second clip holds about ninety spoken words" holds |
| **Truncation** | none — `whisper tiny.en` returns all 59 words in order, nothing added or dropped |
| **The closing beat** | 0.335s of silence after the last word, at a script budgeted at almost exactly 3 words a second. The template asks for that beat and it fitted |

**What changed in the file is the kind of evidence, not the number.** The 3
words a second here was inherited from *two-person dialogue* measurements and
applied to a single continuous speaker — which is not a conservative estimate
but a category error, because the dialogue tier's low floor comes from clips
where most seconds have nobody speaking at all. `talking-head` shipped exactly
that mistake and had to correct it. The monologue tier now has its own
measurement on this skill's own default model.

**Two rates on two models, written as two observations.**
`talking-head` measured 3.16 w/s on `alibaba/wan-3.0-prime` the same day; this
skill measured 3.05 on `bytedance/seedance-2.5`. They agree, and they both sit
a little above the budget — but neither is repeated, they are different
scripts at different lengths, and the file says so rather than promoting the
pair into a rate the API is known to hold to.

**Bounds, written into the file rather than left implied:** one run, one
script, English, 480p, **20 seconds**. Thirty seconds was never run — the
ninety-word row is a linear extension of a twenty-second observation, and the
file now says that where the row is stated. The Chinese and Japanese
characters-per-second budgets are exactly as untested as they were.

**Also retired: "this skill has no paid run of its own"**, in all four places
it appeared — the measured table, the recap template, the pre-spend message
and the cost-anchor note. The anchor is now one point (20s / 480p / t2v,
2 dollars 20), stated as one point, with `--dry-run` still the only source of
a quote.

**And one methodology note kept rather than tidied away.** A first pass with
`silencedetect` at a 0.35s minimum found no trailing silence, and the reading
drawn from it — "a script at 3 words a second squeezes the closing beat out" —
was wrong. The beat is there in the frames; the pause is 0.335s, just under
the threshold looking for it. That is written into the file as a warning about
concluding from a tool's silence, because it is the kind of error that reads
like a finding.

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
