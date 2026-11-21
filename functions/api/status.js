import { getConfig } from '../_lib/config.js';
import { currentUser } from '../_lib/auth.js';
import { loadUsers } from '../_lib/users.js';
import { json } from '../_lib/http.js';

// Tells the app which mode to run in and who is signed in. Never reveals secrets, only the NAMES of missing settings.
//   setup: true  -> nobody has an account yet, so the app offers "create the first account"
export async function onRequest({ request, env }) {
  const cfg = getConfig(env);
  if (!cfg.ready) return json(200, { cloud: false, authed: false, missing: cfg.missing, reason: cfg.reason });
  try {
    const { data } = await loadUsers(cfg.bucket);
    const user = await currentUser(cfg, request, { users: data.users });
    const out = { cloud: true, authed: !!user, setup: Object.keys(data.users).length === 0 };
    if (user) out.user = { name: user.name, admin: user.admin };
    return json(200, out);
  } catch (e) {
    return json(502, { error: 'storage_error', message: String(e.message || e).slice(0, 300) });
  }
}
