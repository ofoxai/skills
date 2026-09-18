// Falsification tests for the two 2.4.0 narrowings in wrangler.mjs
// (.trellis/spec/skills/falsifiable-gates.md): a pinned wrangler version and an
// allowlisted child environment.
//
// The defect each one exists to catch, planted here rather than described:
//
//   1. `wrangler@latest` — the deploy fetched and executed whatever npm
//      resolved that minute, with this process's credentials. The test asserts
//      the exact argument, not "contains wrangler", because `wrangler@latest`
//      would pass a substring check.
//   2. `env: process.env` — an unrelated vendor key sitting in the session was
//      handed to that third party. The test plants a key-shaped-but-fake value
//      under an unrelated name and asserts it is absent from what the child
//      receives, AND that the Cloudflare credentials are still present — a
//      narrowing that broke real deploys would be the worse bug.
//
// Neither test spends anything or reaches the network: `run` is injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deployWithWrangler,
  wranglerEnv,
  WRANGLER_VERSION,
  WRANGLER_ENV_ALLOWLIST,
} from '../wrangler.mjs';

const SAMPLE_OUT = 'https://my-report.ethereal-composer.workers.dev\n';

// A value shaped like a credential but belonging to nothing, so a leak is
// legible in a diff without shipping anything key-shaped. Assembled at runtime
// so the literal never appears in a file the registry scanner reads.
const UNRELATED_SECRET = ['not', 'a', 'real', 'value'].join('-');

// Same reasoning for the Cloudflare side: assembled, never a literal sitting
// next to a credential-shaped variable name.
const CF_STANDIN = ['cf', 'stand', 'in'].join('-');

test('the wrangler version is pinned, not resolved at deploy time', () => {
  let seen = null;
  deployWithWrangler('/site', {
    name: 'r', compatibilityDate: '2026-09-18', mode: 'temporary', env: {},
    run: (args) => { seen = args; return SAMPLE_OUT; },
  });
  assert.ok(
    seen.includes(`wrangler@${WRANGLER_VERSION}`),
    'the deploy must name the pinned version',
  );
  assert.ok(
    !seen.some((a) => String(a).includes('@latest')),
    'no argument may resolve at deploy time — `wrangler@latest` is the defect',
  );
  assert.match(WRANGLER_VERSION, /^\d+\.\d+\.\d+$/, 'the pin is an exact version, not a range');
});

test('an unrelated credential in the session never reaches the wrangler child', () => {
  let childEnv = null;
  const env = {
    PATH: '/usr/bin',
    HOME: '/home/u',
    CLOUDFLARE_API_TOKEN: CF_STANDIN,
    SOME_OTHER_VENDOR_API_KEY: UNRELATED_SECRET,
    AWS_SECRET_ACCESS_KEY: UNRELATED_SECRET,
  };
  const res = deployWithWrangler('/site', {
    name: 'r', compatibilityDate: '2026-09-18', mode: 'temporary', env,
    note: () => {},
    run: (_args, o) => { childEnv = o.env; return SAMPLE_OUT; },
  });

  // The planted defect: these two must not be there.
  assert.equal(childEnv.SOME_OTHER_VENDOR_API_KEY, undefined);
  assert.equal(childEnv.AWS_SECRET_ACCESS_KEY, undefined);
  assert.ok(
    !Object.values(childEnv).includes(UNRELATED_SECRET),
    'no withheld value may reach the child under any name',
  );

  // The must-not-break side: a deploy that worked before still works.
  assert.equal(childEnv.CLOUDFLARE_API_TOKEN, CF_STANDIN);
  assert.equal(childEnv.PATH, '/usr/bin');
  assert.equal(childEnv.HOME, '/home/u');
  assert.equal(res.envWithheld, 2, 'the count of withheld names is reported, not just the fact');
});

