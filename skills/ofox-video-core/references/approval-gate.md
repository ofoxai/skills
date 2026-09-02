# The approval gate

**One spec, shared by every Ofox skill in this repo** — `ofox-video-core`,
`ofox-image-core`, and every `seedance-*` scenario skill built on them. They
link here rather than each restating the rule, because four paraphrases of
"show the price first" drift into four different rules, and the one that
drifts is the one that spends someone's money without asking.

It lives in `ofox-video-core/references/` because that is the one skill every
scenario in this repo depends on. If you are reading a skill that links here
and the file is missing, the skill was installed without `ofox-video-core` —
the rule below still applies; `npx skills add ofoxai/skills` gets you the
whole repo.

## The rule

**Never send a billable request until the user has seen a cost table and
said yes.**

Not "mentioned the price in a sentence". A table, then an explicit yes, then
the spend. The user is not only approving a number — they are approving a
model, a prompt, a resolution and a quantity, any of which can waste the
money more thoroughly than a wrong price would.

## The table

Every row is one billable unit. Required columns:

| Model ID | Type | Parameters | Unit price | Qty | Est. cost |
|---|---|---|---|---|---|
| `bytedance/seedance-2.5` | video (t2v) | 8s, 720p, 16:9 | 24 cents/s | 1 | ~$1.92 |

- **Model ID** — the full id that will actually be sent, resolved before the
  table is printed. Never "the default" or "the cheapest one"; if a fallback
  happened, name the model that won and say what it replaced (see below).
- **Type** — `image`, or `video (t2v)` / `video (i2v)` / `video (v2v)`. What
  the job is and what tier it bills at are two different facts, and the table
  needs both: an image-to-video job bills at the **t2v** tier (verified by a
  real i2v run billing 4s x $0.11 at 480p — the t2v rate, not the v2v $0.14),
  and only a *video* input moves a job to v2v, where 1080p Seedance 2.5 is
  $0.71/s against t2v's $0.60/s. Take the tier from the dry run, never from
  an assumption about which input types "ought to" cost more.
- **Parameters** — whatever moves the price or the result: duration,
  resolution, aspect ratio, size, quality, takes, seed if pinned.
- **Unit price** — per second for video, per output token for an image.
- **Est. cost** — copied from the script's own estimate line. Not recomputed.

**Show the full prompt with the table, not just the price.** The user is
paying for the prompt — what the character looks like, how the camera moves,
whether their dialogue survived word for word. A clip that costs exactly what
you quoted and shows a character they never pictured is still a wasted job.
Put the prompt text in the message, in full, next to the table.

## Where the numbers come from

**Only from the script's `--dry-run` output. Never from your own
arithmetic.**

The two scripts live in two different skills, so the path depends on where
you are running from. From a `seedance-*` scenario skill's own directory:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate --dry-run \
  --prompt "..." --duration 8 --resolution 720p
bash ../ofox-image-core/references/ofox-image.sh generate --dry-run \
  --prompt "..." --quality standard
