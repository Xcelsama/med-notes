// POST { name, password } -> signs you in (sets the session cookie) and says who you are.
import { getConfig } from '../_lib/config.js';
import { sessionCookie } from '../_lib/auth.js';
import { cleanName, nameKey, loadUsers, verifyPassword, publicUser } from '../_lib/users.js';
import { json, readJson } from '../_lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  let body;
  try { body = await readJson(request, 10_000); } catch (e) { return json(e.status || 400, { error: 'bad_request' }); }
  try {
    const name = cleanName(body.name);
    const { data } = await loadUsers(cfg.bucket);
    const user = name ? data.users[nameKey(name)] : undefined;
    // verifyPassword does the same work whether or not the name exists, so timing does not reveal which names are real
    if (!(await verifyPassword(user, body.password))) {
      await sleep(800); // slows down password guessing
      return json(401, { error: 'wrong_login', message: 'Wrong name or password.' });
    }
    return json(200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': await sessionCookie(cfg, request, { key: nameKey(user.name), sv: user.sv }) });
  } catch (e) {
    return json(e.status || 502, { error: 'storage_error', message: String(e.message || e).slice(0, 300) });
  }
}
