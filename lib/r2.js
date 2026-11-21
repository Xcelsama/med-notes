'use strict';
// Tiny Cloudflare R2 client (S3-compatible API, path-style URLs).
const { signRequest, sha256hex, uriEncode } = require('./sigv4');

const EMPTY_HASH = sha256hex('');

/** Read the R2 settings from environment variables and say what is missing. */
function getConfig(env = process.env) {
  const missing = [];
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  let endpoint = env.R2_ENDPOINT;
  if (!endpoint && env.R2_ACCOUNT_ID) endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  if (!env.R2_ACCOUNT_ID && !env.R2_ENDPOINT) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_BUCKET');
  if (!env.NOTEBOOK_PASSWORD) missing.push('NOTEBOOK_PASSWORD');

  if (missing.length) return { ready: false, missing, reason: 'Missing environment variables: ' + missing.join(', ') };
  return {
    ready: true, missing: [], endpoint: endpoint.replace(/\/+$/, ''),
    accessKeyId, secretAccessKey, bucket, password: env.NOTEBOOK_PASSWORD,
    sessionSecret: env.SESSION_SECRET || '',
  };
}

async function r2Fetch(cfg, method, key, { body, contentType } = {}) {
  const url = new URL(cfg.endpoint);
  const path = '/' + [cfg.bucket, ...key.split('/')].join('/');
  const payloadHash = body ? sha256hex(body) : EMPTY_HASH;
  const headers = {};
  if (contentType) headers['content-type'] = contentType;
  const signed = signRequest({
    method, host: url.host, path, headers, payloadHash,
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
  });
  const full = `${url.protocol}//${url.host}${path.split('/').map(uriEncode).join('/')}`;
  return fetch(full, { method, headers: signed.headers, body: body || undefined, signal: AbortSignal.timeout(20000) });
}

/** Returns { buffer, contentType } or null when the object does not exist. */
async function getObject(cfg, key) {
  const res = await r2Fetch(cfg, 'GET', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET ${key} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

async function putObject(cfg, key, buffer, contentType) {
  const res = await r2Fetch(cfg, 'PUT', key, { body: buffer, contentType });
  if (!res.ok) throw new Error(`R2 PUT ${key} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

module.exports = { getConfig, getObject, putObject };
