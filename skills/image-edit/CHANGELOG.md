# Changelog

All notable changes to the **image-edit** skill. Versioning follows SemVer.

## 1.0.0 — first release

The first of two **image** scenario skills in this repo. Every scenario skill
before these produced video and delegated to `ofox-video-core`; this one
delegates to `ofox-image-core`, whose documented delegation contract had never
had a real scenario caller until now.

It exists because `ofox-image-core` 1.11.0 added `edit` (`POST
/v1/images/edits`) a few hours earlier. Before that there was nothing for this
skill to sit on.

**One image in, one edited image out**, and the craft is the second half of
the instruction rather than the first. The skill's whole shape is built around
the fact that the interesting question is not "what should the picture look
like" — the picture already exists — but "what must survive", and that the
answer to that is what makes a result checkable at all.

**The instruction is two sentences and the second one is the one people leave
out.** Name the change concretely, then name what must not change concretely.
Without the second sentence, "did this work?" is a question about your memory
of the source rather than about specific pixels.

**The source file is opened and confirmed before it is trusted.** A path in a
request is a claim about which file, and a wrong source does not fail — the
edit succeeds, bills, and hands back a correct edit of the wrong picture. The
skip row that says not to ask whether there is a file now also says to look at
it, and to say what you actually see if it does not match the request rather
than proceeding on the theory that the user knows their own folder. Same rule,
same wording, in `product-image`, where a wrong source costs four calls
instead of one.

**One change per call**, argued from a measurement rather than from taste: at
`--n 2` both token components scaled exactly with the count, so two calls cost
what one call with two clauses costs. There is no saving to trade the control
away for.

**The evidence and its boundary are stated together, everywhere.** The
endpoint genuinely edits rather than redrawing — a UI screenshot asked for one
button colour change returned every string verbatim, mean absolute difference
5.27/255 overall against 84.27 inside the button, a region that is 1.1% of the
frame carrying 58% of substantially-changed pixels, replicated three times.
That is what makes "leave the rest alone" a reasonable thing to write. It is
also three runs on **one** model, on inputs with hard edges and flat colour,
which is why the verify-the-artifact step is an instruction rather than an
assumption.

**This skill has generated nothing of its own**, and says so in its third
paragraph. Every measured figure names the run it came from: `ofox-image-core`
built the `edit` subcommand and measured it, and two probe calls were made
directly against `ofox-image.sh` on 2026-09-15 while this file was written.
None of them came through this skill's flow.

**No model, price or size table.** Edit support is `models --endpoint edits`,
read live from each model's `supported_endpoints`; prices are whatever
`--dry-run` prints, relayed as the line prints rather than as a figure copied
into prose. `--model` is omitted so `ofox-image-core` resolves its own chain
against the edits endpoint.

**The dry run is documented as the guard, not a politeness.** `POST
/v1/images/generations` refuses a bad `--quality` for free; `POST
/v1/images/edits` does not — measured 2026-09-15, an unknown value was
silently ignored, rendered and billed on six models. On this endpoint the
client-side checks are the only thing between a typo and a bill.

**The input image decides the output's shape and part of the price**, with
both stated as one model's three runs rather than as general behaviour: the
output follows the input's ratio at a near-constant ~1.57 MP, and the uploaded
picture is billed — 576 of 608 input tokens on an 854x480 source — at a rate
that is *not* linear in pixels.

**Routing is explicit in six directions**, because a fresh agent picks a skill
from the descriptions and the "When NOT to use" list: `ofox-image-core` for a
text-to-image render or low-level API work, `product-image` for a set,
`seedance-product-video` / `seedance-ad-creative` when the deliverable is
video, `seedance-anime-drama` for character images inside its own consistency
flow, and `hal-image` when the change has to be exact rather than generative.