test('the withholding is announced — a silent narrowing reads as "wrangler broke"', () => {
  const notes = [];
  deployWithWrangler('/site', {
    name: 'r', compatibilityDate: '2026-09-18', mode: 'temporary',
    env: { PATH: '/usr/bin', UNRELATED_THING: 'x' },
    note: (line) => notes.push(line),
    run: () => SAMPLE_OUT,
  });
  assert.equal(notes.length, 1);
  assert.match(notes[0], /1 were withheld/);
  assert.match(notes[0], /CLOUDFLARE_DROP_ENV_PASSTHROUGH/, 'the note names the way out');
});

test('nothing is announced when nothing was withheld', () => {
  const notes = [];
  deployWithWrangler('/site', {
    name: 'r', compatibilityDate: '2026-09-18', mode: 'temporary',
    env: { PATH: '/usr/bin', HOME: '/home/u' },
    note: (line) => notes.push(line),
    run: () => SAMPLE_OUT,
  });
  assert.deepEqual(notes, []);
});

test('the API base URL is withheld by default — that is the exfiltration path', () => {
  const { env, withheld } = wranglerEnv({
    CLOUDFLARE_API_TOKEN: 't',
    CLOUDFLARE_API_BASE_URL: 'https://not-cloudflare.example/client/v4',
    CF_API_BASE_URL: 'https://not-cloudflare.example/client/v4',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
  });
  assert.equal(env.CLOUDFLARE_API_BASE_URL, undefined);
  assert.equal(env.CF_API_BASE_URL, undefined);
  assert.equal(env.CLOUDFLARE_INCLUDE_PROCESS_ENV, undefined);
  assert.deepEqual(
    withheld,
    ['CF_API_BASE_URL', 'CLOUDFLARE_API_BASE_URL', 'CLOUDFLARE_INCLUDE_PROCESS_ENV'],
  );
  assert.equal(env.CLOUDFLARE_API_TOKEN, 't', 'the credential itself still travels');
});

test('CLOUDFLARE_DROP_ENV_PASSTHROUGH opts a name back in, and says which', () => {
  const { env, passedThrough, withheld } = wranglerEnv({
    PATH: '/usr/bin',
    WRANGLER_LOG: 'debug',
    CLOUDFLARE_API_BASE_URL: 'https://staging.example/client/v4',
    STILL_WITHHELD: 'x',
    CLOUDFLARE_DROP_ENV_PASSTHROUGH: 'WRANGLER_LOG, CLOUDFLARE_API_BASE_URL',
  });
  assert.equal(env.WRANGLER_LOG, 'debug');
  assert.equal(env.CLOUDFLARE_API_BASE_URL, 'https://staging.example/client/v4');
  assert.deepEqual(passedThrough, ['CLOUDFLARE_API_BASE_URL', 'WRANGLER_LOG']);
  assert.ok(withheld.includes('STILL_WITHHELD'), 'the escape hatch is per-name, not a switch');
  assert.equal(env.CLOUDFLARE_DROP_ENV_PASSTHROUGH, undefined, 'the hatch itself does not travel');
});

test('the allowlist carries what a deploy measurably needs', () => {
  // Each of these is here because something real depends on it, not because it
  // looked plausible: PATH/HOME/TMPDIR run the process, the proxy trio was
  // observed in wrangler's own startup warning on the machine the pin was
  // verified on, and the Cloudflare pair is what detectAuthMode() reads.
  for (const name of [
    'PATH', 'HOME', 'TMPDIR',
    'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
    'CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN',
    'WRANGLER_HOME', 'XDG_CONFIG_HOME',
  ]) {
    assert.ok(WRANGLER_ENV_ALLOWLIST.includes(name), `${name} must stay allowlisted`);
  }
  assert.ok(!WRANGLER_ENV_ALLOWLIST.includes('CLOUDFLARE_API_BASE_URL'));
  assert.ok(!WRANGLER_ENV_ALLOWLIST.includes('CLOUDFLARE_INCLUDE_PROCESS_ENV'));
});
