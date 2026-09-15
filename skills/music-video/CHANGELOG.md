# Changelog

All notable changes to the **music-video** skill. Versioning follows SemVer.

## 1.0.2 — the frontmatter did not parse, and the installer said nothing

The `description` carried a `: ` (colon then space) inside an unquoted YAML
value. YAML reads that as a nested mapping and rejects the whole block, so
`skills add` **skipped this file entirely** — and reported the count of skills
it found, never the ones it dropped. This skill was uninstallable from
skills.sh while appearing published everywhere else.

Replaced with an em dash, matching the rest of these descriptions. Nothing
else changed. A parse check over every SKILL.md is now a publish gate in
CONTRIBUTING.md, because nothing in this repo had ever parsed its own
frontmatter — which is why this survived.

## 1.0.1 — one money bug, one misleading cost story, one contradiction

Routing was correct in every blind test. These are defects in the file itself.

- **`--shots-file` would have shredded this skill's own template, and that is
  a money bug.** `chain --shots-file` is line-based: every non-blank line
  becomes a separate shot, each billed as a full-length job. This skill
  teaches a nine-line templated prompt and asks for seven of them, which makes
  it the single most likely place in the repo for someone to reach for that
  flag to avoid an unwieldy command line. Reproduced 2026-09-15 with
  `--dry-run` at zero cost: a five-line prompt came back `Chaining 5 shots` /
  `SHOTS_REQUESTED 5`. The instruction — **one `--shot` per segment,
  `--shots-file` never in this skill** — is now stated where the generate step
  is, repeated at the dry-run step, given two rows in the defaults table and a
  row in the failure-mode table, with the here-doc pattern for passing long
  prompts. It is written to stand on its own: `ofox-video-core` now refuses
  the shape it can recognise (lines opening with ALL-CAPS labels), but that
  guard is a heuristic, cannot exist on an older core, and was verified not to
  catch the same prompt written as plain prose lines — which still quoted five
  jobs. `SHOTS_REQUESTED` is named as the number to check before every yes.
- **The cheap draft is thrown away, and the file did not say so.** `chain`'s
  whole mechanism is that segment 2 opens on segment 1's **real closing
  frame**, extracted from the file the run itself generated — so a standalone
  draft cannot become link 1, and `chain` always regenerates its own segment
  1. A literal reading of the old text suggested the draft carried forward and
  saved its own cost. It does not: segment 1 is paid for twice. The
  draft-cheap section now says "discarded" in those words, the cost table gets
  a rule requiring **two stages with the total added together and nothing
  subtracted**, the `--resolution` default row repeats it, and the one route
  where the draft does survive (keep it as link 1 via `last-frame` plus
  `--frame-first-image`) is offered with its two honest caveats — a visible
  tier change at the first seam, and a composition this repo has not run end
  to end.
- **The section map was called "the single most valuable input this skill
  receives" while sitting at `ask-if-open`.** A tester given tempo and mood
  but no timestamps fell through to arbitrary even segments and had to stop
  itself from presenting invented intro/verse/chorus structure as fact —
  noting that the worked example reads confidently enough to invite exactly
  that. **The tier is kept and the contradiction is resolved in the file.**
  Why kept: must-ask is reserved for axes without which there is no job at all
  (the track, the subject); a user with a song and no timestamps has a
  complete job, and blocking them would refuse work the even-segment path does
  fine. The price of keeping it is paid by a new hard rule — **you have not
  heard the track, so never present a structure you invented as one you were
  given.** With no map the segments are called *even segments* in the recap,
  in the cost table's `Section` column, in the prompts and in the hand-over;
  any proposed structure is labelled `(invented — I have not heard your
  track)` on every line it applies to; and the worked example now says in its
  own header that its track is not real and its chorus was made up.

## 1.0.0 — first release

A scenario skill for producing picture for a piece of music the user already
has: read the track locally, write the visuals to its structure, generate the
segments with `chain` so they stay continuous, and lay the user's own audio
file on at the end with `mux-audio`. Execution is delegated to
`ofox-video-core`.

