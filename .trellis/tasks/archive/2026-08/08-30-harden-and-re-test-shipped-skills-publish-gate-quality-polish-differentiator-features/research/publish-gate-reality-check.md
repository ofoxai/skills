# Research: what the publish gate actually requires (vs. what the plan doc says)

Checked 2026-08-30 against the live official specs. The source plan
(`2026-08-28_GitHub两类仓库操作手册.md` §5.2/§5.6) names three artifacts that
turn out **not to be required by any of the four directories**, and misses
three frontmatter details that **are** required. Net: less busywork, but a
real compatibility gap to close.

## Not required after all — do not build these

### `_meta.json` — does not exist in the ClawHub format

Plan doc §5.2: "给 AI 读的 `llms-install.md` 和 clawhub 用的 `_meta.json`
放各 skill 目录里."

The official ClawHub skill format lists the complete file set:

- **Required:** `SKILL.md` (or `skill.md`; legacy `skills.md` accepted)
- **Optional:** any supporting regular files, `.clawhubignore` (legacy
  `.clawdhubignore`), `.gitignore`, `.clawhub/origin.json` (written by the
  CLI on install, not by us)

The format "does not define `_meta.json` or `llms-install.md`". ClawHub
reads its metadata from the SKILL.md YAML frontmatter — "The server
extracts metadata from frontmatter during publish." So `_meta.json` would
be a file nothing reads.

### `llms-install.md` — also not part of the format

Same source: not defined by ClawHub. It is a Cline-ecosystem convention,
not something any of the four target directories consumes. No evidence any
of npm / skills.sh / LobeHub / ClawHub reads it.

### Root `package.json` — not required by skills.sh

The live skills.sh schema (`https://skills.sh/schemas/skills.sh.schema.json`)
is `additionalProperties: false` with exactly four top-level keys:
`$schema`, `schema` (legacy), `notGrouped`, `groupings` (required). It
does not reference `package.json` anywhere; the description only says
"Place this file at the repository root as skills.sh.json."

Our current `skills.sh.json` validates cleanly against this schema: it uses
`$schema` + `groupings`, and every grouping has `title` (1–120 chars),
optional `description` (<=500 chars), and a non-empty `skills` array.

`package.json` is needed **only** to publish an npm package — and the plan
doc itself puts that in a separate repo (§5.2: "npm 那条路另开一个小仓库
`ofoxai/ofox-media-skills-cli`"), which the user has already scoped out.

## Actually required — three real gaps in our frontmatter

The official ClawHub example frontmatter, verbatim:

```yaml
---
name: todoist-cli
description: Manage Todoist tasks, projects, and labels from the command line.
version: 1.2.0
metadata:
  openclaw:
    requires:
      env:
        - TODOIST_API_KEY
      bins:
        - curl
    primaryEnv: TODOIST_API_KEY
    envVars:
      - name: TODOIST_API_KEY
        required: true
        description: Todoist API token.
      - name: TODOIST_PROJECT_ID
        required: false
        description: Optional default project ID.
    emoji: "✅"
    homepage: https://github.com/example/todoist-cli
---
```

Against our 9 shipped skills:

| Field | ClawHub expects | We have | Gap |
|---|---|---|---|
| `version` | **top-level** key | `metadata.version` only | Scanner reads top-level; "does not mention `metadata.version`". Our skills would publish with no version. |
| `homepage` | under **`metadata.openclaw.homepage`** | top-level `homepage` | ClawHub reads the nested one. Plan doc §5.6 warns a missing `homepage` "会降信任分". |
| `envVars` / `primaryEnv` | optional, improves install UX | absent | Lets the installer explain what `OFOX_API_KEY` is and prompt for it, instead of a bare name. |

`requires.env` / `requires.bins` we already have and they are accurate —
that is the field the security scanner matches against actual script
contents ("if your code references `TODOIST_API_KEY` but your frontmatter
doesn't declare it… the analysis will flag a metadata mismatch").

### These are additive, not migrations

Top-level `version` and `metadata.version` can coexist; so can top-level
`homepage` and `metadata.openclaw.homepage`. Anthropic's Agent Skills
frontmatter treats `metadata` as a free-form map and does not define
`version` at all, so adding the top-level keys ClawHub wants breaks nothing
for Claude Code / skills.sh. Recommend **adding** rather than moving, so
`CONTRIBUTING.md`'s existing rules stay true.

### One policy note

"All skills published on ClawHub are licensed under `MIT-0`" and the format
"prohibits adding conflicting license terms." Our skills declare
`license: MIT` (repo is MIT). MIT vs MIT-0 differ only in MIT-0 dropping
the attribution requirement. Worth a conscious decision before publishing,
but not a blocker for this task (no publish happens here).

## Revised publish-gate work for this task

Drop: `_meta.json`, `llms-install.md`, root `package.json`.

Keep/add:
1. Top-level `version` on all 9 skills (mirroring `metadata.version`).
2. `metadata.openclaw.homepage` on the 6 Ofox skills (mirroring top-level
   `homepage`); decide whether to retrofit the 3 pre-existing skills, which
   currently have no `metadata.openclaw` at all.
3. `metadata.openclaw.envVars` + `primaryEnv` for `OFOX_API_KEY` on the 6
   Ofox skills.
4. Install `clawhub` CLI and run `--dry-run` — the only way to confirm the
   above actually satisfies the scanner rather than just matching the docs.
5. Update `CONTRIBUTING.md` so the frontmatter template carries these.

## Sources

- https://docs.openclaw.ai/clawhub/skill-format
- https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md
- https://raw.githubusercontent.com/openclaw/clawhub/main/docs/skill-format.md
- https://skills.sh/schemas/skills.sh.schema.json
