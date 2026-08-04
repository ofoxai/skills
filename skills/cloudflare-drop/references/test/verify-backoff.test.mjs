// Tests for the self-verify backoff (round-014 spec 05, folding in #89).
//
// Drop edge propagation means the fresh URL can 404 for a few seconds after the
// deploy reports done. Both round-013 rehearsals hit this and pushed the retry
// decision onto the caller. verifyWithBackoff polls with escalating intervals
// (default ~5 tries, ~60s budget) and only reports URL_UNVERIFIED once every
// probe has failed — the caller no longer hand-retries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyWithBackoff,
  BACKOFF_DELAYS_MS,
  verifyContent,
  deployHtmlString,
} from '../deploy.mjs';

test('succeeds once a probe returns 200 (first two 404, third 200)', async () => {
  const codes = [404, 404, 200];
  let calls = 0;
  const probe = async () => codes[calls++];
  const slept = [];
  const sleepFn = async (ms) => { slept.push(ms); };

  const ok = await verifyWithBackoff('https://x.workers.dev', { probe, sleepFn });

  assert.equal(ok, true, 'reports verified once a 200 arrives');
  assert.equal(calls, 3, 'stopped probing after the first 200');
  // Slept between the failed probes (before probe 2 and probe 3), escalating.
  assert.equal(slept.length, 2, 'backed off between the two failures');
  assert.ok(slept[1] >= slept[0], 'intervals escalate');
});

test('reports URL_UNVERIFIED when every probe fails', async () => {
  let calls = 0;
  const probe = async () => { calls++; return 404; };
  const sleepFn = async () => {};

  const ok = await verifyWithBackoff('https://x.workers.dev', { probe, sleepFn, tries: 5 });

  assert.equal(ok, false, 'all probes failed → unverified');
  assert.equal(calls, 5, 'tried the full budget');
});

test('defaults to ~5 escalating tries within a ~60s budget', () => {
  assert.ok(Array.isArray(BACKOFF_DELAYS_MS), 'backoff schedule is exported');
  assert.ok(BACKOFF_DELAYS_MS.length >= 4, 'about 5 tries');
  // Monotonic non-decreasing (escalating) intervals.
  for (let i = 1; i < BACKOFF_DELAYS_MS.length; i++) {
    assert.ok(BACKOFF_DELAYS_MS[i] >= BACKOFF_DELAYS_MS[i - 1], 'intervals escalate');
  }
  const total = BACKOFF_DELAYS_MS.reduce((a, b) => a + b, 0);
  assert.ok(total <= 65_000, `total wait budget ~60s (was ${total}ms)`);
  assert.ok(total >= 20_000, 'meaningful budget, not near-instant');
});

test('a probe that throws is treated as a failed attempt, not a crash', async () => {
  let calls = 0;
  const probe = async () => {
    calls++;
    if (calls < 3) throw new Error('network blip');
    return 200;
  };
  const sleepFn = async () => {};
  const ok = await verifyWithBackoff('https://x.workers.dev', { probe, sleepFn });
  assert.equal(ok, true, 'rides out transient probe errors and eventually verifies');
});

// --- verifyContent: check content, not just status (round-016 spec 02, A6) --
// round-015 A6: a renewed page returned HTTP 200 but was a blank/truncated husk;
// a status-only self-verify reported success and the user got an empty page.
// verifyContent downloads the live page and asserts it is the real content:
// its byte size is within tolerance of the source (allowing the injected
// countdown's small growth) AND a body sentinel string is present.

const SOURCE_HTML =
  '<!doctype html><html><body><h1>Report</h1>' +
  'X'.repeat(2000) +
  '<span id="sentinel">the-body-is-here</span></body></html>';

test('verifyContent passes when the live page matches the source (size + sentinel)', async () => {
  // fetchFn returns the deployed page ~= source (a bit larger: countdown injected).
  const live = SOURCE_HTML + '<div id="drop-expiry-countdown">…</div>';
  const fetchFn = async () => live;
  const ok = await verifyContent('https://x.workers.dev', {
    sourceHtml: SOURCE_HTML,
    sentinel: 'the-body-is-here',
    fetchFn,
  });
  assert.equal(ok, true, 'full content served → verified');
});

test('verifyContent FAILS on a truncated/blank page (the A6 husk)', async () => {
  // The bug: a ~1.8KB head-only husk served for a ~33KB source. Here the live
  // page is a fraction of the source and the body sentinel is gone.
  const husk = '<!doctype html><html><head><title>Report</title></head><body></body></html>';
  const fetchFn = async () => husk;
  const ok = await verifyContent('https://x.workers.dev', {
    sourceHtml: SOURCE_HTML,
    sentinel: 'the-body-is-here',
    fetchFn,
  });
  assert.equal(ok, false, 'truncated/blank page must fail content verification');
});

test('verifyContent FAILS when the body sentinel is missing even if size is close', async () => {
  // Same size class, but the key body string isn't there → not the real page.
  const wrong = '<!doctype html><html><body>' + 'Y'.repeat(2010) + '</body></html>';
  const fetchFn = async () => wrong;
  const ok = await verifyContent('https://x.workers.dev', {
    sourceHtml: SOURCE_HTML,
    sentinel: 'the-body-is-here',
    fetchFn,
  });
  assert.equal(ok, false, 'missing sentinel → fail even at a plausible size');
});

// --- deployHtmlString routes BOTH deploy + renew through the same verifier ---
// A6 single-exit: the URL is only ever returned after verifyWithBackoff (edge
// poll) AND verifyContent (size + sentinel). renew hands its rebuilt page to
// deployHtmlString, so it inherits the exact same content self-verify — a caller
// never has to hand-sleep+curl.

test('deployHtmlString throws URL_UNVERIFIED when content check fails (blank page)', async () => {
  const html = SOURCE_HTML;
  await assert.rejects(
    () =>
      deployHtmlString(html, {
        // upload succeeds and 200-probes pass, but the served content is a husk.
        uploadFn: async () => ({
          url: 'https://drop-x.a.workers.dev',
          claim: null,
          uploadedAtUTC: new Date().toISOString(),
        }),
        probe: async () => 200,
        fetchFn: async () =>
          '<!doctype html><html><head></head><body></body></html>', // husk
        sleepFn: async () => {},
      }),
    /URL_UNVERIFIED/,
    'a 200 that serves a blank page must NOT be reported as success',
  );
});

test('deployHtmlString returns the url when both 200 and content verify pass', async () => {
  const html = SOURCE_HTML;
  const res = await deployHtmlString(html, {
    uploadFn: async () => ({
      url: 'https://drop-ok.a.workers.dev',
      claim: 'https://cloudflare.com/drop/claim/ok',
      uploadedAtUTC: new Date().toISOString(),
    }),
    probe: async () => 200,
    fetchFn: async () => html + '<div id="drop-expiry-countdown"></div>',
    sleepFn: async () => {},
  });
  assert.equal(res.url, 'https://drop-ok.a.workers.dev');
  assert.equal(res.claim, 'https://cloudflare.com/drop/claim/ok');
});
