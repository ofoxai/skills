# ofoxai/skills

High-standard, open-source [agent skills](https://www.skills.sh/ofoxai/skills) from **OFOX AI** —
one monorepo so every skill ships with the same quality bar (clear safety
contracts, real-tool recipes, no leaking of secrets or local paths).

Skills work with Claude Code, Cursor, Copilot, and 70+ other agents via
[skills.sh](https://skills.sh).

## Install

Install everything:

```
npx skills add ofoxai/skills
```

Or a single skill:

```
npx skills add ofoxai/skills@hal-vault
npx skills add ofoxai/skills@hal-image
npx skills add ofoxai/skills@cloudflare-drop
npx skills add ofoxai/skills@ofox-video-core
npx skills add ofoxai/skills@seedance-short-drama
npx skills add ofoxai/skills@seedance-ad-creative
```

## Skills

| Skill | Group | Description |
|-------|-------|-------------|
| [hal-vault](skills/hal-vault/SKILL.md) | Secrets | Agent-safe secret management: SSH-key encrypted storage, tag search, masked-by-default output — store, search, and inject secrets without ever seeing or leaking them. |
| [hal-image](skills/hal-image/SKILL.md) | Media | Agent-safe image handling: read metadata, resize/crop/composite/montage/watermark/convert with ImageMagick, and losslessly compress before sending so images stay small and transfers don't stall. |
| [cloudflare-drop](skills/cloudflare-drop/SKILL.md) | Deploy | Publish a static site (a folder of HTML/CSS/JS/images/fonts) to Cloudflare and get a live, shareable `*.workers.dev` URL in seconds. One packaged command built on the Wrangler CLI (Cloudflare's own agent guidance): permanent deploy when `CLOUDFLARE_API_TOKEN` is set, 60-minute claimable preview when not — always says which one you got. Bakes an honest expiry countdown into previews, self-verifies the served content (not just a 200), and fails open rather than inventing a link. |
| [ofox-video-core](skills/ofox-video-core/SKILL.md) | Video | Shared execution layer for the Ofox video generation API (Seedance 2.5): submits a job, polls it to completion, downloads the finished mp4 from a persistent CDN URL, and reports the real cost. A library skill the other Video skills (`seedance-short-drama`, `seedance-ad-creative`) build on — not typically installed on its own unless you're calling the Ofox video API directly with custom parameters. |
| [seedance-short-drama](skills/seedance-short-drama/SKILL.md) | Video | Generate a realistic-human, dialogue-driven short-drama shot from a script or scene description via the Ofox video API (Seedance 2.5): builds a shot-craft prompt (character appearance, quoted dialogue, scene-cut timing cues), shows a cost estimate, then submits, polls, downloads, and reports the real cost. Built on `ofox-video-core`. |
| [seedance-ad-creative](skills/seedance-ad-creative/SKILL.md) | Video | Generate a cinematic brand/product ad clip from a description or product photo via the Ofox video API (Seedance 2.5): builds a shot-craft prompt (product framing, camera language, brand tone), shows a cost estimate, then submits, polls, downloads, and reports the real cost. Built on `ofox-video-core`. |

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
- [ofoxai/hal2099](https://github.com/ofoxai/hal2099) — the 24/7 digital-human
  cluster on native Claude Code that these skills equip.

## License

MIT © OFOX AI
