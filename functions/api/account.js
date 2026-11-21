// POST { action, ... }  everything about accounts after you are signed in.
//   password  { old, password }   change YOUR password (you stay signed in here, other devices are signed out)
//   list      (admin)             who has an account
//   reset     (admin) { name, password }  give someone a new password (they are signed out everywhere)
//   remove    (admin) { name }    delete someone's account (their notes stay, still marked with their name)
import { getConfig } from '../_lib/config.js';
import { currentUser, sessionCookie } from '../_lib/auth.js';
import { cleanName, nameKey, checkPasswordShape, setPassword, verifyPassword, loadUsers, updateUsers } from '../_lib/users.js';
import { json, readJson } from '../_lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  const me = await currentUser(cfg, request);
  if (!me) return json(401, { error: 'unauthorized' });
  let body;
  try { body = await readJson(request, 10_000); } catch (e) { return json(e.status || 400, { error: 'bad_request' }); }

  try {
    if (body.action === 'password') {
      const weak = checkPasswordShape(body.password);
      if (weak) return json(400, { error: 'weak_password', message: weak });
      const out = await updateUsers(cfg.bucket, async (data) => {
        const u = data.users[me.key];
        if (!u) return { abort: true, gone: true };
        if (!(await verifyPassword(u, body.old))) return { abort: true, wrong: true };
        await setPassword(u, body.password);
        return { ok: true, sv: u.sv };
      });
      if (out.gone) return json(401, { error: 'unauthorized' });
      if (out.wrong) { await sleep(800); return json(403, { error: 'wrong_password', message: 'Your current password is not right.' }); }
      return json(200, { ok: true }, { 'Set-Cookie': await sessionCookie(cfg, request, { key: me.key, sv: out.sv }) });
    }

    // everything below is for the admin only
    if (!me.admin) return json(403, { error: 'admin_only', message: 'Only the admin can do that.' });

    if (body.action === 'list') {
      const { data } = await loadUsers(cfg.bucket);
      const people = Object.values(data.users).map((u) => ({ name: u.name, admin: !!u.admin, createdAt: u.createdAt || 0 }))
        .sort((a, b) => (b.admin - a.admin) || (a.createdAt - b.createdAt));
      return json(200, { users: people });
    }

    const target = cleanName(body.name);
    const key = target ? nameKey(target) : '';
    if (body.action === 'reset') {
      const weak = checkPasswordShape(body.password);
      if (weak) return json(400, { error: 'weak_password', message: weak });
      const out = await updateUsers(cfg.bucket, async (data) => {
        const u = data.users[key];
        if (!u) return { abort: true, missing: true };
        await setPassword(u, body.password);
        return { ok: true };
      });
      if (out.missing) return json(404, { error: 'no_such_user', message: 'No account with that name.' });
      // if the admin reset their own password here, keep them signed in on this device
      if (key === me.key) {
        const { data } = await loadUsers(cfg.bucket);
        return json(200, { ok: true }, { 'Set-Cookie': await sessionCookie(cfg, request, { key, sv: data.users[key].sv }) });
      }
      return json(200, { ok: true });
    }
    if (body.action === 'remove') {
      if (key === me.key) return json(400, { error: 'cannot_remove_self', message: 'You cannot remove your own account.' });
      const out = await updateUsers(cfg.bucket, async (data) => {
        if (!data.users[key]) return { abort: true, missing: true };
        delete data.users[key];
        return { ok: true };
      });
      if (out.missing) return json(404, { error: 'no_such_user', message: 'No account with that name.' });
      return json(200, { ok: true });
    }
    return json(400, { error: 'bad_action' });
  } catch (e) {
    return json(e.status || 502, { error: 'storage_error', message: String(e.message || e).slice(0, 300) });
  }
}
