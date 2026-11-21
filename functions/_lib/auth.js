// Single-password gate: a signed, HttpOnly cookie. No accounts, no database.
// Uses the Web Crypto API that Cloudflare Workers provide (no Node modules).
const COOKIE = 'nb_session';
const DAYS = 30;
const enc = new TextEncoder();

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))); }

async function secretFor(cfg) {
  // If SESSION_SECRET is not set, derive one from the password: changing the password signs everyone out.
  if (cfg.sessionSecret) return cfg.sessionSecret;
  return b64url(await sha256('nb-session|' + cfg.password));
}

async function sign(cfg, exp) {
  const key = await crypto.subtle.importKey('raw', enc.encode(await secretFor(cfg)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode('nb1.' + exp)));
}

/** Compare two strings without leaking where they differ: hash both, then compare every byte. */
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

export async function makeToken(cfg, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DAYS * 86400;
  return `${exp}.${await sign(cfg, exp)}`;
}

export async function verifyToken(cfg, token, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(now / 1000)) return false;
  return safeEqual(sig, await sign(cfg, exp));
}

export function getCookie(request, name) {
  const raw = request.headers.get('cookie');
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return ''; }
    }
  }
  return '';
}

export const isAuthed = (cfg, request) => verifyToken(cfg, getCookie(request, COOKIE));
export const passwordOk = (cfg, attempt) => safeEqual(attempt || '', cfg.password);

const isHttps = (request) => new URL(request.url).protocol === 'https:';

export async function sessionCookie(cfg, request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE}=${await makeToken(cfg)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

export function clearCookie(request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
