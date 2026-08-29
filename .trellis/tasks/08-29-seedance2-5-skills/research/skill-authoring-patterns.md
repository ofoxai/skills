# Skill Authoring Patterns for This Task

Two sources studied for this task, both already read in full (not just referenced by name).

## 1. This repo's own conventions — the actual bar

`CONTRIBUTING.md` (repo root) is the authoritative checklist every new skill must clear before merge. Key points relevant to `ofox-video-core` / `seedance-short-drama` / `seedance-ad-creative`:

- **English only** — name, description, body, comments, examples. No Chinese anywhere in the shipped files. This project's planning conversation has been in Chinese; the shipped `SKILL.md` files must not be.
- **Frontmatter** must be complete and honest:
  ```yaml
  ---
  name: <kebab-case, == directory name>
  description: <one paragraph. What it does AND precise "use when..." triggers>
  license: MIT
  metadata:
    author: ofoxai
    version: "1.0.0"   # semver; bump on every published change
  ---
  ```
- **Safety contract up front** if the skill touches anything sensitive — here, the `OFOX_API_KEY`. State plainly near the top what the skill must never do with it (e.g. never print it, never log it to a shared file).
- **Real tools, real recipes** — every command must run as written against the named tool, tested on a real machine before publishing. No invented flags.
- **Availability check + install path** — tell the agent how to verify `curl` / `jq` are present and how to install them if not.
- **Fail-open unless safety requires fail-closed** — a missing API key should guide the user to sign up, not hard-block the conversation. (Note: this is about the *helper* failing open when its tool/config is missing — it does not mean silently proceeding with a broken/absent key to call the paid API; "fail open" here means don't dead-end the user, offer the signup path.)
- **Self-contained** — `SKILL.md` must be usable on its own; `references/` is for depth loaded on demand, not required reading.

Directory layout convention (from `skills/cloudflare-drop`, `skills/hal-vault`, `skills/hal-image`):

```
skills/<skill-name>/
  SKILL.md
  references/
    *.md or *.sh / *.mjs
```

## 2. `skills/cloudflare-drop` — closest in-repo precedent

Read in full. Relevant patterns to imitate for `ofox-video-core`:

- Wraps a single real external call (Wrangler CLI) behind one packaged script invocation (`references/deploy.mjs`), not a pile of ad-hoc curl snippets pasted into the SKILL.md body.
- **Never claims success it can't verify.** It curl-verifies the deployed URL actually returns 200 *and* matches expected content before reporting success; a result that can't be verified is printed as `URL_UNVERIFIED` and explicitly documented as "deploy failed — do NOT deliver that URL." The equivalent for us: don't report a video as ready until the poll response actually shows `status: completed` with a real `mirror_urls` entry, and don't invent a cost number — read `usage.video_cost` from the response.
- Detects which mode it ran in (permanent vs. temporary) and always reports which one, rather than letting the caller assume. Equivalent for us: always state clearly which model/resolution/duration were actually used and what it actually cost, not just what was requested.
- Documents flags in a table, and documents *why* a design choice was made (e.g. why TTL defaults to 60m) — worth the same treatment for cost-estimate-before-generation vs. actual-cost-after.
- Versioned frontmatter, bumped per change (`2.1.0` at last commit), with a CHANGELOG entry per bump.

## 3. External: `EvoLinkAI/gpt-image-2-gen-skill`

Fetched and read (`SKILL.md` from GitHub, this is a different platform's image-gen skill, not video, but same "API-key-gated paid generation skill" shape). Two patterns worth adopting that are *not* obvious from first principles:

1. **Key-check-once flow**: on first load, check the API key env var. If unset, give a direct signup link plus a one-line offer to walk the user through it, then stop (don't dump a feature menu). Once the key has been validated in the session, don't re-prompt for it on every subsequent call.
2. **Never resubmit on suspected timeout.** The skill's guidance is explicit: once a job is submitted, do not retry/resubmit it just because polling is taking a while or a client-side timeout hit — that creates a duplicate paid job and double-charges the user. If polling itself errors, retry the *poll* call, not the *create* call. This must be an explicit, called-out rule in `ofox-video-core`'s script and in the scenario skills' guidance to the calling agent, not just implicit in the code.

It also maps HTTP error codes to specific, actionable user-facing messages (dashboard link for 401, retry-timing guidance for 429, etc.) rather than surfacing raw JSON — directly reusable pattern given Ofox's error codes are documented in `research/ofox-video-api.md`.

## Non-pattern: existing Seedance skills on GitHub

Already surveyed in the source plan (dexhunter/seedance2-skill, songguoxs/seedance-prompt-skill, LeoYeAI/seedance-skills, nutllwhy/seedance-tvc-director, liyue-aigc/seedance-2-5-video-director, huangbai-AI/sd-2-5-prompt, lixiaoxiao9888-create/manju-laoli-skill). All are prompt-writing only — none call an API, poll, download a result, or report cost. No code pattern to borrow from them; their only relevance is confirming the execution layer is genuinely empty.
