# Skill-Authoring Guidelines

> This repo (`ofoxai/skills`) is a skills-authoring monorepo, not a typical
> frontend/backend web app — the generic `backend/` and `frontend/` spec
> layers under `.trellis/spec/` (ORM/component/hook-oriented, still unfilled
> `trellis init` scaffolding) do not apply here. This layer is for
> conventions specific to writing and shipping a `skills/<name>/` directory.

## The authoritative source

`CONTRIBUTING.md` (repo root) is the actual, enforced quality bar for every
skill — English-only, frontmatter shape, safety contract, fail-open, real-
machine-tested commands, self-contained. Read it in full before writing a
skill; this layer does not restate it, only adds conventions CONTRIBUTING.md
doesn't cover (real API integration gotchas, cross-skill delegation shape).

## Pre-Development Checklist

Before writing a new skill or extending an existing one:

1. Read `CONTRIBUTING.md` (repo root) in full.
2. Read the closest existing skill for the same shape of problem:
   - Wraps a real external API/CLI, verifies its own success/failure honestly →
     `skills/cloudflare-drop/SKILL.md`.
   - Calls a billable external API with polling → `skills/ofox-video-core/`
     (the shared execution layer other Video-group skills delegate to).
   - Scenario-specific skill that delegates all mechanics to a shared
     execution-layer skill rather than reimplementing them →
     `skills/seedance-short-drama/SKILL.md` or `skills/seedance-ad-creative/SKILL.md`.
3. If the skill talks to a paid/billable external API, read
   [`external-api-integration.md`](./external-api-integration.md) before
   writing the request/poll/download logic.
4. If a common-layer skill already exists for the API/service you need
   (e.g. `ofox-video-core` for anything on `api.ofox.ai/v1/videos`), delegate
   to it — don't duplicate request-building, polling, or error-mapping logic
   in a new scenario skill. See `seedance-short-drama`/`seedance-ad-creative`
   for the delegation shape (call the shared skill's script by relative path,
   reference rather than restate its safety contract).

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [External API Integration](./external-api-integration.md) | No-resubmit-on-timeout rule, and why to distrust "always present" claims in third-party API docs for optional/derived response fields | Filled |

## Quality Check

Before publishing or modifying a skill, confirm (this is `CONTRIBUTING.md`'s
bar restated as a checklist, not a separate standard):

- [ ] English only — no Chinese/CJK anywhere in the shipped `SKILL.md`,
      `references/`, or any file that ships with the skill.
- [ ] Frontmatter complete: `name` == directory name, `description` with
      concrete "use when" triggers, `license: MIT`, `homepage` pointing at
      `https://github.com/ofoxai/skills/tree/main/skills/<name>`,
      `metadata.author: ofoxai`, `metadata.version` bumped on every published
      change, `metadata.openclaw.requires.env`/`requires.bins` listing every
      env var/CLI tool the skill's script(s) actually need (direct or
      transitive via a delegated-to skill).
- [ ] Safety contract stated near the top if the skill touches secrets/keys.
- [ ] Every command in the skill has actually been run on a real machine —
      `bash -n` and (if available) `shellcheck` for shell scripts is the
      floor, not the ceiling; if the skill calls a real paid API, at least
      one real (ideally minimal-cost) end-to-end run is required before
      considering the skill done — see
      [External API Integration](./external-api-integration.md) for why
      docs-only implementation isn't sufficient for billable API integrations.
- [ ] `README.md`'s Skills table and `skills.sh.json` updated and consistent
      with the skill's actual directory name and frontmatter `name`.
- [ ] Any skill that writes a file to disk resolves and reports an
      **absolute** path — never a relative path the user must infer their
      own working directory to locate.
