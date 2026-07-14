// Tests for the self-verify backoff (round-014 spec 05, folding in #89).
//
// Drop edge propagation means the fresh URL can 404 for a few seconds after the
// deploy reports done. Both round-013 rehearsals hit this and pushed the retry
// decision onto the caller. verifyWithBackoff polls with escalating intervals
// (default ~5 tries, ~60s budget) and only reports URL_UNVERIFIED once every
// probe has failed — the caller no longer hand-retries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWithBackoff, BACKOFF_DELAYS_MS } from '../deploy.mjs';

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
