'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { signRequest, sha256hex } = require('../lib/sigv4');
const { merge } = require('../public/merge.js');
const { cleanNodes, sniffImage } = require('../lib/validate');
const { makeToken, verifyToken } = require('../lib/auth');
const { getConfig } = require('../lib/r2');
const { startMockS3 } = require('./mock-s3');
const { createServer } = require('../scripts/dev');

test('SigV4 signer matches the official AWS documentation example', () => {
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html (GET Object with Range)
  const r = signRequest({
    method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt',
    headers: { range: 'bytes=0-9' }, payloadHash: sha256hex(''),
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', service: 's3', date: new Date('2013-05-24T00:00:00Z'),
  });
  assert.equal(r.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
});

test('SigV4 encodes odd characters in paths', () => {
  const r = signRequest({
    method: 'GET', host: 'h', path: '/b/a b/c!.txt', payloadHash: sha256hex(''),
    accessKeyId: 'k', secretAccessKey: 's', date: new Date('2026-01-01T00:00:00Z'),
  });
  assert.equal(r.canonicalPath, '/b/a%20b/c%21.txt');
});

test('merge: newer wins, deletes stick, no-change is detected', () => {
  const a = { n1: { id: 'n1', title: 'old', updatedAt: 10 }, n2: { id: 'n2', title: 'keep', updatedAt: 5 } };
  const b = { n1: { id: 'n1', title: 'new', updatedAt: 20 }, n3: { id: 'n3', title: 'fresh', updatedAt: 1 } };
  const m = merge(a, b);
  assert.equal(m.nodes.n1.title, 'new');
  assert.ok(m.nodes.n2 && m.nodes.n3);
  assert.equal(m.changedBase, true);

  const del = merge({ x: { id: 'x', updatedAt: 50, deleted: true } }, { x: { id: 'x', title: 'zombie', updatedAt: 40 } });
  assert.equal(del.nodes.x.deleted, true, 'an older copy must not resurrect a deleted node');
  assert.equal(del.changedBase, false);

  const same = merge(a, a);
  assert.equal(same.changedBase, false);
  assert.equal(same.changedIncoming, false);
});

test('validate: drops bad nodes, keeps good ones, trims fields', () => {
  const out = cleanNodes({
    ok: { id: 'ok', type: 'note', title: 'T', body: 'hello', updatedAt: 5, parentId: null },
    bad1: { id: 'bad1', type: 'script', updatedAt: 1 },
    bad2: { id: 'other', type: 'note', updatedAt: 1 },          // key/id mismatch
    bad3: { id: 'bad3', type: 'note', updatedAt: 'NaN' },
    'x y': { id: 'x y', type: 'note', updatedAt: 1 },
  });
  assert.deepEqual(Object.keys(out), ['ok']);
  assert.equal(out.ok.body, 'hello');
});

test('validate: image sniffing rejects non-images', () => {
  assert.equal(sniffImage(Buffer.from('<html><script>alert(1)</script></html>')), null);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(sniffImage(png), 'image/png');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(10)]);
  assert.equal(sniffImage(webp), 'image/webp');
});

test('auth tokens: valid, tampered, expired', () => {
  const cfg = { password: 'pw', sessionSecret: '' };
  const t = makeToken(cfg);
  assert.equal(verifyToken(cfg, t), true);
  assert.equal(verifyToken(cfg, t.slice(0, -2) + 'xx'), false);
  assert.equal(verifyToken({ password: 'other', sessionSecret: '' }, t), false, 'new password signs sessions out');
  assert.equal(verifyToken(cfg, t, Date.now() + 40 * 86400 * 1000), false);
});

test('config reports which variables are missing (names only)', () => {
  const c = getConfig({ R2_BUCKET: 'b' });
  assert.equal(c.ready, false);
  assert.ok(c.missing.includes('R2_ACCESS_KEY_ID') && c.missing.includes('NOTEBOOK_PASSWORD'));
});

