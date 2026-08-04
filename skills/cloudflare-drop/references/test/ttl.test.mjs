// Tests for ttl.mjs — the countdown window (round-015).
//
// The load-bearing property here is HONESTY: the countdown shown on a page must
// never claim more life than the hosting mode actually gives it. A temporary
// preview dies at 60 min no matter what TTL we asked for, so the clamp is not a
// nicety — it's what keeps the page from lying to whoever opens the link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTtl,
  resolveTtlSeconds,
  honestTtl,
  formatTtl,
  DEFAULT_TTL_SECONDS,
  TEMPORARY_HARD_TTL_SECONDS,
} from '../ttl.mjs';

test('default window matches the temporary-preview lifetime (no dead config)', () => {
  // A longer default would never reach a reader: previews clamp to 60, and
  // permanent deploys inject no countdown at all. The default must be reachable.
  assert.equal(DEFAULT_TTL_SECONDS, 60 * 60);
  assert.equal(resolveTtlSeconds({ env: {} }), 60 * 60);
  assert.equal(
    honestTtl(DEFAULT_TTL_SECONDS, 'temporary').clamped,
    false,
    'the default must survive a temporary deploy unclamped',
  );
});

test('parseTtl accepts s/m/h/d suffixes and bare numbers as minutes', () => {
  assert.equal(parseTtl('180m'), 10_800);
  assert.equal(parseTtl('3h'), 10_800);
  assert.equal(parseTtl('90'), 5_400, 'bare number = minutes');
  assert.equal(parseTtl(90), 5_400, 'numeric input = minutes');
  assert.equal(parseTtl('5400s'), 5_400);
  assert.equal(parseTtl('1d'), 86_400);
  assert.equal(parseTtl('2H'), 7_200, 'case-insensitive');
});

test('parseTtl returns null for absent/unparseable input (caller falls back)', () => {
  for (const bad of [null, undefined, '', 'soon', '-5m', '0', 'abc123', {}]) {
    assert.equal(parseTtl(bad), null, `${JSON.stringify(bad)} → null`);
  }
});

test('parseTtl clamps absurd values into a sane band', () => {
  assert.equal(parseTtl('1s'), 60, 'floor at 1 min — a shorter countdown is noise');
  assert.equal(parseTtl('999d'), 30 * 24 * 3600, 'ceiling at 30 days');
});

test('resolveTtlSeconds precedence: explicit > env > default', () => {
  const env = { CLOUDFLARE_DROP_TTL: '45m' };
  assert.equal(resolveTtlSeconds({ ttl: '2h', env }), 7_200, 'explicit wins');
  assert.equal(resolveTtlSeconds({ env }), 2_700, 'env used when no explicit');
  assert.equal(resolveTtlSeconds({ env: {} }), DEFAULT_TTL_SECONDS, 'default last');
  assert.equal(
    resolveTtlSeconds({ ttl: 'nonsense', env: {} }),
    DEFAULT_TTL_SECONDS,
    'unparseable explicit falls through to default, never throws',
  );
});

test('honestTtl clamps a temporary preview to its real 60-min lifetime', () => {
  const r = honestTtl(180 * 60, 'temporary');
  assert.equal(r.seconds, TEMPORARY_HARD_TTL_SECONDS, 'clamped to what Cloudflare enforces');
  assert.equal(r.clamped, true);
  assert.match(r.reason, /60 min/, 'reason states the real limit so the caller can surface it');
});

test('honestTtl leaves a within-limit temporary window alone', () => {
  const r = honestTtl(30 * 60, 'temporary');
  assert.equal(r.seconds, 30 * 60);
  assert.equal(r.clamped, false);
  assert.equal(r.reason, null);
});

test('honestTtl does not clamp permanent deploys', () => {
  const r = honestTtl(180 * 60, 'permanent');
  assert.equal(r.seconds, 180 * 60);
  assert.equal(r.clamped, false);
});

test('formatTtl renders whole units', () => {
  assert.equal(formatTtl(10_800), '3 小时');
  assert.equal(formatTtl(2_700), '45 分钟');
  assert.equal(formatTtl(86_400), '1 天');
  assert.equal(formatTtl(90), '90 秒');
});
