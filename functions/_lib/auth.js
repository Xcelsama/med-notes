// Login sessions: a signed, HttpOnly cookie that says WHO you are. No database lookup is needed to read it,
// because the server signs it with a secret (an HMAC). If anyone edits the name inside, the signature stops matching.
// Uses the Web Crypto API that Cloudflare Workers provide (no Node modules).
import { loadUsers, publicUser } from './users.js';

const COOKIE = 'nb_session';
const DAYS = 30;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function sha256(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))); }

async function secretFor(cfg) {
  // If SESSION_SECRET is not set, derive one from the access code: changing the code signs everyone out.
  if (cfg.sessionSecret) return cfg.sessionSecret;
  return b64url(await sha256('nb-session|' + cfg.password));
}

async function sign(cfg, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(await secretFor(cfg)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode('nb2.' + text)));
}

/** Compare two strings without leaking where they differ: hash both, then compare every byte. */
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/** user = { key, sv }  (key = lowercase name, sv = the account's session version) */
export async function makeToken(cfg, user, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DAYS * 86400;
  const body = `${b64url(enc.encode(user.key))}.${user.sv}.${exp}`;
  return `${body}.${await sign(cfg, body)}`;
}

/** Returns { key, sv } when the cookie is genuine and not expired, otherwise null. */
export async function readToken(cfg, token, now = Date.now()) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [k, sv, exp, sig] = parts;
  if (!k || !sv || !/^\d+$/.test(exp) || !sig) return null;
  if (Number(exp) < Math.floor(now / 1000)) return null;
  if (!(await safeEqual(sig, await sign(cfg, `${k}.${sv}.${exp}`)))) return null;
  try { return { key: dec.decode(fromB64url(k)), sv }; } catch { return null; }
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

/**
 * Who is making this request? Returns { key, name, admin } or null.
 *   strict (default): also checks the account still exists and the password was not changed since sign-in.
 *                     That costs one small read from R2 (pass `users` if you already loaded the file).
 *   strict:false:     only checks the signature. Used for pictures, which are fetched many times per page.
 */
export async function currentUser(cfg, request, { strict = true, users } = {}) {
  const t = await readToken(cfg, getCookie(request, COOKIE));
  if (!t) return null;
  if (!strict) return { key: t.key, name: t.key, admin: false };
  const map = users || (await loadUsers(cfg.bucket)).data.users;
  const u = map[t.key];
  if (!u || u.sv !== t.sv) return null;
  return { key: t.key, ...publicUser(u) };
}

/** The class access code: needed to create an account. It is the NOTEBOOK_PASSWORD secret. */
export const accessCodeOk = (cfg, attempt) => safeEqual(attempt || '', cfg.password);

const isHttps = (request) => new URL(request.url).protocol === 'https:';

export async function sessionCookie(cfg, request, user) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE}=${await makeToken(cfg, user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

export function clearCookie(request) {
  const secure = isHttps(request) ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
