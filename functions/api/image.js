// POST /api/image?id=<id>   body = the image bytes   -> stores it in R2
// GET  /api/image?id=<id>                            -> streams it back (needs the login cookie)
import { getConfig } from '../_lib/config.js';
import { currentUser } from '../_lib/auth.js';
import { json, readBytes } from '../_lib/http.js';
import { sniffImage, IMAGE_ID } from '../_lib/validate.js';

const MAX_BYTES = 4 * 1024 * 1024; // the app shrinks pictures well below this before uploading

export async function onRequest({ request, env }) {
  const cfg = getConfig(env);
  if (!cfg.ready) return json(503, { error: 'not_configured', reason: cfg.reason });
  // pictures are fetched many times per page, so only the cookie signature is checked here (no extra read from R2)
  if (!(await currentUser(cfg, request, { strict: false }))) return json(401, { error: 'unauthorized' });

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !IMAGE_ID.test(id)) return json(400, { error: 'bad_id' });
  const key = `notebook/images/${id}`;

  try {
    if (request.method === 'POST' || request.method === 'PUT') {
      const buf = await readBytes(request, MAX_BYTES);
      const type = sniffImage(buf);
      if (!type) return json(415, { error: 'not_an_image' });
      await cfg.bucket.put(key, buf, { httpMetadata: { contentType: type } });
      return json(200, { ok: true, id, bytes: buf.length, type });
    }
    if (request.method === 'GET') {
      const obj = await cfg.bucket.get(key);
      if (!obj) return json(404, { error: 'not_found' });
      // Only sniffed image types are ever stored, so this type is safe to send back.
      const type = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
      return new Response(obj.body, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Cache-Control': 'private, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      });
    }
    return json(405, { error: 'method_not_allowed' });
  } catch (e) {
    const status = e.status || 502;
    return json(status, { error: status === 413 ? 'too_large' : 'storage_error', message: String(e.message || e).slice(0, 300) });
  }
}
