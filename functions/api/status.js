import { getConfig } from '../_lib/config.js';
import { isAuthed } from '../_lib/auth.js';
import { json } from '../_lib/http.js';

// Tells the app which mode to run in. Never reveals secrets, only the NAMES of missing settings.
export async function onRequest({ request, env }) {
  const cfg = getConfig(env);
  if (!cfg.ready) return json(200, { cloud: false, authed: false, missing: cfg.missing, reason: cfg.reason });
  return json(200, { cloud: true, authed: await isAuthed(cfg, request) });
}
