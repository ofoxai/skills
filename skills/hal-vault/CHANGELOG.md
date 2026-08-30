# Changelog

All notable changes to the **hal-vault** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

## 1.1.0 — ClawHub metadata

- Frontmatter now declares `metadata.openclaw` with the `hal-vault` binary and
  `HAL_VAULT_DIR` marked optional (resolution order is the `-d` flag, then that
  variable, then `~/.hal-vault`), plus a top-level `version` — the fields
  ClawHub's publish scanner reads.
- No change to behavior. This is a secrets skill and still fails closed, not
  open: a missing vault or key is an error, never a silent pass-through.
