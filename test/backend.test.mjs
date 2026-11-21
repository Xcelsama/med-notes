import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { merge } from '../functions/_lib/merge.js';
import { cleanNodes, sniffImage } from '../functions/_lib/validate.js';
import { makeToken, readToken } from '../functions/_lib/auth.js';
import { stampAuthors } from '../functions/_lib/authors.js';
import { cleanName } from '../functions/_lib/users.js';
import { getConfig } from '../functions/_lib/config.js';
import * as status from '../functions/api/status.js';
import * as login from '../functions/api/login.js';
import * as logout from '../functions/api/logout.js';
import * as register from '../functions/api/register.js';
import * as account from '../functions/api/account.js';
import * as sync from '../functions/api/sync.js';
import * as image from '../functions/api/image.js';

// A tiny in-memory stand-in for an R2 bucket binding (same get/put shape as the real one).
function fakeBucket() {
  const store = new Map();
  let etagN = 0;
  return {
    store,
    async get(key) {
      const o = store.get(key);
      if (!o) return null;
      return {
        etag: o.etag,
        httpMetadata: { contentType: o.type },
        body: new Blob([o.bytes]).stream(),
        async text() { return new TextDecoder().decode(o.bytes); },
        async arrayBuffer() { return o.bytes.slice().buffer; },
      };
    },
    async put(key, value, opts = {}) {
      const cur = store.get(key);
      const c = opts.onlyIf || {};
      if (c.etagMatches && (!cur || cur.etag !== c.etagMatches)) return null;   // like R2: null = condition failed
      if (c.etagDoesNotMatch === '*' && cur) return null;
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      store.set(key, { bytes, type: opts.httpMetadata && opts.httpMetadata.contentType, etag: 'e' + (++etagN) });
    },
  };
}

const BASE = 'https://notebook.test';
const handlers = { status, login, logout, sync, image, register, account };
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

test('session tokens: valid, tampered, expired, tied to the account', async () => {
  const cfg = { password: 'code', sessionSecret: '' };
  const t = await makeToken(cfg, { key: 'ada', sv: 'abc123' });
  assert.deepEqual(await readToken(cfg, t), { key: 'ada', sv: 'abc123' });
  assert.equal(await readToken(cfg, t.slice(0, -2) + 'xx'), null, 'edited signature');
  const [k, sv, exp, sig] = t.split('.');
  const bob = Buffer.from('bob').toString('base64url');
  assert.equal(await readToken(cfg, [bob, sv, exp, sig].join('.')), null, 'cannot swap in another name');
  assert.equal(await readToken({ password: 'other', sessionSecret: '' }, t), null, 'new access code signs sessions out');
  assert.equal(await readToken(cfg, t, Date.now() + 40 * 86400 * 1000), null, 'expired');
  assert.equal(await readToken(cfg, 'junk'), null);
});

test('names: trimmed, limited, case-insensitive handled by key', () => {
  assert.equal(cleanName('  Ada   Obi '), 'Ada Obi');
  assert.equal(cleanName('A'), null);
  assert.equal(cleanName('x'.repeat(25)), null);
  assert.equal(cleanName('<script>'), null);
  assert.equal(cleanName('Chidi_O.'), 'Chidi_O.');
  assert.equal(cleanName(null), null);
});

