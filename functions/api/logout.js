import { clearCookie } from '../_lib/auth.js';
import { json } from '../_lib/http.js';

export async function onRequest({ request }) {
  return json(200, { ok: true }, { 'Set-Cookie': clearCookie(request) });
}
