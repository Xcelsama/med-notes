// Small helpers shared by the API functions.
export function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Read the request body as bytes, refusing anything over `limit`. */
export async function readBytes(request, limit = 4 * 1024 * 1024) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > limit) { const e = new Error('Request body too large'); e.status = 413; throw e; }
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length > limit) { const e = new Error('Request body too large'); e.status = 413; throw e; }
  return buf;
}

export async function readJson(request, limit) {
  const buf = await readBytes(request, limit);
  if (!buf.length) return {};
  try { return JSON.parse(new TextDecoder().decode(buf)); }
  catch { const e = new Error('Invalid JSON'); e.status = 400; throw e; }
}
