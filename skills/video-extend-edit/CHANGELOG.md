# Changelog

All notable changes to the **video-extend-edit** skill. Versioning follows SemVer.

## 1.0.1 — two holes found by blind routing testers, both on the money path

Routing itself was correct in every blind test. These are defects in the file,
found by testers who followed it literally.

- **The audio hand-off was a hole, and the default it shipped was broken.**
  The join recipe strips audio from both parts with `-an` and then said to
  "lay the final track on afterwards with `mux-audio joined.mp4 track.m4a`" —
  without ever saying where `track.m4a` comes from. In this skill's own
  scenario that recipe, followed literally, hands the user a fifteen-second
  video whose generated nine seconds are silent, and nothing flagged that as
  the default outcome. A new section, **"The audio hand-off"**, names the
  three honest endings — the source clip's own track padded out, keeping the
  model's generated track and accepting a hard cut between two unrelated
  soundtracks, or deliberate silence — with the commands for each and an
  explicit note that **which one sounds best is craft, not a measurement.**
- **And it contained a worse trap than silence.** `mux-audio` runs to the
  **shorter** of its two inputs, so muxing the source clip's own unpadded
  track onto the joined file **destroys the segment that was just paid for**.
  Reproduced locally at zero cost: a 14-second joined picture and a 5-second
  track produced a **5.0-second** file. The padding step is therefore written
  as mandatory, the script's own `NOTE:` is quoted as the thing to act on, and
  the case has its own row in the failure-mode table. Every command in the new
  section was run end to end on real files before being written down.
- **"The source clip's own tier" was a default nobody could execute.** The
  recommended-defaults table said to match the source's resolution tier but
  never said how to map an arbitrary `WIDTHxHEIGHT` onto a tier — a tester
  with a 1080x1920 phone clip had to guess and said so. A new subsection gives
  a decidable rule (**short side → the highest offered tier at or below it**,
  with the tier list read live rather than hardcoded) and states plainly that
  **nothing measures which tier "matches" a source best**: what is measured is
  that the delivered size comes from the tier and the frame's ratio, and the
  join rescales everything anyway, so this choice decides how much detail
  exists to be scaled and what the segment costs — not the finished file's
  size. Tiers not written as a pixel height are called out as outside the
  rule, and dropping a tier to save money is named as a legitimate row in the
  cost table rather than a mistake.
- `--generate-audio`'s default row now says what it really is: the audio
  decision, made **before** the paid job, because only the keep-the-model's-
  track ending needs `true`.
- The hand-over section now says the deliverable is the `-with-audio.mp4` file
  when a track was muxed on, and that the chosen ending has to be stated —
  a user cannot hear an ending from a path.

## 1.0.0 — first release

A scenario skill for the case where the user already has footage and wants
more of it: a frame is pulled out of their clip locally for nothing, handed to
a new video job as its first frame, and the result is joined onto the
original. Three routes over one mechanism — `last-frame` to extend, `frame-at`
to replace the ending from a chosen second, and `chain` for several segments.

**The route this skill does not take is the one its planning document named.**
Video-to-video via `input_references` was the obvious candidate and is
measured not to reach what it promises: a video reference leaves a single
job's duration ceiling unchanged, so there is no mechanism there for extending
a clip past one job's length; it requires a publicly reachable URL with no
local-file form; it bills at the dearer video-to-video tier; and the one real
run on it could not distinguish continuing a scene from a style reference
redrawing a near-static picture. The frame route is cheaper, takes a local
file, and anchors on an actual frame. Video-to-video is recorded under
"Unmeasured edges" as *no evidence yet*, phrased so that a later measurement
adds a second route rather than overturning this file.

**Built on one paid run, two zero-cost readings and one local reproduction,
and the skill says which is which throughout.** Job `35b6aed1` (2026-09-15),
`bytedance/seedance-2.5`, 4 seconds, 480p, one frame attached, **44 cents
billed against a 44-cent estimate**. The input was built to be hostile in
exactly one way: a frame taken out of an existing 854x480 clip with
`frame-at --at 6.5`, then resized to 720x480 — a 3:2 shape that is not in the
model's aspect-ratio list at all. Four findings came out of it:

- **A frame whose shape is not in the catalog is accepted.** No rejection of
  any kind. The skill therefore does not tell anyone their clip has to be
  16:9, because that would be false.
- **The delivered segment's pixel dimensions never come from the source
  clip.** Three observations — 1792x1008 in at 720p gave 1280x720 twice, and
  720x480 in at 480p gave 794x530 — all keeping the ratio and none keeping the
  size. The rule is written as "dimensions come from the tier you paid for and
  the frame's ratio"; **no formula for a non-catalog ratio is published**,
  because one data point cannot support one.
- **Which is why the join needs a rescale, and why skipping it is silent.**
  A plain `concat -c copy` across the two sizes does *not* error: it produces
  a variable-resolution mp4 whose container header advertises only the first
  part's size. Reproduced locally at zero cost — header 854x480, frame at 4
  seconds really 794x530. Not erroring is worse than erroring, so this is the
  most prominent thing in the file, with a normalise-then-join recipe that was
  run end to end across a size change, a frame-rate change and mixed audio
  presence, plus a verification loop that is the only thing which catches the
  silent case.
- **The result continues the scene rather than reproducing the fed frame.**
  The camera measurably pulled back and the prompted ripples appear where the
  source clip has none. The promise is therefore worded as **continuity of the
  same set and subject** — never "keeps the style", which nothing measured
  here supports.

Also in this release:

- **A pre-flight look at the extracted frame, before any money moves.** A
  photoreal person in an attached frame is refused at submission on
  `bytedance/seedance-2.5` (`input_moderation_failed`, unbilled), so the route
  stops there for live-action footage of people. The fallbacks are stated
  precisely rather than hopefully: `alibaba/wan-3.0-prime` and
  `minimax/hailuo-3` were measured accepting a real person's **portrait
  image**, which is not a frame lifted out of footage, and **neither model's
  image-to-video behaviour has been measured in this repo at all**. The
  measured run here deliberately used a clip with no people, so it says
  nothing about real-person footage in either direction.
- **"Re-shooting from second N regenerates everything after N" is stated
  before the routes**, where a reader hits it while planning rather than
  afterwards. There is no mechanism for changing the middle of a clip and
  keeping its ending.
- **`chain --frame-first-image` is documented with its evidence split out.**
  The flag reaching shot 1 was confirmed locally at zero cost by observing
  that shot 1 raises `references_conflict` only when a frame is present; both
  halves of the composition are measured separately; **the composed command
  has not been run end to end**, and the file says so and offers the
  one-`generate`-per-segment alternative for anyone who wants only measured
  ground.
- **No hardcoded model, price, resolution or duration table.** Those are
  catalog facts that move, and the skill points at `ofox-video.sh models` /
  `providers` / `generate --dry-run`. The single cost figure it prints carries
  the exact parameters it was measured at.
- **An ffmpeg check of its own.** `ofox-video.sh check` covers `curl`, `jq`
  and the key but not ffmpeg, and this skill cannot run one step without it.
- **The core-directory probe ships from day one**, above the first example
  containing a hardcoded path, so the skill works on LobeHub's
  `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.
- **A routing table with eight rows**, including the two that are easiest to
  get wrong: "change what is in the picture" has no path in this repo at all
  (`image-edit` is a single still, not footage), and a multi-shot sequence
  with no existing footage is core's `chain` directly rather than this skill.
- Shared prose is linked, not restated: the approval gate, the prompt formula
  and the pre-prompt question rules all live in `ofox-video-core/references/`.

**What a caller has to do**: install `ofox-video-core` beside this skill, at a
version that has `frame-at` — `last-frame` is older, so on a core without
`frame-at` the extend route still works and only the replace-the-ending route
is unavailable. `npx ofox-skills` installs every skill in this repo, which is
what keeps the sibling path resolvable. `ffmpeg` is required for every route.
