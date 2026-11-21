import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { merge } from '../functions/_lib/merge.js';
import { cleanNodes, sniffImage } from '../functions/_lib/validate.js';
import { makeToken, verifyToken } from '../functions/_lib/auth.js';
import { getConfig } from '../functions/_lib/config.js';
import * as status from '../functions/api/status.js';
import * as login from '../functions/api/login.js';
import * as logout from '../functions/api/logout.js';
import * as sync from '../functions/api/sync.js';
import * as image from '../functions/api/image.js';

// A tiny in-memory stand-in for an R2 bucket binding (same get/put shape as the real one).
function fakeBucket() {
  const store = new Map();
  return {
    store,
    async get(key) {
      const o = store.get(key);
      if (!o) return null;
      return {
        httpMetadata: { contentType: o.type },
        body: new Blob([o.bytes]).stream(),
        async text() { return new TextDecoder().decode(o.bytes); },
        async arrayBuffer() { return o.bytes.slice().buffer; },
      };
    },
    async put(key, value, opts = {}) {
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      store.set(key, { bytes, type: opts.httpMetadata && opts.httpMetadata.contentType });
    },
  };
}

const BASE = 'https://notebook.test';
const handlers = { status, login, logout, sync, image };
const call = (name, env, path, { method = 'GET', cookie, body, headers = {} } = {}) =>
  handlers[name].onRequest({
    request: new Request(BASE + path, { method, body, headers: { ...(cookie ? { cookie } : {}), ...headers } }),
    env,
  });

test('merge: newer wins, deletes stick, no-change is detected', () => {
  const a = { n1: { id: 'n1', title: 'old', updatedAt: 10 }, n2: { id: 'n2', title: 'keep', updatedAt: 5 } };
  const b = { n1: { id: 'n1', title: 'new', updatedAt: 20 }, n3: { id: 'n3', title: 'fresh', updatedAt: 1 } };
  const m = merge(a, b);
  assert.equal(m.nodes.n1.title, 'new');
  assert.ok(m.nodes.n2 && m.nodes.n3);
  assert.equal(m.changedBase, true);
  const del = merge({ x: { id: 'x', updatedAt: 50, deleted: true } }, { x: { id: 'x', title: 'zombie', updatedAt: 40 } });
  assert.equal(del.nodes.x.deleted, true);
  assert.equal(del.changedBase, false);
  const same = merge(a, a);
  assert.equal(same.changedBase, false);
  assert.equal(same.changedIncoming, false);
});

test('server merge and browser merge (public/merge.js) always agree', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(new URL('../public/merge.js', import.meta.url), 'utf8'), { self: sandbox });
  const browser = sandbox.NBMerge.merge;
  let seed = 7;
  const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  const mk = () => {
    const o = {};
    for (let i = 0; i < rnd(6); i++) {
      const id = 'n' + rnd(5);
      o[id] = { id, title: 't' + rnd(9), updatedAt: rnd(4), ...(rnd(3) === 0 ? { deleted: true } : {}) };
    }
    return o;
  };
  for (let i = 0; i < 500; i++) {
    const a = mk(), b = mk();
    // JSON round-trip: the browser copy runs in a separate sandbox, so compare plain data, not object identity
    assert.deepEqual(JSON.parse(JSON.stringify(merge(a, b))), JSON.parse(JSON.stringify(browser(a, b))));
  }
});

test('validate: drops bad nodes, keeps good ones, trims fields', () => {
  const out = cleanNodes({
    ok: { id: 'ok', type: 'note', title: 'T', body: 'hello', updatedAt: 5, parentId: null },
    bad1: { id: 'bad1', type: 'script', updatedAt: 1 },
    bad2: { id: 'other', type: 'note', updatedAt: 1 },
    bad3: { id: 'bad3', type: 'note', updatedAt: 'NaN' },
    'x y': { id: 'x y', type: 'note', updatedAt: 1 },
  });
  assert.deepEqual(Object.keys(out), ['ok']);
  assert.equal(out.ok.body, 'hello');
});

test('validate: image sniffing rejects non-images', () => {
  assert.equal(sniffImage(new TextEncoder().encode('<html><script>alert(1)</script></html>')), null);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
  assert.equal(sniffImage(png), 'image/png');
  const webp = new Uint8Array([...new TextEncoder().encode('RIFF'), 0, 0, 0, 0, ...new TextEncoder().encode('WEBP'), 0, 0]);
  assert.equal(sniffImage(webp), 'image/webp');
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
});

test('auth tokens: valid, tampered, expired', async () => {
  const cfg = { password: 'pw', sessionSecret: '' };
  const t = await makeToken(cfg);
  assert.equal(await verifyToken(cfg, t), true);
  assert.equal(await verifyToken(cfg, t.slice(0, -2) + 'xx'), false);
  assert.equal(await verifyToken({ password: 'other', sessionSecret: '' }, t), false, 'new password signs sessions out');
  assert.equal(await verifyToken(cfg, t, Date.now() + 40 * 86400 * 1000), false);
});

test('config reports which settings are missing (names only)', () => {
  const c = getConfig({});
  assert.equal(c.ready, false);
  assert.deepEqual(c.missing, ['BUCKET (R2 binding)', 'NOTEBOOK_PASSWORD']);
  assert.equal(getConfig({ BUCKET: fakeBucket(), NOTEBOOK_PASSWORD: 'x' }).ready, true);
});