```

From inside `ofox-video-core` or `ofox-image-core` itself, its own script is
`references/ofox-<video|image>.sh`. There is no `references/ofox-image.sh`
under `ofox-video-core` — that path fails with "no such file", which is a
confusing way to discover you skipped the quote.

Both print exactly one `Estimated cost:` line, always — including when they
cannot produce a figure, in which case the line says why. Relay whichever
line you get. Multiplying a rate by a duration yourself is how a table ends
up quoting a tier the job will not actually bill at.

`--dry-run` validates everything, resolves the model, builds the payload and
stops before the request. Nothing is submitted, nothing is billed, and no
`OFOX_API_KEY` is needed — pricing is exactly what someone does *before*
signing up.

The estimate a *real* run prints appears microseconds before the request goes
out. By the time you could relay it, the job exists and is billable. That is
what `--dry-run` is for.

### When there is no estimate

**Show the table anyway, write "cannot be predicted — `<reason>`" in the cost
column, and still wait for a yes.** Approving an unknown price is the user's
call to make; skipping the gate because the number is missing is not.

This is the normal case for images: an image bills per output token, and the
token count only exists once the response comes back. `ofox-image.sh` can only
produce a figure for a model whose token count was measured on a real earlier
call (`ofox-image-core/references/token-anchors.json`), and it labels that
figure **ROUGH**. Relay it as rough. Never present it as a quote, and never
borrow one model's measured token count for another model — a borrowed number
is indistinguishable from a measured one and is worth less than no number.

### When a model fell back

The image chain is a priority, not a lock: if the preferred model is
unavailable, the script drops to the next one and reports
`MODEL_FALLBACK_FROM`, `MODEL_FALLBACK_REASON` and `MODEL_PRICE_DELTA`. All
three go in front of the user, alongside the model actually chosen. "We are
using B instead of A because A is deprecated, and B costs 1.8x more per
output token" is a fact the user may want to act on — by picking a different
model, or by not spending at all.

When the price gap cannot be quantified, `MODEL_PRICE_DELTA` says which of
the two models has no published rate. Relay that as it stands; do not round
it up into "it costs more" — an unknown gap is not a known one.

If instead you get `MODEL_CHAIN_EXHAUSTED`, nothing in the chain is usable
and the model in the table is one the script expects the API to reject. Say
that plainly before asking for approval. A yes to a job that cannot run is
not consent to the retry you would pick afterwards.

## Batches get an itemised table, not one total

Multiple takes, multiple shots, multiple keyframes: **one row each, plus a
total row.** A total on its own hides the shape of the spend, and the shape
is the decision. Four 480p drafts and one 1080p master can come to nearly the
same money and mean completely different things.

When one usable clip is the goal, say plainly that the **total** is what that
clip cost — `BATCH_COST_TOTAL`, not `BATCH_COST_PER_TAKE`. If one take in
four is usable, the per-take figure understates its cost by 4x.

## Two-phase flows: two approvals

A skill that generates an image and then feeds it into a video (today:
`seedance-anime-drama`) asks **twice**, not once.

The reason is not politeness. Phase 2's prompt depends on what phase 1
produced: the video opens on that exact image. Before the image exists, the
user cannot tell whether it is worth paying to animate — and for a skill
whose entire selling point is character consistency, what the character looks
like is only knowable by looking at it.

- **Approval 1 (image)**: the image table, plus a heads-up of roughly what
  phase 2 will cost, so nobody agrees to a first step without knowing the
  size of the second.
- **Approval 2 (video)**: the video table, plus **what phase 1 actually
  billed** and the **running total**. Quote the video phase at the tier the
  dry run reports for the job as configured, first frame attached and all.

If the user rejects phase 2, phase 1's spend still happened. Say so; do not
present the image as free because the video never ran.

## Afterwards: the actual bill

An estimate is never a bill. Once the job finishes, report the real figure
the script printed — `VIDEO_COST` from the job's own usage, `IMAGE_COST`
computed from the response's own token counts — as money (`$1.92`), not as a
raw ten-decimal string. If the actual differs noticeably from the estimate,
say so rather than letting the earlier number stand.

## What counts as approval

- An explicit yes to **this** table. Not "sounds good" to an earlier,
  different plan.
- Approval is for the table shown. Change the model, resolution, take count,
  duration or prompt afterwards and it is a **new** table needing a new yes —
  those are the four things that move the price and the one thing that
  decides whether the output is usable.
- A user who says "just do it, stop asking" has approved the current job.
  Take them at their word for that job; quote the next one anyway if it costs
  materially more.
- Silence is not approval. Neither is the absence of an objection.

## Why this exists at all

`ofox-image-core` used to refuse to default `--model`, on the grounds that the
image models differ ~4x in price and picking one would silently pick a price
on the user's behalf. It now defaults to the cheapest available model, and
**this gate is the exchange**: the price is put in front of the user before
every spend, default or not, so the default no longer decides anything
quietly. Weaken the gate and that trade stops holding.
