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
```

## Skills

| Skill | Group | Description |
|-------|-------|-------------|
| [hal-vault](skills/hal-vault/SKILL.md) | Secrets | Agent-safe secret management: SSH-key encrypted storage, tag search, masked-by-default output — store, search, and inject secrets without ever seeing or leaking them. |
| [hal-image](skills/hal-image/SKILL.md) | Media | Agent-safe image handling: read metadata, resize/crop/composite/montage/watermark/convert with ImageMagick, and losslessly compress before sending so images stay small and transfers don't stall. |
| [cloudflare-drop](skills/cloudflare-drop/SKILL.md) | Deploy | Publish a static site (folder or zip of HTML/CSS/JS/images) to [Cloudflare Drop](https://cloudflare.com/drop) and get a live, shareable `*.workers.dev` URL in seconds — no account, no build. Runs a packaged headless-playwright script (one command), bakes a 60-minute expiry countdown into the page, always flags the expiry, and fails open rather than inventing a link. |

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
