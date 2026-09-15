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
2. **Frontmatter is complete and honest — and it parses.**

   ⚠️ **No `: ` (colon followed by a space) inside an unquoted value.** YAML
   reads it as a nested mapping and rejects the whole block, and the installer
   then **skips the skill silently** — it reports the skills it did find, not
   the ones it dropped. `music-video`, `ofox-image-core` and `ugc-ads` shipped
   this way and were uninstallable for two release rounds before anyone
   noticed, because nothing in the repo ever parsed the frontmatter. Use an em
   dash instead, as the rest of these descriptions do.

   Run this before publishing. It exits non-zero and names the file, line and
   column:

   ```bash
   node bin/check-frontmatter.mjs
   ```

   `npx ofox-skills doctor` runs the same check and reports such a skill as
   **BROKEN** rather than MISSING — the distinction matters, because
   reinstalling fixes MISSING and does nothing at all for BROKEN.

   ```yaml
   ---
   name: <kebab-case, == directory name>
   description: <one paragraph. What it does AND precise "use when..." triggers.
     The agent decides whether to load the skill from this alone — make the
     triggers concrete, not vague.>
   license: MIT
   version: "1.0.0"   # top-level: this is the one ClawHub's scanner reads
   homepage: https://github.com/ofoxai/skills/tree/main/skills/<name>
   metadata:
     author: ofoxai
     version: "1.0.0"   # same value; semver, bump on every published change
     openclaw:
       requires:
         env: [ENV_VAR_ONE]    # every REQUIRED env var, direct or transitive
         bins: [tool-one]      # every CLI tool the skill's script(s) call, direct or transitive
       primaryEnv: ENV_VAR_ONE # the one a user must set first, if there is one
       envVars:                # human-readable, including OPTIONAL vars
         - name: ENV_VAR_ONE
           required: true
           description: <what it is and where to get it>
       emoji: "🧰"
       homepage: https://github.com/ofoxai/skills/tree/main/skills/<name>
   ---
   ```
   - **`version` appears twice on purpose.** ClawHub's publish scanner reads the
     top-level `version`; its docs never mention `metadata.version`. Keep both
     in sync and bump both together. (Verified against the live ClawHub skill
     format spec — note the CLI itself takes the *published* version from
     `--version` or the registry's next patch, so the frontmatter value is for
     the format's sake, not what drives a publish.)
   - **`homepage` also appears twice on purpose**, for the same reason: ClawHub
     reads `metadata.openclaw.homepage`, other consumers read the top-level one.
     Both point at the skill's own directory in this repo
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
   - `requires.env` means **required**. A variable that merely unlocks a better
     path belongs in `envVars` with `required: false`, not in `requires.env` —
     e.g. `cloudflare-drop` deploys a preview without `CLOUDFLARE_API_TOKEN`
     and a permanent site with it, so it declares no required env at all.
   - `envVars` descriptions are read by installers and shown to a user who has
     to go get the value. Say what it is and where to get it, not just its name.
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
8. **No `$0` sequence in a `SKILL.md`.** A skill body is expanded with
   shell-style substitution when it loads, and `$0` is replaced by the
   invocation's arguments. Sub-dollar prices are where this bites: `$0.64`
   renders as the user's own prompt text followed by `.64`. Every other
   figure (`$1.92`, `$7.20`) is unaffected — only `$0` is. Write those
   amounts a way that has no `$0` in it (`64 cents`, `4 cents/s`) and keep
   the number itself identical. This matters most in exactly the skills that
   quote prices, whose whole job is not to misstate one. `references/*.md`
   are read as files rather than expanded, so they are unaffected.

## Adding a skill

1. Create `skills/<name>/SKILL.md` (and `references/` if needed), clearing the
   bar above.
2. Add the skill to the right grouping in `skills.sh.json` (create a new
   grouping if no existing one fits).
3. Add a row to the **Skills** table in `README.md`.
4. Start a `skills/<name>/CHANGELOG.md`. Every skill has one; every published
   version gets an entry saying what changed and, when behavior a caller could
   depend on moved, what to do about it.
5. Test the recipes on a real machine; confirm the availability check works.
   Anything with a script gets `bash -n` and `shellcheck -S warning` clean at
   minimum, plus tests under `references/test/` that a reader can run — see
   `ofox-video-core` and `cloudflare-drop` for the two shapes (bash and node).
   Tests for a skill that calls a paid API must be free by construction: point
   the API base somewhere unroutable so a case that passes validation dies on
   connect rather than spending someone's credits.
6. Dry-run the ClawHub publish:

   ```
   npx clawhub skill publish ./skills/<name> --owner ofoxai \
     --version <the frontmatter version> --dry-run --json
   ```

   `fileCount` in that JSON is the cheapest way to catch a `references/` file
   that won't ship or a stray file that will. Three things about this command,
   all measured against CLI v0.23.3 during the 2026-09-08 publish:

   - **`--json` is what prints `fileCount`.** Without it the whole output is
     one line, `Would publish <slug>@<version>`, and the file check you came
     for isn't in it.
   - **Pass `--version` explicitly.** The CLI does not read the frontmatter
     version; left to itself it publishes `1.0.0` or the registry's next
     patch. `hal-vault` sitting at `1.1.0` dry-ran as `hal-vault@1.0.0`.
     Publish nine skills without this flag and nine version histories
     flatten to 1.0.0.
   - **A green dry-run does not mean publish will work.** Run unauthenticated
     it never checks the publisher, so nine passing dry-runs were followed by
     `Publisher "@ofoxai" not found` on the first real publish. The publisher
     org has to exist (`npx clawhub publisher create <handle>`), and that is
     one of a class of preconditions dry-run says nothing about.
   - **The scanner reads `CHANGELOG.md` too, and `skill verify` will not tell
     you where a hit is.** `suspicious.exposed_secret_literal` fires on any
     key-shaped literal assigned to a credential-named variable, in any
     shipped file — including a changelog entry that quotes the literal it
     just removed (`ofox-video-core` 1.21.1 shipped exactly that and had to be
     followed by 1.21.2). `verify` returns only the reason code; the file and
     line are in `clawhub scan download <slug> --version <v>`, under
     `static-analysis.json` → `findings[]`. Local folder scans were removed
     from the CLI, so every attempt at a fix costs a published patch version:
     read the stored report first, grep the whole skill directory for the
     literal's text before bumping, and describe a removed secret-shaped
     string without reproducing it.

   Two more, measured against CLI v0.23.3 during the 2026-09-15 round:

   - **Publishing a new version of an existing skill does not move the
     `latest` tag.** A brand-new slug's first version becomes `latest`
     automatically; an update does not, and `skill publish` reports
     `ok: true, publicationStatus: pending` either way. The round that found
     this published ten skills and then read the registry back: the six new
     ones were live, and all four updates still served their previous
     version — a split clean enough to be a mechanism rather than a timing
     lag, which is what pointed at the tag. Finish every update with

     ```
     npx clawhub skill tag ofoxai/<name> <version> --tag latest --yes
     ```

     and then read the version back; a publish that returned `ok` is not
     evidence anyone can install it.
   - **The rate limiter extends its own window when you retry into it.**
     Observed resets of 35s, then 45s, then 55s across three consecutive
     attempts — so a retry loop walks the limit away from itself and never
     catches up. Stop calling entirely for a few minutes, then retry one
     command at a time with a wide gap. The failure surfaces as a
     `convex-helpers` stack trace with `(reset in Ns)` on the end, which
     reads like a crash and is not one.
7. Open a PR. Releasing is merging to `main` + a tag if the change is
   user-visible.

## Versioning

Each skill carries its own `metadata.version` (semver). Bump it on every
published change to that skill. The repo itself is the distribution unit;
individual skills are installable via `ofoxai/skills@<name>`.
