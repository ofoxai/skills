# OTP security review

Scope: optional six-digit shared access code on permanent Workers deployments.
Temporary previews deliberately do not support this feature. This is a sharing
password, not identity verification or a rotating/single-use OTP protocol.

## Findings and controls

| Finding | Control |
| --- | --- |
| Static HTML and sibling assets were public by design. A client-only form cannot protect source. | `assets.run_worker_first: true` sends every path through server authentication, including asset requests, HEAD, query variants and guessed configuration paths. |
| Six digits permit online guessing. Isolate memory counters reset and differ across locations. | One SQLite Durable Object serializes a persistent, fixed 15-minute budget: 10 attempts/IP, 100 overall. Only HMACs of IPs are stored, in one bounded record. All login attempts consume budget. |
| Session spoofing, cross-site login, cache reuse. | HMAC-SHA256 session binds expiry and host; one-hour maximum; Secure/HttpOnly/host-only/SameSite=Strict cookie; same-origin JSON POST, bounded body; no-store responses; conditional/range headers removed before authenticated asset reads. |
| Password embedded in public JS enables bypass. | Cryptographic random generation with leading zeroes; server-only HMAC verifier/key in mode-0600 config outside asset root. No plaintext code in that config, index, gate or report. Private staging removed in finally; protected error diagnostics do not echo Wrangler variables. |
| Success HTTP status alone does not verify protection. | Verify anonymous gate responses on multiple paths, wrong-code rejection, cookie attributes and byte-exact authenticated HTML. Errors fail closed. |
| A retry may accidentally remove protection. | Temporary/renew reject `-otp` before deployment; no automatic downgrade or alternate static upload backend. |
| Existing OAuth backup could be overwritten. | Refuse to pause credentials when the backup path already exists. |

## Boundaries

- Anyone given the code can read/save every staged asset. Use a dedicated publish
  folder; sibling-directory copying remains existing behavior, not a file allowlist.
- Already-public copies, downloads, third-party resources and screenshots cannot be
  revoked by deploying a password later. Prefer a fresh worker name for that transition.
- Six digits are a convenience access barrier with a durable guessing budget, not
  enterprise identity or MFA. Shared-IP/global limits can cause temporary denial of
  access. Account owners can see server configuration and replace/delete the Worker.
- Redeploying with `-otp` rotates the key/code and invalidates sessions. Deliberately
  deploying without `-otp` makes a site public; the optional flag must be preserved
  when updating a protected share. Permanent sites do not expire automatically.
- Wrangler/account failures never cause unprotected fallback. Changing this routing
  or disabling the Durable Object requires re-running the security cases.

## Validation

```bash
node --test skills/cloudflare-drop/references/test/*.test.mjs skills/cloudflare-drop/test/*.test.mjs
```

`otp.test.mjs` uses isolated temporary staging and exercises the real Worker handler
with a transactional storage fixture. Also run `wrangler dev --local --config
<generated-wrangler.json>` against synthetic HTML plus a data asset and verify in a
browser: anonymous direct-asset navigation, wrong code, correct code, reload, new
browser context, mobile layout and CSP. Unit fixtures do not prove edge routing;
local Wrangler tests exercise the actual Worker/Assets/Durable Object runtime.

Architecture references:
[Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[Durable Object storage](https://developers.cloudflare.com/durable-objects/api/storage-api/).
