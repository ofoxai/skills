# ofoxai/skills

High-standard, open-source [agent skills](https://www.skills.sh/ofoxai/skills) from **OFOX AI** —
one monorepo so every skill ships with the same quality bar (clear safety
contracts, real-tool recipes, no leaking of secrets or local paths).

Skills work with Claude Code, Cursor, Copilot, and 70+ other agents via
[skills.sh](https://skills.sh).

[简体中文](README.zh-CN.md)

```
npx ofox-skills          # install every skill into every agent on this machine
npx ofox-skills doctor    # check which agents can actually see them
```

No account needed to price a job — see below. Read that part first: twelve of
these skills spend real money.

## The video and image skills cost real money — here's how to check before you commit

The ten video skills — the four `seedance-*` ones plus `keyframe-animation`,
`product-demo`, `ugc-ads`, `shorts-reels`, `talking-head` and `explainer` —
call Ofox's video API, which runs
[Seedance 2.5](https://ofox.ai/models/bytedance/seedance-2.5?utm_source=github&utm_medium=readme&utm_campaign=skills)
and bills per second of generated video. A 15-second 720p clip runs about
**$3.60**; a 4-second 480p draft is about **$0.44**, and there are cheaper
models. Generation is a slot machine — you often want several takes and keep
one — so the per-clip figure is not the whole cost.

The two image skills — `image-edit` and `product-image` — call the image API
instead, which bills per **output token**, so there is no such thing as one
price per picture: the same model has been measured 26x apart across two
flags. Cents rather than dollars, but quote it rather than assume it. Two
things make that worth doing properly. An *edit* also bills the picture you
upload, so a large source costs more than a small one; and a set of four is
four bills, which is why `product-image` quotes the set's total and never the
per-image figure.

**You can price any of this with no account and no API key.** Install, then:

```
bash ~/.agents/skills/ofox-video-core/references/ofox-video.sh \
  generate --dry-run --prompt "two people arguing in a kitchen" \
  --duration 15 --resolution 720p
# Estimated cost: ~$3.60 (15s x $0.24/s)
# DRY RUN — nothing was submitted and nothing was billed.
```

`~/.agents/skills/` is where the installer keeps the canonical copy, and every
agent reads it — directly, or through a symlink of its own. Claude Code also
exposes the same skill at `~/.claude/skills/ofox-video-core/`, but that path
only exists if Claude Code is installed, so the line above is the one that
works everywhere.

The image side has the same escape hatch, including for an edit of a file you
already have:

```
bash ~/.agents/skills/ofox-image-core/references/ofox-image.sh \
  edit --dry-run --image ./photo.jpg --prompt "replace the background with a beach"
# DRY RUN — nothing was submitted and nothing was billed.
```

`--dry-run` validates everything and quotes the price without sending a
request. `ofox-video.sh models` / `providers` and `ofox-image.sh models`
likewise need no key. Decide whether it's worth it, *then* sign up.

When you are ready: get a key at [app.ofox.ai](https://app.ofox.ai/?utm_source=github&utm_medium=badge&utm_campaign=skills)
(Settings → API Keys → Create New Key, shown once), then

```
export OFOX_API_KEY=your_key_here
```

Already running Codex / Claude Code / Cline with an Ofox key configured? The
same `OFOX_API_KEY` works — no new key needed.

**Prerequisites**: `curl` and `jq`. `curl` is usually preinstalled; `jq` often
isn't (`brew install jq` on macOS, `apt-get install jq` on Debian/Ubuntu). The
skills check for both and tell you what's missing.

`hal-vault`, `hal-image` and `cloudflare-drop` don't touch the Ofox API and
cost nothing to run.

## Every clip is recorded, and can be aimed at again

Generation is a slot machine, so the take you keep is worth being able to
describe afterwards. Each finished clip lands as `<name>-<short job id>.mp4` —
pass `--name` and it is named after the scene instead of a bare job id — with
a `.json` sidecar beside it holding the full job id, the prompt, the seed, the
request as submitted, and what it actually cost.

The seed is the part that matters. Without one the server picks its own and
reports it nowhere, so "that take was good, give me it at 1080p" has nothing
to point at. Recorded, the whole request can be re-submitted at a different
resolution.

**What that is not is a reproduction.** Measured 2026-09-15: three submissions
of one byte-identical request on a fixed seed came back as two visibly
different clips and one refusal. A re-render aims at a take; it does not
return it — and these skills are written to say so before anyone pays for one.

To see what this looks like at the other end, the
[Seedance 2.5 prompts and examples](https://ofox.ai/seedance-2-5-prompts?utm_source=github&utm_medium=case&utm_campaign=skills)
page on ofox.ai publishes finished clips with the prompt and parameters behind
each one — and, for the clips generated with these skills, the job id and the
real bill.

## Install

```
npx ofox-skills
```

Every skill, into every agent on your machine, at user level. That combination
is the default because the other combinations break quietly:

- **Every agent**, because `skills add` on its own asks you interactively which
  agents to install to — and when an *agent* is the one running it, skips the
  question and installs only to the agent it detects. Either way the agents you
  didn't pick get nothing, and you don't find out until one of them can't see a
  skill you know you installed.
- **Every skill**, because each scenario skill reaches its execution layer by
  relative path, which only resolves when they sit side by side — the video
  scenarios need `ofox-video-core`, `image-edit` and `product-image` need
  `ofox-image-core`, and `seedance-anime-drama` needs both. The skills.sh
  manifest format has no dependency field to declare that with, so installing
  one alone can leave you with:

  ```
  bash: ../ofox-video-core/references/ofox-video.sh: No such file or directory
  ```

  That means the core skill is missing, not that the skill is broken.

### Check what your agents can actually see

```
npx ofox-skills doctor
```

Lists every skill in this repo with the agents it is currently linked into, and
exits non-zero if any are missing. Worth running when an agent insists a skill
doesn't exist — usually it is right, and this says which ones and why.

It checks user-level (global) skills, which is where the default install puts
them, and names that scope in its own output. If you installed with
`--project`, ask for the same scope:

```
npx ofox-skills doctor --project
```

If everything is listed but an agent still can't see it, restart the agent;
most read their skills once at startup.

### Narrower installs

Any flag you pass overrides the matching default:

```
npx ofox-skills --agent codex               # one agent, still every skill
npx ofox-skills seedance-short-drama        # one skill, still every agent
npx ofox-skills --project                   # this project instead of user level
```

The underlying CLI works directly too, if you'd rather not go through this
package — but then the defaults are yours to supply:

```
npx skills add ofoxai/skills --skill '*' --agent '*' --global --yes
```

## Skills

Seventeen skills in three groups. The one-liners below are deliberately short —
each `SKILL.md` carries the full contract, the flags, and the measured costs.

### Video — Ofox video API (Seedance 2.5), bills per second

| Skill | What it does |
|-------|--------------|
| [seedance-short-drama](skills/seedance-short-drama/SKILL.md) | Dialogue-driven scenes with real humans. Writes the shot list, quoted lines and delivery notes; one held take or several hard cuts inside one job. |
| [seedance-ad-creative](skills/seedance-ad-creative/SKILL.md) | Cinematic brand/product ads — hook, showcase, slow-motion climax, hero close. From a product photo or a text description. |
| [seedance-product-video](skills/seedance-product-video/SKILL.md) | Plain catalog/listing footage — white background, simple orbit or turntable, literal accuracy, no mood lighting. A product photo gives the best fidelity; a text description works for a generic or fictional product. |
| [seedance-anime-drama](skills/seedance-anime-drama/SKILL.md) | Anime/manga storyboard shots. Generates the character image first, then animates it, so the same character survives across shots. |
| [keyframe-animation](skills/keyframe-animation/SKILL.md) | Two stills you already have: image A as the first frame, image B as the last, in one job — the model fills the middle. Both ends come back honoured to the pixel, and the motion arrives early and then holds. |
| [product-demo](skills/product-demo/SKILL.md) | Two screenshots of your interface, before and after a state change, animated as one clip. The model cross-fades only the values that differ; the strings stay legible, so this one carries no anti-text rule. |
| [ugc-ads](skills/ugc-ads/SKILL.md) | Handheld, phone-shot creator clips — unboxing, first impression, honest review. Deliberately inverts the polish the other scenarios default to: one practical light, imperfect framing, no grading, no beauty filter. |
| [shorts-reels](skills/shorts-reels/SKILL.md) | Several cheap vertical 9:16 drafts in one priced batch, a contact sheet to pick from, then one proper re-render of the winner. Brings the format and the economics; the prompt comes from whichever scenario skill fits. |
| [talking-head](skills/talking-head/SKILL.md) | A portrait plus a short script, as one person saying those words to camera. You supply the text and the model generates the voice — audio can't be uploaded. The only skill here that doesn't default to Seedance 2.5: it refuses a real person's photo, so this one runs on `wan-3.0-prime`. |
| [explainer](skills/explainer/SKILL.md) | An article, doc or release note as a short spoken clip. A 30-second clip holds about ninety words — under a tenth of a 1,200-word post — so it doesn't summarise the piece. It picks the one idea worth saying, and helps you choose which. |
| [ofox-video-core](skills/ofox-video-core/SKILL.md) | **Library.** The execution layer the ten above call: submit, poll, download, report the real cost. Install it, don't invoke it — unless you're driving the API directly. |

### Image — Ofox image API, bills per output token

| Skill | What it does |
|-------|--------------|
| [image-edit](skills/image-edit/SKILL.md) | One change to a picture you already have — swap the background, recolour a part, remove an object — written as two sentences so what must *not* change is stated and checkable. One image in, one out. |
| [product-image](skills/product-image/SKILL.md) | A set of product images to choose between: several styles or backgrounds of one product, each an edit of the same photo so the item stays itself, priced as the set's total rather than per image. |
| [ofox-image-core](skills/ofox-image-core/SKILL.md) | **Library.** Every image model Ofox serves, `--model` defaulting to a cheapest-first chain that falls back and says so. Generates from text, or **edits an image you already have** (change the background, recolour an element) from a local file. Prices a job with `--dry-run`, then reports real token usage and dollar cost. |

### Free to run — no Ofox API, no per-call cost

| Skill | What it does |
|-------|--------------|
| [hal-vault](skills/hal-vault/SKILL.md) | SSH-key encrypted secret store. Masked by default, so an agent can search and inject a credential without ever printing it. |
| [hal-image](skills/hal-image/SKILL.md) | ImageMagick recipes — resize, crop, composite, montage, watermark, convert — plus lossless compression before sending, so transfers stay small. Needs `magick` installed. |
| [cloudflare-drop](skills/cloudflare-drop/SKILL.md) | A folder of static files to a live shareable URL. Permanent when `CLOUDFLARE_API_TOKEN` is set, a 60-minute claimable preview when not — and it says which one you got, verifies the served content, and refuses to invent a link. Optional `-otp` protects permanent links with a server-side six-digit access code. |

## Why a monorepo

One repo, one quality bar. Each skill is self-contained under `skills/<name>/`
(a `SKILL.md` plus optional `references/`), declared in
[`skills.sh.json`](skills.sh.json). Publishing many skills from a single
high-standard repo is easier to govern, version, and review than a repo per
skill — and consumers can still install any skill individually with
`ofoxai/skills@<name>`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the bar every skill must clear.

## Related

- [ofoxai/awesome-seedance-2.5](https://github.com/ofoxai/awesome-seedance-2.5) —
  the Seedance 2.5 prompt and clip collection: official and community cases
  plus the ones generated with these skills, every case with its prompt and
  parameters, the self-run ones with the bill. The prompts page on ofox.ai
  is its on-site mirror.
- [ofoxai/hal-vault](https://github.com/ofoxai/hal-vault) — the SSH-key
  encrypted secret store the `hal-vault` skill drives (Go CLI, built on
  [age](https://github.com/FiloSottile/age)).

## License

MIT © OFOX AI