test('stampAuthors: names come from the session, not the browser', () => {
  const base = {
    old: { id: 'old', createdBy: 'Ada', by: 'Ada', updatedAt: 1 },
    legacy: { id: 'legacy', updatedAt: 1 },
  };
  const incoming = {
    fresh: { id: 'fresh', by: 'Somebody Else', createdBy: 'Somebody Else', updatedAt: 5 },          // new note: forged names are replaced
    old: { id: 'old', createdBy: 'Mallory', by: 'Mallory', updatedAt: 5 },                           // forged: createdBy locked, by = sender
    legacy: { id: 'legacy', by: 'Bob', createdBy: 'Bob', updatedAt: 5 },                             // legacy note: cannot claim createdBy
  };
  const merged = { fresh: incoming.fresh, old: incoming.old, legacy: incoming.legacy };
  stampAuthors(merged, base, incoming, 'Bob');
  assert.equal(merged.fresh.by, 'Bob');
  assert.equal(merged.fresh.createdBy, 'Bob');
  assert.equal(merged.old.createdBy, 'Ada');
  assert.equal(merged.old.by, 'Bob');
  assert.equal(merged.legacy.createdBy, undefined);
  assert.equal(merged.legacy.by, 'Bob');

  // a star/move (not an edit) keeps the previous 'saved by', even though a different person sent it
  const inc2 = { old: { id: 'old', createdBy: 'Ada', by: 'Ada', starred: true, updatedAt: 9 } };
  const m2 = { old: inc2.old };
  stampAuthors(m2, base, inc2, 'Bob');
  assert.equal(m2.old.by, 'Ada');

  // a copy that lost the merge is left alone
  const stored = { id: 'old', by: 'Ada', updatedAt: 99 };
  const m3 = { old: stored };
  stampAuthors(m3, base, { old: { id: 'old', by: 'Eve', updatedAt: 3 } }, 'Eve');
  assert.equal(m3.old.by, 'Ada');
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
  assert.deepEqual(await r.json(), { cloud: true, authed: false, setup: true });

  // everything is locked without a cookie
  assert.equal((await call('sync', env, '/api/sync')).status, 401);
  assert.equal((await call('image', env, '/api/image?id=abcdef12')).status, 401);

  // creating the first account needs the access code; the first account is the admin
  const reg = (b) => post('register', '/api/register', null, JSON.stringify(b));
  assert.equal((await reg({ name: 'Excel', password: 'secret1', code: 'wrong' })).status, 403);
  assert.equal((await reg({ name: 'X', password: 'secret1', code: 'correct horse' })).status, 400, 'name too short');
  assert.equal((await reg({ name: 'Excel', password: '123', code: 'correct horse' })).status, 400, 'password too short');
  r = await reg({ name: 'Excel', password: 'secret1', code: 'correct horse' });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).user, { name: 'Excel', admin: true });
  assert.equal((await call('status', env, '/api/status')).status, 200);
  assert.equal((await (await call('status', env, '/api/status')).json()).setup, false);
  // the stored file holds a hash, never the password
  const usersFile = new TextDecoder().decode(bucket.store.get('notebook/users.json').bytes);
  assert.ok(!usersFile.includes('secret1'));
  assert.equal((await reg({ name: 'excel', password: 'another1', code: 'correct horse' })).status, 409, 'same name in any case is taken');

  // wrong name / wrong password look the same, then the right ones -> cookie
  r = await post('login', '/api/login', null, JSON.stringify({ name: 'Excel', password: 'nope' }));
  assert.equal(r.status, 401);
  r = await post('login', '/api/login', null, JSON.stringify({ name: 'Nobody', password: 'secret1' }));
  assert.equal(r.status, 401);
  r = await post('login', '/api/login', null, JSON.stringify({ name: 'EXCEL', password: 'secret1' }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.name, 'Excel');
  const setCookie = r.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/); // https request
  const cookie = setCookie.split(';')[0];

  r = await call('status', env, '/api/status', { cookie });
  const st = await r.json();
  assert.equal(st.authed, true);
  assert.deepEqual(st.user, { name: 'Excel', admin: true });

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
  const r = await register.onRequest({
    request: new Request('http://localhost:8788/api/register', { method: 'POST', body: JSON.stringify({ name: 'Local', password: 'secret1', code: 'pw' }) }),
    env,
  });
  assert.equal(r.status, 200);
  assert.ok(!/Secure/.test(r.headers.get('set-cookie')));
});

