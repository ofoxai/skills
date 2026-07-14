// Tests for drop-index.mjs — the content-addressed deploy index that lets
// `deploy.mjs renew` rebuild an expired Drop link (round-014 spec 05).
//
// The index must: write one entry per deploy keyed on the URL's drop-{id}
// segment, store a sha256-addressed HTML copy (dedupe identical content),
// resolve its home in the right layers (env > hal2099 inst > standalone), and
// never live in the skill dir or a session workspace. `renew` reads it back,
// re-injects a fresh countdown, redeploys, and records the renewed_from chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  recordDeploy,
  resolveHome,
  idFromUrl,
  readEntry,
  renew,
} from '../drop-index.mjs';

const HTML = '<!doctype html><html><body><h1>Report</h1></body></html>';
const URL_A = 'https://drop-ab12.brave-lion.workers.dev';
const URL_B = 'https://drop-cd34.calm-otter.workers.dev';

function tmpHome(prefix = 'drop-idx-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// --- idFromUrl -------------------------------------------------------------

test('idFromUrl extracts the drop-{id} segment from a workers.dev url', () => {
  assert.equal(idFromUrl(URL_A), 'ab12');
  assert.equal(idFromUrl('https://drop-9xy.foo-bar.workers.dev/'), '9xy');
  // A bare id is accepted as-is (renew <id> path).
  assert.equal(idFromUrl('ab12'), 'ab12');
  assert.equal(idFromUrl('drop-ab12'), 'ab12');
});

// --- resolveHome layering --------------------------------------------------

test('resolveHome: $CLOUDFLARE_DROP_HOME wins when set', () => {
  const dir = tmpHome();
  try {
    const home = resolveHome({ env: { CLOUDFLARE_DROP_HOME: dir }, cwd: '/tmp' });
    assert.equal(home, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveHome: hal2099 instance → ~/.hal2099-<inst>/drop/', () => {
  // A hal2099 instance is detected from cwd sitting under an agents/<inst> tree,
  // or from a HAL_INSTANCE env var.
  const home = resolveHome({
    env: { HAL_INSTANCE: 'acme' },
    cwd: '/tmp',
  });
  assert.equal(home, join(homedir(), '.hal2099-acme', 'drop'));
});

test('resolveHome: standalone default → ~/.cloudflare-drop/', () => {
  const home = resolveHome({ env: {}, cwd: '/tmp' });
  assert.equal(home, join(homedir(), '.cloudflare-drop'));
});

test('resolveHome refuses the skill dir / a session workspace', () => {
  // Even if something tries to point HOME at the skill dir or a workspace, the
  // resolver must reject it (loud), never silently write into our own tree.
  const skillish = '/x/.claude/skills/cloudflare-drop';
  assert.throws(
    () => resolveHome({ env: { CLOUDFLARE_DROP_HOME: skillish }, cwd: '/tmp' }),
    /skill dir|workspace|refuse/i,
  );
  const ws = '/x/sessions/abc/workspace';
  assert.throws(
    () => resolveHome({ env: { CLOUDFLARE_DROP_HOME: ws }, cwd: '/tmp' }),
    /skill dir|workspace|refuse/i,
  );
});

// --- recordDeploy: index entry + content-addressed copy --------------------

test('recordDeploy writes an index entry + artifacts/<sha256>.html', () => {
  const home = tmpHome();
  try {
    const expiry = 1_800_000_000;
    const entry = recordDeploy({
      url: URL_A,
      title: 'Q3 Report',
      summary: 'quarterly numbers',
      claimUrl: 'https://cloudflare.com/drop/claim/xyz',
      expiryEpoch: expiry,
      html: HTML,
      home,
    });

    // index.jsonl has exactly one entry, keyed on the drop id.
    const indexPath = join(home, 'index.jsonl');
    assert.ok(existsSync(indexPath), 'index.jsonl must exist');
    const lines = readFileSync(indexPath, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'one entry written');
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.id, 'ab12', 'keyed on drop-{id}');
    assert.equal(rec.url, URL_A);
    assert.equal(rec.title, 'Q3 Report');
    assert.equal(rec.summary, 'quarterly numbers');
    assert.equal(rec.claim_url, 'https://cloudflare.com/drop/claim/xyz');
    assert.equal(rec.expires_at, expiry);
    assert.ok(rec.deployed_at, 'deploy time recorded');

    // The content-addressed copy exists and matches the sha256 in the entry.
    const sha = createHash('sha256').update(HTML).digest('hex');
    assert.equal(rec.sha256, sha, 'entry carries the content hash');
    const artifactPath = join(home, 'artifacts', `${sha}.html`);
    assert.ok(existsSync(artifactPath), 'content-addressed copy written');
    assert.equal(readFileSync(artifactPath, 'utf8'), HTML, 'copy is the original html');

    // The returned entry mirrors what was written.
    assert.equal(entry.id, 'ab12');
    assert.equal(entry.sha256, sha);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('two deploys of identical content dedupe to a single artifact', () => {
  const home = tmpHome();
  try {
    recordDeploy({ url: URL_A, html: HTML, expiryEpoch: 1, home });
    recordDeploy({ url: URL_B, html: HTML, expiryEpoch: 2, home });

    const artifactsDir = join(home, 'artifacts');
    const files = readdirSync(artifactsDir).filter((f) => f.endsWith('.html'));
    assert.equal(files.length, 1, 'identical content → exactly one artifact (sha256 dedupe)');

    // But both index entries exist (two distinct urls/ids).
    const lines = readFileSync(join(home, 'index.jsonl'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 2, 'both deploys recorded');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('readEntry returns the most recent entry for an id', () => {
  const home = tmpHome();
  try {
    recordDeploy({ url: URL_A, title: 'v1', html: HTML, expiryEpoch: 1, home });
    // A second deploy of the same id (e.g. a renew) overrides on read.
    recordDeploy({ url: URL_A, title: 'v2', html: HTML, expiryEpoch: 2, home });
    const rec = readEntry('ab12', home);
    assert.ok(rec, 'entry found');
    assert.equal(rec.title, 'v2', 'latest entry wins');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('readEntry returns null for an id that was never archived', () => {
  const home = tmpHome();
  try {
    const rec = readEntry('nope', home);
    assert.equal(rec, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- renew: rebuild + redeploy + record renewed_from -----------------------

test('renew reads the index, re-injects a fresh countdown, redeploys, records renewed_from', async () => {
  const home = tmpHome();
  try {
    // Seed: an original deploy is archived.
    recordDeploy({
      url: URL_A,
      title: 'Q3 Report',
      html: HTML,
      expiryEpoch: 1_000,
      claimUrl: 'https://cloudflare.com/drop/claim/orig',
      home,
    });

    // A fake deploy fn stands in for the real playwright upload: it returns a
    // NEW url and captures the html it was handed so we can assert the countdown
    // was re-injected fresh.
    let deployedHtml = null;
    const fakeDeploy = async (html) => {
      deployedHtml = html;
      return {
        url: URL_B,
        claim: 'https://cloudflare.com/drop/claim/new',
        expiryEpoch: 2_000,
      };
    };

    const result = await renew('ab12', { home, deployFn: fakeDeploy, now: 1_500 });

    // Returns the NEW url (Drop can't revive the original).
    assert.equal(result.url, URL_B, 'renew returns the new url');
    assert.notEqual(result.url, URL_A, 'not the original url');
    // The real expiry (from the deploy's own clock) is surfaced.
    assert.equal(result.expiryEpoch, 2_000, 'the deploy-measured expiry is returned');

    // The redeployed html carries a FRESH countdown (stamped with the renew's
    // provisional expiry = now + 3600 = 5100), not the stale 1000.
    assert.ok(deployedHtml.includes('drop-expiry-countdown'), 'fresh countdown injected');
    assert.ok(deployedHtml.includes('5100'), 'fresh provisional expiry stamped (now+3600)');
    assert.ok(!deployedHtml.includes('data-expiry-epoch="1000"'), 'stale expiry not carried over');

    // The new entry records the renewed_from chain (points back to the old id)
    // and the deploy-measured expiry.
    const newRec = readEntry('cd34', home);
    assert.ok(newRec, 'new entry recorded');
    assert.equal(newRec.renewed_from, 'ab12', 'renewed_from chains back to the original');
    assert.equal(newRec.expires_at, 2_000, 'new entry carries the deploy-measured expiry');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('renew strips a stale countdown before re-injecting (no double countdown)', async () => {
  const home = tmpHome();
  try {
    // Seed with html that ALREADY carries a countdown (as a real deployed page would).
    const { injectCountdown } = await import('../inject-countdown.mjs');
    const staleHtml = injectCountdown(HTML, 1_000);
    recordDeploy({ url: URL_A, html: staleHtml, expiryEpoch: 1_000, home });

    let deployedHtml = null;
    const fakeDeploy = async (html) => {
      deployedHtml = html;
      return { url: URL_B, claim: null, expiryEpoch: 5_000 };
    };
    await renew('ab12', { home, deployFn: fakeDeploy, now: 4_500 });

    const count = (deployedHtml.match(/id="drop-expiry-countdown"/g) || []).length;
    assert.equal(count, 1, 'exactly one countdown after renew (stale one stripped)');
    // A fresh countdown is stamped with the renew's provisional expiry (now+3600
    // = 8100), and the stale expiry (1000) is gone.
    assert.ok(deployedHtml.includes('data-expiry-epoch="8100"'), 'fresh expiry stamped (now+3600)');
    assert.ok(!deployedHtml.includes('data-expiry-epoch="1000"'), 'stale expiry gone');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('renew of an unarchived id fails loudly (no silent guess)', async () => {
  const home = tmpHome();
  try {
    const fakeDeploy = async () => ({ url: URL_B, claim: null, expiryEpoch: 2 });
    await assert.rejects(
      () => renew('ghost', { home, deployFn: fakeDeploy }),
      /not archived|no index entry|can't renew|cannot renew/i,
      'renewing an unarchived id must throw',
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
