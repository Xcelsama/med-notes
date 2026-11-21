'use strict';
// Small helpers that work both on Vercel and in the local dev server.

function send(res, status, data, extraHeaders = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.statusCode = status;
  if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(body);
}

/** Read the request body as a Buffer. Vercel may already have read it into req.body. */
async function readBody(req, limit = 4 * 1024 * 1024) {
  let buf;
  if (Buffer.isBuffer(req.body)) buf = req.body;
  else if (typeof req.body === 'string') buf = Buffer.from(req.body);
  else if (req.body && typeof req.body === 'object') buf = Buffer.from(JSON.stringify(req.body));
  else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) { const e = new Error('Request body too large'); e.status = 413; throw e; }
      chunks.push(chunk);
    }
    buf = Buffer.concat(chunks);
  }
  if (buf.length > limit) { const e = new Error('Request body too large'); e.status = 413; throw e; }
  return buf;
}

async function readJson(req, limit) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); }
  catch { const e = new Error('Invalid JSON'); e.status = 400; throw e; }
}

const query = (req) => Object.fromEntries(new URL(req.url, 'http://x').searchParams);

module.exports = { send, readBody, readJson, query };
