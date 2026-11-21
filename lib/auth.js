'use strict';
// Single-password gate: a signed, HttpOnly cookie. No accounts, no database.
const crypto = require('node:crypto');

const COOKIE = 'nb_session';
const DAYS = 30;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function secretFor(cfg) {
  // If SESSION_SECRET is not set, derive one from the password: changing the password signs everyone out.
  return cfg.sessionSecret || crypto.createHash('sha256').update('nb-session|' + cfg.password).digest('hex');
}

function sign(cfg, exp) {
  return b64url(crypto.createHmac('sha256', secretFor(cfg)).update('nb1.' + exp).digest());
}

function makeToken(cfg, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DAYS * 86400;
  return `${exp}.${sign(cfg, exp)}`;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function verifyToken(cfg, token, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(now / 1000)) return false;
  return safeEqual(sig, sign(cfg, exp));
}

function getCookie(req, name) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

const isAuthed = (cfg, req) => verifyToken(cfg, getCookie(req, COOKIE));
const passwordOk = (cfg, attempt) => safeEqual(attempt || '', cfg.password);

function isHttps(req) {
  const proto = (req.headers && req.headers['x-forwarded-proto']) || '';
  return proto.split(',')[0].trim() === 'https';
}

function sessionCookie(cfg, req) {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE}=${makeToken(cfg)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure}`;
}

function clearCookie(req) {
  const secure = isHttps(req) ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

module.exports = { isAuthed, passwordOk, sessionCookie, clearCookie, makeToken, verifyToken, getCookie };
