'use strict';
// A fake S3/R2 server for tests: stores objects in memory and checks that requests are signed.
const http = require('node:http');

function startMockS3() {
  const objects = new Map();
  const log = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const auth = req.headers.authorization || '';
    log.push({ method: req.method, url: req.url, auth });
    if (!/^AWS4-HMAC-SHA256 Credential=TESTKEY\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=.*host.*x-amz-content-sha256.*x-amz-date.*, Signature=[0-9a-f]{64}$/.test(auth)) {
      res.statusCode = 403; return res.end('bad signature header');
    }
    const key = decodeURIComponent(req.url.split('?')[0]);
    if (req.method === 'PUT') {
      objects.set(key, { body, type: req.headers['content-type'] || 'application/octet-stream' });
      res.statusCode = 200; return res.end();
    }
    if (req.method === 'GET') {
      const o = objects.get(key);
      if (!o) { res.statusCode = 404; return res.end('<Error><Code>NoSuchKey</Code></Error>'); }
      res.setHeader('Content-Type', o.type); res.statusCode = 200; return res.end(o.body);
    }
    res.statusCode = 405; res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}`, objects, log, close: () => new Promise((r) => server.close(r)),
    }));
  });
}

module.exports = { startMockS3 };
