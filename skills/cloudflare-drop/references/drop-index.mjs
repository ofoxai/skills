// drop-index.mjs — a content-addressed deploy index for cloudflare-drop (round-014 spec 05).
//
// Why: Drop links expire in 60 minutes. To renew one you need the page content,
// but the source file lives in a session workspace that gets cleaned up — a
// path-only index would dangle. So every deploy writes:
//   1. an index entry (index.jsonl, one line per deploy) keyed on the URL's
//      drop-{id} segment: title/summary/deploy-time/expires_at/claim_url/sha256.
//   2. a content-addressed copy at artifacts/<sha256>.html (identical content
//      deduped by hash — deploy the same page twice, store it once).
//
// `renew` reads the entry, takes the archived copy, strips the stale countdown,
// re-injects a fresh one, redeploys, and records `renewed_from` so the chain is
// auditable. The index HOME resolves in layers (env > hal2099 inst > standalone)
// and is NEVER the skill dir or a session workspace.
//
// Prune note (keep the store small, don't over-build a GC): artifacts are
// content-addressed under artifacts/, so it's safe to periodically delete files
// older than a day or two — an expired Drop can't be renewed anyway once its
// content is gone, and a re-deploy re-archives. A simple
// `find <home>/artifacts -mtime +2 -delete` is enough; no bespoke GC needed.

import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { injectCountdown, stripCountdown } from './inject-countdown.mjs';

const INDEX_FILE = 'index.jsonl';
const ARTIFACT_DIR = 'artifacts';
const EXPIRY_WINDOW_SECONDS = 3600; // Drop links live ~60 min from deploy.

/**
 * Extract the drop-{id} key from a Drop URL, or accept a bare id/`drop-id`.
 * `https://drop-ab12.brave-lion.workers.dev` → `ab12`.
 * @param {string} urlOrId
 * @returns {string}
 */
export function idFromUrl(urlOrId) {
  const s = String(urlOrId || '').trim();
  const m = s.match(/drop-([a-z0-9]+)/i);
  if (m) return m[1];
  // A bare id (renew <id> path) — accept it verbatim.
  return s.replace(/^drop-/i, '');
}

/**
 * Resolve where the index lives, in layers:
 *   $CLOUDFLARE_DROP_HOME  >  (hal2099) ~/.hal2099-<inst>/drop/  >  ~/.cloudflare-drop/
 * Never the skill dir or a session workspace — those get cleaned up / committed,
 * so an index there would dangle or leak. A HOME that points at one is a loud error.
 *
 * @param {{env?:NodeJS.ProcessEnv, cwd?:string}} [opts]
 * @returns {string} absolute path to the index home
 */
export function resolveHome({ env = process.env, cwd = process.cwd() } = {}) {
  const explicit = env.CLOUDFLARE_DROP_HOME;
  if (explicit) {
    const abs = resolve(explicit);
    assertSafeHome(abs);
    return abs;
  }

  const inst = detectInstance(env, cwd);
  if (inst) {
    return join(homedir(), `.hal2099-${inst}`, 'drop');
  }

  // Standalone default.
  return join(homedir(), '.cloudflare-drop');
}

// A hal2099 instance is identified by env (HAL_INSTANCE / HAL2099_INSTANCE) or
// by a cwd sitting under an `agents/<inst>/…` tree.
function detectInstance(env, cwd) {
  if (env.HAL_INSTANCE) return env.HAL_INSTANCE;
  if (env.HAL2099_INSTANCE) return env.HAL2099_INSTANCE;
  const m = String(cwd || '').match(/[/\\]agents[/\\]([^/\\]+)/);
  if (m && m[1] !== '.template') return m[1];
  return null;
}

// Refuse a HOME that would drop the index inside our own skill tree or a session
// workspace — those are not durable stores.
function assertSafeHome(abs) {
  const p = abs.replace(/\\/g, '/');
  if (/\/skills\/cloudflare-drop(\/|$)/.test(p) || /\/\.claude\/skills(\/|$)/.test(p)) {
    throw new Error(
      `CLOUDFLARE_DROP_HOME refuses the skill dir (${abs}) — the index must be durable, not committed with the skill`,
    );
  }
  if (/\/sessions\/[^/]+\/workspace(\/|$)/.test(p) || /(^|\/)workspace(\/|$)/.test(p)) {
    throw new Error(
      `CLOUDFLARE_DROP_HOME refuses a session workspace (${abs}) — workspaces get cleaned up, the index would dangle`,
    );
  }
}

function ensureDirs(home) {
  mkdirSync(join(home, ARTIFACT_DIR), { recursive: true });
}

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Record a deploy: append an index entry + write the content-addressed HTML copy.
 * Identical content dedupes to one artifact (keyed by sha256).
 *
 * @param {object} p
 * @param {string} p.url          the live *.workers.dev url
 * @param {string} p.html         the deployed page's HTML (the exact bytes served)
 * @param {number} p.expiryEpoch  unix seconds when the link expires
 * @param {string} [p.title]      a human label for the page
 * @param {string} [p.summary]    a one-line summary
 * @param {string} [p.claimUrl]   the Drop claim link (permanence)
 * @param {string} [p.renewedFrom] the id this deploy renews (renew chain)
 * @param {string} [p.home]       index home (default: resolveHome())
 * @param {number} [p.now]        deploy epoch seconds (default: Date.now())
 * @returns {object} the index entry that was written
 */
