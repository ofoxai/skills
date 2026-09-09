import { randomInt, randomBytes, createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

// Only the server receives the key/hash. Plaintext codes are returned to the
// operator once, never written to asset files, config, or the renewal index.
export function stageOtp(stagedDir, { name, compatibilityDate }) {
  const root = dirname(stagedDir);
  const otpCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const key = randomBytes(32).toString('hex');
  const html = readFileSync(join(here, 'otp-gate.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const hash = createHash('sha256').update(script).digest('base64');
  writeFileSync(join(root, 'otp-worker.mjs'), readFileSync(join(here, 'otp-worker.mjs'), 'utf8').replace('__SCRIPT_HASH__', hash), { mode: 0o600 });
  cpSync(join(here, 'otp-gate.html'), join(root, 'otp-gate.html'));
  const configPath = join(root, 'wrangler.json');
  writeFileSync(configPath, JSON.stringify({
    name, compatibility_date: compatibilityDate, main: './otp-worker.mjs',
    assets: { directory: './site', binding: 'ASSETS', run_worker_first: true },
    rules: [{ type: 'Text', globs: ['**/*.html'], fallthrough: true }],
    vars: { SESSION_KEY: key, OTP_HASH: createHmac('sha256', key).update(`code:${otpCode}`).digest('hex') },
    durable_objects: { bindings: [{ name: 'OTP_LIMITER', class_name: 'OtpLimiter' }] },
    migrations: [{ tag: 'otp-v1', new_sqlite_classes: ['OtpLimiter'] }],
    observability: { enabled: false },
  }, null, 2), { mode: 0o600 });
  return { configPath, otpCode };
}

// Verify the guard AND exact authorized content before returning a protected URL.
export async function verifyOtp(url, { otpCode, sourceHtml, request = fetch }) {
  const call = (path, opts = {}) => request(new URL(path, url), { redirect: 'manual', signal: AbortSignal.timeout(20000), ...opts });
  try {
    for (const path of ['/', '/index.html', '/otp-worker.mjs', '/wrangler.json', '/asset.css']) {
      const res = await call(path);
      const body = await res.text();
      if (res.status !== 401 || !body.includes('id="code"') || !res.headers.get('Cache-Control')?.includes('no-store')) return false;
    }
    const login = code => call('/__drop/login', { method: 'POST', headers: { Origin: new URL(url).origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const wrong = await login(String((Number(otpCode) + 1) % 1_000_000).padStart(6, '0'));
    if (wrong.status !== 401 || wrong.headers.has('Set-Cookie')) return false;
    const accepted = await login(otpCode);
    const cookie = accepted.headers.get('Set-Cookie');
    if (accepted.status !== 200 || !cookie || !cookie.includes('HttpOnly') || !cookie.includes('Secure')) return false;
    const content = await call('/', { headers: { Cookie: cookie.split(';')[0] } });
    return content.status === 200 && (await content.text()) === sourceHtml;
  } catch { return false; }
}
