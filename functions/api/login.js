import { getConfig } from '../_lib/config.js';
import { passwordOk, sessionCookie } from '../_lib/auth.js';
import { json, readJson } from '../_lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  let body;
  try { body = await readJson(request, 10_000); } catch (e) { return json(e.status || 400, { error: 'bad_request' }); }
  if (!(await passwordOk(cfg, body.password))) {
    await sleep(800); // slows down password guessing
    return json(401, { error: 'wrong_password' });
  }
  return json(200, { ok: true }, { 'Set-Cookie': await sessionCookie(cfg, request) });
}
