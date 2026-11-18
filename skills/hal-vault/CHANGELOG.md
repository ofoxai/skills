# Changelog

All notable changes to the **hal-vault** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

## 1.3.0 — `.env.tpl` + `hal-vault run` for several secrets at once

hal-vault CLI v0.1.0 adds `hal7://` references and two commands, `run` and
`check`. The skill now makes `run` the first choice whenever a command needs
more than one secret:

```
# before: one decryption per variable
OPENAI_API_KEY="$(hal-vault get openai --reveal)" \
GITHUB_TOKEN="$(hal-vault get github-pat --reveal)" pnpm run e2e

# after (CLI v0.1.0+): a committable template, one decryption, masked output
hal-vault run --env-file .env.tpl -- pnpm run e2e
```

- New workflow "Several secrets for one command", and `run` as item 0 of
  "The order to reach for" — it is the environment-variable form, done once
  for all variables, with the child's output masked.
- `--no-masking` is documented as human-terminal only: never when the output
  comes back to the agent.
- `references/cli-reference.md` documents `run`, `check` and the env file
  format.
- The per-variable `get --reveal` forms are unchanged and remain the way to
  go on a CLI older than v0.1.0.
- The frontmatter `description` now names the multi-secret trigger.

## 1.2.0 — `--reveal` in an argument is an exposure, and the docs now say so

Answers the two findings ClawHub's scanner raised against 1.1.0 ("raw secrets
are embedded in generated shell command text" and "revealed secrets are exposed
through process arguments or environment variables"). Both named something this
skill really recommended. `--reveal` is not being removed — it is the reason the
skill exists — but the guidance around it was too coarse.

**What changes for a caller.** The recommended way to send a bearer token moves
from an argument to stdin:

```
# before (1.1.0), still works, now discouraged
curl -H "Authorization: Bearer $(hal-vault get github-pat --reveal)" https://api.github.com/user

# after (1.2.0)
hal-vault get github-pat --reveal \
  | sed 's/^/Authorization: Bearer /' \
  | curl -H @- https://api.github.com/user
```

The safety contract's rule 2 said to use `--reveal` "inside command
substitution", which reads as a guarantee and is not one: a substitution that
lands in an **argument** puts the plaintext into that process's argument list.
Rule 2 now says the destination is what matters, and a new section gives the
order to reach for — environment variable, then stdin, then an argument as a
last resort that you disclose.

**Measured, not asserted** (macOS 25.5, curl 8.7.1, using a stand-in script that
prints a fixed placeholder with one trailing newline — the output shape
`references/cli-reference.md` documents for `--reveal`; `hal-vault` itself is
not installed on the machine this was verified on). With both forms in flight at
once, `ps -A -o args=` printed the value in full for the argument form and
`-H @-` for the stdin form, and both delivered a byte-identical `Authorization`
header to a local server. The `-K -` (config on stdin) variant was run the same
way, same result. Whether another *user account* on the same host can read that
argument list was **not** measured and is not claimed — the documented finding
is that the value is in the process table at all.

Also new: an explicit rule against writing out an **already-substituted**
command. The unexpanded text is safe to put in a file or a message; resolving
`--reveal` yourself to hand someone a "ready to run" line is the leak the first
scanner finding names.

No behavior change — this skill ships no code. The frontmatter `description`
tail changed with the rule it summarised.

## 1.1.0 — ClawHub metadata

- Frontmatter now declares `metadata.openclaw` with the `hal-vault` binary and
  `HAL_VAULT_DIR` marked optional (resolution order is the `-d` flag, then that
  variable, then `~/.hal-vault`), plus a top-level `version` — the fields
  ClawHub's publish scanner reads.
- No change to behavior. This is a secrets skill and still fails closed, not
  open: a missing vault or key is an error, never a silent pass-through.