**The scenario was redefined before it was built, by a measurement.** The
original framing was "generate matching visuals from this piece of music",
which reads as the model listening to the track. It does not. The API accepts
an `audio_url` reference, validates it, really fetches it and bills the job —
and the delivered clip carries a **model-generated** track, not the supplied
one: measured 2026-09-15 on job `d8561509-dcc6-4f2c-8864-a193cd239b14`, 55
cents, RMS envelope correlation 0.41 between the audio sent and the audio
returned. Every video model in the catalog also reports
`capabilities.audio_input: false`, which described the outcome better than the
parameter table's "≤3 audio clips, each ≤15s" limits did.

So **this skill never sends the user's audio to the API.** The redefinition is
the first section after the title, before any command, because it is the
expectation the request arrives with: the visuals are cut to a structure
*described* from the music — its sections, its energy, its feel — and are
**not** synchronised by the model to the waveform. Nothing here lands a cut on
a particular snare hit, and the skill says so in the first reply rather than
after the bill. That claim is backed rather than hedged: cut timestamps inside
one job land to about **±1 second** when they land at all, and a 15-second job
that wrote three explicit hard-cut stamps kept one of them and delivered two
nobody asked for (`9cd773d0`). A second is several beats at any dance tempo.
When beat-frame-accurate cutting is the actual requirement, the skill says to
generate longer continuous material and cut it in an editor.

**The multi-job cost warning is the other thing this skill exists to say.**
One job is one clip of at most 30 seconds, so the segment count is arithmetic,
not a preference: `ceil(track duration / the model's maximum duration)`. A
three-minute song is **six separately billed jobs**; 3:12 is seven. The cost
table is therefore built as *track length → segment count → total*, with three
lines above it naming the track's real duration, the model's ceiling and the
resulting segment count, and rows per segment — never a single segment's price
for a whole song. Someone shown one segment's price and then billed for six
has been misled by the skill, not by the API. Every figure comes from
`chain --dry-run`, which prices the whole sequence in one `Estimated cost:`
line (it says "takes" where it means shots; the skill says so rather than
letting it read as a different unit). No price is written down anywhere in the
file.

Also in this release:

- **Four steps, each with its boundary stated**: `ffprobe` for the duration,
  the user for the section map, `chain` for the segments, `mux-audio` for the
  track. `mux-audio` is named as **the only way** to get a specific track onto
  a clip — local, no API call, no key, no cost — and its behaviour is passed
  through honestly: it replaces the clip's own audio rather than mixing, runs
  to the shorter of the two inputs, and prints a `NOTE:` naming which one was
  cut when they differ by more than half a second. The skill requires that
  note to be relayed.
- **Section boundaries decide segment boundaries.** Derived from the ±1 second
  tolerance: a boundary that drifts a second at a section change reads as an
  edit, one that drifts a second inside a phrase reads as a mistake. `chain`
  takes one `--duration` for the whole run, so the two ways to get uneven
  segments are documented — round the sections to a shared length, or generate
  the odd one with `last-frame` plus `--frame-first-image` — with the note that
  the mixed sequence has never been run end to end here.
- **Cut density is written as a register, not a number**: dense 2–3s a shot,
  mid 3–5s, or one continuous shot with a travelling camera. Backed by the
  measured hard-cut-mix finding — a timeline where only 3 of 9 boundaries were
  labelled hard cuts rendered **none** of them, while 3-of-8 and above rendered
  every one — so "weight the segment toward hard cuts if you want a cutting
  rhythm" is advice with evidence rather than taste. The measured envelope
  inside one job (10 shots, up to 6 hard cuts, 8–30s, 480p and 720p) is stated
  as the edge it is.
