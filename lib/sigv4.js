'use strict';
// AWS Signature Version 4 signer (what Cloudflare R2's S3 API expects).
// Written with node:crypto only, so the project needs no npm packages.
const crypto = require('node:crypto');

const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// RFC 3986 encoding, as AWS requires (encodeURIComponent leaves ! ' ( ) * alone).
function uriEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Sign one request.
 * `path` is the UNencoded path (e.g. "/bucket/notebook/doc.json"); it is encoded here.
 * Returns { headers, canonicalRequest, stringToSign, signature }.
 * `headers` holds everything to send (except Host, which fetch sets itself).
 */
function signRequest(opts) {
  const {
    method, host, path, query = {}, headers = {}, payloadHash,
    accessKeyId, secretAccessKey, region = 'auto', service = 's3', date = new Date(),
  } = opts;

  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const dateStamp = amzDate.slice(0, 8);

  const all = {};
  for (const [k, v] of Object.entries(headers)) all[k.toLowerCase()] = String(v);
  all.host = host;
  all['x-amz-content-sha256'] = payloadHash;
  all['x-amz-date'] = amzDate;

  const names = Object.keys(all).sort();
  const canonicalHeaders = names.map((k) => `${k}:${all[k].trim().replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalQuery = Object.keys(query).sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(String(query[k]))}`).join('&');
  const canonicalPath = path.split('/').map(uriEncode).join('/');

  const canonicalRequest = [method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const out = { ...all };
  delete out.host;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: out, canonicalRequest, stringToSign, signature, canonicalPath };
}

module.exports = { signRequest, sha256hex, uriEncode };
