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
  renewCountFor,
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

test('resolveHome: portable — only two layers, no hal2099 middle layer (U1a)', () => {
  // round-016 U1a: the skill is published standalone, so it must carry ZERO
  // hal2099 awareness. There is no `~/.hal2099-<inst>/drop` layer anymore — a
  // hal2099-looking env / cwd resolves to the SAME standalone default. hal2099
  // integration is done purely by injecting CLOUDFLARE_DROP_HOME at deploy time.
  const standalone = join(homedir(), '.cloudflare-drop');
  assert.equal(
    resolveHome({ env: { HAL_INSTANCE: 'acme' }, cwd: '/tmp' }),
    standalone,
    'a HAL_INSTANCE env must NOT create a hal2099-specific home',
  );
  assert.equal(
    resolveHome({ env: {}, cwd: '/x/agents/acme/sessions/s1' }),
    standalone,
    'a hal2099-looking cwd must NOT create a hal2099-specific home',
  );
});

test('resolveHome: standalone default → ~/.cloudflare-drop/', () => {
  const home = resolveHome({ env: {}, cwd: '/tmp' });
  assert.equal(home, join(homedir(), '.cloudflare-drop'));
});

test('resolveHome: $CLOUDFLARE_DROP_HOME injection is the only integration seam', () => {
  const dir = tmpHome();
  try {
    // This is how hal2099 lands the index under the instance dir — via env only.
    const home = resolveHome({ env: { CLOUDFLARE_DROP_HOME: dir }, cwd: '/x/agents/acme' });
    assert.equal(home, dir, 'the injected env wins over any cwd/instance heuristics');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test('renew reproduces the FULL body of a large page (A3: no head-only truncation)', async () => {
  // round-015 A3: renewing a 33.7KB page produced a 1.8KB page — strip ate the
  // whole body, leaving only head + countdown CSS. This guards the whole renew
  // chain (archive → strip → re-inject → deploy) end to end: the html handed to
  // the deploy fn must carry the entire source body, sized like the source.
  const home = tmpHome();
  try {
    // A realistic large page with its own <style>/<div>/<script> (what tripped strip).
    const rows = Array.from(
      { length: 60 },
      (_, i) => `<div class="row">Section ${i}: substantial content to make this page large.</div>`,
    ).join('\n');
    const bigPage =
      '<!doctype html><html><head><title>Big</title>\n<style>.row{padding:8px}</style>\n</head><body>\n' +
      '<h1>Big Report</h1>\n' +
      rows +
      "\n<script>function foo(){return 1;}</script>\n</body></html>";

    // Archive the page EXACTLY as deploy does — with the countdown already
    // injected (recordDeploy stores the staged index.html, which carries it).
    // This is what tripped A3: renew strips this stale countdown before re-inject.
    const { injectCountdown } = await import('../inject-countdown.mjs');
    const archived = injectCountdown(bigPage, 1_000);
    recordDeploy({ url: URL_A, title: 'Big', html: archived, expiryEpoch: 1_000, home });

    let deployedHtml = null;
    const fakeDeploy = async (html) => {
      deployedHtml = html;
      return { url: URL_B, claim: null, expiryEpoch: 5_000 };
    };
    await renew('ab12', { home, deployFn: fakeDeploy, now: 4_500 });

    // Body sentinels present — not the head-only ~1.8KB artifact.
    assert.ok(deployedHtml.includes('Section 59'), 'last body row present after renew');
    assert.ok(deployedHtml.includes('<h1>Big Report</h1>'), 'heading present after renew');
    assert.ok(deployedHtml.includes('function foo(){return 1;}'), "page's own script present");
    // Renewed size is within tolerance of the source (source + one countdown block),
    // never a fraction of it. The old bug produced < 10% of the source size.
    assert.ok(
      deployedHtml.length >= bigPage.length * 0.9,
      `renewed size ~= source (got ${deployedHtml.length} vs ${bigPage.length})`,
    );
    // Exactly one fresh countdown (stale stripped, not stacked).
    const cd = (deployedHtml.match(/id="drop-expiry-countdown"/g) || []).length;
    assert.equal(cd, 1, 'exactly one countdown after renew');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- renewCount: the renewed_from chain depth (round-016 spec 03, U1b) -------
// Claim etiquette gates on how many times the SAME content has been renewed.
// The renew output surfaces renewCount so the delivery skill offers the claim
// link ONLY at the 3rd renew (renewCount >= 3), link + expiry every other time.

test('renew surfaces renewCount, incrementing along the renewed_from chain', async () => {
  const home = tmpHome();
  try {
    // Original deploy (renewCount 0 — it's not a renew).
    const { injectCountdown } = await import('../inject-countdown.mjs');
    recordDeploy({ url: URL_A, title: 'Doc', html: injectCountdown(HTML, 1_000), expiryEpoch: 1_000, home });

    // Each renew's deployFn returns the NEXT url in the chain.
    const urls = [
      'https://drop-r1.a.workers.dev',
      'https://drop-r2.b.workers.dev',
      'https://drop-r3.c.workers.dev',
    ];
    let step = 0;
    const fakeDeploy = async () => ({ url: urls[step++], claim: 'https://cloudflare.com/drop/claim/x', expiryEpoch: 9_000 });

    // 1st renew: original → r1 → renewCount 1.
    const a = await renew('ab12', { home, deployFn: fakeDeploy, now: 1_500 });
    assert.equal(a.renewCount, 1, 'first renew → renewCount 1');

    // 2nd renew: r1 → r2 → renewCount 2.
    const b = await renew('r1', { home, deployFn: fakeDeploy, now: 2_000 });
    assert.equal(b.renewCount, 2, 'second renew → renewCount 2');

    // 3rd renew: r2 → r3 → renewCount 3 (this is where claim is offered).
    const c = await renew('r2', { home, deployFn: fakeDeploy, now: 2_500 });
    assert.equal(c.renewCount, 3, 'third renew → renewCount 3 (claim-offer threshold)');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('renewCountFor walks the renewed_from chain to a given id', () => {
  const home = tmpHome();
  try {
    recordDeploy({ url: URL_A, html: HTML, expiryEpoch: 1, home }); // ab12, root
    recordDeploy({ url: 'https://drop-x1.a.workers.dev', html: HTML, expiryEpoch: 2, renewedFrom: 'ab12', home });
    recordDeploy({ url: 'https://drop-x2.b.workers.dev', html: HTML, expiryEpoch: 3, renewedFrom: 'x1', home });

    assert.equal(renewCountFor('ab12', home), 0, 'the root is renewCount 0');
    assert.equal(renewCountFor('x1', home), 1, 'one hop from root → 1');
    assert.equal(renewCountFor('x2', home), 2, 'two hops from root → 2');
    assert.equal(renewCountFor('nope', home), 0, 'an unknown id → 0 (no chain)');
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
