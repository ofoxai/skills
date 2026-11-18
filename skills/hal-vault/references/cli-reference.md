# hal-vault CLI reference

Complete command reference for [hal-vault](https://github.com/ofoxai/hal-vault).
Every command accepts `-d DIR` to select the vault directory (default
`$HAL_VAULT_DIR`, or `~/.hal-vault`).

## init

```
hal-vault init [-r PUBKEY] [-i PRIVKEY] [-d DIR]
```

Binds a new vault to an SSH key pair and writes an encrypted empty database.

- With no flags: uses the dedicated key `~/.ssh/hal-vault_ed25519(.pub)`,
  generating it on first use (never overwrites an existing file). Your
  day-to-day SSH keys are not touched.
- `-r` / `-i`: use an existing key pair (`ssh-ed25519` or `ssh-rsa`). With
  only `-r`, the private key path is derived by stripping `.pub`; with only
  `-i`, the public key is expected at `PRIVKEY.pub`.
- Fails if the vault is already initialized (`config.json` exists).
- Passphrase-protected private keys are prompted for on the terminal when
  decrypting.

## add

```
hal-vault add LABEL [-t TYPE] [--tags TAG,...] [-n NOTE] [-d DIR]
```

Stores a new secret. The value is **never** passed as an argument:

- stdin piped → reads all of stdin, strips one trailing newline (and CR)
- stdin is a terminal → hidden double prompt

Types: `api_key`, `password`, `token`, `ssh_key`, `cert`, `identity`,
`other` (default). Values must be valid UTF-8 (base64-encode binary
material first; invalid input is rejected, not corrupted).

Output: `added <id> <label>: <masked>`.

## get

```
hal-vault get ID|LABEL [--reveal] [--json] [-d DIR]
```

- Default: human-readable detail view with the value **masked**.
- `--reveal`: prints the raw value plus exactly one trailing newline —
  designed for `KEY=$(hal-vault get x --reveal)`, and for piping into a tool
  that reads the value on stdin. A substitution that lands in a command
  **argument** instead puts the plaintext in the process table; see
  "Where a revealed secret still leaks" in `SKILL.md`.
- `--json`: JSON object `{id,label,type,tags,note,masked,created_at,updated_at}`;
  a `value` field is included **only** when `--reveal` is also given.
- Lookup: exact ID match wins; otherwise case-insensitive exact label
  match. Ambiguous labels return an error listing candidate IDs (no values).

## list

```
hal-vault list [--json] [-d DIR]
```

Table of all entries: `ID TYPE LABEL TAGS MASKED UPDATED`. Always masked.

## search

```
hal-vault search [QUERY] [--tag TAG] [--type TYPE] [--json] [-d DIR]
```

- `QUERY`: case-insensitive substring over label, note, tags, and type.
- `--tag`: exact tag filter. `--type`: exact type filter.
- Filters AND-combine; at least one of query/tag/type is required.
- Same masked table rendering as `list`.

## update

```
hal-vault update ID|LABEL [--label L] [-t TYPE] [--tags TAG,...] [-n NOTE] [--value] [-d DIR]
```

- Metadata flags update in place; `--tags` **replaces** the whole tag list.
- `--value` (boolean): reads a new secret value from stdin or the hidden
  prompt, exactly like `add`.
- At least one flag is required.

## rm

```
hal-vault rm ID|LABEL [-f] [-d DIR]
```

Asks `remove <id> (<label>)? [y/N]` on a terminal. Non-interactive use
(piped stdin) requires `-f`.

## run

```
hal-vault run [--env-file FILE]... [--no-masking] [-d DIR] -- CMD [ARGS...]
```

Requires CLI v0.1.0 or later. Runs `CMD` with every `hal7://` reference in
its environment replaced by the secret value.

- **References.** A variable whose *whole* value is `hal7://<label-or-id>`;
  resolved like `get` (ID first, then case-insensitive label; an ambiguous
  label is an error listing candidate IDs). No interpolation inside longer
  values.
- **Environment.** The current process environment, then each `--env-file`
  in order; a later definition overrides an earlier one. References already
  present in the current environment are resolved too.
- **One decryption.** All references are resolved from a single load of the
  vault. Without any reference the vault is not opened at all.
- **Fail fast.** Any unresolved reference → `CMD` is not started, stderr
  lists every failing `KEY  hal7://ref  reason`, exit code `1`.
- **No leaks by `run` itself.** Values go only into the child's environment
  — not into files, not into argv, not into `run`'s output.
- **Output masking (default).** Injected secrets of 6 or more characters are
  replaced with their masked form wherever they appear in `CMD`'s stdout
  and stderr, including matches split across writes. Shorter values are not
  masked. Masking pipes the output, so `CMD` does not see a terminal.
- `--no-masking`: connect `CMD`'s output directly (interactive/TTY use). Only
  when a human is watching that terminal.
- stdin is passed through; SIGINT and SIGTERM are forwarded to `CMD`
  (best effort on Windows); the exit code is `CMD`'s own (`128+N` when it
  was killed by signal N).
- Flags go before `--`; everything after it is the command line of `CMD`.

### Env file format

A dotenv subset, conventionally named `.env.tpl`:

```
# comment
PLAIN=value                 # unquoted; " # ..." starts a comment
export EXPORTED=value       # "export " is ignored
SINGLE='taken verbatim'
DOUBLE="escapes: \" \\ \n \r \t"
EMPTY=
OPENAI_API_KEY=hal7://openai
```

Keys must match `[A-Za-z_][A-Za-z0-9_]*`. No `${VAR}` expansion, no
multi-line values. Parse errors name the file and line, never the value.

## check

```
hal-vault check [--env-file FILE]... [-d DIR]
```

Requires CLI v0.1.0 or later. Resolves the same references as `run` (same
environment layering) without running anything and without printing any
value.

- All resolve → exit `0`, one line per reference:
  `KEY  hal7://ref  <id> <label>: <masked>`, then `all N references resolve.`
- Any failure → exit `1`, stderr lists every failing reference.
- No references at all → exit `0`, `no hal7:// references found.`

Use it in CI and before starting work to catch a renamed or deleted entry.

## version

```
hal-vault version
```

Prints the release version (e.g. `v0.0.1`).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | runtime error (not found, decryption failure, I/O, unresolved `hal7://` reference) |
| 2 | usage error (bad flags/arguments, unknown command) |
| any | `run`, once `CMD` has started: `CMD`'s own exit code |

## Storage model

- `~/.hal-vault/secrets.db` — the entire database as one age-encrypted blob
- `~/.hal-vault/secrets.db.bak` — previous generation, kept on every save
- `~/.hal-vault/config.json` — paths of the bound SSH key pair
- Saves are atomic and durable (fsync + single rename); concurrent
  processes serialize through an exclusive lock (`.lock`)