- **BPM belongs in the arithmetic, not the prompt.** A quantity attached to a
  description has been measured repeatedly as a wish — `a full 360 degrees`
  came back as about half a turn, twice — so the skill spends the tempo on
  choosing the register and the segment count, and names the one time-axis
  instruction measured to hold: a budget ("at most 0.2 seconds of slow motion,
  only at …").
- **No music in the prompt, with three stacked reasons**: the mux replaces the
  track anyway so a generated score is bought and discarded; asking this model
  for music has failed output moderation on copyright here (unbilled), which on
  a chain stops the whole run; and `--generate-audio false` removes the audio
  stream entirely rather than muting it, which is exactly the state wanted
  before a mux. `false` is the default on every segment, with the music words
  in `AVOID` as well as `No music.` in the sound line.
- **Lyrics on screen are refused up front.** Text rendered from a description
  comes back invented or garbled; text approved on a still and attached as a
  frame is preserved. Lyrics go on in an editor, where they are free, correct
  and actually timed to the waveform.
- **The performer wall is stated before anyone plans a band.** A photoreal
  person in an attached frame is refused at submission on
  `bytedance/seedance-2.5` (`input_moderation_failed`, nothing billed), and
  `chain` attaches a frame to every segment after the first — so a photoreal
  performer cannot be carried across a piece on this model. Four workable
  shapes are given instead, and the two models measured accepting a real-person
  portrait are named **with** the fact that their chaining behaviour is
  untested here.
- **A skip table at the top and a "when NOT to use" at the bottom**, both
  turning on one question: is there a particular audio file the finished video
  has to carry? `shorts-reels`, `seedance-ad-creative`, `seedance-anime-drama`,
  `explainer`, `talking-head`, `keyframe-animation` and `video-extend-edit` are
  each routed to by name, and the skill states that the visual *style* remains
  another scenario's craft.
- **A five-question brief**, with `Track` and `Visuals` as must-ask rows
  carrying no "Let the AI decide" — a file that does not exist cannot be
  invented, and six segments of the model's own guess at a subject is an
  expensive way to discover that. Skip rows route "cut on the beat" to the
  expectation correction and "with the lyrics on screen" to the editor.
- **An unmeasured-edges section written as "no evidence yet", never as
  "impossible"**, so a later measurement adds a path rather than overturning
  the file. It covers whether an audio reference conditions the *visuals* at
  all (undecided) — **and why that is still undecided**, which is the
  transferable part: the obvious experiment, same prompt with and without
  audio, cannot isolate the variable, because a fixed seed does not make this
  API reproducible (three submissions of one byte-identical request on seed
  `424242`: two completed as visibly different clips, one failed outright). A
  control arm that unstable makes any difference in the audio arm
  indistinguishable from run-to-run noise, so settling it needs a distribution
  comparison, not a repeat. Also covered: whether a six or seven segment chain
  holds, and endings when the picture outruns the track.
- **Endings are explicitly unsettled.** The arithmetic rounds the segment count
  up, so the picture is normally longer than the song and the mux trims the
  tail — meaning whatever was written as the final beat may never be seen. The
  three ways out are named and **this round chooses none of them**; the working
  advice is to end the last segment on a held picture and tell the user the
  tail is trimmed. The reverse case (picture shorter than the track, so the
  song is cut off mid-phrase) is called out as the one to avoid.
- **This skill has no paid run of its own**, and the evidence table says so
  line by line — which claims are measured jobs, which are the skill's own
  reasoning. The approval-gate section requires that sentence in the same
  message as the cost table, and there is no cost anchor because there has
  never been a bill.
- **No hardcoded model, price, resolution, duration or aspect-ratio table.**
  Those are catalog facts; the skill points at `models`, `providers MODEL` and
  `--dry-run`, and notes that the axis mattering most here is the model's
  *maximum duration*, because it decides the segment count and therefore the
  shape of the bill.
- **`ffmpeg` is declared in `requires.bins`** alongside `curl` and `jq`, and
  the availability-check section checks it separately — `ofox-video.sh check`
  does not. It is a hard dependency here rather than an enhancement: the last
  step of the deliverable is a local mux, and `chain` refuses to start a
  multi-shot run without it.
- **An after-it-lands checklist** — does the muxed file carry the right audio
  all the way to the end, did the cuts happen (read frames, never a scene
  detector's count, which under-reports cuts whenever two shots share a
  location and a light), do the seams hold, was any lettering invented.
- **The core-directory probe ships from day one and sits above the first
  command that uses a hardcoded sibling path**, so the skill works on
  LobeHub's `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.

**What a caller has to do**: install `ofox-video-core` **1.25.0 or newer**
beside this skill — that is the version `mux-audio` arrives in, and without it
the last step of this skill does not exist — and have `ffmpeg` on the machine. `npx ofox-skills` installs every skill in this repo,
which is what keeps the sibling path resolvable.
