// Accounts: a small file in your R2 bucket (notebook/users.json) holding each person's name and a
// SCRAMBLED version of their password (a "hash"). The real password is never stored anywhere.
//
//   { v: 1, users: { "ada": { name: "Ada", salt, iter, hash, sv, admin?, createdAt } } }
//
// salt  random text mixed into the password before scrambling, so two people with the same password get different hashes
// iter  how many times the scrambling is repeated (slows down anyone trying to guess passwords from a stolen file)
// sv    "session version": changes when the password changes, which signs that person out on every device
//
// Uses the Web Crypto API that Cloudflare Workers provide (no Node modules).
const USERS_KEY = 'notebook/users.json';

// Cloudflare's free plan gives each request only a few milliseconds of processing time, and scrambling
// takes longer the more times it repeats. 30,000 is a safe middle (about 6 ms). Each account remembers the
// number it was made with, so you can raise this later (paid plans allow up to 100,000) without locking anyone out.
export const HASH_ITERATIONS = 30000;

export const PW_MIN = 6;
export const PW_MAX = 200;

const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomText = (n) => b64(crypto.getRandomValues(new Uint8Array(n))).replace(/[^A-Za-z0-9]/g, '').slice(0, n * 1.2 | 0) || 'x';

/** Names: 2 to 24 characters, letters/numbers first, then letters, numbers, spaces and . _ ' - */
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{1,23}$/u;
export function cleanName(raw) {
  const s = String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  return NAME_RE.test(s) ? s : null;
}
/** "Ada" and "ada" are the same person, so accounts are looked up by the lowercase form. */
export const nameKey = (name) => String(name).toLowerCase();

export function checkPasswordShape(pw) {
  if (typeof pw !== 'string' || pw.length < PW_MIN) return `Use at least ${PW_MIN} characters for the password.`;
  if (pw.length > PW_MAX) return 'That password is too long.';
  return '';
}

async function derive(password, saltB64, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, key, 256);
  return b64(bits);
}

export async function makeUser(name, password, { admin = false } = {}) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const u = { name, salt, iter: HASH_ITERATIONS, hash: await derive(password, salt, HASH_ITERATIONS), sv: randomText(8), createdAt: Date.now() };
  if (admin) u.admin = true;
  return u;
}

/** Give an existing account a new password (and sign it out everywhere else). */
export async function setPassword(user, password) {
  user.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  user.iter = HASH_ITERATIONS;
  user.hash = await derive(password, user.salt, HASH_ITERATIONS);
  user.sv = randomText(8);
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// A pretend account, so that "no such name" takes as long as "wrong password" (people cannot probe which names exist).
const DUMMY = { salt: b64(new Uint8Array(16)), iter: HASH_ITERATIONS, hash: '' };

/** user may be undefined (unknown name): we still do the same work, then say no. */
export async function verifyPassword(user, password) {
  const u = user || DUMMY;
  const h = await derive(String(password == null ? '' : password), u.salt, u.iter || HASH_ITERATIONS);
  return !!user && sameText(h, user.hash);
}

export const publicUser = (u) => ({ name: u.name, admin: !!u.admin });

// ---------------------------------------------------------------- the users file in R2
export async function loadUsers(bucket) {
  const obj = await bucket.get(USERS_KEY);
  if (!obj) return { data: { v: 1, users: {} }, etag: null, raw: '' };
  const raw = await obj.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('notebook/users.json in the bucket is not valid JSON'); }
  return { data: { v: 1, users: (parsed && parsed.users) || {} }, etag: obj.etag || null, raw };
}

/**
 * Save only if nobody else changed the file since we read it. R2 answers null when that check fails.
 *   file exists  -> "only if its etag (version stamp) is still the one we read"
 *   no file yet  -> "only if there is still no file" (the * means any version), so two first sign-ups cannot overwrite each other.
 * If R2 ever refuses that second form we fall back to a plain write: the only cost is a tiny race on the very first account.
 */
async function saveUsers(bucket, data, etag) {
  const meta = { httpMetadata: { contentType: 'application/json' } };
  const text = JSON.stringify(data);
  let res;
  try {
    res = await bucket.put(USERS_KEY, text, { ...meta, onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' } });
  } catch (e) {
    if (etag) throw e;
    res = await bucket.put(USERS_KEY, text, meta);
  }
  return res !== null;
}

/**
 * Read the users file, let `mutate` change it, save. If two people change it at the same moment,
 * the second one re-reads and tries again, so nobody's change is lost.
 * `mutate(data)` returns { abort: <response info> } to stop without saving, or anything else to save.
 */
export async function updateUsers(bucket, mutate) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, etag } = await loadUsers(bucket);
    const out = await mutate(data);
    if (out && out.abort) return out;
    if (await saveUsers(bucket, data, etag)) return out || { ok: true };
  }
  const e = new Error('Several people changed accounts at once. Please try again.');
  e.status = 409;
  throw e;
}