test('several people: own passwords, "saved by", admin tools, sign-out on password change', async () => {
  const bucket = fakeBucket();
  const env = { BUCKET: bucket, NOTEBOOK_PASSWORD: 'class-code' };
  const send = async (name, path, body, cookie) => {
    const r = await call(name, env, path, { method: 'POST', cookie, body: JSON.stringify(body) });
    return { r, j: await r.clone().json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const ada = await send('register', '/api/register', { name: 'Ada', password: 'ada-pass', code: 'class-code' });
  const bob = await send('register', '/api/register', { name: 'Bob', password: 'bob-pass', code: 'class-code' });
  assert.equal(ada.j.user.admin, true);
  assert.equal(bob.j.user.admin, false);

  // each person's note carries THEIR name, even if the browser claims another one
  const t = Date.now();
  const mk = (id, by, extra = {}) => ({ id, type: 'note', parentId: null, title: id, body: 'x', order: 1, createdAt: t, updatedAt: t, by, createdBy: by, ...extra });
  let s = await send('sync', '/api/sync', { nodes: { a1: mk('a1', 'Ada') } }, ada.cookie);
  assert.equal(s.j.nodes.a1.by, 'Ada');
  s = await send('sync', '/api/sync', { nodes: { b1: mk('b1', 'Ada') } }, bob.cookie);   // Bob pretends to be Ada
  assert.equal(s.j.nodes.b1.by, 'Bob');
  assert.equal(s.j.nodes.b1.createdBy, 'Bob');
  assert.equal(s.j.nodes.a1.by, 'Ada');
  // Bob edits Ada's note: saved by Bob now, started by Ada still
  s = await send('sync', '/api/sync', { nodes: { a1: mk('a1', 'Bob', { body: 'edited', updatedAt: t + 10, createdBy: 'Bob' }) } }, bob.cookie);
  assert.equal(s.j.nodes.a1.by, 'Bob');
  assert.equal(s.j.nodes.a1.createdBy, 'Ada');
  // a full push of unchanged copies does not re-stamp anybody
  const all = (await send('sync', '/api/sync', { nodes: {} }, ada.cookie)).j.nodes;
  s = await send('sync', '/api/sync', { nodes: all }, ada.cookie);
  assert.equal(s.j.nodes.a1.by, 'Bob');
  assert.equal(s.j.nodes.b1.by, 'Bob');

  // only the admin can manage people
  assert.equal((await send('account', '/api/account', { action: 'list' }, bob.cookie)).r.status, 403);
  const list = await send('account', '/api/account', { action: 'list' }, ada.cookie);
  assert.deepEqual(list.j.users.map((u) => u.name), ['Ada', 'Bob']);
  assert.equal((await send('account', '/api/account', { action: 'remove', name: 'Ada' }, ada.cookie)).r.status, 400, 'cannot remove yourself');
  assert.equal((await send('account', '/api/account', { action: 'nonsense' }, ada.cookie)).r.status, 400);

  // Bob changes his password: needs the old one; his old cookie dies, the new cookie works
  assert.equal((await send('account', '/api/account', { action: 'password', old: 'wrong', password: 'bob-new1' }, bob.cookie)).r.status, 403);
  const ch = await send('account', '/api/account', { action: 'password', old: 'bob-pass', password: 'bob-new1' }, bob.cookie);
  assert.equal(ch.r.status, 200);
  assert.equal((await call('sync', env, '/api/sync', { cookie: bob.cookie })).status, 401, 'old session is signed out');
  assert.equal((await call('sync', env, '/api/sync', { cookie: ch.cookie })).status, 200);
  assert.equal((await send('login', '/api/login', { name: 'Bob', password: 'bob-pass' })).r.status, 401);
  assert.equal((await send('login', '/api/login', { name: 'Bob', password: 'bob-new1' })).r.status, 200);

  // admin resets Bob, then removes him: his sessions stop working, his notes stay and keep his name
  assert.equal((await send('account', '/api/account', { action: 'reset', name: 'Bob', password: 'temp-pass1' }, ada.cookie)).r.status, 200);
  assert.equal((await call('sync', env, '/api/sync', { cookie: ch.cookie })).status, 401);
  const login2 = await send('login', '/api/login', { name: 'Bob', password: 'temp-pass1' });
  assert.equal(login2.r.status, 200);
  assert.equal((await send('account', '/api/account', { action: 'remove', name: 'Bob' }, ada.cookie)).r.status, 200);
  assert.equal((await call('sync', env, '/api/sync', { cookie: login2.cookie })).status, 401);
  assert.equal((await call('image', env, '/api/image?id=abcdef12', { cookie: login2.cookie })).status, 404, 'pictures only check the signature (cheap), so a removed person gets "not found", never data');
  const final = await (await call('sync', env, '/api/sync', { cookie: ada.cookie })).json();
  assert.equal(final.nodes.b1.by, 'Bob');
});

test('two accounts created at the same moment are both kept', async () => {
  const bucket = fakeBucket();
  const env = { BUCKET: bucket, NOTEBOOK_PASSWORD: 'c' };
  const reg = (name) => call('register', env, '/api/register', { method: 'POST', body: JSON.stringify({ name, password: 'password1', code: 'c' }) });
  const rs = await Promise.all([reg('Ann'), reg('Ben'), reg('Cy')]);
  assert.ok(rs.every((r) => r.status === 200), 'all succeed');
  const users = JSON.parse(new TextDecoder().decode(bucket.store.get('notebook/users.json').bytes)).users;
  assert.deepEqual(Object.keys(users).sort(), ['ann', 'ben', 'cy']);
  assert.equal(Object.values(users).filter((u) => u.admin).length, 1, 'exactly one admin');
});
