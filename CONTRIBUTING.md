# Contributing to ofoxai/skills

This repo holds OFOX AI's published agent skills. Every skill ships to a public
audience through [skills.sh](https://skills.sh), so the bar is high and uniform.
Read this before adding or changing a skill.

## Repository layout

```
ofoxai/skills/
├── skills.sh.json          # publish manifest: groupings -> skill names (keep in sync)
├── README.md               # the Skills table (add a row per skill)
├── CONTRIBUTING.md          # this file
├── LICENSE                  # MIT
└── skills/
    └── <skill-name>/
        ├── SKILL.md         # the skill itself (frontmatter + body)
        └── references/      # optional: deep-dive docs loaded on demand
            └── *.md
```

A skill name is lowercase kebab-case and matches its directory name, the
`name:` in its frontmatter, and its entry in `skills.sh.json`.

## The quality bar (every skill must clear all of these)

1. **English only.** Names, descriptions, body, comments, examples — all
   English. These skills are public and international.
2. **Frontmatter is complete and honest.**
   ```yaml
   ---
   name: <kebab-case, == directory name>
   description: <one paragraph. What it does AND precise "use when..." triggers.
     The agent decides whether to load the skill from this alone — make the
     triggers concrete, not vague.>
   license: MIT
   homepage: https://github.com/ofoxai/skills/tree/main/skills/<name>
   metadata:
     author: ofoxai
     version: "1.0.0"   # semver; bump on every published change
     openclaw:
       requires:
         env: [ENV_VAR_ONE]    # every env var the skill's script(s) read, direct or transitive
         bins: [tool-one]      # every CLI tool the skill's script(s) call, direct or transitive
   ---
   ```
   - `homepage` always points at the skill's own directory in this repo
     (`https://github.com/ofoxai/skills/tree/main/skills/<name>`) — required
     for every skill, new or existing.
   - `metadata.openclaw.requires.env`/`requires.bins` must list every
     environment variable and command-line tool the skill actually needs,
     including ones pulled in transitively by delegating to another skill's
     script (e.g. a scenario skill built on `ofox-video-core` still needs
     `OFOX_API_KEY`, `curl`, `jq` even though it never calls them directly).
     A missing entry here is a metadata/reality mismatch — treat it as a bug.
     If a skill genuinely needs no env vars or no extra bins, omit that key
     rather than declaring an empty list.
3. **Safety contract up front.** If the skill touches anything sensitive
   (secrets, local file paths, credentials, destructive ops), state the
   non-negotiable discipline near the top — what the agent must never do. See
   `hal-vault` (never print raw secrets) and `hal-image` (never leak local
   paths; fail-open) as the model.
4. **Real tools, real recipes.** Every command must run as written against the
   named tool. Test each recipe on a real machine before publishing — no
   invented flags, no untested pipelines.
5. **Availability check + install path.** Tell the agent how to verify the
   underlying tool is present (`tool --version`) and how to install it
   (`brew …`, release binary, etc.) if it is not.
6. **Fail-open unless safety requires fail-closed.** A helper skill (image
   processing, formatting) must never block the main task: if its tool is
   missing or a step errors, pass the input through unchanged. A safety skill
   (secrets) fails closed instead.
7. **Self-contained.** No links into private repos or local-only paths. A
   `references/` doc is for depth the agent loads only when needed; the
   `SKILL.md` must be usable on its own.

## Adding a skill

1. Create `skills/<name>/SKILL.md` (and `references/` if needed), clearing the
   bar above.
2. Add the skill to the right grouping in `skills.sh.json` (create a new
   grouping if no existing one fits).
3. Add a row to the **Skills** table in `README.md`.
4. Test the recipes on a real machine; confirm the availability check works.
5. Open a PR. Releasing is merging to `main` + a tag if the change is
   user-visible.

## Versioning

Each skill carries its own `metadata.version` (semver). Bump it on every
published change to that skill. The repo itself is the distribution unit;
individual skills are installable via `ofoxai/skills@<name>`.
