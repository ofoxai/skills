# ofoxai/skills

High-standard, open-source [agent skills](https://www.skills.sh/ofoxai/skills) from **OFOX AI** —
one monorepo so every skill ships with the same quality bar (clear safety
contracts, real-tool recipes, no leaking of secrets or local paths).

Skills work with Claude Code, Cursor, Copilot, and 70+ other agents via
[skills.sh](https://skills.sh).

## The video skills cost real money — here's how to check before you commit

The four `seedance-*` skills call Ofox's video API, which runs
[Seedance 2.5](https://ofox.ai/models/bytedance/seedance-2.5?utm_source=github&utm_medium=readme&utm_campaign=skills)
and bills per second of generated video. A 15-second 720p clip runs about
**$3.60**; a 4-second 480p draft is about **$0.44**, and there are cheaper
models. Generation is a slot machine — you often want several takes and keep
one — so the per-clip figure is not the whole cost.

**You can price any of this with no account and no API key.** Install, then:

```
bash ~/.claude/skills/ofox-video-core/references/ofox-video.sh \
  generate --dry-run --prompt "two people arguing in a kitchen" \
  --duration 15 --resolution 720p
# Estimated cost: ~$3.60 (15s x $0.24/s)
# DRY RUN — nothing was submitted and nothing was billed.
```

`--dry-run` validates everything and quotes the price without sending a
request. `ofox-video.sh models` and `ofox-video.sh providers` likewise need no
key. Decide whether it's worth it, *then* sign up.

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

## Every clip can be reproduced

Generation is a slot machine, so the take you keep is worth being able to get
back. Each finished clip lands as `<name>-<short job id>.mp4` — pass `--name`
and it is named after the scene instead of a bare job id — with a `.json`
sidecar beside it holding the full job id, the prompt, the seed, the request
as submitted, and what it actually cost.

The seed is the part that matters. Without one the server picks its own and
reports it nowhere, so "that take was good, give me it at 1080p" means rolling
the dice again. Recorded, it re-renders the same shot at a different
resolution rather than producing a different shot.

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
- **Every skill**, because each scenario skill reaches its execution layer
  (`ofox-video-core`, and for `seedance-anime-drama` also `ofox-image-core`) by
  relative path, which only resolves when they sit side by side. The skills.sh
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

| Skill | Group | Description |
|-------|-------|-------------|
| [hal-vault](skills/hal-vault/SKILL.md) | Secrets | Agent-safe secret management: SSH-key encrypted storage, tag search, masked-by-default output — store, search, and inject secrets without ever seeing or leaking them. |
| [hal-image](skills/hal-image/SKILL.md) | Media | Agent-safe image handling: read metadata, resize/crop/composite/montage/watermark/convert with ImageMagick, and losslessly compress before sending so images stay small and transfers don't stall. |
| [cloudflare-drop](skills/cloudflare-drop/SKILL.md) | Deploy | Publish a static site (a folder of HTML/CSS/JS/images/fonts) to Cloudflare and get a live, shareable `*.workers.dev` URL in seconds. One packaged command built on the Wrangler CLI (Cloudflare's own agent guidance): permanent deploy when `CLOUDFLARE_API_TOKEN` is set, 60-minute claimable preview when not — always says which one you got. Bakes an honest expiry countdown into previews, self-verifies the served content (not just a 200), and fails open rather than inventing a link. |
| [ofox-video-core](skills/ofox-video-core/SKILL.md) | Video | Shared execution layer for the Ofox video generation API (Seedance 2.5): submits a job, polls it to completion, downloads the finished mp4 from a persistent CDN URL, and reports the real cost. A library skill every Video skill (`seedance-short-drama`, `seedance-ad-creative`, `seedance-product-video`, `seedance-anime-drama`) builds on — not typically installed on its own unless you're calling the Ofox video API directly with custom parameters. |
| [seedance-short-drama](skills/seedance-short-drama/SKILL.md) | Video | Generate a realistic-human, dialogue-driven short-drama shot from a script or scene description via the Ofox video API (Seedance 2.5): builds a shot-craft prompt (character appearance, quoted dialogue, scene-cut timing cues), shows a cost estimate, then submits, polls, downloads, and reports the real cost. Built on `ofox-video-core`. |
| [seedance-ad-creative](skills/seedance-ad-creative/SKILL.md) | Video | Generate a cinematic brand/product ad clip from a description or product photo via the Ofox video API (Seedance 2.5): builds a shot-craft prompt (product framing, camera language, brand tone), shows a cost estimate, then submits, polls, downloads, and reports the real cost. Built on `ofox-video-core`. |
| [seedance-product-video](skills/seedance-product-video/SKILL.md) | Video | Generate a clean, catalog-style e-commerce product video from a real product photo via the Ofox video API (Seedance 2.5): plain white-background prompt with a simple turntable/orbit motion (no cinematic camera language), strongly prefers image-to-video for literal product accuracy, shows a cost estimate, then submits, polls, downloads, and reports the real cost. Built on `ofox-video-core`. |
| [ofox-image-core](skills/ofox-image-core/SKILL.md) | Image | Shared execution layer for the Ofox image generation API (every image model Ofox serves; `--model` defaults to a cheapest-first priority chain that falls back and says so): validates parameters client-side, prices a job with `--dry-run` before spending, sends one synchronous text-to-image request, base64-decodes and saves the result, and reports both the real token usage and the dollar cost, computed from the published rates and verified against a real invoice. A library skill other scenario skills (e.g. a character-reference-image step ahead of video generation) build on — not typically installed on its own unless you're calling the Ofox image API directly with custom parameters. |
| [seedance-anime-drama](skills/seedance-anime-drama/SKILL.md) | Video | Turn a novel/script excerpt into an anime- or manga-style storyboard shot: writes the character description, generates the image the shot opens on via `ofox-image-core`, then animates it via `ofox-video-core`. `--frame-first-image` is the literal first frame, so a single shot wants an in-scene opening frame — a multi-view character sheet fed there makes the clip open on a grid of thumbnails. For a sequence, a sheet is generated too, once, to fix the design, and each shot gets its own opening frame written from the same description. Asks for approval twice — once for the image, once for the shots — because the shot prompt depends on the image the user has to see first. Built on both `ofox-image-core` and `ofox-video-core`. |

## Why a monorepo

One repo, one quality bar. Each skill is self-contained under `skills/<name>/`
(a `SKILL.md` plus optional `references/`), declared in
[`skills.sh.json`](skills.sh.json). Publishing many skills from a single
high-standard repo is easier to govern, version, and review than a repo per
skill — and consumers can still install any skill individually with
`ofoxai/skills@<name>`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the bar every skill must clear.

## Related

- [ofoxai/hal-vault](https://github.com/ofoxai/hal-vault) — the SSH-key
  encrypted secret store the `hal-vault` skill drives (Go CLI, built on
  [age](https://github.com/FiloSottile/age)).

## License

MIT © OFOX AI