test('API stays closed (demo mode) when settings are missing', async () => {
  const j = await (await call('status', {}, '/api/status')).json();
  assert.equal(j.cloud, false);
  assert.ok(j.missing.includes('NOTEBOOK_PASSWORD'));
  assert.equal((await call('sync', {}, '/api/sync')).status, 503);
  assert.equal((await call('image', {}, '/api/image?id=abcdef12')).status, 503);
});

test('API end to end against a fake R2 binding', async () => {
  const bucket = fakeBucket();
  const env = { BUCKET: bucket, NOTEBOOK_PASSWORD: 'correct horse' };
  const post = (name, path, cookie, body, extra = {}) => call(name, env, path, { method: 'POST', cookie, body, ...extra });

  let r = await call('status', env, '/api/status');
  assert.deepEqual(await r.json(), { cloud: true, authed: false });

  // everything is locked without a cookie
  assert.equal((await call('sync', env, '/api/sync')).status, 401);
  assert.equal((await call('image', env, '/api/image?id=abcdef12')).status, 401);

  // wrong password, then right password -> cookie
  r = await post('login', '/api/login', null, JSON.stringify({ password: 'nope' }));
  assert.equal(r.status, 401);
  r = await post('login', '/api/login', null, JSON.stringify({ password: 'correct horse' }));
  assert.equal(r.status, 200);
  const setCookie = r.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/); // https request
  const cookie = setCookie.split(';')[0];

  r = await call('status', env, '/api/status', { cookie });
  assert.equal((await r.json()).authed, true);

  // sync: device A pushes a note
  const now = Date.now();
  const noteA = { id: 'n1', type: 'note', parentId: null, title: 'Vitamins', body: 'A D E K', order: 1, createdAt: now, updatedAt: now };
  r = await post('sync', '/api/sync', cookie, JSON.stringify({ nodes: { n1: noteA } }));
  let doc = await r.json();
  assert.equal(r.status, 200);
  assert.equal(doc.rev, 1);
  assert.equal(doc.nodes.n1.body, 'A D E K');

  // device B (empty) pulls it, and a pull must not write
  r = await post('sync', '/api/sync', cookie, JSON.stringify({ nodes: {} }));
  doc = await r.json();
  assert.equal(doc.nodes.n1.title, 'Vitamins');
  assert.equal(doc.rev, 1);

  // GET returns the stored notebook
  r = await call('sync', env, '/api/sync', { cookie });
  assert.equal((await r.json()).nodes.n1.title, 'Vitamins');

  // an older copy cannot overwrite a newer one
  r = await post('sync', '/api/sync', cookie, JSON.stringify({ nodes: { n1: { ...noteA, body: 'STALE', updatedAt: now - 1000 } } }));
  assert.equal((await r.json()).nodes.n1.body, 'A D E K');

  // a junk node is ignored; invalid JSON is a clean 400
  r = await post('sync', '/api/sync', cookie, JSON.stringify({ nodes: { evil: { id: 'evil', type: 'x', updatedAt: 1 } } }));
  assert.equal((await r.json()).nodes.evil, undefined);
  r = await post('sync', '/api/sync', cookie, '{not json');
  assert.equal(r.status, 400);

  // daily backup: pretend the saved file is from yesterday, then change something
  const stored = JSON.parse(new TextDecoder().decode(bucket.store.get('notebook/doc.json').bytes));
  stored.savedAt = '2020-01-01T10:00:00.000Z';
  await bucket.put('notebook/doc.json', JSON.stringify(stored), { httpMetadata: { contentType: 'application/json' } });
  r = await post('sync', '/api/sync', cookie, JSON.stringify({ nodes: { n1: { ...noteA, body: 'NEW', updatedAt: now + 5000 } } }));
  assert.equal(r.status, 200);
  assert.ok(bucket.store.has('notebook/backups/doc-2020-01-01.json'));

  // images: upload, fetch back, reject non-images and bad ids
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(7)]);
  r = await post('image', '/api/image?id=img12345', cookie, png);
  assert.equal(r.status, 200);
  r = await call('image', env, '/api/image?id=img12345', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.match(r.headers.get('cache-control'), /immutable/);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), png);
  assert.equal((await post('image', '/api/image?id=evil1234', cookie, '<html>')).status, 415);
  assert.equal((await call('image', env, '/api/image?id=../../x', { cookie })).status, 400);
  assert.equal((await call('image', env, '/api/image?id=missing99', { cookie })).status, 404);
  const tooBig = new Uint8Array(4 * 1024 * 1024 + 10); tooBig.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal((await post('image', '/api/image?id=huge1234', cookie, tooBig)).status, 413);

  // everything lives under notebook/ in the bucket
  assert.ok([...bucket.store.keys()].every((k) => k.startsWith('notebook/')));

  // logout clears the cookie
  r = await post('logout', '/api/logout', cookie);
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
});

test('cookie has no Secure flag on plain http (local dev)', async () => {
  const env = { BUCKET: fakeBucket(), NOTEBOOK_PASSWORD: 'pw' };
  const r = await login.onRequest({
    request: new Request('http://localhost:8788/api/login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }),
    env,
  });
  assert.equal(r.status, 200);
  assert.ok(!/Secure/.test(r.headers.get('set-cookie')));
});
