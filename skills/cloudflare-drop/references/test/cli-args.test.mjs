// Tests for the CLI flag parser (deploy.mjs parseArgs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../deploy.mjs';

test('parseArgs: defaults — countdown on, oauth pause on', () => {
  const a = parseArgs([]);
  assert.deepEqual(a, {
    _: [],
    ttl: null,
    name: null,
    permanent: false,
    pauseOAuth: true,
    noCountdown: false,
  });
});

test('parseArgs: every flag lands on its field', () => {
  const a = parseArgs([
    'page.html',
    '--ttl', '30m',
    '--name', 'my-report',
    '--permanent',
    '--no-pause-oauth',
    '--no-countdown',
  ]);
  assert.deepEqual(a._, ['page.html']);
  assert.equal(a.ttl, '30m');
  assert.equal(a.name, 'my-report');
  assert.equal(a.permanent, true);
  assert.equal(a.pauseOAuth, false);
  assert.equal(a.noCountdown, true);
});
