// POST { name, password, code } -> creates an account and signs you in.
// "code" is the class access code (the NOTEBOOK_PASSWORD secret), so only people you gave it to can join.
// The very first account becomes the admin, who can reset passwords and remove people.
import { getConfig } from '../_lib/config.js';
import { accessCodeOk, sessionCookie } from '../_lib/auth.js';
import { cleanName, nameKey, checkPasswordShape, makeUser, updateUsers, publicUser } from '../_lib/users.js';
import { json, readJson } from '../_lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  let body;
  try { body = await readJson(request, 10_000); } catch (e) { return json(e.status || 400, { error: 'bad_request' }); }

  const name = cleanName(body.name);
  if (!name) return json(400, { error: 'bad_name', message: 'Use 2 to 24 letters or numbers for your name (spaces, . _ - are fine).' });
  const weak = checkPasswordShape(body.password);
  if (weak) return json(400, { error: 'weak_password', message: weak });
  if (!(await accessCodeOk(cfg, body.code))) {
    await sleep(800);
    return json(403, { error: 'wrong_code', message: 'That access code is not right.' });
  }

  try {
    const key = nameKey(name);
    const made = await updateUsers(cfg.bucket, async (data) => {
      if (data.users[key]) return { abort: true, taken: true };
      const first = Object.keys(data.users).length === 0;
      const user = await makeUser(name, body.password, { admin: first });
      data.users[key] = user;
      return { ok: true, user };
    });
    if (made.taken) return json(409, { error: 'name_taken', message: 'Someone already has that name. Pick another, or sign in.' });
    return json(200, { ok: true, user: publicUser(made.user) }, { 'Set-Cookie': await sessionCookie(cfg, request, { key, sv: made.user.sv }) });
  } catch (e) {
    return json(e.status || 502, { error: 'storage_error', message: String(e.message || e).slice(0, 300) });
  }
}