test('API end to end against a mock R2', async () => {
  const s3 = await startMockS3();
  Object.assign(process.env, {
    R2_ENDPOINT: s3.url, R2_ACCESS_KEY_ID: 'TESTKEY', R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'my-bucket', NOTEBOOK_PASSWORD: 'correct horse',
  });
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // status says cloud is on, not signed in
    let r = await fetch(base + '/api/status');
    assert.deepEqual(await r.json(), { cloud: true, authed: false });

    // everything is locked without a cookie
    assert.equal((await fetch(base + '/api/sync')).status, 401);
    assert.equal((await fetch(base + '/api/image?id=abcdef12')).status, 401);

    // wrong password
    r = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'nope' }) });
    assert.equal(r.status, 401);

    // right password -> cookie
    r = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse' }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    assert.match(r.headers.get('set-cookie'), /HttpOnly/);
    const H = { cookie, 'content-type': 'application/json' };

    r = await fetch(base + '/api/status', { headers: { cookie } });
    assert.equal((await r.json()).authed, true);

    // sync: device A pushes a note
    const now = Date.now();
    const noteA = { id: 'n1', type: 'note', parentId: null, title: 'Vitamins', body: 'A D E K', order: 1, createdAt: now, updatedAt: now };
    r = await fetch(base + '/api/sync', { method: 'POST', headers: H, body: JSON.stringify({ nodes: { n1: noteA } }) });
    let doc = await r.json();
    assert.equal(r.status, 200);
    assert.equal(doc.rev, 1);
    assert.equal(doc.nodes.n1.body, 'A D E K');

    // device B (empty) pulls it
    r = await fetch(base + '/api/sync', { method: 'POST', headers: H, body: JSON.stringify({ nodes: {} }) });
    doc = await r.json();
    assert.equal(doc.nodes.n1.title, 'Vitamins');
    assert.equal(doc.rev, 1, 'a pull must not write');

    // an older copy cannot overwrite a newer one
    r = await fetch(base + '/api/sync', { method: 'POST', headers: H, body: JSON.stringify({ nodes: { n1: { ...noteA, body: 'STALE', updatedAt: now - 1000 } } }) });
    assert.equal((await r.json()).nodes.n1.body, 'A D E K');

    // a junk node is ignored
    r = await fetch(base + '/api/sync', { method: 'POST', headers: H, body: JSON.stringify({ nodes: { evil: { id: 'evil', type: 'x', updatedAt: 1 } } }) });
    assert.equal((await r.json()).nodes.evil, undefined);

    // images: upload, fetch back, reject non-images
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
    r = await fetch(base + '/api/image?id=img12345', { method: 'POST', headers: { cookie, 'content-type': 'application/octet-stream' }, body: png });
    assert.equal(r.status, 200);
    r = await fetch(base + '/api/image?id=img12345', { headers: { cookie } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.match(r.headers.get('cache-control'), /immutable/);
    assert.ok(Buffer.from(await r.arrayBuffer()).equals(png));
    r = await fetch(base + '/api/image?id=evil1234', { method: 'POST', headers: { cookie, 'content-type': 'application/octet-stream' }, body: '<html>' });
    assert.equal(r.status, 415);
    r = await fetch(base + '/api/image?id=../../x', { headers: { cookie } });
    assert.equal(r.status, 400);
    assert.equal((await fetch(base + '/api/image?id=missing99', { headers: { cookie } })).status, 404);

    // everything stored under the notebook/ prefix of the right bucket, all requests signed
    assert.ok(s3.objects.has('/my-bucket/notebook/doc.json'));
    assert.ok(s3.objects.has('/my-bucket/notebook/images/img12345'));
    assert.ok(s3.log.every((l) => l.auth.startsWith('AWS4-HMAC-SHA256')));

    // logout clears the cookie
    r = await fetch(base + '/api/logout', { method: 'POST', headers: { cookie } });
    assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  } finally {
    server.close(); await s3.close();
    for (const k of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'NOTEBOOK_PASSWORD']) delete process.env[k];
  }
});

test('API stays closed (demo mode) when variables are missing', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const j = await (await fetch(base + '/api/status')).json();
    assert.equal(j.cloud, false);
    assert.ok(j.missing.includes('NOTEBOOK_PASSWORD'));
    assert.equal((await fetch(base + '/api/sync')).status, 503);
  } finally { server.close(); }
});
