// Server-only module. Never copy this file or its configuration into ASSETS.
import gateHtml from './otp-gate.html';
const encoder = new TextEncoder();
const cookieName = '__Host-drop_session';
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function secure(response) {
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'no-referrer');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  out.headers.delete('ETag');
  out.headers.delete('Last-Modified');
  return out;
}
function json(status, message, headers = {}) {
  return secure(Response.json({ message }, { status, headers }));
}
async function authenticated(request, env) {
  const value = request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!value || !/^\d{10}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expiry, signature] = value.split('.');
  const now = Math.floor(Date.now() / 1000);
  return Number(expiry) > now && Number(expiry) <= now + 3600 && equal(signature, await sign(`session:${new URL(request.url).host}:${expiry}`, env.SESSION_KEY));
}
export default {
  async fetch(request, env) {
    try {
      if (!env.SESSION_KEY || !env.OTP_HASH || !env.OTP_LIMITER) return json(503, 'Access is temporarily unavailable.');
      const url = new URL(request.url);
      if (url.pathname === '/__drop/login') {
        if (request.method !== 'POST') return json(405, 'Use POST.', { Allow: 'POST' });
        if (request.headers.get('Origin') !== url.origin) return json(403, 'Please reload this page and try again.');
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, 'Expected JSON.');
        // Stream with an actual byte limit; Content-Length alone is untrusted.
        let text = '', size = 0;
        if (request.body) {
          const reader = request.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 256) { await reader.cancel(); return json(413, 'Request too large.'); }
            text += new TextDecoder().decode(value);
          }
        }
        let code;
        try { code = JSON.parse(text).code; } catch { return json(400, 'Enter a six-digit access code.'); }
        if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return json(400, 'Enter a six-digit access code.');
        // One durable instance serializes the budget across isolates and locations.
        const limiter = env.OTP_LIMITER.get(env.OTP_LIMITER.idFromName('login'));
        const ip = await sign(request.headers.get('CF-Connecting-IP') || 'unknown', env.SESSION_KEY);
        const limit = await limiter.fetch('https://internal/attempt', { method: 'POST', body: JSON.stringify({ ip }) });
        if (limit.status !== 200) return json(429, 'Too many attempts. Please try again later.', { 'Retry-After': limit.headers.get('Retry-After') || '900' });
        if (!equal(await sign(`code:${code}`, env.SESSION_KEY), env.OTP_HASH)) return json(401, 'That code did not match. Please try again.');
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const signature = await sign(`session:${url.host}:${expiry}`, env.SESSION_KEY);
        return json(200, 'Access granted.', { 'Set-Cookie': `${cookieName}=${expiry}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600` });
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
      if (!await authenticated(request, env)) {
        const response = secure(new Response(request.method === 'HEAD' ? null : gateHtml, { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
        response.headers.set('Content-Security-Policy', "default-src 'none'; script-src 'sha256-__SCRIPT_HASH__'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
        return response;
      }
      // Strip conditional/range requests; authenticated responses must never reuse
      // a previous viewer's browser cache. Every asset remains behind this check.
      const headers = new Headers(request.headers);
      for (const key of ['Cookie', 'Authorization', 'If-None-Match', 'If-Modified-Since', 'Range']) headers.delete(key);
      return secure(await env.ASSETS.fetch(new Request(request, { headers })));
    } catch {
      return json(503, 'Access is temporarily unavailable. Please try again.');
    }
  },
};

// A fixed window bounds both per-client and distributed guessing. Counters are
// stored atomically, survive restarts, and store HMACs rather than raw IPs.
export class OtpLimiter {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const { ip } = await request.json();
    const now = Date.now();
    return this.state.storage.transaction(async storage => {
      let window = await storage.get('window');
      if (!window || now >= window.until) window = { until: now + 900000, total: 0, clients: {} };
      if (window.total >= 100 || (window.clients[ip] || 0) >= 10) {
        return new Response(null, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((window.until - now) / 1000))) } });
      }
      window.total++;
      window.clients[ip] = (window.clients[ip] || 0) + 1;
      await storage.put('window', window);
      return new Response(null, { status: 200 });
    });
  }
}
