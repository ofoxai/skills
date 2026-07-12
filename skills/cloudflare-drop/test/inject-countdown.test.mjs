// Tests for inject-countdown.mjs — the pre-deploy guard that ensures every
// deployed Drop page carries a 60-minute expiry countdown (round-013 spec 01).
// Run: node --test agents/.template/sessions/.session-template/.claude/skills/cloudflare-drop/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCountdown } from '../references/inject-countdown.mjs';

const EXPIRY = 1_800_000_000; // a fixed epoch-seconds value for deterministic assertions

test('injects a countdown into a page that has none', () => {
  const html = '<!doctype html><html><head></head><body><h1>Report</h1></body></html>';
  const out = injectCountdown(html, EXPIRY);
  assert.match(out, /id="drop-expiry-countdown"/, 'countdown element must be present');
  assert.match(out, new RegExp(String(EXPIRY)), 'the real expiry epoch must be stamped in');
  assert.match(out, /链接将在/, 'countdown copy must be present');
  assert.ok(out.includes('<h1>Report</h1>'), 'original content preserved');
});

test('is idempotent — a page that already has the countdown is returned unchanged', () => {
  const html = '<!doctype html><html><body><h1>X</h1></body></html>';
  const once = injectCountdown(html, EXPIRY);
  const twice = injectCountdown(once, EXPIRY);
  assert.equal(twice, once, 'second inject must be a no-op (no duplicate countdown)');
  const count = (twice.match(/id="drop-expiry-countdown"/g) || []).length;
  assert.equal(count, 1, 'exactly one countdown element');
});

test('countdown uses :root vars, not hardcoded colors (light/dark ready)', () => {
  const html = '<!doctype html><html><body></body></html>';
  const out = injectCountdown(html, EXPIRY);
  // The injected style must reference CSS variables, matching the playground standard.
  assert.match(out, /var\(--/, 'countdown styling must go through :root variables');
});

test('fail-open — unparseable/empty input returns something usable, never throws', () => {
  // Countdown is an enhancement; it must never block delivery.
  assert.doesNotThrow(() => injectCountdown('', EXPIRY));
  const out = injectCountdown('not really html', EXPIRY);
  assert.ok(typeof out === 'string' && out.length > 0, 'returns a non-empty string');
});