export function recordDeploy({
  url,
  html,
  expiryEpoch,
  title = '',
  summary = '',
  claimUrl = '',
  renewedFrom = null,
  home = resolveHome(),
  now = Math.floor(Date.now() / 1000),
}) {
  if (!url) throw new Error('recordDeploy: url is required');
  if (typeof html !== 'string') throw new Error('recordDeploy: html is required');
  ensureDirs(home);

  const id = idFromUrl(url);
  const sha = sha256(html);

  // Content-addressed copy — write only if this content isn't already stored.
  const artifactPath = join(home, ARTIFACT_DIR, `${sha}.html`);
  if (!existsSync(artifactPath)) {
    writeFileSync(artifactPath, html);
  }

  const entry = {
    id,
    url,
    title,
    summary,
    claim_url: claimUrl,
    expires_at: expiryEpoch,
    deployed_at: now,
    sha256: sha,
    artifact: join(ARTIFACT_DIR, `${sha}.html`),
    ...(renewedFrom ? { renewed_from: renewedFrom } : {}),
  };

  appendFileSync(join(home, INDEX_FILE), JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Read the most recent index entry for a drop id (later lines override earlier
 * ones for the same id — a renew of the same id, or the natural append order).
 * @param {string} id
 * @param {string} [home]
 * @returns {object|null}
 */
export function readEntry(id, home = resolveHome()) {
  const indexPath = join(home, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  const lines = readFileSync(indexPath, 'utf8').split('\n').filter(Boolean);
  let hit = null;
  for (const line of lines) {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // tolerate a partial/garbled line, keep scanning
    }
    if (rec.id === id) hit = rec; // last one wins
  }
  return hit;
}

/**
 * Read back the archived HTML for an index entry.
 * @param {object} entry  an entry from readEntry()
 * @param {string} home
 * @returns {string}
 */
export function readArtifact(entry, home = resolveHome()) {
  const p = join(home, entry.artifact || join(ARTIFACT_DIR, `${entry.sha256}.html`));
  if (!existsSync(p)) {
    throw new Error(`drop-index: artifact missing for id ${entry.id} (${p}) — can't renew without the content`);
  }
  return readFileSync(p, 'utf8');
}

/**
 * Renew an expired (or soon-to-expire) Drop link: read the archived content,
 * strip the stale countdown, inject a fresh one stamped with the new expiry,
 * redeploy, record the renewed_from chain, and return the NEW result.
 *
 * Drop cannot revive the original URL — renew always produces a new one. A
 * missing/unarchived id fails loudly (we can't renew what we never archived).
 *
 * @param {string} urlOrId  the old url or bare id to renew
 * @param {object} opts
 * @param {(html:string)=>Promise<{url:string,claim?:string|null,expiryEpoch?:number}>} opts.deployFn
 *        redeploys the given html; returns the new url/claim/expiry.
 * @param {string} [opts.home]
 * @param {number} [opts.now]   deploy epoch seconds (default: Date.now())
 * @returns {Promise<{url:string, claim:string|null, expiryEpoch:number, renewedFrom:string, entry:object}>}
 */
export async function renew(urlOrId, { deployFn, home = resolveHome(), now } = {}) {
  if (typeof deployFn !== 'function') {
    throw new Error('renew: a deployFn is required');
  }
  const oldId = idFromUrl(urlOrId);
  const entry = readEntry(oldId, home);
  if (!entry) {
    throw new Error(
      `renew: no index entry for "${urlOrId}" (id ${oldId}) — can't renew a link we didn't archive`,
    );
  }

  const archived = readArtifact(entry, home);
  const nowSec = Number.isFinite(now) ? Math.floor(now) : Math.floor(Date.now() / 1000);

  // Deploy first with a placeholder-free page: strip the old countdown so we
  // don't stack two. The real expiry comes back from the deploy (its own clock),
  // but we stamp a best-effort fresh one before deploy so the page is never blank
  // of a countdown; the deploy fn may re-stamp with its measured upload time.
  const stripped = stripCountdown(archived);
  const provisionalExpiry = nowSec + EXPIRY_WINDOW_SECONDS;
  const staged = injectCountdown(stripped, provisionalExpiry);

  const res = await deployFn(staged);
  if (!res || !res.url) {
    throw new Error('renew: redeploy produced no url');
  }
  const expiryEpoch = Number.isFinite(res.expiryEpoch) ? res.expiryEpoch : provisionalExpiry;

  const newEntry = recordDeploy({
    url: res.url,
    html: staged,
    expiryEpoch,
    title: entry.title,
    summary: entry.summary,
    claimUrl: res.claim || '',
    renewedFrom: oldId,
    home,
    now: nowSec,
  });

  return {
    url: res.url,
    claim: res.claim || null,
    expiryEpoch,
    renewedFrom: oldId,
    entry: newEntry,
  };
}
